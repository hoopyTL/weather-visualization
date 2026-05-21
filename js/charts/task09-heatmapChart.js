/**
 * Task 09 – Heatmap: So sánh thời tiết giữa các vùng
 * 
 * Chart: Heatmap matrix
 * Rows: region | Columns: metrics (temp, humidity, wind, precip, UV)
 * Interactions: hover tooltip, click to highlight row
 * 
 * @module task09-heatmapChart
 */

import { createSvg, getMargin, getDimensions, regionShort, regionColor, formatTemp, formatPercent, formatWind, formatPrecip, formatUV, addResizeObserver } from '../utils.js?v=2';
import { Tooltip } from '../components/tooltip.js?v=2';

const CONTAINER = '#chart-task09';
const tooltip = new Tooltip();

const METRICS = [
  { key: 'avgTemp', label: 'Nhiệt độ TB', format: formatTemp },
  { key: 'maxWind', label: 'Tốc độ gió', format: formatWind },
  { key: 'totalPrecip', label: 'Lượng mưa', format: formatPrecip },
  { key: 'avgHumidity', label: 'Độ ẩm TB', format: formatPercent },
  { key: 'uv', label: 'Chỉ số UV', format: formatUV }
];

let _lastData = null;
let _lastOptions = null;

export function init() {
  if (!init.observed) {
    addResizeObserver(CONTAINER, () => {
      if (_lastData) {
        render(_lastData, _lastOptions);
      }
    });
    init.observed = true;
  }
  console.log('📊 Task 09 – Heatmap initialized');
}

export function render(data, options = {}) {
  _lastData = data;
  _lastOptions = options;

  if (!data || data.length === 0) {
    showPlaceholder('🟥', 'Không có dữ liệu thời tiết');
    return;
  }

  const container = document.querySelector(CONTAINER);
  if (container) {
    container.querySelector('.chart-placeholder')?.remove();
  }

  // 1. Group data by region and compute averages
  const regionNames = [...new Set(data.map(d => d.region))].filter(Boolean).sort();
  if (regionNames.length === 0) {
    showPlaceholder('🟥', 'Không có dữ liệu vùng miền');
    return;
  }

  const regionMeans = regionNames.map(region => {
    const subset = data.filter(d => d.region === region);
    const meanObj = { region };
    METRICS.forEach(m => {
      meanObj[m.key] = d3.mean(subset, d => d[m.key]) || 0;
    });
    return meanObj;
  });

  // 2. Perform independent column-based normalization
  const columnExtents = {};
  METRICS.forEach(m => {
    const values = regionMeans.map(d => d[m.key]);
    const minVal = d3.min(values) || 0;
    const maxVal = d3.max(values) || 1;
    columnExtents[m.key] = { min: minVal, max: maxVal };
  });

  const getNormalizedValue = (key, val) => {
    const { min, max } = columnExtents[key];
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (val - min) / (max - min)));
  };

  // 3. Layout configuration based on responsive screen width
  const margin = { top: 40, right: 20, bottom: 20, left: 160 };
  const dim = getDimensions(CONTAINER, margin);
  if (dim.width === 0) return;
  const isNarrow = dim.width < 500;

  if (isNarrow) {
    margin.left = 90;
    dim.innerWidth = dim.width - margin.left - margin.right;
  }

  let svg = d3.select(CONTAINER).select('svg');
  let g;

  if (svg.empty() || +svg.attr('width') !== dim.width) {
    g = createSvg(CONTAINER, dim.width, dim.height, margin);
    svg = d3.select(CONTAINER).select('svg');
  } else {
    g = svg.select('g');
  }

  // 4. Setup Band Scales
  const xScale = d3.scaleBand()
    .domain(METRICS.map(m => m.key))
    .range([0, dim.innerWidth])
    .padding(0.06);

  const yScale = d3.scaleBand()
    .domain(regionNames)
    .range([0, dim.innerHeight])
    .padding(0.08);

  // 5. Draw Axes (with dynamic abbreviation on narrow screens)
  let xAxisG = g.select('.x-axis');
  if (xAxisG.empty()) {
    xAxisG = g.append('g').attr('class', 'x-axis');
  }
  xAxisG.call(d3.axisTop(xScale).tickFormat(key => METRICS.find(m => m.key === key).label))
    .selectAll('text')
    .style('font-size', 'var(--fs-xs)')
    .style('fill', 'var(--color-text-secondary)')
    .style('font-weight', 'var(--fw-medium)');

  xAxisG.select('.domain').remove();
  xAxisG.selectAll('line').remove();

  let yAxisG = g.select('.y-axis');
  if (yAxisG.empty()) {
    yAxisG = g.append('g').attr('class', 'y-axis');
  }
  yAxisG.call(d3.axisLeft(yScale).tickFormat(r => isNarrow ? regionShort(r) : r))
    .selectAll('text')
    .style('font-size', 'var(--fs-xs)')
    .style('fill', 'var(--color-text-secondary)')
    .style('font-weight', 'var(--fw-medium)');

  yAxisG.select('.domain').remove();
  yAxisG.selectAll('line').remove();

  // Flatten cell data for easy binding
  const cellData = [];
  regionMeans.forEach(r => {
    METRICS.forEach(m => {
      const val = r[m.key];
      const normVal = getNormalizedValue(m.key, val);
      cellData.push({
        region: r.region,
        metricKey: m.key,
        metricLabel: m.label,
        value: val,
        normValue: normVal,
        format: m.format
      });
    });
  });

  // Color mapping function
  const getColor = (normVal) => {
    const value = 0.05 + normVal * 0.78; // Giữ khoảng đệm để không quá sáng/tối
    return d3.interpolateBlues(value);
  };

  // 6. Draw Matrix Cells
  let cellsG = g.select('.cells-group');
  if (cellsG.empty()) {
    cellsG = g.append('g').attr('class', 'cells-group');
  }

  const cells = cellsG.selectAll('.heatmap-cell')
    .data(cellData, d => `${d.region}-${d.metricKey}`);

  cells.join(
    enter => enter.append('rect')
      .attr('class', 'heatmap-cell')
      .attr('x', d => xScale(d.metricKey))
      .attr('y', d => yScale(d.region))
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('rx', 4)
      .attr('ry', 4)
      .style('fill', d => getColor(d.normValue))
      .style('stroke', 'transparent')
      .style('stroke-width', '2px')
      .style('cursor', 'pointer')
      .style('opacity', 0)
      .call(enter => enter.transition().duration(600).style('opacity', 1)),
    update => update.call(update => update.transition().duration(600)
      .attr('x', d => xScale(d.metricKey))
      .attr('y', d => yScale(d.region))
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .style('fill', d => getColor(d.normValue))),
    exit => exit.remove()
  );

  // 7. Draw Numeric Text inside Cells (with contrast check)
  let labelsG = g.select('.labels-group');
  if (labelsG.empty()) {
    labelsG = g.append('g').attr('class', 'labels-group');
  }

  const labels = labelsG.selectAll('.heatmap-label')
    .data(cellData, d => `${d.region}-${d.metricKey}`);

  labels.join(
    enter => enter.append('text')
      .attr('class', 'heatmap-label')
      .attr('x', d => xScale(d.metricKey) + xScale.bandwidth() / 2)
      .attr('y', d => yScale(d.region) + yScale.bandwidth() / 2)
      .attr('dy', '4px')
      .attr('text-anchor', 'middle')
      .style('pointer-events', 'none')
      .style('font-size', isNarrow ? '9px' : 'var(--fs-xs)')
      .style('font-family', 'var(--font-mono)')
      .style('font-weight', 'var(--fw-medium)')
      .style('fill', d => d.normValue > 0.52 ? '#ffffff' : 'var(--color-bg-primary)')
      .style('opacity', 0)
      .text(d => d.format(d.value))
      .call(enter => enter.transition().duration(600).style('opacity', 1)),
    update => update.call(update => update.transition().duration(600)
      .attr('x', d => xScale(d.metricKey) + xScale.bandwidth() / 2)
      .attr('y', d => yScale(d.region) + yScale.bandwidth() / 2)
      .style('fill', d => d.normValue > 0.52 ? '#ffffff' : 'var(--color-bg-primary)')
      .text(d => d.format(d.value))),
    exit => exit.remove()
  );

  // 8. Tooltips and Click Highlights
  cellsG.selectAll('.heatmap-cell')
    .on('mouseover', function(event, d) {
      d3.select(this)
        .style('stroke', 'var(--color-text-primary)')
        .style('stroke-width', '2px')
        .raise();

      cellsG.selectAll('.heatmap-cell')
        .filter(node => node !== d)
        .transition().duration(150)
        .style('opacity', 0.4);

      const html = Tooltip.buildHTML('So sánh chỉ số vùng', [
        { label: 'Vùng miền', value: d.region },
        { label: 'Chỉ số', value: d.metricLabel },
        { label: 'Giá trị TB', value: d.format(d.value), color: regionColor(d.region) }
      ]);
      tooltip.show(event, html);
    })
    .on('mousemove', function(event) {
      tooltip.show(event, tooltip.el.html());
    })
    .on('mouseout', function() {
      // Bỏ viền nếu không phải ô đang được click chọn dòng
      if (!d3.select(this).classed('cell--selected')) {
        d3.select(this).style('stroke', 'transparent');
      }

      cellsG.selectAll('.heatmap-cell')
        .transition().duration(150)
        .style('opacity', 1.0);

      tooltip.hide();
    })
    .on('click', function(event, d) {
      const isSelected = d3.select(this).classed('cell--selected');

      // Reset tất cả các ô chọn dòng khác
      cellsG.selectAll('.heatmap-cell')
        .classed('cell--selected', false)
        .style('stroke', 'transparent');

      if (!isSelected) {
        // Kích hoạt toàn bộ dòng thuộc vùng này
        cellsG.selectAll('.heatmap-cell')
          .filter(node => node.region === d.region)
          .classed('cell--selected', true)
          .style('stroke', 'var(--color-text-primary)')
          .style('stroke-width', '1.5px');
      }
    });
}

function showPlaceholder(icon, label) {
  const el = document.querySelector(CONTAINER);
  if (!el) return;
  el.innerHTML = `
    <div class="chart-placeholder">
      <span class="chart-placeholder__icon">${icon}</span>
      <span>${label}</span>
    </div>`;
}


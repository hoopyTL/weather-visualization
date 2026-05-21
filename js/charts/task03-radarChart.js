/**
 * Task 03 – Radar Chart: Phân tích thời tiết theo vùng
 * 
 * Chart: Radar/spider chart
 * Axes: avgtemp, maxwind, totalprecip, avghumidity, uv (normalized)
 * Interactions: hover highlight, transition on region change
 * 
 * @module task03-radarChart
 */

import { createSvg, getMargin, getDimensions, regionColor, formatTemp, formatPercent, formatWind, formatPrecip, formatUV, addResizeObserver } from '../utils.js?v=2';
import { Tooltip } from '../components/tooltip.js?v=2';
import { Legend } from '../components/legend.js?v=2';

const CONTAINER = '#chart-task03';
const tooltip = new Tooltip();
const legend = new Legend('#task03-controls');

const METRICS = [
  { key: 'avgTemp', label: 'Nhiệt độ TB', format: formatTemp },
  { key: 'maxWind', label: 'Tốc độ gió TB', format: formatWind },
  { key: 'totalPrecip', label: 'Lượng mưa TB', format: formatPrecip },
  { key: 'avgHumidity', label: 'Độ ẩm TB', format: formatPercent },
  { key: 'uv', label: 'Chỉ số UV', format: formatUV }
];

let _lastData = null;
let _lastOptions = null;

export function init() {
  // Tránh việc lắng nghe ResizeObserver lặp đi lặp lại
  if (!init.observed) {
    addResizeObserver(CONTAINER, () => {
      if (_lastData) {
        render(_lastData, _lastOptions);
      }
    });
    init.observed = true;
  }
  console.log('📊 Task 03 – Radar Chart initialized');
}

export function render(data, options = {}) {
  _lastData = data;
  _lastOptions = options;

  if (!data || data.length === 0) {
    showPlaceholder('🕸️', 'Không có dữ liệu thời tiết');
    return;
  }

  const container = document.querySelector(CONTAINER);
  if (container) {
    container.querySelector('.chart-placeholder')?.remove();
  }

  // 1. Group data by region and compute averages
  const regionNames = [...new Set(data.map(d => d.region))].filter(Boolean).sort();
  if (regionNames.length === 0) {
    showPlaceholder('🕸️', 'Không có dữ liệu vùng miền');
    return;
  }

  const regionData = regionNames.map(region => {
    const subset = data.filter(d => d.region === region);
    return {
      region,
      avgTemp: d3.mean(subset, d => d.avgTemp) || 0,
      maxWind: d3.mean(subset, d => d.maxWind) || 0,
      totalPrecip: d3.mean(subset, d => d.totalPrecip) || 0,
      avgHumidity: d3.mean(subset, d => d.avgHumidity) || 0,
      uv: d3.mean(subset, d => d.uv) || 0,
    };
  });

  // 2. Setup bounds and normalization scales dynamically
  const minMax = {};
  METRICS.forEach(m => {
    const values = regionData.map(d => d[m.key]);
    const minVal = d3.min(values) || 0;
    const maxVal = d3.max(values) || 1;

    let scaleMin = 0;
    // Tạo khoảng đệm nhỏ ở tâm để các điểm tối thiểu không tụ hoàn toàn ở tâm
    if (m.key === 'avgTemp') scaleMin = Math.max(0, minVal - 3);
    if (m.key === 'avgHumidity') scaleMin = Math.max(0, minVal - 10);

    minMax[m.key] = {
      min: scaleMin,
      max: maxVal * 1.05 // đệm 5% ở đỉnh ngoài để tránh chạm viền
    };
  });

  const normalize = (key, value) => {
    const { min, max } = minMax[key];
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  };

  // 3. Create SVG structure with dimensions
  const margin = { top: 60, right: 80, bottom: 60, left: 80 };
  const dim = getDimensions(CONTAINER, margin);
  if (dim.width === 0) return; // container chưa hiển thị hoàn toàn

  let svg = d3.select(CONTAINER).select('svg');
  let g;

  if (svg.empty() || +svg.attr('width') !== dim.width) {
    g = createSvg(CONTAINER, dim.width, dim.height, margin);
    svg = d3.select(CONTAINER).select('svg');
  } else {
    g = svg.select('g');
  }

  const cx = dim.innerWidth / 2;
  const cy = dim.innerHeight / 2;
  const radius = Math.min(dim.innerWidth, dim.innerHeight) / 2 - 20;
  const angleSlice = (Math.PI * 2) / METRICS.length;

  // 4. Draw background grid elements
  let gridGroup = g.select('.grid-group');
  if (gridGroup.empty()) {
    gridGroup = g.append('g').attr('class', 'grid-group');
  }

  // concentric pentagons levels
  const levels = 5;
  const gridLevels = d3.range(1, levels + 1).map(d => d / levels);
  const gridData = gridLevels.map(level => {
    return METRICS.map((_, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      return {
        x: cx + radius * level * Math.cos(angle),
        y: cy + radius * level * Math.sin(angle)
      };
    });
  });

  const lineGenerator = d3.line()
    .x(d => d.x)
    .y(d => d.y)
    .curve(d3.curveLinearClosed);

  const gridPaths = gridGroup.selectAll('.grid-level')
    .data(gridData);

  gridPaths.join('path')
    .attr('class', 'grid-level')
    .attr('d', lineGenerator)
    .style('fill', 'none')
    .style('stroke', 'var(--color-border-light)')
    .style('stroke-dasharray', '4, 4')
    .style('stroke-width', '1px');

  // Draw axes lines (spokes)
  const axisLines = gridGroup.selectAll('.axis-spoke')
    .data(METRICS);

  axisLines.join('line')
    .attr('class', 'axis-spoke')
    .attr('x1', cx)
    .attr('y1', cy)
    .attr('x2', (d, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      return cx + radius * Math.cos(angle);
    })
    .attr('y2', (d, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      return cy + radius * Math.sin(angle);
    })
    .style('stroke', 'var(--color-border)')
    .style('stroke-width', '1px');

  // Draw axis labels with auto adjustment text anchor
  const axisLabels = gridGroup.selectAll('.axis-label-text')
    .data(METRICS);

  axisLabels.join('text')
    .attr('class', 'axis-label-text')
    .attr('x', (d, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      return cx + (radius + 15) * Math.cos(angle);
    })
    .attr('y', (d, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      return cy + (radius + 15) * Math.sin(angle);
    })
    .attr('text-anchor', (d, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      const cos = Math.cos(angle);
      return Math.abs(cos) < 0.1 ? 'middle' : cos > 0 ? 'start' : 'end';
    })
    .attr('dominant-baseline', (d, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      const sin = Math.sin(angle);
      return Math.abs(sin) < 0.1 ? 'middle' : sin > 0 ? 'hanging' : 'alphabetic';
    })
    .style('font-size', 'var(--fs-xs)')
    .style('fill', 'var(--color-text-secondary)')
    .style('font-weight', 'var(--fw-medium)')
    .text(d => d.label);

  // 5. Draw radar polygons
  const getRadarPath = (d) => {
    const points = METRICS.map((m, i) => {
      const val = d[m.key];
      const normVal = normalize(m.key, val);
      const angle = i * angleSlice - Math.PI / 2;
      return [
        cx + radius * normVal * Math.cos(angle),
        cy + radius * normVal * Math.sin(angle)
      ];
    });
    return d3.line()(points) + 'Z';
  };

  let polygonGroup = g.select('.polygon-group');
  if (polygonGroup.empty()) {
    polygonGroup = g.append('g').attr('class', 'polygon-group');
  }

  const polygons = polygonGroup.selectAll('.radar-polygon')
    .data(regionData, d => d.region);

  polygons.join(
    enter => enter.append('path')
      .attr('class', 'radar-polygon')
      .attr('d', getRadarPath)
      .style('fill', d => regionColor(d.region))
      .style('fill-opacity', 0.15)
      .style('stroke', d => regionColor(d.region))
      .style('stroke-width', '2.5px')
      .style('cursor', 'pointer')
      .style('opacity', 0)
      .call(enter => enter.transition().duration(600).style('opacity', 1)),
    update => update.call(update => update.transition().duration(600)
      .attr('d', getRadarPath)),
    exit => exit.call(exit => exit.transition().duration(400).style('opacity', 0).remove())
  );

  // 6. Draw vertices circles (dots)
  const dotData = [];
  regionData.forEach(r => {
    METRICS.forEach((m, i) => {
      const val = r[m.key];
      const normVal = normalize(m.key, val);
      const angle = i * angleSlice - Math.PI / 2;
      dotData.push({
        region: r.region,
        metric: m.key,
        metricLabel: m.label,
        value: val,
        format: m.format,
        x: cx + radius * normVal * Math.cos(angle),
        y: cy + radius * normVal * Math.sin(angle)
      });
    });
  });

  let dotGroup = g.select('.dot-group');
  if (dotGroup.empty()) {
    dotGroup = g.append('g').attr('class', 'dot-group');
  }

  const dots = dotGroup.selectAll('.radar-dot')
    .data(dotData, d => `${d.region}-${d.metric}`);

  dots.join(
    enter => enter.append('circle')
      .attr('class', 'radar-dot')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', 4)
      .style('fill', d => regionColor(d.region))
      .style('stroke', '#fff')
      .style('stroke-width', '1.5px')
      .style('cursor', 'pointer')
      .style('opacity', 0)
      .call(enter => enter.transition().duration(600).style('opacity', 1)),
    update => update.call(update => update.transition().duration(600)
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)),
    exit => exit.remove()
  );

  // 7. Interactive highlights & Tooltips
  const highlightRegion = (region) => {
    polygonGroup.selectAll('.radar-polygon')
      .style('fill-opacity', d => d.region === region ? 0.45 : 0.02)
      .style('stroke-opacity', d => d.region === region ? 1.0 : 0.1)
      .style('stroke-width', d => d.region === region ? '4px' : '1px')
      .filter(d => d.region === region)
      .raise();

    dotGroup.selectAll('.radar-dot')
      .style('opacity', d => d.region === region ? 1.0 : 0.1)
      .filter(d => d.region === region)
      .raise();
  };

  const resetHighlight = () => {
    const activeKeys = legend.getActive();
    polygonGroup.selectAll('.radar-polygon')
      .style('fill-opacity', 0.15)
      .style('stroke-opacity', 1.0)
      .style('stroke-width', '2.5px')
      .style('opacity', d => activeKeys.has(d.region) ? 1 : 0);

    dotGroup.selectAll('.radar-dot')
      .style('opacity', 1.0)
      .style('opacity', d => activeKeys.has(d.region) ? 1 : 0);
  };

  // Bind tooltip to polygon hover
  polygonGroup.selectAll('.radar-polygon')
    .on('mouseover', function(event, d) {
      highlightRegion(d.region);

      const rows = METRICS.map(m => ({
        label: m.label,
        value: m.format(d[m.key]),
        color: regionColor(d.region)
      }));

      const html = Tooltip.buildHTML(`Vùng: ${d.region}`, rows);
      tooltip.show(event, html);
    })
    .on('mousemove', function(event) {
      tooltip.show(event, tooltip.el.html());
    })
    .on('mouseout', function() {
      resetHighlight();
      tooltip.hide();
    });

  // Bind tooltip to dot hover
  dotGroup.selectAll('.radar-dot')
    .on('mouseover', function(event, d) {
      highlightRegion(d.region);
      d3.select(this).transition().duration(100).attr('r', 6);

      const html = Tooltip.buildHTML(d.region, [
        { label: d.metricLabel, value: d.format(d.value), color: regionColor(d.region) }
      ]);
      tooltip.show(event, html);
    })
    .on('mousemove', function(event) {
      tooltip.show(event, tooltip.el.html());
    })
    .on('mouseout', function() {
      d3.select(this).transition().duration(100).attr('r', 4);
      resetHighlight();
      tooltip.hide();
    });

  // 8. Render Interactive Legend
  const legendItems = regionNames.map(r => ({
    label: r,
    color: regionColor(r),
    key: r
  }));

  legend.render(legendItems, (key, isActive, activeItems) => {
    polygonGroup.selectAll('.radar-polygon')
      .transition().duration(300)
      .style('opacity', d => activeItems.has(d.region) ? 1 : 0)
      .style('pointer-events', d => activeItems.has(d.region) ? 'auto' : 'none');

    dotGroup.selectAll('.radar-dot')
      .transition().duration(300)
      .style('opacity', d => activeItems.has(d.region) ? 1 : 0)
      .style('pointer-events', d => activeItems.has(d.region) ? 'auto' : 'none');
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


/**
 * Task 14 – Heat Risk Map: Nguy cơ nắng nóng theo tỉnh
 *
 * Ý tưởng:
 *   - Mỗi tỉnh/thành là 1 điểm trên bản đồ.
 *   - Màu điểm = số ngày nắng nóng.
 *   - Kích thước điểm = số ngày nắng nóng.
 *   - Có bảng Top tỉnh nằm riêng bên phải, không đè lên bản đồ.
 *   - Có filter theo ngưỡng nhiệt độ và vùng.
 *
 * Bản này đã chỉnh màu chấm đậm hơn cho light mode.
 */

import { formatNumber, formatTemp, regionColor } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

// Khai báo vùng chứa biểu đồ và vùng chứa bộ lọc.
const CONTAINER = '#chart-task14';
const CONTROLS = '#task14-controls';

// Tạo tooltip để hiện thông tin khi rê chuột.
const tooltip = new Tooltip();

// Lưu dữ liệu và trạng thái bộ lọc hiện tại.
let currentData = [];
let selectedRegion = '';
let selectedThreshold = 35;

// Khởi tạo Task 14 và báo trong console rằng biểu đồ đã sẵn sàng.
export function init() {
  console.log('🔥 Task 14 – Nguy cơ nắng nóng theo tỉnh initialized');
}

// Hàm chính nhận dữ liệu, tạo bộ lọc, xử lý dữ liệu và vẽ bản đồ nắng nóng.
export function render(data, options = {}) {
  currentData = Array.isArray(data) ? data : [];

  if (!currentData.length) {
    showNoData('Không có dữ liệu để vẽ Task 14.');
    return;
  }

  buildControls(currentData);

  const heatData = prepareHeatRiskData(currentData, {
    region: selectedRegion,
    threshold: selectedThreshold,
  });

  drawHeatRiskMap(heatData, currentData);
}

// Tạo bộ lọc theo ngưỡng nhiệt độ và vùng.
function buildControls(data) {
  const controls = document.querySelector(CONTROLS);
  if (!controls || controls.dataset.ready === 'true') return;

  const regions = Array.from(
    new Set(data.map(d => d.region).filter(Boolean))
  ).sort();

  controls.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end;">
      <select id="task14-threshold" class="select" title="Chọn ngưỡng nắng nóng">
        <option value="33" ${selectedThreshold === 33 ? 'selected' : ''}>≥ 33°C</option>
        <option value="35" ${selectedThreshold === 35 ? 'selected' : ''}>≥ 35°C</option>
        <option value="37" ${selectedThreshold === 37 ? 'selected' : ''}>≥ 37°C</option>
      </select>

      <select id="task14-region" class="select" title="Lọc theo vùng">
        <option value="">Tất cả vùng</option>
        ${regions.map(r => `<option value="${escapeHTML(r)}">${escapeHTML(r)}</option>`).join('')}
      </select>
    </div>
  `;

  controls.querySelector('#task14-threshold')?.addEventListener('change', event => {
    selectedThreshold = Number(event.target.value);
    render(currentData);
  });

  controls.querySelector('#task14-region')?.addEventListener('change', event => {
    selectedRegion = event.target.value;
    render(currentData);
  });

  controls.dataset.ready = 'true';
}


// Lọc dữ liệu và tính số ngày nắng nóng theo từng tỉnh/thành.
function prepareHeatRiskData(data, { region, threshold }) {
  const filtered = data.filter(d => {
    if (!isValidCoord(d)) return false;
    if (!Number.isFinite(+d.maxTemp)) return false;
    if (region && d.region !== region) return false;
    return true;
  });

  return d3.rollups(
    filtered,
    values => {
      const heatDays = values.filter(d => +d.maxTemp >= threshold).length;
      const totalDays = values.length;

      return {
        name: values[0].name,
        region: values[0].region,
        terrain: values[0].terrain,
        lat: d3.mean(values, d => d.lat),
        lon: d3.mean(values, d => d.lon),
        heatDays,
        totalDays,
        heatRate: totalDays ? heatDays / totalDays : 0,
        avgMaxTemp: d3.mean(values, d => d.maxTemp),
        maxObservedTemp: d3.max(values, d => d.maxTemp),
        avgTemp: d3.mean(values, d => d.avgTemp),
        avgUV: d3.mean(values, d => d.uv),
      };
    },
    d => d.name
  )
    .map(([, value]) => value)
    .sort((a, b) => d3.descending(a.heatDays, b.heatDays));
}

// Vẽ bản đồ nguy cơ nắng nóng, top tỉnh và chú giải màu.
function drawHeatRiskMap(heatData, allData) {
  const container = document.querySelector(CONTAINER);
  if (!container) return;

  d3.select(CONTAINER).selectAll('*').remove();

  if (!heatData.length) {
    showNoData('Không có dữ liệu phù hợp với bộ lọc hiện tại.');
    return;
  }

  const width = Math.max(container.getBoundingClientRect().width || 1000, 720);
  const height = Math.max(container.getBoundingClientRect().height || 720, 680);

  const margin = {
    top: 30,
    right: 32,
    bottom: 72,
    left: 32,
  };

  const validAll = allData.filter(isValidCoord);

  const lonExtent = padExtent(d3.extent(validAll, d => d.lon), 0.7);
  const latExtent = padExtent(d3.extent(validAll, d => d.lat), 0.8);

  const maxHeatDays = d3.max(heatData, d => d.heatDays) || 1;

  // Tạo thang kích thước điểm theo số ngày nắng nóng.
  const radius = d3.scaleSqrt()
    .domain([0, maxHeatDays])
    .range([4.2, 13.5]);

  // Tạo thang màu: ít ngày màu cam, nhiều ngày màu đỏ đậm.
  const color = d3.scaleLinear()
    .domain([0, maxHeatDays * 0.45, maxHeatDays])
    .range(['#f59e0b', '#f97316', '#b91c1c'])
    .interpolate(d3.interpolateRgb);

  // Tạo SVG chính để vẽ toàn bộ biểu đồ.
  const svg = d3.select(CONTAINER)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const sidePanelWidth = Math.min(330, Math.max(270, width * 0.26));
  const sidePanelGap = 36;

  const mapLeft = margin.left;
  const mapRight = width - sidePanelWidth - sidePanelGap;
  const mapTop = margin.top;
  const mapBottom = height - margin.bottom;

  const mapAreaWidth = mapRight - mapLeft;
  const mapAreaHeight = mapBottom - mapTop;

  const lonRange = lonExtent[1] - lonExtent[0];
  const latRange = latExtent[1] - latExtent[0];

  const geoRatio = lonRange / latRange;
  const aspectBoost = 0.82;

  let plotHeight = mapAreaHeight;
  let plotWidth = plotHeight * geoRatio * aspectBoost;

  if (plotWidth > mapAreaWidth) {
    plotWidth = mapAreaWidth;
    plotHeight = plotWidth / (geoRatio * aspectBoost);
  }

  const plotX0 = mapLeft + (mapAreaWidth - plotWidth) / 2;
  const plotX1 = plotX0 + plotWidth;

  const plotY0 = mapTop + (mapAreaHeight - plotHeight) / 2;
  const plotY1 = plotY0 + plotHeight;

  // Chuyển kinh độ thành vị trí ngang trên SVG.
  const x = d3.scaleLinear()
    .domain(lonExtent)
    .range([plotX0, plotX1]);

  // Chuyển vĩ độ thành vị trí dọc trên SVG.
  const y = d3.scaleLinear()
    .domain(latExtent)
    .range([plotY1, plotY0]);

  // Tạo lớp riêng để zoom/pan bản đồ.
  const zoomLayer = svg.append('g')
    .attr('class', 'task14-zoom-layer');

  // Vẽ nền khung bản đồ.
  zoomLayer.append('rect')
    .attr('x', plotX0 - 28)
    .attr('y', plotY0 - 24)
    .attr('width', plotWidth + 56)
    .attr('height', plotHeight + 48)
    .attr('rx', 14)
    .attr('fill', 'rgba(255,255,255,0.02)')
    .attr('stroke', '#e5dece')
    .attr('stroke-width', 1.2);

  drawCoordinateGrid(zoomLayer, x, y);

  // Vẽ các điểm tỉnh/thành trên bản đồ.
  const points = zoomLayer.append('g')
    .attr('class', 'heat-risk-points')
    .selectAll('circle')
    .data(heatData, d => d.name)
    .join('circle')
    .attr('class', 'map-bubble heat-risk-point')
    .attr('cx', d => x(d.lon))
    .attr('cy', d => y(d.lat))
    .attr('r', 0)
    .style('fill', d => color(d.heatDays))
    .style('fill-opacity', 0.96)
    .style('stroke', '#ffffff')
    .style('stroke-width', 1.8)
    .style('cursor', 'pointer')
    .on('mouseenter', function (event, d) {
      d3.select(this)
        .raise()
        .transition()
        .duration(120)
        .attr('r', Math.max(8, radius(d.heatDays) + 2.8))
        .style('stroke', '#111827')
        .style('stroke-width', 2.2);

      showHeatTooltip(event, d);
    })
    .on('mousemove', function (event, d) {
      showHeatTooltip(event, d);
    })
    .on('mouseleave', function (event, d) {
      d3.select(this)
        .transition()
        .duration(120)
        .attr('r', Math.max(4.2, radius(d.heatDays)))
        .style('stroke', '#ffffff')
        .style('stroke-width', 1.8);

      tooltip.hide();
    });

  // Tạo hiệu ứng điểm xuất hiện dần.
  points.transition()
    .duration(700)
    .delay((d, i) => i * 7)
    .attr('r', d => Math.max(4.2, radius(d.heatDays)));

  const panelX = width - sidePanelWidth - margin.right;
  const panelY = 62;

  const rankingHeight = drawTopRanking(svg, heatData, panelX, panelY, sidePanelWidth);

  drawHeatLegend(
    svg,
    color,
    maxHeatDays,
    panelX,
    panelY + rankingHeight + 38,
    sidePanelWidth
  );

  drawMapNote(svg, heatData.length, width, height);

  // Tạo chức năng kéo và zoom bản đồ.
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .translateExtent([[0, 0], [width, height]])
    .on('zoom', event => {
      zoomLayer.attr('transform', event.transform);
    });

  svg.call(zoom);
}

//TOOLTIP

// Hiển thị tooltip thông tin chi tiết về nắng nóng của từng tỉnh/thành.
function showHeatTooltip(event, d) {
  tooltip.show(event, Tooltip.buildHTML(`🔥 ${escapeHTML(d.name)}`, [
    {
      label: 'Vùng',
      value: escapeHTML(d.region || 'Không rõ'),
      color: regionColor(d.region),
    },
    {
      label: 'Địa hình',
      value: escapeHTML(d.terrain || 'Không rõ'),
    },
    {
      label: `Số ngày ≥ ${selectedThreshold}°C`,
      value: `${formatNumber(d.heatDays)} ngày`,
    },
    {
      label: 'Tỷ lệ nắng nóng',
      value: `${(d.heatRate * 100).toFixed(1)}%`,
    },
    {
      label: 'Nhiệt độ cao nhất TB',
      value: formatTemp(d.avgMaxTemp),
    },
    {
      label: 'Nhiệt độ cao nhất ghi nhận',
      value: formatTemp(d.maxObservedTemp),
    },
    {
      label: 'UV trung bình',
      value: Number.isFinite(d.avgUV) ? d.avgUV.toFixed(1) : '—',
    },
  ]));
}

//: TOP RANKING

// Vẽ bảng top tỉnh có nhiều ngày nắng nóng nhất.
function drawTopRanking(svg, heatData, panelX, panelY, panelWidth) {
  const topData = heatData
    .filter(d => d.heatDays > 0)
    .slice(0, 8);

  if (!topData.length) return 0;

  const rowHeight = 24;
  const panelHeight = 48 + topData.length * rowHeight;

  const g = svg.append('g')
    .attr('class', 'heat-ranking-panel');

  g.append('rect')
    .attr('x', panelX)
    .attr('y', panelY)
    .attr('width', panelWidth)
    .attr('height', panelHeight)
    .attr('rx', 12)
    .attr('fill', 'rgba(255,255,255,0.94)')
    .attr('stroke', '#d8d2c0')
    .attr('stroke-width', 1.1);

  g.append('text')
    .attr('x', panelX + 14)
    .attr('y', panelY + 26)
    .attr('fill', '#1f2937')
    .attr('font-size', '12px')
    .attr('font-weight', 700)
    .text(`Top tỉnh có nhiều ngày ≥ ${selectedThreshold}°C`);

  const maxValue = d3.max(topData, d => d.heatDays) || 1;

  const barX = 118;
  const barMaxWidth = panelWidth - barX - 38;

  const x = d3.scaleLinear()
    .domain([0, maxValue])
    .range([0, barMaxWidth]);

  const rows = g.selectAll('.heat-ranking-row')
    .data(topData)
    .join('g')
    .attr('class', 'heat-ranking-row')
    .attr('transform', (d, i) => `translate(${panelX + 14},${panelY + 52 + i * rowHeight})`);

  rows.append('text')
    .attr('x', 0)
    .attr('y', 0)
    .attr('dy', '0.35em')
    .attr('fill', '#475569')
    .attr('font-size', '11px')
    .attr('font-weight', 500)
    .text(d => truncateText(d.name, 14));

  rows.append('rect')
    .attr('x', barX)
    .attr('y', -6)
    .attr('width', 0)
    .attr('height', 11)
    .attr('rx', 4)
    .attr('fill', '#ea580c')
    .attr('fill-opacity', 0.9)
    .transition()
    .duration(650)
    .attr('width', d => x(d.heatDays));

  rows.append('text')
    .attr('x', panelWidth - 26)
    .attr('y', 0)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'end')
    .attr('fill', '#1f2937')
    .attr('font-size', '11px')
    .attr('font-weight', 700)
    .attr('font-family', 'var(--font-mono)')
    .text(d => d.heatDays);

  return panelHeight;
}


// Vẽ chú giải màu thể hiện số ngày nắng nóng.
function drawHeatLegend(svg, color, maxHeatDays, x0, y0, legendWidth) {
  const legendHeight = 12;
  const gradientId = `task14-heat-gradient-${Math.random().toString(36).slice(2)}`;

  const defs = svg.append('defs');

  const gradient = defs.append('linearGradient')
    .attr('id', gradientId)
    .attr('x1', '0%')
    .attr('x2', '100%')
    .attr('y1', '0%')
    .attr('y2', '0%');

  d3.range(0, 1.01, 0.1).forEach(t => {
    gradient.append('stop')
      .attr('offset', `${t * 100}%`)
      .attr('stop-color', color(t * maxHeatDays));
  });

  svg.append('text')
    .attr('x', x0)
    .attr('y', y0 - 10)
    .attr('fill', '#64748b')
    .attr('font-size', '12px')
    .attr('font-weight', 600)
    .text(`Số ngày nắng nóng ≥ ${selectedThreshold}°C`);

  svg.append('rect')
    .attr('x', x0)
    .attr('y', y0)
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .attr('rx', 6)
    .attr('fill', `url(#${gradientId})`);

  const scale = d3.scaleLinear()
    .domain([0, maxHeatDays])
    .range([x0, x0 + legendWidth]);

  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${y0 + legendHeight})`)
    .call(d3.axisBottom(scale).ticks(4).tickFormat(d3.format('d')))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('text')
      .attr('fill', '#64748b')
      .attr('font-size', '11px')
    )
    .call(g => g.selectAll('line')
      .attr('stroke', '#94a3b8')
    );
}


// Vẽ lưới tọa độ và nhãn Bắc/Nam trên bản đồ.
function drawCoordinateGrid(g, x, y) {
  const lonTicks = x.ticks(5);
  const latTicks = y.ticks(6);

  const xRange = x.range();
  const yRange = y.range();

  const xMin = Math.min(...xRange);
  const xMax = Math.max(...xRange);
  const yMin = Math.min(...yRange);
  const yMax = Math.max(...yRange);

  g.append('g')
    .selectAll('line.lon-grid')
    .data(lonTicks)
    .join('line')
    .attr('class', 'grid-line')
    .attr('x1', d => x(d))
    .attr('x2', d => x(d))
    .attr('y1', yMin)
    .attr('y2', yMax)
    .attr('stroke', '#e5dece')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '3 3')
    .attr('opacity', 0.85);

  g.append('g')
    .selectAll('line.lat-grid')
    .data(latTicks)
    .join('line')
    .attr('class', 'grid-line')
    .attr('x1', xMin)
    .attr('x2', xMax)
    .attr('y1', d => y(d))
    .attr('y2', d => y(d))
    .attr('stroke', '#e5dece')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '3 3')
    .attr('opacity', 0.85);

  g.append('text')
    .attr('x', xMin + 8)
    .attr('y', yMin + 18)
    .attr('fill', '#64748b')
    .attr('font-size', '12px')
    .attr('font-weight', 600)
    .text('Bắc');

  g.append('text')
    .attr('x', xMax - 38)
    .attr('y', yMax - 8)
    .attr('fill', '#64748b')
    .attr('font-size', '12px')
    .attr('font-weight', 600)
    .text('Nam');
}

// Hiển thị ghi chú dưới bản đồ về số tỉnh/thành, vùng lọc và hướng dẫn zoom.
function drawMapNote(svg, pointCount, width, height) {
  const regionText = selectedRegion || 'Tất cả vùng';

  svg.append('text')
    .attr('x', 32)
    .attr('y', height - 20)
    .attr('fill', '#64748b')
    .attr('font-size', '11px')
    .text(`${pointCount} tỉnh/thành • ${regionText} • kéo để di chuyển, cuộn để zoom`);
}


// Kiểm tra một bản ghi có kinh độ và vĩ độ hợp lệ hay không.
function isValidCoord(d) {
  return Number.isFinite(+d.lat) && Number.isFinite(+d.lon);
}

// Nới rộng khoảng min/max của kinh độ hoặc vĩ độ để bản đồ không bị sát mép.
function padExtent(extent, pad) {
  const [min, max] = extent;
  return [min - pad, max + pad];
}

// Rút gọn tên tỉnh/thành nếu tên quá dài.
function truncateText(text, maxLength) {
  const value = String(text || '');
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

// Hiển thị thông báo khi không có dữ liệu phù hợp để vẽ biểu đồ.
function showNoData(message) {
  const el = document.querySelector(CONTAINER);
  if (!el) return;

  el.innerHTML = `<div class="no-data">${message}</div>`;
}

// Làm sạch chuỗi trước khi đưa vào HTML để tránh lỗi hiển thị hoặc chèn mã lạ.
function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
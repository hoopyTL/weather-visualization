/**
 * Task 04 – Temperature Point Map: Bản đồ nhiệt độ trung bình theo tỉnh
 *
 * Vì project chưa có file GeoJSON ranh giới tỉnh, task này dùng trực tiếp
 * tọa độ lat/lon có trong dataset.
 *
 * Mỗi tỉnh/thành = 1 điểm trên bản đồ.
 * Màu điểm = nhiệt độ.
 */

import { createTempScale, formatTemp, formatNumber } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task04';
const CONTROLS = '#task04-controls';
const tooltip = new Tooltip();

let currentData = [];
let selectedRegion = '';
let selectedMonth = '';
let selectedMetric = 'avgTemp';

const METRICS = {
  avgTemp: { label: 'Nhiệt độ trung bình', short: 'TB', field: 'avgTemp' },
  maxTemp: { label: 'Nhiệt độ cao nhất TB', short: 'Cao nhất', field: 'maxTemp' },
  minTemp: { label: 'Nhiệt độ thấp nhất TB', short: 'Thấp nhất', field: 'minTemp' },
};

export function init() {
  console.log('🗺️ Task 04 – Bản đồ nhiệt độ trung bình theo tỉnh initialized');
}

export function render(data, options = {}) {
  currentData = Array.isArray(data) ? data : [];

  if (!currentData.length) {
    showNoData('Không có dữ liệu để vẽ Task 4.');
    return;
  }

  buildControls(currentData);

  const provinceData = prepareProvinceTemperatureData(currentData, {
    region: selectedRegion,
    month: selectedMonth,
    metric: selectedMetric,
  });

  drawTemperatureMap(provinceData, currentData);
}

function buildControls(data) {
  const controls = document.querySelector(CONTROLS);
  if (!controls || controls.dataset.ready === 'true') return;

  const regions = Array.from(new Set(data.map(d => d.region).filter(Boolean))).sort();

  const months = Array.from(new Set(
    data
      .map(d => d.dateStr || (d.date ? d3.timeFormat('%Y-%m-%d')(d.date) : ''))
      .filter(Boolean)
      .map(d => d.slice(0, 7))
  )).sort();

  controls.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end;">
      <select id="task04-metric" class="select" title="Chọn chỉ số nhiệt độ">
        ${Object.entries(METRICS).map(([key, m]) =>
          `<option value="${key}" ${key === selectedMetric ? 'selected' : ''}>${m.short}</option>`
        ).join('')}
      </select>

      <select id="task04-region" class="select" title="Lọc theo vùng">
        <option value="">Tất cả vùng</option>
        ${regions.map(r => `<option value="${escapeHTML(r)}">${escapeHTML(r)}</option>`).join('')}
      </select>

      <select id="task04-month" class="select" title="Lọc theo tháng">
        <option value="">Toàn bộ thời gian</option>
        ${months.map(m => `<option value="${m}">${formatMonthLabel(m)}</option>`).join('')}
      </select>
    </div>
  `;

  controls.querySelector('#task04-metric')?.addEventListener('change', event => {
    selectedMetric = event.target.value;
    render(currentData);
  });

  controls.querySelector('#task04-region')?.addEventListener('change', event => {
    selectedRegion = event.target.value;
    render(currentData);
  });

  controls.querySelector('#task04-month')?.addEventListener('change', event => {
    selectedMonth = event.target.value;
    render(currentData);
  });

  controls.dataset.ready = 'true';
}

function prepareProvinceTemperatureData(data, { region, month, metric }) {
  const metricField = METRICS[metric]?.field || 'avgTemp';

  const filtered = data.filter(d => {
    if (!isValidCoord(d) || Number.isNaN(+d[metricField])) return false;
    if (region && d.region !== region) return false;
    if (month && !getMonthKey(d).startsWith(month)) return false;
    return true;
  });

  return d3.rollups(
    filtered,
    values => ({
      name: values[0].name,
      region: values[0].region,
      terrain: values[0].terrain,
      lat: d3.mean(values, d => d.lat),
      lon: d3.mean(values, d => d.lon),
      value: d3.mean(values, d => d[metricField]),
      avgTemp: d3.mean(values, d => d.avgTemp),
      maxTemp: d3.mean(values, d => d.maxTemp),
      minTemp: d3.mean(values, d => d.minTemp),
      count: values.length,
    }),
    d => d.name
  )
    .map(([, value]) => value)
    .sort((a, b) => d3.descending(a.value, b.value));
}

function drawTemperatureMap(provinceData, allData) {
  const container = document.querySelector(CONTAINER);
  if (!container) return;

  d3.select(CONTAINER).selectAll('*').remove();

  if (!provinceData.length) {
    showNoData('Không có tỉnh/thành phù hợp với bộ lọc hiện tại.');
    return;
  }

  const width = Math.max(container.getBoundingClientRect().width || 900, 420);
  const height = Math.max(container.getBoundingClientRect().height || 520, 500);
  const margin = { top: 26, right: 28, bottom: 58, left: 32 };

  const validAll = allData.filter(isValidCoord);
  const lonExtent = padExtent(d3.extent(validAll, d => d.lon), 0.7);
  const latExtent = padExtent(d3.extent(validAll, d => d.lat), 0.8);

  // const x = d3.scaleLinear()
  //   .domain(lonExtent)
  //   .range([margin.left, width - margin.right]);

  // const y = d3.scaleLinear()
  //   .domain(latExtent)
  //   .range([height - margin.bottom, margin.top]);

  // Giữ tỷ lệ bản đồ để Việt Nam không bị kéo ngang quá nhiều
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const lonRange = lonExtent[1] - lonExtent[0];
  const latRange = latExtent[1] - latExtent[0];

  // Việt Nam dài theo chiều Bắc - Nam, nên map nên hẹp ngang hơn
  const geoRatio = lonRange / latRange;

  // Tăng nhẹ chiều ngang để điểm không bị quá sát nhau
  const aspectBoost = 1.15;

  let plotHeight = innerHeight;
  let plotWidth = plotHeight * geoRatio * aspectBoost;

  if (plotWidth > innerWidth) {
    plotWidth = innerWidth;
    plotHeight = plotWidth / (geoRatio * aspectBoost);
  }

  const plotX0 = margin.left + (innerWidth - plotWidth) / 2;
  const plotX1 = plotX0 + plotWidth;

  const plotY0 = margin.top + (innerHeight - plotHeight) / 2;
  const plotY1 = plotY0 + plotHeight;

  const x = d3.scaleLinear()
    .domain(lonExtent)
    .range([plotX0, plotX1]);

  const y = d3.scaleLinear()
    .domain(latExtent)
    .range([plotY1, plotY0]);

  const tempExtent = d3.extent(provinceData, d => d.value);

  const color = createTempScale(
    tempExtent[0] === tempExtent[1]
      ? [tempExtent[0] - 1, tempExtent[1] + 1]
      : tempExtent
  );

  const svg = d3.select(CONTAINER)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const zoomLayer = svg.append('g')
    .attr('class', 'task04-zoom-layer');

  zoomLayer.append('rect')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', width - margin.left - margin.right)
    .attr('height', height - margin.top - margin.bottom)
    .attr('rx', 14)
    .attr('fill', 'rgba(255,255,255,0.02)')
    .attr('stroke', 'var(--color-border-light)');

  drawCoordinateGrid(zoomLayer, x, y, lonExtent, latExtent, margin, width, height);

  const points = zoomLayer.append('g')
    .attr('class', 'temperature-points')
    .selectAll('circle')
    .data(provinceData, d => d.name)
    .join('circle')
    .attr('class', 'map-bubble')
    .attr('cx', d => x(d.lon))
    .attr('cy', d => y(d.lat))
    .attr('r', 0)
    .style('fill', d => color(d.value))
    .style('fill-opacity', 0.82)
    .style('stroke', 'var(--color-bg-primary)')
    .style('stroke-width', 1.2)
    .style('cursor', 'pointer')
    .on('mouseenter', function (event, d) {
      d3.select(this)
        .raise()
        .transition()
        .duration(120)
        .attr('r', 10)
        .style('stroke', 'var(--color-text-primary)')
        .style('stroke-width', 2);

      showProvinceTooltip(event, d);
    })
    .on('mousemove', function (event, d) {
      showProvinceTooltip(event, d);
    })
    .on('mouseleave', function () {
      d3.select(this)
        .transition()
        .duration(120)
        .attr('r', 7)
        .style('stroke', 'var(--color-bg-primary)')
        .style('stroke-width', 1.2);

      tooltip.hide();
    });

  points.transition()
    .duration(650)
    .delay((d, i) => i * 8)
    .attr('r', 7);

  drawTempLegend(svg, color, tempExtent, width, height, margin);
  drawMapNote(svg, width, height, provinceData.length);

  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .translateExtent([[0, 0], [width, height]])
    .on('zoom', event => {
      zoomLayer.attr('transform', event.transform);
    });

  svg.call(zoom);
}

function showProvinceTooltip(event, d) {
  tooltip.show(event, Tooltip.buildHTML(`🌡️ ${escapeHTML(d.name)}`, [
    { label: 'Vùng', value: escapeHTML(d.region || 'Không rõ') },
    { label: 'Địa hình', value: escapeHTML(d.terrain || 'Không rõ') },
    { label: METRICS[selectedMetric].label, value: formatTemp(d.value) },
    { label: 'Nhiệt độ TB', value: formatTemp(d.avgTemp) },
    { label: 'Số bản ghi', value: formatNumber(d.count) },
  ]));
}

function drawCoordinateGrid(g, x, y, lonExtent, latExtent, margin, width, height) {
  const lonTicks = x.ticks(5);
  const latTicks = y.ticks(6);

  g.append('g')
    .selectAll('line.lon-grid')
    .data(lonTicks)
    .join('line')
    .attr('class', 'grid-line')
    .attr('x1', d => x(d))
    .attr('x2', d => x(d))
    .attr('y1', margin.top)
    .attr('y2', height - margin.bottom)
    .attr('stroke', 'var(--color-border-light)')
    .attr('stroke-dasharray', '3 3');

  g.append('g')
    .selectAll('line.lat-grid')
    .data(latTicks)
    .join('line')
    .attr('class', 'grid-line')
    .attr('x1', margin.left)
    .attr('x2', width - margin.right)
    .attr('y1', d => y(d))
    .attr('y2', d => y(d))
    .attr('stroke', 'var(--color-border-light)')
    .attr('stroke-dasharray', '3 3');

  g.append('text')
    .attr('x', margin.left + 8)
    .attr('y', margin.top + 18)
    .attr('fill', 'var(--color-text-muted)')
    .attr('font-size', '11px')
    .text('Bắc');

  g.append('text')
    .attr('x', width - margin.right - 36)
    .attr('y', height - margin.bottom - 8)
    .attr('fill', 'var(--color-text-muted)')
    .attr('font-size', '11px')
    .text('Nam');
}

function drawTempLegend(svg, color, tempExtent, width, height, margin) {
  const legendWidth = Math.min(240, width * 0.42);
  const legendHeight = 10;
  const x0 = width - margin.right - legendWidth;
  const y0 = height - 34;
  const gradientId = `task04-temp-gradient-${Math.random().toString(36).slice(2)}`;

  const defs = svg.append('defs');

  const gradient = defs.append('linearGradient')
    .attr('id', gradientId)
    .attr('x1', '0%')
    .attr('x2', '100%')
    .attr('y1', '0%')
    .attr('y2', '0%');

  d3.range(0, 1.01, 0.1).forEach(t => {
    const value = tempExtent[0] + t * (tempExtent[1] - tempExtent[0]);

    gradient.append('stop')
      .attr('offset', `${t * 100}%`)
      .attr('stop-color', color(value));
  });

  svg.append('text')
    .attr('x', x0)
    .attr('y', y0 - 8)
    .attr('fill', 'var(--color-text-muted)')
    .attr('font-size', '11px')
    .text(METRICS[selectedMetric].label);

  svg.append('rect')
    .attr('x', x0)
    .attr('y', y0)
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .attr('rx', 5)
    .attr('fill', `url(#${gradientId})`);

  const scale = d3.scaleLinear()
    .domain(tempExtent)
    .range([x0, x0 + legendWidth]);

  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${y0 + legendHeight})`)
    .call(d3.axisBottom(scale).ticks(4).tickFormat(d => `${d.toFixed(1)}°`))
    .call(g => g.select('.domain').remove());
}

function drawMapNote(svg, width, height, pointCount) {
  const label = selectedMonth
    ? `${pointCount} tỉnh/thành • ${formatMonthLabel(selectedMonth)} • kéo để di chuyển, cuộn để zoom`
    : `${pointCount} tỉnh/thành • toàn bộ thời gian • kéo để di chuyển, cuộn để zoom`;

  svg.append('text')
    .attr('x', 32)
    .attr('y', height - 18)
    .attr('fill', 'var(--color-text-muted)')
    .attr('font-size', '11px')
    .text(label);
}

function isValidCoord(d) {
  return Number.isFinite(+d.lat) && Number.isFinite(+d.lon);
}

function getMonthKey(d) {
  if (d.dateStr) return d.dateStr.slice(0, 7);
  if (d.date instanceof Date && !Number.isNaN(d.date)) {
    return d3.timeFormat('%Y-%m')(d.date);
  }
  return '';
}

function padExtent(extent, pad) {
  const [min, max] = extent;
  return [min - pad, max + pad];
}

function formatMonthLabel(monthKey) {
  if (!monthKey) return 'Toàn bộ thời gian';

  const [year, month] = monthKey.split('-');
  return `Tháng ${Number(month)}/${year}`;
}

function showNoData(message) {
  const el = document.querySelector(CONTAINER);
  if (!el) return;

  el.innerHTML = `<div class="no-data">${message}</div>`;
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
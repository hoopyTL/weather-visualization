/**
 * Task 06 – Point Map: Phân bố điểm đo theo khu vực
 *
 * Dataset hiện có 1 tọa độ đại diện cho mỗi tỉnh/thành.
 * Vì vậy “điểm đo” được hiểu là mỗi tỉnh/thành có 1 điểm quan trắc đại diện.
 *
 * Chart chính:
 *   - Point map: phân bố 63 điểm đo trên không gian Việt Nam
 *
 * Chart phụ:
 *   - Horizontal bar chart: số điểm đo theo vùng
 */

import { regionColor, regionShort, formatNumber } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task06';
const CONTROLS = '#task06-controls';
const tooltip = new Tooltip();

let currentData = [];
let selectedRegion = '';
let selectedTerrain = '';
let activeBarRegion = '';

export function init() {
  console.log('📍 Task 06 – Phân bố điểm đo theo khu vực initialized');
}

export function render(data, options = {}) {
  currentData = Array.isArray(data) ? data : [];

  if (!currentData.length) {
    showNoData('Không có dữ liệu để vẽ Task 6.');
    return;
  }

  buildControls(currentData);

  const allStations = prepareStationData(currentData, {
    region: selectedRegion,
    terrain: selectedTerrain,
  });

  const mapStations = activeBarRegion
    ? allStations.filter(d => d.region === activeBarRegion)
    : allStations;

  drawDensityMap(mapStations, allStations, currentData);
}

/* ============================================================
   CONTROLS
   ============================================================ */

function buildControls(data) {
  const controls = document.querySelector(CONTROLS);
  if (!controls || controls.dataset.ready === 'true') return;

  const regions = Array.from(
    new Set(data.map(d => d.region).filter(Boolean))
  ).sort();

  const terrains = Array.from(
    new Set(data.map(d => d.terrain).filter(Boolean))
  ).sort();

  controls.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end;">
      <select id="task06-region" class="select" title="Lọc theo vùng">
        <option value="">Tất cả vùng</option>
        ${regions.map(r => `<option value="${escapeHTML(r)}">${escapeHTML(r)}</option>`).join('')}
      </select>

      <select id="task06-terrain" class="select" title="Lọc theo địa hình">
        <option value="">Tất cả địa hình</option>
        ${terrains.map(t => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join('')}
      </select>
    </div>
  `;

  controls.querySelector('#task06-region')?.addEventListener('change', event => {
    selectedRegion = event.target.value;
    activeBarRegion = '';
    render(currentData);
  });

  controls.querySelector('#task06-terrain')?.addEventListener('change', event => {
    selectedTerrain = event.target.value;
    activeBarRegion = '';
    render(currentData);
  });

  controls.dataset.ready = 'true';
}

/* ============================================================
   DATA PREP
   ============================================================ */

function prepareStationData(data, { region, terrain }) {
  const filtered = data.filter(d => {
    if (!isValidCoord(d)) return false;
    if (region && d.region !== region) return false;
    if (terrain && d.terrain !== terrain) return false;
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
      days: values.length,
      avgTemp: d3.mean(values, d => d.avgTemp),
      avgHumidity: d3.mean(values, d => d.avgHumidity),
    }),
    d => d.name
  )
    .map(([, value]) => value)
    .sort((a, b) => d3.ascending(a.name, b.name));
}

/* ============================================================
   MAIN CHART
   ============================================================ */

function drawDensityMap(mapStations, allStations, allData) {
  const container = document.querySelector(CONTAINER);
  if (!container) return;

  d3.select(CONTAINER).selectAll('*').remove();

  if (!allStations.length) {
    showNoData('Không có điểm đo phù hợp với bộ lọc hiện tại.');
    return;
  }

  const width = Math.max(container.getBoundingClientRect().width || 900, 520);

  /*
    Tách riêng map và bar chart:
    - SVG map có zoom/pan.
    - SVG bar chart không bị ảnh hưởng bởi zoom/pan.
  */
  const mapHeight = 520;
  const barHeight = 250;

  const wrapper = d3.select(CONTAINER)
    .append('div')
    .style('width', '100%');

  const mapHolder = wrapper.append('div')
    .style('width', '100%')
    .style('height', `${mapHeight}px`)
    .style('overflow', 'hidden');

  const barHolder = wrapper.append('div')
    .style('width', '100%')
    .style('height', `${barHeight}px`)
    .style('margin-top', '18px');

  const margin = {
    top: 24,
    right: 24,
    bottom: 32,
    left: 28,
  };

  const validAll = allData.filter(isValidCoord);

  const lonExtent = padExtent(d3.extent(validAll, d => d.lon), 0.7);
  const latExtent = padExtent(d3.extent(validAll, d => d.lat), 0.8);

  /*
    Giữ tỷ lệ để bản đồ không bị kéo ngang.
    Việt Nam dài theo Bắc - Nam nên plot hẹp ngang hơn.
  */
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = mapHeight - margin.top - margin.bottom;

  const lonRange = lonExtent[1] - lonExtent[0];
  const latRange = latExtent[1] - latExtent[0];

  const geoRatio = lonRange / latRange;
  const aspectBoost = 0.82;

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

  const pointRadius = 4.8;

  /*
    SVG riêng cho map.
  */
  const mapSvg = mapHolder.append('svg')
    .attr('width', width)
    .attr('height', mapHeight)
    .attr('viewBox', `0 0 ${width} ${mapHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('overflow', 'hidden');

  const zoomLayer = mapSvg.append('g')
    .attr('class', 'task06-zoom-layer');

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

  const points = zoomLayer.append('g')
    .attr('class', 'station-points')
    .selectAll('circle')
    .data(mapStations, d => d.name)
    .join('circle')
    .attr('class', 'map-bubble station-point')
    .attr('cx', d => x(d.lon))
    .attr('cy', d => y(d.lat))
    .attr('r', 0)
    .style('fill', d => regionColor(d.region))
    .style('fill-opacity', 0.88)
    .style('stroke', '#ffffff')
    .style('stroke-width', 1.4)
    .style('cursor', 'pointer')
    .on('mouseenter', function (event, d) {
      highlightRegion(points, d.region);

      d3.select(this)
        .raise()
        .transition()
        .duration(120)
        .attr('r', 7.2)
        .style('stroke', '#111827')
        .style('stroke-width', 2);

      showStationTooltip(event, d);
    })
    .on('mousemove', function (event, d) {
      showStationTooltip(event, d);
    })
    .on('mouseleave', function () {
      resetHighlight(points);

      d3.select(this)
        .transition()
        .duration(120)
        .attr('r', pointRadius)
        .style('stroke', '#ffffff')
        .style('stroke-width', 1.4);

      tooltip.hide();
    });

  points.transition()
    .duration(650)
    .delay((d, i) => i * 7)
    .attr('r', pointRadius);

  /*
    Zoom giống Task 4 / Task 14:
    chỉ transform zoomLayer.
    Vì bar chart nằm ở SVG khác nên sẽ không bị đè.
  */
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .translateExtent([[0, 0], [width, mapHeight]])
    .on('zoom', event => {
      zoomLayer.attr('transform', event.transform);
    });

  mapSvg.call(zoom);

  const noteText = activeBarRegion
    ? `${mapStations.length} điểm đo thuộc vùng ${activeBarRegion} • click lại thanh vùng để bỏ lọc`
    : `${mapStations.length} điểm đo đại diện theo tỉnh/thành • kéo để di chuyển, cuộn để zoom`;

  mapSvg.append('text')
    .attr('x', 32)
    .attr('y', mapHeight - 18)
    .attr('fill', '#64748b')
    .attr('font-size', '11px')
    .text(noteText);

  /*
    SVG riêng cho bar chart.
  */
  const barSvg = barHolder.append('svg')
    .attr('width', width)
    .attr('height', barHeight)
    .attr('viewBox', `0 0 ${width} ${barHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  drawBarSummary(barSvg, allStations, points, width, barHeight);
}

/* ============================================================
   TOOLTIP
   ============================================================ */

function showStationTooltip(event, d) {
  tooltip.show(event, Tooltip.buildHTML(`📍 ${escapeHTML(d.name)}`, [
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
      label: 'Số ngày có dữ liệu',
      value: formatNumber(d.days),
    },
    {
      label: 'Nhiệt độ TB',
      value: Number.isFinite(d.avgTemp) ? `${d.avgTemp.toFixed(1)}°C` : '—',
    },
    {
      label: 'Độ ẩm TB',
      value: Number.isFinite(d.avgHumidity) ? `${d.avgHumidity.toFixed(0)}%` : '—',
    },
  ]));
}

/* ============================================================
   BAR CHART
   ============================================================ */

function drawBarSummary(svg, stations, points, width, height) {
  const counts = Array.from(
    d3.rollup(
      stations,
      v => ({
        count: v.length,
        totalDays: d3.sum(v, d => d.days),
      }),
      d => d.region
    ),
    ([region, value]) => ({ region, ...value })
  ).sort((a, b) => d3.descending(a.count, b.count));

  const margin = {
    top: 42,
    right: 52,
    bottom: 38,
    left: 150,
  };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append('g')
    .attr('class', 'density-bar-chart');

  const title = activeBarRegion
    ? `Số điểm đo theo vùng – đang lọc: ${activeBarRegion}`
    : 'Số điểm đo theo vùng';

  g.append('text')
    .attr('x', 0)
    .attr('y', 18)
    .attr('fill', '#111827')
    .attr('font-size', '13px')
    .attr('font-weight', 700)
    .text(title);

  g.append('text')
    .attr('x', 0)
    .attr('y', 36)
    .attr('fill', '#64748b')
    .attr('font-size', '11px')
    .text('Click vào một thanh để lọc các điểm trên bản đồ; click lại để bỏ lọc');

  const x = d3.scaleLinear()
    .domain([0, d3.max(counts, d => d.count) || 1])
    .nice()
    .range([0, innerWidth]);

  const y = d3.scaleBand()
    .domain(counts.map(d => d.region))
    .range([margin.top, margin.top + innerHeight])
    .padding(0.28);

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(${margin.left},${margin.top + innerHeight})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('d')))
    .call(axis => axis.select('.domain').remove())
    .call(axis => axis.selectAll('text')
      .attr('fill', '#64748b')
      .attr('font-size', '11px')
    )
    .call(axis => axis.selectAll('line')
      .attr('stroke', '#cbd5e1')
    );

  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickFormat(d => regionShort(d)))
    .call(axis => axis.select('.domain').remove())
    .call(axis => axis.selectAll('text')
      .attr('fill', '#64748b')
      .attr('font-size', '11px')
    )
    .call(axis => axis.selectAll('line').remove());

  const bars = g.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .selectAll('rect')
    .data(counts, d => d.region)
    .join('rect')
    .attr('class', 'bar density-bar')
    .attr('x', 0)
    .attr('y', d => y(d.region))
    .attr('height', y.bandwidth())
    .attr('width', 0)
    .attr('rx', 5)
    .style('fill', d => regionColor(d.region))
    .style('fill-opacity', d => {
      if (!activeBarRegion) return 0.84;
      return d.region === activeBarRegion ? 1 : 0.26;
    })
    .style('stroke', d => d.region === activeBarRegion ? '#111827' : 'none')
    .style('stroke-width', d => d.region === activeBarRegion ? 1.4 : 0)
    .style('cursor', 'pointer')
    .on('click', function (event, d) {
      activeBarRegion = activeBarRegion === d.region ? '' : d.region;
      render(currentData);
    })
    .on('mouseenter', function (event, d) {
      highlightRegion(points, d.region);
      d3.select(this).style('fill-opacity', 1);

      tooltip.show(event, Tooltip.buildHTML(`🧭 ${escapeHTML(d.region)}`, [
        {
          label: 'Số điểm đo',
          value: formatNumber(d.count),
          color: regionColor(d.region),
        },
        {
          label: 'Tổng số bản ghi',
          value: formatNumber(d.totalDays),
        },
        {
          label: 'Tương tác',
          value: 'Click để lọc bản đồ theo vùng này',
        },
      ]));
    })
    .on('mousemove', function (event, d) {
      tooltip.show(event, Tooltip.buildHTML(`🧭 ${escapeHTML(d.region)}`, [
        {
          label: 'Số điểm đo',
          value: formatNumber(d.count),
          color: regionColor(d.region),
        },
        {
          label: 'Tổng số bản ghi',
          value: formatNumber(d.totalDays),
        },
        {
          label: 'Tương tác',
          value: 'Click để lọc bản đồ theo vùng này',
        },
      ]));
    })
    .on('mouseleave', function (event, d) {
      resetHighlight(points);

      d3.select(this)
        .style('fill-opacity', () => {
          if (!activeBarRegion) return 0.84;
          return d.region === activeBarRegion ? 1 : 0.26;
        });

      tooltip.hide();
    });

  bars.transition()
    .duration(650)
    .attr('width', d => x(d.count));

  g.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .selectAll('text.value-label')
    .data(counts, d => d.region)
    .join('text')
    .attr('class', 'value-label')
    .attr('x', d => x(d.count) + 8)
    .attr('y', d => y(d.region) + y.bandwidth() / 2)
    .attr('dy', '0.35em')
    .attr('fill', '#334155')
    .attr('font-size', '11px')
    .attr('font-weight', 600)
    .style('cursor', 'pointer')
    .text(d => d.count)
    .on('click', function (event, d) {
      activeBarRegion = activeBarRegion === d.region ? '' : d.region;
      render(currentData);
    });
}

/* ============================================================
   MAP DECORATION
   ============================================================ */

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

/* ============================================================
   INTERACTION HELPERS
   ============================================================ */

function highlightRegion(points, region) {
  points
    .style('fill-opacity', d => d.region === region ? 0.96 : 0.16)
    .style('stroke-opacity', d => d.region === region ? 1 : 0.2);
}

function resetHighlight(points) {
  points
    .style('fill-opacity', 0.88)
    .style('stroke-opacity', 1);
}

/* ============================================================
   HELPERS
   ============================================================ */

function isValidCoord(d) {
  return Number.isFinite(+d.lat) && Number.isFinite(+d.lon);
}

function padExtent(extent, pad) {
  const [min, max] = extent;
  return [min - pad, max + pad];
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
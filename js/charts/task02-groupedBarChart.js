/**
 * Task 02 – Grouped Bar Chart: So sánh nhiệt độ giữa các vùng
 *
 * Chart: Grouped bar chart (max / avg / min per region)
 * X: location.region (band) | Y: temperature °C
 * Interactions: hover tooltip, sort toggle (TB / Max / Range), animated transitions
 *
 * @module task02-groupedBarChart
 */

import { regionColor, formatTemp } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const CONTAINER   = '#chart-task02';
const CONTROLS_EL = '#task02-controls';

const REGIONS = [
  'Đồng Bằng Sông Cửu Long',
  'Đông Nam Bộ',
  'Bắc Trung Bộ và Duyên hải miền Trung',
  'Trung du và miền núi Bắc Bộ',
  'Đồng Bằng Sông Hồng',
  'Tây Nguyên',
];

const REG_SHORT = {
  'Đồng Bằng Sông Cửu Long':                 'ĐBSCL',
  'Đông Nam Bộ':                              'ĐNB',
  'Bắc Trung Bộ và Duyên hải miền Trung':     'BTB&DHMT',
  'Trung du và miền núi Bắc Bộ':              'TD&MNBB',
  'Đồng Bằng Sông Hồng':                      'ĐBSH',
  'Tây Nguyên':                               'Tây Nguyên',
};

// 3 sub-series – màu cố định theo thiết kế trong ảnh
const SERIES = [
  { key: 'max', label: 'Trung bình nhiệt độ cao nhất trong ngày',   color: '#f87171' },  // đỏ/coral
  { key: 'avg', label: 'Trung bình nhiệt độ trong ngày', color: '#38bdf8' },  // xanh dương
  { key: 'min', label: 'Trung bình nhiệt độ thấp nhất trong ngày',  color: '#a78bfa' },  // tím
];

const MARGIN = { top: 28, right: 24, bottom: 72, left: 52 };

// ─── Module state ─────────────────────────────────────────────────────────────

const tooltip    = new Tooltip();
let currentSort  = 'avg';   // 'avg' | 'max' | 'range'
let _cachedData  = [];
let _cachedOpts  = {};

// ─── Init ─────────────────────────────────────────────────────────────────────

export function init() {
  _buildControls();
  console.log('📊 Task 02 – Grouped Bar Chart initialized');
}

function _buildControls() {
  const el = document.querySelector(CONTROLS_EL);
  if (!el) return;

  el.innerHTML = `
    <div class="ctrl-group" id="t02-sort-btns">
      <button class="btn btn--active" data-sort="avg">Sắp xếp: TB</button>
      <button class="btn"            data-sort="max">Sắp xếp: Max</button>
      <button class="btn"            data-sort="range">Sắp xếp: Range</button>
    </div>`;

  el.querySelector('#t02-sort-btns').addEventListener('click', e => {
    const btn = e.target.closest('[data-sort]');
    if (!btn) return;
    currentSort = btn.dataset.sort;
    el.querySelectorAll('[data-sort]').forEach(b =>
      b.classList.toggle('btn--active', b === btn));
    render(_cachedData, _cachedOpts);
  });
}

// ─── Render ───────────────────────────────────────────────────────────────────

/**
 * @param {Array}  data    - Parsed rows from dataLoader (one row = province-day)
 * @param {Object} options - global filter options (unused here but forwarded)
 */
export function render(data, options = {}) {
  _cachedData = data;
  _cachedOpts = options;

  const el = document.querySelector(CONTAINER);
  if (!el || !data?.length) {
    _showPlaceholder(' ', 'Không có dữ liệu');
    return;
  }

  // 1. Aggregate
  const regionStats = _aggregate(data);

  // 2. Sort
  const sorted = _sort(regionStats, currentSort);

  // 3. Dimensions
  el.innerHTML = '';
  const W = el.clientWidth || 720;
  const H = 380;
  const w = W - MARGIN.left - MARGIN.right;
  const h = H - MARGIN.top  - MARGIN.bottom;

  const svg = d3.select(el).append('svg')
    .attr('width', W).attr('height', H);

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // 4. Scales
  const x0 = d3.scaleBand()
    .domain(sorted.map(d => d.region))
    .range([0, w])
    .padding(0.22);

  const x1 = d3.scaleBand()
    .domain(SERIES.map(s => s.key))
    .range([0, x0.bandwidth()])
    .padding(0.05);

  const allVals = sorted.flatMap(d => [d.max, d.avg, d.min]);
  const yMin = d3.min(allVals) - 2;
  const yMax = d3.max(allVals) + 1;

  const y = d3.scaleLinear()
    .domain([yMin, yMax])
    .range([h, 0])
    .nice();

  // 5. Grid lines
  g.append('g').attr('class', 'grid')
    .selectAll('.grid-line')
    .data(y.ticks(5))
    .join('line')
      .attr('class', 'grid-line')
      .attr('x1', 0).attr('x2', w)
      .attr('y1', d => y(d)).attr('y2', d => y(d));

  // 6. Axes
  _drawAxes(g, x0, y, w, h);

  // 7. Bars
  const regionGs = g.selectAll('.region-group')
    .data(sorted)
    .join('g')
      .attr('class', 'region-group')
      .attr('transform', d => `translate(${x0(d.region)},0)`);

  regionGs.selectAll('.bar')
    .data(d => SERIES.map(s => ({ key: s.key, val: d[s.key], region: d.region, color: s.color })))
    .join('rect')
      .attr('class', 'bar')
      .attr('x',     d => x1(d.key))
      .attr('width',  x1.bandwidth())
      .attr('rx', 3)
      .attr('fill',  d => d.color)
      // Animate from bottom
      .attr('y', h)
      .attr('height', 0)
      .transition()
        .duration(600)
        .delay((_, i) => i * 60)
        .ease(d3.easeCubicOut)
        .attr('y',      d => y(d.val))
        .attr('height', d => h - y(d.val));

  // Value labels on top of bars
  regionGs.selectAll('.bar-label')
    .data(d => SERIES.map(s => ({ key: s.key, val: d[s.key] })))
    .join('text')
      .attr('class', 'bar-label')
      .attr('x', d => x1(d.key) + x1.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('font-family', 'var(--font-mono, monospace)')
      .attr('fill', 'var(--color-text-secondary, #9ca3b8)')
      .attr('opacity', 0)
      // position starts at bottom, animate up
      .attr('y', h - 4)
      .transition()
        .duration(600)
        .delay((_, i) => i * 60)
        .ease(d3.easeCubicOut)
        .attr('y',      d => y(d.val) - 4)
        .attr('opacity', 1)
      .selection()   // exit transition → keep label
        .text(d => d.val.toFixed(2));

  // 8. Hover interactions (re-select after transition)
  // Use an overlay rect per region group for reliable hover area
  regionGs.append('rect')
    .attr('class', 'hover-overlay')
    .attr('x', 0)
    .attr('width', x0.bandwidth())
    .attr('y', 0)
    .attr('height', h)
    .attr('fill', 'transparent')
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      // Dim other groups
      g.selectAll('.region-group').attr('opacity', rg => rg.region === d.region ? 1 : 0.4);

      const html = `
        <div class="chart-tooltip__title">
          ${REG_SHORT[d.region]}
        </div>
        <div class="chart-tooltip__divider"></div>
        ${SERIES.map(s => `
          <div class="chart-tooltip__row">
            <span class="chart-tooltip__label">
              <span class="chart-tooltip__color-dot" style="background:${s.color}"></span>
              ${s.label}
            </span>
            <span class="chart-tooltip__value">${d[s.key].toFixed(2)}°C</span>
          </div>`).join('')}
        <div class="chart-tooltip__divider"></div>
        <div class="chart-tooltip__row">
          <span class="chart-tooltip__label">Range (Max−Min)</span>
          <span class="chart-tooltip__value">${(d.max - d.min).toFixed(2)}°C</span>
        </div>`;

      tooltip.show(html, event);
    })
    .on('mousemove', event => tooltip.move(event))
    .on('mouseleave', function() {
      g.selectAll('.region-group').attr('opacity', 1);
      tooltip.hide();
    });

  // 9. Legend
  _buildLegend(svg, W, H);
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function _aggregate(data) {
  const accum = {};
  REGIONS.forEach(r => { accum[r] = { max: [], avg: [], min: [] }; });

  for (const row of data) {
    const r = row.region;
    if (!accum[r]) continue;
    if (!isNaN(row.maxTemp)) accum[r].max.push(row.maxTemp);
    if (!isNaN(row.avgTemp)) accum[r].avg.push(row.avgTemp);
    if (!isNaN(row.minTemp)) accum[r].min.push(row.minTemp);
  }

  return REGIONS.map(r => ({
    region: r,
    max: d3.mean(accum[r].max) ?? 0,
    avg: d3.mean(accum[r].avg) ?? 0,
    min: d3.mean(accum[r].min) ?? 0,
  }));
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

function _sort(stats, mode) {
  const copy = [...stats];
  if (mode === 'avg')   return copy.sort((a, b) => b.avg - a.avg);
  if (mode === 'max')   return copy.sort((a, b) => b.max - a.max);
  if (mode === 'range') return copy.sort((a, b) => (b.max - b.min) - (a.max - a.min));
  return copy;
}

// ─── Axes ─────────────────────────────────────────────────────────────────────

function _drawAxes(g, x0, y, w, h) {
  // X axis
  g.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${h})`)
    .call(
      d3.axisBottom(x0).tickFormat(r => REG_SHORT[r])
    )
    .call(ax => ax.select('.domain').remove())
    .selectAll('text')
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .attr('font-size', 11);

  // Y axis
  g.append('g')
    .attr('class', 'axis y-axis')
    .call(
      d3.axisLeft(y).ticks(5).tickFormat(d => `${d}°`)
    )
    .call(ax => ax.select('.domain').remove());
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function _buildLegend(svg, W, H) {
  const itemWidth = 300; 
  const rowHeight = 24;  
  const itemsPerRow = 2; 

  const lg = svg.append('g')
    .attr('class', 'legend-group')
    .attr('transform', `translate(0, ${H - 35})`); 

  const rows = [];
  for (let i = 0; i < SERIES.length; i += itemsPerRow) {
    rows.push(SERIES.slice(i, i + itemsPerRow));
  }

  rows.forEach((rowItems, rowIndex) => {
    const rowWidth = rowItems.length * itemWidth;
    
    const startX = (W - rowWidth + 100) / 2;

    rowItems.forEach((s, colIndex) => {
      const gItem = lg.append('g')
        .attr('transform', `translate(${startX + colIndex * itemWidth}, ${rowIndex * rowHeight})`);

      // Vẽ ô màu
      gItem.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('rx', 3)
        .attr('fill', s.color)
        .attr('y', -6); 

      // Vẽ Text
      gItem.append('text')
        .attr('x', 20)
        .attr('y', 0)
        .attr('font-size', 11)
        .attr('fill', 'var(--color-text-secondary, #9ca3b8)')
        .attr('dominant-baseline', 'middle') 
        .text(s.label);
    });
  });
}

// ─── Placeholder ─────────────────────────────────────────────────────────────

function _showPlaceholder(icon, label) {
  const el = document.querySelector(CONTAINER);
  if (!el) return;
  el.innerHTML = `
    <div class="chart-placeholder">
      <span class="chart-placeholder__icon">${icon}</span>
      <span>${label}</span>
    </div>`;
}

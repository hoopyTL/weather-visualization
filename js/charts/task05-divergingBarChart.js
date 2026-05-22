/**
 * Task 05 – Option 1: Diverging Bar Chart per Province
 *
 * Mỗi bar = 1 tỉnh thành (location.name)
 * Giá trị = chênh lệch so với trung bình toàn quốc (hoặc TB vùng) của metric được chọn
 * Màu bar = location.terrain (ven biển / đồng bằng / miền núi)
 *
 * Controls:
 *   - Metric select (6 chỉ số)
 *   - Baseline toggle: TB toàn quốc | TB vùng
 *   - Terrain filter: Tất cả | Ven biển | Nội địa
 *   - Sort: Chênh lệch | Tên tỉnh | Địa hình | Vùng
 *
 * @module task05-divergingBarChart
 */

import { Tooltip } from '../components/tooltip.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTAINER   = '#chart-task05';
const CONTROLS_EL = '#task05-controls';

const TERRAIN_COLORS = {
  'ven biển':   '#38bdf8',
  'đồng bằng':  '#34d399',
  'miền núi':   '#fb923c',
};

const INLAND_TERRAINS = ['đồng bằng', 'miền núi'];

const REG_SHORT = {
  'Đồng Bằng Sông Cửu Long':                 'ĐBSCL',
  'Đông Nam Bộ':                              'ĐNB',
  'Bắc Trung Bộ và Duyên hải miền Trung':     'BTB&DHMT',
  'Trung du và miền núi Bắc Bộ':              'TD&MNBB',
  'Đồng Bằng Sông Hồng':                      'ĐBSH',
  'Tây Nguyên':                               'Tây Nguyên',
};

const METRICS = [
  { key: 'avgTemp',       label: 'Nhiệt độ TB',  unit: '°C',  fmt: v => v.toFixed(2) + '°C',   desc: 'Nhiệt độ trung bình ngày' },
  { key: 'avgHumidity',   label: 'Độ ẩm',        unit: '%',   fmt: v => v.toFixed(1) + '%',    desc: 'Độ ẩm tương đối TB' },
  { key: 'maxWind',       label: 'Tốc độ gió',   unit: 'kph', fmt: v => v.toFixed(1) + ' kph', desc: 'Tốc độ gió tối đa TB' },
  { key: 'uv',            label: 'Chỉ số UV',    unit: '',    fmt: v => v.toFixed(2),           desc: 'Chỉ số UV TB' },
  { key: 'totalPrecip',   label: 'Lượng mưa',    unit: 'mm',  fmt: v => v.toFixed(1) + ' mm',  desc: 'Lượng mưa TB ngày' },
  { key: 'avgVisibility', label: 'Tầm nhìn',     unit: 'km',  fmt: v => v.toFixed(1) + ' km',  desc: 'Tầm nhìn TB' },
];

const MARGIN = { top: 20, right: 110, bottom: 52, left: 130 };
const ROW_H  = 22;   // px per province row

// ─── State ────────────────────────────────────────────────────────────────────

const tooltip     = new Tooltip();
let metric        = METRICS[0];
let baseline      = 'national';   // 'national' | 'regional'
let sortBy        = 'diff';       // 'diff' | 'name' | 'terrain' | 'region'
let filterTerrain = 'all';        // 'all' | 'ven biển' | 'inland'
let _data         = [];
let _opts         = {};
let viewMode = 'summary';

// ─── Init ─────────────────────────────────────────────────────────────────────

export function init() {
  _buildControls();
  console.log('📊 Task 05 – Diverging Bar (per province) initialized');
}

function _buildControls() {
  const el = document.querySelector(CONTROLS_EL);
  if (!el) return;

  el.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">

      <div class="select-wrapper">
        <select class="select" id="t05-metric">
          ${METRICS.map(m => `<option value="${m.key}">${m.label}</option>`).join('')}
        </select>
      </div>

      <div class="ctrl-group" id="t05-baseline">
        <button class="btn btn--active" data-base="national">So với TB toàn quốc</button>
        <button class="btn"             data-base="regional">So với TB vùng</button>
      </div>

      <div class="ctrl-group" id="t05-terrain">
        <button class="btn btn--active" data-terrain="all">Tất cả</button>
        <button class="btn" data-terrain="ven biển"
          style="border-left:3px solid #38bdf8">Ven biển</button>
        <button class="btn" data-terrain="inland"
          style="border-left:3px solid #aaa">Nội địa</button>
      </div>

      <div class="ctrl-group" id="t05-viewmode" style="margin-bottom: 12px; display: flex; width: 100%; border-bottom: 1px solid #eee; padding-bottom: 10px;">
        <button class="btn" data-view="province" style="font-weight: bold;">Chi tiết từng tỉnh</button>
        <button class="btn btn--active" data-view="summary" style="font-weight: bold;">Đánh giá Tổng quát</button>
      </div>

      <div class="select-wrapper">
        <select class="select" id="t05-sort">
          <option value="diff">Sắp xếp: Chênh lệch</option>
          <option value="name">Sắp xếp: Tên tỉnh</option>
          <option value="terrain">Sắp xếp: Địa hình</option>
          <option value="region">Sắp xếp: Vùng</option>
        </select>
      </div>

    </div>`;

  el.querySelector('#t05-metric').addEventListener('change', e => {
    metric = METRICS.find(m => m.key === e.target.value);
    render(_data, _opts);
  });

  el.querySelector('#t05-baseline').addEventListener('click', e => {
    const btn = e.target.closest('[data-base]');
    if (!btn) return;
    baseline = btn.dataset.base;
    el.querySelectorAll('[data-base]').forEach(b =>
      b.classList.toggle('btn--active', b === btn));
    render(_data, _opts);
  });

  el.querySelector('#t05-terrain').addEventListener('click', e => {
    const btn = e.target.closest('[data-terrain]');
    if (!btn) return;
    filterTerrain = btn.dataset.terrain;
    el.querySelectorAll('[data-terrain]').forEach(b =>
      b.classList.toggle('btn--active', b === btn));
    render(_data, _opts);
  });

  el.querySelector('#t05-sort').addEventListener('change', e => {
    sortBy = e.target.value;
    render(_data, _opts);
  });

  el.querySelector('#t05-viewmode').addEventListener('click', e => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    
    viewMode = btn.dataset.view;

    el.querySelectorAll('[data-view]').forEach(b =>
      b.classList.toggle('btn--active', b === btn));
      
    // Render lại biểu đồ dựa trên chế độ mới
    render(_data, _opts);
  });
}

function _drawSummary(el, data) {
  console.log('el.getBoundingClientRect():', el.getBoundingClientRect());
  console.log('el.offsetWidth:', el.offsetWidth);
  console.log('el.parentElement.offsetWidth:', el.parentElement?.offsetWidth);
  console.log('el.parentElement.parentElement.offsetWidth:', el.parentElement?.parentElement?.offsetWidth);
  const summaryData = METRICS.map(m => {
    const validData = data.filter(d => d[m.key] != null && !isNaN(+d[m.key]));
    
    const coastal = validData.filter(d => d.terrain === 'ven biển');
    const inland = validData.filter(d => INLAND_TERRAINS.includes(d.terrain));
    
    const cAvg = d3.mean(coastal, d => +d[m.key]) || 0;
    const iAvg = d3.mean(inland, d => +d[m.key]) || 0;
    
    const diffPct = iAvg ? ((cAvg - iAvg) / iAvg) * 100 : 0;
    
    return {
      name: m.label,
      metricBase: m,
      cAvg, iAvg, diffPct
    };
  }).sort((a, b) => Math.abs(b.diffPct) - Math.abs(a.diffPct)); // Sort tuyệt đối giảm dần

  // 2. Vẽ biểu đồ
  const W = Math.max(el.getBoundingClientRect().width, 700);
  const H = 400;
  const W_MARGIN = { top: 40, right: 80, bottom: 40, left: 120 };
  const w = W - W_MARGIN.left - W_MARGIN.right;
  const h = H - W_MARGIN.top - W_MARGIN.bottom;

  const svg = d3.select(el).append('svg')
    .attr('width', W)
    .attr('height', Math.max(H, 200))
    .attr('viewBox', `0 0 ${W} ${Math.max(H, 200)}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');
  // Tiêu đề
  svg.append('text')
    .attr('x', W_MARGIN.left).attr('y', 20)
    .attr('font-size', 14).attr('font-weight', 'bold').attr('fill', 'var(--color-text-main, #050505)')
    .text('Tổng quan chênh lệch (%): Ven biển so với Nội địa');

  const g = svg.append('g').attr('transform', `translate(${W_MARGIN.left},${W_MARGIN.top})`);

  // Scales
  const minVal = d3.min(summaryData, d => d.diffPct) || 0;
  const maxVal = d3.max(summaryData, d => d.diffPct) || 0;
  // Tự động scale mượt mà cả 2 bên trái phải, giữ điểm 0
  const x = d3.scaleLinear()
    .domain([Math.min(0, minVal * 1.2), Math.max(0, maxVal * 1.2)]) 
    .range([0, w]);
  const y = d3.scaleBand().domain(summaryData.map(d => d.name)).range([0, h]).padding(0.3);

  // Trục 0
  g.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', h)
   .attr('stroke', '#333').attr('stroke-width', 1.5).attr('stroke-dasharray', '4,4');

  // Bars
  g.selectAll('.sbar').data(summaryData).join('rect').attr('class', 'sbar')
    .attr('y', d => y(d.name)).attr('height', y.bandwidth())
    .attr('fill', d => d.diffPct >= 0 ? '#0ea5e9' : '#f97316') // Xanh dương cho dương, Cam cho âm
    .attr('rx', 3)
    .attr('x', x(0)).attr('width', 0) // Hiệu ứng ban đầu
    .transition().duration(800).ease(d3.easeCubicOut)
    .attr('x', d => Math.min(x(0), x(d.diffPct)))
    .attr('width', d => Math.abs(x(d.diffPct) - x(0)));

  // Text % trên bar
  g.selectAll('.stext').data(summaryData).join('text').attr('class', 'stext')
    .attr('y', d => y(d.name) + y.bandwidth() / 2 + 4)
    .attr('x', x(0)).style('opacity', 0)
    .attr('text-anchor', d => d.diffPct < 0 ? 'end' : 'start')
    .attr('font-size', 11).attr('font-weight', 'bold').attr('fill', '#131414')
    .text(d => `${d.diffPct > 0 ? '+' : ''}${d.diffPct.toFixed(1)}%`)
    .transition().duration(800).delay(200)
    .attr('x', d => x(d.diffPct) + (d.diffPct < 0 ? -6 : 6))
    .style('opacity', 1);

  // Nhãn trục Y (Tên chỉ số)
  g.selectAll('.sylabel').data(summaryData).join('text').attr('class', 'sylabel')
    .attr('x', -10).attr('y', d => y(d.name) + y.bandwidth() / 2 + 4)
    .attr('text-anchor', 'end').attr('font-size', 12)
    .attr('fill', '#171515')
    .text(d => d.name);

  // Tooltip tương tác
  g.selectAll('.shover').data(summaryData).join('rect')
    .attr('y', d => y(d.name)).attr('height', y.bandwidth())
    .attr('x', 0).attr('width', w).attr('fill', 'transparent').style('cursor', 'pointer')
    .on('mouseover', (event, d) => {
      tooltip.show(`
        <div style="font-weight:bold; margin-bottom: 5px">${d.name}</div>
        <div>Ven biển: <span style="color:#0ea5e9; font-weight:bold">${d.cAvg.toFixed(1)}</span> ${d.metricBase.unit}</div>
        <div>Nội địa: <span style="color:#f97316; font-weight:bold">${d.iAvg.toFixed(1)}</span> ${d.metricBase.unit}</div>
        <hr style="margin:5px 0; border:0; border-top:1px solid #ccc"/>
        <div>Chênh lệch: <strong style="color:${d.diffPct>=0?'#0ea5e9':'#f97316'}">
          ${d.diffPct > 0 ? '+' : ''}${d.diffPct.toFixed(1)}%
        </strong></div>
      `, event);
    })
    .on('mousemove', e => tooltip.move(e))
    .on('mouseleave', () => tooltip.hide());
    
  // Legend Text ở dưới cùng
  svg.append('text').attr('x', W_MARGIN.left).attr('y', H - 5).attr('font-size', 11).attr('fill', '#f97316').text('← Nội địa cao hơn');
  svg.append('text').attr('x', W_MARGIN.left + w).attr('y', H - 5).attr('font-size', 11).attr('fill', '#0ea5e9').attr('text-anchor', 'end').text('Ven biển cao hơn →');
}

// ─── Render ───────────────────────────────────────────────────────────────────

export function render(data, options = {}) {
  _data = data;
  _opts = options;

  const el = document.querySelector(CONTAINER);
  if (!el || !data?.length) { _placeholder(); return; }

  el.innerHTML = ''; // Xóa biểu đồ cũ

  // ĐIỀU HƯỚNG VIEW MODE
  if (viewMode === 'summary') {
    _drawSummary(el, data);
    return; // Dừng tại đây, không chạy code bên dưới
  }

  // --- Luồng vẽ cũ cho chế độ "Chi tiết từng tỉnh" ---
  const provinces  = _aggregate(data);
  const withDiff   = _computeDiff(provinces);
  const filtered   = _filter(withDiff);

  if (!filtered.length) { _placeholder('Không có dữ liệu cho bộ lọc này'); return; }

  const sorted = _sort(filtered);
  _draw(el, sorted);
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function _aggregate(data) {
  const accum = {};

  for (const row of data) {
    const name = row.name;
    if (!accum[name]) {
      accum[name] = { name, terrain: row.terrain, region: row.region, vals: [] };
    }
    const v = row[metric.key];
    if (v != null && !isNaN(+v)) accum[name].vals.push(+v);
  }

  return Object.values(accum)
    .map(p => ({
      name:    p.name,
      terrain: p.terrain,
      region:  p.region,
      value:   d3.mean(p.vals),
      n:       p.vals.length,
    }))
    .filter(p => p.value != null && !isNaN(p.value));
}

function _computeDiff(provinces) {
  if (baseline === 'national') {
    const nat = d3.mean(provinces, p => p.value);
    return provinces.map(p => ({
      ...p,
      baseline: nat,
      diff: +(p.value - nat).toFixed(3),
    }));
  }

  // Regional
  const regionMeans = {};
  d3.group(provinces, p => p.region).forEach((ps, r) => {
    regionMeans[r] = d3.mean(ps, p => p.value);
  });

  return provinces.map(p => ({
    ...p,
    baseline: regionMeans[p.region],
    diff: +(p.value - regionMeans[p.region]).toFixed(3),
  }));
}

function _filter(provinces) {
  if (filterTerrain === 'ven biển') return provinces.filter(p => p.terrain === 'ven biển');
  if (filterTerrain === 'inland')   return provinces.filter(p => INLAND_TERRAINS.includes(p.terrain));
  return provinces;
}

function _sort(provinces) {
  const copy = [...provinces];
  if (sortBy === 'diff')    return copy.sort((a, b) => b.diff - a.diff);
  if (sortBy === 'name')    return copy.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  if (sortBy === 'terrain') return copy.sort((a, b) =>
    a.terrain.localeCompare(b.terrain) || b.diff - a.diff);
  if (sortBy === 'region')  return copy.sort((a, b) =>
    a.region.localeCompare(b.region) || b.diff - a.diff);
  return copy;
}

// ─── Draw ─────────────────────────────────────────────────────────────────────

function _draw(el, rows) {
  const W = Math.max(el.getBoundingClientRect().width || 900, 700);
  const H  = MARGIN.top + rows.length * ROW_H + MARGIN.bottom;
  const w  = W - MARGIN.left - MARGIN.right;

  const svg = d3.select(el).append('svg')
    .attr('width', W)
    .attr('height', Math.max(H, 200))
    .attr('viewBox', `0 0 ${W} ${Math.max(H, 200)}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Subtitle
  svg.append('text')
    .attr('x', MARGIN.left).attr('y', 12)
    .attr('font-size', 10.5)
    .attr('fill', 'var(--color-text-muted)')
    .text(`${metric.desc} — chênh lệch so với TB ${baseline === 'national' ? 'toàn quốc' : 'vùng kinh tế'}`);

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // Scales
  const minDiff = d3.min(rows, d => d.diff) || 0;
  const maxDiff = d3.max(rows, d => d.diff) || 0;
  const x = d3.scaleLinear()
    .domain([Math.min(0, minDiff * 1.18), Math.max(0, maxDiff * 1.18)])
    .range([0, w]);
  const y   = d3.scaleBand()
    .domain(rows.map(d => d.name))
    .range([0, rows.length * ROW_H])
    .padding(0.18);

  // Vertical grid
  g.append('g').selectAll('.vgl')
    .data(x.ticks(6))
    .join('line')
      .attr('class', 'grid-line')
      .attr('x1', d => x(d)).attr('x2', d => x(d))
      .attr('y1', 0).attr('y2', rows.length * ROW_H);

  // Zero line
  g.append('line')
    .attr('x1', x(0)).attr('x2', x(0))
    .attr('y1', 0).attr('y2', rows.length * ROW_H)
    .attr('stroke', 'var(--color-border)')
    .attr('stroke-width', 2);

  // Group separator lines when sorted by terrain or region
  if (sortBy === 'region' || sortBy === 'terrain') {
    let lastGroup = null;
    rows.forEach((d, i) => {
      const group = sortBy === 'region' ? d.region : d.terrain;
      if (lastGroup !== null && group !== lastGroup) {
        g.append('line')
          .attr('x1', -MARGIN.left + 4).attr('x2', w + MARGIN.right - 4)
          .attr('y1', i * ROW_H - 2).attr('y2', i * ROW_H - 2)
          .attr('stroke', 'var(--color-border-light, #3a3d50)')
          .attr('stroke-dasharray', '4,3');

        // Group label
        g.append('text')
          .attr('x', -MARGIN.left + 6)
          .attr('y', i * ROW_H - 5)
          .attr('font-size', 9)
          .attr('fill', 'var(--color-text-muted)')
          .attr('font-style', 'italic')
          .text(sortBy === 'region' ? REG_SHORT[d.region] : d.terrain);
      }
      lastGroup = group;
    });
  }

  // Bars
  g.selectAll('.pbar')
    .data(rows)
    .join('rect')
      .attr('class', 'pbar')
      .attr('y',       d => y(d.name))
      .attr('height',  y.bandwidth())
      .attr('rx', 2)
      .attr('fill',    d => TERRAIN_COLORS[d.terrain] ?? '#888')
      .attr('opacity', 0.82)
      // animate from zero
      .attr('x', x(0)).attr('width', 0)
      .transition().duration(500).ease(d3.easeCubicOut)
      .delay((_, i) => Math.min(i * 5, 350))
      .attr('x',     d => d.diff >= 0 ? x(0) : x(d.diff))
      .attr('width', d => Math.abs(x(d.diff) - x(0)));

  // Value labels (right column)
  g.selectAll('.pval')
    .data(rows)
    .join('text')
      .attr('class', 'pval')
      .attr('y',    d => y(d.name) + y.bandwidth() / 2 + 3.5)
      .attr('x',    w + 6)
      .attr('font-size', 9)
      .attr('font-family', 'var(--font-mono, monospace)')
      .attr('fill', d => TERRAIN_COLORS[d.terrain] ?? '#888')
      .attr('opacity', 0)
      .text(d => (d.diff > 0 ? '+' : '') + metric.fmt(d.diff))
      .transition().delay(300).duration(300)
      .attr('opacity', 1);

  // Province name labels (left)
  g.selectAll('.plabel')
    .data(rows)
    .join('text')
      .attr('class', 'plabel')
      .attr('x', -8)
      .attr('y', d => y(d.name) + y.bandwidth() / 2 + 3.5)
      .attr('text-anchor', 'end')
      .attr('font-size', 10)
      .attr('fill', d => TERRAIN_COLORS[d.terrain] ?? 'var(--color-text-secondary)')
      .text(d => d.name);

  // X axis
  g.append('g')
    .attr('transform', `translate(0,${rows.length * ROW_H})`)
    .call(
      d3.axisBottom(x).ticks(6)
        .tickFormat(v => (v > 0 ? '+' : '') + v + (metric.unit ? metric.unit : ''))
    )
    .call(ax => ax.select('.domain').remove())
    .selectAll('text')
      .attr('font-size', 10)
      .attr('fill', 'var(--color-text-muted)');

  // Direction annotations
  const zx = x(0);
  svg.append('text')
    .attr('x', MARGIN.left + zx + 8).attr('y', H - 28)
    .attr('font-size', 9.5).attr('fill', '#9ca3b8').attr('opacity', .55)
    .text('↑ Cao hơn TB');
  svg.append('text')
    .attr('x', MARGIN.left + zx - 8).attr('y', H - 28)
    .attr('text-anchor', 'end')
    .attr('font-size', 9.5).attr('fill', '#9ca3b8').attr('opacity', .55)
    .text('Thấp hơn TB ↓');

  // Legend
  const terrains = ['ven biển', 'đồng bằng', 'miền núi'];
  const lgG = svg.append('g')
    .attr('transform', `translate(${MARGIN.left + w / 2 - 160}, ${H - 14})`);
  terrains.forEach((t, i) => {
    const gi = lgG.append('g').attr('transform', `translate(${i * 112}, 0)`);
    gi.append('rect').attr('width', 9).attr('height', 9).attr('rx', 2)
      .attr('fill', TERRAIN_COLORS[t]);
    gi.append('text').attr('x', 13).attr('y', 9)
      .attr('font-size', 10)
      .attr('fill', 'var(--color-text-secondary)')
      .text(t);
  });

  // Hover overlay
  g.selectAll('.hover-bar')
    .data(rows)
    .join('rect')
      .attr('class', 'hover-bar')
      .attr('x', -MARGIN.left)
      .attr('y', d => y(d.name))
      .attr('width', W)
      .attr('height', y.step())
      .attr('fill', 'transparent')
      .style('cursor', 'default')
      .on('mouseover', function(event, d) {
        g.selectAll('.pbar').attr('opacity', b => b.name === d.name ? 1 : 0.2);
        g.selectAll('.plabel').attr('font-weight', b => b.name === d.name ? '600' : 'normal');

        tooltip.show(`
          <div class="chart-tooltip__title">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;
              background:${TERRAIN_COLORS[d.terrain]};margin-right:5px;flex-shrink:0"></span>
            ${d.name}
          </div>
          <div class="chart-tooltip__divider"></div>
          <div class="chart-tooltip__row">
            <span class="chart-tooltip__label">Địa hình</span>
            <span class="chart-tooltip__value">${d.terrain}</span>
          </div>
          <div class="chart-tooltip__row">
            <span class="chart-tooltip__label">Vùng</span>
            <span class="chart-tooltip__value">${REG_SHORT[d.region]}</span>
          </div>
          <div class="chart-tooltip__divider"></div>
          <div class="chart-tooltip__row">
            <span class="chart-tooltip__label">${metric.label}</span>
            <span class="chart-tooltip__value">${metric.fmt(d.value)}</span>
          </div>
          <div class="chart-tooltip__row">
            <span class="chart-tooltip__label">TB ${baseline === 'national' ? 'toàn quốc' : 'vùng'}</span>
            <span class="chart-tooltip__value">${metric.fmt(d.baseline)}</span>
          </div>
          <div class="chart-tooltip__row">
            <span class="chart-tooltip__label">Chênh lệch</span>
            <span class="chart-tooltip__value"
              style="color:${d.diff >= 0 ? '#34d399' : '#f87171'}">
              ${d.diff > 0 ? '+' : ''}${metric.fmt(d.diff)}
            </span>
          </div>
          <div class="chart-tooltip__row">
            <span class="chart-tooltip__label">Ngày quan trắc</span>
            <span class="chart-tooltip__value">${d.n}</span>
          </div>
        `, event);
      })
      .on('mousemove', e => tooltip.move(e))
      .on('mouseleave', function() {
        g.selectAll('.pbar').attr('opacity', 0.82);
        g.selectAll('.plabel').attr('font-weight', 'normal');
        tooltip.hide();
      });
}

// ─── Placeholder ─────────────────────────────────────────────────────────────

function _placeholder(msg = 'Task 5: Ven biển vs Nội địa') {
  const el = document.querySelector(CONTAINER);
  if (!el) return;
  el.innerHTML = `
    <div class="chart-placeholder">
      <span class="chart-placeholder__icon">↔️</span>
      <span>${msg}</span>
    </div>`;
}

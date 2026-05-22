/**
 * Task 01 – Line Chart: Nhiệt độ trung bình tháng theo vùng
 *
 * Chart  : Multi-line + gradient area fill (monthly aggregated)
 * X      : tháng  |  Y: avgTemp (°C)  |  Color: region
 * Extras : toggle Theo vùng / Tổng hợp, legend click ẩn/hiện,
 *          hover crosshair tooltip, brush-zoom, stat cards
 *
 * @module task01-lineChart
 */

import { regionColor, formatTemp } from '../utils.js';

const CONTAINER   = '#chart-task01';
const CONTROLS_ID = '#task01-controls';
const LEGEND_ID   = '#task01-legend';

/* ── Tooltip ── */
const _tt = (() => {
  let el = document.getElementById('_t01_tooltip');
  if (!el) {
    el = document.createElement('div');
    el.id = '_t01_tooltip';
    el.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:9999',
      'background:#1a1d2e',
      'border:1px solid #2a2d3e',
      'border-radius:10px',
      'padding:11px 15px',
      'font-size:12px',
      'font-family:var(--font-primary,Inter,sans-serif)',
      'color:#e8eaf0',
      'opacity:0',
      'transition:opacity 0.12s',
      'min-width:190px',
      'max-width:260px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.55)',
      'backdrop-filter:blur(8px)',
    ].join(';');
    document.body.appendChild(el);
  }
  return {
    show(html, event) {
      el.innerHTML = html;
      el.style.opacity = '1';
      this._move(event);
    },
    move(event) { this._move(event); },
    hide() { el.style.opacity = '0'; },
    _move(event) {
      const W = window.innerWidth, H = window.innerHeight;
      const tw = el.offsetWidth  || 220;
      const th = el.offsetHeight || 160;
      const gap = 14;
      let x = event.clientX + gap;
      let y = event.clientY - 20;
      if (x + tw > W - 8) x = event.clientX - tw - gap;
      if (y + th > H - 8) y = H - th - 8;
      if (y < 4) y = 4;
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
    },
  };
})();

const REGION_SHORT = {
  'Đồng Bằng Sông Hồng':                     'Đồng Bằng Sông Hồng',
  'Trung du và miền núi Bắc Bộ':              'Trung du và miền núi Bắc Bộ',
  'Bắc Trung Bộ và Duyên hải miền Trung':     'Bắc Trung Bộ và Duyên hải miền Trung',
  'Tây Nguyên':                                'Tây Nguyên',
  'Đông Nam Bộ':                               'Đông Nam Bộ',
  'Đồng Bằng Sông Cửu Long':                  'Đồng Bằng Sông Cửu Long',
};

let svg, g, xAxisG, yAxisG, linesG, areasG, dotsG, brushG, clipPathId;
let width, height, margin;
let xScale, yScale;
let _monthlyData = [];   // cache aggregated data
let _dimmed      = new Set();
let _view        = 'region'; // 'region' | 'all'

export function init() {
  const containerEl = d3.select(CONTAINER);
  if (containerEl.empty()) return;
  containerEl.html('');

  margin = { top: 24, right: 24, bottom: 52, left: 52 };

  const node = document.querySelector(CONTAINER);
  const W    = node ? (node.getBoundingClientRect().width  || 900) : 900;
  const H    = 420;

  width  = W - margin.left - margin.right;
  height = H - margin.top  - margin.bottom;

  svg = containerEl.append('svg')
    .attr('width',  W)
    .attr('height', H)
    .style('overflow', 'visible');

  // Gradient defs (1 per region + 1 for "all")
  const defs = svg.append('defs');
  _buildGradients(defs);

  // Clip path
  clipPathId = `clip-task01-${Math.floor(Math.random() * 1e6)}`;
  defs.append('clipPath').attr('id', clipPathId)
    .append('rect').attr('width', width).attr('height', height + 4);

  g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  areasG = g.append('g').attr('class', 'areas-group').attr('clip-path', `url(#${clipPathId})`);
  linesG = g.append('g').attr('class', 'lines-group').attr('clip-path', `url(#${clipPathId})`);
  dotsG  = g.append('g').attr('class', 'dots-group' ).attr('clip-path', `url(#${clipPathId})`);
  xAxisG = g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${height})`);
  yAxisG = g.append('g').attr('class', 'y-axis');
  brushG = g.append('g').attr('class', 'brush');

  // Crosshair line (ẩn mặc định)
  g.append('line')
    .attr('class', 'crosshair')
    .attr('y1', 0).attr('y2', height)
    .attr('stroke', 'rgba(255,255,255,0.18)')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,3')
    .style('opacity', 0)
    .style('pointer-events', 'none');

  // Y-axis label
  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2).attr('y', -40)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--color-text-muted)')
    .attr('font-size', '11px')
    .text('Nhiệt độ TB (°C)');

  console.log('📊 Task 01 – Line Chart initialized');
}

/* ============================================================
   RENDER – gọi mỗi khi data / filter thay đổi
   ============================================================ */
export function render(data, options = {}) {
  if (!g) init();
  if (!data || data.length === 0) return;

  // 1. Aggregate theo tháng
  _monthlyData = _aggregateMonthly(data);
  if (_monthlyData.length === 0) return;

  // 2. Inject controls + legend + stats (chỉ lần đầu)
  _injectControls();
  _buildLegend();
  _buildStatCards(_monthlyData);

  // 3. Vẽ
  _drawChart();
}

/* ============================================================
   VẼ CHART – dùng lại khi toggle / legend click
   ============================================================ */
function _drawChart() {
  const allMonths   = _monthlyData[0].points.map(p => p.monthKey);
  const visibleData = _view === 'all'
    ? _monthlyData
    : _monthlyData.filter(d => !_dimmed.has(d.region));

  const displayData = visibleData.length ? visibleData : _monthlyData;

  // ── Scales ────────────────────────────────────────────────
  xScale = d3.scalePoint()
    .domain(allMonths)
    .range([0, width])
    .padding(0.1);

  const allTemps = displayData.flatMap(d => d.points.map(p => p.avgTemp));
  const [minT, maxT] = d3.extent(allTemps);
  yScale = d3.scaleLinear()
    .domain([Math.floor(minT) - 2, Math.ceil(maxT) + 1])
    .range([height, 0])
    .nice();

  // ── Generators ────────────────────────────────────────────
  const lineGen = d3.line()
    .x(d => xScale(d.monthKey))
    .y(d => yScale(d.avgTemp))
    .defined(d => d.avgTemp != null && !isNaN(d.avgTemp))
    .curve(d3.curveCatmullRom.alpha(0.5));

  const areaGen = d3.area()
    .x(d => xScale(d.monthKey))
    .y0(height)
    .y1(d => yScale(d.avgTemp))
    .defined(d => d.avgTemp != null && !isNaN(d.avgTemp))
    .curve(d3.curveCatmullRom.alpha(0.5));

  // ── Axes ──────────────────────────────────────────────────
  const xAxis = d3.axisBottom(xScale)
    .tickFormat(k => _monthKeyToLabel(k));

  const yAxis = d3.axisLeft(yScale)
    .ticks(6)
    .tickFormat(d => `${d}°`);

  xAxisG.transition().duration(600).call(xAxis)
    .selectAll('text')
      .attr('font-size', '11px')
      .attr('fill', 'var(--color-text-muted)');
  xAxisG.select('.domain').attr('stroke', 'var(--color-border)');
  xAxisG.selectAll('.tick line').attr('stroke', 'var(--color-border)');

  yAxisG.transition().duration(600).call(yAxis)
    .selectAll('text')
      .attr('font-size', '11px')
      .attr('fill', 'var(--color-text-muted)');
  yAxisG.select('.domain').remove();
  yAxisG.selectAll('.tick line').attr('stroke', 'var(--color-border)');

  // Grid Y
  g.selectAll('.grid-line').remove();
  yScale.ticks(6).forEach(tick => {
    g.insert('line', ':first-child')
      .attr('class', 'grid-line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', yScale(tick)).attr('y2', yScale(tick))
      .attr('stroke', 'var(--color-border)')
      .attr('stroke-opacity', 0.45)
      .attr('stroke-dasharray', '3,3');
  });

  // ── Chọn data để vẽ tuỳ theo view ─────────────────────────
  let drawData;
  if (_view === 'all') {
    // Tính trung bình tất cả vùng theo tháng
    const avgPoints = allMonths.map(mk => {
      const vals = _monthlyData.map(d => d.points.find(p => p.monthKey === mk)?.avgTemp).filter(v => v != null);
      return { monthKey: mk, avgTemp: d3.mean(vals) };
    });
    drawData = [{ region: '__all__', points: avgPoints }];
  } else {
    drawData = _monthlyData.map(d => ({
      ...d,
      points: d.points,
      _dimmed: _dimmed.has(d.region),
    }));
  }

  // ── AREAS ─────────────────────────────────────────────────
  const areas = areasG.selectAll('.area-path')
    .data(drawData, d => d.region);

  areas.exit().transition().duration(300).style('opacity', 0).remove();

  areas.enter().append('path').attr('class', 'area-path')
    .attr('fill', d => `url(#area-grad-${_gradId(d.region)})`)
    .attr('opacity', 0)
    .merge(areas)
    .attr('fill', d => `url(#area-grad-${_gradId(d.region)})`)
    .transition().duration(600)
    .attr('opacity', d => d._dimmed ? 0 : 1)
    .attr('d', d => areaGen(d.points));

  // ── LINES ─────────────────────────────────────────────────
  const lines = linesG.selectAll('.line-path')
    .data(drawData, d => d.region);

  lines.exit().transition().duration(300).style('opacity', 0).remove();

  lines.enter().append('path')
    .attr('class', 'line-path')
    .attr('fill', 'none')
    .attr('stroke-width', 2.2)
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')
    .attr('stroke', d => _getColor(d.region))
    .attr('opacity', 0)
    .merge(lines)
    .attr('stroke', d => _getColor(d.region))
    .transition().duration(600)
    .attr('opacity', d => d._dimmed ? 0.1 : 0.95)
    .attr('d', d => lineGen(d.points));

  // ── DOTS ──────────────────────────────────────────────────
  dotsG.selectAll('.dot-group').remove();

  drawData.forEach(series => {
    if (series._dimmed) return;
    const color = _getColor(series.region);
    dotsG.append('g').attr('class', 'dot-group')
      .selectAll('circle')
      .data(series.points.filter(p => p.avgTemp != null))
      .enter().append('circle')
        .attr('cx', d => xScale(d.monthKey))
        .attr('cy', d => yScale(d.avgTemp))
        .attr('r', 3.8)
        .attr('fill', color)
        .attr('stroke', 'var(--color-bg-card)')
        .attr('stroke-width', 1.8)
        .style('cursor', 'pointer');
  });

  // ── HOVER ─────────────────────────────────────────────────
  _setupHover(drawData, allMonths);

  // ── BRUSH ZOOM ────────────────────────────────────────────
  _setupBrush(drawData, lineGen, areaGen, xAxis);
}

/* ============================================================
   HOVER INTERACTION
   – crosshair dọc snap theo tháng
   – dot highlight (phóng to + viền trắng) tại cột đang hover
   – line highlight (đường hovered sáng hơn, còn lại mờ đi)
   – tooltip hiện đầy đủ: tháng, tất cả vùng sắp xếp cao→thấp,
     kèm mini bar biểu diễn tương quan nhiệt độ
   ============================================================ */
function _setupHover(drawData, allMonths) {
  const crosshair   = g.select('.crosshair');
  const hoverDotsG  = g.select('.dots-group'); // reuse dotsG layer

  g.selectAll('.overlay-rect').remove();
  g.selectAll('.hover-dot-overlay').remove();

  // Layer riêng cho hover dots (nằm trên dotsG)
  const hoverLayer = g.append('g').attr('class', 'hover-dot-overlay');

  g.append('rect')
    .attr('class', 'overlay-rect')
    .attr('width', width).attr('height', height)
    .attr('fill', 'none')
    .attr('pointer-events', 'all')
    .on('mouseover', () => crosshair.style('opacity', 1))
    .on('mouseout',  () => {
      crosshair.style('opacity', 0);
      _tt.hide();
      // Reset line opacity
      linesG.selectAll('.line-path').attr('opacity', d => d._dimmed ? 0.1 : 0.95).attr('stroke-width', 2.2);
      areasG.selectAll('.area-path').attr('opacity', d => d._dimmed ? 0   : 1);
      hoverLayer.selectAll('*').remove();
    })
    .on('mousemove', function(event) {
      const [mx] = d3.pointer(event, this);

      // ── Snap đến tháng gần nhất ─────────────────────────
      const step    = xScale.step();
      const padding = xScale.padding() * step;
      const idx     = Math.round((mx - padding) / step);
      const safeIdx = Math.max(0, Math.min(allMonths.length - 1, idx));
      const mk      = allMonths[safeIdx];
      const cx      = xScale(mk);

      crosshair.attr('x1', cx).attr('x2', cx);

      // ── Rows data ────────────────────────────────────────
      const rows = drawData
        .filter(d => !d._dimmed)
        .map(d => {
          const pt = d.points.find(p => p.monthKey === mk);
          return { region: d.region, val: pt?.avgTemp };
        })
        .filter(r => r.val != null)
        .sort((a, b) => b.val - a.val);

      // ── Highlight lines ──────────────────────────────────
      // Khi hover: tất cả line mờ xuống, chỉ line cao nhất sáng nhất
      // (hoặc trong mode 'all' thì 1 line duy nhất — không thay đổi)
      if (_view === 'region' && rows.length > 1) {
        linesG.selectAll('.line-path').each(function(d) {
          const isTop = d.region === rows[0].region;
          d3.select(this)
            .transition().duration(80)
            .attr('opacity',      d._dimmed ? 0.08 : (isTop ? 1 : 0.25))
            .attr('stroke-width', d._dimmed ? 0    : (isTop ? 3   : 1.5));
        });
        areasG.selectAll('.area-path').each(function(d) {
          const isTop = d.region === rows[0].region;
          d3.select(this)
            .transition().duration(80)
            .attr('opacity', d._dimmed ? 0 : (isTop ? 1 : 0.3));
        });
      }

      // ── Hover dots (phóng to tại cột đang hover) ─────────
      hoverLayer.selectAll('*').remove();
      rows.forEach(r => {
        const color = _getColor(r.region);
        const cy    = yScale(r.val);
        // Vòng ngoài glow
        hoverLayer.append('circle')
          .attr('cx', cx).attr('cy', cy).attr('r', 8)
          .attr('fill', color).attr('opacity', 0.18);
        // Dot chính
        hoverLayer.append('circle')
          .attr('cx', cx).attr('cy', cy).attr('r', 5)
          .attr('fill', color)
          .attr('stroke', '#fff').attr('stroke-width', 1.8);
        // Label nhiệt độ nhỏ bên cạnh dot (chỉ hiện cho vùng cao nhất)
        if (r.region === rows[0].region && _view === 'region') {
          hoverLayer.append('text')
            .attr('x', cx + 9).attr('y', cy + 4)
            .attr('font-size', '11px').attr('font-weight', '600')
            .attr('fill', color)
            .text(`${r.val.toFixed(1)}°`);
        }
      });

      // ── Tooltip ──────────────────────────────────────────
      const maxVal = rows[0]?.val || 1;
      const minVal = rows[rows.length - 1]?.val || 0;
      const valRange = maxVal - minVal || 1;

      let html = `
        <div style="font-weight:600;font-size:11px;color:#6b7394;margin-bottom:9px;display:flex;align-items:center;gap:5px;">
          <span style="font-size:13px;">📅</span> ${_monthKeyToFull(mk)}
        </div>`;

      rows.forEach((r, i) => {
        const color = _getColor(r.region);
        const label = r.region === '__all__' ? 'Trung bình cả nước' : (REGION_SHORT[r.region] || r.region);
        const barW  = Math.round(((r.val - minVal) / valRange) * 60 + 20); // 20–80px

        html += `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:3px 0;${i < rows.length-1 ? 'border-bottom:1px solid rgba(255,255,255,0.05);' : ''}">
            <span style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;box-shadow:0 0 5px ${color}88;"></span>
              <span style="font-size:11px;color:#9ca3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</span>
            </span>
            <span style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
              <span style="display:inline-block;height:3px;width:${barW}px;background:${color};border-radius:2px;opacity:0.55;"></span>
              <span style="font-size:12px;font-weight:700;color:${color};min-width:46px;text-align:right;">${r.val.toFixed(2)}°C</span>
            </span>
          </div>`;
      });

      // Thêm dòng chênh lệch nếu có nhiều hơn 1 vùng
      if (rows.length > 1) {
        const diff = rows[0].val - rows[rows.length - 1].val;
        html += `
          <div style="margin-top:7px;padding-top:6px;border-top:1px solid #2a2d3e;display:flex;justify-content:space-between;font-size:10px;color:#6b7394;">
            <span>Chênh lệch</span>
            <span style="font-weight:600;color:#ffb347;">±${diff.toFixed(1)}°C</span>
          </div>`;
      }

      _tt.show(html, event);
    });
}

/* ============================================================
   BRUSH ZOOM
   ============================================================ */
function _setupBrush(drawData, lineGen, areaGen, xAxis) {
  brushG.selectAll('*').remove();

  const brush = d3.brushX()
    .extent([[0, 0], [width, height]])
    .on('end', (event) => {
      const sel = event.selection;
      if (!sel) {
        // reset — re-draw full
        _drawChart();
        return;
      }
      // Lọc domain theo vùng quét
      const [x0, x1] = sel;
      const allMonths = _monthlyData[0].points.map(p => p.monthKey);
      const filtered  = allMonths.filter(mk => {
        const cx = xScale(mk);
        return cx >= x0 && cx <= x1;
      });
      if (filtered.length < 2) return;

      xScale.domain(filtered);
      brushG.call(brush.move, null);

      xAxisG.transition().duration(400).call(xAxis);
      linesG.selectAll('.line-path').transition().duration(400).attr('d', d => lineGen(d.points));
      areasG.selectAll('.area-path').transition().duration(400).attr('d', d => areaGen(d.points));
      dotsG.selectAll('circle')
        .attr('cx', d => xScale(d.monthKey))
        .attr('display', d => filtered.includes(d.monthKey) ? null : 'none');
    });

  brushG.call(brush);
}

/* ============================================================
   AGGREGATE MONTHLY
   ============================================================ */
function _aggregateMonthly(data) {
  // Nhóm theo (region, YYYY-MM)
  const rolled = d3.rollups(
    data,
    v => d3.mean(v, d => +d.avgTemp),
    d => d.region,
    d => {
      const dt = d.date instanceof Date ? d.date : new Date(d.date);
      const y  = dt.getFullYear();
      const m  = String(dt.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
  );

  return rolled.map(([region, pairs]) => ({
    region,
    points: pairs
      .map(([monthKey, avgTemp]) => ({ monthKey, avgTemp }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
  }));
}

/* ============================================================
   INJECT CONTROLS (toggle buttons)
   ============================================================ */
function _injectControls() {
  const el = document.querySelector(CONTROLS_ID);
  if (!el || el.dataset.built) return;
  el.dataset.built = '1';

  el.innerHTML = `
    <div style="display:flex;gap:6px;">
      <button id="t01-btn-region" style="${_btnStyle(true)}">Theo vùng</button>
      <button id="t01-btn-all"    style="${_btnStyle(false)}">Tổng hợp</button>
    </div>`;

  document.getElementById('t01-btn-region').addEventListener('click', () => {
    _view = 'region';
    document.getElementById('t01-btn-region').style.cssText = _btnStyle(true);
    document.getElementById('t01-btn-all'   ).style.cssText = _btnStyle(false);
    _drawChart();
  });
  document.getElementById('t01-btn-all').addEventListener('click', () => {
    _view = 'all';
    document.getElementById('t01-btn-region').style.cssText = _btnStyle(false);
    document.getElementById('t01-btn-all'   ).style.cssText = _btnStyle(true);
    _drawChart();
  });
}

function _btnStyle(active) {
  return active
    ? 'padding:5px 13px;font-size:12px;font-weight:500;border-radius:8px;border:1px solid var(--color-accent);background:var(--color-accent);color:#fff;cursor:pointer;font-family:var(--font-primary);transition:all 0.15s;'
    : 'padding:5px 13px;font-size:12px;font-weight:500;border-radius:8px;border:1px solid var(--color-border);background:transparent;color:var(--color-text-secondary);cursor:pointer;font-family:var(--font-primary);transition:all 0.15s;';
}

/* ============================================================
   LEGEND (click ẩn/hiện vùng)
   ============================================================ */
function _buildLegend() {
  const el = document.querySelector(LEGEND_ID);
  if (!el) return;
  el.innerHTML = '';
  el.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px 20px;padding-top:14px;border-top:1px solid var(--color-border);margin-top:4px;';

  _monthlyData.forEach(d => {
    const color   = regionColor(d.region);
    const isDimmed = _dimmed.has(d.region);
    const item    = document.createElement('div');
    item.style.cssText = `display:flex;align-items:center;gap:7px;font-size:12px;color:var(--color-text-secondary);cursor:pointer;user-select:none;opacity:${isDimmed ? 0.28 : 1};transition:opacity 0.2s;`;
    item.innerHTML = `
      <span style="display:inline-block;width:18px;height:2.5px;background:${color};border-radius:2px;position:relative;">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};position:absolute;left:6px;top:-1.75px;"></span>
      </span>
      <span>${REGION_SHORT[d.region] || d.region}</span>`;

    item.addEventListener('click', () => {
      if (_dimmed.has(d.region)) {
        _dimmed.delete(d.region);
      } else {
        if (_dimmed.size < _monthlyData.length - 1) _dimmed.add(d.region);
      }
      _buildLegend();
      _drawChart();
    });

    el.appendChild(item);
  });
}

/* ============================================================
   STAT CARDS
   ============================================================ */
function _buildStatCards(monthlyData) {
  // Tìm hoặc tạo container #task01-stats ngay sau card__body của task01
  let statsEl = document.getElementById('task01-stats');
  if (statsEl) return; // đã build rồi

  const cardBody = document.querySelector('#chart-task01');
  if (!cardBody) return;

  // Insert sau legend
  statsEl = document.createElement('div');
  statsEl.id = 'task01-stats';
  statsEl.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px;';

  // Tính toán thống kê
  let peakVal = -Infinity, peakRegion = '', peakMonth = '';
  let lowVal  =  Infinity, lowRegion  = '', lowMonth  = '';

  monthlyData.forEach(d => {
    d.points.forEach(p => {
      if (p.avgTemp > peakVal) { peakVal = p.avgTemp; peakRegion = d.region; peakMonth = p.monthKey; }
      if (p.avgTemp < lowVal ) { lowVal  = p.avgTemp; lowRegion  = d.region; lowMonth  = p.monthKey; }
    });
  });

  const rangePairs = monthlyData[0].points.map(p => {
    const vals = monthlyData.map(d => ({ region: d.region, val: d.points.find(q => q.monthKey === p.monthKey)?.avgTemp }));
    const max  = d3.max(vals, v => v.val);
    const min  = d3.min(vals, v => v.val);
    return max - min;
  });
  const maxRange = d3.max(rangePairs);

  const cards = [
    {
      cls: 'peak', color: '#7fd16e', label: 'ĐỈNH NHIỆT',
      value: `${peakVal.toFixed(2)}°C`,
      desc: `${REGION_SHORT[peakRegion] || peakRegion}, tháng ${_monthKeyToShort(peakMonth)}`
    },
    {
      cls: 'low', color: '#b08cff', label: 'THẤP NHẤT',
      value: `${lowVal.toFixed(2)}°C`,
      desc: `${REGION_SHORT[lowRegion] || lowRegion}, tháng ${_monthKeyToShort(lowMonth)}`
    },
    {
      cls: 'cold', color: '#4fc3f7', label: 'MÙA LẠNH',
      value: 'Tháng 12–2',
      desc: 'Nhiệt độ giảm mạnh ở miền Bắc'
    },
    {
      cls: 'range', color: '#ffb347', label: 'BIÊN ĐỘ VÙNG',
      value: `~${maxRange.toFixed(0)}°C`,
      desc: 'Chênh lệch giữa vùng nóng và lạnh nhất'
    },
  ];

  cards.forEach(c => {
    const div = document.createElement('div');
    div.style.cssText = `background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:12px;padding:14px 18px;position:relative;overflow:hidden;`;
    div.innerHTML = `
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${c.color};"></div>
      <div style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:7px;">${c.label}</div>
      <div style="font-size:${c.cls==='cold'?'18px':'24px'};font-weight:700;letter-spacing:-0.3px;line-height:1;margin-bottom:5px;color:${c.color};">${c.value}</div>
      <div style="font-size:11px;color:var(--color-text-muted);">${c.desc}</div>`;
    statsEl.appendChild(div);
  });

  // Insert sau #task01-legend
  const legendEl = document.querySelector(LEGEND_ID);
  if (legendEl && legendEl.parentNode) {
    legendEl.parentNode.insertBefore(statsEl, legendEl.nextSibling);
  } else {
    cardBody.parentNode?.appendChild(statsEl);
  }
}

/* ============================================================
   GRADIENT DEFS
   ============================================================ */
function _buildGradients(defs) {
  const regions = Object.keys(REGION_SHORT);
  [...regions, '__all__'].forEach(name => {
    const color = name === '__all__' ? '#6c63ff' : regionColor(name);
    const id    = `area-grad-${_gradId(name)}`;
    const grad  = defs.append('linearGradient')
      .attr('id', id)
      .attr('x1','0').attr('x2','0').attr('y1','0').attr('y2','1');
    grad.append('stop').attr('offset', '0%' ).attr('stop-color', color).attr('stop-opacity', 0.28);
    grad.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0.02);
  });
}

/* ============================================================
   HELPERS
   ============================================================ */
function _getColor(region) {
  return region === '__all__' ? '#6c63ff' : regionColor(region);
}

function _gradId(name) {
  return (REGION_SHORT[name] || name).replace(/[^a-zA-Z0-9]/g, '_');
}

function _monthKeyToLabel(mk) {
  // "2024-04" → "T4'24"
  if (!mk) return '';
  const [y, m] = mk.split('-');
  return `T${parseInt(m)}'${y.slice(2)}`;
}

function _monthKeyToFull(mk) {
  if (!mk) return '';
  const [y, m] = mk.split('-');
  return `Tháng ${parseInt(m)}/${y}`;
}

function _monthKeyToShort(mk) {
  if (!mk) return '';
  const [y, m] = mk.split('-');
  return `${parseInt(m)}/${y}`;
}

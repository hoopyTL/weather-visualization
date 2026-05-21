/**
 * task13-uvHeatmap.js – UV cao nhất xảy ra vào thời điểm nào trong năm?
 *
 * Chart type : Heatmap (tháng × vùng)
 * X-axis     : Tháng (12 cột)
 * Y-axis     : location.region (6 hàng)
 * Color      : UV trung bình (sequential scale: light yellow → deep orange → red)
 *
 * Interactions:
 *   - Hover cell          → tooltip: vùng, tháng, UV TB / max / min
 *                         → highlight toàn bộ hàng + cột tương ứng
 *   - Click row (vùng)    → emit event → task12 highlight vùng đó (cross-chart)
 *   - Click column (tháng)→ highlight cột
 *   - Legend color bar    → continuous scale legend bên dưới
 *   - Filter metric       → toggle giữa UV trung bình / UV max (transition cell color)
 *
 * Dependencies (globals expected on window):
 *   d3  (v7)
 *
 * Shared utilities (ES module imports):
 *   REGION_SHORT, regionColor    from '../utils.js'
 *   Tooltip                      from '../components/tooltip.js'
 */

import { REGION_SHORT, REGION_COLORS } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

/* ─── Constants ──────────────────────────────────────────── */

const CONTAINER = '#chart-task13';

const MARGIN = { top: 50, right: 40, bottom: 80, left: 200 };

function formatMonthShort(monthStr) {
  const [y, m] = monthStr.split('-');
  return `T${parseInt(m)}-${y}`;
}

function formatMonthLabel(monthStr) {
  const [y, m] = monthStr.split('-');
  return `Tháng ${parseInt(m)}/${y}`;
}

const REGIONS_ORDER = [
  'Trung du và miền núi Bắc Bộ',
  'Đồng Bằng Sông Hồng',
  'Bắc Trung Bộ và Duyên hải miền Trung',
  'Tây Nguyên',
  'Đông Nam Bộ',
  'Đồng Bằng Sông Cửu Long',
];

/** UV color scale breakpoints */
const UV_COLOR_SCALE = d3.scaleSequential()
  .domain([0, 12])
  .interpolator(d3.interpolateYlOrRd);

/* ─── Module state ───────────────────────────────────────── */

let _tooltip      = null;
let _currentData  = [];          // aggregated heatmap data
let _uniqueMonths = [];          // list of 'YYYY-MM' strings
let _activeMetric = 'avg';       // 'avg' | 'max'
let _selectedRow  = null;        // highlighted region
let _selectedCol  = null;        // highlighted month index

/* ═══════════════════════════════════════════════════════════
   PUBLIC API
═══════════════════════════════════════════════════════════ */

export function init() {
  _tooltip = new Tooltip();
}

/**
 * render(data, filters)
 * @param {Array<Object>} data    – full weather dataset
 * @param {Object}        filters – optional { region, terrain }
 */
export function render(data, filters = {}) {
  _currentData  = _aggregate(data);
  _selectedRow  = null;
  _selectedCol  = null;

  _drawChart(_currentData);
  _drawMetricToggle();
}

/* ═══════════════════════════════════════════════════════════
   DATA AGGREGATION
═══════════════════════════════════════════════════════════ */

/**
 * Aggregate raw rows → { region × month } cells
 * @returns {Array<{ region, month, avg, max, min, count }>}
 */
function _aggregate(data) {
  const valid = data.filter(d => d.uv >= 0 && d.date && d.region);

  _uniqueMonths = Array.from(new Set(
    valid.map(d => `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`)
  )).sort();

  const rolled = d3.rollup(
    valid,
    v => ({
      avg   : d3.mean(v, d => d.uv),
      max   : d3.max (v, d => d.uv),
      min   : d3.min (v, d => d.uv),
      count : v.length,
    }),
    d => d.region,
    d => `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`
  );

  const cells = [];
  for (const [region, monthMap] of rolled) {
    for (const m of _uniqueMonths) {
      const entry = monthMap.get(m);
      cells.push({
        region,
        month  : m,
        avg    : entry ? +entry.avg.toFixed(2)  : null,
        max    : entry ? +entry.max.toFixed(2)  : null,
        min    : entry ? +entry.min.toFixed(2)  : null,
        count  : entry ? entry.count            : 0,
      });
    }
  }

  return cells;
}

/* ═══════════════════════════════════════════════════════════
   CHART DRAWING
═══════════════════════════════════════════════════════════ */

function _drawChart(cells) {
  const container = document.querySelector(CONTAINER);
  if (!container) return;

  /* ── Dimensions ── */
  const totalW = container.clientWidth  || 860;
  const totalH = container.clientHeight || 460;
  const innerW = totalW - MARGIN.left - MARGIN.right;
  const innerH = totalH - MARGIN.top  - MARGIN.bottom;

  /* ── Clear ── */
  d3.select(CONTAINER).select('svg').remove();

  const svg = d3.select(CONTAINER)
    .append('svg')
    .attr('width',   totalW)
    .attr('height',  totalH)
    .attr('viewBox', `0 0 ${totalW} ${totalH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  /* ── Scales ── */
  const xScale = d3.scaleBand()
    .domain(_uniqueMonths)
    .range([0, innerW])
    .padding(0.05);

  const yScale = d3.scaleBand()
    .domain(REGIONS_ORDER)
    .range([0, innerH])
    .padding(0.05);

  const cellW = xScale.bandwidth();
  const cellH = yScale.bandwidth();

  /* ── X Axis (months) ── */
  g.append('g')
    .attr('class', 'axis axis--x')
    .attr('transform', `translate(0,${innerH})`)
    .call(
      d3.axisBottom(xScale)
        .tickFormat(d => formatMonthShort(d))
    )
    .call(s => s.select('.domain').remove())
    .call(s => s.selectAll('.tick line').remove())
    .call(s => s.selectAll('.tick text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '12px')
      .attr('font-family', 'IBM Plex Sans, sans-serif')
    );

  /* ── Y Axis (regions) ── */
  g.append('g')
    .attr('class', 'axis axis--y')
    .call(
      d3.axisLeft(yScale)
        .tickFormat(r => REGION_SHORT[r] || r)
    )
    .call(s => s.select('.domain').remove())
    .call(s => s.selectAll('.tick line').remove())
    .call(s => s.selectAll('.tick text')
      .attr('fill', d => REGION_COLORS[d] || '#94a3b8')
      .attr('font-size', '12.5px')
      .attr('font-family', 'IBM Plex Sans, sans-serif')
      .attr('font-weight', 600)
      .attr('cursor', 'pointer')
      .on('click', (event, region) => _onRowClick(region, g, xScale, yScale))
    );

  /* ── Cells ── */
  const cellsG = g.append('g').attr('class', 'cells-group');

  cellsG.selectAll('.heatmap-cell')
    .data(cells, d => `${d.region}-${d.month}`)
    .join('rect')
    .attr('class', 'heatmap-cell')
    .attr('data-region', d => d.region)
    .attr('data-month',  d => d.month)
    .attr('x',      d => xScale(d.month))
    .attr('y',      d => yScale(d.region))
    .attr('width',  cellW)
    .attr('height', cellH)
    .attr('rx', 3).attr('ry', 3)
    .attr('fill',   d => _cellColor(d))
    .attr('opacity', 1)
    .on('mouseover', function (event, d) {
      _onCellHover(event, d, g, xScale, yScale, cellW, cellH);
    })
    .on('mousemove', function (event) {
      _tooltip.show(event, _tooltip.el.html());
    })
    .on('mouseleave', function (event, d) {
      _onCellLeave(d, g);
    })
    .on('click', function (event, d) {
      _onCellClick(d, g, xScale, yScale);
    });

  /* ── Cell labels (UV value) ── */
  cellsG.selectAll('.cell-label')
    .data(cells.filter(d => d[_activeMetric] !== null), d => `${d.region}-${d.month}`)
    .join('text')
    .attr('class', 'cell-label')
    .attr('data-region', d => d.region)
    .attr('data-month',  d => d.month)
    .attr('x', d => xScale(d.month) + cellW / 2)
    .attr('y', d => yScale(d.region) + cellH / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .attr('font-size', `${Math.max(9, Math.min(cellW * 0.28, 12))}px`)
    .attr('font-family', 'IBM Plex Sans, sans-serif')
    .attr('font-weight', 700)
    .attr('fill', d => _labelColor(d))
    .attr('pointer-events', 'none')
    .text(d => d[_activeMetric] !== null ? d[_activeMetric].toFixed(1) : '');

  /* ── Color Legend Bar ── */
  _drawColorLegend(g, innerW, innerH);

  /* ── Title annotation ── */
  g.append('text')
    .attr('x', innerW / 2)
    .attr('y', -28)
    .attr('text-anchor', 'middle')
    .attr('fill', '#cbd5e1')
    .attr('font-size', '13px')
    .attr('font-family', 'IBM Plex Sans, sans-serif')
    .attr('letter-spacing', '0.5px')
    .text('Chỉ số UV trung bình theo tháng & vùng');

  /* ── Click-outside to deselect ── */
  svg.on('click', function (event) {
    if (event.target.classList.contains('heatmap-cell')) return;
    _clearHighlight(g);
    _selectedRow = null;
    _selectedCol = null;
  });
}

/* ─── Color Legend ───────────────────────────────────────── */

function _drawColorLegend(g, innerW, innerH) {
  const legendW  = Math.min(300, innerW * 0.6);
  const legendH  = 12;
  const legendX  = (innerW - legendW) / 2;
  const legendY  = innerH + 44;

  const defs = d3.select(CONTAINER).select('svg').select('defs');
  const defsEl = defs.empty()
    ? d3.select(CONTAINER).select('svg').append('defs')
    : defs;

  // Linear gradient
  const gradId = 'task13-uv-gradient';
  defsEl.selectAll(`#${gradId}`).remove();

  const grad = defsEl.append('linearGradient')
    .attr('id', gradId)
    .attr('x1', '0%').attr('x2', '100%');

  const stops = d3.range(0, 1.01, 0.1);
  stops.forEach(t => {
    grad.append('stop')
      .attr('offset', `${(t * 100).toFixed(0)}%`)
      .attr('stop-color', UV_COLOR_SCALE(t * 12));
  });

  const lgG = g.append('g')
    .attr('class', 'color-legend')
    .attr('transform', `translate(${legendX},${legendY})`);

  lgG.append('rect')
    .attr('width', legendW).attr('height', legendH)
    .attr('rx', 3).attr('ry', 3)
    .attr('fill', `url(#${gradId})`);

  // Ticks: 0, 3, 6, 9, 12
  const legendScale = d3.scaleLinear().domain([0, 12]).range([0, legendW]);

  lgG.append('g')
    .attr('transform', `translate(0,${legendH})`)
    .call(
      d3.axisBottom(legendScale)
        .tickValues([0, 3, 6, 9, 12])
        .tickSize(4)
        .tickFormat(d => d)
    )
    .call(s => s.select('.domain').remove())
    .call(s => s.selectAll('.tick line').attr('stroke', '#64748b'))
    .call(s => s.selectAll('.tick text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'IBM Plex Sans, sans-serif')
    );

  // Labels
  lgG.append('text')
    .attr('x', -6).attr('y', legendH / 2).attr('dy', '0.35em')
    .attr('text-anchor', 'end')
    .attr('fill', '#64748b').attr('font-size', '10px')
    .attr('font-family', 'IBM Plex Sans, sans-serif')
    .text('UV thấp');

  lgG.append('text')
    .attr('x', legendW + 6).attr('y', legendH / 2).attr('dy', '0.35em')
    .attr('fill', '#64748b').attr('font-size', '10px')
    .attr('font-family', 'IBM Plex Sans, sans-serif')
    .text('UV cao');
}

/* ─── Metric Toggle ─────────────────────────────────────── */

function _drawMetricToggle() {
  // Ensure container exists
  let toggleContainer = document.querySelector(`${CONTAINER} .metric-toggle`);
  if (!toggleContainer) {
    toggleContainer = document.createElement('div');
    toggleContainer.className = 'metric-toggle';
    toggleContainer.style.cssText = `
      display: flex; gap: 8px; margin-bottom: 8px;
      justify-content: flex-end; padding-right: 8px;
    `;
    document.querySelector(CONTAINER)?.prepend(toggleContainer);
  }

  toggleContainer.innerHTML = `
    <span style="color:#64748b;font-size:11px;font-family:'IBM Plex Sans',sans-serif;align-self:center;">
      Hiển thị:
    </span>
    <button class="metric-btn ${_activeMetric === 'avg' ? 'metric-btn--active' : ''}"
      data-metric="avg"
      style="padding:3px 10px;border-radius:4px;border:1px solid #334155;
             background:${_activeMetric==='avg'?'#f59e0b':'#1e293b'};
             color:${_activeMetric==='avg'?'#0f172a':'#94a3b8'};
             font-size:11px;font-family:'IBM Plex Sans',sans-serif;cursor:pointer;">
      UV Trung bình
    </button>
    <button class="metric-btn ${_activeMetric === 'max' ? 'metric-btn--active' : ''}"
      data-metric="max"
      style="padding:3px 10px;border-radius:4px;border:1px solid #334155;
             background:${_activeMetric==='max'?'#ef4444':'#1e293b'};
             color:${_activeMetric==='max'?'#fff':'#94a3b8'};
             font-size:11px;font-family:'IBM Plex Sans',sans-serif;cursor:pointer;">
      UV Cao nhất
    </button>
  `;

  toggleContainer.querySelectorAll('.metric-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeMetric = btn.dataset.metric;
      _transitionMetric();
      _drawMetricToggle();   // re-render button state
    });
  });
}

/* ─── Transition metric (avg ↔ max) ─────────────────────── */

function _transitionMetric() {
  const t = d3.transition().duration(500).ease(d3.easeCubicInOut);

  d3.select(CONTAINER).selectAll('.heatmap-cell')
    .transition(t)
    .attr('fill', d => _cellColor(d));

  d3.select(CONTAINER).selectAll('.cell-label')
    .transition(t)
    .attr('fill', d => _labelColor(d))
    .text(d => d[_activeMetric] !== null ? d[_activeMetric].toFixed(1) : '');
}

/* ─── Interaction Handlers ───────────────────────────────── */

function _onCellHover(event, d, g, xScale, yScale, cellW, cellH) {
  if (d[_activeMetric] === null) return;

  /* Highlight row */
  d3.selectAll('.heatmap-cell')
    .transition().duration(150)
    .attr('opacity', cell =>
      cell.region === d.region || cell.month === d.month ? 1 : 0.3
    );

  /* Row highlight bar */
  g.selectAll('.row-highlight').remove();
  g.append('rect')
    .attr('class', 'row-highlight')
    .attr('x', -MARGIN.left + 4)
    .attr('y', yScale(d.region))
    .attr('width', MARGIN.left - 8)
    .attr('height', yScale.bandwidth())
    .attr('rx', 3)
    .attr('fill', REGION_COLORS[d.region] || '#f59e0b')
    .attr('opacity', 0.15)
    .attr('pointer-events', 'none');

  /* Column highlight bar */
  g.selectAll('.col-highlight').remove();
  g.append('rect')
    .attr('class', 'col-highlight')
    .attr('x', xScale(d.month))
    .attr('y', -MARGIN.top + 4)
    .attr('width', xScale.bandwidth())
    .attr('height', MARGIN.top - 8)
    .attr('rx', 3)
    .attr('fill', '#f59e0b')
    .attr('opacity', 0.15)
    .attr('pointer-events', 'none');

  /* Tooltip */
  _tooltip.show(event, Tooltip.buildHTML(
    `${REGION_SHORT[d.region] || d.region} — ${formatMonthLabel(d.month)}`,
    [
      { label: 'UV Trung bình', value: d.avg  !== null ? d.avg.toFixed(2)  : '—' },
      { label: 'UV Cao nhất',   value: d.max  !== null ? d.max.toFixed(2)  : '—' },
      { label: 'UV Thấp nhất',  value: d.min  !== null ? d.min.toFixed(2)  : '—' },
      { label: 'Số ngày đo',    value: d.count.toString() },
    ]
  ));
}

function _onCellLeave(d, g) {
  // Only clear if no persistent selection
  if (_selectedRow === null && _selectedCol === null) {
    d3.selectAll('.heatmap-cell')
      .transition().duration(200)
      .attr('opacity', 1);
    g.selectAll('.row-highlight').remove();
    g.selectAll('.col-highlight').remove();
  }
  _tooltip.hide();
}

function _onCellClick(d, g, xScale, yScale) {
  // Toggle selection
  if (_selectedRow === d.region && _selectedCol === d.month) {
    _clearHighlight(g);
    _selectedRow = null;
    _selectedCol = null;
    return;
  }

  _selectedRow = d.region;
  _selectedCol = d.month;

  /* Persist highlight */
  d3.selectAll('.heatmap-cell')
    .transition().duration(200)
    .attr('opacity', cell =>
      cell.region === d.region || cell.month === d.month ? 1 : 0.25
    );

  /* Bold selected cell border */
  d3.selectAll('.heatmap-cell')
    .attr('stroke', cell =>
      cell.region === d.region && cell.month === d.month
        ? '#fff' : 'none'
    )
    .attr('stroke-width', cell =>
      cell.region === d.region && cell.month === d.month ? 2 : 0
    );

  /* Dispatch custom event → task12 can listen */
  const evt = new CustomEvent('task13:regionSelected', {
    detail: { region: d.region, month: d.month },
    bubbles: true,
  });
  document.dispatchEvent(evt);
}

function _onRowClick(region, g, xScale, yScale) {
  _selectedRow = _selectedRow === region ? null : region;
  _selectedCol = null;

  if (_selectedRow === null) {
    _clearHighlight(g);
    return;
  }

  d3.selectAll('.heatmap-cell')
    .transition().duration(250)
    .attr('opacity', cell => cell.region === _selectedRow ? 1 : 0.2);

  /* Dispatch event */
  document.dispatchEvent(new CustomEvent('task13:regionSelected', {
    detail: { region: _selectedRow, month: null },
    bubbles: true,
  }));
}

function _clearHighlight(g) {
  d3.selectAll('.heatmap-cell')
    .transition().duration(250)
    .attr('opacity', 1)
    .attr('stroke', 'none');

  g.selectAll('.row-highlight').remove();
  g.selectAll('.col-highlight').remove();
}

/* ─── Color Helpers ─────────────────────────────────────── */

/** Fill color for a cell based on active metric */
function _cellColor(d) {
  const v = d[_activeMetric];
  if (v === null) return '#1e293b';     // no-data cell
  return UV_COLOR_SCALE(Math.min(v, 12));
}

/**
 * Label color: dark text on light cells, white on dark cells.
 * Threshold based on lightness of background.
 */
function _labelColor(d) {
  const v = d[_activeMetric];
  if (v === null) return 'transparent';
  // YlOrRd: low UV → light yellow → dark text; high UV → dark red → white text
  return v > 7 ? '#fff' : '#1a1a1a';
}

/* ─── Helpers ───────────────────────────────────────────── */
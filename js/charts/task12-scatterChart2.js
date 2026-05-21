/**
 * task12-scatterChart2.js – Ban ngày dài có ảnh hưởng đến UV không?
 *
 * Chart type : Scatter Plot + Linear Regression Line (per terrain)
 * X-axis     : dayLengthHours  (số giờ ban ngày, quantitative)
 * Y-axis     : day.uv          (chỉ số UV, quantitative)
 * Color      : location.terrain (3 nhóm: đồng bằng / ven biển / miền núi)
 *
 * Interactions:
 *   - Hover dot        → tooltip: tỉnh, vùng, terrain, ngày, UV, giờ ban ngày
 *   - Legend click     → toggle ẩn/hiện terrain group + regression line (transition opacity)
 *   - Brush (lasso)    → zoom into selected area, double-click để reset
 *   - Highlight        → hover terrain label trên legend → dim các nhóm khác
 *
 * Regression:
 *   - Tính Ordinary Least Squares (OLS) riêng cho từng terrain group
 *   - Hiển thị đường hồi quy + label R² ở cuối đường
 *   - Slope dương / âm → annotation "Tương quan thuận / nghịch"
 *
 * Dependencies (globals expected on window):
 *   d3  (v7)
 *
 * Shared utilities (ES module imports):
 *   TERRAIN_COLORS, REGION_SHORT           from '../utils.js'
 *   Tooltip                                from '../components/tooltip.js'
 *   Legend                                 from '../components/legend.js'
 */

import { TERRAIN_COLORS, REGION_SHORT, formatUV, sanitizeKey } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';
import { Legend  } from '../components/legend.js';

/* ─── Constants ──────────────────────────────────────────── */

const CONTAINER = '#chart-task12';

const MARGIN = { top: 40, right: 160, bottom: 70, left: 65 };

/** Terrain display labels */
const TERRAIN_LABEL = {
  'ven biển' : 'Ven biển',
  'đồng bằng': 'Đồng bằng',
  'miền núi' : 'Miền núi',
};

/** Max dots to render (performance) — sample evenly if exceeded */
const MAX_DOTS = 4000;

/* ─── Module state ───────────────────────────────────────── */

let _tooltip    = null;
let _legend     = null;
let _activeKeys = new Set(['ven biển', 'đồng bằng', 'miền núi']);

/** Zoom/brush state */
let _brushExtent = null;   // null = no zoom, [[x0,y0],[x1,y1]] = zoomed

/* ═══════════════════════════════════════════════════════════
   PUBLIC API
═══════════════════════════════════════════════════════════ */

export function init() {
  _tooltip = new Tooltip();
  _legend  = new Legend(`${CONTAINER} .chart-legend-container`);
}

/**
 * render(data, filters)
 * @param {Array<Object>} data    – full weather dataset
 * @param {Object}        filters – optional { region, terrain }
 */
export function render(data, filters = {}) {
  // Apply optional external filters (region etc.) but keep all terrains for this chart
  let filtered = data.filter(d =>
    d.dayLengthHours > 0 &&
    d.uv >= 0 &&
    d.terrain
  );

  if (filters.region) {
    filtered = filtered.filter(d => d.region === filters.region);
  }

  _brushExtent = null;   // reset zoom on re-render
  _drawChart(filtered);
  _drawLegend();
}

/* ═══════════════════════════════════════════════════════════
   REGRESSION HELPERS
═══════════════════════════════════════════════════════════ */

/**
 * Ordinary Least Squares linear regression.
 * @param {Array<{x: number, y: number}>} points
 * @returns {{ slope: number, intercept: number, r2: number }}
 */
function _ols(points) {
  const n  = points.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

  const xMean = d3.mean(points, d => d.x);
  const yMean = d3.mean(points, d => d.y);

  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (const p of points) {
    ssXY += (p.x - xMean) * (p.y - yMean);
    ssXX += (p.x - xMean) ** 2;
    ssYY += (p.y - yMean) ** 2;
  }

  const slope     = ssXX === 0 ? 0 : ssXY / ssXX;
  const intercept = yMean - slope * xMean;
  const r2        = ssYY === 0 ? 0 : (ssXY ** 2) / (ssXX * ssYY);

  return { slope, intercept, r2 };
}

/**
 * Sample array evenly to at most `max` items.
 * @param {Array} arr
 * @param {number} max
 */
function _sample(arr, max) {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  return Array.from({ length: max }, (_, i) => arr[Math.floor(i * step)]);
}

/* ═══════════════════════════════════════════════════════════
   CHART DRAWING
═══════════════════════════════════════════════════════════ */

function _drawChart(data) {
  const container = document.querySelector(CONTAINER);
  if (!container) return;

  /* ── Dimensions ── */
  const totalW = container.clientWidth  || 800;
  const totalH = container.clientHeight || 460;
  const innerW = totalW - MARGIN.left - MARGIN.right;
  const innerH = totalH - MARGIN.top  - MARGIN.bottom;

  /* ── Clear previous SVG ── */
  d3.select(CONTAINER).select('svg').remove();

  const svg = d3.select(CONTAINER)
    .append('svg')
    .attr('width',   totalW)
    .attr('height',  totalH)
    .attr('viewBox', `0 0 ${totalW} ${totalH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  /* ── Clip path (prevents dots escaping during brush zoom) ── */
  svg.append('defs').append('clipPath')
    .attr('id', 'task12-clip')
    .append('rect')
    .attr('width',  innerW)
    .attr('height', innerH);

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  /* ── Group data by terrain ── */
  const terrains    = ['đồng bằng', 'ven biển', 'miền núi'];
  const groupedData = {};
  terrains.forEach(t => {
    groupedData[t] = _sample(
      data.filter(d => d.terrain === t),
      MAX_DOTS
    );
  });

  /* ── Scales ── */
  const xExtent = d3.extent(data, d => d.dayLengthHours);
  const yExtent = d3.extent(data, d => d.uv);

  const xPad = (xExtent[1] - xExtent[0]) * 0.04;
  const yPad = (yExtent[1] - yExtent[0]) * 0.06;

  let xScale = d3.scaleLinear()
    .domain([xExtent[0] - xPad, xExtent[1] + xPad])
    .range([0, innerW])
    .nice();

  let yScale = d3.scaleLinear()
    .domain([Math.max(0, yExtent[0] - yPad), yExtent[1] + yPad])
    .range([innerH, 0])
    .nice();

  /* ── Grid ── */
  const gridG = g.append('g').attr('class', 'grid-group');

  gridG.append('g')
    .attr('class', 'grid grid--x')
    .attr('transform', `translate(0,${innerH})`)
    .call(
      d3.axisBottom(xScale).ticks(7).tickSize(-innerH).tickFormat('')
    )
    .call(s => s.select('.domain').remove())
    .call(s => s.selectAll('.tick line')
      .attr('stroke', 'rgba(255,255,255,0.05)')
      .attr('stroke-dasharray', '3,3')
    );

  gridG.append('g')
    .attr('class', 'grid grid--y')
    .call(
      d3.axisLeft(yScale).ticks(6).tickSize(-innerW).tickFormat('')
    )
    .call(s => s.select('.domain').remove())
    .call(s => s.selectAll('.tick line')
      .attr('stroke', 'rgba(255,255,255,0.05)')
      .attr('stroke-dasharray', '3,3')
    );

  /* ── Axes ── */
  const axisFont = { fill: '#94a3b8', fontSize: '12px', fontFamily: 'IBM Plex Sans, sans-serif' };

  const xAxisG = g.append('g')
    .attr('class', 'axis axis--x')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(7).tickFormat(d => `${d.toFixed(1)}h`));

  xAxisG.select('.domain').attr('stroke', 'rgba(255,255,255,0.15)');
  xAxisG.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.15)');
  xAxisG.selectAll('.tick text').attr('fill', axisFont.fill).attr('font-size', axisFont.fontSize).attr('font-family', axisFont.fontFamily);

  const yAxisG = g.append('g')
    .attr('class', 'axis axis--y')
    .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => d.toFixed(1)));

  yAxisG.select('.domain').remove();
  yAxisG.selectAll('.tick line').remove();
  yAxisG.selectAll('.tick text').attr('fill', axisFont.fill).attr('font-size', axisFont.fontSize).attr('font-family', axisFont.fontFamily);

  /* ── Axis labels ── */
  g.append('text')
    .attr('x', innerW / 2).attr('y', innerH + 52)
    .attr('text-anchor', 'middle')
    .attr('fill', '#64748b').attr('font-size', '12px').attr('font-family', axisFont.fontFamily)
    .text('Số giờ ban ngày');

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2).attr('y', -50)
    .attr('text-anchor', 'middle')
    .attr('fill', '#64748b').attr('font-size', '12px').attr('font-family', axisFont.fontFamily)
    .text('Chỉ số UV');

  /* ── Clipped group for dots + regression lines ── */
  const plotG = g.append('g')
    .attr('class', 'plot-group')
    .attr('clip-path', 'url(#task12-clip)');

  /* ── Dots ── */
  terrains.forEach(terrain => {
    const color  = TERRAIN_COLORS[terrain] || '#888';
    const points = groupedData[terrain];

    plotG.append('g')
      .attr('class', `dots-group dots--${sanitizeKey(terrain)}`)
      .attr('data-terrain', terrain)
      .selectAll('circle')
      .data(points)
      .join('circle')
      .attr('cx', d => xScale(d.dayLengthHours))
      .attr('cy', d => yScale(d.uv))
      .attr('r', 3.5)
      .attr('fill', color)
      .attr('opacity', 0.45)
      .attr('stroke', 'none')
      .on('mouseover', function (event, d) {
        d3.select(this)
          .raise()
          .transition().duration(120)
          .attr('r', 7)
          .attr('opacity', 1)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5);

        _tooltip.show(event, Tooltip.buildHTML(
          d.name,
          [
            { label: 'Vùng',         value: REGION_SHORT[d.region] || d.region },
            { label: 'Địa hình',     value: TERRAIN_LABEL[d.terrain] || d.terrain, color },
            { label: 'Ngày',         value: _formatDate(d.dateStr) },
            { label: 'Giờ ban ngày', value: `${d.dayLengthHours.toFixed(2)}h` },
            { label: 'Chỉ số UV',    value: formatUV(d.uv) },
          ]
        ));
      })
      .on('mousemove', function (event) {
        _tooltip.show(event, _tooltip.el.html());
      })
      .on('mouseleave', function () {
        d3.select(this)
          .transition().duration(120)
          .attr('r', 3.5)
          .attr('opacity', 0.45)
          .attr('stroke', 'none');
        _tooltip.hide();
      });
  });

  /* ── Regression lines ── */
  const regressionG = g.append('g').attr('class', 'regression-group');

  terrains.forEach(terrain => {
    const color  = TERRAIN_COLORS[terrain] || '#888';
    const allPts = data.filter(d => d.terrain === terrain);   // use full (unsampled) data for OLS
    const olsPts = allPts.map(d => ({ x: d.dayLengthHours, y: d.uv }));
    const { slope, intercept, r2 } = _ols(olsPts);

    // Draw line across full x domain
    const xDom  = xScale.domain();
    const lineData = [
      { x: xDom[0], y: slope * xDom[0] + intercept },
      { x: xDom[1], y: slope * xDom[1] + intercept },
    ];

    const lineGen = d3.line()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y));

    const regGroup = regressionG.append('g')
      .attr('class', `regression regression--${sanitizeKey(terrain)}`)
      .attr('data-terrain', terrain);

    // Regression line
    regGroup.append('path')
      .datum(lineData)
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6,3')
      .attr('opacity', 0.9)
      .attr('cursor', 'pointer')
      .on('mouseover', function (event) {
        d3.select(this).attr('stroke-width', 3);
        
        const slopeLabel = slope > 0.05 ? 'Tương quan thuận' : slope < -0.05 ? 'Tương quan nghịch' : 'Không rõ';
        _tooltip.show(event, Tooltip.buildHTML(
          'Đường xu hướng (Hồi quy)',
          [
            { label: 'Địa hình', value: TERRAIN_LABEL[terrain] || terrain, color },
            { label: 'Chiều hướng', value: slopeLabel },
            { label: 'Hệ số R²', value: r2.toFixed(3) },
          ]
        ));
      })
      .on('mousemove', function (event) {
        _tooltip.show(event, _tooltip.el.html());
      })
      .on('mouseleave', function () {
        d3.select(this).attr('stroke-width', 2);
        _tooltip.hide();
      });

    // R² label at right end
    const labelX = xScale(xDom[1]) + 6;
    const labelY = yScale(slope * xDom[1] + intercept);

    regGroup.append('text')
      .attr('x', Math.min(labelX, innerW - 10))
      .attr('y', labelY)
      .attr('dy', '0.35em')
      .attr('fill', color)
      .attr('font-size', '11px')
      .attr('font-family', 'IBM Plex Sans, sans-serif')
      .attr('font-weight', 600)
      .text(`R²=${r2.toFixed(2)}`);

    // Slope annotation: up/down arrow + text
    const slopeLabel  = slope > 0.05  ? '↑ Tương quan thuận'
                      : slope < -0.05 ? '↓ Tương quan nghịch'
                      : '→ Không rõ tương quan';

    const midX = (xDom[0] + xDom[1]) / 2;
    const midY = slope * midX + intercept;

    regGroup.append('text')
      .attr('x', xScale(midX))
      .attr('y', yScale(midY) - 10)
      .attr('text-anchor', 'middle')
      .attr('fill', color)
      .attr('font-size', '10px')
      .attr('font-family', 'IBM Plex Sans, sans-serif')
      .attr('opacity', 0.75)
      .text(slopeLabel);
  });

  /* ── Brush for zoom ── */
  _attachBrush(g, svg, plotG, regressionG, xScale, yScale, innerW, innerH, data, terrains);

  /* ── Zoom-reset hint ── */
  g.append('text')
    .attr('class', 'zoom-hint')
    .attr('x', innerW)
    .attr('y', -12)
    .attr('text-anchor', 'end')
    .attr('fill', '#475569')
    .attr('font-size', '10.5px')
    .attr('font-family', 'IBM Plex Sans, sans-serif')
    .text('Kéo chọn vùng để zoom · Double-click để reset');
}

/* ─── Brush / Zoom ───────────────────────────────────────── */

function _attachBrush(g, svg, plotG, regressionG, xScale, yScale, innerW, innerH, data, terrains) {
  const brush = d3.brush()
    .extent([[0, 0], [innerW, innerH]])
    .on('end', brushed);

  const brushG = g.insert('g', '.plot-group').attr('class', 'brush').call(brush);

  // Style brush selection rect
  brushG.select('.selection')
    .attr('fill', 'rgba(255,255,255,0.07)')
    .attr('stroke', 'rgba(255,255,255,0.3)')
    .attr('stroke-width', 1);

  function brushed(event) {
    const sel = event.selection;
    if (!sel) return;                    // empty selection = no-op

    const [[x0, y0], [x1, y1]] = sel;

    // New domains
    const newXDomain = [xScale.invert(x0), xScale.invert(x1)];
    const newYDomain = [yScale.invert(y1), yScale.invert(y0)];   // invert Y

    // Clear brush
    brushG.call(brush.move, null);

    // Transition scales + dots + regression
    _zoomTo(g, svg, plotG, regressionG, newXDomain, newYDomain, innerW, innerH, data, terrains);
  }

  // Double-click → reset zoom
  svg.on('dblclick', () => {
    const xExtent = d3.extent(data, d => d.dayLengthHours);
    const yExtent = d3.extent(data, d => d.uv);
    const xPad    = (xExtent[1] - xExtent[0]) * 0.04;
    const yPad    = (yExtent[1] - yExtent[0]) * 0.06;

    _zoomTo(
      g, svg, plotG, regressionG,
      [xExtent[0] - xPad, xExtent[1] + xPad],
      [Math.max(0, yExtent[0] - yPad), yExtent[1] + yPad],
      innerW, innerH, data, terrains
    );
  });
}

function _zoomTo(g, svg, plotG, regressionG, xDomain, yDomain, innerW, innerH, data, terrains) {
  const newX = d3.scaleLinear().domain(xDomain).range([0, innerW]);
  const newY = d3.scaleLinear().domain(yDomain).range([innerH, 0]);

  const t = d3.transition().duration(500).ease(d3.easeCubicInOut);

  /* Update axes */
  g.select('.axis--x')
    .transition(t)
    .call(d3.axisBottom(newX).ticks(7).tickFormat(d => `${d.toFixed(1)}h`))
    .call(s => s.select('.domain').attr('stroke', 'rgba(255,255,255,0.15)'))
    .call(s => s.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.15)'))
    .call(s => s.selectAll('.tick text').attr('fill', '#94a3b8').attr('font-size', '12px'));

  g.select('.axis--y')
    .transition(t)
    .call(d3.axisLeft(newY).ticks(6).tickFormat(d => d.toFixed(1)))
    .call(s => s.select('.domain').remove())
    .call(s => s.selectAll('.tick line').remove())
    .call(s => s.selectAll('.tick text').attr('fill', '#94a3b8').attr('font-size', '12px'));

  /* Transition dots */
  plotG.selectAll('circle')
    .transition(t)
    .attr('cx', d => newX(d.dayLengthHours))
    .attr('cy', d => newY(d.uv));

  /* Transition regression lines */
  terrains.forEach(terrain => {
    const allPts = data.filter(d => d.terrain === terrain);
    const olsPts = allPts.map(d => ({ x: d.dayLengthHours, y: d.uv }));
    const { slope, intercept } = _ols(olsPts);

    const lineData = [
      { x: xDomain[0], y: slope * xDomain[0] + intercept },
      { x: xDomain[1], y: slope * xDomain[1] + intercept },
    ];

    const lineGen = d3.line()
      .x(d => newX(d.x))
      .y(d => newY(d.y));

    regressionG.select(`.regression--${sanitizeKey(terrain)} path`)
      .transition(t)
      .attr('d', lineGen(lineData));

    /* Update R² label position */
    const labelX = newX(xDomain[1]) + 6;
    const labelY = newY(slope * xDomain[1] + intercept);

    regressionG.select(`.regression--${sanitizeKey(terrain)} text`)
      .transition(t)
      .attr('x', Math.min(labelX, innerW - 10))
      .attr('y', labelY);
  });
}

/* ─── Legend ────────────────────────────────────────────── */

function _drawLegend() {
  let legendContainer = document.querySelector(`${CONTAINER} .chart-legend-container`);
  if (!legendContainer) {
    legendContainer = document.createElement('div');
    legendContainer.className = 'chart-legend-container';
    document.querySelector(CONTAINER)?.appendChild(legendContainer);
    _legend = new Legend(`${CONTAINER} .chart-legend-container`);
  }

  const items = Object.entries(TERRAIN_COLORS).map(([key, color]) => ({
    key,
    label : TERRAIN_LABEL[key] || key,
    color,
  }));

  _legend.render(items, (key, isActive, activeSet) => {
    _activeKeys = activeSet;
    _applyTerrainVisibility(activeSet);
  });
}

/**
 * Toggle terrain groups (dots + regression) with transition.
 */
function _applyTerrainVisibility(activeSet) {
  d3.selectAll('.dots-group').each(function () {
    const terrain = d3.select(this).attr('data-terrain');
    d3.select(this)
      .transition().duration(400).ease(d3.easeQuadInOut)
      .attr('opacity', activeSet.has(terrain) ? 1 : 0);
  });

  d3.selectAll('.regression').each(function () {
    const terrain = d3.select(this).attr('data-terrain');
    d3.select(this)
      .transition().duration(400).ease(d3.easeQuadInOut)
      .attr('opacity', activeSet.has(terrain) ? 1 : 0);
  });
}

/* ─── Helpers ───────────────────────────────────────────── */

function _formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}
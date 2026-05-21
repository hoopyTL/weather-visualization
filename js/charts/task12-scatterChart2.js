/**
 * task12-scatterChart2.js – Ban ngày dài có ảnh hưởng đến UV không?
 *
 * Chart type : Hexbin Map + LOESS Regression Line (per terrain)
 * X-axis     : dayLengthHours  (số giờ ban ngày, quantitative)
 * Y-axis     : day.uv          (chỉ số UV, quantitative)
 * Color      : Hexbin (density) / LOESS (terrain)
 *
 * Interactions:
 *   - Hover hex        → tooltip: số lượng điểm đo
 *   - Hover LOESS      → tooltip: địa hình
 *   - Legend click     → toggle ẩn/hiện terrain group (re-calculate hexbin & loess)
 *   - Brush (lasso)    → zoom into selected area, double-click để reset
 *
 * Dependencies (globals expected on window):
 *   d3, d3.hexbin
 */

import { REGION_SHORT, formatUV, sanitizeKey } from '../utils.js';

// Colors matching the user's reference image
const TERRAIN_COLORS = {
  'ven biển' : '#38bdf8',   // Sky Blue
  'đồng bằng': '#86efac',   // Light/Pastel Green
  'miền núi' : '#fdba74',   // Orange/Peach
};
import { Tooltip } from '../components/tooltip.js';
import { Legend  } from '../components/legend.js';

/* ─── Constants ──────────────────────────────────────────── */
const CONTAINER = '#chart-task12';
const MARGIN = { top: 40, right: 160, bottom: 70, left: 65 };

const TERRAIN_LABEL = {
  'ven biển' : 'Ven biển',
  'đồng bằng': 'Đồng bằng',
  'miền núi' : 'Miền núi',
};

/* ─── Module state ───────────────────────────────────────── */
let _tooltip    = null;
let _legend     = null;
let _activeKeys = new Set(['ven biển', 'đồng bằng', 'miền núi']);
let _brushExtent = null;
let _rawData = []; // store for re-render on legend toggle

/* ═══════════════════════════════════════════════════════════
   PUBLIC API
═══════════════════════════════════════════════════════════ */
export function init() {
  _tooltip = new Tooltip();
  _legend  = new Legend(`${CONTAINER} .chart-legend-container`);
}

export function render(data, filters = {}) {
  // Apply optional external filters
  let filtered = data.filter(d =>
    d.dayLengthHours > 0 &&
    d.uv >= 0 &&
    d.terrain
  );

  if (filters.region) {
    filtered = filtered.filter(d => d.region === filters.region);
  }

  _rawData = filtered;
  _brushExtent = null;
  
  _drawLegend(); 
  // Legend initial render triggers visibility, but we'll call _drawChart manually first time
  _drawChart(); 
}

/* ═══════════════════════════════════════════════════════════
   REGRESSION HELPERS
═══════════════════════════════════════════════════════════ */

/**
 * Locally Weighted Scatterplot Smoothing (LOWESS)
 * @param {Array<{x: number, y: number}>} points 
 * @param {number} bandwidth fraction of points to use (e.g. 0.3)
 * @param {number} steps number of output points to generate across the x-domain
 */
function _loess(points, bandwidth = 0.3, steps = 100) {
  const n = points.length;
  if (n < 2) return [];

  points.sort((a, b) => a.x - b.x);
  const x = points.map(d => d.x);
  const y = points.map(d => d.y);
  
  const k = Math.max(2, Math.floor(n * bandwidth));
  
  // Generate evenly spaced x values for the smoothed curve
  const xMin = x[0];
  const xMax = x[n - 1];
  const stepSize = (xMax - xMin) / (steps - 1);
  const result = [];

  for (let i = 0; i < steps; i++) {
    const targetX = xMin + i * stepSize;
    
    // Find k nearest neighbors to targetX
    let dists = [];
    for (let j = 0; j < n; j++) {
      dists.push({ idx: j, dist: Math.abs(x[j] - targetX) });
    }
    dists.sort((a, b) => a.dist - b.dist);
    
    const maxDist = dists[k - 1].dist || 1e-9;
    
    let sumW = 0, sumWX = 0, sumWY = 0, sumWXX = 0, sumWXY = 0;
    
    for (let j = 0; j < n; j++) {
      const d = Math.abs(x[j] - targetX) / maxDist;
      if (d < 1) {
        // Tricube weight
        const w = Math.pow(1 - d * d * d, 3);
        sumW += w;
        sumWX += w * x[j];
        sumWY += w * y[j];
        sumWXX += w * x[j] * x[j];
        sumWXY += w * x[j] * y[j];
      }
    }
    
    let yFit = 0;
    const denom = sumW * sumWXX - sumWX * sumWX;
    if (denom !== 0) {
      const slope = (sumW * sumWXY - sumWX * sumWY) / denom;
      const intercept = (sumWY - slope * sumWX) / sumW;
      yFit = slope * targetX + intercept;
    } else if (sumW !== 0) {
      yFit = sumWY / sumW; // fallback to mean if matrix is singular
    }
    
    result.push({ x: targetX, y: yFit });
  }
  
  return result;
}

/* ═══════════════════════════════════════════════════════════
   CHART DRAWING
═══════════════════════════════════════════════════════════ */
function _drawChart() {
  const container = document.querySelector(CONTAINER);
  if (!container) return;

  const totalW = container.clientWidth  || 800;
  const totalH = container.clientHeight || 460;
  const innerW = totalW - MARGIN.left - MARGIN.right;
  const innerH = totalH - MARGIN.top  - MARGIN.bottom;

  d3.select(CONTAINER).select('svg').remove();

  const svg = d3.select(CONTAINER)
    .append('svg')
    .attr('width',   totalW)
    .attr('height',  totalH)
    .attr('viewBox', `0 0 ${totalW} ${totalH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  svg.append('defs').append('clipPath')
    .attr('id', 'task12-clip')
    .append('rect')
    .attr('width',  innerW)
    .attr('height', innerH);

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // Filter data by active terrains
  const activeData = _rawData.filter(d => _activeKeys.has(d.terrain));

  /* ── Scales ── */
  // Use _rawData for scales so the axes don't jump when filtering
  const xExtent = d3.extent(_rawData, d => d.dayLengthHours); 
  const yExtent = d3.extent(_rawData, d => d.uv);

  const yPad = (yExtent[1] - yExtent[0]) * 0.05;

  const xScale = d3.scaleLinear()
    .domain([xExtent[0] - 0.15, xExtent[1] + 0.15]) // Tighten X axis bounds instead of large padding + nice()
    .range([0, innerW]);

  const yScale = d3.scaleLinear()
    .domain([Math.max(0, yExtent[0] - yPad), yExtent[1] + yPad])
    .range([innerH, 0])
    .nice();

  /* ── Grid ── */
  const gridG = g.append('g').attr('class', 'grid-group');
  gridG.append('g')
    .attr('class', 'grid grid--x')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(7).tickSize(-innerH).tickFormat(''))
    .call(s => s.select('.domain').remove())
    .call(s => s.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.05)').attr('stroke-dasharray', '3,3'));

  gridG.append('g')
    .attr('class', 'grid grid--y')
    .call(d3.axisLeft(yScale).ticks(6).tickSize(-innerW).tickFormat(''))
    .call(s => s.select('.domain').remove())
    .call(s => s.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.05)').attr('stroke-dasharray', '3,3'));

  /* ── Axes ── */
  const axisFont = { fill: '#475569', fontSize: '12px', fontFamily: 'IBM Plex Sans, sans-serif' };
  const xAxisG = g.append('g').attr('class', 'axis axis--x').attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(7).tickFormat(d => `${d.toFixed(1)}h`));
  xAxisG.select('.domain').attr('stroke', 'rgba(0,0,0,0.15)');
  xAxisG.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.15)');
  xAxisG.selectAll('.tick text').attr('fill', axisFont.fill).attr('font-size', axisFont.fontSize).attr('font-family', axisFont.fontFamily);

  const yAxisG = g.append('g').attr('class', 'axis axis--y')
    .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => d.toFixed(1)));
  yAxisG.select('.domain').remove();
  yAxisG.selectAll('.tick line').remove();
  yAxisG.selectAll('.tick text').attr('fill', axisFont.fill).attr('font-size', axisFont.fontSize).attr('font-family', axisFont.fontFamily);

  g.append('text').attr('x', innerW / 2).attr('y', innerH + 52).attr('text-anchor', 'middle')
    .attr('fill', '#64748b').attr('font-size', '12px').attr('font-family', axisFont.fontFamily)
    .text('Số giờ ban ngày');

  g.append('text').attr('transform', 'rotate(-90)').attr('x', -innerH / 2).attr('y', -50).attr('text-anchor', 'middle')
    .attr('fill', '#64748b').attr('font-size', '12px').attr('font-family', axisFont.fontFamily)
    .text('Chỉ số UV');

  const plotG = g.append('g').attr('class', 'plot-group').attr('clip-path', 'url(#task12-clip)');

  /* ── Hexbin Generator ── */
  if (typeof d3.hexbin !== 'function') {
    console.error("d3-hexbin plugin is missing! Make sure it is loaded in index.html");
    return;
  }

  const hexRadius = 8;
  const hexbin = d3.hexbin()
    .x(d => xScale(d.dayLengthHours))
    .y(d => yScale(d.uv))
    .radius(hexRadius)
    .extent([[0, 0], [innerW, innerH]]);

  const bins = hexbin(activeData);

  /* ── Hex Color Scale ── */
  const maxDensity = d3.max(bins, d => d.length) || 1;
  
  // Magma (Purple -> Orange -> Yellow) as requested by user
  const darkColorScale = d3.scaleSequential(t => d3.interpolateMagma(0.1 + 0.8 * t))
    .domain([0, maxDensity]);

  /* ── Draw Hexagons ── */
  plotG.append('g')
    .attr('class', 'hex-group')
    .selectAll('path')
    .data(bins)
    .join('path')
    .attr('d', hexbin.hexagon())
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .attr('fill', d => darkColorScale(d.length))
    .attr('stroke', '#efeadd') // Match light background
    .attr('stroke-width', 1)
    .attr('opacity', 0.85)
    .on('mouseover', function (event, d) {
      d3.select(this)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('opacity', 1)
        .raise();
        
      _tooltip.show(event, Tooltip.buildHTML(
        'Mật độ quan trắc',
        [
          { label: 'Số điểm đo', value: `${d.length} ngày` },
          { label: 'Giờ ban ngày', value: `~ ${xScale.invert(d.x).toFixed(1)}h` },
          { label: 'Chỉ số UV', value: `~ ${yScale.invert(d.y).toFixed(1)}` },
        ]
      ));
    })
    .on('mousemove', function (event) {
      _tooltip.show(event, _tooltip.el.html());
    })
    .on('mouseleave', function () {
      d3.select(this)
        .attr('stroke', '#efeadd')
        .attr('stroke-width', 1)
        .attr('opacity', 0.85);
      _tooltip.hide();
    });

  /* ── Regression Lines (LOESS) ── */
  const regressionG = g.append('g').attr('class', 'regression-group').attr('clip-path', 'url(#task12-clip)');
  const terrains = ['đồng bằng', 'ven biển', 'miền núi'];

  terrains.forEach(terrain => {
    if (!_activeKeys.has(terrain)) return;

    const color = TERRAIN_COLORS[terrain] || '#888';
    const tData = activeData.filter(d => d.terrain === terrain);
    const pts = tData.map(d => ({ x: d.dayLengthHours, y: d.uv }));
    
    // Generate LOESS curve points (bandwidth 35%, 60 points res)
    const smoothedPts = _loess(pts, 0.35, 60);

    if (smoothedPts.length === 0) return;

    const lineGen = d3.line()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .curve(d3.curveBasis);

    const regGroup = regressionG.append('g')
      .attr('class', `regression regression--${sanitizeKey(terrain)}`)
      .attr('data-terrain', terrain);

    regGroup.append('path')
      .datum(smoothedPts)
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 4)
      .attr('opacity', 0.9)
      .attr('cursor', 'pointer')
      .on('mouseover', function (event) {
        d3.select(this).attr('stroke-width', 6);
        _tooltip.show(event, Tooltip.buildHTML(
          'Xu hướng LOESS',
          [
            { label: 'Địa hình', value: TERRAIN_LABEL[terrain] || terrain, color },
          ]
        ));
      })
      .on('mousemove', function (event) {
        _tooltip.show(event, _tooltip.el.html());
      })
      .on('mouseleave', function () {
        d3.select(this).attr('stroke-width', 4);
        _tooltip.hide();
      });
  });

  /* ── Brush for zoom ── */
  _attachBrush(g, svg, plotG, regressionG, xScale, yScale, innerW, innerH, activeData, hexbin, darkColorScale);

  /* ── Zoom-reset hint ── */
  g.append('text').attr('class', 'zoom-hint')
    .attr('x', innerW).attr('y', -12).attr('text-anchor', 'end')
    .attr('fill', '#475569').attr('font-size', '10.5px').attr('font-family', 'IBM Plex Sans, sans-serif')
    .text('Kéo chọn vùng để zoom · Double-click để reset');
}

/* ─── Brush / Zoom ───────────────────────────────────────── */
function _attachBrush(g, svg, plotG, regressionG, xScale, yScale, innerW, innerH, activeData, hexbin, colorScale) {
  const brush = d3.brush()
    .extent([[0, 0], [innerW, innerH]])
    .on('end', brushed);

  const brushG = g.insert('g', '.plot-group').attr('class', 'brush').call(brush);
  brushG.select('.selection').attr('fill', 'rgba(255,255,255,0.07)').attr('stroke', 'rgba(255,255,255,0.3)').attr('stroke-width', 1);

  function brushed(event) {
    const sel = event.selection;
    if (!sel) return;

    const [[x0, y0], [x1, y1]] = sel;
    const newXDomain = [xScale.invert(x0), xScale.invert(x1)];
    const newYDomain = [yScale.invert(y1), yScale.invert(y0)];

    brushG.call(brush.move, null);
    _zoomTo(g, svg, plotG, regressionG, newXDomain, newYDomain, innerW, innerH, activeData, hexbin, colorScale);
  }

  svg.on('dblclick', () => {
    const xExtent = d3.extent(_rawData, d => d.dayLengthHours);
    const yExtent = d3.extent(_rawData, d => d.uv);
    const yPad = (yExtent[1] - yExtent[0]) * 0.05;
    
    _zoomTo(g, svg, plotG, regressionG, 
      [xExtent[0] - 0.15, xExtent[1] + 0.15], 
      [Math.max(0, yExtent[0] - yPad), yExtent[1] + yPad], 
      innerW, innerH, activeData, hexbin, darkColorScale);
  });
}

function _zoomTo(g, svg, plotG, regressionG, xDomain, yDomain, innerW, innerH, activeData, hexbin, colorScale) {
  const newX = d3.scaleLinear().domain(xDomain).range([0, innerW]);
  const newY = d3.scaleLinear().domain(yDomain).range([innerH, 0]);

  const t = d3.transition().duration(500).ease(d3.easeCubicInOut);

  g.select('.axis--x').transition(t)
    .call(d3.axisBottom(newX).ticks(7).tickFormat(d => `${d.toFixed(1)}h`))
    .call(s => s.select('.domain').attr('stroke', 'rgba(0,0,0,0.15)'))
    .call(s => s.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.15)'))
    .call(s => s.selectAll('.tick text').attr('fill', '#475569').attr('font-size', '12px'));

  g.select('.axis--y').transition(t)
    .call(d3.axisLeft(newY).ticks(6).tickFormat(d => d.toFixed(1)))
    .call(s => s.select('.domain').remove())
    .call(s => s.selectAll('.tick line').remove())
    .call(s => s.selectAll('.tick text').attr('fill', '#475569').attr('font-size', '12px'));

  /* Re-bin Hexagons on zoom */
  hexbin.x(d => newX(d.dayLengthHours)).y(d => newY(d.uv));
  const newBins = hexbin(activeData);
  
  const maxDensity = d3.max(newBins, d => d.length) || 1;
  colorScale.domain([0, maxDensity]);

  const hexGroup = plotG.select('.hex-group');
  
  hexGroup.selectAll('path')
    .data(newBins)
    .join(
      enter => enter.append('path')
        .attr('d', hexbin.hexagon())
        .attr('transform', d => `translate(${d.x},${d.y})`)
        .attr('fill', d => colorScale(d.length))
        .attr('stroke', '#efeadd')
        .attr('stroke-width', 1)
        .attr('opacity', 0)
        .call(enter => enter.transition(t).attr('opacity', 0.85)),
      update => update.call(update => update.transition(t)
        .attr('transform', d => `translate(${d.x},${d.y})`)
        .attr('fill', d => colorScale(d.length))),
      exit => exit.call(exit => exit.transition(t).attr('opacity', 0).remove())
    )
    .on('mouseover', function (event, d) {
      d3.select(this).attr('stroke', '#fff').attr('stroke-width', 2).attr('opacity', 1).raise();
      _tooltip.show(event, Tooltip.buildHTML('Mật độ quan trắc', [
        { label: 'Số điểm đo', value: `${d.length} ngày` },
        { label: 'Giờ ban ngày', value: `~ ${newX.invert(d.x).toFixed(1)}h` },
        { label: 'Chỉ số UV', value: `~ ${newY.invert(d.y).toFixed(1)}` }
      ]));
    })
    .on('mousemove', function (event) { _tooltip.show(event, _tooltip.el.html()); })
    .on('mouseleave', function () {
      d3.select(this).attr('stroke', '#efeadd').attr('stroke-width', 1).attr('opacity', 0.85);
      _tooltip.hide();
    });

  /* Transition LOESS lines */
  regressionG.selectAll('.regression').each(function() {
    const terrain = d3.select(this).attr('data-terrain');
    const tData = activeData.filter(d => d.terrain === terrain);
    const pts = tData.map(d => ({ x: d.dayLengthHours, y: d.uv }));
    
    // Recalculate LOESS curve for new data points if we want, but since data is the same, 
    // we just use the smoothedPts and map to newX / newY
    const smoothedPts = _loess(pts, 0.35, 60);

    const lineGen = d3.line()
      .x(d => newX(d.x))
      .y(d => newY(d.y))
      .curve(d3.curveBasis);

    d3.select(this).select('path')
      .transition(t)
      .attr('d', lineGen(smoothedPts));
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

  const initialKeys = _activeKeys.size > 0 ? Array.from(_activeKeys) : items.map(i => i.key);
  
  _legend.render(items, (key, isActive, activeSet) => {
    _activeKeys = activeSet;
    _drawChart(); 
  }, initialKeys);
}
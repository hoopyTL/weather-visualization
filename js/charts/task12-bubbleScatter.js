/**
 * task12-scatterChart2.js – Ban ngày dài có ảnh hưởng đến UV không?
 *
 * Chart type : Bubble Scatter + Trend Line (Best Combo)
 * X-axis     : Binned day length (hours)
 * Y-axis     : UV Index
 * Size       : Frequency (global scale)
 * Line       : Mean UV per day length bin
 * Color      : terrain
 *
 * Interactions:
 *   - Hover bubble → tooltip: X, Y, Count, Share %
 */

import { REGION_SHORT, formatUV, sanitizeKey } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';
import { Legend } from '../components/legend.js';

const TERRAIN_COLORS = {
  'ven biển': '#38bdf8',   // Sky Blue
  'đồng bằng': '#86efac',   // Light/Pastel Green
  'miền núi': '#fdba74',   // Orange/Peach
};

const INSIGHT_ANNOTATIONS = {
  'đồng bằng': 'UV tăng thuận chiều rõ rệt cùng ban ngày',
  'ven biển': 'Cụm tần suất cao nhất: 12.5–13h, UV ~7',
  'miền núi': 'UV tập trung quanh mốc 5–7, ít biến động',
};

/* ─── Constants ──────────────────────────────────────────── */
const CONTAINER = '#chart-task12';
const MARGIN = { top: 40, right: 40, bottom: 70, left: 65 };

const TERRAIN_LABEL = {
  'ven biển': 'Ven biển',
  'đồng bằng': 'Đồng bằng',
  'miền núi': 'Miền núi',
};

/* ─── Module state ───────────────────────────────────────── */
let _tooltip = null;
let _legend = null;
let _activeKeys = new Set(['ven biển', 'đồng bằng', 'miền núi']);
let _rawData = [];

/* ═══════════════════════════════════════════════════════════
   PUBLIC API
═══════════════════════════════════════════════════════════ */
export function init() {
  _tooltip = new Tooltip();
  _legend = new Legend(`${CONTAINER} .chart-legend-container`);
}

export function render(data, filters = {}) {
  let filtered = data.filter(d =>
    d.dayLengthHours > 0 &&
    d.uv >= 0 &&
    d.terrain
  );

  if (filters.region) {
    filtered = filtered.filter(d => d.region === filters.region);
  }

  _rawData = filtered;

  _drawLegend();
  _drawChart();
}

/* ═══════════════════════════════════════════════════════════
   DATA AGGREGATION
═══════════════════════════════════════════════════════════ */

function _computeChartData(data, xStep = 0.5, yStep = 1.0) {
  const results = [];
  const activeTerrains = ['đồng bằng', 'ven biển', 'miền núi'].filter(t => _activeKeys.has(t));

  const tDataGlobal = data.filter(d => _activeKeys.has(d.terrain));
  if (tDataGlobal.length === 0) return { results: [], xDomain: [0, 1], yDomain: [0, 1], maxCount: 0 };

  const xExtent = d3.extent(tDataGlobal, d => d.dayLengthHours);
  let globalYMin = Infinity;
  let globalYMax = -Infinity;

  const xMin = Math.floor(xExtent[0] / xStep) * xStep;
  const xMax = Math.ceil(xExtent[1] / xStep) * xStep;

  let maxCount = 0;

  activeTerrains.forEach(terrain => {
    const tData = data.filter(d => d.terrain === terrain);
    const totalTerrainCount = tData.length;
    const bins2D = new Map();
    const bins1D = new Map(); // Dành cho trend line

    tData.forEach(d => {
      // Bins cho Bubbles (2D)
      const bx = Math.round(d.dayLengthHours / xStep) * xStep;
      const by = Math.round(d.uv / yStep) * yStep;

      const key2D = `${bx.toFixed(2)}_${by.toFixed(2)}`;
      if (!bins2D.has(key2D)) {
        bins2D.set(key2D, { x: bx, y: by, count: 0 });
      }
      bins2D.get(key2D).count += 1;

      // Bins cho Trend Line (1D)
      const key1D = bx.toFixed(2);
      if (!bins1D.has(key1D)) {
        bins1D.set(key1D, { bin: bx, values: [] });
      }
      bins1D.get(key1D).values.push(d.uv);

      if (d.uv < globalYMin) globalYMin = d.uv;
      if (d.uv > globalYMax) globalYMax = d.uv;
    });

    const bubbles = Array.from(bins2D.values());
    const localMax = d3.max(bubbles, b => b.count) || 0;
    if (localMax > maxCount) maxCount = localMax;

    const lineData = Array.from(bins1D.values())
      .map(b => ({ bin: parseFloat(b.bin), meanUV: d3.mean(b.values) }))
      .sort((a, b) => a.bin - b.bin);

    results.push({ terrain, bubbles, lineData, totalCount: totalTerrainCount });
  });

  // Tighter Y-scale based on real data
  const yMin = Math.max(0, Math.floor(globalYMin) - 1);
  const yMax = Math.ceil(globalYMax) + 1;

  return {
    results,
    xDomain: [xMin - xStep / 2, xMax + xStep / 2],
    yDomain: [yMin, yMax],
    maxCount,
    xStep,
    yStep
  };
}

/* ═══════════════════════════════════════════════════════════
   CHART DRAWING
═══════════════════════════════════════════════════════════ */
function _drawChart() {
  const container = document.querySelector(CONTAINER);
  if (!container) return;

  d3.select(CONTAINER).selectAll('.size-legend-container').remove();

  const totalW = container.clientWidth || 800;
  const totalH = 460;
  const innerW = totalW - MARGIN.left - MARGIN.right;
  const innerH = totalH - MARGIN.top - MARGIN.bottom;

  d3.select(CONTAINER).select('svg').remove();

  const chartData = _computeChartData(_rawData, 0.5, 1.0);
  if (chartData.results.length === 0) return;

  const svg = d3.select(CONTAINER)
    .append('svg')
    .attr('width', totalW)
    .attr('height', totalH)
    .attr('viewBox', `0 0 ${totalW} ${totalH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  const numFacets = chartData.results.length;
  const gap = 30;
  const facetW = (innerW - gap * (numFacets - 1)) / numFacets;

  /* ── Scales ── */
  const xDomain = chartData.xDomain;
  const yDomain = chartData.yDomain;

  const yScale = d3.scaleLinear().domain(yDomain).range([innerH, 0]).nice();

  // Sqrt scale cho Bubbles để area = count, scale GLOBAL toàn bộ facets
  const maxRadius = Math.min(25, facetW / 6);
  const rScale = d3.scaleSqrt().domain([0, chartData.maxCount]).range([0, maxRadius]);

  const axisFont = { fill: '#475569', fontSize: '12px', fontFamily: 'IBM Plex Sans, sans-serif' };
  const defs = svg.append('defs');

  /* ── Global Y Axis & Grid ── */
  g.append('g').attr('class', 'grid grid--y')
    .call(d3.axisLeft(yScale).ticks(8).tickSize(-innerW).tickFormat(''))
    .call(s => s.select('.domain').remove())
    .call(s => s.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.05)').attr('stroke-dasharray', '3,3'));

  g.append('g').attr('class', 'axis axis--y')
    .call(d3.axisLeft(yScale).ticks(8).tickFormat(d => d.toFixed(0)))
    .call(s => s.select('.domain').remove())
    .call(s => s.selectAll('.tick line').remove())
    .call(s => s.selectAll('.tick text').attr('fill', axisFont.fill).attr('font-size', axisFont.fontSize).attr('font-family', axisFont.fontFamily));

  g.append('text').attr('transform', 'rotate(-90)').attr('x', -innerH / 2).attr('y', -45).attr('text-anchor', 'middle')
    .attr('fill', '#64748b').attr('font-size', '12px').attr('font-family', axisFont.fontFamily)
    .text('Chỉ số UV');

  /* ── Facets ── */
  const facetsG = g.append('g').attr('class', 'facets');

  chartData.results.forEach((series, i) => {
    const terrain = series.terrain;
    const xOffset = i * (facetW + gap);
    const color = TERRAIN_COLORS[terrain] || '#888';

    const facetG = facetsG.append('g')
      .attr('class', `facet facet--${sanitizeKey(terrain)}`)
      .attr('data-terrain', terrain)
      .attr('transform', `translate(${xOffset}, 0)`);

    const clipId = `clip-${sanitizeKey(terrain)}`;
    defs.append('clipPath').attr('id', clipId)
      .append('rect').attr('width', facetW + maxRadius * 2).attr('height', innerH + maxRadius * 2).attr('x', -maxRadius).attr('y', -maxRadius);

    // Facet Title
    facetG.append('text')
      .attr('x', facetW / 2).attr('y', -20).attr('text-anchor', 'middle')
      .attr('fill', color).attr('font-size', '14px').attr('font-weight', 600)
      .text(TERRAIN_LABEL[terrain] || terrain);

    // Annotation
    facetG.append('text')
      .attr('x', facetW / 2).attr('y', -5).attr('text-anchor', 'middle')
      .attr('fill', '#64748b').attr('font-size', '10.5px').attr('font-style', 'italic')
      .text(INSIGHT_ANNOTATIONS[terrain] || '');

    const xF = d3.scaleLinear().domain(xDomain).range([0, facetW]);
    const xTicks = d3.range(xDomain[0] + chartData.xStep / 2, xDomain[1], chartData.xStep);

    facetG.append('g').attr('class', 'grid grid--x').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xF).tickValues(xTicks).tickSize(-innerH).tickFormat(''))
      .call(s => s.select('.domain').remove())
      .call(s => s.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.05)').attr('stroke-dasharray', '3,3'));

    const xFAxis = facetG.append('g').attr('class', 'axis axis--x').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xF).tickValues(xTicks).tickFormat(d => `${d.toFixed(1)}h`));
    xFAxis.select('.domain').attr('stroke', 'rgba(0,0,0,0.15)');
    xFAxis.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.15)');
    xFAxis.selectAll('.tick text').attr('fill', axisFont.fill).attr('font-size', axisFont.fontSize).attr('font-family', axisFont.fontFamily);

    if (i === Math.floor(numFacets / 2)) {
      facetG.append('text').attr('x', facetW / 2).attr('y', innerH + 45).attr('text-anchor', 'middle')
        .attr('fill', '#64748b').attr('font-size', '12px').attr('font-family', axisFont.fontFamily)
        .text('Thời lượng ban ngày (giờ)');
    }

    const plotG = facetG.append('g').attr('class', 'plot-group').attr('clip-path', `url(#${clipId})`);

    // 1. Draw Bubbles
    series.bubbles.sort((a, b) => b.count - a.count);

    plotG.selectAll('.bubble')
      .data(series.bubbles)
      .join('circle')
      .attr('class', 'bubble')
      .attr('cx', d => xF(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', 0)
      .attr('fill', color)
      .attr('fill-opacity', 0)
      .attr('stroke', d3.color(color).darker(0.8))
      .attr('stroke-width', 1)
      .call(sel => sel.transition('bubble-enter')
        .delay((d, bubbleIndex) => i * 90 + Math.min(bubbleIndex * 10, 260))
        .duration(650)
        .ease(d3.easeCubicOut)
        .attr('r', d => Math.max(1, rScale(d.count)))
        .attr('fill-opacity', 0.6)
      )
      .on('mouseover', function (event, d) {
        d3.select(this).attr('stroke', '#1e293b').attr('stroke-width', 2).raise();

        const sharePct = ((d.count / series.totalCount) * 100).toFixed(1);

        _tooltip.show(event, Tooltip.buildHTML(`Chi tiết`, [
          { label: 'Địa hình', value: TERRAIN_LABEL[terrain], color },
          { label: 'Ban ngày', value: `${d.x.toFixed(1)}h` },
          { label: 'Mức UV', value: d.y.toFixed(1) },
          { label: 'Tần suất', value: `${d.count} ngày` },
          { label: 'Tỷ trọng', value: `${sharePct}% (của ${TERRAIN_LABEL[terrain]})` }
        ]));
      })
      .on('mousemove', e => _tooltip.show(e, _tooltip.el.html()))
      .on('mouseleave', function () {
        d3.select(this).attr('stroke', d3.color(color).darker(0.8)).attr('stroke-width', 1);
        _tooltip.hide();
      });

    // 2. Draw Trend Line (Mean UV)
    const lineColor = d3.color(color).darker(1.5).hex(); // Màu trầm hơn nhiều so với bubble
    const lineGen = d3.line()
      .x(d => xF(d.bin))
      .y(d => yScale(d.meanUV))
      .curve(d3.curveMonotoneX);

    const trendLine = plotG.append('path')
      .datum(series.lineData)
      .attr('class', 'trend-line')
      .attr('data-terrain', terrain)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', 3)
      .attr('d', lineGen)
      .style('pointer-events', 'none'); // Cho phép hover xuyên qua line để chạm bubble

    const lineLength = trendLine.node()?.getTotalLength() || 0;
    if (lineLength > 0) {
      trendLine
        .attr('stroke-dasharray', lineLength)
        .attr('stroke-dashoffset', lineLength)
        .transition('trend-draw')
        .delay(i * 120 + 180)
        .duration(900)
        .ease(d3.easeCubicInOut)
        .attr('stroke-dashoffset', 0);
    }
  });
}

/* ─── Legend Terrain ────────────────────────────────────────── */
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
    label: TERRAIN_LABEL[key] || key,
    color,
    shape: 'circle',
    active: _activeKeys.has(key)
  }));

  _legend.render(
    items,
    (key, active) => {
      if (active) _activeKeys.add(key);
      else _activeKeys.delete(key);
      _drawChart();
    },
    Array.from(_activeKeys),
    _applyTerrainHover
  );
}

function _applyTerrainHover(terrain, isHovering) {
  d3.select(CONTAINER).selectAll('.facet').each(function () {
    const isTarget = d3.select(this).attr('data-terrain') === terrain;
    d3.select(this)
      .transition('legend-hover')
      .duration(180)
      .attr('opacity', !isHovering || isTarget ? 1 : 0.22);
  });

  d3.select(CONTAINER).selectAll('.trend-line').each(function () {
    const isTarget = d3.select(this).attr('data-terrain') === terrain;
    d3.select(this)
      .transition('legend-hover-line')
      .duration(180)
      .attr('stroke-width', isHovering && isTarget ? 4.5 : 3)
      .attr('opacity', !isHovering || isTarget ? 1 : 0.55);
  });
}

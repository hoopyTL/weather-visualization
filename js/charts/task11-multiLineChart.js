/**
 * task11-lineChart.js – Độ dài ban ngày theo 6 vùng
 *
 * Chart type : Multi-line Chart (1 đường / vùng)
 * X-axis     : Tháng (aggregate theo tháng)
 * Y-axis     : Số giờ ban ngày trung bình (dayLengthHours)
 * Color      : location.region (6 màu từ REGION_COLORS)
 *
 * Interactions:
 *   - Hover crosshair  → tooltip hiện tất cả 6 vùng tại tháng đó
 *   - Legend click     → toggle ẩn/hiện đường tương ứng (transition opacity)
 *   - Filter dropdown  → filter theo vùng, transition path
 *
 * Dependencies (globals expected on window):
 *   d3  (v7)
 *
 * Shared utilities (ES module imports):
 *   REGION_COLORS, REGION_SHORT, regionColor  from '../utils.js'
 *   Tooltip                                   from '../components/tooltip.js'
 *   Legend                                    from '../components/legend.js'
 *   loadWeatherData                           from '../dataLoader.js'
 */

import { REGION_COLORS, REGION_SHORT, regionColor } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';
import { Legend } from '../components/legend.js';
import { loadWeatherData } from '../dataLoader.js';

/* ─── Constants ─────────────────────────────────────────── */

const CONTAINER = '#chart-task11';          // div that holds the chart
const CHART_ID = 'task11';

const MARGIN = { top: 30, right: 60, bottom: 60, left: 60 };

// Vietnamese month labels
const MONTH_LABELS = [
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6',
  'T7', 'T8', 'T9', 'T10', 'T11', 'T12',
];

/* ─── Module-level state ─────────────────────────────────── */

let _rawData = [];         // full dataset
let _tooltip = null;
let _legend = null;
let _activeKeys = new Set();  // which regions are visible

/* ═══════════════════════════════════════════════════════════
   PUBLIC API  (called by main.js)
═══════════════════════════════════════════════════════════ */

/**
 * init() – called once per page visit.
 * Instantiates tooltip & legend singletons.
 */
export function init() {
  _tooltip = new Tooltip();
  _legend = new Legend(`${CONTAINER} .chart-legend-container`);
}

/**
 * render(data, filters) – (re)draws the chart.
 * @param {Array<Object>} data    – full weather dataset
 * @param {Object}        filters – { region, terrain, … } (may be empty)
 */
export function render(data, filters = {}) {
  _rawData = data;

  const { series, nationalSeries } = _aggregate(data);
  _activeKeys = new Set(series.map(s => s.region)); // Default show all 6 regions

  _drawChart(series, nationalSeries);
  _drawLegend(series);
  _buildStatCards(series);
  _applyVisibilityTransition(_activeKeys); // Set trạng thái khởi tạo
  
  // Attach National Only button listener
  const btnNat = document.getElementById('btn-national-t11');
  if (btnNat) {
    btnNat.onclick = () => {
      _activeKeys = new Set();
      _drawLegend(series, _activeKeys);
      _applyVisibilityTransition(_activeKeys);
    };
  }
}

/* ═══════════════════════════════════════════════════════════
   DATA AGGREGATION
═══════════════════════════════════════════════════════════ */

/**
 * Aggregate raw rows → one series per region.
 * Each series: { region, values: [{month, avgHours, minHours, maxHours}] }
 */
function _aggregate(data) {
  // Group by (region, YYYY-MM)
  const nested = d3.rollup(
    data.filter(d => d.dayLengthHours > 0 && d.date),
    v => ({
      avg: d3.mean(v, d => d.dayLengthHours),
      min: d3.min(v, d => d.dayLengthHours),
      max: d3.max(v, d => d.dayLengthHours),
      date: new Date(v[0].date.getFullYear(), v[0].date.getMonth(), 1)
    }),
    d => d.region,
    d => `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`
  );

  const series = [];
  for (const [region, monthMap] of nested) {
    const sortedKeys = Array.from(monthMap.keys()).sort();
    const values = sortedKeys.map(k => {
      const entry = monthMap.get(k);
      return {
        date: entry.date,
        avgHours: +entry.avg.toFixed(2),
        minHours: +entry.min.toFixed(2),
        maxHours: +entry.max.toFixed(2),
      };
    });
    series.push({ region, values });
  }

  // Calculate national average per month (by YYYY-MM)
  const nationalMap = d3.rollup(
    data.filter(d => d.dayLengthHours > 0 && d.date),
    v => ({
      avgHours: +d3.mean(v, d => d.dayLengthHours).toFixed(2),
      date: new Date(v[0].date.getFullYear(), v[0].date.getMonth(), 1)
    }),
    d => `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`
  );

  const sortedNationalKeys = Array.from(nationalMap.keys()).sort();
  const nationalSeries = sortedNationalKeys.map(k => nationalMap.get(k));

  return {
    series: series.sort((a, b) => a.region.localeCompare(b.region)),
    nationalSeries
  };
}

/* ═══════════════════════════════════════════════════════════
   CHART DRAWING
═══════════════════════════════════════════════════════════ */

function _drawChart(series, nationalSeries) {
  const container = document.querySelector(CONTAINER);
  if (!container) return;

  // ── Dimensions ──────────────────────────────────────────
  const totalW = container.clientWidth || 800;
  const totalH = 420; // Fixed height to prevent unbounded growth from stats cards
  const innerW = totalW - MARGIN.left - MARGIN.right;
  const innerH = totalH - MARGIN.top - MARGIN.bottom;

  // ── Clear & create SVG ───────────────────────────────────
  d3.select(CONTAINER).select('svg').remove();

  const svg = d3.select(CONTAINER)
    .append('svg')
    .attr('width', totalW)
    .attr('height', totalH)
    .attr('viewBox', `0 0 ${totalW} ${totalH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // ── Scales ───────────────────────────────────────────────
  const allValues = series.flatMap(s => s.values.map(v => v.avgHours));
  const yMin = Math.floor(d3.min(allValues) * 10) / 10 - 0.1;
  const yMax = Math.ceil(d3.max(allValues) * 10) / 10 + 0.1;

  const allDates = series.flatMap(s => s.values.map(v => v.date));
  const xScale = d3.scaleTime()
    .domain(d3.extent(allDates))
    .range([0, innerW]);

  const yScale = d3.scaleLinear()
    .domain([yMin, yMax])
    .nice()
    .range([innerH, 0]);

  // ── Grid lines ───────────────────────────────────────────
  g.append('g')
    .attr('class', 'grid grid--y')
    .call(
      d3.axisLeft(yScale)
        .ticks(6)
        .tickSize(-innerW)
        .tickFormat('')
    )
    .call(sel => sel.select('.domain').remove())
    .call(sel => sel.selectAll('.tick line')
      .attr('stroke', 'rgba(255,255,255,0.06)')
      .attr('stroke-dasharray', '3,3')
    );

  // ── Axes ─────────────────────────────────────────────────
  // X axis
  g.append('g')
    .attr('class', 'axis axis--x')
    .attr('transform', `translate(0,${innerH})`)
    .call(
      d3.axisBottom(xScale)
        .ticks(innerW / 80)
        .tickFormat(d => `T${d.getMonth() + 1}-${d.getFullYear()}`)
    )
    .call(sel => sel.select('.domain')
      .attr('stroke', 'rgba(255,255,255,0.15)')
    )
    .call(sel => sel.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.15)'))
    .call(sel => sel.selectAll('.tick text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '12px')
      .attr('font-family', 'IBM Plex Sans, sans-serif')
    );

  // Y axis
  g.append('g')
    .attr('class', 'axis axis--y')
    .call(
      d3.axisLeft(yScale)
        .ticks(6)
        .tickFormat(d => `${d.toFixed(1)}h`)
    )
    .call(sel => sel.select('.domain').remove())
    .call(sel => sel.selectAll('.tick line').remove())
    .call(sel => sel.selectAll('.tick text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '12px')
      .attr('font-family', 'IBM Plex Sans, sans-serif')
    );

  // Y axis label
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -48)
    .attr('text-anchor', 'middle')
    .attr('fill', '#64748b')
    .attr('font-size', '11px')
    .attr('font-family', 'IBM Plex Sans, sans-serif')
    .text('Số giờ ban ngày trung bình');

  // X axis label
  g.append('text')
    .attr('x', innerW / 2)
    .attr('y', innerH + 48)
    .attr('text-anchor', 'middle')
    .attr('fill', '#64748b')
    .attr('font-size', '11px')
    .attr('font-family', 'IBM Plex Sans, sans-serif')
    .text('Tháng');

  // ── Line generator ───────────────────────────────────────
  const lineGen = d3.line()
    .x(d => xScale(d.date))
    .y(d => yScale(d.avgHours))
    .curve(d3.curveCatmullRom.alpha(0.5))
    .defined(d => d.avgHours !== null);

  // ── Draw National Context Line ───────────────────────────
  const nationalGen = d3.line()
    .x(d => xScale(d.date))
    .y(d => yScale(d.avgHours))
    .curve(d3.curveCatmullRom.alpha(0.5));

  g.append('path')
    .datum(nationalSeries)
    .attr('class', 'national-line')
    .attr('d', nationalGen)
    .attr('fill', 'none')
    .attr('stroke', '#94a3b8')
    .attr('stroke-width', 3)
    .attr('opacity', 1);

  // ── Draw lines ───────────────────────────────────────────
  const seriesG = g.append('g').attr('class', 'series-group');

  series.forEach(s => {
    const color = regionColor(s.region);
    const groupEl = seriesG.append('g')
      .attr('class', `series series--${_sanitizeKey(s.region)}`)
      .attr('data-region', s.region);

    // Confidence band (min–max range)
    const areaGen = d3.area()
      .x(d => xScale(d.date))
      .y0(d => yScale(d.minHours))
      .y1(d => yScale(d.maxHours))
      .curve(d3.curveCatmullRom.alpha(0.5))
      .defined(d => d.avgHours !== null);

    groupEl.append('path')
      .datum(s.values)
      .attr('class', 'series__band')
      .attr('d', areaGen)
      .attr('fill', color)
      .attr('opacity', 0.08);

    // Main line
    groupEl.append('path')
      .datum(s.values)
      .attr('class', 'series__line')
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2.5)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('opacity', 1);

    // Dots at each month
    groupEl.selectAll('.series__dot')
      .data(s.values)
      .join('circle')
      .attr('class', 'series__dot')
      .attr('cx', d => xScale(d.date))
      .attr('cy', d => yScale(d.avgHours))
      .attr('r', 3.5)
      .attr('fill', color)
      .attr('stroke', '#1a1d2e')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.85);
  });

  // ── Animate Line Drawing on Load ─────────────────────────
  g.selectAll('.national-line, .series__line').each(function() {
    const length = this.getTotalLength();
    if (length > 0) {
      d3.select(this)
        .attr('stroke-dasharray', length)
        .attr('stroke-dashoffset', length)
        .transition('draw')
        .duration(2000)
        .ease(d3.easeCubicInOut)
        .attr('stroke-dashoffset', 0);
    }
  });

  // ── Tooltip Interaction ────────────────────────────────────────
  _attachHoverBehavior(g, svg, series, nationalSeries, xScale, yScale, innerW, innerH);
}

/* ─── Hover / crosshair behavior ────────────────────────── */

function _attachHoverBehavior(g, svg, series, nationalSeries, xScale, yScale, innerW, innerH) {
  // Vertical crosshair line
  const crosshair = g.append('line')
    .attr('class', 'crosshair')
    .attr('y1', 0)
    .attr('y2', innerH)
    .attr('stroke', 'rgba(255,255,255,0.25)')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,3')
    .attr('pointer-events', 'none')
    .attr('opacity', 0);

  // Invisible overlay rect for mouse events
  g.append('rect')
    .attr('class', 'hover-overlay')
    .attr('width', innerW)
    .attr('height', innerH)
    .attr('fill', 'transparent')
    .on('mousemove', function (event) {
      const mx = d3.pointer(event)[0];
      const hoveredDate = xScale.invert(mx);

      // Find nearest date in dataset
      const dates = nationalSeries.map(v => v.date);
      const bisect = d3.bisector(d => d).left;
      const i = bisect(dates, hoveredDate, 1);
      const d0 = dates[i - 1], d1 = dates[i];
      let closestDate = d0;
      if (d0 && d1) {
        closestDate = hoveredDate - d0 > d1 - hoveredDate ? d1 : d0;
      } else if (d1) {
        closestDate = d1;
      }

      crosshair
        .attr('x1', xScale(closestDate))
        .attr('x2', xScale(closestDate))
        .attr('opacity', 1);

      // Highlight dots at this month (only for active regions)
      d3.selectAll('.series__dot').each(function () {
        const region = this.parentNode.getAttribute('data-region');
        if (!_activeKeys.has(region)) return;

        const isHovered = d3.select(this).datum().date.getTime() === closestDate.getTime();
        d3.select(this)
          .attr('r', isHovered ? 6 : 3.5)
          .attr('opacity', isHovered ? 1 : 0.85);
      });

      // Build tooltip
      const visibleSeries = series.filter(s => _activeKeys.has(s.region));
      let rows = visibleSeries.map(s => {
        const point = s.values.find(v => v.date.getTime() === closestDate.getTime());
        return {
          label: REGION_SHORT[s.region] || s.region,
          value: point ? `${point.avgHours.toFixed(2)}h` : '—',
          color: regionColor(s.region),
        };
      });

      if (rows.length === 0) {
        const natPoint = nationalSeries.find(v => v.date.getTime() === closestDate.getTime());
        if (natPoint) {
          rows.push({
            label: 'Toàn quốc',
            value: `${natPoint.avgHours.toFixed(2)}h`,
            color: '#94a3b8'
          });
        }
      }

      rows.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));

      _tooltip.show(
        event,
        Tooltip.buildHTML(`Tháng ${closestDate.getMonth() + 1}/${closestDate.getFullYear()}`, rows)
      );
    })
    .on('mouseleave', function () {
      crosshair.attr('opacity', 0);
      d3.selectAll('.series__dot').each(function () {
        const region = this.parentNode.getAttribute('data-region');
        if (_activeKeys.has(region)) {
          d3.select(this).attr('r', 3.5).attr('opacity', 0.85);
        }
      });
      _tooltip.hide();
    });
}

/* ─── Legend ────────────────────────────────────────────── */

function _drawLegend(series, activeKeys) {
  // Ensure legend container exists inside chart container
  let legendContainer = document.querySelector(`${CONTAINER} .chart-legend-container`);
  if (!legendContainer) {
    legendContainer = document.createElement('div');
    legendContainer.className = 'chart-legend-container';
    document.querySelector(CONTAINER)?.appendChild(legendContainer);
    _legend = new Legend(`${CONTAINER} .chart-legend-container`);
  }

  const items = series.map(s => ({
    key: s.region,
    label: REGION_SHORT[s.region] || s.region,
    color: regionColor(s.region),
  }));

  _legend.render(
    items, 
    (key, isActive, activeSet) => {
      _activeKeys = activeSet;
      _applyVisibilityTransition(activeSet);
    }, 
    activeKeys !== undefined ? Array.from(activeKeys) : null,
    (key, isHovering) => {
      _applyHoverTransition(key, isHovering);
    }
  );
}

/**
 * Handle hover on legend items
 * @param {string} hoveredKey 
 * @param {boolean} isHovering 
 */
function _applyHoverTransition(hoveredKey, isHovering) {
  if (!isHovering) {
    // Restore normal state
    _applyVisibilityTransition(_activeKeys);
    return;
  }

  // Highlight hoveredKey, dim others
  d3.selectAll('.series').each(function () {
    const region = d3.select(this).attr('data-region');
    const isHoveredRegion = region === hoveredKey;
    
    if (!_activeKeys.has(region)) return;

    d3.select(this).select('.series__line')
      .transition('opacity').duration(200)
      .attr('opacity', isHoveredRegion ? 1 : 0.2)
      .attr('stroke-width', isHoveredRegion ? 3.5 : 2.5);

    d3.select(this).select('.series__band')
      .transition('opacity').duration(200)
      .attr('opacity', isHoveredRegion ? 0.15 : 0.02);

    d3.select(this).selectAll('.series__dot')
      .transition('opacity').duration(200)
      .attr('opacity', isHoveredRegion ? 1 : 0.2);
  });

  d3.select('.national-line').transition('opacity').duration(200).attr('opacity', 0.1);
}

/**
 * Toggle series visibility with transition.
 * @param {Set<string>} activeSet
 */
function _applyVisibilityTransition(activeSet) {
  const hasAnyActive = activeSet.size > 0;

  // Fade out national line if any region is active (Focus mode)
  d3.select('.national-line').transition('opacity').duration(400).attr('opacity', hasAnyActive ? 0.3 : 1);

  // Region Lines and bands
  d3.selectAll('.series').each(function () {
    const region = d3.select(this).attr('data-region');
    const active = activeSet.has(region);

    // Mặc định (hasAnyActive = false): Ẩn sạch các đường vùng (opacity 0)
    // Khi có vùng được chọn (hasAnyActive = true): Vùng active = 1, vùng inactive = 0.05 (rất mờ) hoặc 0 tùy bạn. Mình set 0 luôn cho sạch.
    const lineOpacity = hasAnyActive ? (active ? 1 : 0) : 0;
    const dotOpacity = hasAnyActive ? (active ? 0.85 : 0) : 0;
    const bandOpacity = active ? 0.08 : 0;

    d3.select(this).select('.series__line')
      .transition('opacity').duration(400)
      .ease(d3.easeQuadInOut)
      .attr('opacity', lineOpacity);

    d3.select(this).select('.series__band')
      .transition('opacity').duration(400)
      .ease(d3.easeQuadInOut)
      .attr('opacity', bandOpacity);

    d3.select(this).selectAll('.series__dot')
      .transition('opacity').duration(400)
      .ease(d3.easeQuadInOut)
      .attr('opacity', dotOpacity);
  });
}

/* ============================================================
   STAT CARDS
   ============================================================ */
function _buildStatCards(series) {
  let statsEl = document.getElementById('task11-stats');
  if (statsEl) return;

  const cardBody = document.querySelector('#chart-task11');
  if (!cardBody) return;

  statsEl = document.createElement('div');
  statsEl.id = 'task11-stats';
  statsEl.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px;';

  let peakVal = -Infinity, peakRegion = '', peakDate = null;
  let lowVal = Infinity, lowRegion = '', lowDate = null;

  series.forEach(s => {
    s.values.forEach(v => {
      if (v.avgHours > peakVal) { peakVal = v.avgHours; peakRegion = s.region; peakDate = v.date; }
      if (v.avgHours < lowVal) { lowVal = v.avgHours; lowRegion = s.region; lowDate = v.date; }
    });
  });

  // Chênh lệch lớn nhất (khoảng tháng 6)
  let maxDiff = 0;
  if (series.length > 0 && series[0].values.length > 0) {
    const juneVals = series.map(s => {
      const v = s.values.find(d => d.date.getMonth() === 5); // June
      return v ? v.avgHours : null;
    }).filter(v => v !== null);
    if (juneVals.length > 0) {
      maxDiff = d3.max(juneVals) - d3.min(juneVals);
    }
  }

  const cards = [
    {
      cls: 'peak', color: '#ffb347', label: 'NGÀY DÀI NHẤT',
      value: `${peakVal.toFixed(1)}h`,
      desc: `${REGION_SHORT[peakRegion] || peakRegion}, Tháng ${peakDate.getMonth() + 1}/${peakDate.getFullYear()}`
    },
    {
      cls: 'low', color: '#b08cff', label: 'NGÀY NGẮN NHẤT',
      value: `${lowVal.toFixed(1)}h`,
      desc: `${REGION_SHORT[lowRegion] || lowRegion}, Tháng ${lowDate.getMonth() + 1}/${lowDate.getFullYear()}`
    },
    {
      cls: 'summer', color: '#4fc3f7', label: 'MÙA NGÀY DÀI',
      value: 'Tháng 5–8',
      desc: 'Thời gian ban ngày lớn hơn ban đêm'
    },
    {
      cls: 'range', color: '#7fd16e', label: 'LỆCH THEO VĨ ĐỘ',
      value: `~${maxDiff.toFixed(1)}h`,
      desc: 'Chênh lệch giờ sáng giữa Bắc và Nam vào Hè'
    },
  ];

  cards.forEach(c => {
    const div = document.createElement('div');
    div.style.cssText = `background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:12px;padding:14px 18px;position:relative;overflow:hidden;`;
    div.innerHTML = `
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${c.color};"></div>
      <div style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:7px;">${c.label}</div>
      <div style="font-size:24px;font-weight:700;letter-spacing:-0.3px;line-height:1;margin-bottom:5px;color:${c.color};">${c.value}</div>
      <div style="font-size:11px;color:var(--color-text-muted);">${c.desc}</div>`;
    statsEl.appendChild(div);
  });

  const legendEl = document.querySelector(`${CONTAINER} .chart-legend-container`);
  if (legendEl && legendEl.parentNode) {
    legendEl.parentNode.insertBefore(statsEl, legendEl.nextSibling);
  } else {
    cardBody.parentNode?.appendChild(statsEl);
  }
}

/* ─── Helpers ───────────────────────────────────────────── */

/** Sanitize region name for use as CSS class */
function _sanitizeKey(str) {
  return str
    .toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

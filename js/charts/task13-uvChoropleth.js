/**
 * task13-uvHeatmap.js (Spatiotemporal Choropleth Map)
 *
 * Chart type : Choropleth Map (Bản đồ phân bố theo tỉnh)
 * Temporal   : Có thanh trượt thời gian (Slider) và Animation để xem sự thay đổi theo tháng.
 * Color      : UV trung bình (sequential scale: YlOrRd)
 * Layout     : Flexbox (Map bên trái, Ranking Panel bên phải)
 */

import { REGION_SHORT, REGION_COLORS } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task13';
const CHART_HEIGHT = 480;
const MARGIN = { top: 20, right: 20, bottom: 20, left: 20 };

let _tooltip = null;
let _geoJson = null;
let _rawData = null;
let _currentFilters = {};

// Data state
let _rolledAll = null;
let _rolledMonth = null;
let _uniqueMonths = [];
let _globalMinUV = 0;
let _globalMaxUV = 12;

// UI State
let _currentMonthIndex = -1; // -1 means "All Time"
let _isPlaying = false;
let _playInterval = null;
let _chartBuilt = false;
let _lastContainerWidth = 0;
let _controlsBound = false;
let _syncingFromSlider = false;

export function init() {
  _tooltip = new Tooltip();
}

function _computeRollups(valid) {
  _rolledAll = d3.rollup(
    valid,
    v => d3.mean(v, d => d.uv),
    d => d.name
  );

  _rolledMonth = d3.rollup(
    valid,
    v => d3.mean(v, d => d.uv),
    d => d.name,
    d => `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`
  );

  _uniqueMonths = Array.from(new Set(
    valid.map(d => `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`)
  )).sort();

  _globalMinUV = 5;
  _globalMaxUV = 10;
}

function _syncMonthFromFilters(filters) {
  if (filters.month && filters.month !== 'All') {
    const idx = _uniqueMonths.indexOf(filters.month);
    _currentMonthIndex = idx >= 0 ? idx : -1;
  } else {
    _currentMonthIndex = -1;
  }
}

function _monthKeyFromIndex() {
  return _currentMonthIndex === -1 ? 'All' : _uniqueMonths[_currentMonthIndex];
}

function _syncSliderToGlobalFilter() {
  const monthKey = _monthKeyFromIndex();
  if (_currentFilters.month === monthKey || !window.updateGlobalFilter) return;
  _syncingFromSlider = true;
  window.__t13MonthSyncInProgress = true;
  window.updateGlobalFilter('month', monthKey);
  window.__t13MonthSyncInProgress = false;
  _syncingFromSlider = false;
}

export async function render(data, filters = {}) {
  const valid = data.filter(d => d.uv >= 0 && d.name);
  _rawData = valid;
  _currentFilters = filters;

  _computeRollups(valid);

  if (_isPlaying) _togglePlay();
  if (!_syncingFromSlider) {
    _syncMonthFromFilters(filters);
  }

  if (!_geoJson) {
    try {
      _geoJson = await d3.json('assets/vietnam-provinces.json');
    } catch (err) {
      console.error('Failed to load GeoJSON', err);
      document.querySelector(CONTAINER).innerHTML = '<div style="padding:20px;color:red;">Lỗi tải dữ liệu bản đồ. Vui lòng đảm bảo file assets/vietnam-provinces.json tồn tại.</div>';
      _chartBuilt = false;
      return;
    }
  }

  const container = document.querySelector(CONTAINER);
  const containerW = container?.clientWidth || 0;
  if (_chartBuilt && containerW && containerW !== _lastContainerWidth) {
    _chartBuilt = false;
  }
  _lastContainerWidth = containerW;

  if (!_chartBuilt) {
    _buildChartOnce();
    _chartBuilt = true;
    _ensureControls(true);
  } else {
    _ensureControls(false);
    _updateMapColors(0);
  }
}

function normalizeName(name) {
  if (!name) return '';
  let n = name.replace(/^(Tỉnh |Thành phố |TP\. )/i, '')
    .replace('Thừa Thiên Huế', 'Thừa Thiên - Huế')
    .replace('Bà Rịa - Vũng Tàu', 'Bà Rịa-Vũng Tàu')
    .replace('Hoà Bình', 'Hòa Bình')
    .replace('Thanh Hoá', 'Thanh Hóa')
    .replace('Khánh Hoà', 'Khánh Hòa')
    .trim();
  if (n === 'Hồ Chí Minh') n = 'TP. Hồ Chí Minh';
  return n;
}

function _getUV(normName) {
  if (_currentMonthIndex === -1) {
    return _rolledAll.get(normName);
  } else {
    const m = _uniqueMonths[_currentMonthIndex];
    const map = _rolledMonth.get(normName);
    return map ? map.get(m) : undefined;
  }
}

function _getColorScale() {
  return d3.scaleSequential(d3.interpolateYlOrRd).domain([_globalMinUV, _globalMaxUV]);
}

function _formatMonthLabel() {
  if (_currentMonthIndex !== -1 && _uniqueMonths[_currentMonthIndex]) {
    const [y, m] = _uniqueMonths[_currentMonthIndex].split('-');
    return `Tháng ${parseInt(m)}/${y}`;
  }
  return 'Tất cả thời gian';
}

function _buildChartOnce() {
  const container = document.querySelector(CONTAINER);
  if (!container) return;

  const totalW = container.clientWidth || 800;
  const totalH = CHART_HEIGHT;
  container.style.overflow = 'hidden';

  container.innerHTML = `
    <div style="display:flex; width:100%; height:${CHART_HEIGHT}px; gap:24px; overflow:hidden;">
      <div id="t13-map-area" style="flex:1; position:relative; height:${CHART_HEIGHT}px; min-height:0;"></div>
      <div id="t13-ranking-area" style="width:260px; flex-shrink:0; display:flex; flex-direction:column; padding-top:10px; overflow-y:auto; max-height:${CHART_HEIGHT}px;"></div>
    </div>
  `;

  const mapArea = document.getElementById('t13-map-area');
  const mapW = mapArea.clientWidth || (totalW - 280);
  const mapH = totalH;

  const innerW = mapW - MARGIN.left - MARGIN.right;
  const innerH = mapH - MARGIN.top - MARGIN.bottom;

  const svg = d3.select('#t13-map-area')
    .append('svg')
    .attr('width', mapW)
    .attr('height', mapH)
    .attr('viewBox', `0 0 ${mapW} ${mapH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Background rect for zoom reset
  svg.append('rect')
    .attr('width', mapW)
    .attr('height', mapH)
    .attr('fill', 'transparent')
    .on('click', reset);

  const g = svg.append('g').attr('class', 'map-group');

  // Zoom
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  svg.call(zoom);

  function reset() {
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    miniChart.transition().duration(300).style('opacity', 0);
  }

  // Projection
  const projection = d3.geoMercator().fitSize([innerW - 40, innerH], _geoJson);
  projection.translate([projection.translate()[0] + 60, projection.translate()[1]]); // center better
  const path = d3.geoPath().projection(projection);

  // Mini Chart Container
  let miniChart = d3.select('#t13-mini-chart');
  if (miniChart.empty()) {
    miniChart = d3.select('#t13-map-area').append('div')
      .attr('id', 't13-mini-chart')
      .style('position', 'absolute')
      .style('bottom', '20px')
      .style('left', '20px')
      .style('background', '#fff')
      .style('padding', '12px')
      .style('border-radius', '8px')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
      .style('border', '1px solid #e2e8f0')
      .style('width', '300px')
      .style('pointer-events', 'none')
      .style('opacity', 0);
  }

  // Draw Map paths
  g.selectAll('path')
    .data(_geoJson.features)
    .join('path')
    .attr('class', 'province-path')
    .attr('d', path)
    .attr('stroke', '#fff')
    .attr('stroke-width', 0.5)
    .attr('cursor', 'pointer')
    .on('mouseover', function (event, d) {
      g.selectAll('.province-path').attr('opacity', 0.3);
      d3.select(this)
        .attr('opacity', 1)
        .attr('stroke', '#334155')
        .attr('stroke-width', 1.5)
        .raise();

      const normName = normalizeName(d.properties.Ten);
      const uv = _getUV(normName);

      const row = _rawData.find(item => normalizeName(item.name) === normName);
      const region = row ? (REGION_SHORT[row.region] || row.region) : 'N/A';

      const provinceData = _rawData.filter(item => normalizeName(item.name) === normName);
      const maxUV = provinceData.length ? d3.max(provinceData, d => d.uv) : 'N/A';

      _tooltip.show(event, Tooltip.buildHTML(
        normName,
        [
          { label: 'Vùng', value: region, color: row ? REGION_COLORS[row.region] : '#ccc' },
          { label: _currentMonthIndex === -1 ? 'UV TB (Cả năm)' : 'UV Tháng', value: uv !== undefined ? uv.toFixed(1) : 'N/A' },
          { label: 'UV Đỉnh (Max)', value: typeof maxUV === 'number' ? maxUV.toFixed(1) : maxUV }
        ]
      ));
    })
    .on('mousemove', e => _tooltip.show(e, _tooltip.el.html()))
    .on('mouseleave', function () {
      g.selectAll('.province-path').attr('opacity', 1);
      d3.select(this)
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5);
      _tooltip.hide();
    })
    .on('click', clicked);

  function clicked(event, d) {
    event.stopPropagation();

    if (!d) {
      reset();
      miniChart.transition().duration(300).style('opacity', 0);
      if (window.updateGlobalFilter) window.updateGlobalFilter('province', 'All');
      return;
    }
    
    const normName = normalizeName(d.properties.Ten);
    if (window.updateGlobalFilter) window.updateGlobalFilter('province', normName);

    const [[x0, y0], [x1, y1]] = path.bounds(d);
    svg.transition().duration(750).call(
      zoom.transform,
      d3.zoomIdentity
        .translate(mapW / 2, mapH / 2)
        .scale(Math.min(8, 0.9 / Math.max((x1 - x0) / mapW, (y1 - y0) / mapH)))
        .translate(-(x0 + x1) / 2, -(y0 + y1) / 2),
      d3.pointer(event, svg.node())
    );

    // Draw Mini Chart
    const monthMap = _rolledMonth.get(normName);
    if (!monthMap) return;

    const chartData = _uniqueMonths.map((m, i) => {
      const [year, month] = m.split('-');
      return {
        index: i,
        monthStr: `T${parseInt(month)}`,
        uv: monthMap.get(m) || 0
      };
    });

    miniChart.html(`
      <div style="font-size:13px; font-weight:700; margin-bottom:8px; color:var(--color-text-primary); font-family:var(--font-primary);">Diễn biến UV: ${normName}</div>
      <div id="t13-mini-svg"></div>
    `);

    const mcW = 276;
    const mcH = 120;
    const mSvg = d3.select('#t13-mini-svg').append('svg').attr('width', mcW).attr('height', mcH);

    const maxIdx = Math.max(1, _uniqueMonths.length - 1);
    const mx = d3.scaleLinear().domain([0, maxIdx]).range([20, mcW - 10]);
    const my = d3.scaleLinear().domain([0, Math.ceil(_globalMaxUV)]).range([mcH - 20, 10]);

    const mLine = d3.line().x(d => mx(d.index)).y(d => my(d.uv)).curve(d3.curveMonotoneX);
    const mArea = d3.area().x(d => mx(d.index)).y0(mcH - 20).y1(d => my(d.uv)).curve(d3.curveMonotoneX);

    mSvg.append('path').datum(chartData).attr('fill', 'rgba(239, 68, 68, 0.1)').attr('d', mArea);
    mSvg.append('path').datum(chartData).attr('fill', 'none').attr('stroke', '#ef4444').attr('stroke-width', 2).attr('d', mLine);

    mSvg.selectAll('.mc-dot').data(chartData).join('circle')
      .attr('cx', d => mx(d.index)).attr('cy', d => my(d.uv)).attr('r', 2.5).attr('fill', '#ef4444');

    mSvg.append('g').attr('transform', `translate(0,${mcH - 20})`)
      .call(d3.axisBottom(mx).ticks(_uniqueMonths.length).tickFormat(i => {
        const d = chartData[i];
        return d ? d.monthStr : '';
      }).tickSize(3))
      .call(s => s.select('.domain').attr('stroke', '#cbd5e1'))
      .call(s => s.selectAll('.tick text').attr('font-size', '9px').attr('fill', '#94a3b8'));

    mSvg.append('g').attr('transform', `translate(20,0)`)
      .call(d3.axisLeft(my).ticks(3).tickSize(3))
      .call(s => s.select('.domain').remove())
      .call(s => s.selectAll('.tick text').attr('font-size', '9px').attr('fill', '#94a3b8'));

    miniChart.transition().duration(300).style('opacity', 1);
  }

  _updateMapColors(0);

  // Legend
  _drawLegend(svg, mapW, mapH);

  // Hint
  svg.append('text')
    .attr('x', 20)
    .attr('y', 20)
    .attr('text-anchor', 'start')
    .attr('fill', '#94a3b8')
    .attr('font-size', '12px')
    .attr('font-family', 'IBM Plex Sans, sans-serif');
}

function _updateMapColors(duration = 500) {
  const svg = d3.select('#t13-map-area').select('svg');
  if (svg.empty()) return;

  const colorScale = _getColorScale();

  svg.selectAll('.province-path')
    .transition().duration(duration)
    .attr('fill', d => {
      const normName = normalizeName(d.properties.Ten);
      const uv = _getUV(normName);
      return uv !== undefined ? colorScale(uv) : '#f1f5f9';
    });

  // Update Ranking
  _drawRanking();
}

function _drawRanking() {
  const rankingArea = document.getElementById('t13-ranking-area');
  if (!rankingArea) return;

  // 1. Gather data for current view
  let currentData = [];
  if (_currentMonthIndex === -1) {
    _rolledAll.forEach((uv, name) => currentData.push({ name, uv }));
  } else {
    const m = _uniqueMonths[_currentMonthIndex];
    _rolledAll.forEach((_, name) => {
      const map = _rolledMonth.get(name);
      if (map && map.has(m)) {
        currentData.push({ name, uv: map.get(m) });
      }
    });
  }

  // 2. Sort & Slice Top 5
  currentData.sort((a, b) => b.uv - a.uv);
  const top5 = currentData.slice(0, 5);

  const colorScale = _getColorScale();

  // 3. Render HTML
  let html = `
    <div style="font-weight:700; font-size:14px; color:var(--color-text-primary); font-family:var(--font-primary); margin-bottom:16px;">
      Top 5 Tỉnh có UV TB cao nhất ☀️
    </div>
    <div style="display:flex; flex-direction:column; gap:10px;">
  `;

  top5.forEach((d, i) => {
    const color = colorScale(d.uv);
    // rgba equivalent of 0.15 opacity
    const rgb = d3.color(color).rgb();
    const bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`;

    html += `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-radius:8px; background:${i === 0 ? bgColor : '#fff'}; border:1px solid ${i === 0 ? color : '#e2e8f0'}; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:13px; font-weight:${i === 0 ? 800 : 600}; color:${i === 0 ? color : 'var(--color-text-secondary)'}; width:16px; text-align:center;">${i + 1}</span>
          <span style="font-size:13px; font-weight:600; color:var(--color-text-primary); font-family:var(--font-primary);">${d.name}</span>
        </div>
        <span style="font-size:14px; font-weight:700; color:${color}; font-family:var(--font-mono);">${d.uv.toFixed(1)}</span>
      </div>
    `;
  });

  html += `</div>`;
  rankingArea.innerHTML = html;
}

function _drawLegend(svg, totalW, totalH) {
  const legendW = 200;
  const legendH = 10;
  const legendX = totalW - legendW - 45; // increased margin to prevent cutoff
  const legendY = totalH - 40;

  // Ensure defs and gradient are clean
  svg.selectAll('defs').remove();
  const defs = svg.append('defs');
  const gradId = 'task13-choro-gradient';

  svg.selectAll('.color-legend').remove();

  const grad = defs.append('linearGradient')
    .attr('id', gradId)
    .attr('x1', '0%').attr('x2', '100%');

  const colorScale = _getColorScale();
  const stops = d3.range(0, 1.01, 0.1);
  stops.forEach(t => {
    const val = _globalMinUV + t * (_globalMaxUV - _globalMinUV);
    grad.append('stop')
      .attr('offset', `${(t * 100).toFixed(0)}%`)
      .attr('stop-color', colorScale(val));
  });

  const lgG = svg.append('g')
    .attr('class', 'color-legend')
    .attr('transform', `translate(${legendX},${legendY})`);

  lgG.append('rect')
    .attr('width', legendW).attr('height', legendH)
    .attr('rx', 2).attr('ry', 2)
    .attr('fill', `url(#${gradId})`)
    .attr('stroke', '#cbd5e1')
    .attr('stroke-width', 0.5);

  const legendScale = d3.scaleLinear().domain([_globalMinUV, _globalMaxUV]).range([0, legendW]);

  // WHO UV Index levels
  const whoTicks = [3, 6, 8, 11].filter(v => v > _globalMinUV && v < _globalMaxUV);
  const tickVals = Array.from(new Set([_globalMinUV, ...whoTicks, _globalMaxUV])).sort((a,b)=>a-b);

  lgG.append('g')
    .attr('transform', `translate(0,${legendH})`)
    .call(
      d3.axisBottom(legendScale)
        .tickValues(tickVals)
        .tickSize(6)
        .tickFormat(d => d.toFixed(0))
    )
    .call(s => s.select('.domain').remove())
    .call(s => s.selectAll('.tick line').attr('stroke', '#cbd5e1'))
    .call(s => s.selectAll('.tick text')
      .attr('fill', '#64748b')
      .attr('font-size', '10px')
      .attr('font-weight', 600)
      .attr('font-family', 'IBM Plex Sans, sans-serif')
    );

  // WHO category labels
  const whoLabels = [
    { threshold: 3, label: 'Mod' },
    { threshold: 6, label: 'High' },
    { threshold: 8, label: 'V.High' },
    { threshold: 11, label: 'Ext' }
  ];

  whoLabels.forEach(w => {
    if (w.threshold >= _globalMinUV && w.threshold <= _globalMaxUV) {
      lgG.append('text')
        .attr('x', legendScale(w.threshold))
        .attr('y', legendH + 28)
        .attr('text-anchor', 'middle')
        .attr('fill', '#94a3b8')
        .attr('font-size', '9px')
        .attr('font-weight', 600)
        .attr('font-family', 'IBM Plex Sans, sans-serif')
        .text(w.label);
    }
  });

  lgG.append('text')
    .attr('x', 0).attr('y', -6)
    .attr('text-anchor', 'start')
    .attr('fill', '#64748b').attr('font-size', '11px')
    .attr('font-weight', 600)
    .attr('font-family', 'IBM Plex Sans, sans-serif')
    .text('UV thấp');

  lgG.append('text')
    .attr('x', legendW).attr('y', -6)
    .attr('text-anchor', 'end')
    .attr('fill', '#64748b').attr('font-size', '11px')
    .attr('font-weight', 600)
    .attr('font-family', 'IBM Plex Sans, sans-serif')
    .text('UV cao');
}

function _ensureControls(forceRebuild = false) {
  const controls = document.getElementById('task13-controls');
  if (!controls) return;

  if (forceRebuild || !_controlsBound) {
    controls.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px; align-items:flex-end;">
        <div style="display:flex;gap:12px;align-items:center; background:#f8fafc; padding:6px 12px; border-radius:8px; border:1px solid #e2e8f0;">
          <button id="t13-btn-play" type="button" style="background:var(--color-accent);color:#fff;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;">
            ${_isPlaying ? '⏸' : '▶'}
          </button>
          <input type="range" id="t13-slider" min="-1" max="${Math.max(0, _uniqueMonths.length - 1)}" value="${_currentMonthIndex}"
                 style="width:200px; cursor:pointer; accent-color:var(--color-accent);" />
          <span id="t13-time-label" style="font-size:12px;font-weight:600;font-family:var(--font-primary);color:var(--color-text-primary);min-width:120px;text-align:right;">
            ${_formatMonthLabel()}
          </span>
        </div>
      </div>`;

    const slider = document.getElementById('t13-slider');
    const label = document.getElementById('t13-time-label');

    slider.addEventListener('input', (e) => {
      if (_isPlaying) _togglePlay();
      _currentMonthIndex = parseInt(e.target.value, 10);
      if (label) label.textContent = _formatMonthLabel();
      _updateMapColors(200);
      _syncSliderToGlobalFilter();
    });

    document.getElementById('t13-btn-play').addEventListener('click', _togglePlay);
    _controlsBound = true;
  } else {
    _refreshControlsUI();
  }
}

function _refreshControlsUI() {
  const slider = document.getElementById('t13-slider');
  const btn = document.getElementById('t13-btn-play');
  if (slider) {
    slider.max = Math.max(0, _uniqueMonths.length - 1);
    if (_currentMonthIndex > _uniqueMonths.length - 1) _currentMonthIndex = -1;
    slider.value = _currentMonthIndex;
  }
  if (btn) btn.innerHTML = _isPlaying ? '⏸' : '▶';
  _updateSliderUI();
}

function _togglePlay() {
  _isPlaying = !_isPlaying;
  const btn = document.getElementById('t13-btn-play');
  btn.innerHTML = _isPlaying ? '⏸' : '▶';

  if (_isPlaying) {
    if (_currentMonthIndex === _uniqueMonths.length - 1) {
      // Loop back to start if already at the end
      _currentMonthIndex = -1;
      _updateSliderUI();
      _updateMapColors(500);
    }

    _playInterval = setInterval(() => {
      _currentMonthIndex++;
      if (_currentMonthIndex > _uniqueMonths.length - 1) {
        // Pause at the end
        _togglePlay();
        return;
      }
      _updateSliderUI();
      _updateMapColors(800);
      _syncSliderToGlobalFilter();
    }, 1500);
  } else {
    clearInterval(_playInterval);
  }
}

function _updateSliderUI() {
  const slider = document.getElementById('t13-slider');
  const label = document.getElementById('t13-time-label');
  if (slider) slider.value = _currentMonthIndex;
  if (label) label.textContent = _formatMonthLabel();
}

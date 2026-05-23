/**
 * task12-dualAxis.js – UV & Thời lượng ban ngày (Dual-Axis)
 *
 * Chart type : Dual Axis (Bar + Line)
 * X-axis     : Time (Days if month selected, else Months)
 * Y-axis (L) : UV Index (Max) -> Bar
 * Y-axis (R) : Day Length (Avg hours) -> Line
 */

import { Tooltip } from '../components/tooltip.js';
import { formatUV } from '../utils.js';

const CONTAINER = '#chart-task12';
const CHART_HEIGHT = 360;
const BAR_HOVER_LIFT = 6;

const MARGIN = { top: 40, right: 60, bottom: 40, left: 60 };

const tooltip = new Tooltip();

export function init() {
  const controlsEl = document.getElementById('task12-controls');
  if (controlsEl) controlsEl.innerHTML = '';
}

export function render(data, options = {}) {
  const el = document.querySelector(CONTAINER);

  if (!el || !data?.length) {
    _showPlaceholder('☀️', 'Không có dữ liệu');
    return;
  }

  const isMonthFiltered = options.month && options.month !== 'All';

  const groupsMap = {};
  data.forEach(d => {
    if (!d.date) return;
    let key, label;

    if (isMonthFiltered) {
      key = d.date.getDate();
      label = `Ngày ${key}`;
    } else {
      const y = d.date.getFullYear();
      const m = String(d.date.getMonth() + 1).padStart(2, '0');
      key = `${y}-${m}`;
      label = `Tháng ${d.date.getMonth() + 1}/${y}`;
    }

    if (!groupsMap[key]) {
      groupsMap[key] = { key, label, maxUV: -Infinity, totalDayLength: 0, count: 0 };
    }

    groupsMap[key].maxUV = Math.max(groupsMap[key].maxUV, d.uv);
    groupsMap[key].totalDayLength += d.dayLengthHours;
    groupsMap[key].count++;
  });

  const aggregated = Object.values(groupsMap).map(g => ({
    key: g.key,
    label: g.label,
    uv: g.maxUV === -Infinity ? 0 : g.maxUV,
    dayLength: g.totalDayLength / g.count,
  }));

  if (isMonthFiltered) {
    aggregated.sort((a, b) => a.key - b.key);
  } else {
    aggregated.sort((a, b) => String(a.key).localeCompare(String(b.key)));
  }

  el.innerHTML = '';
  el.style.height = '100%';
  el.style.minHeight = `${CHART_HEIGHT}px`;
  el.style.maxHeight = `${CHART_HEIGHT}px`;
  el.style.overflow = 'hidden';
  const W = el.clientWidth || 720;
  const H = CHART_HEIGHT;
  const w = W - MARGIN.left - MARGIN.right;
  const h = H - MARGIN.top - MARGIN.bottom;

  const svg = d3.select(el).append('svg')
    .attr('width', W).attr('height', H);

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  const x = d3.scaleBand()
    .domain(aggregated.map(d => d.key))
    .range([0, w])
    .padding(0.3);

  const maxUVValue = d3.max(aggregated, d => d.uv) || 15;
  const yLeft = d3.scaleLinear()
    .domain([0, Math.max(12, maxUVValue + 2)])
    .range([h, 0])
    .nice();

  const [minDL, maxDL] = d3.extent(aggregated, d => d.dayLength);
  const yRight = d3.scaleLinear()
    .domain([Math.max(0, (minDL || 10) - 1), (maxDL || 14) + 1])
    .range([h, 0])
    .nice();

  const uvColor = d3.scaleSequential(d3.interpolateYlOrRd).domain([5, 10]);

  g.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).tickFormat(d => {
      if (isMonthFiltered) return d;
      return parseInt(String(d).split('-')[1]);
    }))
    .call(ax => ax.select('.domain').remove())
    .selectAll('text')
    .attr('fill', 'var(--color-text-muted)')
    .attr('font-size', 11);

  g.append('text')
    .attr('x', w / 2)
    .attr('y', h + 35)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--color-text-muted)')
    .attr('font-size', 12)
    .text(isMonthFiltered ? 'Ngày trong tháng' : 'Tháng');

  g.append('g')
    .attr('class', 'axis y-axis-left')
    .call(d3.axisLeft(yLeft).ticks(5))
    .call(ax => ax.select('.domain').remove())
    .selectAll('text')
    .attr('fill', 'var(--color-text-muted)');

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h / 2)
    .attr('y', -40)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--color-text)')
    .attr('font-size', 12)
    .attr('font-weight', '600')
    .text('Chỉ số UV (Cột)');

  g.append('g')
    .attr('class', 'axis y-axis-right')
    .attr('transform', `translate(${w},0)`)
    .call(d3.axisRight(yRight).ticks(5).tickFormat(d => `${d}h`))
    .call(ax => ax.select('.domain').remove())
    .selectAll('text')
    .attr('fill', 'var(--color-text-muted)');

  g.append('text')
    .attr('transform', `translate(${w}, 0) rotate(90)`)
    .attr('x', h / 2)
    .attr('y', -45)
    .attr('text-anchor', 'middle')
    .attr('fill', '#38bdf8')
    .attr('font-size', 12)
    .attr('font-weight', '600')
    .text('Giờ nắng (Đường)');

  const barY = d => yLeft(d.uv);
  const barH = d => h - yLeft(d.uv);

  const resetBars = (selection) => {
    selection
      .transition('bar-hover').duration(150).ease(d3.easeCubicOut)
      .attr('opacity', 0.8)
      .attr('y', barY)
      .attr('height', barH);
  };

  g.selectAll('.bar')
    .data(aggregated)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', d => x(d.key))
    .attr('width', x.bandwidth())
    .attr('rx', 4)
    .attr('fill', d => uvColor(d.uv))
    .attr('opacity', 0.8)
    .attr('y', h)
    .attr('height', 0)
    .on('mouseover', function (event, d) {
      g.selectAll('.bar')
        .transition('bar-hover').duration(150).ease(d3.easeCubicOut)
        .attr('opacity', 0.35)
        .attr('y', barY)
        .attr('height', barH);

      d3.select(this)
        .transition('bar-hover').duration(150).ease(d3.easeCubicOut)
        .attr('opacity', 1)
        .attr('y', barY(d) - BAR_HOVER_LIFT)
        .attr('height', barH(d) + BAR_HOVER_LIFT);

      g.selectAll('.dot').attr('opacity', 0.3);
      g.selectAll('.dot').filter(dotData => dotData.key === d.key).attr('opacity', 1).attr('r', 6);

      const html = `
        <div class="chart-tooltip__title">${d.label}</div>
        <div class="chart-tooltip__divider"></div>
        <div class="chart-tooltip__row">
          <span class="chart-tooltip__label">
            <span class="chart-tooltip__color-dot" style="background:${uvColor(d.uv)}"></span>
            Chỉ số UV
          </span>
          <span class="chart-tooltip__value">${formatUV(d.uv)}</span>
        </div>
        <div class="chart-tooltip__row">
          <span class="chart-tooltip__label">
            <span class="chart-tooltip__color-dot" style="background:#38bdf8"></span>
            Thời lượng nắng
          </span>
          <span class="chart-tooltip__value">${d.dayLength.toFixed(1)}h</span>
        </div>
      `;
      tooltip.show(event, html);
    })
    .on('mousemove', event => tooltip.move(event))
    .on('mouseleave', function () {
      resetBars(g.selectAll('.bar'));
      g.selectAll('.dot').attr('opacity', 1).attr('r', 4);
      tooltip.hide();
    })
    .transition('bar-enter')
    .duration(800)
    .delay((d, i) => i * 30)
    .ease(d3.easeCubicOut)
    .attr('y', barY)
    .attr('height', barH);

  const line = d3.line()
    .x(d => x(d.key) + x.bandwidth() / 2)
    .y(d => yRight(d.dayLength))
    .curve(d3.curveMonotoneX);

  const path = g.append('path')
    .datum(aggregated)
    .attr('fill', 'none')
    .attr('stroke', '#38bdf8')
    .attr('stroke-width', 3)
    .attr('d', line);

  const totalLength = path.node().getTotalLength();
  path
    .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
    .attr('stroke-dashoffset', totalLength)
    .transition()
    .duration(1500)
    .ease(d3.easeCubicOut)
    .attr('stroke-dashoffset', 0);

  g.selectAll('.dot')
    .data(aggregated)
    .join('circle')
    .attr('class', 'dot')
    .attr('cx', d => x(d.key) + x.bandwidth() / 2)
    .attr('cy', d => yRight(d.dayLength))
    .attr('r', 0)
    .attr('fill', 'var(--color-surface)')
    .attr('stroke', '#38bdf8')
    .attr('stroke-width', 2)
    .style('pointer-events', 'none')
    .transition()
    .duration(500)
    .delay((d, i) => 800 + i * 30)
    .attr('r', 4);
}

function _showPlaceholder(icon, label) {
  const el = document.querySelector(CONTAINER);
  if (!el) return;
  el.innerHTML = `
    <div class="chart-placeholder" style="height:360px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--color-text-muted);">
      <span style="font-size:32px;">${icon}</span>
      <span>${label}</span>
    </div>`;
}

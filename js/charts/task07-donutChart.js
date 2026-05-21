/**
 * Task 07 – Donut Chart: Tần suất trạng thái thời tiết
 * 
 * Chart: Donut/pie chart
 * Data: count of day.condition.text
 * Interactions: hover expand arc + tooltip, region filter, transition on filter
 * 
 * @module task07-donutChart
 */

import { createSvg, getMargin, getDimensions, formatNumber, formatPercent, addResizeObserver } from '../utils.js?v=2';
import { Tooltip } from '../components/tooltip.js?v=2';
import { Legend } from '../components/legend.js?v=2';

const CONTAINER = '#chart-task07';
const tooltip = new Tooltip();
const legend = new Legend('#task07-controls');

// Bảng ánh xạ màu sắc thời tiết trực quan phù hợp thực tế
const conditionColors = {
  'Sunny': '#ffa726', // Vàng nắng
  'Clear': '#ffa726', // Vàng nắng
  'Partly cloudy': '#90a4ae', // Xám xanh mỏng
  'Cloudy': '#78909c', // Xám vừa
  'Overcast': '#546e7a', // Xám âm u dầy
  'Patchy rain possible': '#4fc3f7', // Xanh mưa bóng mây
  'Moderate rain at times': '#29b6f6', // Xanh mưa vừa
  'Heavy rain at times': '#0288d1', // Xanh mưa nặng hạt
  'Moderate or heavy rain shower': '#0277bd', // Xanh sẫm mưa rào
  'Light drizzle': '#81d4fa', // Xanh lục mưa phùn
  'Patchy light drizzle': '#81d4fa',
  'Thundery outbreaks possible': '#ab47bc', // Tím giông sét
  'Patchy light rain with thunder': '#ab47bc',
  'Moderate or heavy rain with thunder': '#7b1fa2', // Tím sẫm giông sét lớn
  'Khác': '#b0bec5' // Xám trung tính cho nhóm Khác
};

let _lastData = null;
let _lastOptions = null;

export function init() {
  if (!init.observed) {
    addResizeObserver(CONTAINER, () => {
      if (_lastData) {
        render(_lastData, _lastOptions);
      }
    });
    init.observed = true;
  }
  console.log('📊 Task 07 – Donut Chart initialized');
}

export function render(data, options = {}) {
  _lastData = data;
  _lastOptions = options;

  if (!data || data.length === 0) {
    showPlaceholder('🍩', 'Không có dữ liệu thời tiết');
    return;
  }

  const container = document.querySelector(CONTAINER);
  if (container) {
    container.querySelector('.chart-placeholder')?.remove();
  }

  // 1. Roll up and count weather conditions
  const counts = d3.rollup(data, v => v.length, d => d.condition);
  let sortedData = Array.from(counts, ([condition, count]) => ({ condition, count }))
    .sort((a, b) => b.count - a.count);

  if (sortedData.length === 0) {
    showPlaceholder('🍩', 'Không có dữ liệu thời tiết');
    return;
  }

  // 2. Intelligent grouping: Top 5 + "Khác"
  if (sortedData.length > 6) {
    const top5 = sortedData.slice(0, 5);
    const rest = sortedData.slice(5);
    const otherSum = d3.sum(rest, d => d.count);
    sortedData = [...top5, { condition: 'Khác', count: otherSum }];
  }

  const totalDays = d3.sum(sortedData, d => d.count);

  // 3. Custom color mapping with ordinal scale fallback
  const uniqueConditions = sortedData.map(d => d.condition);
  const fallbackScale = d3.scaleOrdinal()
    .domain(uniqueConditions)
    .range(d3.schemeTableau10);

  const getColor = (cond) => {
    return conditionColors[cond] || fallbackScale(cond);
  };

  // 4. Layout dimensions and coordinates
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const dim = getDimensions(CONTAINER, margin);
  if (dim.width === 0) return;

  let svg = d3.select(CONTAINER).select('svg');
  let g;

  if (svg.empty() || +svg.attr('width') !== dim.width) {
    g = createSvg(CONTAINER, dim.width, dim.height, margin);
    svg = d3.select(CONTAINER).select('svg');
  } else {
    g = svg.select('g');
  }

  // Center coordinate configuration
  const cx = dim.innerWidth / 2;
  const cy = dim.innerHeight / 2;
  const radius = Math.min(dim.innerWidth, dim.innerHeight) / 2 - 10;
  const innerRadius = radius * 0.58;
  const outerRadius = radius;

  // Arc generators
  const arc = d3.arc()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);

  // Donut chart group positioning
  let donutG = g.select('.donut-group');
  if (donutG.empty()) {
    donutG = g.append('g')
      .attr('class', 'donut-group')
      .attr('transform', `translate(${cx}, ${cy})`);
  } else {
    donutG.attr('transform', `translate(${cx}, ${cy})`);
  }

  // 5. Draw Donut Slices
  const pie = d3.pie()
    .value(d => d.count)
    .sort(null);

  const arcsData = pie(sortedData);

  const paths = donutG.selectAll('.donut-slice')
    .data(arcsData, d => d.data.condition);

  paths.join(
    enter => enter.append('path')
      .attr('class', 'donut-slice')
      .attr('d', arc)
      .style('fill', d => getColor(d.data.condition))
      .style('stroke', 'var(--color-bg-card)')
      .style('stroke-width', '2px')
      .style('cursor', 'pointer')
      .each(function(d) {
        this._current = d;
        const angle = (d.startAngle + d.endAngle) / 2;
        const offset = 8;
        const x = Math.sin(angle) * offset;
        const y = -Math.cos(angle) * offset;
        d3.select(this)
          .style('--hover-x', `${x}px`)
          .style('--hover-y', `${y}px`);
      })
      .style('opacity', 0)
      .call(enter => enter.transition().duration(600).style('opacity', 1)),
    update => update.call(update => update.transition().duration(600)
      .attrTween('d', function(d) {
        const interpolate = d3.interpolate(this._current, d);
        this._current = interpolate(0);
        return function(t) { return arc(interpolate(t)); };
      })
      .each(function(d) {
        const angle = (d.startAngle + d.endAngle) / 2;
        const offset = 8;
        const x = Math.sin(angle) * offset;
        const y = -Math.cos(angle) * offset;
        d3.select(this)
          .style('--hover-x', `${x}px`)
          .style('--hover-y', `${y}px`);
      })),
    exit => exit.call(exit => exit.transition().duration(400).style('opacity', 0).remove())
  );

  // 6. Draw Center Text Callout
  let centerG = donutG.select('.center-text-group');
  if (centerG.empty()) {
    centerG = donutG.append('g').attr('class', 'center-text-group');

    centerG.append('text')
      .attr('class', 'center-value')
      .attr('text-anchor', 'middle')
      .attr('dy', '-2px')
      .style('font-size', 'var(--fs-lg)')
      .style('font-weight', 'var(--fw-bold)')
      .style('fill', 'var(--color-text-primary)');

    centerG.append('text')
      .attr('class', 'center-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '18px')
      .style('font-size', 'var(--fs-xs)')
      .style('fill', 'var(--color-text-muted)')
      .text('Ngày quan trắc');
  }

  const updateCenterText = (value, label) => {
    centerG.select('.center-value').text(value);
    centerG.select('.center-label').text(label.length > 12 ? label.substring(0, 10) + '...' : label);
  };

  updateCenterText(formatNumber(totalDays), 'Ngày quan trắc');

  // 7. Interactive Bindings for Slices
  const syncLegendState = () => {
    const activeItems = legend.getActive();

    donutG.selectAll('.donut-slice')
      .transition().duration(200)
      .style('opacity', d => activeItems.has(d.data.condition) ? 1.0 : 0.15)
      .style('pointer-events', d => activeItems.has(d.data.condition) ? 'auto' : 'none');

    d3.selectAll('#task07-controls .chart-legend__item')
      .transition().duration(200)
      .style('opacity', item => activeItems.has(item.key) ? 1.0 : 0.25);
  };

  donutG.selectAll('.donut-slice')
    .on('mouseover', function(event, d) {
      // Thêm class hover để kích hoạt CSS transition mượt mà
      d3.select(this).classed('donut-slice--hovered', true);

      donutG.selectAll('.donut-slice')
        .filter(node => node.data.condition !== d.data.condition)
        .transition().duration(200)
        .style('opacity', 0.25);

      // Dim non-hovered legend items in HTML
      d3.selectAll('#task07-controls .chart-legend__item')
        .filter(item => item.key !== d.data.condition)
        .transition().duration(200)
        .style('opacity', 0.25);

      const percent = (d.data.count / totalDays) * 100;
      updateCenterText(formatPercent(percent), d.data.condition);

      const html = Tooltip.buildHTML('Trạng thái thời tiết', [
        { label: 'Trạng thái', value: d.data.condition, color: getColor(d.data.condition) },
        { label: 'Số ngày', value: `${formatNumber(d.data.count)} ngày` },
        { label: 'Tỷ lệ', value: `${percent.toFixed(1)}%` }
      ]);
      tooltip.show(event, html);
    })
    .on('mousemove', function(event) {
      tooltip.show(event, tooltip.el.html());
    })
    .on('mouseout', function() {
      // Gỡ bỏ class hover để thu nhỏ về bình thường
      d3.select(this).classed('donut-slice--hovered', false);

      syncLegendState();

      updateCenterText(formatNumber(totalDays), 'Ngày quan trắc');
      tooltip.hide();
    });

  // 8. Render Interactive HTML Legend using the shared component
  const legendItems = sortedData.map(d => ({
    label: d.condition,
    color: getColor(d.condition),
    key: d.condition
  }));

  legend.render(legendItems, (key, isActive, activeItems) => {
    syncLegendState();
  });

  // Tương tác đồng bộ hai chiều khi hover qua Legend HTML
  d3.selectAll('#task07-controls .chart-legend__item')
    .on('mouseenter', function(event, d) {
      // Tìm mảnh donut tương ứng để phóng to
      donutG.selectAll('.donut-slice')
        .filter(node => node.data.condition === d.key)
        .classed('donut-slice--hovered', true);

      donutG.selectAll('.donut-slice')
        .filter(node => node.data.condition !== d.key)
        .transition().duration(200)
        .style('opacity', 0.25);

      d3.selectAll('#task07-controls .chart-legend__item')
        .filter(item => item.key !== d.key)
        .transition().duration(200)
        .style('opacity', 0.25);

      // Cập nhật nhãn chữ ở tâm donut
      const targetData = sortedData.find(item => item.condition === d.key);
      if (targetData) {
        const percent = (targetData.count / totalDays) * 100;
        updateCenterText(formatPercent(percent), d.key);
      }
    })
    .on('mouseleave', function(event, d) {
      donutG.selectAll('.donut-slice')
        .classed('donut-slice--hovered', false);

      syncLegendState();

      updateCenterText(formatNumber(totalDays), 'Ngày quan trắc');
    });
}

function showPlaceholder(icon, label) {
  const el = document.querySelector(CONTAINER);
  if (!el) return;
  el.innerHTML = `
    <div class="chart-placeholder">
      <span class="chart-placeholder__icon">${icon}</span>
      <span>${label}</span>
    </div>`;
}


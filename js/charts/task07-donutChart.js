/**
 * Task 07 – Donut Chart: Tần suất trạng thái thời tiết
 * 
 * Chart: Donut/pie chart
 * Data: count of day.condition.text
 * Interactions: hover expand arc + tooltip, region filter, transition on filter
 * 
 * @module task07-donutChart
 */

import { createSvg, formatNumber, formatPercent } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task07';
const tooltip = new Tooltip();

export function init() {
  console.log('📊 Task 07 – Donut Chart initialized');
}

export function render(data, options = {}) {
  // TODO: Implement
  showPlaceholder('🍩', 'Task 7: Donut – Tần suất thời tiết');
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

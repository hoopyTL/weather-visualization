/**
 * Task 08 – Box/Violin Plot: Nhiệt độ theo trạng thái thời tiết
 * 
 * Chart: Box plot (or violin)
 * X: condition.text (top 8) | Y: avgtemp_c
 * Interactions: hover stats tooltip, click to isolate
 * 
 * @module task08-violinChart
 */

import { createSvg, getMargin, getDimensions, formatTemp } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task08';
const tooltip = new Tooltip();

export function init() {
  console.log('📊 Task 08 – Box Plot initialized');
}

export function render(data, options = {}) {
  // TODO: Implement
  showPlaceholder('📦', 'Task 8: Box Plot – Nhiệt độ theo thời tiết');
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

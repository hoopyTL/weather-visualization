/**
 * Task 10 – Scatter Plot: Chỉ số UV và nhiệt độ
 * 
 * Chart: Scatter plot with trend line
 * X: avgtemp_c | Y: uv | Color: region
 * Interactions: hover tooltip, brush selection, region filter
 * 
 * @module task10-scatterChart
 */

import { createSvg, getMargin, getDimensions, regionColor, formatTemp, formatUV } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task10';
const tooltip = new Tooltip();

export function init() {
  console.log('📊 Task 10 – Scatter Plot initialized');
}

export function render(data, options = {}) {
  // TODO: Implement
  showPlaceholder('⚬', 'Task 10: Scatter – UV vs Nhiệt độ');
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

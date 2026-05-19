/**
 * Task 02 – Grouped Bar Chart: So sánh nhiệt độ giữa các vùng
 * 
 * Chart: Grouped bar chart
 * X: location.region | Y: avg/max/min temp
 * Interactions: hover tooltip, click highlight
 * 
 * @module task02-groupedBarChart
 */

import { createSvg, getMargin, getDimensions, regionColor, formatTemp } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task02';
const tooltip = new Tooltip();

export function init() {
  console.log('📊 Task 02 – Grouped Bar Chart initialized');
}

export function render(data, options = {}) {
  // TODO: Implement
  // 1. Aggregate avg/max/min temp per region
  // 2. Create band scale (x) and linear scale (y)
  // 3. Draw grouped bars (3 per region: avg, max, min)
  // 4. Add hover tooltip
  // 5. Add sort toggle
  showPlaceholder('📊', 'Task 2: Grouped Bar – So sánh nhiệt độ vùng');
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

/**
 * Task 09 – Heatmap: So sánh thời tiết giữa các vùng
 * 
 * Chart: Heatmap matrix
 * Rows: region | Columns: metrics (temp, humidity, wind, precip, UV)
 * Interactions: hover tooltip, click to highlight row
 * 
 * @module task09-heatmapChart
 */

import { createSvg, getMargin, getDimensions, regionShort } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task09';
const tooltip = new Tooltip();

export function init() {
  console.log('📊 Task 09 – Heatmap initialized');
}

export function render(data, options = {}) {
  // TODO: Implement
  showPlaceholder('🟥', 'Task 9: Heatmap – So sánh thời tiết vùng');
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

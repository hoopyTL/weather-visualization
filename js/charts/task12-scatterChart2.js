/**
 * Task 12 – Scatter Plot: Ban ngày dài ảnh hưởng UV?
 * 
 * Chart: Scatter with color gradient
 * X: day length (hours) | Y: uv | Color: avgtemp | Size: totalprecip
 * Interactions: hover tooltip, brush, region filter
 * 
 * @module task12-scatterChart2
 */

import { createSvg, getMargin, getDimensions, createTempScale, formatUV } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task12';
const tooltip = new Tooltip();

export function init() {
  console.log('📊 Task 12 – Scatter Plot 2 initialized');
}

export function render(data, options = {}) {
  // TODO: Implement
  showPlaceholder('☀️', 'Task 12: Scatter – Ban ngày vs UV');
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

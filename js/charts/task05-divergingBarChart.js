/**
 * Task 05 – Diverging Bar Chart: So sánh ven biển & nội địa
 * 
 * Chart: Grouped/diverging bar chart
 * Groups: terrain (ven biển, đồng bằng, miền núi)
 * Metrics: avgtemp, totalprecip, avghumidity
 * Interactions: hover tooltip, metric toggle
 * 
 * @module task05-divergingBarChart
 */

import { createSvg, getMargin, getDimensions, TERRAIN_COLORS, formatTemp } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task05';
const tooltip = new Tooltip();

export function init() {
  console.log('📊 Task 05 – Diverging Bar Chart initialized');
}

export function render(data, options = {}) {
  // TODO: Implement
  showPlaceholder('↔️', 'Task 5: Diverging Bar – Ven biển vs Nội địa');
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

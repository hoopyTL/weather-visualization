/**
 * Task 06 – Bubble Map: Mật độ điểm đo theo khu vực
 * 
 * Chart: Proportional symbol map
 * Position: lat/lon | Size: measurement count | Color: region
 * Interactions: hover tooltip, zoom/pan
 * 
 * @module task06-bubbleMap
 */

import { createSvg, regionColor } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task06';
const tooltip = new Tooltip();

export function init() {
  console.log('🗺️ Task 06 – Bubble Map initialized');
}

export function render(data, options = {}) {
  // TODO: Implement
  showPlaceholder('🔵', 'Task 6: Bubble Map – Mật độ điểm đo');
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

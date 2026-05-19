/**
 * Task 11 – Area Chart: Độ dài ban ngày
 * 
 * Chart: Multi-line area chart
 * X: date | Y: day length (hours) | Groups: lat bands (North/Central/South)
 * Interactions: hover crosshair, transition on toggle
 * 
 * @module task11-areaChart
 */

import { createSvg, getMargin, getDimensions, formatDateShort } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task11';
const tooltip = new Tooltip();

export function init() {
  console.log('📊 Task 11 – Area Chart initialized');
}

export function render(data, options = {}) {
  // TODO: Implement
  showPlaceholder('🌅', 'Task 11: Area – Độ dài ban ngày');
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

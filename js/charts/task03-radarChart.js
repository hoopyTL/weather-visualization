/**
 * Task 03 – Radar Chart: Phân tích thời tiết theo vùng
 * 
 * Chart: Radar/spider chart
 * Axes: avgtemp, maxwind, totalprecip, avghumidity, uv (normalized)
 * Interactions: hover highlight, transition on region change
 * 
 * @module task03-radarChart
 */

import { createSvg, regionColor, formatTemp } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task03';
const tooltip = new Tooltip();

export function init() {
  console.log('📊 Task 03 – Radar Chart initialized');
}

export function render(data, options = {}) {
  // TODO: Implement
  // 1. Compute mean of each metric per region
  // 2. Normalize all metrics to 0-1
  // 3. Draw radar axes (5 spokes)
  // 4. Draw polygon per region
  // 5. Add hover to highlight one region
  // 6. Add transition when changing selected regions
  showPlaceholder('🕸️', 'Task 3: Radar – Phân tích thời tiết vùng');
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

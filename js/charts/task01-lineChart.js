/**
 * Task 01 – Line Chart: Nhiệt độ trung bình theo thời gian
 * 
 * Chart: Multi-line chart with area fill
 * X: date | Y: day.avgtemp_c | Color: region
 * Interactions: hover tooltip, brush-zoom, transition on filter
 * 
 * @module task01-lineChart
 */

import { createSvg, getMargin, getDimensions, createRegionScale, regionColor, formatTemp, formatDateShort } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task01';
const tooltip = new Tooltip();

/**
 * Initialize chart (binds to container, sets up static elements)
 */
export function init() {
  // TODO: Set up SVG, axes groups, brush, clip path
  console.log('📊 Task 01 – Line Chart initialized');
}

/**
 * Render/update chart with data
 * @param {Array} data - Filtered weather data
 * @param {Object} options - { selectedRegions: string[] }
 */
export function render(data, options = {}) {
  // TODO: Implement
  // 1. Group data by region, compute daily avg across provinces per region
  // 2. Create time scale (x) and linear scale (y)
  // 3. Draw lines with d3.line()
  // 4. Add area fill below lines
  // 5. Add hover interaction with vertical crosshair
  // 6. Add brush for zoom
  // 7. Animate transitions when regions change
  showPlaceholder('📈', 'Task 1: Line Chart – Nhiệt độ theo thời gian');
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

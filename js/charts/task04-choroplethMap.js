/**
 * Task 04 – Choropleth Map: Bản đồ nhiệt độ trung bình
 * 
 * Chart: Choropleth map of Vietnam provinces
 * Color: avgtemp_c (sequential blue→red)
 * Interactions: hover tooltip, pan/zoom, month slider
 * 
 * @module task04-choroplethMap
 */

import { createSvg, createTempScale, formatTemp } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task04';
const tooltip = new Tooltip();

export function init() {
  console.log('🗺️ Task 04 – Choropleth Map initialized');
}

export function render(data, options = {}) {
  // TODO: Implement
  // 1. Load GeoJSON from assets/vietnam-provinces.json
  // 2. Create projection (d3.geoMercator) fitted to Vietnam bounds
  // 3. Compute avg temp per province
  // 4. Create path generator and draw provinces
  // 5. Color fill by temp scale
  // 6. Add hover tooltip (province name + temp)
  // 7. Add d3.zoom for pan/zoom
  // 8. Add month slider to filter by time
  showPlaceholder('🗺️', 'Task 4: Choropleth – Bản đồ nhiệt độ');
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

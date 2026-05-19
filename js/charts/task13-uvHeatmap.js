/**
 * Task 13 – UV Heatmap: UV cao nhất xảy ra vào thời điểm nào trong năm?
 * 
 * Chart: Heatmap
 * X: Month (Tháng 1 -> 12)
 * Y: Region (Vùng)
 * Color: Max UV index (hoặc Avg UV index)
 * Interactions: hover tooltip, transition on data update
 * 
 * @module task13-uvHeatmap
 */

import { createSvg, getMargin, getDimensions, regionColor } from '../utils.js';
import { Tooltip } from '../components/tooltip.js';

const CONTAINER = '#chart-task13';
const tooltip = new Tooltip();

export function init() {
  console.log('📊 Task 13 – UV Heatmap initialized');
}

export function render(data, options = {}) {
  // TODO: Implement
  // 1. Extract month from date
  // 2. Group data by Region and Month
  // 3. Calculate max/avg UV per group
  // 4. Create band scales for X (Month) and Y (Region)
  // 5. Create color scale for UV values
  // 6. Draw rects for the heatmap
  // 7. Add hover tooltip showing region, month, and UV stats
  // 8. Add controls to toggle between Max UV and Avg UV if needed
  showPlaceholder('🔥', 'Task 13: Thời điểm UV cao nhất (Heatmap Tháng x Vùng)');
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

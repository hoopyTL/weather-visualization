/**
 * utils.js – Shared color scales, formatters, and helper functions
 * 
 * USAGE:
 *   import { REGION_COLORS, regionColor, formatTemp, formatDate } from './utils.js';
 */

/* ============================================================
   1. COLOR SCALES
   ============================================================ */

/** Region name → color mapping (matches CSS variables) */
export const REGION_COLORS = {
  'Đồng Bằng Sông Hồng':                      '#4fc3f7',
  'Trung du và miền núi Bắc Bộ':               '#81c784',
  'Bắc Trung Bộ và Duyên hải miền Trung':      '#ffb74d',
  'Tây Nguyên':                                 '#e57373',
  'Đông Nam Bộ':                                '#ba68c8',
  'Đồng Bằng Sông Cửu Long':                   '#4db6ac',
};

/** Region abbreviations for compact labels */
export const REGION_SHORT = {
  'Đồng Bằng Sông Hồng':                      'ĐBSH',
  'Trung du và miền núi Bắc Bộ':               'TD&MNBB',
  'Bắc Trung Bộ và Duyên hải miền Trung':      'BTB&DHMT',
  'Tây Nguyên':                                 'Tây Nguyên',
  'Đông Nam Bộ':                                'ĐNB',
  'Đồng Bằng Sông Cửu Long':                   'ĐBSCL',
};

/** Terrain name → color */
export const TERRAIN_COLORS = {
  'ven biển': '#4fc3f7',
  'đồng bằng': '#aed581',
  'miền núi': '#ff8a65',
};

/** Display labels (viết hoa chữ cái đầu) — value trong data giữ nguyên */
export const TERRAIN_LABELS = {
  'ven biển': 'Ven biển',
  'đồng bằng': 'Đồng bằng',
  'miền núi': 'Miền núi',
};

/**
 * @param {string} terrain — raw key from dataset
 * @returns {string}
 */
export function formatTerrainLabel(terrain) {
  if (!terrain) return '—';
  return TERRAIN_LABELS[terrain] || terrain;
}

/**
 * Get color for a region name
 * @param {string} region
 * @returns {string} hex color
 */
export function regionColor(region) {
  return REGION_COLORS[region] || '#888';
}

/**
 * Get abbreviated region name
 * @param {string} region
 * @returns {string}
 */
export function regionShort(region) {
  return REGION_SHORT[region] || region;
}

/**
 * Sanitize a string for use as a CSS class or DOM ID
 * @param {string} str
 * @returns {string}
 */
export function sanitizeKey(str) {
  return str
    .toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Create a D3 ordinal color scale for regions
 * @param {string[]} regions - Array of region names
 * @returns {d3.ScaleOrdinal}
 */
export function createRegionScale(regions) {
  return d3.scaleOrdinal()
    .domain(regions)
    .range(regions.map(r => REGION_COLORS[r] || '#888'));
}

/**
 * Temperature color scale (blue → orange → red)
 * @param {[number, number]} domain - [min, max] temperature
 * @returns {d3.ScaleSequential}
 */
export function createTempScale(domain) {
  return d3.scaleSequential()
    .domain(domain)
    .interpolator(d3.interpolateYlOrRd);
}


/* ============================================================
   2. FORMATTERS
   ============================================================ */

/** Format temperature with unit */
export const formatTemp = (v) => `${v.toFixed(1)}°C`;

/** Format percentage */
export const formatPercent = (v) => `${Math.round(v)}%`;

/** Format wind speed */
export const formatWind = (v) => `${v.toFixed(1)} km/h`;

/** Format precipitation */
export const formatPrecip = (v) => `${v.toFixed(1)} mm`;

/** Format UV index */
export const formatUV = (v) => (v != null && !isNaN(v) ? v.toFixed(1) : '—');

/**
 * WHO UV Index risk level for badges / alerts
 * @param {number} uv
 * @returns {{ label: string, color: string, bg: string }}
 */
export function getUvRiskLevel(uv) {
  if (uv == null || isNaN(uv)) {
    return { label: 'N/A', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  }
  if (uv >= 11) return { label: 'CỰC CAO', color: '#7f1d1d', bg: 'rgba(127,29,29,0.15)' };
  if (uv >= 8) return { label: 'RẤT CAO', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
  if (uv >= 6) return { label: 'CAO', color: '#f97316', bg: 'rgba(249,115,22,0.1)' };
  if (uv >= 3) return { label: 'TRUNG BÌNH', color: '#eab308', bg: 'rgba(234,179,8,0.1)' };
  return { label: 'THẤP', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' };
}

/** Format decimal hours as "Xh Ym" */
export function formatDayLengthHours(hours) {
  if (hours == null || isNaN(hours)) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

/** Format date (short) */
export const formatDateShort = d3.timeFormat('%d/%m/%Y');

/** Format date (month-year) */
export const formatMonthYear = d3.timeFormat('%m/%Y');

/** Format number with locale */
export const formatNumber = d3.format(',');


/* ============================================================
   3. CHART HELPERS
   ============================================================ */

/**
 * Standard margin convention
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @returns {{top: number, right: number, bottom: number, left: number}}
 */
export function getMargin(size = 'md') {
  const margins = {
    sm: { top: 20, right: 20, bottom: 30, left: 40 },
    md: { top: 30, right: 30, bottom: 50, left: 60 },
    lg: { top: 40, right: 40, bottom: 60, left: 80 },
  };
  return margins[size] || margins.md;
}

/**
 * Get the inner dimensions of a container element
 * @param {string} selector - CSS selector for container
 * @param {Object} margin - Margin object
 * @returns {{ width: number, height: number, innerWidth: number, innerHeight: number }}
 */
export function getDimensions(selector, margin = getMargin()) {
  const container = document.querySelector(selector);
  if (!container) return { width: 0, height: 0, innerWidth: 0, innerHeight: 0 };

  const rect = container.getBoundingClientRect();
  const width  = rect.width;
  const height = Math.max(rect.height, 350); // minimum height

  return {
    width,
    height,
    innerWidth:  width - margin.left - margin.right,
    innerHeight: height - margin.top - margin.bottom,
  };
}

/**
 * Create or select an SVG element inside a container
 * @param {string} selector - Container CSS selector
 * @param {number} width
 * @param {number} height
 * @param {Object} margin
 * @returns {d3.Selection} The inner <g> group (translated by margin)
 */
export function createSvg(selector, width, height, margin) {
  // Clear any existing SVG
  d3.select(selector).selectAll('svg').remove();

  const svg = d3.select(selector)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  return g;
}

/**
 * Add responsive resize observer to a chart
 * @param {string} selector - Container CSS selector
 * @param {Function} renderFn - Function to call on resize
 */
export function addResizeObserver(selector, renderFn) {
  const el = document.querySelector(selector);
  if (!el) return;

  let timeout;
  const observer = new ResizeObserver(() => {
    clearTimeout(timeout);
    timeout = setTimeout(renderFn, 200);
  });
  observer.observe(el);
}

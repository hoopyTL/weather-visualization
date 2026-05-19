/**
 * dataLoader.js – CSV loading, parsing, and data preprocessing
 * 
 * USAGE:
 *   import { loadWeatherData, getRegions, getTerrains, getProvinces } from './dataLoader.js';
 *   const data = await loadWeatherData();
 */

const DATA_PATH = './datasets/df_weather_cleaned_final.csv';

/** @type {Array|null} Cached parsed data */
let _cachedData = null;

/**
 * Load and parse the weather CSV data.
 * Results are cached after first load.
 * @returns {Promise<Array<Object>>} Parsed and enriched data rows
 */
export async function loadWeatherData() {
  if (_cachedData) return _cachedData;

  const raw = await d3.csv(DATA_PATH);

  _cachedData = raw.map(d => ({
    // --- Location ---
    name:     d['location.name'],
    region:   d['location.region'],
    terrain:  d['location.terrain'],
    lat:      +d['location.lat'],
    lon:      +d['location.lon'],

    // --- Date ---
    date:      d3.timeParse('%Y-%m-%d')(d['date']),
    dateStr:   d['date'],

    // --- Temperature ---
    maxTemp:   +d['day.maxtemp_c'],
    minTemp:   +d['day.mintemp_c'],
    avgTemp:   +d['day.avgtemp_c'],

    // --- Weather ---
    maxWind:       +d['day.maxwind_kph'],
    totalPrecip:   +d['day.totalprecip_mm'],
    avgHumidity:   +d['day.avghumidity'],
    avgVisibility: +d['day.avgvis_km'],
    condition:     d['day.condition.text'],
    conditionCode: +d['day.condition.code'],
    uv:            +d['day.uv'],

    // --- Astronomy ---
    sunrise:   d['astro.sunrise'],
    sunset:    d['astro.sunset'],
    moonPhase: d['astro.moon_phase'],

    // --- Computed ---
    dayLengthHours: computeDayLength(d['astro.sunrise'], d['astro.sunset']),
  }));

  console.log(`✅ Loaded ${_cachedData.length} weather records`);
  return _cachedData;
}

/**
 * Compute day length in hours from sunrise/sunset strings
 * @param {string} sunrise - e.g. "05:46 AM"
 * @param {string} sunset  - e.g. "06:11 PM"
 * @returns {number} Day length in decimal hours
 */
function computeDayLength(sunrise, sunset) {
  const toMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let [, h, m, period] = match;
    h = parseInt(h);
    m = parseInt(m);
    if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (period.toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  const sunriseMin = toMinutes(sunrise);
  const sunsetMin  = toMinutes(sunset);
  const diff = sunsetMin - sunriseMin;
  return diff > 0 ? +(diff / 60).toFixed(2) : 0;
}


/* ============================================================
   DATA ACCESSOR HELPERS
   ============================================================ */

/**
 * Get unique region names from cached data
 * @returns {string[]}
 */
export function getRegions() {
  if (!_cachedData) return [];
  return [...new Set(_cachedData.map(d => d.region))].sort();
}

/**
 * Get unique terrain types
 * @returns {string[]}
 */
export function getTerrains() {
  if (!_cachedData) return [];
  return [...new Set(_cachedData.map(d => d.terrain))].sort();
}

/**
 * Get unique province names
 * @returns {string[]}
 */
export function getProvinces() {
  if (!_cachedData) return [];
  return [...new Set(_cachedData.map(d => d.name))].sort();
}

/**
 * Get unique weather conditions sorted by frequency (desc)
 * @returns {Array<{condition: string, count: number}>}
 */
export function getConditions() {
  if (!_cachedData) return [];
  const counts = d3.rollup(_cachedData, v => v.length, d => d.condition);
  return Array.from(counts, ([condition, count]) => ({ condition, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get the date extent [min, max]
 * @returns {[Date, Date]}
 */
export function getDateExtent() {
  if (!_cachedData) return [new Date(), new Date()];
  return d3.extent(_cachedData, d => d.date);
}

/**
 * Filter data by criteria
 * @param {Object} filters - { region, terrain, dateRange, condition }
 * @returns {Array<Object>}
 */
export function filterData(filters = {}) {
  if (!_cachedData) return [];

  return _cachedData.filter(d => {
    if (filters.region && d.region !== filters.region) return false;
    if (filters.terrain && d.terrain !== filters.terrain) return false;
    if (filters.condition && d.condition !== filters.condition) return false;
    if (filters.dateRange) {
      const [start, end] = filters.dateRange;
      if (d.date < start || d.date > end) return false;
    }
    return true;
  });
}

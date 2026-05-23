/**
 * main.js – App initialization, page routing, global state
 * 
 * Entry point for the dashboard. Loads data, sets up navigation,
 * and orchestrates chart rendering.
 */

import { loadWeatherData, getRegions, getDateExtent } from './dataLoader.js';
import { getUvRiskLevel, formatDayLengthHours, formatTerrainLabel } from './utils.js';

// --- Chart modules ---
import * as task01 from './charts/task01-lineChart.js';
import * as task02 from './charts/task02-groupedBarChart.js';
import * as task03 from './charts/task03-radarChart.js';
import * as task04 from './charts/task04-choroplethMap.js';
import * as task05 from './charts/task05-divergingBarChart.js';
import * as task06 from './charts/task06-bubbleMap.js';
import * as task07 from './charts/task07-donutChart.js';
import * as task08 from './charts/task08-violinChart.js';
import * as task09 from './charts/task09-heatmapChart.js';
import * as task10 from './charts/task10-scatterChart.js';
import * as task11 from './charts/task11-multiLineChart.js';
import * as task12 from './charts/task12-dualAxis.js';
import * as task13 from './charts/task13-uvChoropleth.js';
import * as task14 from './charts/task14-heatRiskMap.js';
import * as task15 from './charts/task15-scatterplot.js';

/* ============================================================
   PAGE DEFINITIONS
   ============================================================ */

const PAGES = {
  temperature: {
    label: 'Nhiệt độ',
    icon: '🌡️',
    tasks: [
      { id: 'task01', module: task01, title: 'Nhiệt độ theo thời gian' },
      { id: 'task02', module: task02, title: 'So sánh nhiệt độ vùng' },
      { id: 'task03', module: task03, title: 'Phân tích thời tiết vùng' },
      
    ],
  },
  geography: {
    label: 'Địa lý',
    icon: '🗺️',
    tasks: [
      { id: 'task04', module: task04, title: 'Bản đồ nhiệt độ' },
      { id: 'task05', module: task05, title: 'Ven biển vs Nội địa' },
      { id: 'task06', module: task06, title: 'Mật độ điểm đo' },
      { id: 'task14', module: task14, title: 'Nguy cơ nắng nóng theo tỉnh' },
    ],
  },
  weather: {
    label: 'Thời tiết',
    icon: '⛅',
    tasks: [
      { id: 'task07', module: task07, title: 'Tần suất thời tiết' },
      { id: 'task08', module: task08, title: 'Nhiệt độ theo thời tiết' },
      { id: 'task09', module: task09, title: 'So sánh vùng' },
    ],
  },
  uv_dashboard: {
    label: 'UV & Thời lượng ban ngày',
    icon: '☀️',
    tasks: [
      { id: 'task13', module: task13, title: 'Bản đồ phân bố UV' },
      { id: 'task11', module: task11, title: 'Độ dài ban ngày' },
      { id: 'task12', module: task12, title: 'Phân phối rủi ro UV' },
    ],
  },
  uv_daylight: {
    label: 'UV & Ban ngày',
    icon: '☀️',
    tasks: [
      { id: 'task10', module: task10, title: 'UV vs Nhiệt độ' },
      { id: 'task15', module: task15, title: 'Ảnh hưởng của Thời lượng ban ngày' }
    ],
  },
};

/* ============================================================
   GLOBAL STATE
   ============================================================ */

const state = {
  data: [],
  currentPage: 'temperature',
  filters: {
    region: null,
    dateRange: null,
  },
};


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  showLoading(true);

  try {
    // 1. Load data
    state.data = await loadWeatherData();

    // 2. Update summary stats
    updateStats(state.data);

    // 3. Setup global filters for specific tabs
    setupGlobalFilters();

    // 4. Build navigation
    buildNavigation();

    // Setup sidebar toggle
    const btnToggle = document.getElementById('btn-toggle-sidebar');
    const appShell = document.querySelector('.app');
    if (btnToggle && appShell) {
      btnToggle.addEventListener('click', () => {
        appShell.classList.toggle('sidebar-collapsed');
        // Trigger a resize event to ensure charts readjust to new width
        setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
      });
    }

    // 5. Render initial page
    navigateTo('temperature');

    showLoading(false);
    console.log('🚀 Dashboard ready!');
  } catch (err) {
    console.error('❌ Failed to initialize:', err);
    showLoading(false);
    showError(err.message);
  }
});

// Resize debounce
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (state.currentPage) {
      renderCurrentPage();
    }
  }, 300);
});

// Global API for click-to-filter
window.updateGlobalFilter = function(key, value) {
  const select = document.getElementById(`filter-${key}`);
  if (select) {
    select.value = value;
    const event = new Event('change');
    select.dispatchEvent(event);
  }
};


/* ============================================================
   NAVIGATION
   ============================================================ */

function buildNavigation() {
  const navList = document.getElementById('nav-list');
  if (!navList) return;

  navList.innerHTML = '';

  for (const [pageKey, page] of Object.entries(PAGES)) {
    // Section title
    const section = document.createElement('li');
    section.className = 'nav-item';

    const link = document.createElement('button');
    link.className = `nav-link ${pageKey === state.currentPage ? 'nav-link--active' : ''}`;
    link.dataset.page = pageKey;
    link.innerHTML = `
      <span class="nav-link__icon">${page.icon}</span>
      <span class="nav-link__label">${page.label}</span>
      <span class="nav-link__badge">${page.tasks.length}</span>
    `;
    link.addEventListener('click', () => navigateTo(pageKey));

    section.appendChild(link);
    navList.appendChild(section);

    // Sub-items for each task
    page.tasks.forEach(task => {
      const subItem = document.createElement('li');
      subItem.className = 'nav-item';

      const subLink = document.createElement('button');
      subLink.className = 'nav-link nav-link--sub';
      subLink.dataset.task = task.id;
      subLink.innerHTML = `
        <span class="nav-link__icon" style="font-size: 0.5rem; opacity: 0.4">●</span>
        <span class="nav-link__label">${task.title}</span>
      `;
      subLink.addEventListener('click', () => {
        navigateTo(pageKey);
        scrollToChart(task.id);
      });

      subItem.appendChild(subLink);
      navList.appendChild(subItem);
    });
  }
}

function navigateTo(pageKey) {
  state.currentPage = pageKey;

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('nav-link--active', link.dataset.page === pageKey);
  });

  // Show/hide pages
  document.querySelectorAll('.page-section').forEach(section => {
    section.classList.toggle('page-section--active', section.id === `page-${pageKey}`);
  });

  // Hide global stats on uv_dashboard since it has its own KPIs
  const statsRow = document.querySelector('.stats-row');
  if (statsRow) {
    statsRow.style.display = pageKey === 'uv_dashboard' ? 'none' : '';
  }

  // Initialize and render charts for this page
  const page = PAGES[pageKey];
  if (page) {
    let currentData = state.data;
    const currentFilters = pageKey === 'uv_dashboard' ? (state.filters.uv_dashboard || {}) : state.filters;

    if (pageKey === 'uv_dashboard') {
      currentData = getUvDashboardFilteredData(currentFilters);
      updateUvDashboardKpis(currentData);
    }

    page.tasks.forEach(task => {
      task.module.init();
      task.module.render(currentData, currentFilters);
    });
  }
}

/**
 * Re-render charts on the active page without re-init or nav rebuild (e.g. resize).
 */
function renderCurrentPage() {
  const page = PAGES[state.currentPage];
  if (!page) return;

  let currentData = state.data;
  const currentFilters = state.currentPage === 'uv_dashboard'
    ? (state.filters.uv_dashboard || {})
    : state.filters;

  if (state.currentPage === 'uv_dashboard') {
    currentData = getUvDashboardFilteredData(currentFilters);
    updateUvDashboardKpis(currentData);
  }

  page.tasks.forEach(task => {
    if (task.module.render) {
      task.module.render(currentData, currentFilters);
    }
  });
}

function updateUvDashboardKpis(data) {
  const valueEl = document.getElementById('kpi-max-uv-value');
  const badgeEl = document.getElementById('kpi-max-uv-badge');
  const daylightEl = document.getElementById('kpi-avg-daylight-value');
  if (!valueEl || !badgeEl || !daylightEl) return;

  if (!data?.length) {
    valueEl.textContent = '—';
    badgeEl.textContent = '';
    badgeEl.style.display = 'none';
    daylightEl.textContent = '—';
    return;
  }

  const maxUv = d3.max(data, d => d.uv);
  const avgDayLength = d3.mean(data, d => d.dayLengthHours);
  const risk = getUvRiskLevel(maxUv);

  valueEl.textContent = maxUv != null && !isNaN(maxUv) ? maxUv.toFixed(1) : '—';
  badgeEl.textContent = risk.label;
  badgeEl.style.display = 'inline';
  badgeEl.style.color = risk.color;
  badgeEl.style.background = risk.bg;
  daylightEl.textContent = formatDayLengthHours(avgDayLength);
}

function setupGlobalFilters() {
  const selectRegion = document.getElementById('filter-region');
  const selectTerrain = document.getElementById('filter-terrain');
  const selectProvince = document.getElementById('filter-province');
  const selectMonth = document.getElementById('filter-month');
  
  if (!selectRegion || !selectTerrain || !selectProvince || !selectMonth) return;

  // Initialize uv_dashboard filters state
  state.filters.uv_dashboard = {
    region: 'All',
    terrain: 'All',
    province: 'All',
    month: 'All'
  };

  // Populate Regions
  const regions = [...new Set(state.data.map(d => d.region))].sort();
  regions.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    selectRegion.appendChild(opt);
  });

  // Populate Terrains
  const terrains = [...new Set(state.data.map(d => d.terrain).filter(Boolean))].sort();
  terrains.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = formatTerrainLabel(t);
    selectTerrain.appendChild(opt);
  });

  // Populate Provinces based on Region and Terrain
  const populateProvinces = (region, terrain) => {
    const currentProv = selectProvince.value;
    selectProvince.innerHTML = '<option value="All">Tất cả tỉnh thành</option>';
    
    let provData = state.data;
    if (region && region !== 'All') {
      provData = provData.filter(d => d.region === region);
    }
    if (terrain && terrain !== 'All') {
      provData = provData.filter(d => d.terrain === terrain);
    }
    
    const provinces = [...new Set(provData.map(d => d.name))].sort();
    let found = false;
    provinces.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      selectProvince.appendChild(opt);
      if (p === currentProv) found = true;
    });
    
    if (found) {
      selectProvince.value = currentProv;
    } else {
      selectProvince.value = 'All';
    }
  };

  populateProvinces('All', 'All');

  // Populate Months dynamically from data
  // Get unique YYYY-MM
  const uniqueMonths = [...new Set(state.data.map(d => {
    if (!d.date) return null;
    const y = d.date.getFullYear();
    const m = String(d.date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }).filter(Boolean))].sort();

  uniqueMonths.forEach(ym => {
    const [year, month] = ym.split('-');
    const opt = document.createElement('option');
    opt.value = ym;
    opt.textContent = `Tháng ${parseInt(month)}/${year}`;
    selectMonth.appendChild(opt);
  });

  // Handle Changes
  const updateFilters = () => {
    state.filters.uv_dashboard.region = selectRegion.value;
    state.filters.uv_dashboard.terrain = selectTerrain.value;
    state.filters.uv_dashboard.province = selectProvince.value;
    state.filters.uv_dashboard.month = selectMonth.value;

    // Only update if we are currently on the uv_dashboard page
    if (state.currentPage === 'uv_dashboard') {
      const page = PAGES['uv_dashboard'];
      const filteredData = getUvDashboardFilteredData(state.filters.uv_dashboard);
      updateUvDashboardKpis(filteredData);

      page.tasks.forEach(task => {
        // Render with filtered data
        if (task.module.render) {
          task.module.render(filteredData, state.filters.uv_dashboard);
        }
      });
    }
  };

  selectRegion.addEventListener('change', () => {
    populateProvinces(selectRegion.value, selectTerrain.value);
    updateFilters();
  });
  selectTerrain.addEventListener('change', () => {
    populateProvinces(selectRegion.value, selectTerrain.value);
    updateFilters();
  });
  selectProvince.addEventListener('change', () => {
    // Auto-select region and terrain if province is chosen
    if (selectProvince.value !== 'All') {
      const provInfo = state.data.find(d => d.name === selectProvince.value);
      if (provInfo && selectRegion.value !== provInfo.region) {
        selectRegion.value = provInfo.region;
      }
      if (provInfo && selectTerrain.value !== provInfo.terrain) {
        selectTerrain.value = provInfo.terrain;
      }
      if (provInfo) {
        populateProvinces(provInfo.region, provInfo.terrain);
      }
    }
    updateFilters();
  });
  selectMonth.addEventListener('change', updateFilters);

  const btnReset = document.getElementById('btn-reset-filters');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      selectRegion.value = 'All';
      selectTerrain.value = 'All';
      populateProvinces('All', 'All');
      selectProvince.value = 'All';
      selectMonth.value = 'All';
      updateFilters();
    });
  }
}

function getUvDashboardFilteredData(filters = {}) {
  let filteredData = state.data;

  if (filters.region && filters.region !== 'All') {
    filteredData = filteredData.filter(d => d.region === filters.region);
  }
  if (filters.terrain && filters.terrain !== 'All') {
    filteredData = filteredData.filter(d => d.terrain === filters.terrain);
  }
  if (filters.province && filters.province !== 'All') {
    filteredData = filteredData.filter(d => d.name === filters.province);
  }
  if (filters.month && filters.month !== 'All') {
    const [targetYear, targetMonth] = filters.month.split('-').map(Number);
    filteredData = filteredData.filter(d =>
      d.date &&
      d.date.getFullYear() === targetYear &&
      d.date.getMonth() + 1 === targetMonth
    );
  }

  return filteredData;
}

function scrollToChart(taskId) {
  const el = document.getElementById(`chart-${taskId}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}


/* ============================================================
   SUMMARY STATS
   ============================================================ */

function updateStats(data) {
  const setStatValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  const avgTemp = d3.mean(data, d => d.avgTemp);
  const totalProvinces = new Set(data.map(d => d.name)).size;
  const totalDays = new Set(data.map(d => d.dateStr)).size;
  const avgHumidity = d3.mean(data, d => d.avgHumidity);

  setStatValue('stat-avg-temp', `${avgTemp.toFixed(1)}°C`);
  setStatValue('stat-provinces', totalProvinces);
  setStatValue('stat-days', totalDays);
  setStatValue('stat-humidity', `${avgHumidity.toFixed(0)}%`);
}


/* ============================================================
   UI HELPERS
   ============================================================ */

function showLoading(show) {
  const loader = document.getElementById('loading-overlay');
  if (loader) {
    if (show) {
      loader.classList.remove('fade-out');
      loader.style.display = 'flex';
    } else {
      loader.classList.add('fade-out');
      setTimeout(() => loader.style.display = 'none', 400); // Matches CSS transition duration
    }
  }
}

function showError(message) {
  const main = document.querySelector('.main');
  if (main) {
    main.innerHTML = `
      <div class="no-data" style="min-height: 60vh; flex-direction: column; gap: 1rem;">
        <span style="font-size: 3rem;">⚠️</span>
        <h2>Lỗi tải dữ liệu</h2>
        <p class="text-muted">${message}</p>
        <p class="text-muted" style="font-size: var(--fs-sm)">
          Đảm bảo file <code>datasets/df_weather_cleaned_final.csv</code> tồn tại
          và bạn đang chạy qua HTTP server.
        </p>
      </div>`;
  }
}

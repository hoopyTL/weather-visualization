/**
 * main.js – App initialization, page routing, global state
 * 
 * Entry point for the dashboard. Loads data, sets up navigation,
 * and orchestrates chart rendering.
 */

import { loadWeatherData, getRegions, getDateExtent } from './dataLoader.js';

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
import * as task12 from './charts/task12-bubbleScatter.js';
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
  uv_daylight: {
    label: 'UV & Ban ngày',
    icon: '☀️',
    tasks: [
      { id: 'task10', module: task10, title: 'UV vs Nhiệt độ' },
      { id: 'task11', module: task11, title: 'Độ dài ban ngày' },
      { id: 'task12', module: task12, title: 'Ban ngày vs UV' },
      { id: 'task13', module: task13, title: 'Bản đồ phân bố UV' },
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

    // 3. Build navigation
    buildNavigation();

    // 4. Render initial page
    navigateTo('temperature');

    showLoading(false);
    console.log('🚀 Dashboard ready!');
  } catch (err) {
    console.error('❌ Failed to initialize:', err);
    showError(err.message);
  }
});


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

  // Initialize and render charts for this page
  const page = PAGES[pageKey];
  if (page) {
    page.tasks.forEach(task => {
      task.module.init();
      task.module.render(state.data, state.filters);
    });
  }
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
  if (loader) loader.style.display = show ? 'flex' : 'none';
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

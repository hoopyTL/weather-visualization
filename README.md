# 🌤️ Vietnam Weather Dashboard

> **CSC10108 – Trực quan hóa dữ liệu**  
> Trường Đại học Khoa học Tự nhiên – ĐHQG TP.HCM

Interactive D3.js dashboard visualizing weather data across **63 Vietnamese provinces**, covering temperature, precipitation, UV index, and daylight patterns over 14 months (Apr 2024 – Jun 2025).

![D3.js](https://img.shields.io/badge/D3.js-v7-orange)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 📋 Table of Contents

- [Features](#-features)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Dataset](#-dataset)
- [Task List](#-task-list)
- [Team Workflow](#-team-workflow)
- [Tech Stack](#-tech-stack)

---

## ✨ Features

- **12 interactive visualizations** (line, bar, radar, choropleth, scatter, donut, heatmap, box plot, area, bubble map)
- **Hover tooltips** & **click interactions** on all charts
- **Smooth transitions** when switching filters or data views
- **Dark theme** dashboard with responsive layout
- **No build tools** required – pure ES modules served over HTTP

---

## 📁 Project Structure

```
weather-visualization/
├── index.html                  # Main entry – dashboard layout & navigation
├── datasets/
│   └── df_weather_fixed_utf8.csv   # Weather data (not tracked by git)
├── css/
│   ├── main.css                # Design system (variables, typography, cards)
│   ├── layout.css              # Grid layout, sidebar, responsive breakpoints
│   └── charts.css              # Chart-specific styles (tooltip, axes, legend)
├── js/
│   ├── main.js                 # App init, page routing, global state
│   ├── dataLoader.js           # CSV loading, parsing, data preprocessing
│   ├── utils.js                # Shared helpers (color scales, formatters)
│   ├── charts/                 # One module per task (easy to split work)
│   │   ├── task01-lineChart.js
│   │   ├── task02-groupedBarChart.js
│   │   ├── task03-radarChart.js
│   │   ├── task04-choroplethMap.js
│   │   ├── task05-divergingBarChart.js
│   │   ├── task06-bubbleMap.js
│   │   ├── task07-donutChart.js
│   │   ├── task08-violinChart.js
│   │   ├── task09-heatmapChart.js
│   │   ├── task10-scatterChart.js
│   │   ├── task11-multiLineChart.js
│   │   ├── task12-bubbleScatter.js
│   │   └── task13-uvChoropleth.js
│   └── components/             # Reusable UI components
│       ├── tooltip.js
│       ├── legend.js
│       └── filters.js
├── assets/
│   └── vietnam-provinces.json  # GeoJSON for choropleth map
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- A modern browser (Chrome / Firefox / Edge)
- Python 3.x (for local HTTP server) **or** VS Code Live Server extension

### 1. Clone the repo

```bash
git clone <repo-url>
cd weather-visualization
```

### 2. Download the dataset

Download `df_weather_cleaned_final.csv` from the shared drive / Kaggle and place it in:

```
datasets/df_weather_cleaned_final.csv
```

> ⚠️ The CSV is **not tracked by git** (it's ~7 MB). Each team member downloads it separately.

### 3. Start a local server

```bash
# Option A: Python
python3 -m http.server 8000

# Option B: VS Code Live Server
# Right-click index.html → "Open with Live Server"
```

### 4. Open the dashboard

Navigate to [http://localhost:8000](http://localhost:8000) in your browser.

---

## 📊 Dataset

| Property | Value |
|---|---|
| **File** | `df_weather_cleaned_final.csv` |
| **Source** | Kaggle – Weather API dataset (Vietnamese localization, cleaned) |
| **Records** | ~25,831 rows |
| **Provinces** | 63 |
| **Regions** | 6 (ĐBSH, TD&MNBB, BTB&DHMT, Tây Nguyên, ĐNB, ĐBSCL) |
| **Terrain types** | 3 (ven biển, đồng bằng, miền núi) |
| **Date range** | 2024-04-21 → 2025-06-04 |
| **Key columns** | avgtemp_c, maxtemp_c, mintemp_c, maxwind_kph, totalprecip_mm, avghumidity, condition.text, uv, sunrise, sunset |

---

## 📝 Task List

| # | Task | Chart Type | Status |
|---|---|---|---|
| 1 | Nhiệt độ theo thời gian | Multi-line chart | ⬜ |
| 2 | So sánh nhiệt độ giữa các vùng | Grouped bar chart | ⬜ |
| 3 | Phân tích thời tiết theo vùng | Radar chart | ⬜ |
| 4 | Bản đồ nhiệt độ trung bình | Choropleth map | ⬜ |
| 5 | So sánh ven biển & nội địa | Diverging bar chart | ⬜ |
| 6 | Mật độ điểm đo theo khu vực | Bubble map | ⬜ |
| 7 | Tần suất trạng thái thời tiết | Donut chart | ⬜ |
| 8 | Nhiệt độ theo trạng thái thời tiết | Box plot | ⬜ |
| 9 | So sánh thời tiết giữa các vùng | Heatmap | ⬜ |
| 10 | Chỉ số UV và nhiệt độ | Scatter plot | ⬜ |
| 11 | Độ dài ban ngày | Multi-line chart | ⬜ |
| 12 | Ban ngày dài ảnh hưởng UV? | Bubble scatter | ⬜ |
| 13 | Bản đồ phân bố UV | Choropleth map | ⬜ |

### Mandatory Requirements

- [x] D3.js v6+ (using v7)
- [ ] ≥ 2 biểu đồ tương tác (hover, tooltip, filter, highlight)
- [ ] ≥ 1 biểu đồ có transition khi đổi filter

---

## 👥 Team Workflow

### Branch strategy

```
main              ← stable, merged code
├── feat/task01   ← Member A
├── feat/task02   ← Member A
├── feat/task07   ← Member B
├── feat/task08   ← Member B
└── ...
```

### How to work on a task

1. Create your branch: `git checkout -b feat/task01`
2. Edit **only** your file: `js/charts/task01-lineChart.js`
3. Use shared imports:
   ```js
   import { createSvg, regionColor, formatTemp } from '../utils.js';
   import { Tooltip } from '../components/tooltip.js';
   ```
4. Implement `init()` and `render(data, options)` functions
5. Test locally, then push & create a Pull Request

### Rules

- ❌ Don't modify `main.js`, `dataLoader.js`, or `utils.js` without team agreement
- ✅ Each task file is **independent** – no conflicts if everyone stays in their lane
- ✅ Use shared components (`Tooltip`, `Legend`, `filters`) for consistency

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| [D3.js](https://d3js.org/) | v7.9 | Data visualization |
| [TopoJSON](https://github.com/topojson/topojson) | v3 | Map data compression |
| Vanilla CSS | — | Styling (custom properties) |
| ES Modules | — | Code organization |
| Python HTTP Server | 3.x | Local development |

---

## 📄 License

This project is for educational purposes at HCMUS.

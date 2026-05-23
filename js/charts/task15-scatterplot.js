/**
 * Task 15 – Scatter Plot Đa biến: Ảnh hưởng của Thời lượng ban ngày
 *
 * X: dayLengthHours | Y: avgTemp | Kích thước (Radius): avgHumidity | Màu sắc: region
 * Tương tác: Thêm đường Trendline tổng thể và Trendline cho từng vùng khi Isolate.
 *
 * @module task15-dayLengthChart
 */

import {
  createSvg,
  getMargin,
  getDimensions,
  REGION_COLORS,
  regionColor,
  regionShort,
  sanitizeKey,
  formatTemp,
  formatPercent,
} from "../utils.js";
import { Tooltip } from "../components/tooltip.js";
import { filterData } from "../dataLoader.js";

const CONTAINER = "#chart-task15";

// ==========================================
// BIẾN TOÀN CỤC
// ==========================================
let isInitialized = false;
let svg,
  xAxisGroup,
  yAxisGroup,
  dotsGroup,
  trendLineGroup,
  legendGroup,
  tooltip;
let dims, margin;
let xScale, yScale, rScale;
let activeRegion = null;

const formatHours = (h) => `${h.toFixed(1)} giờ`;

function computeDayLength(sunrise, sunset) {
  if (!sunrise || !sunset) return 0;
  const parseTime = (timeStr) => {
    const [time, period] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return hours + minutes / 60;
  };
  return parseTime(sunset) - parseTime(sunrise);
}

// 📈 Hàm tính Hồi quy tuyến tính (Linear Regression)
function calcLinearRegression(dataset) {
  const n = dataset.length;
  if (n < 2) return null;

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (let d of dataset) {
    sumX += d.dayLengthHours;
    sumY += d.avgTemp;
    sumXY += d.dayLengthHours * d.avgTemp;
    sumXX += d.dayLengthHours * d.dayLengthHours;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const xMin = d3.min(dataset, (d) => d.dayLengthHours);
  const xMax = d3.max(dataset, (d) => d.dayLengthHours);

  return {
    x1: xMin,
    y1: slope * xMin + intercept,
    x2: xMax,
    y2: slope * xMax + intercept,
  };
}

// ==========================================
// 1. HÀM INIT (KHỞI TẠO KHUNG)
// ==========================================
export function init() {
  console.log("☀️ Task 15 – Day Length Analysis initialized");

  margin = { ...getMargin("md"), top: 50, right: 120, bottom: 60, left: 60 };
  dims = getDimensions(CONTAINER, margin);

  if (dims.width === 0) return;

  svg = createSvg(CONTAINER, dims.width, dims.height, margin);
  tooltip = new Tooltip();

  xAxisGroup = svg
    .append("g")
    .attr("transform", `translate(0,${dims.innerHeight})`);
  yAxisGroup = svg.append("g");

  // 🚀 SỬA LỖI ĐÂY: Đưa dotsGroup lên trước, trendLineGroup xuống sau!
  dotsGroup = svg.append("g").attr("class", "all-dots"); // Chấm vẽ trước (nằm dưới)
  trendLineGroup = svg.append("g").attr("class", "trend-line-layer"); // Trendline vẽ sau (nổi lên trên)

  legendGroup = svg
    .append("g")
    .attr("transform", `translate(${dims.innerWidth + 20}, 20)`);

  xScale = d3.scaleLinear().range([0, dims.innerWidth]);
  yScale = d3.scaleLinear().range([dims.innerHeight, 0]);
  rScale = d3.scaleSqrt().range([2, 12]);

  svg
    .append("text")
    .attr("x", dims.innerWidth / 2)
    .attr("y", dims.innerHeight + 45)
    .attr("fill", "#333")
    .style("text-anchor", "middle")
    .style("font-weight", "bold")
    .text("Thời lượng ban ngày (Giờ)");
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -dims.innerHeight / 2)
    .attr("y", -40)
    .attr("fill", "#333")
    .style("text-anchor", "middle")
    .style("font-weight", "bold")
    .text("Nhiệt độ trung bình (°C)");
  svg
    .append("text")
    .attr("x", dims.innerWidth / 2)
    .attr("y", -20)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .attr("fill", "#333")
    .text("Ảnh hưởng của Thời lượng ban ngày đến Nhiệt độ");

  const regions = Object.keys(REGION_COLORS);
  const legendItems = legendGroup
    .selectAll(".legend-item")
    .data(regions)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * 25})`)
    .style("cursor", "pointer");

  legendItems
    .append("circle")
    .attr("r", 6)
    .style("fill", (d) => regionColor(d));
  legendItems
    .append("text")
    .attr("x", 12)
    .attr("y", 4)
    .style("font-size", "11px")
    .style("fill", "#333")
    .text((d) => regionShort(d));

  svg.on("click", (event) => {
    if (event.target && event.target.tagName === "svg") {
      activeRegion = null;
      updateHighlightAndTrend();
    }
  });

  isInitialized = true;
}

// ==========================================
// 2. HÀM RENDER
// ==========================================
export function render(data, options = {}) {
  try {
    if (!xScale) {
      init();
      if (!xScale) return;
    }

    let rawData = filterData(options.filters);

    let filteredData = rawData.filter((d) => {
      if (d && d.dayLengthHours === undefined) {
        d.dayLengthHours = computeDayLength(d.sunrise, d.sunset);
      }
      return (
        d &&
        d.region &&
        d.dayLengthHours > 0 &&
        !isNaN(d.dayLengthHours) &&
        d.avgTemp != null &&
        !isNaN(d.avgTemp) &&
        d.avgHumidity != null &&
        !isNaN(d.avgHumidity)
      );
    });

    if (!filteredData.length) return;

    if (options?.filters?.region !== undefined) {
      activeRegion = options.filters.region || null;
    }

    xScale
      .domain([
        d3.min(filteredData, (d) => d.dayLengthHours) - 0.2,
        d3.max(filteredData, (d) => d.dayLengthHours) + 0.2,
      ])
      .nice();
    yScale
      .domain([
        d3.min(filteredData, (d) => d.avgTemp) - 2,
        d3.max(filteredData, (d) => d.avgTemp) + 2,
      ])
      .nice();
    rScale.domain([0, 100]);

    xAxisGroup
      .transition()
      .duration(500)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .style("fill", "#333");
    yAxisGroup
      .transition()
      .duration(500)
      .call(d3.axisLeft(yScale))
      .selectAll("text")
      .style("fill", "#333");
    svg.selectAll(".domain, .tick line").attr("stroke", "#333");

    const dots = dotsGroup
      .selectAll(".dot")
      .data(filteredData, (d) => `${d.name}-${d.dateStr}`)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", (d) => `dot dot-${sanitizeKey(d.region)}`)
            .attr("cx", (d) => xScale(d.dayLengthHours))
            .attr("cy", (d) => yScale(d.avgTemp))
            .attr("r", (d) => rScale(d.avgHumidity))
            .style("fill", (d) => regionColor(d.region))
            .style("opacity", 0.6)
            .attr("shape-rendering", "optimizeSpeed"),
        (update) =>
          update
            .attr("cx", (d) => xScale(d.dayLengthHours))
            .attr("cy", (d) => yScale(d.avgTemp))
            .attr("r", (d) => rScale(d.avgHumidity)),
        (exit) => exit.remove(),
      );

    // =========================================================
    // 🚀 HÀM XỬ LÝ CÔ LẬP VÙNG VÀ VẼ TRENDLINE (MỚI)
    // =========================================================
    function updateHighlightAndTrend() {
      // 1. Xử lý chấm mờ/rõ
      dotsGroup
        .selectAll(".dot")
        .style("pointer-events", (d) =>
          !activeRegion || d.region === activeRegion ? "all" : "none",
        )
        .style("opacity", (d) => {
          if (!activeRegion) return 0.6;
          return d.region === activeRegion ? 0.9 : 0;
        })
        .style("stroke", (d) =>
          activeRegion && d.region === activeRegion ? "#fff" : "none",
        )
        .style("stroke-width", (d) =>
          activeRegion && d.region === activeRegion ? 0.5 : 0,
        );

      legendGroup
        .selectAll("text")
        .transition()
        .duration(400)
        .style("opacity", (d) =>
          !activeRegion || d === activeRegion ? 1 : 0.4,
        )
        .style("font-weight", (d) => (d === activeRegion ? "bold" : "normal"));

      // 2. Tính toán và vẽ Trendline
      const trendData = activeRegion
        ? filteredData.filter((d) => d.region === activeRegion)
        : filteredData;
      const lineCoords = calcLinearRegression(trendData);

      trendLineGroup
        .selectAll(".trend-line")
        .data(lineCoords ? [lineCoords] : [])
        .join(
          (enter) =>
            enter
              .append("line")
              .attr("class", "trend-line")
              .attr("stroke-width", 3)
              .style("stroke-dasharray", "8, 6") // Đường đứt nét dễ nhìn
              .style("opacity", 0)
              .attr("x1", (d) => xScale(d.x1))
              .attr("y1", (d) => yScale(d.y1))
              .attr("x2", (d) => xScale(d.x2))
              .attr("y2", (d) => yScale(d.y2)),
          (update) => update,
          (exit) =>
            exit.transition().duration(300).style("opacity", 0).remove(),
        )
        .transition()
        .duration(500)
        .style("opacity", 0.9)
        .attr("stroke", activeRegion ? "#333" : "#ff4757") // Đỏ nổi bật nếu tổng thể, màu vùng nếu đang isolate
        .attr("x1", (d) => xScale(d.x1))
        .attr("y1", (d) => yScale(d.y1))
        .attr("x2", (d) => xScale(d.x2))
        .attr("y2", (d) => yScale(d.y2));
    }

    updateHighlightAndTrend();

    // ==========================================
    // GẮN SỰ KIỆN TƯƠNG TÁC
    // ==========================================
    legendGroup
      .selectAll(".legend-item")
      .on("mouseover", function (event, region) {
        if (activeRegion === region) return;
        dotsGroup
          .selectAll(".dot")
          .style("opacity", (d) => (d.region === region ? 0.9 : 0));
      })
      .on("mouseleave", () => {
        updateHighlightAndTrend();
      })
      .on("click", function (event, region) {
        event.stopPropagation();
        activeRegion = activeRegion === region ? null : region;
        updateHighlightAndTrend();
      });

    dots
      .on("mouseover", function (event, d) {
        dotsGroup.selectAll(".dot").style("opacity", (p) => {
          if (activeRegion && p.region !== activeRegion) return 0;
          return 0.15;
        });

        d3.select(this)
          .raise()
          .transition()
          .duration(150)
          .attr("r", rScale(d.avgHumidity) + 3)
          .style("opacity", 1)
          .style("stroke", "#333")
          .style("stroke-width", 1.5);

        const html = Tooltip.buildHTML(d.name, [
          {
            label: "Vùng",
            value: regionShort(d.region),
            color: regionColor(d.region),
          },
          { label: "Ngày", value: d.dateStr },
          { label: "Trạng thái", value: d.condition },
          { label: "Thời lượng ngày", value: formatHours(d.dayLengthHours) },
          { label: "Nhiệt độ", value: formatTemp(d.avgTemp) },
          { label: "Độ ẩm", value: formatPercent(d.avgHumidity) },
        ]);
        tooltip.show(event, html);
      })
      .on("mousemove", (event) => tooltip.show(event, tooltip.el.html()))
      .on("mouseleave", function (event, d) {
        d3.select(this)
          .style("stroke", activeRegion ? "#fff" : "none")
          .style("stroke-width", activeRegion ? 0.5 : 0)
          .attr("r", rScale(d.avgHumidity));

        updateHighlightAndTrend();
        tooltip.hide();
      });
  } catch (err) {
    console.error("💥 Lỗi tại Task 15:", err);
  }
}

/**
 * Task 10 – Scatter Plot: Chỉ số UV và nhiệt độ
 *
 * Chart: Scatter plot with trend line
 * X: avgtemp_c | Y: uv | Color: region
 * Interactions: hover tooltip, brush selection, region filter
 *
 * @module task10-scatterChart
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
  formatUV,
} from "../utils.js";
import { Tooltip } from "../components/tooltip.js";
import { filterData } from "../dataLoader.js";

const CONTAINER = "#chart-task10";

// ==========================================
// BIẾN TOÀN CỤC
// ==========================================
let svg,
  xAxisGroup,
  yAxisGroup,
  dotsGroup,
  trendLineGroup,
  legendGroup,
  tooltip;
let dims, margin;
let xScale, yScale;
let activeRegion = null;

// Hàm tính hồi quy tuyến tính
function calcLinearRegression(dataset) {
  const n = dataset.length;
  if (n < 2) return null;

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (let d of dataset) {
    sumX += d.avgTemp;
    sumY += d.uv;
    sumXY += d.avgTemp * d.uv;
    sumXX += d.avgTemp * d.avgTemp;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const xMin = d3.min(dataset, (d) => d.avgTemp);
  const xMax = d3.max(dataset, (d) => d.avgTemp);

  return {
    x1: xMin,
    y1: slope * xMin + intercept,
    x2: xMax,
    y2: slope * xMax + intercept,
  };
}

export function init() {
  console.log("📊 Task 10 – Scatter Plot initialized");

  margin = { ...getMargin("md"), top: 50, right: 120, bottom: 60, left: 60 };
  dims = getDimensions(CONTAINER, margin);

  if (dims.width === 0) return;

  svg = createSvg(CONTAINER, dims.width, dims.height, margin);
  tooltip = new Tooltip();

  xAxisGroup = svg
    .append("g")
    .attr("transform", `translate(0,${dims.innerHeight})`);
  yAxisGroup = svg.append("g");
  trendLineGroup = svg.append("g").attr("class", "trend-line-layer");
  dotsGroup = svg.append("g").attr("class", "all-dots");
  legendGroup = svg
    .append("g")
    .attr("transform", `translate(${dims.innerWidth + 20}, 20)`);

  xScale = d3.scaleLinear().range([0, dims.innerWidth]);
  yScale = d3.scaleLinear().range([dims.innerHeight, 0]);

  svg
    .append("text")
    .attr("x", dims.innerWidth / 2)
    .attr("y", dims.innerHeight + 45)
    .attr("fill", "#333")
    .style("text-anchor", "middle")
    .style("font-weight", "bold")
    .text("Nhiệt độ trung bình (°C)");
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -dims.innerHeight / 2)
    .attr("y", -40)
    .attr("fill", "#333")
    .style("text-anchor", "middle")
    .style("font-weight", "bold")
    .text("Chỉ số UV");
  svg
    .append("text")
    .attr("x", dims.innerWidth / 2)
    .attr("y", -20)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .attr("fill", "#333")
    .text("Tương quan giữa Nhiệt độ và Chỉ số UV");

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
      dotsGroup
        .selectAll(".dot")
        .style("opacity", 0.7)
        .attr("r", 5)
        .style("pointer-events", "all");
      legendGroup
        .selectAll("text")
        .style("opacity", 1)
        .style("font-weight", "normal");
    }
  });
}

export function render(data, options = {}) {
  try {
    let rawData = filterData(options.filters);

    let filteredData = rawData.filter(
      (d) =>
        d &&
        d.region &&
        d.avgTemp != null &&
        !isNaN(d.avgTemp) &&
        d.uv != null &&
        !isNaN(d.uv),
    );

    if (!filteredData.length) return;

    if (options?.filters?.region !== undefined) {
      activeRegion = options.filters.region || null;
    }

    // Cập nhật Domain cho Trục (Tính toán trên 100% dữ liệu)
    xScale.domain([0, d3.max(filteredData, (d) => d.avgTemp)]).nice();
    yScale.domain([0, d3.max(filteredData, (d) => d.uv)]).nice();

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
            .attr("r", 5)
            .attr("cx", (d) => xScale(d.avgTemp))
            .attr("cy", (d) => yScale(d.uv))
            .style("fill", (d) => regionColor(d.region))
            .style("opacity", 0.7)
            .attr("shape-rendering", "optimizeSpeed"),
        (update) =>
          update
            .attr("cx", (d) => xScale(d.avgTemp))
            .attr("cy", (d) => yScale(d.uv)),
        (exit) => exit.remove(),
      );

    function updateHighlightAndTrend() {
      dotsGroup
        .selectAll(".dot")
        .style("pointer-events", (d) =>
          !activeRegion || d.region === activeRegion ? "all" : "none",
        )
        .style("opacity", (d) => {
          if (!activeRegion) return 0.7;
          return d.region === activeRegion ? 0.9 : 0; // Tàng hình hoàn toàn
        })
        .attr("r", (d) => (activeRegion && d.region === activeRegion ? 6 : 5));

      legendGroup
        .selectAll("text")
        .transition()
        .duration(400)
        .style("opacity", (d) =>
          !activeRegion || d === activeRegion ? 1 : 0.4,
        )
        .style("font-weight", (d) => (d === activeRegion ? "bold" : "normal"));

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
              .style("stroke-dasharray", "6, 6")
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
        .attr("stroke", activeRegion ? regionColor(activeRegion) : "#ff6b6b")
        .attr("x1", (d) => xScale(d.x1))
        .attr("y1", (d) => yScale(d.y1))
        .attr("x2", (d) => xScale(d.x2))
        .attr("y2", (d) => yScale(d.y2));
    }

    updateHighlightAndTrend();

    // ---------------------------------------------------------
    // GẮN SỰ KIỆN TƯƠNG TÁC
    // ---------------------------------------------------------
    legendGroup
      .selectAll(".legend-item")
      .on("mouseover", function (event, region) {
        if (activeRegion === region) return;
        dotsGroup
          .selectAll(".dot")
          .style("opacity", (d) => (d.region === region ? 0.9 : 0));
      })
      .on("mouseleave", function () {
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
          return 0.15; // Mờ đi tức thì
        });
        d3.select(this)
          .raise()
          .transition()
          .duration(200)
          .attr("r", 8)
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
          { label: "Thời tiết", value: d.condition },
          { label: "Nhiệt độ", value: formatTemp(d.avgTemp) },
          { label: "Chỉ số UV", value: formatUV(d.uv) },
        ]);
        tooltip.show(event, html);
      })
      .on("mousemove", (event) => tooltip.show(event, tooltip.el.html()))
      .on("mouseleave", function () {
        d3.select(this).style("stroke", "none");
        updateHighlightAndTrend();
        tooltip.hide();
      });

    svg.on("click", (event) => {
      if (event.target && event.target.tagName === "svg") {
        activeRegion = null;
        updateHighlightAndTrend();
      }
    });
  } catch (err) {
    console.error("💥 Lỗi tại Task 10:", err);
  }
}

/**
 * Task 08 – Box/Violin Plot: Nhiệt độ theo trạng thái thời tiết
 *
 * Chart: Box plot (or violin)
 * X: condition.text (top 8) | Y: avgtemp_c
 * Interactions: hover stats tooltip, click to isolate
 *
 * @module task08-violinChart
 */

import { createSvg, getMargin, getDimensions, formatTemp } from "../utils.js";
import { Tooltip } from "../components/tooltip.js";
import { filterData } from "../dataLoader.js";

// Nếu dự án của bạn dùng NPM, bạn import d3 như sau:
// import * as d3 from "d3";

const CONTAINER = "#chart-task08";

export function init() {
  console.log("📊 Task 08 – Box Plot initialized");
}

// Giả sử bạn đã import Tooltip class vào file này
// import { Tooltip } from './path-to-tooltip';

export function render(data, options = {}) {
  // 1. Dọn dẹp bản vẽ cũ
  const container = d3.select(CONTAINER);
  container.selectAll("*").remove();

  let filteredData = filterData(options.filters);

  // 2. Thiết lập không gian
  const margin = { top: 30, right: 30, bottom: 135, left: 50 };
  const width = 600 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // ==========================================
  // KHỞI TẠO TOOLTIP TỪ CLASS CỦA BẠN
  // ==========================================
  const tooltip = new Tooltip();

  // ==========================================
  // TÍNH TOÁN THỐNG KÊ
  // ==========================================
  const sumstat = Array.from(
    d3.group(filteredData, (d) => d.condition),
    ([key, values]) => {
      const sortedTemp = values.map((d) => d.avgTemp).sort(d3.ascending);
      return {
        key: key,
        q1: d3.quantile(sortedTemp, 0.25),
        median: d3.quantile(sortedTemp, 0.5),
        q3: d3.quantile(sortedTemp, 0.75),
        min: sortedTemp[0],
        max: sortedTemp[sortedTemp.length - 1],
      };
    },
  );

  // ==========================================
  // THIẾT LẬP SCALES VÀ TRỤC
  // ==========================================
  const x = d3
    .scaleBand()
    .domain(sumstat.map((d) => d.key))
    .range([0, width])
    .padding(0.3);

  const y = d3
    .scaleLinear()
    .domain([
      d3.min(sumstat, (d) => d.min) - 3,
      d3.max(sumstat, (d) => d.max) + 3,
    ])
    .range([height, 0]);

  // Trục X
  svg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#333")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end")
    .attr("dx", "-0.5em")
    .attr("dy", "0.2em");

  // Trục Y
  svg
    .append("g")
    .call(d3.axisLeft(y))
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#333");

  // Đổi màu đường trục sang màu tối
  svg.selectAll(".domain, .tick line").attr("stroke", "#333");

  // ==========================================
  // VẼ BOX PLOT (Groups)
  // ==========================================
  const boxWidth = x.bandwidth() > 50 ? 50 : x.bandwidth();
  let activeBox = null; // Lưu trạng thái click (isolate)

  const boxGroups = svg
    .selectAll(".boxGroup")
    .data(sumstat)
    .enter()
    .append("g")
    .attr("class", "boxGroup")
    .attr("transform", (d) => `translate(${x(d.key) + x.bandwidth() / 2}, 0)`)
    .style("cursor", "pointer")
    .style("transition", "opacity 0.3s ease");

  // 1. Râu
  boxGroups
    .append("line")
    .attr("x1", 0)
    .attr("x2", 0)
    .attr("y1", (d) => y(d.min))
    .attr("y2", (d) => y(d.max))
    .attr("stroke", "#333333")
    .style("stroke-width", 1.5)
    .style("stroke-dasharray", "4,4");

  // 2. Hộp
  boxGroups
    .append("rect")
    .attr("x", -boxWidth / 2)
    .attr("y", (d) => y(d.q3))
    .attr("height", (d) => y(d.q1) - y(d.q3))
    .attr("width", boxWidth)
    .attr("stroke", "#333333")
    .attr("stroke-width", 1.5)
    .style("fill", "#69b3a2")
    .style("opacity", 0.9);

  // 3. Đường Trung vị
  boxGroups
    .append("line")
    .attr("x1", -boxWidth / 2)
    .attr("x2", boxWidth / 2)
    .attr("y1", (d) => y(d.median))
    .attr("y2", (d) => y(d.median))
    .attr("stroke", "#333333")
    .style("stroke-width", 2.5);

  // ==========================================
  // GẮN SỰ KIỆN TƯƠNG TÁC CÙNG CLASS TOOLTIP
  // ==========================================

  // Hàm helper để render HTML cho tooltip dựa trên data `d`
  const getTooltipHtml = (d) => {
    return Tooltip.buildHTML(d.key, [
      { label: "Max", value: `${d.max.toFixed(1)}°C` },
      { label: "Q3", value: `${d.q3.toFixed(1)}°C` },
      { label: "Median", value: `${d.median.toFixed(1)}°C` },
      { label: "Q1", value: `${d.q1.toFixed(1)}°C` },
      { label: "Min", value: `${d.min.toFixed(1)}°C` },
    ]);
  };

  boxGroups
    .on("mouseover", function (event, d) {
      // Highlight logic
      if (!activeBox) {
        boxGroups.style("opacity", 0.3);
        d3.select(this).style("opacity", 1);
      }

      // Hiển thị tooltip
      tooltip.show(event, getTooltipHtml(d));
    })
    .on("mousemove", function (event, d) {
      // Cập nhật vị trí tooltip khi di chuyển chuột (class của bạn cần gọi show lại để update X/Y)
      tooltip.show(event, getTooltipHtml(d));
    })
    .on("mouseleave", function (event, d) {
      // Ẩn tooltip
      tooltip.hide();

      // Reset Highlight logic
      if (!activeBox) {
        boxGroups.style("opacity", 1);
      } else {
        boxGroups.style("opacity", (g) => (g.key === activeBox ? 1 : 0.15));
      }
    })
    .on("click", function (event, d) {
      // Isolate logic
      if (activeBox === d.key) {
        activeBox = null;
        boxGroups.style("opacity", 1);
      } else {
        activeBox = d.key;
        boxGroups.style("opacity", (g) => (g.key === activeBox ? 1 : 0.15));
      }
    });

  // Reset Isolate khi bấm ra ngoài nền
  svg.on("click", function (event) {
    if (event.target.tagName === "svg") {
      activeBox = null;
      boxGroups.style("opacity", 1);
    }
  });
}

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

export function render(data, options = {}) {
  // ==========================================
  // 1. DỮ LIỆU & LỌC RÁC
  // ==========================================
  // Lọc bỏ các trạng thái thời tiết rỗng/undefined gây ra khoảng trắng bên trái
  const filteredData = filterData(options.filters);

  // ==========================================
  // 2. KHÔNG GIAN & SVG (Dùng Utils)
  // ==========================================
  // Lấy margin chuẩn 'md' và ghi đè bottom/right
  const margin = {
    ...getMargin("md"),
    bottom: 145, // Chứa chữ nghiêng
    right: 15, // Tận dụng mép phải
  };

  // Lấy kích thước động từ utils
  const dims = getDimensions(CONTAINER, margin);

  // Tạo SVG siêu gọn bằng utils
  const svg = createSvg(CONTAINER, dims.width, dims.height, margin);

  // Khởi tạo Tooltip
  const tooltip = new Tooltip();

  // ==========================================
  // 3. TÍNH TOÁN THỐNG KÊ
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

  // Nếu không có dữ liệu sau khi lọc, dừng vẽ
  if (sumstat.length === 0) return;

  // ==========================================
  // 4. SCALES VÀ TRỤC
  // ==========================================
  const x = d3
    .scaleBand()
    .domain(sumstat.map((d) => d.key))
    .range([0, dims.innerWidth]) // Dùng innerWidth từ utils
    .padding(0.3);

  const y = d3
    .scaleLinear()
    .domain([
      d3.min(sumstat, (d) => d.min) - 3,
      d3.max(sumstat, (d) => d.max) + 3,
    ])
    .range([dims.innerHeight, 0]); // Dùng innerHeight từ utils

  // Vẽ trục X
  svg
    .append("g")
    .attr("transform", `translate(0, ${dims.innerHeight})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#333")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end")
    .attr("dx", "-0.5em")
    .attr("dy", "0.2em");

  // Vẽ trục Y
  svg
    .append("g")
    .call(d3.axisLeft(y))
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#333");

  // Trục tối màu
  svg.selectAll(".domain, .tick line").attr("stroke", "#333");

  // ==========================================
  // 5. VẼ BOX PLOT
  // ==========================================
  const boxWidth = Math.min(x.bandwidth(), 50); // Viết gọn lại hàm if
  let activeBox = null;

  const boxGroups = svg
    .selectAll(".boxGroup")
    .data(sumstat)
    .enter()
    .append("g")
    .attr("class", "boxGroup")
    .attr("transform", (d) => `translate(${x(d.key) + x.bandwidth() / 2}, 0)`)
    .style("cursor", "pointer")
    .style("transition", "opacity 0.3s ease");

  // Râu
  boxGroups
    .append("line")
    .attr("y1", (d) => y(d.min))
    .attr("y2", (d) => y(d.max))
    .attr("stroke", "#333333")
    .style("stroke-width", 1.5)
    .style("stroke-dasharray", "4,4");

  // Hộp
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

  // Trung vị
  boxGroups
    .append("line")
    .attr("x1", -boxWidth / 2)
    .attr("x2", boxWidth / 2)
    .attr("y1", (d) => y(d.median))
    .attr("y2", (d) => y(d.median))
    .attr("stroke", "#333333")
    .style("stroke-width", 2.5);

  // ==========================================
  // 6. INTERACTION & TOOLTIP (Dùng formatTemp)
  // ==========================================
  const getTooltipHtml = (d) => {
    return Tooltip.buildHTML(d.key, [
      { label: "Max", value: formatTemp(d.max) },
      { label: "Q3", value: formatTemp(d.q3) },
      { label: "Median", value: formatTemp(d.median) },
      { label: "Q1", value: formatTemp(d.q1) },
      { label: "Min", value: formatTemp(d.min) },
    ]);
  };

  boxGroups
    .on("mouseover", function (event, d) {
      if (!activeBox) {
        boxGroups.style("opacity", 0.3);
        d3.select(this).style("opacity", 1);
      }
      tooltip.show(event, getTooltipHtml(d));
    })
    .on("mousemove", (event, d) => tooltip.show(event, getTooltipHtml(d)))
    .on("mouseleave", () => {
      tooltip.hide();
      boxGroups.style("opacity", (g) =>
        !activeBox || g.key === activeBox ? 1 : 0.15,
      );
    })
    .on("click", (event, d) => {
      activeBox = activeBox === d.key ? null : d.key;
      boxGroups.style("opacity", (g) =>
        !activeBox || g.key === activeBox ? 1 : 0.15,
      );
    });

  // Reset Isolate khi bấm vào nền SVG
  svg.on("click", (event) => {
    if (event.target.tagName === "svg") {
      activeBox = null;
      boxGroups.style("opacity", 1);
    }
  });
}
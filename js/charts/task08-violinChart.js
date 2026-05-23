/**
 * Task 08 – Box Plot: Nhiệt độ theo trạng thái thời tiết (Gom nhóm chuẩn 5 danh mục)
 *
 * Chart: Box plot
 * X: 5 Weather Groups | Y: avgtemp_c
 * Interactions: hover stats tooltip, click to isolate
 *
 * @module task08-violinChart
 */

import { createSvg, getMargin, getDimensions, formatTemp } from "../utils.js";
import { Tooltip } from "../components/tooltip.js";
import { filterData } from "../dataLoader.js";

const CONTAINER = "#chart-task08";

// ==========================================
// BIẾN TOÀN CỤC CỦA CHART
// ==========================================
let svg, xAxisGroup, yAxisGroup, boxesGroup, tooltip;
let dims, margin;
let x, y;
let activeBox = null;

// ==========================================
// 🚀 BẢNG ÁNH XẠ GOM NHÓM THEO YÊU CẦU
// ==========================================
const getWeatherGroup = (conditionText) => {
  if (!conditionText) return "Khác";
  const text = conditionText.toLowerCase().trim();

  // 1. Heavy Rain / Storm (Mưa lớn, giông)
  if (
    text.includes("heavy rain") ||
    text.includes("thunder") ||
    text.includes("torrential") ||
    text.includes("moderate or heavy rain")
  ) {
    return "Mưa lớn, giông";
  }

  // 2. Light Rain / Drizzle (Mưa nhẹ)
  if (
    text.includes("drizzle") ||
    text.includes("light rain") ||
    text.includes("patchy rain") ||
    text.includes("moderate rain at times") ||
    text.includes("shower")
  ) {
    return "Mưa nhẹ";
  }

  // 3. Clear / Sunny (Trời quang, nắng)
  if (text.includes("sunny") || text.includes("clear")) {
    return "Trời quang, nắng";
  }

  // 4. Cloudy (Có mây)
  if (text.includes("cloudy") || text.includes("overcast")) {
    return "Có mây";
  }

  // 5. Fog / Mist (Sương mù)
  if (text.includes("fog") || text.includes("mist")) {
    return "Sương mù";
  }

  return "Khác";
};

// Hàm tính toán thống kê sau khi gom 5 nhóm
const getBoxStats = (data) => {
  const mappedData = data
    .filter(
      (d) =>
        d &&
        d.condition &&
        d.condition.trim() !== "" &&
        d.avgTemp != null &&
        !isNaN(d.avgTemp),
    )
    .map((d) => ({
      ...d,
      weatherGroup: getWeatherGroup(d.condition),
    }))
    .filter((d) => d.weatherGroup !== "Khác"); // Loại bỏ các nhóm không định nghĩa nếu có

  return Array.from(
    d3.group(mappedData, (d) => d.weatherGroup),
    ([key, vals]) => {
      const t = vals.map((d) => d.avgTemp).sort(d3.ascending);
      return {
        key,
        min: t[0],
        max: t.at(-1),
        q1: d3.quantile(t, 0.25),
        median: d3.quantile(t, 0.5),
        q3: d3.quantile(t, 0.75),
        count: vals.length,
      };
    },
  ).sort((a, b) => d3.descending(a.median, b.median)); // Sắp xếp tự động từ nóng đến lạnh dựa trên Median
};

export function init() {
  // Hạ bottom margin xuống còn 60px vì tên nhóm giờ cực kỳ gọn gàng
  margin = { ...getMargin("md"), top: 40, bottom: 60, right: 20, left: 50 };
  dims = getDimensions(CONTAINER, margin);

  if (dims.width === 0) return;

  svg = createSvg(CONTAINER, dims.width, dims.height, margin);
  tooltip = new Tooltip();

  xAxisGroup = svg
    .append("g")
    .attr("transform", `translate(0, ${dims.innerHeight})`);
  yAxisGroup = svg.append("g");
  boxesGroup = svg.append("g").attr("class", "all-boxes");

  // padding(0.5) giúp các hộp có khoảng cách rộng rãi, rất sang dòng và dễ nhìn
  x = d3.scaleBand().range([0, dims.innerWidth]).padding(0.5);
  y = d3.scaleLinear().range([dims.innerHeight, 0]);

  svg.on("click", (event) => {
    if (event.target.tagName === "svg") {
      activeBox = null;
      boxesGroup.selectAll(".boxGroup").style("opacity", 1);
    }
  });
}

export function render(data, options = {}) {
  const stats = getBoxStats(filterData(options.filters));
  if (!stats.length) return;

  x.domain(stats.map((d) => d.key));
  y.domain([
    Math.max(0, d3.min(stats, (d) => d.min) - 2),
    d3.max(stats, (d) => d.max) + 2,
  ]).nice();

  // Trục X hiển thị nằm ngang hoàn toàn (không cần xoay góc nữa vì chỉ có 5 nhóm chữ ngắn)
  xAxisGroup
    .transition()
    .duration(500)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#333")
    .style("font-weight", "bold")
    .attr("transform", "rotate(0)")
    .style("text-anchor", "middle")
    .attr("dx", "0")
    .attr("dy", "1em");

  yAxisGroup
    .transition()
    .duration(500)
    .call(d3.axisLeft(y))
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#333");

  svg.selectAll(".domain, .tick line").attr("stroke", "#333");

  const boxW = Math.min(x.bandwidth(), 55);

  const groups = boxesGroup
    .selectAll(".boxGroup")
    .data(stats, (d) => d.key)
    .join(
      (enter) => {
        const g = enter
          .append("g")
          .attr("class", "boxGroup")
          .style("cursor", "pointer")
          .attr(
            "transform",
            (d) => `translate(${x(d.key) + x.bandwidth() / 2}, 0)`,
          );

        g.append("line")
          .attr("class", "whisker")
          .attr("stroke", "#333333")
          .style("stroke-width", 1.5)
          .style("stroke-dasharray", "4,4");

        g.append("rect")
          .attr("class", "box")
          .attr("stroke", "#333333")
          .style("stroke-width", 1.5)
          .style("fill", "#69b3a2")
          .style("opacity", 0.85);

        g.append("line")
          .attr("class", "median")
          .attr("stroke", "#2c3e50")
          .style("stroke-width", 3);

        return g;
      },
      (update) => update,
      (exit) => exit.transition().duration(300).style("opacity", 0).remove(),
    );

  groups
    .transition()
    .duration(500)
    .attr("transform", (d) => `translate(${x(d.key) + x.bandwidth() / 2}, 0)`);

  groups
    .select(".whisker")
    .transition()
    .duration(500)
    .attr("x1", 0)
    .attr("x2", 0)
    .attr("y1", (d) => y(d.min))
    .attr("y2", (d) => y(d.max));

  groups
    .select(".box")
    .transition()
    .duration(500)
    .attr("x", -boxW / 2)
    .attr("y", (d) => y(d.q3))
    .attr("width", boxW)
    .attr("height", (d) => Math.max(0, y(d.q1) - y(d.q3)));

  groups
    .select(".median")
    .transition()
    .duration(500)
    .attr("x1", -boxW / 2)
    .attr("x2", boxW / 2)
    .attr("y1", (d) => y(d.median))
    .attr("y2", (d) => y(d.median));

  // ==========================================
  // TOOLTIP ĐƯỢC CHUẨN HÓA THEO NHÓM MỚI
  // ==========================================
  const getTooltipHtml = (d) =>
    Tooltip.buildHTML(d.key, [
      { label: "Tổng số mẫu", value: `${d.count} ngày` },
      { label: "Nhiệt độ Cao nhất", value: formatTemp(d.max) },
      { label: "Tứ phân vị trên (Q3)", value: formatTemp(d.q3) },
      { label: "Nhiệt độ Trung vị", value: formatTemp(d.median) },
      { label: "Tứ phân vị dưới (Q1)", value: formatTemp(d.q1) },
      { label: "Nhiệt độ Thấp nhất", value: formatTemp(d.min) },
    ]);

  groups
    .on("mouseover", function (event, d) {
      if (!activeBox) {
        groups.style("opacity", 0.25);
        d3.select(this).style("opacity", 1);
      }
      tooltip.show(event, getTooltipHtml(d));
    })
    .on("mousemove", (event, d) => {
      tooltip.show(event, getTooltipHtml(d));
    })
    .on("mouseleave", () => {
      tooltip.hide();
      groups.style("opacity", (g) =>
        !activeBox || g.key === activeBox ? 1 : 0.15,
      );
    })
    .on("click", (event, d) => {
      event.stopPropagation();
      activeBox = activeBox === d.key ? null : d.key;
      groups.style("opacity", (g) =>
        !activeBox || g.key === activeBox ? 1 : 0.15,
      );
    });
}

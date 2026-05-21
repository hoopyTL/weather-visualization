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

const CONTAINER = "#chart-task08";

// ==========================================
// BIẾN TOÀN CỤC CỦA CHART
// ==========================================
let svg, xAxisGroup, yAxisGroup, boxesGroup, tooltip;
let dims, margin;
let x, y;
let activeBox = null; // Phải để ngoài này để giữ trạng thái Isolate khi render lại

// Hàm tính toán thống kê (Min, Max, Q1, Q3, Median)
const getBoxStats = (data) =>
  Array.from(
    d3.group(
      data.filter((d) => d.condition && d.condition.trim() !== ""),
      (d) => d.condition,
    ),
    ([key, vals]) => {
      const t = vals.map((d) => d.avgTemp).sort(d3.ascending);
      return {
        key,
        min: t[0],
        max: t.at(-1),
        q1: d3.quantile(t, 0.25),
        median: d3.quantile(t, 0.5),
        q3: d3.quantile(t, 0.75),
      };
    },
  );

export function init() {
  margin = { ...getMargin("md"), bottom: 145, right: 15 };
  dims = getDimensions(CONTAINER, margin); // Thay CONTAINER bằng selector của bạn

  svg = createSvg(CONTAINER, dims.width, dims.height, margin);
  tooltip = new Tooltip();

  // Tạo sẵn các thẻ Group (g)
  xAxisGroup = svg
    .append("g")
    .attr("transform", `translate(0, ${dims.innerHeight})`);
  yAxisGroup = svg.append("g");
  boxesGroup = svg.append("g").attr("class", "all-boxes");

  // Khởi tạo Scale
  x = d3.scaleBand().range([0, dims.innerWidth]).padding(0.3);
  y = d3.scaleLinear().range([dims.innerHeight, 0]);

  // Click ra ngoài nền thì reset Isolate
  svg.on("click", (event) => {
    if (event.target.tagName === "svg") {
      activeBox = null;
      boxesGroup.selectAll(".boxGroup").style("opacity", 1);
    }
  });
}

export function render(data, options = {}) {
  // Lấy dữ liệu và tính toán
  const stats = getBoxStats(filterData(options.filters)); // Đảm bảo bạn có hàm filterData
  if (!stats.length) return;

  // Cập nhật Domain cho Scale
  x.domain(stats.map((d) => d.key));
  y.domain([d3.min(stats, (d) => d.min) - 3, d3.max(stats, (d) => d.max) + 3]);

  // Cập nhật trục X, Y với transition mượt
  xAxisGroup
    .transition()
    .duration(500)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#333")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end")
    .attr("dx", "-0.5em");

  yAxisGroup
    .transition()
    .duration(500)
    .call(d3.axisLeft(y))
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#333");

  svg.selectAll(".domain, .tick line").attr("stroke", "#333"); // Đổi màu trục

  // Vẽ các Hộp Boxplot bằng .join()
  const boxW = Math.min(x.bandwidth(), 50);

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

        // VẼ RÂU (Whisker) - Sửa màu #333
        g.append("line")
          .attr("class", "whisker")
          .attr("stroke", "#333333")
          .style("stroke-width", 1.5)
          .style("stroke-dasharray", "4,4");

        // VẼ HỘP (Box) - Sửa màu #333
        g.append("rect")
          .attr("class", "box")
          .attr("stroke", "#333333")
          .style("stroke-width", 1.5)
          .style("fill", "#69b3a2");

        // VẼ TRUNG VỊ (Median) - Sửa màu #333
        g.append("line")
          .attr("class", "median")
          .attr("stroke", "#333333")
          .style("stroke-width", 2.5);

        return g;
      },
      (update) => update,
      (exit) => exit.remove(),
    );

  // Hiệu ứng di chuyển (Transition) cho tất cả các thành phần
  groups
    .transition()
    .duration(500)
    .attr("transform", (d) => `translate(${x(d.key) + x.bandwidth() / 2}, 0)`);

  groups
    .select(".whisker")
    .transition()
    .duration(500)
    .attr("x1", 0)
    .attr("x2", 0) // Quan trọng: Đặt toạ độ X cho râu
    .attr("y1", (d) => y(d.min))
    .attr("y2", (d) => y(d.max));

  groups
    .select(".box")
    .transition()
    .duration(500)
    .attr("x", -boxW / 2)
    .attr("y", (d) => y(d.q3))
    .attr("width", boxW)
    .attr("height", (d) => Math.max(0, y(d.q1) - y(d.q3))); // Tránh lỗi chiều cao âm

  groups
    .select(".median")
    .transition()
    .duration(500)
    .attr("x1", -boxW / 2)
    .attr("x2", boxW / 2)
    .attr("y1", (d) => y(d.median))
    .attr("y2", (d) => y(d.median));

  // ==========================================
  // GẮN LẠI SỰ KIỆN TƯƠNG TÁC
  // ==========================================
  const getTooltipHtml = (d) =>
    Tooltip.buildHTML(d.key, [
      { label: "Max", value: formatTemp(d.max) },
      { label: "Q3", value: formatTemp(d.q3) },
      { label: "Median", value: formatTemp(d.median) },
      { label: "Q1", value: formatTemp(d.q1) },
      { label: "Min", value: formatTemp(d.min) },
    ]);

  groups
    .on("mouseover", function (event, d) {
      if (!activeBox) {
        groups.style("opacity", 0.3);
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
      event.stopPropagation(); // Ngăn sự kiện click truyền ra SVG nền
      activeBox = activeBox === d.key ? null : d.key;
      groups.style("opacity", (g) =>
        !activeBox || g.key === activeBox ? 1 : 0.15,
      );
    });
}

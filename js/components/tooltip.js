/**
 * tooltip.js – Shared tooltip component
 * 
 * USAGE:
 *   import { Tooltip } from '../components/tooltip.js';
 *   const tip = new Tooltip();
 *   tip.show(event, '<b>Title</b><br>Value: 25°C');
 *   tip.hide();
 */

export class Tooltip {
  constructor() {
    // Create tooltip element if it doesn't exist
    this.el = d3.select('body').select('.chart-tooltip');
    if (this.el.empty()) {
      this.el = d3.select('body')
        .append('div')
        .attr('class', 'chart-tooltip');
    }
  }

  /**
   * Show tooltip at mouse position
   * @param {MouseEvent} event
   * @param {string} html - Inner HTML content
   */
  show(event, html) {
    this.el
      .html(html)
      .classed('chart-tooltip--visible', true);

    // Position near cursor, avoid overflow
    const tipRect  = this.el.node().getBoundingClientRect();
    const padX = 16, padY = 16;

    let x = event.clientX + padX;
    let y = event.clientY + padY;

    if (x + tipRect.width > window.innerWidth) {
      x = event.clientX - tipRect.width - padX;
    }
    if (y + tipRect.height > window.innerHeight) {
      y = event.clientY - tipRect.height - padY;
    }

    this.el
      .style('left', `${x}px`)
      .style('top', `${y}px`);
  }

  /**
   * Hide tooltip
   */
  hide() {
    this.el.classed('chart-tooltip--visible', false);
  }

  /**
   * Helper: Build tooltip HTML with title and key-value rows
   * @param {string} title
   * @param {Array<{label: string, value: string, color?: string}>} rows
   * @returns {string} HTML string
   */
  static buildHTML(title, rows) {
    const rowsHTML = rows.map(r => {
      const dot = r.color
        ? `<span class="chart-tooltip__color-dot" style="background:${r.color}"></span> `
        : '';
      return `
        <div class="chart-tooltip__row">
          <span class="chart-tooltip__label">${dot}${r.label}</span>
          <span class="chart-tooltip__value">${r.value}</span>
        </div>`;
    }).join('');

    return `
      <div class="chart-tooltip__title">${title}</div>
      <div class="chart-tooltip__divider"></div>
      ${rowsHTML}
    `;
  }
}

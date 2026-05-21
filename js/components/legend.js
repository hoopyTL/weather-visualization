/**
 * legend.js – Shared legend component
 * 
 * USAGE:
 *   import { Legend } from '../components/legend.js';
 *   const legend = new Legend('#legend-container');
 *   legend.render(items, onToggle);
 */

export class Legend {
  /**
   * @param {string} selector - Container CSS selector
   */
  constructor(selector) {
    this.container = d3.select(selector);
    this.activeItems = new Set(); // track which items are active
  }

  /**
   * Render legend items
   * @param {Array<{label: string, color: string, key: string}>} items
   * @param {Function} onToggle - callback(key, isActive) when item is clicked
   * @param {Array<string>} initialActive - optional array of keys to start active
   */
  render(items, onToggle = null, initialActive = null) {
    if (initialActive !== null) {
      this.activeItems = new Set(initialActive);
    } else {
      this.activeItems = new Set(items.map(i => i.key));
    }

    const legend = this.container
      .selectAll('.chart-legend')
      .data([null])
      .join('div')
      .attr('class', 'chart-legend');

    const itemSel = legend
      .selectAll('.chart-legend__item')
      .data(items, d => d.key)
      .join('div')
      .attr('class', 'chart-legend__item')
      .on('click', (event, d) => {
        if (!onToggle) return;

        if (this.activeItems.has(d.key)) {
          this.activeItems.delete(d.key);
        } else {
          this.activeItems.add(d.key);
        }

        // Update visual state
        legend.selectAll('.chart-legend__item')
          .classed('chart-legend__item--dimmed', item => !this.activeItems.has(item.key));

        onToggle(d.key, this.activeItems.has(d.key), this.activeItems);
      });

    itemSel.selectAll('.chart-legend__swatch')
      .data(d => [d])
      .join('span')
      .attr('class', 'chart-legend__swatch')
      .style('background-color', d => d.color);

    itemSel.selectAll('.chart-legend__label')
      .data(d => [d])
      .join('span')
      .attr('class', 'chart-legend__label')
      .text(d => d.label);
  }

  /**
   * Get currently active keys
   * @returns {Set<string>}
   */
  getActive() {
    return this.activeItems;
  }
}

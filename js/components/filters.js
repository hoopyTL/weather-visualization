/**
 * filters.js – Shared dropdown and slider filter controls
 * 
 * USAGE:
 *   import { createDropdown, createDateSlider } from '../components/filters.js';
 *   createDropdown('#container', { options, label, onChange });
 */

/**
 * Create a dropdown/select filter
 * @param {string} selector - Container CSS selector
 * @param {Object} config
 * @param {string} config.id - Unique ID for the select element
 * @param {string} config.label - Label text
 * @param {Array<{value: string, text: string}>} config.options
 * @param {string} [config.defaultValue] - Default selected value
 * @param {Function} config.onChange - callback(selectedValue)
 */
export function createDropdown(selector, config) {
  const container = d3.select(selector);

  const wrapper = container.append('div')
    .attr('class', 'filter-group');

  if (config.label) {
    wrapper.append('label')
      .attr('for', config.id)
      .attr('class', 'filter-label')
      .text(config.label);
  }

  const select = wrapper.append('select')
    .attr('id', config.id)
    .attr('class', 'select')
    .on('change', function () {
      config.onChange(this.value);
    });

  // "All" option
  select.append('option')
    .attr('value', '')
    .text('Tất cả');

  // Data options
  select.selectAll('option.data-option')
    .data(config.options)
    .join('option')
    .attr('class', 'data-option')
    .attr('value', d => d.value)
    .text(d => d.text);

  if (config.defaultValue) {
    select.property('value', config.defaultValue);
  }

  return select;
}

/**
 * Create a button group filter (toggle buttons)
 * @param {string} selector
 * @param {Object} config
 * @param {string} config.id
 * @param {Array<{value: string, text: string}>} config.options
 * @param {string} config.defaultValue
 * @param {Function} config.onChange
 */
export function createButtonGroup(selector, config) {
  const container = d3.select(selector);

  const group = container.append('div')
    .attr('class', 'btn-group')
    .attr('id', config.id);

  group.selectAll('.btn')
    .data(config.options)
    .join('button')
    .attr('class', d => `btn ${d.value === config.defaultValue ? 'btn--active' : ''}`)
    .attr('data-value', d => d.value)
    .text(d => d.text)
    .on('click', function (event, d) {
      group.selectAll('.btn').classed('btn--active', false);
      d3.select(this).classed('btn--active', true);
      config.onChange(d.value);
    });

  return group;
}

import type { Formatter, FormatterOptions } from './interface.js';
import { TextFormatter } from './text.js';
import { JsonFormatter } from './json.js';
import { TableFormatter } from './table.js';

// Re-export types and classes
export type { Formatter, FormatterType, FormatterOptions } from './interface.js';
export { TextFormatter } from './text.js';
export { JsonFormatter } from './json.js';
export { TableFormatter } from './table.js';

/**
 * Create a formatter instance
 * @param options - Formatter configuration options
 * @returns Formatter instance
 */
export function createFormatter(options: FormatterOptions): Formatter {
  const { type, color = true, writer } = options;

  let formatter: Formatter;

  switch (type) {
    case 'json':
      formatter = new JsonFormatter();
      break;
    case 'table':
      formatter = new TableFormatter({ color });
      break;
    case 'text':
    default:
      formatter = new TextFormatter({ color });
      break;
  }

  if (writer) {
    formatter.setWriter(writer);
  }

  return formatter;
}

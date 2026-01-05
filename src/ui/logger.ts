import pc from 'picocolors';

export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'dim' | 'step';

/**
 * Logger utility with colored output
 */
export const logger = {
  /**
   * Log info message
   */
  info(message: string): void {
    console.log(message);
  },

  /**
   * Log success message (green)
   */
  success(message: string): void {
    console.log(pc.green(`✓ ${message}`));
  },

  /**
   * Log warning message (yellow)
   */
  warning(message: string): void {
    console.log(pc.yellow(`⚠ ${message}`));
  },

  /**
   * Log error message (red)
   */
  error(message: string): void {
    console.log(pc.red(`✗ ${message}`));
  },

  /**
   * Log dim/muted message
   */
  dim(message: string): void {
    console.log(pc.dim(message));
  },

  /**
   * Log step message with label
   */
  step(label: string, message: string): void {
    console.log(`\n${pc.cyan(`[${label}]`)} ${pc.bold(message)}`);
  },

  /**
   * Log empty line
   */
  newLine(): void {
    console.log('');
  },

  /**
   * Log divider line
   */
  divider(char: string = '─', length: number = 50): void {
    console.log(pc.dim(char.repeat(length)));
  },

  /**
   * Log banner
   */
  banner(title: string, width: number = 50): void {
    const padding = Math.max(0, width - title.length - 4);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;

    console.log('');
    console.log(pc.cyan('═'.repeat(width)));
    console.log(pc.cyan('║') + ' '.repeat(leftPad) + pc.bold(title) + ' '.repeat(rightPad) + pc.cyan('║'));
    console.log(pc.cyan('═'.repeat(width)));
    console.log('');
  },

  /**
   * Log box with content
   */
  box(lines: string[], title?: string): void {
    const maxLength = Math.max(...lines.map(l => l.length), title?.length ?? 0);
    const width = maxLength + 4;

    console.log('');
    console.log(pc.dim('┌' + '─'.repeat(width - 2) + '┐'));

    if (title) {
      const titlePad = width - title.length - 4;
      console.log(pc.dim('│') + ' ' + pc.bold(title) + ' '.repeat(titlePad) + ' ' + pc.dim('│'));
      console.log(pc.dim('├' + '─'.repeat(width - 2) + '┤'));
    }

    for (const line of lines) {
      const linePad = width - line.length - 4;
      console.log(pc.dim('│') + '  ' + line + ' '.repeat(linePad) + ' ' + pc.dim('│'));
    }

    console.log(pc.dim('└' + '─'.repeat(width - 2) + '┘'));
  },

  /**
   * Log command to be executed
   */
  command(cmd: string): void {
    console.log(pc.yellow(`$ ${cmd}`));
    console.log('');
  },

  /**
   * Log key-value pair
   */
  keyValue(key: string, value: string, keyWidth: number = 15): void {
    const paddedKey = key.padEnd(keyWidth);
    console.log(`  ${pc.cyan(paddedKey)} ${value}`);
  },

  /**
   * Log list item
   */
  listItem(item: string, indent: number = 2): void {
    console.log(' '.repeat(indent) + pc.dim('•') + ' ' + item);
  },

  /**
   * Log numbered item
   */
  numberedItem(index: number, item: string, indent: number = 2): void {
    console.log(' '.repeat(indent) + pc.dim(`${index}.`) + ' ' + item);
  },
};

/**
 * Color utilities
 */
export const colors = {
  green: pc.green,
  red: pc.red,
  yellow: pc.yellow,
  blue: pc.blue,
  cyan: pc.cyan,
  magenta: pc.magenta,
  dim: pc.dim,
  bold: pc.bold,
  reset: pc.reset,
};

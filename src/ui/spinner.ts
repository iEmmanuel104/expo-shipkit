import ora, { type Ora } from 'ora';

/**
 * Create a spinner instance
 */
export function createSpinner(text: string): Ora {
  return ora({
    text,
    color: 'cyan',
  });
}

/**
 * Run an async operation with a spinner
 */
export async function withSpinner<T>(
  text: string,
  fn: () => Promise<T>,
  options: {
    successText?: string;
    failText?: string;
  } = {}
): Promise<T> {
  const spinner = createSpinner(text).start();

  try {
    const result = await fn();
    spinner.succeed(options.successText ?? text);
    return result;
  } catch (error) {
    spinner.fail(options.failText ?? `Failed: ${text}`);
    throw error;
  }
}

/**
 * Spinner manager for multiple steps
 */
export class SpinnerManager {
  private spinner: Ora | null = null;

  /**
   * Start a new spinner
   */
  start(text: string): void {
    this.stop();
    this.spinner = createSpinner(text).start();
  }

  /**
   * Update spinner text
   */
  update(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  /**
   * Mark spinner as succeeded
   */
  succeed(text?: string): void {
    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = null;
    }
  }

  /**
   * Mark spinner as failed
   */
  fail(text?: string): void {
    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = null;
    }
  }

  /**
   * Mark spinner as warning
   */
  warn(text?: string): void {
    if (this.spinner) {
      this.spinner.warn(text);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner without status
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Check if spinner is active
   */
  isSpinning(): boolean {
    return this.spinner?.isSpinning ?? false;
  }
}

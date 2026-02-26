import { execInteractive, exec } from '../../utils/exec.js';
import { logger } from '../../ui/logger.js';
import type { PrerequisiteResult } from './checker.js';

/**
 * Auto-fix a prerequisite by running the suggested fix command.
 * All fix commands are hardcoded strings — no user input injection risk.
 */
export async function autoFix(result: PrerequisiteResult): Promise<boolean> {
  if (!result.fix || !result.autoFixable) {
    return false;
  }

  logger.step('FIX', `Fixing: ${result.name}`);
  logger.command(result.fix);

  try {
    // For interactive commands like `eas login`, use interactive mode
    if (result.fix === 'eas login') {
      const code = await execInteractive(result.fix);
      return code === 0;
    }

    // For install commands, run silently and show result
    const execResult = await exec(result.fix, { silent: true, timeout: 120000 });
    if (execResult.code === 0) {
      logger.success(`${result.name} fixed successfully`);
      return true;
    }

    logger.error(`Failed to fix ${result.name}: ${execResult.stderr.trim()}`);
    return false;
  } catch (error) {
    logger.error(`Failed to fix ${result.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Auto-fix all fixable prerequisites
 */
export async function autoFixAll(results: PrerequisiteResult[]): Promise<number> {
  const fixable = results.filter((r) => r.autoFixable && r.status !== 'pass');
  let fixed = 0;

  for (const result of fixable) {
    const success = await autoFix(result);
    if (success) {
      fixed++;
    }
  }

  return fixed;
}

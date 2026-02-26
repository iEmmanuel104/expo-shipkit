import { Command } from 'commander';
import { logger } from '../../ui/logger.js';
import { createSpinner } from '../../ui/spinner.js';
import { displayDoctorResults } from '../../ui/display.js';
import { runDoctorChecks } from '../../core/doctor/runner.js';
import type { CheckCategory } from '../../core/doctor/checks.js';

export const doctorCommand = new Command('doctor')
  .description('Check project health and configuration')
  .option('--category <category>', 'Check specific category (environment|project|credentials|security)')
  .option('--json', 'Output results as JSON')
  .action(async (options) => {
    const cwd = process.cwd();

    if (!options.json) {
      logger.banner('SHIPKIT DOCTOR', 50);
    }

    const spinner = !options.json ? createSpinner('Running health checks...').start() : null;

    try {
      const category = options.category as CheckCategory | undefined;
      const summary = await runDoctorChecks({ category, projectRoot: cwd });

      spinner?.stop();

      if (options.json) {
        console.log(JSON.stringify(summary, null, 2));
        return;
      }

      displayDoctorResults(summary);

      // Exit with error code if there are failures
      if (summary.fail > 0) {
        process.exit(1);
      }
    } catch (error) {
      spinner?.fail('Health check failed');
      logger.error(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

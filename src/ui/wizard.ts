import pc from 'picocolors';
import { logger } from './logger.js';

/**
 * Display wizard step header
 */
export function wizardStep(step: number, total: number, title: string): void {
  console.log('');
  console.log(pc.cyan(`  Step ${step}/${total}: ${pc.bold(title)}`));
  console.log(pc.dim('  ' + '─'.repeat(45)));
}

/**
 * Display a checklist item
 */
export function checklistItem(
  label: string,
  status: 'pass' | 'warn' | 'fail' | 'skip' | 'pending',
  detail?: string,
): void {
  const icons: Record<string, string> = {
    pass: pc.green('  [✓]'),
    warn: pc.yellow('  [!]'),
    fail: pc.red('  [✗]'),
    skip: pc.dim('  [-]'),
    pending: pc.dim('  [ ]'),
  };

  const icon = icons[status] ?? icons.pending;
  const text = status === 'skip' ? pc.dim(label) : label;
  const suffix = detail ? pc.dim(` (${detail})`) : '';

  console.log(`${icon} ${text}${suffix}`);
}

/**
 * Display wizard completion summary
 */
export function wizardComplete(
  projectName: string,
  filesCreated: string[],
  filesModified: string[],
  warnings: string[],
): void {
  console.log('');
  console.log(pc.green('═'.repeat(50)));
  console.log(pc.green('║') + '     ' + pc.bold(pc.green('expo-shipkit initialized!')) + '         ' + pc.green('║'));
  console.log(pc.green('═'.repeat(50)));
  console.log('');

  logger.keyValue('Project', projectName);
  console.log('');

  if (filesCreated.length > 0) {
    logger.dim('Files created:');
    for (const file of filesCreated) {
      logger.listItem(file);
    }
    console.log('');
  }

  if (filesModified.length > 0) {
    logger.dim('Files modified:');
    for (const file of filesModified) {
      logger.listItem(file);
    }
    console.log('');
  }

  if (warnings.length > 0) {
    logger.dim('Warnings:');
    for (const warning of warnings) {
      console.log(pc.yellow(`  ! ${warning}`));
    }
    console.log('');
  }

  logger.dim('Next steps:');
  logger.numberedItem(1, 'Review shipkit.config.ts and customize as needed');
  logger.numberedItem(2, 'Run "shipkit credentials setup" to configure store credentials');
  logger.numberedItem(3, 'Run "shipkit doctor" to verify your project health');
  logger.numberedItem(4, 'Run "shipkit deploy" to start deploying');
  console.log('');
}

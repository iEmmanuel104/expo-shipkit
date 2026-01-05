import pc from 'picocolors';
import type { DeploymentRecord, Profile, Platform, ConfigChange } from '../types/deployment.js';
import { formatDate } from '../core/deployment/tracker.js';
import { logger } from './logger.js';

/**
 * Display deployment status for a version
 */
export function displayVersionStatus(
  version: string,
  status: DeploymentRecord,
  isCurrent: boolean = false
): void {
  const title = isCurrent ? `v${version} (current)` : `v${version}`;

  console.log('');
  console.log(pc.dim('┌' + '─'.repeat(55) + '┐'));
  console.log(pc.dim('│') + '  ' + pc.bold(title.padEnd(52)) + pc.dim('│'));
  console.log(pc.dim('├' + '─'.repeat(55) + '┤'));

  // iOS status
  const iosPreview = status.ios.preview;
  const iosProd = status.ios.production;
  const iosPreviewIcon = iosPreview ? pc.green('✓') : pc.red('✗');
  const iosProdIcon = iosProd ? pc.green('✓') : pc.red('✗');

  console.log(pc.dim('│') + '  ' + pc.cyan('iOS') + ' '.repeat(50) + pc.dim('│'));
  console.log(pc.dim('│') + `    Preview:    ${iosPreviewIcon} ${formatDate(iosPreview).padEnd(35)}` + pc.dim('│'));
  console.log(pc.dim('│') + `    Production: ${iosProdIcon} ${formatDate(iosProd).padEnd(35)}` + pc.dim('│'));

  console.log(pc.dim('├' + '─'.repeat(55) + '┤'));

  // Android status
  const androidPreview = status.android.preview;
  const androidProd = status.android.production;
  const androidPreviewIcon = androidPreview ? pc.green('✓') : pc.red('✗');
  const androidProdIcon = androidProd ? pc.green('✓') : pc.red('✗');

  console.log(pc.dim('│') + '  ' + pc.cyan('Android') + ' '.repeat(46) + pc.dim('│'));
  console.log(pc.dim('│') + `    Preview:    ${androidPreviewIcon} ${formatDate(androidPreview).padEnd(35)}` + pc.dim('│'));
  console.log(pc.dim('│') + `    Production: ${androidProdIcon} ${formatDate(androidProd).padEnd(35)}` + pc.dim('│'));

  console.log(pc.dim('└' + '─'.repeat(55) + '┘'));
}

/**
 * Display sync warnings
 */
export function displaySyncWarnings(missingPlatforms: Platform[], profile: Profile, version: string): void {
  if (missingPlatforms.length === 0) return;

  console.log('');
  for (const platform of missingPlatforms) {
    logger.warning(`${platform} ${profile} not yet deployed for v${version}`);
  }
}

/**
 * Display config changes
 */
export function displayConfigChanges(platform: Platform, changes: ConfigChange[]): void {
  if (changes.length === 0) return;

  console.log('');
  logger.warning(`Config changes detected for ${platform}:`);
  for (const change of changes) {
    console.log(pc.yellow(`   • ${change.key}: ${change.from} → ${change.to}`));
  }
}

/**
 * Display credential status
 */
export function displayCredentialStatus(status: {
  ios: { configured: boolean; errors: string[] };
  android: { configured: boolean; errors: string[] };
}): void {
  console.log('');
  logger.banner('CREDENTIAL STATUS', 45);

  // iOS
  const iosIcon = status.ios.configured && status.ios.errors.length === 0
    ? pc.green('✓')
    : status.ios.configured
      ? pc.yellow('⚠')
      : pc.red('✗');

  console.log(`  ${pc.cyan('iOS:')} ${iosIcon} ${status.ios.configured ? 'Configured' : 'Not configured'}`);
  if (status.ios.errors.length > 0) {
    for (const error of status.ios.errors) {
      console.log(pc.dim(`       • ${error}`));
    }
  }

  console.log('');

  // Android
  const androidIcon = status.android.configured && status.android.errors.length === 0
    ? pc.green('✓')
    : status.android.configured
      ? pc.yellow('⚠')
      : pc.red('✗');

  console.log(`  ${pc.cyan('Android:')} ${androidIcon} ${status.android.configured ? 'Configured' : 'Not configured'}`);
  if (status.android.errors.length > 0) {
    for (const error of status.android.errors) {
      console.log(pc.dim(`       • ${error}`));
    }
  }

  console.log('');
}

/**
 * Display deployment complete message
 */
export function displayDeploymentComplete(
  version: string,
  platforms: Platform[],
  profile: Profile,
  didSubmit: boolean
): void {
  console.log('');
  console.log(pc.green('═'.repeat(50)));
  console.log(pc.green('║') + '      ' + pc.bold(pc.green('DEPLOYMENT COMPLETED!')) + '              ' + pc.green('║'));
  console.log(pc.green('═'.repeat(50)));
  console.log('');

  logger.keyValue('Version', version);
  logger.keyValue('Platforms', platforms.join(', '));
  logger.keyValue('Profile', profile);

  if (didSubmit) {
    console.log('');
    logger.dim('Next steps:');
    if (platforms.includes('ios')) {
      logger.listItem('iOS: Check App Store Connect for TestFlight/Review status');
    }
    if (platforms.includes('android')) {
      logger.listItem('Android: Check Google Play Console for review status');
    }
  }

  console.log('');
}

/**
 * Display deployment failed message
 */
export function displayDeploymentFailed(error: string): void {
  console.log('');
  console.log(pc.red('═'.repeat(50)));
  console.log(pc.red('║') + '         ' + pc.bold(pc.red('DEPLOYMENT FAILED')) + '              ' + pc.red('║'));
  console.log(pc.red('═'.repeat(50)));
  console.log('');
  logger.error(error);
  console.log('');
}

/**
 * Display initialization success
 */
export function displayInitSuccess(projectName: string): void {
  console.log('');
  console.log(pc.green('═'.repeat(50)));
  console.log(pc.green('║') + '     ' + pc.bold(pc.green('expo-shipkit initialized!')) + '         ' + pc.green('║'));
  console.log(pc.green('═'.repeat(50)));
  console.log('');

  logger.keyValue('Project', projectName);
  console.log('');

  logger.dim('Files created:');
  logger.listItem('shipkit.config.ts');
  logger.listItem('.deployments.json');
  console.log('');

  logger.dim('Next steps:');
  logger.numberedItem(1, 'Review shipkit.config.ts and customize as needed');
  logger.numberedItem(2, 'Run "shipkit credentials setup" to configure store credentials');
  logger.numberedItem(3, 'Run "shipkit deploy" to start deploying');
  console.log('');
}

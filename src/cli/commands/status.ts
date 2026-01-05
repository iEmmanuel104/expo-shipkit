import { Command } from 'commander';
import { logger } from '../../ui/logger.js';
import { displayVersionStatus, displaySyncWarnings, displayConfigChanges } from '../../ui/display.js';
import { loadConfig, isInitialized } from '../../core/config/loader.js';
import { DeploymentTracker } from '../../core/deployment/tracker.js';
import { VersionManager } from '../../core/version/manager.js';
import { detectConfigChanges } from '../../core/deployment/config-detector.js';
import type { Platform } from '../../types/deployment.js';

export const statusCommand = new Command('status')
  .description('Show deployment status')
  .option('-v, --version <version>', 'Show status for specific version')
  .option('--json', 'Output as JSON')
  .option('--all', 'Show all versions')
  .action(async (options) => {
    const cwd = process.cwd();

    // Check if initialized
    if (!isInitialized(cwd)) {
      logger.error('expo-shipkit is not initialized in this project.');
      logger.dim('Run "shipkit init" first.');
      process.exit(1);
    }

    const config = await loadConfig(cwd);
    const tracker = new DeploymentTracker(cwd);
    const versionManager = new VersionManager(cwd);

    const currentVersion = versionManager.getCurrentVersion();
    const allVersions = tracker.getAllVersions();

    // JSON output
    if (options.json) {
      const data = {
        currentVersion,
        versions: options.version
          ? { [options.version]: tracker.getVersionStatus(options.version) }
          : Object.fromEntries(
              allVersions.map((v) => [v, tracker.getVersionStatus(v)])
            ),
        lastConfig: tracker.getData().lastConfig,
      };
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    // Display banner
    logger.banner(config?.display?.banner ?? 'DEPLOYMENT STATUS', 50);

    // Show specific version
    if (options.version) {
      const status = tracker.getVersionStatus(options.version);
      const isCurrent = options.version === currentVersion;
      displayVersionStatus(options.version, status, isCurrent);
      return;
    }

    // Show current version
    logger.info(`Current version: ${currentVersion}`);
    const currentStatus = tracker.getVersionStatus(currentVersion);
    displayVersionStatus(currentVersion, currentStatus, true);

    // Show sync warnings for current version
    const missingPreview = tracker.getMissingPlatforms(currentVersion, 'preview');
    const missingProd = tracker.getMissingPlatforms(currentVersion, 'production');

    if (missingPreview.length > 0) {
      displaySyncWarnings(missingPreview, 'preview', currentVersion);
    }
    if (missingProd.length > 0) {
      displaySyncWarnings(missingProd, 'production', currentVersion);
    }

    // Show config changes
    const platforms: Platform[] = ['ios', 'android'];
    for (const platform of platforms) {
      const changes = detectConfigChanges(
        platform,
        tracker,
        cwd,
        config?.criticalConfig[platform]
      );
      if (changes.length > 0) {
        displayConfigChanges(platform, changes);
      }
    }

    // Show previous versions
    const previousVersions = allVersions.filter((v) => v !== currentVersion);
    const versionsToShow = options.all ? previousVersions : previousVersions.slice(0, 3);

    if (versionsToShow.length > 0) {
      logger.newLine();
      logger.dim('Previous versions:');

      for (const version of versionsToShow) {
        displayVersionStatus(version, tracker.getVersionStatus(version), false);
      }

      if (!options.all && previousVersions.length > 3) {
        logger.newLine();
        logger.dim(`... and ${previousVersions.length - 3} more. Use --all to see all versions.`);
      }
    }

    logger.newLine();
  });

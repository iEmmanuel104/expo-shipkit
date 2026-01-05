import { Command } from 'commander';
import { logger } from '../../ui/logger.js';
import { promptVersionBump } from '../../ui/prompts.js';
import { isInitialized } from '../../core/config/loader.js';
import { VersionManager } from '../../core/version/manager.js';
import type { VersionBumpType } from '../../types/deployment.js';

export const versionCommand = new Command('version')
  .description('Manage app version')
  .argument('[type]', 'Bump type: patch | minor | major')
  .option('--get', 'Get current version')
  .option('--set <version>', 'Set specific version (e.g., 1.2.3)')
  .action(async (type: string | undefined, options) => {
    const cwd = process.cwd();

    // Check if initialized (not strictly required for version, but good practice)
    if (!isInitialized(cwd)) {
      logger.warning('expo-shipkit is not initialized. Running in standalone mode.');
    }

    const versionManager = new VersionManager(cwd);

    // Get current version
    if (options.get) {
      const currentVersion = versionManager.getCurrentVersion();
      console.log(currentVersion);
      return;
    }

    // Set specific version
    if (options.set) {
      try {
        const newVersion = versionManager.setVersion(options.set);
        logger.success(`Version set to ${newVersion}`);
      } catch (error) {
        if (error instanceof Error) {
          logger.error(error.message);
        }
        process.exit(1);
      }
      return;
    }

    // Validate bump type if provided
    const validTypes = ['patch', 'minor', 'major', 'none'];
    let bumpType: VersionBumpType;

    if (type) {
      if (!validTypes.includes(type)) {
        logger.error(`Invalid version type: ${type}`);
        logger.dim('Valid types: patch, minor, major');
        process.exit(1);
      }
      bumpType = type as VersionBumpType;
    } else {
      // Interactive prompt
      bumpType = await promptVersionBump();
    }

    if (bumpType === 'none') {
      const currentVersion = versionManager.getCurrentVersion();
      logger.info(`Current version: ${currentVersion}`);
      return;
    }

    // Bump version
    const { oldVersion, newVersion } = versionManager.bump(bumpType);
    logger.success(`Version bumped: ${oldVersion} → ${newVersion}`);
  });

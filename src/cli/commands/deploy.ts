import { Command } from 'commander';
import { logger } from '../../ui/logger.js';
import {
  promptAction,
  promptVersionBump,
  promptPlatform,
  promptProfile,
  promptClearCache,
  promptConfirmation,
} from '../../ui/prompts.js';
import {
  displayVersionStatus,
  displaySyncWarnings,
  displayDeploymentComplete,
  displayDeploymentFailed,
} from '../../ui/display.js';
import { loadConfig, isInitialized, getAvailableProfiles } from '../../core/config/loader.js';
import { DeploymentTracker } from '../../core/deployment/tracker.js';
import { VersionManager } from '../../core/version/manager.js';
import { detectConfigChanges, updateTrackedConfig } from '../../core/deployment/config-detector.js';
import { runBuild } from '../../core/deployment/builder.js';
import { runSubmit } from '../../core/deployment/submitter.js';
import { execInteractive } from '../../utils/exec.js';
import type { Platform, Profile, DeployAction, VersionBumpType, DeploymentSummary } from '../../types/deployment.js';

export const deployCommand = new Command('deploy')
  .description('Start interactive deployment wizard')
  .option('--platform <platform>', 'Target platform (ios|android|all)')
  .option('--profile <profile>', 'Build profile (preview|production)')
  .option('--version-bump <type>', 'Version bump type (patch|minor|major|none)')
  .option('--skip-build', 'Submit only, skip building')
  .option('--skip-submit', 'Build only, skip submitting')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (options) => {
    const cwd = process.cwd();

    // Check if initialized
    if (!isInitialized(cwd)) {
      logger.error('expo-shipkit is not initialized in this project.');
      logger.dim('Run "shipkit init" first.');
      process.exit(1);
    }

    // Load configuration
    const config = await loadConfig(cwd);
    const tracker = new DeploymentTracker(cwd);
    const versionManager = new VersionManager(cwd);

    const currentVersion = versionManager.getCurrentVersion();
    const currentStatus = tracker.getVersionStatus(currentVersion);

    // Display current status
    logger.banner(config?.display?.banner ?? 'DEPLOYMENT', 50);

    logger.info(`Current version: ${currentVersion}`);
    displayVersionStatus(currentVersion, currentStatus, true);

    // Check for missing platform deployments
    const missingPreview = tracker.getMissingPlatforms(currentVersion, 'preview');
    const missingProd = tracker.getMissingPlatforms(currentVersion, 'production');

    if (missingPreview.length > 0) {
      displaySyncWarnings(missingPreview, 'preview', currentVersion);
    }
    if (missingProd.length > 0) {
      displaySyncWarnings(missingProd, 'production', currentVersion);
    }

    // Determine action
    let action: DeployAction;
    if (options.skipBuild && options.skipSubmit) {
      logger.error('Cannot skip both build and submit.');
      process.exit(1);
    } else if (options.skipBuild) {
      action = 'submit';
    } else if (options.skipSubmit) {
      action = 'build';
    } else {
      action = await promptAction();
    }

    const shouldBuild = action === 'build' || action === 'build+submit';
    const shouldSubmit = action === 'build+submit' || action === 'submit';

    // Determine version bump (only if building)
    let versionBump: VersionBumpType = 'none';
    let targetVersion = currentVersion;

    if (shouldBuild) {
      if (options.versionBump) {
        versionBump = options.versionBump as VersionBumpType;
      } else {
        versionBump = await promptVersionBump();
      }

      if (versionBump !== 'none') {
        targetVersion = versionManager.calculateNewVersion(currentVersion, versionBump);
      }
    }

    // Determine platform
    let platformChoice: Platform | 'all';
    if (options.platform) {
      platformChoice = options.platform as Platform | 'all';
    } else {
      platformChoice = await promptPlatform();
    }

    const platforms: Platform[] = platformChoice === 'all'
      ? ['ios', 'android']
      : [platformChoice];

    // Filter platforms based on config
    const enabledPlatforms = platforms.filter((p) => {
      if (p === 'ios' && config?.platforms.ios === false) return false;
      if (p === 'android' && config?.platforms.android === false) return false;
      return true;
    });

    if (enabledPlatforms.length === 0) {
      logger.error('No enabled platforms selected.');
      process.exit(1);
    }

    // Determine profile
    let profile: Profile;
    if (options.profile) {
      profile = options.profile as Profile;
    } else {
      const availableProfiles = getAvailableProfiles(cwd);
      profile = await promptProfile(availableProfiles.length > 0 ? availableProfiles : undefined);
    }

    // Check for config changes and determine cache clearing
    const clearCache: Record<Platform, boolean> = { ios: false, android: false };

    if (shouldBuild && config?.build.autoClearCache) {
      for (const platform of enabledPlatforms) {
        const changes = detectConfigChanges(
          platform,
          tracker,
          cwd,
          config?.criticalConfig[platform]
        );

        if (changes.length > 0) {
          clearCache[platform] = await promptClearCache(changes);
        }
      }
    }

    // Build summary
    const summary: DeploymentSummary = {
      currentVersion,
      targetVersion,
      platforms: enabledPlatforms,
      profile,
      action,
      willClearCache: Object.entries(clearCache)
        .filter(([, clear]) => clear)
        .map(([p]) => p as Platform),
    };

    // Confirm deployment
    if (!options.yes) {
      const confirmed = await promptConfirmation(summary);
      if (!confirmed) {
        logger.info('Deployment cancelled.');
        process.exit(0);
      }
    }

    // Execute deployment
    logger.banner('STARTING DEPLOYMENT', 50);

    try {
      // Run pre-build hook
      if (config?.hooks?.preBuild && shouldBuild) {
        logger.step('HOOK', 'Running pre-build hook');
        logger.command(config.hooks.preBuild);
        const code = await execInteractive(config.hooks.preBuild, { cwd });
        if (code !== 0) {
          throw new Error('Pre-build hook failed');
        }
      }

      // Bump version
      if (versionBump !== 'none') {
        logger.step('VERSION', `Bumping version: ${currentVersion} → ${targetVersion}`);
        versionManager.bump(versionBump);
        logger.success(`Version updated to ${targetVersion}`);
      }

      // Build for each platform
      for (const platform of enabledPlatforms) {
        if (shouldBuild) {
          logger.step('BUILD', `Building ${platform} (${profile})`);

          const buildCode = await runBuild({
            platform,
            profile,
            clearCache: clearCache[platform],
            config,
            projectRoot: cwd,
          });

          if (buildCode !== 0) {
            throw new Error(`Build failed for ${platform}`);
          }

          // Update deployment tracking
          tracker.updateStatus(targetVersion, platform, profile);
          logger.dim(`Deployment status updated for ${platform} ${profile}`);

          // Update config snapshot
          updateTrackedConfig(platform, tracker, cwd, config?.criticalConfig[platform]);
          logger.dim(`Config snapshot saved for ${platform}`);
        }

        // Run post-build hook
        if (config?.hooks?.postBuild && shouldBuild) {
          logger.step('HOOK', 'Running post-build hook');
          await execInteractive(config.hooks.postBuild, { cwd });
        }

        // Run pre-submit hook
        if (config?.hooks?.preSubmit && shouldSubmit) {
          logger.step('HOOK', 'Running pre-submit hook');
          await execInteractive(config.hooks.preSubmit, { cwd });
        }

        // Submit
        if (shouldSubmit) {
          logger.step('SUBMIT', `Submitting ${platform} to ${platform === 'ios' ? 'App Store Connect' : 'Google Play'}`);

          const submitCode = await runSubmit({
            platform,
            profile,
            projectRoot: cwd,
          });

          if (submitCode !== 0) {
            throw new Error(`Submit failed for ${platform}`);
          }
        }
      }

      // Run post-submit hook
      if (config?.hooks?.postSubmit && shouldSubmit) {
        logger.step('HOOK', 'Running post-submit hook');
        await execInteractive(config.hooks.postSubmit, { cwd });
      }

      // Display success
      displayDeploymentComplete(targetVersion, enabledPlatforms, profile, shouldSubmit);

      // Show final status
      const finalStatus = tracker.getVersionStatus(targetVersion);
      displayVersionStatus(targetVersion, finalStatus, true);

      // Check for remaining missing platforms
      const stillMissing = tracker.getMissingPlatforms(targetVersion, profile);
      if (stillMissing.length > 0) {
        logger.newLine();
        logger.warning(`Reminder: ${stillMissing.join(', ')} ${profile} not yet deployed for v${targetVersion}`);
        logger.dim('Run "shipkit deploy" again to deploy the missing platform.');
      }

    } catch (error) {
      displayDeploymentFailed(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

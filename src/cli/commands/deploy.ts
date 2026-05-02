import { Command } from 'commander';
import { logger } from '../../ui/logger.js';
import {
  promptAction,
  promptVersionBump,
  promptPlatform,
  promptProfile,
  promptClearCache,
  promptConfirmation,
  promptConfirm,
} from '../../ui/prompts.js';
import {
  displayVersionStatus,
  displaySyncWarnings,
  displayDeploymentComplete,
  displayDeploymentFailed,
  displaySecurityAudit,
  displayErrorSuggestions,
} from '../../ui/display.js';
import { loadConfig, isInitialized, getAvailableProfiles } from '../../core/config/loader.js';
import { DeploymentTracker } from '../../core/deployment/tracker.js';
import { VersionManager } from '../../core/version/manager.js';
import { detectConfigChanges, updateTrackedConfig } from '../../core/deployment/config-detector.js';
import { runBuild } from '../../core/deployment/builder.js';
import { runSubmit } from '../../core/deployment/submitter.js';
import { execInteractive } from '../../utils/exec.js';
import { runSecurityAudit, hasCriticalIssues } from '../../core/security/audit.js';
import { findSuggestions } from '../../core/errors/suggestions.js';
import {
  detectJsOnlyChanges,
  getCurrentCommit,
  getLatestCommitSubject,
} from '../../core/updates/change-detector.js';
import { runUpdate, resolveBranch } from '../../core/updates/publisher.js';
import { resolveRuntimeVersion } from '../../core/updates/runtime-version.js';
import { validateUpdatesSetup, partitionIssues } from '../../core/updates/validator.js';
import {
  assertUpdateBranchName,
  getUpdateMessageValidationError,
  parseDeploymentProfile,
  parseUpdatePlatform,
} from '../../core/updates/guards.js';
import { select } from '@inquirer/prompts';
import type { Platform, Profile, DeployAction, VersionBumpType, DeploymentSummary } from '../../types/deployment.js';

export const deployCommand = new Command('deploy')
  .description('Start interactive deployment wizard')
  .option('--platform <platform>', 'Target platform (ios|android|all)')
  .option('--profile <profile>', 'Build profile (development|preview|staging|production)')
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
    try {
      platformChoice = options.platform ? parseUpdatePlatform(options.platform) : await promptPlatform();
    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'Invalid platform');
      process.exit(1);
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
    try {
      if (options.profile) {
        profile = parseDeploymentProfile(options.profile);
      } else {
        const availableProfiles = getAvailableProfiles(cwd);
        profile = await promptProfile(availableProfiles.length > 0 ? availableProfiles : undefined);
        profile = parseDeploymentProfile(profile);
      }
    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'Invalid profile');
      process.exit(1);
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

    // Smart-deploy: detect JS-only changes and offer OTA path instead of rebuild
    if (
      shouldBuild &&
      config?.updates?.enabled &&
      config.updates.smartDeploy !== false &&
      !options.yes
    ) {
      const lastBuild = tracker.getLastBuild(profile);
      if (!lastBuild?.commit) {
        logger.dim(`Smart-deploy: no previous ${profile} build recorded — falling through to full build.`);
      }
      const hasPlatformCoverage = Boolean(
        lastBuild?.platforms && enabledPlatforms.every((platform) => lastBuild.platforms?.includes(platform)),
      );
      if (lastBuild?.commit && !hasPlatformCoverage) {
        logger.dim(`Smart-deploy: no previous ${profile} build recorded for ${enabledPlatforms.join('+')} — falling through to full build.`);
      }
      if (lastBuild?.commit && hasPlatformCoverage) {
        const diff = await detectJsOnlyChanges(lastBuild.commit, 'HEAD', cwd);
        if (diff.jsOnly && diff.changedFiles.length > 0) {
          logger.newLine();
          logger.info(
            `Detected ${diff.changedFiles.length} JS-only change(s) since last ${profile} build (v${lastBuild.version}).`,
          );
          logger.dim('  Files changed: ' + diff.changedFiles.slice(0, 5).join(', ') + (diff.changedFiles.length > 5 ? '…' : ''));

          const choice = await select({
            message: 'Publish an OTA update instead of a full rebuild?',
            choices: [
              { name: 'Yes — publish OTA via eas update', value: 'ota' },
              { name: 'No — proceed with full build', value: 'build' },
              { name: 'Cancel', value: 'cancel' },
            ],
            default: 'ota',
          });

          if (choice === 'cancel') {
            logger.info('Deployment cancelled.');
            process.exit(0);
          }

          if (choice === 'ota') {
            // Hand off to OTA path. Validate setup before invoking.
            const issues = validateUpdatesSetup({
              profiles: config.profiles,
              updates: config.updates,
              projectRoot: cwd,
            });
            const { errors, warnings } = partitionIssues(issues);
            for (const w of warnings) logger.warning(`${w.field}: ${w.message}`);
            if (errors.length > 0) {
              for (const e of errors) {
                logger.error(`${e.field}: ${e.message}`);
                if (e.fix) logger.dim(`  Fix: ${e.fix}`);
              }
              process.exit(1);
            }

            let branch: string;
            let message: string;
            try {
              branch = assertUpdateBranchName(resolveBranch(profile, config.updates));
              message =
                config.updates.defaultMessage === 'auto'
                  ? (await getLatestCommitSubject(cwd)) ?? `OTA update for v${currentVersion}`
                  : config.updates.defaultMessage ?? `OTA update for v${currentVersion}`;
              const messageError = getUpdateMessageValidationError(message);
              if (messageError) throw new Error(messageError);
            } catch (error) {
              logger.error(error instanceof Error ? error.message : 'Invalid OTA update options');
              process.exit(1);
            }

            try {
              if (config.hooks?.preUpdate) {
                logger.step('HOOK', 'Running pre-update hook');
                logger.command(config.hooks.preUpdate);
                const code = await execInteractive(config.hooks.preUpdate, { cwd });
                if (code !== 0) throw new Error('Pre-update hook failed');
              }

              logger.step('UPDATE', `Publishing OTA to "${branch}"`);
              const code = await runUpdate({
                profile,
                platform: enabledPlatforms.length === 2 ? 'all' : enabledPlatforms[0],
                branch,
                message,
                updates: config.updates,
                projectRoot: cwd,
              });
              if (code !== 0) throw new Error(`eas update exited with code ${code}`);

              const commit = (await getCurrentCommit(cwd)) ?? undefined;
              const runtimeVersion = resolveRuntimeVersion(cwd) ?? undefined;
              tracker.recordUpdate({
                branch,
                profile,
                platform: enabledPlatforms.length === 2 ? 'all' : enabledPlatforms[0],
                message,
                runtimeVersion,
                appVersion: currentVersion,
                commit,
                publishedAt: new Date().toISOString(),
              });

              if (config.hooks?.postUpdate) {
                logger.step('HOOK', 'Running post-update hook');
                await execInteractive(config.hooks.postUpdate, { cwd });
              }

              logger.success(`Published OTA update to "${branch}"`);
              process.exit(0);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              logger.error(`OTA publish failed: ${errorMessage}`);
              const suggestions = findSuggestions(errorMessage);
              if (suggestions.length > 0) displayErrorSuggestions(suggestions);
              process.exit(1);
            }
          }
          // 'build' path falls through to the normal flow below
        } else if (diff.indeterminate === false && diff.nativeReasons.length > 0) {
          logger.newLine();
          logger.dim('Native changes detected since last build — full rebuild required:');
          for (const r of diff.nativeReasons.slice(0, 3)) {
            logger.dim(`  • ${r}`);
          }
        }
      }
    }

    // Security pre-flight audit
    if (shouldSubmit) {
      const auditResults = await runSecurityAudit(cwd);
      const hasIssues = auditResults.some((r) => r.status !== 'pass');

      if (hasIssues) {
        logger.step('SECURITY', 'Pre-flight audit');
        displaySecurityAudit(auditResults);

        if (hasCriticalIssues(auditResults)) {
          logger.warning('Critical security issues detected.');
          const continueAnyway = await promptConfirm('Continue with deployment anyway?', false);
          if (!continueAnyway) {
            logger.info('Deployment cancelled.');
            process.exit(0);
          }
        }
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
            config: config ?? undefined,
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

          // Record last-build pointer for smart-deploy diffing on next run
          const buildCommit = (await getCurrentCommit(cwd)) ?? undefined;
          tracker.recordLastBuild(profile, targetVersion, buildCommit, platform);
        }

        // Run post-build hook
        if (config?.hooks?.postBuild && shouldBuild) {
          logger.step('HOOK', 'Running post-build hook');
          await execInteractive(config.hooks.postBuild, { cwd });
        }

        // Run pre-submit hook
        if (config?.hooks?.preSubmit && shouldSubmit) {
          logger.step('HOOK', 'Running pre-submit hook');
          const preSubmitCode = await execInteractive(config.hooks.preSubmit, { cwd });
          if (preSubmitCode !== 0) {
            throw new Error('Pre-submit hook failed');
          }
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      displayDeploymentFailed(errorMessage);

      // Show actionable suggestions
      const suggestions = findSuggestions(errorMessage);
      if (suggestions.length > 0) {
        displayErrorSuggestions(suggestions);
      }

      process.exit(1);
    }
  });

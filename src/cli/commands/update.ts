import { Command } from 'commander';
import { logger } from '../../ui/logger.js';
import { createSpinner } from '../../ui/spinner.js';
import { promptInput, promptConfirm, promptProfile, promptPlatform } from '../../ui/prompts.js';
import { displayErrorSuggestions } from '../../ui/display.js';
import { loadConfig, isInitialized, getAvailableProfiles } from '../../core/config/loader.js';
import { DeploymentTracker } from '../../core/deployment/tracker.js';
import { VersionManager } from '../../core/version/manager.js';
import {
  buildUpdateCommand,
  runUpdate,
  resolveBranch,
} from '../../core/updates/publisher.js';
import { validateUpdatesSetup, partitionIssues } from '../../core/updates/validator.js';
import {
  getCurrentCommit,
  getLatestCommitSubject,
} from '../../core/updates/change-detector.js';
import { readRuntimeVersion, resolveRuntimeVersion } from '../../core/updates/runtime-version.js';
import { setupUpdates, buildUpdatesConfigSnippet } from '../../core/updates/setup.js';
import {
  assertUpdateBranchName,
  getUpdateMessageValidationError,
  parseDeploymentProfile,
  parseRuntimeVersionPolicy,
  parseUpdatePlatform,
} from '../../core/updates/guards.js';
import { execInteractive } from '../../utils/exec.js';
import { findSuggestions } from '../../core/errors/suggestions.js';
import type { Platform, Profile } from '../../types/deployment.js';

const setupSubcommand = new Command('setup')
  .description('Configure expo-updates, runtimeVersion, and channel mapping')
  .option('--policy <policy>', 'runtimeVersion policy (appVersion|sdkVersion|fingerprint)')
  .option('--no-install', 'Skip installing expo-updates if missing')
  .option('--no-configure', 'Skip running "eas update:configure" if updates.url missing')
  .action(async (options) => {
    const cwd = process.cwd();

    if (!isInitialized(cwd)) {
      logger.error('expo-shipkit is not initialized in this project.');
      logger.dim('Run "shipkit init" first.');
      process.exit(1);
    }

    const config = await loadConfig(cwd);
    logger.banner('SHIPKIT UPDATE SETUP', 50);
    let policy: ReturnType<typeof parseRuntimeVersionPolicy> | undefined;
    try {
      policy = options.policy
        ? parseRuntimeVersionPolicy(options.policy)
        : readRuntimeVersion(cwd)
          ? undefined
          : config?.updates?.runtimeVersionPolicy;
    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'Invalid runtimeVersion policy');
      process.exit(1);
    }

    const spinner = createSpinner('Configuring OTA updates...').start();
    try {
      const result = await setupUpdates({
        profiles: config?.profiles,
        channels: config?.updates?.channels,
        runtimeVersionPolicy: policy,
        installExpoUpdates: options.install !== false,
        runEasUpdateConfigure: options.configure !== false,
        projectRoot: cwd,
      });
      spinner.succeed('OTA setup complete');

      if (result.installedExpoUpdates) logger.success('Installed expo-updates');
      if (result.appJsonChanged) logger.success('Updated app.json (runtimeVersion / updates.url)');
      if (result.easJsonChanged) logger.success('Wrote channels into eas.json');
      if (result.ranEasUpdateConfigure) logger.success('Provisioned project via eas update:configure');

      logger.newLine();
      logger.info('Channel mapping:');
      for (const [profile, branch] of Object.entries(result.channelMap)) {
        logger.listItem(`${profile} → ${branch}`);
      }

      if (result.warnings.length > 0) {
        logger.newLine();
        for (const w of result.warnings) {
          logger.warning(w);
        }
      }

      logger.newLine();
      logger.dim('Add this to your shipkit.config.ts:');
      console.log(JSON.stringify({
        updates: buildUpdatesConfigSnippet(result, policy ?? config?.updates?.runtimeVersionPolicy ?? 'appVersion'),
      }, null, 2));
      logger.newLine();
      logger.dim('Then run "shipkit update --profile preview" to publish your first OTA.');
    } catch (error) {
      spinner.fail('OTA setup failed');
      if (error instanceof Error) logger.error(error.message);
      process.exit(1);
    }
  });

export const updateCommand = new Command('update')
  .description('Publish an EAS Update (OTA) to a branch')
  .option('--platform <platform>', 'Target platform (ios|android|all)')
  .option('--profile <profile>', 'Build profile (development|preview|staging|production)')
  .option('--branch <branch>', 'Target EAS Update branch (overrides profile mapping)')
  .option('-m, --message <message>', 'Update message')
  .option('--auto-message', 'Use latest commit subject as the message')
  .option('--skip-hooks', 'Skip pre/post update hooks')
  .option('--non-interactive', 'Pass --non-interactive to eas update')
  .option('-y, --yes', 'Skip confirmation prompts')
  .addCommand(setupSubcommand)
  .action(async (options) => {
    const cwd = process.cwd();

    if (!isInitialized(cwd)) {
      logger.error('expo-shipkit is not initialized in this project.');
      logger.dim('Run "shipkit init" first.');
      process.exit(1);
    }

    const config = await loadConfig(cwd);
    if (!config?.updates?.enabled) {
      logger.error('OTA updates are not enabled in shipkit.config.ts.');
      logger.dim('Run "shipkit update setup" to enable them.');
      process.exit(1);
    }

    // Resolve profile
    let profile: Profile;
    try {
      if (options.profile) {
        profile = parseDeploymentProfile(options.profile);
      } else {
        const available = getAvailableProfiles(cwd);
        profile = await promptProfile(available.length > 0 ? available : undefined);
        profile = parseDeploymentProfile(profile);
      }
    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'Invalid profile');
      process.exit(1);
    }

    // Resolve platform
    let platform: Platform | 'all';
    try {
      platform = options.platform ? parseUpdatePlatform(options.platform) : await promptPlatform();
    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'Invalid platform');
      process.exit(1);
    }

    // Pre-flight validation for the selected profile
    const issues = validateUpdatesSetup({
      profiles: [profile],
      updates: config.updates,
      projectRoot: cwd,
    });
    const { errors, warnings } = partitionIssues(issues);
    if (warnings.length > 0) {
      logger.newLine();
      for (const w of warnings) logger.warning(`${w.field}: ${w.message}`);
    }
    if (errors.length > 0) {
      logger.newLine();
      for (const e of errors) {
        logger.error(`${e.field}: ${e.message}`);
        if (e.fix) logger.dim(`  Fix: ${e.fix}`);
      }
      process.exit(1);
    }

    // Resolve branch
    let branch: string;
    try {
      branch = assertUpdateBranchName(options.branch ?? resolveBranch(profile, config.updates));
    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'Invalid branch');
      process.exit(1);
    }
    if (options.branch) {
      const configuredBranch = resolveBranch(profile, config.updates);
      if (branch !== configuredBranch) {
        logger.warning(`Branch override "${branch}" differs from configured channel "${configuredBranch}".`);
      }
    }

    // Resolve message
    let message = options.message as string | undefined;
    if (!message && options.autoMessage) {
      message = (await getLatestCommitSubject(cwd)) ?? undefined;
    }
    if (!message && config.updates.defaultMessage === 'auto') {
      message = (await getLatestCommitSubject(cwd)) ?? undefined;
    } else if (!message && config.updates.defaultMessage) {
      message = config.updates.defaultMessage;
    }
    if (!message) {
      message = await promptInput('Update message:', 'Update');
    }
    message = message.trim();
    const messageError = getUpdateMessageValidationError(message);
    if (messageError) {
      logger.error(messageError);
      process.exit(1);
    }

    // Show summary
    const versionManager = new VersionManager(cwd);
    const currentVersion = versionManager.getCurrentVersion();
    const runtimeVersion = resolveRuntimeVersion(cwd) ?? '(unset)';

    logger.banner('OTA UPDATE SUMMARY', 50);
    logger.keyValue('App version', currentVersion);
    logger.keyValue('Runtime version', runtimeVersion);
    logger.keyValue('Profile', profile);
    logger.keyValue('Branch', branch);
    logger.keyValue('Platform', platform);
    logger.keyValue('Message', message);
    logger.newLine();

    if (!options.yes) {
      const confirmed = await promptConfirm('Publish this update?', true);
      if (!confirmed) {
        logger.info('Update cancelled.');
        process.exit(0);
      }
    }

    try {
      // Pre-update hook
      if (!options.skipHooks && config.hooks?.preUpdate) {
        logger.step('HOOK', 'Running pre-update hook');
        logger.command(config.hooks.preUpdate);
        const code = await execInteractive(config.hooks.preUpdate, { cwd });
        if (code !== 0) {
          throw new Error('Pre-update hook failed');
        }
      }

      // Show the resolved command for transparency
      const cmdString = buildUpdateCommand({
        profile,
        platform,
        branch,
        message,
        updates: config.updates,
        nonInteractive: options.nonInteractive,
        projectRoot: cwd,
      });
      logger.step('UPDATE', `Publishing to branch "${branch}"`);
      logger.command(cmdString);

      const code = await runUpdate({
        profile,
        platform,
        branch,
        message,
        updates: config.updates,
        nonInteractive: options.nonInteractive,
        projectRoot: cwd,
      });
      if (code !== 0) {
        throw new Error(`eas update exited with code ${code}`);
      }

      // Track in .deployments.json
      const tracker = new DeploymentTracker(cwd);
      const commit = (await getCurrentCommit(cwd)) ?? undefined;
      tracker.recordUpdate({
        branch,
        profile,
        platform,
        message,
        runtimeVersion: runtimeVersion === '(unset)' ? undefined : runtimeVersion,
        appVersion: currentVersion,
        commit,
        publishedAt: new Date().toISOString(),
      });

      logger.success(`Published OTA update to "${branch}"`);

      // Post-update hook
      if (!options.skipHooks && config.hooks?.postUpdate) {
        logger.step('HOOK', 'Running post-update hook');
        await execInteractive(config.hooks.postUpdate, { cwd });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Update failed: ${errorMessage}`);
      const suggestions = findSuggestions(errorMessage);
      if (suggestions.length > 0) {
        displayErrorSuggestions(suggestions);
      }
      process.exit(1);
    }
  });

import { Command } from 'commander';
import * as path from 'path';
import { logger } from '../../ui/logger.js';
import { createSpinner } from '../../ui/spinner.js';
import { promptProjectName, promptConfirm, promptBundleIdentifier, promptAndroidPackage } from '../../ui/prompts.js';
import { displayPrerequisiteResults, displayDoctorResults, displayInitSuccess } from '../../ui/display.js';
import { wizardStep, checklistItem, wizardComplete } from '../../ui/wizard.js';
import { isExpoProject, isInitialized, getProjectName, hasEasJson, loadAppJson } from '../../core/config/loader.js';
import { generateConfigContent } from '../../core/config/defaults.js';
import { DeploymentTracker } from '../../core/deployment/tracker.js';
import { writeFile, readJsonFile, writeJsonFile, fileExists, ensureDir } from '../../utils/fs.js';
import { checkAllPrerequisites, hasFailures, getAutoFixable } from '../../core/prerequisites/checker.js';
import { autoFixAll } from '../../core/prerequisites/installer.js';
import { generateEasJson, validateEasJson } from '../../core/generators/eas-json.js';
import { detectAppJsonGaps, fixAppJsonGaps, suggestBundleIdentifier, suggestAndroidPackage } from '../../core/generators/app-json.js';
import { updateGitignore } from '../../core/generators/gitignore.js';
import { generateEnvTemplate } from '../../core/generators/env-template.js';
import { validateAppleCredentials, updateAppleCredentials, getAppleSetupInstructions } from '../../core/credentials/apple.js';
import { validateGoogleCredentials, updateGoogleCredentials, getGoogleSetupInstructions } from '../../core/credentials/google.js';
import { promptInput, promptFilePath } from '../../ui/prompts.js';
import { runDoctorChecks } from '../../core/doctor/runner.js';

const TOTAL_STEPS = 8;

export const initCommand = new Command('init')
  .description('Initialize expo-shipkit in your Expo project')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('--skip-scripts', 'Skip adding npm scripts to package.json')
  .option('--quick', 'Quick init (minimal setup, v1 behavior)')
  .action(async (options) => {
    const cwd = process.cwd();

    // Check if already initialized
    if (isInitialized(cwd) && !options.force) {
      logger.error('expo-shipkit is already initialized in this project.');
      logger.dim('Use --force to reinitialize.');
      process.exit(1);
    }

    // Quick mode: run the minimal v1 init flow
    if (options.quick) {
      await runQuickInit(cwd, options);
      return;
    }

    // Full wizard mode
    await runWizardInit(cwd, options);
  });

/**
 * Quick init — minimal setup (backwards-compatible v1 behavior)
 */
async function runQuickInit(cwd: string, options: { force?: boolean; skipScripts?: boolean }): Promise<void> {
  // Check if Expo project
  const spinner = createSpinner('Detecting project...').start();

  if (!isExpoProject(cwd)) {
    spinner.fail('This does not appear to be an Expo project.');
    logger.dim('Make sure you have an app.json with an "expo" key.');
    process.exit(1);
  }

  spinner.succeed('Expo project detected');

  // Check for eas.json
  if (!hasEasJson(cwd)) {
    logger.warning('No eas.json found. You may need to run "eas build:configure" first.');
    const continueAnyway = await promptConfirm('Continue anyway?', true);
    if (!continueAnyway) {
      process.exit(0);
    }
  }

  // Get project name
  const detectedName = getProjectName(cwd);
  const projectName = await promptProjectName(detectedName ?? undefined);

  // Create configuration file
  const configSpinner = createSpinner('Creating configuration...').start();

  try {
    const configPath = path.join(cwd, 'shipkit.config.ts');
    const configContent = generateConfigContent(projectName);
    writeFile(configPath, configContent);

    const tracker = new DeploymentTracker(cwd);
    if (!tracker.exists()) {
      tracker.initialize();
    }

    configSpinner.succeed('Configuration created');

    // Add npm scripts
    if (!options.skipScripts) {
      addNpmScripts(cwd);
    }

    // Update .gitignore
    updateGitignore(cwd);

    // Display success
    displayInitSuccess(projectName);
  } catch (error) {
    configSpinner.fail('Failed to create configuration');
    if (error instanceof Error) {
      logger.error(error.message);
    }
    process.exit(1);
  }
}

/**
 * Full wizard init — guided 8-step setup
 */
async function runWizardInit(cwd: string, options: { force?: boolean; skipScripts?: boolean }): Promise<void> {
  logger.banner('SHIPKIT SETUP WIZARD', 50);
  logger.dim('  This wizard will guide you through setting up expo-shipkit.');
  logger.dim('  Press Ctrl+C at any time to cancel.\n');

  const filesCreated: string[] = [];
  const filesModified: string[] = [];
  const warnings: string[] = [];

  // ─── Step 1: Environment Check ───
  wizardStep(1, TOTAL_STEPS, 'Environment Check');

  const prereqs = await checkAllPrerequisites();
  displayPrerequisiteResults(prereqs);

  if (hasFailures(prereqs)) {
    const fixable = getAutoFixable(prereqs);
    if (fixable.length > 0) {
      const shouldFix = await promptConfirm('Auto-fix available issues?', true);
      if (shouldFix) {
        await autoFixAll(prereqs);
      }
    }

    // Re-check after fixes
    const recheck = await checkAllPrerequisites();
    if (hasFailures(recheck)) {
      logger.warning('Some prerequisites are still failing. You may encounter issues.');
      const continueAnyway = await promptConfirm('Continue anyway?', false);
      if (!continueAnyway) {
        process.exit(0);
      }
    }
  }

  // ─── Step 2: Project Analysis ───
  wizardStep(2, TOTAL_STEPS, 'Project Analysis');

  if (!isExpoProject(cwd)) {
    logger.error('This does not appear to be an Expo project.');
    logger.dim('Make sure you have an app.json with an "expo" key.');
    process.exit(1);
  }

  checklistItem('Expo project detected', 'pass');

  const appJson = loadAppJson(cwd);
  const slug = appJson?.expo?.slug ?? '';
  const detectedName = getProjectName(cwd);

  checklistItem(`Project name: ${detectedName ?? 'unknown'}`, detectedName ? 'pass' : 'warn');
  checklistItem(`Slug: ${slug || 'not set'}`, slug ? 'pass' : 'warn');

  if (hasEasJson(cwd)) {
    checklistItem('eas.json found', 'pass');
  } else {
    checklistItem('eas.json not found (will be created)', 'warn');
  }

  const projectName = await promptProjectName(detectedName ?? undefined);

  // ─── Step 3: App Configuration ───
  wizardStep(3, TOTAL_STEPS, 'App Configuration');

  const gaps = detectAppJsonGaps(cwd);
  const fixes: { bundleIdentifier?: string; androidPackage?: string; addBuildProperties?: boolean } = {};

  if (gaps.length === 0) {
    checklistItem('All app.json fields configured', 'pass');
  } else {
    for (const gap of gaps) {
      checklistItem(gap.description, gap.required ? 'fail' : 'warn');
    }

    // Prompt for missing bundle identifier
    const needsBundleId = gaps.some((g) => g.field === 'expo.ios.bundleIdentifier');
    if (needsBundleId) {
      const cleanSlug = slug || projectName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const suggestion = suggestBundleIdentifier(cleanSlug);
      fixes.bundleIdentifier = await promptBundleIdentifier(suggestion);
    }

    // Prompt for missing Android package
    const needsPackage = gaps.some((g) => g.field === 'expo.android.package');
    if (needsPackage) {
      const cleanSlug = slug || projectName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const suggestion = suggestAndroidPackage(cleanSlug);
      fixes.androidPackage = await promptAndroidPackage(fixes.bundleIdentifier ?? suggestion);
    }

    // Offer to add build properties plugin
    const needsBuildProps = gaps.some((g) => g.field.includes('expo-build-properties'));
    if (needsBuildProps) {
      fixes.addBuildProperties = await promptConfirm('Add expo-build-properties plugin with recommended defaults?', true);
    }

    // Apply fixes
    if (fixes.bundleIdentifier || fixes.androidPackage || fixes.addBuildProperties) {
      fixAppJsonGaps(fixes, cwd);
      filesModified.push('app.json');
      logger.success('app.json updated');
    }
  }

  // ─── Step 4: EAS Configuration ───
  wizardStep(4, TOTAL_STEPS, 'EAS Configuration');

  if (hasEasJson(cwd)) {
    const easWarnings = validateEasJson(cwd);
    if (easWarnings.length === 0) {
      checklistItem('eas.json is properly configured', 'pass');
    } else {
      for (const w of easWarnings) {
        checklistItem(w, 'warn');
      }
      warnings.push(...easWarnings);
    }
  } else {
    const created = generateEasJson(cwd);
    if (created) {
      checklistItem('eas.json created with default profiles', 'pass');
      filesCreated.push('eas.json');
    }
  }

  // ─── Step 5: iOS Credentials (skippable) ───
  wizardStep(5, TOTAL_STEPS, 'iOS Credentials');

  const setupIos = await promptConfirm('Configure iOS App Store credentials now?', false);
  if (setupIos) {
    logger.dim(getAppleSetupInstructions());

    const ascAppId = await promptInput('App Store Connect App ID:', undefined);
    const keyPath = await promptFilePath('Path to .p8 key file:', 'keys/AuthKey.p8');
    const issuerId = await promptInput('API Key Issuer ID:', undefined);
    const keyId = await promptInput('API Key ID:', undefined);

    if (ascAppId && keyPath && issuerId && keyId) {
      const credentials = { ascAppId, ascApiKeyPath: keyPath, ascApiIssuerId: issuerId, ascApiKeyId: keyId };
      const errors = validateAppleCredentials(credentials, cwd);

      if (errors.length === 0) {
        updateAppleCredentials(credentials, 'production', cwd);
        checklistItem('iOS credentials saved to eas.json', 'pass');
        filesModified.push('eas.json (iOS credentials)');
      } else {
        for (const err of errors) {
          checklistItem(err, 'warn');
        }
        const saveAnyway = await promptConfirm('Save credentials anyway?', true);
        if (saveAnyway) {
          updateAppleCredentials(credentials, 'production', cwd);
          filesModified.push('eas.json (iOS credentials)');
        }
      }
    }
  } else {
    checklistItem('iOS credentials skipped', 'skip');
  }

  // ─── Step 6: Android Credentials (skippable) ───
  wizardStep(6, TOTAL_STEPS, 'Android Credentials');

  const setupAndroid = await promptConfirm('Configure Android Google Play credentials now?', false);
  if (setupAndroid) {
    logger.dim(getGoogleSetupInstructions());

    const keyPath = await promptFilePath('Path to service account JSON:', 'keys/google-play-key.json');

    if (keyPath) {
      const credentials = { serviceAccountKeyPath: keyPath };
      const errors = validateGoogleCredentials(credentials, cwd);

      if (errors.length === 0) {
        updateGoogleCredentials(credentials, 'production', cwd);
        checklistItem('Android credentials saved to eas.json', 'pass');
        filesModified.push('eas.json (Android credentials)');
      } else {
        for (const err of errors) {
          checklistItem(err, 'warn');
        }
        const saveAnyway = await promptConfirm('Save credentials anyway?', true);
        if (saveAnyway) {
          updateGoogleCredentials(credentials, 'production', cwd);
          filesModified.push('eas.json (Android credentials)');
        }
      }
    }
  } else {
    checklistItem('Android credentials skipped', 'skip');
  }

  // ─── Step 7: Project Files ───
  wizardStep(7, TOTAL_STEPS, 'Project Files');

  try {
    // Generate shipkit.config.ts
    const configPath = path.join(cwd, 'shipkit.config.ts');
    const configContent = generateConfigContent(projectName);
    writeFile(configPath, configContent);
    checklistItem('shipkit.config.ts', 'pass');
    filesCreated.push('shipkit.config.ts');

    // Initialize .deployments.json
    const tracker = new DeploymentTracker(cwd);
    if (!tracker.exists()) {
      tracker.initialize();
      checklistItem('.deployments.json', 'pass');
      filesCreated.push('.deployments.json');
    } else {
      checklistItem('.deployments.json (already exists)', 'pass');
    }

    // Create keys/ directory
    const keysDir = path.join(cwd, 'keys');
    if (!fileExists(keysDir)) {
      ensureDir(keysDir);
      writeFile(path.join(keysDir, '.gitkeep'), '');
      checklistItem('keys/ directory', 'pass');
      filesCreated.push('keys/.gitkeep');
    } else {
      checklistItem('keys/ directory (already exists)', 'pass');
    }

    // Generate .env.example
    const envCreated = generateEnvTemplate(cwd);
    if (envCreated) {
      checklistItem('.env.example', 'pass');
      filesCreated.push('.env.example');
    } else {
      checklistItem('.env.example (already exists)', 'pass');
    }

    // Update .gitignore
    const gitignorePath = path.join(cwd, '.gitignore');
    if (fileExists(gitignorePath)) {
      const count = updateGitignore(cwd);
      if (count > 0) {
        checklistItem(`.gitignore (${count} patterns added)`, 'pass');
        filesModified.push('.gitignore');
      } else {
        checklistItem('.gitignore (already configured)', 'pass');
      }
    } else {
      const count = updateGitignore(cwd);
      checklistItem(`.gitignore created (${count} patterns)`, 'pass');
      filesCreated.push('.gitignore');
    }

    // Add npm scripts
    if (!options.skipScripts) {
      const added = addNpmScripts(cwd);
      if (added) {
        checklistItem('npm scripts added to package.json', 'pass');
        filesModified.push('package.json');
      }
    }
  } catch (error) {
    logger.error(`Failed to create project files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }

  // ─── Step 8: Verification ───
  wizardStep(8, TOTAL_STEPS, 'Verification');

  const verifySpinner = createSpinner('Running health checks...').start();
  const summary = await runDoctorChecks({ projectRoot: cwd });
  verifySpinner.stop();

  displayDoctorResults(summary);

  if (summary.fail > 0) {
    warnings.push(`${summary.fail} health check(s) failed — run "shipkit doctor" for details`);
  }

  // Display completion
  wizardComplete(projectName, filesCreated, filesModified, warnings);
}

/**
 * Add npm scripts to package.json
 */
function addNpmScripts(cwd: string): boolean {
  const packageJsonPath = path.join(cwd, 'package.json');
  const packageJson = readJsonFile<Record<string, unknown>>(packageJsonPath);

  if (!packageJson) return false;

  const scripts = (packageJson.scripts ?? {}) as Record<string, string>;

  const newScripts: Record<string, string> = {
    'deploy': 'shipkit deploy',
    'deploy:status': 'shipkit status',
    'deploy:doctor': 'shipkit doctor',
    'version:patch': 'shipkit version patch',
    'version:minor': 'shipkit version minor',
    'version:major': 'shipkit version major',
  };

  // Only add scripts that don't already exist
  for (const [key, value] of Object.entries(newScripts)) {
    if (!scripts[key]) {
      scripts[key] = value;
    }
  }

  packageJson.scripts = scripts;
  writeJsonFile(packageJsonPath, packageJson);

  return true;
}

import { Command } from 'commander';
import * as path from 'path';
import { logger } from '../../ui/logger.js';
import { createSpinner } from '../../ui/spinner.js';
import { promptProjectName, promptConfirm } from '../../ui/prompts.js';
import { displayInitSuccess } from '../../ui/display.js';
import { isExpoProject, isInitialized, getProjectName, hasEasJson } from '../../core/config/loader.js';
import { generateConfigContent } from '../../core/config/defaults.js';
import { DeploymentTracker } from '../../core/deployment/tracker.js';
import { writeFile, readJsonFile, writeJsonFile, fileExists } from '../../utils/fs.js';

export const initCommand = new Command('init')
  .description('Initialize expo-shipkit in your Expo project')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('--skip-scripts', 'Skip adding npm scripts to package.json')
  .action(async (options) => {
    const cwd = process.cwd();

    // Check if already initialized
    if (isInitialized(cwd) && !options.force) {
      logger.error('expo-shipkit is already initialized in this project.');
      logger.dim('Use --force to reinitialize.');
      process.exit(1);
    }

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
      // Generate shipkit.config.ts
      const configPath = path.join(cwd, 'shipkit.config.ts');
      const configContent = generateConfigContent(projectName);
      writeFile(configPath, configContent);

      // Initialize .deployments.json
      const tracker = new DeploymentTracker(cwd);
      if (!tracker.exists()) {
        tracker.initialize();
      }

      configSpinner.succeed('Configuration created');

      // Add npm scripts
      if (!options.skipScripts) {
        const scriptsSpinner = createSpinner('Adding npm scripts...').start();

        const packageJsonPath = path.join(cwd, 'package.json');
        const packageJson = readJsonFile<Record<string, unknown>>(packageJsonPath);

        if (packageJson) {
          const scripts = (packageJson.scripts ?? {}) as Record<string, string>;

          // Add shipkit scripts
          scripts['deploy'] = 'shipkit deploy';
          scripts['deploy:status'] = 'shipkit status';
          scripts['version:patch'] = 'shipkit version patch';
          scripts['version:minor'] = 'shipkit version minor';
          scripts['version:major'] = 'shipkit version major';

          packageJson.scripts = scripts;
          writeJsonFile(packageJsonPath, packageJson);

          scriptsSpinner.succeed('npm scripts added');
        } else {
          scriptsSpinner.warn('Could not update package.json');
        }
      }

      // Update .gitignore
      const gitignorePath = path.join(cwd, '.gitignore');
      if (fileExists(gitignorePath)) {
        const gitignoreSpinner = createSpinner('Updating .gitignore...').start();

        const gitignoreContent = await import('fs').then(fs =>
          fs.readFileSync(gitignorePath, 'utf8')
        );

        const additions: string[] = [];

        // Add credential files to gitignore
        if (!gitignoreContent.includes('*.p8')) {
          additions.push('# Apple API Key files');
          additions.push('*.p8');
        }

        if (!gitignoreContent.includes('*-key.json')) {
          additions.push('# Google service account keys');
          additions.push('*-key.json');
        }

        if (!gitignoreContent.includes('keys/')) {
          additions.push('# Credential keys folder');
          additions.push('keys/');
        }

        if (additions.length > 0) {
          const newContent = gitignoreContent.trimEnd() + '\n\n' + additions.join('\n') + '\n';
          writeFile(gitignorePath, newContent);
          gitignoreSpinner.succeed('.gitignore updated');
        } else {
          gitignoreSpinner.succeed('.gitignore already configured');
        }
      }

      // Display success
      displayInitSuccess(projectName);

    } catch (error) {
      configSpinner.fail('Failed to create configuration');
      if (error instanceof Error) {
        logger.error(error.message);
      }
      process.exit(1);
    }
  });

import { Command } from 'commander';
import { logger } from '../../ui/logger.js';
import { createSpinner } from '../../ui/spinner.js';
import { promptConfirm, promptInput, promptFilePath } from '../../ui/prompts.js';
import { displayCredentialStatus } from '../../ui/display.js';
import { isInitialized } from '../../core/config/loader.js';
import {
  checkAppleCredentials,
  validateAppleCredentials,
  updateAppleCredentials,
  getAppleSetupInstructions,
} from '../../core/credentials/apple.js';
import {
  checkGoogleCredentials,
  validateGoogleCredentials,
  updateGoogleCredentials,
  getGoogleSetupInstructions,
} from '../../core/credentials/google.js';
import { fileExists } from '../../utils/fs.js';
import type { Platform } from '../../types/deployment.js';

const setupCommand = new Command('setup')
  .description('Interactive credential setup')
  .option('-p, --platform <platform>', 'Platform to configure (ios|android)')
  .action(async (options) => {
    const cwd = process.cwd();

    if (!isInitialized(cwd)) {
      logger.warning('expo-shipkit is not initialized. Credentials will be saved to eas.json.');
    }

    const platforms: Platform[] = options.platform
      ? [options.platform as Platform]
      : ['ios', 'android'];

    for (const platform of platforms) {
      logger.banner(`${platform.toUpperCase()} CREDENTIALS SETUP`, 50);

      if (platform === 'ios') {
        await setupAppleCredentials(cwd);
      } else {
        await setupGoogleCredentials(cwd);
      }
    }
  });

async function setupAppleCredentials(cwd: string): Promise<void> {
  // Show instructions
  console.log(getAppleSetupInstructions());

  const hasKey = await promptConfirm('Do you have an App Store Connect API Key (.p8 file)?', false);

  if (!hasKey) {
    logger.info('Please generate an API Key following the instructions above.');
    logger.dim('Run "shipkit credentials setup --platform ios" when ready.');
    return;
  }

  // Get key file path
  const keyPath = await promptFilePath(
    'Path to .p8 key file:',
    './keys/AuthKey_XXXXX.p8'
  );

  if (!fileExists(keyPath)) {
    logger.error(`File not found: ${keyPath}`);
    logger.dim('Make sure the file exists and try again.');
    return;
  }

  // Get other credentials
  const ascAppId = await promptInput('App Store Connect App ID:');
  const ascApiKeyId = await promptInput('API Key ID (10 characters):');
  const ascApiIssuerId = await promptInput('Issuer ID (UUID format):');

  // Validate
  const spinner = createSpinner('Validating credentials...').start();

  const credentials = {
    ascAppId,
    ascApiKeyPath: keyPath,
    ascApiKeyId,
    ascApiIssuerId,
  };

  const errors = validateAppleCredentials(credentials, cwd);

  if (errors.length > 0) {
    spinner.warn('Credentials have issues:');
    for (const error of errors) {
      logger.warning(`  • ${error}`);
    }

    const saveAnyway = await promptConfirm('Save credentials anyway?', false);
    if (!saveAnyway) {
      return;
    }
  } else {
    spinner.succeed('Credentials validated');
  }

  // Save credentials
  const saveSpinner = createSpinner('Saving credentials...').start();
  try {
    updateAppleCredentials(credentials, 'production', cwd);
    saveSpinner.succeed('iOS credentials saved to eas.json');
  } catch (error) {
    saveSpinner.fail('Failed to save credentials');
    if (error instanceof Error) {
      logger.error(error.message);
    }
  }
}

async function setupGoogleCredentials(cwd: string): Promise<void> {
  // Show instructions
  console.log(getGoogleSetupInstructions());

  const hasKey = await promptConfirm('Do you have a Google Play Service Account key (.json file)?', false);

  if (!hasKey) {
    logger.info('Please create a service account following the instructions above.');
    logger.dim('Run "shipkit credentials setup --platform android" when ready.');
    return;
  }

  // Get key file path
  const keyPath = await promptFilePath(
    'Path to service account JSON key:',
    './keys/google-play-key.json'
  );

  if (!fileExists(keyPath)) {
    logger.error(`File not found: ${keyPath}`);
    logger.dim('Make sure the file exists and try again.');
    return;
  }

  // Validate
  const spinner = createSpinner('Validating credentials...').start();

  const credentials = {
    serviceAccountKeyPath: keyPath,
    track: 'internal' as const,
    releaseStatus: 'draft' as const,
  };

  const errors = validateGoogleCredentials(credentials, cwd);

  if (errors.length > 0) {
    spinner.warn('Credentials have issues:');
    for (const error of errors) {
      logger.warning(`  • ${error}`);
    }

    const saveAnyway = await promptConfirm('Save credentials anyway?', false);
    if (!saveAnyway) {
      return;
    }
  } else {
    spinner.succeed('Credentials validated');
  }

  // Save credentials
  const saveSpinner = createSpinner('Saving credentials...').start();
  try {
    updateGoogleCredentials(credentials, 'production', cwd);
    saveSpinner.succeed('Android credentials saved to eas.json');
  } catch (error) {
    saveSpinner.fail('Failed to save credentials');
    if (error instanceof Error) {
      logger.error(error.message);
    }
  }
}

const checkCommand = new Command('check')
  .description('Verify credentials are configured')
  .action(async () => {
    const cwd = process.cwd();

    const spinner = createSpinner('Checking credentials...').start();

    // Check iOS
    const appleCredentials = checkAppleCredentials(cwd);
    const appleErrors = appleCredentials
      ? validateAppleCredentials(appleCredentials, cwd)
      : ['Not configured'];

    // Check Android
    const googleCredentials = checkGoogleCredentials(cwd);
    const googleErrors = googleCredentials
      ? validateGoogleCredentials(googleCredentials, cwd)
      : ['Not configured'];

    spinner.succeed('Credential check complete');

    displayCredentialStatus({
      ios: {
        configured: appleCredentials !== null,
        errors: appleErrors,
      },
      android: {
        configured: googleCredentials !== null,
        errors: googleErrors,
      },
    });
  });

const guideCommand = new Command('guide')
  .description('Show credential setup guide')
  .option('-p, --platform <platform>', 'Platform guide (ios|android)')
  .action((options) => {
    if (!options.platform || options.platform === 'ios') {
      console.log(getAppleSetupInstructions());
    }
    if (!options.platform || options.platform === 'android') {
      console.log(getGoogleSetupInstructions());
    }
  });

export const credentialsCommand = new Command('credentials')
  .description('Manage store credentials')
  .addCommand(setupCommand)
  .addCommand(checkCommand)
  .addCommand(guideCommand);

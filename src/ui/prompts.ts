import { select, confirm, input } from '@inquirer/prompts';
import type { DeployAction, VersionBumpType, Platform, Profile, DeploymentSummary } from '../types/deployment.js';
import { colors } from './logger.js';

/**
 * Prompt for deployment action
 */
export async function promptAction(): Promise<DeployAction> {
  return select({
    message: 'What would you like to do?',
    choices: [
      {
        name: 'Build only',
        value: 'build' as DeployAction,
        description: 'Build without submitting to stores',
      },
      {
        name: 'Build and Submit',
        value: 'build+submit' as DeployAction,
        description: 'Build and submit to App Store / Google Play',
      },
      {
        name: 'Submit only',
        value: 'submit' as DeployAction,
        description: 'Submit latest build to stores',
      },
    ],
  });
}

/**
 * Prompt for version bump type
 */
export async function promptVersionBump(): Promise<VersionBumpType> {
  return select({
    message: 'Version bump type:',
    choices: [
      {
        name: 'Patch (x.x.0 → x.x.1)',
        value: 'patch' as VersionBumpType,
        description: 'Bug fixes and minor changes',
      },
      {
        name: 'Minor (x.0.x → x.1.0)',
        value: 'minor' as VersionBumpType,
        description: 'New features, backwards compatible',
      },
      {
        name: 'Major (0.x.x → 1.0.0)',
        value: 'major' as VersionBumpType,
        description: 'Breaking changes',
      },
      {
        name: 'None - Keep current version',
        value: 'none' as VersionBumpType,
        description: 'No version change',
      },
    ],
  });
}

/**
 * Prompt for platform selection
 */
export async function promptPlatform(): Promise<Platform | 'all'> {
  return select({
    message: 'Target platform:',
    choices: [
      {
        name: 'iOS',
        value: 'ios' as Platform,
        description: 'Build for iOS only',
      },
      {
        name: 'Android',
        value: 'android' as Platform,
        description: 'Build for Android only',
      },
      {
        name: 'Both platforms',
        value: 'all',
        description: 'Build for iOS and Android',
      },
    ],
  });
}

/**
 * Prompt for profile selection
 */
export async function promptProfile(availableProfiles?: string[]): Promise<Profile> {
  const profiles = availableProfiles ?? ['preview', 'production'];

  const choices = profiles.map((profile) => {
    const descriptions: Record<string, string> = {
      development: 'Development builds with debugging',
      preview: 'TestFlight / Internal Testing',
      staging: 'Staging environment',
      production: 'App Store / Google Play release',
    };

    return {
      name: profile.charAt(0).toUpperCase() + profile.slice(1),
      value: profile as Profile,
      description: descriptions[profile] ?? `${profile} profile`,
    };
  });

  return select({
    message: 'Build profile:',
    choices,
  });
}

/**
 * Prompt for cache clear confirmation
 */
export async function promptClearCache(changes: Array<{ key: string; from: unknown; to: unknown }>): Promise<boolean> {
  console.log('');
  console.log(colors.yellow('⚠ Config changes detected:'));
  for (const change of changes) {
    console.log(colors.yellow(`   • ${change.key}: ${change.from} → ${change.to}`));
  }
  console.log('');

  return confirm({
    message: 'Clear build cache to apply changes? (recommended)',
    default: true,
  });
}

/**
 * Prompt for deployment confirmation
 */
export async function promptConfirmation(summary: DeploymentSummary): Promise<boolean> {
  console.log('');
  console.log(colors.yellow('═'.repeat(50)));
  console.log(colors.bold('           DEPLOYMENT SUMMARY'));
  console.log(colors.yellow('═'.repeat(50)));
  console.log('');
  console.log(`  ${colors.cyan('Version:')}  ${summary.currentVersion} → ${colors.bold(summary.targetVersion)}`);
  console.log(`  ${colors.cyan('Platform:')} ${summary.platforms.join(', ')}`);
  console.log(`  ${colors.cyan('Profile:')}  ${summary.profile}`);
  console.log(`  ${colors.cyan('Action:')}   ${summary.action}`);

  if (summary.willClearCache.length > 0) {
    console.log(`  ${colors.cyan('Cache:')}    Will clear for ${summary.willClearCache.join(', ')}`);
  }

  console.log('');

  return confirm({
    message: 'Proceed with deployment?',
    default: true,
  });
}

/**
 * Prompt for text input
 */
export async function promptInput(message: string, defaultValue?: string): Promise<string> {
  return input({
    message,
    default: defaultValue,
  });
}

/**
 * Prompt for yes/no confirmation
 */
export async function promptConfirm(message: string, defaultValue: boolean = true): Promise<boolean> {
  return confirm({
    message,
    default: defaultValue,
  });
}

/**
 * Prompt for project name
 */
export async function promptProjectName(defaultName?: string): Promise<string> {
  return input({
    message: 'Project name:',
    default: defaultName,
    validate: (value) => {
      if (!value.trim()) {
        return 'Project name is required';
      }
      return true;
    },
  });
}

/**
 * Prompt for credential file path
 */
export async function promptFilePath(message: string, defaultPath?: string): Promise<string> {
  return input({
    message,
    default: defaultPath,
    validate: (value) => {
      if (!value.trim()) {
        return 'Path is required';
      }
      return true;
    },
  });
}

import * as path from 'path';
import { readJsonFile, fileExists } from '../../utils/fs.js';
import { readRuntimeVersion } from './runtime-version.js';
import {
  getUpdateBranchValidationError,
  isRuntimeVersionPolicy,
} from './guards.js';
import type { EasConfig, ExpoAppJson } from '../../types/eas.js';
import type { Profile } from '../../types/deployment.js';
import type { UpdatesConfig } from '../../types/config.js';
import type { RuntimeVersionValue } from './runtime-version.js';

export interface UpdatesValidationIssue {
  severity: 'error' | 'warn';
  field: string;
  message: string;
  fix?: string;
}

/**
 * Validate that the project is set up for EAS Update / OTA publishing.
 *
 * Errors block publishing. Warnings are advisory.
 */
export function validateUpdatesSetup(
  options: { profiles?: Profile[]; updates?: UpdatesConfig; projectRoot?: string } = {},
): UpdatesValidationIssue[] {
  const cwd = options.projectRoot ?? process.cwd();
  const issues: UpdatesValidationIssue[] = [];

  // 1. expo-updates installed?
  const pkgPath = path.join(cwd, 'package.json');
  if (!fileExists(pkgPath)) {
    issues.push({
      severity: 'error',
      field: 'package.json',
      message: 'package.json is missing',
      fix: 'Run ShipKit from the root of an Expo project',
    });
  }
  const pkgJson = readJsonFile<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(
    pkgPath,
  );
  if (fileExists(pkgPath) && !pkgJson) {
    issues.push({
      severity: 'error',
      field: 'package.json',
      message: 'package.json is not valid JSON',
    });
  }
  const deps = { ...(pkgJson?.dependencies ?? {}), ...(pkgJson?.devDependencies ?? {}) };
  if (!deps['expo-updates']) {
    issues.push({
      severity: 'error',
      field: 'expo-updates',
      message: 'expo-updates is not installed',
      fix: 'Run "shipkit update setup" or "npx expo install expo-updates"',
    });
  }

  // 2. runtimeVersion set?
  const rv = readRuntimeVersion(cwd);
  if (!rv) {
    issues.push({
      severity: 'error',
      field: 'app.json/expo.runtimeVersion',
      message: 'runtimeVersion is not set in app.json',
      fix: 'Run "shipkit update setup" to add a runtimeVersion policy',
    });
  } else {
    const runtimeVersionError = getRuntimeVersionValidationError(rv);
    if (runtimeVersionError) {
      issues.push({
        severity: 'error',
        field: 'app.json/expo.runtimeVersion',
        message: runtimeVersionError,
        fix: 'Use a non-empty string or a valid policy object: { "policy": "appVersion" | "sdkVersion" | "fingerprint" }',
      });
    }
  }

  // 3. updates.url present?
  const appJsonPath = path.join(cwd, 'app.json');
  const appJson = readJsonFile<ExpoAppJson & { expo?: { updates?: { url?: unknown } } }>(appJsonPath);
  if (!fileExists(appJsonPath)) {
    issues.push({
      severity: 'error',
      field: 'app.json',
      message: 'app.json is missing',
      fix: 'Run ShipKit from an Expo project with app.json',
    });
  } else if (!appJson) {
    issues.push({
      severity: 'error',
      field: 'app.json',
      message: 'app.json is not valid JSON',
    });
  }

  const updatesUrl = appJson?.expo?.updates?.url;
  if (typeof updatesUrl !== 'string' || updatesUrl.trim().length === 0) {
    issues.push({
      severity: 'error',
      field: 'app.json/expo.updates.url',
      message: 'expo.updates.url is not set',
      fix: 'Run "eas update:configure" to provision the project and write the URL',
    });
  } else {
    try {
      const parsedUrl = new URL(updatesUrl);
      if (parsedUrl.protocol !== 'https:') {
        issues.push({
          severity: 'error',
          field: 'app.json/expo.updates.url',
          message: 'expo.updates.url must be an HTTPS URL',
        });
      }
    } catch {
      issues.push({
        severity: 'error',
        field: 'app.json/expo.updates.url',
        message: 'expo.updates.url is not a valid URL',
      });
    }
  }

  // 4. Channels set in eas.json for active profiles
  const easJsonPath = path.join(cwd, 'eas.json');
  if (!fileExists(easJsonPath)) {
    issues.push({
      severity: 'error',
      field: 'eas.json',
      message: 'eas.json is missing',
      fix: 'Run "shipkit init" or "eas build:configure"',
    });
  } else {
    const easJson = readJsonFile<EasConfig>(easJsonPath);
    if (!easJson) {
      issues.push({
        severity: 'error',
        field: 'eas.json',
        message: 'eas.json is not valid JSON',
      });
      return issues;
    }
    const profiles = options.profiles ?? ['preview', 'production'];
    for (const profile of profiles) {
      const channelOverride = options.updates?.channels?.[profile];
      const expectedChannel = channelOverride ?? profile;
      const expectedChannelError = getUpdateBranchValidationError(expectedChannel, `Configured channel for "${profile}"`);
      if (expectedChannelError) {
        issues.push({
          severity: 'error',
          field: `updates.channels.${profile}`,
          message: expectedChannelError,
        });
        continue;
      }
      const buildProfile = easJson.build?.[profile];
      if (!buildProfile) {
        issues.push({
          severity: 'warn',
          field: `eas.json/build.${profile}`,
          message: `Build profile "${profile}" not found in eas.json`,
        });
        continue;
      }
      if (!buildProfile.channel) {
        issues.push({
          severity: 'error',
          field: `eas.json/build.${profile}.channel`,
          message: `Profile "${profile}" has no channel — published OTA would not reach this build`,
          fix: `Set "channel": "${expectedChannel}" on build.${profile} in eas.json`,
        });
      } else if (buildProfile.channel !== expectedChannel) {
        issues.push({
          severity: 'error',
          field: `eas.json/build.${profile}.channel`,
          message: `Profile "${profile}" channel is "${buildProfile.channel}" but ShipKit publishes to "${expectedChannel}"`,
          fix: `Set "channel": "${expectedChannel}" on build.${profile} in eas.json or update updates.channels.${profile}`,
        });
      } else {
        const actualChannelError = getUpdateBranchValidationError(buildProfile.channel, `eas.json build.${profile}.channel`);
        if (actualChannelError) {
          issues.push({
            severity: 'error',
            field: `eas.json/build.${profile}.channel`,
            message: actualChannelError,
          });
        }
      }
    }
  }

  return issues;
}

function getRuntimeVersionValidationError(value: RuntimeVersionValue): string | null {
  if (typeof value === 'string') {
    return value.trim().length > 0 ? null : 'runtimeVersion string cannot be empty';
  }

  if (!value || typeof value !== 'object' || !('policy' in value)) {
    return 'runtimeVersion must be a string or policy object';
  }

  return isRuntimeVersionPolicy(value.policy) ? null : `Invalid runtimeVersion policy "${String(value.policy)}"`;
}

/**
 * Convenience: split issues into errors / warnings.
 */
export function partitionIssues(
  issues: UpdatesValidationIssue[],
): { errors: UpdatesValidationIssue[]; warnings: UpdatesValidationIssue[] } {
  return {
    errors: issues.filter((i) => i.severity === 'error'),
    warnings: issues.filter((i) => i.severity === 'warn'),
  };
}

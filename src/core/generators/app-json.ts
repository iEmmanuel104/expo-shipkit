import * as path from 'path';
import { readJsonFile, writeJsonFile } from '../../utils/fs.js';
import type { ExpoAppJson } from '../../types/eas.js';

export interface AppJsonGap {
  field: string;
  description: string;
  required: boolean;
}

/**
 * Detect gaps in app.json configuration
 */
export function detectAppJsonGaps(projectRoot?: string): AppJsonGap[] {
  const cwd = projectRoot ?? process.cwd();
  const appJsonPath = path.join(cwd, 'app.json');
  const gaps: AppJsonGap[] = [];

  const appJson = readJsonFile<ExpoAppJson>(appJsonPath);
  if (!appJson?.expo) {
    gaps.push({
      field: 'expo',
      description: 'app.json is missing the "expo" key',
      required: true,
    });
    return gaps;
  }

  if (!appJson.expo.ios?.bundleIdentifier) {
    gaps.push({
      field: 'expo.ios.bundleIdentifier',
      description: 'iOS bundle identifier is not set',
      required: true,
    });
  }

  if (!appJson.expo.android?.package) {
    gaps.push({
      field: 'expo.android.package',
      description: 'Android package name is not set',
      required: true,
    });
  }

  if (!appJson.expo.extra?.eas?.projectId) {
    gaps.push({
      field: 'expo.extra.eas.projectId',
      description: 'EAS project ID is not set (run "eas init" to configure)',
      required: false,
    });
  }

  // Check for expo-build-properties plugin
  const hasPlugin = appJson.expo.plugins?.some((p) => {
    if (typeof p === 'string') return p === 'expo-build-properties';
    if (Array.isArray(p)) return p[0] === 'expo-build-properties';
    return false;
  });

  if (!hasPlugin) {
    gaps.push({
      field: 'expo.plugins (expo-build-properties)',
      description: 'expo-build-properties plugin is not configured',
      required: false,
    });
  }

  return gaps;
}

/**
 * Suggest bundle identifier from project slug
 */
export function suggestBundleIdentifier(slug: string): string {
  const cleaned = slug.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const segment = cleaned || 'app';
  const safeSegment = /^[a-zA-Z]/.test(segment) ? segment : `app${segment}`;
  return `com.yourcompany.${safeSegment}`;
}

/**
 * Suggest Android package from project slug
 */
export function suggestAndroidPackage(slug: string): string {
  const cleaned = slug.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const segment = cleaned || 'app';
  const safeSegment = /^[a-zA-Z]/.test(segment) ? segment : `app${segment}`;
  return `com.yourcompany.${safeSegment}`;
}

export interface AppJsonFixes {
  bundleIdentifier?: string;
  androidPackage?: string;
  addBuildProperties?: boolean;
}

/**
 * Apply fixes to app.json
 */
export function fixAppJsonGaps(fixes: AppJsonFixes, projectRoot?: string): void {
  const cwd = projectRoot ?? process.cwd();
  const appJsonPath = path.join(cwd, 'app.json');

  const appJson = readJsonFile<ExpoAppJson>(appJsonPath);
  if (!appJson?.expo) return;

  if (fixes.bundleIdentifier) {
    if (!appJson.expo.ios) {
      appJson.expo.ios = {};
    }
    appJson.expo.ios.bundleIdentifier = fixes.bundleIdentifier;
  }

  if (fixes.androidPackage) {
    if (!appJson.expo.android) {
      appJson.expo.android = {};
    }
    appJson.expo.android.package = fixes.androidPackage;
  }

  if (fixes.addBuildProperties) {
    if (!appJson.expo.plugins) {
      appJson.expo.plugins = [];
    }

    const hasPlugin = appJson.expo.plugins.some((p) => {
      if (typeof p === 'string') return p === 'expo-build-properties';
      if (Array.isArray(p)) return p[0] === 'expo-build-properties';
      return false;
    });

    if (!hasPlugin) {
      appJson.expo.plugins.push([
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 24,
            targetSdkVersion: 34,
            compileSdkVersion: 34,
          },
          ios: {
            deploymentTarget: '15.1',
          },
        },
      ]);
    }
  }

  writeJsonFile(appJsonPath, appJson);
}

import * as path from 'path';
import { readJsonFile } from '../../utils/fs.js';
import { DeploymentTracker } from './tracker.js';
import type { Platform, ConfigChange } from '../../types/deployment.js';
import type { ExpoAppJson, ExpoBuildPropertiesConfig } from '../../types/eas.js';
import type { CriticalConfig } from '../../types/config.js';

/**
 * Default critical config keys to track
 */
const DEFAULT_CRITICAL_CONFIG: CriticalConfig = {
  android: ['minSdkVersion', 'targetSdkVersion', 'compileSdkVersion'],
  ios: ['deploymentTarget'],
};

/**
 * Read current platform config from app.json (expo-build-properties plugin)
 */
export function readCurrentPlatformConfig(
  platform: Platform,
  projectRoot?: string,
  criticalKeys?: string[]
): Record<string, unknown> {
  const cwd = projectRoot ?? process.cwd();
  const appJsonPath = path.join(cwd, 'app.json');
  const appJson = readJsonFile<ExpoAppJson>(appJsonPath);

  if (!appJson) {
    return {};
  }

  const plugins = appJson.expo?.plugins ?? [];

  // Find expo-build-properties plugin
  const buildPropsPlugin = plugins.find(
    (p) => Array.isArray(p) && p[0] === 'expo-build-properties'
  ) as [string, ExpoBuildPropertiesConfig] | undefined;

  if (!buildPropsPlugin || !buildPropsPlugin[1]) {
    return {};
  }

  const pluginConfig = buildPropsPlugin[1];
  const platformConfig = (platform === 'android' ? pluginConfig.android : pluginConfig.ios) ?? {};
  const config: Record<string, unknown> = {};
  const keys = criticalKeys ?? DEFAULT_CRITICAL_CONFIG[platform];

  // Extract only the critical keys
  for (const key of keys) {
    const value = platformConfig[key as keyof typeof platformConfig];
    if (value !== undefined) {
      config[key] = value;
    }
  }

  return config;
}

/**
 * Detect config changes between current and last deployed
 */
export function detectConfigChanges(
  platform: Platform,
  tracker: DeploymentTracker,
  projectRoot?: string,
  criticalKeys?: string[]
): ConfigChange[] {
  const currentConfig = readCurrentPlatformConfig(platform, projectRoot, criticalKeys);
  const lastConfig = tracker.getLastConfig(platform);
  const changes: ConfigChange[] = [];
  const keys = criticalKeys ?? DEFAULT_CRITICAL_CONFIG[platform];

  for (const key of keys) {
    const current = currentConfig[key];
    const last = lastConfig[key];

    if (current !== last) {
      changes.push({
        key,
        from: last !== undefined ? last : 'unset',
        to: current !== undefined ? current : 'unset',
      });
    }
  }

  return changes;
}

/**
 * Check if any config has changed for a platform
 */
export function hasConfigChanged(
  platform: Platform,
  tracker: DeploymentTracker,
  projectRoot?: string,
  criticalKeys?: string[]
): boolean {
  const changes = detectConfigChanges(platform, tracker, projectRoot, criticalKeys);
  return changes.length > 0;
}

/**
 * Update tracker with current config after successful build
 */
export function updateTrackedConfig(
  platform: Platform,
  tracker: DeploymentTracker,
  projectRoot?: string,
  criticalKeys?: string[]
): void {
  const currentConfig = readCurrentPlatformConfig(platform, projectRoot, criticalKeys);
  tracker.updateLastConfig(platform, currentConfig);
}

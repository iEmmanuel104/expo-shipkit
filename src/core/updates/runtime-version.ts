import * as path from 'path';
import { readJsonFile, writeJsonFile, fileExists } from '../../utils/fs.js';
import type { ExpoAppJson } from '../../types/eas.js';

export type RuntimeVersionPolicy = 'appVersion' | 'sdkVersion' | 'fingerprint';

/**
 * runtimeVersion may be a literal string or a `{ policy }` object in app.json.
 */
export type RuntimeVersionValue = string | { policy: RuntimeVersionPolicy };

interface AppJsonWithUpdates extends ExpoAppJson {
  expo: ExpoAppJson['expo'] & {
    runtimeVersion?: RuntimeVersionValue;
    sdkVersion?: string;
    updates?: {
      url?: string;
      enabled?: boolean;
      checkAutomatically?: 'ON_LOAD' | 'ON_ERROR_RECOVERY' | 'WIFI_ONLY' | 'NEVER';
      fallbackToCacheTimeout?: number;
    };
  };
}

/**
 * Read the runtimeVersion configured in app.json, if any.
 */
export function readRuntimeVersion(projectRoot?: string): RuntimeVersionValue | null {
  const cwd = projectRoot ?? process.cwd();
  const appJson = readJsonFile<AppJsonWithUpdates>(path.join(cwd, 'app.json'));
  return appJson?.expo?.runtimeVersion ?? null;
}

/**
 * Resolve the effective runtimeVersion string for tracking/display purposes.
 * For policies the resolved string is the policy name in brackets (e.g. `[policy:appVersion]`).
 */
export function resolveRuntimeVersion(projectRoot?: string): string | null {
  const rv = readRuntimeVersion(projectRoot);
  if (!rv) return null;
  if (typeof rv === 'string') return rv;
  return `[policy:${rv.policy}]`;
}

/**
 * Write a runtimeVersion policy block into app.json. Idempotent.
 * Returns true if the file was modified.
 */
export function writeRuntimeVersionPolicy(
  policy: RuntimeVersionPolicy,
  projectRoot?: string,
): boolean {
  const cwd = projectRoot ?? process.cwd();
  const appJsonPath = path.join(cwd, 'app.json');

  if (!fileExists(appJsonPath)) {
    return false;
  }

  const appJson = readJsonFile<AppJsonWithUpdates>(appJsonPath);
  if (!appJson?.expo) return false;

  const existing = appJson.expo.runtimeVersion;
  if (existing && typeof existing !== 'string' && existing.policy === policy) {
    return false;
  }

  appJson.expo.runtimeVersion = { policy };
  writeJsonFile(appJsonPath, appJson);
  return true;
}

/**
 * Check whether app.json has a usable updates.url and runtimeVersion set.
 */
export function hasUpdatesUrl(projectRoot?: string): boolean {
  const cwd = projectRoot ?? process.cwd();
  const appJson = readJsonFile<AppJsonWithUpdates>(path.join(cwd, 'app.json'));
  const url = appJson?.expo?.updates?.url;
  return typeof url === 'string' && url.trim().length > 0;
}

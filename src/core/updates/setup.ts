import * as path from 'path';
import { readJsonFile, writeJsonFile, fileExists } from '../../utils/fs.js';
import { execInteractiveFile } from '../../utils/exec.js';
import { writeRuntimeVersionPolicy, hasUpdatesUrl, readRuntimeVersion } from './runtime-version.js';
import { assertUpdateBranchName, parseRuntimeVersionPolicy } from './guards.js';
import type { EasConfig } from '../../types/eas.js';
import type { Profile } from '../../types/deployment.js';
import type { UpdatesConfig } from '../../types/config.js';
import type { RuntimeVersionPolicy } from './runtime-version.js';

export interface SetupUpdatesOptions {
  profiles?: Profile[];
  channels?: Record<string, string>;
  runtimeVersionPolicy?: RuntimeVersionPolicy;
  // When true, run `npx expo install expo-updates` if missing.
  installExpoUpdates?: boolean;
  // When true and updates.url is missing, run `eas update:configure`.
  runEasUpdateConfigure?: boolean;
  projectRoot?: string;
}

export interface SetupUpdatesResult {
  installedExpoUpdates: boolean;
  ranEasUpdateConfigure: boolean;
  appJsonChanged: boolean;
  easJsonChanged: boolean;
  channelMap: Record<string, string>;
  warnings: string[];
}

/**
 * Idempotent OTA setup for an Expo project:
 *   1. Install expo-updates if missing (when installExpoUpdates=true)
 *   2. Write a runtimeVersion policy block in app.json
 *   3. Run `eas update:configure` to provision the project URL (when runEasUpdateConfigure=true and url missing)
 *   4. Write `channel` into each build profile in eas.json
 *
 * Does NOT modify shipkit.config.ts — the caller persists that.
 */
export async function setupUpdates(options: SetupUpdatesOptions = {}): Promise<SetupUpdatesResult> {
  const cwd = options.projectRoot ?? process.cwd();
  const profiles: Profile[] = options.profiles ?? ['preview', 'production'];
  const policy = options.runtimeVersionPolicy
    ? parseRuntimeVersionPolicy(options.runtimeVersionPolicy)
    : undefined;
  for (const profile of profiles) {
    assertUpdateBranchName(
      options.channels?.[profile] ?? profile,
      `EAS Update channel for profile "${profile}"`,
    );
  }

  const result: SetupUpdatesResult = {
    installedExpoUpdates: false,
    ranEasUpdateConfigure: false,
    appJsonChanged: false,
    easJsonChanged: false,
    channelMap: {},
    warnings: [],
  };

  // 1. expo-updates installed?
  const pkgPath = path.join(cwd, 'package.json');
  const pkgJson = readJsonFile<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(pkgPath);
  const deps = { ...(pkgJson?.dependencies ?? {}), ...(pkgJson?.devDependencies ?? {}) };
  if (!deps['expo-updates']) {
    if (options.installExpoUpdates) {
      const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const code = await execInteractiveFile(npx, ['expo', 'install', 'expo-updates'], { cwd });
      if (code !== 0) {
        result.warnings.push('npx expo install expo-updates exited with code ' + code);
      } else {
        result.installedExpoUpdates = true;
      }
    } else {
      result.warnings.push('expo-updates is not installed (skipped install)');
    }
  }

  // 2. runtimeVersion policy
  const existingRuntimeVersion = readRuntimeVersion(cwd);
  const policyToWrite = policy ?? (existingRuntimeVersion ? undefined : 'appVersion');
  if (policyToWrite && writeRuntimeVersionPolicy(policyToWrite, cwd)) {
    result.appJsonChanged = true;
  }

  // 3. updates.url
  if (!hasUpdatesUrl(cwd) && options.runEasUpdateConfigure) {
    const eas = process.platform === 'win32' ? 'eas.cmd' : 'eas';
    const code = await execInteractiveFile(eas, ['update:configure'], { cwd });
    if (code !== 0) {
      result.warnings.push('eas update:configure exited with code ' + code);
    } else if (!hasUpdatesUrl(cwd)) {
      result.warnings.push('eas update:configure completed but expo.updates.url is still missing');
    } else {
      result.ranEasUpdateConfigure = true;
      result.appJsonChanged = true;
    }
  } else if (!hasUpdatesUrl(cwd)) {
    result.warnings.push('expo.updates.url is not set — run "eas update:configure" before publishing');
  }

  // 4. eas.json channel per profile
  const easJsonPath = path.join(cwd, 'eas.json');
  if (fileExists(easJsonPath)) {
    const easJson = readJsonFile<EasConfig>(easJsonPath) ?? {};
    if (!easJson.build) easJson.build = {};
    let mutated = false;
    for (const profile of profiles) {
      const branch = options.channels?.[profile] ?? profile;
      result.channelMap[profile] = assertUpdateBranchName(branch, `EAS Update channel for profile "${profile}"`);
      const buildProfile = easJson.build[profile] ?? {};
      if (buildProfile.channel !== branch) {
        easJson.build[profile] = { ...buildProfile, channel: branch };
        mutated = true;
      }
    }
    if (mutated) {
      writeJsonFile(easJsonPath, easJson);
      result.easJsonChanged = true;
    }
  } else {
    result.warnings.push('eas.json is missing — channels not written');
  }

  return result;
}

/**
 * Build the recommended `updates` block for shipkit.config.ts based on a setup run.
 */
export function buildUpdatesConfigSnippet(
  result: SetupUpdatesResult,
  policy: RuntimeVersionPolicy = 'appVersion',
): UpdatesConfig {
  return {
    enabled: true,
    smartDeploy: true,
    runtimeVersionPolicy: policy,
    channels: Object.keys(result.channelMap).length > 0 ? result.channelMap : undefined,
  };
}

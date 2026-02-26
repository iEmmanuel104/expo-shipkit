import { execInteractive } from '../../utils/exec.js';
import type { Platform, Profile } from '../../types/deployment.js';
import type { ShipkitConfig } from '../../types/config.js';

export interface BuildOptions {
  platform: Platform;
  profile: Profile;
  clearCache?: boolean;
  config?: ShipkitConfig;
  projectRoot?: string;
}

export interface BuildResult {
  code: number;
  errorOutput?: string;
}

/**
 * Build EAS build command
 */
export function buildEasCommand(options: BuildOptions): string {
  const { platform, profile, clearCache, config } = options;

  const parts = ['eas', 'build'];

  // Platform
  parts.push('--platform', platform);

  // Profile
  parts.push('--profile', profile);

  // Non-interactive flag based on config
  const nonInteractive = platform === 'android'
    ? (config?.build.android.nonInteractive ?? true)
    : (config?.build.ios.nonInteractive ?? false);

  if (nonInteractive) {
    parts.push('--non-interactive');
  }

  // Clear cache if needed
  if (clearCache) {
    parts.push('--clear-cache');
  }

  return parts.join(' ');
}

/**
 * Execute EAS build and return result with error output
 */
export async function runBuild(options: BuildOptions): Promise<number> {
  const command = buildEasCommand(options);
  const cwd = options.projectRoot ?? process.cwd();

  return execInteractive(command, { cwd });
}

/**
 * Build multiple platforms sequentially
 */
export async function runBuilds(
  platforms: Platform[],
  profile: Profile,
  clearCacheMap: Record<Platform, boolean>,
  config?: ShipkitConfig,
  projectRoot?: string
): Promise<Map<Platform, number>> {
  const results = new Map<Platform, number>();

  for (const platform of platforms) {
    const code = await runBuild({
      platform,
      profile,
      clearCache: clearCacheMap[platform] ?? false,
      config,
      projectRoot,
    });

    results.set(platform, code);

    // Stop if build failed
    if (code !== 0) {
      break;
    }
  }

  return results;
}

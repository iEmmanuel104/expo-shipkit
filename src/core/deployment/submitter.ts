import { execInteractive } from '../../utils/exec.js';
import type { Platform, Profile } from '../../types/deployment.js';

export interface SubmitOptions {
  platform: Platform;
  profile: Profile;
  projectRoot?: string;
}

/**
 * Build EAS submit command
 */
export function buildSubmitCommand(options: SubmitOptions): string {
  const { platform, profile } = options;

  const parts = ['eas', 'submit'];

  // Platform
  parts.push('--platform', platform);

  // Profile
  parts.push('--profile', profile);

  // Use latest build
  parts.push('--latest');

  return parts.join(' ');
}

/**
 * Execute EAS submit
 */
export async function runSubmit(options: SubmitOptions): Promise<number> {
  const command = buildSubmitCommand(options);
  const cwd = options.projectRoot ?? process.cwd();

  return execInteractive(command, { cwd });
}

/**
 * Submit multiple platforms sequentially
 */
export async function runSubmits(
  platforms: Platform[],
  profile: Profile,
  projectRoot?: string
): Promise<Map<Platform, number>> {
  const results = new Map<Platform, number>();

  for (const platform of platforms) {
    const code = await runSubmit({
      platform,
      profile,
      projectRoot,
    });

    results.set(platform, code);

    // Stop if submit failed
    if (code !== 0) {
      break;
    }
  }

  return results;
}

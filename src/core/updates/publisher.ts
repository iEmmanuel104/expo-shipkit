import { execInteractiveFile } from '../../utils/exec.js';
import type { Platform, Profile } from '../../types/deployment.js';
import type { UpdatesConfig } from '../../types/config.js';
import {
  assertUpdateBranchName,
  getUpdateMessageValidationError,
  parseUpdatePlatform,
} from './guards.js';

export interface UpdateOptions {
  profile: Profile;
  // Platform: 'ios' | 'android' | 'all' — defaults to 'all' on the EAS CLI side.
  platform?: Platform | 'all';
  // Branch override; if omitted, falls back to updates.channels[profile] ?? profile.
  branch?: string;
  message: string;
  // updates config from shipkit; used only to resolve the branch override map.
  updates?: UpdatesConfig;
  // Pass --non-interactive (used in CI / inside hooks).
  nonInteractive?: boolean;
  projectRoot?: string;
}

/**
 * Resolve which EAS Update branch a given profile publishes to.
 */
export function resolveBranch(profile: Profile, updates?: UpdatesConfig): string {
  return updates?.channels?.[profile] ?? profile;
}

function shellQuoteForDisplay(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

/**
 * Build argv for `eas update`. Used for execution so user-controlled values
 * never go through a shell.
 */
export function buildUpdateArgs(options: UpdateOptions): string[] {
  const branch = options.branch ?? resolveBranch(options.profile, options.updates);
  const platform = parseUpdatePlatform(options.platform ?? 'all');
  const messageError = getUpdateMessageValidationError(options.message);
  if (messageError) {
    throw new Error(messageError);
  }

  const args = [
    'update',
    '--branch',
    assertUpdateBranchName(branch),
    '--message',
    options.message.trim(),
    '--platform',
    platform,
  ];

  if (options.nonInteractive) {
    args.push('--non-interactive');
  }
  return args;
}

/**
 * Build a display-only `eas update` command string.
 */
export function buildUpdateCommand(options: UpdateOptions): string {
  const args = buildUpdateArgs(options);
  return ['eas', ...args.map((arg, index) => (args[index - 1] === '--message' ? shellQuoteForDisplay(arg) : arg))].join(' ');
}

/**
 * Execute `eas update` interactively (stdio inherited).
 */
export async function runUpdate(options: UpdateOptions): Promise<number> {
  const args = buildUpdateArgs(options);
  const cwd = options.projectRoot ?? process.cwd();
  return execInteractiveFile('eas', args, { cwd });
}

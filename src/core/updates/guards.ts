import type { Platform, Profile } from '../../types/deployment.js';
import type { RuntimeVersionPolicy } from './runtime-version.js';

export type UpdatePlatform = Platform | 'all';

export const RUNTIME_VERSION_POLICIES = ['appVersion', 'sdkVersion', 'fingerprint'] as const;
export const UPDATE_PLATFORMS = ['ios', 'android', 'all'] as const;
export const DEPLOYMENT_PROFILES = ['development', 'preview', 'staging', 'production'] as const;

const UPDATE_BRANCH_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,199}$/;

export function isRuntimeVersionPolicy(value: string): value is RuntimeVersionPolicy {
  return RUNTIME_VERSION_POLICIES.includes(value as RuntimeVersionPolicy);
}

export function parseRuntimeVersionPolicy(value: unknown): RuntimeVersionPolicy {
  if (typeof value === 'string' && isRuntimeVersionPolicy(value)) {
    return value;
  }
  throw new Error(`Invalid runtimeVersion policy "${String(value)}" — must be one of: ${RUNTIME_VERSION_POLICIES.join(', ')}`);
}

export function isUpdatePlatform(value: string): value is UpdatePlatform {
  return UPDATE_PLATFORMS.includes(value as UpdatePlatform);
}

export function parseUpdatePlatform(value: unknown): UpdatePlatform {
  if (typeof value === 'string' && isUpdatePlatform(value)) {
    return value;
  }
  throw new Error(`Invalid platform "${String(value)}" — must be one of: ${UPDATE_PLATFORMS.join(', ')}`);
}

export function isDeploymentProfile(value: string): value is Profile {
  return DEPLOYMENT_PROFILES.includes(value as Profile);
}

export function parseDeploymentProfile(value: unknown): Profile {
  if (typeof value === 'string' && isDeploymentProfile(value)) {
    return value;
  }
  throw new Error(`Invalid profile "${String(value)}" — must be one of: ${DEPLOYMENT_PROFILES.join(', ')}`);
}

export function getUpdateBranchValidationError(branch: unknown, label = 'EAS Update branch'): string | null {
  if (typeof branch !== 'string') {
    return `${label} must be a string`;
  }

  if (!UPDATE_BRANCH_PATTERN.test(branch)) {
    return `Invalid ${label} "${branch}" - must be 1-200 characters and contain only letters, digits, dots, dashes, slashes, or underscores, starting with a letter or digit`;
  }

  if (branch.includes('//') || branch.includes('/./') || branch.includes('/../') || branch.endsWith('/')) {
    return `Invalid ${label} "${branch}" - contains an unsafe path segment`;
  }

  return null;
}

export function assertUpdateBranchName(branch: string, label = 'EAS Update branch'): string {
  const error = getUpdateBranchValidationError(branch, label);
  if (error) {
    throw new Error(error);
  }
  return branch;
}

export function getUpdateMessageValidationError(message: unknown): string | null {
  if (typeof message !== 'string' || message.trim().length === 0) {
    return 'Update message cannot be empty';
  }

  if (message.length > 1000) {
    return 'Update message must be 1000 characters or less';
  }

  return null;
}

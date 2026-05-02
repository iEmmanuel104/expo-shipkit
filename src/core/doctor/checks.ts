import * as path from 'path';
import * as fs from 'fs';
import { exec } from '../../utils/exec.js';
import { fileExists, readJsonFile } from '../../utils/fs.js';
import { isExpoProject, hasEasJson, isInitialized } from '../config/loader.js';
import { checkAllPrerequisites, type PrerequisiteResult } from '../prerequisites/checker.js';
import { detectAppJsonGaps } from '../generators/app-json.js';
import { validateEasJson } from '../generators/eas-json.js';
import { hasAllCredentialPatterns } from '../generators/gitignore.js';
import { checkAppleCredentials, validateAppleCredentials } from '../credentials/apple.js';
import { checkGoogleCredentials, validateGoogleCredentials } from '../credentials/google.js';
import { isWindows, canBuildIOS } from '../../utils/platform.js';
import { validateUpdatesSetup } from '../updates/validator.js';
import { loadConfig } from '../config/loader.js';
import type { EasConfig } from '../../types/eas.js';

export type CheckCategory = 'environment' | 'project' | 'credentials' | 'security' | 'updates';

export interface DoctorCheckResult {
  category: CheckCategory;
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  fix?: string;
}

/**
 * Run environment checks (reuses prerequisite checks)
 */
export async function runEnvironmentChecks(): Promise<DoctorCheckResult[]> {
  const prereqs = await checkAllPrerequisites();

  const results = prereqs.map((p: PrerequisiteResult) => ({
    category: 'environment' as CheckCategory,
    name: p.name,
    status: p.status,
    message: p.message,
    fix: p.fix,
  }));

  // Check if iOS local builds are possible
  if (!canBuildIOS()) {
    results.push({
      category: 'environment',
      name: 'iOS Local Build',
      status: 'warn',
      message: 'Not running on macOS — local iOS builds unavailable (EAS cloud builds still work)',
      fix: undefined,
    });
  }

  return results;
}

/**
 * Run project structure checks
 */
export async function runProjectChecks(projectRoot?: string): Promise<DoctorCheckResult[]> {
  const cwd = projectRoot ?? process.cwd();
  const results: DoctorCheckResult[] = [];

  // Check Expo project
  if (isExpoProject(cwd)) {
    results.push({
      category: 'project',
      name: 'Expo Project',
      status: 'pass',
      message: 'Valid Expo project detected (app.json with "expo" key)',
    });
  } else {
    results.push({
      category: 'project',
      name: 'Expo Project',
      status: 'fail',
      message: 'Not a valid Expo project',
      fix: 'Ensure app.json has an "expo" key',
    });
    return results;
  }

  // Check shipkit initialization
  if (isInitialized(cwd)) {
    results.push({
      category: 'project',
      name: 'Shipkit Config',
      status: 'pass',
      message: 'shipkit.config.ts found',
    });
  } else {
    results.push({
      category: 'project',
      name: 'Shipkit Config',
      status: 'warn',
      message: 'shipkit is not initialized',
      fix: 'Run "shipkit init" to initialize',
    });
  }

  // Check eas.json
  if (hasEasJson(cwd)) {
    const warnings = validateEasJson(cwd);
    if (warnings.length === 0) {
      results.push({
        category: 'project',
        name: 'EAS Config',
        status: 'pass',
        message: 'eas.json is properly configured',
      });
    } else {
      results.push({
        category: 'project',
        name: 'EAS Config',
        status: 'warn',
        message: `eas.json has issues: ${warnings[0]}`,
        fix: warnings.length > 1 ? `${warnings.length} issues found` : undefined,
      });
    }
  } else {
    results.push({
      category: 'project',
      name: 'EAS Config',
      status: 'warn',
      message: 'eas.json not found',
      fix: 'Run "eas build:configure" or "shipkit init" to create it',
    });
  }

  // Check app.json gaps
  const gaps = detectAppJsonGaps(cwd);
  const requiredGaps = gaps.filter((g) => g.required);
  const optionalGaps = gaps.filter((g) => !g.required);

  if (requiredGaps.length === 0) {
    results.push({
      category: 'project',
      name: 'App Config (required)',
      status: 'pass',
      message: 'All required app.json fields are set',
    });
  } else {
    results.push({
      category: 'project',
      name: 'App Config (required)',
      status: 'fail',
      message: `Missing: ${requiredGaps.map((g) => g.field).join(', ')}`,
      fix: 'Run "shipkit init" to configure missing fields',
    });
  }

  if (optionalGaps.length > 0) {
    results.push({
      category: 'project',
      name: 'App Config (optional)',
      status: 'warn',
      message: `Recommended: ${optionalGaps.map((g) => g.field).join(', ')}`,
    });
  }

  return results;
}

/**
 * Run credential checks
 */
export async function runCredentialChecks(projectRoot?: string): Promise<DoctorCheckResult[]> {
  const cwd = projectRoot ?? process.cwd();
  const results: DoctorCheckResult[] = [];
  const ascPlacementIssues = findMisplacedAscConfig(cwd);
  if (ascPlacementIssues.length > 0) {
    results.push({
      category: 'credentials',
      name: 'ASC Config Placement',
      status: 'warn',
      message: `App Store Connect fields should live under eas.submit.<profile>.ios, not ${ascPlacementIssues.slice(0, 3).join(', ')}`,
      fix: 'Move ascAppId, ascApiKeyPath, ascApiIssuerId, and ascApiKeyId into the iOS submit profile',
    });
  }

  // iOS credentials
  const appleCredentials = checkAppleCredentials(cwd);
  if (appleCredentials) {
    const errors = validateAppleCredentials(appleCredentials, cwd);
    if (errors.length === 0) {
      results.push({
        category: 'credentials',
        name: 'iOS Credentials',
        status: 'pass',
        message: 'Apple App Store Connect credentials configured',
      });
    } else {
      results.push({
        category: 'credentials',
        name: 'iOS Credentials',
        status: 'warn',
        message: errors[0],
        fix: 'Run "shipkit credentials setup --platform ios"',
      });
    }
  } else {
    results.push({
      category: 'credentials',
      name: 'iOS Credentials',
      status: 'warn',
      message: 'iOS submission credentials not configured',
      fix: 'Run "shipkit credentials setup --platform ios"',
    });
  }

  // Android credentials
  const googleCredentials = checkGoogleCredentials(cwd);
  if (googleCredentials) {
    const errors = validateGoogleCredentials(googleCredentials, cwd);
    if (errors.length === 0) {
      results.push({
        category: 'credentials',
        name: 'Android Credentials',
        status: 'pass',
        message: 'Google Play service account configured',
      });
    } else {
      results.push({
        category: 'credentials',
        name: 'Android Credentials',
        status: 'warn',
        message: errors[0],
        fix: 'Run "shipkit credentials setup --platform android"',
      });
    }
  } else {
    results.push({
      category: 'credentials',
      name: 'Android Credentials',
      status: 'warn',
      message: 'Android submission credentials not configured',
      fix: 'Run "shipkit credentials setup --platform android"',
    });
  }

  return results;
}

function findMisplacedAscConfig(projectRoot: string): string[] {
  const easJson = readJsonFile<EasConfig & Record<string, unknown>>(path.join(projectRoot, 'eas.json'));
  const issues: string[] = [];
  const ascKeys = ['ascAppId', 'ascApiKeyPath', 'ascApiIssuerId', 'ascApiKeyId'];

  for (const [profileName, buildProfile] of Object.entries(easJson?.build ?? {})) {
    const iosConfig = (buildProfile as { ios?: Record<string, unknown> }).ios;
    for (const key of ascKeys) {
      if (iosConfig && key in iosConfig) {
        issues.push(`eas.build.${profileName}.ios.${key}`);
      }
    }
  }

  const submitRoot = easJson?.submit as Record<string, unknown> | undefined;
  const rootIosSubmit = submitRoot?.ios as Record<string, unknown> | undefined;
  for (const key of ascKeys) {
    if (rootIosSubmit && key in rootIosSubmit) {
      issues.push(`eas.submit.ios.${key}`);
    }
  }

  return issues;
}

/**
 * Run security checks.
 * All exec() calls use hardcoded git commands — no user input injection risk.
 */
export async function runSecurityChecks(projectRoot?: string): Promise<DoctorCheckResult[]> {
  const cwd = projectRoot ?? process.cwd();
  const results: DoctorCheckResult[] = [];

  // Check .gitignore
  if (hasAllCredentialPatterns(cwd)) {
    results.push({
      category: 'security',
      name: 'Gitignore Patterns',
      status: 'pass',
      message: 'All credential patterns present in .gitignore',
    });
  } else {
    results.push({
      category: 'security',
      name: 'Gitignore Patterns',
      status: 'warn',
      message: 'Some credential patterns missing from .gitignore',
      fix: 'Run "shipkit init" to update .gitignore',
    });
  }

  // Check keys/ directory permissions (Unix only)
  if (!isWindows()) {
    const keysDir = path.join(cwd, 'keys');
    if (fileExists(keysDir)) {
      try {
        const stats = fs.statSync(keysDir);
        const mode = stats.mode & 0o777;
        if (mode & 0o004) {
          results.push({
            category: 'security',
            name: 'Keys Directory Permissions',
            status: 'warn',
            message: 'keys/ directory is world-readable',
            fix: 'Run: chmod 700 keys/',
          });
        } else {
          results.push({
            category: 'security',
            name: 'Keys Directory Permissions',
            status: 'pass',
            message: 'keys/ directory has restricted permissions',
          });
        }
      } catch {
        results.push({
          category: 'security',
          name: 'Keys Directory Permissions',
          status: 'warn',
          message: 'Could not check keys/ directory permissions',
        });
      }
    }
  }

  // Check if we're in a git repo
  let isGitRepo = false;
  try {
    const gitCheck = await exec('git rev-parse --is-inside-work-tree', { cwd, silent: true, timeout: 3000 });
    isGitRepo = gitCheck.code === 0 && gitCheck.stdout.trim() === 'true';
  } catch {
    // Not a git repo
  }

  if (!isGitRepo) {
    results.push({
      category: 'security',
      name: 'Git Repository',
      status: 'warn',
      message: 'Not a git repository — some security checks skipped',
      fix: 'Run "git init" to initialize a git repository',
    });
    return results;
  }

  // Check for credential files tracked by git
  try {
    const result = await exec(
      'git ls-files -- "*.p8" "*-key.json" "*.env" ".env.*"',
      { cwd, silent: true, timeout: 5000 },
    );

    if (result.code === 0 && result.stdout.trim()) {
      const trackedFiles = result.stdout.trim().split('\n').filter(Boolean);
      results.push({
        category: 'security',
        name: 'Tracked Credentials',
        status: 'fail',
        message: `Credential files tracked by git: ${trackedFiles.join(', ')}`,
        fix: 'Remove from git: git rm --cached <file>',
      });
    } else {
      results.push({
        category: 'security',
        name: 'Tracked Credentials',
        status: 'pass',
        message: 'No credential files tracked by git',
      });
    }
  } catch {
    results.push({
      category: 'security',
      name: 'Tracked Credentials',
      status: 'warn',
      message: 'Could not check git-tracked files (not a git repo?)',
    });
  }

  // Check git history for credential files
  try {
    const result = await exec(
      'git log --all --diff-filter=A --name-only --pretty=format: -- "*.p8" "*-key.json"',
      { cwd, silent: true, timeout: 10000 },
    );

    if (result.code === 0 && result.stdout.trim()) {
      const files = result.stdout.trim().split('\n').filter(Boolean);
      results.push({
        category: 'security',
        name: 'Credential History',
        status: 'warn',
        message: `Credential files found in git history: ${files.join(', ')}`,
        fix: 'Consider using git-filter-repo to remove sensitive files from history',
      });
    } else {
      results.push({
        category: 'security',
        name: 'Credential History',
        status: 'pass',
        message: 'No credential files found in git history',
      });
    }
  } catch {
    results.push({
      category: 'security',
      name: 'Credential History',
      status: 'warn',
      message: 'Could not check git history',
      fix: undefined,
    });
  }

  return results;
}

/**
 * Run OTA / EAS Update checks.
 */
export async function runUpdatesChecks(projectRoot?: string): Promise<DoctorCheckResult[]> {
  const cwd = projectRoot ?? process.cwd();
  const results: DoctorCheckResult[] = [];

  // Pull config so we can use the configured channels/profiles when validating
  let config = null;
  try {
    config = await loadConfig(cwd);
  } catch {
    // ignore — validator works with defaults
  }

  // If updates are explicitly disabled (or no config at all), surface a single
  // informational warn — no point running deeper checks.
  if (!config?.updates?.enabled) {
    results.push({
      category: 'updates',
      name: 'OTA Updates',
      status: 'warn',
      message: 'OTA updates are not enabled in shipkit.config.ts',
      fix: 'Run "shipkit update setup" to enable EAS Update for this project',
    });
    return results;
  }

  const issues = validateUpdatesSetup({
    profiles: config.profiles,
    updates: config.updates,
    projectRoot: cwd,
  });

  if (issues.length === 0) {
    results.push({
      category: 'updates',
      name: 'OTA Setup',
      status: 'pass',
      message: 'expo-updates installed, runtimeVersion + updates.url configured, channels wired',
    });
    return results;
  }

  for (const issue of issues) {
    results.push({
      category: 'updates',
      name: issue.field,
      status: issue.severity === 'error' ? 'fail' : 'warn',
      message: issue.message,
      fix: issue.fix,
    });
  }

  return results;
}

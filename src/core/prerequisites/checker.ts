import { commandExists, isEasCliInstalled, getEasCliVersion, exec } from '../../utils/exec.js';

export interface PrerequisiteResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  fix?: string;
  autoFixable?: boolean;
}

/**
 * Check Node.js version (>= 18)
 */
export async function checkNodeVersion(): Promise<PrerequisiteResult> {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);

  if (major >= 18) {
    return {
      name: 'Node.js',
      status: 'pass',
      message: `Node.js ${version} installed`,
    };
  }

  return {
    name: 'Node.js',
    status: 'fail',
    message: `Node.js ${version} detected, but >= 18.0.0 is required`,
    fix: 'Update Node.js: https://nodejs.org/',
  };
}

/**
 * Check if EAS CLI is installed and meets minimum version
 */
export async function checkEasCli(): Promise<PrerequisiteResult> {
  const installed = await isEasCliInstalled();

  if (!installed) {
    return {
      name: 'EAS CLI',
      status: 'fail',
      message: 'EAS CLI is not installed',
      fix: 'npm install -g eas-cli',
      autoFixable: true,
    };
  }

  const version = await getEasCliVersion();
  if (version) {
    const major = parseInt(version.split('.')[0], 10);
    if (major >= 10) {
      return {
        name: 'EAS CLI',
        status: 'pass',
        message: `EAS CLI v${version} installed`,
      };
    }

    return {
      name: 'EAS CLI',
      status: 'warn',
      message: `EAS CLI v${version} installed, but >= 10.0.0 is recommended`,
      fix: 'npm install -g eas-cli@latest',
      autoFixable: true,
    };
  }

  return {
    name: 'EAS CLI',
    status: 'pass',
    message: 'EAS CLI installed (version unknown)',
  };
}

/**
 * Check if Expo CLI is installed
 */
export async function checkExpoCli(): Promise<PrerequisiteResult> {
  const installed = await commandExists('npx');

  if (!installed) {
    return {
      name: 'Expo CLI',
      status: 'warn',
      message: 'npx not found — Expo CLI may not be available',
      fix: 'Ensure npm/npx is installed with Node.js',
    };
  }

  return {
    name: 'Expo CLI',
    status: 'pass',
    message: 'npx available (Expo CLI accessible via npx expo)',
  };
}

/**
 * Check EAS login status
 */
export async function checkEasLogin(): Promise<PrerequisiteResult> {
  try {
    // Uses hardcoded command - no user input injection risk
    const result = await exec('eas whoami', { silent: true, timeout: 10000 });

    if (result.code === 0 && result.stdout.trim()) {
      return {
        name: 'EAS Login',
        status: 'pass',
        message: `Logged in as ${result.stdout.trim()}`,
      };
    }

    return {
      name: 'EAS Login',
      status: 'warn',
      message: 'Not logged in to EAS',
      fix: 'eas login',
      autoFixable: true,
    };
  } catch {
    return {
      name: 'EAS Login',
      status: 'warn',
      message: 'Could not check EAS login status',
      fix: 'eas login',
      autoFixable: true,
    };
  }
}

/**
 * Run all prerequisite checks
 */
export async function checkAllPrerequisites(): Promise<PrerequisiteResult[]> {
  const results = await Promise.all([
    checkNodeVersion(),
    checkEasCli(),
    checkExpoCli(),
    checkEasLogin(),
  ]);

  return results;
}

/**
 * Check if all prerequisites pass (no failures)
 */
export function hasFailures(results: PrerequisiteResult[]): boolean {
  return results.some((r) => r.status === 'fail');
}

/**
 * Get auto-fixable failures/warnings
 */
export function getAutoFixable(results: PrerequisiteResult[]): PrerequisiteResult[] {
  return results.filter((r) => r.autoFixable && r.status !== 'pass');
}

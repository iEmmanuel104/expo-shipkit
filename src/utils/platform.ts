import * as os from 'os';

/**
 * Get the current operating system
 */
export function getOS(): 'windows' | 'macos' | 'linux' {
  const platform = os.platform();
  switch (platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    default:
      return 'linux';
  }
}

/**
 * Check if running on Windows
 */
export function isWindows(): boolean {
  return os.platform() === 'win32';
}

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
  return os.platform() === 'darwin';
}

/**
 * Check if running on Linux
 */
export function isLinux(): boolean {
  return os.platform() === 'linux';
}

/**
 * Get the home directory
 */
export function getHomeDir(): string {
  return os.homedir();
}

/**
 * Check if iOS development is possible (macOS only)
 */
export function canBuildIOS(): boolean {
  return isMacOS();
}

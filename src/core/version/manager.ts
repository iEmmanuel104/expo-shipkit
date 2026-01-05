import * as path from 'path';
import { readJsonFile, writeJsonFile } from '../../utils/fs.js';
import type { VersionBumpType, VersionBumpResult } from '../../types/deployment.js';
import type { ExpoAppJson } from '../../types/eas.js';

/**
 * Version manager class
 */
export class VersionManager {
  private projectRoot: string;
  private appJsonPath: string;
  private packageJsonPath: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot ?? process.cwd();
    this.appJsonPath = path.join(this.projectRoot, 'app.json');
    this.packageJsonPath = path.join(this.projectRoot, 'package.json');
  }

  /**
   * Get current version from app.json
   */
  public getCurrentVersion(): string {
    const appJson = readJsonFile<ExpoAppJson>(this.appJsonPath);
    return appJson?.expo?.version ?? '0.0.0';
  }

  /**
   * Parse version string into parts
   */
  private parseVersion(version: string): [number, number, number] {
    const parts = version.split('.').map(Number);
    return [
      parts[0] ?? 0,
      parts[1] ?? 0,
      parts[2] ?? 0,
    ];
  }

  /**
   * Calculate new version based on bump type
   */
  public calculateNewVersion(currentVersion: string, type: VersionBumpType): string {
    if (type === 'none') {
      return currentVersion;
    }

    const [major, minor, patch] = this.parseVersion(currentVersion);

    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default:
        return currentVersion;
    }
  }

  /**
   * Bump version in both app.json and package.json
   */
  public bump(type: VersionBumpType): VersionBumpResult {
    const oldVersion = this.getCurrentVersion();

    if (type === 'none') {
      return { oldVersion, newVersion: oldVersion };
    }

    const newVersion = this.calculateNewVersion(oldVersion, type);

    // Update app.json
    const appJson = readJsonFile<ExpoAppJson>(this.appJsonPath);
    if (appJson) {
      appJson.expo.version = newVersion;
      writeJsonFile(this.appJsonPath, appJson);
    }

    // Update package.json
    const packageJson = readJsonFile<{ version: string }>(this.packageJsonPath);
    if (packageJson) {
      packageJson.version = newVersion;
      writeJsonFile(this.packageJsonPath, packageJson);
    }

    return { oldVersion, newVersion };
  }

  /**
   * Set specific version
   */
  public setVersion(version: string): string {
    // Validate version format
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      throw new Error(`Invalid version format: ${version}. Expected format: x.y.z`);
    }

    // Update app.json
    const appJson = readJsonFile<ExpoAppJson>(this.appJsonPath);
    if (appJson) {
      appJson.expo.version = version;
      writeJsonFile(this.appJsonPath, appJson);
    }

    // Update package.json
    const packageJson = readJsonFile<{ version: string }>(this.packageJsonPath);
    if (packageJson) {
      packageJson.version = version;
      writeJsonFile(this.packageJsonPath, packageJson);
    }

    return version;
  }

  /**
   * Get version parts as object
   */
  public getVersionParts(): { major: number; minor: number; patch: number } {
    const [major, minor, patch] = this.parseVersion(this.getCurrentVersion());
    return { major, minor, patch };
  }
}

/**
 * Compare two version strings
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const aVal = aParts[i] ?? 0;
    const bVal = bParts[i] ?? 0;

    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
  }

  return 0;
}

/**
 * Check if version a is greater than version b
 */
export function isNewerVersion(a: string, b: string): boolean {
  return compareVersions(a, b) > 0;
}

/**
 * Supported platforms
 */
export type Platform = 'ios' | 'android';

/**
 * Deployment profiles
 */
export type Profile = 'development' | 'preview' | 'staging' | 'production';

/**
 * Deployment action types
 */
export type DeployAction = 'build' | 'build+submit' | 'submit';

/**
 * Version bump types
 */
export type VersionBumpType = 'patch' | 'minor' | 'major' | 'none';

/**
 * Profile deployment status (null if not deployed)
 */
export interface ProfileDeploymentStatus {
  preview: string | null;
  production: string | null;
  staging?: string | null;
  development?: string | null;
}

/**
 * Deployment record for a single version
 */
export interface DeploymentRecord {
  ios: ProfileDeploymentStatus;
  android: ProfileDeploymentStatus;
}

/**
 * Platform configuration snapshot
 */
export interface PlatformConfigSnapshot {
  android: Record<string, unknown>;
  ios: Record<string, unknown>;
}

/**
 * Full deployment history structure
 */
export interface DeploymentHistory {
  versions: Record<string, DeploymentRecord>;
  lastConfig: PlatformConfigSnapshot;
}

/**
 * Configuration change detection result
 */
export interface ConfigChange {
  key: string;
  from: unknown;
  to: unknown;
}

/**
 * Deployment parameters for a deployment run
 */
export interface DeploymentParams {
  action: DeployAction;
  versionBump: VersionBumpType;
  platforms: Platform[];
  profile: Profile;
  clearCache: Record<Platform, boolean>;
  targetVersion: string;
}

/**
 * Deployment summary for confirmation display
 */
export interface DeploymentSummary {
  currentVersion: string;
  targetVersion: string;
  platforms: Platform[];
  profile: Profile;
  action: DeployAction;
  willClearCache: Platform[];
}

/**
 * Sync warning for platform deployment status
 */
export interface SyncWarning {
  message: string;
  platform: Platform;
  profile: Profile;
}

/**
 * Version bump result
 */
export interface VersionBumpResult {
  oldVersion: string;
  newVersion: string;
}

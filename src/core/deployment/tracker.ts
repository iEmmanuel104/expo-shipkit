import * as path from 'path';
import { readJsonFile, writeJsonFile, fileExists } from '../../utils/fs.js';
import type {
  Platform,
  Profile,
  DeploymentHistory,
  DeploymentRecord,
  ProfileDeploymentStatus,
  SyncWarning,
} from '../../types/deployment.js';

const DEPLOYMENTS_FILE = '.deployments.json';

/**
 * Default empty deployment record
 */
function createEmptyDeploymentRecord(): DeploymentRecord {
  return {
    ios: { preview: null, production: null },
    android: { preview: null, production: null },
  };
}

/**
 * Default empty deployment history
 */
function createEmptyDeploymentHistory(): DeploymentHistory {
  return {
    versions: {},
    lastConfig: {
      android: {},
      ios: {},
    },
  };
}

/**
 * Deployment tracker class
 */
export class DeploymentTracker {
  private projectRoot: string;
  private deploymentsPath: string;
  private data: DeploymentHistory;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot ?? process.cwd();
    this.deploymentsPath = path.join(this.projectRoot, DEPLOYMENTS_FILE);
    this.data = this.load();
  }

  /**
   * Load deployment history from file
   */
  private load(): DeploymentHistory {
    if (!fileExists(this.deploymentsPath)) {
      return createEmptyDeploymentHistory();
    }

    const data = readJsonFile<DeploymentHistory>(this.deploymentsPath);
    return data ?? createEmptyDeploymentHistory();
  }

  /**
   * Save deployment history to file
   */
  private save(): void {
    writeJsonFile(this.deploymentsPath, this.data);
  }

  /**
   * Check if deployments file exists
   */
  public exists(): boolean {
    return fileExists(this.deploymentsPath);
  }

  /**
   * Initialize empty deployments file
   */
  public initialize(): void {
    this.data = createEmptyDeploymentHistory();
    this.save();
  }

  /**
   * Get deployment record for a specific version
   */
  public getVersionStatus(version: string): DeploymentRecord {
    return this.data.versions[version] ?? createEmptyDeploymentRecord();
  }

  /**
   * Update deployment status for a version/platform/profile
   */
  public updateStatus(version: string, platform: Platform, profile: Profile): void {
    if (!this.data.versions[version]) {
      this.data.versions[version] = createEmptyDeploymentRecord();
    }

    this.data.versions[version][platform][profile as keyof ProfileDeploymentStatus] = new Date().toISOString();
    this.save();
  }

  /**
   * Get last deployed config for a platform
   */
  public getLastConfig(platform: Platform): Record<string, unknown> {
    return this.data.lastConfig[platform] ?? {};
  }

  /**
   * Update last deployed config for a platform
   */
  public updateLastConfig(platform: Platform, config: Record<string, unknown>): void {
    this.data.lastConfig[platform] = config;
    this.save();
  }

  /**
   * Get all tracked versions
   */
  public getAllVersions(): string[] {
    return Object.keys(this.data.versions).sort((a, b) => {
      // Sort versions in descending order (newest first)
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);

      for (let i = 0; i < 3; i++) {
        if ((aParts[i] ?? 0) !== (bParts[i] ?? 0)) {
          return (bParts[i] ?? 0) - (aParts[i] ?? 0);
        }
      }
      return 0;
    });
  }

  /**
   * Check for sync warnings between platforms
   */
  public checkSyncWarnings(version: string, platform: Platform, profile: Profile): SyncWarning[] {
    const warnings: SyncWarning[] = [];
    const status = this.getVersionStatus(version);

    // Check if other platform is deployed but not this one
    const otherPlatform: Platform = platform === 'ios' ? 'android' : 'ios';
    const otherDeployedAt = status[otherPlatform][profile as keyof ProfileDeploymentStatus];
    const thisDeployedAt = status[platform][profile as keyof ProfileDeploymentStatus];

    if (otherDeployedAt && !thisDeployedAt) {
      warnings.push({
        message: `${otherPlatform} ${profile} was deployed on ${formatDate(otherDeployedAt)}`,
        platform: otherPlatform,
        profile,
      });
    }

    // Check if already deployed
    if (thisDeployedAt) {
      warnings.push({
        message: `${platform} ${profile} already deployed on ${formatDate(thisDeployedAt)}`,
        platform,
        profile,
      });
    }

    return warnings;
  }

  /**
   * Get platforms missing deployment for a profile
   */
  public getMissingPlatforms(version: string, profile: Profile): Platform[] {
    const status = this.getVersionStatus(version);
    const missing: Platform[] = [];

    if (!status.ios[profile as keyof ProfileDeploymentStatus] && status.android[profile as keyof ProfileDeploymentStatus]) {
      missing.push('ios');
    }
    if (!status.android[profile as keyof ProfileDeploymentStatus] && status.ios[profile as keyof ProfileDeploymentStatus]) {
      missing.push('android');
    }

    return missing;
  }

  /**
   * Get raw deployment data
   */
  public getData(): DeploymentHistory {
    return this.data;
  }
}

/**
 * Format ISO date string for display
 */
export function formatDate(isoString: string | null): string {
  if (!isoString) return 'Not deployed';
  const date = new Date(isoString);
  return date.toLocaleString();
}

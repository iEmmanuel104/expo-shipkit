/**
 * EAS Build profile configuration
 */
export interface EasBuildProfile {
  distribution?: 'internal' | 'store' | 'simulator';
  channel?: string;
  developmentClient?: boolean;
  autoIncrement?: boolean | 'version' | 'buildNumber';
  env?: Record<string, string>;
  ios?: {
    image?: string;
    simulator?: boolean;
    buildNumberOffset?: number;
    resourceClass?: string;
  };
  android?: {
    image?: string;
    buildType?: 'apk' | 'app-bundle';
    buildNumberOffset?: number;
    resourceClass?: string;
  };
}

/**
 * EAS Submit profile configuration
 */
export interface EasSubmitProfile {
  ios?: {
    ascAppId?: string;
    appleId?: string;
    appleTeamId?: string;
    ascApiKeyPath?: string;
    ascApiIssuerId?: string;
    ascApiKeyId?: string;
  };
  android?: {
    serviceAccountKeyPath?: string;
    track?: 'internal' | 'alpha' | 'beta' | 'production';
    releaseStatus?: 'draft' | 'completed' | 'halted' | 'inProgress';
    changesNotSentForReview?: boolean;
  };
}

/**
 * Full EAS configuration structure
 */
export interface EasConfig {
  cli?: {
    version?: string;
    appVersionSource?: 'local' | 'remote';
    requireCommit?: boolean;
  };
  build?: Record<string, EasBuildProfile>;
  submit?: Record<string, EasSubmitProfile>;
}

/**
 * Expo app.json structure (relevant parts)
 */
export interface ExpoAppJson {
  expo: {
    name: string;
    slug: string;
    version: string;
    owner?: string;
    extra?: {
      eas?: {
        projectId?: string;
      };
    };
    ios?: {
      bundleIdentifier?: string;
      buildNumber?: string;
      deploymentTarget?: string;
      supportsTablet?: boolean;
    };
    android?: {
      package?: string;
      versionCode?: number;
      adaptiveIcon?: {
        foregroundImage?: string;
        backgroundColor?: string;
      };
    };
    plugins?: Array<string | [string, Record<string, unknown>]>;
  };
}

/**
 * Build properties plugin configuration
 */
export interface ExpoBuildPropertiesConfig {
  android?: {
    minSdkVersion?: number;
    targetSdkVersion?: number;
    compileSdkVersion?: number;
    buildToolsVersion?: string;
    kotlinVersion?: string;
  };
  ios?: {
    deploymentTarget?: string;
    useFrameworks?: 'static' | 'dynamic';
  };
}

/**
 * EAS build status from CLI
 */
export interface EasBuildStatus {
  id: string;
  status: 'new' | 'in-queue' | 'in-progress' | 'errored' | 'finished' | 'canceled';
  platform: 'ios' | 'android';
  artifacts?: {
    buildUrl?: string;
    applicationArchiveUrl?: string;
  };
  createdAt: string;
  completedAt?: string;
  error?: {
    message: string;
    errorCode: string;
  };
}

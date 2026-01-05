/**
 * expo-shipkit
 * Streamlined deployment workflow for Expo/EAS applications
 */

// Configuration
export { defineConfig, ShipkitConfigSchema } from './types/config.js';
export type { ShipkitConfig, HooksConfig, DisplayConfig } from './types/config.js';

// Core functionality
export { loadConfig, isInitialized, isExpoProject, loadAppJson, loadEasJson } from './core/config/loader.js';
export { generateConfigContent, defaultConfig } from './core/config/defaults.js';

// Deployment
export { DeploymentTracker, formatDate } from './core/deployment/tracker.js';
export { detectConfigChanges, readCurrentPlatformConfig } from './core/deployment/config-detector.js';
export { runBuild, buildEasCommand } from './core/deployment/builder.js';
export { runSubmit, buildSubmitCommand } from './core/deployment/submitter.js';

// Version management
export { VersionManager, compareVersions, isNewerVersion } from './core/version/manager.js';

// Credentials
export {
  checkAppleCredentials,
  validateAppleCredentials,
  updateAppleCredentials,
  getAppleSetupInstructions,
} from './core/credentials/apple.js';
export {
  checkGoogleCredentials,
  validateGoogleCredentials,
  updateGoogleCredentials,
  getGoogleSetupInstructions,
} from './core/credentials/google.js';

// Types
export type {
  Platform,
  Profile,
  DeployAction,
  VersionBumpType,
  DeploymentRecord,
  DeploymentHistory,
  ConfigChange,
  DeploymentParams,
  DeploymentSummary,
  SyncWarning,
  VersionBumpResult,
} from './types/deployment.js';

export type {
  EasConfig,
  EasBuildProfile,
  EasSubmitProfile,
  ExpoAppJson,
  ExpoBuildPropertiesConfig,
} from './types/eas.js';

// UI utilities (for extending)
export { logger, colors } from './ui/logger.js';
export { createSpinner, withSpinner, SpinnerManager } from './ui/spinner.js';

// Utility functions
export { exec, execInteractive, commandExists, isEasCliInstalled, getEasCliVersion } from './utils/exec.js';
export { readJsonFile, writeJsonFile, fileExists, findProjectRoot } from './utils/fs.js';
export { getOS, isWindows, isMacOS, isLinux, canBuildIOS } from './utils/platform.js';

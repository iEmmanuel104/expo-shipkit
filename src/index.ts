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
export { loadEnvFiles, parseEnvFile } from './core/config/environment.js';

// Deployment
export { DeploymentTracker, formatDate } from './core/deployment/tracker.js';
export { detectConfigChanges, readCurrentPlatformConfig } from './core/deployment/config-detector.js';
export { runBuild, buildEasCommand } from './core/deployment/builder.js';
export type { BuildResult } from './core/deployment/builder.js';
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

// Prerequisites
export {
  checkAllPrerequisites,
  checkNodeVersion,
  checkEasCli,
  checkExpoCli,
  checkEasLogin,
  hasFailures,
  getAutoFixable,
} from './core/prerequisites/checker.js';
export type { PrerequisiteResult } from './core/prerequisites/checker.js';
export { autoFix, autoFixAll } from './core/prerequisites/installer.js';

// Generators
export {
  generateEasJson,
  getDefaultEasJson,
  validateEasJson,
  detectAppJsonGaps,
  fixAppJsonGaps,
  suggestBundleIdentifier,
  suggestAndroidPackage,
  generateEnvTemplate,
  updateGitignore,
  hasAllCredentialPatterns,
  generateCiTemplate,
} from './core/generators/index.js';
export type { AppJsonGap, AppJsonFixes } from './core/generators/app-json.js';

// Doctor
export {
  runDoctorChecks,
  runEnvironmentChecks,
  runProjectChecks,
  runCredentialChecks,
  runSecurityChecks,
} from './core/doctor/index.js';
export type { CheckCategory, DoctorCheckResult, DoctorSummary } from './core/doctor/index.js';

// Errors
export { findSuggestions, getBestSuggestion } from './core/errors/suggestions.js';
export type { ErrorSuggestion } from './core/errors/suggestions.js';

// Security
export { runSecurityAudit, hasCriticalIssues, validateP8Structure } from './core/security/audit.js';
export type { AuditResult } from './core/security/audit.js';

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
export {
  displayDoctorResults,
  displayPrerequisiteResults,
  displaySecurityAudit,
  displayErrorSuggestions,
} from './ui/display.js';

// Utility functions
export { exec, execInteractive, commandExists, isEasCliInstalled, getEasCliVersion } from './utils/exec.js';
export { readJsonFile, writeJsonFile, fileExists, findProjectRoot } from './utils/fs.js';
export { getOS, isWindows, isMacOS, isLinux, canBuildIOS } from './utils/platform.js';

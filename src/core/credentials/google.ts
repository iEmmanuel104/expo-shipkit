import * as path from 'path';
import { fileExists, readJsonFile, writeJsonFile } from '../../utils/fs.js';
import type { EasConfig } from '../../types/eas.js';

export interface GoogleCredentials {
  serviceAccountKeyPath?: string;
  track?: 'internal' | 'alpha' | 'beta' | 'production';
  releaseStatus?: 'draft' | 'completed' | 'halted' | 'inProgress';
}

export interface GoogleServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

/**
 * Check if Google credentials are configured in eas.json
 */
export function checkGoogleCredentials(projectRoot?: string): GoogleCredentials | null {
  const cwd = projectRoot ?? process.cwd();
  const easJsonPath = path.join(cwd, 'eas.json');

  if (!fileExists(easJsonPath)) {
    return null;
  }

  const easJson = readJsonFile<EasConfig>(easJsonPath);
  if (!easJson?.submit?.production?.android) {
    return null;
  }

  const androidSubmit = easJson.submit.production.android;

  return {
    serviceAccountKeyPath: androidSubmit.serviceAccountKeyPath,
    track: androidSubmit.track,
    releaseStatus: androidSubmit.releaseStatus,
  };
}

/**
 * Check if Google service account key file exists
 */
export function checkGoogleKeyFile(keyPath: string, projectRoot?: string): boolean {
  const cwd = projectRoot ?? process.cwd();
  const fullPath = path.isAbsolute(keyPath) ? keyPath : path.join(cwd, keyPath);
  return fileExists(fullPath);
}

/**
 * Validate Google service account key file
 */
export function validateGoogleKeyFile(keyPath: string, projectRoot?: string): string[] {
  const cwd = projectRoot ?? process.cwd();
  const fullPath = path.isAbsolute(keyPath) ? keyPath : path.join(cwd, keyPath);
  const errors: string[] = [];

  if (!fileExists(fullPath)) {
    errors.push(`Service account key file not found: ${keyPath}`);
    return errors;
  }

  const keyFile = readJsonFile<GoogleServiceAccountKey>(fullPath);

  if (!keyFile) {
    errors.push('Service account key file is not valid JSON');
    return errors;
  }

  if (keyFile.type !== 'service_account') {
    errors.push('Key file is not a service account key (type should be "service_account")');
  }

  if (!keyFile.client_email) {
    errors.push('Service account email (client_email) is missing');
  }

  if (!keyFile.private_key) {
    errors.push('Private key is missing from service account file');
  }

  return errors;
}

/**
 * Validate Google credentials configuration
 */
export function validateGoogleCredentials(credentials: GoogleCredentials, projectRoot?: string): string[] {
  const errors: string[] = [];

  if (!credentials.serviceAccountKeyPath) {
    errors.push('Service account key path is not configured');
    return errors;
  }

  const keyErrors = validateGoogleKeyFile(credentials.serviceAccountKeyPath, projectRoot);
  errors.push(...keyErrors);

  return errors;
}

/**
 * Update Google credentials in eas.json
 */
export function updateGoogleCredentials(
  credentials: GoogleCredentials,
  profile: string = 'production',
  projectRoot?: string
): void {
  const cwd = projectRoot ?? process.cwd();
  const easJsonPath = path.join(cwd, 'eas.json');

  const easJson = readJsonFile<EasConfig>(easJsonPath) ?? { submit: {} };

  if (!easJson.submit) {
    easJson.submit = {};
  }

  if (!easJson.submit[profile]) {
    easJson.submit[profile] = {};
  }

  easJson.submit[profile].android = {
    ...easJson.submit[profile].android,
    ...credentials,
  };

  writeJsonFile(easJsonPath, easJson);
}

/**
 * Get Google Play credential setup instructions
 */
export function getGoogleSetupInstructions(): string {
  return `
Google Play Service Account Setup
==================================

Step 1: Create Google Cloud Project
1. Go to Google Cloud Console (https://console.cloud.google.com)
2. Create a new project or select existing one
3. Note the project name

Step 2: Enable API
1. Go to APIs & Services → Library
2. Search for "Google Play Android Developer API"
3. Click Enable

Step 3: Create Service Account
1. Go to APIs & Services → Credentials
2. Click "Create Credentials" → "Service Account"
3. Fill in:
   - Name: "EAS Submit"
   - ID: auto-generated
4. Click "Create and Continue"
5. Skip role assignment, click "Done"

Step 4: Generate Key
1. Click on the created service account
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Select JSON format
5. Click "Create" - key file downloads automatically

Step 5: Link to Play Console
1. Go to Google Play Console (https://play.google.com/console)
2. Go to Settings → Users and permissions
3. Click "Invite new users"
4. Enter the service account email (from JSON file: client_email)
5. Grant "Admin" or appropriate permissions
6. Click "Invite"

After setup:
1. Create a "keys" folder in your project root
2. Move the JSON key file there (e.g., ./keys/google-play-key.json)
3. Run: shipkit credentials setup --platform android

For more info: https://docs.expo.dev/submit/android/
`;
}

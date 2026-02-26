import * as path from 'path';
import { fileExists, readJsonFile, writeJsonFile, readFile } from '../../utils/fs.js';
import type { EasConfig } from '../../types/eas.js';

export interface AppleCredentials {
  ascAppId?: string;
  ascApiKeyPath?: string;
  ascApiIssuerId?: string;
  ascApiKeyId?: string;
  appleId?: string;
  appleTeamId?: string;
}

/**
 * Check if Apple credentials are configured in eas.json
 */
export function checkAppleCredentials(projectRoot?: string): AppleCredentials | null {
  const cwd = projectRoot ?? process.cwd();
  const easJsonPath = path.join(cwd, 'eas.json');

  if (!fileExists(easJsonPath)) {
    return null;
  }

  const easJson = readJsonFile<EasConfig>(easJsonPath);
  if (!easJson?.submit?.production?.ios) {
    return null;
  }

  const iosSubmit = easJson.submit.production.ios;

  return {
    ascAppId: iosSubmit.ascAppId,
    ascApiKeyPath: iosSubmit.ascApiKeyPath,
    ascApiIssuerId: iosSubmit.ascApiIssuerId,
    ascApiKeyId: iosSubmit.ascApiKeyId,
    appleId: iosSubmit.appleId,
    appleTeamId: iosSubmit.appleTeamId,
  };
}

/**
 * Check if Apple API Key file exists
 */
export function checkAppleApiKeyFile(keyPath: string, projectRoot?: string): boolean {
  const cwd = projectRoot ?? process.cwd();
  const fullPath = path.isAbsolute(keyPath) ? keyPath : path.join(cwd, keyPath);
  return fileExists(fullPath);
}

/**
 * Validate Apple credentials configuration
 */
export function validateAppleCredentials(credentials: AppleCredentials, projectRoot?: string): string[] {
  const errors: string[] = [];

  if (!credentials.ascAppId) {
    errors.push('App Store Connect App ID (ascAppId) is not configured');
  }

  if (credentials.ascApiKeyPath) {
    const cwd = projectRoot ?? process.cwd();
    const fullPath = path.isAbsolute(credentials.ascApiKeyPath)
      ? credentials.ascApiKeyPath
      : path.join(cwd, credentials.ascApiKeyPath);

    if (!checkAppleApiKeyFile(credentials.ascApiKeyPath, projectRoot)) {
      errors.push(`API Key file not found: ${credentials.ascApiKeyPath}`);
    } else {
      // Validate .p8 file structure (PEM format check)
      const content = readFile(fullPath);
      if (content) {
        const trimmed = content.trim();
        if (!trimmed.startsWith('-----BEGIN PRIVATE KEY-----') || !trimmed.endsWith('-----END PRIVATE KEY-----')) {
          errors.push('API Key file does not appear to be a valid .p8 key (missing PEM headers)');
        }
      }
    }

    if (!credentials.ascApiIssuerId) {
      errors.push('API Key Issuer ID (ascApiIssuerId) is required when using API Key');
    }

    if (!credentials.ascApiKeyId) {
      errors.push('API Key ID (ascApiKeyId) is required when using API Key');
    }
  }

  return errors;
}

/**
 * Update Apple credentials in eas.json
 */
export function updateAppleCredentials(
  credentials: AppleCredentials,
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

  easJson.submit[profile].ios = {
    ...easJson.submit[profile].ios,
    ...credentials,
  };

  writeJsonFile(easJsonPath, easJson);
}

/**
 * Get Apple credential setup instructions
 */
export function getAppleSetupInstructions(): string {
  return `
Apple App Store Connect API Key Setup
=====================================

1. Go to App Store Connect (https://appstoreconnect.apple.com)
2. Navigate to Users and Access → Keys (under Integrations)
3. Click "Generate a Key" or "+" button
4. Enter a name (e.g., "EAS Submit API Key")
5. Select "App Manager" role (recommended)
6. Click "Generate"
7. Download the .p8 file immediately (can only be downloaded once!)
8. Note down:
   - Issuer ID (shown at the top of the Keys page)
   - Key ID (shown next to your key name)

After generating the key:
1. Create a "keys" folder in your project root
2. Move the .p8 file there (e.g., ./keys/AuthKey_XXXXXX.p8)
3. Run: shipkit credentials setup --platform ios

For more info: https://docs.expo.dev/submit/ios/
`;
}

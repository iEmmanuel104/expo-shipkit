import * as path from 'path';
import { fileExists, writeFile } from '../../utils/fs.js';

/**
 * Default .env.example content
 */
export function getEnvTemplateContent(): string {
  return `# Expo / EAS Configuration
# Copy this file to .env and fill in your values

# EAS Project ID (from eas.json or expo.dev dashboard)
# EXPO_PUBLIC_EAS_PROJECT_ID=

# App Environment
# EXPO_PUBLIC_APP_ENV=development

# API Configuration
# EXPO_PUBLIC_API_URL=https://api.example.com

# Sentry (optional)
# SENTRY_DSN=
# SENTRY_AUTH_TOKEN=

# Analytics (optional)
# EXPO_PUBLIC_ANALYTICS_KEY=
`;
}

/**
 * Generate .env.example file
 */
export function generateEnvTemplate(projectRoot?: string): boolean {
  const cwd = projectRoot ?? process.cwd();
  const envPath = path.join(cwd, '.env.example');

  if (fileExists(envPath)) {
    return false;
  }

  writeFile(envPath, getEnvTemplateContent());
  return true;
}

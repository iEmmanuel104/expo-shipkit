# expo-shipkit

Streamlined deployment workflow for Expo/EAS applications.

[![npm version](https://badge.fury.io/js/expo-shipkit.svg)](https://www.npmjs.com/package/expo-shipkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Interactive Deployment Wizard** - Guided prompts for version bumping, platform selection, and profile choice
- **Deployment Tracking** - Automatically tracks what versions have been deployed to which platforms/profiles
- **Config Change Detection** - Detects SDK version changes and prompts to clear build cache
- **Sync Warnings** - Alerts when platforms are out of sync for a version
- **Credential Management** - Interactive setup for Apple and Google Play store credentials
- **Hooks Support** - Run custom scripts before/after build and submit
- **TypeScript Support** - Full type safety with TypeScript configuration

## Installation

```bash
npm install -D expo-shipkit
# or
yarn add -D expo-shipkit
```

## Quick Start

1. **Initialize in your Expo project:**

```bash
npx shipkit init
```

This creates:
- `shipkit.config.ts` - Configuration file
- `.deployments.json` - Deployment tracking file
- npm scripts in `package.json`

2. **Deploy your app:**

```bash
yarn deploy
# or
npx shipkit deploy
```

3. **Check deployment status:**

```bash
yarn deploy:status
# or
npx shipkit status
```

## Commands

### `shipkit init`

Initialize expo-shipkit in your Expo project.

```bash
npx shipkit init [options]

Options:
  -f, --force      Overwrite existing configuration
  --skip-scripts   Skip adding npm scripts to package.json
```

### `shipkit deploy`

Start the interactive deployment wizard.

```bash
npx shipkit deploy [options]

Options:
  --platform <platform>     Target platform (ios|android|all)
  --profile <profile>       Build profile (preview|production)
  --version-bump <type>     Version bump type (patch|minor|major|none)
  --skip-build             Submit only, skip building
  --skip-submit            Build only, skip submitting
  -y, --yes                Skip confirmation prompts
```

### `shipkit status`

Show deployment status for all versions.

```bash
npx shipkit status [options]

Options:
  -v, --version <version>   Show status for specific version
  --json                    Output as JSON
  --all                     Show all versions
```

### `shipkit version`

Manage app version.

```bash
npx shipkit version [type] [options]

Arguments:
  type               Bump type: patch | minor | major

Options:
  --get              Get current version
  --set <version>    Set specific version (e.g., 1.2.3)
```

### `shipkit credentials`

Manage store credentials for automated submissions.

```bash
# Interactive setup
npx shipkit credentials setup [--platform ios|android]

# Check credential status
npx shipkit credentials check

# Show setup guide
npx shipkit credentials guide [--platform ios|android]
```

## Configuration

Create a `shipkit.config.ts` in your project root:

```typescript
import { defineConfig } from 'expo-shipkit';

export default defineConfig({
  projectName: 'MyApp',

  platforms: {
    ios: true,
    android: true,
  },

  profiles: ['preview', 'production'],

  // Config keys to track for cache invalidation
  criticalConfig: {
    android: ['minSdkVersion', 'targetSdkVersion', 'compileSdkVersion'],
    ios: ['deploymentTarget'],
  },

  build: {
    android: { nonInteractive: true },  // Uses service account
    ios: { nonInteractive: false },     // May prompt for credentials
    autoClearCache: true,               // Auto-clear on config changes
  },

  // Store submission config
  submit: {
    android: {
      track: 'internal',
      releaseStatus: 'draft',
      serviceAccountKeyPath: './keys/google-play-key.json',
    },
    ios: {
      ascAppId: '1234567890',
      ascApiKeyPath: './keys/AuthKey_XXXXX.p8',
      ascApiIssuerId: 'YOUR_ISSUER_ID',
      ascApiKeyId: 'YOUR_KEY_ID',
    },
  },

  // Custom hooks
  hooks: {
    preBuild: 'npm run type-check',
    postBuild: undefined,
    preSubmit: undefined,
    postSubmit: 'echo "Deployed!"',
  },

  display: {
    banner: 'MYAPP DEPLOYMENT',
    colors: true,
  },
});
```

## Store Credentials Setup

### Apple App Store

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **Users and Access → Keys**
3. Generate an API Key with "App Manager" role
4. Download the `.p8` file (one-time download!)
5. Note the Issuer ID and Key ID
6. Run: `npx shipkit credentials setup --platform ios`

### Google Play Store

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable Google Play Android Developer API
3. Create a Service Account with JSON key
4. Link the service account in [Play Console](https://play.google.com/console) → Settings → Users and permissions
5. Run: `npx shipkit credentials setup --platform android`

## Deployment Tracking

expo-shipkit tracks deployments in `.deployments.json`:

```json
{
  "versions": {
    "1.0.0": {
      "ios": {
        "preview": "2024-01-15T10:30:00.000Z",
        "production": "2024-01-16T14:00:00.000Z"
      },
      "android": {
        "preview": "2024-01-15T10:45:00.000Z",
        "production": null
      }
    }
  },
  "lastConfig": {
    "android": {
      "minSdkVersion": 24,
      "targetSdkVersion": 35,
      "compileSdkVersion": 35
    },
    "ios": {
      "deploymentTarget": "15.1"
    }
  }
}
```

## Programmatic Usage

You can also use expo-shipkit programmatically:

```typescript
import {
  loadConfig,
  DeploymentTracker,
  VersionManager,
  runBuild,
} from 'expo-shipkit';

// Load configuration
const config = await loadConfig();

// Track deployments
const tracker = new DeploymentTracker();
const status = tracker.getVersionStatus('1.0.0');

// Manage versions
const versionManager = new VersionManager();
versionManager.bump('patch');

// Run builds
await runBuild({
  platform: 'ios',
  profile: 'production',
});
```

## Requirements

- Node.js >= 18.0.0
- Expo project with `app.json`
- EAS CLI (`npm install -g eas-cli`)
- EAS account and project configuration

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a pull request.

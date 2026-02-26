import * as path from 'path';
import { fileExists, writeFile, ensureDir } from '../../utils/fs.js';

/**
 * Generate GitHub Actions workflow for EAS builds
 */
export function getGithubActionsWorkflow(): string {
  return `name: EAS Build & Submit

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      platform:
        description: 'Platform to build'
        required: true
        default: 'all'
        type: choice
        options:
          - all
          - ios
          - android
      profile:
        description: 'Build profile'
        required: true
        default: 'preview'
        type: choice
        options:
          - development
          - preview
          - production

permissions:
  contents: read

jobs:
  build:
    name: EAS Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: \${{ secrets.EXPO_TOKEN }}

      - name: Build
        run: |
          PLATFORM=\${{ github.event.inputs.platform || 'all' }}
          PROFILE=\${{ github.event.inputs.profile || 'preview' }}
          if [ "\$PLATFORM" = "all" ]; then
            eas build --platform all --profile "\$PROFILE" --non-interactive
          else
            eas build --platform "\$PLATFORM" --profile "\$PROFILE" --non-interactive
          fi
`;
}

/**
 * Generate GitHub Actions workflow file
 */
export function generateCiTemplate(projectRoot?: string): boolean {
  const cwd = projectRoot ?? process.cwd();
  const workflowDir = path.join(cwd, '.github', 'workflows');
  const workflowPath = path.join(workflowDir, 'eas-build.yml');

  if (fileExists(workflowPath)) {
    return false;
  }

  ensureDir(workflowDir);
  writeFile(workflowPath, getGithubActionsWorkflow());
  return true;
}

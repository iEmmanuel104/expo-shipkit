import { Command } from 'commander';
import { getPackageVersion } from '../utils/fs.js';
import { initCommand } from './commands/init.js';
import { deployCommand } from './commands/deploy.js';
import { statusCommand } from './commands/status.js';
import { versionCommand } from './commands/version.js';
import { credentialsCommand } from './commands/credentials.js';
import { doctorCommand } from './commands/doctor.js';

const program = new Command();

program
  .name('shipkit')
  .description('Streamlined deployment workflow for Expo/EAS applications')
  .version(getPackageVersion(), '-v, --version', 'Display version number');

// Add commands
program.addCommand(initCommand);
program.addCommand(deployCommand);
program.addCommand(statusCommand);
program.addCommand(versionCommand);
program.addCommand(credentialsCommand);
program.addCommand(doctorCommand);

// Default action (show help)
program.action(() => {
  program.help();
});

// Parse arguments
program.parse();

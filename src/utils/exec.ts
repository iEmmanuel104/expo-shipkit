import { spawn, SpawnOptions } from 'child_process';

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  silent?: boolean;
  timeout?: number;
}

/**
 * Execute a command and return the result
 */
export function exec(command: string, options: ExecOptions = {}): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const spawnOptions: SpawnOptions = {
      shell: true,
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: options.silent ? 'pipe' : 'inherit',
    };

    let stdout = '';
    let stderr = '';
    let timeoutId: NodeJS.Timeout | undefined;

    const child = spawn(command, spawnOptions);

    if (options.silent && child.stdout && child.stderr) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    if (options.timeout) {
      timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out after ${options.timeout}ms`));
      }, options.timeout);
    }

    child.on('close', (code) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve({
        code: code ?? 0,
        stdout,
        stderr,
      });
    });

    child.on('error', (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(error);
    });
  });
}

/**
 * Execute a command with inherited stdio (interactive)
 */
export function execInteractive(command: string, options: ExecOptions = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const spawnOptions: SpawnOptions = {
      shell: true,
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: 'inherit',
    };

    const child = spawn(command, spawnOptions);

    child.on('close', (code) => {
      resolve(code ?? 0);
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Check if a command exists in PATH
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    const checkCmd = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
    const result = await exec(checkCmd, { silent: true });
    return result.code === 0;
  } catch {
    return false;
  }
}

/**
 * Check if EAS CLI is installed
 */
export async function isEasCliInstalled(): Promise<boolean> {
  return commandExists('eas');
}

/**
 * Get EAS CLI version
 */
export async function getEasCliVersion(): Promise<string | null> {
  try {
    const result = await exec('eas --version', { silent: true });
    if (result.code === 0) {
      // Output is like "eas-cli/10.0.0 linux-x64 node-v20.0.0"
      const match = result.stdout.match(/eas-cli\/(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

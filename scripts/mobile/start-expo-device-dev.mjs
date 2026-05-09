#!/usr/bin/env node

import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function resolveHostMode(argv) {
  const hostIndex = argv.indexOf('--host');
  if (hostIndex >= 0 && typeof argv[hostIndex + 1] === 'string' && argv[hostIndex + 1].length > 0) {
    return argv[hostIndex + 1];
  }

  const hostFlag = argv.find((value) => value.startsWith('--host='));
  if (hostFlag) {
    return hostFlag.slice('--host='.length);
  }

  return 'tunnel';
}

function pickLanAddress() {
  const interfaces = networkInterfaces();
  const preferred = ['en0', 'en1', 'Ethernet', 'Wi-Fi'];

  for (const name of preferred) {
    const entries = interfaces[name] ?? [];
    for (const entry of entries) {
      if (entry && entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry && entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  return null;
}

const ipAddress = pickLanAddress();
if (!ipAddress) {
  console.error('mobile:dev:device could not determine a local IPv4 address.');
  console.error('Set EXPO_PUBLIC_API_BASE_URL manually or connect to a LAN interface.');
  process.exit(1);
}

const apiBaseUrl = `http://${ipAddress}:8788`;
const hostMode = resolveHostMode(process.argv.slice(2));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const mobileDir = path.resolve(repoRoot, 'apps/mobile');
const expoCliPath = path.resolve(mobileDir, 'node_modules', 'expo', 'bin', 'cli');

if (process.argv.includes('--print-only')) {
  console.log(apiBaseUrl);
  process.exit(0);
}

console.log(`[mobile:dev:device] Using EXPO_PUBLIC_API_BASE_URL=${apiBaseUrl}`);
console.log(`[mobile:dev:device] Starting Expo with --host ${hostMode}`);

const child = spawn(expoCliPath, ['start', '--dev-client', '--host', hostMode, '--port', '8081', '--clear'], {
  cwd: mobileDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

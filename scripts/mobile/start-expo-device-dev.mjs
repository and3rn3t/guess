#!/usr/bin/env node

import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

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

if (process.argv.includes('--print-only')) {
  console.log(apiBaseUrl);
  process.exit(0);
}

console.log(`[mobile:dev:device] Using EXPO_PUBLIC_API_BASE_URL=${apiBaseUrl}`);

const mobileDir = path.resolve(process.cwd(), 'apps/mobile');
const child = spawn(
  'pnpm',
  ['exec', 'expo', 'start', '--dev-client', '--host', 'lan', '--port', '8081', '--clear'],
  {
    cwd: mobileDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
    },
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

function escapeForRegex(filePath) {
  return filePath.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}

function folderPattern(folderName) {
  const absolutePath = path.join(workspaceRoot, folderName);
  return `^${escapeForRegex(absolutePath)}\/.*$`;
}

const config = getDefaultConfig(projectRoot);

// Reduce dev-client reload noise from non-mobile artifacts written elsewhere in the monorepo.
const blockedFolders = [
  folderPattern('dist'),
  folderPattern('coverage'),
  folderPattern('playwright-report'),
  folderPattern('test-results'),
  folderPattern('.wrangler')
].join('|');

config.resolver.blockList = new RegExp(blockedFolders);

module.exports = config;

#!/usr/bin/env node

const { execSync } = require('child_process');
const os = require('os');

console.log('🔍 Detecting platform...');
console.log('Platform:', os.platform());
console.log('Architecture:', os.arch());

try {
  console.log('📦 Installing Chrome for Puppeteer...');
  execSync('npx puppeteer browsers install chrome', { stdio: 'inherit' });
  console.log('✅ Chrome installed successfully!');
} catch (error) {
  console.error('❌ Failed to install Chrome:', error.message);
  process.exit(1);
}

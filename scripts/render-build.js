#!/usr/bin/env node

const { execSync } = require('child_process');
const os = require('os');

console.log('🚀 Starting Render.com build process...');
console.log('Platform:', os.platform());
console.log('Architecture:', os.arch());

try {
  // Install Chrome for Puppeteer
  console.log('📦 Installing Chrome for Puppeteer...');
  execSync('npx puppeteer browsers install chrome', { stdio: 'inherit' });
  console.log('✅ Chrome installed successfully!');
  
  // Build the Remix app
  console.log('🔨 Building Remix app...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

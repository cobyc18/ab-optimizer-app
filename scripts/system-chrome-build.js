#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Installing Chrome system-wide for Render.com...');

try {
  // Install system dependencies and Chrome for Selenium
  console.log('📦 Installing system dependencies for Selenium...');
  
  // Update package lists and install Chrome
  const installCommands = [
    'apt-get update',
    'apt-get install -y wget gnupg software-properties-common',
    'wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -',
    'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list',
    'apt-get update',
    'apt-get install -y google-chrome-stable chromium-browser'
  ];
  
  for (const cmd of installCommands) {
    try {
      console.log(`🔄 Running: ${cmd}`);
      execSync(cmd, { stdio: 'inherit', timeout: 300000 });
    } catch (error) {
      console.log(`⚠️ Command failed (this might be expected): ${error.message}`);
    }
  }
  
  // Verify Chrome installation
  try {
    execSync('google-chrome --version', { stdio: 'inherit' });
    console.log('✅ Chrome installed successfully!');
  } catch (error) {
    console.log('⚠️ Chrome verification failed, but continuing...');
  }
  
  // Install npm dependencies
  console.log('📦 Installing npm dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  
  // Build the app
  console.log('🔨 Building Remix app...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('✅ Build completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

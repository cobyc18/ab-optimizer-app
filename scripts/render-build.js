#!/usr/bin/env node

const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Render.com build process...');
console.log('Platform:', os.platform());
console.log('Architecture:', os.arch());
console.log('Node version:', process.version);

try {
  // Install system dependencies for Chrome on Linux
  if (os.platform() === 'linux') {
    console.log('🐧 Installing system dependencies for Chrome on Linux...');
    try {
      execSync('apt-get update && apt-get install -y wget gnupg', { stdio: 'inherit' });
      console.log('✅ System dependencies installed');
    } catch (sysError) {
      console.log('⚠️ Could not install system dependencies (this might be expected):', sysError.message);
    }
  }
  
  // Install Chrome for Puppeteer
  console.log('📦 Installing Chrome for Puppeteer...');
  try {
    execSync('npx puppeteer browsers install chrome', { 
      stdio: 'inherit',
      timeout: 300000 // 5 minutes timeout
    });
    console.log('✅ Chrome installed successfully!');
    
    // Verify Chrome installation
    const puppeteer = require('puppeteer');
    const executablePath = puppeteer.executablePath();
    console.log('🔍 Chrome executable path:', executablePath);
    
    if (fs.existsSync(executablePath)) {
      console.log('✅ Chrome executable found at expected path');
    } else {
      console.log('⚠️ Chrome executable not found at expected path');
    }
    
  } catch (chromeError) {
    console.error('❌ Chrome installation failed:', chromeError.message);
    console.log('🔄 Trying alternative Chrome installation...');
    
    // Try installing with different flags
    try {
      execSync('PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false npx puppeteer browsers install chrome', { 
        stdio: 'inherit',
        timeout: 300000
      });
      console.log('✅ Alternative Chrome installation successful!');
    } catch (altError) {
      console.error('❌ Alternative Chrome installation also failed:', altError.message);
      throw altError;
    }
  }
  
  // Build the Remix app
  console.log('🔨 Building Remix app...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

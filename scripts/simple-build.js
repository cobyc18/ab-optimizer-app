#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Simple build process for Render.com...');
console.log('Current working directory:', process.cwd());
console.log('Node version:', process.version);

try {
  // First, install dependencies
  console.log('📦 Installing npm dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed!');
  
  // Install Chrome for Puppeteer with verbose output
  console.log('📦 Installing Chrome for Puppeteer...');
  try {
    execSync('npx puppeteer browsers install chrome --verbose', { 
      stdio: 'inherit',
      timeout: 600000 // 10 minutes timeout
    });
    console.log('✅ Chrome installation completed!');
  } catch (chromeError) {
    console.error('❌ Chrome installation failed:', chromeError.message);
    console.log('🔄 Trying alternative installation method...');
    
    // Try with different flags
    try {
      execSync('PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false npx puppeteer browsers install chrome', { 
        stdio: 'inherit',
        timeout: 600000
      });
      console.log('✅ Alternative Chrome installation completed!');
    } catch (altError) {
      console.error('❌ Alternative Chrome installation also failed:', altError.message);
      console.log('⚠️ Continuing without Chrome - screenshots will use fallback');
    }
  }
  
  // Verify Chrome installation
  try {
    const puppeteer = require('puppeteer');
    const executablePath = puppeteer.executablePath();
    console.log('🔍 Chrome executable path:', executablePath);
    
    if (fs.existsSync(executablePath)) {
      console.log('✅ Chrome executable found and verified!');
    } else {
      console.log('⚠️ Chrome executable not found at expected path');
      console.log('📁 Checking cache directory...');
      const cacheDir = path.dirname(executablePath);
      if (fs.existsSync(cacheDir)) {
        console.log('📁 Cache directory exists:', cacheDir);
        const files = fs.readdirSync(cacheDir);
        console.log('📁 Files in cache:', files);
      } else {
        console.log('❌ Cache directory does not exist:', cacheDir);
      }
    }
  } catch (verifyError) {
    console.log('⚠️ Could not verify Chrome installation:', verifyError.message);
  }
  
  // Build the Remix app
  console.log('🔨 Building Remix app...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

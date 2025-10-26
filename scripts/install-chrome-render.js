#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Installing Chrome specifically for Render.com...');

try {
  // Set environment variables for Puppeteer
  process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'false';
  process.env.PUPPETEER_CACHE_DIR = '/opt/render/.cache/puppeteer';
  
  console.log('📦 Installing Chrome with specific cache directory...');
  
  // Try multiple installation methods
  const methods = [
    'npx puppeteer browsers install chrome',
    'npx puppeteer browsers install chrome@latest',
    'PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false npx puppeteer browsers install chrome'
  ];
  
  let success = false;
  for (const method of methods) {
    try {
      console.log(`🔄 Trying: ${method}`);
      execSync(method, { 
        stdio: 'inherit',
        timeout: 600000,
        env: { ...process.env }
      });
      console.log('✅ Chrome installation successful!');
      success = true;
      break;
    } catch (error) {
      console.log(`❌ Method failed: ${error.message}`);
    }
  }
  
  if (!success) {
    console.log('⚠️ All installation methods failed, but continuing...');
  }
  
  // Verify installation
  try {
    const puppeteer = require('puppeteer');
    const executablePath = puppeteer.executablePath();
    console.log('🔍 Chrome executable path:', executablePath);
    
    if (fs.existsSync(executablePath)) {
      console.log('✅ Chrome executable verified!');
    } else {
      console.log('⚠️ Chrome executable not found, but build will continue');
    }
  } catch (verifyError) {
    console.log('⚠️ Could not verify Chrome:', verifyError.message);
  }
  
} catch (error) {
  console.error('❌ Chrome installation failed:', error.message);
  process.exit(1);
}

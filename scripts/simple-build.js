#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 Simple build process for Render.com...');

try {
  // Install Chrome for Puppeteer with verbose output
  console.log('📦 Installing Chrome for Puppeteer...');
  execSync('npx puppeteer browsers install chrome --verbose', { 
    stdio: 'inherit',
    timeout: 600000 // 10 minutes timeout
  });
  console.log('✅ Chrome installation completed!');
  
  // Build the Remix app
  console.log('🔨 Building Remix app...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

#!/usr/bin/env node

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');

console.log('🧪 Testing Selenium WebDriver...');

async function testSelenium() {
  let driver;
  
  try {
    // Configure Chrome options
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments('--headless');
    chromeOptions.addArguments('--no-sandbox');
    chromeOptions.addArguments('--disable-dev-shm-usage');
    chromeOptions.addArguments('--disable-gpu');
    chromeOptions.addArguments('--window-size=800,600');
    
    // Try to find Chrome
    const chromePaths = [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    ];
    
    let chromeFound = false;
    for (const chromePath of chromePaths) {
      if (fs.existsSync(chromePath)) {
        console.log('🔍 Found Chrome at:', chromePath);
        chromeOptions.setChromeBinaryPath(chromePath);
        chromeFound = true;
        break;
      }
    }
    
    if (!chromeFound) {
      console.log('⚠️ No Chrome found, using system default');
    }
    
    // Create WebDriver
    console.log('🚀 Launching WebDriver...');
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();
    
    console.log('✅ WebDriver launched successfully');
    
    // Navigate to a test page
    console.log('🌐 Navigating to test page...');
    await driver.get('https://example.com');
    
    // Wait for page load
    await driver.wait(until.titleContains('Example'), 5000);
    console.log('📄 Page loaded successfully');
    
    // Take a screenshot
    console.log('📸 Taking screenshot...');
    const screenshot = await driver.takeScreenshot();
    
    // Save screenshot
    fs.writeFileSync('selenium-test.png', screenshot, 'base64');
    console.log('💾 Screenshot saved as selenium-test.png');
    
    console.log('✅ Selenium test completed successfully!');
    
  } catch (error) {
    console.error('❌ Selenium test failed:', error.message);
    process.exit(1);
  } finally {
    if (driver) {
      try {
        await driver.quit();
        console.log('🔒 WebDriver closed');
      } catch (closeError) {
        console.log('⚠️ Error closing WebDriver:', closeError.message);
      }
    }
  }
}

testSelenium();

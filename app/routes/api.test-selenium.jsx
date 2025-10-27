import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import fs from "fs";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    console.log('🧪 Testing Selenium WebDriver...');
    
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
      
      console.log('✅ Selenium test completed successfully!');
      
      return json({
        success: true,
        message: 'Selenium WebDriver test passed!',
        chromeFound: chromeFound,
        screenshotSize: screenshot.length
      });
      
    } catch (seleniumError) {
      console.error('❌ Selenium test failed:', seleniumError);
      
      return json({
        success: false,
        error: seleniumError.message,
        message: 'Selenium WebDriver test failed'
      });
      
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
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return json({ 
      error: "Test failed", 
      details: error.message 
    }, { status: 500 });
  }
};

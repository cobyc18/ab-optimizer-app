import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import path from "path";
import fs from "fs";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    const { previewUrl, productHandle, themeId } = await request.json();
    
    console.log('📸 Generating screenshot using Selenium...');
    console.log('🔗 Preview URL:', previewUrl);
    
    // Ensure screenshots directory exists
    const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const filename = `selenium-preview-${productHandle}-${themeId}-${Date.now()}.png`;
    const outputPath = path.join(screenshotsDir, filename);
    
    let driver;
    
    try {
      // Configure Chrome options for headless mode
      const chromeOptions = new chrome.Options();
      chromeOptions.addArguments('--headless');
      chromeOptions.addArguments('--no-sandbox');
      chromeOptions.addArguments('--disable-dev-shm-usage');
      chromeOptions.addArguments('--disable-gpu');
      chromeOptions.addArguments('--window-size=800,600');
      chromeOptions.addArguments('--disable-web-security');
      chromeOptions.addArguments('--disable-features=VizDisplayCompositor');
      
      // Try different Chrome executable paths
      const chromePaths = [
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/opt/google/chrome/chrome'
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
        console.log('⚠️ No Chrome executable found, trying system default');
      }
      
      // Create WebDriver instance
      driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .build();
      
      console.log('✅ Selenium WebDriver launched successfully');
      
      // Navigate to the preview URL
      await driver.get(previewUrl);
      console.log('🌐 Navigated to preview URL');
      
      // Wait for the page to load
      await driver.wait(until.titleContains(''), 10000);
      await driver.sleep(2000); // Additional wait for content to load
      
      // Take screenshot
      const screenshot = await driver.takeScreenshot();
      console.log('📸 Screenshot captured');
      
      // Save screenshot to file
      fs.writeFileSync(outputPath, screenshot, 'base64');
      console.log('💾 Screenshot saved to:', outputPath);
      
      const screenshotUrl = `/screenshots/${filename}`;
      
      return json({
        success: true,
        screenshotUrl: screenshotUrl,
        filename: filename,
        method: 'selenium',
        message: 'Screenshot generated successfully using Selenium',
        previewUrl: previewUrl
      });
      
    } catch (seleniumError) {
      console.error('❌ Selenium screenshot failed:', seleniumError);
      
      // Fallback: Create a placeholder with the actual URL
      const placeholderUrl = `https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=${encodeURIComponent(`Preview: ${productHandle}\\n\\nTheme ID: ${themeId}\\n\\nClick to view live`)}`;
      
      return json({
        success: true,
        screenshotUrl: placeholderUrl,
        filename: `placeholder-${productHandle}-${themeId}-${Date.now()}.png`,
        method: 'placeholder_fallback',
        message: 'Selenium failed, using placeholder (Chrome not available)',
        note: 'Selenium requires Chrome to be installed. Click "View Live Preview" to see the actual page.',
        previewUrl: previewUrl
      });
      
    } finally {
      // Always close the driver
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
    console.error('❌ Screenshot generation failed:', error);
    return json({ 
      error: "Failed to generate screenshot", 
      details: error.message 
    }, { status: 500 });
  }
};

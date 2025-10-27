import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import path from "path";
import fs from "fs";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    const { previewUrl, productHandle, themeId, storePassword } = await request.json();
    
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
      chromeOptions.addArguments('--window-size=1200,800');
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
      console.log('🌐 Navigated to preview URL:', previewUrl);
      
      // Check if we're on a password page
      const currentUrl = await driver.getCurrentUrl();
      console.log('🔍 Current URL after navigation:', currentUrl);
      
      // Handle password protection
      if (currentUrl.includes('password') || await driver.getTitle().then(title => title.toLowerCase().includes('password'))) {
        console.log('🔐 Store is password protected, attempting to bypass...');
        
        try {
          // Look for password input field
          const passwordField = await driver.findElement(By.name('password'));
          const password = storePassword || process.env.SHOPIFY_STORE_PASSWORD || 'your-store-password';
          
          console.log('🔑 Entering store password...');
          await passwordField.sendKeys(password);
          
          // Look for submit button or form
          try {
            const submitButton = await driver.findElement(By.css('button[type="submit"], input[type="submit"], .btn-submit'));
            await submitButton.click();
            console.log('✅ Password submitted');
          } catch (submitError) {
            // Try pressing Enter
            await passwordField.sendKeys('\n');
            console.log('✅ Password submitted via Enter key');
          }
          
          // Wait for redirect after password submission
          await driver.sleep(3000);
          console.log('⏳ Waiting for password verification...');
          
          // After password submission, navigate to the specific product URL again
          console.log('🔄 Re-navigating to product URL after password bypass...');
          await driver.get(previewUrl);
          console.log('🌐 Re-navigated to:', previewUrl);
          
        } catch (passwordError) {
          console.log('⚠️ Could not handle password protection:', passwordError.message);
          // Continue anyway, might be a different type of protection
        }
      }
      
      // Wait for the page to load and verify we're on the right page
      await driver.wait(until.titleContains(''), 10000);
      await driver.sleep(3000); // Additional wait for content to load
      
      // Verify we're on the correct product page
      const finalUrl = await driver.getCurrentUrl();
      const pageTitle = await driver.getTitle();
      console.log('🔍 Final URL:', finalUrl);
      console.log('📄 Page title:', pageTitle);
      
      // Check if we're on the correct product page
      if (!finalUrl.includes(productHandle)) {
        console.log('⚠️ Not on correct product page, attempting to navigate again...');
        await driver.get(previewUrl);
        await driver.sleep(2000);
      }
      
      // Wait for product page content to load
      try {
        // Wait for common product page elements
        await driver.wait(until.elementLocated(By.css('main, .product, [data-product], .product-page')), 10000);
        console.log('✅ Product page content loaded');
      } catch (waitError) {
        console.log('⚠️ Could not find product page elements, proceeding anyway');
      }
      
      // Additional wait for images and dynamic content
      await driver.sleep(2000);
      
      // Get the full page dimensions
      const fullPageHeight = await driver.executeScript('return Math.max(document.body.scrollHeight, document.body.offsetHeight, document.documentElement.clientHeight, document.documentElement.scrollHeight, document.documentElement.offsetHeight);');
      const viewportHeight = await driver.executeScript('return window.innerHeight;');
      const viewportWidth = await driver.executeScript('return window.innerWidth;');
      
      console.log('📏 Page dimensions:', {
        fullHeight: fullPageHeight,
        viewportHeight: viewportHeight,
        viewportWidth: viewportWidth
      });
      
      // Set the browser window to capture the full page height
      await driver.manage().window().setRect({
        width: viewportWidth,
        height: fullPageHeight
      });
      
      console.log('🖼️ Resized browser window to full page height');
      
      // Wait a moment for the resize to take effect
      await driver.sleep(1000);
      
      // Take full page screenshot
      const screenshot = await driver.takeScreenshot();
      console.log('📸 Full page screenshot captured');
      
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

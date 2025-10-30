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
    console.log('🧾 Screenshot API received:', {
      previewUrl,
      productHandle,
      themeId,
      passwordProvided: Boolean(storePassword || process.env.SHOPIFY_STORE_PASSWORD),
      passwordLength: (storePassword || process.env.SHOPIFY_STORE_PASSWORD || '').length
    });
    
    console.log('📸 Generating screenshot using Selenium...');
    console.log('🔗 Preview URL:', previewUrl);
    
    // Ensure screenshots directory exists
    const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');
    console.log('📁 Screenshots directory:', screenshotsDir);
    
    if (!fs.existsSync(screenshotsDir)) {
      console.log('📁 Creating screenshots directory...');
      fs.mkdirSync(screenshotsDir, { recursive: true });
      console.log('✅ Screenshots directory created');
    } else {
      console.log('✅ Screenshots directory already exists');
    }
    
    // Clean theme ID for filename (remove colons and slashes)
    const cleanThemeId = themeId.replace(/[:\/]/g, '-');
    const filename = `selenium-preview-${productHandle}-${cleanThemeId}-${Date.now()}.png`;
    const outputPath = path.join(screenshotsDir, filename);
    console.log('📄 Output path:', outputPath);
    
      let driver;

      // Set a timeout for the entire screenshot process
      const screenshotTimeout = setTimeout(async () => {
        console.log('⏰ Screenshot generation timeout reached, closing browser...');
        if (driver) {
          try {
            await driver.quit();
          } catch (e) {
            console.log('Error closing browser on timeout:', e.message);
          }
        }
      }, 120000); // 2 minute timeout

      try {
      // Configure Chrome options for fast headless mode
      const chromeOptions = new chrome.Options();
      chromeOptions.addArguments('--headless=new');
      chromeOptions.addArguments('--no-sandbox');
      chromeOptions.addArguments('--disable-dev-shm-usage');
      chromeOptions.addArguments('--disable-gpu');
      chromeOptions.addArguments('--disable-software-rasterizer');
      chromeOptions.addArguments('--disable-background-timer-throttling');
      chromeOptions.addArguments('--disable-backgrounding-occluded-windows');
      chromeOptions.addArguments('--disable-renderer-backgrounding');
      chromeOptions.addArguments('--disable-features=TranslateUI');
      chromeOptions.addArguments('--disable-ipc-flooding-protection');
      chromeOptions.addArguments('--window-size=1200,800');
      chromeOptions.addArguments('--disable-web-security');
      chromeOptions.addArguments('--disable-features=VizDisplayCompositor');
      chromeOptions.addArguments('--disable-extensions');
      chromeOptions.addArguments('--disable-plugins');
      chromeOptions.addArguments('--aggressive-cache-discard');
      chromeOptions.addArguments('--memory-pressure-off');
      chromeOptions.addArguments('--disable-background-networking');
      chromeOptions.addArguments('--disable-sync');
      chromeOptions.addArguments('--disable-default-apps');
      chromeOptions.addArguments('--disable-component-extensions-with-background-pages');
      
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
          const password = storePassword || process.env.SHOPIFY_STORE_PASSWORD || '';
          
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
          
          // Wait for redirect after password submission (reduced wait time)
          await driver.sleep(1000);
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
      
      // Wait for the page to load and verify we're on the right page (optimized)
      console.log('⏳ Waiting for page to load...');
      await driver.wait(until.titleContains(''), 5000);
      await driver.sleep(1000); // Reduced wait for content to load
      
      // Verify we're on the correct product page
      const finalUrl = await driver.getCurrentUrl();
      const pageTitle = await driver.getTitle();
      console.log('🔍 Final URL:', finalUrl);
      console.log('📄 Page title:', pageTitle);
      
      // Check if we're on the correct product page
      if (!finalUrl.includes(productHandle)) {
        console.log('⚠️ Not on correct product page, attempting to navigate again...');
        await driver.get(previewUrl);
        await driver.sleep(500);
      }
      
      // Wait for product page content to load (optimized with images)
      console.log('⏳ Waiting for product page elements...');
      try {
        // Wait for common product page elements with shorter timeout
        await driver.wait(until.elementLocated(By.css('main, .product, [data-product], .product-page, body')), 5000);
        console.log('✅ Product page content loaded');
        
        // Wait for images to load (but with timeout)
        console.log('⏳ Waiting for images to load...');
        await driver.executeScript(`
          return Promise.all(
            Array.from(document.images).map(img => {
              if (img.complete) return Promise.resolve();
              return new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = resolve; // Don't fail on broken images
                setTimeout(resolve, 2000); // Max 2 second wait per image
              });
            })
          );
        `);
        console.log('✅ Images loaded');
        
      } catch (waitError) {
        console.log('⚠️ Could not find product page elements, proceeding anyway:', waitError.message);
      }
      
      // Minimal wait for final content
      console.log('⏳ Final content wait...');
      await driver.sleep(500);
      
      // Get the full page dimensions
      console.log('📏 Getting page dimensions...');
      const fullPageHeight = await driver.executeScript('return Math.max(document.body.scrollHeight, document.body.offsetHeight, document.documentElement.clientHeight, document.documentElement.scrollHeight, document.documentElement.offsetHeight);');
      const viewportHeight = await driver.executeScript('return window.innerHeight;');
      const viewportWidth = await driver.executeScript('return window.innerWidth;');
      
      console.log('📏 Page dimensions:', {
        fullHeight: fullPageHeight,
        viewportHeight: viewportHeight,
        viewportWidth: viewportWidth
      });
      
      // Set the browser window to capture the full page height
      console.log('🖼️ Resizing browser window...');
      await driver.manage().window().setRect({
        width: viewportWidth,
        height: fullPageHeight
      });
      
      console.log('🖼️ Resized browser window to full page height');
      
      // Wait a moment for the resize to take effect (optimized)
      console.log('⏳ Waiting for resize to take effect...');
      await driver.sleep(300);
      
      // Take full page screenshot
      console.log('📸 Taking screenshot...');
      const screenshot = await driver.takeScreenshot();
      console.log('📸 Full page screenshot captured');
      
      // Save screenshot to file
      console.log('💾 Saving screenshot to file...');
      try {
        fs.writeFileSync(outputPath, screenshot, 'base64');
        console.log('💾 Screenshot saved to:', outputPath);
      } catch (writeError) {
        console.error('❌ Failed to save screenshot:', writeError);
        throw new Error(`Failed to save screenshot: ${writeError.message}`);
      }
      
      const screenshotUrl = `/screenshots/${filename}`;
      
      // Clear the timeout since we completed successfully
      clearTimeout(screenshotTimeout);
      
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
      
      // Clear the timeout
      clearTimeout(screenshotTimeout);
      
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
      // Clear the timeout
      clearTimeout(screenshotTimeout);
      
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

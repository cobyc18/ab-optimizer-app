import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

// Check if we're in a development environment
const isDevelopment = process.env.NODE_ENV === 'development';

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  
  try {
    const { previewUrl, productHandle, themeId } = await request.json();
    
    console.log('📝 Screenshot request received:', { previewUrl, productHandle, themeId });
    
    if (!previewUrl || !productHandle || !themeId) {
      console.log('❌ Missing required parameters');
      return json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Generate unique filename for caching
    const filename = `preview-${productHandle}-${themeId}-${Date.now()}.png`;
    const outputPath = path.join(process.cwd(), 'public', 'screenshots', filename);
    
    // Ensure screenshots directory exists
    const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      console.log('📁 Creating screenshots directory:', screenshotsDir);
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    console.log(`🖼️ Generating screenshot for: ${previewUrl}`);
    console.log(`📁 Output path: ${outputPath}`);
    
    // Launch Puppeteer with more robust configuration
    let browser;
    try {
      console.log('🚀 Launching Puppeteer...');
      browser = await puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox", 
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor"
        ],
        timeout: 30000
      });
      console.log('✅ Puppeteer launched successfully');
    } catch (puppeteerError) {
      console.error('❌ Puppeteer launch failed:', puppeteerError);
      
      // In development, provide a more helpful error message
      if (isDevelopment) {
        return json({ 
          error: "Puppeteer launch failed in development", 
          details: puppeteerError.message,
          suggestion: "Try running: npm install puppeteer && npm run dev",
          troubleshooting: [
            "Make sure Chrome/Chromium is installed",
            "Check if you have sufficient permissions",
            "Try running with: sudo npm run dev (if on Linux/Mac)",
            "Consider using puppeteer-core with a local Chrome installation"
          ]
        }, { status: 500 });
      }
      
      return json({ 
        error: "Puppeteer launch failed", 
        details: puppeteerError.message,
        suggestion: "This might be due to missing Chrome dependencies or insufficient permissions"
      }, { status: 500 });
    }

    const page = await browser.newPage();
    console.log('📄 New page created');
    
    // Set viewport for consistent screenshots
    await page.setViewport({
      width: 1200,
      height: 800,
      deviceScaleFactor: 1,
    });
    console.log('📐 Viewport set');

    // Navigate to the preview URL
    console.log('🌐 Navigating to preview URL...');
    await page.goto(previewUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    console.log('✅ Page loaded');

    // Wait for main content to load
    try {
      await page.waitForSelector('main', { timeout: 10000 });
      console.log('✅ Main content found');
    } catch (error) {
      console.log('⚠️ Main selector not found, proceeding with screenshot');
    }

    // Optional: Wait a bit more for any lazy-loaded content
    await page.waitForTimeout(2000);
    console.log('⏳ Additional wait completed');

    // Take full page screenshot
    console.log('📸 Taking screenshot...');
    await page.screenshot({ 
      path: outputPath, 
      fullPage: true,
      type: 'png'
    });
    console.log('✅ Screenshot captured');

    await browser.close();
    console.log('🔒 Browser closed');

    console.log(`✅ Screenshot saved: ${filename}`);

    // Return the public URL for the screenshot
    const screenshotUrl = `/screenshots/${filename}`;
    
    return json({ 
      success: true, 
      screenshotUrl,
      filename 
    });

  } catch (error) {
    console.error('❌ Screenshot generation failed:', error);
    
    // Ensure browser is closed even if there's an error
    try {
      if (browser) {
        await browser.close();
        console.log('🔒 Browser closed after error');
      }
    } catch (closeError) {
      console.error('❌ Error closing browser:', closeError);
    }
    
    return json({ 
      error: "Failed to generate screenshot", 
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
};

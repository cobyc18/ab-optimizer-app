import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  
  try {
    const { previewUrl, productHandle, themeId } = await request.json();
    
    if (!previewUrl || !productHandle || !themeId) {
      return json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Generate unique filename for caching
    const filename = `preview-${productHandle}-${themeId}-${Date.now()}.png`;
    const outputPath = path.join(process.cwd(), 'public', 'screenshots', filename);
    
    // Ensure screenshots directory exists
    const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    console.log(`🖼️ Generating screenshot for: ${previewUrl}`);
    
    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();
    
    // Set viewport for consistent screenshots
    await page.setViewport({
      width: 1200,
      height: 800,
      deviceScaleFactor: 1,
    });

    // Navigate to the preview URL
    await page.goto(previewUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait for main content to load
    try {
      await page.waitForSelector('main', { timeout: 10000 });
    } catch (error) {
      console.log('⚠️ Main selector not found, proceeding with screenshot');
    }

    // Optional: Wait a bit more for any lazy-loaded content
    await page.waitForTimeout(2000);

    // Take full page screenshot
    await page.screenshot({ 
      path: outputPath, 
      fullPage: true,
      type: 'png'
    });

    await browser.close();

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
    return json({ 
      error: "Failed to generate screenshot", 
      details: error.message 
    }, { status: 500 });
  }
};

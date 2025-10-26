import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import puppeteer from "puppeteer";

export const action = async ({ request }) => {
  try {
    console.log('🧪 Test screenshot endpoint called');
    
    // Test basic Puppeteer functionality
    console.log('🚀 Launching test browser...');
    
    // Try to get the executable path, with fallback
    let executablePath;
    try {
      executablePath = puppeteer.executablePath();
      console.log('🔍 Chrome executable path:', executablePath);
    } catch (pathError) {
      console.log('⚠️ Could not get executable path, trying without it');
      executablePath = undefined;
    }
    
    // Launch configuration
    const launchConfig = {
      headless: "new",
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    };
    
    // Only add executablePath if we have it
    if (executablePath) {
      launchConfig.executablePath = executablePath;
    }
    
    const browser = await puppeteer.launch(launchConfig);
    
    console.log('✅ Browser launched');
    const page = await browser.newPage();
    console.log('✅ Page created');
    
    await page.setViewport({ width: 1200, height: 800 });
    console.log('✅ Viewport set');
    
    await page.goto('https://example.com', { waitUntil: 'networkidle2' });
    console.log('✅ Page loaded');
    
    await browser.close();
    console.log('✅ Browser closed');
    
    return json({ 
      success: true, 
      message: "Puppeteer test completed successfully" 
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
};

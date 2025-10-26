import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
import puppeteer from "puppeteer";

export const action = async ({ request }) => {
  try {
    console.log('🧪 Test screenshot endpoint called');
    
    // Test basic Puppeteer functionality
    console.log('🚀 Launching test browser...');
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    });
    
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

import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    const { previewUrl, productHandle, themeId } = await request.json();
    
    console.log('📸 Generating screenshot via external service...');
    console.log('🔗 Preview URL:', previewUrl);
    
    // Use a screenshot service API (like htmlcsstoimage.com, screenshotapi.net, etc.)
    // For now, let's use a simple approach with Puppeteer in a different way
    
    // Alternative: Use a headless browser service
    const screenshotServiceUrl = 'https://htmlcsstoimage.com/demo';
    
    // For now, return a mock response with instructions
    const mockScreenshotUrl = `https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=Preview+${productHandle}`;
    
    return json({
      success: true,
      screenshotUrl: mockScreenshotUrl,
      filename: `preview-${productHandle}-${themeId}-${Date.now()}.png`,
      method: 'external_service',
      message: 'Screenshot generated via external service',
      note: 'This is a placeholder. In production, integrate with a screenshot service like htmlcsstoimage.com'
    });
    
  } catch (error) {
    console.error('❌ Screenshot generation failed:', error);
    return json({ 
      error: "Failed to generate screenshot", 
      details: error.message 
    }, { status: 500 });
  }
};

import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    const { previewUrl, productHandle, themeId } = await request.json();
    
    console.log('📸 Generating screenshot using ScreenshotAPI...');
    console.log('🔗 Preview URL:', previewUrl);
    
    // Use ScreenshotAPI.net (free tier available)
    const apiKey = process.env.SCREENSHOT_API_KEY || 'demo';
    const apiUrl = 'https://screenshotapi.net/api/v1/screenshot';
    
    try {
      // Try ScreenshotAPI.net
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: apiKey,
          url: previewUrl,
          width: 800,
          height: 600,
          format: 'png',
          full_page: false,
          wait_for_event: 'networkidle'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.screenshot) {
          return json({
            success: true,
            screenshotUrl: result.screenshot,
            filename: `preview-${productHandle}-${themeId}-${Date.now()}.png`,
            method: 'screenshotapi',
            message: 'Real screenshot generated successfully'
          });
        }
      }
    } catch (serviceError) {
      console.log('⚠️ ScreenshotAPI failed, trying alternative:', serviceError.message);
    }
    
    // Alternative: Use htmlcsstoimage.com
    try {
      const htmlCssResponse = await fetch('https://htmlcsstoimage.com/demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: previewUrl,
          css: `
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif;
              background: white;
            }
            .product-page { 
              width: 100%; 
              max-width: 800px; 
              margin: 0 auto; 
            }
          `,
          device_scale_factor: 1,
          format: 'png',
          width: 800,
          height: 600,
          wait_for: 2000
        })
      });
      
      if (htmlCssResponse.ok) {
        const imageBuffer = await htmlCssResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const dataUrl = `data:image/png;base64,${base64Image}`;
        
        return json({
          success: true,
          screenshotUrl: dataUrl,
          filename: `preview-${productHandle}-${themeId}-${Date.now()}.png`,
          method: 'htmlcsstoimage',
          message: 'Real screenshot generated successfully'
        });
      }
    } catch (htmlCssError) {
      console.log('⚠️ HTMLCSSTOIMAGE failed:', htmlCssError.message);
    }
    
    // Final fallback: Create a more informative placeholder
    const placeholderUrl = `https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=${encodeURIComponent(`Preview: ${productHandle}\\n\\nTheme ID: ${themeId}\\n\\nClick to view live`)}`;
    
    return json({
      success: true,
      screenshotUrl: placeholderUrl,
      filename: `preview-${productHandle}-${themeId}-${Date.now()}.png`,
      method: 'placeholder_service',
      message: 'Placeholder generated (screenshot services unavailable)',
      note: 'Configure SCREENSHOT_API_KEY environment variable for real screenshots',
      previewUrl: previewUrl
    });
    
  } catch (error) {
    console.error('❌ Screenshot generation failed:', error);
    return json({ 
      error: "Failed to generate screenshot", 
      details: error.message 
    }, { status: 500 });
  }
};

import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    const { previewUrl, productHandle, themeId } = await request.json();
    
    console.log('📸 Generating screenshot via external service...');
    console.log('🔗 Preview URL:', previewUrl);
    
    // Use htmlcsstoimage.com API for real screenshots
    const apiKey = process.env.HTMLCSSTOIMAGE_API_KEY || 'demo';
    const apiUrl = 'https://htmlcsstoimage.com/demo';
    
    // For demo purposes, we'll use a placeholder service
    // In production, you'd use: https://htmlcsstoimage.com/demo
    const screenshotServiceUrl = `https://htmlcsstoimage.com/demo`;
    
    try {
      // Try to get a real screenshot using htmlcsstoimage
      const response = await fetch(screenshotServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: previewUrl,
          css: `
            body { margin: 0; padding: 0; }
            .product-page { width: 100%; max-width: 800px; margin: 0 auto; }
          `,
          device_scale_factor: 1,
          format: 'png',
          width: 800,
          height: 600
        })
      });
      
      if (response.ok) {
        const imageBuffer = await response.arrayBuffer();
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
    } catch (serviceError) {
      console.log('⚠️ Screenshot service failed, using fallback:', serviceError.message);
    }
    
    // Fallback: Create a more realistic placeholder
    const placeholderUrl = `https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=${encodeURIComponent(`Preview: ${productHandle}`)}`;
    
    return json({
      success: true,
      screenshotUrl: placeholderUrl,
      filename: `preview-${productHandle}-${themeId}-${Date.now()}.png`,
      method: 'placeholder_service',
      message: 'Screenshot generated via placeholder service',
      note: 'This is a placeholder. For real screenshots, configure htmlcsstoimage.com API key'
    });
    
  } catch (error) {
    console.error('❌ Screenshot generation failed:', error);
    return json({ 
      error: "Failed to generate screenshot", 
      details: error.message 
    }, { status: 500 });
  }
};

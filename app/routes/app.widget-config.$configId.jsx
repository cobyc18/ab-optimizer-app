import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request, params }) {
  const { configId } = params;
  
  if (!configId || configId === 'Enter config ID' || configId === 'none') {
    return json({ error: 'Invalid config ID' }, { status: 400 });
  }

  try {
    // Fetch widget configuration from database
    const widgetConfig = await prisma.widgetConfig.findUnique({
      where: { id: configId }
    });

    if (!widgetConfig) {
      return json({ error: 'Widget configuration not found' }, { status: 404 });
    }

    // Return the configuration as JSON
    return json({
      success: true,
      config: widgetConfig.config
    });

  } catch (error) {
    console.error('Error fetching widget config:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const actionType = formData.get("actionType");

    switch (actionType) {
      case "create_widget_config":
        const widgetType = formData.get("widgetType");
        const config = JSON.parse(formData.get("config"));
        
        const newConfig = await prisma.widgetConfig.create({
          data: {
            widgetType,
            config: config,
            shopId: admin.shop
          }
        });

        return json({ 
          success: true, 
          configId: newConfig.id,
          message: "Widget configuration created successfully" 
        });

      case "update_widget_config":
        const configId = formData.get("configId");
        const updatedConfig = JSON.parse(formData.get("config"));
        
        await prisma.widgetConfig.update({
          where: { id: configId },
          data: { config: updatedConfig }
        });

        return json({ 
          success: true, 
          message: "Widget configuration updated successfully" 
        });

      case "delete_widget_config":
        const deleteConfigId = formData.get("configId");
        
        await prisma.widgetConfig.delete({
          where: { id: deleteConfigId }
        });

        return json({ 
          success: true, 
          message: "Widget configuration deleted successfully" 
        });

      default:
        return json({ error: "Invalid action type" }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in widget config action:', error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
} 
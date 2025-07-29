const express = require('express');
const axios = require('axios');
const prisma = require('../lib/db.server');
const router = express.Router();

// Middleware to verify shop access
const verifyShopAccess = async (req, res, next) => {
  try {
    const { shop } = req.params;
    const shopData = await prisma.shop.findUnique({
      where: { shop },
    });
    
    if (!shopData || !shopData.isActive) {
      return res.status(404).json({ error: 'Shop not found or not installed' });
    }
    
    req.shop = shopData;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error verifying shop access' });
  }
};

// Get all shops
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;
    
    let where = {};
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }
    
    const shops = await prisma.shop.findMany({
      where,
      orderBy: { installedAt: 'desc' },
      skip: skip,
      take: parseInt(limit),
      select: {
        id: true,
        shop: true,
        scope: true,
        isActive: true,
        installedAt: true,
        uninstalledAt: true,
        lastWebhookAt: true,
        settings: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    const total = await prisma.shop.count({ where });
    
    res.json({
      shops,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching shops:', error);
    res.status(500).json({ error: 'Error fetching shops' });
  }
});

// Get shop details
router.get('/:shop', verifyShopAccess, async (req, res) => {
  try {
    const shopData = { ...req.shop };
    delete shopData.accessToken; // Don't send access token
    
    // Get recent webhook events
    const recentEvents = await prisma.webhookEvent.findMany({
      where: { shop: req.params.shop },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        topic: true,
        shop: true,
        webhookId: true,
        eventId: true,
        processed: true,
        createdAt: true,
        processedAt: true,
        processingTime: true,
        retryAttempts: true,
      },
    });
    
    // Get webhook statistics for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const stats = await prisma.webhookEvent.groupBy({
      by: ['topic', 'processed'],
      where: {
        shop: req.params.shop,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      _count: {
        id: true,
      },
    });
    
    res.json({
      shop: shopData,
      recentEvents,
      stats,
    });
  } catch (error) {
    console.error('Error fetching shop details:', error);
    res.status(500).json({ error: 'Error fetching shop details' });
  }
});

// Get shop orders
router.get('/:shop/orders', verifyShopAccess, async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const skip = (page - 1) * limit;
    
    let query = '';
    if (status) {
      query = `&status=${status}`;
    }
    
    const response = await axios.get(
      `https://${req.params.shop}/admin/api/2023-10/orders.json?limit=${limit}&page=${page}${query}`,
      {
        headers: {
          'X-Shopify-Access-Token': req.shop.accessToken,
        },
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Error fetching orders' });
  }
});

// Get shop customers
router.get('/:shop/customers', verifyShopAccess, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const response = await axios.get(
      `https://${req.params.shop}/admin/api/2023-10/customers.json?limit=${limit}&page=${page}`,
      {
        headers: {
          'X-Shopify-Access-Token': req.shop.accessToken,
        },
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Error fetching customers' });
  }
});

// Get shop products
router.get('/:shop/products', verifyShopAccess, async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    
    let query = '';
    if (status) {
      query = `&status=${status}`;
    }
    
    const response = await axios.get(
      `https://${req.params.shop}/admin/api/2023-10/products.json?limit=${limit}&page=${page}${query}`,
      {
        headers: {
          'X-Shopify-Access-Token': req.shop.accessToken,
        },
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Error fetching products' });
  }
});

// Get shop analytics
router.get('/:shop/analytics', verifyShopAccess, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Get webhook statistics
    const webhookStats = await WebhookEvent.getStats(req.params.shop, parseInt(days));
    
    // Get shop info
    const shopInfo = req.shop.getShopInfo();
    
    // Calculate installation age
    const installationAge = Math.floor((Date.now() - shopInfo.installedAt.getTime()) / (1000 * 60 * 60 * 24));
    
    res.json({
      shop: {
        domain: shopInfo.shop,
        isActive: shopInfo.isActive,
        installedAt: shopInfo.installedAt,
        installationAge,
        scope: shopInfo.scope,
      },
      webhookStats,
      summary: {
        totalEvents: webhookStats.reduce((sum, stat) => sum + stat.total, 0),
        processedEvents: webhookStats.reduce((sum, stat) => sum + stat.processed, 0),
        failedEvents: webhookStats.reduce((sum, stat) => sum + stat.failed, 0),
        avgProcessingTime: webhookStats.reduce((sum, stat) => sum + (stat.avgProcessingTime || 0), 0) / webhookStats.length || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Error fetching analytics' });
  }
});

// Update shop settings
router.put('/:shop/settings', verifyShopAccess, async (req, res) => {
  try {
    const { settings } = req.body;
    
    const updatedShop = await prisma.shop.update({
      where: { id: req.shop.id },
      data: { settings },
    });
    
    res.json({
      message: 'Settings updated successfully',
      settings: updatedShop.settings,
    });
  } catch (error) {
    console.error('Error updating shop settings:', error);
    res.status(500).json({ error: 'Error updating shop settings' });
  }
});

// Uninstall shop
router.post('/:shop/uninstall', verifyShopAccess, async (req, res) => {
  try {
    await prisma.shop.update({
      where: { id: req.shop.id },
      data: {
        isActive: false,
        uninstalledAt: new Date(),
      },
    });
    
    res.json({ message: 'Shop uninstalled successfully' });
  } catch (error) {
    console.error('Error uninstalling shop:', error);
    res.status(500).json({ error: 'Error uninstalling shop' });
  }
});

// Reinstall shop
router.post('/:shop/reinstall', verifyShopAccess, async (req, res) => {
  try {
    await prisma.shop.update({
      where: { id: req.shop.id },
      data: {
        isActive: true,
        uninstalledAt: null,
      },
    });
    
    res.json({ message: 'Shop reinstalled successfully' });
  } catch (error) {
    console.error('Error reinstalling shop:', error);
    res.status(500).json({ error: 'Error reinstalling shop' });
  }
});

// Test shop connection
router.post('/:shop/test-connection', verifyShopAccess, async (req, res) => {
  try {
    const response = await axios.get(
      `https://${req.params.shop}/admin/api/2023-10/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': req.shop.accessToken,
        },
      }
    );
    
    res.json({
      success: true,
      shop: response.data.shop,
    });
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ 
      success: false,
      error: 'Connection test failed',
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router; 
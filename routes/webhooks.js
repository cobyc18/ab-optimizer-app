const express = require('express');
const prisma = require('../lib/db.server');
const router = express.Router();

// Get all webhook events
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      topic, 
      shop, 
      status,
      days = 30 
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));
    
    let where = {
      createdAt: {
        gte: daysAgo,
      },
    };
    
    if (topic) {
      where.topic = topic;
    }
    
    if (shop) {
      where.shop = shop;
    }
    
    if (status === 'processed') {
      where.processed = true;
    } else if (status === 'failed') {
      where.processed = false;
      where.error = { not: null };
    } else if (status === 'pending') {
      where.processed = false;
      where.error = null;
    }
    
    const events = await prisma.webhookEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: parseInt(limit),
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
    
    const total = await prisma.webhookEvent.count({ where });
    
    res.json({
      events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching webhook events:', error);
    res.status(500).json({ error: 'Error fetching webhook events' });
  }
});

// Get webhook event by ID
router.get('/:id', async (req, res) => {
  try {
    const event = await WebhookEvent.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Webhook event not found' });
    }
    
    res.json({
      event: event.getSummary(),
      payload: event.payload,
      error: event.error,
    });
  } catch (error) {
    console.error('Error fetching webhook event:', error);
    res.status(500).json({ error: 'Error fetching webhook event' });
  }
});

// Get webhook statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { shop, days = 30 } = req.query;
    
    const stats = await WebhookEvent.getStats(shop, parseInt(days));
    
    const summary = {
      totalEvents: stats.reduce((sum, stat) => sum + stat.total, 0),
      processedEvents: stats.reduce((sum, stat) => sum + stat.processed, 0),
      failedEvents: stats.reduce((sum, stat) => sum + stat.failed, 0),
      avgProcessingTime: stats.reduce((sum, stat) => sum + (stat.avgProcessingTime || 0), 0) / stats.length || 0,
      successRate: 0,
    };
    
    if (summary.totalEvents > 0) {
      summary.successRate = (summary.processedEvents / summary.totalEvents) * 100;
    }
    
    res.json({
      stats,
      summary,
    });
  } catch (error) {
    console.error('Error fetching webhook statistics:', error);
    res.status(500).json({ error: 'Error fetching webhook statistics' });
  }
});

// Get webhook statistics by topic
router.get('/stats/topics', async (req, res) => {
  try {
    const { shop, days = 30 } = req.query;
    
    const stats = await WebhookEvent.getStats(shop, parseInt(days));
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching topic statistics:', error);
    res.status(500).json({ error: 'Error fetching topic statistics' });
  }
});

// Get failed webhook events
router.get('/failed/list', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    
    const events = await WebhookEvent.findFailed(parseInt(limit))
      .skip(skip);
    
    const total = await WebhookEvent.countDocuments({
      processed: false,
      'error.message': { $exists: true }
    });
    
    res.json({
      events: events.map(event => event.getSummary()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching failed events:', error);
    res.status(500).json({ error: 'Error fetching failed events' });
  }
});

// Retry failed webhook event
router.post('/:id/retry', async (req, res) => {
  try {
    const event = await WebhookEvent.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Webhook event not found' });
    }
    
    if (event.processed) {
      return res.status(400).json({ error: 'Event is already processed' });
    }
    
    // Reset error state
    event.error = null;
    event.nextRetryAt = null;
    
    await event.save();
    
    res.json({
      message: 'Event queued for retry',
      event: event.getSummary(),
    });
  } catch (error) {
    console.error('Error retrying webhook event:', error);
    res.status(500).json({ error: 'Error retrying webhook event' });
  }
});

// Mark webhook event as processed
router.post('/:id/mark-processed', async (req, res) => {
  try {
    const event = await WebhookEvent.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Webhook event not found' });
    }
    
    await event.markProcessed();
    
    res.json({
      message: 'Event marked as processed',
      event: event.getSummary(),
    });
  } catch (error) {
    console.error('Error marking event as processed:', error);
    res.status(500).json({ error: 'Error marking event as processed' });
  }
});

// Delete webhook event
router.delete('/:id', async (req, res) => {
  try {
    const event = await WebhookEvent.findByIdAndDelete(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Webhook event not found' });
    }
    
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting webhook event:', error);
    res.status(500).json({ error: 'Error deleting webhook event' });
  }
});

// Clean old webhook events
router.post('/cleanup', async (req, res) => {
  try {
    const { daysToKeep = 90 } = req.body;
    
    const deletedCount = await WebhookEvent.cleanOldEvents(parseInt(daysToKeep));
    
    res.json({
      message: `Cleaned up ${deletedCount} old events`,
      deletedCount,
    });
  } catch (error) {
    console.error('Error cleaning up webhook events:', error);
    res.status(500).json({ error: 'Error cleaning up webhook events' });
  }
});

// Get webhook topics
router.get('/topics/list', async (req, res) => {
  try {
    const topics = await WebhookEvent.distinct('topic');
    
    res.json({ topics });
  } catch (error) {
    console.error('Error fetching webhook topics:', error);
    res.status(500).json({ error: 'Error fetching webhook topics' });
  }
});

// Get webhook events by topic
router.get('/topics/:topic', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    
    const events = await WebhookEvent.findByTopic(req.params.topic, parseInt(limit))
      .skip(skip);
    
    const total = await WebhookEvent.countDocuments({ topic: req.params.topic });
    
    res.json({
      events: events.map(event => event.getSummary()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching events by topic:', error);
    res.status(500).json({ error: 'Error fetching events by topic' });
  }
});

// Get webhook events by shop
router.get('/shops/:shop', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    
    const events = await WebhookEvent.findByShop(req.params.shop, parseInt(limit))
      .skip(skip);
    
    const total = await WebhookEvent.countDocuments({ shop: req.params.shop });
    
    res.json({
      events: events.map(event => event.getSummary()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching events by shop:', error);
    res.status(500).json({ error: 'Error fetching events by shop' });
  }
});

module.exports = router; 
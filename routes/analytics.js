const express = require('express');
const prisma = require('../lib/db.server');
const router = express.Router();

// Get overall analytics dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));
    
    // Get shop statistics
    const totalShops = await prisma.shop.count();
    const activeShops = await prisma.shop.count({ where: { isActive: true } });
    const newShops = await prisma.shop.count({ 
      where: { installedAt: { gte: daysAgo } } 
    });
    const uninstalledShops = await prisma.shop.count({ 
      where: { uninstalledAt: { gte: daysAgo } } 
    });
    
    // Get webhook statistics
    const webhookStats = await prisma.webhookEvent.groupBy({
      by: ['topic', 'processed'],
      where: {
        createdAt: { gte: daysAgo },
      },
      _count: {
        id: true,
      },
    });
    
    const totalEvents = webhookStats.reduce((sum, stat) => sum + stat._count.id, 0);
    const processedEvents = webhookStats
      .filter(stat => stat.processed)
      .reduce((sum, stat) => sum + stat._count.id, 0);
    const failedEvents = webhookStats
      .filter(stat => !stat.processed)
      .reduce((sum, stat) => sum + stat._count.id, 0);
    
    // Get user statistics
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { isActive: true } });
    const newUsers = await prisma.user.count({ 
      where: { createdAt: { gte: daysAgo } } 
    });
    
    // Calculate success rate
    const successRate = totalEvents > 0 ? (processedEvents / totalEvents) * 100 : 0;
    
    // Get top performing shops
    const topShops = await WebhookEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo }
        }
      },
      {
        $group: {
          _id: '$shop',
          eventCount: { $sum: 1 },
          processedCount: {
            $sum: { $cond: ['$processed', 1, 0] }
          }
        }
      },
      {
        $addFields: {
          successRate: {
            $multiply: [
              { $divide: ['$processedCount', '$eventCount'] },
              100
            ]
          }
        }
      },
      {
        $sort: { eventCount: -1 }
      },
      {
        $limit: 10
      }
    ]);
    
    // Get webhook events by day
    const eventsByDay = await WebhookEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          total: { $sum: 1 },
          processed: {
            $sum: { $cond: ['$processed', 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $not: '$processed' }, 1, 0] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Get webhook events by topic
    const eventsByTopic = await WebhookEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo }
        }
      },
      {
        $group: {
          _id: '$topic',
          total: { $sum: 1 },
          processed: {
            $sum: { $cond: ['$processed', 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $not: '$processed' }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          successRate: {
            $multiply: [
              { $divide: ['$processed', '$total'] },
              100
            ]
          }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);
    
    res.json({
      overview: {
        shops: {
          total: totalShops,
          active: activeShops,
          new: newShops,
          uninstalled: uninstalledShops,
          retentionRate: totalShops > 0 ? ((totalShops - uninstalledShops) / totalShops) * 100 : 0,
        },
        webhooks: {
          total: totalEvents,
          processed: processedEvents,
          failed: failedEvents,
          successRate,
          avgProcessingTime: webhookStats.reduce((sum, stat) => sum + (stat.avgProcessingTime || 0), 0) / webhookStats.length || 0,
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          new: newUsers,
        },
      },
      topShops,
      eventsByDay,
      eventsByTopic,
      period: {
        days: parseInt(days),
        startDate: daysAgo,
        endDate: new Date(),
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Error fetching dashboard analytics' });
  }
});

// Get shop performance analytics
router.get('/shops/performance', async (req, res) => {
  try {
    const { days = 30, limit = 20 } = req.query;
    const daysAgo = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    
    const shopPerformance = await WebhookEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo }
        }
      },
      {
        $group: {
          _id: '$shop',
          eventCount: { $sum: 1 },
          processedCount: {
            $sum: { $cond: ['$processed', 1, 0] }
          },
          avgProcessingTime: { $avg: '$processingTime' },
          lastEventAt: { $max: '$createdAt' }
        }
      },
      {
        $addFields: {
          successRate: {
            $multiply: [
              { $divide: ['$processedCount', '$eventCount'] },
              100
            ]
          }
        }
      },
      {
        $sort: { eventCount: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);
    
    res.json({
      shopPerformance,
      period: {
        days: parseInt(days),
        startDate: daysAgo,
        endDate: new Date(),
      },
    });
  } catch (error) {
    console.error('Error fetching shop performance:', error);
    res.status(500).json({ error: 'Error fetching shop performance' });
  }
});

// Get webhook topic analytics
router.get('/webhooks/topics', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysAgo = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    
    const topicAnalytics = await WebhookEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo }
        }
      },
      {
        $group: {
          _id: '$topic',
          total: { $sum: 1 },
          processed: {
            $sum: { $cond: ['$processed', 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $not: '$processed' }, 1, 0] }
          },
          avgProcessingTime: { $avg: '$processingTime' },
          maxProcessingTime: { $max: '$processingTime' },
          minProcessingTime: { $min: '$processingTime' }
        }
      },
      {
        $addFields: {
          successRate: {
            $multiply: [
              { $divide: ['$processed', '$total'] },
              100
            ]
          }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);
    
    res.json({
      topicAnalytics,
      period: {
        days: parseInt(days),
        startDate: daysAgo,
        endDate: new Date(),
      },
    });
  } catch (error) {
    console.error('Error fetching webhook topic analytics:', error);
    res.status(500).json({ error: 'Error fetching webhook topic analytics' });
  }
});

// Get time series analytics
router.get('/timeseries', async (req, res) => {
  try {
    const { days = 30, interval = 'day' } = req.query;
    const daysAgo = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    
    let dateFormat;
    switch (interval) {
      case 'hour':
        dateFormat = '%Y-%m-%d-%H';
        break;
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        dateFormat = '%Y-%U';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }
    
    const timeSeriesData = await WebhookEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: '$createdAt'
            }
          },
          total: { $sum: 1 },
          processed: {
            $sum: { $cond: ['$processed', 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $not: '$processed' }, 1, 0] }
          },
          avgProcessingTime: { $avg: '$processingTime' }
        }
      },
      {
        $addFields: {
          successRate: {
            $multiply: [
              { $divide: ['$processed', '$total'] },
              100
            ]
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    res.json({
      timeSeriesData,
      period: {
        days: parseInt(days),
        interval,
        startDate: daysAgo,
        endDate: new Date(),
      },
    });
  } catch (error) {
    console.error('Error fetching time series analytics:', error);
    res.status(500).json({ error: 'Error fetching time series analytics' });
  }
});

// Get error analytics
router.get('/errors', async (req, res) => {
  try {
    const { days = 30, limit = 20 } = req.query;
    const daysAgo = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    
    const errorAnalytics = await WebhookEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo },
          'error.message': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$error.message',
          count: { $sum: 1 },
          topics: { $addToSet: '$topic' },
          shops: { $addToSet: '$shop' },
          lastOccurrence: { $max: '$createdAt' }
        }
      },
      {
        $addFields: {
          topicCount: { $size: '$topics' },
          shopCount: { $size: '$shops' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);
    
    res.json({
      errorAnalytics,
      period: {
        days: parseInt(days),
        startDate: daysAgo,
        endDate: new Date(),
      },
    });
  } catch (error) {
    console.error('Error fetching error analytics:', error);
    res.status(500).json({ error: 'Error fetching error analytics' });
  }
});

// Get user activity analytics
router.get('/users/activity', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysAgo = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    
    const userActivity = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          newUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: ['$isActive', 1, 0] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    const roleDistribution = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    res.json({
      userActivity,
      roleDistribution,
      period: {
        days: parseInt(days),
        startDate: daysAgo,
        endDate: new Date(),
      },
    });
  } catch (error) {
    console.error('Error fetching user activity analytics:', error);
    res.status(500).json({ error: 'Error fetching user activity analytics' });
  }
});

module.exports = router; 
import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext, Link } from "@remix-run/react";
import { useState } from "react";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Fetch Shopify products
  let products = [];
  try {
    const productsRes = await admin.graphql(`
      query {
        products(first: 20) {
          nodes {
            id
            title
            handle
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            featuredImage {
              url
              altText
            }
            images(first: 1) {
              nodes {
                url
                altText
              }
            }
            variants(first: 1) {
              nodes {
                compareAtPrice
                price
              }
            }
            totalInventory
            createdAt
            status
            tags
          }
        }
      }
    `);
    const productsJson = await productsRes.json();
    products = productsJson.data.products.nodes;
    console.log("✅ Products fetched:", products.length);
  } catch (error) {
    console.error("❌ Error fetching products:", error);
  }

  // Fetch theme information
  let themeInfo = {};
  try {
    const shopRes = await admin.graphql(`query { shop { myshopifyDomain } }`);
    const shopJson = await shopRes.json();
    const shopDomain = shopJson.data.shop.myshopifyDomain;
    
    const themeRes = await admin.graphql(`query { themes(first: 5) { nodes { id name role } } }`);
    const themeJson = await themeRes.json();
    const themes = themeJson.data.themes.nodes;
    const mainTheme = themes.find(t => t.role === "MAIN");
    const themeId = mainTheme?.id.replace("gid://shopify/OnlineStoreTheme/", "");
    
    themeInfo = {
      shopDomain,
      themeId,
      mainTheme,
      themes
    };
    console.log("✅ Theme info fetched:", themeInfo);
  } catch (error) {
    console.error("❌ Error fetching theme info:", error);
  }
  
  // Fetch real data from database
  let stats = {
    totalTests: 0,
    activeTests: 0,
    totalConversions: 0,
    conversionRate: 0,
    totalRevenue: 0,
    totalImpressions: 0,
    recentActivity: []
  };

  try {
    const shop = session.shop;
    
    // Get all tests for this shop
    const tests = await prisma.aBTest.findMany({
      where: { shop },
      include: {
        events: true
      },
      orderBy: { startDate: 'desc' }
    });

    // Get all events for this shop
    const events = await prisma.aBEvent.findMany({
      where: {
        test: {
          shop: shop
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    // Calculate statistics
    stats.totalTests = tests.length;
    stats.activeTests = tests.filter(test => test.status === 'running').length;
    
    // Calculate conversions and revenue
    const purchaseEvents = events.filter(event => event.eventType === 'purchase');
    stats.totalConversions = purchaseEvents.length;
    stats.totalRevenue = purchaseEvents.reduce((sum, event) => sum + (event.value || 0), 0);
    
    // Calculate impressions
    const impressionEvents = events.filter(event => event.eventType === 'impression');
    stats.totalImpressions = impressionEvents.length;
    
    // Calculate conversion rate
    stats.conversionRate = stats.totalImpressions > 0 
      ? (stats.totalConversions / stats.totalImpressions * 100).toFixed(1)
      : 0;

    // Generate recent activity from events
    const recentEvents = events.slice(0, 5).map(event => {
      const test = tests.find(t => t.id === event.testId);
      let message = '';
      let iconType = 'beaker';
      let color = 'blue';

      switch (event.eventType) {
        case 'purchase':
          message = `Purchase from ${test?.name || 'A/B Test'} - $${event.value?.toFixed(2) || '0.00'}`;
          iconType = 'fire';
          color = 'orange';
          break;
        case 'impression':
          message = `Impression recorded for ${test?.name || 'A/B Test'} (Variant ${event.variant})`;
          iconType = 'eye';
          color = 'blue';
          break;
        case 'add_to_cart':
          message = `Add to cart from ${test?.name || 'A/B Test'} (Variant ${event.variant})`;
          iconType = 'cart';
          color = 'green';
          break;
        default:
          message = `${event.eventType} event from ${test?.name || 'A/B Test'}`;
          iconType = 'chart';
          color = 'purple';
      }

      return {
        id: event.id,
        type: event.eventType,
        message,
        time: getTimeAgo(event.timestamp),
        iconType,
        color
      };
    });

    stats.recentActivity = recentEvents;

  } catch (error) {
    console.error("❌ Error fetching test data:", error);
    // Keep default stats if database query fails
  }

  return json({ stats, products, themeInfo });
};

// Helper function to format time ago
const getTimeAgo = (date) => {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return `${Math.floor(diffInSeconds / 2592000)} months ago`;
};

export default function TryLabDashboard() {
  const { stats, products, themeInfo } = useLoaderData();
  const { user } = useOutletContext();
  
  // Experiment creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState('queued'); // 'queued' or 'discover'
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [placementGuideOpen, setPlacementGuideOpen] = useState(false);
  const [autopilotMode, setAutopilotMode] = useState('balanced');
  const [autoPushWinner, setAutoPushWinner] = useState(true);
  const [cardIndex, setCardIndex] = useState(0);
  const [cardOffset, setCardOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [swipeAnimation, setSwipeAnimation] = useState('');
  const [themeEditorOpen, setThemeEditorOpen] = useState(false);
  const [widgetPreview, setWidgetPreview] = useState(null);
  const [placementHotspots, setPlacementHotspots] = useState([]);
  const [experimentData, setExperimentData] = useState({
    idea: null,
    product: null,
    variant: null,
    placement: null,
    name: '',
    description: '',
    testName: '',
    hypothesis: '',
    trafficSplit: 50,
    goalMetric: 'add_to_cart',
    startDate: new Date(),
    endConditions: {},
    queuedIdeas: [
      {
        id: 1,
        utility: 'Free Shipping Badge',
        rationale: 'Increases conversion by 8-12%',
        style: 'Minimal',
        status: 'queued'
      },
      {
        id: 2,
        utility: 'Trust Badge',
        rationale: 'Builds buyer confidence',
        style: 'Conservative',
        status: 'queued'
      }
    ],
    discoverIdeas: [
      {
        id: 3,
        utility: 'Countdown Timer',
        rationale: 'Creates urgency, boosts checkout by 5-7%',
        style: 'Energetic',
        preview: '⏰ Limited time offer!'
      },
      {
        id: 4,
        utility: 'Product Badge',
        rationale: 'Highlights key benefits',
        style: 'Emphasis',
        preview: '🏆 Best Seller'
      },
      {
        id: 5,
        utility: 'Social Proof',
        rationale: 'Shows recent purchases',
        style: 'Minimal',
        preview: '👥 12 bought in last hour'
      }
    ]
  });

  // Swipe gesture handlers
  const handleSwipe = (direction) => {
    if (direction === 'left') {
      // Swipe left - reject idea
      if (cardIndex < experimentData.discoverIdeas.length - 1) {
        setSwipeAnimation('card-swipe-left');
        setTimeout(() => {
          setCardIndex(cardIndex + 1);
          setSwipeAnimation('');
        }, 300);
      }
    } else if (direction === 'right') {
      // Swipe right - accept idea
      setSwipeAnimation('card-swipe-right');
      setSelectedIdea(experimentData.discoverIdeas[cardIndex]);
      setTimeout(() => {
        setCurrentStep(2);
        setSwipeAnimation('');
      }, 300);
    } else if (direction === 'up') {
      // Swipe up - maybe/save for later
      if (cardIndex < experimentData.discoverIdeas.length - 1) {
        setSwipeAnimation('card-swipe-up');
        setTimeout(() => {
          setCardIndex(cardIndex + 1);
          setSwipeAnimation('');
        }, 300);
      }
    }
    setCardOffset(0);
  };

  // Theme Editor Functions
  const openThemeEditor = (product, widget) => {
    if (!themeInfo.shopDomain || !themeInfo.themeId) {
      alert('Theme information not available. Please try again.');
      return;
    }

    const productHandle = product.handle;
    const encodedProductPath = encodeURIComponent(`/products/${productHandle}`);
    const apiKey = "5ff212573a3e19bae68ca45eae0a80c4"; // App's client_id
    
    // Create deep link URL to theme editor with widget placement
    const themeEditorUrl = `https://admin.shopify.com/store/${themeInfo.shopDomain.replace('.myshopify.com', '')}/themes/${themeInfo.themeId}/editor?previewPath=${encodedProductPath}&template=product&addAppBlockId=${apiKey}/${widget.id}&target=mainSection`;
    
    window.open(themeEditorUrl, '_blank');
    setThemeEditorOpen(true);
  };

  const generateWidgetCode = (widget, placement) => {
    const widgetTemplates = {
      'Free Shipping Badge': `
<div class="ab-test-widget free-shipping-badge" style="
  background: linear-gradient(135deg, #10B981, #059669);
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  margin: 16px 0;
  text-align: center;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
">
  🚚 Free shipping on orders over $50
</div>`,
      'Trust Badge': `
<div class="ab-test-widget trust-badge" style="
  background: #F8FAFC;
  border: 2px solid #E2E8F0;
  padding: 12px;
  border-radius: 8px;
  margin: 16px 0;
  text-align: center;
">
  <div style="font-size: 24px; margin-bottom: 8px;">🛡️</div>
  <div style="font-weight: 600; color: #1E293B; margin-bottom: 4px;">Secure Checkout</div>
  <div style="font-size: 12px; color: #64748B;">SSL encrypted • 30-day returns</div>
</div>`,
      'Countdown Timer': `
<div class="ab-test-widget countdown-timer" style="
  background: linear-gradient(135deg, #EF4444, #DC2626);
  color: white;
  padding: 16px;
  border-radius: 8px;
  margin: 16px 0;
  text-align: center;
  font-weight: 600;
">
  <div style="font-size: 18px; margin-bottom: 8px;">⏰ Limited Time Offer!</div>
  <div style="font-size: 24px; font-weight: 700;" id="countdown-${Date.now()}">
    <span id="hours">23</span>:<span id="minutes">59</span>:<span id="seconds">59</span>
  </div>
  <div style="font-size: 12px; margin-top: 4px;">Ends soon!</div>
</div>`,
      'Product Badge': `
<div class="ab-test-widget product-badge" style="
  background: linear-gradient(135deg, #F59E0B, #D97706);
  color: white;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
  margin: 8px 0;
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
">
  🏆 Best Seller
</div>`,
      'Social Proof': `
<div class="ab-test-widget social-proof" style="
  background: #F0F9FF;
  border-left: 4px solid #3B82F6;
  padding: 12px 16px;
  margin: 16px 0;
  border-radius: 0 6px 6px 0;
">
  <div style="display: flex; align-items: center; gap: 8px;">
    <div style="font-size: 20px;">👥</div>
    <div>
      <div style="font-weight: 600; color: #1E293B;">12 people bought this in the last hour</div>
      <div style="font-size: 12px; color: #64748B;">Join thousands of happy customers</div>
    </div>
  </div>
</div>`
    };

    return widgetTemplates[widget] || `
<div class="ab-test-widget custom-widget" style="
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  padding: 16px;
  border-radius: 8px;
  margin: 16px 0;
  text-align: center;
">
  <div style="font-weight: 600; color: #1E293B;">${widget}</div>
  <div style="font-size: 12px; color: #64748B;">A/B Test Widget</div>
</div>`;
  };

  const injectWidgetIntoTheme = async (widget, product, placement) => {
    if (!themeInfo.themeId) {
      alert('Theme ID not available. Please try again.');
      return;
    }

    try {
      // Generate widget code
      const widgetCode = generateWidgetCode(widget, placement);
      
      // Create a snippet for the widget
      const snippetName = `ab-test-${widget.toLowerCase().replace(/\s+/g, '-')}`;
      const snippetContent = widgetCode;

      // Inject the snippet into the theme
      const response = await fetch('/api/inject-widget', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          themeId: themeInfo.themeId,
          snippetName,
          snippetContent,
          widget,
          productId: product.id
        })
      });

      if (response.ok) {
        alert(`Widget "${widget}" successfully added to your theme!`);
        setExperimentData({
          ...experimentData,
          placement: placement,
          variant: widget
        });
      } else {
        throw new Error('Failed to inject widget');
      }
    } catch (error) {
      console.error('Error injecting widget:', error);
      alert('Failed to add widget to theme. Please try again or use the theme editor.');
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    setCardOffset(deltaX);
  };

  const handleMouseUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    // Determine swipe direction
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 100) {
        handleSwipe('right');
      } else if (deltaX < -100) {
        handleSwipe('left');
      } else {
        setCardOffset(0);
      }
    } else if (deltaY < -100) {
      handleSwipe('up');
    } else {
      setCardOffset(0);
    }
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStart.x;
    const deltaY = touch.clientY - dragStart.y;
    setCardOffset(deltaX);
  };

  const handleTouchEnd = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - dragStart.x;
    const deltaY = touch.clientY - dragStart.y;
    
    // Determine swipe direction
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 100) {
        handleSwipe('right');
      } else if (deltaX < -100) {
        handleSwipe('left');
      } else {
        setCardOffset(0);
      }
    } else if (deltaY < -100) {
      handleSwipe('up');
    } else {
      setCardOffset(0);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F5F5F5',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex'
    }}>
      <style>{`
        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutToLeft {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(-100%);
            opacity: 0;
          }
        }
        
        @keyframes cardSwipeRight {
          from {
            transform: translateX(0) rotate(0deg);
          }
          to {
            transform: translateX(100vw) rotate(30deg);
          }
        }
        
        @keyframes cardSwipeLeft {
          from {
            transform: translateX(0) rotate(0deg);
          }
          to {
            transform: translateX(-100vw) rotate(-30deg);
          }
        }
        
        @keyframes cardSwipeUp {
          from {
            transform: translateY(0) rotate(0deg);
          }
          to {
            transform: translateY(-100vh) rotate(0deg);
          }
        }
        
        .card-swipe-right {
          animation: cardSwipeRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        
        .card-swipe-left {
          animation: cardSwipeLeft 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        
        .card-swipe-up {
          animation: cardSwipeUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
      {/* Left Sidebar */}
      <div style={{
        width: '280px',
        background: '#FFFFFF',
        borderRight: '1px solid #E5E5E5',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        left: 0,
        top: 0,
        zIndex: 10
      }}>
        {/* Logo Section */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #E5E5E5',
          display: 'flex',
          alignItems: 'center'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: '#1E40AF',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '12px'
          }}>
            <span style={{ fontSize: '20px' }}>🧪</span>
          </div>
          <span style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#1F2937'
          }}>TryLab</span>
        </div>

        {/* Navigation */}
        <nav style={{
          flex: 1,
          padding: '24px 0'
        }}>
          <div style={{
            padding: '12px 24px',
            background: '#3B82F6',
            color: '#FFFFFF',
            margin: '0 16px 8px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            <span style={{ marginRight: '12px' }}>🏠</span>
            Home
          </div>
          
          <div style={{
            padding: '12px 24px',
            color: '#6B7280',
            margin: '0 16px 8px 16px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <span style={{ marginRight: '12px' }}>📊</span>
            Experiments Hub
          </div>
          
          <div style={{
            padding: '12px 24px',
            color: '#6B7280',
            margin: '0 16px 8px 16px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <span style={{ marginRight: '12px' }}>📈</span>
            Insights & Reports
          </div>
          
          <div style={{
            padding: '12px 24px',
            color: '#6B7280',
            margin: '0 16px 8px 16px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <span style={{ marginRight: '12px' }}>🧩</span>
            Widget Library
          </div>
          
          <div style={{
            padding: '12px 24px',
            color: '#6B7280',
            margin: '0 16px 8px 16px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <span style={{ marginRight: '12px' }}>⚙️</span>
            Settings
          </div>
          
          <div style={{
            padding: '12px 24px',
            color: '#6B7280',
            margin: '0 16px 8px 16px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <span style={{ marginRight: '12px' }}>❓</span>
            Help/Onboarding
          </div>
        </nav>

        {/* Trial Information Box */}
        <div style={{
          margin: '16px',
          padding: '20px',
          background: '#F97316',
          borderRadius: '12px',
          color: '#FFFFFF'
        }}>
          <div style={{
            fontSize: '16px',
            fontWeight: '700',
            marginBottom: '8px'
          }}>
            You have 9 days on the Pro free trial
          </div>
          <div style={{
            fontSize: '12px',
            marginBottom: '16px',
            opacity: 0.9
          }}>
            Usage is unlimited while on trial and will reset when the trial ends.
          </div>
          <button style={{
            width: '100%',
            padding: '10px',
            background: '#3B82F6',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            Upgrade your free trial →
          </button>
        </div>

        {/* Logout */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #E5E5E5',
          display: 'flex',
          alignItems: 'center',
          color: '#6B7280',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          <span style={{ marginRight: '12px' }}>🚪</span>
          Log out
        </div>
      </div>

      {/* Main Content Area - Full Width */}
      <div style={{
        marginLeft: '280px',
        width: 'calc(100vw - 280px)',
        minHeight: '100vh',
        background: '#F5F5F5',
        padding: '0'
      }}>
        {/* Header Section */}
        <div style={{
          padding: '32px 40px 24px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#1F2937',
              margin: '0 0 8px 0'
            }}>
              Welcome Back, {user?.firstName || 'Zac'} 👋
            </h1>
            <p style={{
              fontSize: '16px',
              color: '#6B7280',
              margin: '0'
            }}>
              Ready to test and grow your store today?
            </p>
          </div>
          
          <button 
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '12px 24px',
              background: '#3B82F6',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}>
            + New Experiment
          </button>
        </div>

        {/* Top Row: Three Blue Cards + What's New */}
        <div style={{
          padding: '0 40px 32px 40px',
          display: 'flex',
          gap: '20px',
          alignItems: 'flex-start'
        }}>
          {/* Active Experiments Card */}
          <div style={{
            flex: 0.6,
            background: '#97CDFF',
            padding: '18px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            minHeight: '110px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{
                fontSize: '32px',
                fontWeight: '700',
                color: '#1F2937',
                marginBottom: '8px'
              }}>
                3
              </div>
              <div style={{
                fontSize: '14px',
                color: '#1F2937',
                marginBottom: '16px'
              }}>
                Active Experiments
              </div>
            </div>
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <span style={{
                  fontSize: '14px',
                  color: '#059669',
                  fontWeight: '600'
                }}>
                  + 30%
                </span>
                <span style={{
                  fontSize: '12px',
                  color: '#1F2937'
                }}>
                  This month
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <div style={{
                  width: '24px',
                  height: '16px',
                  background: '#3B82F6',
                  borderRadius: '2px',
                  opacity: 0.3
                }}></div>
              </div>
            </div>
          </div>

          {/* Winning Variants Found Card */}
          <div style={{
            flex: 0.6,
            background: '#97CDFF',
            padding: '18px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            minHeight: '110px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{
                fontSize: '32px',
                fontWeight: '700',
                color: '#1F2937',
                marginBottom: '8px'
              }}>
                34
              </div>
              <div style={{
                fontSize: '14px',
                color: '#1F2937',
                marginBottom: '16px'
              }}>
                Winning Variants Found
              </div>
            </div>
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <span style={{
                  fontSize: '14px',
                  color: '#059669',
                  fontWeight: '600'
                }}>
                  + 15%
                </span>
                <span style={{
                  fontSize: '12px',
                  color: '#1F2937'
                }}>
                  This month
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <div style={{
                  width: '24px',
                  height: '16px',
                  background: '#3B82F6',
                  borderRadius: '2px',
                  opacity: 0.3
                }}></div>
              </div>
            </div>
          </div>

          {/* Revenue Impact Card */}
          <div style={{
            flex: 0.6,
            background: '#97CDFF',
            padding: '18px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            minHeight: '110px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{
                fontSize: '32px',
                fontWeight: '700',
                color: '#1F2937',
                marginBottom: '8px'
              }}>
                +12%
              </div>
              <div style={{
                fontSize: '14px',
                color: '#1F2937',
                marginBottom: '16px'
              }}>
                Revenue Impact
              </div>
            </div>
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <span style={{
                  fontSize: '14px',
                  color: '#059669',
                  fontWeight: '600'
                }}>
                  + 23%
                </span>
                <span style={{
                  fontSize: '12px',
                  color: '#1F2937'
                }}>
                  This month
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <div style={{
                  width: '24px',
                  height: '16px',
                  background: '#3B82F6',
                  borderRadius: '2px',
                  opacity: 0.3
                }}></div>
              </div>
            </div>
          </div>

          {/* What's New Section - Part of Background */}
          <div style={{
            flex: 1.8,
            padding: '0 0 0 0'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1F2937',
              margin: '0 0 20px 0'
            }}>
              Whats New
            </h2>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#F97316',
                  borderRadius: '50%'
                }}></div>
                <span style={{
                  fontSize: '14px',
                  color: '#1F2937'
                }}>
                  You can now see which version is winning faster — no more guessing!
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#F97316',
                  borderRadius: '50%'
                }}></div>
                <span style={{
                  fontSize: '14px',
                  color: '#1F2937'
                }}>
                  Cleaner graphs to understand your results at a glance
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#F97316',
                  borderRadius: '50%'
                }}></div>
                <span style={{
                  fontSize: '14px',
                  color: '#1F2937'
                }}>
                  Easier setup flow — launch a new test in just 2 clicks
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#F97316',
                  borderRadius: '50%'
                }}></div>
                <span style={{
                  fontSize: '14px',
                  color: '#1F2937'
                }}>
                  Shopify sync improved — your products and pages show up instantly
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#F97316',
                  borderRadius: '50%'
                }}></div>
                <span style={{
                  fontSize: '14px',
                  color: '#1F2937'
                }}>
                  Added tooltips & guides so you always know what each number means
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div style={{
          padding: '0 40px 40px 25px',
          display: 'flex',
          gap: '24px',
          alignItems: 'flex-start'
        }}>
          {/* Left Column */}
          <div style={{
            flex: 2
          }}>
            {/* Experiment Overview Graph - Part of Background */}
            <div style={{
              padding: '24px',
              marginBottom: '24px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <h2 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    margin: '0'
                  }}>
                    Experiment Overview
                  </h2>
                  <div style={{
                    position: 'relative',
                    display: 'inline-block'
                  }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      background: '#6B7280',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '10px',
                      color: '#FFFFFF',
                      fontWeight: 'bold'
                    }}
                    onMouseEnter={(e) => {
                      const tooltip = e.currentTarget.nextElementSibling;
                      if (tooltip) tooltip.style.display = 'block';
                    }}
                    onMouseLeave={(e) => {
                      const tooltip = e.currentTarget.nextElementSibling;
                      if (tooltip) tooltip.style.display = 'none';
                    }}>
                      i
                    </div>
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#1F2937',
                      color: '#FFFFFF',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '5px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                      Conversion rate over time for all experiments. Hover over data points to see detailed metrics.
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '0',
                        height: '0',
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderTop: '5px solid #1F2937'
                      }}></div>
                    </div>
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  background: '#F3F4F6',
                  borderRadius: '6px',
                  padding: '2px'
                }}>
                  <div style={{
                    padding: '6px 12px',
                    background: '#10B981',
                    color: '#FFFFFF',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    All experiments
                  </div>
                  <div style={{
                    padding: '6px 12px',
                    color: '#6B7280',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    Selected experiment
                  </div>
                </div>
              </div>
              
              {/* Graph Area - No Background */}
              <div style={{
                height: '200px',
                padding: '16px',
                position: 'relative'
              }}>
                {/* Y-axis labels */}
                <div style={{
                  position: 'absolute',
                  left: '16px',
                  top: '16px',
                  bottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#6B7280'
                }}>
                  <span>5%</span>
                  <span>4%</span>
                  <span>3%</span>
                  <span>2%</span>
                  <span>1%</span>
                  <span>0%</span>
                </div>
                
                {/* Graph lines */}
                <div style={{
                  position: 'absolute',
                  left: '60px',
                  right: '16px',
                  top: '16px',
                  bottom: '16px'
                }}>
                  {/* Variant A line (yellow/gold - sine wave pattern) */}
                  <svg width="100%" height="100%" style={{ position: 'absolute' }}>
                    <polyline
                      points="0,120 50,100 100,80 150,100 200,120 250,100 300,80 350,100 400,120 450,100"
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="2"
                    />
                    <circle cx="0" cy="120" r="3" fill="#F59E0B" />
                    <circle cx="50" cy="100" r="3" fill="#F59E0B" />
                    <circle cx="100" cy="80" r="3" fill="#F59E0B" />
                    <circle cx="150" cy="100" r="3" fill="#F59E0B" />
                    <circle cx="200" cy="120" r="3" fill="#F59E0B" />
                    <circle cx="250" cy="100" r="3" fill="#F59E0B" />
                    <circle cx="300" cy="80" r="3" fill="#F59E0B" />
                    <circle cx="350" cy="100" r="3" fill="#F59E0B" />
                    <circle cx="400" cy="120" r="3" fill="#F59E0B" />
                    <circle cx="450" cy="100" r="3" fill="#F59E0B" />
                  </svg>
                  
                  {/* Variant B line (blue - sine wave pattern) */}
                  <svg width="100%" height="100%" style={{ position: 'absolute' }}>
                    <polyline
                      points="0,140 50,120 100,100 150,120 200,140 250,120 300,100 350,120 400,140 450,120"
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2"
                    />
                    <circle cx="0" cy="140" r="3" fill="#3B82F6" />
                    <circle cx="50" cy="120" r="3" fill="#3B82F6" />
                    <circle cx="100" cy="100" r="3" fill="#3B82F6" />
                    <circle cx="150" cy="120" r="3" fill="#3B82F6" />
                    <circle cx="200" cy="140" r="3" fill="#3B82F6" />
                    <circle cx="250" cy="120" r="3" fill="#3B82F6" />
                    <circle cx="300" cy="100" r="3" fill="#3B82F6" />
                    <circle cx="350" cy="120" r="3" fill="#3B82F6" />
                    <circle cx="400" cy="140" r="3" fill="#3B82F6" />
                    <circle cx="450" cy="120" r="3" fill="#3B82F6" />
                  </svg>
                  
                  {/* Control line (grey dotted) */}
                  <svg width="100%" height="100%" style={{ position: 'absolute' }}>
                    <polyline
                      points="0,100 50,95 100,100 150,90 200,85 250,80 300,75 350,80 400,70 450,65"
                      fill="none"
                      stroke="#6B7280"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                      opacity="0.4"
                    />
                  </svg>
                </div>
                
                {/* X-axis labels */}
                <div style={{
                  position: 'absolute',
                  bottom: '0',
                  left: '60px',
                  right: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#6B7280'
                }}>
                  <span>JAN</span>
                  <span>FEB</span>
                  <span>MAR</span>
                  <span>APR</span>
                  <span>MAY</span>
                  <span>JUN</span>
                  <span>JUL</span>
                  <span>AUG</span>
                  <span>SEP</span>
                  <span>OCT</span>
                  <span>NOV</span>
                  <span>DEC</span>
                </div>
              </div>
              
              {/* Legend */}
              <div style={{
                display: 'flex',
                gap: '16px',
                marginTop: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    background: '#3B82F6',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '12px',
                    color: '#1F2937'
                  }}>Variant A</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    background: '#F59E0B',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '12px',
                    color: '#1F2937'
                  }}>Variant B</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    background: '#6B7280',
                    borderRadius: '50%',
                    opacity: '0.4'
                  }}></div>
                  <span style={{
                    fontSize: '12px',
                    color: '#1F2937'
                  }}>Control</span>
                </div>
              </div>
            </div>

            {/* Recent Activity - Part of Background */}
            <div style={{
              padding: '24px',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1F2937',
                margin: '0 0 20px 0'
              }}>
                Recent Activity
              </h2>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#F97316',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    Variant B beat Variant A by 11% in CTR (Product Page Banner Test)
                  </span>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#F97316',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    Experiment "Cart Upsell Offer" reached 97% statistical significance
                  </span>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#F97316',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    New experiment started: "Homepage Hero Image" (running 3 variants)
                  </span>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#F97316',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    Test "Buy Now Button Color" completed — Winner: Variant A (+6% conversions)
                  </span>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#F97316',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    User milestone unlocked: 🎉 10 successful experiments this month
                  </span>
                </div>
              </div>
            </div>

            {/* Legend Scientist Card */}
            <div style={{
              background: '#0038FF',
              padding: '24px',
              borderRadius: '12px',
              color: '#FFFFFF',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '180px'
            }}>
              {/* Top Row - Badge + Title + Mini Containers */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                marginBottom: '16px'
              }}>
                {/* Left Section - Large Badge + Title */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexShrink: 0
                }}>
                  <div style={{
                    width: '45px',
                    height: '45px',
                    background: '#FFFFFF',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px'
                  }}>
                    🏆
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      margin: '0 0 2px 0'
                    }}>
                      Legend Scientist
                    </h3>
                    <p style={{
                      fontSize: '12px',
                      margin: '0',
                      opacity: 0.9
                    }}>
                      Current level/title
                    </p>
                  </div>
                </div>

                {/* Spacer to push mini containers to the right */}
                <div style={{ flex: 1 }}></div>

                {/* Right Section - Mini Containers */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  flexShrink: 0
                }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    padding: '12px',
                    borderRadius: '6px',
                    textAlign: 'center',
                    minWidth: '70px'
                  }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      marginBottom: '2px'
                    }}>
                      23
                    </div>
                    <div style={{
                      fontSize: '9px',
                      opacity: 0.8
                    }}>
                      Tests Run (lifetime)
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    padding: '12px',
                    borderRadius: '6px',
                    textAlign: 'center',
                    minWidth: '70px'
                  }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      marginBottom: '2px'
                    }}>
                      8
                    </div>
                    <div style={{
                      fontSize: '9px',
                      opacity: 0.8
                    }}>
                      Winners Pushed (lifetime)
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Row - Progress Bar */}
              <div style={{
                marginBottom: '16px'
              }}>
                <div style={{
                  marginBottom: '8px'
                }}>
                  <span style={{
                    fontSize: '14px',
                    opacity: 0.9
                  }}>
                    150 pts to go
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: '60%',
                    height: '100%',
                    background: '#FFFFFF',
                    borderRadius: '4px'
                  }}></div>
                </div>
              </div>

              {/* Bottom Row - Mini Badges */}
              <div style={{
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🎉 First Winner Found
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🚀 5 Experiments Launched
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  👥 1000 Visitors Tested
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🔥 Streak: 4 Weeks Testing
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Aligned with What's New */}
          <div style={{
            flex: 1,
            paddingTop: '0',
            paddingLeft: '0'
          }}>
            {/* New Test Ideas - Part of Background */}
            <div style={{
              padding: '0 0 24px 0',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1F2937',
                margin: '0 0 20px 0'
              }}>
                New Test Ideas
              </h2>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: '#10B981',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: '#FFFFFF',
                    flexShrink: 0
                  }}>
                    🚚
                  </div>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '4px'
                    }}>
                      Try a free shipping badge under product prices
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6B7280'
                    }}>
                      Often boosts conversion by 8–12%
                    </div>
                  </div>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: '#10B981',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: '#FFFFFF',
                    flexShrink: 0
                  }}>
                    ⏰
                  </div>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '4px'
                    }}>
                      Test a countdown timer on cart page
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6B7280'
                    }}>
                      Can increase checkout completion by 5–7%
                    </div>
                  </div>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: '#10B981',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: '#FFFFFF',
                    flexShrink: 0
                  }}>
                    🖼️
                  </div>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '4px'
                    }}>
                      Swap product images with lifestyle shots vs. plain backgrounds
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6B7280'
                    }}>
                      Great for A/B testing CTR
                    </div>
                  </div>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: '#10B981',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: '#FFFFFF',
                    flexShrink: 0
                  }}>
                    🛡️
                  </div>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '4px'
                    }}>
                      Add a trust badge near the "Buy Now" button
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6B7280'
                    }}>
                      Improves buyer confidence
                    </div>
                  </div>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: '#10B981',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: '#FFFFFF',
                    flexShrink: 0
                  }}>
                    📝
                  </div>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1F2937',
                      marginBottom: '4px'
                    }}>
                      Experiment with short vs. long product descriptions
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6B7280'
                    }}>
                      Test which drives more add-to-cart
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Features - Part of Background */}
            <div style={{
              padding: '0'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1F2937',
                margin: '0 0 20px 0'
              }}>
                Upcoming Features
              </h2>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#3B82F6',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    Multi-variant testing (beyond A/B) → run A/B/C/D tests simultaneously
                  </span>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#3B82F6',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    AI-powered test suggestions tailored to your store data
                  </span>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#3B82F6',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    Auto-rollout winners → automatically publish winning variant to your store
                  </span>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#3B82F6',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    Deeper analytics: segment results by device, country, or traffic source
                  </span>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#3B82F6',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    fontSize: '14px',
                    color: '#1F2937'
                  }}>
                    One-click report export to PDF & Google Slides for sharing results
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Experiment Creation Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px 32px',
              borderBottom: '1px solid #E5E5E5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1F2937',
                margin: 0
              }}>
                Create New Experiment
              </h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6B7280'
                }}>
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '32px',
              position: 'relative'
            }}>
              {currentStep === 1 && (
                <div style={{
                  animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'translateX(0)',
                  opacity: 1
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    marginBottom: '8px'
                  }}>
                    What do you want to try?
                  </h3>
                  
                  {/* Tabs */}
                  <div style={{
                    display: 'flex',
                    borderBottom: '1px solid #E5E5E5',
                    marginBottom: '24px'
                  }}>
                    <button
                      onClick={() => setActiveTab('queued')}
                      style={{
                        padding: '12px 24px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'queued' ? '2px solid #3B82F6' : '2px solid transparent',
                        color: activeTab === 'queued' ? '#3B82F6' : '#6B7280',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}>
                      Queued ({experimentData.queuedIdeas.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('discover')}
                      style={{
                        padding: '12px 24px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'discover' ? '2px solid #3B82F6' : '2px solid transparent',
                        color: activeTab === 'discover' ? '#3B82F6' : '#6B7280',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}>
                      Discover
                    </button>
                  </div>

                  {/* Queued Tab */}
                  {activeTab === 'queued' && (
                    <div>
                      {experimentData.queuedIdeas.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {experimentData.queuedIdeas.map((idea) => (
                            <div 
                              key={idea.id}
                              onClick={() => setSelectedIdea(idea)}
                              style={{
                                padding: '16px',
                                border: selectedIdea?.id === idea.id ? '2px solid #3B82F6' : '1px solid #E5E5E5',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                background: selectedIdea?.id === idea.id ? '#F0F9FF' : '#FFFFFF',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                              <div>
                                <h4 style={{
                                  fontSize: '16px',
                                  fontWeight: '600',
                                  color: '#1F2937',
                                  margin: '0 0 4px 0'
                                }}>
                                  {idea.utility}
                                </h4>
                                <p style={{
                                  fontSize: '14px',
                                  color: '#6B7280',
                                  margin: '0 0 8px 0'
                                }}>
                                  {idea.rationale}
                                </p>
                                <span style={{
                                  fontSize: '12px',
                                  color: '#3B82F6',
                                  background: '#F0F9FF',
                                  padding: '2px 8px',
                                  borderRadius: '12px'
                                }}>
                                  {idea.style}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button style={{
                                  padding: '6px 12px',
                                  background: '#3B82F6',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}>
                                  Use
                                </button>
                                <button style={{
                                  padding: '6px 12px',
                                  background: 'none',
                                  color: '#6B7280',
                                  border: '1px solid #D1D5DB',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}>
                                  Preview
                                </button>
                                <button style={{
                                  padding: '6px 8px',
                                  background: 'none',
                                  color: '#6B7280',
                                  border: 'none',
                                  fontSize: '16px',
                                  cursor: 'pointer'
                                }}>
                                  ⋯
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{
                          textAlign: 'center',
                          padding: '40px 20px',
                          color: '#6B7280'
                        }}>
                          <p style={{ marginBottom: '16px' }}>No queued ideas yet</p>
                          <p style={{ fontSize: '14px', marginBottom: '24px' }}>Swipe to pick an idea. You can always adjust later.</p>
                          <button 
                            onClick={() => setActiveTab('discover')}
                            style={{
                              padding: '8px 16px',
                              background: '#3B82F6',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              cursor: 'pointer'
                            }}>
                            Go to Discover
                          </button>
                        </div>
                      )}
                      
                      <div style={{ marginTop: '24px', textAlign: 'center' }}>
                        <button style={{
                          background: 'none',
                          border: 'none',
                          color: '#3B82F6',
                          fontSize: '14px',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}>
                          Create manually
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Discover Tab */}
                  {activeTab === 'discover' && (
                    <div>
                      <p style={{
                        fontSize: '14px',
                        color: '#6B7280',
                        marginBottom: '24px',
                        textAlign: 'center'
                      }}>
                        Swipe to pick an idea. You can always adjust later.
                      </p>
                      
                      {/* Tinder-style card stack */}
                      <div style={{
                        position: 'relative',
                        height: '350px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        userSelect: 'none'
                      }}>
                        {experimentData.discoverIdeas.slice(cardIndex, cardIndex + 3).map((idea, stackIndex) => {
                          const actualIndex = cardIndex + stackIndex;
                          const isTopCard = stackIndex === 0;
                          const rotation = isTopCard ? (cardOffset / 20) : 0;
                          const scale = isTopCard ? 1 : (1 - stackIndex * 0.05);
                          const opacity = isTopCard ? 1 : (1 - stackIndex * 0.2);
                          
                          return (
                            <div 
                              key={idea.id}
                              className={isTopCard && swipeAnimation ? swipeAnimation : ''}
                              onMouseDown={isTopCard ? handleMouseDown : undefined}
                              onMouseMove={isTopCard ? handleMouseMove : undefined}
                              onMouseUp={isTopCard ? handleMouseUp : undefined}
                              onTouchStart={isTopCard ? handleTouchStart : undefined}
                              onTouchMove={isTopCard ? handleTouchMove : undefined}
                              onTouchEnd={isTopCard ? handleTouchEnd : undefined}
                              style={{
                                position: 'absolute',
                                width: '300px',
                                height: '220px',
                                background: '#FFFFFF',
                                border: '1px solid #E5E5E5',
                                borderRadius: '16px',
                                padding: '24px',
                                boxShadow: isTopCard 
                                  ? `0 ${8 + Math.abs(cardOffset) / 10}px ${20 + Math.abs(cardOffset) / 5}px rgba(0, 0, 0, 0.15)` 
                                  : '0 4px 12px rgba(0, 0, 0, 0.1)',
                                transform: isTopCard 
                                  ? `translateX(${cardOffset}px) translateY(${stackIndex * 4}px) rotate(${rotation}deg) scale(${scale})`
                                  : `translateY(${stackIndex * 4}px) translateX(${stackIndex * 2}px) scale(${scale})`,
                                zIndex: 3 - stackIndex,
                                cursor: isTopCard ? 'grab' : 'default',
                                transition: isTopCard && !isDragging ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                                opacity: opacity,
                                transformOrigin: 'center center'
                              }}>
                              
                              {/* Swipe indicators */}
                              {isTopCard && (
                                <>
                                  <div style={{
                                    position: 'absolute',
                                    top: '20px',
                                    left: '20px',
                                    background: cardOffset > 50 ? '#10B981' : 'rgba(16, 185, 129, 0.3)',
                                    color: '#FFFFFF',
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    transform: `translateX(${Math.max(0, cardOffset - 100)}px)`,
                                    opacity: cardOffset > 30 ? 1 : 0,
                                    transition: 'all 0.2s ease'
                                  }}>
                                    ✓ LIKE
                                  </div>
                                  <div style={{
                                    position: 'absolute',
                                    top: '20px',
                                    right: '20px',
                                    background: cardOffset < -50 ? '#EF4444' : 'rgba(239, 68, 68, 0.3)',
                                    color: '#FFFFFF',
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    transform: `translateX(${Math.min(0, cardOffset + 100)}px)`,
                                    opacity: cardOffset < -30 ? 1 : 0,
                                    transition: 'all 0.2s ease'
                                  }}>
                                    ✕ PASS
                                  </div>
                                </>
                              )}
                              
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '16px'
                              }}>
                                <div style={{
                                  width: '48px',
                                  height: '48px',
                                  background: '#10B981',
                                  borderRadius: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '24px'
                                }}>
                                  {idea.utility === 'Countdown Timer' ? '⏰' :
                                   idea.utility === 'Product Badge' ? '🏆' : '👥'}
                                </div>
                                <div>
                                  <h4 style={{
                                    fontSize: '18px',
                                    fontWeight: '700',
                                    color: '#1F2937',
                                    margin: '0 0 4px 0'
                                  }}>
                                    {idea.utility}
                                  </h4>
                                  <span style={{
                                    fontSize: '12px',
                                    color: '#3B82F6',
                                    background: '#F0F9FF',
                                    padding: '4px 12px',
                                    borderRadius: '16px',
                                    fontWeight: '600'
                                  }}>
                                    {idea.style}
                                  </span>
                                </div>
                              </div>
                              
                              <p style={{
                                fontSize: '15px',
                                color: '#6B7280',
                                margin: '0 0 20px 0',
                                lineHeight: '1.4'
                              }}>
                                {idea.rationale}
                              </p>
                              
                              <div style={{
                                background: '#F9FAFB',
                                padding: '16px',
                                borderRadius: '8px',
                                fontSize: '16px',
                                color: '#1F2937',
                                textAlign: 'center',
                                fontWeight: '500',
                                border: '1px solid #E5E5E5'
                              }}>
                                {idea.preview}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Action buttons */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '20px',
                        marginTop: '32px'
                      }}>
                        <button 
                          onClick={() => handleSwipe('left')}
                          style={{
                            width: '56px',
                            height: '56px',
                            background: '#EF4444',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '50%',
                            fontSize: '24px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                            transition: 'all 0.2s ease',
                            transform: 'scale(1)'
                          }}
                          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                          ✕
                        </button>
                        <button 
                          onClick={() => handleSwipe('up')}
                          style={{
                            width: '56px',
                            height: '56px',
                            background: '#F59E0B',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '50%',
                            fontSize: '24px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                            transition: 'all 0.2s ease',
                            transform: 'scale(1)'
                          }}
                          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                          ?
                        </button>
                        <button 
                          onClick={() => handleSwipe('right')}
                          style={{
                            width: '56px',
                            height: '56px',
                            background: '#10B981',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '50%',
                            fontSize: '24px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                            transition: 'all 0.2s ease',
                            transform: 'scale(1)'
                          }}
                          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                          ✓
                        </button>
                      </div>
                      
                      {/* Progress indicator */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '8px',
                        marginTop: '20px'
                      }}>
                        {experimentData.discoverIdeas.map((_, index) => (
                          <div 
                            key={index}
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: index <= cardIndex ? '#3B82F6' : '#E5E5E5',
                              transition: 'all 0.3s ease'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 2 && (
                <div style={{
                  animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'translateX(0)',
                  opacity: 1
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    marginBottom: '8px'
                  }}>
                    Which product are we testing?
                  </h3>
                  
                  {/* Product Search */}
                  <div style={{
                    marginBottom: '24px'
                  }}>
                    <input
                      type="text"
                      placeholder="Search products..."
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: '#FFFFFF'
                      }}
                    />
                  </div>
                  
                  {/* Product Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px'
                  }}>
                    {products.map((product, index) => {
                      const price = product.priceRangeV2?.minVariantPrice?.amount || '0';
                      const currency = product.priceRangeV2?.minVariantPrice?.currencyCode || 'USD';
                      const imageUrl = product.featuredImage?.url || product.images?.nodes?.[0]?.url;
                      const isBestseller = product.tags?.includes('bestseller') || product.tags?.includes('featured');
                      
                      return (
                        <div 
                          key={product.id}
                          onClick={() => setSelectedProduct(product)}
                          style={{
                            padding: '16px',
                            border: selectedProduct?.id === product.id ? '2px solid #3B82F6' : '1px solid #E5E5E5',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            background: selectedProduct?.id === product.id ? '#F0F9FF' : '#FFFFFF',
                            position: 'relative',
                            transition: 'all 0.2s ease'
                          }}>
                          {isBestseller && (
                            <div style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              background: '#10B981',
                              color: '#FFFFFF',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '600',
                              zIndex: 1
                            }}>
                              BESTSELLER
                            </div>
                          )}
                          <div style={{
                            width: '100%',
                            height: '120px',
                            background: '#F3F4F6',
                            borderRadius: '6px',
                            marginBottom: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            position: 'relative'
                          }}>
                            {imageUrl ? (
                              <img 
                                src={imageUrl} 
                                alt={product.featuredImage?.altText || product.title}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  borderRadius: '6px'
                                }}
                              />
                            ) : (
                              <div style={{
                                fontSize: '32px',
                                color: '#9CA3AF'
                              }}>
                                📦
                              </div>
                            )}
                          </div>
                          <h4 style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#1F2937',
                            margin: '0 0 4px 0',
                            lineHeight: '1.3',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {product.title}
                          </h4>
                          <p style={{
                            fontSize: '12px',
                            color: '#6B7280',
                            margin: 0
                          }}>
                            {currency} {parseFloat(price).toFixed(2)}
                          </p>
                          {product.totalInventory > 0 && (
                            <p style={{
                              fontSize: '10px',
                              color: '#10B981',
                              margin: '4px 0 0 0',
                              fontWeight: '500'
                            }}>
                              {product.totalInventory} in stock
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Concurrency Notice */}
                  <div style={{
                    background: '#FEF3C7',
                    border: '1px solid #F59E0B',
                    borderRadius: '6px',
                    padding: '12px',
                    fontSize: '14px',
                    color: '#92400E',
                    marginBottom: '24px'
                  }}>
                    ⚠️ We recommend one test per page at a time for clean results.
                  </div>
                  
                  {/* Variant Cards Preview */}
                  {selectedProduct && (
                    <div style={{
                      display: 'flex',
                      gap: '16px',
                      marginTop: '24px'
                    }}>
                      {/* Variant Card A (Control) */}
                      <div style={{
                        flex: 1,
                        padding: '16px',
                        border: '2px solid #10B981',
                        borderRadius: '8px',
                        background: '#F0FDF4'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '12px'
                        }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            background: '#10B981',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            A
                          </div>
                          <h4 style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#1F2937',
                            margin: 0
                          }}>
                            Control (current page)
                          </h4>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '80px',
                          background: '#F3F4F6',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden'
                        }}>
                          {selectedProduct.featuredImage?.url ? (
                            <img 
                              src={selectedProduct.featuredImage.url} 
                              alt={selectedProduct.featuredImage.altText || selectedProduct.title}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: '4px'
                              }}
                            />
                          ) : (
                            <div style={{ fontSize: '24px', color: '#9CA3AF' }}>📦</div>
                          )}
                        </div>
                        <p style={{
                          fontSize: '12px',
                          color: '#6B7280',
                          margin: '8px 0 0 0',
                          textAlign: 'center',
                          lineHeight: '1.2'
                        }}>
                          {selectedProduct.title}
                        </p>
                      </div>
                      
                      {/* Variant Card B (Empty) */}
                      <div style={{
                        flex: 1,
                        padding: '16px',
                        border: '2px dashed #D1D5DB',
                        borderRadius: '8px',
                        background: '#FAFAFA',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '140px'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          background: '#F3F4F6',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '12px'
                        }}>
                          +
                        </div>
                        <p style={{
                          fontSize: '14px',
                          color: '#6B7280',
                          margin: 0,
                          textAlign: 'center'
                        }}>
                          Create duplicate variant with added {selectedIdea?.utility || 'widget'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 3 && (
                <div style={{
                  animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'translateX(0)',
                  opacity: 1
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    marginBottom: '8px'
                  }}>
                    Variant & Placement
                  </h3>
                  
                  {/* Two variant cards side by side */}
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    marginBottom: '24px'
                  }}>
                    {/* Card A (Control) - Locked */}
                    <div style={{
                      flex: 1,
                      padding: '20px',
                      border: '2px solid #10B981',
                      borderRadius: '8px',
                      background: '#F0FDF4',
                      opacity: 0.8
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '16px'
                      }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          background: '#10B981',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          A
                        </div>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#1F2937',
                          margin: 0
                        }}>
                          Control
                        </h4>
                        <span style={{
                          fontSize: '12px',
                          color: '#6B7280',
                          background: '#F3F4F6',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          Locked
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '120px',
                        background: '#F3F4F6',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '32px',
                        marginBottom: '12px'
                      }}>
                        {selectedProduct?.image || '📦'}
                      </div>
                      <p style={{
                        fontSize: '14px',
                        color: '#6B7280',
                        margin: 0,
                        textAlign: 'center'
                      }}>
                        Current page (baseline)
                      </p>
                    </div>
                    
                    {/* Card B (Empty) - Interactive */}
                    <div style={{
                      flex: 1,
                      padding: '20px',
                      border: '2px dashed #3B82F6',
                      borderRadius: '8px',
                      background: '#F0F9FF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '200px'
                    }}
                    onClick={() => setPlacementGuideOpen(true)}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        background: '#3B82F6',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        fontSize: '20px',
                        marginBottom: '16px'
                      }}>
                        +
                      </div>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1F2937',
                        margin: '0 0 8px 0',
                        textAlign: 'center'
                      }}>
                        Create duplicate variant with added {selectedIdea?.utility || 'widget'}
                      </h4>
                      <p style={{
                        fontSize: '14px',
                        color: '#6B7280',
                        margin: 0,
                        textAlign: 'center'
                      }}>
                        Click to configure placement
                      </p>
                    </div>
                  </div>
                  
                  {/* Placement Guide Modal */}
                  {placementGuideOpen && (
                    <div style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2000
                    }}>
                      <div style={{
                        background: '#FFFFFF',
                        borderRadius: '12px',
                        width: '90%',
                        maxWidth: '1000px',
                        maxHeight: '90vh',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        {/* Placement Guide Header */}
                        <div style={{
                          padding: '24px 32px',
                          borderBottom: '1px solid #E5E5E5',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <h3 style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#1F2937',
                            margin: 0
                          }}>
                            We'll place {selectedIdea?.utility || 'widget'} where it performs best. Want to choose?
                          </h3>
                          <button 
                            onClick={() => setPlacementGuideOpen(false)}
                            style={{
                              background: 'none',
                              border: 'none',
                              fontSize: '24px',
                              cursor: 'pointer',
                              color: '#6B7280'
                            }}>
                            ×
                          </button>
                        </div>
                        
                        {/* Placement Guide Content */}
                        <div style={{
                          flex: 1,
                          padding: '32px',
                          display: 'flex',
                          gap: '24px'
                        }}>
                          {/* Left: Options */}
                          <div style={{ flex: 1 }}>
                            <h4 style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#1F2937',
                              margin: '0 0 16px 0'
                            }}>
                              Placement Options
                            </h4>
                            
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                              marginBottom: '24px'
                            }}>
                              <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}>
                                <input type="radio" name="placement" value="recommended" defaultChecked />
                                <div>
                                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1F2937' }}>
                                    Recommended placement
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                                    Below Add to Cart button
                                  </div>
                                </div>
                              </label>
                              
                              <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}>
                                <input type="radio" name="placement" value="manual" />
                                <div>
                                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1F2937' }}>
                                    Choose manually
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                                    Select exact position on page
                                  </div>
                                </div>
                              </label>
                            </div>
                            
                            {/* Mini Edit Fields */}
                            <div style={{
                              background: '#F9FAFB',
                              padding: '16px',
                              borderRadius: '8px',
                              marginBottom: '16px'
                            }}>
                              <h5 style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#1F2937',
                                margin: '0 0 12px 0'
                              }}>
                                Customize (Optional)
                              </h5>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                  <label style={{
                                    display: 'block',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    color: '#1F2937',
                                    marginBottom: '4px'
                                  }}>
                                    Short copy (≤60 chars)
                                  </label>
                                  <input 
                                    type="text"
                                    placeholder="Free shipping on orders over $50"
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      border: '1px solid #D1D5DB',
                                      borderRadius: '4px',
                                      fontSize: '14px'
                                    }}
                                  />
                                </div>
                                <div>
                                  <label style={{
                                    display: 'block',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    color: '#1F2937',
                                    marginBottom: '4px'
                                  }}>
                                    Color
                                  </label>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    {['#3B82F6', '#10B981', '#F59E0B', '#EF4444'].map(color => (
                                      <div 
                                        key={color}
                                        style={{
                                          width: '24px',
                                          height: '24px',
                                          background: color,
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          border: '2px solid transparent'
                                        }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <button style={{
                              width: '100%',
                              padding: '12px',
                              background: '#3B82F6',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}>
                              Save placement
                            </button>
                          </div>
                          
                          {/* Right: Live Preview */}
                          <div style={{ flex: 1 }}>
                            <h4 style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#1F2937',
                              margin: '0 0 16px 0'
                            }}>
                              Live Preview
                            </h4>
                            <div style={{
                              border: '1px solid #E5E5E5',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              background: '#FFFFFF'
                            }}>
                              <div style={{
                                height: '300px',
                                background: '#F9FAFB',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative'
                              }}>
                                {/* Mock product page with hotspots */}
                                <div style={{
                                  width: '80%',
                                  background: '#FFFFFF',
                                  borderRadius: '6px',
                                  padding: '16px',
                                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                                }}>
                                  <div style={{ height: '60px', background: '#F3F4F6', borderRadius: '4px', marginBottom: '12px' }}></div>
                                  <div style={{ height: '20px', background: '#E5E5E5', borderRadius: '2px', marginBottom: '8px' }}></div>
                                  <div style={{ height: '16px', background: '#E5E5E5', borderRadius: '2px', marginBottom: '16px', width: '60%' }}></div>
                                  <div style={{ height: '32px', background: '#3B82F6', borderRadius: '4px', marginBottom: '8px' }}></div>
                                  
                                  {/* Hotspot chips */}
                                  <div style={{
                                    position: 'absolute',
                                    top: '20px',
                                    right: '20px',
                                    background: '#FEF3C7',
                                    border: '1px solid #F59E0B',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    fontSize: '10px',
                                    color: '#92400E',
                                    fontWeight: '600'
                                  }}>
                                    Above price
                                  </div>
                                  <div style={{
                                    position: 'absolute',
                                    bottom: '20px',
                                    right: '20px',
                                    background: '#DCFCE7',
                                    border: '1px solid #10B981',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    fontSize: '10px',
                                    color: '#166534',
                                    fontWeight: '600'
                                  }}>
                                    Near ATC
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div style={{
                              marginTop: '12px',
                              textAlign: 'center'
                            }}>
                              <button 
                                onClick={() => openThemeEditor(selectedProduct, selectedIdea)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#3B82F6',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  textDecoration: 'underline'
                                }}>
                                Open in Theme Editor...
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Product Preview Modal */}
                  {selectedProduct && (
                    <div style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2000
                    }}>
                      <div style={{
                        background: '#FFFFFF',
                        borderRadius: '12px',
                        width: '90%',
                        maxWidth: '600px',
                        maxHeight: '80vh',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        {/* Preview Header */}
                        <div style={{
                          padding: '20px 24px',
                          borderBottom: '1px solid #E5E5E5',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <h3 style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#1F2937',
                            margin: 0
                          }}>
                            Product Preview
                          </h3>
                          <button 
                            onClick={() => setSelectedProduct(null)}
                            style={{
                              background: 'none',
                              border: 'none',
                              fontSize: '20px',
                              cursor: 'pointer',
                              color: '#6B7280'
                            }}>
                            ×
                          </button>
                        </div>
                        
                        {/* Preview Content */}
                        <div style={{
                          flex: 1,
                          padding: '24px',
                          overflow: 'auto'
                        }}>
                          <div style={{
                            display: 'flex',
                            gap: '20px',
                            marginBottom: '20px'
                          }}>
                            {/* Product Image */}
                            <div style={{
                              flex: 1,
                              minWidth: '200px'
                            }}>
                              <div style={{
                                width: '100%',
                                height: '200px',
                                background: '#F3F4F6',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {selectedProduct.featuredImage?.url ? (
                                  <img 
                                    src={selectedProduct.featuredImage.url} 
                                    alt={selectedProduct.featuredImage.altText || selectedProduct.title}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover'
                                    }}
                                  />
                                ) : (
                                  <div style={{ fontSize: '48px', color: '#9CA3AF' }}>📦</div>
                                )}
                              </div>
                            </div>
                            
                            {/* Product Details */}
                            <div style={{
                              flex: 1,
                              minWidth: '200px'
                            }}>
                              <h4 style={{
                                fontSize: '20px',
                                fontWeight: '700',
                                color: '#1F2937',
                                margin: '0 0 8px 0'
                              }}>
                                {selectedProduct.title}
                              </h4>
                              
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '12px'
                              }}>
                                <span style={{
                                  fontSize: '18px',
                                  fontWeight: '600',
                                  color: '#1F2937'
                                }}>
                                  {selectedProduct.priceRangeV2?.minVariantPrice?.currencyCode || 'USD'} {parseFloat(selectedProduct.priceRangeV2?.minVariantPrice?.amount || '0').toFixed(2)}
                                </span>
                                {selectedProduct.variants?.nodes?.[0]?.compareAtPrice && (
                                  <span style={{
                                    fontSize: '14px',
                                    color: '#6B7280',
                                    textDecoration: 'line-through'
                                  }}>
                                    {selectedProduct.priceRangeV2?.minVariantPrice?.currencyCode || 'USD'} {parseFloat(selectedProduct.variants.nodes[0].compareAtPrice).toFixed(2)}
                                  </span>
                                )}
                              </div>
                              
                              {selectedProduct.totalInventory > 0 && (
                                <div style={{
                                  background: '#DCFCE7',
                                  color: '#166534',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  display: 'inline-block',
                                  marginBottom: '12px'
                                }}>
                                  {selectedProduct.totalInventory} in stock
                                </div>
                              )}
                              
                              {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                                <div style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '6px',
                                  marginBottom: '12px'
                                }}>
                                  {selectedProduct.tags.slice(0, 3).map((tag, index) => (
                                    <span 
                                      key={index}
                                      style={{
                                        background: '#F0F9FF',
                                        color: '#3B82F6',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '10px',
                                        fontWeight: '500'
                                      }}>
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              
                              <div style={{
                                fontSize: '12px',
                                color: '#6B7280',
                                marginTop: '8px'
                              }}>
                                Created: {new Date(selectedProduct.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div style={{
                            display: 'flex',
                            gap: '12px',
                            justifyContent: 'flex-end'
                          }}>
                            <button 
                              onClick={() => setSelectedProduct(null)}
                              style={{
                                padding: '8px 16px',
                                background: 'none',
                                border: '1px solid #D1D5DB',
                                color: '#6B7280',
                                borderRadius: '6px',
                                fontSize: '14px',
                                cursor: 'pointer'
                              }}>
                              Cancel
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedProduct(null);
                                setCurrentStep(3);
                              }}
                              style={{
                                padding: '8px 16px',
                                background: '#3B82F6',
                                border: 'none',
                                color: '#FFFFFF',
                                borderRadius: '6px',
                                fontSize: '14px',
                                cursor: 'pointer'
                              }}>
                              Use This Product
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Optional: Preview full page button */}
                  <div style={{
                    textAlign: 'center',
                    marginTop: '16px'
                  }}>
                    <button 
                      onClick={() => setSelectedProduct(selectedProduct)}
                      style={{
                        background: 'none',
                        border: '1px solid #D1D5DB',
                        color: '#6B7280',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}>
                      Preview product details
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div style={{
                  animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'translateX(0)',
                  opacity: 1
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937',
                    marginBottom: '8px'
                  }}>
                    Review & launch
                  </h3>
                  
                  {/* Summary Card */}
                  <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E5E5E5',
                    borderRadius: '8px',
                    padding: '24px',
                    marginBottom: '24px'
                  }}>
                    {/* Test Name */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1F2937',
                        marginBottom: '8px'
                      }}>
                        Test name
                      </label>
                      <input 
                        type="text"
                        value={`${selectedIdea?.utility || 'Widget'} on ${selectedProduct?.title || 'Product'}`}
                        onChange={(e) => setExperimentData({...experimentData, testName: e.target.value})}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #D1D5DB',
                          borderRadius: '6px',
                          fontSize: '14px',
                          background: '#FFFFFF'
                        }}
                      />
                    </div>
                    
                    {/* Hypothesis */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1F2937',
                        marginBottom: '8px'
                      }}>
                        Hypothesis
                      </label>
                      <input 
                        type="text"
                        value={`Adding a ${selectedIdea?.utility || 'widget'} near ${experimentData.placement || 'placement'} will increase Add to Cart for ${selectedProduct?.title || 'this product'}.`}
                        onChange={(e) => setExperimentData({...experimentData, hypothesis: e.target.value})}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #D1D5DB',
                          borderRadius: '6px',
                          fontSize: '14px',
                          background: '#FFFFFF'
                        }}
                      />
                    </div>
                    
                    {/* Variants */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1F2937',
                        marginBottom: '8px'
                      }}>
                        Variants
                      </label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{
                          flex: 1,
                          padding: '12px',
                          border: '1px solid #E5E5E5',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <div style={{
                            width: '20px',
                            height: '20px',
                            background: '#10B981',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFFFFF',
                            fontSize: '10px',
                            fontWeight: '600'
                          }}>
                            A
                          </div>
                          <span style={{ fontSize: '14px', color: '#1F2937' }}>Control</span>
                        </div>
                        <div style={{
                          flex: 1,
                          padding: '12px',
                          border: '1px solid #E5E5E5',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <div style={{
                            width: '20px',
                            height: '20px',
                            background: '#3B82F6',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFFFFF',
                            fontSize: '10px',
                            fontWeight: '600'
                          }}>
                            B
                          </div>
                          <span style={{ fontSize: '14px', color: '#1F2937' }}>
                            {selectedIdea?.utility || 'Widget'} (Style S-01)
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Traffic Split */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1F2937',
                        marginBottom: '8px'
                      }}>
                        Traffic split
                      </label>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        background: '#F9FAFB',
                        borderRadius: '6px'
                      }}>
                        <span style={{ fontSize: '14px', color: '#1F2937' }}>50 / 50</span>
                        {!isAdvanced && (
                          <span style={{
                            fontSize: '12px',
                            color: '#6B7280',
                            background: '#F3F4F6',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            Locked in Simple
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Goal Metric */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1F2937',
                        marginBottom: '8px'
                      }}>
                        Goal metric
                      </label>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px',
                        background: '#F9FAFB',
                        borderRadius: '6px'
                      }}>
                        <span style={{ fontSize: '14px', color: '#1F2937' }}>Add to Cart</span>
                        <span style={{
                          fontSize: '12px',
                          color: '#6B7280'
                        }}>
                          (recommended for PDP changes)
                        </span>
                      </div>
                      <p style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        margin: '4px 0 0 0'
                      }}>
                        You can change this later.
                      </p>
                    </div>
                    
                    {/* Autopilot Mode */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1F2937',
                        marginBottom: '8px'
                      }}>
                        Autopilot Mode
                      </label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        {['Faster', 'Balanced', 'Extra careful'].map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setAutopilotMode(mode.toLowerCase())}
                            style={{
                              padding: '8px 16px',
                              background: autopilotMode === mode.toLowerCase() ? '#3B82F6' : '#F3F4F6',
                              color: autopilotMode === mode.toLowerCase() ? '#FFFFFF' : '#6B7280',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}>
                            {mode}
                          </button>
                        ))}
                      </div>
                      <p style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        margin: 0
                      }}>
                        Most stores see a clear result in ~2 weeks with <strong>Balanced</strong>.
                      </p>
                    </div>
                    
                    {/* Auto-push winner */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}>
                        <input 
                          type="checkbox"
                          checked={autoPushWinner}
                          onChange={(e) => setAutoPushWinner(e.target.checked)}
                        />
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937' }}>
                          Auto-push winner
                        </span>
                        <span style={{
                          fontSize: '12px',
                          color: '#10B981',
                          background: '#DCFCE7',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          Recommended
                        </span>
                      </label>
                      <p style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        margin: '4px 0 0 0'
                      }}>
                        We'll swap the winner live when it's clear.
                      </p>
                    </div>
                    
                    {/* Advanced link */}
                    <div style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => setIsAdvanced(!isAdvanced)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#3B82F6',
                          fontSize: '14px',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}>
                        {isAdvanced ? 'Hide' : 'Adjust configurations manually'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Advanced Section */}
                  {isAdvanced && (
                    <div style={{
                      background: '#F0F9FF',
                      border: '1px solid #3B82F6',
                      borderRadius: '8px',
                      padding: '20px',
                      marginBottom: '24px'
                    }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1F2937',
                        margin: '0 0 16px 0'
                      }}>
                        Advanced Settings
                      </h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Traffic Split */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#1F2937',
                            marginBottom: '8px'
                          }}>
                            Traffic split
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input 
                              type="range"
                              min="10"
                              max="90"
                              value={experimentData.trafficSplit}
                              onChange={(e) => setExperimentData({...experimentData, trafficSplit: parseInt(e.target.value)})}
                              style={{ flex: 1 }}
                            />
                            <div style={{
                              display: 'flex',
                              gap: '8px',
                              fontSize: '14px',
                              color: '#1F2937'
                            }}>
                              <span>{experimentData.trafficSplit}%</span>
                              <span>/</span>
                              <span>{100 - experimentData.trafficSplit}%</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Schedule */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#1F2937',
                            marginBottom: '8px'
                          }}>
                            Schedule
                          </label>
                          <input 
                            type="datetime-local"
                            defaultValue={new Date().toISOString().slice(0, 16)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #D1D5DB',
                              borderRadius: '6px',
                              fontSize: '14px'
                            }}
                          />
                        </div>
                        
                        {/* End Conditions */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#1F2937',
                            marginBottom: '8px'
                          }}>
                            End conditions
                          </label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input type="radio" name="endCondition" value="date" />
                              <span style={{ fontSize: '14px', color: '#1F2937' }}>End on date</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input type="radio" name="endCondition" value="impressions" />
                              <span style={{ fontSize: '14px', color: '#1F2937' }}>End at impressions per variant</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input type="radio" name="endCondition" value="conversions" />
                              <span style={{ fontSize: '14px', color: '#1F2937' }}>End at conversions (based on goal)</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input type="radio" name="endCondition" value="minimum" />
                              <span style={{ fontSize: '14px', color: '#1F2937' }}>Require minimum days (e.g., 7)</span>
                            </label>
                          </div>
                        </div>
                        
                        {/* Autopilot off toggle */}
                        <div>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer'
                          }}>
                            <input type="checkbox" />
                            <span style={{ fontSize: '14px', fontWeight: '500', color: '#1F2937' }}>
                              Autopilot off
                            </span>
                          </label>
                          <p style={{
                            fontSize: '12px',
                            color: '#EF4444',
                            margin: '4px 0 0 0'
                          }}>
                            Manual ends can increase false wins.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Validation Notices */}
                  <div style={{
                    background: '#FEF3C7',
                    border: '1px solid #F59E0B',
                    borderRadius: '6px',
                    padding: '12px',
                    fontSize: '14px',
                    color: '#92400E',
                    marginBottom: '24px'
                  }}>
                    ⚠️ Concurrency check: Same page already under test? — show inline warning and disable Launch.
                  </div>
                  
                  <div style={{
                    background: '#F0F9FF',
                    border: '1px solid #3B82F6',
                    borderRadius: '6px',
                    padding: '12px',
                    fontSize: '14px',
                    color: '#1E40AF',
                    marginBottom: '24px'
                  }}>
                    💡 Low traffic hint — suggest broader page or Balanced/Extra careful mode.
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Navigation Bar */}
            <div style={{
              padding: '20px 32px',
              borderTop: '1px solid #E5E5E5',
              background: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {/* Step Progress */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3, 4].map((step) => (
                  <div 
                    key={step}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: step <= currentStep ? '#3B82F6' : '#E5E5E5'
                    }}
                  />
                ))}
              </div>

              {/* Advanced Toggle */}
              <button 
                onClick={() => setIsAdvanced(!isAdvanced)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6B7280',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                Advanced {isAdvanced ? '▲' : '▼'}
              </button>

              {/* Navigation Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                {currentStep > 1 && (
                  <button 
                    onClick={() => setCurrentStep(currentStep - 1)}
                    style={{
                      padding: '8px 16px',
                      background: 'none',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#6B7280',
                      cursor: 'pointer'
                    }}>
                    Back
                  </button>
                )}
                
                {currentStep < 4 ? (
                  <button 
                    onClick={() => setCurrentStep(currentStep + 1)}
                    disabled={!selectedIdea || (currentStep === 2 && !selectedProduct) || (currentStep === 3 && !placementGuideOpen)}
                    style={{
                      padding: '8px 16px',
                      background: '#3B82F6',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      opacity: (!selectedIdea || (currentStep === 2 && !selectedProduct) || (currentStep === 3 && !placementGuideOpen)) ? 0.5 : 1
                    }}>
                    Next
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      // Launch experiment logic here
                      setShowCreateModal(false);
                      setCurrentStep(1);
                      setSelectedIdea(null);
                      setSelectedProduct(null);
                      setPlacementGuideOpen(false);
                      setAutopilotMode('balanced');
                      setAutoPushWinner(true);
                      setExperimentData({
                        idea: null,
                        product: null,
                        variant: null,
                        placement: null,
                        name: '',
                        description: '',
                        testName: '',
                        hypothesis: '',
                        trafficSplit: 50,
                        goalMetric: 'add_to_cart',
                        startDate: new Date(),
                        endConditions: {}
                      });
                    }}
                    style={{
                      padding: '12px 24px',
                      background: '#10B981',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      width: '100%',
                      maxWidth: '200px'
                    }}>
                    Launch Test
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

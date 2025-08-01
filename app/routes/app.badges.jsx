import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { useState } from "react";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log("AB Analytics loader started");
    
    // Get all active A/B tests
    const tests = await prisma.aBTest.findMany({
      where: { status: "running" },
      select: {
        id: true,
        name: true,
        productId: true,
        templateA: true,
        templateB: true,
        trafficSplit: true,
        status: true,
        startDate: true,
        endDate: true
      },
      orderBy: { startDate: "desc" }
    });
    
    console.log("Found tests:", tests.length);

    // Get URL parameters
    const url = new URL(request.url);
    const selectedTestId = url.searchParams.get("testId");

    let analytics = null;
    if (selectedTestId) {
      // Get analytics for selected test
      const impressions = await prisma.aBEvent.count({
        where: {
          testId: selectedTestId,
          eventType: "impression"
        }
      });

      const addToCart = await prisma.aBEvent.count({
        where: {
          testId: selectedTestId,
          eventType: "add_to_cart"
        }
      });

      const checkoutInitiated = await prisma.aBEvent.count({
        where: {
          testId: selectedTestId,
          eventType: "checkout_initiated"
        }
      });

      const purchases = await prisma.aBEvent.count({
        where: {
          testId: selectedTestId,
          eventType: "purchase"
        }
      });

      const cartUpdates = await prisma.aBEvent.count({
        where: {
          testId: selectedTestId,
          eventType: "cart_updated"
        }
      });

      // Get variant breakdown
      const variantBreakdown = await prisma.aBEvent.groupBy({
        by: ["variant", "eventType"],
        where: {
          testId: selectedTestId
        },
        _count: {
          id: true
        }
      });

      analytics = {
        impressions,
        addToCart,
        checkoutInitiated,
        purchases,
        cartUpdates,
        variantBreakdown
      };
    }

    return json({
      tests,
      selectedTestId,
      analytics
    });
  } catch (error) {
    console.error("Error in AB Analytics loader:", error);
    return json({
      tests: [],
      selectedTestId: null,
      analytics: null,
      error: error.message
    });
  }
};

export default function BadgesAndLeaderboard() {
  const { tests, selectedTestId, analytics, error } = useLoaderData();
  const submit = useSubmit();
  const [selectedTest, setSelectedTest] = useState(selectedTestId || "");

  const handleTestChange = (testId) => {
    setSelectedTest(testId);
    if (testId) {
      submit({ testId }, { method: "get" });
    }
  };

  const calculateConversionRate = (numerator, denominator) => {
    if (denominator === 0) return "0%";
    return ((numerator / denominator) * 100).toFixed(2) + "%";
  };

  console.log("BadgesAndLeaderboard component rendered", { tests, selectedTestId, analytics });

  return (
    <div style={{ padding: '20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #32cd32 100%)',
        color: 'white',
        padding: '32px',
        borderRadius: '16px',
        marginBottom: '32px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
      }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>🏆 Badges & Leaderboard</h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>Track performance and optimize your experiments</p>
      </div>

      {/* Test Selection */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '16px',
        marginBottom: '32px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid rgba(50, 205, 50, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#000000' }}>Select A/B Test</h2>
          <div style={{
            background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            {tests.length} Active Tests
          </div>
        </div>
        <select
          value={selectedTest}
          onChange={(e) => handleTestChange(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            background: 'white'
          }}
        >
          <option value="">Choose a test to analyze...</option>
          {tests.map((test) => (
            <option key={test.id} value={test.id}>{test.name}</option>
          ))}
        </select>
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
          Select an A/B test to view detailed analytics and performance metrics
        </p>
      </div>

      {/* Analytics Display */}
      {analytics && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            {/* Impressions */}
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: '1px solid rgba(50, 205, 50, 0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '20px' }}>👁️</span>
                <div style={{
                  background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: '600'
                }}>
                  {calculateConversionRate(analytics.addToCart, analytics.impressions)}
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#000000', marginBottom: '8px' }}>
                {analytics.impressions.toLocaleString()}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Impressions</div>
            </div>

            {/* Add to Cart */}
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: '1px solid rgba(50, 205, 50, 0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '20px' }}>🛒</span>
                <div style={{
                  background: 'linear-gradient(135deg, #9acd32 0%, #6b8e23 100%)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: '600'
                }}>
                  {calculateConversionRate(analytics.addToCart, analytics.impressions)}
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#32cd32', marginBottom: '8px' }}>
                {analytics.addToCart.toLocaleString()}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Add to Cart</div>
            </div>

            {/* Checkout Initiated */}
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: '1px solid rgba(50, 205, 50, 0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '20px' }}>💳</span>
                <div style={{
                  background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: '600'
                }}>
                  {calculateConversionRate(analytics.checkoutInitiated, analytics.impressions)}
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#32cd32', marginBottom: '8px' }}>
                {analytics.checkoutInitiated.toLocaleString()}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Checkout Initiated</div>
            </div>

            {/* Purchases */}
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: '1px solid rgba(50, 205, 50, 0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '20px' }}>💰</span>
                <div style={{
                  background: 'linear-gradient(135deg, #9acd32 0%, #6b8e23 100%)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: '600'
                }}>
                  {calculateConversionRate(analytics.purchases, analytics.impressions)}
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#9acd32', marginBottom: '8px' }}>
                {analytics.purchases.toLocaleString()}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Purchases</div>
            </div>

            {/* Cart Updates */}
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: '1px solid rgba(50, 205, 50, 0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '20px' }}>📊</span>
                <div style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: '600'
                }}>
                  Active
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc2626', marginBottom: '8px' }}>
                {analytics.cartUpdates.toLocaleString()}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Cart Updates</div>
            </div>
          </div>

          {/* Conversion Funnel */}
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '16px',
            marginBottom: '32px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid rgba(50, 205, 50, 0.2)'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#000000', marginBottom: '24px' }}>Conversion Funnel</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Impressions */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Impressions</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#000000' }}>
                    {analytics.impressions.toLocaleString()}
                  </span>
                </div>
                <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: '#32cd32', borderRadius: '4px' }}></div>
                </div>
              </div>
              
              {/* Add to Cart */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', color: '#32cd32' }}>Add to Cart</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#32cd32' }}>
                    {analytics.addToCart.toLocaleString()} ({calculateConversionRate(analytics.addToCart, analytics.impressions)})
                  </span>
                </div>
                <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: analytics.impressions > 0 ? (analytics.addToCart / analytics.impressions) * 100 : 0 + '%', 
                    height: '100%', 
                    background: '#32cd32', 
                    borderRadius: '4px' 
                  }}></div>
                </div>
              </div>
              
              {/* Checkout Initiated */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', color: '#32cd32' }}>Checkout Initiated</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#32cd32' }}>
                    {analytics.checkoutInitiated.toLocaleString()} ({calculateConversionRate(analytics.checkoutInitiated, analytics.impressions)})
                  </span>
                </div>
                <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: analytics.impressions > 0 ? (analytics.checkoutInitiated / analytics.impressions) * 100 : 0 + '%', 
                    height: '100%', 
                    background: '#32cd32', 
                    borderRadius: '4px' 
                  }}></div>
                </div>
              </div>
              
              {/* Purchases */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', color: '#9acd32' }}>Purchases</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#9acd32' }}>
                    {analytics.purchases.toLocaleString()} ({calculateConversionRate(analytics.purchases, analytics.impressions)})
                  </span>
                </div>
                <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: analytics.impressions > 0 ? (analytics.purchases / analytics.impressions) * 100 : 0 + '%', 
                    height: '100%', 
                    background: '#9acd32', 
                    borderRadius: '4px' 
                  }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Variant Breakdown */}
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '16px',
            marginBottom: '32px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid rgba(50, 205, 50, 0.2)'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#000000', marginBottom: '24px' }}>Variant Performance</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {analytics.variantBreakdown.map((item, index) => (
                <div key={index} style={{
                  padding: '16px',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#000000', marginBottom: '4px' }}>
                        Variant {item.variant}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {item.eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                    </div>
                    <div style={{
                      background: 'linear-gradient(135deg, #9acd32 0%, #6b8e23 100%)',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {item._count.id.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
          color: 'white',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px'
        }}>
          <p>Error Loading Analytics: {error}</p>
        </div>
      )}

      {/* No Test Selected */}
      {!selectedTest && !error && (
        <div style={{
          background: 'white',
          padding: '48px 24px',
          borderRadius: '16px',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(50, 205, 50, 0.2)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#000000', marginBottom: '8px' }}>No Test Selected</h2>
          <p style={{ fontSize: '16px', color: '#6b7280' }}>
            Please select an A/B test from the dropdown above to view analytics.
          </p>
        </div>
      )}

      {/* No Tests Available */}
      {!error && tests.length === 0 && (
        <div style={{
          background: 'white',
          padding: '48px 24px',
          borderRadius: '16px',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(50, 205, 50, 0.2)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#000000', marginBottom: '8px' }}>No Active Tests</h2>
          <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '24px' }}>
            You don't have any active A/B tests. Create a test to start seeing analytics.
          </p>
          <button
            onClick={() => window.location.href = '/app/ab-tests'}
            style={{
              background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #228b22 0%, #006400 100%)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)';
            }}
          >
            Create Your First Test
          </button>
        </div>
      )}
    </div>
  );
} 
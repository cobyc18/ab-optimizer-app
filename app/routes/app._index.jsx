import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext, Link } from "@remix-run/react";
import React, { useState } from "react";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

// Figma Design Assets - Dashboard specific assets
const imgPlaceholder = "http://localhost:3845/assets/c9fc7d6b793322789590ccef37f7182244140e0c.png";
const imgLine59 = "http://localhost:3845/assets/e6acbfb8fe84220030b4f382c623d290af131b73.svg";
const imgLine60 = "http://localhost:3845/assets/6fdefdaad07bd3176f051dff8664b72fd8565c7f.svg";
const imgChart = "http://localhost:3845/assets/baf7e28d166b5b283321a852774ef1bdd14f27a6.svg";
const imgGraph = "http://localhost:3845/assets/9b9af956aa583e2a99412e20df5a9e75bf80fdde.svg";
const imgVector = "http://localhost:3845/assets/da7df0a45c49be40bfd8767d7103c37efb03f0d6.svg";
const imgVector1 = "http://localhost:3845/assets/7fe5008c9a6b1cdaf9549ca56f945723f1c85e3e.svg";
const imgVector2 = "http://localhost:3845/assets/5d87a99546af2943d8d4e590bffe963d4ba1d7d5.svg";
const imgVector3 = "http://localhost:3845/assets/8aeda563b5d07bb246e3269201982a2bf0695893.svg";
const imgVector4 = "http://localhost:3845/assets/2ae20abf3ffb8c7432949e47b2eddc72bfe88a95.svg";
const imgVector5 = "http://localhost:3845/assets/c2fb7636bba790f8abc5759046d31f9ff97d4089.svg";
const imgVector6 = "http://localhost:3845/assets/e31598c7df06d3cb5a36f62a3bdd510d4b822902.svg";
const imgFrame2147224432 = "http://localhost:3845/assets/ca4a9b03e163123f65241c5ace3845bafc2a1c4e.svg";
const imgLayer2 = "http://localhost:3845/assets/a9d2b4484df880300053ddc291d4b1508de9f48f.svg";
const imgFrame2147224435 = "http://localhost:3845/assets/452785d63818a5c8e8198f86e2110ab26729a23a.svg";
const img1 = "http://localhost:3845/assets/37f6433eecfe4bba5b55652b996eea8eaa31c272.svg";
const img2 = "http://localhost:3845/assets/aefdaaf09d8161efbb1ad9e2e4ead3a58332e535.svg";
const imgVector7 = "http://localhost:3845/assets/b1a8dd9dcb2f9bc57c5aee95b80168b4fe14075d.svg";
const imgVector8 = "http://localhost:3845/assets/df7e41cc4bc8037fa1f6aaf47c08634a8d8a9f77.svg";
const imgVector9 = "http://localhost:3845/assets/6b645facef47ae73e16a70930d235fb4da42ee2d.svg";
const imgAward = "http://localhost:3845/assets/ba2a64095bc32a278cda21c35ac6bfc74c380c27.svg";
const imgArrowDown2 = "http://localhost:3845/assets/7b59df041cbdc8736eebfca56f0496ca2e5e0b89.svg";
const imgLine62 = "http://localhost:3845/assets/bf7975f6f2b4c3943998210f73b65bf83b77b6df.svg";
const imgLine63 = "http://localhost:3845/assets/276e1036c5497ca9ab217e45810a262790fc3fbd.svg";
const img01IconsLineArrowCircleDownCopy = "http://localhost:3845/assets/70f910ecaf96baffa20bd5afa6db3cbfe4bbe132.svg";
const img01IconsLineArrowCircleDownCopy2 = "http://localhost:3845/assets/a937be020ad68012fc33358c50294cd0b9cca41c.svg";

// Figma Design Variables
const figmaColors = {
  black: "#202226",
  themeDark: "#464255",
  basicFill: "#C5CEE0",
  white: "#ffffff",
  blue: "#0038ff",
  lightBlue: "#97cdff",
  orange: "#ef9362",
  green: "#29ad00",
  yellow: "#f4b207",
  gray: "#e6e6e6",
  lightGray: "#84818a",
  darkGray: "#151515"
};

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Mock data for dashboard
  const mockData = {
    user: {
      name: "Zac",
      level: "Legend Scientist",
      xp: 2100,
      maxXp: 3000
    },
    experiments: [
      {
        id: 1,
        name: "Returns Badge VS Without",
        status: "running",
        variantA: 2100,
        variantB: 2160,
        runtime: "48h",
        goal: "80%"
      }
    ],
    testCards: [
      { id: 1, name: "Test Name", status: "maybe", description: "Architecto consequatur molestias repellat qui. Quia est asd doloremque veniam est rerum. Soluta" },
      { id: 2, name: "Test Name", status: "maybe", description: "Architecto consequatur molestias repellat qui. Quia est asd doloremque veniam est rerum. Soluta" },
      { id: 3, name: "Test Name", status: "maybe", description: "Architecto consequatur molestias repellat qui. Quia est asd doloremque veniam est rerum. Soluta" },
      { id: 4, name: "Test Name", status: "maybe", description: "Architecto consequatur molestias repellat qui. Quia est asd doloremque veniam est rerum. Soluta" }
    ],
    queuedTests: [
      { name: "Shipping badge Design Test" },
      { name: "Feature Bullet Points Test" },
      { name: "Fomo Badge Test" },
      { name: "Scarcity signals Test" },
      { name: "Shipping badge Design Test" },
      { name: "Shipping badge Design Test" }
    ],
    recentActivities: [
      { action: "Paused Badge Test", date: "July 26, 2025" },
      { action: "Winner Found from Scarcity Test", date: "July 26, 2025" },
      { action: "Variation Test Launched", date: "July 26, 2025" },
      { action: "80% Confidence Level Achieve on Running Test", date: "July 26, 2025" },
      { action: "New Progress Level Reached", date: "July 26, 2025" },
      { action: "You've Run Tests for 60 Days in a Row", date: "July 26, 2025" }
    ]
  };

  return json({
    ...mockData,
    shop: session.shop
  });
};

export default function Dashboard() {
  const { user, experiments, testCards, queuedTests, recentActivities, shop } = useLoaderData();
  const [expandedTests, setExpandedTests] = useState(new Set());

  const toggleTestExpansion = (testName) => {
    const newExpanded = new Set(expandedTests);
    if (newExpanded.has(testName)) {
      newExpanded.delete(testName);
    } else {
      newExpanded.add(testName);
    }
    setExpandedTests(newExpanded);
  };

  return (
    <div style={{ 
      padding: '40px 60px', 
      fontFamily: 'Inter, sans-serif', 
      backgroundColor: figmaColors.gray, 
      minHeight: 'calc(100vh - 80px)',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <p style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 400,
            fontSize: '44px',
            color: figmaColors.darkGray,
            margin: '0 0 10px 0'
          }}>
            Welcome Back, {user.name}
          </p>
          <p style={{
            fontSize: '16px',
            color: '#202020',
            margin: 0,
            lineHeight: '26px'
          }}>
            Ready to test and grow your business
          </p>
        </div>
        
        {/* New Experiment Button */}
        <button style={{
          backgroundColor: '#3e3bf3',
          border: 'none',
          borderRadius: '5px',
          padding: '12px 24px',
          cursor: 'pointer'
        }}>
          <p style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 500,
            fontSize: '14px',
            color: figmaColors.white,
            margin: 0
          }}>
            + New Experiment
          </p>
        </button>
      </div>

      {/* Experiment Overview Section */}
      <div style={{
        backgroundColor: figmaColors.lightBlue,
        borderRadius: '20px',
        padding: '40px',
        marginBottom: '40px',
        position: 'relative'
      }}>
        {/* Experiment Title */}
        <div style={{ marginBottom: '30px' }}>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '24px',
            color: figmaColors.darkGray,
            margin: '0 0 20px 0',
            lineHeight: '32px'
          }}>
            Returns Badge VS Without
          </p>
          
          {/* Progress Line */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ width: '100%', height: '4px', backgroundColor: figmaColors.white, borderRadius: '2px', marginBottom: '10px' }}>
              <div style={{ width: '80%', height: '100%', backgroundColor: figmaColors.blue, borderRadius: '2px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: figmaColors.darkGray }}>
              <span>Goal: 80%</span>
              <span>80%</span>
            </div>
          </div>
        </div>
        
        {/* Stats */}
        <div style={{ display: 'flex', gap: '55px', marginBottom: '30px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '24px',
              color: figmaColors.darkGray,
              margin: 0,
              lineHeight: '38.704px'
            }}>
              48 h
            </p>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '16px',
              color: figmaColors.blue,
              margin: 0
            }}>
              Total Run Time
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '24px',
              color: figmaColors.darkGray,
              margin: 0
            }}>
              2,100
            </p>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '16px',
              color: figmaColors.blue,
              margin: 0
            }}>
              Variant A
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '24px',
              color: figmaColors.darkGray,
              margin: 0
            }}>
              2,160
            </p>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '16px',
              color: figmaColors.blue,
              margin: 0
            }}>
              Variant B
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
          <button style={{
            backgroundColor: figmaColors.blue,
            borderRadius: '5px',
            border: 'none',
            padding: '12px 24px',
            cursor: 'pointer'
          }}>
            <p style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 500,
              fontSize: '14px',
              color: figmaColors.white,
              margin: 0
            }}>
              End Experiment
            </p>
          </button>
          <button style={{
            backgroundColor: figmaColors.lightBlue,
            border: `1px solid ${figmaColors.blue}`,
            borderRadius: '5px',
            padding: '12px 24px',
            cursor: 'pointer'
          }}>
            <p style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 500,
              fontSize: '14px',
              color: figmaColors.blue,
              margin: 0
            }}>
              View Story
            </p>
          </button>
        </div>
        
        {/* Chart Area */}
        <div style={{ marginBottom: '30px' }}>
          <img alt="Chart" src={imgChart} style={{ width: '100%', maxWidth: '800px' }} />
        </div>
        
        {/* Legend */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ backgroundColor: '#3d3af3', borderRadius: '4px', width: '16px', height: '16px' }} />
            <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontSize: '16px', color: figmaColors.themeDark, margin: 0 }}>
              Variant
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ backgroundColor: figmaColors.orange, borderRadius: '4px', width: '16px', height: '16px' }} />
            <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 400, fontSize: '16px', color: figmaColors.themeDark, margin: 0 }}>
              Control
            </p>
          </div>
        </div>
        
        {/* Experiment Overview Text */}
        <div style={{ marginBottom: '30px' }}>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '24px',
            color: figmaColors.blue,
            margin: '0 0 15px 0',
            lineHeight: '32px'
          }}>
            Experiment Overview
          </p>
          <div>
            <span style={{
              fontFamily: 'Geist, sans-serif',
              fontWeight: 500,
              fontSize: '20px',
              color: figmaColors.darkGray,
              lineHeight: '28px'
            }}>
              Returns badge is leading 7.4% ATC with 70% certainty.
            </span>
            <span style={{
              fontFamily: 'Geist, sans-serif',
              fontWeight: 300,
              fontSize: '18px',
              color: figmaColors.darkGray,
              lineHeight: '24px'
            }}>
              We suggest keeping the test active for a few more days to reach a more certain conclusion
            </span>
          </div>
        </div>
        
        {/* AutoPilot */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ width: '28px', height: '28px' }}>
            <img alt="Graph" src={imgGraph} style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ width: '16px', height: '16px' }}>
              <img alt="Vector" src={imgVector} style={{ width: '100%', height: '100%' }} />
            </div>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '16px',
              color: figmaColors.blue,
              margin: 0
            }}>
              AutoPilot On
            </p>
          </div>
        </div>
      </div>

      {/* Ideas To Try Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ width: '40px', height: '40px' }}>
            <img alt="Frame" src={imgFrame2147224435} style={{ width: '100%', height: '100%' }} />
          </div>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '32px',
            color: figmaColors.lightGray,
            margin: 0
          }}>
            Ideas To Try
          </p>
        </div>
        
        {/* Navigation Arrows */}
        <div style={{ display: 'flex', gap: '11px', alignItems: 'center' }}>
          <div style={{
            border: '0.714px solid #414042',
            borderRadius: '25px',
            width: '50px',
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}>
            <div style={{ width: '22.857px', height: '22.857px' }}>
              <img alt="Arrow Left" src={img1} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
          <div style={{
            border: '0.714px solid ' + figmaColors.blue,
            borderRadius: '25px',
            width: '50px',
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}>
            <div style={{ width: '22.857px', height: '22.857px' }}>
              <img alt="Arrow Right" src={img2} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Test Cards */}
      <div style={{ display: 'flex', gap: '25px', marginBottom: '40px', overflowX: 'auto', paddingBottom: '10px', maxWidth: '100%' }}>
        {testCards.map((card, index) => (
          <div
            key={card.id}
            style={{
              backgroundColor: figmaColors.gray,
              border: `1px solid ${figmaColors.blue}`,
              borderRadius: '24px',
              padding: '40px',
              minWidth: '280px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              alignItems: 'flex-start',
              cursor: 'pointer',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-5px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '50px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', alignItems: 'flex-start' }}>
                <div style={{ width: '280px', height: '200px', borderRadius: '10px', overflow: 'hidden' }}>
                  <img alt="Placeholder" src={imgPlaceholder} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start' }}>
                  <p style={{
                    fontFamily: 'Geist, sans-serif',
                    fontWeight: 600,
                    fontSize: '24px',
                    color: figmaColors.darkGray,
                    margin: 0
                  }}>
                    {card.name}
                  </p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px',
                    color: figmaColors.darkGray,
                    margin: 0,
                    lineHeight: '20px',
                    width: '280px'
                  }}>
                    {card.description}
                  </p>
                </div>
              </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '280px' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <div style={{ width: '68px', height: '68px' }}>
                    <img alt="Frame" src={imgFrame2147224432} style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div style={{
                    backgroundColor: figmaColors.yellow,
                    borderRadius: '20px',
                    padding: '5px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <p style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 500,
                      fontSize: '14px',
                      color: figmaColors.yellow,
                      margin: 0,
                      letterSpacing: '0.4px'
                    }}>
                      {card.status}
                    </p>
                  </div>
                </div>
                <div style={{
                  border: `1px solid ${figmaColors.green}`,
                  borderRadius: '43px',
                  width: '68px',
                  height: '68px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}>
                  <div style={{ width: '28.544px', height: '24.013px' }}>
                    <img alt="Layer" src={imgLayer2} style={{ width: '100%', height: '100%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Section */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '32px',
            color: figmaColors.darkGray,
            margin: 0
          }}>
            Summary
          </p>
          <div style={{ cursor: 'pointer' }}>
            <p style={{
              fontFamily: 'SF Pro, sans-serif',
              fontWeight: 400,
              fontSize: '16px',
              color: figmaColors.blue,
              margin: 0,
              lineHeight: '24px'
            }}>
              View More
            </p>
          </div>
        </div>
        
        {/* Summary Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '40px'
        }}>
          {/* Revenue Impact Card */}
          <div style={{
            backgroundColor: figmaColors.lightBlue,
            borderRadius: '20px',
            padding: '40px',
            position: 'relative'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <p style={{
                fontFamily: 'Geist, sans-serif',
                fontWeight: 500,
                fontSize: '44px',
                color: '#14213d',
                margin: '0 0 10px 0',
                lineHeight: '32px'
              }}>
                +12%
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                color: '#14213d',
                margin: '0 0 15px 0',
                lineHeight: '20px'
              }}>
                Revenue Impact
              </p>
              <div>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: figmaColors.blue,
                  margin: '0 0 5px 0'
                }}>
                  + 23%
                </p>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '12px',
                  color: '#14213d',
                  margin: 0
                }}>
                  This month
                </p>
              </div>
            </div>
            <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', width: '80px', height: '60px' }}>
              <img alt="Vector" src={imgVector7} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
          
          {/* Total Test Ran Card */}
          <div style={{
            backgroundColor: figmaColors.lightBlue,
            borderRadius: '20px',
            padding: '40px',
            position: 'relative'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <p style={{
                fontFamily: 'Geist, sans-serif',
                fontWeight: 500,
                fontSize: '44px',
                color: '#14213d',
                margin: '0 0 10px 0',
                lineHeight: '32px'
              }}>
                $ 15,221.00
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                color: '#14213d',
                margin: '0 0 15px 0',
                lineHeight: '20px'
              }}>
                Total Test Ran
              </p>
              <div>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: figmaColors.blue,
                  margin: '0 0 5px 0'
                }}>
                  - 253%
                </p>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '12px',
                  color: '#14213d',
                  margin: 0
                }}>
                  This month
                </p>
              </div>
            </div>
            <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', width: '80px', height: '60px' }}>
              <img alt="Vector" src={imgVector8} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
          
          {/* Total Tested Impressions Card */}
          <div style={{
            backgroundColor: figmaColors.lightBlue,
            borderRadius: '20px',
            padding: '40px',
            position: 'relative'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <p style={{
                fontFamily: 'Geist, sans-serif',
                fontWeight: 500,
                fontSize: '44px',
                color: '#14213d',
                margin: '0 0 10px 0',
                lineHeight: '32px'
              }}>
                2,15,221
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                color: '#14213d',
                margin: '0 0 15px 0',
                lineHeight: '20px'
              }}>
                Total Tested Impressions
              </p>
              <div>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: figmaColors.blue,
                  margin: '0 0 5px 0'
                }}>
                  + 250%
                </p>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '12px',
                  color: '#14213d',
                  margin: 0
                }}>
                  This month
                </p>
              </div>
            </div>
            <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', width: '80px', height: '60px' }}>
              <img alt="Vector" src={imgVector9} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
          
          {/* Progress Card */}
          <div style={{
            backgroundColor: figmaColors.blue,
            borderRadius: '20px',
            padding: '40px',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ width: '24px', height: '24px' }}>
                <img alt="Award" src={imgAward} style={{ width: '100%', height: '100%' }} />
              </div>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                color: figmaColors.white,
                margin: 0,
                flex: 1
              }}>
                Your Progress
              </p>
              <div style={{ width: '16px', height: '16px' }}>
                <img alt="Arrow Down" src={imgArrowDown2} style={{ width: '100%', height: '100%' }} />
              </div>
            </div>
            
            <p style={{
              fontFamily: 'Geist, sans-serif',
              fontWeight: 600,
              fontSize: '24px',
              color: figmaColors.white,
              margin: '0 0 20px 0',
              lineHeight: '32px'
            }}>
              {user.level}
            </p>
            
            <div style={{ marginBottom: '10px' }}>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(user.xp / user.maxXp) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(to right, #97cdff 0%, #ef9362 85%)',
                  borderRadius: '4px'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: '12px',
                  color: figmaColors.lightBlue,
                  margin: 0
                }}>
                  Level Progress
                </p>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '12px',
                  color: figmaColors.white,
                  margin: 0
                }}>
                  {user.xp} / {user.maxXp} XP
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities and Queued Ideas Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px' }}>
        {/* Recent Activities */}
        <div style={{
          backgroundColor: '#d9d9d9',
          borderRadius: '20px',
          padding: '40px'
        }}>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '32px',
            color: figmaColors.darkGray,
            margin: '0 0 25px 0'
          }}>
            Recent Activities
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {recentActivities.map((activity, index) => (
              <div key={index}>
                <div>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '16px',
                    color: figmaColors.darkGray,
                    margin: '0 0 5px 0',
                    lineHeight: '25.27px'
                  }}>
                    {activity.action}
                  </p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '12px',
                    color: figmaColors.lightGray,
                    margin: 0,
                    lineHeight: '22px'
                  }}>
                    {activity.date}
                  </p>
                </div>
                {index < recentActivities.length - 1 && (
                  <div style={{ width: '100%', height: '1px', margin: '15px 0' }}>
                    <img alt="Line" src={imgLine63} style={{ width: '100%' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Queued Ideas */}
        <div>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '32px',
            color: figmaColors.darkGray,
            margin: '0 0 30px 0'
          }}>
            Queued Ideas
          </p>

          {/* Queued Tests List */}
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.85)',
            border: `1px solid ${figmaColors.basicFill}`,
            borderRadius: '24px',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              backgroundColor: '#dbdbdb',
              padding: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                color: figmaColors.darkGray,
                margin: 0
              }}>
                Test Name
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '16px',
                color: figmaColors.darkGray,
                margin: 0
              }}>
                Action
              </p>
            </div>
            
            {/* Tests List */}
            <div style={{ padding: '20px' }}>
              {queuedTests.map((test, index) => (
                <div key={index}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '15px 10px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = 'rgba(0, 56, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent';
                    }}
                    onClick={() => toggleTestExpansion(test.name)}
                  >
                    <p style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 400,
                      fontSize: '16px',
                      color: figmaColors.darkGray,
                      margin: 0,
                      lineHeight: '25.27px'
                    }}>
                      {test.name}
                    </p>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <div style={{ width: '20px', height: '20px' }}>
                        <img alt="Arrow" src={img01IconsLineArrowCircleDownCopy} style={{ width: '100%', height: '100%' }} />
                      </div>
                      <div style={{ width: '20px', height: '20px' }}>
                        <img alt="Arrow" src={img01IconsLineArrowCircleDownCopy2} style={{ width: '100%', height: '100%' }} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Separator */}
                  {index < queuedTests.length - 1 && (
                    <div style={{
                      width: '100%',
                      height: '1px',
                      backgroundColor: figmaColors.basicFill,
                      margin: '10px 0'
                    }} />
                  )}
                  
                  {/* Expanded Content */}
                  {expandedTests.has(test.name) && (
                    <div style={{
                      marginTop: '15px',
                      padding: '20px',
                      backgroundColor: 'rgba(0, 56, 255, 0.05)',
                      borderRadius: '12px',
                      border: `1px solid ${figmaColors.blue}`
                    }}>
                      <p style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                        fontSize: '14px',
                        color: figmaColors.darkGray,
                        margin: '0 0 10px 0'
                      }}>
                        Test Details
                      </p>
                      <p style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 400,
                        fontSize: '14px',
                        color: figmaColors.themeDark,
                        margin: 0,
                        lineHeight: '20px'
                      }}>
                        This test is queued and ready to be launched. Click to configure test parameters and start the experiment.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
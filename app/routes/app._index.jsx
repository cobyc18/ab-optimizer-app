import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext, Link } from "@remix-run/react";
import React, { useState } from "react";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";

// Figma Design Assets - using exact URLs from Figma
const imgOption11 = "http://localhost:3845/assets/d48cc262e275c8268a268985b2afdfac992cf82a.png";
const imgPlaceholder = "http://localhost:3845/assets/c9fc7d6b793322789590ccef37f7182244140e0c.png";
const imgTryLab = "http://localhost:3845/assets/ef6b13f0fd5212ac876c7e1fd3199ccecc56dad9.svg";
const img = "http://localhost:3845/assets/b5c9a49a2261b2416025a79cd7d9dd6cbfc9658c.svg";
const imgCultureTube = "http://localhost:3845/assets/cf28cd19afe656dc8b46f5937016390d82168068.svg";
const imgFrame2147224424 = "http://localhost:3845/assets/efa39d32573b3a5b358191daec34021e25764ff5.svg";
const imgLibrary = "http://localhost:3845/assets/b0c7cc936ce4033e4a3be1dd05c8652a4ac4a208.svg";
const imgSetting = "http://localhost:3845/assets/3a6f557c50a8c28dd7c0eaa9f9af18d5d423db40.svg";
const imgVideo = "http://localhost:3845/assets/e06f33da30f1b2eaf1af76aa79a12b922a7ae7a5.svg";
const imgLogout = "http://localhost:3845/assets/f1bc06ff26e0c1ce023694aa2bbc6d1baeb98698.svg";
const imgGroup1000003393 = "http://localhost:3845/assets/9cdfedb15f38de1d7549dce3b40da36973a9c05c.svg";
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
  const [selectedNavItem, setSelectedNavItem] = useState("Home");
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

  const navigationItems = [
    { id: "Home", label: "Home", icon: img, active: true },
    { id: "Experiments Hub", label: "Experiments Hub", icon: imgCultureTube, active: false },
    { id: "Insights & Report", label: "Insights & Report", icon: imgFrame2147224424, active: false },
    { id: "Widget Library", label: "Widget Library", icon: imgLibrary, active: false },
    { id: "Settings", label: "Settings", icon: imgSetting, active: false },
    { id: "Help / Onboarding", label: "Help / Onboarding", icon: imgVideo, active: false },
    { id: "Log out", label: "Log out", icon: imgLogout, active: false }
  ];

  return (
    <div style={{ backgroundColor: figmaColors.gray, position: 'relative', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* LEFT SIDEBAR */}
      <div style={{ position: 'absolute', left: '26px', top: 0 }}>
        {/* Background line */}
        <div style={{
          position: 'absolute',
          backgroundColor: 'rgba(230,230,230,0.85)',
          height: '2342px',
          left: 'calc(12.5% + 107.5px)',
          mixBlendMode: 'multiply',
          top: 0,
          transform: 'translateX(-50%)',
          width: '1px'
        }} />
        
        {/* TryLab Logo */}
        <div style={{
          position: 'absolute',
          height: '44.613px',
          left: '134.49px',
          top: '67.39px',
          width: '159.51px'
        }}>
          <img alt="TryLab" src={imgTryLab} style={{ width: '100%', height: '100%' }} />
        </div>
        
        {/* User Avatar */}
        <div style={{
          position: 'absolute',
          left: '26px',
          width: '108.793px',
          height: '108.793px',
          top: '35.1px'
        }}>
          <img alt="User Avatar" src={imgOption11} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        
        {/* Navigation Menu */}
        <div style={{
          position: 'absolute',
          left: 'calc(4.167% + 94px)',
          top: '178.32px',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          {navigationItems.map((item, index) => (
            <div
              key={item.id}
              onClick={() => setSelectedNavItem(item.id)}
              style={{
                backgroundColor: selectedNavItem === item.id ? figmaColors.blue : 'transparent',
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
                padding: '16px 24px',
                borderRadius: selectedNavItem === item.id ? '12px' : '60px',
                width: '252px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ width: '28px', height: '28px', flexShrink: 0 }}>
                <img alt={item.label} src={item.icon} style={{ width: '100%', height: '100%' }} />
              </div>
              <p style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 500,
                fontSize: '16px',
                color: selectedNavItem === item.id ? figmaColors.white : figmaColors.themeDark,
                margin: 0,
                letterSpacing: '0.4px'
              }}>
                {item.label}
              </p>
            </div>
          ))}
        </div>
        
        {/* Trial Banner */}
        <div style={{
          position: 'absolute',
          backgroundColor: figmaColors.orange,
          left: 'calc(4.167% + 103.5px)',
          top: '736px',
          transform: 'translateX(-50%)',
          padding: '30px 25px',
          borderRadius: '20px',
          width: '230px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '35px', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '35px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', alignItems: 'flex-start' }}>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: figmaColors.darkGray,
                  margin: 0,
                  letterSpacing: '0.4px'
                }}>
                  You have 9 days on the Pro free trial
                </p>
                <div style={{ width: '180px', height: '0px' }}>
                  <img alt="Progress" src={imgGroup1000003393} style={{ width: '100%' }} />
                </div>
              </div>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                color: figmaColors.darkGray,
                margin: 0,
                letterSpacing: '0.4px',
                lineHeight: '20px'
              }}>
                Usage is unlimited while on trial and will reset when the trial ends.
              </p>
            </div>
            <button style={{
              backgroundColor: figmaColors.blue,
              border: 'none',
              borderRadius: '12px',
              padding: '12px 22px',
              cursor: 'pointer'
            }}>
              <p style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 500,
                fontSize: '14px',
                color: figmaColors.white,
                margin: 0,
                letterSpacing: '0.4px'
              }}>
                Upgrade your free trial →
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ position: 'absolute', left: 'calc(16.667% + 78px)', top: '55.43px', width: '1455px' }}>
        {/* Header */}
        <div style={{ height: '79.568px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', alignItems: 'flex-start', position: 'absolute', left: 0, top: 'calc(50% + 6.284px)', transform: 'translateY(-50%)' }}>
            <p style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 400,
              fontSize: '44px',
              color: figmaColors.darkGray,
              margin: 0
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
          <div style={{ position: 'absolute', right: 0, top: '49.73%', bottom: 0 }}>
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
        </div>

        {/* Experiment Overview Section */}
        <div style={{
          position: 'absolute',
          left: '175px',
          top: '175px',
          width: '1455px',
          height: '869px',
          backgroundColor: figmaColors.lightBlue,
          borderRadius: '20px'
        }}>
          {/* Background */}
          <div style={{
            position: 'absolute',
            left: 'calc(62.5% - 74.5px)',
            top: '175px',
            transform: 'translateX(-50%)',
            width: '1455px',
            height: '869px',
            backgroundColor: figmaColors.lightBlue,
            borderRadius: '20px'
          }} />
          
          {/* Experiment Title */}
          <div style={{
            position: 'absolute',
            left: 'calc(16.667% + 123px)',
            top: '921px'
          }}>
            <div style={{
              position: 'absolute',
              left: 'calc(16.667% + 123px)',
              top: '929.5px',
              transform: 'translateY(-50%)',
              width: '469px'
            }}>
              <p style={{
                fontFamily: 'Geist, sans-serif',
                fontWeight: 500,
                fontSize: '24px',
                color: figmaColors.darkGray,
                margin: 0,
                lineHeight: '32px'
              }}>
                Returns Badge VS Without
              </p>
            </div>
            
            {/* Progress Line */}
            <div style={{
              position: 'absolute',
              left: 'calc(16.667% + 124.068px)',
              top: '993px',
              width: '467.932px',
              height: '0px'
            }}>
              <img alt="Line" src={imgLine59} style={{ width: '100%' }} />
            </div>
            <div style={{
              position: 'absolute',
              left: 'calc(16.667% + 124.068px)',
              top: '993px',
              width: '398.787px',
              height: '0px'
            }}>
              <img alt="Line" src={imgLine60} style={{ width: '100%' }} />
            </div>
            
            {/* Goal */}
            <div style={{
              position: 'absolute',
              left: 'calc(16.667% + 123px)',
              top: '970px',
              width: '416.651px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '14px',
                  color: figmaColors.darkGray,
                  margin: 0,
                  lineHeight: '15px'
                }}>
                  Goal
                </p>
              </div>
              <div>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '14px',
                  color: figmaColors.darkGray,
                  margin: 0,
                  lineHeight: '15px'
                }}>
                  80%
                </p>
              </div>
            </div>
          </div>
          
          {/* Stats */}
          <div style={{
            position: 'absolute',
            left: 'calc(50% + 53px)',
            top: '921px',
            display: 'flex',
            gap: '55px',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start', width: '113px' }}>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '24px',
                color: figmaColors.darkGray,
                margin: 0,
                lineHeight: '38.704px',
                letterSpacing: '0.344px'
              }}>
                48 h
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                color: figmaColors.blue,
                margin: 0,
                lineHeight: '34.833px'
              }}>
                Total Run Time
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start', width: '133px' }}>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '24px',
                color: figmaColors.darkGray,
                margin: 0,
                lineHeight: '38.704px',
                letterSpacing: '0.344px'
              }}>
                2,100
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                color: figmaColors.blue,
                margin: 0,
                lineHeight: '34.833px'
              }}>
                Variant A
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start', width: '133px' }}>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '24px',
                color: figmaColors.darkGray,
                margin: 0,
                lineHeight: '38.704px',
                letterSpacing: '0.344px'
              }}>
                2,160
              </p>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                color: figmaColors.blue,
                margin: 0,
                lineHeight: '34.833px'
              }}>
                Variant B
              </p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div style={{
            position: 'absolute',
            height: '105.453px',
            left: 'calc(83.333% + 22px)',
            top: '902px',
            width: '186px'
          }}>
            <button style={{
              position: 'absolute',
              backgroundColor: figmaColors.blue,
              borderRadius: '5px',
              border: 'none',
              padding: '12px 24px',
              cursor: 'pointer',
              top: 0,
              left: 0,
              right: 0,
              height: '45px'
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
              position: 'absolute',
              backgroundColor: figmaColors.lightBlue,
              border: `1px solid ${figmaColors.blue}`,
              borderRadius: '5px',
              padding: '12px 24px',
              cursor: 'pointer',
              bottom: 0,
              left: 0,
              right: 0,
              height: '45px'
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
          <div style={{
            position: 'absolute',
            left: 'calc(16.667% + 156px)',
            top: '406.18px',
            width: '1246.31px',
            height: '262.306px'
          }}>
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 'calc(62.5% - 57.366px)',
              top: '-5.89%',
              transform: 'translateX(-50%)',
              width: '1246.31px',
              height: '262.306px'
            }}>
              <img alt="Chart" src={imgChart} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
          
          {/* Legend */}
          <div style={{
            position: 'absolute',
            left: 'calc(87.5% - 32.114px)',
            top: '230px',
            transform: 'translateX(-50%)',
            width: '144.92px',
            height: '26.086px',
            display: 'flex',
            gap: '11.594px',
            alignItems: 'center'
          }}>
            <div style={{
              backgroundColor: '#3d3af3',
              borderRadius: '4px',
              width: '17.39px',
              height: '17.39px',
              flexShrink: 0
            }} />
            <p style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 400,
              fontSize: '17.39px',
              color: figmaColors.themeDark,
              margin: 0
            }}>
              Variant
            </p>
          </div>
          
          <div style={{
            position: 'absolute',
            left: 'calc(95.833% - 61.472px)',
            top: '230px',
            transform: 'translateX(-50%)',
            width: '144.92px',
            height: '26.086px',
            display: 'flex',
            gap: '11.594px',
            alignItems: 'center'
          }}>
            <div style={{
              backgroundColor: figmaColors.orange,
              borderRadius: '4px',
              width: '17.39px',
              height: '17.39px',
              flexShrink: 0
            }} />
            <p style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 400,
              fontSize: '17.39px',
              color: figmaColors.themeDark,
              margin: 0
            }}>
              Control
            </p>
          </div>
          
          {/* Experiment Overview Text */}
          <div style={{
            position: 'absolute',
            left: 'calc(45.833% - 437px)',
            top: '230px',
            width: '816px'
          }}>
            <p style={{
              fontFamily: 'Geist, sans-serif',
              fontWeight: 500,
              fontSize: '24px',
              color: figmaColors.blue,
              margin: '0 0 10px 0',
              lineHeight: '32px'
            }}>
              Experiment Overview
            </p>
            <div>
              <span style={{
                fontFamily: 'Geist, sans-serif',
                fontWeight: 500,
                fontSize: '32px',
                color: figmaColors.darkGray,
                lineHeight: '40px'
              }}>
                Returns badge is leading 7.4% ATC with 70% certainty.
              </span>
              <span style={{
                fontFamily: 'Geist, sans-serif',
                fontWeight: 300,
                fontSize: '24px',
                color: figmaColors.darkGray,
                lineHeight: '32px'
              }}>
                We suggest keeping the test active for a few more days to reach a more certain conclusion
              </span>
            </div>
          </div>
          
          {/* AutoPilot */}
          <div style={{
            position: 'absolute',
            left: 'calc(16.667% + 123px)',
            top: '858px',
            display: 'flex',
            gap: '15px',
            alignItems: 'center'
          }}>
            <div style={{ width: '28px', height: '28px', flexShrink: 0 }}>
              <img alt="Graph" src={imgGraph} style={{ width: '100%', height: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: '17.256px', height: '17.552px', flexShrink: 0 }}>
                <img alt="Vector" src={imgVector} style={{ width: '100%', height: '100%' }} />
              </div>
              <div>
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
        </div>

        {/* Ideas To Try Section */}
        <div style={{
          position: 'absolute',
          left: 'calc(16.667% + 78px)',
          top: '1124px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center'
        }}>
          <div style={{ width: '40px', height: '40px', flexShrink: 0 }}>
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
        <div style={{
          position: 'absolute',
          left: 'calc(91.667% - 9px)',
          top: '1124px',
          width: '93px',
          height: '40px',
          display: 'flex',
          gap: '11px',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
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

        {/* Test Cards */}
        <div style={{
          position: 'absolute',
          left: 'calc(16.667% + 78px)',
          top: '1219px',
          width: '1522px',
          display: 'flex',
          gap: '25px',
          alignItems: 'center',
          overflow: 'hidden'
        }}>
          {testCards.map((card, index) => (
            <div
              key={card.id}
              style={{
                backgroundColor: figmaColors.gray,
                border: `1px solid ${figmaColors.blue}`,
                borderRadius: '24px',
                padding: '40px',
                width: '308px',
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
                  <div style={{ width: '308px', height: '245px', borderRadius: '10px', overflow: 'hidden' }}>
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
                      width: '308px'
                    }}>
                      {card.description}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '308px' }}>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ width: '68px', height: '68px', flexShrink: 0 }}>
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
        
        {/* Gradient Overlay */}
        <div style={{
          position: 'absolute',
          background: 'linear-gradient(to right, rgba(255,255,255,0), #e6e6e6)',
          height: '580px',
          right: 0,
          top: '1199px',
          width: '245px'
        }} />

        {/* Summary Section */}
        <div style={{
          position: 'absolute',
          left: 'calc(16.667% + 78px)',
          top: '1879px',
          display: 'flex',
          flexDirection: 'column',
          gap: '30px',
          alignItems: 'flex-start'
        }}>
          <div style={{ display: 'flex', gap: '38px', alignItems: 'center', width: '853px' }}>
            <p style={{
              fontFamily: 'Geist, sans-serif',
              fontWeight: 500,
              fontSize: '32px',
              color: figmaColors.darkGray,
              margin: 0,
              flex: 1
            }}>
              Summary
            </p>
            <div style={{
              borderRadius: '8px',
              padding: '6px 0',
              cursor: 'pointer'
            }}>
              <p style={{
                fontFamily: 'SF Pro, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                color: figmaColors.blue,
                margin: 0,
                lineHeight: '24px',
                textAlign: 'center'
              }}>
                View More
              </p>
            </div>
          </div>
          
          {/* Summary Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 415.412px)',
            gridTemplateRows: 'repeat(2, 232.686px)',
            gap: '40px'
          }}>
            {/* Revenue Impact Card */}
            <div style={{
              gridColumn: '2',
              gridRow: '1',
              backgroundColor: figmaColors.lightBlue,
              borderRadius: '20px',
              width: '415.412px',
              height: '232.686px',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                left: '40.41px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '107px',
                display: 'flex',
                flexDirection: 'column',
                gap: '40px',
                alignItems: 'flex-start'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', alignItems: 'flex-start', width: '100%' }}>
                  <p style={{
                    fontFamily: 'Geist, sans-serif',
                    fontWeight: 500,
                    fontSize: '44px',
                    color: '#14213d',
                    margin: 0,
                    lineHeight: '32px',
                    width: '100%'
                  }}>
                    +12%
                  </p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    color: '#14213d',
                    margin: 0,
                    lineHeight: '20px',
                    width: '100%'
                  }}>
                    Revenue Impact
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'flex-start' }}>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '16px',
                    color: figmaColors.blue,
                    margin: 0,
                    lineHeight: '16px'
                  }}>
                    + 23%
                  </p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '12px',
                    color: '#14213d',
                    margin: 0,
                    lineHeight: '14px'
                  }}>
                    This month
                  </p>
                </div>
              </div>
              <div style={{
                position: 'absolute',
                left: 'calc(50% + 121.706px)',
                top: 'calc(50% + 31.157px)',
                transform: 'translate(-50%, -50%)',
                width: '92px',
                height: '81px'
              }}>
                <img alt="Vector" src={imgVector7} style={{ width: '100%', height: '100%' }} />
              </div>
            </div>
            
            {/* Total Test Ran Card */}
            <div style={{
              gridColumn: '1',
              gridRow: '1',
              backgroundColor: figmaColors.lightBlue,
              borderRadius: '20px',
              width: '415.412px',
              height: '232.686px',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                left: '40.41px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '107px',
                display: 'flex',
                flexDirection: 'column',
                gap: '40px',
                alignItems: 'flex-start'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', alignItems: 'flex-start', width: '100%' }}>
                  <p style={{
                    fontFamily: 'Geist, sans-serif',
                    fontWeight: 500,
                    fontSize: '44px',
                    color: '#14213d',
                    margin: 0,
                    lineHeight: '32px'
                  }}>
                    $ 15,221.00
                  </p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    color: '#14213d',
                    margin: 0,
                    lineHeight: '20px',
                    width: '100%'
                  }}>
                    Total Test Ran
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'flex-start' }}>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '16px',
                    color: figmaColors.blue,
                    margin: 0,
                    lineHeight: '16px'
                  }}>
                    - 253%
                  </p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '12px',
                    color: '#14213d',
                    margin: 0,
                    lineHeight: '14px'
                  }}>
                    This month
                  </p>
                </div>
              </div>
              <div style={{
                position: 'absolute',
                left: 'calc(50% + 120.294px)',
                top: 'calc(50% + 25.657px)',
                transform: 'translate(-50%, -50%)',
                width: '94px',
                height: '92px'
              }}>
                <img alt="Vector" src={imgVector8} style={{ width: '100%', height: '100%' }} />
              </div>
            </div>
            
            {/* Total Tested Impressions Card */}
            <div style={{
              gridColumn: '1',
              gridRow: '2',
              backgroundColor: figmaColors.lightBlue,
              borderRadius: '20px',
              width: '415.412px',
              height: '232.686px',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                left: '40.41px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '107px',
                display: 'flex',
                flexDirection: 'column',
                gap: '40px',
                alignItems: 'flex-start'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', alignItems: 'flex-start', width: '100%' }}>
                  <p style={{
                    fontFamily: 'Geist, sans-serif',
                    fontWeight: 500,
                    fontSize: '44px',
                    color: '#14213d',
                    margin: 0,
                    lineHeight: '32px'
                  }}>
                    2,15,221
                  </p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '14px',
                    color: '#14213d',
                    margin: 0,
                    lineHeight: '20px'
                  }}>
                    Total Tested Impressions
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'flex-start' }}>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '16px',
                    color: figmaColors.blue,
                    margin: 0,
                    lineHeight: '16px'
                  }}>
                    + 250%
                  </p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '12px',
                    color: '#14213d',
                    margin: 0,
                    lineHeight: '14px'
                  }}>
                    This month
                  </p>
                </div>
              </div>
              <div style={{
                position: 'absolute',
                left: 'calc(50% + 119.294px)',
                top: '112px',
                transform: 'translateX(-50%)',
                width: '96px',
                height: '76px'
              }}>
                <img alt="Vector" src={imgVector9} style={{ width: '100%', height: '100%' }} />
              </div>
            </div>
            
            {/* Progress Card */}
            <div style={{
              gridColumn: '2',
              gridRow: '2',
              backgroundColor: figmaColors.blue,
              borderRadius: '20px',
              width: '415.412px',
              height: '232.686px',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                left: '20px',
                top: '20px',
                width: '373.333px',
                height: '24px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <div style={{ width: '24px', height: '24px', flexShrink: 0 }}>
                  <img alt="Award" src={imgAward} style={{ width: '100%', height: '100%' }} />
                </div>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '14px',
                  color: figmaColors.white,
                  margin: 0,
                  lineHeight: '20px',
                  flex: 1
                }}>
                  Your Progress!
                </p>
                <div style={{ width: '16px', height: '16px', flexShrink: 0 }}>
                  <img alt="Arrow Down" src={imgArrowDown2} style={{ width: '100%', height: '100%' }} />
                </div>
              </div>
              
              <p style={{
                position: 'absolute',
                left: '20px',
                top: '59px',
                width: '373.333px',
                fontFamily: 'Geist, sans-serif',
                fontWeight: 600,
                fontSize: '24px',
                color: figmaColors.white,
                margin: 0,
                lineHeight: '32px'
              }}>
                {user.level}
              </p>
              
              <div style={{
                position: 'absolute',
                left: '20px',
                bottom: '13.05%',
                width: '371px',
                height: '24px'
              }}>
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  top: '76.47%',
                  background: 'linear-gradient(to right, #97cdff 0%, #ef9362 85%)',
                  borderRadius: '2000px'
                }} />
                <p style={{
                  position: 'absolute',
                  left: 0,
                  top: 'calc(50% - 17px)',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: '12px',
                  color: figmaColors.lightBlue,
                  margin: 0,
                  lineHeight: '18px'
                }}>
                  Level Progress
                </p>
                <p style={{
                  position: 'absolute',
                  right: '0.06%',
                  top: 'calc(50% - 17px)',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '12px',
                  color: figmaColors.white,
                  margin: 0,
                  lineHeight: '18px',
                  textAlign: 'right'
                }}>
                  {user.xp} / {user.maxXp} XP
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div style={{
          position: 'absolute',
          left: 'calc(66.667% + 22px)',
          top: '1941px',
          width: '551px',
          backgroundColor: '#d9d9d9',
          borderRadius: '20px',
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          gap: '25px',
          alignItems: 'flex-start'
        }}>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontWeight: 500,
            fontSize: '32px',
            color: figmaColors.darkGray,
            margin: 0,
            width: '100%'
          }}>
            Recent Activities
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'flex-start', width: '100%' }}>
            {recentActivities.map((activity, index) => (
              <div key={index} style={{ width: '100%' }}>
                <div style={{ width: '100%' }}>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '16px',
                    color: figmaColors.darkGray,
                    margin: '0 0 0 0',
                    lineHeight: '25.27px'
                  }}>
                    {activity.action}
                  </p>
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400,
                    fontSize: '12px',
                    color: figmaColors.lightGray,
                    margin: '0 0 0 0',
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

        {/* Queued Ideas Section */}
        <p style={{
          position: 'absolute',
          left: 'calc(25% - 82px)',
          top: '2527px',
          fontFamily: 'Geist, sans-serif',
          fontWeight: 500,
          fontSize: '32px',
          color: figmaColors.darkGray,
          margin: 0
        }}>
          Queued Ideas
        </p>

        {/* Queued Tests List */}
        <div style={{
          position: 'absolute',
          left: 'calc(16.667% + 78px)',
          top: '2580px',
          width: '1455px',
          height: '415px'
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(255,255,255,0.85)',
            border: `1px solid ${figmaColors.basicFill}`,
            borderRadius: '24px'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '85.54%',
            left: 0,
            right: 0,
            top: 0,
            backgroundColor: '#dbdbdb',
            borderRadius: '24px 24px 0 0'
          }} />
          
          {/* Header */}
          <p style={{
            position: 'absolute',
            left: '92.92%',
            right: '3.57%',
            top: 'calc(50% - 185.5px)',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '16px',
            color: figmaColors.darkGray,
            margin: 0,
            lineHeight: '16px'
          }}>
            Action
          </p>
          <p style={{
            position: 'absolute',
            left: '3.09%',
            right: '88.66%',
            top: 'calc(50% - 185.5px)',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '16px',
            color: figmaColors.darkGray,
            margin: 0,
            lineHeight: '16px'
          }}>
            Test Name
          </p>
          
          {/* Tests List */}
          <div style={{
            position: 'absolute',
            left: '45px',
            top: '86px',
            width: '1365px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            alignItems: 'center'
          }}>
            {queuedTests.map((test, index) => (
              <div key={index} style={{ width: '100%' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    cursor: 'pointer',
                    padding: '10px',
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
                    justifyContent: 'space-between',
                    width: '60px'
                  }}>
                    <div style={{ width: '20px', height: '20px', flexShrink: 0 }}>
                      <img alt="Arrow" src={img01IconsLineArrowCircleDownCopy} style={{ width: '100%', height: '100%' }} />
                    </div>
                    <div style={{ width: '20px', height: '20px', flexShrink: 0 }}>
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
                    margin: '16px 0'
                  }} />
                )}
                
                {/* Expanded Content */}
                {expandedTests.has(test.name) && (
                  <div style={{
                    marginTop: '16px',
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
  );
}
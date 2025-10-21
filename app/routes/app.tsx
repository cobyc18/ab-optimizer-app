import { Outlet, useLocation } from "@remix-run/react";
import { useState } from "react";

// Figma Design Assets - Sidebar specific assets
const imgOption11 = "http://localhost:3845/assets/d48cc262e275c8268a268985b2afdfac992cf82a.png";
const imgTryLab = "http://localhost:3845/assets/ef6b13f0fd5212ac876c7e1fd3199ccecc56dad9.svg";
const img = "http://localhost:3845/assets/b5c9a49a2261b2416025a79cd7d9dd6cbfc9658c.svg";
const imgCultureTube = "http://localhost:3845/assets/cf28cd19afe656dc8b46f5937016390d82168068.svg";
const imgFrame2147224424 = "http://localhost:3845/assets/efa39d32573b3a5b358191daec34021e25764ff5.svg";
const imgLibrary = "http://localhost:3845/assets/b0c7cc936ce4033e4a3be1dd05c8652a4ac4a208.svg";
const imgSetting = "http://localhost:3845/assets/3a6f557c50a8c28dd7c0eaa9f9af18d5d423db40.svg";
const imgVideo = "http://localhost:3845/assets/e06f33da30f1b2eaf1af76aa79a12b922a7ae7a5.svg";
const imgLogout = "http://localhost:3845/assets/f1bc06ff26e0c1ce023694aa2bbc6d1baeb98698.svg";
const imgGroup1000003393 = "http://localhost:3845/assets/9cdfedb15f38de1d7549dce3b40da36973a9c05c.svg";

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

export default function AppLayout() {
  const location = useLocation();
  const [selectedNavItem, setSelectedNavItem] = useState("Home");

  const navigationItems = [
    { id: "Home", label: "Home", icon: img, href: "/app", active: true },
    { id: "Experiments Hub", label: "Experiments Hub", icon: imgCultureTube, href: "/app/experiments", active: false },
    { id: "Insights & Report", label: "Insights & Report", icon: imgFrame2147224424, href: "/app/insights", active: false },
    { id: "Widget Library", label: "Widget Library", icon: imgLibrary, href: "/app/widgets", active: false },
    { id: "Settings", label: "Settings", icon: imgSetting, href: "/app/settings", active: false },
    { id: "Help / Onboarding", label: "Help / Onboarding", icon: imgVideo, href: "/app/help", active: false },
    { id: "Log out", label: "Log out", icon: imgLogout, href: "/auth/logout", active: false }
  ];

  return (
    <div style={{ backgroundColor: figmaColors.gray, position: 'relative', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* LEFT SIDEBAR */}
      <div style={{ position: 'absolute', left: '60px', top: 0, zIndex: 10 }}>
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
            <a
              key={item.id}
              href={item.href}
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
                transition: 'all 0.2s ease',
                textDecoration: 'none'
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
            </a>
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

      {/* MAIN CONTENT AREA - Adjusted for sidebar */}
      <div style={{ marginLeft: '350px', minHeight: '100vh' }}>
        <Outlet />
      </div>
    </div>
  );
}

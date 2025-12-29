import { Outlet, useLocation, Link } from "@remix-run/react";
import { useState, useEffect } from "react";
import tryLabLogo from "../assets/TryLab-Logo.png";

// Figma Design Assets - Sidebar specific assets (using inline SVG data URIs)
const imgOption11 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='109' height='109'%3E%3Ccircle cx='54.5' cy='54.5' r='54.5' fill='%23C5CEE0'/%3E%3Ccircle cx='54.5' cy='54.5' r='40' fill='%2397cdff'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%230038ff' font-family='Arial' font-size='24' font-weight='bold'%3EZ%3C/text%3E%3C/svg%3E";
const imgTryLab = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='45'%3E%3Ctext x='0' y='35' fill='%23151515' font-family='Poppins, sans-serif' font-size='32' font-weight='600'%3ETryLab%3C/text%3E%3C/svg%3E";
const img = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' stroke='%23151515' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
const imgCultureTube = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Crect x='6' y='4' width='12' height='16' rx='2' stroke='%23151515' stroke-width='2'/%3E%3Cpath d='M9 8h6M9 12h6M9 16h6' stroke='%23151515' stroke-width='2'/%3E%3C/svg%3E";
const imgFrame2147224424 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M3 3v8h8M21 21v-8h-8M21 3l-8 8M3 21l8-8' stroke='%23151515' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E";
const imgLibrary = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M4 19.5A2.5 2.5 0 016.5 17H20' stroke='%23151515' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z' stroke='%23151515' stroke-width='2'/%3E%3C/svg%3E";
const imgSetting = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M12 15a3 3 0 100-6 3 3 0 000 6z' stroke='%23151515' stroke-width='2'/%3E%3Cpath d='M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z' stroke='%23151515' stroke-width='2'/%3E%3C/svg%3E";
const imgVideo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' stroke='%23151515' stroke-width='2'/%3E%3C/svg%3E";
const imgLogout = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9' stroke='%23151515' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
const imgGroup1000003393 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='4'%3E%3Crect x='0' y='0' width='180' height='4' rx='2' fill='%23e6e6e6'/%3E%3Crect x='0' y='0' width='144' height='4' rx='2' fill='%230038ff'/%3E%3C/svg%3E";
const imgChevronLeft = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23151515' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M15 18l-6-6 6-6'/%3E%3C/svg%3E";
const imgChevronRight = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23151515' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 18l6-6-6-6'/%3E%3C/svg%3E";

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
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navigationItems = [
    { id: "Home", label: "Home", icon: img, href: "/app" },
    { id: "A/B Testing", label: "A/B Testing", icon: imgCultureTube, href: "/app/ab-tests" },
    //{ id: "Experiments Hub", label: "Experiments Hub", icon: imgCultureTube, href: "/app/experiments" },
    //{ id: "Insights & Report", label: "Insights & Report", icon: imgFrame2147224424, href: "/app/analytics" },
    //{ id: "Widget Library", label: "Widget Library", icon: imgLibrary, href: "/app/widgets" },
    { id: "Settings", label: "Settings", icon: imgSetting, href: "/app/settings" },
    //{ id: "Subscribe", label: "Subscribe", icon: imgSetting, href: "/app/subscribe" },
    //{ id: "Help / Onboarding", label: "Help / Onboarding", icon: imgVideo, href: "/app/help" },
    //{ id: "Log out", label: "Log out", icon: imgLogout, href: "/auth/logout" }
  ];

  // Update selected item based on current location
  useEffect(() => {
    const currentPath = location.pathname;
    const currentItem = navigationItems.find(item => item.href === currentPath);
    if (currentItem) {
      setSelectedNavItem(currentItem.id);
    }
  }, [location.pathname]);

  return (
    <div style={{ backgroundColor: figmaColors.gray, position: 'relative', minHeight: '100vh', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      {/* LEFT SIDEBAR */}
      <div style={{ 
        position: 'absolute', 
        left: isCollapsed ? '20px' : '0px', 
        top: 0, 
        zIndex: 10,
        transition: 'left 0.3s ease',
        width: isCollapsed ? '80px' : '290px',
        height: '100vh',
        overflow: 'hidden'
      }}>
        {/* TryLab Logo - at the left edge of grey border */}
        {!isCollapsed && (
          <div style={{
            position: 'absolute',
            height: '108.793px',
            left: '0px',
            top: '35.1px',
            width: '108.793px',
            transition: 'opacity 0.3s ease'
          }}>
            <img alt="TryLab Logo" src={tryLabLogo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        )}
        
        {/* TryLab Name - positioned after logo */}
        {!isCollapsed && (
          <div style={{
            position: 'absolute',
            height: '44.613px',
            left: '116px',
            top: '67.39px',
            width: '159.51px',
            transition: 'opacity 0.3s ease'
          }}>
            <img alt="TryLab" src={imgTryLab} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'left' }} />
          </div>
        )}
        
        {/* Navigation Menu */}
        <div style={{
          position: 'absolute',
          left: isCollapsed ? '0' : '0px',
          top: isCollapsed ? '40px' : '178.32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          alignItems: isCollapsed ? 'center' : 'flex-start',
          transition: 'all 0.3s ease',
          width: isCollapsed ? '48px' : '280px'
        }}>
          {navigationItems.map((item, index) => (
            <Link
              key={item.id}
              to={item.href}
              onClick={() => setSelectedNavItem(item.id)}
              onMouseEnter={(e) => {
                if (selectedNavItem !== item.id) {
                  e.currentTarget.style.backgroundColor = 'rgba(191, 219, 254, 0.3)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 56, 255, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedNavItem !== item.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
              style={{
                backgroundColor: selectedNavItem === item.id ? figmaColors.blue : 'transparent',
                display: 'flex',
                gap: isCollapsed ? '0' : '16px',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                padding: isCollapsed ? '12px' : '12px 4px',
                borderRadius: selectedNavItem === item.id ? '12px' : '60px',
                width: isCollapsed ? '48px' : '100%',
                maxWidth: isCollapsed ? '48px' : '280px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                textDecoration: 'none',
                position: 'relative',
                transform: 'scale(1)',
                boxSizing: 'border-box'
              }}
              title={isCollapsed ? item.label : ''}
            >
              <div 
                style={{ 
                  width: '28px', 
                  height: '28px', 
                  flexShrink: 0,
                  transition: 'transform 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  if (selectedNavItem !== item.id) {
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedNavItem !== item.id) {
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
              >
                <img 
                  alt={item.label} 
                  src={item.icon} 
                  style={{ 
                    width: '100%', 
                    height: '100%',
                    filter: selectedNavItem === item.id ? 'brightness(0) invert(1)' : 'none',
                    transition: 'filter 0.3s ease, transform 0.3s ease'
                  }} 
                />
              </div>
              {!isCollapsed && (
                <p style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500,
                  fontSize: '16px',
                  color: selectedNavItem === item.id ? figmaColors.white : figmaColors.themeDark,
                  margin: 0,
                  letterSpacing: '0.4px',
                  whiteSpace: 'nowrap',
                  opacity: isCollapsed ? 0 : 1,
                  transition: 'opacity 0.3s ease'
                }}>
                  {item.label}
                </p>
              )}
            </Link>
          ))}
        </div>
        
        {/* Trial Banner - only show when expanded 
        {!isCollapsed && (
          <div style={{
            position: 'absolute',
            backgroundColor: figmaColors.orange,
            left: 'calc(4.167% + 103.5px)',
            top: '736px',
            transform: 'translateX(-50%)',
            padding: '30px 25px',
            borderRadius: '20px',
            width: '230px',
            transition: 'opacity 0.3s ease'
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
        )}
        */}

        {/* Collapse/Expand Toggle Button - Positioned between TryLab name and vertical line */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          onMouseEnter={(e) => {
            const icon = e.currentTarget.querySelector('.toggle-icon') as HTMLElement;
            if (icon) {
              icon.style.opacity = '0';
            }
            const arrow = e.currentTarget.querySelector('.toggle-arrow') as HTMLElement;
            if (arrow) {
              arrow.style.opacity = '1';
            }
          }}
          onMouseLeave={(e) => {
            const icon = e.currentTarget.querySelector('.toggle-icon') as HTMLElement;
            if (icon) {
              icon.style.opacity = '1';
            }
            const arrow = e.currentTarget.querySelector('.toggle-arrow') as HTMLElement;
            if (arrow) {
              arrow.style.opacity = '0';
            }
          }}
          style={{
            position: 'absolute',
            top: isCollapsed ? '20px' : '67.39px',
            left: isCollapsed ? '0px' : '245px',
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '8px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s ease',
            zIndex: 20
          }}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {/* Hamburger Menu Icon */}
          <div 
            className="toggle-icon"
            style={{ 
              position: 'absolute',
              width: '20px',
              height: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'opacity 0.3s ease',
              opacity: 1
            }}
          >
            <div style={{
              width: '100%',
              height: '3px',
              backgroundColor: '#151515',
              borderRadius: '2px'
            }} />
            <div style={{
              width: '100%',
              height: '3px',
              backgroundColor: '#151515',
              borderRadius: '2px'
            }} />
            <div style={{
              width: '100%',
              height: '3px',
              backgroundColor: '#151515',
              borderRadius: '2px'
            }} />
          </div>
          
          {/* Arrow Icon (shown on hover) */}
          <img 
            className="toggle-arrow"
            src={isCollapsed ? imgChevronRight : imgChevronLeft} 
            alt={isCollapsed ? 'Expand' : 'Collapse'} 
            style={{ 
              width: '20px', 
              height: '20px',
              position: 'absolute',
              transition: 'opacity 0.3s ease',
              opacity: 0
            }} 
          />
        </button>
      </div>

      {/* Vertical Separator Line - Only within grey background */}
      <div style={{
        position: 'absolute',
        left: isCollapsed ? '100px' : '290px',
        top: 0,
        height: '100vh',
        width: '2px',
        backgroundColor: 'rgba(0, 0, 0, 0.15)',
        zIndex: 5,
        transition: 'left 0.3s ease'
      }} />

      {/* MAIN CONTENT AREA - Adjusted for sidebar */}
      <div style={{ 
        marginLeft: isCollapsed ? '100px' : '290px', 
        minHeight: '100vh',
        transition: 'margin-left 0.3s ease'
      }}>
        <Outlet />
      </div>
    </div>
  );
}

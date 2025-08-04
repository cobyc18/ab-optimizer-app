import { Link, Outlet, useLoaderData, useRouteError, useLocation } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { authenticate } from "../shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useState } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  return { 
    user: {
      shop: (admin as any).shop || '',
      email: (admin as any).email || '',
      firstName: (admin as any).firstName || '',
      lastName: (admin as any).lastName || '',
      accountOwner: (admin as any).accountOwner || false,
      locale: (admin as any).locale || 'en',
      collaborator: (admin as any).collaborator || false,
      emailVerified: (admin as any).emailVerified || false
    }
  };
};

interface NavigationItem {
  name: string;
  href: string;
  badge?: string;
  icon: string;
}

const navigation: NavigationItem[] = [
  { name: "Dashboard", href: "/app", icon: "📊" },
  { name: "A/B Tests", href: "/app/ab-tests", icon: "🧪" },
  { name: "Recipe Library", href: "/app/recipe-library", icon: "📚" },
  { name: "Badges & Leaderboard", href: "/app/badges", icon: "🏆" },
  { name: "Insights & Reports", href: "/app/analytics", icon: "📈" },
  { name: "Live Themes", href: "/app/themes", icon: "🎨" },
  { name: "Settings", href: "/app/settings", icon: "⚙️" },
];

export default function App() {
  const { user } = useLoaderData<typeof loader>();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const isActive = (path: string) => {
    if (path === '/app') {
      return location.pathname === '/app' || location.pathname === '/app/';
    }
    return location.pathname.startsWith(path);
  };

  const SidebarItem = ({ item }: { item: NavigationItem }) => {
    const isActiveItem = isActive(item.href);
    
    return (
      <Link to={item.href} style={{ textDecoration: 'none' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            margin: '4px 8px',
            borderRadius: '12px',
            color: isActiveItem ? '#ffffff' : '#374151',
            background: isActiveItem 
              ? 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)' 
              : 'transparent',
            border: isActiveItem ? '1px solid #32cd32' : '1px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative',
            transform: 'translateY(0)',
          }}
          onMouseEnter={(e) => {
            if (!isActiveItem) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #9acd32 0%, #6b8e23 100%)';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isActiveItem) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#374151';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          <span style={{ fontSize: '18px', marginRight: '12px', opacity: isActiveItem ? 1 : 0.7 }}>
            {item.icon}
          </span>
          {!isSidebarCollapsed && (
            <>
              <span style={{ 
                fontWeight: isActiveItem ? '600' : '500',
                fontSize: '14px',
                flex: 1
              }}>
                {item.name}
              </span>
              {item.badge && (
                <span style={{
                  fontSize: '10px',
                  background: 'linear-gradient(135deg, #9acd32 0%, #6b8e23 100%)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: '600',
                  marginLeft: '8px'
                }}>
                  {item.badge}
                </span>
              )}
            </>
          )}
          {isActiveItem && (
            <div style={{
              position: 'absolute',
              left: '0',
              top: '0',
              bottom: '0',
              width: '4px',
              background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
              borderRadius: '0 2px 2px 0'
            }} />
          )}
        </div>
      </Link>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f9fafb' }}>
      {/* Beautiful Sidebar */}
      <div style={{
        background: 'linear-gradient(180deg, #000000 0%, #1a1a1a 100%)',
        boxShadow: '4px 0 20px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #32cd32',
        transition: 'all 0.3s ease',
        width: isSidebarCollapsed ? '80px' : '280px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid #32cd32',
          background: 'linear-gradient(135deg, #000000 0%, #32cd32 100%)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'rgba(50, 205, 50, 0.3)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(50, 205, 50, 0.5)'
            }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>AB</span>
            </div>
            {!isSidebarCollapsed && (
              <div style={{ marginLeft: '12px' }}>
                <span style={{ fontWeight: '600', fontSize: '16px' }}>AB Optimizer</span>
                <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>A/B Testing Pro</div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: '16px 8px' }}>
          <div style={{ marginBottom: '16px' }}>
            {!isSidebarCollapsed && (
              <div style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#9acd32',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px',
                paddingLeft: '16px'
              }}>
                Navigation
              </div>
            )}
            <div>
              {navigation.map((item) => (
                <SidebarItem key={item.name} item={item} />
              ))}
            </div>
          </div>
        </nav>

        {/* Sidebar Toggle */}
        <div style={{
          padding: '16px 12px',
          borderTop: '1px solid #32cd32',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #000000 100%)'
        }}>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              color: '#ffffff',
              background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
              border: '1px solid #32cd32',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '14px',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #228b22 0%, #006400 100%)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {isSidebarCollapsed ? (
              <span style={{ fontSize: '16px' }}>→</span>
            ) : (
              <span style={{ fontSize: '16px' }}>←</span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Beautiful Top Bar */}
        <div style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          borderBottom: '1px solid #e5e7eb',
          padding: '16px 24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: 'linear-gradient(135deg, #32cd32 0%, #228b22 100%)',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite'
                }}></div>
                <span style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>
                  {user.shop}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #000000 0%, #32cd32 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
              }}>
                <span style={{ 
                  color: 'white', 
                  fontSize: '16px', 
                  fontWeight: '600'
                }}>
                  {user.firstName ? user.firstName.charAt(0) : 'U'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs: any) => {
  return boundary.headers(headersArgs);
}; 
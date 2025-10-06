import { Link, Outlet, useLoaderData, useRouteError, useLocation } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { authenticate } from "../shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useState } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    console.log('🔍 App route loader called');
    const { admin } = await authenticate.admin(request);
    console.log('🔍 Authentication successful, admin:', admin);
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
  } catch (error) {
    console.error('❌ Authentication failed in app route:', error);
    throw error;
  }
};

interface NavigationItem {
  name: string;
  href: string;
  badge?: string;
  icon: string;
}

const navigation: NavigationItem[] = [
  {
    name: "Dashboard",
    href: "/app",
    icon: "📊"
  },
  {
    name: "Create A/B Test",
    href: "/app/ab-tests",
    icon: "🧪"
  },
  {
    name: "Manage A/B Tests",
    href: "/app/manage-tests",
    icon: "⚙️"
  },
  {
    name: "Analytics",
    href: "/app/analytics",
    icon: "📈"
  },
  {
    name: "Recipe Library",
    href: "/app/recipe-library",
    icon: "📚"
  },
  {
    name: "Section Injector",
    href: "/app/inject-section",
    icon: "🚀",
    badge: "NEW"
  }
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

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
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
            color: isActiveItem ? '#1f2937' : '#6b7280',
            background: isActiveItem 
              ? 'linear-gradient(135deg, rgba(196, 181, 253, 0.15) 0%, rgba(167, 139, 250, 0.08) 100%)' 
              : 'transparent',
            border: isActiveItem ? '1px solid rgba(196, 181, 253, 0.3)' : '1px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative',
            transform: 'translateY(0)',
          }}
          onMouseEnter={(e) => {
            if (!isActiveItem) {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(196, 181, 253, 0.1) 0%, rgba(167, 139, 250, 0.05) 100%)';
              e.currentTarget.style.color = '#1f2937';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(139, 92, 246, 0.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isActiveItem) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#6b7280';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          <span style={{ fontSize: '18px', marginRight: '12px', opacity: isActiveItem ? 1 : 0.8 }}>
            {item.icon}
          </span>
          {!isSidebarCollapsed && (
            <>
              <span style={{ 
                fontWeight: isActiveItem ? '600' : '500',
                fontSize: '16px',
                flex: 1
              }}>
                {item.name}
              </span>
              {item.badge && (
                <span style={{
                  fontSize: '10px',
                  background: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)',
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
              background: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)',
              borderRadius: '0 2px 2px 0'
            }} />
          )}
        </div>
      </Link>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)' }}>
      {/* Beautiful Sidebar */}
      <div style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #fafbff 100%)',
        boxShadow: '4px 0 20px rgba(139, 92, 246, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(196, 181, 253, 0.3)',
        transition: 'all 0.3s ease',
        width: isSidebarCollapsed ? '80px' : '280px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid rgba(196, 181, 253, 0.3)',
          background: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.5)'
            }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>TL</span>
            </div>
            {!isSidebarCollapsed && (
              <div style={{ marginLeft: '12px' }}>
                <span style={{ fontWeight: '600', fontSize: '16px' }}>TryLabs Inc.</span>
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
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937',
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
      </div>

      {/* Expand/Collapse Button */}
      <button
        onClick={toggleSidebar}
        style={{
          position: 'absolute',
          top: '105px',
          left: isSidebarCollapsed ? '60px' : '260px',
          transform: 'translateX(-50%)',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'rgba(196, 181, 253, 0.8)',
          border: '1px solid rgba(196, 181, 253, 0.3)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '21px',
          fontWeight: 'bold',
          transition: 'all 0.2s ease',
          zIndex: 1000,
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#c4b5fd';
          e.currentTarget.style.transform = 'translateX(-50%) scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(196, 181, 253, 0.8)';
          e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
        }}
      >
        {isSidebarCollapsed ? '→' : '←'}
      </button>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Beautiful Top Bar */}
        <div style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #fafbff 100%)',
          borderBottom: '1px solid rgba(196, 181, 253, 0.2)',
          padding: '16px 24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)',
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
                background: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)',
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
import { Link, Outlet, useLoaderData, useRouteError, useLocation } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { authenticate } from "../shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { 
  ChartBarIcon, 
  BeakerIcon, 
  BookOpenIcon, 
  TrophyIcon, 
  ChartBarSquareIcon, 
  SwatchIcon, 
  Cog6ToothIcon, 
  ChevronRightIcon, 
  ChevronLeftIcon,
  SparklesIcon,
  UserIcon
} from "@heroicons/react/24/outline";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
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
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navigation: NavigationItem[] = [
  { name: "Dashboard", href: "/app", icon: ChartBarIcon },
  { name: "A/B Tests", href: "/app/ab-tests", icon: BeakerIcon },
  { name: "Recipe Library", href: "/app/recipes", icon: BookOpenIcon, badge: "Soon" },
  { name: "Badges & Leaderboard", href: "/app/badges", icon: TrophyIcon },
  { name: "Insights & Reports", href: "/app/analytics", icon: ChartBarSquareIcon },
  { name: "Live Themes", href: "/app/themes", icon: SwatchIcon },
  { name: "Settings", href: "/app/settings", icon: Cog6ToothIcon },
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
    
    const content = (
      <Link to={item.href}>
        <div
          className={cn(
            "flex items-center p-3 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors group relative",
            isActiveItem && "bg-blue-50 text-blue-700"
          )}
        >
          <item.icon className="w-5 h-5" />
          {!isSidebarCollapsed && (
            <>
              <span className="ml-3 font-medium">{item.name}</span>
              {item.badge && (
                <span className="ml-auto text-xs bg-orange-500 text-white px-2 py-1 rounded-full">
                  {item.badge}
                </span>
              )}
            </>
          )}
          {isActiveItem && (
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r" />
          )}
        </div>
      </Link>
    );

    return content;
  };

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Sidebar */}
      <div className={cn(
        "bg-white shadow-lg flex flex-col border-r border-neutral-200 transition-all duration-300",
        isSidebarCollapsed ? "w-16" : "w-64"
      )}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-neutral-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <SparklesIcon className="w-4 h-4 text-white" />
            </div>
            {!isSidebarCollapsed && (
              <span className="ml-3 font-semibold text-neutral-800">AB Optimizer</span>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-2">
          <div className="space-y-1">
            {navigation.map((item) => (
              <SidebarItem key={item.name} item={item} />
            ))}
          </div>
        </nav>

        {/* Sidebar Toggle */}
        <div className="p-2 border-t border-neutral-200">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-full flex items-center justify-center p-3 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            {isSidebarCollapsed ? (
              <ChevronRightIcon className="w-4 h-4" />
            ) : (
              <ChevronLeftIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-neutral-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-neutral-600 font-medium">{user.shop}</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user.firstName ? user.firstName.charAt(0) : 'U'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-8">
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
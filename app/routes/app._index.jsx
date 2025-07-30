import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext } from "@remix-run/react";
import { 
  BeakerIcon, 
  ChartBarIcon, 
  FireIcon, 
  UsersIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from "@heroicons/react/24/outline";
import { motion } from "framer-motion";

export const loader = async ({ request }) => {
  // In a real app, you'd fetch this data from your database
  const stats = {
    totalTests: 12,
    activeTests: 5,
    totalConversions: 1247,
    conversionRate: 3.2,
    recentActivity: [
      { id: 1, type: 'test_created', message: 'New A/B test created for Product Page', time: '2 hours ago' },
      { id: 2, type: 'test_completed', message: 'Product Title test completed - Variant B won', time: '1 day ago' },
      { id: 3, type: 'conversion', message: 'Checkout button test showing 15% improvement', time: '2 days ago' },
    ]
  };

  return json({ stats });
};

const StatCard = ({ title, value, change, icon: Icon, color = "blue" }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
  >
    <div className="flex items-center">
      <div className={`p-2 rounded-lg bg-${color}-100`}>
        <Icon className={`h-6 w-6 text-${color}-600`} />
      </div>
      <div className="ml-4 flex-1">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        {change && (
          <div className="flex items-center mt-1">
            {change > 0 ? (
              <ArrowUpIcon className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownIcon className="h-4 w-4 text-red-500" />
            )}
            <span className={`ml-1 text-sm font-medium ${
              change > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {Math.abs(change)}%
            </span>
            <span className="ml-1 text-sm text-gray-500">from last month</span>
          </div>
        )}
      </div>
    </div>
  </motion.div>
);

const QuickActionCard = ({ title, description, icon: Icon, href, color = "blue" }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
  >
    <div className="flex items-center">
      <div className={`p-3 rounded-lg bg-${color}-100`}>
        <Icon className={`h-6 w-6 text-${color}-600`} />
      </div>
      <div className="ml-4 flex-1">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  </motion.div>
);

export default function Dashboard() {
  const { stats } = useLoaderData();
  const { user } = useOutletContext();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back! Here's what's happening with your A/B tests.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Tests"
          value={stats.totalTests}
          change={12}
          icon={BeakerIcon}
          color="blue"
        />
        <StatCard
          title="Active Tests"
          value={stats.activeTests}
          change={-5}
          icon={FireIcon}
          color="green"
        />
        <StatCard
          title="Total Conversions"
          value={stats.totalConversions.toLocaleString()}
          change={8}
          icon={UsersIcon}
          color="purple"
        />
        <StatCard
          title="Avg. Conversion Rate"
          value={`${stats.conversionRate}%`}
          change={2.1}
          icon={ChartBarIcon}
          color="orange"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            title="Create New Test"
            description="Set up a new A/B test for your products"
            icon={PlusIcon}
            href="/app/ab-tests/new"
            color="blue"
          />
          <QuickActionCard
            title="View Analytics"
            description="Check detailed performance metrics"
            icon={ChartBarIcon}
            href="/app/analytics"
            color="green"
          />
          <QuickActionCard
            title="Manage Tests"
            description="View and edit existing A/B tests"
            icon={BeakerIcon}
            href="/app/ab-tests"
            color="purple"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flow-root">
              <ul className="-mb-8">
                {stats.recentActivity.map((activity, activityIdx) => (
                  <li key={activity.id}>
                    <div className="relative pb-8">
                      {activityIdx !== stats.recentActivity.length - 1 ? (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                            <BeakerIcon className="h-5 w-5 text-white" />
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                          <div>
                            <p className="text-sm text-gray-500">
                              {activity.message}
                            </p>
                          </div>
                          <div className="whitespace-nowrap text-right text-sm text-gray-500">
                            {activity.time}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
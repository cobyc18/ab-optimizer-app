import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext } from "@remix-run/react";
import { 
  BeakerIcon, 
  ChartBarIcon, 
  FireIcon, 
  UsersIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  SparklesIcon,
  RocketLaunchIcon,
  CpuChipIcon
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
      { id: 1, type: 'test_created', message: 'New A/B test created for Product Page', time: '2 hours ago', icon: BeakerIcon, color: 'blue' },
      { id: 2, type: 'test_completed', message: 'Product Title test completed - Variant B won', time: '1 day ago', icon: ChartBarIcon, color: 'green' },
      { id: 3, type: 'conversion', message: 'Checkout button test showing 15% improvement', time: '2 days ago', icon: FireIcon, color: 'orange' },
    ]
  };

  return json({ stats });
};

const StatCard = ({ title, value, change, icon: Icon, color = "blue" }) => {
  const colorClasses = {
    blue: { bg: 'bg-gradient-to-br from-blue-50 to-blue-100', icon: 'bg-blue-500', text: 'text-blue-700' },
    green: { bg: 'bg-gradient-to-br from-green-50 to-green-100', icon: 'bg-green-500', text: 'text-green-700' },
    purple: { bg: 'bg-gradient-to-br from-purple-50 to-purple-100', icon: 'bg-purple-500', text: 'text-purple-700' },
    orange: { bg: 'bg-gradient-to-br from-orange-50 to-orange-100', icon: 'bg-orange-500', text: 'text-orange-700' }
  };

  const classes = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={`${classes.bg} rounded-xl shadow-sm border border-gray-200/50 p-6 backdrop-blur-sm`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
          {change && (
            <div className="flex items-center">
              {change > 0 ? (
                <ArrowUpIcon className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <ArrowDownIcon className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm font-medium ${
                change > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {Math.abs(change)}%
              </span>
              <span className="ml-1 text-sm text-gray-500">from last month</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${classes.icon} shadow-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </motion.div>
  );
};

const QuickActionCard = ({ title, description, icon: Icon, href, color = "blue" }) => {
  const colorClasses = {
    blue: { bg: 'bg-gradient-to-br from-blue-500 to-blue-600', hover: 'hover:from-blue-600 hover:to-blue-700' },
    green: { bg: 'bg-gradient-to-br from-green-500 to-green-600', hover: 'hover:from-green-600 hover:to-green-700' },
    purple: { bg: 'bg-gradient-to-br from-purple-500 to-purple-600', hover: 'hover:from-purple-600 hover:to-purple-700' }
  };

  const classes = colorClasses[color];

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`${classes.bg} ${classes.hover} rounded-xl shadow-lg p-6 cursor-pointer transition-all duration-200 text-white`}
    >
      <div className="flex items-center">
        <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-blue-100">{description}</p>
        </div>
        <ArrowUpIcon className="h-5 w-5 text-white/70 transform rotate-45" />
      </div>
    </motion.div>
  );
};

export default function Dashboard() {
  const { stats } = useLoaderData();
  const { user } = useOutletContext();

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="flex items-center justify-center space-x-2 mb-2">
          <SparklesIcon className="h-6 w-6 text-blue-500" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Welcome back!
          </h1>
          <SparklesIcon className="h-6 w-6 text-purple-500" />
        </div>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Here's what's happening with your A/B tests. Your optimization journey is looking great!
        </p>
      </motion.div>

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
        <div className="flex items-center space-x-3 mb-6">
          <RocketLaunchIcon className="h-6 w-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="flex items-center space-x-3 mb-6">
          <CpuChipIcon className="h-6 w-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Recent Activity</h2>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="flow-root">
              <ul className="-mb-8">
                {stats.recentActivity.map((activity, activityIdx) => {
                  const Icon = activity.icon;
                  const colorClasses = {
                    blue: 'bg-blue-500',
                    green: 'bg-green-500',
                    orange: 'bg-orange-500',
                    purple: 'bg-purple-500'
                  };
                  
                  return (
                    <motion.li
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: activityIdx * 0.1 }}
                    >
                      <div className="relative pb-8">
                        {activityIdx !== stats.recentActivity.length - 1 ? (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gradient-to-b from-gray-200 to-transparent"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full ${colorClasses[activity.color]} flex items-center justify-center ring-4 ring-white shadow-lg`}>
                              <Icon className="h-4 w-4 text-white" />
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {activity.message}
                              </p>
                            </div>
                            <div className="whitespace-nowrap text-right text-sm text-gray-500">
                              {activity.time}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
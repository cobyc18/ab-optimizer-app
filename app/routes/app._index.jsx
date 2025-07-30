import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext } from "@remix-run/react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import SummaryCards from "../components/SummaryCards";
import GamifiedHero from "../components/GamifiedHero";

export const loader = async ({ request }) => {
  // Mock data - in a real app, you'd fetch this from your database
  const stats = {
    totalTests: 12,
    activeTests: 5,
    totalConversions: 1247,
    conversionRate: 3.2,
    recentActivity: [
      { id: 1, type: 'test_created', message: 'New A/B test created for Product Page', time: '2 hours ago', iconType: 'beaker', color: 'blue' },
      { id: 2, type: 'test_completed', message: 'Product Title test completed - Variant B won', time: '1 day ago', iconType: 'chart', color: 'green' },
      { id: 3, type: 'conversion', message: 'Checkout button test showing 15% improvement', time: '2 days ago', iconType: 'fire', color: 'orange' },
    ]
  };

  return json({ stats });
};

const QuickActionCard = ({ title, description, href, color = "blue" }) => {
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
          <span className="text-white text-lg">+</span>
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-blue-100">{description}</p>
        </div>
        <span className="text-white/70 text-lg">→</span>
      </div>
    </motion.div>
  );
};

const getActivityIcon = (iconType) => {
  switch (iconType) {
    case 'beaker':
      return '🧪';
    case 'chart':
      return '📊';
    case 'fire':
      return '🔥';
    default:
      return '🧪';
  }
};

export default function Dashboard() {
  const { stats } = useLoaderData();
  const { user } = useOutletContext();

  // Mock experiments data
  const experiments = [
    {
      id: 1,
      name: "Product Page Headline",
      description: "Testing different headline variations",
      status: "running",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      lift: 15.2,
      revenueLift: 2500
    },
    {
      id: 2,
      name: "Checkout Button Color",
      description: "Blue vs Green button test",
      status: "completed",
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      lift: 8.7,
      revenueLift: 1200
    }
  ];

  // Mock user progress data
  const userProgress = {
    currentLevel: "Data Scientist",
    xp: 1250,
    streak: 5,
    variantsCreated: 8,
    pointsEarned: 450,
    badges: ["first_test", "week_streak", "high_lift"]
  };

  const updates = [
    {
      icon: "🚀",
      title: "AI-Powered Suggestions",
      description: "Get intelligent test recommendations",
      bgColor: "bg-blue-500/20",
      iconColor: "text-blue-500"
    },
    {
      icon: "📈",
      title: "Enhanced Analytics",
      description: "Deeper insights into your results",
      bgColor: "bg-green-500/20",
      iconColor: "text-green-500"
    },
    {
      icon: "📱",
      title: "Mobile Optimization",
      description: "Better mobile testing experience",
      bgColor: "bg-orange-500/20",
      iconColor: "text-orange-500"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border-b border-neutral-200 -mx-8 -mt-8 px-8 py-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-800">Dashboard</h1>
            <p className="text-neutral-600 mt-1">Welcome back! Here's what's happening with your experiments.</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              className="hover-scale bg-blue-600 text-white hover:bg-blue-700"
            >
              <span className="mr-2">+</span>
              New Experiment
            </Button>
            <div className="w-10 h-10 bg-neutral-200 rounded-full flex items-center justify-center">
              <span className="text-neutral-600 text-sm">U</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <SummaryCards user={userProgress} experiments={experiments} />

      {/* Gamified Hero */}
      <GamifiedHero user={userProgress} experiments={experiments} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* What's New */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>What's New</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {updates.map((update, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className={`w-8 h-8 ${update.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <span className="text-sm">{update.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-neutral-800">{update.title}</h4>
                    <p className="text-sm text-neutral-600 mt-1">{update.description}</p>
                    <a href="#" className="text-blue-600 text-sm font-medium hover:underline">
                      Learn more →
                    </a>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Live Experiments */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Live Experiments</CardTitle>
              <Button variant="link" className="text-blue-600">
                View all →
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {experiments.filter(exp => exp.status === "running").length === 0 ? (
                  <div className="text-center py-8 text-neutral-500">
                    <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-lg">+</span>
                    </div>
                    <p>No live experiments yet</p>
                    <p className="text-sm">Create your first experiment to get started</p>
                  </div>
                ) : (
                  experiments.filter(exp => exp.status === "running").map((experiment) => (
                    <div key={experiment.id} className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                          <h4 className="font-medium text-neutral-800">{experiment.name}</h4>
                          <p className="text-sm text-neutral-600">{experiment.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-6 text-sm">
                        <div className="text-center">
                          <p className="font-medium text-neutral-800">
                            {experiment.createdAt ? Math.floor((Date.now() - new Date(experiment.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0} days
                          </p>
                          <p className="text-neutral-600">Running</p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-green-500">
                            {experiment.lift ? `+${experiment.lift}%` : "+0%"}
                          </p>
                          <p className="text-neutral-600">Lift</p>
                        </div>
                        <Button variant="ghost" size="sm">
                          →
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <h2 className="text-2xl font-bold text-gray-900">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            title="Create New Test"
            description="Set up a new A/B test for your products"
            href="/app/ab-tests/new"
            color="blue"
          />
          <QuickActionCard
            title="View Analytics"
            description="Check detailed performance metrics"
            href="/app/analytics"
            color="green"
          />
          <QuickActionCard
            title="Manage Tests"
            description="View and edit existing A/B tests"
            href="/app/ab-tests"
            color="purple"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <h2 className="text-2xl font-bold text-gray-900">Recent Activity</h2>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="flow-root">
              <ul className="-mb-8">
                {stats.recentActivity.map((activity, activityIdx) => {
                  const activityIcon = getActivityIcon(activity.iconType);
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
                              <span className="text-white text-sm">{activityIcon}</span>
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
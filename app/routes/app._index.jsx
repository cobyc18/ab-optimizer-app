import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext } from "@remix-run/react";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";
import { Tile, TileHeader, TileTitle, TileContent } from "../components/ui/tile";
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
      bgColor: "bg-gradient-to-br from-blue-500/20 to-blue-600/20",
      borderColor: "border-blue-200",
      iconBg: "bg-blue-500/20"
    },
    {
      icon: "📈",
      title: "Enhanced Analytics",
      description: "Deeper insights into your results",
      bgColor: "bg-gradient-to-br from-green-500/20 to-green-600/20",
      borderColor: "border-green-200",
      iconBg: "bg-green-500/20"
    },
    {
      icon: "📱",
      title: "Mobile Optimization",
      description: "Better mobile testing experience",
      bgColor: "bg-gradient-to-br from-orange-500/20 to-orange-600/20",
      borderColor: "border-orange-200",
      iconBg: "bg-orange-500/20"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header Tile */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Tile variant="colorful" className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Welcome back! 👋</h1>
              <p className="text-indigo-100 text-lg">Here's what's happening with your experiments today.</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
              >
                <span className="mr-2">+</span>
                New Experiment
              </Button>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30">
                <span className="text-white font-semibold">
                  {user?.firstName ? user.firstName.charAt(0) : 'U'}
                </span>
              </div>
            </div>
          </div>
        </Tile>
      </motion.div>

      {/* Summary Cards Tile */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Tile variant="default">
          <TileHeader>
            <TileTitle className="flex items-center">
              <span className="mr-2">📊</span>
              Performance Overview
            </TileTitle>
            <p className="text-gray-600 mt-1">Your key metrics at a glance</p>
          </TileHeader>
          <TileContent>
            <SummaryCards user={userProgress} experiments={experiments} />
          </TileContent>
        </Tile>
      </motion.div>

      {/* Gamified Hero Tile */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tile variant="gradient" className="p-0 overflow-hidden">
          <GamifiedHero user={userProgress} experiments={experiments} />
        </Tile>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* What's New Tile */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-1"
        >
          <Tile variant="info">
            <TileHeader>
              <TileTitle className="flex items-center text-blue-800">
                <span className="mr-2">✨</span>
                What's New
              </TileTitle>
            </TileHeader>
            <TileContent className="space-y-4">
              {updates.map((update, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className={`p-4 rounded-xl border ${update.borderColor} ${update.bgColor} backdrop-blur-sm`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-10 h-10 ${update.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <span className="text-lg">{update.icon}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">{update.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{update.description}</p>
                      <a href="#" className="text-blue-600 text-sm font-medium hover:underline mt-2 inline-block">
                        Learn more →
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </TileContent>
          </Tile>
        </motion.div>

        {/* Live Experiments Tile */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Tile variant="success">
            <TileHeader className="flex flex-row items-center justify-between">
              <TileTitle className="flex items-center text-emerald-800">
                <span className="mr-2">🔬</span>
                Live Experiments
              </TileTitle>
              <Button variant="link" className="text-emerald-600 hover:text-emerald-700">
                View all →
              </Button>
            </TileHeader>
            <TileContent>
              <div className="space-y-4">
                {experiments.filter(exp => exp.status === "running").length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">+</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No live experiments yet</h3>
                    <p className="text-sm">Create your first experiment to get started</p>
                    <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white">
                      Create Experiment
                    </Button>
                  </div>
                ) : (
                  experiments.filter(exp => exp.status === "running").map((experiment, index) => (
                    <motion.div
                      key={experiment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className="flex items-center justify-between p-6 bg-white/60 backdrop-blur-sm border border-emerald-200 rounded-xl hover:bg-white/80 transition-all duration-200"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-4 h-4 bg-emerald-500 rounded-full animate-pulse"></div>
                        <div>
                          <h4 className="font-semibold text-gray-800">{experiment.name}</h4>
                          <p className="text-sm text-gray-600">{experiment.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-8 text-sm">
                        <div className="text-center">
                          <p className="font-semibold text-gray-800">
                            {experiment.createdAt ? Math.floor((Date.now() - new Date(experiment.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0} days
                          </p>
                          <p className="text-gray-600">Running</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-emerald-600">
                            {experiment.lift ? `+${experiment.lift}%` : "+0%"}
                          </p>
                          <p className="text-gray-600">Lift</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700">
                          →
                        </Button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </TileContent>
          </Tile>
        </motion.div>
      </div>

      {/* Quick Actions Tile */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Tile variant="default">
          <TileHeader>
            <TileTitle className="flex items-center">
              <span className="mr-2">⚡</span>
              Quick Actions
            </TileTitle>
            <p className="text-gray-600 mt-1">Get started with common tasks</p>
          </TileHeader>
          <TileContent>
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
          </TileContent>
        </Tile>
      </motion.div>

      {/* Recent Activity Tile */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Tile variant="glass">
          <TileHeader>
            <TileTitle className="flex items-center">
              <span className="mr-2">📝</span>
              Recent Activity
            </TileTitle>
            <p className="text-gray-600 mt-1">Your latest testing activities</p>
          </TileHeader>
          <TileContent>
            <div className="flow-root">
              <ul className="-mb-8">
                {stats.recentActivity.map((activity, activityIdx) => {
                  const activityIcon = getActivityIcon(activity.iconType);
                  const colorClasses = {
                    blue: 'bg-gradient-to-br from-blue-500 to-blue-600',
                    green: 'bg-gradient-to-br from-green-500 to-green-600',
                    orange: 'bg-gradient-to-br from-orange-500 to-orange-600',
                    purple: 'bg-gradient-to-br from-purple-500 to-purple-600'
                  };
                  
                  return (
                    <motion.li
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + activityIdx * 0.1 }}
                    >
                      <div className="relative pb-8">
                        {activityIdx !== stats.recentActivity.length - 1 ? (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gradient-to-b from-gray-200 to-transparent"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div className="relative flex space-x-4">
                          <div>
                            <span className={`h-10 w-10 rounded-full ${colorClasses[activity.color]} flex items-center justify-center ring-4 ring-white shadow-lg`}>
                              <span className="text-white text-sm">{activityIcon}</span>
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">
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
          </TileContent>
        </Tile>
      </motion.div>
    </div>
  );
} 
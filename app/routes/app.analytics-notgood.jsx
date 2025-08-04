import { useOutletContext } from "@remix-run/react";
import { 
  ChartBarIcon, 
  SparklesIcon,
  ArrowTrendingUpIcon,
  UsersIcon,
  CurrencyDollarIcon,
  EyeIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CalendarIcon,
  BeakerIcon
} from "@heroicons/react/24/outline";
import { motion } from "framer-motion";

export default function Analytics() {
  const { user } = useOutletContext();

  const metrics = [
    {
      title: "Total Revenue",
      value: "$12,847",
      change: 12.5,
      icon: CurrencyDollarIcon,
      color: "green"
    },
    {
      title: "Conversion Rate",
      value: "3.2%",
      change: 8.1,
      icon: ArrowTrendingUpIcon,
      color: "blue"
    },
    {
      title: "Total Visitors",
      value: "24,521",
      change: -2.3,
      icon: UsersIcon,
      color: "purple"
    },
    {
      title: "Page Views",
      value: "89,234",
      change: 15.7,
      icon: EyeIcon,
      color: "orange"
    }
  ];

  const topTests = [
    {
      name: "Product Page Headline",
      impressions: 1247,
      conversions: 89,
      rate: 7.1,
      improvement: 15.2
    },
    {
      name: "Checkout Button Color",
      impressions: 892,
      conversions: 67,
      rate: 7.5,
      improvement: 8.7
    },
    {
      name: "Product Description",
      impressions: 567,
      conversions: 34,
      rate: 6.0,
      improvement: 12.1
    }
  ];

  const getColorClasses = (color) => {
    const classes = {
      green: { bg: 'bg-green-50', icon: 'bg-green-500', text: 'text-green-700' },
      blue: { bg: 'bg-blue-50', icon: 'bg-blue-500', text: 'text-blue-700' },
      purple: { bg: 'bg-purple-50', icon: 'bg-purple-500', text: 'text-purple-700' },
      orange: { bg: 'bg-orange-50', icon: 'bg-orange-500', text: 'text-orange-700' }
    };
    return classes[color] || classes.blue;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="flex items-center justify-center space-x-2 mb-2">
          <ChartBarIcon className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Analytics
          </h1>
          <SparklesIcon className="h-6 w-6 text-purple-500" />
        </div>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Comprehensive insights into your A/B test performance and conversion optimization.
        </p>
      </motion.div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => {
          const colorClasses = getColorClasses(metric.color);
          const MetricIcon = metric.icon;
          
          return (
            <motion.div
              key={metric.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -2 }}
              className={`${colorClasses.bg} rounded-xl shadow-sm border border-gray-200/50 p-6 backdrop-blur-sm`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-1">{metric.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mb-2">{metric.value}</p>
                  <div className="flex items-center">
                    {metric.change > 0 ? (
                      <ArrowUpIcon className="h-4 w-4 text-green-500 mr-1" />
                    ) : (
                      <ArrowDownIcon className="h-4 w-4 text-red-500 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${
                      metric.change > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {Math.abs(metric.change)}%
                    </span>
                    <span className="ml-1 text-sm text-gray-500">vs last month</span>
                  </div>
                </div>
                <div className={`p-3 rounded-xl ${colorClasses.icon} shadow-lg`}>
                  <MetricIcon className="h-6 w-6 text-white" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Chart Placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Conversion Trends</h3>
            <p className="text-sm text-gray-600">Last 30 days performance</p>
          </div>
          <div className="flex items-center space-x-2">
            <CalendarIcon className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">Last 30 days</span>
          </div>
        </div>
        
        {/* Chart Placeholder */}
        <div className="h-64 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border-2 border-dashed border-blue-200 flex items-center justify-center">
          <div className="text-center">
            <ChartBarIcon className="h-12 w-12 text-blue-400 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">Interactive Chart Coming Soon</p>
            <p className="text-sm text-gray-400">Real-time conversion tracking and visualization</p>
          </div>
        </div>
      </motion.div>

      {/* Top Performing Tests */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <BeakerIcon className="h-6 w-6 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900">Top Performing Tests</h3>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {topTests.map((test, index) => (
            <motion.div
              key={test.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-6 hover:bg-gray-50 transition-colors duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900">{test.name}</h4>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-xs text-gray-500">{test.impressions.toLocaleString()} impressions</span>
                    <span className="text-xs text-gray-500">{test.conversions} conversions</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{test.rate}%</p>
                  <p className="text-xs text-green-600 font-medium">+{test.improvement}% improvement</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-green-500 rounded-lg">
              <ArrowTrendingUpIcon className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Key Insights</h3>
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Product page headlines show 15% improvement in conversions
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Checkout button optimization increased revenue by 8.7%
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Mobile conversion rate improved by 12% this month
            </li>
          </ul>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-500 rounded-lg">
              <UsersIcon className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Recommendations</h3>
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Test product image layouts for better engagement
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Optimize mobile checkout flow for higher conversions
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Consider testing pricing strategies for premium products
            </li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
} 
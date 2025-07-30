import { useOutletContext } from "@remix-run/react";
import { 
  BeakerIcon, 
  PlusIcon, 
  SparklesIcon,
  RocketLaunchIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import { motion } from "framer-motion";

export default function ABTests() {
  const { user } = useOutletContext();

  const mockTests = [
    {
      id: 1,
      name: "Product Page Headline",
      status: "active",
      variants: 2,
      impressions: 1247,
      conversions: 89,
      conversionRate: 7.1,
      improvement: 15.2
    },
    {
      id: 2,
      name: "Checkout Button Color",
      status: "completed",
      variants: 3,
      impressions: 892,
      conversions: 67,
      conversionRate: 7.5,
      improvement: 8.7
    },
    {
      id: 3,
      name: "Product Image Layout",
      status: "draft",
      variants: 2,
      impressions: 0,
      conversions: 0,
      conversionRate: 0,
      improvement: 0
    }
  ];

  const getStatusInfo = (status) => {
    switch (status) {
      case 'active':
        return { 
          color: 'bg-green-500', 
          text: 'Active', 
          icon: CheckCircleIcon,
          bg: 'bg-green-50',
          textColor: 'text-green-700'
        };
      case 'completed':
        return { 
          color: 'bg-blue-500', 
          text: 'Completed', 
          icon: ChartBarIcon,
          bg: 'bg-blue-50',
          textColor: 'text-blue-700'
        };
      case 'draft':
        return { 
          color: 'bg-gray-500', 
          text: 'Draft', 
          icon: ClockIcon,
          bg: 'bg-gray-50',
          textColor: 'text-gray-700'
        };
      default:
        return { 
          color: 'bg-yellow-500', 
          text: 'Paused', 
          icon: ExclamationTriangleIcon,
          bg: 'bg-yellow-50',
          textColor: 'text-yellow-700'
        };
    }
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
          <BeakerIcon className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            A/B Tests
          </h1>
          <SparklesIcon className="h-6 w-6 text-purple-500" />
        </div>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Create and manage A/B tests to optimize your store's performance and increase conversions.
        </p>
      </motion.div>

      {/* Action Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center"
      >
        <button className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-xl shadow-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-105">
          <PlusIcon className="h-5 w-5 mr-2" />
          Create New Test
        </button>
      </motion.div>

      {/* Tests Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {mockTests.map((test, index) => {
          const statusInfo = getStatusInfo(test.status);
          const StatusIcon = statusInfo.icon;
          
          return (
            <motion.div
              key={test.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -2 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{test.name}</h3>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.textColor}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusInfo.text}
                      </span>
                      <span className="text-sm text-gray-500">{test.variants} variants</span>
                    </div>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${statusInfo.color}`}></div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{test.impressions.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">Impressions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{test.conversions}</p>
                    <p className="text-sm text-gray-600">Conversions</p>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Conversion Rate</p>
                      <p className="text-lg font-semibold text-gray-900">{test.conversionRate}%</p>
                    </div>
                    {test.improvement > 0 && (
                      <div className="text-right">
                        <p className="text-sm text-green-600 font-medium">+{test.improvement}%</p>
                        <p className="text-xs text-gray-500">Improvement</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {mockTests.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16"
        >
          <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full flex items-center justify-center mb-6">
            <BeakerIcon className="h-12 w-12 text-blue-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No A/B tests yet</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Get started by creating your first A/B test. Optimize your store and boost conversions with data-driven decisions.
          </p>
          <button className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200">
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Your First Test
          </button>
        </motion.div>
      )}

      {/* Tips Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100"
      >
        <div className="flex items-center space-x-3 mb-4">
          <RocketLaunchIcon className="h-6 w-6 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900">Pro Tips</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-sm text-gray-700">
            <strong>Test one element at a time</strong> to clearly identify what drives improvements.
          </div>
          <div className="text-sm text-gray-700">
            <strong>Run tests for at least 2 weeks</strong> to account for weekly patterns.
          </div>
          <div className="text-sm text-gray-700">
            <strong>Focus on high-traffic pages</strong> to get statistically significant results faster.
          </div>
        </div>
      </motion.div>
    </div>
  );
} 
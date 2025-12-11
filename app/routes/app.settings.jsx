import { useOutletContext } from "@remix-run/react";
import { 
  CogIcon, 
  SparklesIcon,
  BellIcon,
  ShieldCheckIcon,
  UserIcon,
  GlobeAltIcon,
  CreditCardIcon,
  DocumentTextIcon,
  QuestionMarkCircleIcon,
  ArrowRightIcon
} from "@heroicons/react/24/outline";
import { motion } from "framer-motion";

export default function Settings() {
  const { user } = useOutletContext();

  const settingsSections = [
    {
      title: "Account Settings",
      icon: UserIcon,
      color: "blue",
      items: [
        { name: "Profile Information", description: "Update your account details", href: "#" },
        { name: "Email Preferences", description: "Manage notification settings", href: "#" },
        { name: "Password & Security", description: "Change password and security settings", href: "#" }
      ]
    },
    {
      title: "App Configuration",
      icon: CogIcon,
      color: "green",
      items: [
        { name: "General Settings", description: "Configure app behavior and defaults", href: "#" },
        { name: "Integration Settings", description: "Manage third-party integrations", href: "#" },
        { name: "API Configuration", description: "View and manage API keys", href: "#" }
      ]
    },
    {
      title: "Billing & Subscription",
      icon: CreditCardIcon,
      color: "purple",
      items: [
        { name: "Manage Subscription", description: "View and manage your subscription", href: "/app/billing" },
        { name: "Current Plan", description: "View your current plan details", href: "/app/billing" },
        { name: "Billing History", description: "Download invoices and receipts", href: "/app/billing" }
      ]
    },
    {
      title: "Privacy & Security",
      icon: ShieldCheckIcon,
      color: "orange",
      items: [
        { name: "Data Privacy", description: "Manage data collection and usage", href: "#" },
        { name: "Security Settings", description: "Configure security preferences", href: "#" },
        { name: "Access Logs", description: "View account activity and access", href: "#" }
      ]
    }
  ];

  const getColorClasses = (color) => {
    const classes = {
      blue: { bg: 'bg-blue-50', icon: 'bg-blue-500', border: 'border-blue-200' },
      green: { bg: 'bg-green-50', icon: 'bg-green-500', border: 'border-green-200' },
      purple: { bg: 'bg-purple-50', icon: 'bg-purple-500', border: 'border-purple-200' },
      orange: { bg: 'bg-orange-50', icon: 'bg-orange-500', border: 'border-orange-200' }
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
          <CogIcon className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Settings
          </h1>
          <SparklesIcon className="h-6 w-6 text-purple-500" />
        </div>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Manage your app preferences, account settings, and configuration options.
        </p>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-500 rounded-lg">
              <UserIcon className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Account Status</p>
              <p className="text-lg font-semibold text-gray-900">Active</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-500 rounded-lg">
              <GlobeAltIcon className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Shop Domain</p>
              <p className="text-lg font-semibold text-gray-900">{user.shop}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-500 rounded-lg">
              <BellIcon className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Notifications</p>
              <p className="text-lg font-semibold text-gray-900">Enabled</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {settingsSections.map((section, index) => {
          const colorClasses = getColorClasses(section.color);
          const SectionIcon = section.icon;
          
          return (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`${colorClasses.bg} rounded-xl border ${colorClasses.border} p-6`}
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className={`p-3 rounded-lg ${colorClasses.icon}`}>
                  <SectionIcon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
              </div>
              
              <div className="space-y-4">
                {section.items.map((item, itemIndex) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (index * 0.1) + (itemIndex * 0.05) }}
                    className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 cursor-pointer group"
                    onClick={() => {
                      if (item.href && item.href !== "#") {
                        window.location.href = item.href;
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                          {item.name}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                      </div>
                      <ArrowRightIcon className="h-4 w-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all duration-200" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Help & Support */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100"
      >
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-blue-500 rounded-lg">
            <QuestionMarkCircleIcon className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Need Help?</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <DocumentTextIcon className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <h4 className="text-sm font-medium text-gray-900 mb-1">Documentation</h4>
            <p className="text-xs text-gray-600">Comprehensive guides and tutorials</p>
          </div>
          <div className="text-center">
            <BellIcon className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <h4 className="text-sm font-medium text-gray-900 mb-1">Support</h4>
            <p className="text-xs text-gray-600">Get help from our support team</p>
          </div>
          <div className="text-center">
            <GlobeAltIcon className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <h4 className="text-sm font-medium text-gray-900 mb-1">Community</h4>
            <p className="text-xs text-gray-600">Connect with other users</p>
          </div>
        </div>
      </motion.div>

      {/* Version Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <p className="text-sm text-gray-500">
          AB Optimizer v1.0.0 • Built with ❤️ for Shopify merchants
        </p>
      </motion.div>
    </div>
  );
} 
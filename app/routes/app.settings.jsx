import { useOutletContext } from "@remix-run/react";
import { CogIcon } from "@heroicons/react/24/outline";
import Layout from "../components/Layout";

export default function Settings() {
  const { user } = useOutletContext();

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your app preferences and configuration.
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center py-12">
            <CogIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Settings coming soon</h3>
            <p className="mt-1 text-sm text-gray-500">
              App settings and configuration options will be available soon.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
} 
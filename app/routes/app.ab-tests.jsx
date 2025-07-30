import { useOutletContext } from "@remix-run/react";
import { BeakerIcon, PlusIcon } from "@heroicons/react/24/outline";
import Layout from "../components/Layout";

export default function ABTests() {
  const { user } = useOutletContext();

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">A/B Tests</h1>
            <p className="mt-1 text-sm text-gray-600">
              Create and manage A/B tests for your products.
            </p>
          </div>
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <PlusIcon className="h-4 w-4 mr-2" />
            New Test
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center py-12">
            <BeakerIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No A/B tests yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first A/B test.
            </p>
            <div className="mt-6">
              <button className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Test
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
} 
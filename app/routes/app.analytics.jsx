import { useOutletContext } from "@remix-run/react";
import { ChartBarIcon } from "@heroicons/react/24/outline";

export default function Analytics() {
  const { user } = useOutletContext();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-600">
          View detailed performance metrics and insights.
        </p>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-12">
          <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Analytics coming soon</h3>
          <p className="mt-1 text-sm text-gray-500">
            Detailed analytics and reporting features will be available soon.
          </p>
        </div>
      </div>
    </div>
  );
} 
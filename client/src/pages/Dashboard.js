import React from 'react';
import { useQuery } from 'react-query';
import { 
  Store, 
  Activity, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';

const Dashboard = () => {
  const { data: analytics, isLoading, error } = useQuery('dashboard-analytics', async () => {
    const response = await axios.get('/api/analytics/dashboard?days=30');
    return response.data;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading dashboard</h3>
        <p className="mt-1 text-sm text-gray-500">Please try again later.</p>
      </div>
    );
  }

  const { overview, eventsByDay, eventsByTopic, topShops } = analytics;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your Shopify app performance and analytics
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Store className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Active Shops</dt>
                <dd className="text-lg font-medium text-gray-900">{overview.shops.active}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Activity className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Webhook Success Rate</dt>
                <dd className="text-lg font-medium text-gray-900">{overview.webhooks.successRate.toFixed(1)}%</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                <dd className="text-lg font-medium text-gray-900">{overview.users.total}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Shop Retention</dt>
                <dd className="text-lg font-medium text-gray-900">{overview.shops.retentionRate.toFixed(1)}%</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Webhook Events Over Time */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Webhook Events (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={eventsByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="_id" 
                tickFormatter={(value) => format(new Date(value), 'MMM dd')}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                formatter={(value, name) => [value, name === 'total' ? 'Total' : name === 'processed' ? 'Processed' : 'Failed']}
              />
              <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} />
              <Line type="monotone" dataKey="processed" stroke="#10B981" strokeWidth={2} />
              <Line type="monotone" dataKey="failed" stroke="#EF4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Webhook Topics Distribution */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Webhook Topics Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={eventsByTopic}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="total"
              >
                {eventsByTopic.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Performing Shops */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performing Shops</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shop Domain
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Success Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topShops.map((shop, index) => (
                <tr key={shop._id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {shop._id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {shop.eventCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {shop.successRate.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      shop.successRate >= 90 
                        ? 'bg-green-100 text-green-800' 
                        : shop.successRate >= 70 
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {shop.successRate >= 90 ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Excellent
                        </>
                      ) : shop.successRate >= 70 ? (
                        <>
                          <Clock className="h-3 w-3 mr-1" />
                          Good
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Needs Attention
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 
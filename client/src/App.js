import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import axios from 'axios';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Shops from './pages/Shops';
import ShopDetail from './pages/ShopDetail';
import Webhooks from './pages/Webhooks';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Login from './pages/Login';
import LoadingSpinner from './components/LoadingSpinner';

// Check if user is authenticated
const checkAuth = async () => {
  try {
    const response = await axios.get('/api/auth/me');
    return response.data;
  } catch (error) {
    throw new Error('Not authenticated');
  }
};

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { data: user, isLoading, error } = useQuery('auth', checkAuth, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="shops" element={<Shops />} />
          <Route path="shops/:shop" element={<ShopDetail />} />
          <Route path="webhooks" element={<Webhooks />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}

export default App; 
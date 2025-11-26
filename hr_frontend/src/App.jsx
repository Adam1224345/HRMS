import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import ResetPasswordPage from './components/auth/ResetPasswordPage';
import Dashboard from './components/dashboard/Dashboard';
import './App.css';

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <NotificationProvider>
        <Dashboard />
      </NotificationProvider>
    );
  }

  return <AuthFlow />;
}

function AuthFlow() {
  const [currentPage, setCurrentPage] = useState('login');

  const handleNavigate = (page) => {
    setCurrentPage(page);
  };

  switch (currentPage) {
    case 'register':
      return <RegisterPage onNavigate={handleNavigate} />;
    case 'forgot-password':
      return <ForgotPasswordPage onNavigate={handleNavigate} />;
    case 'reset-password':
      return <ResetPasswordPage onNavigate={handleNavigate} />;
    default:
      return <LoginPage onNavigate={handleNavigate} />;
  }
}

function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App;

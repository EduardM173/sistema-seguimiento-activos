import React from 'react';
import { Navigate } from 'react-router-dom';
import { DashboardContent } from '../components/layout';
import { useAuth } from '../hooks';
import { LoadingSpinner } from '../components/common';
import '../styles/dashboard.css';

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner fullscreen message="Cargando panel..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardContent />
  );
}
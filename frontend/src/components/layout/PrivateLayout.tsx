import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../navbar/Navbar';

export const PrivateLayout: React.FC = () => {
  return (
    <div className="dashboardPage">
      <Navbar />
      <main className="main-content"><Outlet /></main>
    </div>
  );
};

export default PrivateLayout;


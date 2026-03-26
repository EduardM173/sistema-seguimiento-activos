import React from 'react';
import Navbar from '../navbar/Navbar';

export const PrivateLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="dashboardPage">
      <Navbar />
      <main className="main-content">{children}</main>
    </div>
  );
};

export default PrivateLayout;


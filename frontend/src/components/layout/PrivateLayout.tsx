import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../navbar/Navbar';
import { IconMenu } from '../common/Icon';

export const PrivateLayout: React.FC = () => {
  // Off-canvas drawer state, only meaningful ≤1024px (see navbar.css) —
  // the sidebar is always visible above that width regardless of this.
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="dashboardPage">
      <Navbar isOpen={navOpen} onClose={() => setNavOpen(false)} />
      <main className="main-content">
        <div className="mobile-topbar">
          <button
            type="button"
            className="mobile-topbar__menu"
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menú"
          >
            <IconMenu size={20} />
          </button>
          <span className="mobile-topbar__brand">ActivoGestión</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default PrivateLayout;

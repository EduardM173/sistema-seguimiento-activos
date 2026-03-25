import { Outlet } from 'react-router-dom';

import Navbar from '../navbar/Navbar';

export default function PrivateLayout() {
  return (
    <div className="appLayout">
      <Navbar />

      <main className="appContent">
        <Outlet />
      </main>
    </div>
  );
}
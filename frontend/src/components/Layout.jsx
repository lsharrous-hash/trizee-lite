import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDate } from '../context/DateContext';
import {
  Package,
  LayoutDashboard,
  Upload,
  Truck,
  Users,
  LogOut,
  Menu,
  X,
  Calendar,
} from 'lucide-react';
import { useState } from 'react';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const { selectedDate, setSelectedDate, formatDate, setToday, setTomorrow, isToday, isTomorrow } = useDate();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ...(isAdmin
      ? [
          { to: '/imports', icon: Upload, label: 'Imports' },
          { to: '/sous-traitants', icon: Users, label: 'Sous-traitants' },
          { to: '/chauffeurs', icon: Truck, label: 'Chauffeurs' },
        ]
      : []),
    { to: '/tournees', icon: Package, label: 'Tournées' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header with date selector */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 lg:ml-64">
        <div className="flex items-center justify-between">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Date selector */}
          <div className="flex items-center gap-3 ml-auto">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div className="flex items-center gap-2">
              <button
                onClick={setToday}
                className={`px-3 py-1 text-sm rounded-lg transition ${
                  isToday()
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Aujourd'hui
              </button>
              <button
                onClick={setTomorrow}
                className={`px-3 py-1 text-sm rounded-lg transition ${
                  isTomorrow()
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Demain
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <span className="text-sm text-gray-500 hidden sm:block">
              {formatDate(selectedDate)}
            </span>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Trizee Lite</h1>
              <p className="text-xs text-gray-500">v1.0.0</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info & Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="font-medium text-gray-600">
                {user?.prenom?.[0] || user?.nom?.[0] || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {user?.prenom} {user?.nom}
              </p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen pt-0">
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
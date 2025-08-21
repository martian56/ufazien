import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSubscription } from '../../hooks/useSubscription.jsx';
import { 
  LayoutDashboard, 
  Globe, 
  Database, 
  BarChart3, 
  Settings, 
  FileText, 
  Shield,
  ArrowLeft,
  Server,
  CreditCard,
  Menu,
  X
} from 'lucide-react';

const HostingSidebar = () => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { getStorageUsage } = useSubscription();

  // Get storage usage data
  const storageData = getStorageUsage();
  const storagePercentage = storageData?.percentage || 0;
  
  // Determine color based on usage percentage
  const getStorageColor = () => {
    if (storagePercentage >= 90) return 'text-red-600';
    if (storagePercentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStorageBarColor = () => {
    if (storagePercentage >= 90) return 'bg-red-500';
    if (storagePercentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handleBackToMain = () => {
    navigate('/dashboard');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const navItems = [
    { 
      to: '/hosting', 
      icon: LayoutDashboard, 
      label: 'Dashboard',
      exact: true
    },
    { 
      to: '/hosting/websites', 
      icon: Globe, 
      label: 'Websites' 
    },
    { 
      to: '/hosting/databases', 
      icon: Database, 
      label: 'Databases' 
    },
    { 
      to: '/hosting/domains', 
      icon: Server, 
      label: 'Domains' 
    },
    { 
      to: '/hosting/analytics', 
      icon: BarChart3, 
      label: 'Analytics' 
    },
    { 
      to: '/hosting/billing', 
      icon: CreditCard, 
      label: 'Billing' 
    },
    { 
      to: '/hosting/ssl', 
      icon: Shield, 
      label: 'SSL Certificates' 
    },
    { 
      to: '/hosting/logs', 
      icon: FileText, 
      label: 'Logs' 
    },
    { 
      to: '/hosting/settings', 
      icon: Settings, 
      label: 'Settings' 
    }
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={toggleMobileMenu}
          className="bg-white p-2 rounded-lg shadow-lg border border-gray-200"
        >
          <Menu className="h-6 w-6 text-gray-600" />
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <div className={`bg-white h-screen w-64 shadow-lg flex flex-col fixed left-0 top-0 z-50 transform transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:z-30`}>
        {/* Header with back button */}
        <div className="p-4 border-b border-gray-200">
          {/* Mobile Close Button */}
          <div className="lg:hidden flex justify-end mb-2">
            <button
              onClick={closeMobileMenu}
              className="p-1 rounded-lg hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          
          <button
            onClick={handleBackToMain}
            className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Main App</span>
          </button>
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 rounded-lg p-2">
              <Server className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Hosting</h1>
              <p className="text-sm text-gray-500">Manage your websites</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-900">Storage Used</p>
                <p className="text-xs text-gray-500">{storageData?.used || '0 MB'} of {storageData?.limit || '1.0 GB'}</p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-medium ${getStorageColor()}`}>{Math.round(storagePercentage)}%</p>
              </div>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
              <div className={`h-1 rounded-full ${getStorageBarColor()}`} style={{ width: `${storagePercentage}%` }}></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HostingSidebar;

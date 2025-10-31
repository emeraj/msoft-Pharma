import React, { useState, useRef, useEffect } from 'react';
import type { AppView, ReportView } from '../types';
import { ReceiptIcon, ArchiveIcon, CubeIcon, SettingsIcon, ChartBarIcon, CashIcon, HomeIcon } from './icons/Icons';
import { User } from 'firebase/auth';

interface HeaderProps {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  onOpenSettings: () => void;
  user: User;
  onLogout: () => void;
}

const NavButton: React.FC<{
  label: string;
  view: AppView;
  activeView: AppView;
  onClick: (view: AppView) => void;
  icon: React.ReactNode;
}> = ({ label, view, activeView, onClick, icon }) => {
  const isActive = activeView === view;
  return (
    <button
      onClick={() => onClick(view)}
      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-indigo-600 text-white shadow-md'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

const ReportsDropdown: React.FC<{
  activeView: AppView;
  setActiveView: (view: AppView) => void;
}> = ({ activeView, setActiveView }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const reportViews: ReportView[] = ['daybook', 'suppliersLedger', 'salesReport', 'companyWiseSale'];
  const isReportsActive = reportViews.includes(activeView as ReportView);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const reportLabels: Record<ReportView, string> = {
    daybook: 'Day book',
    suppliersLedger: 'Suppliers Ledger',
    salesReport: 'Sales Report',
    companyWiseSale: 'Company Wise Sale',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
          isReportsActive
            ? 'bg-indigo-600 text-white shadow-md'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        <ChartBarIcon className="h-5 w-5" />
        <span className="hidden sm:inline">Reports</span>
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5">
          {reportViews.map(view => (
             <a
              key={view}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveView(view);
                setIsOpen(false);
              }}
              className={`block px-4 py-2 text-sm ${
                activeView === view 
                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200' 
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {reportLabels[view]}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};


const Header: React.FC<HeaderProps> = ({ activeView, setActiveView, onOpenSettings, user, onLogout }) => {
  return (
    <header className="bg-white dark:bg-slate-800 shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
              Pharma<span className="text-indigo-600 dark:text-indigo-400"> - Retail</span>
            </h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <span className="hidden md:inline text-sm text-slate-600 dark:text-slate-400">
              Welcome, {user.displayName || user.email}
            </span>
             <nav className="hidden sm:flex space-x-2">
              <NavButton label="Dashboard" view="salesDashboard" activeView={activeView} onClick={setActiveView} icon={<HomeIcon className="h-5 w-5" />} />
              <NavButton label="Billing" view="billing" activeView={activeView} onClick={setActiveView} icon={<ReceiptIcon className="h-5 w-5" />} />
              <NavButton label="Purchases" view="purchases" activeView={activeView} onClick={setActiveView} icon={<CubeIcon className="h-5 w-5" />} />
              <NavButton label="Payments" view="paymentEntry" activeView={activeView} onClick={setActiveView} icon={<CashIcon className="h-5 w-5" />} />
              <NavButton label="Inventory" view="inventory" activeView={activeView} onClick={setActiveView} icon={<ArchiveIcon className="h-5 w-5" />} />
              <ReportsDropdown activeView={activeView} setActiveView={setActiveView} />
            </nav>
             <button
              onClick={onOpenSettings}
              className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Open Settings"
            >
              <SettingsIcon className="h-6 w-6" />
            </button>
            <button
              onClick={onLogout}
              className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
             Logout
            </button>
          </div>
        </div>
         <nav className="sm:hidden flex justify-around p-2 border-t dark:border-slate-700">
            <NavButton label="Dashboard" view="salesDashboard" activeView={activeView} onClick={setActiveView} icon={<HomeIcon className="h-5 w-5" />} />
            <NavButton label="Billing" view="billing" activeView={activeView} onClick={setActiveView} icon={<ReceiptIcon className="h-5 w-5" />} />
            <NavButton label="Purchases" view="purchases" activeView={activeView} onClick={setActiveView} icon={<CubeIcon className="h-5 w-5" />} />
            <NavButton label="Payments" view="paymentEntry" activeView={activeView} onClick={setActiveView} icon={<CashIcon className="h-5 w-5" />} />
            <NavButton label="Inventory" view="inventory" activeView={activeView} onClick={setActiveView} icon={<ArchiveIcon className="h-5 w-5" />} />
            <ReportsDropdown activeView={activeView} setActiveView={setActiveView} />
        </nav>
      </div>
    </header>
  );
};

export default Header;

import React, { useState, useRef, useEffect } from 'react';
import type { AppView, ReportView, SystemConfig, UserPermissions } from '../types';
import { ReceiptIcon, ArchiveIcon, CubeIcon, SettingsIcon, ChartBarIcon, CashIcon, CloudIcon } from './icons/Icons';
import type { User } from 'firebase/auth';
import { getTranslation } from '../utils/translationHelper';

interface HeaderProps {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  onOpenSettings: () => void;
  user: User;
  onLogout: () => void;
  systemConfig: SystemConfig;
  userPermissions?: UserPermissions; // Optional for Admins
  isOperator: boolean;
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
  t: any;
}> = ({ activeView, setActiveView, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const reportViews: ReportView[] = ['dashboard', 'daybook', 'suppliersLedger', 'customerLedger', 'salesReport', 'salesmanReport', 'companyWiseSale', 'companyWiseBillWiseProfit', 'chequePrint'];
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
    dashboard: t.reports.dashboard,
    daybook: t.reports.daybook,
    suppliersLedger: t.reports.suppliersLedger,
    customerLedger: t.reports.customerLedger,
    salesReport: t.reports.salesReport,
    salesmanReport: t.reports.salesmanReport,
    companyWiseSale: t.reports.companyWiseSale,
    companyWiseBillWiseProfit: t.reports.companyWiseBillWiseProfit,
    chequePrint: t.reports.chequePrint,
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
        <span className="hidden sm:inline">{t.nav.reports}</span>
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


const Header: React.FC<HeaderProps> = ({ activeView, setActiveView, onOpenSettings, user, onLogout, systemConfig, userPermissions, isOperator }) => {
  const t = getTranslation(systemConfig.language);

  // Helper to check permission. If admin (not operator), always true.
  const hasPermission = (perm: keyof UserPermissions) => !isOperator || (userPermissions && userPermissions[perm]);

  return (
    <header className="bg-white dark:bg-slate-800 shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm mr-3 border border-slate-100 dark:border-slate-600">
                <CloudIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex flex-col justify-center">
                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200 leading-none">
                    Cloud-TAG
                </h1>
                <p className="hidden md:block text-[10px] text-indigo-600 dark:text-indigo-400 font-serif italic leading-none mt-1">
                    Tag Your Business to the Cloud
                </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <span className="hidden md:inline text-sm text-slate-600 dark:text-slate-400">
              {user.displayName || user.email} {isOperator && '(Operator)'}
            </span>
             <nav className="hidden sm:flex space-x-2">
              {hasPermission('canBill') && <NavButton label={t.nav.billing} view="billing" activeView={activeView} onClick={setActiveView} icon={<ReceiptIcon className="h-5 w-5" />} />}
              {hasPermission('canPurchase') && <NavButton label={t.nav.purchases} view="purchases" activeView={activeView} onClick={setActiveView} icon={<CubeIcon className="h-5 w-5" />} />}
              {hasPermission('canInventory') && <NavButton label={t.nav.inventory} view="inventory" activeView={activeView} onClick={setActiveView} icon={<ArchiveIcon className="h-5 w-5" />} />}
              {hasPermission('canPayment') && <NavButton label={t.nav.payments} view="paymentEntry" activeView={activeView} onClick={setActiveView} icon={<CashIcon className="h-5 w-5" />} />}
              {hasPermission('canReports') && <ReportsDropdown activeView={activeView} setActiveView={setActiveView} t={t} />}
            </nav>
            {!isOperator && (
             <button
              onClick={onOpenSettings}
              className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Open Settings"
              title={t.nav.settings}
            >
              <SettingsIcon className="h-6 w-6" />
            </button>
            )}
            <button
              onClick={onLogout}
              className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
             {t.nav.logout}
            </button>
          </div>
        </div>
         <nav className="sm:hidden flex justify-around p-2 border-t dark:border-slate-700">
            {hasPermission('canBill') && <NavButton label={t.nav.billing} view="billing" activeView={activeView} onClick={setActiveView} icon={<ReceiptIcon className="h-5 w-5" />} />}
            {hasPermission('canPurchase') && <NavButton label={t.nav.purchases} view="purchases" activeView={activeView} onClick={setActiveView} icon={<CubeIcon className="h-5 w-5" />} />}
            {hasPermission('canInventory') && <NavButton label={t.nav.inventory} view="inventory" activeView={activeView} onClick={setActiveView} icon={<ArchiveIcon className="h-5 w-5" />} />}
            {hasPermission('canPayment') && <NavButton label={t.nav.payments} view="paymentEntry" activeView={activeView} onClick={setActiveView} icon={<CashIcon className="h-5 w-5" />} />}
            {hasPermission('canReports') && <ReportsDropdown activeView={activeView} setActiveView={setActiveView} t={t} />}
        </nav>
      </div>
    </header>
  );
};

export default Header;

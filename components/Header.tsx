
import React, { useState, useRef, useEffect } from 'react';
import type { AppView, ReportView, GstReportView, MasterDataView, SystemConfig, UserPermissions } from '../types';
import { ReceiptIcon, ArchiveIcon, CubeIcon, SettingsIcon, ChartBarIcon, CashIcon, PillIcon, PercentIcon, CloudIcon, CheckCircleIcon, AdjustmentsIcon, UserGroupIcon } from './icons/Icons';
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

const MasterDataDropdown: React.FC<{
    activeView: AppView;
    setActiveView: (view: AppView) => void;
}> = ({ activeView, setActiveView }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const masterDataViews: MasterDataView[] = ['ledgerMaster', 'productMaster', 'batchMaster'];
    const isMasterActive = masterDataViews.includes(activeView as MasterDataView);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const labels: Record<MasterDataView, string> = {
        ledgerMaster: 'Ledger Master',
        productMaster: 'Product Master',
        batchMaster: 'Batch Master'
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isMasterActive
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
            >
                <AdjustmentsIcon className="h-5 w-5" />
                <span className="hidden sm:inline">Master Data</span>
            </button>
            {isOpen && (
                <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5">
                    {masterDataViews.map(view => (
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
                            {labels[view]}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

const GstReportsDropdown: React.FC<{
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  t: any;
}> = ({ activeView, setActiveView, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const gstReportViews: GstReportView[] = ['gstr3b', 'hsnSales', 'hsnPurchase', 'gstWiseSales'];
  const isGstActive = gstReportViews.includes(activeView as GstReportView);

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

  const reportLabels: Record<GstReportView, string> = {
    gstr3b: 'GSTR 3B Report',
    hsnSales: 'Hsn wise Sales Report',
    hsnPurchase: 'Hsn Wise Purchase Report',
    gstWiseSales: 'GST Wise Sale Report',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
          isGstActive
            ? 'bg-indigo-600 text-white shadow-md'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        <PercentIcon className="h-5 w-5" />
        <span className="hidden sm:inline">GST Reports</span>
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5">
          {gstReportViews.map(view => (
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

const ReportsDropdown: React.FC<{
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  t: any;
  isSuperAdmin: boolean;
}> = ({ activeView, setActiveView, t, isSuperAdmin }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const reportViews: ReportView[] = ['dashboard', 'daybook', 'suppliersLedger', 'customerLedger', 'salesReport', 'salesmanReport', 'companyWiseSale', 'companyWiseBillWiseProfit', 'chequePrint'];
  if (isSuperAdmin) reportViews.push('subscriptionAdmin');

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
    subscriptionAdmin: 'Subscription Admin',
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
  const isPremium = systemConfig.subscription?.isPremium || false;
  const isSuperAdmin = user.email === 'emeraj@gmail.com';

  const hasPermission = (perm: keyof UserPermissions) => !isOperator || (userPermissions && userPermissions[perm]);

  return (
    <header className="bg-white dark:bg-slate-800 shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
               <CloudIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
               <span className="flex items-center gap-2">
                Cloud-TAG 
                {isPremium && <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm font-extrabold uppercase tracking-tighter">PRO</span>}
               </span>
            </h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
             <nav className="hidden sm:flex space-x-2">
              {hasPermission('canPurchase') && <MasterDataDropdown activeView={activeView} setActiveView={setActiveView} />}
              {hasPermission('canBill') && <NavButton label={t.nav.billing} view="billing" activeView={activeView} onClick={setActiveView} icon={<ReceiptIcon className="h-5 w-5" />} />}
              {hasPermission('canPurchase') && <NavButton label={t.nav.purchases} view="purchases" activeView={activeView} onClick={setActiveView} icon={<CubeIcon className="h-5 w-5" />} />}
              {hasPermission('canInventory') && <NavButton label={t.nav.inventory} view="inventory" activeView={activeView} onClick={setActiveView} icon={<ArchiveIcon className="h-5 w-5" />} />}
              {hasPermission('canPayment') && <GstReportsDropdown activeView={activeView} setActiveView={setActiveView} t={t} />}
              {hasPermission('canReports') && <ReportsDropdown activeView={activeView} setActiveView={setActiveView} t={t} isSuperAdmin={isSuperAdmin} />}
            </nav>

            {isSuperAdmin && (
                <button
                    onClick={() => setActiveView('subscriptionAdmin')}
                    className={`p-2 rounded-full transition-colors ${activeView === 'subscriptionAdmin' ? 'bg-indigo-600 text-white shadow' : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}`}
                    title="Subscription Management"
                >
                    <AdjustmentsIcon className="h-6 w-6" />
                </button>
            )}

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
            {hasPermission('canPurchase') && <MasterDataDropdown activeView={activeView} setActiveView={setActiveView} />}
            {hasPermission('canBill') && <NavButton label={t.nav.billing} view="billing" activeView={activeView} onClick={setActiveView} icon={<ReceiptIcon className="h-5 w-5" />} />}
            {hasPermission('canPurchase') && <NavButton label={t.nav.purchases} view="purchases" activeView={activeView} onClick={setActiveView} icon={<CubeIcon className="h-5 w-5" />} />}
            {hasPermission('canInventory') && <NavButton label={t.nav.inventory} view="inventory" activeView={activeView} onClick={setActiveView} icon={<ArchiveIcon className="h-5 w-5" />} />}
            {hasPermission('canReports') && <ReportsDropdown activeView={activeView} setActiveView={setActiveView} t={t} isSuperAdmin={isSuperAdmin} />}
        </nav>
      </div>
    </header>
  );
};

export default Header;

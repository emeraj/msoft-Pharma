
import React, { useState, useRef, useEffect } from 'react';
import type { AppView, ReportView, GstReportView, MasterDataView, VoucherEntryView, SystemConfig, UserPermissions } from '../types';
import { ReceiptIcon, ArchiveIcon, SettingsIcon, ChartBarIcon, PercentIcon, CloudIcon, AdjustmentsIcon, UserCircleIcon } from './icons/Icons';
import type { User } from 'firebase/auth';
import { getTranslation } from '../utils/translationHelper';

interface HeaderProps {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  onOpenSettings: () => void;
  user: User;
  onLogout: () => void;
  systemConfig: SystemConfig;
  userPermissions?: UserPermissions; 
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
      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-bold transition-all duration-200 uppercase tracking-tighter ${
        isActive
          ? 'bg-indigo-600 text-white shadow-lg scale-105'
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
    userPermissions?: UserPermissions;
    isOperator: boolean;
}> = ({ activeView, setActiveView, userPermissions, isOperator }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const hasP = (key: keyof UserPermissions) => !isOperator || (userPermissions && userPermissions[key]);

    const masterDataViews: {view: MasterDataView, label: string, p: keyof UserPermissions}[] = [
        { view: 'ledgerMaster', label: 'Ledger Master', p: 'canMasterLedger' },
        { view: 'productMaster', label: 'Product Master', p: 'canMasterProduct' },
        { view: 'batchMaster', label: 'Batch Master', p: 'canMasterBatch' }
    ];

    const availableViews = masterDataViews.filter(v => hasP(v.p));
    if (availableViews.length === 0) return null;

    const isMasterActive = availableViews.some(v => v.view === activeView);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-bold transition-all duration-200 uppercase tracking-tighter ${
                    isMasterActive
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
            >
                <AdjustmentsIcon className="h-5 w-5" />
                <span className="hidden sm:inline">Master Data</span>
            </button>
            {isOpen && (
                <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-2xl py-2 z-50 ring-1 ring-black ring-opacity-5 animate-fade-in border dark:border-slate-700">
                    {availableViews.map(item => (
                        <a
                            key={item.view}
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                setActiveView(item.view);
                                setIsOpen(false);
                            }}
                            className={`block px-4 py-2 text-xs font-black uppercase tracking-widest ${
                                activeView === item.view
                                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 border-l-4 border-indigo-600'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            {item.label}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

const VoucherEntryDropdown: React.FC<{
    activeView: AppView;
    setActiveView: (view: AppView) => void;
    userPermissions?: UserPermissions;
    isOperator: boolean;
}> = ({ activeView, setActiveView, userPermissions, isOperator }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const hasP = (key: keyof UserPermissions) => !isOperator || (userPermissions && userPermissions[key]);

    const voucherViews: {view: VoucherEntryView | 'billing' | 'purchases', label: string, p: keyof UserPermissions}[] = [
        { view: 'billing', label: 'Sale Entry', p: 'canVoucherSale' },
        { view: 'purchases', label: 'Purchase Entry', p: 'canVoucherPurchase' },
        { view: 'saleReturn', label: 'Sale Return', p: 'canVoucherSaleReturn' },
        { view: 'purchaseReturn', label: 'Purchase Return', p: 'canVoucherPurchaseReturn' },
        { view: 'journalEntry', label: 'Journal Entry', p: 'canVoucherJournal' },
        { view: 'debitNote', label: 'Debit Note', p: 'canVoucherNotes' },
        { view: 'creditNote', label: 'Credit Note', p: 'canVoucherNotes' },
    ];
    
    const availableViews = voucherViews.filter(v => hasP(v.p));
    if (availableViews.length === 0) return null;

    const isVoucherActive = availableViews.some(v => v.view === activeView);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-bold transition-all duration-200 uppercase tracking-tighter ${
                    isVoucherActive
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
            >
                <ReceiptIcon className="h-5 w-5" />
                <span className="hidden sm:inline">Voucher Entry</span>
            </button>
            {isOpen && (
                <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-2xl py-2 z-50 ring-1 ring-black ring-opacity-5 animate-fade-in border dark:border-slate-700">
                    {availableViews.map(item => (
                        <a
                            key={item.view}
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                setActiveView(item.view as AppView);
                                setIsOpen(false);
                            }}
                            className={`block px-4 py-2 text-xs font-black uppercase tracking-widest ${
                                activeView === item.view
                                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 border-l-4 border-indigo-600'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            {item.label}
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
  userPermissions?: UserPermissions;
  isOperator: boolean;
}> = ({ activeView, setActiveView, userPermissions, isOperator }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isOperator && !userPermissions?.canReportGst) return null;

  const gstReportViews: GstReportView[] = ['gstr3b', 'hsnSales', 'hsnPurchase', 'gstWiseSales'];
  const isGstActive = gstReportViews.includes(activeView as GstReportView);

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
        className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-bold transition-all duration-200 uppercase tracking-tighter ${
          isGstActive
            ? 'bg-indigo-600 text-white shadow-lg'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        <PercentIcon className="h-5 w-5" />
        <span className="hidden sm:inline">GST Reports</span>
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-2xl py-2 z-50 ring-1 ring-black ring-opacity-5 animate-fade-in border dark:border-slate-700">
          {gstReportViews.map(view => (
            <a
              key={view}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveView(view);
                setIsOpen(false);
              }}
              className={`block px-4 py-2 text-xs font-black uppercase tracking-widest ${
                activeView === view
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 border-l-4 border-indigo-600'
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
  userPermissions?: UserPermissions;
  isOperator: boolean;
}> = ({ activeView, setActiveView, t, isSuperAdmin, userPermissions, isOperator }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasP = (key: keyof UserPermissions) => !isOperator || (userPermissions && userPermissions[key]);

  const reportViews: {view: ReportView, label: string, p?: keyof UserPermissions}[] = [
    { view: 'dashboard', label: t.reports.dashboard, p: 'canReportDashboard' },
    { view: 'daybook', label: t.reports.daybook, p: 'canReportDaybook' },
    { view: 'suppliersLedger', label: t.reports.suppliersLedger, p: 'canReportSupplierLedger' },
    { view: 'customerLedger', label: t.reports.customerLedger, p: 'canReportCustomerLedger' },
    { view: 'salesReport', label: t.reports.salesReport, p: 'canReportSales' },
    { view: 'salesmanReport', label: t.reports.salesmanReport, p: 'canReportSalesman' },
    { view: 'companyWiseSale', label: t.reports.companyWiseSale, p: 'canReportCompanySales' },
    { view: 'companyWiseBillWiseProfit', label: t.reports.companyWiseBillWiseProfit, p: 'canReportProfit' },
    { view: 'chequePrint', label: t.reports.chequePrint, p: 'canReportCheque' },
  ];

  const availableReports = reportViews.filter(rv => !rv.p || hasP(rv.p));
  if (isSuperAdmin) availableReports.push({ view: 'subscriptionAdmin', label: 'Subscription Admin' });

  if (availableReports.length === 0) return null;

  const isReportsActive = availableReports.some(rv => rv.view === activeView);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-bold transition-all duration-200 uppercase tracking-tighter ${
          isReportsActive
            ? 'bg-indigo-600 text-white shadow-lg'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        <ChartBarIcon className="h-5 w-5" />
        <span className="hidden sm:inline">{t.nav.reports}</span>
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-2xl py-2 z-50 ring-1 ring-black ring-opacity-5 animate-fade-in border dark:border-slate-700">
          {availableReports.map(rv => (
             <a
              key={rv.view}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveView(rv.view);
                setIsOpen(false);
              }}
              className={`block px-4 py-2 text-xs font-black uppercase tracking-widest ${
                activeView === rv.view 
                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 border-l-4 border-indigo-600' 
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {rv.label}
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
    <header className="bg-white dark:bg-slate-800 shadow-xl border-b dark:border-slate-700 sticky top-0 z-40 backdrop-blur-sm bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          <div className="flex items-center py-2">
            <h1 className="text-xl font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer group" onClick={() => setActiveView('dashboard')}>
               <div className="p-1.5 bg-indigo-600 rounded-lg shadow-indigo-500/50 shadow-lg group-hover:scale-110 transition-transform">
                <CloudIcon className="h-7 w-7 text-white" />
               </div>
               <div className="flex flex-col leading-none">
                <span className="tracking-tighter text-lg">Cloud-TAG</span>
                {isPremium && <span className="text-[8px] bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter w-fit mt-0.5">PRO EDITION</span>}
               </div>
            </h1>
            
            <div className="ml-6 hidden lg:flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                <UserCircleIcon className={`h-4 w-4 ${isOperator ? 'text-emerald-500' : 'text-indigo-500'}`} />
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase text-slate-400">Current Session</span>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest truncate max-w-[100px]">
                        {isOperator ? `${user.displayName || 'Staff'}` : 'Admin'}
                    </span>
                </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
             <nav className="hidden sm:flex space-x-1">
              <MasterDataDropdown activeView={activeView} setActiveView={setActiveView} userPermissions={userPermissions} isOperator={isOperator} />
              <VoucherEntryDropdown activeView={activeView} setActiveView={setActiveView} userPermissions={userPermissions} isOperator={isOperator} />
              {hasPermission('canInventory') && <NavButton label={t.nav.inventory} view="inventory" activeView={activeView} onClick={setActiveView} icon={<ArchiveIcon className="h-5 w-5" />} />}
              <GstReportsDropdown activeView={activeView} setActiveView={setActiveView} userPermissions={userPermissions} isOperator={isOperator} />
              <ReportsDropdown activeView={activeView} setActiveView={setActiveView} t={t} isSuperAdmin={isSuperAdmin} userPermissions={userPermissions} isOperator={isOperator} />
            </nav>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block mx-2"></div>

            <div className="flex items-center gap-2">
                {isSuperAdmin && (
                    <button
                        onClick={() => setActiveView('subscriptionAdmin')}
                        className={`p-2.5 rounded-xl transition-all ${activeView === 'subscriptionAdmin' ? 'bg-amber-100 text-amber-700 shadow-inner' : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30'}`}
                        title="Global Admin Control"
                    >
                        <AdjustmentsIcon className="h-5 w-5" />
                    </button>
                )}

                {!isOperator && (
                <button
                    onClick={onOpenSettings}
                    className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                    aria-label="Open Settings"
                    title={t.nav.settings}
                >
                    <SettingsIcon className="h-5 w-5" />
                </button>
                )}
                <button
                onClick={onLogout}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all border border-transparent hover:border-rose-100 dark:hover:border-rose-900/50"
                >
                {t.nav.logout}
                </button>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .h-18 { height: 4.5rem; }
        @keyframes fade-in { 0% { opacity: 0; transform: translateY(-5px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
      `}</style>
    </header>
  );
};

export default Header;

import React from 'react';
import type { AppView } from '../types';
import { PillIcon, ReceiptIcon, ArchiveIcon, BookOpenIcon, CubeIcon } from './icons/Icons';

interface HeaderProps {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
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
          : 'text-slate-700 hover:bg-slate-200'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

const Header: React.FC<HeaderProps> = ({ activeView, setActiveView }) => {
  return (
    <header className="bg-white shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <PillIcon className="h-8 w-8 text-indigo-600" />
            <h1 className="ml-3 text-2xl font-bold text-slate-800">
              PharmaTrack <span className="text-indigo-600">Pro</span>
            </h1>
          </div>
          <nav className="flex space-x-2 sm:space-x-4">
             <NavButton
              label="Billing"
              view="billing"
              activeView={activeView}
              onClick={setActiveView}
              icon={<ReceiptIcon className="h-5 w-5" />}
            />
            <NavButton
              label="Purchases"
              view="purchases"
              activeView={activeView}
              onClick={setActiveView}
              icon={<CubeIcon className="h-5 w-5" />}
            />
            <NavButton
              label="Inventory"
              view="inventory"
              activeView={activeView}
              onClick={setActiveView}
              icon={<ArchiveIcon className="h-5 w-5" />}
            />
            <NavButton
              label="Day Book"
              view="daybook"
              activeView={activeView}
              onClick={setActiveView}
              icon={<BookOpenIcon className="h-5 w-5" />}
            />
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
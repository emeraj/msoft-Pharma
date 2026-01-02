import React, { useState } from 'react';
import type { Customer, Supplier, Salesman, SystemConfig } from '../types';
import Card from './common/Card';
import { UserGroupIcon, UserCircleIcon, IdentificationIcon, PlusIcon, SearchIcon } from './icons/Icons';
import SupplierMaster from './SupplierMaster';
import CustomerLedger from './CustomerLedger';

interface LedgerMasterProps {
    customers: Customer[];
    suppliers: Supplier[];
    salesmen: Salesman[];
    systemConfig: SystemConfig;
    onAddCustomer: (c: any) => Promise<any>;
    onUpdateCustomer: (id: string, d: any) => Promise<void>;
    onAddSupplier: (s: any) => Promise<any>;
    onUpdateSupplier: (id: string, d: any) => void;
    onDeleteSupplier: (id: string) => void;
    onAddSalesman: (s: any) => Promise<any>;
}

type LedgerTab = 'customers' | 'suppliers' | 'salesmen';

const LedgerMaster: React.FC<LedgerMasterProps> = ({ 
    customers, suppliers, salesmen, systemConfig, 
    onAddCustomer, onUpdateCustomer, onAddSupplier, onUpdateSupplier, onDeleteSupplier, onAddSalesman 
}) => {
    const [activeTab, setActiveTab] = useState<LedgerTab>('customers');

    const TabButton: React.FC<{ id: LedgerTab, label: string, icon: React.ReactNode }> = ({ id, label, icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-black uppercase tracking-widest transition-all border-b-2 ${
                activeTab === id
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20'
                    : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'
            }`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border dark:border-slate-700 overflow-hidden">
                <div className="flex border-b dark:border-slate-700 overflow-x-auto no-scrollbar">
                    <TabButton id="customers" label="Customer Master" icon={<UserGroupIcon className="h-5 w-5" />} />
                    <TabButton id="suppliers" label="Supplier Master" icon={<UserCircleIcon className="h-5 w-5" />} />
                    <TabButton id="salesmen" label="Salesman Master" icon={<IdentificationIcon className="h-5 w-5" />} />
                </div>
            </div>

            <div className="animate-fade-in">
                {activeTab === 'customers' && (
                    <CustomerLedger 
                        customers={customers} 
                        bills={[]} 
                        payments={[]} 
                        companyProfile={null as any} 
                        onAddPayment={async () => {}} 
                        onUpdateCustomer={onUpdateCustomer}
                        onEditBill={() => {}}
                        onDeleteBill={() => {}}
                        onUpdatePayment={async () => {}}
                        onDeletePayment={async () => {}}
                    />
                )}
                {activeTab === 'suppliers' && (
                    <SupplierMaster 
                        suppliers={suppliers} 
                        onAdd={onAddSupplier} 
                        onUpdate={onUpdateSupplier} 
                        onDelete={onDeleteSupplier} 
                    />
                )}
                {activeTab === 'salesmen' && (
                    <SalesmanMasterView salesmen={salesmen} onAdd={onAddSalesman} />
                )}
            </div>
        </div>
    );
};

const SalesmanMasterView: React.FC<{ salesmen: Salesman[], onAdd: (s: any) => Promise<any> }> = ({ salesmen, onAdd }) => {
    const [search, setSearch] = useState('');
    const filtered = salesmen.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

    const handleAddNew = async () => {
        const name = prompt("Enter Salesman Name:");
        if (name) await onAdd({ name });
    };

    return (
        <Card title={
            <div className="flex justify-between items-center w-full">
                <span>Salesman Registry</span>
                <button onClick={handleAddNew} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tighter flex items-center gap-2">
                    <PlusIcon className="h-4 w-4" /> Add Salesman
                </button>
            </div>
        }>
            <div className="mb-4 relative">
                <input 
                    type="text" 
                    placeholder="Search salesman..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    className="w-full p-2 bg-yellow-100 border rounded-lg pl-10" 
                />
                <SearchIcon className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            </div>
            <div className="overflow-x-auto rounded-lg border dark:border-slate-700">
                <table className="w-full text-sm text-left">
                    <thead className="bg-[#1e293b] text-slate-300 uppercase text-[10px] font-black">
                        <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">Salesman Name</th>
                            <th className="px-6 py-4 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                        {filtered.map(s => (
                            <tr key={s.id} className="bg-white dark:bg-slate-800">
                                <td className="px-6 py-4 font-mono text-xs text-slate-500">{s.id.slice(-6).toUpperCase()}</td>
                                <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 uppercase">{s.name}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded-full uppercase">Active</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

export default LedgerMaster;
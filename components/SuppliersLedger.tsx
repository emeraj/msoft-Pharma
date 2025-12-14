
import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import type { Supplier, Purchase, Payment, CompanyProfile } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { DownloadIcon, PrinterIcon, PencilIcon, PlusIcon, TrashIcon } from './icons/Icons';
import PrintableSupplierLedger from './PrintableSupplierLedger';

// --- Utility function to export data to CSV ---
const exportToCsv = (filename: string, data: any[]) => {
  if (data.length === 0) {
    alert("No data to export.");
    return;
  }
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        if (/[",\n]/.test(cell)) {
          cell = `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    )
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};


interface SuppliersLedgerProps {
  suppliers: Supplier[];
  purchases: Purchase[];
  payments: Payment[];
  companyProfile: CompanyProfile;
  initialSupplierId?: string | null;
  onSupplierSelected?: (supplierId: string | null) => void;
  onUpdateSupplier: (id: string, data: Omit<Supplier, 'id'>) => void;
  onAddPayment?: (payment: Omit<Payment, 'id' | 'voucherNumber'>) => Promise<Payment | null>;
  onDeletePurchase: (purchase: Purchase) => void;
  onEditPurchase: (purchase: Purchase) => void;
  onUpdatePayment: (id: string, data: Omit<Payment, 'id'>) => Promise<void>;
  onDeletePayment: (id: string) => Promise<void>;
}

interface SupplierLedgerEntry extends Supplier {
    openingBalanceForPeriod: number;
    purchasesInPeriod: number;
    paymentsInPeriod: number;
    outstandingBalance: number;
}

interface EditSupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplier: Supplier;
    onUpdate: (id: string, data: Omit<Supplier, 'id'>) => void;
}

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
const formSelectStyle = `${formInputStyle} appearance-none`;

const EditSupplierModal: React.FC<EditSupplierModalProps> = ({ isOpen, onClose, supplier, onUpdate }) => {
    const [formState, setFormState] = useState({
        address: '', phone: '', gstin: '', openingBalance: ''
    });

    useEffect(() => {
        if (supplier) {
            setFormState({
                address: supplier.address || '',
                phone: supplier.phone || '',
                gstin: supplier.gstin || '',
                openingBalance: String(supplier.openingBalance || 0)
            });
        }
    }, [supplier]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormState({ ...formState, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplier.id) {
            alert("Cannot update supplier: missing ID.");
            return;
        }
        onUpdate(supplier.id, {
            name: supplier.name, // name is not editable
            address: formState.address,
            phone: formState.phone,
            gstin: formState.gstin,
            openingBalance: parseFloat(formState.openingBalance) || 0
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit Supplier: ${supplier.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supplier Name</label>
                    <input value={supplier.name} className={`${formInputStyle} bg-slate-200 dark:bg-slate-700 cursor-not-allowed`} readOnly />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                    <input name="address" value={formState.address} onChange={handleChange} className={formInputStyle} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                        <input name="phone" value={formState.phone} onChange={handleChange} className={formInputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">GSTIN</label>
                        <input name="gstin" value={formState.gstin} onChange={handleChange} className={formInputStyle} />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Opening Balance (-ve for Credit, +ve for Debit)</label>
                    <input name="openingBalance" value={formState.openingBalance} onChange={handleChange} type="number" step="0.01" className={formInputStyle} required />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700 mt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Update Supplier</button>
                </div>
            </form>
        </Modal>
    );
};

const AddPaymentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    supplierName: string;
    onAddPayment: (payment: Omit<Payment, 'id' | 'voucherNumber'>) => Promise<Payment | null>;
}> = ({ isOpen, onClose, supplierName, onAddPayment }) => {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [method, setMethod] = useState<'Cash' | 'Bank Transfer' | 'Cheque' | 'Other'>('Bank Transfer');
    const [remarks, setRemarks] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            alert('Please enter a valid amount');
            return;
        }
        await onAddPayment({
            supplierName,
            date: new Date(date).toISOString(),
            amount: numAmount,
            method,
            remarks
        });
        setAmount('');
        setRemarks('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Make Payment">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supplier</label>
                    <input value={supplierName} className={`${formInputStyle} bg-slate-200 dark:bg-slate-700`} readOnly />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className={formInputStyle} required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amount</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className={formInputStyle} required min="0.01" step="0.01" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                    <select value={method} onChange={e => setMethod(e.target.value as any)} className={formSelectStyle}>
                        <option>Bank Transfer</option>
                        <option>Cash</option>
                        <option>Cheque</option>
                        <option>Other</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Remarks</label>
                    <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} className={formInputStyle} />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg dark:text-slate-200">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Save Payment</button>
                </div>
            </form>
        </Modal>
    );
};

const EditPaymentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    payment: Payment;
    onUpdate: (id: string, data: Omit<Payment, 'id'>) => Promise<void>;
}> = ({ isOpen, onClose, payment, onUpdate }) => {
    const [amount, setAmount] = useState(String(payment.amount));
    const [method, setMethod] = useState<'Cash' | 'Bank Transfer' | 'Cheque' | 'Other'>(payment.method);
    const [remarks, setRemarks] = useState(payment.remarks || '');
    const [date, setDate] = useState(new Date(payment.date).toISOString().split('T')[0]);

    useEffect(() => {
        setAmount(String(payment.amount));
        setMethod(payment.method);
        setRemarks(payment.remarks || '');
        setDate(new Date(payment.date).toISOString().split('T')[0]);
    }, [payment]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            alert("Please enter a valid amount");
            return;
        }
        await onUpdate(payment.id, {
            supplierName: payment.supplierName,
            date: new Date(date).toISOString(),
            amount: numAmount,
            method,
            remarks,
            voucherNumber: payment.voucherNumber
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit Payment: ${payment.voucherNumber}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className={formInputStyle} required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amount</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className={formInputStyle} required min="0.01" step="0.01" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                    <select value={method} onChange={e => setMethod(e.target.value as any)} className={formSelectStyle}>
                        <option>Bank Transfer</option>
                        <option>Cash</option>
                        <option>Cheque</option>
                        <option>Other</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Remarks</label>
                    <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} className={formInputStyle} />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Update</button>
                </div>
            </form>
        </Modal>
    );
};

interface Transaction {
    id: string;
    date: Date;
    particulars: string;
    debit: number;
    credit: number;
    type: 'purchase' | 'payment';
    data: Purchase | Payment;
}

const SuppliersLedger: React.FC<SuppliersLedgerProps> = ({ suppliers, purchases, payments, companyProfile, initialSupplierId, onSupplierSelected, onUpdateSupplier, onAddPayment, onDeletePurchase, onEditPurchase, onUpdatePayment, onDeletePayment }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedSupplier, setSelectedSupplier] = useState<SupplierLedgerEntry | null>(null);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    
    // Edit Payment State
    const [paymentToEdit, setPaymentToEdit] = useState<Payment | null>(null);

    const supplierLedgerData = useMemo<SupplierLedgerEntry[]>(() => {
        const startDate = fromDate ? new Date(fromDate) : null;
        if (startDate) startDate.setHours(0, 0, 0, 0);

        const endDate = toDate ? new Date(toDate) : new Date();
        endDate.setHours(23, 59, 59, 999);
        
        return suppliers.map(supplier => {
            const supplierPurchases = purchases.filter(p => p.supplier === supplier.name);
            const supplierPayments = payments.filter(p => p.supplierName === supplier.name);

            // Invert user-facing balance: -1000 (Credit) becomes +1000 internally.
            // Internal representation: +ve means Credit (liability), -ve means Debit (asset).
            let openingBalanceForPeriod = (supplier.openingBalance || 0) * -1;

            const prePeriodPurchases = supplierPurchases.filter(p => startDate && new Date(p.invoiceDate) < startDate);
            const prePeriodPayments = supplierPayments.filter(p => startDate && new Date(p.date) < startDate);

            prePeriodPurchases.forEach(p => {
                openingBalanceForPeriod += p.totalAmount; // Purchase increases liability
            });
            prePeriodPayments.forEach(p => {
                openingBalanceForPeriod -= p.amount; // Payment decreases liability
            });


            // Calculate transactions within the period
            const purchasesInPeriod = supplierPurchases.reduce((sum, p) => {
                const purchaseDate = new Date(p.invoiceDate);
                const isAfterStart = startDate ? purchaseDate >= startDate : true;
                if (isAfterStart && purchaseDate <= endDate) {
                    return sum + p.totalAmount;
                }
                return sum;
            }, 0);

            const paymentsInPeriod = supplierPayments.reduce((sum, p) => {
                const paymentDate = new Date(p.date);
                const isAfterStart = startDate ? paymentDate >= startDate : true;
                if (isAfterStart && paymentDate <= endDate) {
                    return sum + p.amount;
                }
                return sum;
            }, 0);

            const outstandingBalance = openingBalanceForPeriod + purchasesInPeriod - paymentsInPeriod;

            return {
                ...supplier,
                openingBalanceForPeriod,
                purchasesInPeriod,
                paymentsInPeriod,
                outstandingBalance,
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [suppliers, purchases, payments, fromDate, toDate]);
    
    // Sync Selected Supplier with Prop ID and Latest Data (critical for refresh after edit/delete)
    useEffect(() => {
        if (initialSupplierId) {
            const found = supplierLedgerData.find(s => s.id === initialSupplierId);
            setSelectedSupplier(found || null);
        }
    }, [initialSupplierId, supplierLedgerData]);

    const filteredLedger = useMemo(() => {
        if (!searchTerm) return supplierLedgerData;
        return supplierLedgerData.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [supplierLedgerData, searchTerm]);

    const handleSelectSupplier = (supplier: SupplierLedgerEntry | null) => {
        setSelectedSupplier(supplier);
        if (onSupplierSelected) {
            onSupplierSelected(supplier ? supplier.id : null);
        }
    };

    const handleOpenEditModal = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setEditingSupplier(null);
        setEditModalOpen(false);
    };

    const handleExport = () => {
        const exportData = filteredLedger.map(s => ({
            'Supplier Name': s.name,
            'Opening Balance': `${Math.abs(s.openingBalanceForPeriod).toFixed(2)} ${s.openingBalanceForPeriod >= 0 ? 'Cr' : 'Dr'}`,
            'Total Purchases (Period)': s.purchasesInPeriod.toFixed(2),
            'Total Payments (Period)': s.paymentsInPeriod.toFixed(2),
            'Outstanding Balance': `${Math.abs(s.outstandingBalance).toFixed(2)} ${s.outstandingBalance >= 0 ? 'Cr' : 'Dr'}`,
            'Phone': s.phone,
            'GSTIN': s.gstin,
        }));
        exportToCsv('suppliers_ledger', exportData);
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card title="Suppliers Ledger">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <input
                        type="text"
                        placeholder="Search by supplier name..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 md:col-span-2"
                    />
                     <div className="flex items-center gap-2">
                        <label htmlFor="fromDate" className="text-sm font-medium text-slate-700 dark:text-slate-300">From</label>
                        <input type="date" id="fromDate" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full px-3 py-2 bg-yellow-100 text-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                     </div>
                     <div className="flex items-center gap-2">
                        <label htmlFor="toDate" className="text-sm font-medium text-slate-700 dark:text-slate-300">To</label>
                        <input type="date" id="toDate" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full px-3 py-2 bg-yellow-100 text-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                     </div>
                </div>
                <div className="flex justify-end mb-4">
                    <button onClick={handleExport} className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors duration-200">
                        <DownloadIcon className="h-5 w-5" />
                        <span className="hidden sm:inline">Export to Excel</span>
                    </button>
                </div>


                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                        <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th scope="col" className="px-6 py-3">Supplier</th>
                                <th scope="col" className="px-6 py-3 text-right">Opening Balance</th>
                                <th scope="col" className="px-6 py-3 text-right">Purchases (Period)</th>
                                <th scope="col" className="px-6 py-3 text-right">Payments (Period)</th>
                                <th scope="col" className="px-6 py-3 text-right">Outstanding Balance</th>
                                <th scope="col" className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLedger.map(supplier => (
                                <tr key={supplier.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">{supplier.name}</td>
                                    <td className="px-6 py-4 text-right">₹{Math.abs(supplier.openingBalanceForPeriod).toFixed(2)} {supplier.openingBalanceForPeriod >= 0 ? 'Cr' : 'Dr'}</td>
                                    <td className="px-6 py-4 text-right">₹{supplier.purchasesInPeriod.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right">₹{supplier.paymentsInPeriod.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-bold">₹{Math.abs(supplier.outstandingBalance).toFixed(2)} {supplier.outstandingBalance >= 0 ? 'Cr' : 'Dr'}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <button onClick={() => handleSelectSupplier(supplier)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                                                View Details
                                            </button>
                                            <button onClick={() => handleOpenEditModal(supplier)} title="Edit Supplier" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                                                <PencilIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredLedger.length === 0 && (
                        <div className="text-center py-10 text-slate-600 dark:text-slate-400">
                            <p>No suppliers found for the selected criteria.</p>
                        </div>
                    )}
                </div>
            </Card>

            {selectedSupplier && (
                <SupplierDetailsModal
                    isOpen={!!selectedSupplier}
                    onClose={() => handleSelectSupplier(null)}
                    supplier={selectedSupplier}
                    purchases={purchases}
                    payments={payments}
                    companyProfile={companyProfile}
                    dateRange={{ from: fromDate, to: toDate }}
                    onAddPayment={onAddPayment}
                    onDeletePurchase={onDeletePurchase}
                    onEditPurchase={onEditPurchase}
                    onDeletePayment={onDeletePayment}
                    onEditPayment={(payment) => setPaymentToEdit(payment)}
                />
            )}
            
            {editingSupplier && (
                <EditSupplierModal
                    isOpen={isEditModalOpen}
                    onClose={handleCloseEditModal}
                    supplier={editingSupplier}
                    onUpdate={onUpdateSupplier}
                />
            )}

            {paymentToEdit && (
                <EditPaymentModal 
                    isOpen={!!paymentToEdit}
                    onClose={() => setPaymentToEdit(null)}
                    payment={paymentToEdit}
                    onUpdate={onUpdatePayment}
                />
            )}
        </div>
    );
};

interface SupplierDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplier: SupplierLedgerEntry;
    purchases: Purchase[];
    payments: Payment[];
    companyProfile: CompanyProfile;
    dateRange: { from: string; to: string };
    onAddPayment?: (payment: Omit<Payment, 'id' | 'voucherNumber'>) => Promise<Payment | null>;
    onDeletePurchase: (purchase: Purchase) => void;
    onEditPurchase: (purchase: Purchase) => void;
    onDeletePayment: (id: string) => Promise<void>;
    onEditPayment: (payment: Payment) => void;
}

const SupplierDetailsModal: React.FC<SupplierDetailsModalProps> = ({ isOpen, onClose, supplier, purchases, payments, companyProfile, dateRange, onAddPayment, onDeletePurchase, onEditPurchase, onDeletePayment, onEditPayment }) => {
    const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedTxIndex, setSelectedTxIndex] = useState<number | null>(null);
    const [showActionMenu, setShowActionMenu] = useState<{ x: number, y: number, tx: Transaction } | null>(null);
    const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
    
    // Format helpers
    const formatCurrency = (val: number) => `₹${Math.abs(val).toFixed(2)}`;
    const formatDrCr = (val: number) => val >= 0 ? 'Cr' : 'Dr';

    const transactions = useMemo(() => {
        const startDate = dateRange.from ? new Date(dateRange.from) : null;
        if (startDate) startDate.setHours(0, 0, 0, 0);

        const endDate = dateRange.to ? new Date(dateRange.to) : new Date();
        endDate.setHours(23, 59, 59, 999);

        const periodPurchases = purchases
            .filter(p => p.supplier === supplier.name)
            .filter(p => {
                const purchaseDate = new Date(p.invoiceDate);
                const isAfterStart = startDate ? purchaseDate >= startDate : true;
                return isAfterStart && purchaseDate <= endDate;
            })
            .map(p => ({ id: p.id, type: 'purchase' as const, date: new Date(p.invoiceDate), data: p, particulars: `Purchase - Inv #${p.invoiceNumber}`, debit: 0, credit: p.totalAmount }));

        const periodPayments = payments
            .filter(p => p.supplierName === supplier.name)
            .filter(p => {
                const paymentDate = new Date(p.date);
                const isAfterStart = startDate ? paymentDate >= startDate : true;
                return isAfterStart && paymentDate <= endDate;
            })
            .map(p => ({ id: p.id, type: 'payment' as const, date: new Date(p.date), data: p, particulars: `Payment - ${p.method} (V: ${p.voucherNumber})`, debit: p.amount, credit: 0 }));

        return [...periodPurchases, ...periodPayments].sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [purchases, payments, supplier.name, dateRange]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (showActionMenu) return; 

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedTxIndex(prev => {
                    const next = (prev === null ? -1 : prev) + 1;
                    if (next < transactions.length) return next;
                    return prev;
                });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedTxIndex(prev => {
                    const next = (prev === null ? transactions.length : prev) - 1;
                    if (next >= 0) return next;
                    return prev;
                });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedTxIndex !== null && transactions[selectedTxIndex]) {
                    const tx = transactions[selectedTxIndex];
                    const row = rowRefs.current[selectedTxIndex];
                    if (row) {
                        const rect = row.getBoundingClientRect();
                        setShowActionMenu({ x: rect.left + rect.width / 2, y: rect.bottom, tx });
                    }
                }
            } else if (e.key === 'Escape') {
                if (showActionMenu) setShowActionMenu(null);
                else onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, transactions, showActionMenu, selectedTxIndex, onClose]);

    useEffect(() => {
        if (selectedTxIndex !== null && rowRefs.current[selectedTxIndex]) {
            rowRefs.current[selectedTxIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selectedTxIndex]);

    const handleRowClick = (index: number) => {
        setSelectedTxIndex(index);
    };

    const handleRowDoubleClick = (index: number, tx: Transaction, e: React.MouseEvent) => {
        setSelectedTxIndex(index);
        const rect = (e.currentTarget as HTMLTableRowElement).getBoundingClientRect();
        setShowActionMenu({ x: e.clientX, y: rect.bottom, tx });
    };

    const handleAction = (action: 'edit' | 'delete') => {
        if (!showActionMenu) return;
        const { tx } = showActionMenu;
        
        if (action === 'edit') {
            if (tx.type === 'purchase') {
                onEditPurchase(tx.data as Purchase);
            } else {
                onEditPayment(tx.data as Payment);
            }
        } else if (action === 'delete') {
            if (tx.type === 'purchase') {
                onDeletePurchase(tx.data as Purchase);
            } else {
                onDeletePayment((tx.data as Payment).id);
            }
        }
        setShowActionMenu(null);
    };

    const handleExportPdf = () => {
        const printWindow = window.open('', '_blank', 'height=800,width=800');
        if (printWindow) {
            printWindow.document.title = ' ';
            const style = printWindow.document.createElement('style');
            style.innerHTML = `
                @page { 
                    size: A4;
                    margin: 0; 
                }
                body {
                    margin: 0;
                }
            `;
            printWindow.document.head.appendChild(style);
            
            const printRoot = document.createElement('div');
            printWindow.document.body.appendChild(printRoot);
            
            const root = ReactDOM.createRoot(printRoot);
            root.render(
                <PrintableSupplierLedger
                    supplier={supplier}
                    transactions={transactions.map(tx => ({ date: tx.date, particulars: tx.particulars, debit: tx.debit, credit: tx.credit }))}
                    companyProfile={companyProfile}
                    openingBalance={supplier.openingBalanceForPeriod}
                    dateRange={dateRange}
                />
            );
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
                printWindow.close();
            }, 1000);
        }
    };

    let runningBalance = supplier.openingBalanceForPeriod;
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Ledger for ${supplier.name}`} maxWidth="max-w-5xl">
            <div className="space-y-6 relative" onClick={() => setShowActionMenu(null)}>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-700">
                    <div className="flex flex-col border-r border-slate-700 pr-4">
                        <span className="text-slate-400 text-sm mb-1">Opening Balance</span>
                        <span className="text-xl font-bold">{formatCurrency(supplier.openingBalanceForPeriod)} <span className="text-sm font-normal text-slate-400">{formatDrCr(supplier.openingBalanceForPeriod)}</span></span>
                    </div>
                    <div className="flex flex-col border-r border-slate-700 px-4">
                        <span className="text-red-400 text-sm mb-1">Purchases (Credit)</span>
                        <span className="text-xl font-bold">₹{supplier.purchasesInPeriod.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col border-r border-slate-700 px-4">
                        <span className="text-green-400 text-sm mb-1">Payments (Debit)</span>
                        <span className="text-xl font-bold">₹{supplier.paymentsInPeriod.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col pl-4">
                        <span className="text-slate-400 text-sm mb-1">Outstanding Balance</span>
                        <span className="text-2xl font-bold">{formatCurrency(supplier.outstandingBalance)} <span className="text-sm font-normal text-slate-400">{formatDrCr(supplier.outstandingBalance)}</span></span>
                    </div>
                </div>

                {/* Actions Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-700/30 p-3 rounded-lg border dark:border-slate-700">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Period:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {dateRange.from ? new Date(dateRange.from).toLocaleDateString() : 'Start'} - {dateRange.to ? new Date(dateRange.to).toLocaleDateString() : 'Now'}
                        </span>
                    </div>
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={handleExportPdf}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-800 dark:text-white rounded-lg text-sm transition-colors"
                        >
                            <PrinterIcon className="h-4 w-4" /> Print
                        </button>
                        {onAddPayment && (
                            <button 
                                onClick={() => setPaymentModalOpen(true)}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm text-sm"
                            >
                                <PlusIcon className="h-4 w-4" /> Payments
                            </button>
                        )}
                    </div>
                </div>

                {/* Transaction Table */}
                <div className="overflow-hidden border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm relative">
                    <div className="bg-slate-800 text-slate-200 px-4 py-3 font-semibold border-b border-slate-700 flex justify-between items-center">
                        <span>Transaction History</span>
                    </div>
                    <div className="overflow-x-auto max-h-[500px]" tabIndex={0} style={{outline: 'none'}}>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold sticky top-0 z-10 border-b dark:border-slate-700 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Particulars</th>
                                    <th className="px-4 py-3 text-right text-green-600 dark:text-green-400">Debit (₹)</th>
                                    <th className="px-4 py-3 text-right text-red-600 dark:text-red-400">Credit (₹)</th>
                                    <th className="px-4 py-3 text-right">Balance (₹)</th>
                                    <th className="px-4 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                                    <td className="px-4 py-3 text-slate-500 italic">Opening</td>
                                    <td className="px-4 py-3 text-slate-500 italic">Opening Balance</td>
                                    <td className="px-4 py-3 text-right">-</td>
                                    <td className="px-4 py-3 text-right">-</td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                                        {formatCurrency(supplier.openingBalanceForPeriod)} {formatDrCr(supplier.openingBalanceForPeriod)}
                                    </td>
                                    <td></td>
                                </tr>
                                {transactions.map((tx, idx) => {
                                    runningBalance = runningBalance + tx.credit - tx.debit;
                                    const isSelected = selectedTxIndex === idx;
                                    
                                    return (
                                        <tr 
                                            key={tx.id} 
                                            ref={el => {rowRefs.current[idx] = el}}
                                            onClick={() => handleRowClick(idx)}
                                            onDoubleClick={(e) => handleRowDoubleClick(idx, tx, e)}
                                            className={`transition-colors cursor-pointer select-none ${
                                                isSelected 
                                                ? 'bg-blue-50 dark:bg-blue-900/40 border-l-4 border-blue-500' 
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-4 border-transparent'
                                            }`}
                                        >
                                            <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">{tx.date.toLocaleDateString()}</td>
                                            <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{tx.particulars}</td>
                                            <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">{tx.debit > 0 ? tx.debit.toFixed(2) : '-'}</td>
                                            <td className="px-4 py-3 text-right font-medium text-red-600 dark:text-red-400">{tx.credit > 0 ? tx.credit.toFixed(2) : '-'}</td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                                                {Math.abs(runningBalance).toFixed(2)} {formatDrCr(runningBalance)}
                                            </td>
                                            <td className="px-2">
                                                <div className="opacity-0 group-hover:opacity-100 text-slate-400">...</div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {transactions.length === 0 && (
                                    <tr><td colSpan={6} className="text-center py-8 text-slate-500">No transactions found in this period.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Context Menu */}
                    {showActionMenu && (
                        <div 
                        className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50 min-w-[150px] animate-fade-in"
                        style={{ 
                            left: Math.min(showActionMenu.x, window.innerWidth - 160), 
                            top: Math.min(showActionMenu.y, window.innerHeight - 100) 
                        }}
                        >
                            <button 
                            onClick={() => handleAction('edit')}
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200"
                            >
                                <PencilIcon className="h-4 w-4" /> Edit
                            </button>
                            <button 
                            onClick={() => handleAction('delete')}
                            className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2 text-red-600"
                            >
                                <TrashIcon className="h-4 w-4" /> Delete
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 font-medium text-slate-800 dark:text-slate-200 transition-colors">Close</button>
                </div>
            </div>

            {isPaymentModalOpen && onAddPayment && (
                <AddPaymentModal 
                    isOpen={isPaymentModalOpen}
                    onClose={() => setPaymentModalOpen(false)}
                    supplierName={supplier.name}
                    onAddPayment={onAddPayment}
                />
            )}
        </Modal>
    );
};

export default SuppliersLedger;

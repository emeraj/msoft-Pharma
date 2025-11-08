import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import type { Supplier, Purchase, Payment, CompanyProfile } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { DownloadIcon, PrinterIcon, PencilIcon } from './icons/Icons';
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
  onUpdateSupplier: (id: string, data: Omit<Supplier, 'id'>) => void;
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

    const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
    
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
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Opening Balance</label>
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

const SuppliersLedger: React.FC<SuppliersLedgerProps> = ({ suppliers, purchases, payments, companyProfile, onUpdateSupplier }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedSupplier, setSelectedSupplier] = useState<SupplierLedgerEntry | null>(null);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    const supplierLedgerData = useMemo<SupplierLedgerEntry[]>(() => {
        const startDate = fromDate ? new Date(fromDate) : null;
        if (startDate) startDate.setHours(0, 0, 0, 0);

        const endDate = toDate ? new Date(toDate) : new Date();
        endDate.setHours(23, 59, 59, 999);
        
        return suppliers.map(supplier => {
            const supplierPurchases = purchases.filter(p => p.supplier === supplier.name);
            const supplierPayments = payments.filter(p => p.supplierName === supplier.name);

            // Calculate Opening Balance for the period
            let openingBalanceForPeriod = supplier.openingBalance || 0;
            const prePeriodPurchases = supplierPurchases.filter(p => startDate && new Date(p.invoiceDate) < startDate);
            const prePeriodPayments = supplierPayments.filter(p => startDate && new Date(p.date) < startDate);

            prePeriodPurchases.forEach(p => {
                openingBalanceForPeriod += p.totalAmount;
            });
            prePeriodPayments.forEach(p => {
                openingBalanceForPeriod -= p.amount;
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
    
    const filteredLedger = useMemo(() => {
        if (!searchTerm) return supplierLedgerData;
        return supplierLedgerData.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [supplierLedgerData, searchTerm]);

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
            'Opening Balance': s.openingBalanceForPeriod.toFixed(2),
            'Total Purchases (Period)': s.purchasesInPeriod.toFixed(2),
            'Total Payments (Period)': s.paymentsInPeriod.toFixed(2),
            'Outstanding Balance': s.outstandingBalance.toFixed(2),
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
                                    <td className="px-6 py-4 text-right">₹{supplier.openingBalanceForPeriod.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right">₹{supplier.purchasesInPeriod.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right">₹{supplier.paymentsInPeriod.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-bold">₹{supplier.outstandingBalance.toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <button onClick={() => setSelectedSupplier(supplier)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
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
                    onClose={() => setSelectedSupplier(null)}
                    supplier={selectedSupplier}
                    purchases={purchases}
                    payments={payments}
                    companyProfile={companyProfile}
                    dateRange={{ from: fromDate, to: toDate }}
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
}

const SupplierDetailsModal: React.FC<SupplierDetailsModalProps> = ({ isOpen, onClose, supplier, purchases, payments, companyProfile, dateRange }) => {
    
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
            .map(p => ({ type: 'purchase' as const, date: new Date(p.invoiceDate), data: p }));

        const periodPayments = payments
            .filter(p => p.supplierName === supplier.name)
            .filter(p => {
                const paymentDate = new Date(p.date);
                const isAfterStart = startDate ? paymentDate >= startDate : true;
                return isAfterStart && paymentDate <= endDate;
            })
            .map(p => ({ type: 'payment' as const, date: new Date(p.date), data: p }));

        return [...periodPurchases, ...periodPayments].sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [purchases, payments, supplier.name, dateRange]);

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
                    transactions={transactions.map(tx => tx.type === 'purchase' ? 
                        { date: tx.date, particulars: `Purchase - Inv #${tx.data.invoiceNumber}`, debit: tx.data.totalAmount, credit: 0 } :
                        { date: tx.date, particulars: `Payment - ${tx.data.method} (V: ${tx.data.voucherNumber})`, debit: 0, credit: tx.data.amount }
                    )}
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
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Ledger for ${supplier.name}`}>
            <div className="space-y-4 text-slate-800 dark:text-slate-300">
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Opening Balance:</div>
                    <div className="text-right">₹{supplier.openingBalanceForPeriod.toFixed(2)}</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Purchases (Period):</div>
                    <div className="text-right">₹{supplier.purchasesInPeriod.toFixed(2)}</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Payments (Period):</div>
                    <div className="text-right text-green-600 dark:text-green-400">₹{supplier.paymentsInPeriod.toFixed(2)}</div>
                    <div className="font-bold text-lg text-slate-800 dark:text-slate-100 col-span-2 border-t dark:border-slate-600 mt-2 pt-2 flex justify-between">
                        <span>Outstanding Balance:</span>
                        <span>₹{supplier.outstandingBalance.toFixed(2)}</span>
                    </div>
                </div>

                <div className="border-t dark:border-slate-700 pt-2">
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Transaction History (Period)</h4>
                    <div className="max-h-60 overflow-y-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-700">
                                <tr>
                                    <th className="py-2 px-2">Date</th>
                                    <th className="py-2 px-2">Particulars</th>
                                    <th className="py-2 px-2 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx, idx) => (
                                    <tr key={idx} className="border-b dark:border-slate-600">
                                        <td className="py-2 px-2">{tx.date.toLocaleDateString()}</td>
                                        {tx.type === 'purchase' ? (
                                            <>
                                                <td className="py-2 px-2">Purchase - Inv #{tx.data.invoiceNumber}</td>
                                                <td className="py-2 px-2 text-right font-medium text-red-600 dark:text-red-400">₹{tx.data.totalAmount.toFixed(2)}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="py-2 px-2">Payment - {tx.data.method} (V: {tx.data.voucherNumber})</td>
                                                <td className="py-2 px-2 text-right font-medium text-green-600 dark:text-green-400">₹{tx.data.amount.toFixed(2)}</td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {transactions.length === 0 && <p className="text-center text-slate-500 dark:text-slate-400 py-4">No transactions found for this supplier in the selected period.</p>}
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t dark:border-slate-700 mt-4 gap-3">
                    <button onClick={handleExportPdf} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow hover:bg-indigo-700 transition-colors">
                       <PrinterIcon className="h-5 w-5" /> Export to PDF
                    </button>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Close</button>
                </div>
            </div>
        </Modal>
    );
}

export default SuppliersLedger;
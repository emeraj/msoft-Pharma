import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import type { Supplier, Purchase, Payment, CompanyProfile } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { DownloadIcon, PrinterIcon } from './icons/Icons';
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
}

interface SupplierLedgerEntry extends Supplier {
    totalPurchases: number;
    totalPayments: number;
    outstandingBalance: number;
}

const SuppliersLedger: React.FC<SuppliersLedgerProps> = ({ suppliers, purchases, payments, companyProfile }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState<SupplierLedgerEntry | null>(null);

    const supplierLedgerData = useMemo<SupplierLedgerEntry[]>(() => {
        const purchaseTotals = new Map<string, number>();
        purchases.forEach(purchase => {
            const currentTotal = purchaseTotals.get(purchase.supplier) || 0;
            purchaseTotals.set(purchase.supplier, currentTotal + purchase.totalAmount);
        });

        const paymentTotals = new Map<string, number>();
        payments.forEach(payment => {
            const currentTotal = paymentTotals.get(payment.supplierName) || 0;
            paymentTotals.set(payment.supplierName, currentTotal + payment.amount);
        });

        return suppliers.map(supplier => {
            const totalPurchases = purchaseTotals.get(supplier.name) || 0;
            const totalPayments = paymentTotals.get(supplier.name) || 0;
            const outstandingBalance = (supplier.openingBalance || 0) + totalPurchases - totalPayments;
            return {
                ...supplier,
                totalPurchases,
                totalPayments,
                outstandingBalance,
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [suppliers, purchases, payments]);
    
    const filteredLedger = useMemo(() => {
        if (!searchTerm) return supplierLedgerData;
        return supplierLedgerData.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [supplierLedgerData, searchTerm]);

    const handleExport = () => {
        const exportData = filteredLedger.map(s => ({
            'Supplier Name': s.name,
            'Opening Balance': s.openingBalance.toFixed(2),
            'Total Purchases': s.totalPurchases.toFixed(2),
            'Total Payments': s.totalPayments.toFixed(2),
            'Outstanding Balance': s.outstandingBalance.toFixed(2),
            'Phone': s.phone,
            'GSTIN': s.gstin,
        }));
        exportToCsv('suppliers_ledger', exportData);
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card title="Suppliers Ledger">
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <input
                        type="text"
                        placeholder="Search by supplier name..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 flex-grow"
                    />
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
                                <th scope="col" className="px-6 py-3 text-right">Total Purchases</th>
                                <th scope="col" className="px-6 py-3 text-right">Total Payments</th>
                                <th scope="col" className="px-6 py-3 text-right">Outstanding Balance</th>
                                <th scope="col" className="px-6 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLedger.map(supplier => (
                                <tr key={supplier.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">{supplier.name}</td>
                                    <td className="px-6 py-4 text-right">₹{supplier.openingBalance.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right">₹{supplier.totalPurchases.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right">₹{supplier.totalPayments.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-bold">₹{supplier.outstandingBalance.toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => setSelectedSupplier(supplier)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredLedger.length === 0 && (
                        <div className="text-center py-10 text-slate-600 dark:text-slate-400">
                            <p>No suppliers found.</p>
                        </div>
                    )}
                </div>
            </Card>

            {selectedSupplier && (
                <SupplierDetailsModal
                    isOpen={!!selectedSupplier}
                    onClose={() => setSelectedSupplier(null)}
                    supplier={selectedSupplier}
                    purchases={purchases.filter(p => p.supplier === selectedSupplier.name)}
                    payments={payments.filter(p => p.supplierName === selectedSupplier.name)}
                    companyProfile={companyProfile}
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
}

const SupplierDetailsModal: React.FC<SupplierDetailsModalProps> = ({ isOpen, onClose, supplier, purchases, payments, companyProfile }) => {
    
    const transactions = useMemo(() => {
        const combined = [
            ...purchases.map(p => ({ type: 'purchase' as const, date: new Date(p.invoiceDate), data: p })),
            ...payments.map(p => ({ type: 'payment' as const, date: new Date(p.date), data: p }))
        ];
        return combined.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [purchases, payments]);

    const handleExportPdf = () => {
        const printWindow = window.open('', '_blank', 'height=800,width=800');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Print Supplier Ledger</title></head><body><div id="print-root"></div></body></html>');
            printWindow.document.close();
            const printRoot = printWindow.document.getElementById('print-root');
            if (printRoot) {
                const root = ReactDOM.createRoot(printRoot);
                root.render(
                    <PrintableSupplierLedger
                        supplier={supplier}
                        purchases={purchases}
                        payments={payments}
                        companyProfile={companyProfile}
                    />
                );
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                    printWindow.close();
                }, 1000);
            }
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Ledger for ${supplier.name}`}>
            <div className="space-y-4 text-slate-800 dark:text-slate-300">
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Opening Balance:</div>
                    <div className="text-right">₹{supplier.openingBalance.toFixed(2)}</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Total Purchases:</div>
                    <div className="text-right">₹{supplier.totalPurchases.toFixed(2)}</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Total Payments:</div>
                    <div className="text-right text-green-600 dark:text-green-400">₹{supplier.totalPayments.toFixed(2)}</div>
                    <div className="font-bold text-lg text-slate-800 dark:text-slate-100 col-span-2 border-t dark:border-slate-600 mt-2 pt-2 flex justify-between">
                        <span>Outstanding Balance:</span>
                        <span>₹{supplier.outstandingBalance.toFixed(2)}</span>
                    </div>
                </div>

                <div className="border-t dark:border-slate-700 pt-2">
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Transaction History</h4>
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
                        {transactions.length === 0 && <p className="text-center text-slate-500 dark:text-slate-400 py-4">No transactions found for this supplier.</p>}
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
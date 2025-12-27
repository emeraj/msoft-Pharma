
import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import type { Bill, CompanyProfile, SystemConfig, PrinterProfile, Product } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { DownloadIcon, PencilIcon, TrashIcon, PrinterIcon, CashIcon, ReceiptIcon, InformationCircleIcon } from './icons/Icons';
import PrintableA5Bill from './PrintableA5Bill';
import PrintableA5LandscapeBill from './PrintableA5LandscapeBill';
import ThermalPrintableBill from './ThermalPrintableBill';
import PrintableBill from './PrintableBill';
import PrinterSelectionModal from './PrinterSelectionModal';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

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

interface DayBookProps {
  bills: Bill[];
  products: Product[];
  companyProfile: CompanyProfile;
  systemConfig: SystemConfig;
  onDeleteBill: (bill: Bill) => void;
  onEditBill: (bill: Bill) => void;
  onUpdateBillDetails: (billId: string, updates: Partial<Pick<Bill, 'customerName' | 'doctorName'>>) => void;
}

const DayBook: React.FC<DayBookProps> = ({ bills, products = [], companyProfile, systemConfig, onDeleteBill, onEditBill, onUpdateBillDetails }) => {
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPrinterModalOpen, setPrinterModalOpen] = useState(false);
  const [billToPrint, setBillToPrint] = useState<Bill | null>(null);

  const billsForSelectedDate = useMemo(() => {
    return bills.filter(bill => bill.date.startsWith(selectedDate)).sort((a, b) => a.billNumber.localeCompare(b.billNumber));
  }, [bills, selectedDate]);

  const summary = useMemo(() => {
    let cashTotal = 0;
    let creditTotal = 0;
    let totalTax = 0;
    let totalProfit = 0;

    billsForSelectedDate.forEach(b => {
        const amount = b.grandTotal;
        if ((b.paymentMode || 'Cash') === 'Cash') cashTotal += amount;
        else creditTotal += amount;
        totalTax += b.totalGst;

        // Simple Profit Estimation based on Purchase Prices in items
        b.items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            const batch = product?.batches.find(bt => bt.id === item.batchId);
            if (batch) {
                const unitsPerStrip = product?.unitsPerStrip || 1;
                const costPerUnit = batch.purchasePrice / unitsPerStrip;
                const itemCogs = costPerUnit * item.quantity;
                const itemRevenueExclTax = item.total / (1 + item.gst / 100);
                totalProfit += (itemRevenueExclTax - itemCogs);
            }
        });
    });

    return {
        total: cashTotal + creditTotal,
        cash: cashTotal,
        credit: creditTotal,
        tax: totalTax,
        profit: totalProfit,
        count: billsForSelectedDate.length
    };
  }, [billsForSelectedDate, products]);

  const handleExport = () => {
    const exportData: any[] = billsForSelectedDate.map(bill => ({
        'Bill No.': bill.billNumber,
        'Time': new Date(bill.date).toLocaleTimeString(),
        'Customer': bill.customerName,
        'Type': bill.paymentMode || 'Cash',
        'Amount': bill.grandTotal.toFixed(2),
        'Tax': bill.totalGst.toFixed(2),
    }));
    exportData.push({ 'Bill No.': 'TOTAL', 'Time': '', 'Customer': '', 'Type': '', 'Amount': summary.total.toFixed(2), 'Tax': summary.tax.toFixed(2) });
    exportToCsv(`day_book_${selectedDate}`, exportData);
  };
  
  const formattedDate = useMemo(() => new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), [selectedDate]);

  const handlePrintClick = (bill: Bill) => {
    setBillToPrint(bill);
    setPrinterModalOpen(true);
  };
  
  const handleUpdateConfig = (newConfig: SystemConfig) => {
     if (auth.currentUser) {
         const configRef = doc(db, `users/${auth.currentUser.uid}/systemConfig`, 'config');
         updateDoc(configRef, newConfig as any);
     }
  };

  const handlePrinterSelection = (printer: PrinterProfile) => {
      if (billToPrint) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            const printRoot = document.createElement('div');
            printWindow.document.body.appendChild(printRoot);
            const root = ReactDOM.createRoot(printRoot);
            
            if (printer.format === 'Thermal') {
                root.render(<ThermalPrintableBill bill={billToPrint} companyProfile={companyProfile} systemConfig={systemConfig} />);
            } else if (printer.format === 'A5') {
                if (printer.orientation === 'Landscape') {
                    root.render(<PrintableA5LandscapeBill bill={billToPrint} companyProfile={companyProfile} systemConfig={systemConfig} />);
                } else {
                    root.render(<PrintableA5Bill bill={billToPrint} companyProfile={companyProfile} systemConfig={systemConfig} />);
                }
            } else {
                root.render(<PrintableBill bill={billToPrint} companyProfile={companyProfile} systemConfig={systemConfig} />);
            }
            
            setTimeout(() => { printWindow.print(); printWindow.close(); setBillToPrint(null); }, 500);
        }
      }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <ReceiptIcon className="h-8 w-8 text-indigo-600" />
                    Professional Day Book
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">{formattedDate}</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-yellow-100 dark:bg-slate-700 text-slate-900 dark:text-white border-2 border-indigo-100 dark:border-slate-600 rounded-xl focus:ring-4 focus:ring-indigo-500/20 transition-all outline-none"
                />
                <button onClick={handleExport} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all transform active:scale-95 font-bold">
                    <DownloadIcon className="h-5 w-5" /> Export Excel
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard title="Total Revenue" value={`₹${summary.total.toFixed(2)}`} icon={<ReceiptIcon className="h-6 w-6 text-indigo-600" />} bgColor="bg-indigo-50 dark:bg-indigo-900/30" isHighlight />
            <SummaryCard title="GST Collected" value={`₹${summary.tax.toFixed(2)}`} icon={<div className="font-black text-xl text-orange-600">%</div>} bgColor="bg-orange-50 dark:bg-orange-900/30" />
            <SummaryCard title="Est. Gross Profit" value={`₹${summary.profit.toFixed(2)}`} icon={<CashIcon className="h-6 w-6 text-emerald-600" />} bgColor="bg-emerald-50 dark:bg-emerald-900/30" />
            <SummaryCard title="Bills Count" value={summary.count} icon={<div className="font-black text-xl text-slate-600 dark:text-slate-300">#</div>} bgColor="bg-slate-100 dark:bg-slate-700" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <Card title="Detailed Invoice Registry">
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-[#1e293b] text-slate-300 uppercase text-[11px] font-black tracking-wider border-b dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4">Bill #</th>
                                    <th className="px-6 py-4">Time</th>
                                    <th className="px-6 py-4">Customer/Patient</th>
                                    <th className="px-6 py-4 text-center">Mode</th>
                                    <th className="px-6 py-4 text-right">Tax</th>
                                    <th className="px-6 py-4 text-right">Amount</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {billsForSelectedDate.map(bill => (
                                    <tr key={bill.id} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">{bill.billNumber}</td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{new Date(bill.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{bill.customerName}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase ${
                                                (bill.paymentMode || 'Cash') === 'Cash' 
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' 
                                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                            }`}>
                                                {bill.paymentMode || 'Cash'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-slate-500 italic">₹{bill.totalGst.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">₹{bill.grandTotal.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => setSelectedBill(bill)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors">
                                                    <ReceiptIcon className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => handlePrintClick(bill)} className="p-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                                    <PrinterIcon className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => onEditBill(bill)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                                                    <PencilIcon className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => onDeleteBill(bill)} className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors">
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {billsForSelectedDate.length === 0 && (
                            <div className="text-center py-20 bg-white dark:bg-slate-800">
                                <div className="bg-slate-100 dark:bg-slate-700 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                                    <ReceiptIcon className="h-8 w-8" />
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 font-bold text-lg">No sales recorded today.</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
            
            <div className="lg:col-span-1 space-y-6">
                <Card title="Mode Breakdown">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Cash In</p>
                                <p className="text-xl font-black text-slate-800 dark:text-slate-100">₹{summary.cash.toFixed(2)}</p>
                            </div>
                            <CashIcon className="h-8 w-8 text-emerald-500 opacity-50" />
                        </div>
                        <div className="flex justify-between items-center p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-100 dark:border-rose-800">
                            <div>
                                <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Credit Sale</p>
                                <p className="text-xl font-black text-slate-800 dark:text-slate-100">₹{summary.credit.toFixed(2)}</p>
                            </div>
                            <InformationCircleIcon className="h-8 w-8 text-rose-500 opacity-50" />
                        </div>
                    </div>
                </Card>
                
                <Card title="Quick Audit Memo">
                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-3">
                        <div className="flex justify-between border-b dark:border-slate-700 pb-2">
                            <span>Total Bills:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{summary.count}</span>
                        </div>
                        <div className="flex justify-between border-b dark:border-slate-700 pb-2">
                            <span>Tax (GST):</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">₹{summary.tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b dark:border-slate-700 pb-2">
                            <span>Net Value:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">₹{(summary.total - summary.tax).toFixed(2)}</span>
                        </div>
                        <p className="mt-4 italic text-[10px] opacity-70">Note: Profit estimation is based on the purchase price recorded in the active batches at the time of calculation.</p>
                    </div>
                </Card>
            </div>
        </div>
        
        {selectedBill && (
            <BillDetailsModal
                isOpen={!!selectedBill}
                onClose={() => setSelectedBill(null)}
                bill={selectedBill}
                onUpdateBillDetails={onUpdateBillDetails}
                systemConfig={systemConfig}
            />
        )}
        
        <PrinterSelectionModal 
            isOpen={isPrinterModalOpen}
            onClose={() => { setPrinterModalOpen(false); setBillToPrint(null); }}
            systemConfig={systemConfig}
            onUpdateConfig={handleUpdateConfig}
            onSelectPrinter={handlePrinterSelection}
        />
    </div>
  );
};

const SummaryCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; bgColor: string; isHighlight?: boolean }> = ({ title, value, icon, bgColor, isHighlight }) => (
    <div className={`${bgColor} p-5 rounded-2xl border border-white/10 dark:border-slate-700 shadow-sm transition-transform hover:scale-[1.02]`}>
        <div className="flex justify-between items-start mb-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isHighlight ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}>{title}</span>
            <div className="p-2 bg-white/50 dark:bg-black/20 rounded-xl shadow-sm">
                {icon}
            </div>
        </div>
        <p className={`text-2xl font-black ${isHighlight ? 'text-indigo-600 dark:text-indigo-100' : 'text-slate-800 dark:text-slate-100'}`}>{value}</p>
    </div>
);

const BillDetailsModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    bill: Bill;
    systemConfig: SystemConfig;
    onUpdateBillDetails: (billId: string, updates: Partial<Pick<Bill, 'customerName' | 'doctorName'>>) => void;
}> = ({ isOpen, onClose, bill, systemConfig, onUpdateBillDetails }) => {
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const getExpiryDate = (expiryString: string): Date => {
        if (!expiryString) return new Date('9999-12-31');
        const [year, month] = expiryString.split('-').map(Number);
        return new Date(year, month, 0);
    };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Invoice: ${bill.billNumber}`} maxWidth="max-w-3xl">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="space-y-1">
                        <EditableField label="Customer" value={bill.customerName} onSave={(val) => onUpdateBillDetails(bill.id, { customerName: val })} />
                        {isPharmaMode && <EditableField label="Doctor" value={bill.doctorName || ''} onSave={(val) => onUpdateBillDetails(bill.id, { doctorName: val })} />}
                    </div>
                    <div className="text-right mt-4 sm:mt-0 text-sm text-slate-500 dark:text-slate-400">
                        <p>Date: {new Date(bill.date).toLocaleString('en-IN')}</p>
                        <p className="font-black text-indigo-600 dark:text-indigo-400 tracking-tighter mt-1">{bill.paymentMode || 'Cash'} Transaction</p>
                    </div>
                </div>

                <div className="overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[#1e293b] text-slate-300 font-bold text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3">Item Description</th>
                                <th className="px-4 py-3 text-center">Qty</th>
                                <th className="px-4 py-3 text-right">Price</th>
                                <th className="px-4 py-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {bill.items.map(item => {
                                const expiry = getExpiryDate(item.expiryDate);
                                const isExpired = isPharmaMode && expiry < today;
                                return (
                                    <tr key={item.batchId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-800 dark:text-slate-100">{item.productName}</div>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex gap-2 mt-0.5 uppercase">
                                                <span>B: {item.batchNumber}</span>
                                                <span className={isExpired ? 'text-rose-600 font-bold' : ''}>E: {item.expiryDate}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-slate-800 dark:text-slate-200">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">₹{item.mrp.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white">₹{item.total.toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end">
                    <div className="w-full sm:w-64 space-y-2 border-t-2 border-indigo-600 dark:border-indigo-400 pt-4">
                        <div className="flex justify-between text-slate-500 dark:text-slate-400 text-sm">
                            <span>Subtotal</span>
                            <span>₹{bill.subTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 dark:text-slate-400 text-sm">
                            <span>GST Total</span>
                            <span>₹{bill.totalGst.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-black text-slate-900 dark:text-white pt-2 border-t dark:border-slate-700">
                            <span>Total</span>
                            <span>₹{bill.grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white font-bold rounded-xl hover:bg-slate-200 transition-colors">Close</button>
                </div>
            </div>
        </Modal>
    );
};

const EditableField: React.FC<{ label: string; value: string; onSave: (newValue: string) => void }> = ({ label, value, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { if (isEditing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [isEditing]);
  
  const handleSave = () => {
    setIsEditing(false);
    if (currentValue.trim() !== value) onSave(currentValue.trim());
  };

  return (
    <div className="flex items-center gap-2 group">
      <span className="text-[10px] font-black text-slate-400 uppercase w-20">{label}:</span>
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); }}
          className="px-2 py-0.5 bg-yellow-100 text-slate-900 border border-indigo-400 rounded-md focus:ring-2 focus:ring-indigo-500 text-sm"
        />
      ) : (
        <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">{value || 'N/A'}</span>
            <button onClick={() => setIsEditing(true)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-all">
                <PencilIcon className="h-3.5 w-3.5" />
            </button>
        </div>
      )}
    </div>
  );
};

export default DayBook;

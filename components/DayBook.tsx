import React, { useState, useMemo } from 'react';
import type { Bill } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { DownloadIcon, PencilIcon, TrashIcon } from './icons/Icons';

// --- Utility function to export data to CSV ---
const exportToCsv = (filename: string, data: any[]) => {
  if (data.length === 0) {
    alert("No data to export.");
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','), // header row
    ...data.map(row => 
      headers.map(header => {
        let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        // handle commas, quotes, and newlines in data
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
  onDeleteBill: (bill: Bill) => void;
  onEditBill: (bill: Bill) => void;
}

const DayBook: React.FC<DayBookProps> = ({ bills, onDeleteBill, onEditBill }) => {
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const billsForSelectedDate = useMemo(() => {
    return bills.filter(bill => bill.date.startsWith(selectedDate)).sort((a, b) => a.billNumber.localeCompare(b.billNumber));
  }, [bills, selectedDate]);

  const totalSales = useMemo(() => {
    return billsForSelectedDate.reduce((total, bill) => total + bill.grandTotal, 0);
  }, [billsForSelectedDate]);

  const handleExport = () => {
    const exportData = billsForSelectedDate.map(bill => ({
        'Bill No.': bill.billNumber,
        'Time': new Date(bill.date).toLocaleTimeString(),
        'Customer': bill.customerName,
        'Items': bill.items.length,
        'Amount': bill.grandTotal.toFixed(2),
    }));
    exportToCsv(`day_book_${selectedDate}`, exportData);
  };
  
  const formattedDate = useMemo(() => {
    // Adding T00:00:00 to avoid timezone issues where it might show the previous day.
    return new Date(selectedDate + 'T00:00:00').toLocaleDateString();
  }, [selectedDate]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
        <Card>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                 <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Day Book - {formattedDate}
                    </h1>
                    <p className="text-sm text-slate-600">View, edit, or delete sales for a specific day.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={e => setSelectedDate(e.target.value)}
                        className="w-full sm:w-auto px-4 py-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button onClick={handleExport} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors duration-200">
                        <DownloadIcon className="h-5 w-5" /> Export to Excel
                    </button>
                </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                <div className="bg-indigo-50 p-4 rounded-lg">
                    <p className="text-sm text-indigo-800 font-semibold">Total Bills on Date</p>
                    <p className="text-3xl font-bold text-indigo-900">{billsForSelectedDate.length}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-800 font-semibold">Total Sales on Date</p>
                    <p className="text-3xl font-bold text-green-900">₹{totalSales.toFixed(2)}</p>
                </div>
            </div>
        </Card>

      <Card title={`Bills for ${formattedDate}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-800">
            <thead className="text-xs text-slate-800 uppercase bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3">Bill No.</th>
                <th scope="col" className="px-6 py-3">Time</th>
                <th scope="col" className="px-6 py-3">Customer</th>
                <th scope="col" className="px-6 py-3">Items</th>
                <th scope="col" className="px-6 py-3">Amount</th>
                <th scope="col" className="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {billsForSelectedDate.map(bill => (
                <tr key={bill.id} className="bg-white border-b hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{bill.billNumber}</td>
                  <td className="px-6 py-4">{new Date(bill.date).toLocaleTimeString()}</td>
                  <td className="px-6 py-4">{bill.customerName}</td>
                  <td className="px-6 py-4 text-center">{bill.items.length}</td>
                  <td className="px-6 py-4 font-semibold">₹{bill.grandTotal.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-4">
                        <button onClick={() => setSelectedBill(bill)} className="font-medium text-indigo-600 hover:underline">
                          View
                        </button>
                        <button onClick={() => onEditBill(bill)} title="Edit Bill" className="text-blue-600 hover:text-blue-800">
                            <PencilIcon className="h-5 w-5" />
                        </button>
                        <button onClick={() => onDeleteBill(bill)} title="Delete Bill" className="text-red-600 hover:text-red-800">
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {billsForSelectedDate.length === 0 && (
                <div className="text-center py-10 text-slate-600">
                    <p>No bills have been generated on this date.</p>
                </div>
            )}
        </div>
      </Card>
      
      {selectedBill && (
        <BillDetailsModal
          isOpen={!!selectedBill}
          onClose={() => setSelectedBill(null)}
          bill={selectedBill}
        />
      )}
    </div>
  );
};

// --- Helper Component ---
const BillDetailsModal: React.FC<{ isOpen: boolean; onClose: () => void; bill: Bill; }> = ({ isOpen, onClose, bill }) => {
    
    const getExpiryDate = (expiryString: string): Date => {
        if (!expiryString) return new Date('9999-12-31');
        const [year, month] = expiryString.split('-').map(Number);
        return new Date(year, month, 0); // Last day of the expiry month
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Bill Details: ${bill.billNumber}`}>
            <div className="space-y-4 text-slate-800">
                <div className="flex justify-between text-sm">
                    <div>
                        <p className="font-semibold text-slate-800">Customer: {bill.customerName}</p>
                        <p className="text-slate-600">Date: {new Date(bill.date).toLocaleString()}</p>
                    </div>
                </div>
                <div className="border-t pt-2">
                    <div className="max-h-60 overflow-y-auto">
                        <table className="w-full text-xs text-left">
                            <thead>
                                <tr>
                                    <th className="py-1">Product</th>
                                    <th className="py-1 text-center">Qty</th>
                                    <th className="py-1 text-right">Rate</th>
                                    <th className="py-1 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bill.items.map(item => {
                                    const expiry = getExpiryDate(item.expiryDate);
                                    let rowClass = '';
                                    let statusBadge = null;
                                    let rowTitle = '';

                                    if (expiry < today) {
                                        rowClass = 'bg-red-100 text-red-800';
                                        statusBadge = <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-red-600 rounded-full">Expired</span>;
                                        rowTitle = `The batch for this item expired on ${expiry.toLocaleDateString()}`;
                                    } else if (expiry <= thirtyDaysFromNow) {
                                        rowClass = 'bg-yellow-100 text-yellow-800';
                                        statusBadge = <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-slate-800 bg-yellow-400 rounded-full">Expires Soon</span>;
                                        rowTitle = `The batch for this item expires on ${expiry.toLocaleDateString()}`;
                                    }

                                    return (
                                        <tr key={item.batchId} className={`border-b ${rowClass}`} title={rowTitle}>
                                            <td className="py-2">
                                                {item.productName}
                                                {item.composition && <div className="text-xs text-indigo-600 font-medium">{item.composition}</div>}
                                                <div className="text-slate-500">
                                                  Batch: {item.batchNumber} / Exp: {item.expiryDate} {statusBadge}
                                                </div>
                                            </td>
                                            <td className="py-2 text-center">{item.quantity}</td>
                                            <td className="py-2 text-right">₹{item.mrp.toFixed(2)}</td>
                                            <td className="py-2 text-right">₹{item.total.toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="border-t pt-3 space-y-1 text-sm">
                    <div className="flex justify-between text-slate-700">
                        <span >Subtotal:</span>
                        <span className="font-medium">₹{bill.subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                        <span>Total GST:</span>
                        <span className="font-medium">₹{bill.totalGst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-slate-800 mt-1">
                        <span>Grand Total:</span>
                        <span>₹{bill.grandTotal.toFixed(2)}</span>
                    </div>
                </div>
                 <div className="flex justify-end pt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300">Close</button>
                </div>
            </div>
        </Modal>
    );
}

export default DayBook;
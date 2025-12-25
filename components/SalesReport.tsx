import React, { useState, useMemo } from 'react';
import type { Bill } from '../types';
import Card from './common/Card';
import { DownloadIcon } from './icons/Icons';

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

interface SalesReportProps {
  bills: Bill[];
}

const SalesReport: React.FC<SalesReportProps> = ({ bills }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredBills = useMemo(() => {
    return bills
      .filter(bill => {
        const billDate = new Date(bill.date);
        billDate.setHours(0, 0, 0, 0);

        if (fromDate) {
          const start = new Date(fromDate);
          start.setHours(0, 0, 0, 0);
          if (billDate < start) return false;
        }

        if (toDate) {
          const end = new Date(toDate);
          end.setHours(0, 0, 0, 0);
          if (billDate > end) return false;
        }

        if (searchTerm) {
          const lowerSearchTerm = searchTerm.toLowerCase();
          return (
            bill.billNumber.toLowerCase().includes(lowerSearchTerm) ||
            bill.customerName.toLowerCase().includes(lowerSearchTerm)
          );
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bills, searchTerm, fromDate, toDate]);

  const summary = useMemo(() => {
    return filteredBills.reduce((acc, bill) => {
        acc.totalSales += bill.grandTotal;
        acc.totalBills++;
        return acc;
    }, { totalSales: 0, totalBills: 0 });
  }, [filteredBills]);

  const handleExport = () => {
    const exportData = filteredBills.map(bill => ({
      'Bill No.': bill.billNumber,
      'Date': new Date(bill.date).toLocaleDateString(),
      'Time': new Date(bill.date).toLocaleTimeString(),
      'Customer': bill.customerName,
      'Items': bill.items.length,
      'Subtotal': bill.subTotal.toFixed(2),
      'GST': bill.totalGst.toFixed(2),
      'Grand Total': bill.grandTotal.toFixed(2),
    }));
    const filename = `sales_report_${fromDate || 'all'}_to_${toDate}`;
    exportToCsv(filename, exportData);
  };
  
  const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
  
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card title="Sales Report">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border dark:border-slate-700">
            <div className="md:col-span-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Search</label>
                <input 
                    type="text" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                    className={formInputStyle}
                    placeholder="Bill No. / Customer"
                />
            </div>
            <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">From</label>
                <input 
                    type="date" 
                    value={fromDate} 
                    onChange={e => setFromDate(e.target.value)}
                    className={formInputStyle}
                />
            </div>
            <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">To</label>
                <input 
                    type="date" 
                    value={toDate} 
                    onChange={e => setToDate(e.target.value)}
                    className={formInputStyle}
                />
            </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
            <div className="grid grid-cols-2 gap-4 w-full sm:w-auto">
                <div className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800 text-center min-w-[160px]">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest">Total Sales</p>
                    <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-1">₹{summary.totalSales.toFixed(2)}</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 text-center min-w-[120px]">
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest">Bills Count</p>
                    <p className="text-2xl font-black text-indigo-900 dark:text-indigo-100 mt-1">{summary.totalBills}</p>
                </div>
            </div>
            <button onClick={handleExport} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-black shadow-lg hover:bg-emerald-700 transition-all transform active:scale-95 uppercase text-sm">
                <DownloadIcon className="h-5 w-5" /> Export Excel
            </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#1e293b] text-slate-300 uppercase text-[11px] font-black tracking-wider border-b dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Bill No.</th>
                <th className="px-6 py-4">Date / Time</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4 text-center">Items</th>
                <th className="px-6 py-4 text-right">Subtotal</th>
                <th className="px-6 py-4 text-right">GST</th>
                <th className="px-6 py-4 text-right">Grand Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
              {filteredBills.map(bill => (
                <tr key={bill.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">{bill.billNumber}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{new Date(bill.date).toLocaleDateString()}</div>
                      <div className="text-[10px]">{new Date(bill.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{bill.customerName}</td>
                  <td className="px-6 py-4 text-center font-bold">{bill.items.length}</td>
                  <td className="px-6 py-4 text-right font-medium">₹{bill.subTotal.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-medium">₹{bill.totalGst.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">₹{bill.grandTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredBills.length === 0 && (
                <div className="text-center py-20 text-slate-500 italic bg-white dark:bg-slate-800">
                    No sales records found for this criteria.
                </div>
            )}
        </div>
      </Card>
    </div>
  );
};

export default SalesReport;
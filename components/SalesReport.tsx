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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-700">
            <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Search Bill No. / Customer</label>
                <input 
                    type="text" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                    className={formInputStyle}
                    placeholder="e.g., B0001 or John Doe"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From Date</label>
                <input 
                    type="date" 
                    value={fromDate} 
                    onChange={e => setFromDate(e.target.value)}
                    className={formInputStyle}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">To Date</label>
                <input 
                    type="date" 
                    value={toDate} 
                    onChange={e => setToDate(e.target.value)}
                    className={formInputStyle}
                />
            </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-green-50 dark:bg-green-900/50 p-4 rounded-lg text-center">
                    <p className="text-sm text-green-800 dark:text-green-300 font-semibold">Total Sales</p>
                    <p className="text-3xl font-bold text-green-900 dark:text-green-200">₹{summary.totalSales.toFixed(2)}</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/50 p-4 rounded-lg text-center">
                    <p className="text-sm text-indigo-800 dark:text-indigo-300 font-semibold">Total Bills</p>
                    <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-200">{summary.totalBills}</p>
                </div>
            </div>
            <button onClick={handleExport} className="flex-shrink-0 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors duration-200">
                <DownloadIcon className="h-5 w-5" />
                <span>Export to Excel</span>
            </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
            <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
              <tr>
                <th scope="col" className="px-6 py-3">Bill No.</th>
                <th scope="col" className="px-6 py-3">Date</th>
                <th scope="col" className="px-6 py-3">Customer</th>
                <th scope="col" className="px-6 py-3 text-center">Items</th>
                <th scope="col" className="px-6 py-3 text-right">Subtotal</th>
                <th scope="col" className="px-6 py-3 text-right">GST</th>
                <th scope="col" className="px-6 py-3 text-right">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map(bill => (
                <tr key={bill.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{bill.billNumber}</td>
                  <td className="px-6 py-4">{new Date(bill.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4">{bill.customerName}</td>
                  <td className="px-6 py-4 text-center">{bill.items.length}</td>
                  <td className="px-6 py-4 text-right">₹{bill.subTotal.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">₹{bill.totalGst.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-semibold">₹{bill.grandTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredBills.length === 0 && (
                <div className="text-center py-10 text-slate-600 dark:text-slate-400">
                    <p>No bills found for the selected criteria.</p>
                </div>
            )}
        </div>
      </Card>
    </div>
  );
};

export default SalesReport;

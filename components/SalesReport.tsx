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

        if (searchTerm && !bill.customerName.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bills, fromDate, toDate, searchTerm]);
  
  const summary = useMemo(() => {
    return filteredBills.reduce((acc, bill) => {
      acc.totalSales += bill.grandTotal;
      acc.totalGst += bill.totalGst;
      return acc;
    }, { totalSales: 0, totalGst: 0 });
  }, [filteredBills]);

  const handleExport = () => {
    const exportData = filteredBills.map(bill => ({
      'Bill No.': bill.billNumber,
      'Date': new Date(bill.date).toLocaleDateString(),
      'Customer Name': bill.customerName,
      'GST Amount': bill.totalGst.toFixed(2),
      'Total Amount': bill.grandTotal.toFixed(2),
    }));
    const filename = `sales_report_${fromDate || 'all'}_to_${toDate}`;
    exportToCsv(filename, exportData);
  };
  
  const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card title="Sales Report">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-700">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Search Customer</label>
            <input
              type="text"
              placeholder="Filter by customer name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={formInputStyle}
            />
          </div>
          <div className="flex items-end">
            <div>
              <label htmlFor="fromDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From</label>
              <input type="date" id="fromDate" value={fromDate} onChange={e => setFromDate(e.target.value)} className={formInputStyle} />
            </div>
          </div>
          <div className="flex items-end">
            <div>
              <label htmlFor="toDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">To</label>
              <input type="date" id="toDate" value={toDate} onChange={e => setToDate(e.target.value)} className={formInputStyle} />
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full sm:w-auto">
                 <div className="bg-blue-50 dark:bg-blue-900/50 p-3 rounded-lg text-center">
                    <p className="text-sm text-blue-800 dark:text-blue-300 font-semibold">Total Bills</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{filteredBills.length}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/50 p-3 rounded-lg text-center">
                    <p className="text-sm text-green-800 dark:text-green-300 font-semibold">Total Sales</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-200">₹{summary.totalSales.toFixed(2)}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/50 p-3 rounded-lg text-center">
                    <p className="text-sm text-purple-800 dark:text-purple-300 font-semibold">Total GST</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">₹{summary.totalGst.toFixed(2)}</p>
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
                <th scope="col" className="px-6 py-3">Customer Name</th>
                <th scope="col" className="px-6 py-3 text-right">GST Amount</th>
                <th scope="col" className="px-6 py-3 text-right">Total Bill Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map(bill => (
                <tr key={bill.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{bill.billNumber}</td>
                  <td className="px-6 py-4">{new Date(bill.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4">{bill.customerName}</td>
                  <td className="px-6 py-4 text-right">₹{bill.totalGst.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-semibold">₹{bill.grandTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredBills.length === 0 && (
            <div className="text-center py-10 text-slate-600 dark:text-slate-400">
              <p>No sales records found for the selected criteria.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SalesReport;


import React, { useState, useMemo } from 'react';
import type { Bill, Salesman } from '../types';
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

interface SalesmanReportProps {
  bills: Bill[];
  salesmen: Salesman[];
}

interface SalesmanSummary {
    id: string;
    name: string;
    totalBills: number;
    totalSales: number;
}

const SalesmanReport: React.FC<SalesmanReportProps> = ({ bills, salesmen }) => {
  const [selectedSalesmanId, setSelectedSalesmanId] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  // Filter bills by date
  const dateFilteredBills = useMemo(() => {
    return bills.filter(bill => {
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
        
        // Only consider bills that have a salesman assigned if we want strict reporting,
        // but for 'summary' of All, we usually only care about known salesmen.
        return true;
    });
  }, [bills, fromDate, toDate]);

  // Report Data Logic
  const reportData = useMemo(() => {
      if (selectedSalesmanId === 'All') {
          // View 1: Summary of all salesmen
          const summaryMap = new Map<string, SalesmanSummary>();
          
          // Initialize map with all known salesmen (so we show them even with 0 sales)
          salesmen.forEach(s => {
              summaryMap.set(s.id, { id: s.id, name: s.name, totalBills: 0, totalSales: 0 });
          });

          dateFilteredBills.forEach(bill => {
              if (bill.salesmanId && summaryMap.has(bill.salesmanId)) {
                  const data = summaryMap.get(bill.salesmanId)!;
                  data.totalBills += 1;
                  data.totalSales += bill.grandTotal;
              }
          });

          return Array.from(summaryMap.values());
      } else {
          // View 2: Detailed bills for specific salesman
          return dateFilteredBills
            .filter(bill => bill.salesmanId === selectedSalesmanId)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
  }, [dateFilteredBills, selectedSalesmanId, salesmen]);

  const grandTotals = useMemo(() => {
      if (selectedSalesmanId === 'All') {
          const data = reportData as SalesmanSummary[];
          return data.reduce((acc, curr) => ({
              bills: acc.bills + curr.totalBills,
              sales: acc.sales + curr.totalSales
          }), { bills: 0, sales: 0 });
      } else {
          const data = reportData as Bill[];
          return data.reduce((acc, curr) => ({
              bills: data.length,
              sales: acc.sales + curr.grandTotal
          }), { bills: 0, sales: 0 });
      }
  }, [reportData, selectedSalesmanId]);

  const handleExport = () => {
    if (selectedSalesmanId === 'All') {
        const data = (reportData as SalesmanSummary[]).map(s => ({
            'Salesman Name': s.name,
            'Total Bills': s.totalBills,
            'Total Sales': s.totalSales.toFixed(2)
        }));
        
        // Add Total Row
        data.push({
            'Salesman Name': 'TOTAL',
            'Total Bills': grandTotals.bills,
            'Total Sales': grandTotals.sales.toFixed(2)
        });

        exportToCsv(`salesman_summary_${fromDate || 'all'}_to_${toDate}`, data);
    } else {
        const data = (reportData as Bill[]).map(b => ({
            'Date': new Date(b.date).toLocaleDateString(),
            'Bill No': b.billNumber,
            'Customer': b.customerName,
            'Amount': b.grandTotal.toFixed(2)
        }));
        
        // Add Total Row
        data.push({
            'Date': '',
            'Bill No': '',
            'Customer': 'TOTAL',
            'Amount': grandTotals.sales.toFixed(2)
        });

        const salesmanName = salesmen.find(s => s.id === selectedSalesmanId)?.name || 'salesman';
        exportToCsv(`${salesmanName}_sales_${fromDate || 'all'}_to_${toDate}`, data);
    }
  };

  const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
  const formSelectStyle = `${formInputStyle} appearance-none`;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card title="Salesman Report">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-700">
            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select Salesman</label>
                <select 
                    value={selectedSalesmanId} 
                    onChange={e => setSelectedSalesmanId(e.target.value)} 
                    className={formSelectStyle}
                >
                    <option value="All">All Salesmen</option>
                    {salesmen.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
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
             <div className="grid grid-cols-2 gap-4 w-full sm:w-auto">
                 <div className="bg-indigo-50 dark:bg-indigo-900/50 p-3 rounded-lg text-center min-w-[120px]">
                    <p className="text-sm text-indigo-800 dark:text-indigo-300 font-semibold">Total Bills</p>
                    <p className="text-xl font-bold text-indigo-900 dark:text-indigo-200">{grandTotals.bills}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/50 p-3 rounded-lg text-center min-w-[150px]">
                    <p className="text-sm text-green-800 dark:text-green-300 font-semibold">Total Sales</p>
                    <p className="text-xl font-bold text-green-900 dark:text-green-200">₹{grandTotals.sales.toFixed(2)}</p>
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
                        {selectedSalesmanId === 'All' ? (
                            <>
                                <th scope="col" className="px-6 py-3">Salesman Name</th>
                                <th scope="col" className="px-6 py-3 text-center">Total Bills</th>
                                <th scope="col" className="px-6 py-3 text-right">Total Sales</th>
                            </>
                        ) : (
                            <>
                                <th scope="col" className="px-6 py-3">Date</th>
                                <th scope="col" className="px-6 py-3">Bill No</th>
                                <th scope="col" className="px-6 py-3">Customer</th>
                                <th scope="col" className="px-6 py-3 text-right">Amount</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {selectedSalesmanId === 'All' ? (
                        (reportData as SalesmanSummary[]).map((row) => (
                            <tr key={row.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{row.name}</td>
                                <td className="px-6 py-4 text-center">{row.totalBills}</td>
                                <td className="px-6 py-4 text-right font-semibold">₹{row.totalSales.toFixed(2)}</td>
                            </tr>
                        ))
                    ) : (
                        (reportData as Bill[]).map((bill) => (
                            <tr key={bill.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                                <td className="px-6 py-4">{new Date(bill.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{bill.billNumber}</td>
                                <td className="px-6 py-4">{bill.customerName}</td>
                                <td className="px-6 py-4 text-right font-semibold">₹{bill.grandTotal.toFixed(2)}</td>
                            </tr>
                        ))
                    )}
                    {reportData.length === 0 && (
                        <tr>
                            <td colSpan={selectedSalesmanId === 'All' ? 3 : 4} className="text-center py-10 text-slate-600 dark:text-slate-400">
                                No records found.
                            </td>
                        </tr>
                    )}
                </tbody>
                <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-700 font-bold border-t-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white">
                        {selectedSalesmanId === 'All' ? (
                            <>
                                <td className="px-6 py-4">TOTAL</td>
                                <td className="px-6 py-4 text-center">{grandTotals.bills}</td>
                                <td className="px-6 py-4 text-right">₹{grandTotals.sales.toFixed(2)}</td>
                            </>
                        ) : (
                            <>
                                <td colSpan={3} className="px-6 py-4 text-right">TOTAL</td>
                                <td className="px-6 py-4 text-right">₹{grandTotals.sales.toFixed(2)}</td>
                            </>
                        )}
                    </tr>
                </tfoot>
            </table>
        </div>
      </Card>
    </div>
  );
};

export default SalesmanReport;

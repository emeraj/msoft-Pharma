import React, { useState, useMemo } from 'react';
import type { Bill, Product } from '../types';
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

interface CompanyWiseBillWiseProfitProps {
  bills: Bill[];
  products: Product[];
}

interface ProfitReportData {
    billId: string;
    billNumber: string;
    date: string;
    customerName: string;
    billValue: number;
    cogs: number;
    profit: number;
}

const CompanyWiseBillWiseProfit: React.FC<CompanyWiseBillWiseProfitProps> = ({ bills, products }) => {
  const [companyFilter, setCompanyFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const companies = useMemo(() => {
    return [...new Set(products.map(p => p.company))].sort();
  }, [products]);
  
  const productMap = useMemo(() => {
      const map = new Map<string, Product>();
      products.forEach(p => map.set(p.id, p));
      return map;
  }, [products]);

  const reportData = useMemo<ProfitReportData[]>(() => {
    if (!companyFilter) return [];
    
    const profitData: ProfitReportData[] = [];

    const dateFilteredBills = bills.filter(bill => {
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
        return true;
    });

    dateFilteredBills.forEach(bill => {
        const companyItems = bill.items.filter(item => {
            const product = productMap.get(item.productId);
            return product?.company === companyFilter;
        });

        if (companyItems.length > 0) {
            let billCogs = 0;
            let billSubTotalForCompany = 0;

            companyItems.forEach(item => {
                const product = productMap.get(item.productId);
                if (!product) return;
                
                const batch = product.batches.find(b => b.id === item.batchId);
                if (!batch || batch.purchasePrice === undefined) {
                    return; 
                }

                const unitsPerStrip = product.unitsPerStrip || 1;
                const costPerUnit = batch.purchasePrice / unitsPerStrip;
                const itemCogs = costPerUnit * item.quantity;
                billCogs += itemCogs;
                
                billSubTotalForCompany += item.total / (1 + item.gst / 100);
            });
            
            if (billSubTotalForCompany > 0 || billCogs > 0) {
                 profitData.push({
                    billId: bill.id,
                    billNumber: bill.billNumber,
                    date: bill.date,
                    customerName: bill.customerName,
                    billValue: billSubTotalForCompany,
                    cogs: billCogs,
                    profit: billSubTotalForCompany - billCogs,
                });
            }
        }
    });

    return profitData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bills, companyFilter, fromDate, toDate, productMap]);

  const summary = useMemo(() => {
    return reportData.reduce((acc, sale) => {
        acc.totalValue += sale.billValue;
        acc.totalCogs += sale.cogs;
        acc.totalProfit += sale.profit;
        return acc;
    }, { totalValue: 0, totalCogs: 0, totalProfit: 0 });
  }, [reportData]);

  const handleExport = () => {
    if (!companyFilter) {
      alert("Please select a company to export data.");
      return;
    }
    const exportData = reportData.map(d => ({
      'Date': new Date(d.date).toLocaleDateString(),
      'Bill No.': d.billNumber,
      'Customer Name': d.customerName,
      'Sale Value (w/o Tax)': d.billValue.toFixed(2),
      'Cost of Goods': d.cogs.toFixed(2),
      'Profit': d.profit.toFixed(2),
    }));
    const filename = `profit_report_${companyFilter.replace(/ /g, '_')}_${fromDate || 'all'}_to_${toDate}`;
    exportToCsv(filename, exportData);
  };
  
  const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
  const formSelectStyle = `${formInputStyle} appearance-none`;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card title="Company Wise-Bill Wise Profit Report">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-700">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select Company*</label>
              <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className={formSelectStyle} required>
                  <option value="">-- Select a Company --</option>
                  {companies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="fromDate-profit" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From</label>
              <input type="date" id="fromDate-profit" value={fromDate} onChange={e => setFromDate(e.target.value)} className={formInputStyle} />
            </div>
            <div>
              <label htmlFor="toDate-profit" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">To</label>
              <input type="date" id="toDate-profit" value={toDate} onChange={e => setToDate(e.target.value)} className={formInputStyle} />
            </div>
        </div>

        {companyFilter && (
             <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full sm:w-auto">
                     <div className="bg-blue-50 dark:bg-blue-900/50 p-3 rounded-lg text-center">
                        <p className="text-sm text-blue-800 dark:text-blue-300 font-semibold">Total Sale Value</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">₹{summary.totalValue.toFixed(2)}</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/50 p-3 rounded-lg text-center">
                        <p className="text-sm text-orange-800 dark:text-orange-300 font-semibold">Total Cost</p>
                        <p className="text-2xl font-bold text-orange-900 dark:text-orange-200">₹{summary.totalCogs.toFixed(2)}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/50 p-3 rounded-lg text-center">
                        <p className="text-sm text-green-800 dark:text-green-300 font-semibold">Total Profit</p>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-200">₹{summary.totalProfit.toFixed(2)}</p>
                    </div>
                </div>
                <button onClick={handleExport} className="flex-shrink-0 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors duration-200">
                    <DownloadIcon className="h-5 w-5" />
                    <span>Export to Excel</span>
                </button>
            </div>
        )}

        {companyFilter ? (
             <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th scope="col" className="px-6 py-3">Date</th>
                    <th scope="col" className="px-6 py-3">Bill No.</th>
                    <th scope="col" className="px-6 py-3">Customer</th>
                    <th scope="col" className="px-6 py-3 text-right">Sale Value (w/o Tax)</th>
                    <th scope="col" className="px-6 py-3 text-right">Cost of Goods</th>
                    <th scope="col" className="px-6 py-3 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map(d => (
                    <tr key={d.billId} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                      <td className="px-6 py-4">{new Date(d.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{d.billNumber}</td>
                      <td className="px-6 py-4">{d.customerName}</td>
                      <td className="px-6 py-4 text-right">₹{d.billValue.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-red-600 dark:text-red-400">₹{d.cogs.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-green-600 dark:text-green-400">₹{d.profit.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportData.length === 0 && (
                <div className="text-center py-10 text-slate-600 dark:text-slate-400">
                  <p>No sales records found for this company in the selected date range with available cost data.</p>
                </div>
              )}
            </div>
        ) : (
             <div className="text-center py-10 text-slate-600 dark:text-slate-400">
              <p className="text-lg">Please select a company to view the profit report.</p>
            </div>
        )}
      </Card>
    </div>
  );
};

export default CompanyWiseBillWiseProfit;

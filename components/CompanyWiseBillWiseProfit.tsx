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
            if (companyFilter === 'All') return true;
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
    if (reportData.length === 0) {
        alert("No data to export.");
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

    const headers = Object.keys(exportData[0]);

    // Custom CSV generation to include footer
    const escapeCell = (cell: any) => {
        let strCell = cell === null || cell === undefined ? '' : String(cell);
        if (/[",\n]/.test(strCell)) {
            strCell = `"${strCell.replace(/"/g, '""')}"`;
        }
        return strCell;
    };

    const headerRow = headers.join(',');
    const dataRows = exportData.map(row => 
        headers.map(header => escapeCell((row as any)[header])).join(',')
    );

    const footerCells = new Array(headers.length).fill('');
    footerCells[2] = 'Totals'; 
    footerCells[3] = summary.totalValue.toFixed(2); 
    footerCells[4] = summary.totalCogs.toFixed(2); 
    footerCells[5] = summary.totalProfit.toFixed(2); 
    const footerRow = footerCells.join(',');

    const csvContent = [
        headerRow,
        ...dataRows,
        '', 
        footerRow
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        const filename = `profit_report_${companyFilter.replace(/ /g, '_')}_${fromDate || 'all'}_to_${toDate}.csv`;
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };
  
  const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
  const formSelectStyle = `${formInputStyle} appearance-none`;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card title="Profit Analysis Report">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border dark:border-slate-700">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Select Company</label>
              <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className={formSelectStyle} required>
                  <option value="">-- Select a Company --</option>
                  <option value="All">All Companies</option>
                  {companies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={formInputStyle} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={formInputStyle} />
            </div>
        </div>

        {companyFilter && (
             <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full sm:w-auto">
                     <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl border border-blue-100 dark:border-blue-800 text-center min-w-[160px]">
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">Sale Value</p>
                        <p className="text-2xl font-black text-blue-900 dark:text-blue-100 mt-1">₹{summary.totalValue.toFixed(2)}</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-xl border border-orange-100 dark:border-orange-800 text-center min-w-[160px]">
                        <p className="text-[10px] text-orange-600 dark:text-orange-400 font-black uppercase tracking-widest">Net Cost</p>
                        <p className="text-2xl font-black text-orange-900 dark:text-orange-100 mt-1">₹{summary.totalCogs.toFixed(2)}</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800 text-center min-w-[160px]">
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest">Gross Profit</p>
                        <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-1">₹{summary.totalProfit.toFixed(2)}</p>
                    </div>
                </div>
                <button onClick={handleExport} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-black shadow-lg hover:bg-emerald-700 transition-all transform active:scale-95 uppercase text-sm">
                    <DownloadIcon className="h-5 w-5" /> Export
                </button>
            </div>
        )}

        {companyFilter ? (
             <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#1e293b] text-slate-300 uppercase text-[11px] font-black tracking-wider border-b dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Bill No.</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4 text-right">Sale (Basic)</th>
                    <th className="px-6 py-4 text-right">Cost (COGS)</th>
                    <th className="px-6 py-4 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                  {reportData.map(d => (
                    <tr key={d.billId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{new Date(d.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">{d.billNumber}</td>
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{d.customerName}</td>
                      <td className="px-6 py-4 text-right font-medium">₹{d.billValue.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-medium text-orange-600 dark:text-orange-400">₹{d.cogs.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-black text-emerald-600 dark:text-emerald-400">₹{d.profit.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportData.length === 0 && (
                <div className="text-center py-20 text-slate-500 italic bg-white dark:bg-slate-800">
                  No records found with available cost data.
                </div>
              )}
            </div>
        ) : (
             <div className="text-center py-20 text-slate-400 italic">
              <p className="text-lg font-bold">Please select a company to generate report.</p>
            </div>
        )}
      </Card>
    </div>
  );
};

export default CompanyWiseBillWiseProfit;
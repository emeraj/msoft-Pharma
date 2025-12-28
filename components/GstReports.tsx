import React, { useState, useMemo } from 'react';
import type { Bill, Purchase, GstReportView } from '../types';
import Card from './common/Card';
import { DownloadIcon, SearchIcon } from './icons/Icons';

interface GstReportsProps {
  view: GstReportView;
  bills: Bill[];
  purchases: Purchase[];
}

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

const GstReports: React.FC<GstReportsProps> = ({ view, bills, purchases }) => {
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const dateFilteredBills = useMemo(() => {
    return bills.filter(b => {
      const d = b.date.split('T')[0];
      return d >= fromDate && d <= toDate;
    });
  }, [bills, fromDate, toDate]);

  const dateFilteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const d = p.invoiceDate.split('T')[0];
      return d >= fromDate && d <= toDate;
    });
  }, [purchases, fromDate, toDate]);

  const renderReport = () => {
    switch (view) {
      case 'gstr3b':
        return renderGSTR3B();
      case 'hsnSales':
        return renderHsnReport(true);
      case 'hsnPurchase':
        return renderHsnReport(false);
      case 'gstWiseSales':
        return renderGstWiseSalesReport();
      default:
        return null;
    }
  };

  const renderGSTR3B = () => {
    const summary = {
      outward: { taxable: 0, tax: 0 },
      inward: { taxable: 0, tax: 0 }
    };

    dateFilteredBills.forEach(b => {
      summary.outward.taxable += b.subTotal;
      summary.outward.tax += b.totalGst;
    });

    dateFilteredPurchases.forEach(p => {
      p.items.forEach(item => {
          const taxable = (item.quantity * item.purchasePrice) * (1 - (item.discount || 0) / 100);
          summary.inward.taxable += taxable;
          summary.inward.tax += (taxable * (item.gst / 100));
      });
    });

    const handleExport = () => {
        exportToCsv('gstr_3b_summary', [
            { Category: 'Outward Supplies (Sales)', 'Taxable Value': summary.outward.taxable.toFixed(2), 'Total Tax': summary.outward.tax.toFixed(2) },
            { Category: 'Inward Supplies (ITC)', 'Taxable Value': summary.inward.taxable.toFixed(2), 'Total Tax': summary.inward.tax.toFixed(2) }
        ]);
    };

    return (
      <Card title="GSTR 3B Summary (Periodical)">
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <h3 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-4">Outward Supplies (Sales)</h3>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-600 dark:text-slate-400">Total Taxable Value</span>
                        <span className="text-xl font-black text-slate-800 dark:text-slate-100">₹{summary.outward.taxable.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-400">Total Output GST</span>
                        <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">₹{summary.outward.tax.toFixed(2)}</span>
                    </div>
                </div>
                <div className="p-6 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-100 dark:border-teal-800">
                    <h3 className="text-sm font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest mb-4">Eligible ITC (Purchases)</h3>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-600 dark:text-slate-400">Total Purchase Value</span>
                        <span className="text-xl font-black text-slate-800 dark:text-slate-100">₹{summary.inward.taxable.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-slate-400">Total Input GST</span>
                        <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">₹{summary.inward.tax.toFixed(2)}</span>
                    </div>
                </div>
            </div>
            <div className="flex justify-end">
                <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-xl font-black uppercase text-xs shadow-lg hover:bg-emerald-700 transition-all"><DownloadIcon className="h-5 w-5" /> Export Summary</button>
            </div>
        </div>
      </Card>
    );
  };

  const renderHsnReport = (isSales: boolean) => {
    const hsnMap = new Map<string, { hsn: string; taxable: number; tax: number; qty: number }>();
    
    if (isSales) {
        dateFilteredBills.forEach(bill => {
            bill.items.forEach(item => {
                const taxable = item.total / (1 + item.gst / 100);
                const existing = hsnMap.get(item.hsnCode) || { hsn: item.hsnCode, taxable: 0, tax: 0, qty: 0 };
                existing.taxable += taxable;
                existing.tax += (item.total - taxable);
                existing.qty += item.quantity;
                hsnMap.set(item.hsnCode, existing);
            });
        });
    } else {
        dateFilteredPurchases.forEach(pur => {
            pur.items.forEach(item => {
                const taxable = (item.quantity * item.purchasePrice) * (1 - (item.discount || 0) / 100);
                const existing = hsnMap.get(item.hsnCode) || { hsn: item.hsnCode, taxable: 0, tax: 0, qty: 0 };
                existing.taxable += taxable;
                existing.tax += (taxable * (item.gst / 100));
                existing.qty += item.quantity;
                hsnMap.set(item.hsnCode, existing);
            });
        });
    }

    const reportData = Array.from(hsnMap.values()).sort((a, b) => a.hsn.localeCompare(b.hsn));
    const handleExport = () => {
        exportToCsv(`hsn_${isSales ? 'sales' : 'purchase'}_report`, reportData.map(d => ({
            'HSN Code': d.hsn,
            'Quantity': d.qty,
            'Taxable Value': d.taxable.toFixed(2),
            'GST Amount': d.tax.toFixed(2),
            'Total': (d.taxable + d.tax).toFixed(2)
        })));
    };

    return (
      <Card title={`HSN Summary - ${isSales ? 'Sales' : 'Purchase'}`}>
         <div className="flex justify-end mb-4">
             <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-xl font-black uppercase text-xs shadow-lg hover:bg-emerald-700 transition-all"><DownloadIcon className="h-5 w-5" /> Export Excel</button>
         </div>
         <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm text-left">
                <thead className="bg-[#1e293b] text-slate-300 uppercase text-[10px] font-black tracking-widest">
                    <tr>
                        <th className="px-6 py-4">HSN Code</th>
                        <th className="px-6 py-4 text-center">Quantity</th>
                        <th className="px-6 py-4 text-right">Taxable Value</th>
                        <th className="px-6 py-4 text-right">Tax Amount</th>
                        <th className="px-6 py-4 text-right">Total Value</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                    {reportData.map((d, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">{d.hsn || 'No HSN'}</td>
                            <td className="px-6 py-4 text-center font-medium text-slate-600 dark:text-slate-400">{d.qty}</td>
                            <td className="px-6 py-4 text-right font-medium">₹{d.taxable.toFixed(2)}</td>
                            <td className="px-6 py-4 text-right font-medium text-emerald-600">₹{d.tax.toFixed(2)}</td>
                            <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">₹{(d.taxable + d.tax).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>
      </Card>
    );
  };

  const renderGstWiseSalesReport = () => {
    const gstMap = new Map<number, { rate: number; taxable: number; cgst: number; sgst: number; total: number }>();
    
    dateFilteredBills.forEach(bill => {
        bill.items.forEach(item => {
            const taxable = item.total / (1 + item.gst / 100);
            const gstAmt = item.total - taxable;
            const existing = gstMap.get(item.gst) || { rate: item.gst, taxable: 0, cgst: 0, sgst: 0, total: 0 };
            existing.taxable += taxable;
            existing.cgst += gstAmt / 2;
            existing.sgst += gstAmt / 2;
            existing.total += item.total;
            gstMap.set(item.gst, existing);
        });
    });

    const reportData = Array.from(gstMap.values()).sort((a, b) => a.rate - b.rate);
    const handleExport = () => {
        exportToCsv('gst_wise_sales_report', reportData.map(d => ({
            'GST Rate (%)': d.rate,
            'Taxable Value': d.taxable.toFixed(2),
            'CGST': d.cgst.toFixed(2),
            'SGST': d.sgst.toFixed(2),
            'Total Value': d.total.toFixed(2)
        })));
    };

    return (
      <Card title="GST Wise Sales Summary">
         <div className="flex justify-end mb-4">
             <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-xl font-black uppercase text-xs shadow-lg hover:bg-emerald-700 transition-all"><DownloadIcon className="h-5 w-5" /> Export Excel</button>
         </div>
         <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm text-left">
                <thead className="bg-[#1e293b] text-slate-300 uppercase text-[10px] font-black tracking-widest">
                    <tr>
                        <th className="px-6 py-4">GST Rate (%)</th>
                        <th className="px-6 py-4 text-right">Taxable Value</th>
                        <th className="px-6 py-4 text-right">CGST</th>
                        <th className="px-6 py-4 text-right">SGST</th>
                        <th className="px-6 py-4 text-right">Total Value</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                    {reportData.map((d, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="px-6 py-4 font-black text-indigo-600 dark:text-indigo-400">{d.rate}%</td>
                            <td className="px-6 py-4 text-right font-medium">₹{d.taxable.toFixed(2)}</td>
                            <td className="px-6 py-4 text-right font-medium text-emerald-600">₹{d.cgst.toFixed(2)}</td>
                            <td className="px-6 py-4 text-right font-medium text-emerald-600">₹{d.sgst.toFixed(2)}</td>
                            <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">₹{d.total.toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>
      </Card>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">GST Reports Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase mt-1 tracking-widest">Compliant Periodical Tax Reporting</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
            <div className="flex-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">From</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full p-2 bg-yellow-100 text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">To</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full p-2 bg-yellow-100 text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>
        </div>
      </div>
      <div className="transition-all duration-300">
        {renderReport()}
      </div>
    </div>
  );
};

export default GstReports;
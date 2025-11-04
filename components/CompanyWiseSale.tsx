import React, { useState, useMemo } from 'react';
import type { Bill, Product } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
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

interface CompanyWiseSaleProps {
  bills: Bill[];
  products: Product[];
}

interface CompanySaleData {
    billId: string;
    date: string;
    customerName: string;
    basicAmount: number;
    gstAmount: number;
    totalValue: number;
}


const CompanySaleDetailsModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    bill: Bill; 
    companyName: string;
    productCompanyMap: Map<string, string>;
}> = ({ isOpen, onClose, bill, companyName, productCompanyMap }) => {
    
    const companyItems = useMemo(() => {
        return bill.items.filter(item => productCompanyMap.get(item.productId) === companyName);
    }, [bill, companyName, productCompanyMap]);

    const { subTotal, totalGst, grandTotal } = useMemo(() => {
        let subTotal = 0;
        let totalGst = 0;
        companyItems.forEach(item => {
          const basePrice = item.total / (1 + item.gst / 100);
          subTotal += basePrice;
          totalGst += item.total - basePrice;
        });
        const grandTotal = subTotal + totalGst;
        return { subTotal, totalGst, grandTotal };
    }, [companyItems]);

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
        <Modal isOpen={isOpen} onClose={onClose} title={`Bill Details for ${companyName}: ${bill.billNumber}`}>
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
                                {companyItems.map(item => {
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
                        <span >Subtotal (for {companyName}):</span>
                        <span className="font-medium">₹{subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                        <span>Total GST (for {companyName}):</span>
                        <span className="font-medium">₹{totalGst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-slate-800 mt-1">
                        <span>Grand Total (for {companyName}):</span>
                        <span>₹{grandTotal.toFixed(2)}</span>
                    </div>
                </div>
                 <div className="flex justify-end pt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300">Close</button>
                </div>
            </div>
        </Modal>
    );
};


const CompanyWiseSale: React.FC<CompanyWiseSaleProps> = ({ bills, products }) => {
  const [companyFilter, setCompanyFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const companies = useMemo(() => {
    return [...new Set(products.map(p => p.company))].sort();
  }, [products]);

  const productCompanyMap = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach(p => map.set(p.id, p.company));
    return map;
  }, [products]);

  const filteredSalesData = useMemo<CompanySaleData[]>(() => {
    if (!companyFilter) return [];

    const salesData: CompanySaleData[] = [];

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
        const companyItems = bill.items.filter(item => productCompanyMap.get(item.productId) === companyFilter);

        if (companyItems.length > 0) {
            let basicAmount = 0;
            let gstAmount = 0;
            let totalValue = 0;

            companyItems.forEach(item => {
                const itemBasePrice = item.total / (1 + item.gst / 100);
                basicAmount += itemBasePrice;
                gstAmount += item.total - itemBasePrice;
                totalValue += item.total;
            });

            salesData.push({
                billId: bill.id,
                date: bill.date,
                customerName: bill.customerName,
                basicAmount,
                gstAmount,
                totalValue
            });
        }
    });

    return salesData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  }, [bills, companyFilter, fromDate, toDate, productCompanyMap]);
  
  const summary = useMemo(() => {
      return filteredSalesData.reduce((acc, sale) => {
          acc.totalBasic += sale.basicAmount;
          acc.totalGst += sale.gstAmount;
          acc.totalValue += sale.totalValue;
          return acc;
      }, { totalBasic: 0, totalGst: 0, totalValue: 0 });
  }, [filteredSalesData]);
  
  const handleExport = () => {
    if (!companyFilter) {
      alert("Please select a company to export data.");
      return;
    }
    const exportData = filteredSalesData.map(sale => ({
      'Date': new Date(sale.date).toLocaleDateString(),
      'Customer Name': sale.customerName,
      'Basic Amount': sale.basicAmount.toFixed(2),
      'GST Amount': sale.gstAmount.toFixed(2),
      'Total Value': sale.totalValue.toFixed(2),
    }));
    const filename = `sales_report_${companyFilter.replace(/ /g, '_')}_${fromDate || 'all'}_to_${toDate}`;
    exportToCsv(filename, exportData);
  };
  
  const handleViewDetails = (billId: string) => {
    const bill = bills.find(b => b.id === billId);
    if (bill) {
        setSelectedBill(bill);
    }
  };

  const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500";
  const formSelectStyle = `${formInputStyle} appearance-none`;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card title="Company-wise Sales Report">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-slate-50 rounded-lg border">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Company</label>
              <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className={formSelectStyle} required>
                  <option value="">-- Select a Company --</option>
                  {companies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="fromDate" className="block text-sm font-medium text-slate-700 mb-1">From</label>
              <input type="date" id="fromDate" value={fromDate} onChange={e => setFromDate(e.target.value)} className={formInputStyle} />
            </div>
            <div>
              <label htmlFor="toDate" className="block text-sm font-medium text-slate-700 mb-1">To</label>
              <input type="date" id="toDate" value={toDate} onChange={e => setToDate(e.target.value)} className={formInputStyle} />
            </div>
        </div>

        {companyFilter && (
             <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full sm:w-auto">
                     <div className="bg-blue-50 p-3 rounded-lg text-center">
                        <p className="text-sm text-blue-800 font-semibold">Total Basic Amount</p>
                        <p className="text-2xl font-bold text-blue-900">₹{summary.totalBasic.toFixed(2)}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg text-center">
                        <p className="text-sm text-purple-800 font-semibold">Total GST Amount</p>
                        <p className="text-2xl font-bold text-purple-900">₹{summary.totalGst.toFixed(2)}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-center">
                        <p className="text-sm text-green-800 font-semibold">Total Invoice Value</p>
                        <p className="text-2xl font-bold text-green-900">₹{summary.totalValue.toFixed(2)}</p>
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
              <table className="w-full text-sm text-left text-slate-800">
                <thead className="text-xs text-slate-800 uppercase bg-slate-50">
                  <tr>
                    <th scope="col" className="px-6 py-3">Date</th>
                    <th scope="col" className="px-6 py-3">Customer Name</th>
                    <th scope="col" className="px-6 py-3 text-right">Basic Amount</th>
                    <th scope="col" className="px-6 py-3 text-right">GST Amount</th>
                    <th scope="col" className="px-6 py-3 text-right">Total Invoice Value</th>
                    <th scope="col" className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSalesData.map(sale => (
                    <tr key={sale.billId} className="bg-white border-b hover:bg-slate-50">
                      <td className="px-6 py-4">{new Date(sale.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">{sale.customerName}</td>
                      <td className="px-6 py-4 text-right">₹{sale.basicAmount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">₹{sale.gstAmount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-semibold">₹{sale.totalValue.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => handleViewDetails(sale.billId)} className="font-medium text-indigo-600 hover:underline">
                            View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSalesData.length === 0 && (
                <div className="text-center py-10 text-slate-600">
                  <p>No sales records found for this company in the selected date range.</p>
                </div>
              )}
            </div>
        ) : (
             <div className="text-center py-10 text-slate-600">
              <p className="text-lg">Please select a company to view the sales report.</p>
            </div>
        )}
      </Card>
      {selectedBill && (
        <CompanySaleDetailsModal
          isOpen={!!selectedBill}
          onClose={() => setSelectedBill(null)}
          bill={selectedBill}
          companyName={companyFilter}
          productCompanyMap={productCompanyMap}
        />
      )}
    </div>
  );
};

export default CompanyWiseSale;
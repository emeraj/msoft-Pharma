
import React, { useState, useMemo, useEffect } from 'react';
import type { Product, Purchase, Bill, SystemConfig, GstRate, Batch } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { DownloadIcon, TrashIcon, PlusIcon, PencilIcon, UploadIcon, ArchiveIcon } from './icons/Icons';
import { getTranslation } from '../utils/translationHelper';

interface InventoryProps {
  products: Product[];
  purchases?: Purchase[];
  bills?: Bill[];
  systemConfig: SystemConfig;
  gstRates: GstRate[];
  onAddProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  onUpdateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
}

const inputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";

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

const getExpiryDate = (expiryString: string): Date => {
    if (!expiryString) return new Date('9999-12-31');
    const [year, month] = expiryString.split('-').map(Number);
    return new Date(year, month, 0);
};

const formatStock = (stock: number, unitsPerStrip?: number): string => {
    if (stock === 0) return '0 U';
    if (!unitsPerStrip || unitsPerStrip <= 1) {
        return `${stock} U`;
    }
    const strips = Math.floor(stock / unitsPerStrip);
    const looseUnits = stock % unitsPerStrip;
    let result = '';
    if (strips > 0) {
        result += `${strips} S`;
    }
    if (looseUnits > 0) {
        result += `${strips > 0 ? ' + ' : ''}${looseUnits} U`;
    }
    return result || '0 U';
};

const BatchWiseStockView: React.FC<{ products: Product[], onDeleteBatch: (pid: string, bid: string) => void, systemConfig: SystemConfig, t: any }> = ({ products, onDeleteBatch, systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const allBatches = useMemo(() => { return products.flatMap(p => p.batches.map(b => ({ ...b, product: p }))).filter(item => { const term = searchTerm.toLowerCase(); return item.product.name.toLowerCase().includes(term) || item.batchNumber.toLowerCase().includes(term); }); }, [products, searchTerm]);
    
    const handleExport = () => {
        if (allBatches.length === 0) { alert("No data"); return; }
        const data = allBatches.map(b => {
            const units = b.product.unitsPerStrip || 1;
            const stockVal = (b.stock / units) * b.purchasePrice;
            return {
                'Product': b.product.name,
                'Company': b.product.company,
                'Batch': b.batchNumber,
                'Expiry': b.expiryDate,
                'MRP': b.mrp.toFixed(2),
                'Rate': b.purchasePrice.toFixed(2),
                'Stock': formatStock(b.stock, b.product.unitsPerStrip),
                'Value': stockVal.toFixed(2)
            };
        });
        exportToCsv('all_batches_stock', data);
    };

    return (
        <Card title={t.inventory.batchStock}>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <input type="text" placeholder="Search by Product or Batch..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputStyle} />
                <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors flex-shrink-0">
                    <DownloadIcon className="h-5 w-5" /> Export
                </button>
            </div>
            <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs sticky top-0">
                        <tr>
                            <th className="px-4 py-2">Product</th>
                            <th className="px-4 py-2">Company</th>
                            <th className="px-4 py-2">Batch No</th>
                            <th className="px-4 py-2">Expiry</th>
                            <th className="px-4 py-2 text-right">MRP</th>
                            <th className="px-4 py-2 text-right">Rate</th>
                            <th className="px-4 py-2 text-center">Stock</th>
                            <th className="px-4 py-2 text-right">Value</th>
                            <th className="px-4 py-2 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allBatches.map(item => {
                            const units = item.product.unitsPerStrip || 1;
                            const stockValue = (item.stock / units) * item.purchasePrice;
                            return (
                                <tr key={`${item.product.id}-${item.id}`} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                    <td className="px-4 py-2 font-medium">{item.product.name}</td>
                                    <td className="px-4 py-2">{item.product.company}</td>
                                    <td className="px-4 py-2">{item.batchNumber}</td>
                                    <td className="px-4 py-2">{item.expiryDate}</td>
                                    <td className="px-4 py-2 text-right">₹{item.mrp.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-right">₹{item.purchasePrice.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-center">{formatStock(item.stock, item.product.unitsPerStrip)}</td>
                                    <td className="px-4 py-2 text-right">₹{stockValue.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-center">
                                        <button 
                                            onClick={() => { if(window.confirm(`Are you sure you want to delete batch ${item.batchNumber} of ${item.product.name}?`)) onDeleteBatch(item.product.id, item.id); }} 
                                            className="text-red-500 hover:text-red-700 p-1"
                                            title="Delete Batch"
                                        >
                                            <TrashIcon className="h-4 w-4"/>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

const CompanyWiseStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], systemConfig: SystemConfig, t: any }> = ({ products, purchases, bills, systemConfig, t }) => {
    const [selectedCompany, setSelectedCompany] = useState('All Companies');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const companies = useMemo(() => ['All Companies', ...[...new Set(products.map(p => p.company))].sort()], [products]);
    
    interface BatchReportRow {
        productId: string;
        productName: string;
        company: string;
        batchNumber: string;
        expiryDate: string;
        unitsPerStrip: number;
        openingStock: number;
        purchasedQty: number;
        soldQty: number;
        closingStock: number;
        stockValue: number;
        mrp: number;
        isFirstOfProduct: boolean;
    }

    const reportData = useMemo<BatchReportRow[]>(() => {
        const start = fromDate ? new Date(fromDate) : null;
        if (start) start.setHours(0, 0, 0, 0);
        
        const end = toDate ? new Date(toDate) : new Date();
        end.setHours(23, 59, 59, 999);

        // Filter products by company
        const filteredProducts = products.filter(p => selectedCompany === 'All Companies' || p.company === selectedCompany);
        
        const rows: BatchReportRow[] = [];

        filteredProducts.forEach(product => {
            const unitsPerStrip = product.unitsPerStrip || 1;
            let isFirst = true;

            product.batches.forEach(batch => {
                // 1. Current Live Stock (Closing for "Now")
                const currentStock = batch.stock;

                // 2. Calculate Transactions AFTER 'end' date (Future relative to report period)
                // We need to reverse these from Current Stock to find Closing Stock of Period
                let futurePurchases = 0;
                let futureSales = 0;
                
                // 3. Calculate Transactions WITHIN 'start' and 'end' date
                let periodPurchases = 0;
                let periodSales = 0;

                // Purchases
                purchases.forEach(pur => {
                    const pDate = new Date(pur.invoiceDate);
                    pur.items.forEach(item => {
                        // Match Logic: BatchId preferred, else BatchNumber within same product
                        const isMatch = (item.batchId && item.batchId === batch.id) || 
                                        (!item.batchId && item.productId === product.id && item.batchNumber === batch.batchNumber) ||
                                        (!item.batchId && !item.productId && item.productName === product.name && item.batchNumber === batch.batchNumber);
                        
                        if (isMatch) {
                            const qty = item.quantity * (item.unitsPerStrip || unitsPerStrip);
                            
                            if (pDate > end) {
                                futurePurchases += qty;
                            } else if (!start || pDate >= start) {
                                periodPurchases += qty;
                            }
                        }
                    });
                });

                // Sales (Bills)
                bills.forEach(bill => {
                    const bDate = new Date(bill.date);
                    bill.items.forEach(item => {
                        // Bills usually have batchId
                        if (item.batchId === batch.id) {
                            const qty = item.quantity; // Stored as total units
                            
                            if (bDate > end) {
                                futureSales += qty;
                            } else if (!start || bDate >= start) {
                                periodSales += qty;
                            }
                        }
                    });
                });

                // 4. Calculate Closing Stock at 'end' date
                // Closing = Current - FuturePurchases + FutureSales
                const closingStock = currentStock - futurePurchases + futureSales;

                // 5. Calculate Opening Stock at 'start' date
                // Opening = Closing - PeriodPurchases + PeriodSales
                const openingStock = closingStock - periodPurchases + periodSales;

                // Filter out inactive batches:
                // Hide if Opening=0 AND Closing=0 AND No Activity in Period
                if (openingStock !== 0 || closingStock !== 0 || periodPurchases !== 0 || periodSales !== 0) {
                    const stockValue = closingStock * (batch.mrp / unitsPerStrip);
                    
                    rows.push({
                        productId: product.id,
                        productName: product.name,
                        company: product.company,
                        batchNumber: batch.batchNumber,
                        expiryDate: batch.expiryDate,
                        unitsPerStrip,
                        openingStock,
                        purchasedQty: periodPurchases,
                        soldQty: periodSales,
                        closingStock,
                        stockValue,
                        mrp: batch.mrp,
                        isFirstOfProduct: isFirst
                    });
                    isFirst = false;
                }
            });
        });

        return rows.sort((a, b) => a.productName.localeCompare(b.productName));
    }, [products, purchases, bills, selectedCompany, fromDate, toDate]);

    const handleExport = () => {
        if (reportData.length === 0) { alert("No data to export."); return; }
        
        const data = reportData.map(r => ({
            'Product': r.productName,
            'Company': r.company,
            'Batch': r.batchNumber,
            'Expiry': r.expiryDate,
            'Opening Stock': formatStock(r.openingStock, r.unitsPerStrip),
            'Purchased': formatStock(r.purchasedQty, r.unitsPerStrip),
            'Sold': formatStock(r.soldQty, r.unitsPerStrip),
            'Closing Stock': formatStock(r.closingStock, r.unitsPerStrip),
            'Value': r.stockValue.toFixed(2)
        }));
        
        exportToCsv(`Company_Stock_${selectedCompany}_${fromDate}_to_${toDate}`, data);
    };

    return (
        <Card title={t.inventory.companyStock}>
            <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
                <div className="flex-grow w-full md:w-auto"><select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} className={inputStyle + " w-full"}>{companies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="flex items-center gap-2"><label className="text-sm font-medium whitespace-nowrap text-slate-700 dark:text-slate-300">From</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputStyle} /></div>
                <div className="flex items-center gap-2"><label className="text-sm font-medium whitespace-nowrap text-slate-700 dark:text-slate-300">To</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inputStyle} /></div>
                <div><button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors"><DownloadIcon className="h-5 w-5" /> Export to Excel</button></div>
            </div>
            
            <div className="overflow-x-auto rounded-lg border dark:border-slate-700">
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="text-xs uppercase bg-slate-800 text-slate-200">
                        <tr>
                            <th className="px-4 py-3 w-1/4">Product / Company</th>
                            <th className="px-4 py-3">Batch / Expiry</th>
                            <th className="px-4 py-3 text-center">Opening</th>
                            <th className="px-4 py-3 text-center">Purchased</th>
                            <th className="px-4 py-3 text-center">Sold</th>
                            <th className="px-4 py-3 text-center">Closing</th>
                            <th className="px-4 py-3 text-right">Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700 bg-slate-900 text-slate-300">
                        {reportData.map((row, idx) => (
                            <tr key={`${row.productId}-${row.batchNumber}-${idx}`} className="hover:bg-slate-800 transition-colors">
                                <td className="px-4 py-3 align-top">
                                    {row.isFirstOfProduct ? (
                                        <>
                                            <div className="font-bold text-white text-base">{row.productName}</div>
                                            <div className="text-xs text-slate-400 mt-1 uppercase tracking-wide">{row.company}</div>
                                        </>
                                    ) : null}
                                </td>
                                <td className="px-4 py-3 align-top">
                                    <div className="text-slate-200 font-medium">{row.batchNumber}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">{row.expiryDate}</div>
                                </td>
                                <td className="px-4 py-3 text-center align-top text-slate-400">
                                    {formatStock(row.openingStock, row.unitsPerStrip)}
                                </td>
                                <td className="px-4 py-3 text-center align-top text-green-400">
                                    {row.purchasedQty > 0 ? formatStock(row.purchasedQty, row.unitsPerStrip) : '-'}
                                </td>
                                <td className="px-4 py-3 text-center align-top text-red-400">
                                    {row.soldQty > 0 ? formatStock(row.soldQty, row.unitsPerStrip) : '-'}
                                </td>
                                <td className="px-4 py-3 text-center align-top font-bold text-white">
                                    {formatStock(row.closingStock, row.unitsPerStrip)}
                                </td>
                                <td className="px-4 py-3 text-right align-top font-mono">
                                    {row.stockValue > 0 ? `₹${row.stockValue.toFixed(2)}` : '₹0.00'}
                                </td>
                            </tr>
                        ))}
                        {reportData.length === 0 && (
                            <tr><td colSpan={7} className="text-center py-8 text-slate-500">No active stock found for the selected criteria.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

const ExpiredStockView: React.FC<{ products: Product[], onDeleteBatch: (pid: string, bid: string) => void, systemConfig: SystemConfig, t: any }> = ({ products, onDeleteBatch, t }) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const expiredBatches = useMemo(() => { return products.flatMap(p => p.batches.map(b => ({ ...b, product: p }))).filter(item => item.stock > 0 && getExpiryDate(item.expiryDate) < today); }, [products, today]);
    
    const handleExport = () => {
        if (expiredBatches.length === 0) { alert("No data"); return; }
        const data = expiredBatches.map(b => ({
            'Product': b.product.name,
            'Batch': b.batchNumber,
            'Expiry': b.expiryDate,
            'Stock': formatStock(b.stock, b.product.unitsPerStrip)
        }));
        exportToCsv('expired_stock', data);
    };

    return (
        <Card title={
            <div className="flex justify-between items-center">
                <span>{t.inventory.expiredStock}</span>
                <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 text-sm rounded-lg shadow hover:bg-green-700 transition-colors">
                    <DownloadIcon className="h-4 w-4" /> Export
                </button>
            </div>
        }>
            <div className="overflow-x-auto"><table className="w-full text-sm text-left text-slate-800 dark:text-slate-300"><thead className="bg-red-50 dark:bg-red-900/30 uppercase text-xs"><tr><th className="px-4 py-2">Product</th><th className="px-4 py-2">Batch</th><th className="px-4 py-2">Expiry</th><th className="px-4 py-2 text-center">Stock</th><th className="px-4 py-2 text-center">Action</th></tr></thead><tbody>{expiredBatches.map(item => (<tr key={`${item.product.id}-${item.id}`} className="border-b dark:border-slate-700"><td className="px-4 py-2 font-medium">{item.product.name}</td><td className="px-4 py-2">{item.batchNumber}</td><td className="px-4 py-2 text-red-600 font-bold">{item.expiryDate}</td><td className="px-4 py-2 text-center">{formatStock(item.stock, item.product.unitsPerStrip)}</td><td className="px-4 py-2 text-center"><button onClick={() => { if(window.confirm('Delete this expired batch?')) onDeleteBatch(item.product.id, item.id); }} className="text-red-600 hover:text-red-800"><TrashIcon className="h-4 w-4" /></button></td></tr>))}{expiredBatches.length === 0 && <tr><td colSpan={5} className="text-center py-4">No expired stock found.</td></tr>}</tbody></table></div>
        </Card>
    );
};

const NearingExpiryStockView: React.FC<{ products: Product[], onDeleteBatch: (pid: string, bid: string) => void, systemConfig: SystemConfig, t: any }> = ({ products, onDeleteBatch, t }) => {
    const today = new Date(); today.setHours(0,0,0,0); const next30Days = new Date(today); next30Days.setDate(today.getDate() + 30);
    const nearExpiryBatches = useMemo(() => { return products.flatMap(p => p.batches.map(b => ({ ...b, product: p }))).filter(item => { const exp = getExpiryDate(item.expiryDate); return item.stock > 0 && exp >= today && exp <= next30Days; }); }, [products, today, next30Days]);
    
    const handleExport = () => {
        if (nearExpiryBatches.length === 0) { alert("No data"); return; }
        const data = nearExpiryBatches.map(b => ({
            'Product': b.product.name,
            'Batch': b.batchNumber,
            'Expiry': b.expiryDate,
            'Stock': formatStock(b.stock, b.product.unitsPerStrip)
        }));
        exportToCsv('near_expiry_stock', data);
    };

    return (
        <Card title={
            <div className="flex justify-between items-center">
                <span>{t.inventory.nearExpiry}</span>
                <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 text-sm rounded-lg shadow hover:bg-green-700 transition-colors">
                    <DownloadIcon className="h-4 w-4" /> Export
                </button>
            </div>
        }>
            <div className="overflow-x-auto"><table className="w-full text-sm text-left text-slate-800 dark:text-slate-300"><thead className="bg-yellow-50 dark:bg-yellow-900/30 uppercase text-xs"><tr><th className="px-4 py-2">Product</th><th className="px-4 py-2">Batch</th><th className="px-4 py-2">Expiry</th><th className="px-4 py-2 text-center">Stock</th><th className="px-4 py-2 text-center">Action</th></tr></thead><tbody>{nearExpiryBatches.map(item => (<tr key={`${item.product.id}-${item.id}`} className="border-b dark:border-slate-700"><td className="px-4 py-2 font-medium">{item.product.name}</td><td className="px-4 py-2">{item.batchNumber}</td><td className="px-4 py-2 text-yellow-600 font-bold">{item.expiryDate}</td><td className="px-4 py-2 text-center">{formatStock(item.stock, item.product.unitsPerStrip)}</td><td className="px-4 py-2 text-center"><button onClick={() => { if(window.confirm('Delete this batch?')) onDeleteBatch(item.product.id, item.id); }} className="text-red-600 hover:text-red-800"><TrashIcon className="h-4 w-4" /></button></td></tr>))}{nearExpiryBatches.length === 0 && <tr><td colSpan={5} className="text-center py-4">No batches expiring soon.</td></tr>}</tbody></table></div>
        </Card>
    );
};

const AddProductModal: React.FC<{ isOpen: boolean, onClose: () => void, onAdd: (p: any) => void, systemConfig: SystemConfig, gstRates: GstRate[], initialData?: Product, isEdit?: boolean }> = ({ isOpen, onClose, onAdd, systemConfig, gstRates, initialData, isEdit }) => {
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [formData, setFormData] = useState<any>({
        name: '', company: '', hsnCode: '', gst: 0, barcode: '', composition: '', unitsPerStrip: 1, isScheduleH: false
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    name: initialData.name,
                    company: initialData.company,
                    hsnCode: initialData.hsnCode,
                    gst: initialData.gst,
                    barcode: initialData.barcode || '',
                    composition: initialData.composition || '',
                    unitsPerStrip: initialData.unitsPerStrip || 1,
                    isScheduleH: initialData.isScheduleH || false
                });
            } else {
                setFormData({ name: '', company: '', hsnCode: '', gst: 0, barcode: '', composition: '', unitsPerStrip: 1, isScheduleH: false });
            }
        }
    }, [isOpen, initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd({
            ...formData,
            gst: parseFloat(formData.gst as string) || 0,
            unitsPerStrip: parseInt(formData.unitsPerStrip as string) || 1,
            ...(!initialData && { batches: [] }) // Only initialize batches for new product
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Product' : 'Add New Product'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium mb-1">Product Name</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputStyle} required /></div>
                <div><label className="block text-sm font-medium mb-1">Company</label><input type="text" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} className={inputStyle} required /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium mb-1">HSN Code</label><input type="text" value={formData.hsnCode} onChange={e => setFormData({...formData, hsnCode: e.target.value})} className={inputStyle} /></div>
                    <div>
                        <label className="block text-sm font-medium mb-1">GST (%)</label>
                        <select value={formData.gst} onChange={e => setFormData({...formData, gst: e.target.value})} className={inputStyle}>
                            {gstRates.map(r => <option key={r.id} value={r.rate}>{r.rate}%</option>)}
                        </select>
                    </div>
                </div>
                {!isPharmaMode && <div><label className="block text-sm font-medium mb-1">Barcode</label><input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className={inputStyle} /></div>}
                {isPharmaMode && (
                    <>
                        <div><label className="block text-sm font-medium mb-1">Composition</label><input type="text" value={formData.composition} onChange={e => setFormData({...formData, composition: e.target.value})} className={inputStyle} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium mb-1">Units per Strip</label><input type="number" value={formData.unitsPerStrip} onChange={e => setFormData({...formData, unitsPerStrip: e.target.value})} className={inputStyle} min="1" /></div>
                            <div className="flex items-center mt-6">
                                <input type="checkbox" checked={formData.isScheduleH} onChange={e => setFormData({...formData, isScheduleH: e.target.checked})} className="mr-2 h-4 w-4" />
                                <label className="text-sm font-medium">Schedule H Drug</label>
                            </div>
                        </div>
                    </>
                )}
                <div className="flex justify-end gap-2 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                </div>
            </form>
        </Modal>
    );
};

const Inventory: React.FC<InventoryProps> = ({ products, purchases = [], bills = [], systemConfig, gstRates, onAddProduct, onUpdateProduct, onDeleteProduct }) => {
    const t = getTranslation(systemConfig.language);
    const [view, setView] = useState<'products' | 'batches' | 'company' | 'expired' | 'nearExpiry'>('products');
    const [isAddProductOpen, setAddProductOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleDeleteBatch = (pid: string, bid: string) => {
        const product = products.find(p => p.id === pid);
        if(product) {
            const updatedBatches = product.batches.filter(b => b.id !== bid);
            onUpdateProduct(pid, { batches: updatedBatches });
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={() => setView('products')} className={`px-4 py-2 rounded-lg ${view === 'products' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800'}`}>Product Master</button>
                <button onClick={() => setView('batches')} className={`px-4 py-2 rounded-lg ${view === 'batches' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800'}`}>{t.inventory.batchStock}</button>
                <button onClick={() => setView('company')} className={`px-4 py-2 rounded-lg ${view === 'company' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800'}`}>{t.inventory.companyStock}</button>
                <button onClick={() => setView('expired')} className={`px-4 py-2 rounded-lg ${view === 'expired' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800'}`}>{t.inventory.expiredStock}</button>
                <button onClick={() => setView('nearExpiry')} className={`px-4 py-2 rounded-lg ${view === 'nearExpiry' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800'}`}>{t.inventory.nearExpiry}</button>
            </div>

            {view === 'products' && (
                <Card title={
                    <div className="flex justify-between items-center">
                        <span>Product Master</span>
                        <button onClick={() => setAddProductOpen(true)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2">
                            <PlusIcon className="h-4 w-4"/> {t.inventory.addProduct}
                        </button>
                    </div>
                }>
                    <div className="mb-4">
                        <input type="text" placeholder={t.inventory.searchPlaceholder} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputStyle} />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                            <thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-2">Name</th>
                                    <th className="px-4 py-2">Company</th>
                                    <th className="px-4 py-2">GST</th>
                                    <th className="px-4 py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map(p => (
                                    <tr key={p.id} className="border-b dark:border-slate-700">
                                        <td className="px-4 py-2">{p.name}</td>
                                        <td className="px-4 py-2">{p.company}</td>
                                        <td className="px-4 py-2">{p.gst}%</td>
                                        <td className="px-4 py-2 flex gap-2">
                                            <button onClick={() => setEditingProduct(p)} className="text-blue-600"><PencilIcon className="h-4 w-4" /></button>
                                            <button onClick={() => onDeleteProduct(p.id)} className="text-red-600"><TrashIcon className="h-4 w-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {view === 'batches' && <BatchWiseStockView products={products} onDeleteBatch={handleDeleteBatch} systemConfig={systemConfig} t={t} />}
            {view === 'company' && <CompanyWiseStockView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} t={t} />}
            {view === 'expired' && <ExpiredStockView products={products} onDeleteBatch={handleDeleteBatch} systemConfig={systemConfig} t={t} />}
            {view === 'nearExpiry' && <NearingExpiryStockView products={products} onDeleteBatch={handleDeleteBatch} systemConfig={systemConfig} t={t} />}

            <AddProductModal 
                isOpen={isAddProductOpen} 
                onClose={() => setAddProductOpen(false)} 
                onAdd={onAddProduct} 
                systemConfig={systemConfig} 
                gstRates={gstRates} 
            />
            
            {editingProduct && (
                <AddProductModal 
                    isOpen={!!editingProduct} 
                    onClose={() => setEditingProduct(null)} 
                    onAdd={(data: any) => { onUpdateProduct(editingProduct.id, data); }} 
                    initialData={editingProduct}
                    systemConfig={systemConfig} 
                    gstRates={gstRates} 
                    isEdit={true}
                />
            )}
        </div>
    );
};

export default Inventory;

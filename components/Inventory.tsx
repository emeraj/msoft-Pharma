
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, Purchase, Bill, SystemConfig, GstRate, Batch } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { DownloadIcon, TrashIcon, PlusIcon, PencilIcon, UploadIcon, ArchiveIcon, BarcodeIcon, PrinterIcon, InformationCircleIcon, CheckCircleIcon, SearchIcon } from './icons/Icons';
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

const formatStock = (stock: number, unitsPerStrip?: number): string => {
    if (stock === 0) return '0 U';
    if (!unitsPerStrip || unitsPerStrip <= 1) return `${stock} U`;
    const strips = Math.floor(stock / unitsPerStrip);
    const looseUnits = stock % unitsPerStrip;
    let result = '';
    if (strips > 0) result += `${strips} S`;
    if (looseUnits > 0) result += `${strips > 0 ? ' + ' : ''}${looseUnits} U`;
    return result || '0 U';
};

/* Fix: Added missing ProductImportModal component */
const ProductImportModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onDownloadTemplate: () => void;
}> = ({ isOpen, onClose, onImport, onDownloadTemplate }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import Products">
            <div className="space-y-6">
                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
                    <h4 className="text-indigo-900 dark:text-indigo-200 font-bold mb-2">Instructions</h4>
                    <ul className="text-sm text-indigo-700 dark:text-indigo-300 list-disc pl-5 space-y-1">
                        <li>Download the CSV template below.</li>
                        <li>Fill in your product details.</li>
                        <li>Save and upload the file to bulk import items.</li>
                    </ul>
                </div>
                <div className="flex flex-col gap-4">
                    <button onClick={onDownloadTemplate} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                        <DownloadIcon className="h-5 w-5" /> Download Template
                    </button>
                    <div className="relative">
                        <input 
                            type="file" 
                            accept=".csv" 
                            onChange={onImport} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                        />
                        <div className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                            <UploadIcon className="h-5 w-5" /> Import CSV File
                        </div>
                    </div>
                </div>
                <div className="flex justify-end pt-4 border-t dark:border-slate-700">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-300 transition-colors">Close</button>
                </div>
            </div>
        </Modal>
    );
};

const CompanyWiseStockView: React.FC<{ products: Product[], t: any }> = ({ products, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    
    const companyData = useMemo(() => {
        const map = new Map<string, { company: string, totalValue: number, itemCount: number }>();
        
        products.forEach(p => {
            const totalValue = p.batches.reduce((sum, b) => {
                const units = p.unitsPerStrip || 1;
                return sum + (b.stock * (b.purchasePrice / units));
            }, 0);

            const current = map.get(p.company) || { company: p.company, totalValue: 0, itemCount: 0 };
            current.totalValue += totalValue;
            current.itemCount += 1;
            map.set(p.company, current);
        });

        return Array.from(map.values())
            .filter(i => i.company.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.company.localeCompare(b.company));
    }, [products, searchTerm]);

    const totalValuation = useMemo(() => companyData.reduce((sum, item) => sum + item.totalValue, 0), [companyData]);

    const handleExport = () => {
        exportToCsv('company_wise_stock', companyData.map(item => ({
            'Company': item.company,
            'Total Items': item.itemCount,
            'Valuation (Purchase)': item.totalValue.toFixed(2)
        })));
    };

    return (
        <Card title={t.inventory.companyStock}>
            <div className="flex flex-col sm:flex-row gap-4 mb-4 justify-between items-end">
                <div className="relative flex-grow max-w-md">
                    <input 
                        type="text" 
                        placeholder="Search company..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className={`${inputStyle} pl-10`} 
                    />
                    <SearchIcon className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-lg border border-indigo-100 dark:border-indigo-800">
                        <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">Total Value:</span>
                        <span className="ml-2 text-lg font-bold text-indigo-900 dark:text-indigo-100">₹{totalValuation.toFixed(2)}</span>
                    </div>
                    <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700">
                        <DownloadIcon className="h-5 w-5" /> Export
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto border dark:border-slate-700 rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs font-bold">
                        <tr>
                            <th className="px-4 py-3">Company Name</th>
                            <th className="px-4 py-3 text-center">No. of Items</th>
                            <th className="px-4 py-3 text-right">Total Stock Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {companyData.map((item, idx) => (
                            <tr key={idx} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white uppercase">{item.company}</td>
                                <td className="px-4 py-3 text-center font-bold text-slate-500">{item.itemCount}</td>
                                <td className="px-4 py-3 text-right font-black text-indigo-600 dark:text-indigo-400">₹{item.totalValue.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {companyData.length === 0 && (
                    <div className="py-10 text-center text-slate-500">No company stock records found.</div>
                )}
            </div>
        </Card>
    );
};

const AllItemStockView: React.FC<{ products: Product[], systemConfig: SystemConfig, t: any }> = ({ products, systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const stockData = useMemo(() => {
        return products.map(p => {
            const totalStock = p.batches.reduce((sum, b) => sum + b.stock, 0);
            const unitsPerStrip = p.unitsPerStrip || 1;
            const totalValue = p.batches.reduce((sum, b) => sum + (b.stock * (b.purchasePrice / unitsPerStrip)), 0);
            return { id: p.id, name: p.name, company: p.company, unitsPerStrip, totalStock, totalValue };
        }).filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.company.toLowerCase().includes(searchTerm.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
    }, [products, searchTerm]);
    const totalValuation = useMemo(() => stockData.reduce((sum, item) => sum + item.totalValue, 0), [stockData]);
    const handleExport = () => { exportToCsv('all_item_stock_summary', stockData.map(item => ({ 'Product': item.name, 'Company': item.company, 'Total Stock': formatStock(item.totalStock, item.unitsPerStrip), 'Stock Value': item.totalValue.toFixed(2) }))); };
    return (
        <Card title={t.inventory.allStock}>
            <div className="flex flex-col sm:flex-row gap-4 mb-4 justify-between items-end">
                <input type="text" placeholder={t.inventory.searchPlaceholder} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${inputStyle} max-w-sm`} />
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                    <div className="bg-teal-50 dark:bg-teal-900/30 px-4 py-2 rounded-lg w-full sm:w-auto text-center border border-teal-100 dark:border-teal-800"><span className="text-sm font-semibold text-teal-800 dark:text-teal-300">Total Valuation:</span><span className="ml-2 text-lg font-bold text-teal-900 dark:text-teal-100">₹{totalValuation.toFixed(2)}</span></div>
                    <button onClick={handleExport} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg"><DownloadIcon className="h-5 w-5" /> Export</button>
                </div>
            </div>
            <div className="overflow-x-auto max-h-[600px] border dark:border-slate-700 rounded-lg"><table className="w-full text-sm text-left"><thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs sticky top-0"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Company</th><th className="px-4 py-3 text-center">Total Stock</th><th className="px-4 py-3 text-right">Value</th></tr></thead><tbody>{stockData.map(item => (<tr key={item.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"><td className="px-4 py-3 font-medium">{item.name}</td><td className="px-4 py-3">{item.company}</td><td className="px-4 py-3 text-center font-bold">{formatStock(item.totalStock, item.unitsPerStrip)}</td><td className="px-4 py-3 text-right">₹{item.totalValue.toFixed(2)}</td></tr>))}</tbody></table></div>
        </Card>
    );
};

const SelectedItemStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], systemConfig: SystemConfig, t: any }> = ({ products, purchases, bills, systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
    const productSuggestions = useMemo(() => { if (!searchTerm) return []; return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10); }, [searchTerm, products]);
    const handleSelectProduct = (p: Product) => { setSelectedProduct(p); setSearchTerm(p.name); setIsSuggestionsOpen(false); };
    const transactions = useMemo(() => {
        if (!selectedProduct) return [];
        const txs: any[] = [];
        const unitsPerStrip = selectedProduct.unitsPerStrip || 1;
        purchases.forEach(pur => pur.items.forEach(item => {
            if (item.productId === selectedProduct.id || (!item.productId && item.productName === selectedProduct.name && item.company === selectedProduct.company)) {
                txs.push({ date: new Date(pur.invoiceDate), type: 'Purchase', particulars: `Inv: ${pur.invoiceNumber} (${pur.supplier})`, inQty: item.quantity * (item.unitsPerStrip || unitsPerStrip), outQty: 0 });
            }
        }));
        bills.forEach(bill => bill.items.forEach(item => {
            if (item.productId === selectedProduct.id) {
                txs.push({ date: new Date(bill.date), type: 'Sale', particulars: `Bill: ${bill.billNumber} (${bill.customerName})`, inQty: 0, outQty: item.quantity });
            }
        }));
        return txs.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [selectedProduct, purchases, bills]);
    const filteredResults = useMemo(() => {
        let opening = 0;
        const start = fromDate ? new Date(fromDate) : null; if (start) start.setHours(0,0,0,0);
        const end = toDate ? new Date(toDate) : new Date(); end.setHours(23,59,59,999);
        if (start) transactions.forEach(tx => { if (tx.date < start) opening += (tx.inQty - tx.outQty); });
        let running = opening;
        const rows = transactions.filter(tx => (!start || tx.date >= start) && tx.date <= end).map(tx => {
            running += (tx.inQty - tx.outQty);
            return { ...tx, balance: running };
        });
        return { opening, rows };
    }, [transactions, fromDate, toDate]);
    return (
        <Card title={t.inventory.selectedStock}>
            <div className="mb-6 relative"><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Search Product</label><input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setIsSuggestionsOpen(true); }} onFocus={() => setIsSuggestionsOpen(true)} className={inputStyle} />{isSuggestionsOpen && productSuggestions.length > 0 && (<ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">{productSuggestions.map(p => (<li key={p.id} onClick={() => handleSelectProduct(p)} className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer text-slate-800 dark:text-slate-200"><div className="font-medium">{p.name}</div><div className="text-xs text-slate-500">{p.company}</div></li>))}</ul>)}</div>
            {selectedProduct && (<div className="space-y-6"><div className="bg-slate-700 text-white p-4 rounded-lg flex justify-between items-center shadow-md"><div><h2 className="text-xl font-bold">{selectedProduct.name}</h2><p className="text-slate-300">{selectedProduct.company}</p></div><div className="text-right"><p className="text-sm">Current Stock</p><p className="text-2xl font-bold">{formatStock(selectedProduct.batches.reduce((sum, b) => sum + b.stock, 0), selectedProduct.unitsPerStrip)}</p></div></div><div className="flex gap-4 items-end"><div className="flex-1"><label className="block text-xs font-medium uppercase mb-1 text-slate-600 dark:text-slate-400">From</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputStyle} /></div><div className="flex-1"><label className="block text-xs font-medium uppercase mb-1 text-slate-600 dark:text-slate-400">To</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inputStyle} /></div></div><div className="overflow-x-auto border dark:border-slate-700 rounded-lg"><table className="w-full text-sm text-left"><thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-particulars">Particulars</th><th className="px-4 py-3 text-right">IN</th><th className="px-4 py-3 text-right">OUT</th><th className="px-4 py-3 text-right">Balance</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"><tr className="bg-slate-50 dark:bg-slate-800/30"><td colSpan={5} className="px-4 py-3 text-right font-bold">Opening Balance:</td><td className="px-4 py-3 text-right font-bold">{formatStock(filteredResults.opening, selectedProduct.unitsPerStrip)}</td></tr>{filteredResults.rows.map((row, idx) => (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><td className="px-4 py-3">{row.date.toLocaleDateString()}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.type === 'Sale' ? 'bg-teal-100 text-teal-800' : 'bg-green-100 text-green-800'}`}>{row.type}</span></td><td className="px-4 py-3">{row.particulars}</td><td className="px-4 py-3 text-right text-green-600">{row.inQty > 0 ? row.inQty : '-'}</td><td className="px-4 py-3 text-right text-red-600">{row.outQty > 0 ? row.outQty : '-'}</td><td className="px-4 py-3 text-right font-bold">{formatStock(row.balance, selectedProduct.unitsPerStrip)}</td></tr>))}</tbody></table></div></div>)}
        </Card>
    );
};

const EditBatchModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    batch: Batch;
    onSave: (pid: string, updatedBatch: Batch) => void;
}> = ({ isOpen, onClose, product, batch, onSave }) => {
    const [formData, setFormData] = useState<Batch>({ ...batch });
    useEffect(() => { setFormData({ ...batch }); }, [batch, isOpen]);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(product.id, formData); onClose(); };
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Batch">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Product</label><input value={product.name} disabled className={`${inputStyle} bg-slate-200 dark:bg-slate-700 cursor-not-allowed`} /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Batch No</label><input name="batchNumber" value={formData.batchNumber} onChange={handleChange} className={inputStyle} required /></div>
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Expiry (YYYY-MM)</label><input name="expiryDate" value={formData.expiryDate} onChange={handleChange} className={inputStyle} placeholder="YYYY-MM" required /></div>
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">MRP</label><input type="number" name="mrp" step="0.01" value={formData.mrp} onChange={handleChange} className={inputStyle} required /></div>
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Sale Rate</label><input type="number" name="saleRate" step="0.01" value={formData.saleRate || formData.mrp} onChange={handleChange} className={inputStyle} /></div>
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Purchase Price</label><input type="number" name="purchasePrice" step="0.01" value={formData.purchasePrice} onChange={handleChange} className={inputStyle} required /></div>
                    <div className="col-span-2"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Stock (Total Units)</label><input type="number" name="stock" value={formData.stock} onChange={handleChange} className={inputStyle} required /></div>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700"><button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg">Save</button></div>
            </form>
        </Modal>
    );
};

const BatchWiseStockView: React.FC<{ products: Product[], onDeleteBatch: (pid: string, bid: string) => void, onUpdateProduct: (id: string, product: Partial<Product>) => Promise<void>, systemConfig: SystemConfig, t: any }> = ({ products, onDeleteBatch, onUpdateProduct, systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingBatchData, setEditingBatchData] = useState<{ product: Product, batch: Batch } | null>(null);
    const allBatches = useMemo(() => products.flatMap(p => p.batches.map(b => ({ ...b, product: p }))).filter(item => { const term = searchTerm.toLowerCase(); return item.product.name.toLowerCase().includes(term) || item.batchNumber.toLowerCase().includes(term); }), [products, searchTerm]);
    const handleUpdateBatch = (pid: string, updatedBatch: Batch) => { const product = products.find(p => p.id === pid); if (product) { const updatedBatches = product.batches.map(b => b.id === updatedBatch.id ? updatedBatch : b); onUpdateProduct(pid, { batches: updatedBatches }); } };
    return (
        <Card title={t.inventory.batchStock}>
            <div className="mb-4">
                <input type="text" placeholder="Search product or batch..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputStyle} />
            </div>
            <div className="overflow-x-auto border dark:border-slate-700 rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3">Product</th>
                            <th className="px-4 py-3">Batch No</th>
                            <th className="px-4 py-3">Expiry</th>
                            <th className="px-4 py-3 text-right">MRP</th>
                            <th className="px-4 py-3 text-center">Stock</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allBatches.map((item, idx) => (
                            <tr key={idx} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                <td className="px-4 py-3">{item.product.name}</td>
                                <td className="px-4 py-3 font-mono">{item.batchNumber}</td>
                                <td className="px-4 py-3">{item.expiryDate}</td>
                                <td className="px-4 py-3 text-right">₹{item.mrp.toFixed(2)}</td>
                                <td className="px-4 py-3 text-center font-bold">{formatStock(item.stock, item.product.unitsPerStrip)}</td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex justify-center gap-2">
                                        <button onClick={() => setEditingBatchData({ product: item.product, batch: item })} className="text-blue-500 hover:text-blue-700"><PencilIcon className="h-4 w-4" /></button>
                                        <button onClick={() => onDeleteBatch(item.product.id, item.id)} className="text-red-500 hover:text-red-700"><TrashIcon className="h-4 w-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {editingBatchData && (
                <EditBatchModal 
                    isOpen={!!editingBatchData} 
                    onClose={() => setEditingBatchData(null)} 
                    product={editingBatchData.product} 
                    batch={editingBatchData.batch} 
                    onSave={handleUpdateBatch} 
                />
            )}
        </Card>
    );
};

const Inventory: React.FC<InventoryProps> = ({ products, purchases = [], bills = [], systemConfig, gstRates, onAddProduct, onUpdateProduct, onDeleteProduct }) => {
    const t = getTranslation(systemConfig.language);
    const [activeTab, setActiveTab] = useState<'all' | 'selected' | 'batch' | 'company'>('all');
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    
    const handleDeleteBatch = (pid: string, bid: string) => {
        if (!window.confirm("Delete this batch?")) return;
        const product = products.find(p => p.id === pid);
        if (product) {
            const updatedBatches = product.batches.filter(b => b.id !== bid);
            onUpdateProduct(pid, { batches: updatedBatches });
        }
    };

    const handleImportCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            alert("CSV Import Triggered (Logic pending backend mapping)");
            setImportModalOpen(false);
        };
        reader.readAsText(file);
    };

    const handleDownloadTemplate = () => {
        const headers = ["Name", "Barcode", "Company", "GST", "MRP", "Purchase Rate", "Sale Rate"];
        const csvContent = headers.join(',') + '\nExample Item,1001,Demo Corp,12,150,100,120';
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", "inventory_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{t.inventory.title}</h1>
                <div className="flex gap-2">
                    <button onClick={() => setImportModalOpen(true)} className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-200">
                        <UploadIcon className="h-5 w-5" /> {t.inventory.import}
                    </button>
                </div>
            </div>

            <div className="flex border-b dark:border-slate-700 overflow-x-auto gap-4">
                <button onClick={() => setActiveTab('all')} className={`pb-2 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'all' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-slate-500'}`}>{t.inventory.allStock}</button>
                <button onClick={() => setActiveTab('selected')} className={`pb-2 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'selected' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-slate-500'}`}>{t.inventory.selectedStock}</button>
                <button onClick={() => setActiveTab('batch')} className={`pb-2 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'batch' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-slate-500'}`}>{t.inventory.batchStock}</button>
                <button onClick={() => setActiveTab('company')} className={`pb-2 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'company' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-slate-500'}`}>{t.inventory.companyStock}</button>
            </div>

            <div className="mt-4 transition-all duration-300">
                {activeTab === 'all' && <AllItemStockView products={products} systemConfig={systemConfig} t={t} />}
                {activeTab === 'selected' && <SelectedItemStockView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} t={t} />}
                {activeTab === 'batch' && <BatchWiseStockView products={products} onDeleteBatch={handleDeleteBatch} onUpdateProduct={onUpdateProduct} systemConfig={systemConfig} t={t} />}
                {activeTab === 'company' && <CompanyWiseStockView products={products} t={t} />}
            </div>

            <ProductImportModal 
                isOpen={isImportModalOpen} 
                onClose={() => setImportModalOpen(false)} 
                onImport={handleImportCsv} 
                onDownloadTemplate={handleDownloadTemplate} 
            />
        </div>
    );
};

export default Inventory;

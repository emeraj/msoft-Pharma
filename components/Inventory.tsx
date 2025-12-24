
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, Purchase, Bill, SystemConfig, GstRate, Batch } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { DownloadIcon, TrashIcon, PlusIcon, PencilIcon, UploadIcon, ArchiveIcon, BarcodeIcon, PrinterIcon, InformationCircleIcon, CheckCircleIcon } from './icons/Icons';
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

const ProductImportModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onDownloadTemplate: () => void;
}> = ({ isOpen, onClose, onImport, onDownloadTemplate }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    if (!isOpen) return null;

    const requiredFields = [
        { name: 'Name', desc: 'Product Name (e.g. Paracetamol 500mg)' },
        { name: 'Barcode/Part No', desc: 'Unique Barcode or Part Number' },
        { name: 'Company', desc: 'Manufacturer or Brand Name' },
        { name: 'GST', desc: 'Tax percentage (e.g. 12 or 18)' },
        { name: 'MRP', desc: 'Maximum Retail Price' },
        { name: 'Purchase Rate', desc: 'Price at which you bought it' },
        { name: 'Sale Rate', desc: 'Actual selling price (can be same as MRP)' }
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import Products from CSV" maxWidth="max-w-2xl">
            <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                    <h4 className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-2">
                        <InformationCircleIcon className="h-5 w-5" />
                        CSV Format Instructions
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mb-4">
                        Please ensure your CSV file has the following column headers exactly as shown below:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {requiredFields.map((field, idx) => (
                            <div key={idx} className="flex flex-col p-2 bg-white dark:bg-slate-800 rounded border dark:border-slate-700 shadow-sm">
                                <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-tighter">{field.name}</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">{field.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                    <div className="text-center sm:text-left">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">Prepared your file?</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Upload your .csv file here</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={onDownloadTemplate}
                            className="px-4 py-2 bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-700 rounded-lg text-sm font-bold hover:bg-teal-50 transition-colors flex items-center gap-2"
                        >
                            <DownloadIcon className="h-4 w-4" /> Template
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 shadow-md transition-colors flex items-center gap-2"
                        >
                            <UploadIcon className="h-4 w-4" /> Choose CSV File
                        </button>
                        <input type="file" ref={fileInputRef} onChange={onImport} accept=".csv" className="hidden" />
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t dark:border-slate-700">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg text-sm font-bold">Cancel</button>
                </div>
            </div>
        </Modal>
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
    useEffect(() => { setFormData({ ...batch }); }, [batch]);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(product.id, formData); onClose(); };
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Batch Details">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium">Product</label><input value={product.name} disabled className={`${inputStyle} bg-slate-200 dark:bg-slate-700 cursor-not-allowed`} /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium">Batch Number</label><input name="batchNumber" value={formData.batchNumber} onChange={handleChange} className={inputStyle} required /></div>
                    <div><label className="block text-sm font-medium">Expiry (YYYY-MM)</label><input name="expiryDate" value={formData.expiryDate} onChange={handleChange} className={inputStyle} placeholder="YYYY-MM" required /></div>
                    <div><label className="block text-sm font-medium">MRP</label><input type="number" name="mrp" step="0.01" value={formData.mrp} onChange={handleChange} className={inputStyle} required /></div>
                    <div><label className="block text-sm font-medium">Sale Rate</label><input type="number" name="saleRate" step="0.01" value={formData.saleRate || formData.mrp} onChange={handleChange} className={inputStyle} /></div>
                    <div><label className="block text-sm font-medium">Purchase Price</label><input type="number" name="purchasePrice" step="0.01" value={formData.purchasePrice} onChange={handleChange} className={inputStyle} required /></div>
                    <div className="col-span-2"><label className="block text-sm font-medium">Current Stock (Total Units)</label><input type="number" name="stock" value={formData.stock} onChange={handleChange} className={inputStyle} required /><p className="text-xs text-orange-600 mt-1">Warning: Manually adjusting stock affects inventory.</p></div>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700"><button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg">Save</button></div>
            </form>
        </Modal>
    );
};

const PrintBarcodeModal: React.FC<{ isOpen: boolean; onClose: () => void; product: Product }> = ({ isOpen, onClose, product }) => {
    const [quantity, setQuantity] = useState(1);
    const mrp = useMemo(() => {
        if (!product.batches || product.batches.length === 0) return 0;
        return Math.max(...product.batches.map(b => b.saleRate || b.mrp));
    }, [product]);
    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) { alert("Please allow popups."); return; }
        const barcodeValue = product.barcode || product.id.substring(0, 8);
        const html = `<!DOCTYPE html><html><head><title>Print Labels</title><script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script><style>@media print{@page{size:50mm 25mm;margin:0}body{margin:0}}body{margin:0;padding:0;font-family:sans-serif}.label{width:50mm;height:25mm;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;text-align:center;overflow:hidden;page-break-inside:avoid;page-break-after:always;padding:1mm 0;box-sizing:border-box}.name{font-size:9px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:48mm;text-transform:uppercase;line-height:1}.price{font-size:9px;font-weight:bold;line-height:1}svg{width:95%;height:auto;max-height:15mm;display:block}</style></head><body>${Array.from({ length: quantity }).map(() => `<div class="label"><div class="name">${product.name}</div><svg class="barcode" jsbarcode-format="auto" jsbarcode-value="${barcodeValue}" jsbarcode-textmargin="0" jsbarcode-fontoptions="bold" jsbarcode-height="45" jsbarcode-width="2" jsbarcode-displayValue="true" jsbarcode-fontSize="14" jsbarcode-marginTop="0" jsbarcode-marginBottom="0"></svg><div class="price">RATE: ₹${mrp.toFixed(2)}</div></div>`).join('')}<script>JsBarcode(".barcode").init();window.onload=function(){setTimeout(function(){window.print();window.close();},500)}</script></body></html>`;
        printWindow.document.write(html); printWindow.document.close(); onClose();
    };
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Print Barcode Labels (50x25mm)">
            <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg"><p className="text-lg font-bold">{product.name}</p><p className="text-sm text-slate-500">{product.company}</p></div>
                <div><label className="block text-sm font-medium mb-1">Number of Labels</label><input type="number" min="1" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} className={inputStyle} autoFocus /></div>
                <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700"><button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Cancel</button><button onClick={handlePrint} className="px-4 py-2 bg-teal-600 text-white rounded-lg flex items-center gap-2"><PrinterIcon className="h-4 w-4" /> Print</button></div>
            </div>
        </Modal>
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
            <div className="overflow-x-auto max-h-[600px] border dark:border-slate-700 rounded-lg">
                <table className="w-full text-sm text-left"><thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs sticky top-0"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Company</th><th className="px-4 py-3 text-center">Total Stock</th><th className="px-4 py-3 text-right">Value</th></tr></thead><tbody>{stockData.map(item => (<tr key={item.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"><td className="px-4 py-3 font-medium">{item.name}</td><td className="px-4 py-3">{item.company}</td><td className="px-4 py-3 text-center font-bold">{formatStock(item.totalStock, item.unitsPerStrip)}</td><td className="px-4 py-3 text-right">₹{item.totalValue.toFixed(2)}</td></tr>))}</tbody></table>
            </div>
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
            {selectedProduct && (<div className="space-y-6"><div className="bg-slate-700 text-white p-4 rounded-lg flex justify-between items-center shadow-md"><div><h2 className="text-xl font-bold">{selectedProduct.name}</h2><p className="text-slate-300">{selectedProduct.company}</p></div><div className="text-right"><p className="text-sm">Current Stock</p><p className="text-2xl font-bold">{formatStock(selectedProduct.batches.reduce((sum, b) => sum + b.stock, 0), selectedProduct.unitsPerStrip)}</p></div></div><div className="flex gap-4 items-end"><div className="flex-1"><label className="block text-xs font-medium uppercase mb-1 text-slate-600 dark:text-slate-400">From</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputStyle} /></div><div className="flex-1"><label className="block text-xs font-medium uppercase mb-1 text-slate-600 dark:text-slate-400">To</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inputStyle} /></div></div><div className="overflow-x-auto border dark:border-slate-700 rounded-lg"><table className="w-full text-sm text-left"><thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Particulars</th><th className="px-4 py-3 text-right">IN</th><th className="px-4 py-3 text-right">OUT</th><th className="px-4 py-3 text-right">Balance</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"><tr className="bg-slate-50 dark:bg-slate-800/30"><td colSpan={5} className="px-4 py-3 text-right font-bold">Opening Balance:</td><td className="px-4 py-3 text-right font-bold">{formatStock(filteredResults.opening, selectedProduct.unitsPerStrip)}</td></tr>{filteredResults.rows.map((row, idx) => (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><td className="px-4 py-3">{row.date.toLocaleDateString()}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.type === 'Sale' ? 'bg-teal-100 text-teal-800' : 'bg-green-100 text-green-800'}`}>{row.type}</span></td><td className="px-4 py-3">{row.particulars}</td><td className="px-4 py-3 text-right text-green-600">{row.inQty > 0 ? row.inQty : '-'}</td><td className="px-4 py-3 text-right text-red-600">{row.outQty > 0 ? row.outQty : '-'}</td><td className="px-4 py-3 text-right font-bold">{formatStock(row.balance, selectedProduct.unitsPerStrip)}</td></tr>))}</tbody></table></div></div>)}
        </Card>
    );
};

const BatchWiseStockView: React.FC<{ products: Product[], onDeleteBatch: (pid: string, bid: string) => void, onUpdateProduct: (id: string, product: Partial<Product>) => Promise<void>, systemConfig: SystemConfig, t: any }> = ({ products, onDeleteBatch, onUpdateProduct, systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingBatchData, setEditingBatchData] = useState<{ product: Product, batch: Batch } | null>(null);
    const allBatches = useMemo(() => products.flatMap(p => p.batches.map(b => ({ ...b, product: p }))).filter(item => { const term = searchTerm.toLowerCase(); return item.product.name.toLowerCase().includes(term) || item.batchNumber.toLowerCase().includes(term); }), [products, searchTerm]);
    const handleUpdateBatch = (pid: string, updatedBatch: Batch) => { const product = products.find(p => p.id === pid); if (product) { const updatedBatches = product.batches.map(b => b.id === updatedBatch.id ? updatedBatch : b); onUpdateProduct(pid, { batches: updatedBatches }); } };
    return (
        <Card title={t.inventory.batchStock}>
            <div className="flex gap-4 mb-4"><input type="text" placeholder="Search product or batch..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputStyle} /></div>
            <div className="overflow-x-auto max-h-[600px] border dark:border-slate-700 rounded-lg"><table className="w-full text-sm text-left"><thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs sticky top-0"><tr><th className="px-4 py-2">Product</th><th className="px-4 py-2">Batch</th><th className="px-4 py-2">Expiry</th><th className="px-4 py-2 text-right">MRP</th><th className="px-4 py-2 text-right">Rate</th><th className="px-4 py-2 text-center">Stock</th><th className="px-4 py-2 text-center">Action</th></tr></thead><tbody className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">{allBatches.map(item => (<tr key={`${item.product.id}-${item.id}`} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"><td className="px-4 py-2 font-medium">{item.product.name}</td><td className="px-4 py-2">{item.batchNumber}</td><td className="px-4 py-2">{item.expiryDate}</td><td className="px-4 py-2 text-right">₹{item.mrp.toFixed(2)}</td><td className="px-4 py-2 text-right">₹{(item.saleRate || item.mrp).toFixed(2)}</td><td className="px-4 py-2 text-center font-bold">{formatStock(item.stock, item.product.unitsPerStrip)}</td><td className="px-4 py-2 text-center flex justify-center gap-2"><button onClick={() => setEditingBatchData({ product: item.product, batch: item })} className="text-blue-500 hover:text-blue-700 p-1"><PencilIcon className="h-4 w-4"/></button><button onClick={() => { if(window.confirm('Delete batch?')) onDeleteBatch(item.product.id, item.id); }} className="text-red-500 hover:text-red-700 p-1"><TrashIcon className="h-4 w-4"/></button></td></tr>))}</tbody></table></div>
            {editingBatchData && (<EditBatchModal isOpen={!!editingBatchData} onClose={() => setEditingBatchData(null)} product={editingBatchData.product} batch={editingBatchData.batch} onSave={handleUpdateBatch} />)}
        </Card>
    );
};

const CompanyWiseStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], systemConfig: SystemConfig, t: any }> = ({ products, purchases, bills, systemConfig, t }) => {
    const [selectedCompany, setSelectedCompany] = useState('All Companies');
    const companies = useMemo(() => ['All Companies', ...[...new Set(products.map(p => p.company))].sort()], [products]);
    const reportData = useMemo(() => {
        const rows: any[] = [];
        products.filter(p => selectedCompany === 'All Companies' || p.company === selectedCompany).forEach(product => {
            const unitsPerStrip = product.unitsPerStrip || 1;
            product.batches.forEach(batch => { if (batch.stock > 0) rows.push({ productName: product.name, company: product.company, batchNumber: batch.batchNumber, expiryDate: batch.expiryDate, stock: batch.stock, unitsPerStrip, value: batch.stock * (batch.mrp / unitsPerStrip) }); });
        });
        return rows.sort((a, b) => a.productName.localeCompare(b.productName));
    }, [products, selectedCompany]);
    return (
        <Card title={t.inventory.companyStock}>
            <div className="mb-6"><select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} className={inputStyle}>{companies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className="overflow-x-auto rounded-lg border dark:border-slate-700"><table className="w-full text-sm text-left"><thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700"><tr><th className="px-4 py-3">Product / Company</th><th className="px-4 py-3">Batch / Expiry</th><th className="px-4 py-3 text-center">Stock</th><th className="px-4 py-3 text-right">Value</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">{reportData.map((row, idx) => (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700"><td className="px-4 py-3"><div className="font-bold">{row.productName}</div><div className="text-[10px] text-slate-500 uppercase">{row.company}</div></td><td className="px-4 py-3"><div>{row.batchNumber}</div><div className="text-[10px] text-slate-500">{row.expiryDate}</div></td><td className="px-4 py-3 text-center font-bold">{formatStock(row.stock, row.unitsPerStrip)}</td><td className="px-4 py-3 text-right">₹{row.value.toFixed(2)}</td></tr>))}</tbody></table></div>
        </Card>
    );
};

const ExpiredStockView: React.FC<{ products: Product[], onDeleteBatch: (pid: string, bid: string) => void, t: any }> = ({ products, onDeleteBatch, t }) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const expiredBatches = useMemo(() => products.flatMap(p => p.batches.map(b => ({ ...b, product: p }))).filter(item => item.stock > 0 && new Date(item.expiryDate + '-01') < today), [products, today]);
    return (
        <Card title={t.inventory.expiredStock}>
            <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-red-50 dark:bg-red-900/30 uppercase text-xs"><tr><th className="px-4 py-2">Product</th><th className="px-4 py-2">Batch</th><th className="px-4 py-2">Expiry</th><th className="px-4 py-2 text-center">Stock</th><th className="px-4 py-2 text-center">Action</th></tr></thead><tbody className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">{expiredBatches.map(item => (<tr key={`${item.product.id}-${item.id}`} className="border-b dark:border-slate-700"><td className="px-4 py-2 font-medium">{item.product.name}</td><td className="px-4 py-2">{item.batchNumber}</td><td className="px-4 py-2 text-red-600 font-bold">{item.expiryDate}</td><td className="px-4 py-2 text-center font-bold">{formatStock(item.stock, item.product.unitsPerStrip)}</td><td className="px-4 py-2 text-center"><button onClick={() => { if(window.confirm('Delete expired batch?')) onDeleteBatch(item.product.id, item.id); }} className="text-red-600 hover:text-red-800"><TrashIcon className="h-4 w-4" /></button></td></tr>))}</tbody></table></div>
        </Card>
    );
};

const NearingExpiryStockView: React.FC<{ products: Product[], onDeleteBatch: (pid: string, bid: string) => void, t: any }> = ({ products, onDeleteBatch, t }) => {
    const today = new Date(); today.setHours(0,0,0,0); const next30Days = new Date(today); next30Days.setDate(today.getDate() + 30);
    const nearExpiryBatches = useMemo(() => products.flatMap(p => p.batches.map(b => ({ ...b, product: p }))).filter(item => { const exp = new Date(item.expiryDate + '-01'); return item.stock > 0 && exp >= today && exp <= next30Days; }), [products, today]);
    return (
        <Card title={t.inventory.nearExpiry}>
            <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-yellow-50 dark:bg-yellow-900/30 uppercase text-xs"><tr><th className="px-4 py-2">Product</th><th className="px-4 py-2">Batch</th><th className="px-4 py-2">Expiry</th><th className="px-4 py-2 text-center">Stock</th><th className="px-4 py-2 text-center">Action</th></tr></thead><tbody className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">{nearExpiryBatches.map(item => (<tr key={`${item.product.id}-${item.id}`} className="border-b dark:border-slate-700"><td className="px-4 py-2 font-medium">{item.product.name}</td><td className="px-4 py-2">{item.batchNumber}</td><td className="px-4 py-2 text-yellow-600 font-bold">{item.expiryDate}</td><td className="px-4 py-2 text-center font-bold">{formatStock(item.stock, item.product.unitsPerStrip)}</td><td className="px-4 py-2 text-center"><button onClick={() => { if(window.confirm('Delete batch?')) onDeleteBatch(item.product.id, item.id); }} className="text-red-600 hover:text-red-800"><TrashIcon className="h-4 w-4" /></button></td></tr>))}</tbody></table></div>
        </Card>
    );
};

const AddProductModal: React.FC<{ isOpen: boolean, onClose: () => void, onAdd: (p: any) => void, systemConfig: SystemConfig, gstRates: GstRate[], initialData?: Product, isEdit?: boolean, existingCompanies: string[] }> = ({ isOpen, onClose, onAdd, systemConfig, gstRates, initialData, isEdit, existingCompanies }) => {
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [formData, setFormData] = useState<any>({ name: '', company: '', hsnCode: '', gst: 0, barcode: '', composition: '', unitsPerStrip: 1, isScheduleH: false });
    useEffect(() => {
        if (isOpen) {
            if (initialData) setFormData({ name: initialData.name, company: initialData.company, hsnCode: initialData.hsnCode, gst: initialData.gst, barcode: initialData.barcode || '', composition: initialData.composition || '', unitsPerStrip: initialData.unitsPerStrip || 1, isScheduleH: initialData.isScheduleH || false });
            else setFormData({ name: '', company: '', hsnCode: '', gst: 0, barcode: '', composition: '', unitsPerStrip: 1, isScheduleH: false });
        }
    }, [isOpen, initialData]);
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onAdd({ ...formData, gst: parseFloat(formData.gst as string) || 0, unitsPerStrip: parseInt(formData.unitsPerStrip as string) || 1, ...(!initialData && { batches: [] }) }); onClose(); };
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Product' : 'Add New Product'}>
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Product Name</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputStyle} required /></div>
                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Company</label><input type="text" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} className={inputStyle} required list="comp-list"/><datalist id="comp-list">{existingCompanies.map(c => <option key={c} value={c}/>)}</datalist></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">HSN Code</label><input type="text" value={formData.hsnCode} onChange={e => setFormData({...formData, hsnCode: e.target.value})} className={inputStyle} /></div>
                    <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">GST (%)</label><select value={formData.gst} onChange={e => setFormData({...formData, gst: e.target.value})} className={inputStyle}>{gstRates.map(r => <option key={r.id} value={r.rate}>{r.rate}%</option>)}</select></div>
                </div>
                {!isPharmaMode && <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Barcode</label><input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className={inputStyle} placeholder="Leave blank for auto-generate" /></div>}
                {isPharmaMode && (
                    <><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Units per Strip</label><input type="number" value={formData.unitsPerStrip} onChange={e => setFormData({...formData, unitsPerStrip: e.target.value})} className={inputStyle} min="1" /></div><div className="flex items-center mt-6"><input type="checkbox" checked={formData.isScheduleH} onChange={e => setFormData({...formData, isScheduleH: e.target.checked})} className="mr-2 h-4 w-4 text-teal-600 focus:ring-teal-500" /><label className="text-sm font-medium text-slate-700 dark:text-slate-300">Schedule H Drug</label></div></div><div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Composition</label><input type="text" value={formData.composition} onChange={e => setFormData({...formData, composition: e.target.value})} className={inputStyle} /></div></>
                )}
                <div className="flex justify-end gap-2 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-slate-600 rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 shadow-md">Save</button></div>
            </form>
        </Modal>
    );
};

const Inventory: React.FC<InventoryProps> = ({ products, purchases = [], bills = [], systemConfig, gstRates, onAddProduct, onUpdateProduct, onDeleteProduct }) => {
    const t = getTranslation(systemConfig.language);
    const [view, setView] = useState<'products' | 'allStock' | 'selectedStock' | 'batches' | 'company' | 'expired' | 'nearExpiry'>('products');
    const [isAddProductOpen, setAddProductOpen] = useState(false);
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [printingProduct, setPrintingProduct] = useState<Product | null>(null);
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const uniqueCompanies = useMemo(() => Array.from(new Set(products.map(p => p.company))).sort(), [products]);
    const handleDeleteBatch = (pid: string, bid: string) => { const product = products.find(p => p.id === pid); if(product) { const updatedBatches = product.batches.filter(b => b.id !== bid); onUpdateProduct(pid, { batches: updatedBatches }); } };

    const handleAddProductWrapper = async (productData: any) => {
        if (!productData.barcode || productData.barcode.trim() === '') {
            let maxBarcode = 0;
            products.forEach(p => { if (p.barcode && /^\d+$/.test(p.barcode)) { const num = parseInt(p.barcode, 10); if (!isNaN(num) && num > maxBarcode && p.barcode.length <= 8) maxBarcode = num; } });
            productData.barcode = (maxBarcode + 1).toString().padStart(6, '0');
        }
        await onAddProduct(productData);
    };

    const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string; if (!text) return;
            const rows = text.split('\n').filter(row => row.trim().length > 0);
            if (rows.length < 2) { alert("CSV file seems empty or missing header."); return; }
            const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
            const barcodeIdx = headers.findIndex(h => h.includes('barcode') || h.includes('part'));
            const nameIdx = headers.findIndex(h => h.includes('name'));
            const gstIdx = headers.findIndex(h => h.includes('gst'));
            const mrpIdx = headers.findIndex(h => h.includes('mrp'));
            const saleRateIdx = headers.findIndex(h => h.includes('sale') && h.includes('rate'));
            const purchaseIdx = headers.findIndex(h => h.includes('purchase') || h.includes('rate') && !h.includes('sale') && !h.includes('mrp'));
            const companyIdx = headers.findIndex(h => h.includes('company'));
            if (nameIdx === -1) { alert("CSV must contain an 'Name' column."); return; }
            let importedCount = 0; let skippedCount = 0;
            for (let i = 1; i < rows.length; i++) {
                const cols = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                if (!cols[nameIdx]) continue;
                const barcode = barcodeIdx !== -1 ? cols[barcodeIdx] : '';
                const name = cols[nameIdx];
                const gst = gstIdx !== -1 ? parseFloat(cols[gstIdx]) || 0 : 0;
                const mrp = mrpIdx !== -1 ? parseFloat(cols[mrpIdx]) || 0 : 0;
                const saleRate = saleRateIdx !== -1 ? parseFloat(cols[saleRateIdx]) || 0 : mrp;
                const purchasePrice = purchaseIdx !== -1 ? parseFloat(cols[purchaseIdx]) || 0 : 0;
                const company = companyIdx !== -1 ? cols[companyIdx] : 'General';
                if (barcode && products.some(p => p.barcode === barcode)) { skippedCount++; continue; }
                const initialBatch: Batch = { id: `batch_import_${Date.now()}_${i}`, batchNumber: isPharmaMode ? 'IMPORT' : 'DEFAULT', expiryDate: '2099-12', stock: 0, mrp: mrp, saleRate: saleRate, purchasePrice: purchasePrice, openingStock: 0 };
                const productData: Omit<Product, 'id'> = { name, company, hsnCode: '', gst: gst, barcode, batches: [initialBatch] };
                await handleAddProductWrapper(productData); importedCount++;
            }
            alert(`Import Complete!\nSuccessfully added: ${importedCount}\nSkipped (Duplicates): ${skippedCount}`);
            setImportModalOpen(false);
        };
        reader.readAsText(file);
    };

    const downloadImportTemplate = () => {
        const headers = ["Name", "Barcode/Part No", "Company", "GST", "MRP", "Purchase Rate", "Sale Rate"];
        const example = ["Paracetamol 500mg", "1001", "Generic Pharma", "12", "15.50", "10.00", "14.00"];
        const csvContent = headers.join(',') + '\n' + example.join(',');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "product_import_template.csv"; link.click();
    };

    const tabClass = (active: boolean) => `
        px-4 py-2.5 rounded-lg font-bold transition-all duration-200 shadow-sm
        ${active 
            ? 'bg-teal-600 text-white shadow-teal-200 dark:shadow-teal-900 scale-105 ring-2 ring-teal-500 ring-offset-2 dark:ring-offset-slate-900' 
            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200'
        }
    `;

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-wrap gap-3 mb-6 bg-white dark:bg-slate-900/50 p-3 rounded-xl border dark:border-slate-800 shadow-sm">
                <button onClick={() => setView('products')} className={tabClass(view === 'products')}>Product Master</button>
                <button onClick={() => setView('allStock')} className={tabClass(view === 'allStock')}>All Item Stock</button>
                <button onClick={() => setView('selectedStock')} className={tabClass(view === 'selectedStock')}>{t.inventory.selectedStock}</button>
                {isPharmaMode && <button onClick={() => setView('batches')} className={tabClass(view === 'batches')}>{t.inventory.batchStock}</button>}
                <button onClick={() => setView('company')} className={tabClass(view === 'company')}>{t.inventory.companyStock}</button>
                {isPharmaMode && <button onClick={() => setView('expired')} className={tabClass(view === 'expired')}>{t.inventory.expiredStock}</button>}
                {isPharmaMode && <button onClick={() => setView('nearExpiry')} className={tabClass(view === 'nearExpiry')}>{t.inventory.nearExpiry}</button>}
            </div>

            {view === 'products' && (
                <div className="space-y-4">
                    <Card title={<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"><span>Product Master</span><div className="flex flex-wrap gap-2"><button onClick={() => setImportModalOpen(true)} className="bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 transition-colors"><UploadIcon className="h-4 w-4"/> Import Product List</button><button onClick={() => setAddProductOpen(true)} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 hover:bg-teal-700 transition-colors shadow-md"><PlusIcon className="h-4 w-4"/> {t.inventory.addProduct}</button></div></div>}>
                        <div className="mb-4"><input type="text" placeholder={t.inventory.searchPlaceholder} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputStyle} /></div>
                        <div className="overflow-x-auto border dark:border-slate-700 rounded-lg"><table className="w-full text-sm text-left"><thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Barcode</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">GST</th><th className="px-4 py-3 text-right">MRP</th><th className="px-4 py-3 text-right">Sale Rate</th><th className="px-4 py-3 text-right">Pur. Rate</th><th className="px-4 py-3 text-center">Actions</th></tr></thead><tbody className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">{filteredProducts.map(p => {
                            const db = p.batches?.[0] || null;
                            return (<tr key={p.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"><td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{p.name}{isPharmaMode && p.composition && <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{p.composition}</div>}</td><td className="px-4 py-3 font-mono text-xs">{p.barcode || '-'}</td><td className="px-4 py-3">{p.company}</td><td className="px-4 py-3">{p.gst}%</td><td className="px-4 py-3 text-right">₹{db ? db.mrp.toFixed(2) : '0.00'}</td><td className="px-4 py-3 text-right">₹{db ? (db.saleRate || db.mrp).toFixed(2) : '0.00'}</td><td className="px-4 py-3 text-right">₹{db ? db.purchasePrice.toFixed(2) : '0.00'}</td><td className="px-4 py-3 text-center flex justify-center gap-2"><button onClick={() => setPrintingProduct(p)} className="text-slate-400 hover:text-teal-600 p-1" title="Print Barcode"><BarcodeIcon className="h-4 w-4" /></button><button onClick={() => setEditingProduct(p)} className="text-blue-600 hover:text-blue-800 p-1"><PencilIcon className="h-4 w-4" /></button><button onClick={() => onDeleteProduct(p.id)} className="text-red-600 hover:text-red-800 p-1"><TrashIcon className="h-4 w-4" /></button></td></tr>);
                        })}</tbody></table></div>
                    </Card>
                </div>
            )}

            {view === 'allStock' && <AllItemStockView products={products} systemConfig={systemConfig} t={t} />}
            {view === 'selectedStock' && <SelectedItemStockView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} t={t} />}
            {view === 'batches' && isPharmaMode && <BatchWiseStockView products={products} onDeleteBatch={handleDeleteBatch} onUpdateProduct={onUpdateProduct} systemConfig={systemConfig} t={t} />}
            {view === 'company' && <CompanyWiseStockView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} t={t} />}
            {view === 'expired' && isPharmaMode && <ExpiredStockView products={products} onDeleteBatch={handleDeleteBatch} t={t} />}
            {view === 'nearExpiry' && isPharmaMode && <NearingExpiryStockView products={products} onDeleteBatch={handleDeleteBatch} t={t} />}

            <AddProductModal isOpen={isAddProductOpen || !!editingProduct} onClose={() => { setAddProductOpen(false); setEditingProduct(null); }} onAdd={async (data) => { if (editingProduct) await onUpdateProduct(editingProduct.id, data); else await handleAddProductWrapper(data); }} systemConfig={systemConfig} gstRates={gstRates} initialData={editingProduct || undefined} isEdit={!!editingProduct} existingCompanies={uniqueCompanies} />
            <ProductImportModal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} onImport={handleImportCsv} onDownloadTemplate={downloadImportTemplate} />
            {printingProduct && (<PrintBarcodeModal isOpen={!!printingProduct} onClose={() => setPrintingProduct(null)} product={printingProduct} />)}
        </div>
    );
};

export default Inventory;

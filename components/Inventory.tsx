
import React, { useState, useMemo, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { Product, Purchase, Bill, SystemConfig, GstRate, Batch, Company, PurchaseReturn, SaleReturn } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { DownloadIcon, TrashIcon, PlusIcon, PencilIcon, ArchiveIcon, BarcodeIcon, PrinterIcon, InformationCircleIcon, SearchIcon, XIcon, SwitchHorizontalIcon, GlobeIcon } from './icons/Icons';
import { getTranslation } from '../utils/translationHelper';

const normalizeCode = (str: string = "") => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

export type InventoryTab = 'productMaster' | 'all' | 'selected' | 'batch' | 'company' | 'expired' | 'nearExpiry';

export interface InventoryRef {
  setTab: (tab: InventoryTab) => void;
}

interface InventoryProps {
  products: Product[];
  companies: Company[];
  purchases?: Purchase[];
  bills?: Bill[];
  purchaseReturns?: PurchaseReturn[];
  saleReturns?: SaleReturn[];
  systemConfig: SystemConfig;
  gstRates: GstRate[];
  onAddProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  onUpdateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onAddCompany: (company: Omit<Company, 'id'>) => Promise<Company | null>;
  initialTab?: InventoryTab;
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
    const isNegative = stock < 0;
    const absStock = Math.abs(stock);
    
    if (absStock === 0) return '0 U';
    if (!unitsPerStrip || unitsPerStrip <= 1) return `${stock} U`;
    
    const strips = Math.floor(absStock / unitsPerStrip);
    const looseUnits = absStock % unitsPerStrip;
    
    let result = '';
    if (strips > 0) result += `${strips} S`;
    if (looseUnits > 0) result += `${strips > 0 ? ' + ' : ''}${looseUnits} U`;
    
    return isNegative ? `-${result}` : (result || '0 U');
};

const getLiveStockData = (product: Product) => {
    const total = (product.batches || []).reduce((sum, b) => sum + (b.stock || 0), 0);
    const batchStocks = new Map<string, number>();
    (product.batches || []).forEach(b => batchStocks.set(b.id, b.stock || 0));
    return { total, batchStocks };
};

const PrintLabelModal: React.FC<{ isOpen: boolean; onClose: () => void; product: Product | null; onPrint: (quantity: number) => void; }> = ({ isOpen, onClose, product, onPrint }) => {
    const [quantity, setQuantity] = useState(1);
    if (!isOpen || !product) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Print Label">
            <div className="space-y-4">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Product: <span className="font-bold">{product.name}</span></p>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Number of Labels</label>
                    <input type="number" min="1" max="100" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} className={inputStyle} />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Cancel</button>
                    <button type="button" onClick={() => { onPrint(quantity); onClose(); }} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow">Print</button>
                </div>
            </div>
        </Modal>
    );
};

const AddCompanyModal: React.FC<{ isOpen: boolean; onClose: () => void; onAdd: (name: string) => void; }> = ({ isOpen, onClose, onAdd }) => {
    const [name, setName] = useState('');
    if (!isOpen) return null;
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (name.trim()) { onAdd(name.trim()); setName(''); onClose(); } };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Company">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company Name*</label>
                    <input autoFocus value={name} onChange={e => setName(e.target.value)} className={inputStyle} required placeholder="e.g. Cipla Ltd" />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg font-bold">Cancel</button>
                    <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-black shadow-lg hover:bg-indigo-700">ADD COMPANY</button>
                </div>
            </form>
        </Modal>
    );
};

const ProductMasterView: React.FC<{ 
    products: Product[], 
    purchases: Purchase[],
    bills: Bill[],
    systemConfig: SystemConfig,
    onEdit: (p: Product) => void, 
    onDelete: (id: string) => void, 
    t: any 
}> = ({ products, purchases, bills, systemConfig, onEdit, onDelete, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [companyFilter, setCompanyFilter] = useState('All');
    const [printingProduct, setPrintingProduct] = useState<Product | null>(null);
    const isRetail = systemConfig.softwareMode === 'Retail';
    
    const companies = useMemo(() => {
        return ['All', ...new Set(products.filter(p => p !== null).map(p => p.company))].sort();
    }, [products]);

    const filtered = useMemo(() => 
        products.filter(p => p !== null && (
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.barcode && p.barcode.includes(searchTerm))
        )).filter(p => companyFilter === 'All' || p.company === companyFilter)
        .sort((a,b) => a.name.localeCompare(b.name))
    , [products, searchTerm, companyFilter]);

    const handlePrintLabels = (product: Product, quantity: number) => {
        const barcodeValue = product.barcode || '00000000';
        const mrp = product.batches[0]?.mrp?.toFixed(2) || '0.00';
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            const itemsHtml = Array(quantity).fill(0).map((_, i) => '<div class="label-container"><div class="name">' + product.name + '</div><svg id="barcode-' + i + '" class="barcode-svg"></svg><div class="price">MRP: ₹' + mrp + '</div></div>').join('');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Print Barcode - ${product.name}</title>
                        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                        <style>
                            @page { margin: 0; size: 50mm 25mm; }
                            body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: white; }
                            .label-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 25mm; width: 50mm; box-sizing: border-box; page-break-after: always; overflow: hidden; }
                            .name { font-size: 11pt; font-weight: bold; text-transform: uppercase; margin-bottom: 1px; text-align: center; width: 95%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: black; }
                            .barcode-svg { width: 90%; max-height: 40px; }
                            .price { font-size: 14pt; font-weight: 900; margin-top: 1px; text-align: center; color: black; }
                        </style>
                    </head>
                    <body>
                        ${itemsHtml}
                        <script>
                            window.onload = function() {
                                try {
                                    for (let i = 0; i < ${quantity}; i++) {
                                        JsBarcode("#barcode-" + i, "${barcodeValue}", { format: "CODE128", width: 1.8, height: 35, displayValue: true, fontSize: 10, font: "Arial", margin: 0, textMargin: 0 });
                                    }
                                    setTimeout(() => { window.print(); window.close(); }, 500);
                                } catch (e) { console.error(e); window.close(); }
                            };
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    return (
        <Card title={
            <div className="flex justify-between items-center w-full">
                <span className="text-xl font-bold">Product Master</span>
                <button onClick={() => onEdit(null as any)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all transform active:scale-95"><PlusIcon className="h-4 w-4" /> Add New Product</button>
            </div>
        }>
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                    <input type="text" placeholder="Search by Name or Barcode..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-3 bg-yellow-100 text-slate-900 placeholder-slate-500 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 shadow-inner" />
                    <SearchIcon className="absolute right-4 top-3.5 h-5 w-5 text-slate-400" />
                </div>
                <div className="relative">
                    <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 shadow-sm">
                        {companies.map(c => <option key={c} value={c}>{c === 'All' ? 'Filter by Company' : c}</option>)}
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-[#1e293b] text-slate-300 uppercase text-[11px] font-black tracking-wider">
                        <tr>
                            <th className="px-4 py-4">Name</th>
                            <th className="px-4 py-4">Company</th>
                            <th className="px-4 py-4">Barcode</th>
                            <th className="px-4 py-4 text-center">Opening Stock</th>
                            <th className="px-4 py-4 text-center">Live Stock</th>
                            {!isRetail && <th className="px-4 py-4">Composition</th>}
                            <th className="px-4 py-4 text-center">GST</th>
                            <th className="px-4 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                        {filtered.map(p => {
                            if (!p) return null;
                            const liveStock = getLiveStockData(p);
                            const isLowStock = liveStock.total <= (p.unitsPerStrip || 1);
                            return (
                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                                    <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">{p.name}{!isRetail && p.isScheduleH && <span className="ml-2 text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-black">SCH H</span>}</td>
                                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">{p.company}</td>
                                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">{p.barcode || '-'}</td>
                                    <td className="px-4 py-3.5 text-center text-slate-500">{p.openingStock || 0} U</td>
                                    <td className={`px-4 py-3.5 text-center font-black ${isLowStock ? 'text-rose-600 bg-rose-50/30' : 'text-emerald-600'}`}>{formatStock(liveStock.total, p.unitsPerStrip)}{isLowStock && <div className="text-[8px] uppercase tracking-tighter">Refill Required</div>}</td>
                                    {!isRetail && <td className="px-4 py-3.5 text-xs text-slate-500 italic">{p.composition || '-'}</td>}
                                    <td className="px-4 py-3.5 text-center font-medium text-slate-700 dark:text-slate-300">{p.gst}%</td>
                                    <td className="px-4 py-3.5">
                                        <div className="flex justify-center items-center gap-3">
                                            {isRetail && p.barcode && (<button onClick={() => setPrintingProduct(p)} className="p-1 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 transition-colors" title="Labels"><BarcodeIcon className="h-5 w-5" /></button>)}
                                            <button onClick={() => onEdit(p)} className="p-1 text-blue-500 dark:text-blue-400 hover:text-blue-700 transition-colors" title="Edit"><PencilIcon className="h-5 w-5" /></button>
                                            <button onClick={() => onDelete(p.id)} className="p-1 text-rose-500 dark:text-rose-400 hover:text-rose-700 transition-colors" title="Delete"><TrashIcon className="h-5 w-5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <PrintLabelModal isOpen={!!printingProduct} onClose={() => setPrintingProduct(null)} product={printingProduct} onPrint={(qty) => printingProduct && handlePrintLabels(printingProduct, qty)} />
        </Card>
    );
};

const CompanyWiseStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], t: any }> = ({ products, purchases, bills, t }) => {
    const [selectedCompany, setSelectedCompany] = useState('All');
    const companies = useMemo(() => ['All', ...new Set(products.filter(p => p !== null).map(p => p.company))].sort(), [products]);
    const detailedStockData = useMemo(() => {
        const rows: any[] = [];
        products.forEach(p => {
            if (!p || (selectedCompany !== 'All' && p.company !== selectedCompany)) return;
            const unitsPerStrip = p.unitsPerStrip || 1;
            (p.batches || []).forEach(b => {
                const valuation = b.stock * (b.purchasePrice / unitsPerStrip);
                rows.push({ productId: p.id, productName: p.name, company: p.company, batchNumber: b.batchNumber, expiryDate: b.expiryDate, opening: b.openingStock || 0, closing: b.stock, valuation, unitsPerStrip });
            });
        });
        return rows.sort((a, b) => a.productName.localeCompare(b.productName));
    }, [products, selectedCompany]);

    const totalPeriodValuation = useMemo(() => detailedStockData.reduce((sum, r) => sum + r.valuation, 0), [detailedStockData]);

    return (
        <Card title={
            <div className="flex justify-between items-center w-full">
                <span className="flex items-center gap-2"><GlobeIcon className="h-5 w-5 text-indigo-500" /> Company Stock Ledger</span>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-black uppercase">Net Valuation: ₹{totalPeriodValuation.toLocaleString()}</span>
            </div>
        }>
            <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
                <div className="w-full md:w-1/3"><label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Select Company</label><select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} className={inputStyle}>{companies.map(c => <option key={c} value={c}>{c === 'All' ? 'All Companies' : c}</option>)}</select></div>
                <button onClick={() => exportToCsv('company_wise_stock', detailedStockData)} className="w-full md:w-auto bg-emerald-600 text-white px-6 py-2 rounded-lg font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-md transition-all"><DownloadIcon className="h-5 w-5" /> Export Excel</button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <table className="w-full text-[13px] text-left border-collapse">
                    <thead className="bg-[#1e293b] text-slate-300 uppercase text-[11px] font-black tracking-wider">
                        <tr><th className="px-4 py-4">PRODUCT / COMPANY</th><th className="px-4 py-4">BATCH / EXPIRY</th><th className="px-4 py-4 text-center">OPENING</th><th className="px-4 py-4 text-center">CLOSING</th><th className="px-4 py-4 text-right">VALUE</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                        {detailedStockData.map((row, idx) => (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"><td className="px-4 py-3"><div className="font-bold text-slate-800 dark:text-slate-200">{row.productName}</div><div className="text-[10px] text-slate-400 uppercase">{row.company}</div></td><td className="px-4 py-3"><div className="font-mono text-slate-700 dark:text-slate-300">{row.batchNumber}</div><div className="text-[10px] text-slate-500 italic">{row.expiryDate}</div></td><td className="px-4 py-3 text-center font-medium text-slate-500">{formatStock(row.opening, row.unitsPerStrip)}</td><td className="px-4 py-3 text-center font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/40">{formatStock(row.closing, row.unitsPerStrip)}</td><td className="px-4 py-3 text-right font-black text-slate-700 dark:text-slate-300">₹{row.valuation.toFixed(2)}</td></tr>))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <td colSpan={4} className="px-4 py-4 text-right font-black text-slate-500 uppercase text-[10px]">Grand Total Valuation:</td>
                            <td className="px-4 py-4 text-right font-black text-indigo-600 text-lg">₹{totalPeriodValuation.toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </Card>
    );
};

const AllItemStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], systemConfig: SystemConfig, t: any }> = ({ products, purchases, bills, systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const stockData = useMemo(() => {
        return products.filter(p => !!p).map(p => {
            const liveStock = getLiveStockData(p);
            const unitsPerStrip = p.unitsPerStrip || 1;
            const totalValuation = (p.batches || []).reduce((sum, b) => {
                return sum + (b.stock * (b.purchasePrice / unitsPerStrip));
            }, 0);
            return { id: p.id, name: p.name, company: p.company, unitsPerStrip, totalStock: liveStock.total, totalValue: totalValuation };
        }).filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.company.toLowerCase().includes(searchTerm.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
    }, [products, searchTerm]);
    const totalValuation = useMemo(() => stockData.reduce((sum, item) => sum + item.totalValue, 0), [stockData]);
    return (
        <Card title={t.inventory.allStock}>
            <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between items-end">
                <div className="relative w-full sm:max-w-md"><input type="text" placeholder={t.inventory.searchPlaceholder} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${inputStyle}`} /><SearchIcon className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" /></div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"><div className="bg-teal-50 dark:bg-teal-900/30 px-6 py-3 rounded-xl w-full sm:w-auto text-center border border-teal-100 dark:border-teal-800 shadow-sm"><span className="text-[10px] font-black uppercase text-teal-600 dark:text-teal-400 tracking-widest block">Total Inventory Value</span><span className="text-xl font-black text-teal-900 dark:text-teal-100">₹{totalValuation.toFixed(2)}</span></div><button onClick={() => exportToCsv('all_item_stock', stockData)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-black shadow-lg hover:bg-emerald-700 transition-all transform active:scale-95 uppercase text-sm"><DownloadIcon className="h-5 w-5" /> Export Excel</button></div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><table className="w-full text-sm text-left"><thead className="bg-[#1e293b] text-slate-300 uppercase text-[11px] font-black tracking-wider border-b dark:border-slate-700"><tr><th className="px-6 py-4">Product Name</th><th className="px-6 py-4">Company</th><th className="px-6 py-4 text-center">Total Stock</th><th className="px-6 py-4 text-right">Inventory Value</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">{stockData.map(item => (<tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"><td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{item.name}</td><td className="px-6 py-4 text-slate-500 dark:text-slate-400">{item.company}</td><td className="px-6 py-4 text-center font-black text-slate-900 dark:text-white">{formatStock(item.totalStock, item.unitsPerStrip)}</td><td className="px-6 py-4 text-right font-medium text-slate-700 dark:text-slate-300">₹{item.totalValue.toFixed(2)}</td></tr>))}</tbody></table></div>
        </Card>
    );
};

const SelectedItemStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], purchaseReturns: PurchaseReturn[], saleReturns?: SaleReturn[], systemConfig: SystemConfig, t: any }> = ({ products, purchases, bills, purchaseReturns, saleReturns = [], systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
    
    const isPharma = systemConfig.softwareMode === 'Pharma';
    const selectedProduct = useMemo(() => selectedProductId ? products.find(p => p.id === selectedProductId) || null : null, [selectedProductId, products]);
    const productSuggestions = useMemo(() => searchTerm ? products.filter(p => p && p.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10) : [], [searchTerm, products]);
    
    const handleSelectProduct = (p: Product) => { setSelectedProductId(p.id); setSearchTerm(p.name); setIsSuggestionsOpen(false); };
    
    const transactions = useMemo(() => {
        if (!selectedProduct) return [];
        const txs: any[] = [];
        const unitsPerStrip = selectedProduct.unitsPerStrip || 1;
        const pBarcode = normalizeCode(selectedProduct.barcode || "");
        const pName = selectedProduct.name.toLowerCase().trim();
        const pCompany = selectedProduct.company.toLowerCase().trim();

        selectedProduct.batches?.forEach(b => {
            if (b.openingStock && b.openingStock > 0) {
                txs.push({
                    id: `opening_${b.id}`,
                    date: new Date(0), 
                    type: 'OPENING',
                    particulars: `Opening Stock (Batch: ${b.batchNumber})`,
                    batch: b.batchNumber,
                    inQty: b.openingStock,
                    outQty: 0
                });
            }
        });

        purchases?.forEach(pur => pur.items.forEach(item => {
            const iBarcode = normalizeCode(item.barcode || "");
            const isMatch = item.productId === selectedProduct.id || 
                           (pBarcode !== "" && iBarcode === pBarcode) ||
                           (pBarcode === "" && iBarcode === "" && item.productName.toLowerCase().trim() === pName && item.company.toLowerCase().trim() === pCompany);
            
            if (isMatch) {
                txs.push({ 
                    id: `pur_${pur.id}_${Math.random()}`,
                    date: new Date(pur.invoiceDate), 
                    type: 'PURCHASE', 
                    particulars: `Inv: ${pur.invoiceNumber} (${pur.supplier})`, 
                    batch: item.batchNumber,
                    inQty: item.quantity * (item.unitsPerStrip || unitsPerStrip), 
                    outQty: 0 
                });
            }
        }));

        bills?.forEach(bill => bill.items.forEach(item => {
             if (item.productId === selectedProduct.id) {
                 txs.push({
                     id: `bill_${bill.id}_${Math.random()}`,
                     date: new Date(bill.date),
                     type: 'SALE',
                     particulars: `Bill: ${bill.billNumber} (${bill.customerName})`,
                     batch: item.batchNumber,
                     inQty: 0,
                     outQty: item.quantity
                 });
             }
        }));

        purchaseReturns?.forEach(ret => ret.items.forEach(item => {
            if (item.productId === selectedProduct.id) {
                const returnUnits = item.quantity * (item.unitsPerStrip || unitsPerStrip);
                txs.push({
                    id: `pret_${ret.id}_${Math.random()}`,
                    date: new Date(ret.date),
                    type: 'P.RETURN',
                    particulars: `Return: ${ret.returnNumber} (${ret.supplier})`,
                    batch: item.batchNumber,
                    inQty: 0,
                    outQty: returnUnits
                });
            }
        }));

        saleReturns?.forEach(sr => sr.items.forEach(item => {
            if (item.productId === selectedProduct.id) {
                txs.push({
                    id: `sret_${sr.id}_${Math.random()}`,
                    date: new Date(sr.date),
                    type: 'S.RETURN',
                    particulars: `Return: ${sr.returnNumber} (${sr.customerName})`,
                    batch: item.batchNumber,
                    inQty: item.quantity,
                    outQty: 0
                });
            }
        }));

        return txs.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [selectedProduct, purchases, bills, purchaseReturns, saleReturns]);

    const filteredResults = useMemo(() => {
        if (!selectedProduct) return { opening: 0, rows: [], closing: 0 };

        let opening = (selectedProduct.openingStock || 0);
        const start = fromDate ? new Date(fromDate) : null; if (start) start.setHours(0,0,0,0);
        const end = toDate ? new Date(toDate) : new Date(); end.setHours(23,59,59,999);
        
        if (start) {
            transactions.forEach(tx => { 
                if (tx.date < start) opening += (tx.inQty - tx.outQty); 
            });
        }

        let running = opening;
        const rows = transactions.filter(tx => (!start || tx.date >= start || tx.type === 'OPENING') && tx.date <= end).map(tx => { 
            running += (tx.inQty - tx.outQty); 
            return { ...tx, balance: running }; 
        });

        return { opening, rows, closing: running };
    }, [transactions, fromDate, toDate, selectedProduct]);

    const getTypeBadgeClass = (type: string) => {
        switch (type) {
            case 'OPENING': return 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';
            case 'PURCHASE': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
            case 'SALE': return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
            case 'P.RETURN': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
            case 'S.RETURN': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
        }
    };

    return (
        <div className="space-y-6">
            <Card title="Stock Ledger (Cardex)">
                <div className="mb-6 relative">
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Select Product to Audit</label>
                    <div className="relative">
                        <input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedProductId(null); setIsSuggestionsOpen(true); }} onFocus={() => setIsSuggestionsOpen(true)} className={`${inputStyle} h-12 text-lg`} placeholder="Start typing name..." />
                        <SearchIcon className="absolute right-4 top-3 h-6 w-6 text-slate-400" />
                    </div>
                    {isSuggestionsOpen && productSuggestions.length > 0 && (
                        <ul className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                            {productSuggestions.map(p => (
                                <li key={p.id} onClick={() => handleSelectProduct(p)} className="px-4 py-3 hover:bg-indigo-50 dark:hover:bg-slate-700 cursor-pointer text-slate-800 dark:text-slate-200 border-b last:border-b-0 dark:border-slate-700 transition-colors">
                                    <div className="font-bold">{p.name}</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">{p.company} | Units: 1*{p.unitsPerStrip || 1}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {selectedProduct && (
                    <div className="animate-fade-in space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4 items-end bg-[#1e293b]/40 p-4 rounded-xl border border-slate-700/50">
                            <div className="flex-grow">
                                <h2 className="text-xl font-black text-slate-100 uppercase tracking-tight">{selectedProduct.name}</h2>
                                <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">{selectedProduct.company}</p>
                            </div>
                            <div className="flex gap-4">
                                <div><label className="block text-[9px] font-black uppercase text-slate-500 mb-1">From Date</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-white" /></div>
                                <div><label className="block text-[9px] font-black uppercase text-slate-500 mb-1">To Date</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-white" /></div>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-2xl bg-[#0f172a]">
                            <table className="w-full text-[13px] text-left border-collapse">
                                <thead className="bg-[#1e293b] text-slate-400 uppercase text-[10px] font-black tracking-widest border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Particulars</th>
                                        <th className="px-6 py-4 text-center">IN (Qty)</th>
                                        <th className="px-6 py-4 text-center">OUT (Qty)</th>
                                        <th className="px-6 py-4 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 text-slate-300">
                                    <tr className="bg-slate-900/50 border-b border-slate-800">
                                        <td colSpan={5} className="px-6 py-4 text-right">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Opening Balance (Master):</span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-white text-base">
                                            {formatStock(filteredResults.opening, selectedProduct.unitsPerStrip)}
                                        </td>
                                    </tr>

                                    {filteredResults.rows.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                                {row.type === 'OPENING' ? 'Starting' : new Date(row.date).toLocaleDateString('en-IN')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black tracking-widest ${getTypeBadgeClass(row.type)}`}>
                                                    {row.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-300">{row.particulars}</div>
                                                {isPharma && row.batch && <div className="text-[9px] text-slate-600 font-mono mt-0.5">BATCH: {row.batch}</div>}
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-emerald-400">
                                                {row.inQty > 0 ? row.inQty : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-rose-400">
                                                {row.outQty > 0 ? row.outQty : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-white bg-slate-900/30">
                                                {formatStock(row.balance, selectedProduct.unitsPerStrip)}
                                            </td>
                                        </tr>
                                    ))}
                                    
                                    {filteredResults.rows.length === 0 && (
                                        <tr><td colSpan={6} className="text-center py-20 text-slate-600 font-bold uppercase tracking-tighter">No transaction history for selected period</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

const ExpiredStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], t: any }> = ({ products, purchases, bills, t }) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const expiredBatches = useMemo(() => products.filter(p => !!p).flatMap(p => { return (p.batches || []).map(b => ({ ...b, product: p })); }).filter(item => item && getExpiryDate(item.expiryDate) < today && item.stock > 0), [products]);
    return (
        <Card title="Expired Stock (Loss Analysis)">
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><table className="w-full text-sm text-left"><thead className="bg-[#1e293b] text-slate-300 uppercase text-[11px] font-black tracking-wider border-b dark:border-slate-700"><tr><th className="px-6 py-4">Product Name</th><th className="px-6 py-4">Batch No</th><th className="px-6 py-4">Expired On</th><th className="px-4 py-4 text-right">MRP</th><th className="px-6 py-4 text-center">Remaining Stock</th><th className="px-6 py-4 text-right">Loss Value</th></tr></thead><tbody className="bg-white dark:bg-slate-800">{expiredBatches.map((item, idx) => (<tr key={idx} className="border-b border-rose-100 dark:border-rose-900/20 bg-rose-50/20 dark:bg-rose-900/10 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"><td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{item.product.name}</td><td className="px-6 py-4 font-mono text-xs">{item.batchNumber}</td><td className="px-6 py-4 text-rose-600 dark:text-rose-400 font-black">{item.expiryDate}</td><td className="px-4 py-4 text-right font-medium">₹{item.mrp.toFixed(2)}</td><td className="px-6 py-4 text-center font-bold">{formatStock(item.stock, item.product.unitsPerStrip)}</td><td className="px-6 py-4 text-right font-black text-rose-600 dark:text-rose-400">₹{(item.stock * (item.purchasePrice / (item.product.unitsPerStrip || 1))).toFixed(2)}</td></tr>))}</tbody></table></div>
        </Card>
    );
};

const NearExpiryView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], t: any }> = ({ products, purchases, bills, t }) => {
    const today = new Date(); today.setHours(0,0,0,0); const thirtyDaysLater = new Date(); thirtyDaysLater.setDate(today.getDate() + 30);
    const nearExpiryBatches = useMemo(() => products.filter(p => !!p).flatMap(p => { return (p.batches || []).map(b => ({ ...b, product: p })); }).filter(item => { if (!item) return false; const exp = getExpiryDate(item.expiryDate); return exp >= today && exp <= thirtyDaysLater && item.stock > 0; }), [products]);
    return (
        <Card title="Expiring in Next 30 Days">
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><table className="w-full text-sm text-left"><thead className="bg-[#1e293b] text-slate-300 uppercase text-[11px] font-black tracking-wider border-b dark:border-slate-700"><tr><th className="px-6 py-4">Product Name</th><th className="px-6 py-4">Batch No</th><th className="px-6 py-4">Expiry Date</th><th className="px-4 py-4 text-right">MRP</th><th className="px-6 py-4 text-center">In Stock</th><th className="px-6 py-4 text-right">Stock Valuation</th></tr></thead><tbody className="bg-white dark:bg-slate-800">{nearExpiryBatches.map((item, idx) => (<tr key={idx} className="border-b border-orange-100 dark:border-orange-900/20 bg-orange-50/20 dark:bg-orange-900/10 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"><td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{item.product.name}</td><td className="px-6 py-4 font-mono text-xs">{item.batchNumber}</td><td className="px-6 py-4 text-orange-600 dark:text-orange-400 font-black">{item.expiryDate}</td><td className="px-4 py-4 text-right font-medium">₹{item.mrp.toFixed(2)}</td><td className="px-6 py-4 text-center font-bold">{formatStock(item.stock, item.product.unitsPerStrip)}</td><td className="px-6 py-4 text-right font-black text-slate-700 dark:text-slate-300">₹{(item.stock * (item.purchasePrice / (item.product.unitsPerStrip || 1))).toFixed(2)}</td></tr>))}</tbody></table></div>
        </Card>
    );
};

const EditBatchModal: React.FC<{ isOpen: boolean; onClose: () => void; product: Product; batch: Batch; onSave: (pid: string, updatedBatch: Batch) => void; }> = ({ isOpen, onClose, product, batch, onSave }) => {
    const [formData, setFormData] = useState<Batch>({ ...batch }); useEffect(() => { setFormData({ ...batch }); }, [batch, isOpen]);
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(product.id, formData); onClose(); }; if (!isOpen || !product) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Batch Details">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border dark:border-slate-700"><label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Product</label><p className="font-bold text-indigo-600 dark:text-indigo-400">{product.name || 'N/A'}</p></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Batch No</label><input name="batchNumber" value={formData.batchNumber} onChange={e => setFormData({...formData, batchNumber: e.target.value})} className={inputStyle} required /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expiry (YYYY-MM)</label><input name="expiryDate" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} className={inputStyle} placeholder="YYYY-MM" required /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">MRP</label><input type="number" name="mrp" step="0.01" value={formData.mrp} onChange={e => setFormData({...formData, mrp: parseFloat(e.target.value) || 0})} className={inputStyle} required /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sale Rate</label><input type="number" name="saleRate" step="0.01" value={formData.saleRate || formData.mrp} onChange={e => setFormData({...formData, saleRate: parseFloat(e.target.value) || 0})} className={inputStyle} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Purchase Price</label><input type="number" name="purchasePrice" step="0.01" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: parseFloat(e.target.value) || 0})} className={inputStyle} required /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Current Stock (U)</label><input type="number" name="stock" value={formData.stock || 0} onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})} className={inputStyle} required /></div>
                    <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Opening Stock (U)</label><input type="number" name="openingStock" value={formData.openingStock || 0} onChange={e => setFormData({...formData, openingStock: parseInt(e.target.value) || 0})} className={inputStyle} /></div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700"><button type="button" onClick={onClose} className="px-5 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold hover:bg-slate-300">Cancel</button><button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-black shadow-lg hover:bg-indigo-700 transform active:scale-95 transition-all">SAVE CHANGES</button></div>
            </form>
        </Modal>
    );
};

const AddBatchModal: React.FC<{ isOpen: boolean; onClose: () => void; products: Product[]; onSave: (pid: string, newBatch: Batch) => void; }> = ({ isOpen, onClose, products, onSave }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [formData, setFormData] = useState({ batchNumber: '', expiryDate: '', mrp: 0, saleRate: 0, purchasePrice: 0, stock: 0, openingStock: 0 });
    
    const productSuggestions = useMemo(() => {
        if (!searchTerm || selectedProduct) return [];
        return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 5);
    }, [searchTerm, products, selectedProduct]);

    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        if (!selectedProduct) { alert("Please select a product first."); return; } 
        onSave(selectedProduct.id, { ...formData, id: `batch_${Date.now()}` }); 
        reset(); 
        onClose(); 
    };

    const reset = () => { 
        setSearchTerm(''); 
        setSelectedProduct(null); 
        setActiveIndex(-1);
        setFormData({ batchNumber: '', expiryDate: '', mrp: 0, saleRate: 0, purchasePrice: 0, stock: 0, openingStock: 0 }); 
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (productSuggestions.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev < productSuggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            if (activeIndex >= 0) {
                e.preventDefault();
                const p = productSuggestions[activeIndex];
                setSelectedProduct(p);
                setSearchTerm(p.name);
                setIsSuggestionsOpen(false);
            }
        } else if (e.key === 'Escape') {
            setIsSuggestionsOpen(false);
            setActiveIndex(-1);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Initialize Manual Batch">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Select Product*</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            mask-pattern=".*"
                            value={searchTerm} 
                            onChange={e => { setSearchTerm(e.target.value); setSelectedProduct(null); setIsSuggestionsOpen(true); setActiveIndex(-1); }}
                            onFocus={() => setIsSuggestionsOpen(true)}
                            onKeyDown={handleKeyDown}
                            className={inputStyle}
                            placeholder="Type to search product..."
                            autoComplete="off"
                            required
                        />
                        <SearchIcon className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                    </div>
                    {isSuggestionsOpen && productSuggestions.length > 0 && (
                        <ul className="absolute z-[100] w-full mt-1 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                            {productSuggestions.map((p, idx) => (
                                <li 
                                    key={p.id} 
                                    onClick={() => { setSelectedProduct(p); setSearchTerm(p.name); setIsSuggestionsOpen(false); }}
                                    className={`px-4 py-3 cursor-pointer text-slate-800 dark:text-slate-200 border-b last:border-b-0 dark:border-slate-600 transition-colors ${idx === activeIndex ? 'bg-indigo-100 dark:bg-indigo-900 border-l-4 border-indigo-600' : 'hover:bg-indigo-50 dark:hover:bg-slate-600'}`}
                                >
                                    <div className="font-bold">{p.name}</div>
                                    <div className="text-[10px] text-slate-500 uppercase">{p.company}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {selectedProduct && (
                    <div className="animate-fade-in space-y-4 pt-2">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
                             <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1">Target Product</span>
                             <span className="font-bold text-slate-800 dark:text-white">{selectedProduct.name} ({selectedProduct.company})</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Batch No*</label><input value={formData.batchNumber} onChange={e => setFormData({...formData, batchNumber: e.target.value})} className={inputStyle} required /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expiry (YYYY-MM)*</label><input value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} className={inputStyle} placeholder="YYYY-MM" required /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">MRP*</label><input type="number" step="0.01" value={formData.mrp || ''} onChange={e => setFormData({...formData, mrp: parseFloat(e.target.value) || 0, saleRate: formData.saleRate || parseFloat(e.target.value) || 0})} className={inputStyle} required /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Purchase Price</label><input type="number" step="0.01" value={formData.purchasePrice || ''} onChange={e => setFormData({...formData, purchasePrice: parseFloat(e.target.value) || 0})} className={inputStyle} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Opening Stock (U)</label><input type="number" value={formData.openingStock || ''} onChange={e => setFormData({...formData, openingStock: parseInt(e.target.value) || 0, stock: parseInt(e.target.value) || 0})} className={inputStyle} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Current Stock (U)*</label><input type="number" value={formData.stock || ''} onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})} className={inputStyle} required /></div>
                        </div>
                    </div>
                )}
                
                <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                    <button type="button" onClick={onClose} className="px-5 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold hover:bg-slate-300">Cancel</button>
                    <button type="submit" disabled={!selectedProduct} className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-black shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">ADD BATCH</button>
                </div>
            </form>
        </Modal>
    );
};

const BatchWiseStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], onDeleteBatch: (pid: string, bid: string) => void, onUpdateProduct: (id: string, product: Partial<Product>) => Promise<void>, systemConfig: SystemConfig, t: any }> = ({ products, purchases, bills, onDeleteBatch, onUpdateProduct, systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState(''); 
    const [editingBatchData, setEditingBatchData] = useState<{ product: Product, batch: Batch } | null>(null);
    const [isAddBatchModalOpen, setIsAddBatchModalOpen] = useState(false);
    
    const allBatches = useMemo(() => products.filter(p => !!p).flatMap(p => { return (p.batches || []).map(b => ({ ...b, product: p })); }).filter(item => { const term = searchTerm.toLowerCase(); return item.product.name.toLowerCase().includes(term) || item.batchNumber.toLowerCase().includes(term); }), [products, searchTerm]);
    
    const handleUpdateBatch = (pid: string, updatedBatch: Batch) => { 
        const product = products.find(p => p.id === pid); 
        if (product) { 
            const updatedBatches = (product.batches || []).map(b => b.id === updatedBatch.id ? updatedBatch : b); 
            onUpdateProduct(pid, { batches: updatedBatches }); 
        } 
    };

    const handleAddBatch = (pid: string, newBatch: Batch) => {
        const product = products.find(p => p.id === pid);
        if (product) {
            onUpdateProduct(pid, { batches: [...(product.batches || []), newBatch] });
        }
    };

    return (
        <Card title={
            <div className="flex justify-between items-center w-full">
                <span>{t.inventory.batchStock}</span>
                <button onClick={() => setIsAddBatchModalOpen(true)} className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-200 transition-all border border-indigo-200 dark:border-indigo-800"><PlusIcon className="h-4 w-4" /> Manual Batch Entry</button>
            </div>
        }>
            <div className="mb-6 relative"><input type="text" placeholder="Search product or batch number..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputStyle} /><SearchIcon className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" /></div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><table className="w-full text-sm text-left"><thead className="bg-[#1e293b] text-slate-300 uppercase text-[11px] font-black tracking-wider border-b dark:border-slate-700"><tr><th className="px-6 py-4">Product Name</th><th className="px-6 py-4">Batch No</th><th className="px-6 py-4">Expiry Date</th><th className="px-4 py-4 text-right">MRP</th><th className="px-6 py-4 text-center">Live Stock</th><th className="px-6 py-4 text-center">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">{allBatches.map((item, idx) => (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"><td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{item.product.name}</td><td className="px-6 py-4 font-mono text-xs text-slate-500">{item.batchNumber}</td><td className="px-6 py-4 text-slate-600 dark:text-slate-400">{item.expiryDate}</td><td className="px-4 py-4 text-right font-medium">₹{item.mrp.toFixed(2)}</td><td className="px-6 py-4 text-center font-black text-slate-900 dark:text-white">{formatStock(item.stock, item.product.unitsPerStrip)}</td><td className="px-6 py-4 text-center"><div className="flex justify-center gap-3"><button onClick={() => setEditingBatchData({ product: item.product, batch: item })} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Edit Batch"><PencilIcon className="h-5 w-5" /></button><button onClick={() => onDeleteBatch(item.product.id, item.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Delete Batch"><TrashIcon className="h-5 w-5" /></button></div></td></tr>))}</tbody></table></div>
            {editingBatchData && <EditBatchModal isOpen={!!editingBatchData} onClose={() => setEditingBatchData(null)} product={editingBatchData.product} batch={editingBatchData.batch} onSave={handleUpdateBatch} />}
            <AddBatchModal isOpen={isAddBatchModalOpen} onClose={() => setIsAddBatchModalOpen(false)} products={products} onSave={handleAddBatch} />
        </Card>
    );
};

const AddEditProductModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    product?: Product | null;
    products: Product[];
    companies: Company[];
    gstRates: GstRate[];
    onSave: (p: Omit<Product, 'id'>) => void;
    onUpdate: (id: string, p: Partial<Product>) => void;
    onAddCompany: (company: Omit<Company, 'id'>) => Promise<Company | null>;
    systemConfig: SystemConfig;
}> = ({ isOpen, onClose, product, products, companies, gstRates, onSave, onUpdate, onAddCompany, systemConfig }) => {
    const isRetail = systemConfig.softwareMode === 'Retail';
    const initialFormState = {
        name: '',
        company: '',
        hsnCode: '',
        gst: 12,
        barcode: '',
        openingStock: 0,
        composition: '',
        unitsPerStrip: 1,
        isScheduleH: false,
    };
    const [formData, setFormData] = useState(initialFormState);
    const [isAddingCompany, setIsAddingCompany] = useState(false);

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name,
                company: product.company,
                hsnCode: product.hsnCode,
                gst: product.gst,
                barcode: product.barcode || '',
                openingStock: product.openingStock || 0,
                composition: product.composition || '',
                unitsPerStrip: product.unitsPerStrip || 1,
                isScheduleH: !!product.isScheduleH,
            });
        } else {
            setFormData(initialFormState);
        }
    }, [product, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (product) {
            onUpdate(product.id, formData);
        } else {
            onSave({ ...formData, batches: [] });
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={product ? 'Edit Product Master' : 'Add New Product Master'} maxWidth="max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product Name*</label>
                        <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputStyle} required />
                    </div>
                    <div>
                        <div className="flex justify-between items-end mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Company*</label>
                            <button type="button" onClick={() => setIsAddingCompany(true)} className="text-[10px] text-indigo-600 font-bold hover:underline">+ NEW COMPANY</button>
                        </div>
                        <select value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} className={inputStyle} required>
                            <option value="">-- Select Company --</option>
                            {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">HSN Code</label>
                        <input value={formData.hsnCode} onChange={e => setFormData({ ...formData, hsnCode: e.target.value })} className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">GST Rate (%)</label>
                        <select value={formData.gst} onChange={e => setFormData({ ...formData, gst: parseFloat(e.target.value) })} className={inputStyle}>
                            {gstRates.map(r => <option key={r.id} value={r.rate}>{r.rate}%</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Barcode / SKU (Optional)</label>
                        <input value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} className={inputStyle} placeholder="Auto-gen if left blank" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Opening Stock (U)</label>
                        <input type="number" value={formData.openingStock} onChange={e => setFormData({ ...formData, openingStock: parseInt(e.target.value) || 0 })} className={inputStyle} />
                    </div>
                    {!isRetail && (
                        <>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Composition</label>
                                <input value={formData.composition} onChange={e => setFormData({ ...formData, composition: e.target.value })} className={inputStyle} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Units per Pack</label>
                                <input type="number" value={formData.unitsPerStrip} onChange={e => setFormData({ ...formData, unitsPerStrip: parseInt(e.target.value) || 1 })} className={inputStyle} />
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                                <input type="checkbox" id="isScheduleH" checked={formData.isScheduleH} onChange={e => setFormData({ ...formData, isScheduleH: e.target.checked })} className="h-4 w-4 text-indigo-600 rounded" />
                                <label htmlFor="isScheduleH" className="text-xs font-bold text-slate-500 uppercase">Is Schedule H?</label>
                            </div>
                        </>
                    )}
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                    <button type="button" onClick={onClose} className="px-5 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold">Cancel</button>
                    <button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-black shadow-lg hover:bg-indigo-700 transform active:scale-95 transition-all">SAVE PRODUCT</button>
                </div>
            </form>
            <AddCompanyModal isOpen={isAddingCompany} onClose={() => setIsAddingCompany(false)} onAdd={(name) => onAddCompany({ name })} />
        </Modal>
    );
};

const Inventory = forwardRef<InventoryRef, InventoryProps>(({ products, companies, purchases = [], bills = [], purchaseReturns = [], saleReturns = [], systemConfig, gstRates, onAddProduct, onUpdateProduct, onDeleteProduct, onAddCompany, initialTab = 'company' }, ref) => {
    const [activeTab, setActiveTab] = useState<InventoryTab>(initialTab);
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const t = getTranslation(systemConfig.language);

    useImperativeHandle(ref, () => ({
        setTab: (tab: InventoryTab) => setActiveTab(tab)
    }));

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    const handleEditProduct = (product: Product) => {
        setEditingProduct(product);
        setIsAddEditModalOpen(true);
    };

    const handleDeleteBatch = async (pid: string, bid: string) => {
        const product = products.find(p => p.id === pid);
        if (product && window.confirm("Delete this batch?")) {
            const updatedBatches = (product.batches || []).filter(b => b.id !== bid);
            await onUpdateProduct(pid, { batches: updatedBatches });
        }
    };

    const TabButton: React.FC<{ id: InventoryTab, label: string, icon: React.ReactNode }> = ({ id, label, icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold whitespace-nowrap transition-all border-b-2 ${activeTab === id
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20'
                    : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
        >
            {icon}
            {label}
        </button>
    );

    const tabs: { id: InventoryTab; label: string; icon: React.ReactNode }[] = [
        { id: 'company', label: t.inventory.companyStock, icon: <PrinterIcon className="h-4 w-4" /> },
        { id: 'all', label: t.inventory.allStock, icon: <ArchiveIcon className="h-4 w-4" /> },
        { id: 'selected', label: t.inventory.selectedStock, icon: <SearchIcon className="h-4 w-4" /> },
        { id: 'batch', label: t.inventory.batchStock, icon: <BarcodeIcon className="h-4 w-4" /> },
        { id: 'productMaster', label: 'Product Master', icon: <PlusIcon className="h-4 w-4" /> },
        { id: 'expired', label: t.inventory.expiredStock, icon: <TrashIcon className="h-4 w-4" /> },
        { id: 'nearExpiry', label: t.inventory.nearExpiry, icon: <InformationCircleIcon className="h-4 w-4" /> },
    ];

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border dark:border-slate-700 overflow-hidden">
                <div className="flex border-b dark:border-slate-700 overflow-x-auto no-scrollbar">
                    {tabs.map(tab => (
                        <TabButton key={tab.id} id={tab.id} label={tab.label} icon={tab.icon} />
                    ))}
                </div>
            </div>

            <div className="animate-fade-in">
                {activeTab === 'productMaster' && <ProductMasterView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} onEdit={handleEditProduct} onDelete={onDeleteProduct} t={t} />}
                {activeTab === 'all' && <AllItemStockView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} t={t} />}
                {activeTab === 'selected' && <SelectedItemStockView products={products} purchases={purchases} bills={bills} purchaseReturns={purchaseReturns} saleReturns={saleReturns} systemConfig={systemConfig} t={t} />}
                {activeTab === 'batch' && <BatchWiseStockView products={products} purchases={purchases} bills={bills} onDeleteBatch={handleDeleteBatch} onUpdateProduct={onUpdateProduct} systemConfig={systemConfig} t={t} />}
                {activeTab === 'company' && <CompanyWiseStockView products={products} purchases={purchases} bills={bills} t={t} />}
                {activeTab === 'expired' && <ExpiredStockView products={products} purchases={purchases} bills={bills} t={t} />}
                {activeTab === 'nearExpiry' && <NearExpiryView products={products} purchases={purchases} bills={bills} t={t} />}
            </div>

            <AddEditProductModal
                isOpen={isAddEditModalOpen}
                onClose={() => setIsAddEditModalOpen(false)}
                product={editingProduct}
                products={products}
                companies={companies}
                gstRates={gstRates}
                onSave={onAddProduct}
                onUpdate={onUpdateProduct}
                onAddCompany={onAddCompany}
                systemConfig={systemConfig}
            />
        </div>
    );
});

export default Inventory;

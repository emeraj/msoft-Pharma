
import React, { useState, useMemo, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { Product, Purchase, Bill, SystemConfig, GstRate, Batch, Company } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { DownloadIcon, TrashIcon, PlusIcon, PencilIcon, UploadIcon, ArchiveIcon, BarcodeIcon, PrinterIcon, InformationCircleIcon, CheckCircleIcon, SearchIcon, XIcon, CameraIcon } from './icons/Icons';
import { getTranslation } from '../utils/translationHelper';
import BarcodeScannerModal from './BarcodeScannerModal';

const normalizeCode = (str: string = "") => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

type InventoryTab = 'productMaster' | 'all' | 'selected' | 'batch' | 'company' | 'expired' | 'nearExpiry';

interface InventoryProps {
  products: Product[];
  companies: Company[];
  purchases?: Purchase[];
  bills?: Bill[];
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
    
    return isNegative ? `-${result}` : result;
};

const getLiveStockData = (product: Product, purchases: Purchase[], bills: Bill[]) => {
    const unitsPerStrip = product.unitsPerStrip || 1;
    let totalIn = (product.openingStock || 0);
    let totalOut = 0;
    const batchStockMap = new Map<string, number>();
    const pName = product.name.toLowerCase().trim();
    const pCompany = product.company.toLowerCase().trim();
    const pBarcode = normalizeCode(product.barcode);

    (product.batches || []).forEach(b => {
        let initialBatchStock = b.openingStock || 0;
        if (b.batchNumber === 'OPENING' || (b.batchNumber === 'DEFAULT' && (product.batches || []).length === 1)) {
            initialBatchStock += (product.openingStock || 0);
        }
        batchStockMap.set(b.id, initialBatchStock);
        if (b.openingStock) totalIn += b.openingStock;
    });

    purchases.forEach(pur => {
        pur.items.forEach(item => {
            const iBarcode = normalizeCode(item.barcode);
            const iName = item.productName.toLowerCase().trim();
            const iCompany = item.company.toLowerCase().trim();
            const isMatch = item.productId === product.id || (pBarcode !== "" && iBarcode === pBarcode) || (pBarcode === "" && iBarcode === "" && iName === pName && iCompany === pCompany);
            if (isMatch) {
                const qtyUnits = item.quantity * unitsPerStrip;
                totalIn += qtyUnits;
                const targetBatch = product.batches.find(b => b.batchNumber === item.batchNumber && Math.abs(b.mrp - item.mrp) < 0.1) || product.batches.find(b => Math.abs(b.mrp - item.mrp) < 0.1);
                if (targetBatch) batchStockMap.set(targetBatch.id, (batchStockMap.get(targetBatch.id) || 0) + qtyUnits);
                else if (product.batches.length > 0) batchStockMap.set(product.batches[0].id, (batchStockMap.get(product.batches[0].id) || 0) + qtyUnits);
            }
        });
    });

    bills.forEach(bill => {
        bill.items.forEach(item => {
            const iBarcode = normalizeCode(item.barcode || "");
            const isMatch = item.productId === product.id || (pBarcode !== "" && iBarcode === pBarcode);
            if (isMatch) {
                totalOut += item.quantity;
                if (batchStockMap.has(item.batchId)) batchStockMap.set(item.batchId, (batchStockMap.get(item.batchId) || 0) - item.quantity);
                else if (product.batches.length > 0) {
                    const matchedBatch = product.batches.find(b => b.batchNumber === item.batchNumber);
                    const fallbackId = matchedBatch ? matchedBatch.id : product.batches[0].id;
                    batchStockMap.set(fallbackId, (batchStockMap.get(fallbackId) || 0) - item.quantity);
                }
            }
        });
    });

    return { total: totalIn - totalOut, totalIn, totalOut, batchStocks: batchStockMap };
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
                            const liveStock = getLiveStockData(p, purchases, bills);
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
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const companies = useMemo(() => ['All', ...new Set(products.filter(p => p !== null).map(p => p.company))].sort(), [products]);
    const detailedStockData = useMemo(() => {
        const start = fromDate ? new Date(fromDate) : null; if (start) start.setHours(0, 0, 0, 0);
        const end = toDate ? new Date(toDate) : new Date(); end.setHours(23, 59, 59, 999);
        const rows: any[] = [];
        products.forEach(p => {
            if (!p || (selectedCompany !== 'All' && p.company !== selectedCompany)) return;
            const unitsPerStrip = p.unitsPerStrip || 1;
            const pBarcode = normalizeCode(p.barcode);
            const batchMap = new Map<string, { batchNumber: string; expiryDate: string; opening: number; purchased: number; sold: number; purchasePrice: number; batchIds: Set<string>; }>();
            (p.batches || []).forEach(b => {
                const existing = batchMap.get(b.batchNumber) || { batchNumber: b.batchNumber, expiryDate: b.expiryDate, opening: 0, purchased: 0, sold: 0, purchasePrice: b.purchasePrice, batchIds: new Set<string>() };
                existing.batchIds.add(b.id);
                existing.opening += (b.openingStock || 0);
                batchMap.set(b.batchNumber, existing);
            });
            const baseOpening = p.openingStock || 0;
            batchMap.forEach((agg, bName) => {
                let transOpening = 0, purchased = 0, sold = 0;
                purchases.forEach(pur => {
                    const purDate = new Date(pur.invoiceDate);
                    pur.items.forEach(item => {
                        const iBarcode = normalizeCode(item.barcode);
                        const isMatch = item.productId === p.id || (pBarcode !== "" && iBarcode === pBarcode) || (pBarcode === "" && iBarcode === "" && item.productName.toLowerCase().trim() === p.name.toLowerCase().trim() && item.company.toLowerCase().trim() === p.company.toLowerCase().trim());
                        if (!isMatch || item.batchNumber !== bName) return;
                        const qtyInUnits = item.quantity * unitsPerStrip;
                        if (purDate < (start || new Date(0))) transOpening += qtyInUnits;
                        else if (purDate <= end) purchased += qtyInUnits;
                    });
                });
                bills.forEach(bill => {
                    const billDate = new Date(bill.date);
                    bill.items.forEach(item => {
                        const iBarcode = normalizeCode(item.barcode);
                        const isMatch = item.productId === p.id || (pBarcode !== "" && iBarcode === pBarcode);
                        if (!isMatch || !agg.batchIds.has(item.batchId)) return;
                        if (billDate < (start || new Date(0))) transOpening -= item.quantity;
                        else if (billDate <= end) sold += item.quantity;
                    });
                });
                const totalOpening = agg.opening + transOpening + (bName === 'OPENING' || (bName === 'DEFAULT' && batchMap.size === 1) ? baseOpening : 0);
                const closing = totalOpening + purchased - sold;
                const valuation = closing * (agg.purchasePrice / unitsPerStrip);
                if (purchased !== 0 || sold !== 0 || closing !== 0 || totalOpening !== 0) {
                    rows.push({ productId: p.id, productName: p.name, company: p.company, batchNumber: agg.batchNumber, expiryDate: agg.expiryDate, opening: totalOpening, purchased, sold, closing, valuation, unitsPerStrip });
                }
            });
            if (batchMap.size === 0 && baseOpening > 0) rows.push({ productId: p.id, productName: p.name, company: p.company, batchNumber: 'OPENING', expiryDate: '-', opening: baseOpening, purchased: 0, sold: 0, closing: baseOpening, valuation: 0, unitsPerStrip });
        });
        return rows.sort((a, b) => a.productName.localeCompare(b.productName));
    }, [products, purchases, bills, fromDate, toDate, selectedCompany]);

    return (
        <Card title="Company Stock Ledger">
            <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
                <div className="w-full md:w-1/3"><label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Select Company</label><select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} className={inputStyle}>{companies.map(c => <option key={c} value={c}>{c === 'All' ? 'All Companies' : c}</option>)}</select></div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="flex-1"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">From</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputStyle} /></div>
                    <div className="flex-1"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">To</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inputStyle} /></div>
                </div>
                <button onClick={() => exportToCsv('company_wise_stock', detailedStockData)} className="w-full md:w-auto bg-emerald-600 text-white px-6 py-2 rounded-lg font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-md transition-all"><DownloadIcon className="h-5 w-5" /> Export Excel</button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <table className="w-full text-[13px] text-left border-collapse">
                    <thead className="bg-[#1e293b] text-slate-300 uppercase text-[11px] font-black tracking-wider">
                        <tr><th className="px-4 py-4">PRODUCT / COMPANY</th><th className="px-4 py-4">BATCH / EXPIRY</th><th className="px-4 py-4 text-center">OPENING</th><th className="px-4 py-4 text-center">INWARD</th><th className="px-4 py-4 text-center">OUTWARD</th><th className="px-4 py-4 text-center">CLOSING</th><th className="px-4 py-4 text-right">VALUE</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                        {detailedStockData.map((row, idx) => (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"><td className="px-4 py-3"><div className="font-bold text-slate-800 dark:text-slate-200">{row.productName}</div><div className="text-[10px] text-slate-400 uppercase">{row.company}</div></td><td className="px-4 py-3"><div className="font-mono text-slate-700 dark:text-slate-300">{row.batchNumber}</div><div className="text-[10px] text-slate-500 italic">{row.expiryDate}</div></td><td className="px-4 py-3 text-center font-medium text-slate-500">{formatStock(row.opening, row.unitsPerStrip)}</td><td className="px-4 py-3 text-center text-teal-600 dark:text-teal-400 font-bold">{row.purchased > 0 ? formatStock(row.purchased, row.unitsPerStrip) : '-'}</td><td className="px-4 py-3 text-center text-rose-500 font-bold">{row.sold > 0 ? formatStock(row.sold, row.unitsPerStrip) : '-'}</td><td className="px-4 py-3 text-center font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/40">{formatStock(row.closing, row.unitsPerStrip)}</td><td className="px-4 py-3 text-right font-black text-slate-700 dark:text-slate-300">₹{row.valuation.toFixed(2)}</td></tr>))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

const AllItemStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], systemConfig: SystemConfig, t: any }> = ({ products, purchases, bills, systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const stockData = useMemo(() => {
        return products.filter(p => !!p).map(p => {
            const liveStock = getLiveStockData(p, purchases, bills);
            const unitsPerStrip = p.unitsPerStrip || 1;
            const totalValuation = (p.batches || []).reduce((sum, b) => {
                const batchStock = liveStock.batchStocks.get(b.id) || 0;
                return sum + (batchStock * (b.purchasePrice / unitsPerStrip));
            }, 0);
            return { id: p.id, name: p.name, company: p.company, unitsPerStrip, totalStock: liveStock.total, totalValue: totalValuation };
        }).filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.company.toLowerCase().includes(searchTerm.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
    }, [products, purchases, bills, searchTerm]);
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

const SelectedItemStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], systemConfig: SystemConfig, t: any }> = ({ products, purchases, bills, systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
    const selectedProduct = useMemo(() => selectedProductId ? products.find(p => p.id === selectedProductId) || null : null, [selectedProductId, products]);
    const productSuggestions = useMemo(() => searchTerm ? products.filter(p => p && p.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10) : [], [searchTerm, products]);
    const handleSelectProduct = (p: Product) => { setSelectedProductId(p.id); setSearchTerm(p.name); setIsSuggestionsOpen(false); };
    const transactions = useMemo(() => {
        if (!selectedProduct) return [];
        const txs: any[] = [];
        const unitsPerStrip = selectedProduct.unitsPerStrip || 1;
        const pBarcode = normalizeCode(selectedProduct.barcode);
        purchases?.forEach(pur => pur.items.forEach(item => {
            const iBarcode = normalizeCode(item.barcode);
            const isMatch = item.productId === selectedProduct.id || (pBarcode !== "" && iBarcode === pBarcode);
            if (isMatch) txs.push({ date: new Date(pur.invoiceDate), type: 'Purchase', particulars: `Inv: ${pur.invoiceNumber} (${pur.supplier})`, inQty: item.quantity * (item.unitsPerStrip || unitsPerStrip), outQty: 0 });
        }));
        bills?.forEach(bill => bill.items.forEach(item => {
            const iBarcode = normalizeCode(item.barcode);
            const isMatch = item.productId === selectedProduct.id || (pBarcode !== "" && iBarcode === pBarcode);
            if (isMatch) txs.push({ date: new Date(bill.date), type: 'Sale', particulars: `Bill: ${bill.billNumber} (${bill.customerName})`, inQty: 0, outQty: item.quantity });
        }));
        return txs.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [selectedProduct, purchases, bills]);
    const filteredResults = useMemo(() => {
        let opening = (selectedProduct?.openingStock || 0);
        selectedProduct?.batches?.forEach(b => { opening += (b.openingStock || 0); });
        const start = fromDate ? new Date(fromDate) : null; if (start) start.setHours(0,0,0,0);
        const end = toDate ? new Date(toDate) : new Date(); end.setHours(23,59,59,999);
        if (start) transactions.forEach(tx => { if (tx.date < start) opening += (tx.inQty - tx.outQty); });
        let running = opening;
        const rows = transactions.filter(tx => (!start || tx.date >= start) && tx.date <= end).map(tx => { running += (tx.inQty - tx.outQty); return { ...tx, balance: running }; });
        return { opening, rows, closing: running };
    }, [transactions, fromDate, toDate, selectedProduct]);
    return (
        <Card title={t.inventory.selectedStock}>
            <div className="mb-6 relative"><label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Search Product</label><div className="relative"><input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setIsSuggestionsOpen(true); }} onFocus={() => setIsSuggestionsOpen(true)} className={inputStyle} placeholder="Type product name..." /><SearchIcon className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" /></div>{isSuggestionsOpen && productSuggestions.length > 0 && (<ul className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">{productSuggestions.map(p => (<li key={p.id} onClick={() => handleSelectProduct(p)} className="px-4 py-3 hover:bg-indigo-50 dark:hover:bg-slate-600 cursor-pointer text-slate-800 dark:text-slate-200 border-b last:border-b-0 dark:border-slate-600"><div className="font-bold">{p.name}</div><div className="text-[10px] text-slate-500 uppercase">{p.company}</div></li>))}</ul>)}</div>
            {selectedProduct && (<div className="space-y-6 animate-fade-in"><div className="bg-[#1e293b] text-white p-6 rounded-2xl flex justify-between items-center shadow-xl border border-slate-700"><div><h2 className="text-2xl font-black tracking-tight">{selectedProduct.name}</h2><p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">{selectedProduct.company}</p></div><div className="text-right"><p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Current Stock</p><p className="text-3xl font-black">{formatStock(filteredResults.closing, selectedProduct.unitsPerStrip)}</p></div></div><div className="grid grid-cols-2 gap-4 items-end bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border dark:border-slate-700"><div><label className="block text-[10px] font-black uppercase mb-1 text-slate-500 tracking-widest">From</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputStyle} /></div><div><label className="block text-[10px] font-black uppercase mb-1 text-slate-500 tracking-widest">To</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inputStyle} /></div></div><div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><table className="w-full text-sm text-left"><thead className="bg-[#1e293b] text-slate-300 uppercase text-[11px] font-black tracking-wider border-b dark:border-slate-700"><tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Type</th><th className="px-6 py-4">Particulars</th><th className="px-6 py-4 text-right">IN (Qty)</th><th className="px-6 py-4 text-right">OUT (Qty)</th><th className="px-6 py-4 text-right">Balance</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"><tr className="bg-slate-50 dark:bg-slate-900/40 font-bold"><td colSpan={5} className="px-6 py-4 text-right text-slate-500 uppercase text-[10px] tracking-widest">Opening Balance:</td><td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">{formatStock(filteredResults.opening, selectedProduct.unitsPerStrip)}</td></tr>{filteredResults.rows.map((row, idx) => (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"><td className="px-6 py-4 whitespace-nowrap">{row.date.toLocaleDateString()}</td><td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase ${row.type === 'Sale' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>{row.type}</span></td><td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.particulars}</td><td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{row.inQty > 0 ? row.inQty : '-'}</td><td className="px-6 py-4 text-right font-bold text-rose-600 dark:text-rose-400">{row.outQty > 0 ? row.outQty : '-'}</td><td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/20">{formatStock(row.balance, selectedProduct.unitsPerStrip)}</td></tr>))}</tbody></table></div></div>)}
        </Card>
    );
};

const ExpiredStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], t: any }> = ({ products, purchases, bills, t }) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const expiredBatches = useMemo(() => products.filter(p => !!p).flatMap(p => { const liveData = getLiveStockData(p, purchases, bills); return (p.batches || []).map(b => ({ ...b, product: p, liveStock: liveData.batchStocks.get(b.id) || 0 })); }).filter(item => item && getExpiryDate(item.expiryDate) < today && item.liveStock > 0), [products, purchases, bills]);
    return (
        <Card title="Expired Stock (Loss Analysis)">
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><table className="w-full text-sm text-left"><thead className="bg-[#1e293b] text-slate-300 uppercase text-[11px] font-black tracking-wider border-b dark:border-slate-700"><tr><th className="px-6 py-4">Product Name</th><th className="px-6 py-4">Batch No</th><th className="px-6 py-4">Expired On</th><th className="px-4 py-4 text-right">MRP</th><th className="px-6 py-4 text-center">Remaining Stock</th><th className="px-6 py-4 text-right">Loss Value</th></tr></thead><tbody className="bg-white dark:bg-slate-800">{expiredBatches.map((item, idx) => (<tr key={idx} className="border-b border-rose-100 dark:border-rose-900/20 bg-rose-50/20 dark:bg-rose-900/10 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"><td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{item.product.name}</td><td className="px-6 py-4 font-mono text-xs">{item.batchNumber}</td><td className="px-6 py-4 text-rose-600 dark:text-rose-400 font-black">{item.expiryDate}</td><td className="px-4 py-4 text-right font-medium">₹{item.mrp.toFixed(2)}</td><td className="px-6 py-4 text-center font-bold">{formatStock(item.liveStock, item.product.unitsPerStrip)}</td><td className="px-6 py-4 text-right font-black text-rose-600 dark:text-rose-400">₹{(item.liveStock * (item.purchasePrice / (item.product.unitsPerStrip || 1))).toFixed(2)}</td></tr>))}</tbody></table></div>
        </Card>
    );
};

const NearExpiryView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], t: any }> = ({ products, purchases, bills, t }) => {
    const today = new Date(); today.setHours(0,0,0,0); const thirtyDaysLater = new Date(); thirtyDaysLater.setDate(today.getDate() + 30);
    const nearExpiryBatches = useMemo(() => products.filter(p => !!p).flatMap(p => { const liveData = getLiveStockData(p, purchases, bills); return (p.batches || []).map(b => ({ ...b, product: p, liveStock: liveData.batchStocks.get(b.id) || 0 })); }).filter(item => { if (!item) return false; const exp = getExpiryDate(item.expiryDate); return exp >= today && exp <= thirtyDaysLater && item.liveStock > 0; }), [products, purchases, bills]);
    return (
        <Card title="Expiring in Next 30 Days">
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><table className="w-full text-sm text-left"><thead className="bg-[#1e293b] text-slate-300 uppercase text-[11px] font-black tracking-wider border-b dark:border-slate-700"><tr><th className="px-6 py-4">Product Name</th><th className="px-6 py-4">Batch No</th><th className="px-6 py-4">Expiry Date</th><th className="px-4 py-4 text-right">MRP</th><th className="px-6 py-4 text-center">In Stock</th><th className="px-6 py-4 text-right">Stock Valuation</th></tr></thead><tbody className="bg-white dark:bg-slate-800">{nearExpiryBatches.map((item, idx) => (<tr key={idx} className="border-b border-orange-100 dark:border-orange-900/20 bg-orange-50/20 dark:bg-orange-900/10 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"><td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{item.product.name}</td><td className="px-6 py-4 font-mono text-xs">{item.batchNumber}</td><td className="px-6 py-4 text-orange-600 dark:text-orange-400 font-black">{item.expiryDate}</td><td className="px-4 py-4 text-right font-medium">₹{item.mrp.toFixed(2)}</td><td className="px-6 py-4 text-center font-bold">{formatStock(item.liveStock, item.product.unitsPerStrip)}</td><td className="px-6 py-4 text-right font-black text-slate-700 dark:text-slate-300">₹{(item.liveStock * (item.purchasePrice / (item.product.unitsPerStrip || 1))).toFixed(2)}</td></tr>))}</tbody></table></div>
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
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Opening Stock (U)</label><input type="number" name="openingStock" value={formData.openingStock || 0} onChange={e => setFormData({...formData, openingStock: parseInt(e.target.value) || 0})} className={inputStyle} required /></div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700"><button type="button" onClick={onClose} className="px-5 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold hover:bg-slate-300">Cancel</button><button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-black shadow-lg hover:bg-indigo-700 transform active:scale-95 transition-all">SAVE CHANGES</button></div>
            </form>
        </Modal>
    );
};

const BatchWiseStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], onDeleteBatch: (pid: string, bid: string) => void, onUpdateProduct: (id: string, product: Partial<Product>) => Promise<void>, systemConfig: SystemConfig, t: any }> = ({ products, purchases, bills, onDeleteBatch, onUpdateProduct, systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState(''); const [editingBatchData, setEditingBatchData] = useState<{ product: Product, batch: Batch } | null>(null);
    const allBatches = useMemo(() => products.filter(p => !!p).flatMap(p => { const liveData = getLiveStockData(p, purchases, bills); return (p.batches || []).map(b => ({ ...b, product: p, liveStock: liveData.batchStocks.get(b.id) || 0 })); }).filter(item => { const term = searchTerm.toLowerCase(); return item.product.name.toLowerCase().includes(term) || item.batchNumber.toLowerCase().includes(term); }), [products, purchases, bills, searchTerm]);
    const handleUpdateBatch = (pid: string, updatedBatch: Batch) => { const product = products.find(p => p.id === pid); if (product) { const updatedBatches = (product.batches || []).map(b => b.id === updatedBatch.id ? updatedBatch : b); onUpdateProduct(pid, { batches: updatedBatches }); } };
    return (
        <Card title={t.inventory.batchStock}>
            <div className="mb-6 relative"><input type="text" placeholder="Search product or batch number..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputStyle} /><SearchIcon className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" /></div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><table className="w-full text-sm text-left"><thead className="bg-[#1e293b] text-slate-300 uppercase text-[11px] font-black tracking-wider border-b dark:border-slate-700"><tr><th className="px-6 py-4">Product Name</th><th className="px-6 py-4">Batch No</th><th className="px-6 py-4">Expiry Date</th><th className="px-4 py-4 text-right">MRP</th><th className="px-6 py-4 text-center">Live Stock</th><th className="px-6 py-4 text-center">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">{allBatches.map((item, idx) => (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"><td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{item.product.name}</td><td className="px-6 py-4 font-mono text-xs text-slate-500">{item.batchNumber}</td><td className="px-6 py-4 text-slate-600 dark:text-slate-400">{item.expiryDate}</td><td className="px-4 py-4 text-right font-medium">₹{item.mrp.toFixed(2)}</td><td className="px-6 py-4 text-center font-black text-slate-900 dark:text-white">{formatStock(item.liveStock, item.product.unitsPerStrip)}</td><td className="px-6 py-4 text-center"><div className="flex justify-center gap-3"><button onClick={() => setEditingBatchData({ product: item.product, batch: item })} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Edit Batch"><PencilIcon className="h-5 w-5" /></button><button onClick={() => onDeleteBatch(item.product.id, item.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="Delete Batch"><TrashIcon className="h-5 w-5" /></button></div></td></tr>))}</tbody></table></div>
            {editingBatchData && <EditBatchModal isOpen={!!editingBatchData} onClose={() => setEditingBatchData(null)} product={editingBatchData.product} batch={editingBatchData.batch} onSave={handleUpdateBatch} />}
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
    const isPharma = systemConfig.softwareMode === 'Pharma';
    const [formData, setFormData] = useState({ name: '', company: '', hsnCode: '', gst: 12, composition: '', unitsPerStrip: 1, barcode: '', openingStock: 0, isScheduleH: false, purchasePrice: '', saleRate: '', mrp: '' });
    const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
    const [isAddCompanyModalOpen, setAddCompanyModalOpen] = useState(false);
    const [activeCompanyIndex, setActiveCompanyIndex] = useState(-1);
    const [isScannerOpen, setScannerOpen] = useState(false);

    const filteredCompanySuggestions = useMemo(() => formData.company && showCompanySuggestions ? companies.filter(c => c && c.name && c.name.toLowerCase().includes(formData.company.toLowerCase())).slice(0, 5) : [], [formData.company, showCompanySuggestions, companies]);

    useEffect(() => {
        if (product) setFormData({ name: product.name || '', company: product.company || '', hsnCode: product.hsnCode || '', gst: product.gst !== undefined ? product.gst : 12, composition: product.composition || '', unitsPerStrip: product.unitsPerStrip || 1, barcode: product.barcode || '', openingStock: product.openingStock || 0, isScheduleH: !!product.isScheduleH, purchasePrice: '', saleRate: '', mrp: '' });
        else setFormData({ name: '', company: '', hsnCode: '', gst: 12, composition: '', unitsPerStrip: 1, barcode: '', openingStock: 0, isScheduleH: false, purchasePrice: '', saleRate: '', mrp: '' });
        setActiveCompanyIndex(-1);
    }, [product, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!product && formData.barcode) {
            const exists = products.find(p => p.barcode && normalizeCode(p.barcode) === normalizeCode(formData.barcode));
            if (exists) { alert(`Product with barcode "${formData.barcode}" already exists in Master List as "${exists.name}". Please edit the existing product or use a unique barcode.`); return; }
        }
        if (product) { const { purchasePrice, saleRate, mrp, ...cleanData } = formData; onUpdate(product.id, cleanData); }
        else {
            const { purchasePrice, saleRate, mrp, ...cleanData } = formData;
            const newProduct: Omit<Product, 'id'> = { ...cleanData, batches: [] };
            if (formData.mrp || formData.purchasePrice) {
                newProduct.batches = [{ id: `batch_${Date.now()}`, batchNumber: 'DEFAULT', expiryDate: '9999-12', stock: 0, mrp: parseFloat(formData.mrp) || 0, saleRate: parseFloat(formData.saleRate) || parseFloat(formData.mrp) || 0, purchasePrice: parseFloat(formData.purchasePrice) || 0 }];
            }
            onSave(newProduct);
        }
        onClose();
    };

    const handleCompanyKeyDown = (e: React.KeyboardEvent) => {
        const totalItems = filteredCompanySuggestions.length + 1; 
        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveCompanyIndex(prev => (prev < totalItems - 1 ? prev + 1 : prev)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveCompanyIndex(prev => (prev > 0 ? prev - 1 : prev)); }
        else if (e.key === 'Enter') { e.preventDefault(); if (activeCompanyIndex >= 0 && activeCompanyIndex < filteredCompanySuggestions.length) { setFormData({...formData, company: filteredCompanySuggestions[activeCompanyIndex].name}); setShowCompanySuggestions(false); setActiveCompanyIndex(-1); } else if (activeCompanyIndex === filteredCompanySuggestions.length || (formData.company && filteredCompanySuggestions.length === 0)) { setAddCompanyModalOpen(true); setShowCompanySuggestions(false); setActiveCompanyIndex(-1); } }
        else if (e.key === 'Escape') { setShowCompanySuggestions(false); setActiveCompanyIndex(-1); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={product ? 'Edit Product Master' : 'Create New Product'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Product Name*</label><input autoFocus value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputStyle} required /></div></div>
                <div className="relative"><label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Company*</label><div className="relative flex gap-2"><div className="relative flex-grow"><input value={formData.company} onChange={e => { setFormData({...formData, company: e.target.value}); setShowCompanySuggestions(true); }} onFocus={() => setShowCompanySuggestions(true)} onBlur={() => setTimeout(() => setShowCompanySuggestions(false), 200)} onKeyDown={handleCompanyKeyDown} className={inputStyle} required autoComplete="off" placeholder="Select or Add Company" />{showCompanySuggestions && (formData.company || filteredCompanySuggestions.length > 0) && (<ul className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-700 border rounded shadow-lg max-h-48 overflow-y-auto">{filteredCompanySuggestions.map((c, idx) => (<li key={c.id} onClick={() => setFormData({...formData, company: c.name})} className={`p-2 cursor-pointer text-slate-800 dark:text-slate-200 transition-colors ${idx === activeCompanyIndex ? 'bg-indigo-100 dark:bg-indigo-900 border-l-4 border-indigo-600' : 'hover:bg-indigo-50 dark:hover:bg-slate-600'}`}>{c.name}</li>))}<li onClick={() => setAddCompanyModalOpen(true)} className={`p-2 text-indigo-600 font-bold border-t cursor-pointer transition-colors ${activeCompanyIndex === filteredCompanySuggestions.length ? 'bg-indigo-100 dark:bg-indigo-900 border-l-4 border-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-600'}`}>+ Add New Company</li></ul>)}</div><button type="button" onClick={() => setAddCompanyModalOpen(true)} className="p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors" title="Add New Company"><PlusIcon className="h-5 w-5" /></button></div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="relative"><label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Barcode</label><div className="flex gap-2"><input value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className={inputStyle} placeholder="Scan or type barcode..." /><button type="button" onClick={() => setScannerOpen(true)} className="p-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors" title="Scan Barcode"><CameraIcon className="h-5 w-5" /></button></div></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Opening Stock (U)</label><input type="number" value={formData.openingStock} onChange={e => setFormData({...formData, openingStock: parseInt(e.target.value) || 0})} className={inputStyle} placeholder="Stock from prev years" /></div></div>
                {!product && (<div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700"><p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3">Initial Pricing (Optional Quick Setup)</p><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Purchase Rate</label><input type="number" step="0.01" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} className={inputStyle} placeholder="₹ 0.00" /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sale Rate</label><input type="number" step="0.01" value={formData.saleRate} onChange={e => setFormData({...formData, saleRate: e.target.value})} className={inputStyle} placeholder="₹ 0.00" /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">MRP*</label><input type="number" step="0.01" value={formData.mrp} onChange={e => setFormData({...formData, mrp: e.target.value})} className={inputStyle} placeholder="₹ 0.00" /></div></div></div>)}
                {isPharma && (<div className="grid grid-cols-1 gap-4"><label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Composition</label><input value={formData.composition} onChange={e => setFormData({...formData, composition: e.target.value})} className={inputStyle} placeholder="e.g. Paracetamol 500mg" /></div>)}
                <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">HSN Code</label><input value={formData.hsnCode} onChange={e => setFormData({...formData, hsnCode: e.target.value})} className={inputStyle} /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">GST Rate (%)</label><select value={formData.gst} onChange={e => setFormData({...formData, gst: Number(e.target.value)})} className={inputStyle}>{gstRates.map(r => <option key={r.id} value={r.rate}>{r.rate}%</option>)}</select></div></div>
                {isPharma && (<div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Units per Pack</label><input type="number" value={formData.unitsPerStrip} onChange={e => setFormData({...formData, unitsPerStrip: parseInt(e.target.value) || 1})} className={inputStyle} /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-widest">Scheduled Drug?</label><select value={formData.isScheduleH ? 'Yes' : 'No'} onChange={e => setFormData({...formData, isScheduleH: e.target.value === 'Yes'})} className={inputStyle}><option value="No">NO</option><option value="Yes">YES (Sch. H)</option></select></div></div>)}
                <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700"><button type="button" onClick={onClose} className="px-5 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold">Cancel</button><button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-black shadow-lg hover:bg-indigo-700 transform active:scale-95 transition-all">{product ? 'UPDATE PRODUCT' : 'CREATE PRODUCT'}</button></div>
            </form>
            <AddCompanyModal isOpen={isAddCompanyModalOpen} onClose={() => setAddCompanyModalOpen(false)} onAdd={async (name) => { const c = await onAddCompany({ name }); if (c) setFormData({...formData, company: c.name}); }} />
            <BarcodeScannerModal isOpen={isScannerOpen} onClose={() => setScannerOpen(false)} onScanSuccess={(code) => { setFormData({...formData, barcode: code}); setScannerOpen(false); }} />
        </Modal>
    );
};

const ProductImportModal: React.FC<{ isOpen: boolean; onClose: () => void; onImport: (event: React.ChangeEvent<HTMLInputElement>) => void; onDownloadTemplate: () => void; }> = ({ isOpen, onClose, onImport, onDownloadTemplate }) => {
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import Product Database">
            <div className="space-y-6"><div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800"><h4 className="text-sm font-black text-indigo-800 dark:text-indigo-300 mb-2 uppercase tracking-widest">Instructions</h4><ul className="text-xs text-indigo-700 dark:text-indigo-400 space-y-2 list-disc pl-4"><li>Use the CSV template for column mapping.</li><li>Company name is required for sorting reports.</li></ul></div><div className="flex flex-col gap-4"><button onClick={onDownloadTemplate} className="flex items-center justify-center gap-2 w-full py-4 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-indigo-400 transition-colors"><DownloadIcon className="h-5 w-5 text-indigo-500" /><span className="font-bold text-slate-700 dark:text-slate-300">Download Template</span></button><div className="relative"><input type="file" accept=".csv" onChange={onImport} className="hidden" id="csv-import-input" /><label htmlFor="csv-import-input" className="flex items-center justify-center gap-2 w-full py-4 bg-indigo-600 text-white rounded-xl font-black cursor-pointer hover:bg-indigo-700 shadow-xl transition-all uppercase text-sm"><UploadIcon className="h-5 w-5" /> Select File & Upload</label></div></div><div className="flex justify-end pt-4 border-t dark:border-slate-700"><button type="button" onClick={onClose} className="px-6 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg font-bold">Close</button></div></div>
        </Modal>
    );
};

export interface InventoryRef {
    setTab: (tab: InventoryTab) => void;
}

const Inventory = forwardRef<InventoryRef, InventoryProps>(({ products, companies, purchases = [], bills = [], systemConfig, gstRates, onAddProduct, onUpdateProduct, onDeleteProduct, onAddCompany, initialTab = 'productMaster' }, ref) => {
    const t = getTranslation(systemConfig.language); 
    const isPharma = systemConfig.softwareMode === 'Pharma'; 
    const [activeTab, setActiveTab] = useState<InventoryTab>(initialTab); 
    const [isImportModalOpen, setImportModalOpen] = useState(false); 
    const [isProductModalOpen, setProductModalOpen] = useState(false); 
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    useImperativeHandle(ref, () => ({
        setTab: (tab: InventoryTab) => setActiveTab(tab)
    }));

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    const handleDeleteBatch = (pid: string, bid: string) => { if (!window.confirm("Delete batch?")) return; const product = products.find(p => p && p.id === pid); if (product) { const updatedBatches = (product.batches || []).filter(b => b.id !== bid); onUpdateProduct(pid, { batches: updatedBatches }); } };
    const TabButton: React.FC<{ tab: InventoryTab, label: string }> = ({ tab, label }) => (<button onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === tab ? 'bg-indigo-600 text-white shadow-xl ring-2 ring-indigo-500/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700'}`}>{label}</button>);
    
    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-end gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700"><div><h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-3"><ArchiveIcon className="h-8 w-8 text-indigo-600" />Inventory Reports</h1><p className="text-slate-500 dark:text-slate-400 font-medium mt-1 uppercase text-[10px] tracking-widest">Real-time Batch, Expiry & Stock Tracking</p></div><div className="flex gap-3 w-full sm:w-auto"><button onClick={() => setImportModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-tighter hover:bg-indigo-200 transition-all border border-indigo-200 dark:border-indigo-800"><UploadIcon className="h-5 w-5" /> Bulk Import</button></div></div>
            <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide"><TabButton tab="productMaster" label="Product Master" /><TabButton tab="company" label="Company Stock" /><TabButton tab="all" label="Stock Summary" /><TabButton tab="selected" label="Item Ledger" /><TabButton tab="batch" label="Batch Status" />{isPharma && <><TabButton tab="expired" label="Expired" /><TabButton tab="nearExpiry" label="Expiring Soon" /></>}</div>
            <div className="mt-2 transition-all duration-300">{activeTab === 'productMaster' && <ProductMasterView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} onEdit={(p) => { setEditingProduct(p); setProductModalOpen(true); }} onDelete={onDeleteProduct} t={t} />}{activeTab === 'all' && <AllItemStockView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} t={t} />}{activeTab === 'selected' && <SelectedItemStockView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} t={t} />}{activeTab === 'batch' && <BatchWiseStockView products={products} purchases={purchases} bills={bills} onDeleteBatch={handleDeleteBatch} onUpdateProduct={onUpdateProduct} systemConfig={systemConfig} t={t} />}{activeTab === 'company' && <CompanyWiseStockView products={products} purchases={purchases} bills={bills} t={t} />}{activeTab === 'expired' && <ExpiredStockView products={products} purchases={purchases} bills={bills} t={t} />}{activeTab === 'nearExpiry' && <NearExpiryView products={products} purchases={purchases} bills={bills} t={t} />}</div>
            <ProductImportModal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} onImport={() => {}} onDownloadTemplate={() => {}} />
            <AddEditProductModal isOpen={isProductModalOpen} onClose={() => setProductModalOpen(false)} product={editingProduct} products={products} companies={companies} gstRates={gstRates} onSave={onAddProduct} onUpdate={onUpdateProduct} onAddCompany={onAddCompany} systemConfig={systemConfig} />
        </div>
    );
});

export default Inventory;

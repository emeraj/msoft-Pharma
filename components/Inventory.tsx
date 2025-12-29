import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, Purchase, Bill, SystemConfig, GstRate, Batch, Company } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { DownloadIcon, TrashIcon, PlusIcon, PencilIcon, UploadIcon, ArchiveIcon, BarcodeIcon, PrinterIcon, InformationCircleIcon, CheckCircleIcon, SearchIcon, XIcon, CameraIcon } from './icons/Icons';
import { getTranslation } from '../utils/translationHelper';
import BarcodeScannerModal from './BarcodeScannerModal';
import { extractProductCode } from '../utils/scannerHelper';

// Fix: Define missing InventoryTab type
type InventoryTab = 'productMaster' | 'all' | 'selected' | 'batch' | 'company' | 'expired' | 'nearExpiry';

const normalizeCode = (str: string = "") => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

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

/**
 * HELPER: Calculate current stock for a specific product and its batches by aggregating transactions.
 */
const getLiveStockData = (product: Product, purchases: Purchase[], bills: Bill[]) => {
    const unitsPerStrip = Number(product.unitsPerStrip) || 1;
    const pOpening = Number(product.openingStock) || 0;
    
    let totalIn = pOpening;
    let totalOut = 0;

    const batchStockMap = new Map<string, number>();
    
    const pName = product.name.toLowerCase().trim();
    const pCompany = product.company.toLowerCase().trim();
    const pBarcode = normalizeCode(product.barcode);

    // Initialize with existing batch info
    const batches = product.batches || [];
    batches.forEach(b => {
        const bOp = Number(b.openingStock) || 0;
        batchStockMap.set(b.id, bOp);
        
        // Match product opening to batch if batch opening is 0 and it's a default/only batch
        if (bOp === 0 && (b.batchNumber === 'OPENING' || b.batchNumber === 'DEFAULT' || batches.length === 1)) {
            batchStockMap.set(b.id, pOpening);
        }
    });

    // 1. Sum all Purchases
    purchases.forEach(pur => {
        pur.items.forEach(item => {
            const iBarcode = normalizeCode(item.barcode);
            const iName = item.productName.toLowerCase().trim();
            const iCompany = item.company.toLowerCase().trim();

            const isMatch = item.productId === product.id || 
                          (pBarcode !== "" && iBarcode === pBarcode) ||
                          (pBarcode === "" && iBarcode === "" && iName === pName && iCompany === pCompany);
            
            if (isMatch) {
                const qtyUnits = Number(item.quantity) * unitsPerStrip;
                totalIn += qtyUnits;
                
                const targetBatch = batches.find(b => b.batchNumber === item.batchNumber && Math.abs(b.mrp - item.mrp) < 0.1) ||
                                  batches.find(b => Math.abs(b.mrp - item.mrp) < 0.1);
                
                if (targetBatch) {
                    batchStockMap.set(targetBatch.id, (batchStockMap.get(targetBatch.id) || 0) + qtyUnits);
                } else if (batches.length > 0) {
                    const firstId = batches[0].id;
                    batchStockMap.set(firstId, (batchStockMap.get(firstId) || 0) + qtyUnits);
                }
            }
        });
    });

    // 2. Subtract all Sales
    bills.forEach(bill => {
        bill.items.forEach(item => {
            const iBarcode = normalizeCode(item.barcode || "");
            const isMatch = item.productId === product.id || 
                          (pBarcode !== "" && iBarcode === pBarcode);
            
            if (isMatch) {
                const q = Number(item.quantity);
                totalOut += q;
                if (batchStockMap.has(item.batchId)) {
                    batchStockMap.set(item.batchId, (batchStockMap.get(item.batchId) || 0) - q);
                } else if (batches.length > 0) {
                    const matchedBatch = batches.find(b => b.batchNumber === item.batchNumber);
                    const fallbackId = matchedBatch ? matchedBatch.id : batches[0].id;
                    batchStockMap.set(fallbackId, (batchStockMap.get(fallbackId) || 0) - q);
                }
            }
        });
    });

    return {
        total: totalIn - totalOut,
        totalIn,
        totalOut,
        batchStocks: batchStockMap
    };
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
                            <th className="px-4 py-4 text-center">Op. Stock</th>
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
                                    <td className={`px-4 py-3.5 text-center font-black ${isLowStock ? 'text-rose-600 bg-rose-50/30' : 'text-emerald-600'}`}>{formatStock(liveStock.total, p.unitsPerStrip)}</td>
                                    {!isRetail && <td className="px-4 py-3.5 text-xs text-slate-500 italic">{p.composition || '-'}</td>}
                                    <td className="px-4 py-3.5 text-center font-medium text-slate-700 dark:text-slate-300">{p.gst}%</td>
                                    <td className="px-4 py-3.5 text-center">
                                        <div className="flex justify-center items-center gap-3">
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
        </Card>
    );
};

const CompanyWiseStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], t: any }> = ({ products, purchases, bills, t }) => {
    const data = useMemo(() => {
        const map = new Map<string, { company: string, count: number, value: number, totalUnits: number }>();
        products.forEach(p => {
            const live = getLiveStockData(p, purchases, bills);
            const latestBatch = [...p.batches].sort((a,b) => b.id.localeCompare(a.id))[0];
            const rate = latestBatch?.purchasePrice || 0;
            const val = (live.total / (p.unitsPerStrip || 1)) * rate;
            
            const existing = map.get(p.company) || { company: p.company, count: 0, value: 0, totalUnits: 0 };
            existing.count += 1;
            existing.value += val;
            existing.totalUnits += (live.total / (p.unitsPerStrip || 1));
            map.set(p.company, existing);
        });
        return Array.from(map.values()).sort((a,b) => b.value - a.value);
    }, [products, purchases, bills]);

    return (
        <Card title="Company Wise Inventory Valuation">
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800 text-slate-200 uppercase text-[10px] font-black">
                        <tr>
                            <th className="px-4 py-3">Company</th>
                            <th className="px-4 py-3 text-center">Items</th>
                            <th className="px-4 py-3 text-center">Total Qty</th>
                            <th className="px-4 py-3 text-right">Inventory Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white">
                        {data.map(d => (
                            <tr key={d.company}>
                                <td className="px-4 py-3 font-bold">{d.company}</td>
                                <td className="px-4 py-3 text-center">{d.count}</td>
                                <td className="px-4 py-3 text-center">{d.totalUnits.toFixed(1)}</td>
                                <td className="px-4 py-3 text-right font-black text-emerald-600">₹{d.value.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

const AllItemStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], systemConfig: SystemConfig, t: any }> = ({ products, purchases, bills, systemConfig, t }) => {
    const stockData = useMemo(() => {
        return products.map(p => {
            const live = getLiveStockData(p, purchases, bills);
            const latestBatch = [...p.batches].sort((a,b) => b.id.localeCompare(a.id))[0];
            const rate = latestBatch?.purchasePrice || 0;
            return {
                ...p,
                totalStock: live.total,
                stockValue: (live.total / (p.unitsPerStrip || 1)) * rate
            };
        }).sort((a,b) => b.stockValue - a.stockValue);
    }, [products, purchases, bills]);

    return (
        <Card title="Stock Summary (All Items)">
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800 text-slate-200 uppercase text-[10px] font-black">
                        <tr>
                            <th className="px-4 py-3">Product Name</th>
                            <th className="px-4 py-3">Company</th>
                            <th className="px-4 py-3 text-center">Live Stock</th>
                            <th className="px-4 py-3 text-right">Est. Value (at Cost)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white">
                        {stockData.map(d => (
                            <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-4 py-3 font-bold">{d.name}</td>
                                <td className="px-4 py-3 text-slate-500">{d.company}</td>
                                <td className="px-4 py-3 text-center font-black">{formatStock(d.totalStock, d.unitsPerStrip)}</td>
                                <td className="px-4 py-3 text-right text-emerald-600 font-bold">₹{d.stockValue.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

const SelectedItemStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], systemConfig: SystemConfig, t: any }> = ({ products, purchases, bills, systemConfig, t }) => {
    const [selectedId, setSelectedId] = useState('');
    const [search, setSearch] = useState('');
    
    const selectedProduct = useMemo(() => products.find(p => p.id === selectedId), [products, selectedId]);
    
    const suggestions = useMemo(() => 
        search ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 5) : []
    , [search, products]);

    const history = useMemo(() => {
        if (!selectedProduct) return [];
        const pName = selectedProduct.name.toLowerCase().trim();
        const pCompany = selectedProduct.company.toLowerCase().trim();
        const pBarcode = normalizeCode(selectedProduct.barcode);

        const rows: any[] = [];
        
        purchases.forEach(pur => {
            pur.items.forEach(item => {
                const iBarcode = normalizeCode(item.barcode);
                const isMatch = item.productId === selectedProduct.id || 
                               (pBarcode !== "" && iBarcode === pBarcode) ||
                               (pBarcode === "" && iBarcode === "" && item.productName.toLowerCase().trim() === pName && item.company.toLowerCase().trim() === pCompany);
                if (isMatch) {
                    rows.push({ date: pur.invoiceDate, type: 'PURCHASE', ref: pur.invoiceNumber, qty: item.quantity, rate: item.purchasePrice, entity: pur.supplier });
                }
            });
        });

        bills.forEach(bill => {
            bill.items.forEach(item => {
                const iBarcode = normalizeCode(item.barcode || "");
                const isMatch = item.productId === selectedProduct.id || (pBarcode !== "" && iBarcode === pBarcode);
                if (isMatch) {
                    rows.push({ date: bill.date, type: 'SALE', ref: bill.billNumber, qty: item.quantity / (selectedProduct.unitsPerStrip || 1), rate: item.mrp, entity: bill.customerName });
                }
            });
        });

        return rows.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [selectedProduct, purchases, bills]);

    return (
        <Card title="Item Transaction History">
            <div className="relative mb-6">
                <div className="relative">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Product to view history..." className={inputStyle} />
                    <SearchIcon className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
                </div>
                {suggestions.length > 0 && (
                    <ul className="absolute z-20 w-full bg-white dark:bg-slate-700 border rounded shadow-xl mt-1">
                        {suggestions.map(p => (
                            <li key={p.id} onClick={() => { setSelectedId(p.id); setSearch(p.name); }} className="p-3 hover:bg-indigo-50 dark:hover:bg-slate-600 cursor-pointer font-bold border-b last:border-b-0 dark:border-slate-600">
                                {p.name} <span className="text-xs font-normal opacity-70 ml-2">({p.company})</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {selectedProduct ? (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-800 text-slate-200 uppercase text-[10px] font-black">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Ref #</th>
                                <th className="px-4 py-3">Entity</th>
                                <th className="px-4 py-3 text-center">Qty (Strips)</th>
                                <th className="px-4 py-3 text-right">Rate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white">
                            {history.map((h, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">{new Date(h.date).toLocaleDateString()}</td>
                                    <td className={`px-4 py-3 font-bold ${h.type === 'PURCHASE' ? 'text-emerald-600' : 'text-blue-600'}`}>{h.type}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{h.ref}</td>
                                    <td className="px-4 py-3 text-slate-500">{h.entity}</td>
                                    <td className="px-4 py-3 text-center font-bold">{h.qty.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right">₹{h.rate.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="py-20 text-center text-slate-400 italic">Select a product to see its historical ledger.</div>
            )}
        </Card>
    );
};

const ExpiredStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], t: any }> = ({ products, purchases, bills, t }) => {
    const expired = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        return products.flatMap(p => {
            const live = getLiveStockData(p, purchases, bills);
            return (p.batches || []).map(b => ({ ...b, product: p, liveStock: live.batchStocks.get(b.id) || 0 }))
                .filter(b => b.liveStock > 0 && getExpiryDate(b.expiryDate) < today);
        });
    }, [products, purchases, bills]);

    return (
        <Card title="Expired Stock (Immediate Action Required)">
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm text-left">
                    <thead className="bg-rose-900 text-rose-100 uppercase text-[10px] font-black">
                        <tr>
                            <th className="px-4 py-3">Product / Batch</th>
                            <th className="px-4 py-3 text-center">Expiry</th>
                            <th className="px-4 py-3 text-center">Current Stock</th>
                            <th className="px-4 py-3 text-right">Value (Loss)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white">
                        {expired.length > 0 ? expired.map((b, i) => (
                            <tr key={i}>
                                <td className="px-4 py-3 font-bold">{b.product.name} <span className="text-xs font-mono opacity-60 ml-2">({b.batchNumber})</span></td>
                                <td className="px-4 py-3 text-center text-rose-600 font-black">{b.expiryDate}</td>
                                <td className="px-4 py-3 text-center">{formatStock(b.liveStock, b.product.unitsPerStrip)}</td>
                                <td className="px-4 py-3 text-right font-bold text-rose-500">₹{((b.liveStock / (b.product.unitsPerStrip || 1)) * b.purchasePrice).toFixed(2)}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan={4} className="py-10 text-center text-slate-500 italic">Excellent! No expired items in stock.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

const NearExpiryView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], t: any }> = ({ products, purchases, bills, t }) => {
    const near = useMemo(() => {
        const today = new Date();
        const limit = new Date();
        limit.setDate(today.getDate() + 90);
        return products.flatMap(p => {
            const live = getLiveStockData(p, purchases, bills);
            return (p.batches || []).map(b => ({ ...b, product: p, liveStock: live.batchStocks.get(b.id) || 0 }))
                .filter(b => {
                    const exp = getExpiryDate(b.expiryDate);
                    return b.liveStock > 0 && exp >= today && exp <= limit;
                });
        });
    }, [products, purchases, bills]);

    return (
        <Card title="Expiring within 90 Days">
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm text-left">
                    <thead className="bg-amber-800 text-amber-100 uppercase text-[10px] font-black">
                        <tr>
                            <th className="px-4 py-3">Product / Batch</th>
                            <th className="px-4 py-3 text-center">Expiry</th>
                            <th className="px-4 py-3 text-center">Current Stock</th>
                            <th className="px-4 py-3 text-right">Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white">
                        {near.length > 0 ? near.map((b, i) => (
                            <tr key={i}>
                                <td className="px-4 py-3 font-bold">{b.product.name} <span className="text-xs font-mono opacity-60 ml-2">({b.batchNumber})</span></td>
                                <td className="px-4 py-3 text-center text-amber-600 font-black">{b.expiryDate}</td>
                                <td className="px-4 py-3 text-center">{formatStock(b.liveStock, b.product.unitsPerStrip)}</td>
                                <td className="px-4 py-3 text-right font-bold text-slate-800">₹{((b.liveStock / (b.product.unitsPerStrip || 1)) * b.purchasePrice).toFixed(2)}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan={4} className="py-10 text-center text-slate-500 italic">No items expiring within the next 90 days.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

const EditBatchModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    product?: Product | null; 
    batch?: Batch | null; 
    onSave: (pid: string, updatedBatch: Batch) => void;
    products?: Product[];
}> = ({ isOpen, onClose, product, batch, onSave, products = [] }) => {
    const [formData, setFormData] = useState<Batch>({ id: '', batchNumber: '', expiryDate: '', stock: 0, openingStock: 0, mrp: 0, saleRate: 0, purchasePrice: 0 });
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(product || null);
    const [search, setSearch] = useState('');

    useEffect(() => { 
        if (batch) setFormData({ ...batch }); 
        else setFormData({ id: `batch_${Date.now()}`, batchNumber: '', expiryDate: '', stock: 0, openingStock: 0, mrp: 0, saleRate: 0, purchasePrice: 0 });
        if (product) setSelectedProduct(product);
        else setSelectedProduct(null);
    }, [batch, product, isOpen]);

    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        if (!selectedProduct) { alert("Select a product first."); return; }
        // For new batches, current stock = opening stock initially
        const finalData = batch ? formData : { ...formData, stock: formData.openingStock || 0 };
        onSave(selectedProduct.id, finalData); 
        onClose(); 
    };

    const suggestions = useMemo(() => 
        !selectedProduct && search ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 5) : []
    , [search, products, selectedProduct]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={batch ? "Edit Batch Details" : "Add New Batch"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {!product && !batch && !selectedProduct && (
                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Search Product*</label>
                        <div className="relative">
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Type product name..." className={inputStyle} />
                            <SearchIcon className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                        {suggestions.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white dark:bg-slate-700 border rounded-lg shadow-xl mt-1 max-h-40 overflow-y-auto">
                                {suggestions.map(p => (
                                    <li key={p.id} onClick={() => { setSelectedProduct(p); setSearch(p.name); }} className="px-4 py-2 hover:bg-indigo-50 dark:hover:bg-slate-600 cursor-pointer text-sm font-bold border-b last:border-b-0 dark:border-slate-600">
                                        {p.name} <span className="text-[10px] font-normal opacity-70 uppercase ml-2">{p.company}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
                
                {selectedProduct && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800 flex justify-between items-center">
                        <div>
                            <label className="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Selected Product</label>
                            <p className="font-bold text-slate-800 dark:text-slate-100">{selectedProduct.name}</p>
                        </div>
                        {!batch && (
                            <button type="button" onClick={() => setSelectedProduct(null)} className="text-rose-500 hover:text-rose-700"><XIcon className="h-5 w-5" /></button>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Batch Number*</label>
                        <input value={formData.batchNumber} onChange={e => setFormData({...formData, batchNumber: e.target.value})} className={inputStyle} required placeholder="e.g. B2201" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expiry (YYYY-MM)*</label>
                        <input type="month" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} className={inputStyle} required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Purchase Rate*</label>
                        <input type="number" step="0.01" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: parseFloat(e.target.value) || 0})} className={inputStyle} required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">MRP*</label>
                        <input type="number" step="0.01" value={formData.mrp} onChange={e => setFormData({...formData, mrp: parseFloat(e.target.value) || 0, saleRate: formData.saleRate || parseFloat(e.target.value)})} className={inputStyle} required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sale Rate</label>
                        <input type="number" step="0.01" value={formData.saleRate || formData.mrp} onChange={e => setFormData({...formData, saleRate: parseFloat(e.target.value) || 0})} className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Opening Stock (U)*</label>
                        <input type="number" value={formData.openingStock} onChange={e => setFormData({...formData, openingStock: parseInt(e.target.value) || 0})} className={inputStyle} required />
                    </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                    <button type="button" onClick={onClose} className="px-5 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold hover:bg-slate-300">Cancel</button>
                    <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-black shadow-lg hover:bg-indigo-700 transform active:scale-95 transition-all">SAVE BATCH</button>
                </div>
            </form>
        </Modal>
    );
};

const BatchWiseStockView: React.FC<{ 
    products: Product[], 
    purchases: Purchase[], 
    bills: Bill[], 
    onDeleteBatch: (pid: string, bid: string) => void, 
    onUpdateProduct: (id: string, product: Partial<Product>) => Promise<void>, 
    systemConfig: SystemConfig, 
    t: any 
}> = ({ products, purchases, bills, onDeleteBatch, onUpdateProduct, systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState(''); 
    const [editingBatchData, setEditingBatchData] = useState<{ product: Product, batch: Batch | null } | null>(null);
    const [isAddBatchOpen, setAddBatchOpen] = useState(false);

    const allBatches = useMemo(() => products.filter(p => !!p).flatMap(p => { 
        const liveData = getLiveStockData(p, purchases, bills); 
        return (p.batches || []).map(b => ({ ...b, product: p, liveStock: liveData.batchStocks.get(b.id) || 0 })); 
    }).filter(item => { 
        const term = searchTerm.toLowerCase(); 
        return item.product.name.toLowerCase().includes(term) || item.batchNumber.toLowerCase().includes(term); 
    }), [products, purchases, bills, searchTerm]);

    const handleUpdateBatch = (pid: string, updatedBatch: Batch) => { 
        const product = products.find(p => p.id === pid); 
        if (product) { 
            const isNew = !product.batches.some(b => b.id === updatedBatch.id);
            const updatedBatches = isNew 
                ? [...(product.batches || []), updatedBatch]
                : (product.batches || []).map(b => b.id === updatedBatch.id ? updatedBatch : b); 
            onUpdateProduct(pid, { batches: updatedBatches }); 
        } 
    };

    return (
        <Card title={
            <div className="flex justify-between items-center w-full">
                <span className="text-xl font-bold">Batch Master Ledger</span>
                <button onClick={() => setAddBatchOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all transform active:scale-95"><PlusIcon className="h-4 w-4" /> New Batch Entry</button>
            </div>
        }>
            <div className="mb-6 relative">
                <input type="text" placeholder="Search product or batch number..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputStyle} />
                <SearchIcon className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <table className="w-full text-[13px] text-left">
                    <thead className="bg-[#1e293b] text-slate-300 uppercase text-[10px] font-black tracking-wider border-b dark:border-slate-700">
                        <tr>
                            <th className="px-4 py-4">Product / Batch</th>
                            <th className="px-4 py-4 text-center">Expiry</th>
                            <th className="px-4 py-4 text-right">Purchase</th>
                            <th className="px-4 py-4 text-right">MRP</th>
                            <th className="px-4 py-4 text-right">Sale</th>
                            <th className="px-4 py-4 text-center">Op. Stock</th>
                            <th className="px-4 py-4 text-center">Live Stock</th>
                            <th className="px-4 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                        {allBatches.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="font-bold text-slate-800 dark:text-slate-200">{item.product.name}</div>
                                    <div className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-black">B: {item.batchNumber}</div>
                                </td>
                                <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">{item.expiryDate}</td>
                                <td className="px-4 py-3 text-right font-medium">₹{item.purchasePrice.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right font-medium text-slate-400">₹{item.mrp.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right font-black text-emerald-600">₹{(item.saleRate || item.mrp).toFixed(2)}</td>
                                <td className="px-4 py-3 text-center text-slate-500 font-bold">{formatStock(item.openingStock || 0, item.product.unitsPerStrip)}</td>
                                <td className="px-4 py-3 text-center font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/20">{formatStock(item.liveStock, item.product.unitsPerStrip)}</td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex justify-center gap-3">
                                        <button onClick={() => setEditingBatchData({ product: item.product, batch: item })} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Edit Batch"><PencilIcon className="h-5 w-5" /></button>
                                        <button onClick={() => onDeleteBatch(item.product.id, item.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="Delete Batch"><TrashIcon className="h-5 w-5" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {(editingBatchData || isAddBatchOpen) && (
                <EditBatchModal 
                    isOpen={!!editingBatchData || isAddBatchOpen} 
                    onClose={() => { setEditingBatchData(null); setAddBatchOpen(false); }} 
                    product={editingBatchData?.product} 
                    batch={editingBatchData?.batch} 
                    products={products}
                    onSave={handleUpdateBatch} 
                />
            )}
        </Card>
    );
};

const AddEditProductModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    products: Product[];
    companies: Company[];
    gstRates: GstRate[];
    onSave: (product: Omit<Product, 'id'>) => Promise<void>;
    onUpdate: (id: string, product: Partial<Product>) => Promise<void>;
    onAddCompany: (company: Omit<Company, 'id'>) => Promise<Company | null>;
    systemConfig: SystemConfig;
}> = ({ isOpen, onClose, product, products, companies, gstRates, onSave, onUpdate, onAddCompany, systemConfig }) => {
    const isPharma = systemConfig.softwareMode === 'Pharma';
    const [formData, setFormData] = useState<any>({
        name: '', company: '', hsnCode: '', gst: 12, barcode: '', openingStock: 0, composition: '', unitsPerStrip: 1, isScheduleH: false,
        purchasePrice: '', saleRate: '', mrp: ''
    });
    const [isScannerOpen, setScannerOpen] = useState(false);

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
                isScheduleH: product.isScheduleH || false,
                purchasePrice: '', saleRate: '', mrp: ''
            });
        } else {
            setFormData({
                name: '', company: '', hsnCode: '', gst: 12, barcode: '', openingStock: 0, composition: '', unitsPerStrip: 1, isScheduleH: false,
                purchasePrice: '', saleRate: '', mrp: ''
            });
        }
    }, [product, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { purchasePrice, saleRate, mrp, ...cleanData } = formData;
        
        if (product) {
            await onUpdate(product.id, cleanData);
        } else {
            const newProd: Omit<Product, 'id'> = { ...cleanData, batches: [] };
            // If initial pricing is provided, create a DEFAULT batch with the product's opening stock
            if (mrp || purchasePrice) {
                newProd.batches = [{
                    id: `batch_${Date.now()}`,
                    batchNumber: 'DEFAULT',
                    expiryDate: '9999-12',
                    stock: Number(cleanData.openingStock) || 0,
                    openingStock: Number(cleanData.openingStock) || 0,
                    mrp: parseFloat(mrp) || 0,
                    saleRate: parseFloat(saleRate) || parseFloat(mrp) || 0,
                    purchasePrice: parseFloat(purchasePrice) || 0
                }];
            }
            await onSave(newProd);
        }
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={product ? "Edit Product" : "Add New Product"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product Name*</label>
                        <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputStyle} required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company*</label>
                        <input list="company-list" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} className={inputStyle} required />
                        <datalist id="company-list">
                            {companies.map(c => <option key={c.id} value={c.name} />)}
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Barcode / Part No</label>
                        <div className="flex gap-1">
                            <input value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className={inputStyle} />
                            <button type="button" onClick={() => setScannerOpen(true)} className="p-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors" title="Scan Barcode"><CameraIcon className="h-5 w-5" /></button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">HSN Code</label>
                        <input value={formData.hsnCode} onChange={e => setFormData({...formData, hsnCode: e.target.value})} className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">GST %</label>
                        <select value={formData.gst} onChange={e => setFormData({...formData, gst: parseFloat(e.target.value) || 0})} className={inputStyle}>
                            {gstRates.map(r => <option key={r.id} value={r.rate}>{r.rate}%</option>)}
                        </select>
                    </div>
                    {isPharma && (
                        <>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Composition</label>
                                <input value={formData.composition} onChange={e => setFormData({...formData, composition: e.target.value})} className={inputStyle} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Units per Strip</label>
                                <input type="number" value={formData.unitsPerStrip} onChange={e => setFormData({...formData, unitsPerStrip: parseInt(e.target.value) || 1})} className={inputStyle} />
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                                <input type="checkbox" id="sch-h" checked={formData.isScheduleH} onChange={e => setFormData({...formData, isScheduleH: e.target.checked})} className="h-4 w-4 text-indigo-600 rounded" />
                                <label htmlFor="sch-h" className="text-xs font-bold text-slate-500 uppercase">Schedule H</label>
                            </div>
                        </>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Opening Stock (U)</label>
                        <input type="number" value={formData.openingStock} onChange={e => setFormData({...formData, openingStock: parseInt(e.target.value) || 0})} className={inputStyle} />
                    </div>
                </div>
                {!product && (
                     <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3">Initial Pricing (Optional Quick Setup)</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Purchase Rate</label><input type="number" step="0.01" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} className={inputStyle} placeholder="₹ 0.00" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sale Rate</label><input type="number" step="0.01" value={formData.saleRate} onChange={e => setFormData({...formData, saleRate: e.target.value})} className={inputStyle} placeholder="₹ 0.00" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">MRP*</label><input type="number" step="0.01" value={formData.mrp} onChange={e => setFormData({...formData, mrp: e.target.value})} className={inputStyle} placeholder="₹ 0.00" /></div>
                        </div>
                    </div>
                )}
                <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                    <button type="button" onClick={onClose} className="px-5 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold hover:bg-slate-300">Cancel</button>
                    <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-black shadow-lg hover:bg-indigo-700">SAVE PRODUCT</button>
                </div>
            </form>
            <BarcodeScannerModal isOpen={isScannerOpen} onClose={() => setScannerOpen(false)} onScanSuccess={(code) => { setFormData({...formData, barcode: extractProductCode(code)}); setScannerOpen(false); }} />
        </Modal>
    );
};

const Inventory: React.FC<InventoryProps> = ({ products, companies, purchases = [], bills = [], systemConfig, gstRates, onAddProduct, onUpdateProduct, onDeleteProduct, onAddCompany }) => {
    const t = getTranslation(systemConfig.language); 
    const isPharma = systemConfig.softwareMode === 'Pharma'; 
    const [activeTab, setActiveTab] = useState<InventoryTab>('productMaster'); 
    const [isProductModalOpen, setProductModalOpen] = useState(false); 
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const handleDeleteBatch = (pid: string, bid: string) => { 
        if (!window.confirm("Delete batch record? This may affect ledger consistency.")) return; 
        const product = products.find(p => p && p.id === pid); 
        if (product) { 
            const updatedBatches = (product.batches || []).filter(b => b.id !== bid); 
            onUpdateProduct(pid, { batches: updatedBatches }); 
        } 
    };

    const TabButton: React.FC<{ tab: InventoryTab, label: string }> = ({ tab, label }) => (
        <button onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === tab ? 'bg-indigo-600 text-white shadow-xl ring-2 ring-indigo-500/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700'}`}>{label}</button>
    );

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-end gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-3"><ArchiveIcon className="h-8 w-8 text-indigo-600" />Professional Inventory</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 uppercase text-[10px] tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">Real-time Batch, Expiry & Financial Stock Tracking</p>
                </div>
            </div>
            <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
                <TabButton tab="productMaster" label="Master List" />
                <TabButton tab="batch" label="Batch Status" />
                <TabButton tab="company" label="Company Ledger" />
                <TabButton tab="all" label="Stock Summary" />
                <TabButton tab="selected" label="Item History" />
                {isPharma && <><TabButton tab="expired" label="Expired" /><TabButton tab="nearExpiry" label="Expiring" /></>}
            </div>
            <div className="mt-2 transition-all duration-300">
                {activeTab === 'productMaster' && <ProductMasterView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} onEdit={(p) => { setEditingProduct(p); setProductModalOpen(true); }} onDelete={onDeleteProduct} t={t} />}
                {activeTab === 'batch' && <BatchWiseStockView products={products} purchases={purchases} bills={bills} onDeleteBatch={handleDeleteBatch} onUpdateProduct={onUpdateProduct} systemConfig={systemConfig} t={t} />}
                {activeTab === 'all' && <AllItemStockView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} t={t} />}
                {activeTab === 'selected' && <SelectedItemStockView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} t={t} />}
                {activeTab === 'company' && <CompanyWiseStockView products={products} purchases={purchases} bills={bills} t={t} />}
                {activeTab === 'expired' && <ExpiredStockView products={products} purchases={purchases} bills={bills} t={t} />}
                {activeTab === 'nearExpiry' && <NearExpiryView products={products} purchases={purchases} bills={bills} t={t} />}
            </div>
            {isProductModalOpen && (
                <AddEditProductModal isOpen={isProductModalOpen} onClose={() => setProductModalOpen(false)} product={editingProduct} products={products} companies={companies} gstRates={gstRates} onSave={onAddProduct} onUpdate={onUpdateProduct} onAddCompany={onAddCompany} systemConfig={systemConfig} />
            )}
        </div>
    );
};
export default Inventory;

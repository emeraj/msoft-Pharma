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

const getExpiryDate = (expiryString: string): Date => {
    if (!expiryString) return new Date('9999-12-31');
    const [year, month] = expiryString.split('-').map(Number);
    return new Date(year, month, 0); // Last day of that month
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

const ProductMasterView: React.FC<{ 
    products: Product[], 
    systemConfig: SystemConfig,
    onEdit: (p: Product) => void, 
    onDelete: (id: string) => void, 
    t: any 
}> = ({ products, systemConfig, onEdit, onDelete, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const isRetail = systemConfig.softwareMode === 'Retail';
    
    const filtered = useMemo(() => 
        products.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.barcode && p.barcode.includes(searchTerm))
        ).sort((a,b) => a.name.localeCompare(b.name))
    , [products, searchTerm]);

    const handlePrintLabel = (product: Product) => {
        const barcodeValue = product.barcode || '00000000';
        const mrp = product.batches[0]?.mrp?.toFixed(2) || '0.00';
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Print Barcode - ${product.name}</title>
                        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                        <style>
                            @page { margin: 0; size: 50mm 25mm; }
                            body { 
                                margin: 0; 
                                padding: 0; 
                                display: flex; 
                                flex-direction: column; 
                                align-items: center; 
                                justify-content: center; 
                                height: 25mm; 
                                width: 50mm;
                                font-family: Arial, sans-serif;
                                overflow: hidden;
                                background: white;
                            }
                            .name { 
                                font-size: 11pt; 
                                font-weight: bold; 
                                text-transform: uppercase; 
                                margin-bottom: 2px;
                                text-align: center;
                                width: 95%;
                                white-space: nowrap;
                                overflow: hidden;
                                text-overflow: ellipsis;
                                color: black;
                            }
                            #barcode-container {
                                width: 90%;
                                display: flex;
                                justify-content: center;
                            }
                            #barcode {
                                width: 100%;
                            }
                            .price { 
                                font-size: 14pt; 
                                font-weight: 900; 
                                margin-top: 1px; 
                                text-align: center;
                                color: black;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="name">${product.name}</div>
                        <div id="barcode-container">
                            <svg id="barcode"></svg>
                        </div>
                        <div class="price">MRP: ₹${mrp}</div>
                        <script>
                            window.onload = function() {
                                try {
                                    JsBarcode("#barcode", "${barcodeValue}", {
                                        format: "CODE128",
                                        width: 1.8,
                                        height: 35,
                                        displayValue: true,
                                        fontSize: 10,
                                        font: "Arial",
                                        margin: 0,
                                        textMargin: 0
                                    });
                                    setTimeout(() => {
                                        window.print();
                                        window.close();
                                    }, 500);
                                } catch (e) {
                                    console.error("Barcode Generation Error:", e);
                                    window.close();
                                }
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
                <button 
                    onClick={() => onEdit(null as any)} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all transform active:scale-95"
                >
                    <PlusIcon className="h-4 w-4" /> Add New Product
                </button>
            </div>
        }>
            <div className="mb-6">
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full p-3 bg-yellow-100 text-slate-900 placeholder-slate-500 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 shadow-inner" 
                    />
                    <SearchIcon className="absolute right-4 top-3.5 h-5 w-5 text-slate-400" />
                </div>
            </div>
            
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-[#1e293b] text-slate-300 uppercase text-[11px] font-black tracking-wider">
                        <tr>
                            <th className="px-4 py-4">Name</th>
                            <th className="px-4 py-4">Company</th>
                            {isRetail && <th className="px-4 py-4">Barcode</th>}
                            {!isRetail && <th className="px-4 py-4">Composition</th>}
                            <th className="px-4 py-4 text-center">GST</th>
                            <th className="px-4 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                        {filtered.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                                <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">{p.name}</td>
                                <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">{p.company}</td>
                                {isRetail && <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{p.barcode || '-'}</td>}
                                {!isRetail && <td className="px-4 py-3.5 text-xs text-slate-500 italic">{p.composition || '-'}</td>}
                                <td className="px-4 py-3.5 text-center font-medium text-slate-700 dark:text-slate-300">{p.gst}%</td>
                                <td className="px-4 py-3.5">
                                    <div className="flex justify-center items-center gap-3">
                                        {isRetail && p.barcode && (
                                            <button 
                                                onClick={() => handlePrintLabel(p)} 
                                                className="p-1 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors" 
                                                title="Print Professional Barcode Label"
                                            >
                                                <BarcodeIcon className="h-5 w-5" />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => onEdit(p)} 
                                            className="p-1 text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 transition-colors" 
                                            title="Edit"
                                        >
                                            <PencilIcon className="h-5 w-5" />
                                        </button>
                                        <button 
                                            onClick={() => onDelete(p.id)} 
                                            className="p-1 text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-200 transition-colors" 
                                            title="Delete"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && (
                    <div className="py-20 text-center text-slate-400 italic bg-white dark:bg-slate-800">
                        No products match your search.
                    </div>
                )}
            </div>
        </Card>
    );
};

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
        purchases?.forEach(pur => pur.items.forEach(item => {
            if (item.productId === selectedProduct.id || (!item.productId && item.productName === selectedProduct.name && item.company === selectedProduct.company)) {
                txs.push({ date: new Date(pur.invoiceDate), type: 'Purchase', particulars: `Inv: ${pur.invoiceNumber} (${pur.supplier})`, inQty: item.quantity * (item.unitsPerStrip || unitsPerStrip), outQty: 0 });
            }
        }));
        bills?.forEach(bill => bill.items.forEach(item => {
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

const ExpiredStockView: React.FC<{ products: Product[], t: any }> = ({ products, t }) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const expiredBatches = useMemo(() => {
        return products.flatMap(p => 
            p.batches.map(b => ({ ...b, product: p }))
        ).filter(item => getExpiryDate(item.expiryDate) < today && item.stock > 0);
    }, [products]);

    return (
        <Card title="Expired Stock">
            <div className="overflow-x-auto border dark:border-slate-700 rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3">Product</th>
                            <th className="px-4 py-3">Batch No</th>
                            <th className="px-4 py-3">Expired Date</th>
                            <th className="px-4 py-3 text-right">MRP</th>
                            <th className="px-4 py-3 text-center">Stock</th>
                            <th className="px-4 py-3 text-right">Loss Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {expiredBatches.map((item, idx) => (
                            <tr key={idx} className="border-b border-red-100 dark:border-red-900/20 bg-red-50/30 dark:bg-red-900/10">
                                <td className="px-4 py-3 font-bold">{item.product.name}</td>
                                <td className="px-4 py-3">{item.batchNumber}</td>
                                <td className="px-4 py-3 text-red-600 font-bold">{item.expiryDate}</td>
                                <td className="px-4 py-3 text-right">₹{item.mrp.toFixed(2)}</td>
                                <td className="px-4 py-3 text-center">{formatStock(item.stock, item.product.unitsPerStrip)}</td>
                                <td className="px-4 py-3 text-right font-black text-red-600">₹{(item.stock * (item.purchasePrice / (item.product.unitsPerStrip || 1))).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {expiredBatches.length === 0 && <div className="py-10 text-center text-slate-500">No expired stock found. Good job!</div>}
            </div>
        </Card>
    );
};

const NearExpiryView: React.FC<{ products: Product[], t: any }> = ({ products, t }) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);
    
    const nearExpiryBatches = useMemo(() => {
        return products.flatMap(p => 
            p.batches.map(b => ({ ...b, product: p }))
        ).filter(item => {
            const exp = getExpiryDate(item.expiryDate);
            return exp >= today && exp <= thirtyDaysLater && item.stock > 0;
        });
    }, [products]);

    return (
        <Card title="Near 30 Days Expiry">
            <div className="overflow-x-auto border dark:border-slate-700 rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3">Product</th>
                            <th className="px-4 py-3">Batch No</th>
                            <th className="px-4 py-3">Expiry Date</th>
                            <th className="px-4 py-3 text-right">MRP</th>
                            <th className="px-4 py-3 text-center">Stock</th>
                            <th className="px-4 py-3 text-right">Valuation</th>
                        </tr>
                    </thead>
                    <tbody>
                        {nearExpiryBatches.map((item, idx) => (
                            <tr key={idx} className="border-b border-orange-100 dark:border-orange-900/20 bg-orange-50/30 dark:bg-orange-900/10">
                                <td className="px-4 py-3 font-bold">{item.product.name}</td>
                                <td className="px-4 py-3">{item.batchNumber}</td>
                                <td className="px-4 py-3 text-orange-600 font-bold">{item.expiryDate}</td>
                                <td className="px-4 py-3 text-right">₹{item.mrp.toFixed(2)}</td>
                                <td className="px-4 py-3 text-center">{formatStock(item.stock, item.product.unitsPerStrip)}</td>
                                <td className="px-4 py-3 text-right font-black">₹{(item.stock * (item.purchasePrice / (item.product.unitsPerStrip || 1))).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {nearExpiryBatches.length === 0 && <div className="py-10 text-center text-slate-500">No batches expiring in next 30 days.</div>}
            </div>
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
                                <td className="px-4 py-3 font-bold">{item.product.name}</td>
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

const AddEditProductModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    product?: Product | null;
    gstRates: GstRate[];
    onSave: (p: Omit<Product, 'id'>) => void;
    onUpdate: (id: string, p: Partial<Product>) => void;
    systemConfig: SystemConfig;
}> = ({ isOpen, onClose, product, gstRates, onSave, onUpdate, systemConfig }) => {
    const isPharma = systemConfig.softwareMode === 'Pharma';
    const [formData, setFormData] = useState({ name: '', company: '', hsnCode: '', gst: 12, composition: '', unitsPerStrip: 1, barcode: '' });

    useEffect(() => {
        if (product) {
            setFormData({ name: product.name, company: product.company, hsnCode: product.hsnCode, gst: product.gst, composition: product.composition || '', unitsPerStrip: product.unitsPerStrip || 1, barcode: product.barcode || '' });
        } else {
            setFormData({ name: '', company: '', hsnCode: '', gst: 12, composition: '', unitsPerStrip: 1, barcode: '' });
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={product ? 'Edit Product' : 'Add New Product'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product Name*</label><input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputStyle} required /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company*</label><input value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} className={inputStyle} required /></div>
                
                {!isPharma ? (
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Barcode</label><input value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className={inputStyle} placeholder="Enter barcode..." /></div>
                ) : (
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Composition</label><input value={formData.composition} onChange={e => setFormData({...formData, composition: e.target.value})} className={inputStyle} /></div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">HSN Code</label><input value={formData.hsnCode} onChange={e => setFormData({...formData, hsnCode: e.target.value})} className={inputStyle} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">GST %</label><select value={formData.gst} onChange={e => setFormData({...formData, gst: parseInt(e.target.value)})} className={inputStyle}>{gstRates.map(r => <option key={r.id} value={r.rate}>{r.rate}%</option>)}</select></div>
                </div>
                
                {isPharma && (
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Units per Strip</label><input type="number" value={formData.unitsPerStrip} onChange={e => setFormData({...formData, unitsPerStrip: parseInt(e.target.value) || 1})} className={inputStyle} /></div>
                )}

                <div className="flex justify-end gap-2 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Cancel</button><button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow">{product ? 'Update' : 'Create'}</button></div>
            </form>
        </Modal>
    );
};

type InventoryTab = 'productMaster' | 'all' | 'selected' | 'batch' | 'company' | 'expired' | 'nearExpiry';

const Inventory: React.FC<InventoryProps> = ({ products, purchases = [], bills = [], systemConfig, gstRates, onAddProduct, onUpdateProduct, onDeleteProduct }) => {
    const t = getTranslation(systemConfig.language);
    const isPharma = systemConfig.softwareMode === 'Pharma';
    const [activeTab, setActiveTab] = useState<InventoryTab>('productMaster');
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [isProductModalOpen, setProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    
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
            alert("CSV Import Triggered (Internal logic pending)");
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

    const TabButton: React.FC<{ tab: InventoryTab, label: string }> = ({ tab, label }) => (
        <button 
            onClick={() => setActiveTab(tab)} 
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab 
                ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-500/50' 
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
            }`}
        >
            {label}
        </button>
    );

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

            {/* Pill Navigation */}
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                <TabButton tab="productMaster" label="Product Master" />
                <TabButton tab="all" label={t.inventory.allStock} />
                <TabButton tab="selected" label={t.inventory.selectedStock} />
                <TabButton tab="batch" label={t.inventory.batchStock} />
                <TabButton tab="company" label={t.inventory.companyStock} />
                {isPharma && (
                    <>
                        <TabButton tab="expired" label="Expired Stock" />
                        <TabButton tab="nearExpiry" label="Near 30 Days Expiry" />
                    </>
                )}
            </div>

            <div className="mt-4 transition-all duration-300">
                {activeTab === 'productMaster' && <ProductMasterView products={products} systemConfig={systemConfig} onEdit={(p) => { setEditingProduct(p); setProductModalOpen(true); }} onDelete={onDeleteProduct} t={t} />}
                {activeTab === 'all' && <AllItemStockView products={products} systemConfig={systemConfig} t={t} />}
                {activeTab === 'selected' && <SelectedItemStockView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} t={t} />}
                {activeTab === 'batch' && <BatchWiseStockView products={products} onDeleteBatch={handleDeleteBatch} onUpdateProduct={onUpdateProduct} systemConfig={systemConfig} t={t} />}
                {activeTab === 'company' && <CompanyWiseStockView products={products} t={t} />}
                {activeTab === 'expired' && <ExpiredStockView products={products} t={t} />}
                {activeTab === 'nearExpiry' && <NearExpiryView products={products} t={t} />}
            </div>

            <ProductImportModal 
                isOpen={isImportModalOpen} 
                onClose={() => setImportModalOpen(false)} 
                onImport={handleImportCsv} 
                onDownloadTemplate={handleDownloadTemplate} 
            />

            <AddEditProductModal 
                isOpen={isProductModalOpen}
                onClose={() => setProductModalOpen(false)}
                product={editingProduct}
                gstRates={gstRates}
                onSave={onAddProduct}
                onUpdate={onUpdateProduct}
                systemConfig={systemConfig}
            />
        </div>
    );
};

export default Inventory;
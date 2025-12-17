
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, Purchase, Bill, SystemConfig, GstRate, Batch } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { DownloadIcon, TrashIcon, PlusIcon, PencilIcon, UploadIcon, ArchiveIcon, BarcodeIcon, PrinterIcon } from './icons/Icons';
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

const EditBatchModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    batch: Batch;
    onSave: (pid: string, updatedBatch: Batch) => void;
}> = ({ isOpen, onClose, product, batch, onSave }) => {
    const [formData, setFormData] = useState<Batch>({ ...batch });

    useEffect(() => {
        setFormData({ ...batch });
    }, [batch]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(product.id, formData);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Batch Details">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Product</label>
                    <input value={product.name} disabled className={`${inputStyle} bg-slate-200 dark:bg-slate-700 cursor-not-allowed`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Batch Number</label>
                        <input name="batchNumber" value={formData.batchNumber} onChange={handleChange} className={inputStyle} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Expiry (YYYY-MM)</label>
                        <input name="expiryDate" value={formData.expiryDate} onChange={handleChange} className={inputStyle} placeholder="YYYY-MM" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">MRP</label>
                        <input type="number" name="mrp" step="0.01" value={formData.mrp} onChange={handleChange} className={inputStyle} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Purchase Price</label>
                        <input type="number" name="purchasePrice" step="0.01" value={formData.purchasePrice} onChange={handleChange} className={inputStyle} required />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Current Stock (Total Units)</label>
                        <input type="number" name="stock" value={formData.stock} onChange={handleChange} className={inputStyle} required />
                        <p className="text-xs text-orange-600 mt-1">Warning: Manually adjusting stock here directly affects inventory count.</p>
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700 mt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Changes</button>
                </div>
            </form>
        </Modal>
    );
};

// --- New Component: PrintBarcodeModal ---
const PrintBarcodeModal: React.FC<{ isOpen: boolean; onClose: () => void; product: Product }> = ({ isOpen, onClose, product }) => {
    const [quantity, setQuantity] = useState(1);
    
    // Pick max MRP from active batches for the label
    const mrp = useMemo(() => {
        if (!product.batches || product.batches.length === 0) return 0;
        return Math.max(...product.batches.map(b => b.mrp));
    }, [product]);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Please allow popups to print labels.");
            return;
        }
        
        // Use Barcode or fallback to a portion of ID or HSN
        const barcodeValue = product.barcode || product.hsnCode || product.id.substring(0, 8);

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print Labels - ${product.name}</title>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                <style>
                    @media print {
                        @page {
                            size: 50mm 25mm;
                            margin: 0;
                        }
                        body {
                            margin: 0;
                        }
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: sans-serif;
                    }
                    .label {
                        width: 50mm;
                        height: 25mm;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                        overflow: hidden;
                        page-break-inside: avoid;
                        /* Optional border for preview, most thermal printers ignore page breaks without content flow, 
                           but page-break-after helps */
                        page-break-after: always;
                    }
                    .name {
                        font-size: 10px;
                        font-weight: bold;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        width: 48mm;
                        margin-bottom: 1px;
                        text-transform: uppercase;
                    }
                    .price {
                        font-size: 10px;
                        font-weight: bold;
                        margin-top: 1px;
                    }
                    svg {
                        width: 40mm;
                        height: 10mm;
                        display: block;
                    }
                </style>
            </head>
            <body>
                ${Array.from({ length: quantity }).map(() => `
                    <div class="label">
                        <div class="name">${product.name}</div>
                        <svg class="barcode"
                            jsbarcode-format="auto"
                            jsbarcode-value="${barcodeValue}"
                            jsbarcode-textmargin="0"
                            jsbarcode-fontoptions="bold"
                            jsbarcode-height="30"
                            jsbarcode-width="1"
                            jsbarcode-displayValue="true"
                            jsbarcode-fontSize="10"
                        ></svg>
                        <div class="price">MRP: ₹${mrp.toFixed(2)}</div>
                    </div>
                `).join('')}
                <script>
                    JsBarcode(".barcode").init();
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 500);
                    }
                </script>
            </body>
            </html>
        `;
        
        printWindow.document.write(html);
        printWindow.document.close();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Print Barcode Labels (50x25mm)">
            <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
                    <p className="text-lg font-bold text-slate-800 dark:text-white">{product.name}</p>
                    <p className="text-sm text-slate-500">{product.company}</p>
                    <p className="text-xs text-slate-400 mt-1">Barcode: {product.barcode || 'N/A (Auto-generated)'}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Number of Labels</label>
                    <input 
                        type="number" 
                        min="1" 
                        value={quantity} 
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} 
                        className={inputStyle} 
                        autoFocus
                    />
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
                    <button onClick={handlePrint} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 flex items-center gap-2">
                        <PrinterIcon className="h-4 w-4" /> Print Labels
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// --- New Component: AllItemStockView (Product-wise Summary) ---
const AllItemStockView: React.FC<{ products: Product[], systemConfig: SystemConfig, t: any }> = ({ products, systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const stockData = useMemo(() => {
        return products.map(p => {
            const totalStock = p.batches.reduce((sum, b) => sum + b.stock, 0);
            const unitsPerStrip = p.unitsPerStrip || 1;
            // Calculate total valuation based on purchase price
            const totalValue = p.batches.reduce((sum, b) => {
                const unitPurchasePrice = b.purchasePrice / unitsPerStrip;
                return sum + (b.stock * unitPurchasePrice);
            }, 0);

            return {
                id: p.id,
                name: p.name,
                company: p.company,
                unitsPerStrip,
                totalStock,
                totalValue
            };
        }).filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            item.company.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [products, searchTerm]);

    const totalValuation = useMemo(() => stockData.reduce((sum, item) => sum + item.totalValue, 0), [stockData]);

    const handleExport = () => {
        if (stockData.length === 0) { alert("No data to export."); return; }
        const data = stockData.map(item => ({
            'Product': item.name,
            'Company': item.company,
            'Total Stock': formatStock(item.totalStock, item.unitsPerStrip),
            'Stock Value': item.totalValue.toFixed(2)
        }));
        exportToCsv('all_item_stock_summary', data);
    };

    return (
        <Card title={t.inventory.allStock}>
            <div className="flex flex-col sm:flex-row gap-4 mb-4 justify-between items-end">
                <input 
                    type="text" 
                    placeholder={t.inventory.searchPlaceholder} 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className={`${inputStyle} max-w-sm`} 
                />
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                    <div className="bg-indigo-100 dark:bg-indigo-900/50 px-4 py-2 rounded-lg w-full sm:w-auto text-center sm:text-left">
                        <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">Total Valuation:</span>
                        <span className="ml-2 text-lg font-bold text-indigo-900 dark:text-white">₹{totalValuation.toFixed(2)}</span>
                    </div>
                    <button onClick={handleExport} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors flex-shrink-0">
                        <DownloadIcon className="h-5 w-5" /> Export
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto max-h-[600px] rounded-lg border dark:border-slate-700">
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs sticky top-0">
                        <tr>
                            <th className="px-4 py-3">Product Name</th>
                            <th className="px-4 py-3">Company</th>
                            <th className="px-4 py-3 text-center">Total Stock</th>
                            <th className="px-4 py-3 text-right">Stock Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stockData.map(item => (
                            <tr key={item.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                <td className="px-4 py-3 font-medium">{item.name}</td>
                                <td className="px-4 py-3">{item.company}</td>
                                <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-200">
                                    {formatStock(item.totalStock, item.unitsPerStrip)}
                                </td>
                                <td className="px-4 py-3 text-right">₹{item.totalValue.toFixed(2)}</td>
                            </tr>
                        ))}
                        {stockData.length === 0 && (
                            <tr><td colSpan={4} className="text-center py-8 text-slate-500">No products found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

// --- New Component: SelectedItemStockView ---
interface Transaction {
    date: Date;
    type: 'Sale' | 'Purchase';
    particulars: string;
    inQty: number;
    outQty: number;
    balance: number;
}

const SelectedItemStockView: React.FC<{ 
    products: Product[], 
    purchases: Purchase[], 
    bills: Bill[], 
    systemConfig: SystemConfig, 
    t: any 
}> = ({ products, purchases, bills, systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);

    const productSuggestions = useMemo(() => {
        if (!searchTerm) return [];
        return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10);
    }, [searchTerm, products]);

    const handleSelectProduct = (p: Product) => {
        setSelectedProduct(p);
        setSearchTerm(p.name);
        setIsSuggestionsOpen(false);
    };

    const currentTotalStock = useMemo(() => {
        if (!selectedProduct) return 0;
        return selectedProduct.batches.reduce((sum, b) => sum + b.stock, 0);
    }, [selectedProduct]);

    const transactions = useMemo(() => {
        if (!selectedProduct) return [];

        const txs: Transaction[] = [];
        const unitsPerStrip = selectedProduct.unitsPerStrip || 1;

        // 1. Purchases
        purchases.forEach(pur => {
            pur.items.forEach(item => {
                // Match by ID if available, else by Name
                const isMatch = item.productId === selectedProduct.id || 
                                (!item.productId && item.productName === selectedProduct.name && item.company === selectedProduct.company);
                
                if (isMatch) {
                    txs.push({
                        date: new Date(pur.invoiceDate),
                        type: 'Purchase',
                        particulars: `Inv: ${pur.invoiceNumber} (${pur.supplier})`,
                        inQty: item.quantity * (item.unitsPerStrip || unitsPerStrip),
                        outQty: 0,
                        balance: 0 // To be calculated
                    });
                }
            });
        });

        // 2. Sales
        bills.forEach(bill => {
            bill.items.forEach(item => {
                if (item.productId === selectedProduct.id) {
                    txs.push({
                        date: new Date(bill.date),
                        type: 'Sale',
                        particulars: `Bill: ${bill.billNumber} (${bill.customerName})`,
                        inQty: 0,
                        outQty: item.quantity, // CartItem quantity is total units
                        balance: 0 // To be calculated
                    });
                }
            });
        });

        // Sort by Date
        txs.sort((a, b) => a.date.getTime() - b.date.getTime());

        // Calculate Running Balance
        // We assume start from 0 if no manual opening stock is tracked in this view
        // Ideally we should account for manual adjustments but they are not logged as transactions yet.
        
        return txs;
    }, [selectedProduct, purchases, bills]);

    const filteredTransactions = useMemo(() => {
        let openingBalance = 0;
        const startDate = fromDate ? new Date(fromDate) : null;
        if (startDate) startDate.setHours(0,0,0,0);
        
        const endDate = toDate ? new Date(toDate) : new Date();
        endDate.setHours(23,59,59,999);

        // Calculate Opening Balance based on transactions BEFORE startDate
        if (startDate) {
            transactions.forEach(tx => {
                if (tx.date < startDate) {
                    openingBalance = openingBalance + tx.inQty - tx.outQty;
                }
            });
        } else {
            // If no start date, opening is 0 (or initial product opening stock if we had it)
            openingBalance = 0;
        }

        const viewTxs = transactions.filter(tx => {
            if (startDate && tx.date < startDate) return false;
            if (tx.date > endDate) return false;
            return true;
        });

        // Re-calculate running balance for the view
        let running = openingBalance;
        return {
            openingBalance,
            rows: viewTxs.map(tx => {
                running = running + tx.inQty - tx.outQty;
                return { ...tx, balance: running };
            })
        };

    }, [transactions, fromDate, toDate]);

    const unitsLabel = systemConfig.softwareMode === 'Pharma' ? 'Units' : 'Qty';

    const handleExport = () => {
        if (!selectedProduct) return;
        if (filteredTransactions.rows.length === 0 && filteredTransactions.openingBalance === 0) {
            alert("No data to export.");
            return;
        }

        const data = [];
        
        // Add Opening Balance Row
        data.push({
            'Date': fromDate || 'Start',
            'Type': 'Opening',
            'Particulars': 'Opening Balance',
            'IN': '',
            'OUT': '',
            'Balance': formatStock(filteredTransactions.openingBalance, selectedProduct.unitsPerStrip)
        });

        // Add Transactions
        filteredTransactions.rows.forEach(row => {
            data.push({
                'Date': row.date.toLocaleDateString(),
                'Type': row.type,
                'Particulars': row.particulars,
                'IN': row.inQty > 0 ? formatStock(row.inQty, selectedProduct.unitsPerStrip) : '',
                'OUT': row.outQty > 0 ? formatStock(row.outQty, selectedProduct.unitsPerStrip) : '',
                'Balance': formatStock(row.balance, selectedProduct.unitsPerStrip)
            });
        });

        exportToCsv(`${selectedProduct.name.replace(/\s+/g, '_')}_stock_ledger`, data);
    };

    return (
        <Card title={t.inventory.selectedStock}>
            <div className="mb-6 relative">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Search Product</label>
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setIsSuggestionsOpen(true); }}
                    onFocus={() => setIsSuggestionsOpen(true)}
                    placeholder="Type product name..."
                    className={inputStyle}
                />
                {isSuggestionsOpen && productSuggestions.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {productSuggestions.map(p => (
                            <li 
                                key={p.id}
                                onClick={() => handleSelectProduct(p)}
                                className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer text-slate-800 dark:text-slate-200"
                            >
                                <div className="font-medium">{p.name}</div>
                                <div className="text-xs text-slate-500">{p.company}</div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {selectedProduct && (
                <div className="animate-fade-in space-y-6">
                    <div className="bg-slate-700/90 text-white p-4 rounded-lg shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center">
                        <div>
                            <h2 className="text-xl font-bold">{selectedProduct.name}</h2>
                            <p className="text-slate-300">{selectedProduct.company}</p>
                        </div>
                        <div className="mt-2 md:mt-0 text-right">
                            <p className="text-sm text-slate-300 uppercase tracking-wide">Current Stock</p>
                            <p className="text-2xl font-bold">{formatStock(currentTotalStock, selectedProduct.unitsPerStrip)}</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From</label>
                            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputStyle} />
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">To</label>
                            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inputStyle} />
                        </div>
                        <div className="w-full sm:w-auto">
                             <button onClick={handleExport} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors h-[42px]">
                                <DownloadIcon className="h-5 w-5" /> Export
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border dark:border-slate-700">
                        <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3 w-1/3">Particulars</th>
                                    <th className="px-4 py-3 text-right">IN</th>
                                    <th className="px-4 py-3 text-right">OUT</th>
                                    <th className="px-4 py-3 text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                <tr className="bg-slate-50 dark:bg-slate-700/50">
                                    <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-600 dark:text-slate-400">Opening Balance:</td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{formatStock(filteredTransactions.openingBalance, selectedProduct.unitsPerStrip)}</td>
                                </tr>
                                {filteredTransactions.rows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.date.toLocaleDateString()}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                row.type === 'Sale' 
                                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300' 
                                                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                            }`}>
                                                {row.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-800 dark:text-slate-300">{row.particulars}</td>
                                        <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{row.inQty > 0 ? `${row.inQty} ${unitsLabel}` : '-'}</td>
                                        <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">{row.outQty > 0 ? `${row.outQty} ${unitsLabel}` : '-'}</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{formatStock(row.balance, selectedProduct.unitsPerStrip)}</td>
                                    </tr>
                                ))}
                                {filteredTransactions.rows.length === 0 && (
                                    <tr><td colSpan={6} className="text-center py-8 text-slate-500">No transactions in selected period.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </Card>
    );
};

const BatchWiseStockView: React.FC<{ 
    products: Product[], 
    onDeleteBatch: (pid: string, bid: string) => void, 
    onUpdateProduct: (id: string, product: Partial<Product>) => Promise<void>,
    systemConfig: SystemConfig, 
    t: any 
}> = ({ products, onDeleteBatch, onUpdateProduct, systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingBatchData, setEditingBatchData] = useState<{ product: Product, batch: Batch } | null>(null);

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

    const handleUpdateBatch = (pid: string, updatedBatch: Batch) => {
        const product = products.find(p => p.id === pid);
        if (product) {
            const updatedBatches = product.batches.map(b => b.id === updatedBatch.id ? updatedBatch : b);
            onUpdateProduct(pid, { batches: updatedBatches });
        }
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
                                        <div className="flex items-center justify-center gap-2">
                                            <button 
                                                onClick={() => setEditingBatchData({ product: item.product, batch: item })} 
                                                className="text-blue-500 hover:text-blue-700 p-1"
                                                title="Edit Batch"
                                            >
                                                <PencilIcon className="h-4 w-4"/>
                                            </button>
                                            <button 
                                                onClick={() => { if(window.confirm(`Are you sure you want to delete batch ${item.batchNumber} of ${item.product.name}?`)) onDeleteBatch(item.product.id, item.id); }} 
                                                className="text-red-500 hover:text-red-700 p-1"
                                                title="Delete Batch"
                                            >
                                                <TrashIcon className="h-4 w-4"/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
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
                    <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
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
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {reportData.map((row, idx) => (
                            <tr key={`${row.productId}-${row.batchNumber}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                <td className="px-4 py-3 align-top">
                                    {row.isFirstOfProduct ? (
                                        <>
                                            <div className="font-bold text-slate-900 dark:text-white text-base">{row.productName}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wide">{row.company}</div>
                                        </>
                                    ) : null}
                                </td>
                                <td className="px-4 py-3 align-top">
                                    <div className="text-slate-800 dark:text-slate-200 font-medium">{row.batchNumber}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{row.expiryDate}</div>
                                </td>
                                <td className="px-4 py-3 text-center align-top text-slate-600 dark:text-slate-400">
                                    {formatStock(row.openingStock, row.unitsPerStrip)}
                                </td>
                                <td className="px-4 py-3 text-center align-top text-green-600 dark:text-green-400">
                                    {row.purchasedQty > 0 ? formatStock(row.purchasedQty, row.unitsPerStrip) : '-'}
                                </td>
                                <td className="px-4 py-3 text-center align-top text-red-600 dark:text-red-400">
                                    {row.soldQty > 0 ? formatStock(row.soldQty, row.unitsPerStrip) : '-'}
                                </td>
                                <td className="px-4 py-3 text-center align-top font-bold text-slate-900 dark:text-white">
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

const AddProductModal: React.FC<{ isOpen: boolean, onClose: () => void, onAdd: (p: any) => void, systemConfig: SystemConfig, gstRates: GstRate[], initialData?: Product, isEdit?: boolean, existingCompanies: string[] }> = ({ isOpen, onClose, onAdd, systemConfig, gstRates, initialData, isEdit, existingCompanies }) => {
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [formData, setFormData] = useState<any>({
        name: '', company: '', hsnCode: '', gst: 0, barcode: '', composition: '', unitsPerStrip: 1, isScheduleH: false
    });
    const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
    const [activeCompanyIndex, setActiveCompanyIndex] = useState(-1);
    const activeSuggestionRef = useRef<HTMLLIElement>(null);

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
            setShowCompanySuggestions(false);
            setActiveCompanyIndex(-1);
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

    const companySuggestions = useMemo(() => {
        const input = (formData.company || '').toLowerCase();
        return existingCompanies.filter(c => c.toLowerCase().includes(input));
    }, [existingCompanies, formData.company]);

    // Reset index when suggestions change
    useEffect(() => {
        setActiveCompanyIndex(-1);
    }, [companySuggestions]);

    // Scroll active item into view
    useEffect(() => {
        activeSuggestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [activeCompanyIndex]);

    const handleSelectCompany = (company: string) => {
        setFormData({ ...formData, company });
        setShowCompanySuggestions(false);
    };

    const handleCompanyKeyDown = (e: React.KeyboardEvent) => {
        // If suggestions are not showing, only allow typing normally.
        // We might want to open suggestions on arrow down if closed.
        if (!showCompanySuggestions) {
            if (e.key === 'ArrowDown') {
                setShowCompanySuggestions(true);
            }
            return;
        }

        const exactMatch = companySuggestions.some(c => c.toLowerCase() === formData.company.toLowerCase());
        const hasAddOption = !exactMatch && formData.company.trim().length > 0;
        
        // Total navigable items: suggestions + optional "Add new" item at the end
        const totalItems = companySuggestions.length + (hasAddOption ? 1 : 0);

        if (totalItems === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveCompanyIndex(prev => (prev + 1) % totalItems);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveCompanyIndex(prev => (prev - 1 + totalItems) % totalItems);
                break;
            case 'Enter':
                e.preventDefault();
                if (activeCompanyIndex >= 0 && activeCompanyIndex < companySuggestions.length) {
                    handleSelectCompany(companySuggestions[activeCompanyIndex]);
                } else if (hasAddOption && activeCompanyIndex === companySuggestions.length) {
                    handleSelectCompany(formData.company);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setShowCompanySuggestions(false);
                break;
            case 'Tab':
                // Optional: Select current if highlighted on tab out
                if (activeCompanyIndex >= 0 && activeCompanyIndex < companySuggestions.length) {
                    handleSelectCompany(companySuggestions[activeCompanyIndex]);
                }
                setShowCompanySuggestions(false);
                break;
        }
    };

    if (!isOpen) return null;

    const exactMatch = companySuggestions.some(c => c.toLowerCase() === (formData.company || '').toLowerCase());
    const showAddOption = !exactMatch && (formData.company || '').trim().length > 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Product' : 'Add New Product'}>
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                <div><label className="block text-sm font-medium mb-1">Product Name</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputStyle} required /></div>
                
                <div className="relative">
                    <label className="block text-sm font-medium mb-1">Company</label>
                    <input 
                        type="text" 
                        value={formData.company} 
                        onChange={e => {
                            setFormData({...formData, company: e.target.value});
                            setShowCompanySuggestions(true);
                        }}
                        onFocus={() => setShowCompanySuggestions(true)}
                        onBlur={() => setTimeout(() => setShowCompanySuggestions(false), 200)}
                        onKeyDown={handleCompanyKeyDown}
                        className={inputStyle} 
                        required 
                        placeholder="Type to search or add new"
                    />
                    {showCompanySuggestions && (companySuggestions.length > 0 || showAddOption) && (
                        <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {companySuggestions.map((c, idx) => (
                                <li 
                                    key={idx} 
                                    ref={idx === activeCompanyIndex ? activeSuggestionRef : null}
                                    onMouseDown={() => handleSelectCompany(c)}
                                    className={`px-4 py-2 cursor-pointer text-sm text-slate-800 dark:text-slate-200 ${
                                        idx === activeCompanyIndex 
                                        ? 'bg-indigo-100 dark:bg-indigo-900' 
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-600'
                                    }`}
                                >
                                    {c}
                                </li>
                            ))}
                            {showAddOption && (
                                <li 
                                    ref={companySuggestions.length === activeCompanyIndex ? activeSuggestionRef : null}
                                    onMouseDown={() => handleSelectCompany(formData.company)}
                                    className={`px-4 py-2 cursor-pointer text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-2 ${
                                        companySuggestions.length === activeCompanyIndex 
                                        ? 'bg-green-100 dark:bg-green-900/30' 
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-600'
                                    }`}
                                >
                                    <PlusIcon className="h-4 w-4" /> Add "{formData.company}"
                                </li>
                            )}
                        </ul>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium mb-1">HSN Code</label><input type="text" value={formData.hsnCode} onChange={e => setFormData({...formData, hsnCode: e.target.value})} className={inputStyle} /></div>
                    <div>
                        <label className="block text-sm font-medium mb-1">GST (%)</label>
                        <select value={formData.gst} onChange={e => setFormData({...formData, gst: e.target.value})} className={inputStyle}>
                            {gstRates.map(r => <option key={r.id} value={r.rate}>{r.rate}%</option>)}
                        </select>
                    </div>
                </div>
                {!isPharmaMode && <div><label className="block text-sm font-medium mb-1">Barcode</label><input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className={inputStyle} placeholder="Leave blank for auto-generate" /></div>}
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
    const [view, setView] = useState<'products' | 'allStock' | 'selectedStock' | 'batches' | 'company' | 'expired' | 'nearExpiry'>('products');
    const [isAddProductOpen, setAddProductOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [printingProduct, setPrintingProduct] = useState<Product | null>(null);

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    const uniqueCompanies = useMemo(() => {
        return Array.from(new Set(products.map(p => p.company))).sort();
    }, [products]);

    const handleDeleteBatch = (pid: string, bid: string) => {
        const product = products.find(p => p.id === pid);
        if(product) {
            const updatedBatches = product.batches.filter(b => b.id !== bid);
            onUpdateProduct(pid, { batches: updatedBatches });
        }
    };

    const handleAddProductWrapper = async (productData: any) => {
        // Auto-generate barcode if blank, regardless of mode.
        if (!productData.barcode || productData.barcode.trim() === '') {
            let maxBarcode = 0;
            products.forEach(p => {
                if (p.barcode && /^\d+$/.test(p.barcode)) {
                    const num = parseInt(p.barcode, 10);
                    // Filter: Only consider barcodes with length <= 8 for the sequence to keep it clean from EANs
                    if (!isNaN(num) && num > maxBarcode && p.barcode.length <= 8) {
                        maxBarcode = num;
                    }
                }
            });
            // Ensure even if there are no products, we start with 000001
            const nextBarcode = (maxBarcode + 1).toString().padStart(6, '0');
            productData.barcode = nextBarcode;
        }
        await onAddProduct(productData);
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={() => setView('products')} className={`px-4 py-2 rounded-lg ${view === 'products' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800'}`}>Product Master</button>
                <button onClick={() => setView('allStock')} className={`px-4 py-2 rounded-lg ${view === 'allStock' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800'}`}>All Item Stock</button>
                <button onClick={() => setView('selectedStock')} className={`px-4 py-2 rounded-lg ${view === 'selectedStock' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800'}`}>{t.inventory.selectedStock}</button>
                {isPharmaMode && <button onClick={() => setView('batches')} className={`px-4 py-2 rounded-lg ${view === 'batches' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800'}`}>{t.inventory.batchStock}</button>}
                <button onClick={() => setView('company')} className={`px-4 py-2 rounded-lg ${view === 'company' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800'}`}>{t.inventory.companyStock}</button>
                {isPharmaMode && <button onClick={() => setView('expired')} className={`px-4 py-2 rounded-lg ${view === 'expired' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800'}`}>{t.inventory.expiredStock}</button>}
                {isPharmaMode && <button onClick={() => setView('nearExpiry')} className={`px-4 py-2 rounded-lg ${view === 'nearExpiry' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800'}`}>{t.inventory.nearExpiry}</button>}
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
                                    <th className="px-4 py-2">Barcode</th>
                                    <th className="px-4 py-2">Company</th>
                                    <th className="px-4 py-2">GST</th>
                                    <th className="px-4 py-2 text-right">MRP</th>
                                    <th className="px-4 py-2 text-right">Rate</th>
                                    <th className="px-4 py-2 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map(p => {
                                    // Logic for display MRP/Rate
                                    const batches = p.batches || [];
                                    const activeBatches = batches.filter(b => b.stock > 0);
                                    const targetBatches = activeBatches.length > 0 ? activeBatches : batches;
                                    // Heuristic: Max MRP as representative
                                    const displayBatch = targetBatches.length > 0 
                                        ? targetBatches.reduce((prev, current) => (prev.mrp > current.mrp) ? prev : current)
                                        : null;

                                    const mrpDisplay = displayBatch ? `₹${displayBatch.mrp.toFixed(2)}` : '-';
                                    const rateDisplay = displayBatch ? `₹${displayBatch.purchasePrice.toFixed(2)}` : '-';

                                    return (
                                    <tr key={p.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                        <td className="px-4 py-2 font-medium">
                                            {p.name}
                                            {isPharmaMode && p.composition && <div className="text-xs text-slate-500 dark:text-slate-400">{p.composition}</div>}
                                        </td>
                                        <td className="px-4 py-2 font-mono text-xs">{p.barcode || '-'}</td>
                                        <td className="px-4 py-2">{p.company}</td>
                                        <td className="px-4 py-2">{p.gst}%</td>
                                        <td className="px-4 py-2 text-right">{mrpDisplay}</td>
                                        <td className="px-4 py-2 text-right">{rateDisplay}</td>
                                        <td className="px-4 py-2 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={() => setPrintingProduct(p)} 
                                                    className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                                    title="Print Barcode Label"
                                                >
                                                    <BarcodeIcon className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => setEditingProduct(p)} className="text-blue-600 hover:text-blue-800"><PencilIcon className="h-4 w-4" /></button>
                                                <button onClick={() => onDeleteProduct(p.id)} className="text-red-600 hover:text-red-800"><TrashIcon className="h-4 w-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })}
                                {filteredProducts.length === 0 && (
                                    <tr><td colSpan={7} className="text-center py-8 text-slate-500">No products found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {view === 'allStock' && <AllItemStockView products={products} systemConfig={systemConfig} t={t} />}
            {view === 'selectedStock' && <SelectedItemStockView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} t={t} />}
            {view === 'batches' && isPharmaMode && <BatchWiseStockView products={products} onDeleteBatch={handleDeleteBatch} onUpdateProduct={onUpdateProduct} systemConfig={systemConfig} t={t} />}
            {view === 'company' && <CompanyWiseStockView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} t={t} />}
            {view === 'expired' && isPharmaMode && <ExpiredStockView products={products} onDeleteBatch={handleDeleteBatch} systemConfig={systemConfig} t={t} />}
            {view === 'nearExpiry' && isPharmaMode && <NearingExpiryStockView products={products} onDeleteBatch={handleDeleteBatch} systemConfig={systemConfig} t={t} />}

            <AddProductModal 
                isOpen={isAddProductOpen || !!editingProduct} 
                onClose={() => { setAddProductOpen(false); setEditingProduct(null); }} 
                onAdd={async (data) => {
                    if (editingProduct) {
                        await onUpdateProduct(editingProduct.id, data);
                    } else {
                        await handleAddProductWrapper(data);
                    }
                }}
                systemConfig={systemConfig} 
                gstRates={gstRates} 
                initialData={editingProduct || undefined}
                isEdit={!!editingProduct}
                existingCompanies={uniqueCompanies}
            />
            
            {printingProduct && (
                <PrintBarcodeModal 
                    isOpen={!!printingProduct}
                    onClose={() => setPrintingProduct(null)}
                    product={printingProduct}
                />
            )}
        </div>
    );
};

export default Inventory;

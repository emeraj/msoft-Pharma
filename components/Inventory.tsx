
import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import type { Product, Batch, Company, Bill, Purchase, SystemConfig, CompanyProfile, GstRate } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, DownloadIcon, TrashIcon, PencilIcon, UploadIcon, BarcodeIcon, CameraIcon, CheckCircleIcon } from './icons/Icons';
import BarcodeScannerModal from './BarcodeScannerModal';
import { getTranslation } from '../utils/translationHelper';

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

const formatStock = (stock: number, unitsPerStrip?: number): string => {
    if (stock === 0) return '0 Units';
    if (!unitsPerStrip || unitsPerStrip <= 1) {
        return `${stock} Units`;
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
    return result || '0 Units';
};

const getExpiryDate = (expiryString: string): Date => {
    if (!expiryString) return new Date('9999-12-31');
    const parts = expiryString.split('-');
    if (parts.length === 2) {
        const [year, month] = parts.map(Number);
        return new Date(year, month, 0); // Last day of the expiry month
    }
    return new Date(expiryString);
};

interface InventoryProps {
  products: Product[];
  companies: Company[];
  bills: Bill[];
  purchases: Purchase[];
  systemConfig: SystemConfig;
  companyProfile: CompanyProfile;
  gstRates: GstRate[];
  onAddProduct: (product: Omit<Product, 'id' | 'batches'>, firstBatch: Omit<Batch, 'id'>) => void;
  onUpdateProduct: (productId: string, productData: any) => void;
  onAddBatch: (productId: string, batch: Omit<Batch, 'id'>) => void;
  onDeleteBatch: (productId: string, batchId: string) => void;
  onDeleteProduct: (productId: string, productName: string) => void;
  onBulkAddProducts: (products: Omit<Product, 'id' | 'batches'>[]) => Promise<{success: number; skipped: number}>;
  initialSubView?: string;
  initialProductId?: string | null;
  onEditBill?: (bill: Bill, context?: any) => void;
  onEditPurchase?: (purchase: Purchase, context?: any) => void;
}

type InventorySubView = 'all' | 'selected' | 'batch' | 'company' | 'expired' | 'nearing_expiry';

const Inventory: React.FC<InventoryProps> = ({ products, companies, bills, purchases, systemConfig, companyProfile, gstRates, onAddProduct, onUpdateProduct, onAddBatch, onDeleteBatch, onDeleteProduct, onBulkAddProducts, initialSubView, initialProductId }) => {
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [isBatchModalOpen, setBatchModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isPrintLabelModalOpen, setPrintLabelModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubView, setActiveSubView] = useState<InventorySubView>((initialSubView as InventorySubView) || 'all');
  
  useEffect(() => {
      if (initialProductId && initialSubView === 'selected') {
          const prod = products.find(p => p.id === initialProductId);
          if (prod) setSelectedProduct(prod);
      }
  }, [initialProductId, initialSubView, products]);

  const t = getTranslation(systemConfig.language);
  const isPharmaMode = systemConfig.softwareMode === 'Pharma';

  const handleOpenBatchModal = (product: Product) => { setSelectedProduct(product); setBatchModalOpen(true); };
  const handleOpenEditModal = (product: Product) => { setSelectedProduct(product); setEditModalOpen(true); };
  const handleOpenPrintLabelModal = (product: Product) => { setSelectedProduct(product); setPrintLabelModalOpen(true); };

  const renderSubView = () => {
    switch (activeSubView) {
      case 'all': return <AllItemStockView products={products} purchases={purchases} bills={bills} onOpenBatchModal={handleOpenBatchModal} onOpenEditModal={handleOpenEditModal} onOpenPrintLabelModal={handleOpenPrintLabelModal} systemConfig={systemConfig} searchTerm={searchTerm} onSearchTermChange={setSearchTerm} onDeleteProduct={onDeleteProduct} t={t} />;
      case 'selected': return <SelectedItemStockView products={products} bills={bills} purchases={purchases} onDeleteBatch={onDeleteBatch} systemConfig={systemConfig} t={t} initialProduct={selectedProduct} onProductSelect={setSelectedProduct} />;
      case 'batch': return isPharmaMode ? <BatchWiseStockView products={products} onDeleteBatch={onDeleteBatch} systemConfig={systemConfig} t={t} /> : null;
      case 'company': return <CompanyWiseStockView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} t={t} />;
      case 'expired': return isPharmaMode ? <ExpiredStockView products={products} onDeleteBatch={onDeleteBatch} systemConfig={systemConfig} t={t} /> : null;
      case 'nearing_expiry': return isPharmaMode ? <NearingExpiryStockView products={products} onDeleteBatch={onDeleteBatch} systemConfig={systemConfig} t={t} /> : null;
      default: return <AllItemStockView products={products} purchases={purchases} bills={bills} onOpenBatchModal={handleOpenBatchModal} onOpenEditModal={handleOpenEditModal} onOpenPrintLabelModal={handleOpenPrintLabelModal} systemConfig={systemConfig} searchTerm={searchTerm} onSearchTermChange={setSearchTerm} onDeleteProduct={onDeleteProduct} t={t} />;
    }
  };
  
  const SubNavButton: React.FC<{view: InventorySubView, label: string}> = ({ view, label }) => (
    <button
        onClick={() => setActiveSubView(view)}
        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
            activeSubView === view
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
    >
        {label}
    </button>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{t.inventory.title}</h1>
          <div className="flex items-center gap-2">
             <button 
                onClick={() => setImportModalOpen(true)}
                className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg shadow hover:bg-slate-700 transition-colors duration-200"
              >
                <UploadIcon className="h-5 w-5" /> {t.inventory.import}
              </button>
              <button 
                onClick={() => setProductModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors duration-200"
              >
                <PlusIcon className="h-5 w-5" /> {t.inventory.addProduct}
              </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t dark:border-slate-700 mt-4 pt-4">
            <SubNavButton view="all" label={t.inventory.allStock} />
            <SubNavButton view="selected" label={t.inventory.selectedStock} />
            <SubNavButton view="company" label={t.inventory.companyStock} />
            {isPharmaMode && <SubNavButton view="batch" label={t.inventory.batchStock} />}
            {isPharmaMode && <SubNavButton view="expired" label={t.inventory.expiredStock} />}
            {isPharmaMode && <SubNavButton view="nearing_expiry" label={t.inventory.nearExpiry} />}
        </div>
      </Card>

      {renderSubView()}
      
      <AddProductModal 
        isOpen={isProductModalOpen}
        onClose={() => setProductModalOpen(false)}
        onAddProduct={onAddProduct}
        companies={companies}
        systemConfig={systemConfig}
        gstRates={gstRates}
        products={products}
        t={t}
      />

      {selectedProduct && isBatchModalOpen && (
        <AddBatchModal
          isOpen={isBatchModalOpen}
          onClose={() => { setBatchModalOpen(false); setSelectedProduct(null); }}
          product={selectedProduct}
          onAddBatch={onAddBatch}
          onDeleteBatch={onDeleteBatch}
          systemConfig={systemConfig}
        />
      )}
      
      {selectedProduct && isEditModalOpen && (
        <EditProductModal
          isOpen={isEditModalOpen}
          onClose={() => { setEditModalOpen(false); setSelectedProduct(null); }}
          product={selectedProduct}
          onUpdateProduct={onUpdateProduct}
          systemConfig={systemConfig}
          gstRates={gstRates}
        />
      )}

      {selectedProduct && isPrintLabelModalOpen && (
        <PrintLabelModal
          isOpen={isPrintLabelModalOpen}
          onClose={() => { setPrintLabelModalOpen(false); setSelectedProduct(null); }}
          product={selectedProduct}
          companyProfile={companyProfile}
          systemConfig={systemConfig}
        />
      )}

      <ImportProductsModal
        isOpen={isImportModalOpen}
        onClose={() => setImportModalOpen(false)}
        onBulkAddProducts={onBulkAddProducts}
      />

    </div>
  );
};

const inputStyle = "w-full px-4 py-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
const selectStyle = `${inputStyle} appearance-none`;

// --- Sub View Components ---
interface AllItemStockViewProps {
    products: Product[];
    purchases: Purchase[];
    bills: Bill[];
    systemConfig: SystemConfig;
    searchTerm: string;
    onSearchTermChange: (term: string) => void;
    onOpenBatchModal: (product: Product) => void;
    onOpenEditModal: (product: Product) => void;
    onOpenPrintLabelModal: (product: Product) => void;
    onDeleteProduct: (productId: string, productName: string) => void;
    t: any;
}

const AllItemStockView: React.FC<AllItemStockViewProps> = ({ products, purchases, bills, systemConfig, searchTerm, onSearchTermChange, onOpenBatchModal, onOpenEditModal, onOpenPrintLabelModal, onDeleteProduct, t }) => {
    const [companyFilter, setCompanyFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [isScanning, setIsScanning] = useState(false);
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    const companies = useMemo(() => [...new Set(products.map(p => p.company))].sort(), [products]);
    
    const reportData = useMemo(() => {
        const startDate = fromDate ? new Date(fromDate) : null;
        if (startDate) startDate.setHours(0, 0, 0, 0);
        const endDate = toDate ? new Date(toDate) : null;
        if (endDate) endDate.setHours(23, 59, 59, 999);
        const lowerSearchTerm = searchTerm.toLowerCase();
        return products.filter(product => (product.name.toLowerCase().includes(lowerSearchTerm) || product.id.toLowerCase() === lowerSearchTerm || (!isPharmaMode && product.barcode && product.barcode.includes(searchTerm))) && (companyFilter === '' || product.company === companyFilter)).map(product => {
                let purchasesInPeriod = 0; let salesInPeriod = 0; const unitsPerStrip = product.unitsPerStrip || 1;
                purchases.forEach(purchase => { const purchaseDate = new Date(purchase.invoiceDate); if ((!startDate || purchaseDate >= startDate) && (!endDate || purchaseDate <= endDate)) { purchase.items.forEach(item => { if (item.productId === product.id) { const itemUnitsPerStrip = item.unitsPerStrip || unitsPerStrip; purchasesInPeriod += item.quantity * itemUnitsPerStrip; } }); } });
                bills.forEach(bill => { const billDate = new Date(bill.date); if ((!startDate || billDate >= startDate) && (!endDate || billDate <= endDate)) { bill.items.forEach(item => { if (item.productId === product.id) { salesInPeriod += item.quantity; } }); } });
                const currentStock = product.batches.reduce((sum, batch) => sum + batch.stock, 0); const openingStock = currentStock - purchasesInPeriod + salesInPeriod; const stockValue = product.batches.reduce((sum, batch) => { const unitPrice = batch.mrp / (product.unitsPerStrip || 1); return sum + (unitPrice * batch.stock); }, 0); const latestMrp = product.batches.length > 0 ? Math.max(...product.batches.map(b => b.mrp)) : 0;
                return { id: product.id, name: product.name, company: product.company, composition: product.composition, unitsPerStrip: product.unitsPerStrip, isScheduleH: product.isScheduleH, barcode: product.barcode, openingStock, purchasedQty: purchasesInPeriod, soldQty: salesInPeriod, currentStock, stockValue, latestMrp, product };
            }).sort((a,b) => a.name.localeCompare(b.name));
    }, [products, purchases, bills, searchTerm, companyFilter, fromDate, toDate, isPharmaMode]);
    
    const handleExport = () => {
        if (reportData.length === 0) { alert("No data to export."); return; }
        const totalStockValue = reportData.reduce((sum, item) => sum + item.stockValue, 0);
        const exportData = reportData.map(data => ({
            'Product Name': data.name, 'Company': data.company, 'Barcode': data.barcode, 'Composition': data.composition, 'Schedule H': data.isScheduleH ? 'Yes' : 'No',
            'Opening Stock': formatStock(data.openingStock, data.unitsPerStrip), 'Purchased Qty (Period)': formatStock(data.purchasedQty, data.unitsPerStrip),
            'Sold Qty (Period)': formatStock(data.soldQty, data.unitsPerStrip), 'Current Stock': formatStock(data.currentStock, data.unitsPerStrip),
            'MRP': data.latestMrp.toFixed(2), 'Stock Value (MRP)': data.stockValue.toFixed(2),
        }));
        const headers = Object.keys(exportData[0]);
        const escapeCell = (cell: any) => { let strCell = cell === null || cell === undefined ? '' : String(cell); if (/[",\n]/.test(strCell)) { strCell = `"${strCell.replace(/"/g, '""')}"`; } return strCell; };
        const headerRow = headers.join(',');
        const dataRows = exportData.map(row => headers.map(header => escapeCell((row as any)[header])).join(','));
        const footerCells = new Array(headers.length).fill(''); footerCells[headers.length - 2] = 'Total Stock Value'; footerCells[headers.length - 1] = totalStockValue.toFixed(2); const footerRow = footerCells.join(',');
        const csvContent = [headerRow, ...dataRows, '', footerRow].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); if (link.download !== undefined) { const url = URL.createObjectURL(blob); link.setAttribute("href", url); link.setAttribute("download", 'all_item_stock_report.csv'); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); }
    };

    const handleScanSuccess = (decodedText: string) => {
        onSearchTermChange(decodedText);
        setIsScanning(false);
    };

    return (
        <Card title={t.inventory.allStock}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <input type="text" placeholder={t.inventory.searchPlaceholder} value={searchTerm} onChange={e => onSearchTermChange(e.target.value)} className={inputStyle} />
                    <button
                        onClick={() => setIsScanning(true)}
                        className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors flex-shrink-0"
                        title="Scan Barcode"
                    >
                        <CameraIcon className="h-6 w-6" />
                    </button>
                </div>
                <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className={selectStyle}>
                    <option value="">All Companies</option>
                    {companies.map(company => <option key={company} value={company}>{company}</option>)}
                </select>
                <div className="flex items-center gap-2">
                    <label htmlFor="fromDate-ais" className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">From</label>
                    <input type="date" id="fromDate-ais" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputStyle} />
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor="toDate-ais" className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">To</label>
                    <input type="date" id="toDate-ais" value={toDate} onChange={e => setToDate(e.target.value)} className={inputStyle} />
                </div>
            </div>
            <div className="flex justify-end mb-4">
                <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors duration-200">
                    <DownloadIcon className="h-5 w-5" /> Export to Excel
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                        <tr>
                            <th scope="col" className="px-6 py-3">{t.inventory.productName}</th>
                            <th scope="col" className="px-6 py-3 text-center">{t.inventory.openingStock}</th>
                            <th scope="col" className="px-6 py-3 text-center">{t.inventory.purchased}</th>
                            <th scope="col" className="px-6 py-3 text-center">{t.inventory.sold}</th>
                            <th scope="col" className="px-6 py-3 text-center">{t.inventory.currentStock}</th>
                            <th scope="col" className="px-6 py-3 text-right">{t.inventory.mrp}</th>
                            <th scope="col" className="px-6 py-3 text-right">{t.inventory.stockValue}</th>
                            <th scope="col" className="px-6 py-3">{t.inventory.actions}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(item => (
                            <tr key={item.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                <td scope="row" className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                                    {item.name}
                                    {isPharmaMode && item.isScheduleH && <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-orange-600 dark:bg-orange-700 rounded-full">Sch. H</span>}
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">{item.company}</p>
                                    {!isPharmaMode && item.barcode && <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">Barcode: {item.barcode}</p>}
                                    {isPharmaMode && <p className="text-xs text-indigo-600 dark:text-indigo-400 font-normal">{item.composition}</p>}
                                </td>
                                <td className="px-6 py-4 text-center">{formatStock(item.openingStock, item.unitsPerStrip)}</td>
                                <td className="px-6 py-4 text-center">{formatStock(item.purchasedQty, item.unitsPerStrip)}</td>
                                <td className="px-6 py-4 text-center">{formatStock(item.soldQty, item.unitsPerStrip)}</td>
                                <td className="px-6 py-4 text-center font-bold">{formatStock(item.currentStock, item.unitsPerStrip)}</td>
                                <td className="px-6 py-4 text-right font-semibold">₹{item.latestMrp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="px-6 py-4 text-right font-semibold">₹{item.stockValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => onOpenBatchModal(item.product)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap">
                                            {isPharmaMode ? 'View/Add Batch' : 'View Stock'}
                                        </button>
                                        <button onClick={() => onOpenEditModal(item.product)} title="Edit Product" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50">
                                            <PencilIcon className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => onOpenPrintLabelModal(item.product)} title="Print Barcode Label" className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900/50">
                                            <BarcodeIcon className="h-5 w-5" />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if (window.confirm(`Are you sure you want to delete the product "${item.name}"? This action cannot be undone.`)) {
                                                    onDeleteProduct(item.product.id, item.product.name);
                                                }
                                            }}
                                            title="Delete Product" 
                                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {reportData.length === 0 && (
                    <div className="text-center py-10 text-slate-600 dark:text-slate-400"><p>No products found.</p></div>
                )}
            </div>
            
            <BarcodeScannerModal 
                isOpen={isScanning} 
                onClose={() => setIsScanning(false)} 
                onScanSuccess={handleScanSuccess} 
            />
        </Card>
    );
};

const SelectedItemStockView: React.FC<{products: Product[], bills: Bill[], purchases: Purchase[], onDeleteBatch: (productId: string, batchId: string) => void, systemConfig: SystemConfig, t: any, initialProduct: Product | null, onProductSelect: (p: Product | null) => void }> = ({ products, bills, purchases, onDeleteBatch, systemConfig, t, initialProduct, onProductSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(initialProduct);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    useEffect(() => {
        if (initialProduct) {
            setSelectedProduct(initialProduct);
            setSearchTerm(initialProduct.name);
        }
    }, [initialProduct]);

    const searchResults = useMemo(() => {
        if (!searchTerm || selectedProduct) return [];
        const term = searchTerm.toLowerCase();
        return products.filter(p => p.name.toLowerCase().includes(term) || (!isPharmaMode && p.barcode && p.barcode.includes(term))).slice(0, 10);
    }, [searchTerm, products, selectedProduct, isPharmaMode]);

    const handleSelect = (product: Product) => {
        setSelectedProduct(product);
        setSearchTerm(product.name);
        if(onProductSelect) onProductSelect(product);
    };

    const stockLedger = useMemo(() => {
        if (!selectedProduct) return { openingBalance: 0, transactions: [], closingBalance: 0 };

        const startDate = fromDate ? new Date(fromDate) : null;
        if (startDate) startDate.setHours(0, 0, 0, 0);
        
        const endDate = toDate ? new Date(toDate) : null;
        if (endDate) endDate.setHours(23, 59, 59, 999);

        // 1. Collect all transactions (Sales & Purchases)
        const allTransactions: { date: Date; type: 'Purchase' | 'Sale'; qty: number; invoiceNo: string; party: string; }[] = [];

        // Sales
        bills.forEach(bill => {
            bill.items.forEach(item => {
                if (item.productId === selectedProduct.id) {
                    allTransactions.push({
                        date: new Date(bill.date),
                        type: 'Sale',
                        qty: item.quantity,
                        invoiceNo: bill.billNumber,
                        party: bill.customerName
                    });
                }
            });
        });

        // Purchases
        purchases.forEach(purchase => {
            purchase.items.forEach(item => {
                const units = item.unitsPerStrip || selectedProduct.unitsPerStrip || 1;
                if (item.productId === selectedProduct.id || (!item.productId && item.productName === selectedProduct.name)) {
                    allTransactions.push({
                        date: new Date(purchase.invoiceDate),
                        type: 'Purchase',
                        qty: item.quantity * units,
                        invoiceNo: purchase.invoiceNumber,
                        party: purchase.supplier
                    });
                }
            });
        });

        // 2. Sort by date descending (Newest first) for display
        allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());

        // 3. Current Stock is the authoritative closing balance
        const currentStock = selectedProduct.batches.reduce((sum, b) => sum + b.stock, 0);
        
        // 4. Calculate Balances backwards
        let runningBalance = currentStock;
        
        const history = allTransactions.map(tx => {
            const balanceAfter = runningBalance;
            if (tx.type === 'Sale') {
                runningBalance += tx.qty; // Reverse: Sale reduced stock, so before sale it was higher
            } else {
                runningBalance -= tx.qty; // Reverse: Purchase increased stock, so before purchase it was lower
            }
            return { ...tx, balance: balanceAfter };
        });

        // Filter for display
        const filteredHistory = history.filter(tx => {
            if (startDate && tx.date < startDate) return false;
            if (endDate && tx.date > endDate) return false;
            return true;
        });

        // Opening balance for the selected period is the runningBalance after traversing all transactions back to start date
        // However, if we filter, the last item in filteredHistory (which is earliest in time) would have the balance after that txn.
        // The balance *before* the earliest transaction in the period is effectively the opening balance.
        // `runningBalance` currently holds the stock at the very beginning of time (or start of all records).
        // Let's re-calculate forward for the period to be precise.
        
        // Re-approach: Sort ascending for forward calculation
        allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());
        
        let periodOpening = 0; // Default
        
        // We need to calculate what the stock was at `startDate`.
        // Start from current stock and go back until `startDate`.
        let tempStock = currentStock;
        // Iterate backwards from latest to earliest
        for (let i = allTransactions.length - 1; i >= 0; i--) {
            const tx = allTransactions[i];
            if (startDate && tx.date < startDate) {
                // We reached before the period. `tempStock` is the opening balance.
                break;
            }
            // Reverse logic to go back in time
            if (tx.type === 'Sale') tempStock += tx.qty;
            else tempStock -= tx.qty;
        }
        periodOpening = tempStock;

        return { 
            openingBalance: periodOpening, 
            transactions: filteredHistory, 
            closingBalance: currentStock 
        };

    }, [selectedProduct, bills, purchases, fromDate, toDate]);

    return (
        <Card title={t.inventory.selectedStock}>
            <div className="space-y-4">
                <div className="relative">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Search Product</label>
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setSelectedProduct(null); }}
                        placeholder="Type to search..." 
                        className={inputStyle}
                    />
                    {searchResults.length > 0 && (
                        <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {searchResults.map(p => (
                                <li 
                                    key={p.id} 
                                    onClick={() => handleSelect(p)}
                                    className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-slate-800 dark:text-slate-200"
                                >
                                    {p.name} ({p.company})
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {selectedProduct && (
                    <div className="space-y-6">
                        <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">{selectedProduct.name}</h3>
                            <p className="text-slate-600 dark:text-slate-400">{selectedProduct.company}</p>
                            <p className="text-sm mt-1">Current Stock: <span className="font-bold">{formatStock(selectedProduct.batches.reduce((sum, b) => sum + b.stock, 0), selectedProduct.unitsPerStrip)}</span></p>
                        </div>

                        {/* Date Filters */}
                        <div className="flex gap-4">
                            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputStyle} />
                            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inputStyle} />
                        </div>

                        {/* Ledger Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                                <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                                    <tr>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Particulars</th>
                                        <th className="px-4 py-3 text-right">In</th>
                                        <th className="px-4 py-3 text-right">Out</th>
                                        <th className="px-4 py-3 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="bg-slate-50 dark:bg-slate-700 font-semibold">
                                        <td colSpan={5} className="px-4 py-2 text-right">Opening Balance:</td>
                                        <td className="px-4 py-2 text-right">{formatStock(stockLedger.openingBalance, selectedProduct.unitsPerStrip)}</td>
                                    </tr>
                                    {stockLedger.transactions.map((tx, idx) => (
                                        <tr key={idx} className="border-b dark:border-slate-700">
                                            <td className="px-4 py-2">{tx.date.toLocaleDateString()}</td>
                                            <td className="px-4 py-2">
                                                <span className={`px-2 py-0.5 rounded text-xs ${tx.type === 'Purchase' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {tx.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2">
                                                {tx.type === 'Purchase' ? `Inv: ${tx.invoiceNo} (${tx.party})` : `Bill: ${tx.invoiceNo} (${tx.party})`}
                                            </td>
                                            <td className="px-4 py-2 text-right">{tx.type === 'Purchase' ? formatStock(tx.qty, selectedProduct.unitsPerStrip) : '-'}</td>
                                            <td className="px-4 py-2 text-right">{tx.type === 'Sale' ? formatStock(tx.qty, selectedProduct.unitsPerStrip) : '-'}</td>
                                            <td className="px-4 py-2 text-right font-medium">{formatStock(tx.balance, selectedProduct.unitsPerStrip)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
};

const CompanyWiseStockView: React.FC<{products: Product[], purchases: Purchase[], bills: Bill[], systemConfig: SystemConfig, t: any}> = ({ products, purchases, bills, systemConfig, t }) => {
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const companies = useMemo(() => [...new Set(products.map(p => p.company))].sort(), [products]);
    const [selectedCompany, setSelectedCompany] = useState('');

    const filteredProducts = useMemo(() => {
        if (!selectedCompany) return [];
        return products.filter(p => p.company === selectedCompany);
    }, [selectedCompany, products]);

    return (
        <Card title={t.inventory.companyStock}>
            <div className="mb-4">
                <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} className={selectStyle}>
                    <option value="">Select Company</option>
                    {companies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            {selectedCompany && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                        <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="px-6 py-3">Product Name</th>
                                <th className="px-6 py-3 text-center">Stock</th>
                                <th className="px-6 py-3 text-right">Value (MRP)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map(p => {
                                const stock = p.batches.reduce((sum, b) => sum + b.stock, 0);
                                const value = p.batches.reduce((sum, b) => sum + (b.stock * (b.mrp / (p.unitsPerStrip || 1))), 0);
                                return (
                                    <tr key={p.id} className="border-b dark:border-slate-700">
                                        <td className="px-6 py-4">{p.name}</td>
                                        <td className="px-6 py-4 text-center">{formatStock(stock, p.unitsPerStrip)}</td>
                                        <td className="px-6 py-4 text-right">₹{value.toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );
};

const BatchWiseStockView: React.FC<{products: Product[], onDeleteBatch: (pId: string, bId: string) => void, systemConfig: SystemConfig, t: any}> = ({ products, onDeleteBatch, systemConfig, t }) => {
    const allBatches = useMemo(() => {
        const batches: any[] = [];
        products.forEach(p => {
            p.batches.forEach(b => {
                batches.push({
                    productId: p.id,
                    productName: p.name,
                    company: p.company,
                    unitsPerStrip: p.unitsPerStrip,
                    ...b
                });
            });
        });
        return batches.sort((a, b) => getExpiryDate(a.expiryDate).getTime() - getExpiryDate(b.expiryDate).getTime());
    }, [products]);

    return (
        <Card title={t.inventory.batchStock}>
            <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700 sticky top-0">
                        <tr>
                            <th className="px-4 py-3">Product</th>
                            <th className="px-4 py-3">Batch</th>
                            <th className="px-4 py-3">Expiry</th>
                            <th className="px-4 py-3 text-center">Stock</th>
                            <th className="px-4 py-3 text-right">MRP</th>
                            <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allBatches.map((b, idx) => (
                            <tr key={`${b.productId}-${b.id}-${idx}`} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                                <td className="px-4 py-3">
                                    <div className="font-medium">{b.productName}</div>
                                    <div className="text-xs text-slate-500">{b.company}</div>
                                </td>
                                <td className="px-4 py-3">{b.batchNumber}</td>
                                <td className="px-4 py-3">{b.expiryDate}</td>
                                <td className="px-4 py-3 text-center">{formatStock(b.stock, b.unitsPerStrip)}</td>
                                <td className="px-4 py-3 text-right">₹{b.mrp.toFixed(2)}</td>
                                <td className="px-4 py-3 text-center">
                                    <button onClick={() => onDeleteBatch(b.productId, b.id)} className="text-red-500 hover:text-red-700">
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

const ExpiredStockView: React.FC<{products: Product[], onDeleteBatch: (pId: string, bId: string) => void, systemConfig: SystemConfig, t: any}> = ({ products, onDeleteBatch, systemConfig, t }) => {
    const expiredBatches = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const batches: any[] = [];
        products.forEach(p => {
            p.batches.forEach(b => {
                if (getExpiryDate(b.expiryDate) < today && b.stock > 0) {
                    batches.push({
                        productId: p.id,
                        productName: p.name,
                        company: p.company,
                        unitsPerStrip: p.unitsPerStrip,
                        ...b
                    });
                }
            });
        });
        return batches;
    }, [products]);

    return (
        <Card title={t.inventory.expiredStock}>
            {expiredBatches.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                        <thead className="text-xs text-red-800 dark:text-red-300 uppercase bg-red-50 dark:bg-red-900/20">
                            <tr>
                                <th className="px-4 py-3">Product</th>
                                <th className="px-4 py-3">Batch</th>
                                <th className="px-4 py-3">Expiry</th>
                                <th className="px-4 py-3 text-center">Stock</th>
                                <th className="px-4 py-3 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expiredBatches.map((b, idx) => (
                                <tr key={idx} className="border-b dark:border-slate-700 text-red-600 dark:text-red-400">
                                    <td className="px-4 py-3">{b.productName}</td>
                                    <td className="px-4 py-3">{b.batchNumber}</td>
                                    <td className="px-4 py-3 font-bold">{b.expiryDate}</td>
                                    <td className="px-4 py-3 text-center">{formatStock(b.stock, b.unitsPerStrip)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button onClick={() => onDeleteBatch(b.productId, b.id)} className="text-red-600 hover:text-red-800 underline">
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-center py-6 text-green-600 dark:text-green-400">No expired stock found!</p>
            )}
        </Card>
    );
};

const NearingExpiryStockView: React.FC<{products: Product[], onDeleteBatch: (pId: string, bId: string) => void, systemConfig: SystemConfig, t: any}> = ({ products, onDeleteBatch, systemConfig, t }) => {
    const nearExpiryBatches = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const next30Days = new Date(today);
        next30Days.setDate(today.getDate() + 30);
        
        const batches: any[] = [];
        products.forEach(p => {
            p.batches.forEach(b => {
                const exp = getExpiryDate(b.expiryDate);
                if (exp >= today && exp <= next30Days && b.stock > 0) {
                    batches.push({
                        productId: p.id,
                        productName: p.name,
                        company: p.company,
                        unitsPerStrip: p.unitsPerStrip,
                        ...b
                    });
                }
            });
        });
        return batches;
    }, [products]);

    return (
        <Card title={t.inventory.nearExpiry}>
            {nearExpiryBatches.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                        <thead className="text-xs text-yellow-800 dark:text-yellow-300 uppercase bg-yellow-50 dark:bg-yellow-900/20">
                            <tr>
                                <th className="px-4 py-3">Product</th>
                                <th className="px-4 py-3">Batch</th>
                                <th className="px-4 py-3">Expiry</th>
                                <th className="px-4 py-3 text-center">Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            {nearExpiryBatches.map((b, idx) => (
                                <tr key={idx} className="border-b dark:border-slate-700">
                                    <td className="px-4 py-3">{b.productName}</td>
                                    <td className="px-4 py-3">{b.batchNumber}</td>
                                    <td className="px-4 py-3 font-bold text-yellow-600 dark:text-yellow-400">{b.expiryDate}</td>
                                    <td className="px-4 py-3 text-center">{formatStock(b.stock, b.unitsPerStrip)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-center py-6 text-slate-600 dark:text-slate-400">No batches expiring in the next 30 days.</p>
            )}
        </Card>
    );
};

// --- Modals ---

const AddProductModal: React.FC<any> = ({ isOpen, onClose, onAddProduct, companies, systemConfig, gstRates, products, t }) => {
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [formData, setFormData] = useState({
        name: '', company: '', hsnCode: '', gst: '0', barcode: '', composition: '', unitsPerStrip: '1', isScheduleH: 'No',
        batchNumber: isPharmaMode ? '' : 'DEFAULT', expiryDate: isPharmaMode ? '' : '2099-12', stock: '0', mrp: '0', purchasePrice: '0'
    });

    const handleChange = (e: any) => setFormData({...formData, [e.target.name]: e.target.value});

    const handleSubmit = (e: any) => {
        e.preventDefault();
        onAddProduct(
            {
                name: formData.name, company: formData.company, hsnCode: formData.hsnCode, gst: parseFloat(formData.gst),
                barcode: formData.barcode, composition: formData.composition, unitsPerStrip: parseInt(formData.unitsPerStrip),
                isScheduleH: formData.isScheduleH === 'Yes'
            },
            {
                batchNumber: formData.batchNumber, expiryDate: formData.expiryDate, stock: parseInt(formData.stock),
                mrp: parseFloat(formData.mrp), purchasePrice: parseFloat(formData.purchasePrice)
            }
        );
        onClose();
        setFormData({
            name: '', company: '', hsnCode: '', gst: '0', barcode: '', composition: '', unitsPerStrip: '1', isScheduleH: 'No',
            batchNumber: isPharmaMode ? '' : 'DEFAULT', expiryDate: isPharmaMode ? '' : '2099-12', stock: '0', mrp: '0', purchasePrice: '0'
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t.inventory.addProduct}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input name="name" value={formData.name} onChange={handleChange} placeholder="Product Name" className={inputStyle} required />
                <input name="company" value={formData.company} onChange={handleChange} placeholder="Company" className={inputStyle} required list="companies" />
                <datalist id="companies">{companies.map((c: any) => <option key={c.id} value={c.name} />)}</datalist>
                <div className="grid grid-cols-2 gap-4">
                    <input name="hsnCode" value={formData.hsnCode} onChange={handleChange} placeholder="HSN" className={inputStyle} />
                    <select name="gst" value={formData.gst} onChange={handleChange} className={selectStyle}>
                        {gstRates.map((r: any) => <option key={r.id} value={r.rate}>{r.rate}%</option>)}
                    </select>
                </div>
                {!isPharmaMode && <input name="barcode" value={formData.barcode} onChange={handleChange} placeholder="Barcode" className={inputStyle} />}
                {isPharmaMode && <input name="composition" value={formData.composition} onChange={handleChange} placeholder="Composition" className={inputStyle} />}
                {isPharmaMode && (
                    <div className="grid grid-cols-2 gap-4">
                        <input name="unitsPerStrip" type="number" value={formData.unitsPerStrip} onChange={handleChange} placeholder="Units/Strip" className={inputStyle} />
                        <select name="isScheduleH" value={formData.isScheduleH} onChange={handleChange} className={selectStyle}>
                            <option value="No">Not Sch. H</option>
                            <option value="Yes">Sch. H</option>
                        </select>
                    </div>
                )}
                <div className="border-t pt-4 mt-4">
                    <h4 className="font-semibold mb-2">Initial Stock</h4>
                    <div className="grid grid-cols-2 gap-4">
                        {isPharmaMode && <input name="batchNumber" value={formData.batchNumber} onChange={handleChange} placeholder="Batch" className={inputStyle} required />}
                        {isPharmaMode && <input name="expiryDate" type="month" value={formData.expiryDate} onChange={handleChange} className={inputStyle} required />}
                        <input name="stock" type="number" value={formData.stock} onChange={handleChange} placeholder="Stock" className={inputStyle} required />
                        <input name="mrp" type="number" value={formData.mrp} onChange={handleChange} placeholder="MRP" className={inputStyle} required />
                        <input name="purchasePrice" type="number" value={formData.purchasePrice} onChange={handleChange} placeholder="Purchase Price" className={inputStyle} required />
                    </div>
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded">Save Product</button>
            </form>
        </Modal>
    );
};

const AddBatchModal: React.FC<any> = ({ isOpen, onClose, product, onAddBatch, onDeleteBatch, systemConfig }) => {
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [formData, setFormData] = useState({
        batchNumber: '', expiryDate: '', stock: '', mrp: '', purchasePrice: ''
    });

    const handleSubmit = (e: any) => {
        e.preventDefault();
        onAddBatch(product.id, {
            batchNumber: formData.batchNumber || 'DEFAULT',
            expiryDate: formData.expiryDate || '2099-12',
            stock: parseInt(formData.stock),
            mrp: parseFloat(formData.mrp),
            purchasePrice: parseFloat(formData.purchasePrice)
        });
        setFormData({ batchNumber: '', expiryDate: '', stock: '', mrp: '', purchasePrice: '' });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Manage Stock: ${product.name}`}>
            <div className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-4 border-b pb-6">
                    <h4 className="font-semibold">Add New Batch</h4>
                    <div className="grid grid-cols-2 gap-4">
                        {isPharmaMode && <input name="batchNumber" value={formData.batchNumber} onChange={(e) => setFormData({...formData, batchNumber: e.target.value})} placeholder="Batch No" className={inputStyle} required />}
                        {isPharmaMode && <input name="expiryDate" type="month" value={formData.expiryDate} onChange={(e) => setFormData({...formData, expiryDate: e.target.value})} className={inputStyle} required />}
                        <input name="stock" type="number" value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})} placeholder="Qty" className={inputStyle} required />
                        <input name="mrp" type="number" value={formData.mrp} onChange={(e) => setFormData({...formData, mrp: e.target.value})} placeholder="MRP" className={inputStyle} required />
                        <input name="purchasePrice" type="number" value={formData.purchasePrice} onChange={(e) => setFormData({...formData, purchasePrice: e.target.value})} placeholder="Purchase Rate" className={inputStyle} required />
                    </div>
                    <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Add Stock</button>
                </form>
                <div>
                    <h4 className="font-semibold mb-2">Existing Batches</h4>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="p-2 text-left">Batch</th>
                                <th className="p-2 text-left">Exp</th>
                                <th className="p-2 text-center">Stock</th>
                                <th className="p-2 text-right">MRP</th>
                                <th className="p-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {product.batches.map((b: any) => (
                                <tr key={b.id} className="border-b">
                                    <td className="p-2">{b.batchNumber}</td>
                                    <td className="p-2">{b.expiryDate}</td>
                                    <td className="p-2 text-center">{b.stock}</td>
                                    <td className="p-2 text-right">{b.mrp}</td>
                                    <td className="p-2"><button onClick={() => onDeleteBatch(product.id, b.id)} className="text-red-500"><TrashIcon className="h-4 w-4"/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Modal>
    );
};

const EditProductModal: React.FC<any> = ({ isOpen, onClose, product, onUpdateProduct, systemConfig, gstRates }) => {
    const [formData, setFormData] = useState({...product});
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    const handleSubmit = (e: any) => {
        e.preventDefault();
        onUpdateProduct(product.id, formData);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Product">
            <form onSubmit={handleSubmit} className="space-y-4">
                <input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className={inputStyle} placeholder="Name" />
                <input value={formData.company} onChange={(e) => setFormData({...formData, company: e.target.value})} className={inputStyle} placeholder="Company" />
                <div className="grid grid-cols-2 gap-4">
                    <input value={formData.hsnCode} onChange={(e) => setFormData({...formData, hsnCode: e.target.value})} className={inputStyle} placeholder="HSN" />
                    <select value={formData.gst} onChange={(e) => setFormData({...formData, gst: parseFloat(e.target.value)})} className={selectStyle}>
                        {gstRates.map((r: any) => <option key={r.id} value={r.rate}>{r.rate}%</option>)}
                    </select>
                </div>
                {!isPharmaMode && <input value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} className={inputStyle} placeholder="Barcode" />}
                {isPharmaMode && <input value={formData.composition} onChange={(e) => setFormData({...formData, composition: e.target.value})} className={inputStyle} placeholder="Composition" />}
                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">Update</button>
            </form>
        </Modal>
    );
};

const PrintLabelModal: React.FC<any> = ({ isOpen, onClose, product, companyProfile }) => {
    const handlePrint = () => {
        const w = window.open('', '_blank');
        if(w) {
            w.document.write(`<html><body><div style="text-align:center; font-family:sans-serif;"><h3>${companyProfile.name}</h3><p><strong>${product.name}</strong></p><p>MRP: ${product.batches[0]?.mrp}</p><svg id="barcode"></svg></div><script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script><script>JsBarcode("#barcode", "${product.barcode || product.id}", {height:40}); window.print();</script></body></html>`);
            w.document.close();
        }
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Print Label">
            <div className="text-center p-4">
                <p className="mb-4">Print barcode label for <strong>{product.name}</strong>?</p>
                <button onClick={handlePrint} className="bg-indigo-600 text-white px-4 py-2 rounded">Print</button>
            </div>
        </Modal>
    );
};

const ImportProductsModal: React.FC<any> = ({ isOpen, onClose, onBulkAddProducts }) => {
    const [csvData, setCsvData] = useState('');
    const handleImport = async () => {
        const rows = csvData.trim().split('\n').map(row => row.split(','));
        // Assuming CSV structure: Name,Company,MRP
        const products = rows.slice(1).map(r => ({
            name: r[0], company: r[1], hsnCode: '', gst: 0,
            batches: [{ batchNumber: 'IMP', expiryDate: '2099-12', stock: 100, mrp: parseFloat(r[2]) || 0, purchasePrice: 0 }]
        }));
        await onBulkAddProducts(products as any);
        onClose();
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import Products">
            <div className="space-y-4">
                <p className="text-sm text-slate-500">Paste CSV data (Name,Company,MRP):</p>
                <textarea value={csvData} onChange={(e) => setCsvData(e.target.value)} className="w-full h-40 p-2 border rounded" />
                <button onClick={handleImport} className="bg-green-600 text-white px-4 py-2 rounded">Import</button>
            </div>
        </Modal>
    );
};

export default Inventory;


import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import type { Product, Batch, Company, Bill, Purchase, SystemConfig, CompanyProfile, GstRate } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, DownloadIcon, TrashIcon, PencilIcon, UploadIcon, BarcodeIcon, CameraIcon, CheckCircleIcon } from './icons/Icons';
import BarcodeScannerModal from './BarcodeScannerModal';
import { getTranslation } from '../utils/translationHelper';

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

// ... (Sub Views) ...

const getExpiryDate = (expiryString: string): Date => {
    if (!expiryString) return new Date('9999-12-31');
    const parts = expiryString.split('-');
    if (parts.length === 2) {
        const [year, month] = parts.map(Number);
        return new Date(year, month, 0);
    }
    return new Date(expiryString);
};

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
                purchases.forEach(purchase => { const purchaseDate = new Date(purchase.invoiceDate); if ((!startDate || purchaseDate >= startDate) && (!endDate || purchaseDate <= endDate)) { purchase.items.forEach(item => { if (item.productId === product.id || (!item.productId && item.productName.toLowerCase() === product.name.toLowerCase())) { const itemUnitsPerStrip = item.unitsPerStrip || unitsPerStrip; purchasesInPeriod += item.quantity * itemUnitsPerStrip; } }); } });
                bills.forEach(bill => { const billDate = new Date(bill.date); if ((!startDate || billDate >= startDate) && (!endDate || billDate <= endDate)) { bill.items.forEach(item => { if (item.productId === product.id) { salesInPeriod += item.quantity; } }); } });
                const currentStock = product.batches.reduce((sum, batch) => sum + batch.stock, 0); const openingStock = currentStock - purchasesInPeriod + salesInPeriod; const stockValue = product.batches.reduce((sum, batch) => { const unitPrice = batch.mrp / (product.unitsPerStrip || 1); return sum + (unitPrice * batch.stock); }, 0); const latestMrp = product.batches.length > 0 ? Math.max(...product.batches.map(b => b.mrp)) : 0;
                return { id: product.id, name: product.name, company: product.company, composition: product.composition, unitsPerStrip: product.unitsPerStrip, isScheduleH: product.isScheduleH, barcode: product.barcode, openingStock, purchasedQty: purchasesInPeriod, soldQty: salesInPeriod, currentStock, stockValue, latestMrp, product };
            }).sort((a,b) => a.name.localeCompare(b.name));
    }, [products, purchases, bills, searchTerm, companyFilter, fromDate, toDate, isPharmaMode]);
    
    const handleExport = () => { if (reportData.length === 0) { alert("No data to export."); return; } const totalStockValue = reportData.reduce((sum, item) => sum + item.stockValue, 0); const exportData = reportData.map(data => ({ 'Product Name': data.name, 'Company': data.company, 'Barcode': data.barcode, 'Composition': data.composition, 'Schedule H': data.isScheduleH ? 'Yes' : 'No', 'Opening Stock': formatStock(data.openingStock, data.unitsPerStrip), 'Purchased Qty (Period)': formatStock(data.purchasedQty, data.unitsPerStrip), 'Sold Qty (Period)': formatStock(data.soldQty, data.unitsPerStrip), 'Current Stock': formatStock(data.currentStock, data.unitsPerStrip), 'MRP': data.latestMrp.toFixed(2), 'Stock Value (MRP)': data.stockValue.toFixed(2), })); const headers = Object.keys(exportData[0]); const escapeCell = (cell: any) => { let strCell = cell === null || cell === undefined ? '' : String(cell); if (/[",\n]/.test(strCell)) { strCell = `"${strCell.replace(/"/g, '""')}"`; } return strCell; }; const headerRow = headers.join(','); const dataRows = exportData.map(row => headers.map(header => escapeCell((row as any)[header])).join(',')); const footerCells = new Array(headers.length).fill(''); footerCells[headers.length - 2] = 'Total Stock Value'; footerCells[headers.length - 1] = totalStockValue.toFixed(2); const footerRow = footerCells.join(','); const csvContent = [headerRow, ...dataRows, '', footerRow].join('\n'); const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); if (link.download !== undefined) { const url = URL.createObjectURL(blob); link.setAttribute("href", url); link.setAttribute("download", 'all_item_stock_report.csv'); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); } };
    const handleScanSuccess = (decodedText: string) => { onSearchTermChange(decodedText); setIsScanning(false); };

    return (
        <Card title={t.inventory.allStock}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <input type="text" placeholder={t.inventory.searchPlaceholder} value={searchTerm} onChange={e => onSearchTermChange(e.target.value)} className={inputStyle} />
                    <button onClick={() => setIsScanning(true)} className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors flex-shrink-0" title="Scan Barcode"><CameraIcon className="h-6 w-6" /></button>
                </div>
                <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className={selectStyle}><option value="">All Companies</option>{companies.map(company => <option key={company} value={company}>{company}</option>)}</select>
                <div className="flex items-center gap-2"><label htmlFor="fromDate-ais" className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">From</label><input type="date" id="fromDate-ais" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputStyle} /></div>
                <div className="flex items-center gap-2"><label htmlFor="toDate-ais" className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">To</label><input type="date" id="toDate-ais" value={toDate} onChange={e => setToDate(e.target.value)} className={inputStyle} /></div>
            </div>
            <div className="flex justify-end mb-4"><button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors duration-200"><DownloadIcon className="h-5 w-5" /> Export to Excel</button></div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                        <tr><th className="px-6 py-3">{t.inventory.productName}</th><th className="px-6 py-3 text-center">{t.inventory.openingStock}</th><th className="px-6 py-3 text-center">{t.inventory.purchased}</th><th className="px-6 py-3 text-center">{t.inventory.sold}</th><th className="px-6 py-3 text-center">{t.inventory.currentStock}</th><th className="px-6 py-3 text-right">{t.inventory.mrp}</th><th className="px-6 py-3 text-right">{t.inventory.stockValue}</th><th className="px-6 py-3">{t.inventory.actions}</th></tr>
                    </thead>
                    <tbody>
                        {reportData.map(item => (<tr key={item.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"><td className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">{item.name}{isPharmaMode && item.isScheduleH && <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-orange-600 dark:bg-orange-700 rounded-full">Sch. H</span>}<p className="text-xs text-slate-500 dark:text-slate-400 font-normal">{item.company}</p>{!isPharmaMode && item.barcode && <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">Barcode: {item.barcode}</p>}{isPharmaMode && <p className="text-xs text-indigo-600 dark:text-indigo-400 font-normal">{item.composition}</p>}</td><td className="px-6 py-4 text-center">{formatStock(item.openingStock, item.unitsPerStrip)}</td><td className="px-6 py-4 text-center">{formatStock(item.purchasedQty, item.unitsPerStrip)}</td><td className="px-6 py-4 text-center">{formatStock(item.soldQty, item.unitsPerStrip)}</td><td className="px-6 py-4 text-center font-bold">{formatStock(item.currentStock, item.unitsPerStrip)}</td><td className="px-6 py-4 text-right font-semibold">₹{item.latestMrp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="px-6 py-4 text-right font-semibold">₹{item.stockValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="px-6 py-4"><div className="flex items-center gap-2"><button onClick={() => onOpenBatchModal(item.product)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap">{isPharmaMode ? 'View/Add Batch' : 'View Stock'}</button><button onClick={() => onOpenEditModal(item.product)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50"><PencilIcon className="h-4 w-4" /></button><button onClick={() => onOpenPrintLabelModal(item.product)} className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900/50"><BarcodeIcon className="h-5 w-5" /></button><button onClick={() => { if (window.confirm(`Are you sure you want to delete the product "${item.name}"? This action cannot be undone.`)) { onDeleteProduct(item.product.id, item.product.name); } }} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"><TrashIcon className="h-4 w-4" /></button></div></td></tr>))}
                    </tbody>
                </table>
                {reportData.length === 0 && <div className="text-center py-10 text-slate-600 dark:text-slate-400"><p>No products found.</p></div>}
            </div>
            <BarcodeScannerModal isOpen={isScanning} onClose={() => setIsScanning(false)} onScanSuccess={handleScanSuccess} />
        </Card>
    );
};

const SelectedItemStockView: React.FC<{products: Product[], bills: Bill[], purchases: Purchase[], onDeleteBatch: (productId: string, batchId: string) => void, systemConfig: SystemConfig, t: any, initialProduct: Product | null, onProductSelect: (p: Product | null) => void }> = ({ products, bills, purchases, onDeleteBatch, systemConfig, t, initialProduct, onProductSelect }) => {
    // ... [Same implementation as previous turn] ...
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

    const handleSelectProduct = (product: Product) => { setSelectedProduct(product); setSearchTerm(product.name); onProductSelect(product); };
    const handleClearSelection = () => { setSelectedProduct(null); setSearchTerm(''); onProductSelect(null); };

    const ledger = useMemo(() => {
        if (!selectedProduct) return { openingBalance: 0, transactions: [] };
        const productId = selectedProduct.id;
        const productName = selectedProduct.name.toLowerCase();
        const productCompany = selectedProduct.company.toLowerCase();
        const allMovements: { date: Date; type: 'Purchase' | 'Sale'; particulars: string; inQty: number; outQty: number; timestamp: number }[] = [];
        purchases.forEach(p => { p.items.forEach(item => { const isMatch = item.productId === productId || (item.productName.toLowerCase() === productName && item.company.toLowerCase() === productCompany); if (isMatch) { const units = item.unitsPerStrip || selectedProduct.unitsPerStrip || 1; const qty = item.quantity * units; allMovements.push({ date: new Date(p.invoiceDate), type: 'Purchase', particulars: `Inv: ${p.invoiceNumber} (${p.supplier})`, inQty: qty, outQty: 0, timestamp: new Date(p.invoiceDate).getTime() }); } }); });
        bills.forEach(b => { b.items.forEach(item => { if (item.productId === productId) { allMovements.push({ date: new Date(b.date), type: 'Sale', particulars: `Bill: ${b.billNumber} (${b.customerName})`, inQty: 0, outQty: item.quantity, timestamp: new Date(b.date).getTime() }); } }); });
        allMovements.sort((a, b) => a.timestamp - b.timestamp);
        const startTimestamp = fromDate ? new Date(fromDate).setHours(0,0,0,0) : 0;
        const endTimestamp = toDate ? new Date(toDate).setHours(23,59,59,999) : Infinity;
        let openingBalance = 0;
        
        // Calculate Live Stock from all batches
        const liveStock = selectedProduct.batches.reduce((sum, b) => sum + b.stock, 0);
        
        // Filter transactions within range
        const filteredTransactions = allMovements.filter(m => m.timestamp >= startTimestamp && m.timestamp <= endTimestamp);
        
        // Reverse calculation for Opening Balance
        let calculatedStock = liveStock;
        // Reverse from NOW to End of Report Period
        for (let i = allMovements.length - 1; i >= 0; i--) {
            const m = allMovements[i];
            if (m.timestamp > endTimestamp) {
                calculatedStock = calculatedStock - m.inQty + m.outQty;
            }
        }
        // calculatedStock is now Closing Balance of the report period.
        
        // Now Reverse through the report period to find Opening Balance
        for (let i = allMovements.length - 1; i >= 0; i--) {
            const m = allMovements[i];
            if (m.timestamp >= startTimestamp && m.timestamp <= endTimestamp) {
                calculatedStock = calculatedStock - m.inQty + m.outQty;
            }
        }
        openingBalance = calculatedStock;
        
        // Reverse order for display (Newest First)
        return { openingBalance, transactions: filteredTransactions.reverse() };
    }, [selectedProduct, purchases, bills, fromDate, toDate]);

    const transactionsWithBalance = useMemo(() => {
        let bal = ledger.openingBalance;
        // To get balance after each tx, we must process in chronological order first
        const chronological = [...ledger.transactions].reverse(); 
        const result = chronological.map(tx => {
            bal = bal + tx.inQty - tx.outQty;
            return { ...tx, balance: bal };
        });
        // Then reverse back for display
        return result.reverse();
    }, [ledger]);

    const handleExport = () => {
        if (!selectedProduct || transactionsWithBalance.length === 0) {
            alert("No data to export.");
            return;
        }
        const data = transactionsWithBalance.map(t => ({
            'Date': t.date.toLocaleDateString(),
            'Type': t.type,
            'Particulars': t.particulars,
            'In': t.inQty > 0 ? formatStock(t.inQty, selectedProduct.unitsPerStrip) : '-',
            'Out': t.outQty > 0 ? formatStock(t.outQty, selectedProduct.unitsPerStrip) : '-',
            'Balance': formatStock(t.balance, selectedProduct.unitsPerStrip)
        }));
        exportToCsv(`stock_ledger_${selectedProduct.name.replace(/ /g, '_')}_${fromDate || 'start'}_to_${toDate || 'end'}`, data);
    };

    return (
        <Card title={t.inventory.selectedStock}>
            <div className="relative mb-6"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Search Product</label><div className="flex gap-2"><input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedProduct(null); }} className={inputStyle} placeholder={t.inventory.searchPlaceholder} />{selectedProduct && (<button onClick={handleClearSelection} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">Clear</button>)}</div>{searchResults.length > 0 && (<ul className="absolute z-10 w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto mt-1">{searchResults.map(p => (<li key={p.id} onClick={() => handleSelectProduct(p)} className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer text-slate-800 dark:text-slate-200">{p.name} <span className="text-xs text-slate-500 dark:text-slate-400">({p.company})</span></li>))}</ul>)}</div>
            {selectedProduct && (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600 gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">{selectedProduct.name}</h3>
                            <p className="text-slate-600 dark:text-slate-400">{selectedProduct.company}</p>
                            {isPharmaMode && <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">{selectedProduct.composition}</p>}
                            <div className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Current Total Stock: {formatStock(selectedProduct.batches.reduce((sum, b) => sum + b.stock, 0), selectedProduct.unitsPerStrip)}</div>
                        </div>
                        <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors">
                            <DownloadIcon className="h-5 w-5" /> Export Ledger
                        </button>
                    </div>
                    <div className="flex gap-4 items-center mb-4"><div className="flex-1"><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputStyle} /></div><div className="flex-1"><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inputStyle} /></div></div>
                    <div className="overflow-x-auto"><table className="w-full text-sm text-left text-slate-800 dark:text-slate-300"><thead className="text-xs uppercase bg-white dark:bg-slate-800 border-b-2 dark:border-slate-600 font-bold"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Particulars</th><th className="px-4 py-3 text-center">In</th><th className="px-4 py-3 text-center">Out</th><th className="px-4 py-3 text-right">Balance</th></tr></thead><tbody className="bg-white dark:bg-slate-800"><tr className="border-b dark:border-slate-700 font-semibold bg-slate-50 dark:bg-slate-700/30"><td className="px-4 py-3"></td><td className="px-4 py-3"></td><td className="px-4 py-3 text-right">Opening Balance:</td><td className="px-4 py-3 text-center">-</td><td className="px-4 py-3 text-center">-</td><td className="px-4 py-3 text-right">{formatStock(ledger.openingBalance, selectedProduct.unitsPerStrip)}</td></tr>{transactionsWithBalance.map((txn, index) => (<tr key={index} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"><td className="px-4 py-3">{txn.date.toLocaleDateString()}</td><td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-semibold ${txn.type === 'Purchase' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{txn.type}</span></td><td className="px-4 py-3">{txn.particulars}</td><td className="px-4 py-3 text-center">{txn.inQty > 0 ? formatStock(txn.inQty, selectedProduct.unitsPerStrip) : '-'}</td><td className="px-4 py-3 text-center">{txn.outQty > 0 ? formatStock(txn.outQty, selectedProduct.unitsPerStrip) : '-'}</td><td className="px-4 py-3 text-right font-medium">{formatStock(txn.balance, selectedProduct.unitsPerStrip)}</td></tr>))}{transactionsWithBalance.length === 0 && (<tr><td colSpan={6} className="text-center py-6 text-slate-500">No transactions in selected period.</td></tr>)}</tbody></table></div>
                </div>
            )}
        </Card>
    );
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
            <div className="overflow-x-auto"><table className="w-full text-sm text-left text-slate-800 dark:text-slate-300"><thead className="bg-red-50 dark:bg-red-900/30 uppercase text-xs"><tr><th className="px-4 py-2">Product</th><th className="px-4 py-2">Batch</th><th className="px-4 py-2">Expiry</th><th className="px-4 py-2 text-center">Stock</th><th className="px-4 py-2 text-center">Action</th></tr></thead><tbody>{expiredBatches.map(item => (<tr key={`${item.product.id}-${item.id}`} className="border-b dark:border-slate-700"><td className="px-4 py-2 font-medium">{item.product.name}</td><td className="px-4 py-2">{item.batchNumber}</td><td className="px-4 py-2 text-red-600 font-bold">{item.expiryDate}</td><td className="px-4 py-2 text-center">{formatStock(item.stock, item.product.unitsPerStrip)}</td><td className="px-4 py-2 text-center"><button onClick={() => { if(confirm('Delete expired batch?')) onDeleteBatch(item.product.id, item.id); }} className="text-red-600 hover:text-red-800"><TrashIcon className="h-4 w-4" /></button></td></tr>))}{expiredBatches.length === 0 && <tr><td colSpan={5} className="text-center py-4">No expired stock found.</td></tr>}</tbody></table></div>
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
            <div className="overflow-x-auto"><table className="w-full text-sm text-left text-slate-800 dark:text-slate-300"><thead className="bg-yellow-50 dark:bg-yellow-900/30 uppercase text-xs"><tr><th className="px-4 py-2">Product</th><th className="px-4 py-2">Batch</th><th className="px-4 py-2">Expiry</th><th className="px-4 py-2 text-center">Stock</th><th className="px-4 py-2 text-center">Action</th></tr></thead><tbody>{nearExpiryBatches.map(item => (<tr key={`${item.product.id}-${item.id}`} className="border-b dark:border-slate-700"><td className="px-4 py-2 font-medium">{item.product.name}</td><td className="px-4 py-2">{item.batchNumber}</td><td className="px-4 py-2 text-yellow-600 font-bold">{item.expiryDate}</td><td className="px-4 py-2 text-center">{formatStock(item.stock, item.product.unitsPerStrip)}</td><td className="px-4 py-2 text-center"><button onClick={() => { if(confirm('Delete batch?')) onDeleteBatch(item.product.id, item.id); }} className="text-red-600 hover:text-red-800"><TrashIcon className="h-4 w-4" /></button></td></tr>))}{nearExpiryBatches.length === 0 && <tr><td colSpan={5} className="text-center py-4">No batches expiring soon.</td></tr>}</tbody></table></div>
        </Card>
    );
};

// --- Modals ---

const AddProductModal: React.FC<{ isOpen: boolean, onClose: () => void, onAddProduct: (p: any, b: any) => void, companies: Company[], systemConfig: SystemConfig, gstRates: GstRate[], products: Product[], t: any }> = ({ isOpen, onClose, onAddProduct, companies, systemConfig, gstRates, products, t }) => {
    // ... [No changes to AddProductModal] ...
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [formData, setFormData] = useState({
        name: '', company: '', hsnCode: '', gst: gstRates[0]?.rate || 0, barcode: '', composition: '', unitsPerStrip: 1, isScheduleH: 'No',
        batchNumber: '', expiryDate: '', stock: 0, mrp: 0, purchasePrice: 0
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const productData = {
            name: formData.name, company: formData.company, hsnCode: formData.hsnCode, gst: Number(formData.gst),
            barcode: formData.barcode, composition: formData.composition, unitsPerStrip: Number(formData.unitsPerStrip),
            isScheduleH: formData.isScheduleH === 'Yes'
        };
        const stockVal = Number(formData.stock);
        const batchData = {
            batchNumber: formData.batchNumber || 'DEFAULT',
            expiryDate: formData.expiryDate || '2099-12',
            stock: stockVal, 
            openingStock: stockVal, // Initialize opening stock with initial stock
            mrp: Number(formData.mrp), 
            purchasePrice: Number(formData.purchasePrice)
        };
        onAddProduct(productData, batchData);
        onClose();
        setFormData({ name: '', company: '', hsnCode: '', gst: gstRates[0]?.rate || 0, barcode: '', composition: '', unitsPerStrip: 1, isScheduleH: 'No', batchNumber: '', expiryDate: '', stock: 0, mrp: 0, purchasePrice: 0 });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t.inventory.addProduct}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input placeholder="Product Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputStyle} required />
                <input placeholder="Company" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} className={inputStyle} required list="company-list" />
                <datalist id="company-list">{companies.map(c => <option key={c.id} value={c.name} />)}</datalist>
                
                <div className="grid grid-cols-2 gap-4">
                    <select value={formData.gst} onChange={e => setFormData({...formData, gst: Number(e.target.value)})} className={selectStyle}>
                        {gstRates.map(r => <option key={r.id} value={r.rate}>GST {r.rate}%</option>)}
                    </select>
                    <input placeholder="HSN Code" value={formData.hsnCode} onChange={e => setFormData({...formData, hsnCode: e.target.value})} className={inputStyle} />
                </div>

                {!isPharmaMode && <input placeholder="Barcode" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className={inputStyle} />}
                
                {isPharmaMode && (
                    <>
                        <input placeholder="Composition" value={formData.composition} onChange={e => setFormData({...formData, composition: e.target.value})} className={inputStyle} />
                        <div className="grid grid-cols-2 gap-4">
                            <input type="number" placeholder="Units/Strip" value={formData.unitsPerStrip} onChange={e => setFormData({...formData, unitsPerStrip: Number(e.target.value)})} className={inputStyle} />
                            <select value={formData.isScheduleH} onChange={e => setFormData({...formData, isScheduleH: e.target.value})} className={selectStyle}>
                                <option value="No">Schedule H: No</option>
                                <option value="Yes">Schedule H: Yes</option>
                            </select>
                        </div>
                    </>
                )}

                <div className="border-t pt-4 mt-4">
                    <h4 className="font-semibold mb-2">Initial Batch Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                        {isPharmaMode && <input placeholder="Batch No" value={formData.batchNumber} onChange={e => setFormData({...formData, batchNumber: e.target.value})} className={inputStyle} required />}
                        {isPharmaMode && <input type="month" placeholder="Expiry" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} className={inputStyle} required />}
                        <input type="number" placeholder="Stock Qty" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} className={inputStyle} required />
                        <input type="number" step="0.01" placeholder="MRP" value={formData.mrp} onChange={e => setFormData({...formData, mrp: Number(e.target.value)})} className={inputStyle} required />
                        <input type="number" step="0.01" placeholder="Purchase Price" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: Number(e.target.value)})} className={inputStyle} required />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">Add Product</button>
                </div>
            </form>
        </Modal>
    );
};

const AddBatchModal: React.FC<{ isOpen: boolean, onClose: () => void, product: Product, onAddBatch: (pid: string, b: any) => void, onDeleteBatch: (pid: string, bid: string) => void, systemConfig: SystemConfig }> = ({ isOpen, onClose, product, onAddBatch, onDeleteBatch, systemConfig }) => {
    // ... [No changes to AddBatchModal] ...
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [formData, setFormData] = useState({
        batchNumber: '', expiryDate: '', stock: 0, mrp: 0, purchasePrice: 0
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const stockVal = Number(formData.stock);
        onAddBatch(product.id, {
            batchNumber: formData.batchNumber || 'DEFAULT',
            expiryDate: formData.expiryDate || '2099-12',
            stock: stockVal,
            openingStock: stockVal, // Initialize opening stock
            mrp: Number(formData.mrp), 
            purchasePrice: Number(formData.purchasePrice)
        });
        setFormData({ batchNumber: '', expiryDate: '', stock: 0, mrp: 0, purchasePrice: 0 });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Manage Batches: ${product.name}`}>
            <div className="space-y-6">
                <form onSubmit={handleSubmit} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600">
                    <h4 className="font-semibold mb-3">Add New Batch</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {isPharmaMode && <input placeholder="Batch No" value={formData.batchNumber} onChange={e => setFormData({...formData, batchNumber: e.target.value})} className={inputStyle} required />}
                        {isPharmaMode && <input type="month" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} className={inputStyle} required />}
                        <input type="number" placeholder="Qty" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} className={inputStyle} required />
                        <input type="number" step="0.01" placeholder="MRP" value={formData.mrp} onChange={e => setFormData({...formData, mrp: Number(e.target.value)})} className={inputStyle} required />
                        <input type="number" step="0.01" placeholder="P.Rate" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: Number(e.target.value)})} className={inputStyle} required />
                    </div>
                    <button type="submit" className="mt-3 w-full py-2 bg-green-600 text-white rounded hover:bg-green-700">Add Batch</button>
                </form>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs">
                            <tr>
                                {isPharmaMode && <th>Batch</th>}
                                {isPharmaMode && <th>Expiry</th>}
                                <th>Stock</th>
                                <th>MRP</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {product.batches.map(b => (
                                <tr key={b.id} className="border-b dark:border-slate-700">
                                    {isPharmaMode && <td className="px-4 py-2">{b.batchNumber}</td>}
                                    {isPharmaMode && <td className="px-4 py-2">{b.expiryDate}</td>}
                                    <td className="px-4 py-2">{b.stock}</td>
                                    <td className="px-4 py-2">₹{b.mrp}</td>
                                    <td className="px-4 py-2"><button onClick={() => { if(confirm('Delete?')) onDeleteBatch(product.id, b.id); }} className="text-red-500"><TrashIcon className="h-4 w-4"/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Modal>
    );
};

const EditProductModal: React.FC<{ isOpen: boolean, onClose: () => void, product: Product, onUpdateProduct: (pid: string, data: any) => void, systemConfig: SystemConfig, gstRates: GstRate[] }> = ({ isOpen, onClose, product, onUpdateProduct, systemConfig, gstRates }) => {
    // ... [No changes to EditProductModal] ...
    const [formData, setFormData] = useState({ 
        ...product, 
        gst: String(product.gst),
        openingStock: String(product.batches[0]?.openingStock ?? product.batches[0]?.stock ?? 0)
    });
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    useEffect(() => {
        if (product.batches.length > 0) {
            // Display opening stock if exists, else current stock as fallback for initial value
            const batch = product.batches[0];
            const opStock = batch.openingStock !== undefined ? batch.openingStock : batch.stock;
            setFormData(prev => ({...prev, openingStock: String(opStock)}));
        }
    }, [product]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Logic to update Opening Stock and adjust Current Stock
        const newOpeningStock = Number(formData.openingStock);
        const batch = product.batches[0];
        
        // If single batch product
        if (batch) {
            const oldOpeningStock = batch.openingStock !== undefined ? batch.openingStock : batch.stock;
            const diff = newOpeningStock - oldOpeningStock;
            
            const updatedBatch = {
                ...batch,
                openingStock: newOpeningStock,
                stock: batch.stock + diff // Adjust current stock by the difference in opening stock
            };
            
            onUpdateProduct(product.id, { 
                ...formData, 
                gst: Number(formData.gst),
                batches: [updatedBatch]
            });
        } else {
             onUpdateProduct(product.id, { ...formData, gst: Number(formData.gst) });
        }
        
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Product">
            <form onSubmit={handleSubmit} className="space-y-4">
                <input placeholder="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputStyle} required />
                <input placeholder="Company" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} className={inputStyle} required />
                <div className="grid grid-cols-2 gap-4">
                    <select value={formData.gst} onChange={e => setFormData({...formData, gst: e.target.value})} className={selectStyle}>
                        {gstRates.map(r => <option key={r.id} value={r.rate}>GST {r.rate}%</option>)}
                    </select>
                    <input placeholder="HSN" value={formData.hsnCode} onChange={e => setFormData({...formData, hsnCode: e.target.value})} className={inputStyle} />
                </div>
                {!isPharmaMode && <input placeholder="Barcode" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className={inputStyle} />}
                {isPharmaMode && <input placeholder="Composition" value={formData.composition} onChange={e => setFormData({...formData, composition: e.target.value})} className={inputStyle} />}
                
                {/* Editable Opening Stock Field */}
                {product.batches.length <= 1 && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Opening Stock (Units)</label>
                        <input 
                            type="number" 
                            value={formData.openingStock} 
                            onChange={e => setFormData({...formData, openingStock: e.target.value})} 
                            className={inputStyle} 
                        />
                        <p className="text-xs text-slate-500 mt-1">Modifying this will adjust current stock.</p>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Update</button>
                </div>
            </form>
        </Modal>
    );
};

const PrintLabelModal: React.FC<{ isOpen: boolean, onClose: () => void, product: Product, companyProfile: CompanyProfile, systemConfig: SystemConfig }> = ({ isOpen, onClose, product, companyProfile }) => {
    const [copies, setCopies] = useState(1);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Please allow popups to print labels.");
            return;
        }

        const barcodeVal = product.barcode || product.id || '';
        // Code 39 requires wrapping in *
        const barcodeDisplay = `*${barcodeVal}*`;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print Label - ${product.name}</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39+Text&display=swap" rel="stylesheet">
                <style>
                    @page {
                        size: auto;
                        margin: 0mm;
                    }
                    body {
                        margin: 5mm;
                        font-family: Arial, sans-serif;
                    }
                    .label-container {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 2mm;
                    }
                    .label {
                        width: 50mm; /* Standard Label Width */
                        height: 25mm; /* Standard Label Height */
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                        padding: 1mm;
                        box-sizing: border-box;
                        page-break-inside: avoid;
                    }
                    .company-name {
                        font-size: 8px;
                        font-weight: bold;
                        white-space: nowrap;
                        overflow: hidden;
                        max-width: 100%;
                    }
                    .product-name {
                        font-size: 9px;
                        margin: 1px 0;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        max-width: 100%;
                    }
                    .barcode {
                        font-family: 'Libre Barcode 39 Text', cursive;
                        font-size: 24px; /* Adjust for readability */
                        line-height: 1;
                        white-space: nowrap;
                    }
                    .mrp {
                        font-size: 9px;
                        font-weight: bold;
                        margin-top: 1px;
                    }
                    @media print {
                        body { margin: 0; }
                        .label {
                            border: none; /* Remove border for actual print if using label paper */
                            /* outline: 1px dashed #ccc; Optional: keep for alignment guide if needed */
                        }
                    }
                </style>
            </head>
            <body>
                <div class="label-container">
                    ${Array.from({ length: copies }).map(() => `
                        <div class="label">
                            <div class="company-name">${companyProfile.name}</div>
                            <div class="product-name">${product.name}</div>
                            <div class="barcode">${barcodeDisplay}</div>
                            <div class="mrp">MRP: ₹${product.batches[0]?.mrp || 0}</div>
                        </div>
                    `).join('')}
                </div>
                <script>
                    // Wait for fonts to load roughly
                    document.fonts.ready.then(() => {
                        window.print();
                    });
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Print Product Labels">
            <div className="space-y-6 p-4">
                <div className="flex flex-col items-center border p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                    <p className="text-sm text-slate-500 mb-2">Preview (Standard 50x25mm Label)</p>
                    <div className="bg-white border border-slate-300 w-[50mm] h-[25mm] flex flex-col items-center justify-center p-1 shadow-sm text-black">
                        <p className="text-[8px] font-bold truncate w-full text-center">{companyProfile.name}</p>
                        <p className="text-[9px] truncate w-full text-center">{product.name}</p>
                        {/* Fake visual for preview without loading font in main app */}
                        <p className="font-mono text-xs my-0.5 tracking-widest">||| || |||| ||</p>
                        <p className="text-[9px] font-bold">MRP: ₹{product.batches[0]?.mrp || 0}</p>
                    </div>
                </div>

                <div className="flex items-center justify-center gap-4">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Copies:</label>
                    <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-md">
                        <button onClick={() => setCopies(Math.max(1, copies - 1))} className="px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-600">-</button>
                        <input 
                            type="number" 
                            value={copies} 
                            onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-12 text-center p-1 outline-none bg-transparent dark:text-white"
                        />
                        <button onClick={() => setCopies(copies + 1)} className="px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-600">+</button>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded-lg hover:bg-slate-300">Close</button>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700">
                        <CheckCircleIcon className="h-5 w-5"/> Print
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const ImportProductsModal: React.FC<{ isOpen: boolean, onClose: () => void, onBulkAddProducts: (prods: any[]) => Promise<{success: number, skipped: number}> }> = ({ isOpen, onClose, onBulkAddProducts }) => {
    // ... [No changes to ImportProductsModal] ...
    const [csvText, setCsvText] = useState('');
    const [status, setStatus] = useState('');

    const handleImport = async () => {
        const lines = csvText.split('\n').filter(l => l.trim());
        const products = lines.slice(1).map(line => {
            const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            // Very basic mapping assumption: Name,Company,HSN,GST,MRP,Stock...
            if (cols.length < 2) return null;
            return {
                name: cols[0],
                company: cols[1],
                hsnCode: cols[2] || '',
                gst: parseFloat(cols[3]) || 0,
                // Simplified for bulk import logic, usually needs more robust mapping
            };
        }).filter(p => p !== null);

        setStatus('Importing...');
        const res = await onBulkAddProducts(products);
        setStatus(`Success: ${res.success}, Skipped: ${res.skipped}`);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import Products">
            <div className="space-y-4">
                <p className="text-sm text-slate-500">Paste CSV content (Name,Company,HSN,GST...)</p>
                <textarea className="w-full h-40 p-2 border rounded" value={csvText} onChange={e => setCsvText(e.target.value)}></textarea>
                {status && <p className="text-sm font-bold">{status}</p>}
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 rounded">Close</button>
                    <button onClick={handleImport} className="px-4 py-2 bg-green-600 text-white rounded">Import</button>
                </div>
            </div>
        </Modal>
    );
};

export default Inventory;

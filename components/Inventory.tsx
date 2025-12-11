
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
                purchases.forEach(purchase => { 
                    const purchaseDate = new Date(purchase.invoiceDate); 
                    if ((!startDate || purchaseDate >= startDate) && (!endDate || purchaseDate <= endDate)) { 
                        purchase.items.forEach(item => { 
                            // Match by ID first, then fallback to Name if ID is missing (legacy support)
                            if (item.productId === product.id || (!item.productId && item.productName.toLowerCase() === product.name.toLowerCase())) { 
                                const itemUnitsPerStrip = item.unitsPerStrip || unitsPerStrip; 
                                purchasesInPeriod += item.quantity * itemUnitsPerStrip; 
                            } 
                        }); 
                    } 
                });
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

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
        setSearchTerm(product.name);
        onProductSelect(product);
    };

    const handleClearSelection = () => {
        setSelectedProduct(null);
        setSearchTerm('');
        onProductSelect(null);
    };

    return (
        <Card title={t.inventory.selectedStock}>
            <div className="relative mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Search Product</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={searchTerm} 
                        onChange={e => { setSearchTerm(e.target.value); setSelectedProduct(null); }} 
                        className={inputStyle} 
                        placeholder={t.inventory.searchPlaceholder}
                    />
                    {selectedProduct && (
                        <button onClick={handleClearSelection} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">Clear</button>
                    )}
                </div>
                {searchResults.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto mt-1">
                        {searchResults.map(p => (
                            <li 
                                key={p.id} 
                                onClick={() => handleSelectProduct(p)} 
                                className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer text-slate-800 dark:text-slate-200"
                            >
                                {p.name} <span className="text-xs text-slate-500 dark:text-slate-400">({p.company})</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {selectedProduct && (
                <div className="space-y-6">
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">{selectedProduct.name}</h3>
                        <p className="text-slate-600 dark:text-slate-400">{selectedProduct.company}</p>
                        {isPharmaMode && <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">{selectedProduct.composition}</p>}
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                            <div className="bg-white dark:bg-slate-800 p-3 rounded shadow-sm">
                                <p className="text-xs text-slate-500 dark:text-slate-400">Total Stock</p>
                                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                    {formatStock(selectedProduct.batches.reduce((sum, b) => sum + b.stock, 0), selectedProduct.unitsPerStrip)}
                                </p>
                            </div>
                            {/* Add more summary stats if needed */}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Batch Details</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                                <thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs">
                                    <tr>
                                        {isPharmaMode && <th className="px-4 py-2">Batch No</th>}
                                        {isPharmaMode && <th className="px-4 py-2">Expiry</th>}
                                        <th className="px-4 py-2 text-right">MRP</th>
                                        <th className="px-4 py-2 text-right">Purchase Rate</th>
                                        <th className="px-4 py-2 text-center">Stock</th>
                                        <th className="px-4 py-2 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedProduct.batches.map(batch => (
                                        <tr key={batch.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                            {isPharmaMode && <td className="px-4 py-2 font-medium">{batch.batchNumber}</td>}
                                            {isPharmaMode && <td className="px-4 py-2">{batch.expiryDate}</td>}
                                            <td className="px-4 py-2 text-right">₹{batch.mrp.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right">₹{batch.purchasePrice.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-center font-bold">{formatStock(batch.stock, selectedProduct.unitsPerStrip)}</td>
                                            <td className="px-4 py-2 text-center">
                                                <button 
                                                    onClick={() => {
                                                        if (window.confirm('Delete this batch?')) onDeleteBatch(selectedProduct.id, batch.id);
                                                    }}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {selectedProduct.batches.length === 0 && (
                                        <tr><td colSpan={6} className="text-center py-4 text-slate-500">No batches found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};

const BatchWiseStockView: React.FC<{ products: Product[], onDeleteBatch: (pid: string, bid: string) => void, systemConfig: SystemConfig, t: any }> = ({ products, onDeleteBatch, systemConfig, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    
    const allBatches = useMemo(() => {
        return products.flatMap(p => p.batches.map(b => ({ ...b, product: p })))
            .filter(item => {
                const term = searchTerm.toLowerCase();
                return item.product.name.toLowerCase().includes(term) || item.batchNumber.toLowerCase().includes(term);
            });
    }, [products, searchTerm]);

    return (
        <Card title={t.inventory.batchStock}>
            <input type="text" placeholder="Search by Product or Batch..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputStyle + " mb-4"} />
            <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs sticky top-0">
                        <tr>
                            <th className="px-4 py-2">Product</th>
                            <th className="px-4 py-2">Batch No</th>
                            <th className="px-4 py-2">Expiry</th>
                            <th className="px-4 py-2 text-right">MRP</th>
                            <th className="px-4 py-2 text-center">Stock</th>
                            <th className="px-4 py-2 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allBatches.map(item => (
                            <tr key={`${item.product.id}-${item.id}`} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                <td className="px-4 py-2 font-medium">{item.product.name}</td>
                                <td className="px-4 py-2">{item.batchNumber}</td>
                                <td className="px-4 py-2">{item.expiryDate}</td>
                                <td className="px-4 py-2 text-right">₹{item.mrp.toFixed(2)}</td>
                                <td className="px-4 py-2 text-center">{formatStock(item.stock, item.product.unitsPerStrip)}</td>
                                <td className="px-4 py-2 text-center">
                                    <button onClick={() => { if(confirm('Delete batch?')) onDeleteBatch(item.product.id, item.id); }} className="text-red-600 hover:text-red-800">
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

const CompanyWiseStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], systemConfig: SystemConfig, t: any }> = ({ products, systemConfig, t }) => {
    const companyStats = useMemo(() => {
        const stats: Record<string, { count: number, value: number }> = {};
        products.forEach(p => {
            if (!stats[p.company]) stats[p.company] = { count: 0, value: 0 };
            stats[p.company].count += 1; // Or sum stock
            const pValue = p.batches.reduce((sum, b) => {
                const unitPrice = b.mrp / (p.unitsPerStrip || 1); // Approx value by MRP
                return sum + (unitPrice * b.stock);
            }, 0);
            stats[p.company].value += pValue;
        });
        return Object.entries(stats).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.value - a.value);
    }, [products]);

    return (
        <Card title={t.inventory.companyStock}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-2">Company</th>
                            <th className="px-4 py-2 text-center">Products Count</th>
                            <th className="px-4 py-2 text-right">Total Stock Value (MRP)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {companyStats.map(c => (
                            <tr key={c.name} className="border-b dark:border-slate-700">
                                <td className="px-4 py-2 font-medium">{c.name}</td>
                                <td className="px-4 py-2 text-center">{c.count}</td>
                                <td className="px-4 py-2 text-right">₹{c.value.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

const ExpiredStockView: React.FC<{ products: Product[], onDeleteBatch: (pid: string, bid: string) => void, systemConfig: SystemConfig, t: any }> = ({ products, onDeleteBatch, t }) => {
    const today = new Date();
    today.setHours(0,0,0,0);

    const expiredBatches = useMemo(() => {
        return products.flatMap(p => p.batches.map(b => ({ ...b, product: p })))
            .filter(item => item.stock > 0 && getExpiryDate(item.expiryDate) < today);
    }, [products, today]);

    return (
        <Card title={t.inventory.expiredStock}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="bg-red-50 dark:bg-red-900/30 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-2">Product</th>
                            <th className="px-4 py-2">Batch</th>
                            <th className="px-4 py-2">Expiry</th>
                            <th className="px-4 py-2 text-center">Stock</th>
                            <th className="px-4 py-2 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {expiredBatches.map(item => (
                            <tr key={`${item.product.id}-${item.id}`} className="border-b dark:border-slate-700">
                                <td className="px-4 py-2 font-medium">{item.product.name}</td>
                                <td className="px-4 py-2">{item.batchNumber}</td>
                                <td className="px-4 py-2 text-red-600 font-bold">{item.expiryDate}</td>
                                <td className="px-4 py-2 text-center">{formatStock(item.stock, item.product.unitsPerStrip)}</td>
                                <td className="px-4 py-2 text-center">
                                    <button onClick={() => { if(confirm('Delete expired batch?')) onDeleteBatch(item.product.id, item.id); }} className="text-red-600 hover:text-red-800">
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {expiredBatches.length === 0 && <tr><td colSpan={5} className="text-center py-4">No expired stock found.</td></tr>}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

const NearingExpiryStockView: React.FC<{ products: Product[], onDeleteBatch: (pid: string, bid: string) => void, systemConfig: SystemConfig, t: any }> = ({ products, onDeleteBatch, t }) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const next30Days = new Date(today);
    next30Days.setDate(today.getDate() + 30);

    const nearExpiryBatches = useMemo(() => {
        return products.flatMap(p => p.batches.map(b => ({ ...b, product: p })))
            .filter(item => {
                const exp = getExpiryDate(item.expiryDate);
                return item.stock > 0 && exp >= today && exp <= next30Days;
            });
    }, [products, today, next30Days]);

    return (
        <Card title={t.inventory.nearExpiry}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="bg-yellow-50 dark:bg-yellow-900/30 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-2">Product</th>
                            <th className="px-4 py-2">Batch</th>
                            <th className="px-4 py-2">Expiry</th>
                            <th className="px-4 py-2 text-center">Stock</th>
                            <th className="px-4 py-2 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {nearExpiryBatches.map(item => (
                            <tr key={`${item.product.id}-${item.id}`} className="border-b dark:border-slate-700">
                                <td className="px-4 py-2 font-medium">{item.product.name}</td>
                                <td className="px-4 py-2">{item.batchNumber}</td>
                                <td className="px-4 py-2 text-yellow-600 font-bold">{item.expiryDate}</td>
                                <td className="px-4 py-2 text-center">{formatStock(item.stock, item.product.unitsPerStrip)}</td>
                                <td className="px-4 py-2 text-center">
                                    <button onClick={() => { if(confirm('Delete batch?')) onDeleteBatch(item.product.id, item.id); }} className="text-red-600 hover:text-red-800">
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {nearExpiryBatches.length === 0 && <tr><td colSpan={5} className="text-center py-4">No batches expiring soon.</td></tr>}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

// --- Modals ---

const AddProductModal: React.FC<{ isOpen: boolean, onClose: () => void, onAddProduct: (p: any, b: any) => void, companies: Company[], systemConfig: SystemConfig, gstRates: GstRate[], products: Product[], t: any }> = ({ isOpen, onClose, onAddProduct, companies, systemConfig, gstRates, products, t }) => {
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
        const batchData = {
            batchNumber: formData.batchNumber || 'DEFAULT',
            expiryDate: formData.expiryDate || '2099-12',
            stock: Number(formData.stock), mrp: Number(formData.mrp), purchasePrice: Number(formData.purchasePrice)
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
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [formData, setFormData] = useState({
        batchNumber: '', expiryDate: '', stock: 0, mrp: 0, purchasePrice: 0
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAddBatch(product.id, {
            batchNumber: formData.batchNumber || 'DEFAULT',
            expiryDate: formData.expiryDate || '2099-12',
            stock: Number(formData.stock), mrp: Number(formData.mrp), purchasePrice: Number(formData.purchasePrice)
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
    const [formData, setFormData] = useState({ ...product, gst: String(product.gst) });
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdateProduct(product.id, { ...formData, gst: Number(formData.gst) });
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
                <div className="flex justify-end gap-2 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Update</button>
                </div>
            </form>
        </Modal>
    );
};

const PrintLabelModal: React.FC<{ isOpen: boolean, onClose: () => void, product: Product, companyProfile: CompanyProfile, systemConfig: SystemConfig }> = ({ isOpen, onClose, product, companyProfile }) => {
    const handlePrint = () => { window.print(); };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Print Label">
            <div className="flex flex-col items-center gap-4 p-6">
                <div className="border p-4 text-center w-64 bg-white text-black print:fixed print:top-0 print:left-0 print:w-full print:h-full print:border-none print:flex print:items-center print:justify-center">
                    <p className="font-bold text-sm">{companyProfile.name}</p>
                    <p className="text-xs truncate">{product.name}</p>
                    <p className="text-xs font-mono my-1">{product.barcode || product.id}</p>
                    <p className="font-bold text-sm">MRP: ₹{product.batches[0]?.mrp || 0}</p>
                </div>
                <div className="flex gap-2 print:hidden">
                    <button onClick={handlePrint} className="px-4 py-2 bg-slate-800 text-white rounded flex items-center gap-2"><CheckCircleIcon className="h-4 w-4"/> Print</button>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 rounded">Close</button>
                </div>
                <style>{`@media print { body * { visibility: hidden; } .print\\:fixed, .print\\:fixed * { visibility: visible; } }`}</style>
            </div>
        </Modal>
    );
};

const ImportProductsModal: React.FC<{ isOpen: boolean, onClose: () => void, onBulkAddProducts: (prods: any[]) => Promise<{success: number, skipped: number}> }> = ({ isOpen, onClose, onBulkAddProducts }) => {
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

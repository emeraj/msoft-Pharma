
import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import type { Product, Batch, Company, Bill, Purchase, SystemConfig, CompanyProfile, GstRate } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, DownloadIcon, TrashIcon, PencilIcon, UploadIcon, BarcodeIcon, CameraIcon } from './icons/Icons';
import BarcodeScannerModal from './BarcodeScannerModal';

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

// Helper to parse expiry string YYYY-MM
const getExpiryDate = (expiryString: string): Date => {
    if (!expiryString) return new Date('9999-12-31');
    const [year, month] = expiryString.split('-').map(Number);
    // Return last day of month
    return new Date(year, month, 0);
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
  onUpdateProduct: (productId: string, productData: Partial<Omit<Product, 'id' | 'batches' | 'mrp' | 'purchasePrice'>>) => void;
  onAddBatch: (productId: string, batch: Omit<Batch, 'id'>) => void;
  onDeleteBatch: (productId: string, batchId: string) => void;
  onDeleteProduct: (productId: string, productName: string) => void;
  onBulkAddProducts: (products: Omit<Product, 'id' | 'batches'>[]) => Promise<{success: number; skipped: number}>;
}

type InventorySubView = 'all' | 'selected' | 'batch' | 'company' | 'expired' | 'nearing_expiry';

// --- Main Inventory Component ---
const Inventory: React.FC<InventoryProps> = ({ products, companies, bills, purchases, systemConfig, companyProfile, gstRates, onAddProduct, onUpdateProduct, onAddBatch, onDeleteBatch, onDeleteProduct, onBulkAddProducts }) => {
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [isBatchModalOpen, setBatchModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isPrintLabelModalOpen, setPrintLabelModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const isPharmaMode = systemConfig.softwareMode === 'Pharma';

  const handleOpenBatchModal = (product: Product) => {
    setSelectedProduct(product);
    setBatchModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setSelectedProduct(product);
    setEditModalOpen(true);
  };
  
  const handleOpenPrintLabelModal = (product: Product) => {
    setSelectedProduct(product);
    setPrintLabelModalOpen(true);
  };
  
  const [activeSubView, setActiveSubView] = useState<InventorySubView>('all');

  const renderSubView = () => {
    switch (activeSubView) {
      case 'all':
        return <AllItemStockView products={products} purchases={purchases} bills={bills} onOpenBatchModal={handleOpenBatchModal} onOpenEditModal={handleOpenEditModal} onOpenPrintLabelModal={handleOpenPrintLabelModal} systemConfig={systemConfig} searchTerm={searchTerm} onSearchTermChange={setSearchTerm} onDeleteProduct={onDeleteProduct} />;
      case 'selected':
        return <SelectedItemStockView products={products} onDeleteBatch={onDeleteBatch} systemConfig={systemConfig} />;
      case 'batch':
        return isPharmaMode ? <BatchWiseStockView products={products} onDeleteBatch={onDeleteBatch} systemConfig={systemConfig} /> : null;
      case 'company':
        return <CompanyWiseStockView products={products} purchases={purchases} bills={bills} systemConfig={systemConfig} />;
      case 'expired':
        return isPharmaMode ? <ExpiredStockView products={products} onDeleteBatch={onDeleteBatch} systemConfig={systemConfig} /> : null;
      case 'nearing_expiry':
        return isPharmaMode ? <NearingExpiryStockView products={products} onDeleteBatch={onDeleteBatch} systemConfig={systemConfig} /> : null;
      default:
        return <AllItemStockView products={products} purchases={purchases} bills={bills} onOpenBatchModal={handleOpenBatchModal} onOpenEditModal={handleOpenEditModal} onOpenPrintLabelModal={handleOpenPrintLabelModal} systemConfig={systemConfig} searchTerm={searchTerm} onSearchTermChange={setSearchTerm} onDeleteProduct={onDeleteProduct} />;
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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Inventory Management</h1>
          <div className="flex items-center gap-2">
             <button 
                onClick={() => setImportModalOpen(true)}
                className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg shadow hover:bg-slate-700 transition-colors duration-200"
              >
                <UploadIcon className="h-5 w-5" /> Import Products
              </button>
              <button 
                onClick={() => setProductModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors duration-200"
              >
                <PlusIcon className="h-5 w-5" /> Add New Product
              </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t dark:border-slate-700 mt-4 pt-4">
            <SubNavButton view="all" label="All Item Stock" />
            <SubNavButton view="selected" label="Selected Item Stock" />
            <SubNavButton view="company" label="Company Wise Stock" />
            {isPharmaMode && <SubNavButton view="batch" label="Batch Wise Stock" />}
            {isPharmaMode && <SubNavButton view="expired" label="Expired Stock" />}
            {isPharmaMode && <SubNavButton view="nearing_expiry" label="Near 30 Days Expiry" />}
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
      />

      {selectedProduct && (
        <AddBatchModal
          isOpen={isBatchModalOpen}
          onClose={() => { setBatchModalOpen(false); setSelectedProduct(null); }}
          product={selectedProduct}
          onAddBatch={onAddBatch}
          onDeleteBatch={onDeleteBatch}
          systemConfig={systemConfig}
        />
      )}
      
      {selectedProduct && (
        <EditProductModal
          isOpen={isEditModalOpen}
          onClose={() => { setEditModalOpen(false); setSelectedProduct(null); }}
          product={selectedProduct}
          onUpdateProduct={onUpdateProduct}
          systemConfig={systemConfig}
          gstRates={gstRates}
        />
      )}

      {selectedProduct && (
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
}

const AllItemStockView: React.FC<AllItemStockViewProps> = ({ products, purchases, bills, systemConfig, searchTerm, onSearchTermChange, onOpenBatchModal, onOpenEditModal, onOpenPrintLabelModal, onDeleteProduct }) => {
    const [companyFilter, setCompanyFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [isScanning, setIsScanning] = useState(false);
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    const companies = useMemo(() => [...new Set(products.map(p => p.company))].sort(), [products]);
    
    const handleScanSuccess = (decodedText: string) => {
        onSearchTermChange(decodedText);
        setIsScanning(false);
    };

    const reportData = useMemo(() => {
        const startDate = fromDate ? new Date(fromDate) : null;
        if (startDate) startDate.setHours(0, 0, 0, 0);

        const endDate = toDate ? new Date(toDate) : null;
        if (endDate) endDate.setHours(23, 59, 59, 999);

        const lowerSearchTerm = searchTerm.toLowerCase();

        return products
            .filter(product =>
                (product.name.toLowerCase().includes(lowerSearchTerm) || 
                 product.id.toLowerCase() === lowerSearchTerm ||
                 (!isPharmaMode && product.barcode && product.barcode.includes(searchTerm))) &&
                (companyFilter === '' || product.company === companyFilter)
            )
            .map(product => {
                let purchasesInPeriod = 0;
                let salesInPeriod = 0;
                const unitsPerStrip = product.unitsPerStrip || 1;

                purchases.forEach(purchase => {
                    const purchaseDate = new Date(purchase.invoiceDate);
                    if ((!startDate || purchaseDate >= startDate) && (!endDate || purchaseDate <= endDate)) {
                        purchase.items.forEach(item => {
                            if (item.productId === product.id) {
                                const itemUnitsPerStrip = item.unitsPerStrip || unitsPerStrip;
                                purchasesInPeriod += item.quantity * itemUnitsPerStrip;
                            }
                        });
                    }
                });

                bills.forEach(bill => {
                    const billDate = new Date(bill.date);
                    if ((!startDate || billDate >= startDate) && (!endDate || billDate <= endDate)) {
                        bill.items.forEach(item => {
                            if (item.productId === product.id) {
                                salesInPeriod += item.quantity;
                            }
                        });
                    }
                });
                
                const currentStock = product.batches.reduce((sum, batch) => sum + batch.stock, 0);
                const openingStock = currentStock - purchasesInPeriod + salesInPeriod;
                const stockValue = product.batches.reduce((sum, batch) => {
                    const unitPrice = batch.mrp / (product.unitsPerStrip || 1);
                    return sum + (unitPrice * batch.stock);
                }, 0);
                
                const latestMrp = product.batches.length > 0 ? Math.max(...product.batches.map(b => b.mrp)) : 0;


                return {
                    id: product.id,
                    name: product.name,
                    company: product.company,
                    composition: product.composition,
                    unitsPerStrip: product.unitsPerStrip,
                    isScheduleH: product.isScheduleH,
                    barcode: product.barcode,
                    openingStock,
                    purchasedQty: purchasesInPeriod,
                    soldQty: salesInPeriod,
                    currentStock,
                    stockValue,
                    latestMrp,
                    product // Pass the original product object for the action button
                };
            }).sort((a,b) => a.name.localeCompare(b.name));
    }, [products, purchases, bills, searchTerm, companyFilter, fromDate, toDate, isPharmaMode]);
    
    const handleExport = () => {
        if (reportData.length === 0) {
            alert("No data to export.");
            return;
        }

        const totalStockValue = reportData.reduce((sum, item) => sum + item.stockValue, 0);

        const exportData = reportData.map(data => ({
            'Product Name': data.name,
            'Company': data.company,
            'Barcode': data.barcode,
            'Composition': data.composition,
            'Schedule H': data.isScheduleH ? 'Yes' : 'No',
            'Opening Stock': formatStock(data.openingStock, data.unitsPerStrip),
            'Purchased Qty (Period)': formatStock(data.purchasedQty, data.unitsPerStrip),
            'Sold Qty (Period)': formatStock(data.soldQty, data.unitsPerStrip),
            'Current Stock': formatStock(data.currentStock, data.unitsPerStrip),
            'MRP': data.latestMrp.toFixed(2),
            'Stock Value (MRP)': data.stockValue.toFixed(2),
        }));

        const headers = Object.keys(exportData[0]);
        const escapeCell = (cell: any) => {
            let strCell = cell === null || cell === undefined ? '' : String(cell);
            if (/[",\n]/.test(strCell)) {
                strCell = `"${strCell.replace(/"/g, '""')}"`;
            }
            return strCell;
        };

        const headerRow = headers.join(',');
        const dataRows = exportData.map(row => 
            headers.map(header => escapeCell((row as any)[header])).join(',')
        );

        const footerCells = new Array(headers.length).fill('');
        footerCells[headers.length - 2] = 'Total Stock Value';
        footerCells[headers.length - 1] = totalStockValue.toFixed(2);
        const footerRow = footerCells.join(',');

        const csvContent = [
            headerRow,
            ...dataRows,
            '', // Add an empty row for spacing
            footerRow
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", 'all_item_stock_report.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <Card title="All Item Stock Report">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <div className="relative flex-grow">
                        <input
                            type="text"
                            placeholder={`Search by product name ${isPharmaMode ? '' : 'or barcode'}...`}
                            value={searchTerm}
                            onChange={e => onSearchTermChange(e.target.value)}
                            className={inputStyle}
                        />
                    </div>
                    {!isPharmaMode && (
                        <button
                            onClick={() => setIsScanning(true)}
                            className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 flex-shrink-0"
                            title="Scan Barcode"
                        >
                            <CameraIcon className="h-6 w-6" />
                        </button>
                    )}
                </div>
                <select
                    value={companyFilter}
                    onChange={e => setCompanyFilter(e.target.value)}
                    className={selectStyle}
                >
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
                            <th scope="col" className="px-6 py-3">Product Name</th>
                            <th scope="col" className="px-6 py-3 text-center">Opening Stock</th>
                            <th scope="col" className="px-6 py-3 text-center">Purchased</th>
                            <th scope="col" className="px-6 py-3 text-center">Sold</th>
                            <th scope="col" className="px-6 py-3 text-center">Current Stock</th>
                            <th scope="col" className="px-6 py-3 text-right">MRP</th>
                            <th scope="col" className="px-6 py-3 text-right">Stock Value</th>
                            <th scope="col" className="px-6 py-3">Actions</th>
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

const SelectedItemStockView: React.FC<{ products: Product[], onDeleteBatch: (pid: string, bid: string) => void, systemConfig: SystemConfig }> = ({ products, onDeleteBatch, systemConfig }) => {
    const [selectedProductId, setSelectedProductId] = useState('');
    const product = products.find(p => p.id === selectedProductId);
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    return (
        <Card title="Selected Item Stock">
            <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Product</label>
                <select 
                    value={selectedProductId} 
                    onChange={e => setSelectedProductId(e.target.value)}
                    className={selectStyle}
                >
                    <option value="">-- Select a Product --</option>
                    {products.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>
            {product ? (
                <div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 block">Company:</span> 
                            <span className="text-slate-900 dark:text-slate-100">{product.company}</span>
                        </div>
                        {isPharmaMode && (
                            <div>
                                <span className="font-semibold text-slate-700 dark:text-slate-300 block">Composition:</span>
                                <span className="text-slate-900 dark:text-slate-100">{product.composition || 'N/A'}</span>
                            </div>
                        )}
                        <div>
                             <span className="font-semibold text-slate-700 dark:text-slate-300 block">Total Stock:</span> 
                             <span className="text-slate-900 dark:text-slate-100 font-bold">{formatStock(product.batches.reduce((acc, b) => acc + b.stock, 0), product.unitsPerStrip)}</span>
                        </div>
                    </div>
                    
                    <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 mb-3">Stock Details</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                            <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-100 dark:bg-slate-700">
                                <tr>
                                    {isPharmaMode && <th className="px-4 py-2">Batch No</th>}
                                    {isPharmaMode && <th className="px-4 py-2">Expiry</th>}
                                    <th className="px-4 py-2">Stock</th>
                                    <th className="px-4 py-2">MRP</th>
                                    <th className="px-4 py-2">Purchase Price</th>
                                    <th className="px-4 py-2">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {product.batches.map(batch => (
                                    <tr key={batch.id} className="border-b dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
                                        {isPharmaMode && <td className="px-4 py-2">{batch.batchNumber}</td>}
                                        {isPharmaMode && <td className="px-4 py-2">{batch.expiryDate}</td>}
                                        <td className="px-4 py-2">{formatStock(batch.stock, product.unitsPerStrip)}</td>
                                        <td className="px-4 py-2">₹{batch.mrp}</td>
                                        <td className="px-4 py-2">₹{batch.purchasePrice}</td>
                                        <td className="px-4 py-2">
                                            <button onClick={() => onDeleteBatch(product.id, batch.id)} className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50">
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <p className="text-slate-500 dark:text-slate-400 text-center py-8 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-dashed dark:border-slate-600">Please select a product to view details.</p>
            )}
        </Card>
    );
};

const BatchWiseStockView: React.FC<{ products: Product[], onDeleteBatch: (pid: string, bid: string) => void, systemConfig: SystemConfig }> = ({ products, onDeleteBatch, systemConfig }) => {
    const [searchTerm, setSearchTerm] = useState('');
    
    const allBatches = useMemo(() => {
        return products.flatMap(p => 
            p.batches.map(b => ({
                ...b,
                productName: p.name,
                productId: p.id,
                company: p.company,
                unitsPerStrip: p.unitsPerStrip
            }))
        ).filter(b => 
            b.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.batchNumber.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => a.productName.localeCompare(b.productName));
    }, [products, searchTerm]);

    return (
        <Card title="Batch Wise Stock">
             <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search by product name or batch number..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={inputStyle}
                />
            </div>
            <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-100 dark:bg-slate-700 sticky top-0">
                        <tr>
                            <th className="px-4 py-2">Product Name</th>
                            <th className="px-4 py-2">Company</th>
                            <th className="px-4 py-2">Batch No</th>
                            <th className="px-4 py-2">Expiry</th>
                            <th className="px-4 py-2">Stock</th>
                            <th className="px-4 py-2">MRP</th>
                            <th className="px-4 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allBatches.map(batch => (
                            <tr key={`${batch.productId}-${batch.id}`} className="border-b dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
                                <td className="px-4 py-2 font-medium">{batch.productName}</td>
                                <td className="px-4 py-2 text-slate-500">{batch.company}</td>
                                <td className="px-4 py-2">{batch.batchNumber}</td>
                                <td className="px-4 py-2">{batch.expiryDate}</td>
                                <td className="px-4 py-2">{formatStock(batch.stock, batch.unitsPerStrip)}</td>
                                <td className="px-4 py-2">₹{batch.mrp}</td>
                                <td className="px-4 py-2">
                                     <button onClick={() => onDeleteBatch(batch.productId, batch.id)} className="text-red-600 hover:text-red-800 p-1">
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

const CompanyWiseStockView: React.FC<{ products: Product[], purchases: Purchase[], bills: Bill[], systemConfig: SystemConfig }> = ({ products }) => {
    const companyStats = useMemo(() => {
        const stats = new Map<string, { count: number, value: number }>();
        products.forEach(p => {
            const current = stats.get(p.company) || { count: 0, value: 0 };
            current.count += 1;
            const pValue = p.batches.reduce((acc, b) => acc + (b.stock * (b.mrp / (p.unitsPerStrip || 1))), 0);
            current.value += pValue;
            stats.set(p.company, current);
        });
        return Array.from(stats.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [products]);

    return (
        <Card title="Company Wise Stock Value">
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-100 dark:bg-slate-700">
                        <tr>
                            <th className="px-6 py-3">Company Name</th>
                            <th className="px-6 py-3 text-center">Total Products</th>
                            <th className="px-6 py-3 text-right">Total Stock Value (MRP)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {companyStats.map(([company, stat]) => (
                            <tr key={company} className="border-b dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
                                <td className="px-6 py-4 font-medium">{company}</td>
                                <td className="px-6 py-4 text-center">{stat.count}</td>
                                <td className="px-6 py-4 text-right font-semibold">₹{stat.value.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
        </Card>
    );
};

const ExpiredStockView: React.FC<{ products: Product[], onDeleteBatch: (pid: string, bid: string) => void, systemConfig: SystemConfig }> = ({ products, onDeleteBatch }) => {
    const today = new Date();
    today.setHours(0,0,0,0);

    const expiredBatches = useMemo(() => {
        return products.flatMap(p => 
            p.batches
            .filter(b => b.stock > 0 && getExpiryDate(b.expiryDate) < today)
            .map(b => ({ ...b, productName: p.name, productId: p.id, unitsPerStrip: p.unitsPerStrip }))
        ).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    }, [products]);

    return (
        <Card title="Expired Stock">
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-red-900 dark:text-red-200">
                    <thead className="text-xs uppercase bg-red-100 dark:bg-red-900/50">
                        <tr>
                            <th className="px-4 py-2">Product Name</th>
                            <th className="px-4 py-2">Batch No</th>
                            <th className="px-4 py-2">Expiry</th>
                            <th className="px-4 py-2">Stock</th>
                            <th className="px-4 py-2">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {expiredBatches.map(batch => (
                            <tr key={`${batch.productId}-${batch.id}`} className="border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                                <td className="px-4 py-2 font-medium">{batch.productName}</td>
                                <td className="px-4 py-2">{batch.batchNumber}</td>
                                <td className="px-4 py-2 font-bold">{batch.expiryDate}</td>
                                <td className="px-4 py-2">{formatStock(batch.stock, batch.unitsPerStrip)}</td>
                                <td className="px-4 py-2">
                                     <button onClick={() => onDeleteBatch(batch.productId, batch.id)} className="text-red-700 hover:text-red-900 p-1 border border-red-300 rounded hover:bg-red-200">
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {expiredBatches.length === 0 && <p className="text-center py-4 text-green-600 dark:text-green-400">No expired stock found.</p>}
            </div>
        </Card>
    );
};

const NearingExpiryStockView: React.FC<{ products: Product[], onDeleteBatch: (pid: string, bid: string) => void, systemConfig: SystemConfig }> = ({ products }) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);

    const nearingExpiryBatches = useMemo(() => {
        return products.flatMap(p => 
            p.batches
            .filter(b => {
                const exp = getExpiryDate(b.expiryDate);
                return b.stock > 0 && exp >= today && exp <= thirtyDaysLater;
            })
            .map(b => ({ ...b, productName: p.name, productId: p.id, unitsPerStrip: p.unitsPerStrip }))
        ).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    }, [products]);

    return (
        <Card title="Stock Nearing Expiry (Next 30 Days)">
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-yellow-900 dark:text-yellow-200">
                    <thead className="text-xs uppercase bg-yellow-100 dark:bg-yellow-900/50">
                        <tr>
                            <th className="px-4 py-2">Product Name</th>
                            <th className="px-4 py-2">Batch No</th>
                            <th className="px-4 py-2">Expiry</th>
                            <th className="px-4 py-2">Stock</th>
                        </tr>
                    </thead>
                    <tbody>
                        {nearingExpiryBatches.map(batch => (
                            <tr key={`${batch.productId}-${batch.id}`} className="border-b border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
                                <td className="px-4 py-2 font-medium">{batch.productName}</td>
                                <td className="px-4 py-2">{batch.batchNumber}</td>
                                <td className="px-4 py-2 font-bold">{batch.expiryDate}</td>
                                <td className="px-4 py-2">{formatStock(batch.stock, batch.unitsPerStrip)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {nearingExpiryBatches.length === 0 && <p className="text-center py-4 text-slate-500">No stock nearing expiry.</p>}
            </div>
        </Card>
    );
};

// --- Modals ---

const AddProductModal: React.FC<{
    isOpen: boolean, onClose: () => void, onAddProduct: (p: Omit<Product, 'id'|'batches'>, b: Omit<Batch, 'id'>) => void, 
    companies: Company[], systemConfig: SystemConfig, gstRates: GstRate[], products: Product[] 
}> = ({ isOpen, onClose, onAddProduct, companies, systemConfig, gstRates, products }) => {
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [formData, setFormData] = useState({
        name: '', company: '', hsnCode: '', gst: gstRates[0]?.rate || 12, barcode: '', 
        composition: '', unitsPerStrip: '', isScheduleH: 'No',
        batchNumber: '', expiryDate: '', stock: '', mrp: '', purchasePrice: ''
    });
    const [isScanning, setIsScanning] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const productData = {
            name: formData.name,
            company: formData.company,
            hsnCode: formData.hsnCode,
            gst: Number(formData.gst),
            barcode: formData.barcode || undefined,
            composition: formData.composition || undefined,
            unitsPerStrip: Number(formData.unitsPerStrip) || undefined,
            isScheduleH: formData.isScheduleH === 'Yes'
        };
        const batchData = {
            batchNumber: isPharmaMode ? formData.batchNumber : 'DEFAULT',
            expiryDate: isPharmaMode ? formData.expiryDate : '9999-12',
            stock: Number(formData.stock),
            mrp: Number(formData.mrp),
            purchasePrice: Number(formData.purchasePrice)
        };
        
        if (isPharmaMode && productData.unitsPerStrip && productData.unitsPerStrip > 1) {
             // Input stock is in strips, convert to units
             batchData.stock = batchData.stock * productData.unitsPerStrip;
        }

        onAddProduct(productData, batchData);
        onClose();
        setFormData({
            name: '', company: '', hsnCode: '', gst: gstRates[0]?.rate || 12, barcode: '', 
            composition: '', unitsPerStrip: '', isScheduleH: 'No',
            batchNumber: '', expiryDate: '', stock: '', mrp: '', purchasePrice: ''
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Product">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm mb-1">Name*</label><input className={inputStyle} required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} /></div>
                    <div><label className="block text-sm mb-1">Company*</label><input className={inputStyle} required value={formData.company} onChange={e=>setFormData({...formData, company: e.target.value})} list="companies" /><datalist id="companies">{companies.map(c=><option key={c.id} value={c.name}/>)}</datalist></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div><label className="block text-sm mb-1">HSN Code</label><input className={inputStyle} value={formData.hsnCode} onChange={e=>setFormData({...formData, hsnCode: e.target.value})} /></div>
                     <div>
                         <label className="block text-sm mb-1">GST %</label>
                         <select className={selectStyle} value={formData.gst} onChange={e=>setFormData({...formData, gst: Number(e.target.value)})}>
                             {gstRates.map(r => <option key={r.id} value={r.rate}>{r.rate}%</option>)}
                         </select>
                     </div>
                     {!isPharmaMode && (
                        <div className="relative">
                             <label className="block text-sm mb-1">Barcode</label>
                             <div className="flex gap-1">
                                <input className={inputStyle} value={formData.barcode} onChange={e=>setFormData({...formData, barcode: e.target.value})} />
                                <button type="button" onClick={()=>setIsScanning(true)} className="p-2 bg-slate-200 rounded hover:bg-slate-300"><CameraIcon className="h-5 w-5"/></button>
                             </div>
                        </div>
                     )}
                </div>
                {isPharmaMode && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded">
                         <div><label className="block text-sm mb-1">Composition</label><input className={inputStyle} value={formData.composition} onChange={e=>setFormData({...formData, composition: e.target.value})} /></div>
                         <div><label className="block text-sm mb-1">Units/Strip</label><input type="number" className={inputStyle} value={formData.unitsPerStrip} onChange={e=>setFormData({...formData, unitsPerStrip: e.target.value})} /></div>
                         <div><label className="block text-sm mb-1">Schedule H?</label><select className={selectStyle} value={formData.isScheduleH} onChange={e=>setFormData({...formData, isScheduleH: e.target.value})}><option>No</option><option>Yes</option></select></div>
                    </div>
                )}
                <div className="border-t pt-4 mt-2">
                    <h4 className="font-semibold mb-3">Initial Stock Details</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {isPharmaMode && <div><label className="block text-xs mb-1">Batch No</label><input className={inputStyle} required value={formData.batchNumber} onChange={e=>setFormData({...formData, batchNumber: e.target.value})} /></div>}
                        {isPharmaMode && <div><label className="block text-xs mb-1">Expiry</label><input type="month" className={inputStyle} required value={formData.expiryDate} onChange={e=>setFormData({...formData, expiryDate: e.target.value})} /></div>}
                        <div><label className="block text-xs mb-1">Qty {isPharmaMode ? '(Strips)' : ''}</label><input type="number" className={inputStyle} required value={formData.stock} onChange={e=>setFormData({...formData, stock: e.target.value})} /></div>
                        <div><label className="block text-xs mb-1">Purchase Price</label><input type="number" step="0.01" className={inputStyle} required value={formData.purchasePrice} onChange={e=>setFormData({...formData, purchasePrice: e.target.value})} /></div>
                        <div><label className="block text-xs mb-1">MRP</label><input type="number" step="0.01" className={inputStyle} required value={formData.mrp} onChange={e=>setFormData({...formData, mrp: e.target.value})} /></div>
                    </div>
                </div>
                <div className="flex justify-end pt-4">
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Save Product</button>
                </div>
            </form>
            <BarcodeScannerModal isOpen={isScanning} onClose={()=>setIsScanning(false)} onScanSuccess={(txt)=>{setFormData(prev=>({...prev, barcode: txt})); setIsScanning(false);}} />
        </Modal>
    );
};

const AddBatchModal: React.FC<{ isOpen: boolean, onClose: () => void, product: Product, onAddBatch: (pid: string, b: Omit<Batch, 'id'>) => void, onDeleteBatch: (pid: string, bid: string) => void, systemConfig: SystemConfig }> = ({ isOpen, onClose, product, onAddBatch, onDeleteBatch, systemConfig }) => {
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [formData, setFormData] = useState({ batchNumber: '', expiryDate: '', stock: '', mrp: '', purchasePrice: '' });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let stock = Number(formData.stock);
        if (isPharmaMode && product.unitsPerStrip && product.unitsPerStrip > 1) {
            stock = stock * product.unitsPerStrip;
        }
        onAddBatch(product.id, {
            batchNumber: isPharmaMode ? formData.batchNumber : 'DEFAULT',
            expiryDate: isPharmaMode ? formData.expiryDate : '9999-12',
            stock,
            mrp: Number(formData.mrp),
            purchasePrice: Number(formData.purchasePrice)
        });
        setFormData({ batchNumber: '', expiryDate: '', stock: '', mrp: '', purchasePrice: '' });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Manage Stock: ${product.name}`}>
             <div className="mb-6">
                 <h4 className="font-medium mb-2 text-slate-700 dark:text-slate-300">Add New Batch / Stock</h4>
                 <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end bg-slate-50 dark:bg-slate-700/50 p-3 rounded">
                    {isPharmaMode && <div><label className="text-xs block mb-1">Batch No</label><input className={inputStyle} required value={formData.batchNumber} onChange={e=>setFormData({...formData, batchNumber: e.target.value})}/></div>}
                    {isPharmaMode && <div><label className="text-xs block mb-1">Expiry</label><input type="month" className={inputStyle} required value={formData.expiryDate} onChange={e=>setFormData({...formData, expiryDate: e.target.value})}/></div>}
                    <div><label className="text-xs block mb-1">Qty {isPharmaMode ? '(Strips)' : ''}</label><input type="number" className={inputStyle} required value={formData.stock} onChange={e=>setFormData({...formData, stock: e.target.value})}/></div>
                    <div><label className="text-xs block mb-1">Pur. Price</label><input type="number" step="0.01" className={inputStyle} required value={formData.purchasePrice} onChange={e=>setFormData({...formData, purchasePrice: e.target.value})}/></div>
                    <div><label className="text-xs block mb-1">MRP</label><input type="number" step="0.01" className={inputStyle} required value={formData.mrp} onChange={e=>setFormData({...formData, mrp: e.target.value})}/></div>
                    <button className="col-span-2 md:col-span-5 mt-2 py-2 bg-green-600 text-white rounded w-full">Add Stock</button>
                 </form>
             </div>
             <div>
                 <h4 className="font-medium mb-2 text-slate-700 dark:text-slate-300">Existing Batches</h4>
                 <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 dark:bg-slate-700">
                            <tr>
                                {isPharmaMode && <th>Batch</th>}
                                {isPharmaMode && <th>Exp</th>}
                                <th>Stock</th>
                                <th>MRP</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {product.batches.map(b => (
                                <tr key={b.id} className="border-b">
                                    {isPharmaMode && <td>{b.batchNumber}</td>}
                                    {isPharmaMode && <td>{b.expiryDate}</td>}
                                    <td>{formatStock(b.stock, product.unitsPerStrip)}</td>
                                    <td>{b.mrp}</td>
                                    <td><button onClick={() => onDeleteBatch(product.id, b.id)} className="text-red-500"><TrashIcon className="h-4 w-4"/></button></td>
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
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [formData, setFormData] = useState({ ...product, unitsPerStrip: String(product.unitsPerStrip || ''), isScheduleH: product.isScheduleH ? 'Yes' : 'No', gst: product.gst || 12 });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdateProduct(product.id, {
            name: formData.name,
            company: formData.company,
            hsnCode: formData.hsnCode,
            gst: Number(formData.gst),
            barcode: formData.barcode,
            composition: formData.composition,
            unitsPerStrip: Number(formData.unitsPerStrip) || undefined,
            isScheduleH: formData.isScheduleH === 'Yes'
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Product">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm mb-1">Name</label><input className={inputStyle} required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} /></div>
                    <div><label className="block text-sm mb-1">Company</label><input className={inputStyle} required value={formData.company} onChange={e=>setFormData({...formData, company: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="block text-sm mb-1">HSN</label><input className={inputStyle} value={formData.hsnCode} onChange={e=>setFormData({...formData, hsnCode: e.target.value})} /></div>
                    <div><label className="block text-sm mb-1">GST %</label><select className={selectStyle} value={formData.gst} onChange={e=>setFormData({...formData, gst: Number(e.target.value)})}>{gstRates.map(r=><option key={r.id} value={r.rate}>{r.rate}%</option>)}</select></div>
                    {!isPharmaMode && <div><label className="block text-sm mb-1">Barcode</label><input className={inputStyle} value={formData.barcode || ''} onChange={e=>setFormData({...formData, barcode: e.target.value})} /></div>}
                </div>
                {isPharmaMode && (
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded">
                         <div><label className="block text-sm mb-1">Composition</label><input className={inputStyle} value={formData.composition || ''} onChange={e=>setFormData({...formData, composition: e.target.value})} /></div>
                         <div><label className="block text-sm mb-1">Units/Strip</label><input type="number" className={inputStyle} value={formData.unitsPerStrip} onChange={e=>setFormData({...formData, unitsPerStrip: e.target.value})} /></div>
                         <div><label className="block text-sm mb-1">Schedule H?</label><select className={selectStyle} value={formData.isScheduleH} onChange={e=>setFormData({...formData, isScheduleH: e.target.value})}><option>No</option><option>Yes</option></select></div>
                    </div>
                )}
                <div className="flex justify-end pt-4">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Update Product</button>
                </div>
            </form>
        </Modal>
    );
};

const PrintLabelModal: React.FC<{ isOpen: boolean, onClose: () => void, product: Product, companyProfile: CompanyProfile, systemConfig: SystemConfig }> = ({ isOpen, onClose, product, companyProfile }) => {
    const [quantity, setQuantity] = useState(1);
    
    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head><title>Print Labels</title><style>
                    body { margin: 0; padding: 10px; font-family: sans-serif; text-align: center; }
                    .label { width: 50mm; height: 25mm; border: 1px solid #ccc; margin: 2mm; display: inline-block; box-sizing: border-box; padding: 2mm; text-align: center; overflow: hidden; page-break-inside: avoid; }
                    .name { font-size: 10px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                    .meta { font-size: 8px; margin-top: 2px; }
                    .price { font-size: 12px; font-weight: bold; margin-top: 2px; }
                </style></head>
                <body>
                    ${Array.from({length: quantity}).map(() => `
                        <div class="label">
                            <div class="name">${product.name}</div>
                            <div class="meta">${companyProfile.name.substring(0, 15)}</div>
                            <div class="price">MRP: ₹${Math.max(...product.batches.map(b => b.mrp), 0).toFixed(2)}</div>
                             ${product.barcode ? `<div style="font-size: 9px; letter-spacing: 1px;">${product.barcode}</div>` : ''}
                        </div>
                    `).join('')}
                </body>
                </html>
            `);
            printWindow.document.close();
            setTimeout(() => { printWindow.print(); printWindow.close(); onClose(); }, 500);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Print Labels">
            <div className="space-y-4">
                <p>Product: <strong>{product.name}</strong></p>
                <div>
                    <label className="block text-sm mb-1">Number of Labels</label>
                    <input type="number" className={inputStyle} value={quantity} onChange={e=>setQuantity(Math.max(1, Number(e.target.value)))} min="1" />
                </div>
                <div className="flex justify-end">
                    <button onClick={handlePrint} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2"><BarcodeIcon className="h-4 w-4"/> Print</button>
                </div>
            </div>
        </Modal>
    );
};

const ImportProductsModal: React.FC<{ isOpen: boolean, onClose: () => void, onBulkAddProducts: (p: any[]) => Promise<{success: number, skipped: number}> }> = ({ isOpen, onClose, onBulkAddProducts }) => {
    const [jsonInput, setJsonInput] = useState('');
    const [status, setStatus] = useState('');

    const handleImport = async () => {
        try {
            const data = JSON.parse(jsonInput);
            if (!Array.isArray(data)) throw new Error("Input must be a JSON array");
            
            setStatus("Importing...");
            const result = await onBulkAddProducts(data);
            setStatus(`Success: Added ${result.success}, Skipped ${result.skipped}`);
            setTimeout(onClose, 2000);
        } catch (e: any) {
            setStatus(`Error: ${e.message}`);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import Products (JSON)">
            <p className="text-xs text-slate-500 mb-2">Paste a JSON array of product objects. Example: <code>[{`{"name":"A", "company":"B", "hsnCode":"123", "gst":12, ...}`} ]</code></p>
            <textarea className="w-full h-40 p-2 border rounded bg-slate-50 dark:bg-slate-800 dark:text-white text-xs font-mono" value={jsonInput} onChange={e=>setJsonInput(e.target.value)} placeholder="Paste JSON here..."></textarea>
            {status && <p className="text-sm mt-2 font-semibold">{status}</p>}
            <div className="flex justify-end pt-4">
                <button onClick={handleImport} className="px-4 py-2 bg-blue-600 text-white rounded">Import</button>
            </div>
        </Modal>
    );
};

export default Inventory;

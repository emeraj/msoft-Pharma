

import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import type { Product, Batch, Company, Bill, Purchase, SystemConfig, CompanyProfile, GstRate } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, DownloadIcon, TrashIcon, PencilIcon, UploadIcon, BarcodeIcon } from './icons/Icons';

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
  onUpdateProduct: (productId: string, productData: Partial<Omit<Product, 'id' | 'batches' | 'mrp' | 'purchasePrice'>>) => void;
  onAddBatch: (productId: string, batch: Omit<Batch, 'id'>) => void;
  onDeleteBatch: (productId: string, batchId: string) => void;
  onBulkAddProducts: (products: Omit<Product, 'id' | 'batches'>[]) => Promise<{success: number; skipped: number}>;
}

type InventorySubView = 'all' | 'selected' | 'batch' | 'company' | 'expired' | 'nearing_expiry';

// --- Main Inventory Component ---
const Inventory: React.FC<InventoryProps> = ({ products, companies, bills, purchases, systemConfig, companyProfile, gstRates, onAddProduct, onUpdateProduct, onAddBatch, onDeleteBatch, onBulkAddProducts }) => {
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

  const renderSubView = () => {
    switch (activeSubView) {
      case 'all':
        return <AllItemStockView products={products} purchases={purchases} bills={bills} onOpenBatchModal={handleOpenBatchModal} onOpenEditModal={handleOpenEditModal} onOpenPrintLabelModal={handleOpenPrintLabelModal} systemConfig={systemConfig} searchTerm={searchTerm} onSearchTermChange={setSearchTerm} />;
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
        return <AllItemStockView products={products} purchases={purchases} bills={bills} onOpenBatchModal={handleOpenBatchModal} onOpenEditModal={handleOpenEditModal} onOpenPrintLabelModal={handleOpenPrintLabelModal} systemConfig={systemConfig} searchTerm={searchTerm} onSearchTermChange={setSearchTerm} />;
    }
  };
  const [activeSubView, setActiveSubView] = useState<InventorySubView>('all');
  
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
}

const AllItemStockView: React.FC<AllItemStockViewProps> = ({ products, purchases, bills, systemConfig, searchTerm, onSearchTermChange, onOpenBatchModal, onOpenEditModal, onOpenPrintLabelModal }) => {
    const [companyFilter, setCompanyFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    const companies = useMemo(() => [...new Set(products.map(p => p.company))].sort(), [products]);
    
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
                    product // Pass the original product object for the action button
                };
            }).sort((a,b) => a.name.localeCompare(b.name));
    }, [products, purchases, bills, searchTerm, companyFilter, fromDate, toDate, isPharmaMode]);
    
    const handleExport = () => {
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
            'Stock Value (MRP)': data.stockValue.toFixed(2),
        }));
        exportToCsv('all_item_stock_report', exportData);
    };

    return (
        <Card title="All Item Stock Report">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="flex items-center">
                    <input
                        type="text"
                        placeholder={`Search by product name ${isPharmaMode ? '' : 'or barcode'}...`}
                        value={searchTerm}
                        onChange={e => onSearchTermChange(e.target.value)}
                        className={inputStyle}
                    />
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
        </Card>
    );
};

const SelectedItemStockView: React.FC<{products: Product[], onDeleteBatch: (productId: string, batchId: string) => void, systemConfig: SystemConfig}> = ({ products, onDeleteBatch, systemConfig }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    const searchResults = useMemo(() => {
        if (!searchTerm || selectedProduct) return [];
        return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10);
    }, [searchTerm, products, selectedProduct]);

    const handleSelect = (product: Product) => {
        setSelectedProduct(product);
        setSearchTerm(product.name);
    };

    return (
        <Card title="View Selected Item Stock">
            <div className="relative mb-6">
                <input
                    type="text"
                    placeholder="Search for a product..."
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (selectedProduct) setSelectedProduct(null);
                    }}
                    className={inputStyle}
                />
                {searchResults.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {searchResults.map(p => (
                            <li key={p.id} onClick={() => handleSelect(p)} className="px-4 py-2 text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900 cursor-pointer">{p.name}</li>
                        ))}
                    </ul>
                )}
            </div>
            {selectedProduct && (
                 <div className="animate-fade-in">
                    <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg border dark:border-slate-600 mb-4">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{selectedProduct.name}</h3>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{selectedProduct.company}</p>
                        {isPharmaMode && selectedProduct.composition && <p className="text-sm text-indigo-700 dark:text-indigo-300 font-medium mt-1">{selectedProduct.composition}</p>}
                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-800 dark:text-slate-300">
                           <span>HSN: {selectedProduct.hsnCode}</span>
                           <span>GST: {selectedProduct.gst}%</span>
                           {!isPharmaMode && selectedProduct.barcode && <span>Barcode: {selectedProduct.barcode}</span>}
                           {isPharmaMode && selectedProduct.unitsPerStrip && <span>{selectedProduct.unitsPerStrip} Units/Strip</span>}
                           {isPharmaMode && selectedProduct.isScheduleH && <span className="px-2 py-0.5 text-xs font-semibold text-white bg-orange-600 dark:bg-orange-700 rounded-full">Schedule H Drug</span>}
                           <span className="font-semibold">Total Stock: {formatStock(selectedProduct.batches.reduce((sum, b) => sum + b.stock, 0), selectedProduct.unitsPerStrip)}</span>
                        </div>
                    </div>
                    <BatchListTable 
                      title={isPharmaMode ? "Batches for Selected Product" : "Stock Details"} 
                      batches={selectedProduct.batches.map(b => ({...b, productName: selectedProduct.name, company: selectedProduct.company, productId: selectedProduct.id, unitsPerStrip: selectedProduct.unitsPerStrip}))} 
                      showProductInfo={false}
                      onDeleteBatch={onDeleteBatch}
                      systemConfig={systemConfig}
                    />
                 </div>
            )}
        </Card>
    );
};

const CompanyWiseStockView: React.FC<{products: Product[], purchases: Purchase[], bills: Bill[], systemConfig: SystemConfig}> = ({ products, purchases, bills, systemConfig }) => {
    const [companyFilter, setCompanyFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    const companies = useMemo(() => [...new Set(products.map(p => p.company))].sort(), [products]);
    
    const reportData = useMemo(() => {
        const startDate = fromDate ? new Date(fromDate) : null;
        if (startDate) startDate.setHours(0, 0, 0, 0);

        const endDate = toDate ? new Date(toDate) : null;
        if (endDate) endDate.setHours(23, 59, 59, 999);

        const companyProducts = products.filter(product => companyFilter === '' || product.company === companyFilter);
        
        const processBatches = (product: Product) => product.batches.map(batch => {
            let purchasesInPeriod = 0;
            purchases.forEach(purchase => {
                const purchaseDate = new Date(purchase.invoiceDate);
                if ((!startDate || purchaseDate >= startDate) && (!endDate || purchaseDate <= endDate)) {
                    purchase.items.forEach(item => {
                        if (item.batchId === batch.id) {
                            purchasesInPeriod += item.quantity * (item.unitsPerStrip || product.unitsPerStrip || 1);
                        }
                    });
                }
            });

            let salesInPeriod = 0;
            bills.forEach(bill => {
                const billDate = new Date(bill.date);
                 if ((!startDate || billDate >= startDate) && (!endDate || billDate <= endDate)) {
                    bill.items.forEach(item => {
                        if (item.batchId === batch.id) {
                            salesInPeriod += item.quantity;
                        }
                    });
                }
            });

            const currentStock = batch.stock;
            const openingStock = currentStock - purchasesInPeriod + salesInPeriod;
            const unitPrice = batch.mrp / (product.unitsPerStrip || 1);
            const stockValue = unitPrice * currentStock;
            
            return {
                id: batch.id,
                productId: product.id,
                batchNumber: batch.batchNumber,
                expiryDate: batch.expiryDate,
                mrp: batch.mrp,
                productName: product.name,
                company: product.company,
                unitsPerStrip: product.unitsPerStrip,
                openingStock,
                purchasedQty: purchasesInPeriod,
                soldQty: salesInPeriod,
                currentStock,
                stockValue,
            };
        });
        
        let allItems = companyProducts.flatMap(processBatches);

        if (!isPharmaMode) {
            const aggregated: { [productId: string]: any } = {};
            allItems.forEach(item => {
                if (!aggregated[item.productId]) {
                    aggregated[item.productId] = { ...item };
                } else {
                    aggregated[item.productId].openingStock += item.openingStock;
                    aggregated[item.productId].purchasedQty += item.purchasedQty;
                    aggregated[item.productId].soldQty += item.soldQty;
                    aggregated[item.productId].currentStock += item.currentStock;
                    aggregated[item.productId].stockValue += item.stockValue;
                }
            });
            allItems = Object.values(aggregated);
        }

        return allItems.sort((a, b) => {
            const nameA = a.productName.toLowerCase();
            const nameB = b.productName.toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return a.batchNumber.localeCompare(b.batchNumber);
        });
    }, [products, purchases, bills, companyFilter, fromDate, toDate, isPharmaMode]);
    
    // FIX: Ensure `processedReportData` always returns items with `showProductInfo` to resolve TypeScript error.
    // When not in pharma mode, `showProductInfo` is not used in the JSX, but adding it makes the type consistent.
    const processedReportData = useMemo(() => {
        if (!isPharmaMode) {
            return reportData.map(item => ({...item, showProductInfo: true}));
        }

        let lastProductName = '';
        return reportData.map(batch => {
            const showProductInfo = batch.productName !== lastProductName;
            if (showProductInfo) {
                lastProductName = batch.productName;
            }
            return { ...batch, showProductInfo };
        });
    }, [reportData, isPharmaMode]);

    const handleExport = () => {
        const exportData = reportData.map(item => {
            const baseData: any = {
                'Product Name': item.productName,
                'Company': item.company,
                'Opening Stock': formatStock(item.openingStock, item.unitsPerStrip),
                'Purchased (Period)': formatStock(item.purchasedQty, item.unitsPerStrip),
                'Sold (Period)': formatStock(item.soldQty, item.unitsPerStrip),
                'Current Stock': formatStock(item.currentStock, item.unitsPerStrip),
                'Stock Value (MRP)': item.stockValue.toFixed(2),
            };
            if (isPharmaMode) {
                baseData['Batch No.'] = item.batchNumber;
                baseData['Expiry'] = item.expiryDate;
            }
            return baseData;
        });

        const filename = companyFilter ? `stock_for_${companyFilter.replace(/ /g, '_')}` : 'company_wise_stock';
        exportToCsv(filename, exportData);
    };

    return (
        <Card title="Company-wise Stock">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                 <select
                    value={companyFilter}
                    onChange={e => setCompanyFilter(e.target.value)}
                    className={`${selectStyle} lg:col-span-2`}
                >
                    <option value="">All Companies</option>
                    {companies.map(company => <option key={company} value={company}>{company}</option>)}
                </select>
                <div className="flex items-center gap-2">
                    <label htmlFor="fromDate-cws" className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">From</label>
                    <input type="date" id="fromDate-cws" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputStyle} />
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor="toDate-cws" className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">To</label>
                    <input type="date" id="toDate-cws" value={toDate} onChange={e => setToDate(e.target.value)} className={inputStyle} />
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
                            <th scope="col" className="px-6 py-3">Company</th>
                            {isPharmaMode && <th scope="col" className="px-6 py-3">Batch No.</th>}
                            {isPharmaMode && <th scope="col" className="px-6 py-3">Expiry</th>}
                            <th scope="col" className="px-6 py-3 text-center">Opening Stock</th>
                            <th scope="col" className="px-6 py-3 text-center">Purchased (Period)</th>
                            <th scope="col" className="px-6 py-3 text-center">Sold (Period)</th>
                            <th scope="col" className="px-6 py-3 text-center">Current Stock</th>
                            <th scope="col" className="px-6 py-3 text-right">Stock Value (MRP)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processedReportData.map(item => (
                            <tr key={isPharmaMode ? item.id : item.productId} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                <th scope="row" className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                                    {isPharmaMode ? (item.showProductInfo ? item.productName : '') : item.productName}
                                </th>
                                <td className="px-6 py-4">{isPharmaMode ? (item.showProductInfo ? item.company : '') : item.company}</td>
                                {isPharmaMode && <td className="px-6 py-4">{item.batchNumber}</td>}
                                {isPharmaMode && <td className="px-6 py-4">{item.expiryDate}</td>}
                                <td className="px-6 py-4 text-center">{formatStock(item.openingStock, item.unitsPerStrip)}</td>
                                <td className="px-6 py-4 text-center">{formatStock(item.purchasedQty, item.unitsPerStrip)}</td>
                                <td className="px-6 py-4 text-center">{formatStock(item.soldQty, item.unitsPerStrip)}</td>
                                <td className="px-6 py-4 text-center font-bold">{formatStock(item.currentStock, item.unitsPerStrip)}</td>
                                <td className="px-6 py-4 text-right font-semibold">₹{item.stockValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {reportData.length === 0 && (
                    <div className="text-center py-10 text-slate-600 dark:text-slate-400">
                        <p>No products found for the selected criteria.</p>
                    </div>
                )}
            </div>
        </Card>
    );
};


// Shared logic for batch views
const getExpiryDate = (expiryString: string): Date => {
    const [year, month] = expiryString.split('-').map(Number);
    return new Date(year, month, 0); // Last day of the expiry month
};

const BatchWiseStockView: React.FC<{products: Product[], onDeleteBatch: (productId: string, batchId: string) => void, systemConfig: SystemConfig}> = ({ products, onDeleteBatch, systemConfig }) => {
    const allBatches = useMemo(() => products.flatMap(p => p.batches.map(b => ({ ...b, productName: p.name, company: p.company, productId: p.id, unitsPerStrip: p.unitsPerStrip }))), [products]);
    return <BatchListTable title="All Batches" batches={allBatches} onDeleteBatch={onDeleteBatch} systemConfig={systemConfig} />;
};

const ExpiredStockView: React.FC<{products: Product[], onDeleteBatch: (productId: string, batchId: string) => void, systemConfig: SystemConfig}> = ({ products, onDeleteBatch, systemConfig }) => {
    const today = new Date();
    const expiredBatches = useMemo(() => 
        products.flatMap(p => p.batches.map(b => ({ ...b, productName: p.name, company: p.company, productId: p.id, unitsPerStrip: p.unitsPerStrip })))
                .filter(b => getExpiryDate(b.expiryDate) < today), 
    [products]);
    return <BatchListTable title="Expired Stock" batches={expiredBatches} onDeleteBatch={onDeleteBatch} systemConfig={systemConfig} />;
};

const NearingExpiryStockView: React.FC<{products: Product[], onDeleteBatch: (productId: string, batchId: string) => void, systemConfig: SystemConfig}> = ({ products, onDeleteBatch, systemConfig }) => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    const nearingExpiryBatches = useMemo(() => 
        products.flatMap(p => p.batches.map(b => ({ ...b, productName: p.name, company: p.company, productId: p.id, unitsPerStrip: p.unitsPerStrip })))
                .filter(b => {
                    const expiry = getExpiryDate(b.expiryDate);
                    return expiry >= today && expiry <= thirtyDaysFromNow;
                }), 
    [products]);
    return <BatchListTable title="Stock Nearing Expiry (30 Days)" batches={nearingExpiryBatches} onDeleteBatch={onDeleteBatch} systemConfig={systemConfig} />;
};


// --- Reusable & Helper Components ---

interface BatchWithProductInfo extends Batch { productName: string; company: string; productId: string; unitsPerStrip?: number }
const BatchListTable: React.FC<{ title: string; batches: BatchWithProductInfo[], showProductInfo?: boolean; systemConfig: SystemConfig; onDeleteBatch?: (productId: string, batchId: string) => void; }> = ({ title, batches, showProductInfo = true, systemConfig, onDeleteBatch }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    const filteredBatches = useMemo(() =>
        batches.filter(b => 
            b.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (isPharmaMode && b.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()))
        ).sort((a, b) => {
            const nameA = a.productName.toLowerCase();
            const nameB = b.productName.toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            // If product names are the same, sort by expiry date in pharma mode
            return isPharmaMode ? (getExpiryDate(a.expiryDate).getTime() - getExpiryDate(b.expiryDate).getTime()) : 0;
        }),
    [batches, searchTerm, isPharmaMode]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    const handleExport = () => {
        const exportData = filteredBatches.map(batch => {
            const baseData: any = {
                'Stock': formatStock(batch.stock, batch.unitsPerStrip),
                'MRP': batch.mrp.toFixed(2),
            };
            if(isPharmaMode) {
                baseData['Batch No.'] = batch.batchNumber;
                baseData['Expiry'] = batch.expiryDate;
            }
            if (showProductInfo) {
                return {
                    'Product': batch.productName,
                    'Company': batch.company,
                    ...baseData
                };
            }
            return baseData;
        });
        exportToCsv(title.toLowerCase().replace(/ /g, '_'), exportData);
    };

    return (
        <Card title={title}>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <input
                    type="text"
                    placeholder={`Search by product${isPharmaMode ? ' or batch...' : '...'}`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={`${inputStyle} flex-grow`}
                />
                <button onClick={handleExport} className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors duration-200">
                    <DownloadIcon className="h-5 w-5" /> 
                    <span className="hidden sm:inline">Export</span>
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                        <tr>
                            {showProductInfo && <th className="px-6 py-3">Product</th>}
                            {showProductInfo && <th className="px-6 py-3">Company</th>}
                            {isPharmaMode && <th className="px-6 py-3">Batch No.</th>}
                            {isPharmaMode && <th className="px-6 py-3">Expiry</th>}
                            <th className="px-6 py-3">Stock</th>
                            <th className="px-6 py-3">MRP</th>
                            {isPharmaMode && <th className="px-6 py-3">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBatches.map(batch => {
                            const expiry = getExpiryDate(batch.expiryDate);
                            let rowClass = 'bg-white dark:bg-slate-800';
                            let expiryBadge = null;
                            let rowTitle = '';

                            if (isPharmaMode) {
                                if (expiry < today) {
                                    rowClass = 'bg-red-100 dark:bg-red-900/50 text-red-900 dark:text-red-100 hover:bg-red-200 dark:hover:bg-red-900/70';
                                    expiryBadge = <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-red-600 dark:bg-red-700 rounded-full">Expired</span>;
                                    rowTitle = `This batch expired on ${expiry.toLocaleDateString()}`;
                                } else if (expiry <= thirtyDaysFromNow) {
                                    rowClass = 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-100 hover:bg-yellow-200 dark:hover:bg-yellow-900/70';
                                    expiryBadge = <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-slate-800 bg-yellow-400 dark:text-slate-900 dark:bg-yellow-500 rounded-full">Expires Soon</span>;
                                    rowTitle = `This batch expires on ${expiry.toLocaleDateString()}`;
                                }
                            }
                            
                            return (
                            <tr key={batch.id} className={`${rowClass} border-b dark:border-slate-700`} title={rowTitle}>
                                {showProductInfo && <td className="px-6 py-4 font-medium">{batch.productName}</td>}
                                {showProductInfo && <td className="px-6 py-4">{batch.company}</td>}
                                {isPharmaMode && <td className="px-6 py-4">{batch.batchNumber}</td>}
                                {isPharmaMode && <td className="px-6 py-4 flex items-center">{batch.expiryDate} {expiryBadge}</td>}
                                <td className="px-6 py-4 font-bold">{formatStock(batch.stock, batch.unitsPerStrip)}</td>
                                <td className="px-6 py-4">₹{batch.mrp.toFixed(2)}</td>
                                {isPharmaMode && (
                                    <td className="px-6 py-4">
                                      {onDeleteBatch && (
                                        <button
                                          onClick={() => {
                                            if (window.confirm(`Are you sure you want to delete batch "${batch.batchNumber}" for product "${batch.productName}"? This action cannot be undone.`)) {
                                              onDeleteBatch(batch.productId, batch.id);
                                            }
                                          }}
                                          className="text-red-500 hover:text-red-700 transition-colors"
                                          title="Delete Batch"
                                        >
                                          <TrashIcon className="h-5 w-5" />
                                        </button>
                                      )}
                                    </td>
                                )}
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredBatches.length === 0 && <div className="text-center py-10 text-slate-600 dark:text-slate-400"><p>No batches found.</p></div>}
            </div>
        </Card>
    );
};

const formInputStyle = "p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-indigo-500";
const formSelectStyle = `${formInputStyle} appearance-none`;

const AddProductModal: React.FC<{ isOpen: boolean; onClose: () => void; onAddProduct: InventoryProps['onAddProduct']; companies: Company[]; systemConfig: SystemConfig; gstRates: GstRate[]; }> = ({ isOpen, onClose, onAddProduct, companies, systemConfig, gstRates }) => {
  const sortedGstRates = useMemo(() => [...gstRates].sort((a, b) => a.rate - b.rate), [gstRates]);
  const defaultGst = useMemo(() => sortedGstRates.find(r => r.rate === 12)?.rate.toString() || sortedGstRates[0]?.rate.toString() || '0', [sortedGstRates]);

  const getInitialFormState = () => ({
    name: '', company: '', hsnCode: '', gst: defaultGst, barcode: '', composition: '', unitsPerStrip: '', isScheduleH: 'No',
    batchNumber: '', expiryDate: '', stock: '', mrp: '', purchasePrice: ''
  });

  const [formState, setFormState] = useState(getInitialFormState());
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const isPharmaMode = systemConfig.softwareMode === 'Pharma';

  const companySuggestions = useMemo(() => {
    if (!formState.company) {
        return companies.slice(0, 5);
    }
    return companies.filter(c => c.name.toLowerCase().includes(formState.company.toLowerCase()));
  }, [formState.company, companies]);

  const companyExists = useMemo(() => {
    return companies.some(c => c.name.toLowerCase() === formState.company.trim().toLowerCase());
  }, [formState.company, companies]);

  const handleSelectCompany = (companyName: string) => {
    setFormState({ ...formState, company: companyName });
    setShowCompanySuggestions(false);
  };


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, company, hsnCode, gst, barcode, composition, unitsPerStrip, isScheduleH, batchNumber, expiryDate, stock, mrp, purchasePrice } = formState;
    if (!name || !company || !stock || !mrp) return;
    if (isPharmaMode && (!batchNumber || !expiryDate)) {
        alert("Batch Number and Expiry Date are required in Pharma Mode.");
        return;
    }

    const units = parseInt(unitsPerStrip) || 1;
    const stockInBaseUnits = parseInt(stock) * (isPharmaMode ? units : 1);

    const productDetails: Omit<Product, 'id' | 'batches'> = {
      name,
      company,
      hsnCode,
      gst: parseFloat(gst),
    };
    
    if (isPharmaMode) {
        productDetails.isScheduleH = isScheduleH === 'Yes';
        if (composition) {
          productDetails.composition = composition;
        }
        if (units > 1) {
          productDetails.unitsPerStrip = units;
        }
    } else {
        productDetails.barcode = barcode;
    }

    onAddProduct(
      productDetails,
      { 
          batchNumber: isPharmaMode ? batchNumber : 'DEFAULT', 
          expiryDate: isPharmaMode ? expiryDate : '9999-12', 
          stock: stockInBaseUnits, 
          mrp: parseFloat(mrp), 
          purchasePrice: parseFloat(purchasePrice) || 0 
      }
    );
    onClose();
    setFormState(getInitialFormState());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Product">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h4 className="font-semibold text-slate-700 dark:text-slate-300">Product Details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input name="name" value={formState.name} onChange={handleChange} placeholder="Product Name" className={formInputStyle} required />
          <div className="relative">
            <input 
              name="company" 
              value={formState.company} 
              onChange={handleChange}
              onFocus={() => setShowCompanySuggestions(true)}
              onBlur={() => setTimeout(() => setShowCompanySuggestions(false), 200)}
              placeholder="Company" 
              className={formInputStyle} 
              required 
              autoComplete="off"
            />
            {showCompanySuggestions && (
              <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {companySuggestions.map(c => (
                      <li key={c.id} onClick={() => handleSelectCompany(c.name)} className="px-4 py-2 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900 text-slate-800 dark:text-slate-200">
                          {c.name}
                      </li>
                  ))}
                  {!companyExists && formState.company.trim().length > 0 && (
                      <li onClick={() => handleSelectCompany(formState.company.trim())} className="px-4 py-2 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900 text-green-600 dark:text-green-400 font-semibold">
                          Create new company: "{formState.company.trim()}"
                      </li>
                  )}
              </ul>
            )}
          </div>
          <input name="hsnCode" value={formState.hsnCode} onChange={handleChange} placeholder="HSN Code" className={formInputStyle} />
          <select name="gst" value={formState.gst} onChange={handleChange} className={formSelectStyle}>
            {sortedGstRates.map(rate => (
              <option key={rate.id} value={rate.rate}>{`GST ${rate.rate}%`}</option>
            ))}
          </select>
          {isPharmaMode && (
            <>
                <input name="unitsPerStrip" value={formState.unitsPerStrip} onChange={handleChange} type="number" placeholder="Units per Strip (e.g., 10)" className={formInputStyle} min="1" />
                <select name="isScheduleH" value={formState.isScheduleH} onChange={handleChange} className={formSelectStyle}>
                    <option value="No">Schedule H Drug? No</option>
                    <option value="Yes">Schedule H Drug? Yes</option>
                </select>
                <div className="sm:col-span-2">
                        <input name="composition" value={formState.composition} onChange={handleChange} placeholder="Composition (e.g., Paracetamol 500mg)" className={formInputStyle} />
                    </div>
            </>
          )}
          {!isPharmaMode && (
             <input name="barcode" value={formState.barcode} onChange={handleChange} placeholder="Barcode (auto-generated if empty)" className={formInputStyle} />
          )}
        </div>
        <h4 className="font-semibold text-slate-700 dark:text-slate-300 pt-2 border-t dark:border-slate-700 mt-4">Initial Stock Details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isPharmaMode && <input name="batchNumber" value={formState.batchNumber} onChange={handleChange} placeholder="Batch No.*" className={formInputStyle} required />}
            {isPharmaMode && <input name="expiryDate" value={formState.expiryDate} onChange={handleChange} type="month" placeholder="Expiry (YYYY-MM)" className={formInputStyle} required />}
            <input name="stock" value={formState.stock} onChange={handleChange} type="number" placeholder={`Stock Qty ${isPharmaMode ? '(in Strips/Boxes)' : ''}`} className={formInputStyle} required min="0"/>
            <input name="mrp" value={formState.mrp} onChange={handleChange} type="number" placeholder={`MRP ${isPharmaMode ? '(per Strip/Box)' : ''}`} className={formInputStyle} required min="0" step="0.01"/>
            <input name="purchasePrice" value={formState.purchasePrice} onChange={handleChange} type="number" placeholder={`Purchase Price ${isPharmaMode ? '(per Strip/Box)' : ''}`} className={formInputStyle} min="0" step="0.01"/>
        </div>
        <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Add Product</button>
        </div>
      </form>
    </Modal>
  );
};

interface EditProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    onUpdateProduct: InventoryProps['onUpdateProduct'];
    systemConfig: SystemConfig;
    gstRates: GstRate[];
}

const EditProductModal: React.FC<EditProductModalProps> = ({ isOpen, onClose, product, onUpdateProduct, systemConfig, gstRates }) => {
  const [formState, setFormState] = useState({
    name: '', company: '', hsnCode: '', gst: '12', barcode: '', composition: '', unitsPerStrip: '', isScheduleH: 'No', mrp: '', purchasePrice: ''
  });
  const isPharmaMode = systemConfig.softwareMode === 'Pharma';
  const sortedGstRates = useMemo(() => [...gstRates].sort((a, b) => a.rate - b.rate), [gstRates]);
  const showPriceFields = product?.batches.length === 1;
  
  useEffect(() => {
    if (product) {
        const batch = product.batches[0];
        setFormState({
            name: product.name,
            company: product.company,
            hsnCode: product.hsnCode,
            gst: String(product.gst),
            barcode: product.barcode || '',
            composition: product.composition || '',
            unitsPerStrip: String(product.unitsPerStrip || ''),
            isScheduleH: product.isScheduleH ? 'Yes' : 'No',
            mrp: showPriceFields ? String(batch.mrp) : '',
            purchasePrice: showPriceFields ? String(batch.purchasePrice) : '',
        });
    }
  }, [product, isOpen, showPriceFields]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name || !formState.company) return;
    
    const productUpdate: Partial<Omit<Product, 'id' | 'batches'> & {mrp?: number; purchasePrice?: number}> = {
        name: formState.name,
        company: formState.company,
        hsnCode: formState.hsnCode,
        gst: parseFloat(formState.gst),
    };

    if (isPharmaMode) {
        productUpdate.isScheduleH = formState.isScheduleH === 'Yes';
        if (formState.composition) {
            productUpdate.composition = formState.composition;
        }
        const units = parseInt(formState.unitsPerStrip);
        if (!isNaN(units) && units > 1) {
            productUpdate.unitsPerStrip = units;
        }
    } else {
        productUpdate.barcode = formState.barcode;
    }

    if (showPriceFields) {
        const mrp = parseFloat(formState.mrp);
        const pp = parseFloat(formState.purchasePrice);
        if (!isNaN(mrp)) productUpdate.mrp = mrp;
        if (!isNaN(pp)) productUpdate.purchasePrice = pp;
    }

    onUpdateProduct(product.id, productUpdate);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Product: ${product.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input name="name" value={formState.name} onChange={handleChange} placeholder="Product Name" className={formInputStyle} required />
          <input name="company" value={formState.company} onChange={handleChange} placeholder="Company" className={formInputStyle} required />
          <input name="hsnCode" value={formState.hsnCode} onChange={handleChange} placeholder="HSN Code" className={formInputStyle} />
          <select name="gst" value={formState.gst} onChange={handleChange} className={formSelectStyle}>
             {sortedGstRates.map(rate => (
              <option key={rate.id} value={rate.rate}>{`GST ${rate.rate}%`}</option>
            ))}
          </select>
          {isPharmaMode && (
            <>
                <input name="unitsPerStrip" value={formState.unitsPerStrip} onChange={handleChange} type="number" placeholder="Units per Strip (e.g., 10)" className={formInputStyle} min="1" />
                <select name="isScheduleH" value={formState.isScheduleH} onChange={handleChange} className={formSelectStyle}>
                    <option value="No">Schedule H Drug? No</option>
                    <option value="Yes">Schedule H Drug? Yes</option>
                </select>
                <div className="sm:col-span-2">
                    <input name="composition" value={formState.composition} onChange={handleChange} placeholder="Composition (e.g., Paracetamol 500mg)" className={formInputStyle} />
                </div>
            </>
          )}
          {!isPharmaMode && (
            <div className="sm:col-span-2">
                <input name="barcode" value={formState.barcode} onChange={handleChange} placeholder="Barcode" className={formInputStyle} />
            </div>
          )}
           {showPriceFields && (
            <>
                <input name="mrp" value={formState.mrp} onChange={handleChange} type="number" placeholder="MRP" className={formInputStyle} min="0" step="0.01" />
                <input name="purchasePrice" value={formState.purchasePrice} onChange={handleChange} type="number" placeholder="Purchase Price" className={formInputStyle} min="0" step="0.01" />
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Update Product</button>
        </div>
      </form>
    </Modal>
  );
};


const AddBatchModal: React.FC<{ isOpen: boolean; onClose: () => void; product: Product; onAddBatch: InventoryProps['onAddBatch']; onDeleteBatch: InventoryProps['onDeleteBatch']; systemConfig: SystemConfig; }> = ({ isOpen, onClose, product, onAddBatch, onDeleteBatch, systemConfig }) => {
  const [formState, setFormState] = useState({ batchNumber: '', expiryDate: '', stock: '', mrp: '', purchasePrice: '' });
  const isPharmaMode = systemConfig.softwareMode === 'Pharma';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { batchNumber, expiryDate, stock, mrp, purchasePrice } = formState;
    if (!batchNumber || !expiryDate || !stock || !mrp) return;

    const stockInBaseUnits = parseInt(stock) * (product.unitsPerStrip || 1);

    onAddBatch(
      product.id,
      { batchNumber, expiryDate, stock: stockInBaseUnits, mrp: parseFloat(mrp), purchasePrice: parseFloat(purchasePrice) }
    );
    onClose();
    setFormState({ batchNumber: '', expiryDate: '', stock: '', mrp: '', purchasePrice: '' });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${isPharmaMode ? 'Batches for' : 'Stock Details for'} ${product.name}`}>
      <div className="mb-6 max-h-48 overflow-y-auto">
          <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Existing Stock</h4>
          <ul className="space-y-2">
            {product.batches.map(batch => {
                const expiry = getExpiryDate(batch.expiryDate);
                let liClass = 'bg-slate-50 dark:bg-slate-700';
                let statusBadge = null;
                let liTitle = '';

                if (isPharmaMode) {
                    if (expiry < today) {
                        liClass = 'bg-red-100 dark:bg-red-900/50';
                        statusBadge = <span className="px-2 py-0.5 text-xs font-semibold text-white bg-red-600 dark:bg-red-700 rounded-full">Expired</span>;
                        liTitle = `This batch expired on ${expiry.toLocaleDateString()}`;
                    } else if (expiry <= thirtyDaysFromNow) {
                        liClass = 'bg-yellow-100 dark:bg-yellow-900/50';
                        statusBadge = <span className="px-2 py-0.5 text-xs font-semibold text-slate-800 bg-yellow-400 dark:text-slate-900 dark:bg-yellow-500 rounded-full">Expires Soon</span>;
                        liTitle = `This batch expires on ${expiry.toLocaleDateString()}`;
                    }
                }

                return (
                    <li key={batch.id} className={`flex justify-between items-center p-2 rounded ${liClass}`} title={liTitle}>
                        <div>
                            {isPharmaMode && <span className="font-medium text-slate-800 dark:text-slate-200">Batch: {batch.batchNumber}</span>}
                            {isPharmaMode && <span className="text-sm text-slate-600 dark:text-slate-400 ml-4">Exp: {batch.expiryDate}</span>}
                        </div>
                        <div className="flex items-center gap-4">
                            {statusBadge}
                            <span className="text-sm text-slate-600 dark:text-slate-400">MRP: ₹{batch.mrp.toFixed(2)}</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">Stock: {formatStock(batch.stock, product.unitsPerStrip)}</span>
                            {isPharmaMode && (
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to delete batch "${batch.batchNumber}"? This action cannot be undone.`)) {
                                      onDeleteBatch(product.id, batch.id);
                                    }
                                  }}
                                  className="text-red-500 hover:text-red-700 transition-colors"
                                  title="Delete Batch"
                                >
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    </li>
                );
            })}
          </ul>
      </div>
      {isPharmaMode && (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t dark:border-slate-700">
            <h4 className="font-semibold text-slate-700 dark:text-slate-300">Add New Batch</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input name="batchNumber" value={formState.batchNumber} onChange={handleChange} placeholder="Batch No." className={formInputStyle} required />
                <input name="expiryDate" value={formState.expiryDate} onChange={handleChange} type="month" placeholder="Expiry (YYYY-MM)" className={formInputStyle} required />
                <input name="stock" value={formState.stock} onChange={handleChange} type="number" placeholder="Stock Qty (in Strips/Boxes)" className={formInputStyle} required min="0"/>
                <input name="mrp" value={formState.mrp} onChange={handleChange} type="number" placeholder="MRP (per Strip/Box)" className={formInputStyle} required min="0" step="0.01"/>
                <input name="purchasePrice" value={formState.purchasePrice} onChange={handleChange} type="number" placeholder="Purchase Price (per strip)" className={formInputStyle} min="0" step="0.01"/>
            </div>
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Add Batch</button>
            </div>
        </form>
       )}
       <style>{`
        @keyframes fade-in {
            0% { opacity: 0; }
            100% { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
    `}</style>
    </Modal>
  );
};


const ImportProductsModal: React.FC<{ isOpen: boolean; onClose: () => void; onBulkAddProducts: InventoryProps['onBulkAddProducts']; }> = ({ isOpen, onClose, onBulkAddProducts }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mappedData, setMappedData] = useState<Omit<Product, 'id' | 'batches'>[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [importResult, setImportResult] = useState<{success: number; skipped: number} | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const appFields: (keyof Omit<Product, 'id' | 'batches'> | 'ignore')[] = ['name', 'company', 'barcode', 'hsnCode', 'gst', 'composition', 'unitsPerStrip', 'isScheduleH', 'ignore'];
    
    const resetState = () => {
        setStep(1);
        setFile(null);
        setHeaders([]);
        setMappedData([]);
        setMapping({});
        setImportResult(null);
        setIsLoading(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && selectedFile.type === 'text/csv') {
            setFile(selectedFile);
        } else {
            alert('Please select a valid CSV file.');
            setFile(null);
        }
    };
    
    const parseCsv = () => {
        if (!file) return;
        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) {
                alert('CSV file must have a header row and at least one data row.');
                setIsLoading(false);
                return;
            }
            const fileHeaders = lines[0].split(',').map(h => h.trim());
            setHeaders(fileHeaders);
            
            const data: Omit<Product, 'id' | 'batches'>[] = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                const row: any = {};
                fileHeaders.forEach((header, index) => {
                    row[header] = values[index]?.trim();
                });
                data.push(row);
            }
            setMappedData(data as any);
            setStep(2);
            setIsLoading(false);
        };
        reader.readAsText(file);
    };
    
    const handleMapping = () => {
        if (!mapping['name'] || !mapping['company']) {
            alert('You must map columns for "Product Name" and "Company".');
            return;
        }

        const productsToImport = mappedData.map(row => {
            const product: Omit<Product, 'id'|'batches'> = {
                name: (row as any)[mapping['name']],
                company: (row as any)[mapping['company']],
                hsnCode: (row as any)[mapping['hsnCode']] || '',
                gst: parseFloat((row as any)[mapping['gst']]) || 12,
            };
            
            const barcode = (row as any)[mapping['barcode']];
            if (barcode) {
                product.barcode = barcode;
            }
            const composition = (row as any)[mapping['composition']];
            if (composition) {
                product.composition = composition;
            }
            const unitsPerStripRaw = (row as any)[mapping['unitsPerStrip']];
            if (unitsPerStripRaw) {
                 const units = parseInt(unitsPerStripRaw, 10);
                 if (!isNaN(units) && units > 0) {
                     product.unitsPerStrip = units;
                 }
            }
            
            const isScheduleHRaw = (row as any)[mapping['isScheduleH']];
            if (isScheduleHRaw) {
                const isScheduleHValue = isScheduleHRaw.toLowerCase();
                product.isScheduleH = isScheduleHValue === 'yes' || isScheduleHValue === 'true' || isScheduleHValue === '1';
            }

            return product;
        }).filter(p => p.name && p.company); // Ensure mandatory fields are present

        setIsLoading(true);
        onBulkAddProducts(productsToImport).then(result => {
            setImportResult(result);
            setStep(3);
            setIsLoading(false);
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={() => { onClose(); resetState(); }} title="Import Products from CSV">
            <div className="space-y-4">
                {isLoading && <div className="absolute inset-0 bg-white/70 dark:bg-slate-800/70 flex items-center justify-center z-10"><p>Processing...</p></div>}
                {step === 1 && (
                    <div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Step 1: Upload CSV File</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Select a CSV file to upload. The first row should contain headers like 'Product Name', 'Company', 'GST', etc.</p>
                        <input type="file" accept=".csv" onChange={handleFileChange} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900/50 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100" />
                        <div className="flex justify-end mt-6">
                            <button onClick={parseCsv} disabled={!file} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 disabled:bg-slate-400 dark:disabled:bg-slate-600">
                                Next: Map Columns
                            </button>
                        </div>
                    </div>
                )}
                {step === 2 && (
                     <div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Step 2: Map Columns</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Match the columns from your CSV file to the application's product fields. 'Product Name' and 'Company' are required.</p>
                        <div className="space-y-3 max-h-80 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            {appFields.filter(f => f !== 'ignore').map(field => (
                                <div key={field} className="grid grid-cols-2 gap-4 items-center">
                                    <label className="font-medium text-slate-700 dark:text-slate-300 text-right capitalize">
                                        {field.replace(/([A-Z])/g, ' $1')}
                                        {(field === 'name' || field === 'company') && <span className="text-red-500">*</span>}
                                    </label>
                                    <select 
                                        onChange={(e) => setMapping({...mapping, [field]: e.target.value})} 
                                        className={formSelectStyle}
                                    >
                                        <option value="">-- Select CSV Column --</option>
                                        {headers.map(header => <option key={header} value={header}>{header}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                         <div className="flex justify-between mt-6">
                            <button onClick={() => setStep(1)} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Back</button>
                            <button onClick={handleMapping} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700">
                                Next: Import
                            </button>
                        </div>
                    </div>
                )}
                {step === 3 && (
                     <div className="text-center">
                        <h4 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">Import Complete!</h4>
                        <p className="text-lg text-slate-700 dark:text-slate-300">
                            Successfully imported <span className="font-bold">{importResult?.success}</span> new products.
                        </p>
                        <p className="text-slate-600 dark:text-slate-400">
                            Skipped <span className="font-bold">{importResult?.skipped}</span> products (duplicates found).
                        </p>
                        <div className="flex justify-center mt-6">
                           <button onClick={() => { onClose(); resetState(); }} className="px-6 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700">
                                Finish
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

// --- Barcode Printing Components ---

// Encoding for Code 39. '1' is wide, '0' is narrow.
const CODE39_MAP: { [key: string]: string } = {
    '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
    '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
    '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
    'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
    'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
    'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
    'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
    'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
    'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
    '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
    '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
};

const Barcode: React.FC<{ code: string; isPrinting?: boolean }> = ({ code, isPrinting = false }) => {
    // Validate and prepare code for Code 39
    const validCode = `*${code.toUpperCase().replace(/[^A-Z0-9-.\s$/+%]/g, '')}*`;
    
    const narrowWidth = 1.5;
    const wideWidth = 3.5;
    
    const barElements = [];
    let currentX = 0;
    
    for (const char of validCode) {
        const pattern = CODE39_MAP[char];
        if (!pattern) continue;

        for (let i = 0; i < pattern.length; i++) {
            const isBar = i % 2 === 0;
            const isWide = pattern[i] === '1';
            const width = isWide ? wideWidth : narrowWidth;
            
            if (isBar) {
                barElements.push(<rect key={`${char}-${i}`} x={currentX} y="0" width={width} height="25" fill="black" shapeRendering="crispEdges" />);
            }
            currentX += width;
        }
        // Add narrow space between characters
        currentX += narrowWidth;
    }

    const svgWidth = currentX;
    const spacedCode = code.split('').join(' ');

    const printingTextStyle: React.CSSProperties = {
        fontFamily: 'monospace',
        letterSpacing: '1px',
        fontSize: '5.5pt',
        fontWeight: '500',
        textAlign: 'center',
    };

    const previewTextStyle: React.CSSProperties = {
        fontFamily: 'monospace',
        letterSpacing: '1px',
        fontSize: '8px', // Equivalent to roughly 6pt
        fontWeight: '500',
        textAlign: 'center',
        marginTop: '2px',
    };

    return (
        <div className="flex flex-col items-center">
            <svg width="100%" height="25" aria-hidden="true" viewBox={`0 0 ${svgWidth} 25`}>
                {barElements}
            </svg>
            <p style={isPrinting ? printingTextStyle : previewTextStyle}>{spacedCode}</p>
        </div>
    );
};

// Component to be rendered for printing
const PrintableLabels: React.FC<{
    count: number;
    shopName: string;
    productName: string;
    barcode: string;
    mrp: number;
}> = ({ count, shopName, productName, mrp, barcode }) => {
    const labels = Array.from({ length: count });

    return (
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '2mm'
        }}>
            {labels.map((_, i) => (
                <div key={i} style={{
                    width: '50mm',
                    height: '25mm',
                    border: '1px dotted #ccc',
                    boxSizing: 'border-box',
                    padding: '1mm',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'Arial, sans-serif',
                    textAlign: 'center',
                    overflow: 'hidden',
                    pageBreakInside: 'avoid',
                    gap: '0.5mm'
                }}>
                    <div style={{ fontWeight: 'bold', fontSize: '10pt', lineHeight: '1' }}>{shopName.substring(0, 25)}</div>
                    <div style={{ fontSize: '7pt', lineHeight: '1' }}>{productName.substring(0, 35)}</div>
                    <div style={{ width: '90%', marginTop: '1mm', marginBottom: '0.5mm' }}>
                        <Barcode code={barcode} isPrinting={true} />
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '11pt', lineHeight: '1' }}>
                        ₹{mrp.toFixed(2)}
                    </div>
                </div>
            ))}
        </div>
    );
};


// The Modal component
const PrintLabelModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    companyProfile: CompanyProfile;
    systemConfig: SystemConfig;
}> = ({ isOpen, onClose, product, companyProfile, systemConfig }) => {
    const [labelCount, setLabelCount] = useState(1);
    
    const barcode = useMemo(() => {
        if (systemConfig.softwareMode === 'Retail' && product?.barcode) {
            return product.barcode;
        }
        if (!product?.id) return '000000';
        return product.id.slice(-6).toUpperCase();
    }, [product, systemConfig.softwareMode]);

    useEffect(() => {
        if (isOpen) {
            setLabelCount(1); // Reset count on open
        }
    }, [isOpen]);

    const mrp = useMemo(() => {
        if (!product.batches || product.batches.length === 0) return 0;
        // Use the highest MRP from available batches for the label
        return Math.max(...product.batches.map(b => b.mrp));
    }, [product]);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Please allow popups to print labels.");
            return;
        }

        printWindow.document.write('<html><head><title>Print Labels</title>');
        printWindow.document.write('<style>@page { margin: 2mm; } body { margin: 0; }</style>');
        printWindow.document.write('</head><body><div id="print-root"></div></body></html>');
        printWindow.document.close();

        const printRoot = printWindow.document.getElementById('print-root');
        if (printRoot) {
            const root = ReactDOM.createRoot(printRoot);
            root.render(
                <PrintableLabels
                    count={labelCount}
                    shopName={companyProfile.name}
                    productName={product.name}
                    barcode={barcode}
                    mrp={mrp}
                />
            );
        }

        setTimeout(() => {
            printWindow.print();
            printWindow.close();
            onClose();
        }, 500);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Print Label for ${product.name}`}>
            <div className="space-y-4">
                <div>
                    <label htmlFor="label-count" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Number of labels to print
                    </label>
                    <input
                        id="label-count"
                        type="number"
                        min="1"
                        value={labelCount}
                        onChange={(e) => setLabelCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className={inputStyle}
                    />
                </div>

                <div className="p-4 border dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                    <p className="text-sm text-center text-slate-600 dark:text-slate-400 mb-2">Label Preview (50mm x 25mm):</p>
                    <div className="bg-white dark:bg-slate-800 p-1 rounded-md shadow-inner flex flex-col items-center justify-center gap-1 mx-auto" style={{ width: '189px', height: '94.5px', fontFamily: 'Arial, sans-serif' }}>
                        <p style={{ fontWeight: 'bold', fontSize: '13px', lineHeight: '1' }} className="truncate w-full text-center">{companyProfile.name.substring(0, 25)}</p>
                        <p style={{ fontSize: '9px', lineHeight: '1' }} className="w-full text-center truncate">{product.name.substring(0, 35)}</p>
                        <div style={{width: '90%', margin: '4px 0 2px 0'}}>
                             <Barcode code={barcode} />
                        </div>
                        <p style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '1' }}>₹{mrp.toFixed(2)}</p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow hover:bg-indigo-700"
                    >
                        Print {labelCount} Label{labelCount > 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        </Modal>
    );
};


export default Inventory;
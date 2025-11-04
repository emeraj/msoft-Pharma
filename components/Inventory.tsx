import React, { useState, useMemo, useEffect } from 'react';
import type { Product, Batch, Company, Bill, Purchase } from '../types.ts';
import Card from './common/Card.tsx';
import Modal from './common/Modal.tsx';
import { PlusIcon, DownloadIcon, TrashIcon, PencilIcon } from './icons/Icons.tsx';

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


interface InventoryProps {
  products: Product[];
  companies: Company[];
  bills: Bill[];
  purchases: Purchase[];
  onAddProduct: (product: Omit<Product, 'id' | 'batches'>, firstBatch: Omit<Batch, 'id'>) => void;
  onUpdateProduct: (productId: string, productData: Partial<Omit<Product, 'id' | 'batches'>>) => void;
  onAddBatch: (productId: string, batch: Omit<Batch, 'id'>) => void;
  onDeleteBatch: (productId: string, batchId: string) => void;
}

type InventorySubView = 'all' | 'selected' | 'batch' | 'company' | 'expired' | 'nearing_expiry';

// --- Main Inventory Component ---
const Inventory: React.FC<InventoryProps> = ({ products, companies, bills, purchases, onAddProduct, onUpdateProduct, onAddBatch, onDeleteBatch }) => {
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [isBatchModalOpen, setBatchModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const handleOpenBatchModal = (product: Product) => {
    setSelectedProduct(product);
    setBatchModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setSelectedProduct(product);
    setEditModalOpen(true);
  };
  
  const renderSubView = () => {
    switch (activeSubView) {
      case 'all':
        return <AllItemStockView products={products} purchases={purchases} bills={bills} onOpenBatchModal={handleOpenBatchModal} onOpenEditModal={handleOpenEditModal} />;
      case 'selected':
        return <SelectedItemStockView products={products} onDeleteBatch={onDeleteBatch} />;
      case 'batch':
        return <BatchWiseStockView products={products} onDeleteBatch={onDeleteBatch} />;
      case 'company':
        return <CompanyWiseStockView products={products} purchases={purchases} bills={bills} />;
      case 'expired':
        return <ExpiredStockView products={products} onDeleteBatch={onDeleteBatch} />;
      case 'nearing_expiry':
        return <NearingExpiryStockView products={products} onDeleteBatch={onDeleteBatch} />;
      default:
        return <AllItemStockView products={products} purchases={purchases} bills={bills} onOpenBatchModal={handleOpenBatchModal} onOpenEditModal={handleOpenEditModal} />;
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
          <button 
            onClick={() => setProductModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors duration-200"
          >
            <PlusIcon className="h-5 w-5" /> Add New Product
          </button>
        </div>
        <div className="flex flex-wrap gap-2 border-t dark:border-slate-700 mt-4 pt-4">
            <SubNavButton view="all" label="All Item Stock" />
            <SubNavButton view="selected" label="Selected Item Stock" />
            <SubNavButton view="batch" label="Batch Wise Stock" />
            <SubNavButton view="company" label="Company Wise Stock" />
            <SubNavButton view="expired" label="Expired Stock" />
            <SubNavButton view="nearing_expiry" label="Near 30 Days Expiry" />
        </div>
      </Card>

      {renderSubView()}
      
      <AddProductModal 
        isOpen={isProductModalOpen}
        onClose={() => setProductModalOpen(false)}
        onAddProduct={onAddProduct}
        companies={companies}
      />

      {selectedProduct && (
        <AddBatchModal
          isOpen={isBatchModalOpen}
          onClose={() => { setBatchModalOpen(false); setSelectedProduct(null); }}
          product={selectedProduct}
          onAddBatch={onAddBatch}
          onDeleteBatch={onDeleteBatch}
        />
      )}
      
      {selectedProduct && (
        <EditProductModal
          isOpen={isEditModalOpen}
          onClose={() => { setEditModalOpen(false); setSelectedProduct(null); }}
          product={selectedProduct}
          onUpdateProduct={onUpdateProduct}
        />
      )}
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
    onOpenBatchModal: (product: Product) => void;
    onOpenEditModal: (product: Product) => void;
}

const AllItemStockView: React.FC<AllItemStockViewProps> = ({ products, purchases, bills, onOpenBatchModal, onOpenEditModal }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [companyFilter, setCompanyFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

    const companies = useMemo(() => [...new Set(products.map(p => p.company))].sort(), [products]);
    
    const reportData = useMemo(() => {
        const startDate = fromDate ? new Date(fromDate) : null;
        if (startDate) startDate.setHours(0, 0, 0, 0);

        const endDate = toDate ? new Date(toDate) : null;
        if (endDate) endDate.setHours(23, 59, 59, 999);

        return products
            .filter(product =>
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
                (companyFilter === '' || product.company === companyFilter)
            )
            .map(product => {
                let purchasesInPeriod = 0;
                let salesInPeriod = 0;

                purchases.forEach(purchase => {
                    const purchaseDate = new Date(purchase.invoiceDate);
                    if ((!startDate || purchaseDate >= startDate) && (!endDate || purchaseDate <= endDate)) {
                        purchase.items.forEach(item => {
                            if (item.productId === product.id) {
                                purchasesInPeriod += item.quantity;
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
                const stockValue = product.batches.reduce((sum, batch) => sum + (batch.mrp * batch.stock), 0);

                return {
                    id: product.id,
                    name: product.name,
                    company: product.company,
                    composition: product.composition,
                    openingStock,
                    purchasedQty: purchasesInPeriod,
                    soldQty: salesInPeriod,
                    currentStock,
                    stockValue,
                    product // Pass the original product object for the action button
                };
            }).sort((a,b) => a.name.localeCompare(b.name));
    }, [products, purchases, bills, searchTerm, companyFilter, fromDate, toDate]);
    
    const handleExport = () => {
        const exportData = reportData.map(data => ({
            'Product Name': data.name,
            'Company': data.company,
            'Composition': data.composition,
            'Opening Stock': data.openingStock,
            'Purchased Qty (Period)': data.purchasedQty,
            'Sold Qty (Period)': data.soldQty,
            'Current Stock': data.currentStock,
            'Stock Value (MRP)': data.stockValue.toFixed(2),
        }));
        exportToCsv('all_item_stock_report', exportData);
    };

    return (
        <Card title="All Item Stock Report">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search by product name..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={inputStyle}
                />
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
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">{item.company}</p>
                                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-normal">{item.composition}</p>
                                </td>
                                <td className="px-6 py-4 text-center">{item.openingStock}</td>
                                <td className="px-6 py-4 text-center">{item.purchasedQty}</td>
                                <td className="px-6 py-4 text-center">{item.soldQty}</td>
                                <td className="px-6 py-4 text-center font-bold">{item.currentStock}</td>
                                <td className="px-6 py-4 text-right font-semibold">₹{item.stockValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => onOpenBatchModal(item.product)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap">View/Add Batch</button>
                                        <button onClick={() => onOpenEditModal(item.product)} title="Edit Product" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50">
                                            <PencilIcon className="h-4 w-4" />
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

const SelectedItemStockView: React.FC<{products: Product[], onDeleteBatch: (productId: string, batchId: string) => void}> = ({ products, onDeleteBatch }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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
                        <p className="text-sm text-indigo-700 dark:text-indigo-300 font-medium mt-1">{selectedProduct.composition}</p>
                        <div className="flex gap-4 mt-2 text-sm text-slate-800 dark:text-slate-300">
                           <span>HSN: {selectedProduct.hsnCode}</span>
                           <span>GST: {selectedProduct.gst}%</span>
                           <span className="font-semibold">Total Stock: {selectedProduct.batches.reduce((sum, b) => sum + b.stock, 0)}</span>
                        </div>
                    </div>
                    <BatchListTable 
                      title="Batches for Selected Product" 
                      batches={selectedProduct.batches.map(b => ({...b, productName: selectedProduct.name, company: selectedProduct.company, productId: selectedProduct.id}))} 
                      showProductInfo={false}
                      onDeleteBatch={onDeleteBatch}
                    />
                 </div>
            )}
        </Card>
    );
};

const CompanyWiseStockView: React.FC<{products: Product[], purchases: Purchase[], bills: Bill[]}> = ({ products, purchases, bills }) => {
    const [companyFilter, setCompanyFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

    const companies = useMemo(() => [...new Set(products.map(p => p.company))].sort(), [products]);
    
    const reportData = useMemo(() => {
        const startDate = fromDate ? new Date(fromDate) : null;
        if (startDate) startDate.setHours(0, 0, 0, 0);

        const endDate = toDate ? new Date(toDate) : null;
        if (endDate) endDate.setHours(23, 59, 59, 999);

        const companyProducts = products.filter(product => companyFilter === '' || product.company === companyFilter);
        
        const allBatches = companyProducts.flatMap(product =>
            product.batches.map(batch => {
                let purchasesInPeriod = 0;
                purchases.forEach(purchase => {
                    const purchaseDate = new Date(purchase.invoiceDate);
                    if ((!startDate || purchaseDate >= startDate) && (!endDate || purchaseDate <= endDate)) {
                        purchase.items.forEach(item => {
                            if (item.batchId === batch.id) {
                                purchasesInPeriod += item.quantity;
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
                const stockValue = batch.mrp * currentStock;
                
                return {
                    id: batch.id,
                    batchNumber: batch.batchNumber,
                    expiryDate: batch.expiryDate,
                    mrp: batch.mrp,
                    productName: product.name,
                    company: product.company,
                    openingStock,
                    purchasedQty: purchasesInPeriod,
                    soldQty: salesInPeriod,
                    currentStock,
                    stockValue,
                };
            })
        );

        return allBatches.sort((a, b) => {
            const nameA = a.productName.toLowerCase();
            const nameB = b.productName.toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return a.batchNumber.localeCompare(b.batchNumber);
        });
    }, [products, purchases, bills, companyFilter, fromDate, toDate]);
    
    const processedReportData = useMemo(() => {
        let lastProductName = '';
        return reportData.map(batch => {
            const showProductInfo = batch.productName !== lastProductName;
            if (showProductInfo) {
                lastProductName = batch.productName;
            }
            return { ...batch, showProductInfo };
        });
    }, [reportData]);

    const handleExport = () => {
        const exportData = reportData.map(batch => ({
            'Product Name': batch.productName,
            'Company': batch.company,
            'Batch No.': batch.batchNumber,
            'Expiry': batch.expiryDate,
            'Opening Stock': batch.openingStock,
            'Purchased (Period)': batch.purchasedQty,
            'Sold (Period)': batch.soldQty,
            'Current Stock': batch.currentStock,
            'Stock Value (MRP)': batch.stockValue.toFixed(2),
        }));

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
                            <th scope="col" className="px-6 py-3">Batch No.</th>
                            <th scope="col" className="px-6 py-3">Expiry</th>
                            <th scope="col" className="px-6 py-3 text-center">Opening Stock</th>
                            <th scope="col" className="px-6 py-3 text-center">Purchased (Period)</th>
                            <th scope="col" className="px-6 py-3 text-center">Sold (Period)</th>
                            <th scope="col" className="px-6 py-3 text-center">Current Stock</th>
                            <th scope="col" className="px-6 py-3 text-right">Stock Value (MRP)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processedReportData.map(batch => (
                            <tr key={batch.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                <th scope="row" className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                                    {batch.showProductInfo ? batch.productName : ''}
                                </th>
                                <td className="px-6 py-4">{batch.showProductInfo ? batch.company : ''}</td>
                                <td className="px-6 py-4">{batch.batchNumber}</td>
                                <td className="px-6 py-4">{batch.expiryDate}</td>
                                <td className="px-6 py-4 text-center">{batch.openingStock}</td>
                                <td className="px-6 py-4 text-center">{batch.purchasedQty}</td>
                                <td className="px-6 py-4 text-center">{batch.soldQty}</td>
                                <td className="px-6 py-4 text-center font-bold">{batch.currentStock}</td>
                                <td className="px-6 py-4 text-right font-semibold">₹{batch.stockValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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

const BatchWiseStockView: React.FC<{products: Product[], onDeleteBatch: (productId: string, batchId: string) => void}> = ({ products, onDeleteBatch }) => {
    const allBatches = useMemo(() => products.flatMap(p => p.batches.map(b => ({ ...b, productName: p.name, company: p.company, productId: p.id }))), [products]);
    return <BatchListTable title="All Batches" batches={allBatches} onDeleteBatch={onDeleteBatch} />;
};

const ExpiredStockView: React.FC<{products: Product[], onDeleteBatch: (productId: string, batchId: string) => void}> = ({ products, onDeleteBatch }) => {
    const today = new Date();
    const expiredBatches = useMemo(() => 
        products.flatMap(p => p.batches.map(b => ({ ...b, productName: p.name, company: p.company, productId: p.id })))
                .filter(b => getExpiryDate(b.expiryDate) < today), 
    [products]);
    return <BatchListTable title="Expired Stock" batches={expiredBatches} onDeleteBatch={onDeleteBatch} />;
};

const NearingExpiryStockView: React.FC<{products: Product[], onDeleteBatch: (productId: string, batchId: string) => void}> = ({ products, onDeleteBatch }) => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    const nearingExpiryBatches = useMemo(() => 
        products.flatMap(p => p.batches.map(b => ({ ...b, productName: p.name, company: p.company, productId: p.id })))
                .filter(b => {
                    const expiry = getExpiryDate(b.expiryDate);
                    return expiry >= today && expiry <= thirtyDaysFromNow;
                }), 
    [products]);
    return <BatchListTable title="Stock Nearing Expiry (30 Days)" batches={nearingExpiryBatches} onDeleteBatch={onDeleteBatch} />;
};


// --- Reusable & Helper Components ---

interface BatchWithProductInfo extends Batch { productName: string; company: string; productId: string; }
const BatchListTable: React.FC<{ title: string; batches: BatchWithProductInfo[], showProductInfo?: boolean; onDeleteBatch?: (productId: string, batchId: string) => void; }> = ({ title, batches, showProductInfo = true, onDeleteBatch }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const filteredBatches = useMemo(() =>
        batches.filter(b => 
            b.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.batchNumber.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => {
            const nameA = a.productName.toLowerCase();
            const nameB = b.productName.toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            // If product names are the same, sort by expiry date
            return getExpiryDate(a.expiryDate).getTime() - getExpiryDate(b.expiryDate).getTime();
        }),
    [batches, searchTerm]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    const handleExport = () => {
        const exportData = filteredBatches.map(batch => {
            const baseData = {
                'Batch No.': batch.batchNumber,
                'Expiry': batch.expiryDate,
                'Stock': batch.stock,
                'MRP': batch.mrp.toFixed(2),
            };
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
                    placeholder="Search by product or batch..."
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
                            <th className="px-6 py-3">Batch No.</th>
                            <th className="px-6 py-3">Expiry</th>
                            <th className="px-6 py-3">Stock</th>
                            <th className="px-6 py-3">MRP</th>
                            <th className="px-6 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBatches.map(batch => {
                            const expiry = getExpiryDate(batch.expiryDate);
                            let rowClass = 'bg-white dark:bg-slate-800';
                            let expiryBadge = null;
                            let rowTitle = '';

                            if (expiry < today) {
                                rowClass = 'bg-red-100 dark:bg-red-900/50 text-red-900 dark:text-red-100 hover:bg-red-200 dark:hover:bg-red-900/70';
                                expiryBadge = <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-red-600 dark:bg-red-700 rounded-full">Expired</span>;
                                rowTitle = `This batch expired on ${expiry.toLocaleDateString()}`;
                            } else if (expiry <= thirtyDaysFromNow) {
                                rowClass = 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-100 hover:bg-yellow-200 dark:hover:bg-yellow-900/70';
                                expiryBadge = <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-slate-800 bg-yellow-400 dark:text-slate-900 dark:bg-yellow-500 rounded-full">Expires Soon</span>;
                                rowTitle = `This batch expires on ${expiry.toLocaleDateString()}`;
                            }
                            
                            return (
                            <tr key={batch.id} className={`${rowClass} border-b dark:border-slate-700`} title={rowTitle}>
                                {showProductInfo && <td className="px-6 py-4 font-medium">{batch.productName}</td>}
                                {showProductInfo && <td className="px-6 py-4">{batch.company}</td>}
                                <td className="px-6 py-4">{batch.batchNumber}</td>
                                <td className="px-6 py-4 flex items-center">{batch.expiryDate} {expiryBadge}</td>
                                <td className="px-6 py-4 font-bold">{batch.stock}</td>
                                <td className="px-6 py-4">₹{batch.mrp.toFixed(2)}</td>
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

const AddProductModal: React.FC<{ isOpen: boolean; onClose: () => void; onAddProduct: InventoryProps['onAddProduct']; companies: Company[] }> = ({ isOpen, onClose, onAddProduct, companies }) => {
  const [formState, setFormState] = useState({
    name: '', company: '', hsnCode: '', gst: '12', composition: '',
    batchNumber: '', expiryDate: '', stock: '', mrp: '', purchasePrice: ''
  });
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);

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
    const { name, company, hsnCode, gst, composition, batchNumber, expiryDate, stock, mrp, purchasePrice } = formState;
    if (!name || !company || !batchNumber || !expiryDate || !stock || !mrp) return;

    onAddProduct(
      { name, company, hsnCode, gst: parseFloat(gst), composition },
      { batchNumber, expiryDate, stock: parseInt(stock), mrp: parseFloat(mrp), purchasePrice: parseFloat(purchasePrice) }
    );
    onClose();
    setFormState({
        name: '', company: '', hsnCode: '', gst: '12', composition: '',
        batchNumber: '', expiryDate: '', stock: '', mrp: '', purchasePrice: ''
    });
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
            <option value="5">GST 5%</option>
            <option value="12">GST 12%</option>
            <option value="18">GST 18%</option>
          </select>
           <div className="sm:col-span-2">
                <input name="composition" value={formState.composition} onChange={handleChange} placeholder="Composition (e.g., Paracetamol 500mg)" className={formInputStyle} />
            </div>
        </div>
        <h4 className="font-semibold text-slate-700 dark:text-slate-300 pt-2 border-t dark:border-slate-700 mt-4">First Batch Details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input name="batchNumber" value={formState.batchNumber} onChange={handleChange} placeholder="Batch No." className={formInputStyle} required />
            <input name="expiryDate" value={formState.expiryDate} onChange={handleChange} type="month" placeholder="Expiry (YYYY-MM)" className={formInputStyle} required />
            <input name="stock" value={formState.stock} onChange={handleChange} type="number" placeholder="Stock Qty" className={formInputStyle} required min="0"/>
            <input name="mrp" value={formState.mrp} onChange={handleChange} type="number" placeholder="MRP" className={formInputStyle} required min="0" step="0.01"/>
            <input name="purchasePrice" value={formState.purchasePrice} onChange={handleChange} type="number" placeholder="Purchase Price" className={formInputStyle} min="0" step="0.01"/>
        </div>
        <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Add Product</button>
        </div>
      </form>
    </Modal>
  );
};

const EditProductModal: React.FC<{ isOpen: boolean; onClose: () => void; product: Product; onUpdateProduct: InventoryProps['onUpdateProduct']; }> = ({ isOpen, onClose, product, onUpdateProduct }) => {
  const [formState, setFormState] = useState({
    name: '', company: '', hsnCode: '', gst: '12', composition: ''
  });
  
  useEffect(() => {
    if (product) {
        setFormState({
            name: product.name,
            company: product.company,
            hsnCode: product.hsnCode,
            gst: String(product.gst),
            composition: product.composition || ''
        });
    }
  }, [product, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name || !formState.company) return;

    onUpdateProduct(product.id, {
        ...formState,
        gst: parseFloat(formState.gst)
    });
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
            <option value="5">GST 5%</option>
            <option value="12">GST 12%</option>
            <option value="18">GST 18%</option>
          </select>
          <div className="sm:col-span-2">
            <input name="composition" value={formState.composition} onChange={handleChange} placeholder="Composition (e.g., Paracetamol 500mg)" className={formInputStyle} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Update Product</button>
        </div>
      </form>
    </Modal>
  );
};


const AddBatchModal: React.FC<{ isOpen: boolean; onClose: () => void; product: Product; onAddBatch: InventoryProps['onAddBatch']; onDeleteBatch: InventoryProps['onDeleteBatch']; }> = ({ isOpen, onClose, product, onAddBatch, onDeleteBatch }) => {
  const [formState, setFormState] = useState({ batchNumber: '', expiryDate: '', stock: '', mrp: '', purchasePrice: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { batchNumber, expiryDate, stock, mrp, purchasePrice } = formState;
    if (!batchNumber || !expiryDate || !stock || !mrp) return;

    onAddBatch(
      product.id,
      { batchNumber, expiryDate, stock: parseInt(stock), mrp: parseFloat(mrp), purchasePrice: parseFloat(purchasePrice) }
    );
    onClose();
    setFormState({ batchNumber: '', expiryDate: '', stock: '', mrp: '', purchasePrice: '' });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Batches for ${product.name}`}>
      <div className="mb-6 max-h-48 overflow-y-auto">
          <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Existing Batches</h4>
          <ul className="space-y-2">
            {product.batches.map(batch => {
                const expiry = getExpiryDate(batch.expiryDate);
                let liClass = 'bg-slate-50 dark:bg-slate-700';
                let statusBadge = null;
                let liTitle = '';

                if (expiry < today) {
                    liClass = 'bg-red-100 dark:bg-red-900/50';
                    statusBadge = <span className="px-2 py-0.5 text-xs font-semibold text-white bg-red-600 dark:bg-red-700 rounded-full">Expired</span>;
                    liTitle = `This batch expired on ${expiry.toLocaleDateString()}`;
                } else if (expiry <= thirtyDaysFromNow) {
                    liClass = 'bg-yellow-100 dark:bg-yellow-900/50';
                    statusBadge = <span className="px-2 py-0.5 text-xs font-semibold text-slate-800 bg-yellow-400 dark:text-slate-900 dark:bg-yellow-500 rounded-full">Expires Soon</span>;
                    liTitle = `This batch expires on ${expiry.toLocaleDateString()}`;
                }

                return (
                    <li key={batch.id} className={`flex justify-between items-center p-2 rounded ${liClass}`} title={liTitle}>
                        <div>
                            <span className="font-medium text-slate-800 dark:text-slate-200">Batch: {batch.batchNumber}</span>
                            <span className="text-sm text-slate-600 dark:text-slate-400 ml-4">Exp: {batch.expiryDate}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            {statusBadge}
                            <span className="text-sm text-slate-600 dark:text-slate-400">MRP: ₹{batch.mrp.toFixed(2)}</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">Stock: {batch.stock}</span>
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
                        </div>
                    </li>
                );
            })}
          </ul>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t dark:border-slate-700">
        <h4 className="font-semibold text-slate-700 dark:text-slate-300">Add New Batch</h4>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input name="batchNumber" value={formState.batchNumber} onChange={handleChange} placeholder="Batch No." className={formInputStyle} required />
            <input name="expiryDate" value={formState.expiryDate} onChange={handleChange} type="month" placeholder="Expiry (YYYY-MM)" className={formInputStyle} required />
            <input name="stock" value={formState.stock} onChange={handleChange} type="number" placeholder="Stock Qty" className={formInputStyle} required min="0"/>
            <input name="mrp" value={formState.mrp} onChange={handleChange} type="number" placeholder="MRP" className={formInputStyle} required min="0" step="0.01"/>
            <input name="purchasePrice" value={formState.purchasePrice} onChange={handleChange} type="number" placeholder="Purchase Price" className={formInputStyle} min="0" step="0.01"/>
        </div>
        <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Add Batch</button>
        </div>
      </form>
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


export default Inventory;
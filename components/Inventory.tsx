
import React, { useState, useMemo } from 'react';
import type { Product, Batch, Company } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, DownloadIcon } from './icons/Icons';

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
  onAddProduct: (product: Omit<Product, 'id' | 'batches'>, firstBatch: Omit<Batch, 'id'>) => void;
  onAddBatch: (productId: string, batch: Omit<Batch, 'id'>) => void;
}

type InventorySubView = 'all' | 'selected' | 'batch' | 'company' | 'expired' | 'nearing_expiry';

// --- Main Inventory Component ---
const Inventory: React.FC<InventoryProps> = ({ products, companies, onAddProduct, onAddBatch }) => {
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [isBatchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedProductForBatch, setSelectedProductForBatch] = useState<Product | null>(null);
  const [activeSubView, setActiveSubView] = useState<InventorySubView>('all');

  const handleOpenBatchModal = (product: Product) => {
    setSelectedProductForBatch(product);
    setBatchModalOpen(true);
  };
  
  const renderSubView = () => {
    switch (activeSubView) {
      case 'all':
        return <AllItemStockView products={products} onOpenBatchModal={handleOpenBatchModal} />;
      case 'selected':
        return <SelectedItemStockView products={products} />;
      case 'batch':
        return <BatchWiseStockView products={products} />;
      case 'company':
        return <CompanyWiseStockView products={products} />;
      case 'expired':
        return <ExpiredStockView products={products} />;
      case 'nearing_expiry':
        return <NearingExpiryStockView products={products} />;
      default:
        return <AllItemStockView products={products} onOpenBatchModal={handleOpenBatchModal} />;
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

      {selectedProductForBatch && (
        <AddBatchModal
          isOpen={isBatchModalOpen}
          onClose={() => { setBatchModalOpen(false); setSelectedProductForBatch(null); }}
          product={selectedProductForBatch}
          onAddBatch={onAddBatch}
        />
      )}
    </div>
  );
};

const inputStyle = "w-full px-4 py-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
const selectStyle = `${inputStyle} appearance-none`;

// --- Sub View Components ---

const AllItemStockView: React.FC<{products: Product[], onOpenBatchModal: (product: Product) => void}> = ({ products, onOpenBatchModal }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [companyFilter, setCompanyFilter] = useState('');
    const companies = useMemo(() => [...new Set(products.map(p => p.company))], [products]);
  
    const filteredProducts = useMemo(() => {
        return products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (companyFilter === '' || product.company === companyFilter)
        );
    }, [products, searchTerm, companyFilter]);
    
    const handleExport = () => {
        const exportData = filteredProducts.map(product => ({
            'Product Name': product.name,
            'Company': product.company,
            'Total Stock': product.batches.reduce((sum, batch) => sum + batch.stock, 0),
            'Batches': product.batches.length,
        }));
        exportToCsv('all_item_stock', exportData);
    };

    return (
        <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
            </div>
            <div className="mb-6">
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
                            <th scope="col" className="px-6 py-3">Total Stock</th>
                            <th scope="col" className="px-6 py-3">Batches</th>
                            <th scope="col" className="px-6 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProducts.map(product => {
                            const totalStock = product.batches.reduce((sum, batch) => sum + batch.stock, 0);
                            return (
                                <tr key={product.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                    <th scope="row" className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">{product.name}</th>
                                    <td className="px-6 py-4">{product.company}</td>
                                    <td className="px-6 py-4 font-bold">{totalStock}</td>
                                    <td className="px-6 py-4">{product.batches.length}</td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => onOpenBatchModal(product)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">View/Add Batch</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredProducts.length === 0 && (
                    <div className="text-center py-10 text-slate-600 dark:text-slate-400"><p>No products found.</p></div>
                )}
            </div>
        </Card>
    );
};

const SelectedItemStockView: React.FC<{products: Product[]}> = ({ products }) => {
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
                        <div className="flex gap-4 mt-2 text-sm text-slate-800 dark:text-slate-300">
                           <span>HSN: {selectedProduct.hsnCode}</span>
                           <span>GST: {selectedProduct.gst}%</span>
                           <span className="font-semibold">Total Stock: {selectedProduct.batches.reduce((sum, b) => sum + b.stock, 0)}</span>
                        </div>
                    </div>
                    <BatchListTable title="Batches for Selected Product" batches={selectedProduct.batches.map(b => ({...b, productName: selectedProduct.name, company: selectedProduct.company}))} showProductInfo={false} />
                 </div>
            )}
        </Card>
    );
};

const CompanyWiseStockView: React.FC<{products: Product[]}> = ({ products }) => {
    const [companyFilter, setCompanyFilter] = useState('');

    const companies = useMemo(() => [...new Set(products.map(p => p.company))].sort(), [products]);

    const filteredAndSortedProducts = useMemo(() => {
        return products
            .filter(product => companyFilter === '' || product.company === companyFilter)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [products, companyFilter]);

    const handleExport = () => {
        const exportData = filteredAndSortedProducts.map(product => ({
            'Product Name': product.name,
            'Company': product.company,
            'Total Stock': product.batches.reduce((sum, b) => sum + b.stock, 0),
        }));
        const filename = companyFilter ? `stock_for_${companyFilter.replace(/ /g, '_')}` : 'company_wise_stock';
        exportToCsv(filename, exportData);
    };

    return (
        <Card title="Company-wise Stock">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                 <select
                    value={companyFilter}
                    onChange={e => setCompanyFilter(e.target.value)}
                    className={selectStyle}
                >
                    <option value="">All Companies</option>
                    {companies.map(company => <option key={company} value={company}>{company}</option>)}
                </select>
                <div className="flex justify-start sm:justify-end">
                    <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors duration-200 h-full">
                        <DownloadIcon className="h-5 w-5" /> Export to Excel
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                        <tr>
                            <th scope="col" className="px-6 py-3">Product Name</th>
                            <th scope="col" className="px-6 py-3">Company</th>
                            <th scope="col" className="px-6 py-3">Total Stock</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSortedProducts.map(product => {
                            const totalStock = product.batches.reduce((sum, batch) => sum + batch.stock, 0);
                            return (
                                <tr key={product.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                    <th scope="row" className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">{product.name}</th>
                                    <td className="px-6 py-4">{product.company}</td>
                                    <td className="px-6 py-4 font-bold">{totalStock}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredAndSortedProducts.length === 0 && (
                    <div className="text-center py-10 text-slate-600 dark:text-slate-400">
                        <p>No products found for the selected company.</p>
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

const BatchWiseStockView: React.FC<{products: Product[]}> = ({ products }) => {
    const allBatches = useMemo(() => products.flatMap(p => p.batches.map(b => ({ ...b, productName: p.name, company: p.company }))), [products]);
    return <BatchListTable title="All Batches" batches={allBatches} />;
};

const ExpiredStockView: React.FC<{products: Product[]}> = ({ products }) => {
    const today = new Date();
    const expiredBatches = useMemo(() => 
        products.flatMap(p => p.batches.map(b => ({ ...b, productName: p.name, company: p.company })))
                .filter(b => getExpiryDate(b.expiryDate) < today), 
    [products]);
    return <BatchListTable title="Expired Stock" batches={expiredBatches} />;
};

const NearingExpiryStockView: React.FC<{products: Product[]}> = ({ products }) => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    const nearingExpiryBatches = useMemo(() => 
        products.flatMap(p => p.batches.map(b => ({ ...b, productName: p.name, company: p.company })))
                .filter(b => {
                    const expiry = getExpiryDate(b.expiryDate);
                    return expiry >= today && expiry <= thirtyDaysFromNow;
                }), 
    [products]);
    return <BatchListTable title="Stock Nearing Expiry (30 Days)" batches={nearingExpiryBatches} />;
};


// --- Reusable & Helper Components ---

interface BatchWithProductInfo extends Batch { productName: string; company: string; }
const BatchListTable: React.FC<{ title: string; batches: BatchWithProductInfo[], showProductInfo?: boolean }> = ({ title, batches, showProductInfo = true }) => {
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
    name: '', company: '', hsnCode: '', gst: '12',
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
    const { name, company, hsnCode, gst, batchNumber, expiryDate, stock, mrp, purchasePrice } = formState;
    if (!name || !company || !batchNumber || !expiryDate || !stock || !mrp) return;

    onAddProduct(
      { name, company, hsnCode, gst: parseFloat(gst) },
      { batchNumber, expiryDate, stock: parseInt(stock), mrp: parseFloat(mrp), purchasePrice: parseFloat(purchasePrice) }
    );
    onClose();
    setFormState({
        name: '', company: '', hsnCode: '', gst: '12',
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
                      <li key={c.key} onClick={() => handleSelectCompany(c.name)} className="px-4 py-2 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900 text-slate-800 dark:text-slate-200">
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

const AddBatchModal: React.FC<{ isOpen: boolean; onClose: () => void; product: Product; onAddBatch: InventoryProps['onAddBatch']; }> = ({ isOpen, onClose, product, onAddBatch }) => {
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

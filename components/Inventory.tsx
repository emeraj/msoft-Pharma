import React, { useState, useMemo } from 'react';
import type { Product, Batch } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon } from './icons/Icons';

interface InventoryProps {
  products: Product[];
  onAddProduct: (product: Omit<Product, 'id' | 'batches'>, firstBatch: Omit<Batch, 'id'>) => void;
  onAddBatch: (productId: string, batch: Omit<Batch, 'id'>) => void;
}

type InventorySubView = 'all' | 'selected' | 'batch' | 'company' | 'expired' | 'nearing_expiry';

// --- Main Inventory Component ---
const Inventory: React.FC<InventoryProps> = ({ products, onAddProduct, onAddBatch }) => {
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
                : 'text-slate-700 hover:bg-slate-200'
        }`}
    >
        {label}
    </button>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-800">Inventory Management</h1>
          <button 
            onClick={() => setProductModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors duration-200"
          >
            <PlusIcon className="h-5 w-5" /> Add New Product
          </button>
        </div>
        <div className="flex flex-wrap gap-2 border-t mt-4 pt-4">
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

    return (
        <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Search by product name..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <select
                    value={companyFilter}
                    onChange={e => setCompanyFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                    <option value="">All Companies</option>
                    {companies.map(company => <option key={company} value={company}>{company}</option>)}
                </select>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-800">
                    <thead className="text-xs text-slate-800 uppercase bg-slate-50">
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
                                <tr key={product.id} className="bg-white border-b hover:bg-slate-50">
                                    <th scope="row" className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{product.name}</th>
                                    <td className="px-6 py-4">{product.company}</td>
                                    <td className="px-6 py-4 font-bold">{totalStock}</td>
                                    <td className="px-6 py-4">{product.batches.length}</td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => onOpenBatchModal(product)} className="font-medium text-indigo-600 hover:underline">View/Add Batch</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredProducts.length === 0 && (
                    <div className="text-center py-10 text-slate-600"><p>No products found.</p></div>
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
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                {searchResults.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {searchResults.map(p => (
                            <li key={p.id} onClick={() => handleSelect(p)} className="px-4 py-2 hover:bg-indigo-50 cursor-pointer">{p.name}</li>
                        ))}
                    </ul>
                )}
            </div>
            {selectedProduct && (
                 <div className="animate-fade-in">
                    <div className="p-4 bg-slate-50 rounded-lg border mb-4">
                        <h3 className="text-lg font-bold text-slate-800">{selectedProduct.name}</h3>
                        <p className="text-sm text-slate-700">{selectedProduct.company}</p>
                        <div className="flex gap-4 mt-2 text-sm text-slate-800">
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
    const [openCompany, setOpenCompany] = useState<string | null>(null);
    const productsByCompany = useMemo(() => {
        return products.reduce<Record<string, Product[]>>((acc, product) => {
            (acc[product.company] = acc[product.company] || []).push(product);
            return acc;
        }, {});
    }, [products]);

    return (
        <Card title="Company-wise Stock">
            <div className="space-y-4">
                {Object.entries(productsByCompany).map(([company, companyProducts]) => {
                    const totalStock = companyProducts.flatMap(p => p.batches).reduce((sum, b) => sum + b.stock, 0);
                    return (
                    <div key={company} className="border rounded-lg overflow-hidden">
                        <button onClick={() => setOpenCompany(openCompany === company ? null : company)} className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100">
                            <h3 className="font-semibold text-slate-800">{company}</h3>
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-slate-600">Products: {companyProducts.length}</span>
                                <span className="text-sm font-bold text-slate-800">Total Stock: {totalStock}</span>
                                <svg className={`h-5 w-5 transition-transform ${openCompany === company ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </button>
                        {openCompany === company && (
                            <div className="p-4 border-t">
                                <table className="w-full text-sm text-slate-800">
                                    <thead className="text-xs text-slate-800 bg-white"><tr><th className="py-2 text-left">Product</th><th className="py-2 text-right">Total Stock</th></tr></thead>
                                    <tbody>
                                        {companyProducts.map(p => (
                                            <tr key={p.id} className="border-b">
                                                <td className="py-2">{p.name}</td>
                                                <td className="py-2 text-right font-medium">{p.batches.reduce((s, b) => s + b.stock, 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )})}
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
        ).sort((a,b) => getExpiryDate(a.expiryDate).getTime() - getExpiryDate(b.expiryDate).getTime()),
    [batches, searchTerm]);

    return (
        <Card title={title}>
            <input
                type="text"
                placeholder="Search by product or batch..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full sm:w-1/2 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-4"
            />
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-800">
                    <thead className="text-xs text-slate-800 uppercase bg-slate-50">
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
                        {filteredBatches.map(batch => (
                            <tr key={batch.id} className="bg-white border-b hover:bg-slate-50">
                                {showProductInfo && <td className="px-6 py-4 font-medium text-slate-900">{batch.productName}</td>}
                                {showProductInfo && <td className="px-6 py-4">{batch.company}</td>}
                                <td className="px-6 py-4">{batch.batchNumber}</td>
                                <td className="px-6 py-4">{batch.expiryDate}</td>
                                <td className="px-6 py-4 font-bold">{batch.stock}</td>
                                <td className="px-6 py-4">₹{batch.mrp.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredBatches.length === 0 && <div className="text-center py-10 text-slate-600"><p>No batches found.</p></div>}
            </div>
        </Card>
    );
};

const AddProductModal: React.FC<{ isOpen: boolean; onClose: () => void; onAddProduct: InventoryProps['onAddProduct']; }> = ({ isOpen, onClose, onAddProduct }) => {
  const [formState, setFormState] = useState({
    name: '', company: '', hsnCode: '', gst: '12',
    batchNumber: '', expiryDate: '', stock: '', mrp: '', purchasePrice: ''
  });

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
        <h4 className="font-semibold text-slate-700">Product Details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input name="name" value={formState.name} onChange={handleChange} placeholder="Product Name" className="p-2 border rounded" required />
          <input name="company" value={formState.company} onChange={handleChange} placeholder="Company" className="p-2 border rounded" required />
          <input name="hsnCode" value={formState.hsnCode} onChange={handleChange} placeholder="HSN Code" className="p-2 border rounded" />
          <select name="gst" value={formState.gst} onChange={handleChange} className="p-2 border rounded bg-white">
            <option value="5">GST 5%</option>
            <option value="12">GST 12%</option>
            <option value="18">GST 18%</option>
          </select>
        </div>
        <h4 className="font-semibold text-slate-700 pt-2 border-t mt-4">First Batch Details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input name="batchNumber" value={formState.batchNumber} onChange={handleChange} placeholder="Batch No." className="p-2 border rounded" required />
            <input name="expiryDate" value={formState.expiryDate} onChange={handleChange} type="month" placeholder="Expiry (YYYY-MM)" className="p-2 border rounded" required />
            <input name="stock" value={formState.stock} onChange={handleChange} type="number" placeholder="Stock Qty" className="p-2 border rounded" required min="0"/>
            <input name="mrp" value={formState.mrp} onChange={handleChange} type="number" placeholder="MRP" className="p-2 border rounded" required min="0" step="0.01"/>
            <input name="purchasePrice" value={formState.purchasePrice} onChange={handleChange} type="number" placeholder="Purchase Price" className="p-2 border rounded" min="0" step="0.01"/>
        </div>
        <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300">Cancel</button>
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Batches for ${product.name}`}>
      <div className="mb-6 max-h-48 overflow-y-auto">
          <h4 className="font-semibold text-slate-700 mb-2">Existing Batches</h4>
          <ul className="space-y-2">
            {product.batches.map(batch => (
                <li key={batch.id} className="flex justify-between items-center bg-slate-50 p-2 rounded">
                    <div>
                        <span className="font-medium text-slate-800">Batch: {batch.batchNumber}</span>
                        <span className="text-sm text-slate-600 ml-4">Exp: {batch.expiryDate}</span>
                    </div>
                     <div>
                        <span className="text-sm text-slate-600 mr-4">MRP: ₹{batch.mrp.toFixed(2)}</span>
                        <span className="font-bold text-slate-800">Stock: {batch.stock}</span>
                    </div>
                </li>
            ))}
          </ul>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t">
        <h4 className="font-semibold text-slate-700">Add New Batch</h4>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input name="batchNumber" value={formState.batchNumber} onChange={handleChange} placeholder="Batch No." className="p-2 border rounded" required />
            <input name="expiryDate" value={formState.expiryDate} onChange={handleChange} type="month" placeholder="Expiry (YYYY-MM)" className="p-2 border rounded" required />
            <input name="stock" value={formState.stock} onChange={handleChange} type="number" placeholder="Stock Qty" className="p-2 border rounded" required min="0"/>
            <input name="mrp" value={formState.mrp} onChange={handleChange} type="number" placeholder="MRP" className="p-2 border rounded" required min="0" step="0.01"/>
            <input name="purchasePrice" value={formState.purchasePrice} onChange={handleChange} type="number" placeholder="Purchase Price" className="p-2 border rounded" min="0" step="0.01"/>
        </div>
        <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300">Cancel</button>
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
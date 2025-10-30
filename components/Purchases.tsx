import React, { useState, useMemo, useEffect } from 'react';
import type { Product, Purchase, PurchaseLineItem, Company, Supplier } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, TrashIcon, PencilIcon, DownloadIcon } from './icons/Icons';

interface PurchasesProps {
    products: Product[];
    purchases: Purchase[];
    companies: Company[];
    suppliers: Supplier[];
    onAddPurchase: (purchaseData: Omit<Purchase, 'id' | 'totalAmount'>) => void;
    onUpdatePurchase: (key: string, updatedData: Omit<Purchase, 'id'| 'key'>, originalPurchase: Purchase) => void;
    onDeletePurchase: (purchase: Purchase) => void;
    onAddSupplier: (supplierData: Omit<Supplier, 'id'>) => Promise<Supplier | null>;
}

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


const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
const formSelectStyle = `${formInputStyle} appearance-none`;


const AddSupplierModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAddSupplier: (supplierData: Omit<Supplier, 'id'>) => void;
    initialName?: string;
}> = ({ isOpen, onClose, onAddSupplier, initialName = '' }) => {
    const [formState, setFormState] = useState({
        name: '', address: '', phone: '', gstin: '', openingBalance: ''
    });

    useEffect(() => {
        if (isOpen) {
            setFormState({
                name: initialName, address: '', phone: '', gstin: '', openingBalance: '0'
            });
        }
    }, [isOpen, initialName]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormState({ ...formState, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.name) {
            alert('Supplier Name is required.');
            return;
        }
        onAddSupplier({
            ...formState,
            openingBalance: parseFloat(formState.openingBalance) || 0
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Supplier">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supplier Name*</label>
                        <input name="name" value={formState.name} onChange={handleChange} className={formInputStyle} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                        <input name="phone" value={formState.phone} onChange={handleChange} className={formInputStyle} />
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                    <input name="address" value={formState.address} onChange={handleChange} className={formInputStyle} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">GSTIN</label>
                        <input name="gstin" value={formState.gstin} onChange={handleChange} className={formInputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Opening Balance</label>
                        <input name="openingBalance" value={formState.openingBalance} onChange={handleChange} type="number" step="0.01" className={formInputStyle} />
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700 mt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Add Supplier</button>
                </div>
            </form>
        </Modal>
    );
};


const AddItemForm: React.FC<{ products: Product[], onAddItem: (item: PurchaseLineItem) => void, companies: Company[], disabled?: boolean }> = ({ products, onAddItem, companies, disabled = false }) => {
    const initialFormState = {
        isNewProduct: false,
        productSearch: '',
        selectedProduct: null as Product | null,
        productName: '', company: '', hsnCode: '', gst: '12',
        batchNumber: '', expiryDate: '', quantity: '', mrp: '', purchasePrice: ''
    };
    const [formState, setFormState] = useState(initialFormState);
    const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);

    const companySuggestions = useMemo(() => {
        if (!formState.company) return companies.slice(0, 5);
        return companies.filter(c => c.name.toLowerCase().includes(formState.company.toLowerCase()));
    }, [formState.company, companies]);

    const companyExists = useMemo(() => {
        return companies.some(c => c.name.toLowerCase() === formState.company.trim().toLowerCase());
    }, [formState.company, companies]);

    const handleSelectCompany = (companyName: string) => {
        setFormState(prev => ({ ...prev, company: companyName }));
        setShowCompanySuggestions(false);
    };

    const searchResults = useMemo(() => {
        if (!formState.productSearch) return [];
        return products.filter(p => p.name.toLowerCase().includes(formState.productSearch.toLowerCase())).slice(0, 5);
    }, [formState.productSearch, products]);

    const handleSelectProduct = (product: Product) => {
        setFormState(prev => ({
            ...prev,
            selectedProduct: product,
            productSearch: product.name,
            productName: product.name,
            company: product.company,
            hsnCode: product.hsnCode,
            gst: String(product.gst),
            isNewProduct: false,
        }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));

        if (name === 'productSearch' && value === '') {
             setFormState(prev => ({ ...prev, selectedProduct: null, isNewProduct: false }));
        }
    };

    const handleToggleNewProduct = () => {
        setFormState(prev => ({
            ...initialFormState,
            isNewProduct: true,
        }));
    };
    
    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        const { isNewProduct, selectedProduct, productName, company, hsnCode, gst, batchNumber, expiryDate, quantity, mrp, purchasePrice } = formState;

        if (isNewProduct && (!productName || !company)) {
            alert('Product Name and Company are required for a new product.');
            return;
        }
        if (!isNewProduct && !selectedProduct) {
            alert('Please select an existing product or switch to add a new one.');
            return;
        }

        const item: PurchaseLineItem = {
            isNewProduct,
            productName: isNewProduct ? productName : selectedProduct!.name,
            company: company.trim(),
            hsnCode: isNewProduct ? hsnCode : selectedProduct!.hsnCode,
            gst: parseFloat(gst),
            batchNumber,
            expiryDate,
            quantity: parseInt(quantity),
            mrp: parseFloat(mrp),
            purchasePrice: parseFloat(purchasePrice),
        };

        if (!isNewProduct && selectedProduct) {
            item.productId = selectedProduct.id;
            item.productKey = selectedProduct.key;
        }

        onAddItem(item);
        setFormState(initialFormState); // Reset form
    };

    return (
        <form onSubmit={handleAddItem} className={`p-4 my-4 space-y-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-700 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2 relative">
                    <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">Search Existing Product</label>
                    <input
                        type="text"
                        name="productSearch"
                        value={formState.productSearch}
                        onChange={handleChange}
                        placeholder="Type to search..."
                        className={`mt-1 w-full ${formInputStyle}`}
                        disabled={formState.isNewProduct || disabled}
                        autoComplete="off"
                    />
                    {searchResults.length > 0 && formState.productSearch && !formState.selectedProduct && (
                        <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-700 border dark:border-slate-600 shadow-lg rounded max-h-48 overflow-y-auto">
                            {searchResults.map(p => (
                                <li key={p.id} onClick={() => handleSelectProduct(p)} className="p-2 text-slate-800 dark:text-slate-200 hover:bg-indigo-100 dark:hover:bg-indigo-900 cursor-pointer">{p.name} ({p.company})</li>
                            ))}
                        </ul>
                    )}
                </div>
                <div>
                     <button type="button" onClick={handleToggleNewProduct} className="w-full h-10 px-4 py-2 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-900 transition-colors" disabled={disabled}>
                        Or, Add New Product
                    </button>
                </div>
            </div>

            {formState.isNewProduct && (
                 <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800 animate-fade-in">
                    <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">New Product Details</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <input name="productName" value={formState.productName} onChange={handleChange} placeholder="Product Name*" className={formInputStyle} required />
                        <div className="relative">
                            <input
                                name="company"
                                value={formState.company}
                                onChange={handleChange}
                                onFocus={() => setShowCompanySuggestions(true)}
                                onBlur={() => setTimeout(() => setShowCompanySuggestions(false), 200)}
                                placeholder="Company*"
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
                                            Create: "{formState.company.trim()}"
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
                </div>
            )}

            {(formState.selectedProduct || formState.isNewProduct) && (
                <div className="animate-fade-in">
                     <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 pt-2 border-t dark:border-slate-600">Batch Details</h4>
                     <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                         <input name="batchNumber" value={formState.batchNumber} onChange={handleChange} placeholder="Batch No.*" className={formInputStyle} required />
                         <input name="expiryDate" value={formState.expiryDate} onChange={handleChange} type="month" className={formInputStyle} required />
                         <input name="quantity" value={formState.quantity} onChange={handleChange} type="number" placeholder="Quantity*" className={formInputStyle} required min="1" />
                         <input name="purchasePrice" value={formState.purchasePrice} onChange={handleChange} type="number" placeholder="Purchase Price*" className={formInputStyle} required min="0" step="0.01" />
                         <input name="mrp" value={formState.mrp} onChange={handleChange} type="number" placeholder="MRP*" className={formInputStyle} required min="0" step="0.01" />
                     </div>
                     <div className="flex justify-end mt-4">
                        <button type="submit" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors">
                            <PlusIcon className="h-5 w-5" /> Add Item to Purchase
                        </button>
                     </div>
                </div>
            )}
            <style>{`
                @keyframes fade-in {
                    0% { opacity: 0; transform: translateY(-10px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </form>
    );
};


const Purchases: React.FC<PurchasesProps> = ({ products, purchases, companies, suppliers, onAddPurchase, onUpdatePurchase, onDeletePurchase, onAddSupplier }) => {
    const initialFormState = {
        supplierName: '',
        invoiceNumber: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        currentItems: [] as PurchaseLineItem[]
    };
    
    const [formState, setFormState] = useState(initialFormState);
    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
    const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
    const [isSupplierModalOpen, setSupplierModalOpen] = useState(false);
    
    // State for purchase history filtering
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (editingPurchase) {
            setFormState({
                supplierName: editingPurchase.supplier,
                invoiceNumber: editingPurchase.invoiceNumber,
                invoiceDate: new Date(editingPurchase.invoiceDate).toISOString().split('T')[0],
                currentItems: editingPurchase.items || [],
            });
            window.scrollTo(0, 0); // Scroll to top to see the form
        } else {
            setFormState(initialFormState);
        }
    }, [editingPurchase]);

    const supplierSuggestions = useMemo(() => {
        if (!formState.supplierName) return [];
        return suppliers.filter(s => s.name.toLowerCase().includes(formState.supplierName.toLowerCase()));
    }, [formState.supplierName, suppliers]);

    const exactMatch = useMemo(() => {
        return suppliers.some(s => s.name.toLowerCase() === formState.supplierName.trim().toLowerCase());
    }, [formState.supplierName, suppliers]);

    const handleSelectSupplier = (name: string) => {
        setFormState(prev => ({ ...prev, supplierName: name }));
        setShowSupplierSuggestions(false);
    };

    const handleOpenSupplierModal = () => {
        setSupplierModalOpen(true);
        setShowSupplierSuggestions(false);
    };

    const handleAddNewSupplier = async (supplierData: Omit<Supplier, 'id'>) => {
        const newSupplier = await onAddSupplier(supplierData);
        if (newSupplier) {
            setFormState(prev => ({ ...prev, supplierName: newSupplier.name }));
            setSupplierModalOpen(false);
        }
    };

    const handleAddItem = (item: PurchaseLineItem) => {
        setFormState(prev => ({...prev, currentItems: [...prev.currentItems, item]}));
    };

    const handleRemoveItem = (index: number) => {
        setFormState(prev => ({...prev, currentItems: prev.currentItems.filter((_, i) => i !== index)}));
    };

    const totalAmount = useMemo(() => {
        return formState.currentItems.reduce((total, item) => total + (item.purchasePrice * item.quantity), 0);
    }, [formState.currentItems]);
    
    const resetForm = () => {
        setEditingPurchase(null);
    };

    const handleSavePurchase = () => {
        if (!formState.supplierName || !formState.invoiceDate || formState.currentItems.length === 0) {
            alert('Please select a supplier, set the date, and add at least one item.');
            return;
        }
        if (!formState.invoiceNumber.trim()) {
            alert('Invoice Number is required.');
            return;
        }
        
        const purchaseData = { 
            supplier: formState.supplierName, 
            invoiceNumber: formState.invoiceNumber, 
            invoiceDate: formState.invoiceDate, 
            items: formState.currentItems,
        };

        if (editingPurchase && editingPurchase.key) {
             onUpdatePurchase(editingPurchase.key, { ...purchaseData, totalAmount }, editingPurchase);
        } else {
            onAddPurchase(purchaseData);
        }
        resetForm();
    };

    const filteredPurchases = useMemo(() => {
        return purchases
            .filter(p => {
                const purchaseDate = new Date(p.invoiceDate);
                purchaseDate.setHours(0,0,0,0);
                
                if (fromDate) {
                    const start = new Date(fromDate);
                    start.setHours(0,0,0,0);
                    if (purchaseDate < start) return false;
                }
                
                if (toDate) {
                    const end = new Date(toDate);
                    end.setHours(0,0,0,0);
                    if (purchaseDate > end) return false;
                }
                
                return true;
            })
            .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
    }, [purchases, fromDate, toDate]);
    
    const handleExport = () => {
        if (filteredPurchases.length === 0) {
            alert("No purchase data to export for the selected date range.");
            return;
        }
    
        const exportData = filteredPurchases.map(p => ({
            'Date': new Date(p.invoiceDate).toLocaleDateString(),
            'Invoice #': p.invoiceNumber,
            'Supplier': p.supplier,
            'Items': p.items.length,
            'Total Amount': p.totalAmount.toFixed(2),
        }));
        
        const filename = `purchase_history_${fromDate || 'all-time'}_to_${toDate || 'today'}`;
        exportToCsv(filename, exportData);
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card title={editingPurchase ? `Editing Purchase: ${editingPurchase.invoiceNumber}` : 'New Purchase Entry'}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supplier Name</label>
                        <input 
                            value={formState.supplierName} 
                            onChange={e => setFormState(prev => ({...prev, supplierName: e.target.value}))}
                            onFocus={() => setShowSupplierSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 200)}
                            placeholder="Search or Add Supplier*" 
                            className={formInputStyle} 
                            required
                            autoComplete="off"
                        />
                         {showSupplierSuggestions && formState.supplierName.length > 0 && (
                          <ul className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {supplierSuggestions.map(s => (
                                  <li key={s.key} onClick={() => handleSelectSupplier(s.name)} className="px-4 py-2 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900 text-slate-800 dark:text-slate-200">
                                      {s.name}
                                  </li>
                              ))}
                              {!exactMatch && formState.supplierName.trim().length > 0 && (
                                  <li onClick={handleOpenSupplierModal} className="px-4 py-2 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900 text-green-600 dark:text-green-400 font-semibold">
                                      <PlusIcon className="h-4 w-4 inline mr-2"/> Add new supplier: "{formState.supplierName.trim()}"
                                  </li>
                              )}
                          </ul>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Invoice Number</label>
                        <input value={formState.invoiceNumber} onChange={e => setFormState(prev => ({...prev, invoiceNumber: e.target.value}))} placeholder="Invoice Number*" className={formInputStyle} required/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Invoice Date</label>
                        <input value={formState.invoiceDate} onChange={e => setFormState(prev => ({...prev, invoiceDate: e.target.value}))} type="date" className={formInputStyle} required/>
                    </div>
                </div>

                <AddItemForm products={products} onAddItem={handleAddItem} companies={companies} />
                
                {formState.currentItems.length > 0 && (
                    <div className="mt-4">
                         <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Items in Current Purchase</h3>
                         <div className="overflow-x-auto">
                            <table className="w-full text-sm text-slate-800 dark:text-slate-300">
                                <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-100 dark:bg-slate-700">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Product</th>
                                        <th className="px-4 py-2 text-left">Batch</th>
                                        <th className="px-4 py-2">Qty</th>
                                        <th className="px-4 py-2 text-right">Purchase Price</th>
                                        <th className="px-4 py-2 text-right">Total</th>
                                        <th className="px-4 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formState.currentItems.map((item, index) => (
                                        <tr key={index} className="border-b dark:border-slate-700">
                                            <td className="px-4 py-2 font-medium">{item.productName} {item.isNewProduct && <span className="text-xs text-green-600 dark:text-green-400 font-semibold">(New)</span>}</td>
                                            <td className="px-4 py-2">{item.batchNumber}</td>
                                            <td className="px-4 py-2 text-center">{item.quantity}</td>
                                            <td className="px-4 py-2 text-right">₹{item.purchasePrice.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right font-semibold">₹{(item.purchasePrice * item.quantity).toFixed(2)}</td>
                                            <td className="px-4 py-2 text-center">
                                                <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700"><TrashIcon className="h-4 w-4" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         </div>
                         <div className="flex flex-col sm:flex-row justify-end items-center mt-4 gap-4">
                            <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
                                <span>Total Amount: </span>
                                <span>₹{totalAmount.toFixed(2)}</span>
                            </div>
                            {editingPurchase && (
                                <button type="button" onClick={resetForm} className="bg-slate-500 text-white px-6 py-3 rounded-lg text-lg font-semibold shadow-md hover:bg-slate-600 transition-colors w-full sm:w-auto">
                                    Cancel Edit
                                </button>
                            )}
                            <button onClick={handleSavePurchase} className="bg-green-600 text-white px-6 py-3 rounded-lg text-lg font-semibold shadow-md hover:bg-green-700 transition-colors w-full sm:w-auto">
                                {editingPurchase ? 'Update Purchase' : 'Save Purchase'}
                            </button>
                         </div>
                    </div>
                )}
            </Card>
            
            <AddSupplierModal 
                isOpen={isSupplierModalOpen}
                onClose={() => setSupplierModalOpen(false)}
                onAddSupplier={handleAddNewSupplier}
                initialName={formState.supplierName}
            />

            <Card title="Purchase History">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-700">
                    <div className="flex items-center gap-2">
                        <label htmlFor="fromDate" className="text-sm font-medium text-slate-700 dark:text-slate-300">From</label>
                        <input type="date" id="fromDate" value={fromDate} onChange={e => setFromDate(e.target.value)} className={formInputStyle} />
                    </div>
                    <div className="flex items-center gap-2">
                        <label htmlFor="toDate" className="text-sm font-medium text-slate-700 dark:text-slate-300">To</label>
                        <input type="date" id="toDate" value={toDate} onChange={e => setToDate(e.target.value)} className={formInputStyle} />
                    </div>
                    <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors duration-200">
                        <DownloadIcon className="h-5 w-5" /> Export to Excel
                    </button>
                </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                        <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Invoice #</th>
                                <th className="px-6 py-3">Supplier</th>
                                <th className="px-6 py-3 text-center">Items</th>
                                <th className="px-6 py-3 text-right">Total Amount</th>
                                <th className="px-6 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPurchases.map(p => (
                                <tr key={p.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                                    <td className="px-6 py-4">{new Date(p.invoiceDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{p.invoiceNumber}</td>
                                    <td className="px-6 py-4">{p.supplier}</td>
                                    <td className="px-6 py-4 text-center">{p.items.length}</td>
                                    <td className="px-6 py-4 font-semibold text-right">₹{p.totalAmount.toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center items-center gap-4">
                                            <button onClick={() => setEditingPurchase(p)} title="Edit Purchase" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                                                <PencilIcon className="h-5 w-5" />
                                            </button>
                                            <button onClick={() => onDeletePurchase(p)} title="Delete Purchase" className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredPurchases.length === 0 && <p className="text-center py-6 text-slate-600 dark:text-slate-400">No purchase history found for the selected dates.</p>}
                 </div>
            </Card>
        </div>
    );
};

export default Purchases;
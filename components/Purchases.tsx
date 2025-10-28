import React, { useState, useMemo } from 'react';
import type { Product, Purchase, PurchaseLineItem, Company } from '../types';
import Card from './common/Card';
import { PlusIcon, TrashIcon } from './icons/Icons';

interface PurchasesProps {
    products: Product[];
    purchases: Purchase[];
    companies: Company[];
    onAddPurchase: (purchaseData: Omit<Purchase, 'id' | 'totalAmount'>) => void;
}

const formInputStyle = "p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
const formSelectStyle = `${formInputStyle} appearance-none`;


const AddItemForm: React.FC<{ products: Product[], onAddItem: (item: PurchaseLineItem) => void, companies: Company[] }> = ({ products, onAddItem, companies }) => {
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
        <form onSubmit={handleAddItem} className="p-4 my-4 space-y-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-700">
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
                        disabled={formState.isNewProduct}
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
                     <button type="button" onClick={handleToggleNewProduct} className="w-full h-10 px-4 py-2 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-900 transition-colors">
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


const Purchases: React.FC<PurchasesProps> = ({ products, purchases, companies, onAddPurchase }) => {
    const [supplier, setSupplier] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [currentItems, setCurrentItems] = useState<PurchaseLineItem[]>([]);
    
    const handleAddItem = (item: PurchaseLineItem) => {
        setCurrentItems(prev => [...prev, item]);
    };

    const handleRemoveItem = (index: number) => {
        setCurrentItems(prev => prev.filter((_, i) => i !== index));
    };

    const totalAmount = useMemo(() => {
        return currentItems.reduce((total, item) => total + (item.purchasePrice * item.quantity), 0);
    }, [currentItems]);
    
    const handleSavePurchase = () => {
        if (!supplier || !invoiceDate || currentItems.length === 0) {
            alert('Please fill supplier, date, and add at least one item.');
            return;
        }
        if (!invoiceNumber.trim()) {
            alert('Invoice Number is required.');
            return;
        }
        if (invoiceNumber.trim().length < 3) {
            alert('Invoice Number must be at least 3 characters long.');
            return;
        }
        onAddPurchase({ supplier, invoiceNumber, invoiceDate, items: currentItems });
        // Reset form
        setSupplier('');
        setInvoiceNumber('');
        setInvoiceDate(new Date().toISOString().split('T')[0]);
        setCurrentItems([]);
    };
    
    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card title="New Purchase Entry">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier Name*" className={formInputStyle} required/>
                    <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Invoice Number*" className={formInputStyle} required/>
                    <input value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} type="date" className={formInputStyle} required/>
                </div>

                <AddItemForm products={products} onAddItem={handleAddItem} companies={companies} />
                
                {currentItems.length > 0 && (
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
                                    {currentItems.map((item, index) => (
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
                            <button onClick={handleSavePurchase} className="bg-green-600 text-white px-6 py-3 rounded-lg text-lg font-semibold shadow-md hover:bg-green-700 transition-colors w-full sm:w-auto">
                                Save Purchase
                            </button>
                         </div>
                    </div>
                )}
            </Card>

            <Card title="Purchase History">
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                        <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Invoice #</th>
                                <th className="px-6 py-3">Supplier</th>
                                <th className="px-6 py-3 text-center">Items</th>
                                <th className="px-6 py-3 text-right">Total Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchases.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()).map(p => (
                                <tr key={p.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                                    <td className="px-6 py-4">{new Date(p.invoiceDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{p.invoiceNumber}</td>
                                    <td className="px-6 py-4">{p.supplier}</td>
                                    <td className="px-6 py-4 text-center">{p.items.length}</td>
                                    <td className="px-6 py-4 font-semibold text-right">₹{p.totalAmount.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {purchases.length === 0 && <p className="text-center py-6 text-slate-600 dark:text-slate-400">No purchase history found.</p>}
                 </div>
            </Card>
        </div>
    );
};

export default Purchases;
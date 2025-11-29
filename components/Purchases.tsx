
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, Purchase, PurchaseLineItem, Company, Supplier, SystemConfig, GstRate } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, TrashIcon, PencilIcon, DownloadIcon, BarcodeIcon, CameraIcon, UploadIcon, CheckCircleIcon } from './icons/Icons';
import BarcodeScannerModal from './BarcodeScannerModal';
import { GoogleGenAI } from "@google/genai";

interface PurchasesProps {
    products: Product[];
    purchases: Purchase[];
    companies: Company[];
    suppliers: Supplier[];
    systemConfig: SystemConfig;
    gstRates: GstRate[];
    onAddPurchase: (purchaseData: Omit<Purchase, 'id' | 'totalAmount'>) => void;
    onUpdatePurchase: (id: string, updatedData: Omit<Purchase, 'id'>, originalPurchase: Purchase) => void;
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

// --- OCR Preview Modal ---
interface OcrPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: {
        supplierName: string;
        invoiceNumber: string;
        invoiceDate: string;
        items: PurchaseLineItem[];
    };
    suppliers: Supplier[];
    onImport: (data: { supplierName: string; invoiceNumber: string; invoiceDate: string; items: PurchaseLineItem[] }) => void;
    isPharmaMode: boolean;
}

const OcrPreviewModal: React.FC<OcrPreviewModalProps> = ({ isOpen, onClose, data, suppliers, onImport, isPharmaMode }) => {
    const [supplierName, setSupplierName] = useState(data.supplierName);
    const [invoiceNumber, setInvoiceNumber] = useState(data.invoiceNumber);
    const [invoiceDate, setInvoiceDate] = useState(data.invoiceDate);
    const [items, setItems] = useState<(PurchaseLineItem & { selected: boolean })[]>([]);
    
    useEffect(() => {
        if (isOpen) {
            setSupplierName(data.supplierName);
            setInvoiceNumber(data.invoiceNumber);
            setInvoiceDate(data.invoiceDate);
            setItems(data.items.map(i => ({ ...i, selected: true })));
        }
    }, [isOpen, data]);

    const handleItemChange = (index: number, field: keyof PurchaseLineItem, value: any) => {
        setItems(prev => prev.map((item, i) => {
            if (i === index) {
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const handleToggleSelect = (index: number) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item));
    };

    const handleImport = () => {
        const selectedItems = items.filter(i => i.selected).map(({ selected, ...rest }) => rest);
        onImport({
            supplierName,
            invoiceNumber,
            invoiceDate,
            items: selectedItems
        });
        onClose();
    };

    const handleAddItem = () => {
        const newItem: PurchaseLineItem & { selected: boolean } = {
            isNewProduct: true,
            productName: '',
            company: '',
            hsnCode: '',
            gst: 0,
            batchNumber: isPharmaMode ? '' : 'DEFAULT',
            expiryDate: isPharmaMode ? '' : '9999-12',
            quantity: 1,
            mrp: 0,
            purchasePrice: 0,
            discount: 0,
            selected: true
        };
        setItems([...items, newItem]);
    };

    const handleDeleteItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Verify Scanned Invoice" maxWidth="max-w-6xl">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Supplier</label>
                        <input 
                            value={supplierName} 
                            onChange={(e) => setSupplierName(e.target.value)} 
                            className={formInputStyle} 
                            list="supplier-list-ocr"
                        />
                        <datalist id="supplier-list-ocr">
                            {suppliers.map(s => <option key={s.id} value={s.name} />)}
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Invoice No</label>
                        <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={formInputStyle} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Date</label>
                        <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={formInputStyle} />
                    </div>
                </div>

                <div className="overflow-x-auto border dark:border-slate-700 rounded-lg max-h-[60vh]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 dark:bg-slate-700 text-xs uppercase sticky top-0 z-10">
                            <tr>
                                <th className="px-2 py-3 w-10 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={items.every(i => i.selected)} 
                                        onChange={(e) => setItems(prev => prev.map(i => ({...i, selected: e.target.checked})))} 
                                        className="rounded border-gray-300"
                                    />
                                </th>
                                <th className="px-2 py-3 min-w-[200px]">Product / Desc</th>
                                <th className="px-2 py-3 w-24">HSN</th>
                                {isPharmaMode && <th className="px-2 py-3 w-24">Batch</th>}
                                {isPharmaMode && <th className="px-2 py-3 w-32">Expiry</th>}
                                <th className="px-2 py-3 w-20 text-center">Qty</th>
                                <th className="px-2 py-3 w-24 text-right">Rate</th>
                                <th className="px-2 py-3 w-16 text-center">Disc%</th>
                                <th className="px-2 py-3 w-16 text-center">Tax%</th>
                                <th className="px-2 py-3 w-28 text-right">Amount</th>
                                <th className="px-2 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {items.map((item, index) => {
                                const amount = (item.quantity * item.purchasePrice) * (1 - (item.discount || 0)/100);
                                const taxAmt = amount * (item.gst/100);
                                const total = amount + taxAmt;

                                return (
                                    <tr key={index} className={`hover:bg-slate-50 dark:hover:bg-slate-800 ${!item.selected ? 'opacity-50' : ''}`}>
                                        <td className="px-2 py-2 text-center">
                                            <input 
                                                type="checkbox" 
                                                checked={item.selected} 
                                                onChange={() => handleToggleSelect(index)}
                                                className="rounded border-gray-300"
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <input 
                                                value={item.productName} 
                                                onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
                                            />
                                            {item.isNewProduct && <span className="text-[10px] text-green-600 font-bold block">NEW PRODUCT</span>}
                                        </td>
                                        <td className="px-2 py-2">
                                            <input 
                                                value={item.hsnCode} 
                                                onChange={(e) => handleItemChange(index, 'hsnCode', e.target.value)}
                                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
                                            />
                                        </td>
                                        {isPharmaMode && (
                                            <td className="px-2 py-2">
                                                <input 
                                                    value={item.batchNumber} 
                                                    onChange={(e) => handleItemChange(index, 'batchNumber', e.target.value)}
                                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
                                                />
                                            </td>
                                        )}
                                        {isPharmaMode && (
                                            <td className="px-2 py-2">
                                                <input 
                                                    type="month"
                                                    value={item.expiryDate} 
                                                    onChange={(e) => handleItemChange(index, 'expiryDate', e.target.value)}
                                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
                                                />
                                            </td>
                                        )}
                                        <td className="px-2 py-2">
                                            <input 
                                                type="number"
                                                value={item.quantity} 
                                                onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                className="w-full text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <input 
                                                type="number"
                                                step="0.01"
                                                value={item.purchasePrice} 
                                                onChange={(e) => handleItemChange(index, 'purchasePrice', parseFloat(e.target.value) || 0)}
                                                className="w-full text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <input 
                                                type="number"
                                                step="0.01"
                                                value={item.discount} 
                                                onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)}
                                                className="w-full text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <input 
                                                type="number"
                                                step="0.01"
                                                value={item.gst} 
                                                onChange={(e) => handleItemChange(index, 'gst', parseFloat(e.target.value) || 0)}
                                                className="w-full text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
                                            />
                                        </td>
                                        <td className="px-2 py-2 text-right font-medium">
                                            {total.toFixed(2)}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <button onClick={() => handleDeleteItem(index)} className="text-red-500 hover:text-red-700">
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                
                <div className="flex justify-between items-center pt-2">
                    <button onClick={handleAddItem} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1">
                        <PlusIcon className="h-4 w-4" /> Add Missing Item
                    </button>
                    <div className="text-right">
                        <p className="text-sm text-slate-500">Total Items: {items.filter(i => i.selected).length}</p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg hover:bg-slate-300">Cancel</button>
                    <button onClick={handleImport} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 flex items-center gap-2">
                        <CheckCircleIcon className="h-5 w-5" /> Import Selected Data
                    </button>
                </div>
            </div>
        </Modal>
    );
};


const AddItemForm: React.FC<{ products: Product[], onAddItem: (item: PurchaseLineItem) => void, companies: Company[], systemConfig: SystemConfig, gstRates: GstRate[], disabled?: boolean, itemToEdit?: PurchaseLineItem | null }> = ({ products, onAddItem, companies, systemConfig, gstRates, disabled = false, itemToEdit }) => {
    const sortedGstRates = useMemo(() => [...gstRates].sort((a, b) => a.rate - b.rate), [gstRates]);
    const defaultGst = useMemo(() => sortedGstRates.find(r => r.rate === 12)?.rate.toString() || sortedGstRates[0]?.rate.toString() || '0', [sortedGstRates]);
    
    const getInitialFormState = () => ({
        isNewProduct: false,
        productSearch: '',
        selectedProduct: null as Product | null,
        productName: '', company: '', hsnCode: '', gst: defaultGst, composition: '', unitsPerStrip: '', isScheduleH: 'No',
        batchNumber: '', expiryDate: '', quantity: '', mrp: '', purchasePrice: '',
        barcode: '',
        discount: '',
        tax: defaultGst
    });

    const [formState, setFormState] = useState(getInitialFormState());
    const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const activeItemRef = useRef<HTMLLIElement>(null);
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [isScanning, setIsScanning] = useState(false);

    // Effect to populate form when editing
    useEffect(() => {
        if (itemToEdit) {
            const existingProduct = itemToEdit.productId ? products.find(p => p.id === itemToEdit.productId) : null;
            
            setFormState({
                isNewProduct: itemToEdit.isNewProduct,
                productSearch: itemToEdit.productName,
                selectedProduct: existingProduct || null,
                productName: itemToEdit.productName,
                company: itemToEdit.company,
                hsnCode: itemToEdit.hsnCode,
                gst: String(itemToEdit.gst),
                composition: itemToEdit.composition || '',
                unitsPerStrip: String(itemToEdit.unitsPerStrip || ''),
                isScheduleH: itemToEdit.isScheduleH ? 'Yes' : 'No',
                batchNumber: itemToEdit.batchNumber,
                expiryDate: itemToEdit.expiryDate,
                quantity: String(itemToEdit.quantity),
                mrp: String(itemToEdit.mrp),
                purchasePrice: String(itemToEdit.purchasePrice),
                barcode: itemToEdit.barcode || '',
                discount: itemToEdit.discount ? String(itemToEdit.discount) : '',
                tax: String(itemToEdit.gst)
            });
        }
    }, [itemToEdit, products]);

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
        if (!formState.productSearch || formState.selectedProduct) return [];
        const term = formState.productSearch.toLowerCase();
        return products.filter(p => 
            p.name.toLowerCase().includes(term) || 
            (!isPharmaMode && p.barcode && p.barcode.includes(term))
        ).slice(0, 5);
    }, [formState.productSearch, products, formState.selectedProduct, isPharmaMode]);

    useEffect(() => {
        setActiveIndex(0);
    }, [formState.productSearch]);

    useEffect(() => {
        activeItemRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
        });
    }, [activeIndex]);

    const handleScanSuccess = (decodedText: string) => {
        setFormState(prev => ({ ...prev, barcode: decodedText }));
        setIsScanning(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (searchResults.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % searchResults.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
                break;
            case 'Enter':
                e.preventDefault();
                if (activeIndex >= 0 && activeIndex < searchResults.length) {
                    handleSelectProduct(searchResults[activeIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setFormState(prev => ({...prev, productSearch: '', selectedProduct: null}));
                break;
            default:
                break;
        }
    };


    const handleSelectProduct = (product: Product) => {
        setFormState(prev => ({
            ...prev,
            selectedProduct: product,
            productSearch: product.name,
            productName: product.name,
            company: product.company,
            hsnCode: product.hsnCode,
            gst: String(product.gst),
            tax: String(product.gst), // Sync tax field with product GST
            unitsPerStrip: String(product.unitsPerStrip || ''),
            isScheduleH: product.isScheduleH ? 'Yes' : 'No',
            isNewProduct: false,
        }));
        setActiveIndex(-1);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormState(prev => {
            const newState = { ...prev, [name]: value };
            if (name === 'productSearch') {
                newState.selectedProduct = null;
                newState.isNewProduct = false;
            }
            // If GST changes in top section, update tax field in bottom section
            if (name === 'gst') {
                newState.tax = value;
            }
            // If tax changes in bottom section, update gst in top section
            if (name === 'tax') {
                newState.gst = value;
            }
            return newState;
        });
    };

    const handleToggleNewProduct = () => {
        setFormState(getInitialFormState());
        setFormState(prev => ({
            ...prev,
            isNewProduct: true,
        }));
    };
    
    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        const { isNewProduct, selectedProduct, productName, company, hsnCode, gst, composition, unitsPerStrip, isScheduleH, batchNumber, expiryDate, quantity, mrp, purchasePrice, barcode, discount, tax } = formState;

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
            gst: parseFloat(tax) || parseFloat(gst) || 0, // Use tax value
            batchNumber: isPharmaMode ? batchNumber : 'DEFAULT',
            expiryDate: isPharmaMode ? expiryDate : '9999-12',
            quantity: parseInt(quantity, 10),
            mrp: parseFloat(mrp),
            purchasePrice: parseFloat(purchasePrice),
            barcode: isNewProduct && !isPharmaMode ? barcode : undefined,
            discount: parseFloat(discount) || 0,
        };

        if (isPharmaMode && isNewProduct) {
            item.isScheduleH = isScheduleH === 'Yes';
             if (composition) {
                item.composition = composition;
            }
            const units = parseInt(unitsPerStrip, 10);
            if (!isNaN(units) && units > 1) {
                item.unitsPerStrip = units;
            }
        } else {
            item.isScheduleH = false;
            item.unitsPerStrip = 1;
        }
        
        if (!isNewProduct && selectedProduct) {
            item.productId = selectedProduct.id;
        }

        onAddItem(item);
        setFormState(getInitialFormState()); // Reset form
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
                        onKeyDown={handleKeyDown}
                        placeholder={isPharmaMode ? "Type to search..." : "Scan barcode or type name..."}
                        className={`mt-1 w-full ${formInputStyle}`}
                        disabled={formState.isNewProduct || disabled}
                        autoComplete="off"
                    />
                    {searchResults.length > 0 && (
                        <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-700 border dark:border-slate-600 shadow-lg rounded max-h-48 overflow-y-auto">
                            {searchResults.map((p, index) => (
                                <li 
                                    key={p.id} 
                                    ref={index === activeIndex ? activeItemRef : null}
                                    onClick={() => handleSelectProduct(p)} 
                                    onMouseEnter={() => setActiveIndex(index)}
                                    className={`p-2 text-slate-800 dark:text-slate-200 cursor-pointer ${
                                        index === activeIndex 
                                            ? 'bg-indigo-200 dark:bg-indigo-700' 
                                            : 'hover:bg-indigo-100 dark:hover:bg-indigo-900'
                                    }`}
                                >
                                    {p.name} ({p.company}) {!isPharmaMode && p.barcode && <span className="text-xs text-gray-500">[{p.barcode}]</span>}
                                </li>
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
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
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
                                        <li key={c.id} onClick={() => handleSelectCompany(c.name)} className="px-4 py-2 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900 text-slate-800 dark:text-slate-200">
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
                        {!isPharmaMode && (
                            <div className="relative flex gap-1 items-center col-span-2 md:col-span-1">
                                <input name="barcode" value={formState.barcode} onChange={handleChange} placeholder="Barcode" className={formInputStyle} />
                                <button
                                    type="button"
                                    onClick={() => setIsScanning(true)}
                                    className="p-2 bg-slate-200 dark:bg-slate-600 rounded hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-300"
                                    title="Scan Barcode"
                                >
                                    <CameraIcon className="h-5 w-5" />
                                </button>
                            </div>
                        )}
                        <select name="gst" value={formState.gst} onChange={handleChange} className={formSelectStyle}>
                           {sortedGstRates.map(rate => (
                            <option key={rate.id} value={rate.rate}>{`GST ${rate.rate}%`}</option>
                            ))}
                        </select>
                        {isPharmaMode && (
                           <>
                                <input name="unitsPerStrip" value={formState.unitsPerStrip} onChange={handleChange} type="number" placeholder="Units / Strip" className={formInputStyle} min="1"/>
                                <select name="isScheduleH" value={formState.isScheduleH} onChange={handleChange} className={formSelectStyle}>
                                    <option value="No">Sch. H? No</option>
                                    <option value="Yes">Sch. H? Yes</option>
                                </select>
                                <div className="col-span-2 md:col-span-6">
                                <input name="composition" value={formState.composition} onChange={handleChange} placeholder="Composition (e.g., Paracetamol 500mg)" className={formInputStyle} />
                                </div>
                           </>
                        )}
                    </div>
                </div>
            )}

            {(formState.selectedProduct || formState.isNewProduct) && (
                <div className="animate-fade-in">
                     <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 pt-2 border-t dark:border-slate-600">Purchase Details</h4>
                     <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                         {isPharmaMode && <input name="batchNumber" value={formState.batchNumber} onChange={handleChange} placeholder="Batch No.*" className={formInputStyle} required />}
                         {isPharmaMode && <input name="expiryDate" value={formState.expiryDate} onChange={handleChange} type="month" className={formInputStyle} required />}
                         <input name="quantity" value={formState.quantity} onChange={handleChange} type="number" placeholder={`Qty ${isPharmaMode ? '(Strips)' : ''}*`} className={formInputStyle} required min="1" />
                         <input name="purchasePrice" value={formState.purchasePrice} onChange={handleChange} type="number" placeholder={`Price / ${isPharmaMode ? 'Strip' : 'Unit'}*`} className={formInputStyle} required min="0" step="0.01" />
                         <input name="mrp" value={formState.mrp} onChange={handleChange} type="number" placeholder={`MRP / ${isPharmaMode ? 'Strip' : 'Unit'}*`} className={formInputStyle} required min="0" step="0.01" />
                         <input name="discount" value={formState.discount} onChange={handleChange} type="number" placeholder="Disc (%)" className={formInputStyle} min="0" step="0.01" />
                         <input name="tax" value={formState.tax} onChange={handleChange} type="number" placeholder="Tax (%)" className={formInputStyle} min="0" step="0.01" />
                     </div>
                     <div className="flex justify-end mt-4">
                        <button type="submit" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors">
                            <PlusIcon className="h-5 w-5" /> {itemToEdit ? 'Update Item' : 'Add Item to Purchase'}
                        </button>
                     </div>
                </div>
            )}
             <BarcodeScannerModal 
                isOpen={isScanning} 
                onClose={() => setIsScanning(false)} 
                onScanSuccess={handleScanSuccess} 
             />
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


const Purchases: React.FC<PurchasesProps> = ({ products, purchases, companies, suppliers, systemConfig, gstRates, onAddPurchase, onUpdatePurchase, onDeletePurchase, onAddSupplier }) => {
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
    const [itemToEdit, setItemToEdit] = useState<PurchaseLineItem | null>(null);
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    
    // OCR Processing State
    const [isProcessingOCR, setIsProcessingOCR] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isOcrPreviewOpen, setIsOcrPreviewOpen] = useState(false);
    const [ocrData, setOcrData] = useState<{
        supplierName: string;
        invoiceNumber: string;
        invoiceDate: string;
        items: PurchaseLineItem[];
    }>({ supplierName: '', invoiceNumber: '', invoiceDate: '', items: [] });

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
        setItemToEdit(null); // Clear edit state after adding
    };

    const handleRemoveItem = (index: number) => {
        setFormState(prev => ({...prev, currentItems: prev.currentItems.filter((_, i) => i !== index)}));
    };

    const handleEditItem = (index: number) => {
        const item = formState.currentItems[index];
        setItemToEdit(item);
        handleRemoveItem(index); // Remove from list to be re-added after edit
        // Optionally, scroll to top/form
        const formElement = document.querySelector('form');
        if (formElement) {
            formElement.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Helper function to calculate line item total
    const calculateLineTotal = (item: PurchaseLineItem) => {
        const amount = item.purchasePrice * item.quantity;
        const discountAmount = amount * ((item.discount || 0) / 100);
        const taxableAmount = amount - discountAmount;
        const taxAmount = taxableAmount * (item.gst / 100);
        return taxableAmount + taxAmount;
    };

    const totalAmount = useMemo(() => {
        return formState.currentItems.reduce((total, item) => total + calculateLineTotal(item), 0);
    }, [formState.currentItems]);
    
    const resetForm = () => {
        setEditingPurchase(null);
        setFormState(initialFormState);
        setItemToEdit(null);
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
            totalAmount
        };

        if (editingPurchase && editingPurchase.id) {
             onUpdatePurchase(editingPurchase.id, purchaseData, editingPurchase);
        } else {
            onAddPurchase(purchaseData);
        }
        resetForm();
    };

    // --- Gemini AI Analysis Logic ---

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!process.env.API_KEY) {
            alert("API Key is missing. Please configure the environment variable.");
            return;
        }

        setIsProcessingOCR(true);
        try {
            let base64Data = "";
            let mimeType = file.type;

            if (file.type === 'application/pdf') {
                base64Data = await convertPdfToImageBase64(file);
                mimeType = "image/png"; // Converted to PNG
            } else if (file.type.startsWith('image/')) {
                base64Data = await convertFileToBase64(file);
            } else {
                alert('Unsupported file type. Please upload an image or PDF.');
                setIsProcessingOCR(false);
                return;
            }
            
            if (base64Data) {
                // Remove header if present (e.g. "data:image/png;base64,") for API
                const cleanBase64 = base64Data.split(',')[1];
                await analyzeInvoiceWithGemini(cleanBase64, mimeType);
            }
        } catch (error: any) {
            console.error('AI Analysis Error:', error);
            const msg = error instanceof Error ? error.message : String(error);
            alert(`Failed to analyze invoice. Details: ${msg}`);
        } finally {
            setIsProcessingOCR(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const convertFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const convertPdfToImageBase64 = async (file: File): Promise<string> => {
        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) throw new Error("PDF.js not loaded");

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1); // Process first page only
        
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            return canvas.toDataURL('image/png');
        }
        throw new Error("Could not render PDF");
    };

    const analyzeInvoiceWithGemini = async (base64Data: string, mimeType: string) => {
        // Use gemini-2.5-flash which is more stable for general users on free tier
        const model = 'gemini-2.5-flash'; 
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const prompt = `Analyze this purchase invoice image carefully. Extract the following details:
        1. Supplier Name
        2. Invoice Number
        3. Invoice Date (Format: YYYY-MM-DD)
        4. Line Items. For each item, extract:
           - Product Name (Description)
           - HSN Code
           - Batch Number
           - Expiry Date (Format: YYYY-MM)
           - Quantity (Total units)
           - Unit Rate (Purchase Price per unit before tax)
           - MRP (Maximum Retail Price per unit)
           - Discount Percentage
           - GST Percentage
           - Total Amount (Taxable Value for this line)

        Important: 
        - If Unit Rate is missing, calculate it as Total Amount / Quantity.
        - If Expiry is not found, leave empty or estimate from context if obvious.
        - Return '0' for missing numeric fields.
        `;

        // Use string literals for types to avoid runtime Enum resolution issues
        const responseSchema = {
            type: 'OBJECT' as any,
            properties: {
                supplierName: { type: 'STRING' as any },
                invoiceNumber: { type: 'STRING' as any },
                invoiceDate: { type: 'STRING' as any, description: "YYYY-MM-DD format" },
                items: {
                    type: 'ARRAY' as any,
                    items: {
                        type: 'OBJECT' as any,
                        properties: {
                            productName: { type: 'STRING' as any },
                            hsnCode: { type: 'STRING' as any },
                            batchNumber: { type: 'STRING' as any },
                            expiryDate: { type: 'STRING' as any, description: "YYYY-MM format (e.g. 2025-12)" },
                            quantity: { type: 'NUMBER' as any },
                            rate: { type: 'NUMBER' as any },
                            mrp: { type: 'NUMBER' as any },
                            discount: { type: 'NUMBER' as any },
                            gst: { type: 'NUMBER' as any },
                            amount: { type: 'NUMBER' as any }
                        }
                    }
                }
            }
        };

        const response = await ai.models.generateContent({
            model: model,
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: base64Data } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        });

        const text = response.text;
        if (text) {
            const result = JSON.parse(text);
            processAiResult(result);
        }
    };

    // Helper to clean numbers from strings if AI messes up types
    const parseNumber = (val: any) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.-]/g, '')) || 0;
        return 0;
    };

    const normalizeDate = (dateStr: string) => {
        if (!dateStr) return new Date().toISOString().split('T')[0];
        // Handle DD/MM/YYYY or DD-MM-YYYY which AI sometimes returns despite instructions
        if (dateStr.match(/^\d{2}[\/-]\d{2}[\/-]\d{4}$/)) {
            const parts = dateStr.split(/[\/-]/);
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr; // Assume YYYY-MM-DD
    };

    const processAiResult = (result: any) => {
        const currentData = {
            supplierName: result.supplierName || '',
            invoiceNumber: result.invoiceNumber || '',
            invoiceDate: normalizeDate(result.invoiceDate),
            items: [] as PurchaseLineItem[]
        };

        // Try to match Supplier from DB
        const matchedSupplier = suppliers.find(s => 
            s.name.toLowerCase().includes(result.supplierName?.toLowerCase() || '$$$') || 
            (result.supplierName && s.name.toLowerCase().includes(result.supplierName.toLowerCase()))
        );
        if (matchedSupplier) currentData.supplierName = matchedSupplier.name;

        if (result.items && Array.isArray(result.items)) {
            currentData.items = result.items.map((item: any) => {
                const existingProduct = products.find(p => p.name.toLowerCase() === item.productName?.toLowerCase());
                
                const qty = parseNumber(item.quantity);
                const amt = parseNumber(item.amount);
                let rate = parseNumber(item.rate);
                
                // Smart Fallback: Calculate rate if missing but we have Total Amount & Qty
                if (rate === 0 && qty > 0 && amt > 0) {
                    rate = amt / qty;
                }

                // Smart Fallback: If MRP missing, default to Purchase Rate (better than 0)
                let mrp = parseNumber(item.mrp);
                if (mrp === 0 && rate > 0) mrp = rate;

                return {
                    isNewProduct: !existingProduct,
                    productId: existingProduct?.id,
                    productName: existingProduct?.name || item.productName || 'Unknown Product',
                    company: existingProduct?.company || (currentData.supplierName || 'Unknown Company'),
                    hsnCode: existingProduct?.hsnCode || item.hsnCode || '',
                    gst: existingProduct?.gst || parseNumber(item.gst) || 0,
                    batchNumber: item.batchNumber || 'BATCH',
                    expiryDate: item.expiryDate || '2025-12',
                    quantity: qty || 1,
                    mrp: mrp,
                    purchasePrice: rate,
                    discount: parseNumber(item.discount) || 0,
                    unitsPerStrip: existingProduct?.unitsPerStrip || 1,
                    isScheduleH: existingProduct?.isScheduleH || false,
                    composition: existingProduct?.composition || ''
                };
            });
        }

        setOcrData(currentData);
        setIsOcrPreviewOpen(true);
    };

    const handleImportFromOcr = (data: { supplierName: string; invoiceNumber: string; invoiceDate: string; items: PurchaseLineItem[] }) => {
        setFormState({
            supplierName: data.supplierName,
            invoiceNumber: data.invoiceNumber,
            invoiceDate: data.invoiceDate,
            currentItems: [...formState.currentItems, ...data.items]
        });
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
            <Card title={
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <span>{editingPurchase ? `Editing Purchase: ${editingPurchase.invoiceNumber}` : 'New Purchase Entry'}</span>
                    {!editingPurchase && (
                        <div className="relative">
                            <input 
                                type="file" 
                                accept="image/*,application/pdf" 
                                ref={fileInputRef} 
                                onChange={handleFileUpload} 
                                className="hidden"
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessingOCR}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg shadow-md hover:from-purple-600 hover:to-indigo-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isProcessingOCR ? (
                                    <>
                                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                        <span>Analyzing Invoice with AI...</span>
                                    </>
                                ) : (
                                    <>
                                        <UploadIcon className="h-5 w-5" />
                                        <span>Auto-Fill from Invoice (AI)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            }>
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
                                  <li key={s.id} onClick={() => handleSelectSupplier(s.name)} className="px-4 py-2 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900 text-slate-800 dark:text-slate-200">
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

                <AddItemForm 
                    products={products} 
                    onAddItem={handleAddItem} 
                    companies={companies} 
                    systemConfig={systemConfig} 
                    gstRates={gstRates} 
                    itemToEdit={itemToEdit}
                />
                
                {formState.currentItems.length > 0 && (
                    <div className="mt-4">
                         <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Items in Current Purchase</h3>
                         <div className="overflow-x-auto">
                            <table className="w-full text-sm text-slate-800 dark:text-slate-300">
                                <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-100 dark:bg-slate-700">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Product</th>
                                        <th className="px-4 py-2 text-left">HSN</th>
                                        {isPharmaMode && <th className="px-4 py-2 text-left">Batch</th>}
                                        <th className="px-4 py-2 text-center">Qty</th>
                                        <th className="px-4 py-2 text-right">Rate</th>
                                        <th className="px-4 py-2 text-center">Disc (%)</th>
                                        <th className="px-4 py-2 text-center">Tax (%)</th>
                                        <th className="px-4 py-2 text-right">Total</th>
                                        <th className="px-4 py-2 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formState.currentItems.map((item, index) => (
                                        <tr key={index} className="border-b dark:border-slate-700">
                                            <td className="px-4 py-2 font-medium">{item.productName} {item.isNewProduct && <span className="text-xs text-green-600 dark:text-green-400 font-semibold">(New)</span>}</td>
                                            <td className="px-4 py-2">{item.hsnCode}</td>
                                            {isPharmaMode && <td className="px-4 py-2">{item.batchNumber}</td>}
                                            <td className="px-4 py-2 text-center">{item.quantity}</td>
                                            <td className="px-4 py-2 text-right">₹{item.purchasePrice.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-center">{item.discount || 0}%</td>
                                            <td className="px-4 py-2 text-center">{item.gst}%</td>
                                            <td className="px-4 py-2 text-right font-semibold">₹{calculateLineTotal(item).toFixed(2)}</td>
                                            <td className="px-4 py-2 text-center">
                                                <div className="flex justify-center gap-3">
                                                    <button onClick={() => handleEditItem(index)} className="text-blue-500 hover:text-blue-700" title="Edit Item">
                                                        <PencilIcon className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700" title="Remove Item">
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
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

            <OcrPreviewModal 
                isOpen={isOcrPreviewOpen}
                onClose={() => setIsOcrPreviewOpen(false)}
                data={ocrData}
                suppliers={suppliers}
                onImport={handleImportFromOcr}
                isPharmaMode={isPharmaMode}
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


import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import type { Purchase, Product, Supplier, SystemConfig, GstRate, PurchaseLineItem, Company } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, PencilIcon, TrashIcon, UploadIcon, DownloadIcon } from './icons/Icons';

const exportToCsv = (filename: string, data: any[]) => {
  if (data.length === 0) {
    alert("No data to export.");
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
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

interface PurchasesProps {
  products: Product[];
  purchases: Purchase[];
  companies: Company[];
  suppliers: Supplier[];
  systemConfig: SystemConfig;
  gstRates: GstRate[];
  onAddPurchase: (purchaseData: any) => Promise<void>;
  onUpdatePurchase: (id: string, data: any) => Promise<void>;
  onDeletePurchase: (purchase: Purchase) => Promise<void>;
  onAddSupplier: (supplierData: any) => Promise<Supplier | null>;
}

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
const formSelectStyle = `${formInputStyle} appearance-none`;

const Purchases: React.FC<PurchasesProps> = ({ 
    products, 
    purchases, 
    companies, 
    suppliers, 
    systemConfig, 
    gstRates, 
    onAddPurchase, 
    onUpdatePurchase, 
    onDeletePurchase,
    onAddSupplier 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
        const matchesSearch = p.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              p.supplier.toLowerCase().includes(searchTerm.toLowerCase());
        const purchaseDate = new Date(p.invoiceDate);
        purchaseDate.setHours(0,0,0,0);
        
        let matchesDate = true;
        if (fromDate) {
            const start = new Date(fromDate);
            start.setHours(0,0,0,0);
            if (purchaseDate < start) matchesDate = false;
        }
        if (toDate) {
            const end = new Date(toDate);
            end.setHours(0,0,0,0);
            if (purchaseDate > end) matchesDate = false;
        }
        return matchesSearch && matchesDate;
    }).sort((a,b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
  }, [purchases, searchTerm, fromDate, toDate]);

  const handleExport = () => {
      const data = filteredPurchases.map(p => ({
          'Invoice No': p.invoiceNumber,
          'Date': new Date(p.invoiceDate).toLocaleDateString(),
          'Supplier': p.supplier,
          'Total Amount': p.totalAmount.toFixed(2),
          'Items Count': p.items.length
      }));
      exportToCsv('purchases_report', data);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Purchase Management</h1>
          <button 
            onClick={() => { setEditingPurchase(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors duration-200"
          >
            <PlusIcon className="h-5 w-5" /> Add New Purchase
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <input 
                type="text" 
                placeholder="Search Invoice # or Supplier..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className={formInputStyle} 
            />
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">From:</span>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={formInputStyle} />
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">To:</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={formInputStyle} />
            </div>
        </div>
        
        <div className="flex justify-end mt-4">
             <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded shadow hover:bg-green-700 text-sm">
                <DownloadIcon className="h-4 w-4" /> Export CSV
            </button>
        </div>
      </Card>

      <Card title="Purchase History">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                    <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Invoice #</th>
                        <th className="px-6 py-3">Supplier</th>
                        <th className="px-6 py-3 text-right">Total Amount</th>
                        <th className="px-6 py-3 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredPurchases.map(purchase => (
                        <tr key={purchase.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                            <td className="px-6 py-4">{new Date(purchase.invoiceDate).toLocaleDateString()}</td>
                            <td className="px-6 py-4 font-medium">{purchase.invoiceNumber}</td>
                            <td className="px-6 py-4">{purchase.supplier}</td>
                            <td className="px-6 py-4 text-right font-bold">₹{purchase.totalAmount.toFixed(2)}</td>
                            <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-3">
                                    <button onClick={() => { setEditingPurchase(purchase); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-800">
                                        <PencilIcon className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => onDeletePurchase(purchase)} className="text-red-600 hover:text-red-800">
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredPurchases.length === 0 && (
                        <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-500">No purchases found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </Card>

      {isModalOpen && (
          <AddPurchaseModal 
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            existingPurchase={editingPurchase}
            products={products}
            suppliers={suppliers}
            gstRates={gstRates}
            systemConfig={systemConfig}
            onSave={async (data) => {
                if (editingPurchase) {
                    await onUpdatePurchase(editingPurchase.id, data);
                } else {
                    await onAddPurchase(data);
                }
                setIsModalOpen(false);
            }}
            onAddSupplier={onAddSupplier}
          />
      )}
    </div>
  );
};

interface AddPurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    existingPurchase: Purchase | null;
    products: Product[];
    suppliers: Supplier[];
    gstRates: GstRate[];
    systemConfig: SystemConfig;
    onSave: (data: any) => Promise<void>;
    onAddSupplier: (data: any) => Promise<Supplier | null>;
}

const AddPurchaseModal: React.FC<AddPurchaseModalProps> = ({ 
    isOpen, onClose, existingPurchase, products, suppliers, gstRates, systemConfig, onSave, onAddSupplier 
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    
    const [header, setHeader] = useState({
        invoiceNumber: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        supplier: '',
    });
    const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([]);
    
    // Line item input state
    const [currentItem, setCurrentItem] = useState<Partial<PurchaseLineItem>>({
        isNewProduct: false,
        productName: '',
        company: '',
        hsnCode: '',
        gst: 12,
        batchNumber: '',
        expiryDate: '',
        quantity: 0,
        mrp: 0,
        purchasePrice: 0,
        unitsPerStrip: 1,
    });

    useEffect(() => {
        if (existingPurchase) {
            setHeader({
                invoiceNumber: existingPurchase.invoiceNumber,
                invoiceDate: existingPurchase.invoiceDate.split('T')[0],
                supplier: existingPurchase.supplier,
            });
            setLineItems(existingPurchase.items);
        }
    }, [existingPurchase]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessingImage(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // Convert file to base64
            const reader = new FileReader();
            reader.readAsDataURL(file);
            await new Promise((resolve) => { reader.onload = resolve; });
            const base64Data = (reader.result as string).split(',')[1];
            
            const prompt = "Extract invoice details: invoice number, date, supplier name, and line items (product name, company, hsn, batch, expiry (YYYY-MM), quantity, mrp, rate, gst, units per strip). Return as JSON.";
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    { inlineData: { mimeType: file.type, data: base64Data } },
                    { text: prompt }
                ],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            invoiceNumber: { type: Type.STRING },
                            invoiceDate: { type: Type.STRING },
                            supplierName: { type: Type.STRING },
                            items: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        productName: { type: Type.STRING },
                                        company: { type: Type.STRING },
                                        hsnCode: { type: Type.STRING },
                                        batchNumber: { type: Type.STRING },
                                        expiryDate: { type: Type.STRING },
                                        quantity: { type: Type.NUMBER },
                                        mrp: { type: Type.NUMBER },
                                        purchasePrice: { type: Type.NUMBER },
                                        gst: { type: Type.NUMBER },
                                        unitsPerStrip: { type: Type.NUMBER },
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (response.text) {
                const data = JSON.parse(response.text);
                
                // Auto-fill header
                setHeader(prev => ({
                    ...prev,
                    invoiceNumber: data.invoiceNumber || prev.invoiceNumber,
                    invoiceDate: data.invoiceDate ? new Date(data.invoiceDate).toISOString().split('T')[0] : prev.invoiceDate,
                    supplier: data.supplierName || prev.supplier
                }));

                // Map items
                const newItems: PurchaseLineItem[] = data.items.map((item: any) => {
                    // Try to find existing product
                    const existingProduct = products.find(p => p.name.toLowerCase() === item.productName?.toLowerCase());
                    
                    return {
                        isNewProduct: !existingProduct,
                        productId: existingProduct?.id,
                        productName: item.productName || '',
                        company: item.company || existingProduct?.company || '',
                        hsnCode: item.hsnCode || existingProduct?.hsnCode || '',
                        gst: item.gst || existingProduct?.gst || 12,
                        batchNumber: item.batchNumber || '',
                        expiryDate: item.expiryDate || '',
                        quantity: item.quantity || 0,
                        mrp: item.mrp || 0,
                        purchasePrice: item.purchasePrice || 0,
                        unitsPerStrip: item.unitsPerStrip || existingProduct?.unitsPerStrip || 1,
                        isScheduleH: existingProduct?.isScheduleH || false
                    };
                });
                
                setLineItems(prev => [...prev, ...newItems]);
            }

        } catch (e: any) {
            console.error("AI Extraction Failed", e);
            alert("Failed to process invoice: " + e.message);
        } finally {
            setIsProcessingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleAddLineItem = () => {
        if (!currentItem.productName || !currentItem.quantity || !currentItem.mrp || !currentItem.batchNumber) {
            alert("Please fill all required item details.");
            return;
        }
        setLineItems(prev => [...prev, currentItem as PurchaseLineItem]);
        setCurrentItem({
            isNewProduct: false,
            productName: '',
            company: '',
            hsnCode: '',
            gst: 12,
            batchNumber: '',
            expiryDate: '',
            quantity: 0,
            mrp: 0,
            purchasePrice: 0,
            unitsPerStrip: 1,
        });
    };

    const handleRemoveItem = (index: number) => {
        setLineItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSavePurchase = () => {
        if (!header.invoiceNumber || !header.supplier || lineItems.length === 0) {
            alert("Please fill invoice details and add at least one item.");
            return;
        }
        const totalAmount = lineItems.reduce((sum, item) => sum + (item.quantity * item.purchasePrice), 0);
        onSave({
            ...header,
            items: lineItems,
            totalAmount
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={existingPurchase ? "Edit Purchase" : "Add Purchase"} maxWidth="max-w-4xl">
            <div className="space-y-6">
                {/* Header Section with AI Upload */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow w-full">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Invoice Number</label>
                            <input 
                                value={header.invoiceNumber} 
                                onChange={e => setHeader({...header, invoiceNumber: e.target.value})} 
                                className={formInputStyle} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                            <input 
                                type="date"
                                value={header.invoiceDate} 
                                onChange={e => setHeader({...header, invoiceDate: e.target.value})} 
                                className={formInputStyle} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supplier</label>
                            <input 
                                list="suppliers-list"
                                value={header.supplier} 
                                onChange={e => setHeader({...header, supplier: e.target.value})} 
                                className={formInputStyle} 
                                placeholder="Select or type..."
                            />
                            <datalist id="suppliers-list">
                                {suppliers.map(s => <option key={s.id} value={s.name} />)}
                            </datalist>
                        </div>
                    </div>
                    
                    {/* AI Upload Button - Exact snippet integration */}
                    <div className="flex flex-col items-center gap-2 pt-6">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*,application/pdf"
                            onChange={handleFileUpload}
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isProcessingImage}
                            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg shadow-sm transition-all ${
                                isProcessingImage 
                                ? 'bg-slate-200 text-slate-500 cursor-wait' 
                                : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700'
                            }`}
                        >
                            {isProcessingImage ? (
                                <>
                                    <div className="animate-spin h-4 w-4 border-2 border-slate-500 border-t-transparent rounded-full"></div>
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <UploadIcon className="h-4 w-4" />
                                    <span>Upload Invoice Image/PDF (AI)</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Add Item Form */}
                <div className="p-4 border rounded-lg dark:border-slate-600">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Add Line Item</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        <div className="col-span-2">
                            <label className="block text-xs font-medium mb-1">Product Name</label>
                            <input 
                                value={currentItem.productName} 
                                onChange={e => {
                                    const val = e.target.value;
                                    const existing = products.find(p => p.name.toLowerCase() === val.toLowerCase());
                                    setCurrentItem(prev => ({
                                        ...prev, 
                                        productName: val,
                                        isNewProduct: !existing,
                                        productId: existing?.id,
                                        company: existing?.company || prev.company,
                                        hsnCode: existing?.hsnCode || prev.hsnCode,
                                        gst: existing?.gst || prev.gst,
                                        unitsPerStrip: existing?.unitsPerStrip || prev.unitsPerStrip,
                                    }));
                                }}
                                list="products-list"
                                className={formInputStyle}
                                placeholder="Search product..."
                            />
                            <datalist id="products-list">
                                {products.map(p => <option key={p.id} value={p.name} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Batch No.</label>
                            <input 
                                value={currentItem.batchNumber} 
                                onChange={e => setCurrentItem({...currentItem, batchNumber: e.target.value})} 
                                className={formInputStyle} 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Expiry (YYYY-MM)</label>
                            <input 
                                type="month"
                                value={currentItem.expiryDate} 
                                onChange={e => setCurrentItem({...currentItem, expiryDate: e.target.value})} 
                                className={formInputStyle} 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Qty {systemConfig.softwareMode === 'Pharma' ? '(Strips)' : ''}</label>
                            <input 
                                type="number"
                                value={currentItem.quantity || ''} 
                                onChange={e => setCurrentItem({...currentItem, quantity: parseFloat(e.target.value)})} 
                                className={formInputStyle} 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">MRP</label>
                            <input 
                                type="number"
                                value={currentItem.mrp || ''} 
                                onChange={e => setCurrentItem({...currentItem, mrp: parseFloat(e.target.value)})} 
                                className={formInputStyle} 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Purchase Rate</label>
                            <input 
                                type="number"
                                value={currentItem.purchasePrice || ''} 
                                onChange={e => setCurrentItem({...currentItem, purchasePrice: parseFloat(e.target.value)})} 
                                className={formInputStyle} 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">GST %</label>
                            <select 
                                value={currentItem.gst} 
                                onChange={e => setCurrentItem({...currentItem, gst: parseFloat(e.target.value)})} 
                                className={formSelectStyle}
                            >
                                {gstRates.map(r => <option key={r.id} value={r.rate}>{r.rate}%</option>)}
                            </select>
                        </div>
                        {currentItem.isNewProduct && (
                            <>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Company</label>
                                    <input 
                                        value={currentItem.company} 
                                        onChange={e => setCurrentItem({...currentItem, company: e.target.value})} 
                                        className={formInputStyle} 
                                    />
                                </div>
                                {systemConfig.softwareMode === 'Pharma' && (
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Units/Strip</label>
                                        <input 
                                            type="number"
                                            value={currentItem.unitsPerStrip} 
                                            onChange={e => setCurrentItem({...currentItem, unitsPerStrip: parseFloat(e.target.value)})} 
                                            className={formInputStyle} 
                                        />
                                    </div>
                                )}
                            </>
                        )}
                        <div className="flex items-end">
                            <button onClick={handleAddLineItem} className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700">Add</button>
                        </div>
                    </div>
                </div>

                {/* Items List */}
                <div className="border rounded-lg overflow-hidden dark:border-slate-600">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 dark:bg-slate-700 text-xs uppercase">
                            <tr>
                                <th className="px-4 py-2">Product</th>
                                <th className="px-4 py-2">Batch</th>
                                <th className="px-4 py-2">Exp</th>
                                <th className="px-4 py-2 text-center">Qty</th>
                                <th className="px-4 py-2 text-right">Rate</th>
                                <th className="px-4 py-2 text-right">Total</th>
                                <th className="px-4 py-2 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lineItems.map((item, idx) => (
                                <tr key={idx} className="border-b dark:border-slate-600">
                                    <td className="px-4 py-2">
                                        {item.productName}
                                        {item.isNewProduct && <span className="ml-2 text-xs bg-green-100 text-green-800 px-1 rounded">New</span>}
                                    </td>
                                    <td className="px-4 py-2">{item.batchNumber}</td>
                                    <td className="px-4 py-2">{item.expiryDate}</td>
                                    <td className="px-4 py-2 text-center">{item.quantity}</td>
                                    <td className="px-4 py-2 text-right">{item.purchasePrice.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-right">{(item.quantity * item.purchasePrice).toFixed(2)}</td>
                                    <td className="px-4 py-2 text-center">
                                        <button onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700"><TrashIcon className="h-4 w-4" /></button>
                                    </td>
                                </tr>
                            ))}
                            {lineItems.length === 0 && (
                                <tr><td colSpan={7} className="text-center py-4 text-slate-500">No items added yet.</td></tr>
                            )}
                        </tbody>
                        <tfoot className="bg-slate-50 dark:bg-slate-700 font-bold">
                            <tr>
                                <td colSpan={5} className="px-4 py-2 text-right">Total:</td>
                                <td className="px-4 py-2 text-right">
                                    {lineItems.reduce((sum, item) => sum + (item.quantity * item.purchasePrice), 0).toFixed(2)}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded hover:bg-slate-300">Cancel</button>
                    <button onClick={handleSavePurchase} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold">
                        {existingPurchase ? 'Update Purchase' : 'Save Purchase'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default Purchases;

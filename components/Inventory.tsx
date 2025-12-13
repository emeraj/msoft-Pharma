import React, { useState, useEffect, useMemo } from 'react';
import type { Product, Batch, SystemConfig, GstRate } from '../types';
import Modal from './common/Modal';
import { PencilIcon, TrashIcon, PlusIcon, DownloadIcon, UploadIcon } from './icons/Icons';
import { getTranslation } from '../utils/translationHelper';

const inputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
const selectStyle = `${inputStyle} appearance-none`;

const EditProductModal: React.FC<{ isOpen: boolean, onClose: () => void, product: Product, onUpdateProduct: (pid: string, data: any) => void, systemConfig: SystemConfig, gstRates: GstRate[] }> = ({ isOpen, onClose, product, onUpdateProduct, systemConfig, gstRates }) => {
    const [formData, setFormData] = useState({ 
        ...product, 
        gst: String(product.gst),
        openingStock: String(product.batches[0]?.openingStock ?? product.batches[0]?.stock ?? 0),
        currentStock: String(product.batches[0]?.stock ?? 0)
    });
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    useEffect(() => {
        if (product.batches.length > 0) {
            const batch = product.batches[0];
            const opStock = batch.openingStock !== undefined ? batch.openingStock : batch.stock;
            setFormData(prev => ({
                ...prev, 
                openingStock: String(opStock),
                currentStock: String(batch.stock)
            }));
        }
    }, [product]);

    const handleOpeningStockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // Auto-adjust current stock based on difference
        const oldOp = Number(formData.openingStock);
        const newOp = Number(val);
        const diff = newOp - oldOp;
        
        setFormData(prev => ({
            ...prev,
            openingStock: val,
            currentStock: String(Number(prev.currentStock) + diff)
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const batch = product.batches[0];
        
        // If single batch product
        if (batch) {
            const updatedBatch = {
                ...batch,
                openingStock: Number(formData.openingStock),
                stock: Number(formData.currentStock)
            };
            
            onUpdateProduct(product.id, { 
                ...formData, 
                gst: Number(formData.gst),
                batches: [updatedBatch]
            });
        } else {
             onUpdateProduct(product.id, { ...formData, gst: Number(formData.gst) });
        }
        
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
                
                {/* Editable Opening Stock and Current Stock Fields */}
                {product.batches.length <= 1 && (
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border dark:border-slate-600">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Opening Stock</label>
                            <input 
                                type="number" 
                                value={formData.openingStock} 
                                onChange={handleOpeningStockChange} 
                                className={inputStyle} 
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Business starting qty.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Current Stock</label>
                            <input 
                                type="number" 
                                value={formData.currentStock} 
                                onChange={e => setFormData({...formData, currentStock: e.target.value})} 
                                className={inputStyle} 
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Live stock on hand.</p>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Update</button>
                </div>
            </form>
        </Modal>
    );
};

interface InventoryProps {
  products: Product[];
  systemConfig: SystemConfig;
  gstRates: GstRate[];
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onUpdateProduct: (id: string, product: Partial<Product>) => void;
  onDeleteProduct: (id: string) => void;
}

const Inventory: React.FC<InventoryProps> = ({ products, systemConfig, gstRates, onAddProduct, onUpdateProduct, onDeleteProduct }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const t = getTranslation(systemConfig.language);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    name: '', company: '', hsnCode: '', gst: gstRates[0]?.rate || 0, barcode: '', composition: '', unitsPerStrip: 1, isScheduleH: false, openingStock: 0, purchasePrice: 0, mrp: 0, batchNumber: 'DEFAULT', expiryDate: '2025-12'
  });

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [products, searchTerm]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const batch: Batch = {
        id: Date.now().toString(),
        batchNumber: newProduct.batchNumber,
        expiryDate: newProduct.expiryDate,
        stock: Number(newProduct.openingStock),
        openingStock: Number(newProduct.openingStock),
        mrp: Number(newProduct.mrp),
        purchasePrice: Number(newProduct.purchasePrice)
    };

    onAddProduct({
        name: newProduct.name,
        company: newProduct.company,
        hsnCode: newProduct.hsnCode,
        gst: Number(newProduct.gst),
        barcode: newProduct.barcode,
        composition: newProduct.composition,
        unitsPerStrip: Number(newProduct.unitsPerStrip),
        isScheduleH: newProduct.isScheduleH,
        batches: [batch]
    });
    setAddModalOpen(false);
    setNewProduct({ name: '', company: '', hsnCode: '', gst: gstRates[0]?.rate || 0, barcode: '', composition: '', unitsPerStrip: 1, isScheduleH: false, openingStock: 0, purchasePrice: 0, mrp: 0, batchNumber: 'DEFAULT', expiryDate: '2025-12' });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
            <input 
                type="text" 
                placeholder={t.inventory.searchPlaceholder} 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className={inputStyle + " max-w-md"} 
            />
            <button onClick={() => setAddModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                <PlusIcon className="h-5 w-5" /> {t.inventory.addProduct}
            </button>
        </div>

        <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-lg shadow">
            <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-100 dark:bg-slate-700">
                    <tr>
                        <th className="px-6 py-3">{t.inventory.productName}</th>
                        <th className="px-6 py-3">{t.inventory.company}</th>
                        <th className="px-6 py-3">{t.inventory.currentStock}</th>
                        <th className="px-6 py-3">{t.inventory.actions}</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredProducts.map(product => {
                        const totalStock = product.batches.reduce((sum, b) => sum + b.stock, 0);
                        return (
                            <tr key={product.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                                <td className="px-6 py-4 font-medium">{product.name}</td>
                                <td className="px-6 py-4">{product.company}</td>
                                <td className="px-6 py-4">{totalStock}</td>
                                <td className="px-6 py-4 flex gap-3">
                                    <button onClick={() => setEditingProduct(product)} className="text-blue-600 hover:text-blue-800"><PencilIcon className="h-4 w-4" /></button>
                                    <button onClick={() => onDeleteProduct(product.id)} className="text-red-600 hover:text-red-800"><TrashIcon className="h-4 w-4" /></button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>

        {/* Add Product Modal */}
        <Modal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} title={t.inventory.addProduct}>
            <form onSubmit={handleAddSubmit} className="space-y-4">
                <input placeholder="Product Name" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className={inputStyle} required />
                <input placeholder="Company" value={newProduct.company} onChange={e => setNewProduct({...newProduct, company: e.target.value})} className={inputStyle} required />
                <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Opening Stock" value={newProduct.openingStock} onChange={e => setNewProduct({...newProduct, openingStock: Number(e.target.value)})} className={inputStyle} />
                    <input type="number" placeholder="MRP" value={newProduct.mrp} onChange={e => setNewProduct({...newProduct, mrp: Number(e.target.value)})} className={inputStyle} required />
                </div>
                <div className="flex justify-end pt-4">
                    <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded">{t.inventory.addProduct}</button>
                </div>
            </form>
        </Modal>

        {/* Edit Product Modal */}
        {editingProduct && (
            <EditProductModal 
                isOpen={!!editingProduct} 
                onClose={() => setEditingProduct(null)} 
                product={editingProduct} 
                onUpdateProduct={onUpdateProduct} 
                systemConfig={systemConfig}
                gstRates={gstRates}
            />
        )}
    </div>
  );
};

export default Inventory;
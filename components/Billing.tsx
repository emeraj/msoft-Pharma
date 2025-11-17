
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import type { Bill, Product, CartItem, CompanyProfile, SystemConfig, PrinterProfile, Batch } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, TrashIcon, PrinterIcon, XIcon, CameraIcon, ShoppingCartIcon } from './icons/Icons';
import PrinterSelectionModal from './PrinterSelectionModal';
import PrintableBill from './PrintableBill';
import PrintableA5Bill from './PrintableA5Bill';
import ThermalPrintableBill from './ThermalPrintableBill';
import BarcodeScannerModal from './BarcodeScannerModal';

interface BillingProps {
  products: Product[];
  bills: Bill[];
  onGenerateBill: (billData: Omit<Bill, 'id' | 'billNumber'>) => Promise<Bill | null>;
  companyProfile: CompanyProfile;
  systemConfig: SystemConfig;
  editingBill?: Bill | null;
  onUpdateBill?: (billId: string, updatedBillData: Omit<Bill, 'id'>, originalBill: Bill) => Promise<Bill | null>;
  onCancelEdit?: () => void;
}

const Billing: React.FC<BillingProps> = ({ 
  products, 
  bills, 
  onGenerateBill, 
  companyProfile, 
  systemConfig, 
  editingBill, 
  onUpdateBill, 
  onCancelEdit 
}) => {
  // State
  const [customerName, setCustomerName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Pharma/Batch State
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [quantity, setQuantity] = useState<string>('1');
  
  const [isPrinterModalOpen, setPrinterModalOpen] = useState(false);
  const [lastBill, setLastBill] = useState<Bill | null>(null);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLLIElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isPharmaMode = systemConfig.softwareMode === 'Pharma';
  const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";

  useEffect(() => {
    if (editingBill) {
      setCustomerName(editingBill.customerName);
      setDoctorName(editingBill.doctorName || '');
      setCart(editingBill.items);
    } else {
      resetForm();
    }
  }, [editingBill]);

  const resetForm = () => {
    setCustomerName('');
    setDoctorName('');
    setCart([]);
    setProductSearch('');
    setSelectedProduct(null);
    setSelectedBatchId('');
    setQuantity('1');
  };

  const searchResults = useMemo(() => {
    if (!productSearch) return [];
    const term = productSearch.toLowerCase();
    return products.filter(p => 
        p.name.toLowerCase().includes(term) || 
        (!isPharmaMode && p.barcode && p.barcode.includes(term))
    ).slice(0, 10);
  }, [productSearch, products, isPharmaMode]);

  const handleScanSuccess = (decodedText: string) => {
      setIsScanning(false);
      // Direct add if exact match on barcode
      const product = products.find(p => p.barcode === decodedText);
      if (product) {
          if (isPharmaMode) {
              // In pharma, we still need to select a batch, so just select product
              handleSelectProduct(product);
          } else {
              // In retail, add directly (default batch logic)
              setSelectedProduct(product);
              // Simulate adding
              // We need a way to add directly without UI state if possible, but using state for consistency
              // For now, just selecting it is safer to allow qty check
              handleSelectProduct(product);
          }
      } else {
          alert("Product not found with barcode: " + decodedText);
      }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setShowProductSuggestions(false);
    
    // Auto-select batch logic (First available)
    const availableBatches = product.batches.filter(b => b.stock > 0);
    if (availableBatches.length > 0) {
        setSelectedBatchId(availableBatches[0].id);
    } else if (product.batches.length > 0) {
        setSelectedBatchId(product.batches[0].id);
    }
    setQuantity('1');
  };

  const handleAddToCart = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProduct) return;
    if (isPharmaMode && !selectedBatchId) {
        alert("Please select a batch.");
        return;
    }

    const batch = selectedProduct.batches.find(b => b.id === selectedBatchId);
    if (!batch && isPharmaMode) {
         alert("Batch not found");
         return;
    }
    // Fallback for retail if no batch explicitly selected but only 1 exists (created on import)
    const effectiveBatch = batch || (selectedProduct.batches.length > 0 ? selectedProduct.batches[0] : null);
    
    if (!effectiveBatch) {
        alert("No stock batch available for this product.");
        return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
        alert("Invalid quantity");
        return;
    }

    // Check stock
    if (effectiveBatch.stock < qty) {
        alert(`Insufficient stock. Available: ${effectiveBatch.stock}`);
        return;
    }

    const existingItemIndex = cart.findIndex(item => item.batchId === effectiveBatch.id);
    if (existingItemIndex > -1) {
        const newCart = [...cart];
        const newQty = newCart[existingItemIndex].quantity + qty;
        if (effectiveBatch.stock < newQty) {
             alert(`Insufficient stock for total quantity. Available: ${effectiveBatch.stock}`);
             return;
        }
        newCart[existingItemIndex].quantity = newQty;
        newCart[existingItemIndex].total = newCart[existingItemIndex].quantity * (effectiveBatch.mrp / (selectedProduct.unitsPerStrip || 1));
        setCart(newCart);
    } else {
        const unitPrice = effectiveBatch.mrp / (selectedProduct.unitsPerStrip || 1);
        const newItem: CartItem = {
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            composition: selectedProduct.composition,
            batchId: effectiveBatch.id,
            batchNumber: effectiveBatch.batchNumber,
            expiryDate: effectiveBatch.expiryDate,
            hsnCode: selectedProduct.hsnCode,
            unitsPerStrip: selectedProduct.unitsPerStrip,
            isScheduleH: selectedProduct.isScheduleH,
            stripQty: 0, 
            looseQty: qty, 
            quantity: qty,
            mrp: effectiveBatch.mrp,
            gst: selectedProduct.gst,
            total: unitPrice * qty,
        };
        setCart([...cart, newItem]);
    }

    // Reset
    setProductSearch('');
    setSelectedProduct(null);
    setSelectedBatchId('');
    setQuantity('1');
    if(searchInputRef.current) searchInputRef.current.focus();
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const { subTotal, totalGst, grandTotal } = useMemo(() => {
      let sub = 0;
      let gst = 0;
      cart.forEach(item => {
          const taxable = item.total / (1 + item.gst / 100);
          sub += taxable;
          gst += item.total - taxable;
      });
      return { subTotal: sub, totalGst: gst, grandTotal: sub + gst };
  }, [cart]);

  const handleSaveBill = async () => {
      if (!customerName || cart.length === 0) {
          alert("Customer name and at least one item are required.");
          return;
      }

      const billData = {
          date: new Date().toISOString(),
          customerName,
          doctorName: isPharmaMode ? doctorName : undefined,
          items: cart,
          subTotal,
          totalGst,
          grandTotal
      };

      let savedBill: Bill | null = null;
      if (editingBill && onUpdateBill) {
           savedBill = await onUpdateBill(editingBill.id, billData, editingBill);
           if (savedBill && onCancelEdit) onCancelEdit();
      } else {
           savedBill = await onGenerateBill(billData);
           if (savedBill) resetForm();
      }

      if (savedBill) {
          setLastBill(savedBill);
          setPrinterModalOpen(true);
      }
  };

  // Bluetooth Printing Logic (Fixes error 'printerAPI not found')
  const printThermalBluetooth = async (bill: Bill, profile: CompanyProfile) => {
      const printerAPI = window.BluetoothEscposPrinter;
      if (!printerAPI) {
          alert("Bluetooth Printer plugin not detected.");
          return;
      }

      const printCentered = async (text: string) => {
          await printerAPI.printText(text, 1); // 1 = Center alignment
      };

      try {
          await printerAPI.printerInit();
          await printerAPI.printText(profile.name + "\n", 2); // Centered Title
          await printCentered(profile.address + "\n");
          await printCentered(`GSTIN: ${profile.gstin}\n`);
          await printerAPI.printText("--------------------------------\n", 0);
          
          await printerAPI.printText(`Bill: ${bill.billNumber}  Dt: ${new Date(bill.date).toLocaleDateString()}\n`, 0);
          await printerAPI.printText(`Cust: ${bill.customerName}\n`, 0);
          await printerAPI.printText("--------------------------------\n", 0);

          // Items
          bill.items.forEach((item, i) => {
               const line = `${i+1}. ${item.productName} x ${item.quantity}`;
               const price = `${item.total.toFixed(2)}`;
               const spaces = 32 - line.length - price.length;
               printerAPI.printText(line + (spaces > 0 ? ' '.repeat(spaces) : ' ') + price + "\n", 0);
          });
          await printerAPI.printText("--------------------------------\n", 0);
          
          await printerAPI.printText(`Total: Rs.${bill.grandTotal.toFixed(2)}\n`, 2); // 2 = Right? Or use spaces. Assuming native alignment.
          
          if (profile.upiId && bill.grandTotal > 0) {
             try {
                 const upiUrl = `upi://pay?pa=${profile.upiId}&pn=${encodeURIComponent(profile.name)}&am=${bill.grandTotal.toFixed(2)}&cu=INR`;
                 await printerAPI.printQRCode(upiUrl, 200, 1); 
             } catch(e) { console.error("QR Print Error", e); }
             await printerAPI.printText("\n", {});
          }

          await printCentered("Thank you!\n\n\n\n");

      } catch (e) {
          console.error("Bluetooth Print Error", e);
          alert("Print failed: " + e);
      }
  };

  const handlePrintSelection = (printer: PrinterProfile) => {
      if (!lastBill) return;
      
      // Bluetooth Thermal
      if (printer.connectionType === 'bluetooth' && printer.format === 'Thermal' && window.BluetoothEscposPrinter) {
          printThermalBluetooth(lastBill, companyProfile);
          return;
      }

      // Browser Print
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      
      printWindow.document.title = 'Print Bill';
      const style = printWindow.document.createElement('style');
      style.innerHTML = `@page { size: auto; margin: 0; } body { margin: 0; }`;
      printWindow.document.head.appendChild(style);

      const rootDiv = document.createElement('div');
      printWindow.document.body.appendChild(rootDiv);
      const root = ReactDOM.createRoot(rootDiv);

      if (printer.format === 'Thermal') {
          root.render(<ThermalPrintableBill bill={lastBill} companyProfile={companyProfile} systemConfig={systemConfig} />);
      } else if (printer.format === 'A5') {
          root.render(<PrintableA5Bill bill={lastBill} companyProfile={companyProfile} systemConfig={systemConfig} />);
      } else {
          root.render(<PrintableBill bill={lastBill} companyProfile={companyProfile} />);
      }

      setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
      }, 500);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
        <Card title={editingBill ? `Edit Bill: ${editingBill.billNumber}` : "New Bill"}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Customer Name*</label>
                    <input 
                        value={customerName} 
                        onChange={e => setCustomerName(e.target.value)} 
                        className={formInputStyle} 
                        placeholder="Enter customer name"
                    />
                </div>
                {isPharmaMode && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Doctor Name</label>
                        <input 
                            value={doctorName} 
                            onChange={e => setDoctorName(e.target.value)} 
                            className={formInputStyle} 
                            placeholder="Enter doctor name"
                        />
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                    <input 
                        value={new Date().toLocaleDateString()} 
                        disabled 
                        className={`${formInputStyle} bg-slate-200 dark:bg-slate-700`} 
                    />
                </div>
            </div>

            {/* Product Search & Add */}
            <form onSubmit={handleAddToCart} className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border dark:border-slate-600 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-5 relative">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Product</label>
                        <div className="flex gap-2">
                            <input 
                                ref={searchInputRef}
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                className={formInputStyle}
                                placeholder="Search product or scan barcode..."
                                autoComplete="off"
                            />
                             <button
                                type="button"
                                onClick={() => setIsScanning(true)}
                                className="p-2 bg-slate-200 dark:bg-slate-600 rounded hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-300 flex-shrink-0"
                            >
                                <CameraIcon className="h-5 w-5" />
                            </button>
                        </div>
                        {/* Suggestions */}
                        {showProductSuggestions && searchResults.length > 0 && (
                            <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {searchResults.map((p, i) => (
                                    <li 
                                        key={p.id}
                                        onClick={() => handleSelectProduct(p)}
                                        className="px-4 py-2 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900 text-slate-800 dark:text-slate-200 flex justify-between"
                                    >
                                        <span>{p.name}</span>
                                        <span className="text-sm text-slate-500">{p.company}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Batch Selector (Pharma Only) */}
                    {isPharmaMode && (
                         <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Batch</label>
                            <select 
                                value={selectedBatchId} 
                                onChange={e => setSelectedBatchId(e.target.value)}
                                className={formInputStyle}
                                disabled={!selectedProduct}
                            >
                                <option value="">Select Batch</option>
                                {selectedProduct?.batches.map(b => (
                                    <option key={b.id} value={b.id} disabled={b.stock <= 0}>
                                        {b.batchNumber} (Exp: {b.expiryDate}) - Stock: {b.stock}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Qty</label>
                        <input 
                            type="number" 
                            value={quantity}
                            onChange={e => setQuantity(e.target.value)}
                            min="1"
                            className={formInputStyle}
                        />
                    </div>

                    <div className="md:col-span-2">
                         <button type="submit" className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                             <PlusIcon className="h-5 w-5" /> Add
                         </button>
                    </div>
                </div>
            </form>

            {/* Cart Table */}
            <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-100 dark:bg-slate-700">
                        <tr>
                            <th className="px-4 py-3">Product</th>
                            {isPharmaMode && <th className="px-4 py-3">Batch</th>}
                            {isPharmaMode && <th className="px-4 py-3">Exp</th>}
                            <th className="px-4 py-3 text-center">Qty</th>
                            <th className="px-4 py-3 text-right">Price</th>
                            <th className="px-4 py-3 text-right">Total</th>
                            <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cart.map((item, index) => (
                            <tr key={index} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                                <td className="px-4 py-3 font-medium">{item.productName}</td>
                                {isPharmaMode && <td className="px-4 py-3">{item.batchNumber}</td>}
                                {isPharmaMode && <td className="px-4 py-3">{item.expiryDate}</td>}
                                <td className="px-4 py-3 text-center">{item.quantity}</td>
                                <td className="px-4 py-3 text-right">₹{(item.mrp / (item.unitsPerStrip || 1)).toFixed(2)}</td>
                                <td className="px-4 py-3 text-right font-semibold">₹{item.total.toFixed(2)}</td>
                                <td className="px-4 py-3 text-center">
                                    <button onClick={() => handleRemoveFromCart(index)} className="text-red-500 hover:text-red-700">
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {cart.length === 0 && (
                            <tr>
                                <td colSpan={isPharmaMode ? 7 : 5} className="text-center py-6 text-slate-500">Cart is empty</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Totals & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start border-t dark:border-slate-700 pt-4">
                <div className="w-full md:w-1/2 mb-4 md:mb-0">
                    <div className="grid grid-cols-2 gap-4 text-sm max-w-xs">
                         <span className="text-slate-600 dark:text-slate-400">Subtotal:</span>
                         <span className="text-right font-medium text-slate-800 dark:text-slate-200">₹{subTotal.toFixed(2)}</span>
                         <span className="text-slate-600 dark:text-slate-400">GST:</span>
                         <span className="text-right font-medium text-slate-800 dark:text-slate-200">₹{totalGst.toFixed(2)}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t dark:border-slate-700 grid grid-cols-2 gap-4 max-w-xs">
                         <span className="text-lg font-bold text-slate-800 dark:text-slate-100">Grand Total:</span>
                         <span className="text-lg font-bold text-right text-indigo-600 dark:text-indigo-400">₹{grandTotal.toFixed(2)}</span>
                    </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                     {editingBill && (
                         <button onClick={onCancelEdit} className="flex-1 md:flex-none px-6 py-3 bg-slate-500 text-white rounded-lg shadow hover:bg-slate-600 transition-colors">
                             Cancel
                         </button>
                     )}
                     <button onClick={handleSaveBill} className="flex-1 md:flex-none px-8 py-3 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 transition-colors font-semibold text-lg flex items-center justify-center gap-2">
                         <PrinterIcon className="h-6 w-6" />
                         {editingBill ? 'Update & Print' : 'Save & Print'}
                     </button>
                </div>
            </div>
        </Card>

        <PrinterSelectionModal 
            isOpen={isPrinterModalOpen}
            onClose={() => setPrinterModalOpen(false)}
            systemConfig={systemConfig}
            onUpdateConfig={() => {}} // Config updates managed in settings usually, or lift state
            onSelectPrinter={handlePrintSelection}
        />
        
        <BarcodeScannerModal 
            isOpen={isScanning}
            onClose={() => setIsScanning(false)}
            onScanSuccess={handleScanSuccess}
        />
    </div>
  );
};

export default Billing;

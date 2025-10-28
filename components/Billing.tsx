import React, { useState, useMemo, useCallback } from 'react';
import type { Product, Batch, CartItem, Bill, CompanyProfile } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { TrashIcon } from './icons/Icons';
import PrintableBill from './PrintableBill';

interface BillingProps {
  products: Product[];
  companyProfile: CompanyProfile;
  onGenerateBill: (bill: Omit<Bill, 'id' | 'billNumber'>) => Bill;
}

const inputStyle = "bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

// --- Helper Component for Printing (Moved outside Billing component) ---
const BillPrintModal: React.FC<{ isOpen: boolean; onClose: () => void; bill: Bill; companyProfile: CompanyProfile; }> = ({ isOpen, onClose, bill, companyProfile }) => {
    const handlePrint = () => {
        window.print();
    };

    return (
         <Modal isOpen={isOpen} onClose={onClose} title="Bill Generated">
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #printable-area, #printable-area * {
                        visibility: visible;
                    }
                    #printable-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .print-preview-container {
                        max-height: none !important;
                        overflow: visible !important;
                        border: none !important;
                        padding: 0 !important;
                        background-color: white !important;
                    }
                    .modal-actions {
                        display: none;
                    }
                    @page {
                        size: A5;
                        margin: 10mm;
                    }
                }
            `}</style>

            <div id="printable-area">
                <div className="print-preview-container p-4 border rounded-lg bg-slate-50 dark:bg-slate-700 max-h-96 overflow-y-auto">
                    <PrintableBill bill={bill} companyProfile={companyProfile} />
                </div>
            </div>

            <div className="modal-actions flex justify-end gap-4 mt-6">
                 <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">
                    Close
                </button>
                <button onClick={handlePrint} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold">
                    Print Bill
                </button>
            </div>
        </Modal>
    );
};


const Billing: React.FC<BillingProps> = ({ products, onGenerateBill, companyProfile }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [lastBill, setLastBill] = useState<Bill | null>(null);


  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    return products
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && p.batches.some(b => b.stock > 0))
      .slice(0, 5);
  }, [searchTerm, products]);
  
  const handleAddToCart = (product: Product, batch: Batch) => {
    const existingItem = cart.find(item => item.productId === product.id && item.batchId === batch.id);
    if (existingItem) {
      if (existingItem.quantity < batch.stock) {
        updateCartItem(existingItem.batchId, existingItem.quantity + 1);
      }
    } else {
      const newItem: CartItem = {
        productId: product.id,
        productName: product.name,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        hsnCode: product.hsnCode,
        quantity: 1,
        mrp: batch.mrp,
        gst: product.gst,
        total: batch.mrp,
      };
      setCart([...cart, newItem]);
    }
    setSearchTerm('');
  };

  const updateCartItem = (batchId: string, quantity: number) => {
    setCart(cart.map(item => {
      if (item.batchId === batchId) {
        const product = products.find(p => p.id === item.productId);
        const batch = product?.batches.find(b => b.id === batchId);
        if (batch && quantity > 0 && quantity <= batch.stock) {
          return { ...item, quantity, total: item.mrp * quantity };
        }
      }
      return item;
    }));
  };

  const removeFromCart = (batchId: string) => {
    setCart(cart.filter(item => item.batchId !== batchId));
  };
  
  const { subTotal, totalGst, grandTotal } = useMemo(() => {
    let subTotal = 0;
    let totalGst = 0;
    cart.forEach(item => {
      const basePrice = item.total / (1 + item.gst / 100);
      subTotal += basePrice;
      totalGst += item.total - basePrice;
    });
    const grandTotal = subTotal + totalGst;
    return { subTotal, totalGst, grandTotal };
  }, [cart]);

  const handleFinalizeBill = useCallback(() => {
    if (cart.length === 0) {
        alert("Cart is empty!");
        return;
    }
    const newBill = onGenerateBill({
        date: new Date().toISOString(),
        customerName: customerName || 'Walk-in',
        items: cart,
        subTotal,
        totalGst,
        grandTotal
    });

    setLastBill(newBill); // Show print modal
    setCart([]);
    setCustomerName('');
  }, [cart, customerName, subTotal, totalGst, grandTotal, onGenerateBill]);


  return (
    <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card title="Create Bill">
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search for products to add..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`${inputStyle} w-full px-4 py-3 text-lg`}
            />
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg">
                <ul>
                  {searchResults.map(product => (
                    <li key={product.id} className="border-b dark:border-slate-600 last:border-b-0">
                      <div className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">{product.name}</div>
                      <ul className="pl-4">
                        {product.batches.filter(b => b.stock > 0).map(batch => (
                           <li key={batch.id} 
                               className="px-4 py-2 flex justify-between items-center hover:bg-indigo-50 dark:hover:bg-slate-600 cursor-pointer"
                               onClick={() => handleAddToCart(product, batch)}>
                                <div>
                                    <span className="text-slate-800 dark:text-slate-200">Batch: <span className="font-medium">{batch.batchNumber}</span></span>
                                    <span className="text-sm text-slate-600 dark:text-slate-400 ml-3">Exp: {batch.expiryDate}</span>
                                </div>
                                <div>
                                    <span className="text-slate-800 dark:text-slate-200">MRP: <span className="font-medium">₹{batch.mrp.toFixed(2)}</span></span>
                                    <span className="text-sm text-green-600 dark:text-green-400 font-semibold ml-3">Stock: {batch.stock}</span>
                                </div>
                           </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mt-6">
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">Cart Items</h3>
             <div className="overflow-x-auto max-h-[calc(100vh-380px)]">
                {cart.length > 0 ? (
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700 sticky top-0">
                    <tr>
                        <th scope="col" className="px-4 py-3">Product</th>
                        <th scope="col" className="px-4 py-3">Batch</th>
                        <th scope="col" className="px-4 py-3">Qty</th>
                        <th scope="col" className="px-4 py-3">MRP</th>
                        <th scope="col" className="px-4 py-3">Total</th>
                        <th scope="col" className="px-4 py-3">Action</th>
                    </tr>
                    </thead>
                    <tbody>
                    {cart.map(item => (
                        <tr key={item.batchId} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{item.productName}</td>
                        <td className="px-4 py-3">{item.batchNumber}</td>
                        <td className="px-4 py-3">
                            <input 
                                type="number" 
                                value={item.quantity}
                                onChange={e => updateCartItem(item.batchId, parseInt(e.target.value))}
                                className={`w-20 p-1 text-center ${inputStyle}`}
                                min="1"
                                max={products.find(p => p.id === item.productId)?.batches.find(b => b.id === item.batchId)?.stock}
                            />
                        </td>
                        <td className="px-4 py-3">₹{item.mrp.toFixed(2)}</td>
                        <td className="px-4 py-3 font-semibold">₹{item.total.toFixed(2)}</td>
                        <td className="px-4 py-3">
                            <button onClick={() => removeFromCart(item.batchId)} className="text-red-500 hover:text-red-700">
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                ) : (
                    <div className="text-center py-10 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <p>Your cart is empty.</p>
                        <p className="text-sm">Search for products to add them to the bill.</p>
                    </div>
                )}
             </div>
          </div>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <Card title="Bill Summary" className="sticky top-20">
            <div className="space-y-4">
                <div>
                    <label htmlFor="customerName" className="block text-sm font-medium text-slate-800 dark:text-slate-200">Customer Name</label>
                    <input
                        type="text"
                        id="customerName"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder="Walk-in Customer"
                        className={`mt-1 block w-full px-3 py-2 ${inputStyle}`}
                    />
                </div>
                <div className="border-t dark:border-slate-700 pt-4 space-y-2 text-slate-700 dark:text-slate-300">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>₹{subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Total GST</span>
                        <span>₹{totalGst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-2xl font-bold text-slate-800 dark:text-slate-100 pt-2 border-t dark:border-slate-600 mt-2">
                        <span>Grand Total</span>
                        <span>₹{grandTotal.toFixed(2)}</span>
                    </div>
                </div>
                <button 
                    onClick={handleFinalizeBill}
                    disabled={cart.length === 0}
                    className="w-full bg-green-600 text-white py-3 rounded-lg text-lg font-semibold shadow-md hover:bg-green-700 transition-colors duration-200 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed"
                >
                    Generate Bill
                </button>
            </div>
        </Card>
      </div>
      {lastBill && (
        <BillPrintModal 
            isOpen={!!lastBill}
            onClose={() => setLastBill(null)}
            bill={lastBill}
            companyProfile={companyProfile}
        />
      )}
    </div>
  );
};

export default Billing;

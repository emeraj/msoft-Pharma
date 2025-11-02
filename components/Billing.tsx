import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import type { Product, Batch, CartItem, Bill, CompanyProfile } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { TrashIcon, SwitchHorizontalIcon } from './icons/Icons';
import PrintableA5Bill from './PrintableA5Bill';

interface BillingProps {
  products: Product[];
  companyProfile: CompanyProfile;
  onGenerateBill: (bill: Omit<Bill, 'id' | 'billNumber'>) => Promise<Bill | null>;
}

const inputStyle = "bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

// --- Helper Functions ---
const getExpiryDate = (expiryString: string): Date => {
    if (!expiryString) return new Date('9999-12-31');
    const [year, month] = expiryString.split('-').map(Number);
    return new Date(year, month, 0); // Last day of the expiry month
};


const SubstituteModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    sourceProduct: Product | null;
    substitutes: Product[];
    onAddToCart: (product: Product, batch: Batch) => void;
}> = ({ isOpen, onClose, sourceProduct, substitutes, onAddToCart }) => {
    if (!sourceProduct) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Substitutes for ${sourceProduct.name}`}>
            <div className="space-y-4">
                <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Original Product</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{sourceProduct.name} by {sourceProduct.company}</p>
                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{sourceProduct.composition}</p>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-3">
                    {substitutes.length > 0 ? (
                        substitutes.map(product => (
                            <div key={product.id} className="p-3 border dark:border-slate-600 rounded-lg">
                                <p className="font-semibold text-slate-800 dark:text-slate-200">{product.name}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">{product.company}</p>
                                <ul className="mt-2 space-y-1">
                                    {product.batches.filter(b => b.stock > 0).map(batch => (
                                        <li key={batch.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                                            <div>
                                                <span>Batch: <span className="font-medium">{batch.batchNumber}</span></span>
                                                <span className="ml-3">Exp: {batch.expiryDate}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span>MRP: <span className="font-medium">₹{batch.mrp.toFixed(2)}</span></span>
                                                <span className="text-green-600 dark:text-green-400">Stock: {batch.stock}</span>
                                                <button onClick={() => { onAddToCart(product, batch); onClose(); }} className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700">
                                                    Add
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-slate-600 dark:text-slate-400 py-6">No substitutes with the same composition found in stock.</p>
                    )}
                </div>
            </div>
        </Modal>
    );
};


const Billing: React.FC<BillingProps> = ({ products, onGenerateBill, companyProfile }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [isSubstituteModalOpen, setSubstituteModalOpen] = useState(false);
  const [substituteOptions, setSubstituteOptions] = useState<Product[]>([]);
  const [sourceProductForSub, setSourceProductForSub] = useState<Product | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    return products
      .filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        p.batches.some(b => b.stock > 0 && getExpiryDate(b.expiryDate) >= today)
      )
      .slice(0, 5);
  }, [searchTerm, products, today]);
  
  const handleAddToCart = (product: Product, batch: Batch) => {
    const expiry = getExpiryDate(batch.expiryDate);
    if (expiry < today) {
      alert(`Cannot add expired batch.\nProduct: ${product.name}\nBatch: ${batch.batchNumber}\nExpired on: ${expiry.toLocaleDateString()}`);
      return;
    }

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

  const handleFindSubstitutes = (product: Product) => {
    if (!product.composition || product.composition.trim() === '') {
        alert('Composition details not available for this product. Please update it in the inventory.');
        return;
    }
    const compositionToFind = product.composition.trim().toLowerCase();
    const foundSubstitutes = products.filter(p =>
        p.id !== product.id &&
        p.composition?.trim().toLowerCase() === compositionToFind &&
        p.batches.some(b => b.stock > 0)
    );

    setSourceProductForSub(product);
    setSubstituteOptions(foundSubstitutes);
    setSubstituteModalOpen(true);
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

  const handleExportPdf = () => {
    if (cart.length === 0) return;

    const tempBillForPrint: Bill = {
        id: `print_${Date.now()}`,
        billNumber: 'PREVIEW',
        date: new Date().toISOString(),
        customerName: customerName || 'Walk-in Customer',
        items: cart,
        subTotal,
        totalGst,
        grandTotal,
    };

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        const rootEl = document.createElement('div');
        printWindow.document.body.appendChild(rootEl);
        const root = ReactDOM.createRoot(rootEl);
        
        root.render(<PrintableA5Bill bill={tempBillForPrint} companyProfile={companyProfile} />);
        
        setTimeout(() => {
            printWindow.document.title = `Invoice - ${tempBillForPrint.customerName}`;
            printWindow.print();
            printWindow.close();
        }, 500);
    }
  };

  const handleFinalizeBill = async () => {
    if (cart.length === 0) {
      alert("Cart is empty!");
      return;
    }
    const newBill = await onGenerateBill({
      date: new Date().toISOString(),
      customerName: customerName || 'Walk-in',
      items: cart,
      subTotal,
      totalGst,
      grandTotal
    });

    if (newBill) {
      alert(`Bill ${newBill.billNumber} has been saved successfully!`);
      setCart([]);
      setCustomerName('');
    } else {
      console.error("onGenerateBill did not return a valid bill object.");
      alert("There was an error generating the bill. Please try again.");
    }
  };


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
                      <div className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200 flex justify-between items-center">
                        <span>{product.name}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleFindSubstitutes(product); }}
                            className="flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 px-2 py-1 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                            title="Find substitute medicines"
                        >
                            <SwitchHorizontalIcon className="h-4 w-4" />
                            Substitutes
                        </button>
                      </div>
                      <ul className="pl-4">
                        {product.batches
                          .filter(b => b.stock > 0)
                          .sort((a, b) => getExpiryDate(a.expiryDate).getTime() - getExpiryDate(b.expiryDate).getTime())
                          .map(batch => {
                            const expiry = getExpiryDate(batch.expiryDate);
                            const isExpired = expiry < today;
                            
                            return (
                               <li key={batch.id} 
                                   className={`px-4 py-2 flex justify-between items-center transition-colors ${
                                       isExpired 
                                           ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 cursor-not-allowed' 
                                           : 'hover:bg-indigo-50 dark:hover:bg-slate-600 cursor-pointer'
                                   }`}
                                   onClick={() => handleAddToCart(product, batch)}
                                   title={isExpired ? `This batch expired on ${expiry.toLocaleDateString()}` : ''}>
                                    <div>
                                        <span className={isExpired ? '' : 'text-slate-800 dark:text-slate-200'}>Batch: <span className="font-medium">{batch.batchNumber}</span></span>
                                        <span className={`text-sm ml-3 ${isExpired ? '' : 'text-slate-600 dark:text-slate-400'}`}>Exp: {batch.expiryDate}</span>
                                        {isExpired && <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-red-600 dark:bg-red-700 rounded-full">Expired</span>}
                                    </div>
                                    <div>
                                        <span className={isExpired ? '' : 'text-slate-800 dark:text-slate-200'}>MRP: <span className="font-medium">₹{batch.mrp.toFixed(2)}</span></span>
                                        <span className="text-sm text-green-600 dark:text-green-400 font-semibold ml-3">Stock: {batch.stock}</span>
                                    </div>
                               </li>
                            );
                        })}
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
                <div className="pt-2 space-y-2">
                    <button 
                        onClick={handleFinalizeBill}
                        disabled={cart.length === 0}
                        className="w-full bg-green-600 text-white py-3 rounded-lg text-lg font-semibold shadow-md hover:bg-green-700 transition-colors duration-200 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                        Generate Bill
                    </button>
                    <button 
                        onClick={handleExportPdf}
                        disabled={cart.length === 0}
                        className="w-full bg-indigo-600 text-white py-2 rounded-lg text-md font-semibold shadow-md hover:bg-indigo-700 transition-colors duration-200 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                        Export to PDF
                    </button>
                </div>
            </div>
        </Card>
      </div>
      <SubstituteModal 
        isOpen={isSubstituteModalOpen}
        onClose={() => setSubstituteModalOpen(false)}
        sourceProduct={sourceProductForSub}
        substitutes={substituteOptions}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
};

export default Billing;
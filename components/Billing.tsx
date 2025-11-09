import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import type { Product, Batch, CartItem, Bill, CompanyProfile } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { TrashIcon, SwitchHorizontalIcon, PencilIcon } from './icons/Icons';
import ThermalPrintableBill from './ThermalPrintableBill';

interface BillingProps {
  products: Product[];
  companyProfile: CompanyProfile;
  onGenerateBill: (bill: Omit<Bill, 'id' | 'billNumber'>) => Promise<Bill | null>;
  editingBill?: Bill | null;
  onUpdateBill?: (billId: string, billData: Omit<Bill, 'id'>, originalBill: Bill) => Promise<Bill | null>;
  onCancelEdit?: () => void;
}

const inputStyle = "bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

// --- Helper Functions ---
const getExpiryDate = (expiryString: string): Date => {
    if (!expiryString) return new Date('9999-12-31');
    const [year, month] = expiryString.split('-').map(Number);
    return new Date(year, month, 0); // Last day of the expiry month
};

const formatStock = (stock: number, unitsPerStrip?: number): string => {
    if (stock === 0) return '0 U';
    if (!unitsPerStrip || unitsPerStrip <= 1) {
        return `${stock} U`;
    }
    const strips = Math.floor(stock / unitsPerStrip);
    const looseUnits = stock % unitsPerStrip;
    let result = '';
    if (strips > 0) {
        result += `${strips} S`;
    }
    if (looseUnits > 0) {
        result += `${strips > 0 ? ' + ' : ''}${looseUnits} U`;
    }
    return result || '0 U';
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


const Billing: React.FC<BillingProps> = ({ products, onGenerateBill, companyProfile, editingBill, onUpdateBill, onCancelEdit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [isSubstituteModalOpen, setSubstituteModalOpen] = useState(false);
  const [substituteOptions, setSubstituteOptions] = useState<Product[]>([]);
  const [sourceProductForSub, setSourceProductForSub] = useState<Product | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastAddedBatchIdRef = useRef<string | null>(null);
  const cartItemStripInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const cartItemTabInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

  const isEditing = !!editingBill;

  // --- Keyboard Navigation State ---
  const [activeIndices, setActiveIndices] = useState<{ product: number; batch: number }>({ product: -1, batch: -1 });
  const activeItemRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (lastAddedBatchIdRef.current) {
        // Find the newly added item to decide which input to focus
        const newItem = cart.find(item => item.batchId === lastAddedBatchIdRef.current);
        let inputToFocus: HTMLInputElement | null | undefined = null;

        if (newItem && newItem.unitsPerStrip && newItem.unitsPerStrip > 1) {
            // If it's a strip-based product, focus the strip input first
            inputToFocus = cartItemStripInputRefs.current.get(lastAddedBatchIdRef.current);
        } else {
            // Otherwise, focus the main quantity (tab) input
            inputToFocus = cartItemTabInputRefs.current.get(lastAddedBatchIdRef.current);
        }
        
        if (inputToFocus) {
            inputToFocus.focus();
            inputToFocus.select();
        }
        lastAddedBatchIdRef.current = null; // Reset after focus
    }
  }, [cart]);

  useEffect(() => {
    if (editingBill) {
      setCart(editingBill.items);
      setCustomerName(editingBill.customerName);
    } else {
      setCart([]);
      setCustomerName('');
    }
  }, [editingBill]);

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
      .slice(0, 10);
  }, [searchTerm, products, today]);
  
  const navigableBatchesByProduct = useMemo(() => {
    return searchResults.map(p =>
        p.batches
            .filter(b => b.stock > 0 && getExpiryDate(b.expiryDate) >= today)
            .sort((a, b) => getExpiryDate(a.expiryDate).getTime() - getExpiryDate(b.expiryDate).getTime())
    );
  }, [searchResults, today]);

  // --- Keyboard Navigation Effects ---
  useEffect(() => {
    if (searchTerm && searchResults.length > 0) {
      // Find the first product with navigable batches
      const firstProductIndex = navigableBatchesByProduct.findIndex(batches => batches.length > 0);
      if (firstProductIndex !== -1) {
        setActiveIndices({ product: firstProductIndex, batch: 0 });
      } else {
        setActiveIndices({ product: -1, batch: -1 });
      }
    } else {
      setActiveIndices({ product: -1, batch: -1 });
    }
  }, [searchTerm, searchResults, navigableBatchesByProduct]);


  useEffect(() => {
    activeItemRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
    });
  }, [activeIndices]);


  const updateCartItem = (batchId: string, stripQty: number, looseQty: number) => {
    setCart(currentCart => currentCart.map(item => {
      if (item.batchId === batchId) {
        const product = products.find(p => p.id === item.productId);
        const batch = product?.batches.find(b => b.id === batchId);
        if (!product || !batch) return item;

        const unitsPerStrip = product.unitsPerStrip || 1;
        
        let sQty = Math.max(0, stripQty);
        let lQty = Math.max(0, looseQty);
        
        // Auto-correct loose quantity if it exceeds strip size and it's a strip-based product
        if (unitsPerStrip > 1 && lQty >= unitsPerStrip) {
            sQty += Math.floor(lQty / unitsPerStrip);
            lQty = lQty % unitsPerStrip;
        }

        const totalUnits = (sQty * unitsPerStrip) + lQty;

        if (totalUnits > 0 && totalUnits <= batch.stock) {
            const unitPrice = item.mrp / unitsPerStrip;
            const newTotal = totalUnits * unitPrice;
            return { ...item, stripQty: sQty, looseQty: lQty, quantity: totalUnits, total: newTotal };
        } else if (totalUnits === 0) {
            return { ...item, stripQty: 0, looseQty: 0, quantity: 0, total: 0 };
        }
      }
      return item;
    }));
  };

  const handleAddToCart = (product: Product, batch: Batch) => {
    const expiry = getExpiryDate(batch.expiryDate);
    if (expiry < today) {
      alert(`Cannot add expired batch.\nProduct: ${product.name}\nBatch: ${batch.batchNumber}\nExpired on: ${expiry.toLocaleDateString()}`);
      return;
    }

    const existingItem = cart.find(item => item.productId === product.id && item.batchId === batch.id);
    if (existingItem) {
      const newTotalUnits = existingItem.quantity + 1;
      const unitsPerStrip = product.unitsPerStrip || 1;
      const newStripQty = Math.floor(newTotalUnits / unitsPerStrip);
      const newLooseQty = newTotalUnits % unitsPerStrip;
      updateCartItem(existingItem.batchId, newStripQty, newLooseQty);
    } else {
      const unitsPerStrip = product.unitsPerStrip || 1;
      const unitPrice = batch.mrp / unitsPerStrip;
      const newItem: CartItem = {
        productId: product.id,
        productName: product.name,
        composition: product.composition,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        hsnCode: product.hsnCode,
        unitsPerStrip: product.unitsPerStrip,
        stripQty: 0,
        looseQty: 1,
        quantity: 1,
        mrp: batch.mrp,
        gst: product.gst,
        total: unitPrice,
      };
      lastAddedBatchIdRef.current = newItem.batchId;
      setCart([...cart, newItem]);
    }
    setSearchTerm('');
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

  const executePrint = (billToPrint: Bill, onPrintDialogClosed?: () => void) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        const style = printWindow.document.createElement('style');
        style.innerHTML = `
            @page { 
                size: auto;
                margin: 0mm; 
            }
            body {
                margin: 0;
            }
        `;
        printWindow.document.head.appendChild(style);
        
        const rootEl = document.createElement('div');
        printWindow.document.body.appendChild(rootEl);
        const root = ReactDOM.createRoot(rootEl);
        
        root.render(<ThermalPrintableBill bill={billToPrint} companyProfile={companyProfile} />);
        
        setTimeout(() => {
            printWindow.document.title = ' ';
            printWindow.print();
            printWindow.close();
            if (onPrintDialogClosed) {
                onPrintDialogClosed();
            }
        }, 500);
    } else {
        alert("Please enable popups to print the bill.");
        if (onPrintDialogClosed) {
            onPrintDialogClosed();
        }
    }
  };

  const handleSaveBill = async () => {
    if (cart.length === 0) {
      alert("Cart is empty!");
      return;
    }
    
    if (isEditing && editingBill && onUpdateBill) {
        const billData = {
            date: editingBill.date, // Keep original date on edit
            customerName: customerName || 'Walk-in',
            items: cart,
            subTotal,
            totalGst,
            grandTotal,
            billNumber: editingBill.billNumber // Keep original bill number
        };
        const updatedBill = await onUpdateBill(editingBill.id, billData, editingBill);
        if (updatedBill) {
            executePrint(updatedBill, onCancelEdit);
        }
    } else if (!isEditing && onGenerateBill) {
        const billData = {
            date: new Date().toISOString(),
            customerName: customerName || 'Walk-in',
            items: cart,
            subTotal,
            totalGst,
            grandTotal
        };
        const newBill = await onGenerateBill(billData);

        if (newBill) {
          executePrint(newBill, () => {
              setCart([]);
              setCustomerName('');
          });
        } else {
          console.error("onGenerateBill did not return a valid bill object.");
          alert("There was an error generating the bill. Please try again.");
        }
    }
  };
  
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (searchResults.length === 0 || navigableBatchesByProduct.every(b => b.length === 0)) return;

        const findNext = (current: { product: number; batch: number }) => {
            let { product, batch } = current;

            if (product === -1) { // Not initialized, find first valid item
                const firstProductIndex = navigableBatchesByProduct.findIndex(batches => batches.length > 0);
                 return firstProductIndex !== -1 ? { product: firstProductIndex, batch: 0 } : current;
            }
            
            const currentProductBatches = navigableBatchesByProduct[product];
            if (batch < currentProductBatches.length - 1) {
                return { product, batch: batch + 1 };
            }

            let nextProductIndex = product + 1;
            while (nextProductIndex < navigableBatchesByProduct.length && navigableBatchesByProduct[nextProductIndex].length === 0) {
                nextProductIndex++;
            }

            if (nextProductIndex < navigableBatchesByProduct.length) {
                return { product: nextProductIndex, batch: 0 };
            }
            
            // Wrap around to the first valid item
            const firstValidIndex = navigableBatchesByProduct.findIndex(batches => batches.length > 0);
            return firstValidIndex !== -1 ? { product: firstValidIndex, batch: 0 } : current;
        };

        const findPrev = (current: { product: number; batch: number }) => {
            let { product, batch } = current;

            if (product === -1) { // Not initialized, find last valid item
                let lastProductIndex = navigableBatchesByProduct.length - 1;
                while (lastProductIndex >= 0 && navigableBatchesByProduct[lastProductIndex].length === 0) {
                    lastProductIndex--;
                }
                return lastProductIndex !== -1 ? { product: lastProductIndex, batch: navigableBatchesByProduct[lastProductIndex].length - 1 } : current;
            }

            if (batch > 0) {
                return { product, batch: batch - 1 };
            }

            let prevProductIndex = product - 1;
            while (prevProductIndex >= 0 && navigableBatchesByProduct[prevProductIndex].length === 0) {
                prevProductIndex--;
            }

            if (prevProductIndex >= 0) {
                const prevProductBatches = navigableBatchesByProduct[prevProductIndex];
                return { product: prevProductIndex, batch: prevProductBatches.length - 1 };
            }
            
             // Wrap around to the last valid item
            let lastValidIndex = navigableBatchesByProduct.length - 1;
            while (lastValidIndex >= 0 && navigableBatchesByProduct[lastValidIndex].length === 0) {
                lastValidIndex--;
            }
            return lastValidIndex !== -1 ? { product: lastValidIndex, batch: navigableBatchesByProduct[lastValidIndex].length - 1 } : current;
        };


        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndices(findNext);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndices(findPrev);
                break;
            case 'Enter':
                e.preventDefault();
                if (activeIndices.product !== -1 && activeIndices.batch !== -1) {
                    const product = searchResults[activeIndices.product];
                    const batch = navigableBatchesByProduct[activeIndices.product][activeIndices.batch];
                    if (product && batch) {
                        handleAddToCart(product, batch);
                    }
                }
                break;
            case 'Escape':
                e.preventDefault();
                setSearchTerm('');
                break;
            default:
                break;
        }
    };

    const handleStripQtyKeyDown = (e: React.KeyboardEvent, batchId: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const tabInput = cartItemTabInputRefs.current.get(batchId);
            if (tabInput) {
                tabInput.focus();
                tabInput.select();
            }
        }
    };

    const handleTabQtyKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchInputRef.current?.focus();
        }
    };

  return (
    <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card title={isEditing ? `Editing Bill: ${editingBill?.billNumber}` : 'Create Bill'}>
          <div className="relative mb-4">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search for products to add..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${inputStyle} w-full px-4 py-3 text-lg`}
            />
            {searchResults.length > 0 && searchTerm && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                <ul>
                  {searchResults.map((product, productIndex) => (
                    navigableBatchesByProduct[productIndex]?.length > 0 &&
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
                      <ul className="pl-4 pb-2">
                        {navigableBatchesByProduct[productIndex]?.map((batch, batchIndex) => {
                          const isActive = productIndex === activeIndices.product && batchIndex === activeIndices.batch;
                          const unitsPerStrip = product.unitsPerStrip || 1;
                          return (
                            <li
                              key={batch.id}
                              ref={isActive ? activeItemRef : null}
                              className={`px-4 py-2 flex justify-between items-center transition-colors rounded-md mx-2 my-1 ${
                                isActive
                                  ? 'bg-indigo-200 dark:bg-indigo-700'
                                  : 'hover:bg-indigo-50 dark:hover:bg-slate-600 cursor-pointer'
                              }`}
                              onClick={() => handleAddToCart(product, batch)}
                              onMouseEnter={() => setActiveIndices({ product: productIndex, batch: batchIndex })}
                            >
                              <div>
                                <span className="text-slate-800 dark:text-slate-200">Batch: <span className="font-medium">{batch.batchNumber}</span></span>
                                <span className="text-sm ml-3 text-slate-600 dark:text-slate-400">Exp: {batch.expiryDate}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-slate-800 dark:text-slate-200">
                                  MRP: <span className="font-medium">₹{batch.mrp.toFixed(2)}</span>
                                  {unitsPerStrip > 1 && <span className="text-xs">/S</span>}
                                  {unitsPerStrip > 1 && <span className="text-xs text-slate-500 dark:text-slate-400"> (₹{(batch.mrp / unitsPerStrip).toFixed(2)}/U)</span>}
                                </span>
                                <span className="text-sm text-green-600 dark:text-green-400 font-semibold ml-3">Stock: {formatStock(batch.stock, product.unitsPerStrip)}</span>
                              </div>
                            </li>
                          );
                        })}
                        {product.batches
                            .filter(b => b.stock > 0 && getExpiryDate(b.expiryDate) < today)
                            .map(batch => {
                                const expiry = getExpiryDate(batch.expiryDate);
                                return (
                                <li
                                    key={batch.id}
                                    className={'px-4 py-2 flex justify-between items-center transition-colors bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 cursor-not-allowed rounded-md mx-2 my-1'}
                                    title={`This batch expired on ${expiry.toLocaleDateString()}`}
                                >
                                <div>
                                    <span>Batch: <span className="font-medium">{batch.batchNumber}</span></span>
                                    <span className={`text-sm ml-3`}>Exp: {batch.expiryDate}</span>
                                    <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-red-600 dark:bg-red-700 rounded-full">Expired</span>
                                </div>
                                <div>
                                    <span>MRP: <span className="font-medium">₹{batch.mrp.toFixed(2)}</span></span>
                                    <span className="text-sm text-green-600 dark:text-green-400 font-semibold ml-3">Stock: {formatStock(batch.stock, product.unitsPerStrip)}</span>
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
                        <th scope="col" className="px-2 py-3">Product</th>
                        <th scope="col" className="px-2 py-3">Pack</th>
                        <th scope="col" className="px-2 py-3">Batch</th>
                        <th scope="col" className="px-2 py-3">Stri</th>
                        <th scope="col" className="px-2 py-3">Tab.</th>
                        <th scope="col" className="px-2 py-3">M.R.P./S</th>
                        <th scope="col" className="px-2 py-3">Amount</th>
                        <th scope="col" className="px-2 py-3">Action</th>
                    </tr>
                    </thead>
                    <tbody>
                    {cart.map(item => (
                        <tr key={item.batchId} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                            <td className="px-2 py-3 font-medium text-slate-900 dark:text-white">{item.productName}</td>
                            <td className="px-2 py-3">{item.unitsPerStrip ? `1*${item.unitsPerStrip}`: '-'}</td>
                            <td className="px-2 py-3">{item.batchNumber}</td>
                            <td className="px-2 py-3">
                                <input
                                    ref={(el) => cartItemStripInputRefs.current.set(item.batchId, el)}
                                    type="text"
                                    inputMode="numeric"
                                    value={item.stripQty}
                                    onChange={e => updateCartItem(item.batchId, parseInt(e.target.value) || 0, item.looseQty)}
                                    onKeyDown={(e) => handleStripQtyKeyDown(e, item.batchId)}
                                    className={`w-14 p-1 text-center ${inputStyle}`}
                                    disabled={!item.unitsPerStrip || item.unitsPerStrip <= 1}
                                />
                            </td>
                            <td className="px-2 py-3">
                                <input 
                                    ref={(el) => cartItemTabInputRefs.current.set(item.batchId, el)}
                                    type="text"
                                    inputMode="numeric" 
                                    value={item.looseQty}
                                    onChange={e => updateCartItem(item.batchId, item.stripQty, parseInt(e.target.value) || 0)}
                                    onKeyDown={handleTabQtyKeyDown}
                                    className={`w-14 p-1 text-center ${inputStyle}`}
                                />
                            </td>
                            <td className="px-2 py-3">₹{item.mrp.toFixed(2)}</td>
                            <td className="px-2 py-3 font-semibold">₹{item.total.toFixed(2)}</td>
                            <td className="px-2 py-3">
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
                        onClick={handleSaveBill}
                        disabled={cart.length === 0}
                        className={`w-full text-white py-3 rounded-lg text-lg font-semibold shadow-md transition-colors duration-200 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed ${isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                       {isEditing ? 'Update Bill' : 'Save And Print Bill'}
                    </button>
                    {isEditing && (
                        <button 
                            onClick={onCancelEdit}
                            className="w-full bg-slate-500 text-white py-2 rounded-lg text-md font-semibold shadow-md hover:bg-slate-600 transition-colors duration-200"
                        >
                            Cancel Edit
                        </button>
                    )}
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

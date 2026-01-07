
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import type { Product, Batch, CartItem, Bill, CompanyProfile, SystemConfig, PrinterProfile, Customer, Salesman, Purchase } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { TrashIcon, SwitchHorizontalIcon, PencilIcon, CameraIcon, PrinterIcon, CheckCircleIcon, ShareIcon, PlusIcon, UserCircleIcon, InformationCircleIcon, BarcodeIcon, XIcon, CloudIcon, SearchIcon, ReceiptIcon, CashIcon, ChartBarIcon } from './icons/Icons';
import ThermalPrintableBill from './ThermalPrintableBill';
import PrintableA5Bill from './PrintableA5Bill';
import PrintableA5LandscapeBill from './PrintableA5LandscapeBill';
import PrintableBill from './PrintableBill'; 
import PrinterSelectionModal from './PrinterSelectionModal';
import BarcodeScannerModal, { EmbeddedScanner } from './BarcodeScannerModal';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getTranslation } from '../utils/translationHelper';
import { GoogleGenAI, Type } from "@google/genai";
import { BluetoothHelper } from '../utils/BluetoothHelper';
import type { User } from 'firebase/auth';
import { extractPartNumber } from '../utils/barcodeUtils';

const normalizeCode = (str: string = "") => str.toLowerCase().replace(/[^a-z0-9]/g, '');

const UpgradeAiModal: React.FC<{ isOpen: boolean; onClose: () => void; featureName: string }> = ({ isOpen, onClose, featureName }) => {
    const upiId = "9890072651@upi";
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent("M. Soft India")}&am=5000&cu=INR`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUrl)}`;

    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Premium Feature" maxWidth="max-w-md">
            <div className="text-center p-2">
                <div className="bg-indigo-100 dark:bg-indigo-900/30 p-4 rounded-xl mb-6 flex flex-col items-center gap-2">
                    <CloudIcon className="h-10 w-10 text-indigo-600" />
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{featureName} is for Premium Users</p>
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Upgrade to Cloud-TAG Pro</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-6">Unlock AI Smart Scanning, Multi-Operator support, and Unlimited Cloud Sync.</p>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-dashed border-indigo-300 mb-6">
                    <img src={qrCodeUrl} alt="Payment QR" className="w-40 h-40 mx-auto border-4 border-white rounded-lg shadow-sm" />
                    <p className="mt-3 text-2xl font-black text-indigo-600">₹5,000 <span className="text-xs text-slate-400 font-normal">/ Year</span></p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 py-3 px-4 rounded-lg flex items-center justify-center gap-2 mb-4">
                    <CheckCircleIcon className="h-4 w-4 text-indigo-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">WhatsApp Screenshot: 9890072651</span>
                </div>
                <button onClick={onClose} className="w-full py-2 text-slate-500 hover:text-slate-700 font-bold text-sm">Maybe Later</button>
            </div>
        </Modal>
    );
};

interface BillingProps {
  products: Product[];
  bills: Bill[];
  purchases?: Purchase[];
  customers: Customer[];
  salesmen?: Salesman[];
  companyProfile: CompanyProfile;
  systemConfig: SystemConfig;
  user?: User | null; 
  onGenerateBill: (bill: Omit<Bill, 'id' | 'billNumber'>) => Promise<Bill | null>;
  editingBill?: Bill | null;
  onUpdateBill?: (billId: string, billData: Omit<Bill, 'id'>, originalBill: Bill) => Promise<Bill | null>;
  onCancelEdit?: () => void;
  onAddCustomer: (customer: Omit<Customer, 'id' | 'balance'>) => Promise<Customer | null>;
  onAddSalesman?: (salesman: Omit<Salesman, 'id'>) => Promise<Salesman | null>;
  onUpdateConfig: (config: SystemConfig) => void;
  isSubscriptionExpired?: boolean;
  cart: CartItem[];
  onAddToCart: (item: CartItem) => Promise<void>;
  onRemoveFromCart: (batchId: string) => Promise<void>;
  onUpdateCartItem: (batchId: string, updates: Partial<CartItem>) => Promise<void>;
}

const inputStyle = "bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
const cartInputStyle = "w-16 h-8 text-center bg-[#fefce8] text-slate-900 border-2 border-slate-800 rounded-lg font-black focus:ring-2 focus:ring-indigo-500 outline-none";

const Billing: React.FC<BillingProps> = ({ products, bills, purchases = [], customers, salesmen, onGenerateBill, companyProfile, systemConfig, user, editingBill, onUpdateBill, onCancelEdit, onAddCustomer, onAddSalesman, onUpdateConfig, isSubscriptionExpired, cart, onAddToCart, onRemoveFromCart, onUpdateCartItem }) => {
  const isPharmaMode = systemConfig.softwareMode === 'Pharma';
  const isEditing = !!editingBill;
  const t = getTranslation(systemConfig.language);

  const [searchTerm, setSearchTerm] = useState('');
  const [qrCodeInput, setQrCodeInput] = useState(''); 
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);
  
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Credit'>('Cash');
  const [showScanner, setShowScanner] = useState(false);
  const [isPrinterModalOpen, setPrinterModalOpen] = useState(false);
  const [activeIndices, setActiveIndices] = useState<{ product: number; batch: number }>({ product: -1, batch: -1 });
  const [showOrderSuccessModal, setShowOrderSuccessModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const getLiveBatchStock = useCallback((product: Product, batch: Batch): number => {
    const dbStock = batch.stock || 0;
    const inCart = cart.filter(i => i.batchId === batch.id).reduce((sum, i) => sum + i.quantity, 0);
    return dbStock - inCart;
  }, [cart]);

  const getExpiryDate = (expiryString: string): Date => {
      if (!expiryString) return new Date('9999-12-31');
      const [year, month] = expiryString.split('-').map(Number);
      return new Date(year, month, 0);
  };

  useEffect(() => {
    if (editingBill) {
      setCustomerName(editingBill.customerName);
      const existingCust = customers.find(c => c.id === editingBill.customerId || c.name === editingBill.customerName);
      setSelectedCustomer(existingCust || null);
      setDoctorName(editingBill.doctorName || '');
      setPaymentMode(editingBill.paymentMode || 'Cash');
    }
  }, [editingBill, customers]);

  const handleAddToCartLocal = async (product: Product, batch: Batch) => { 
    if (isSubscriptionExpired) { alert("Subscription Expired!"); return; }
    if (isPharmaMode) { 
        const expiry = getExpiryDate(batch.expiryDate); 
        const todayNoTime = new Date(); todayNoTime.setHours(0,0,0,0);
        if (expiry < todayNoTime) { alert(`Expired: ${product.name} (B: ${batch.batchNumber})`); return; } 
    } 
    
    const existingItem = cart.find(item => item.productId === product.id && item.batchId === batch.id); 
    const unitsPerStrip = (isPharmaMode && product.unitsPerStrip) ? product.unitsPerStrip : 1; 
    const sellingPrice = batch.saleRate || batch.mrp;
    
    if (existingItem) { 
        const newTotalUnits = existingItem.quantity + 1; 
        await onUpdateCartItem(existingItem.batchId, { 
            quantity: newTotalUnits, 
            total: newTotalUnits * (existingItem.mrp / unitsPerStrip) 
        }); 
    } else { 
        const unitPrice = sellingPrice / unitsPerStrip; 
        const newItem: CartItem = { 
            productId: product.id, 
            productName: product.name, 
            batchId: batch.id, 
            batchNumber: batch.batchNumber, 
            expiryDate: batch.expiryDate, 
            hsnCode: product.hsnCode, 
            barcode: product.barcode, 
            stripQty: 0, 
            looseQty: 1, 
            quantity: 1, 
            mrp: sellingPrice, 
            gst: product.gst, 
            total: unitPrice, 
            addedAt: Date.now()
        }; 
        await onAddToCart(newItem); 
    } 
    setSearchTerm(''); 
  };

  /**
   * ROBUST INDUSTRIAL QR CODE EXTRACTION
   * In Qr Scan data 'D/FJWG0000221228/JCF5RFQPN2JD/17681KWA940S /000005/0000017.00/AAB/1/G/000/00' 
   * this is '17681KWA940S' part no (4th segment, index 3)
   */
  const handleXPartScan = (rawCode: string) => {
    if (!rawCode) return;
    const xpart = extractPartNumber(rawCode);
    if (!xpart) return;

    setSearchTerm(xpart);
    const product = products.find(p => p.barcode === xpart || (p.barcode && normalizeCode(p.barcode) === normalizeCode(xpart)));
    
    if (product) {
        // Automatically pick the first batch with stock
        const batchesWithStock = product.batches.map(b => ({ ...b, liveStock: getLiveBatchStock(product, b) }));
        const bestBatch = batchesWithStock.sort((a, b) => b.liveStock - a.liveStock)[0];
        if (bestBatch) {
            handleAddToCartLocal(product, bestBatch);
            setQrCodeInput(''); 
        } else {
            alert(`Product ${product.name} found, but no stock available.`);
        }
    } else {
        setQrCodeInput(xpart);
    }
  };

  const handleBarcodeScan = (rawCode: string) => {
    if (isSubscriptionExpired) { alert("Subscription Expired!"); return; }
    const code = extractPartNumber(rawCode);
    setSearchTerm(code);
    const product = products.find(p => p.barcode === code);
    if (product) {
        const batchesWithStock = product.batches.map(b => ({ ...b, liveStock: getLiveBatchStock(product, b) }));
        const batch = batchesWithStock.sort((a, b) => b.liveStock - a.liveStock)[0];
        if (batch) handleAddToCartLocal(product, batch);
    } else alert(`Product code ${code} not found.`);
    setShowScanner(false);
  };

  const handleSaveBill = async (shouldPrint: boolean) => {
    if (cart.length === 0) { alert(t.billing.cartEmpty); return; }
    const subTotal = cart.reduce((sum, item) => sum + (item.total / (1 + item.gst / 100)), 0);
    const totalGst = cart.reduce((sum, item) => sum + (item.total - (item.total / (1 + item.gst / 100))), 0);
    const grandTotal = Math.round(subTotal + totalGst);
    
    const billData: Omit<Bill, 'id' | 'billNumber'> = {
      date: new Date().toISOString(),
      customerName: customerName.trim() || t.billing.walkInCustomer,
      customerId: selectedCustomer?.id,
      doctorName: isPharmaMode ? doctorName.trim() : undefined,
      items: cart,
      subTotal,
      totalGst,
      grandTotal,
      paymentMode,
      operatorName: auth.currentUser?.displayName || 'Counter Staff'
    };

    let savedBill = await onGenerateBill(billData);
    if (savedBill) {
      setShowOrderSuccessModal(true);
    }
  };

  const resetBilling = () => {
    setCustomerName(''); setSelectedCustomer(null); setDoctorName(''); setPaymentMode('Cash');
    setSearchTerm(''); setQrCodeInput('');
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    const term = normalizeCode(searchTerm);
    return products.filter(p => normalizeCode(p.name).includes(term) || (p.barcode && normalizeCode(p.barcode).includes(term))).slice(0, 10);
  }, [searchTerm, products]);

  const filteredCustomers = useMemo(() => {
      if (!customerName || selectedCustomer) return [];
      return customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).slice(0, 5);
  }, [customerName, selectedCustomer, customers]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (filteredProducts.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndices(prev => {
        const nextPIdx = prev.product < filteredProducts.length - 1 ? prev.product + 1 : prev.product;
        return { product: nextPIdx, batch: 0 };
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndices(prev => {
        if (prev.batch > 0) return { ...prev, batch: prev.batch - 1 };
        if (prev.product > 0) {
          const nextPIdx = prev.product - 1;
          return { product: nextPIdx, batch: filteredProducts[nextPIdx].batches.length - 1 };
        }
        return prev;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const p = filteredProducts[activeIndices.product];
      const b = p?.batches[activeIndices.batch];
      if (p && b) handleAddToCartLocal(p, b);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card title={
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
           <span className="flex items-center gap-2">
            {isEditing ? t.billing.editBill : t.billing.createBill}
           </span>
           <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={() => setShowScanner(!showScanner)} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-black transition-all ${showScanner ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700 border'}`}>
                    <BarcodeIcon className="h-4 w-4" /> {showScanner ? 'Close Scanner' : 'Scanner Cam'}
                </button>
           </div>
        </div>
      }>
        <div className="space-y-4">
          {showScanner && (
            <div className="mb-4">
                <EmbeddedScanner onScanSuccess={handleBarcodeScan} onClose={() => setShowScanner(false)} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Main Barcode / Search</label>
                <div className="relative">
                    <input ref={searchInputRef} type="text" placeholder="Name or Barcode" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setActiveIndices({ product: 0, batch: 0 }); }} onKeyDown={handleSearchKeyDown} className={`${inputStyle} w-full p-2.5 h-14 text-lg`} />
                    <SearchIcon className="absolute right-3 top-4 h-6 w-6 text-slate-400" />
                </div>
              </div>
              <div className="relative">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Qrcode Scan (Automotive/Ind.)</label>
                <div className="relative">
                    <input 
                        ref={qrInputRef} 
                        type="text" 
                        placeholder="Scan long QR string here..." 
                        value={qrCodeInput} 
                        onChange={e => {
                            const val = e.target.value;
                            setQrCodeInput(val);
                            if (val.length >= 50 && val.includes('/')) {
                                handleXPartScan(val);
                            }
                        }} 
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                handleXPartScan(qrCodeInput);
                            }
                        }}
                        className={`${inputStyle} w-full p-2.5 h-14 bg-rose-50 border-rose-200 font-mono text-sm`} 
                    />
                    <div className="absolute right-3 top-4 flex gap-1 opacity-20 pointer-events-none">
                        <div className="w-2 h-6 bg-rose-500 rounded-sm"></div>
                        <div className="w-2 h-6 bg-rose-500 rounded-sm"></div>
                        <div className="w-2 h-6 bg-rose-500 rounded-sm"></div>
                    </div>
                </div>
              </div>
          </div>

          {filteredProducts.length > 0 && (
              <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden mb-4 animate-fade-in">
                {filteredProducts.map((product, pIdx) => (
                  <div key={product.id} className={`border-b last:border-b-0 p-3 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${activeIndices.product === pIdx ? 'bg-indigo-50/50' : ''}`}>
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100">{product.name}</h4>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{product.company} | {product.barcode}</p>
                    </div>
                    <div className="flex gap-2">
                      {product.batches.map((batch, bIdx) => (
                          <button key={batch.id} onClick={() => handleAddToCartLocal(product, batch)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeIndices.product === pIdx && activeIndices.batch === bIdx ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 border border-indigo-100'}`}>
                            ₹{batch.mrp.toFixed(0)} (Stock: {batch.stock})
                          </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Customer</label>
              <div className="relative">
                <input type="text" value={customerName} onChange={e => { setCustomerName(e.target.value); setSelectedCustomer(null); setShowCustomerSuggestions(true); }} placeholder="Walk-in Customer" className={`${inputStyle} w-full p-2.5 h-12`} />
                <UserCircleIcon className="absolute right-3 top-3 h-5 w-5 text-slate-400" />
              </div>
              {showCustomerSuggestions && filteredCustomers.length > 0 && (
                <ul className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg shadow-xl">
                  {filteredCustomers.map(c => (
                    <li key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerName(c.name); setShowCustomerSuggestions(false); }} className="px-4 py-2 hover:bg-indigo-50 cursor-pointer border-b last:border-b-0">
                      <div className="font-bold">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.phone}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {isPharmaMode && (
                <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Doctor Name</label><input type="text" value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Dr. Name" className={`${inputStyle} w-full p-2.5 h-12`} /></div>
            )}
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#1e293b] text-slate-300 uppercase text-[10px] font-black tracking-widest">
                <tr>
                  <th className="px-4 py-4">PRODUCT</th>
                  <th className="px-4 py-4 text-center">QTY</th>
                  <th className="px-4 py-4 text-center">MRP</th>
                  <th className="px-4 py-4 text-right">AMOUNT</th>
                  <th className="px-4 py-4 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-[#0f172a]">
                {cart.map(item => (
                  <tr key={item.batchId} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-100">{item.productName}</div>
                      {isPharmaMode && (
                        <div className="text-[10px] text-slate-400 uppercase">B:{item.batchNumber} | E:{item.expiryDate}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                        <input 
                            type="number" 
                            value={item.quantity} 
                            onChange={e => {
                                const newQty = parseInt(e.target.value) || 0;
                                onUpdateCartItem(item.batchId, { 
                                    quantity: newQty, 
                                    total: newQty * (item.mrp / (item.unitsPerStrip || 1)) 
                                });
                            }} 
                            className={cartInputStyle} 
                        />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                        <input 
                            type="number" 
                            value={item.mrp} 
                            onChange={e => {
                                const newMrp = parseFloat(e.target.value) || 0;
                                onUpdateCartItem(item.batchId, { 
                                    mrp: newMrp, 
                                    total: item.quantity * (newMrp / (item.unitsPerStrip || 1)) 
                                });
                            }}
                            className={cartInputStyle}
                        />
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-slate-100">
                        ₹{item.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex justify-center items-center gap-3">
                        <button className="text-blue-400 hover:text-blue-300">
                            <PencilIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => onRemoveFromCart(item.batchId)} className="text-rose-500 hover:text-rose-400">
                            <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                    <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold uppercase italic">Cart is empty</td></tr>
                )}
              </tbody>
            </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"></div>
        <div className="lg:col-span-1 space-y-6">
          <Card title="Order Summary">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPaymentMode('Cash')} className={`py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${paymentMode === 'Cash' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-700 text-slate-500'}`}>CASH</button>
                <button onClick={() => setPaymentMode('Credit')} className={`py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${paymentMode === 'Credit' ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-700 text-slate-500'}`}>CREDIT</button>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
                <span className="text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter">Total Payable</span>
                <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400 mt-2">₹{cart.reduce((s, i) => s + i.total, 0).toFixed(2)}</p>
              </div>
              <button onClick={() => handleSaveBill(true)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-2xl font-black text-xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3">
                <PrinterIcon className="h-7 w-7" /> SAVE & PRINT
              </button>
            </div>
          </Card>
        </div>
      </div>

      <BarcodeScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} onScanSuccess={handleBarcodeScan} />
      <PrinterSelectionModal isOpen={isPrinterModalOpen} onClose={() => { setPrinterModalOpen(false); resetBilling(); }} systemConfig={systemConfig} onUpdateConfig={onUpdateConfig} onSelectPrinter={() => {}} />
      <Modal isOpen={showOrderSuccessModal} onClose={() => setShowOrderSuccessModal(false)} title="Invoice Saved">
          <div className="text-center py-4">
              <CheckCircleIcon className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
              <button onClick={() => { setShowOrderSuccessModal(false); resetBilling(); }} className="mt-8 w-full py-4 bg-indigo-600 text-white rounded-xl font-black">NEXT BILL</button>
          </div>
      </Modal>
      <UpgradeAiModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} featureName="AI Product Scanner" />
    </div>
  );
};

export default Billing;

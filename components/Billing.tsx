
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import type { Product, Batch, CartItem, Bill, CompanyProfile, SystemConfig, PrinterProfile, Customer, Salesman, Purchase } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { TrashIcon, SwitchHorizontalIcon, PencilIcon, CameraIcon, PrinterIcon, CheckCircleIcon, ShareIcon, PlusIcon, UserCircleIcon, InformationCircleIcon, BarcodeIcon, XIcon, CloudIcon, SearchIcon, ReceiptIcon, CashIcon, ChartBarIcon, GlobeIcon } from './icons/Icons';
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

interface SubstituteModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: Product | null;
  substitutes: Product[];
  onAdd: (product: Product, batch: Batch) => void;
  getLiveBatchStock: (product: Product, batch: Batch) => number;
  formatStock: (stock: number, unitsPerStrip?: number) => string;
}

const SubstituteModal: React.FC<SubstituteModalProps> = ({ isOpen, onClose, target, substitutes, onAdd, getLiveBatchStock, formatStock }) => {
    if (!isOpen || !target) return null;
    const flattenedSubstitutes = substitutes.flatMap(sub => sub.batches.map(batch => ({ sub, batch })));
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Alternatives for ${target.name}`} maxWidth="max-w-4xl">
            <div className="space-y-4">
                <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-xl border border-teal-100 dark:border-teal-800">
                    <p className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest mb-1">Active Composition</p>
                    <p className="font-bold text-slate-800 dark:text-white italic">{target.composition || 'Not Specified'}</p>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[#1e293b] text-slate-300 uppercase text-[10px] font-black tracking-widest">
                            <tr><th className="px-4 py-3">Product / Company</th><th className="px-4 py-3">Batch Details</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-center">Action</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                            {flattenedSubstitutes.length > 0 ? flattenedSubstitutes.map(({ sub, batch }) => {
                                const liveStock = getLiveBatchStock(sub, batch);
                                return (
                                    <tr key={`${sub.id}-${batch.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-4 py-3"><div className="font-bold text-slate-800 dark:text-slate-100 uppercase text-xs">{sub.name}</div><div className="text-[10px] text-slate-400 uppercase font-medium">{sub.company}</div></td>
                                        <td className="px-4 py-3"><div className="font-mono text-xs text-slate-600 dark:text-slate-400">B: {batch.batchNumber}</div><div className="text-[10px] text-slate-500">Exp: {batch.expiryDate}</div><div className={`text-[10px] font-black mt-0.5 ${liveStock > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>Stock: {formatStock(liveStock, sub.unitsPerStrip)}</div></td>
                                        <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white">₹{(batch.saleRate || batch.mrp).toFixed(2)}</td>
                                        <td className="px-4 py-3 text-center"><button onClick={() => { onAdd(sub, batch); onClose(); }} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-md transition-all active:scale-95">Add to Cart</button></td>
                                    </tr>
                                );
                            }) : (<tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500 italic font-medium">No alternative products found with the same composition in stock.</td></tr>)}
                        </tbody>
                    </table>
                </div>
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
const cartInputStyle = "w-full text-center p-1.5 bg-yellow-100 text-slate-900 border-2 border-slate-200 rounded font-bold focus:ring-2 focus:ring-indigo-500 outline-none";

const Billing: React.FC<BillingProps> = ({ products, bills, purchases = [], customers, salesmen, onGenerateBill, companyProfile, systemConfig, user, editingBill, onUpdateBill, onCancelEdit, onAddCustomer, onAddSalesman, onUpdateConfig, isSubscriptionExpired, cart, onAddToCart, onRemoveFromCart, onUpdateCartItem }) => {
  const isPharmaMode = systemConfig.softwareMode === 'Pharma';
  const isEditing = !!editingBill;
  const isMrpEditable = systemConfig.mrpEditable !== false; 
  const t = getTranslation(systemConfig.language);
  const isFreePlan = (systemConfig.subscription?.planType || 'Free') === 'Free';

  const [searchTerm, setSearchTerm] = useState('');
  const [qrInput, setQrInput] = useState(''); 
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [isAddCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>('');
  const [isAddSalesmanModalOpen, setAddSalesmanModalOpen] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const lastAddedBatchIdRef = useRef<string | null>(null);
  const skipCartFocusRef = useRef(false); 
  
  const cartItemStripInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const cartItemTabInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Credit'>('Cash');
  const [showScanner, setShowScanner] = useState(!isPharmaMode && systemConfig.barcodeScannerOpenByDefault !== false);
  const [isPrinterModalOpen, setPrinterModalOpen] = useState(false);
  const [billToPrint, setBillToPrint] = useState<Bill | null>(null);
  const [shouldResetAfterPrint, setShouldResetAfterPrint] = useState(false);
  
  // High Speed Navigation Index (now refers to flattened batch results)
  const [activeFlattenedIdx, setActiveFlattenedIdx] = useState(-1);
  const [activeCustomerIdx, setActiveCustomerIdx] = useState(-1);

  const [showOrderSuccessModal, setShowOrderSuccessModal] = useState(false);
  const [lastSavedBill, setLastSavedBill] = useState<Bill | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [substituteTarget, setSubstituteTarget] = useState<Product | null>(null);
  const [scanResultFeedback, setScanResultFeedback] = useState<{name: string, batch?: string} | null>(null);

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

  const formatStock = (stock: number, unitsPerStrip?: number): string => {
      const isNegative = stock < 0;
      const absStock = Math.abs(stock);
      if (absStock === 0) return '0 U';
      if (!unitsPerStrip || unitsPerStrip <= 1) return `${stock} U`;
      const strips = Math.floor(absStock / unitsPerStrip);
      const looseUnits = absStock % unitsPerStrip;
      let result = '';
      if (strips > 0) result += `${strips} S`;
      if (looseUnits > 0) result += `${strips > 0 ? ' + ' : ''}${looseUnits} U`;
      return (isNegative ? '-' : '') + (result || '0 U');
  };

  useEffect(() => {
    if (systemConfig.enableQuickPartQR) { qrInputRef.current?.focus(); } 
    else { searchInputRef.current?.focus(); }
  }, [systemConfig.enableQuickPartQR]);

  useEffect(() => {
    if (lastAddedBatchIdRef.current && !skipCartFocusRef.current) {
        const newItem = cart.find(item => item.batchId === lastAddedBatchIdRef.current);
        if (newItem) {
            let inputToFocus: HTMLInputElement | null | undefined = null;
            if (isPharmaMode && newItem.unitsPerStrip && newItem.unitsPerStrip > 1) { 
                inputToFocus = cartItemStripInputRefs.current.get(lastAddedBatchIdRef.current); 
            } else { 
                inputToFocus = cartItemTabInputRefs.current.get(lastAddedBatchIdRef.current); 
            }
            if (inputToFocus) { inputToFocus.focus(); inputToFocus.select(); }
            lastAddedBatchIdRef.current = null;
        }
    }
  }, [cart, isPharmaMode]);

  const handleAddToCartLocal = async (product: Product, batch: Batch) => { 
    if (isSubscriptionExpired) { alert("Subscription Expired!"); return; }
    if (isPharmaMode) { 
        const expiry = getExpiryDate(batch.expiryDate); 
        const todayNoTime = new Date(); todayNoTime.setHours(0,0,0,0);
        if (expiry < todayNoTime) { alert(`Expired: ${product.name} (B: ${batch.batchNumber})`); return; } 
    } 
    const liveStock = getLiveBatchStock(product, batch);
    if (liveStock <= 0) {
        if (!window.confirm(`Stock is zero or negative (${liveStock} U). Continue adding?`)) return;
    }

    const existingItem = cart.find(item => item.productId === product.id && item.batchId === batch.id); 
    const unitsPerStrip = (isPharmaMode && product.unitsPerStrip) ? product.unitsPerStrip : 1; 
    const sellingPrice = batch.saleRate || batch.mrp;
    
    if (existingItem) { 
        const newTotalUnits = existingItem.quantity + 1; 
        const newStripQty = Math.floor(newTotalUnits / unitsPerStrip); 
        const newLooseQty = newTotalUnits % unitsPerStrip; 
        await onUpdateCartItem(existingItem.batchId, { stripQty: newStripQty, looseQty: newLooseQty, quantity: newTotalUnits, total: newTotalUnits * (existingItem.mrp / unitsPerStrip) * (1 - (existingItem.discount || 0) / 100) }); 
        lastAddedBatchIdRef.current = existingItem.batchId;
    } else { 
        const unitPrice = sellingPrice / unitsPerStrip; 
        const newItem: CartItem = { productId: product.id, productName: product.name, batchId: batch.id, batchNumber: batch.batchNumber, expiryDate: batch.expiryDate, hsnCode: product.hsnCode, barcode: product.barcode, stripQty: 0, looseQty: 1, quantity: 1, mrp: sellingPrice, discount: 0, gst: product.gst, total: unitPrice, addedAt: Date.now(), ...(isPharmaMode && product.isScheduleH && { isScheduleH: product.isScheduleH }), ...(isPharmaMode && product.composition && { composition: product.composition }), ...(isPharmaMode && product.unitsPerStrip && { unitsPerStrip: product.unitsPerStrip }), }; 
        lastAddedBatchIdRef.current = newItem.batchId; 
        await onAddToCart(newItem); 
    } 
    setSearchTerm(''); setSubstituteTarget(null); setActiveFlattenedIdx(-1);
    searchInputRef.current?.focus();
  };

  const handleBarcodeScan = (code: string) => {
    const product = products.find(p => p.barcode === code);
    if (product) {
        const batch = [...product.batches].sort((a, b) => getLiveBatchStock(product, b) - getLiveBatchStock(product, a))[0];
        if (batch) handleAddToCartLocal(product, batch);
    }
  };

  const handleQrInputChange = (val: string) => {
    setQrInput(val);
    if (val.length >= 47) {
        const extractedPartNo = val.substring(30, 30 + 17).trim();
        if (extractedPartNo) {
            const product = products.find(p => normalizeCode(p.barcode || "") === normalizeCode(extractedPartNo));
            if (product) {
                skipCartFocusRef.current = true;
                const batch = [...product.batches].sort((a, b) => getLiveBatchStock(product, b) - getLiveBatchStock(product, a))[0];
                if (batch) handleAddToCartLocal(product, batch);
                setSearchTerm(''); setQrInput('');
                setTimeout(() => { if (searchInputRef.current) { searchInputRef.current.focus(); searchInputRef.current.select(); } }, 20);
            }
        }
    }
  };

  // Flattened results for "Old Software" tabular style: Product-Batch combinations
  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    const term = normalizeCode(searchTerm);
    const filtered = products.filter(p => normalizeCode(p.name).includes(term) || (p.barcode && normalizeCode(p.barcode).includes(term))).slice(0, 15);
    
    // Flatten products into their batches
    const results: { product: Product; batch: Batch }[] = [];
    filtered.forEach(p => {
        p.batches.forEach(b => {
            results.push({ product: p, batch: b });
        });
    });
    return results.sort((a, b) => a.product.name.localeCompare(b.product.name));
  }, [searchTerm, products]);

  const filteredCustomers = useMemo(() => {
      if (!customerName || selectedCustomer) return [];
      return customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).slice(0, 5);
  }, [customerName, selectedCustomer, customers]);

  const handleProductKeyDown = (e: React.KeyboardEvent) => {
      if (searchResults.length === 0) return;
      if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveFlattenedIdx(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveFlattenedIdx(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
          e.preventDefault();
          const targetIdx = activeFlattenedIdx >= 0 ? activeFlattenedIdx : 0;
          const result = searchResults[targetIdx];
          if (result) {
              handleAddToCartLocal(result.product, result.batch);
          }
      } else if (e.key === 'Escape') {
          setSearchTerm('');
          setActiveFlattenedIdx(-1);
      }
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
      if (filteredCustomers.length === 0 && !customerName) return;
      const totalOptions = filteredCustomers.length + 1;
      
      if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveCustomerIdx(prev => (prev < totalOptions - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveCustomerIdx(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
          e.preventDefault();
          if (activeCustomerIdx >= 0 && activeCustomerIdx < filteredCustomers.length) {
              const c = filteredCustomers[activeCustomerIdx];
              setSelectedCustomer(c); setCustomerName(c.name); setShowCustomerSuggestions(false);
          } else if (activeCustomerIdx === filteredCustomers.length || (filteredCustomers.length === 0 && customerName)) {
              setAddCustomerModalOpen(true);
          }
      } else if (e.key === 'Escape') {
          setShowCustomerSuggestions(false);
          setActiveCustomerIdx(-1);
      }
  };

  const handleSaveBill = async (shouldPrint: boolean) => {
    if (isSubscriptionExpired) { alert("Subscription Expired!"); return; }
    if (cart.length === 0) { alert(t.billing.cartEmpty); return; }
    if (paymentMode === 'Credit') {
        const isWalkIn = !customerName.trim() || customerName.toLowerCase().includes('walk-in') || customerName.toLowerCase().includes('patient') || customerName.toLowerCase().includes('customer');
        if (isWalkIn) { alert("Customer is MANDATORY for CREDIT transactions. Please select or add a specific ledger."); return; }
    }
    const billData: Omit<Bill, 'id' | 'billNumber'> = {
      date: new Date().toISOString(),
      customerName: customerName.trim() || (isPharmaMode ? t.billing.walkInPatient : t.billing.walkInCustomer),
      customerId: selectedCustomer?.id,
      doctorName: isPharmaMode ? doctorName.trim() : undefined,
      salesmanId: selectedSalesmanId || undefined,
      salesmanName: salesmen?.find(s => s.id === selectedSalesmanId)?.name,
      items: cart,
      subTotal: cart.reduce((s, i) => s + (i.total / (1 + i.gst / 100)), 0),
      totalGst: cart.reduce((s, i) => s + (i.total - (i.total / (1 + i.gst / 100))), 0),
      grandTotal: Math.round(cart.reduce((s, i) => s + i.total, 0)),
      paymentMode,
      operatorId: auth.currentUser?.uid,
      operatorName: auth.currentUser?.displayName || 'Counter Staff'
    };
    const savedBill = isEditing ? await onUpdateBill!(editingBill!.id, billData, editingBill!) : await onGenerateBill(billData);
    if (savedBill) {
      setLastSavedBill(savedBill);
      setShowOrderSuccessModal(true);
      if (shouldPrint) { setBillToPrint(savedBill); setPrinterModalOpen(true); setShouldResetAfterPrint(true); } else { resetBilling(); }
    }
  };

  const resetBilling = () => {
    setCustomerName(''); setSelectedCustomer(null); setDoctorName(''); setPaymentMode('Cash'); setSelectedSalesmanId('');
    setSearchTerm(''); setQrInput(''); setActiveFlattenedIdx(-1); setActiveCustomerIdx(-1);
    if (systemConfig.enableQuickPartQR) qrInputRef.current?.focus(); else searchInputRef.current?.focus();
  };

  const handlePrinterSelection = async (printer: PrinterProfile) => {
      if (billToPrint) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            const printRoot = document.createElement('div'); printWindow.document.body.appendChild(printRoot);
            const root = ReactDOM.createRoot(printRoot);
            if (printer.format === 'Thermal') root.render(<ThermalPrintableBill bill={billToPrint} companyProfile={companyProfile} systemConfig={systemConfig} />);
            else if (printer.format === 'A5') root.render(<PrintableA5Bill bill={billToPrint} companyProfile={companyProfile} systemConfig={systemConfig} />);
            else root.render(<PrintableBill bill={billToPrint} companyProfile={companyProfile} systemConfig={systemConfig} />);
            setTimeout(() => { printWindow.print(); printWindow.close(); if (shouldResetAfterPrint) resetBilling(); setBillToPrint(null); }, 500);
        }
      }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title={
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
               <span className="flex items-center gap-2">
                {isEditing ? <PencilIcon className="h-5 w-5 text-amber-500" /> : <PlusIcon className="h-5 w-5 text-indigo-600" />}
                {isEditing ? 'Editing Bill' : 'New Billing Session'}
               </span>
               <div className="flex gap-2">
                    <button onClick={() => setShowUpgradeModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md"><CloudIcon className="h-5 w-5" /> AI Scan</button>
                    <button onClick={() => setShowScanner(!showScanner)} className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${showScanner ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}><BarcodeIcon className="h-5 w-5" /> {showScanner ? 'Close Scanner' : 'Barcode'}</button>
               </div>
            </div>
          }>
            <div className="space-y-6">
              {showScanner && <div className="animate-fade-in"><EmbeddedScanner onScanSuccess={handleBarcodeScan} onClose={() => setShowScanner(false)} /></div>}

              {systemConfig.enableQuickPartQR && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <label className="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><GlobeIcon className="h-3.5 w-3.5" /> High-Speed QR Scanner Port (Index 30)</label>
                    <div className="relative">
                        <input ref={qrInputRef} type="text" placeholder="Point hand-held scanner here..." value={qrInput} onChange={e => handleQrInputChange(e.target.value)} onFocus={e => e.currentTarget.select()} className={`${inputStyle} w-full p-3 font-mono shadow-inner`} />
                        <BarcodeIcon className="absolute right-3 top-2.5 h-6 w-6 text-indigo-300" />
                    </div>
                  </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Step 1: Select Billing Type First</label>
                        {paymentMode === 'Credit' && <span className="text-[9px] font-black text-rose-500 uppercase animate-pulse">! Specific Customer Mandatory</span>}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setPaymentMode('Cash')} className={`flex-1 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all flex flex-col items-center gap-2 ${paymentMode === 'Cash' ? 'bg-indigo-600 text-white shadow-lg ring-4 ring-indigo-500/20' : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'}`}><CashIcon className="h-6 w-6" /> <span>CASH SALE</span></button>
                        <button onClick={() => setPaymentMode('Credit')} className={`flex-1 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all flex flex-col items-center gap-2 ${paymentMode === 'Credit' ? 'bg-rose-600 text-white shadow-lg ring-4 ring-rose-500/20' : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'}`}><SwitchHorizontalIcon className="h-6 w-6" /> <span>CREDIT SALE</span></button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="relative">
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Step 2: Customer Name {paymentMode === 'Credit' && <span className="text-rose-500">*</span>}</label>
                        <div className="relative">
                            <input type="text" value={customerName} onChange={e => { setCustomerName(e.target.value); setSelectedCustomer(null); setShowCustomerSuggestions(true); setActiveCustomerIdx(-1); }} onKeyDown={handleCustomerKeyDown} placeholder={isPharmaMode ? t.billing.walkInPatient : t.billing.walkInCustomer} className={`${inputStyle} w-full p-3 pl-11 ${paymentMode === 'Credit' ? 'border-rose-300 ring-rose-500/10' : ''}`} />
                            <UserCircleIcon className={`absolute left-3 top-3 h-6 w-6 ${paymentMode === 'Credit' ? 'text-rose-400' : 'text-slate-400'}`} />
                        </div>
                        {showCustomerSuggestions && (filteredCustomers.length > 0 || customerName) && (
                            <ul className="absolute z-40 w-full mt-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg shadow-2xl overflow-hidden animate-fade-in">
                                {filteredCustomers.map((c, idx) => (
                                    <li key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerName(c.name); setShowCustomerSuggestions(false); }} className={`px-4 py-3 cursor-pointer border-b last:border-b-0 dark:border-slate-700 font-bold text-sm transition-colors ${idx === activeCustomerIdx ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-50 dark:hover:bg-slate-700'}`}>
                                        {c.name} ({c.phone || 'No Ph'})
                                    </li>
                                ))}
                                <li onClick={() => setAddCustomerModalOpen(true)} className={`px-4 py-3 cursor-pointer text-[10px] font-black uppercase tracking-widest transition-colors ${activeCustomerIdx === filteredCustomers.length ? 'bg-indigo-600 text-white' : 'text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100'}`}>
                                    + Register New Ledger Master
                                </li>
                            </ul>
                        )}
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Step 3: Assign Salesman</label>
                        <div className="flex gap-2">
                            <div className="relative flex-grow">
                                <select value={selectedSalesmanId} onChange={e => setSelectedSalesmanId(e.target.value)} className={`${inputStyle} w-full p-3 appearance-none font-bold text-sm`}>
                                    <option value="">-- No Salesman (Self) --</option>
                                    {salesmen?.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                                </select>
                                <div className="absolute right-3 top-3.5 pointer-events-none text-slate-400"><SwitchHorizontalIcon className="h-4 w-4 rotate-90" /></div>
                            </div>
                            <button onClick={() => setAddSalesmanModalOpen(true)} className="px-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-600 hover:text-indigo-600 transition-colors shadow-sm"><PlusIcon className="h-6 w-6" /></button>
                        </div>
                    </div>
                </div>
              </div>

              <div className="mt-10">
                <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2"><ReceiptIcon className="h-5 w-5 text-indigo-500" /> {t.billing.cartItems}</h3>
                    <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-[10px] font-black text-slate-500">{cart.length} ITEMS ADDED</span>
                </div>

                <div className="relative mb-6 group">
                    <div className="flex justify-between items-end mb-1">
                        <label className="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em]">Manual Product Entry</label>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Step 4: Add Products</span>
                    </div>
                    <div className="relative">
                        <input ref={searchInputRef} type="text" placeholder="Type product name or barcode..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setActiveFlattenedIdx(-1); }} onKeyDown={handleProductKeyDown} onFocus={e => e.currentTarget.select()} className={`${inputStyle} w-full p-5 text-xl shadow-2xl h-16 border-2 border-indigo-100 group-focus-within:border-indigo-500 transition-all`} />
                        <SearchIcon className="absolute right-5 top-5 h-7 w-7 text-indigo-400 animate-pulse" />
                        
                        {searchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-slate-900 border-2 border-indigo-500 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden animate-fade-in">
                            {/* Tabular Header for Dropdown */}
                            <div className="bg-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest flex border-b border-slate-700">
                                <div className="px-3 py-2 flex-grow">Product Name</div>
                                <div className="px-3 py-2 w-32">Company</div>
                                <div className="px-3 py-2 w-24 text-center">Batch</div>
                                <div className="px-3 py-2 w-20 text-center">Expiry</div>
                                <div className="px-3 py-2 w-20 text-right">MRP</div>
                                <div className="px-3 py-2 w-20 text-right pr-4">Stock</div>
                            </div>
                            <div className="max-h-[350px] overflow-y-auto no-scrollbar">
                                {searchResults.map((result, idx) => {
                                    const isActiveRow = idx === activeFlattenedIdx;
                                    const { product, batch } = result;
                                    const liveStock = getLiveBatchStock(product, batch);
                                    const isExpired = isPharmaMode && getExpiryDate(batch.expiryDate) < new Date();

                                    return (
                                        <div 
                                            key={`${product.id}-${batch.id}`} 
                                            onClick={() => handleAddToCartLocal(product, batch)}
                                            className={`flex items-center text-[12px] border-b border-slate-800/50 cursor-pointer transition-colors ${isActiveRow ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                                        >
                                            <div className="px-3 py-2 flex-grow font-bold truncate">
                                                {product.name}
                                                {isPharmaMode && product.isScheduleH && <span className="ml-1 text-[8px] bg-rose-500 text-white px-1 rounded">H</span>}
                                            </div>
                                            <div className={`px-3 py-2 w-32 truncate text-[10px] uppercase ${isActiveRow ? 'text-indigo-100' : 'text-slate-500'}`}>
                                                {product.company}
                                            </div>
                                            <div className="px-3 py-2 w-24 text-center font-mono text-[11px] font-bold">
                                                {batch.batchNumber}
                                            </div>
                                            <div className={`px-3 py-2 w-20 text-center font-bold ${isExpired ? 'text-rose-400' : ''}`}>
                                                {batch.expiryDate}
                                            </div>
                                            <div className="px-3 py-2 w-20 text-right font-black">
                                                ₹{(batch.saleRate || batch.mrp).toFixed(2)}
                                            </div>
                                            <div className={`px-3 py-2 w-20 text-right pr-4 font-black ${isActiveRow ? 'text-white' : (liveStock > 0 ? 'text-emerald-400' : 'text-rose-500')}`}>
                                                {liveStock}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Footer hint */}
                            <div className="bg-slate-800 p-2 text-[9px] text-slate-400 flex justify-between items-center px-4">
                                <div className="flex gap-4">
                                    <span>[↑↓] Move</span>
                                    <span>[Enter] Select</span>
                                    <span>[Esc] Close</span>
                                </div>
                                <button onClick={() => setSubstituteTarget(searchResults[activeFlattenedIdx >= 0 ? activeFlattenedIdx : 0]?.product)} className="text-indigo-400 font-bold hover:underline">F2: View Alternatives</button>
                            </div>
                        </div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <table className="w-full text-[13px] text-left">
                    <thead className="bg-[#1e293b] text-slate-300 uppercase text-[10px] font-black tracking-widest">
                        <tr><th className="px-4 py-4">PRODUCT / BATCH</th><th className="px-4 py-4 text-center">QTY</th><th className="px-4 py-4 text-right">M.R.P.</th><th className="px-4 py-4 text-center">DISC%</th><th className="px-4 py-4 text-right">TOTAL</th><th className="px-4 py-4"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                        {cart.map(item => (
                        <tr key={item.batchId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                            <td className="px-4 py-3.5"><div className="font-bold text-slate-800 dark:text-slate-100 uppercase text-xs">{item.productName}</div><div className="text-[10px] text-slate-400 font-mono">B: {item.batchNumber} | EXP: {item.expiryDate}</div></td>
                            <td className="px-4 py-3.5"><div className="flex items-center justify-center"><input ref={el => cartItemTabInputRefs.current.set(item.batchId, el)} type="number" value={item.quantity || ''} onChange={e => { const q = parseInt(e.target.value) || 0; onUpdateCartItem(item.batchId, { quantity: q, total: q * (item.mrp / (item.unitsPerStrip || 1)) * (1 - (item.discount || 0) / 100) }); }} onFocus={e => e.currentTarget.select()} className={`${cartInputStyle} w-16`} /></div></td>
                            <td className="px-4 py-3.5 text-right font-medium">{isMrpEditable ? <input type="number" value={item.mrp || ''} onChange={e => { const m = parseFloat(e.target.value) || 0; onUpdateCartItem(item.batchId, { mrp: m, total: item.quantity * (m / (item.unitsPerStrip || 1)) * (1 - (item.discount || 0) / 100) }); }} className={`${cartInputStyle} w-20 text-right`} /> : `₹${item.mrp.toFixed(2)}`}</td>
                            <td className="px-4 py-3.5"><div className="flex justify-center"><input type="number" value={item.discount || ''} onChange={e => { const d = parseFloat(e.target.value) || 0; onUpdateCartItem(item.batchId, { discount: d, total: item.quantity * (item.mrp / (item.unitsPerStrip || 1)) * (1 - d / 100) }); }} className={`${cartInputStyle} w-14`} placeholder="0" /></div></td>
                            <td className="px-4 py-3.5 text-right font-black text-slate-900 dark:text-white">₹{item.total.toFixed(2)}</td>
                            <td className="px-4 py-3.5 text-center"><button onClick={() => onRemoveFromCart(item.batchId)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><TrashIcon className="h-5 w-5" /></button></td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card title="Order Finalization">
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <div className="flex justify-between text-sm text-slate-600 mb-2"><span>SUBTOTAL:</span><span className="font-bold">₹{cart.reduce((s,i) => s + (i.total / (1 + i.gst / 100)), 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-sm text-slate-600 mb-4"><span>TAX (GST):</span><span className="font-bold">₹{cart.reduce((s,i) => s + (i.total - (i.total / (1 + i.gst / 100))), 0).toFixed(2)}</span></div>
                <div className="border-t pt-4 flex justify-between items-end"><span className="text-lg font-black uppercase tracking-tighter">PAYABLE:</span><span className="text-4xl font-black text-indigo-600">₹{Math.round(cart.reduce((s,i) => s + i.total, 0)).toFixed(2)}</span></div>
              </div>
              <div className="space-y-3">
                <button onClick={() => handleSaveBill(true)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-2xl font-black text-xl shadow-xl flex items-center justify-center gap-3 transition-all transform active:scale-95"><PrinterIcon className="h-7 w-7" /> {isEditing ? 'UPDATE & PRINT' : 'SAVE & PRINT'}</button>
                <button onClick={() => handleSaveBill(false)} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-4 rounded-xl font-bold">{isEditing ? 'UPDATE ONLY' : 'SAVE ONLY'}</button>
              </div>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 flex items-center gap-3">
                    <div className={`p-2 bg-white dark:bg-slate-800 rounded shadow-sm ${paymentMode === 'Cash' ? 'text-emerald-600' : 'text-rose-600'}`}>{paymentMode === 'Cash' ? <CashIcon className="h-5 w-5" /> : <SwitchHorizontalIcon className="h-5 w-5" />}</div>
                    <div><p className="text-[10px] font-black uppercase opacity-60">Status</p><p className="font-black text-xs uppercase">{paymentMode} SESSION ACTIVE</p></div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal isOpen={isAddCustomerModalOpen} onClose={() => setAddCustomerModalOpen(false)} title="New Ledger Registry">
         <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const nc = await onAddCustomer({ name: fd.get('name') as string, phone: fd.get('phone') as string, address: fd.get('address') as string, openingBalance: parseFloat(fd.get('openingBalance') as string) || 0 }); if (nc) { setSelectedCustomer(nc); setCustomerName(nc.name); setAddCustomerModalOpen(false); setActiveCustomerIdx(-1); } }} className="space-y-4">
             <div><label className="block text-xs font-bold uppercase mb-1">Full Name*</label><input name="name" className={inputStyle + " w-full p-2.5"} required autoFocus /></div>
             <div><label className="block text-xs font-bold uppercase mb-1">Phone</label><input name="phone" className={inputStyle + " w-full p-2.5"} /></div>
             <div><label className="block text-xs font-bold uppercase mb-1">Address</label><input name="address" className={inputStyle + " w-full p-2.5"} /></div>
             <div className="flex justify-end gap-3 pt-6"><button type="button" onClick={() => setAddCustomerModalOpen(false)} className="px-5 py-2 bg-slate-200 rounded-lg">Cancel</button><button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-black">REGISTER</button></div>
         </form>
      </Modal>

      <Modal isOpen={isAddSalesmanModalOpen} onClose={() => setAddSalesmanModalOpen(false)} title="New Salesman Entry">
        <form onSubmit={async (e) => { e.preventDefault(); const name = (new FormData(e.currentTarget)).get('name') as string; if (onAddSalesman) { const ns = await onAddSalesman({ name }); if (ns) { setSelectedSalesmanId(ns.id); setAddSalesmanModalOpen(false); } } }} className="space-y-4">
            <div><label className="block text-xs font-bold uppercase mb-1">Name*</label><input name="name" className={inputStyle + " w-full p-2.5"} required autoFocus /></div>
            <div className="flex justify-end gap-3 pt-6"><button type="button" onClick={onAddSalesman ? () => setAddSalesmanModalOpen(false) : undefined} className="px-5 py-2 bg-slate-200 rounded-lg font-bold">Cancel</button><button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-black shadow-lg">ADD SALESMAN</button></div>
        </form>
      </Modal>

      <PrinterSelectionModal isOpen={isPrinterModalOpen} onClose={() => { setPrinterModalOpen(false); setBillToPrint(null); if (shouldResetAfterPrint) resetBilling(); }} systemConfig={systemConfig} onUpdateConfig={onUpdateConfig} onSelectPrinter={handlePrinterSelection} />
      
      <Modal isOpen={showOrderSuccessModal} onClose={() => setShowOrderSuccessModal(false)} title="Invoice Completed" maxWidth="max-w-md">
          <div className="text-center py-6">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 shadow-inner"><CheckCircleIcon className="h-12 w-12" /></div>
              <h4 className="text-2xl font-black uppercase tracking-tighter">Order Success</h4>
              <p className="text-slate-500 font-medium mt-1">Bill #{lastSavedBill?.billNumber}</p>
              <div className="mt-10 flex flex-col gap-3">
                  <button onClick={() => { if (lastSavedBill) { setBillToPrint(lastSavedBill); setPrinterModalOpen(true); setShowOrderSuccessModal(false); } }} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"><PrinterIcon className="h-6 w-6" /> PRINT INVOICE</button>
                  <button onClick={() => { setShowOrderSuccessModal(false); resetBilling(); }} className="w-full py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-lg transition-all">START NEW SALE</button>
              </div>
          </div>
      </Modal>

      <SubstituteModal isOpen={!!substituteTarget} onClose={() => setSubstituteTarget(null)} target={substituteTarget} substitutes={products.filter(p => p.id !== substituteTarget?.id && normalizeCode(p.composition || '') === normalizeCode(substituteTarget?.composition || ''))} onAdd={handleAddToCartLocal} getLiveBatchStock={getLiveBatchStock} formatStock={formatStock} />
      <UpgradeAiModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} featureName="AI Product Scanner" />

      {scanResultFeedback && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-[60] flex items-center gap-4 animate-bounce border-2 border-indigo-500">
              <div className="bg-emerald-500 p-1.5 rounded-full"><CheckCircleIcon className="h-5 w-5 text-white" /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Added to Cart</p><p className="font-bold">{scanResultFeedback.name}</p></div>
          </div>
      )}
    </div>
  );
};

export default Billing;

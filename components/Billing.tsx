
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

const TextScannerModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    onScan: (imageData: string) => void;
    isProcessing: boolean;
}> = ({ isOpen, onClose, onScan, isProcessing }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        if (isOpen) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
                .then(setStream)
                .catch(err => {
                    console.error("Camera error:", err);
                    alert("Unable to access camera. Please check permissions.");
                });
        } else {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
                setStream(null);
            }
        }
    }, [isOpen]);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    const handleCapture = () => {
        if (isProcessing) return;
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/png', 0.95);
                onScan(dataUrl);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="AI Product Details Scanner" maxWidth="max-w-xl">
            <div className="space-y-4">
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border-4 border-indigo-600 shadow-2xl">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-2/3 h-1/2 border-4 border-red-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center">
                            <div className="text-[10px] text-white bg-red-500 px-3 py-0.5 rounded-full absolute -top-3 font-bold uppercase tracking-widest whitespace-nowrap">
                                POINT AT MEDICINE PACK / LABEL
                            </div>
                            <div className={`w-full h-0.5 bg-red-500/50 ${isProcessing ? 'hidden' : 'animate-pulse'}`}></div>
                        </div>
                    </div>
                    {isProcessing && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white z-20">
                            <div className="animate-spin h-12 w-12 border-4 border-indigo-400 border-t-transparent rounded-full mb-3 shadow-lg"></div>
                            <p className="font-black text-sm uppercase tracking-tighter">Gemini is Gathering Details...</p>
                        </div>
                    )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={handleCapture} 
                        disabled={isProcessing} 
                        className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-lg shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        <CameraIcon className="h-7 w-7" /> CAPTURE & IDENTIFY
                    </button>
                    <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 px-4">
                        Point the camera at the product label. AI will try to extract **Name, Part No, Batch, and Expiry** automatically.
                    </p>
                </div>
            </div>
        </Modal>
    );
};

const SubstituteModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    target: Product | null; 
    substitutes: Product[]; 
    onAdd: (product: Product, batch: Batch) => void;
    getLiveBatchStock: (p: Product, b: Batch) => number;
    formatStock: (stock: number, units?: number) => string;
}> = ({ isOpen, onClose, target, substitutes, onAdd, getLiveBatchStock, formatStock }) => {
    if (!isOpen || !target) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Substitutes for ${target.name}`} maxWidth="max-w-2xl">
            <div className="space-y-4">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Matching Composition</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{target.composition}</p>
                </div>
                <div className="space-y-4">
                    {substitutes.length > 0 ? (
                        substitutes.map(p => {
                            const batchesWithStock = p.batches.map(b => ({ ...b, liveStock: getLiveBatchStock(p, b) }));
                            return (
                                <div key={p.id} className="p-4 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100">{p.name}</h4>
                                            <p className="text-[10px] text-slate-500 uppercase font-medium mt-0.5">{p.company}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Pack Size</p>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">1 * {p.unitsPerStrip || 1}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {batchesWithStock.map(b => (
                                            <div key={b.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-colors">
                                                <div className="text-xs">
                                                    <span className="font-mono text-slate-500 dark:text-slate-400">B: {b.batchNumber}</span>
                                                    <span className="mx-2 text-slate-300">|</span>
                                                    <span className="font-black text-indigo-600 dark:text-indigo-400">₹{b.mrp.toFixed(2)}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${b.liveStock > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>Stock: {formatStock(b.liveStock, p.unitsPerStrip)}</span>
                                                    <button 
                                                        onClick={() => onAdd(p, b)}
                                                        disabled={b.liveStock <= 0}
                                                        className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg shadow-md hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        <div className="py-16 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <div className="bg-white dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                                <InformationCircleIcon className="h-8 w-8 text-slate-300" />
                            </div>
                            <p className="text-slate-500 font-bold text-sm tracking-tight">No alternative products found in inventory</p>
                            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Matching composition: {target.composition}</p>
                        </div>
                    )}
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

const Billing: React.FC<BillingProps> = ({ products, bills, purchases = [], customers, salesmen, onGenerateBill, companyProfile, systemConfig, user, editingBill, onUpdateBill, onCancelEdit, onAddCustomer, onAddSalesman, onUpdateConfig, isSubscriptionExpired, cart, onAddToCart, onRemoveFromCart, onUpdateCartItem }) => {
  const isPharmaMode = systemConfig.softwareMode === 'Pharma';
  const isEditing = !!editingBill;
  const isMrpEditable = systemConfig.mrpEditable !== false; 
  const t = getTranslation(systemConfig.language);
  const isFreePlan = (systemConfig.subscription?.planType || 'Free') === 'Free';

  const [searchTerm, setSearchTerm] = useState('');
  const [qrCodeInput, setQrCodeInput] = useState(''); // State for the Qrcode Scan field
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
  
  const cartItemStripInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const cartItemTabInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const cartItemMrpInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Credit'>('Cash');
  const [showScanner, setShowScanner] = useState(false);
  const [scannerType, setScannerType] = useState<'standard' | 'xpart'>('standard');
  const [isPrinterModalOpen, setPrinterModalOpen] = useState(false);
  const [billToPrint, setBillToPrint] = useState<Bill | null>(null);
  const [shouldResetAfterPrint, setShouldResetAfterPrint] = useState(false);
  const [activeIndices, setActiveIndices] = useState<{ product: number; batch: number }>({ product: -1, batch: -1 });
  const [showOrderSuccessModal, setShowOrderSuccessModal] = useState(false);
  const [lastSavedBill, setLastSavedBill] = useState<Bill | null>(null);
  const [orderSeconds, setOrderSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  const [showTextScanner, setShowTextScanner] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [substituteTarget, setSubstituteTarget] = useState<Product | null>(null);
  const [scanResultFeedback, setScanResultFeedback] = useState<{name: string, batch?: string} | null>(null);
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
    if (editingBill) {
      setCustomerName(editingBill.customerName);
      const existingCust = customers.find(c => c.id === editingBill.customerId || c.name === editingBill.customerName);
      setSelectedCustomer(existingCust || null);
      setDoctorName(editingBill.doctorName || '');
      setPaymentMode(editingBill.paymentMode || 'Cash');
      setSelectedSalesmanId(editingBill.salesmanId || '');
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
        const newStripQty = Math.floor(newTotalUnits / unitsPerStrip); 
        const newLooseQty = newTotalUnits % unitsPerStrip; 
        await onUpdateCartItem(existingItem.batchId, { 
            stripQty: newStripQty, 
            looseQty: newLooseQty, 
            quantity: newTotalUnits, 
            total: newTotalUnits * (existingItem.mrp / unitsPerStrip) 
        }); 
        lastAddedBatchIdRef.current = existingItem.batchId;
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
        lastAddedBatchIdRef.current = newItem.batchId; 
        await onAddToCart(newItem); 
    } 
    setSearchTerm(''); 
  };

  /**
   * SPECIFIC QR CODE LOGIC (xpart)
   * substr(partno, 36, 20) and put as barcode to make entry
   */
  const handleXPartScan = (rawCode: string) => {
    // extract index 36, length 20
    const xpart = rawCode.substring(36, 56).trim();
    if (!xpart) return;

    const product = products.find(p => p.barcode === xpart);
    if (product) {
        // Automatically pick the first batch with stock
        const batchesWithStock = product.batches.map(b => ({ ...b, liveStock: getLiveBatchStock(product, b) }));
        const bestBatch = batchesWithStock.sort((a, b) => b.liveStock - a.liveStock)[0];
        if (bestBatch) {
            handleAddToCartLocal(product, bestBatch);
            setQrCodeInput(''); // clear field for next scan
        } else {
            alert(`Product ${product.name} found, but no batches available.`);
        }
    } else {
        console.log("No product matched xpart:", xpart);
        setQrCodeInput(xpart); // Show the extracted part for debugging or manual search
    }
  };

  const handleBarcodeScan = (rawCode: string) => {
    if (isSubscriptionExpired) { alert("Subscription Expired!"); return; }
    
    if (scannerType === 'xpart') {
        handleXPartScan(rawCode);
    } else {
        const code = extractPartNumber(rawCode);
        const product = products.find(p => p.barcode === code);
        if (product) {
            const batchesWithStock = product.batches.map(b => ({ ...b, liveStock: getLiveBatchStock(product, b) }));
            const batch = batchesWithStock.sort((a, b) => b.liveStock - a.liveStock)[0];
            if (batch) handleAddToCartLocal(product, batch);
        } else alert(`Product code ${code} not found.`);
    }
    setShowScanner(false);
  };

  const handleSaveBill = async (shouldPrint: boolean) => {
    if (cart.length === 0) { alert(t.billing.cartEmpty); return; }
    const subTotal = cart.reduce((sum, item) => sum + (item.total / (1 + item.gst / 100)), 0);
    const totalGst = cart.reduce((sum, item) => sum + (item.total - (item.total / (1 + item.gst / 100))), 0);
    const grandTotal = Math.round(subTotal + totalGst);
    
    const currentOperator = auth.currentUser;
    const salesman = salesmen?.find(s => s.id === selectedSalesmanId);

    const billData: Omit<Bill, 'id' | 'billNumber'> = {
      date: new Date().toISOString(),
      customerName: customerName.trim() || t.billing.walkInCustomer,
      customerId: selectedCustomer?.id,
      doctorName: isPharmaMode ? doctorName.trim() : undefined,
      salesmanId: selectedSalesmanId || undefined,
      salesmanName: salesman?.name,
      items: cart,
      subTotal,
      totalGst,
      grandTotal,
      paymentMode,
      operatorId: currentOperator?.uid,
      operatorName: currentOperator?.displayName || 'Counter Staff'
    };

    let savedBill = null;
    if (isEditing && editingBill) {
      if (!onUpdateBill) return;
      savedBill = await onUpdateBill(editingBill.id, billData, editingBill);
    } else {
      savedBill = await onGenerateBill(billData);
    }

    if (savedBill) {
      setLastSavedBill(savedBill);
      setShowOrderSuccessModal(true);
      if (shouldPrint) {
        setBillToPrint(savedBill);
        setPrinterModalOpen(true);
      }
    }
  };

  const resetBilling = () => {
    setCustomerName(''); setSelectedCustomer(null); setDoctorName(''); setPaymentMode('Cash');
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    const term = normalizeCode(searchTerm);
    return products.filter(p => normalizeCode(p.name).includes(term) || (p.barcode && normalizeCode(p.barcode).includes(term))).slice(0, 10);
  }, [searchTerm, products]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title={
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <span className="flex items-center gap-2">
                {isEditing ? t.billing.editBill : t.billing.createBill}
               </span>
               <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={() => setShowTextScanner(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-black shadow-md transition-all">
                        <CloudIcon className="h-4 w-4" /> AI Scan
                    </button>
                    <button onClick={() => { setScannerType('standard'); setShowScanner(true); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-black bg-slate-100 text-slate-700 border hover:bg-slate-200">
                        <BarcodeIcon className="h-4 w-4" /> Scanner
                    </button>
                    <button onClick={() => { setScannerType('xpart'); setShowScanner(true); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-black bg-rose-600 text-white shadow-md hover:bg-rose-700">
                        <BarcodeIcon className="h-4 w-4" /> QR Scan
                    </button>
               </div>
            </div>
          }>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Search Product</label>
                    <div className="relative">
                        <input ref={searchInputRef} type="text" placeholder="Name or Barcode" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setActiveIndices({ product: 0, batch: 0 }); }} className={`${inputStyle} w-full p-2.5 h-12`} />
                        <SearchIcon className="absolute right-3 top-3 h-5 w-5 text-slate-400" />
                    </div>
                  </div>
                  <div className="relative">
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Qrcode Scan (Direct Input)</label>
                    <div className="relative">
                        <input ref={qrInputRef} type="text" placeholder="Scan into this field..." value={qrCodeInput} onChange={e => {
                            const val = e.target.value;
                            if (val.length >= 56) {
                                handleXPartScan(val);
                            } else {
                                setQrCodeInput(val);
                            }
                        }} className={`${inputStyle} w-full p-2.5 h-12 bg-rose-50 border-rose-200`} />
                        <BarcodeIcon className="absolute right-3 top-3 h-5 w-5 text-rose-400" />
                    </div>
                  </div>
              </div>

              {filteredProducts.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden mb-4">
                    {filteredProducts.map((product, pIdx) => (
                      <div key={product.id} className="border-b last:border-b-0 p-3 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100">{product.name}</h4>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{product.company}</p>
                        </div>
                        <div className="flex gap-2 overflow-x-auto p-1">
                          {product.batches.map(batch => (
                              <button key={batch.id} onClick={() => handleAddToCartLocal(product, batch)} className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-800 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all">
                                ₹{batch.mrp.toFixed(2)} - B:{batch.batchNumber} ({batch.stock} U)
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
                  <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Walk-in Customer" className={`${inputStyle} w-full p-2.5 h-12`} />
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
                      <th className="px-4 py-4">Item Details</th>
                      <th className="px-4 py-4 text-center">Qty</th>
                      <th className="px-4 py-4 text-right">Price</th>
                      <th className="px-4 py-4 text-right">Amount</th>
                      <th className="px-4 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                    {cart.map(item => (
                      <tr key={item.batchId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-800 dark:text-slate-100">{item.productName}</div>
                          <div className="text-[10px] text-slate-500 uppercase">Batch: {item.batchNumber} | Exp: {item.expiryDate}</div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                            <input type="number" value={item.quantity} onChange={e => onUpdateCartItem(item.batchId, { quantity: parseInt(e.target.value) || 0, total: (parseInt(e.target.value) || 0) * (item.mrp / (item.unitsPerStrip || 1)) })} className="w-16 text-center p-1.5 bg-yellow-50 dark:bg-slate-700 border rounded font-bold" />
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium">₹{item.mrp.toFixed(2)}</td>
                        <td className="px-4 py-3.5 text-right font-black">₹{item.total.toFixed(2)}</td>
                        <td className="px-4 py-3.5 text-center">
                          <button onClick={() => onRemoveFromCart(item.batchId)} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><TrashIcon className="h-5 w-5" /></button>
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
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card title="Order Summary">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPaymentMode('Cash')} className={`py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${paymentMode === 'Cash' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-700 text-slate-500'}`}>CASH</button>
                <button onClick={() => setPaymentMode('Credit')} className={`py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${paymentMode === 'Credit' ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-700 text-slate-500'}`}>CREDIT</button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-end">
                  <span className="text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter">Total Payable</span>
                  <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400">₹{cart.reduce((s, i) => s + i.total, 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <button onClick={() => handleSaveBill(true)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-2xl font-black text-xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3">
                  <PrinterIcon className="h-7 w-7" /> SAVE & PRINT
                </button>
                <button onClick={() => handleSaveBill(false)} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-4 rounded-xl font-bold transition-all active:scale-95">
                   SAVE ONLY
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <BarcodeScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} onScanSuccess={handleBarcodeScan} />
      <PrinterSelectionModal isOpen={isPrinterModalOpen} onClose={() => { setPrinterModalOpen(false); resetBilling(); }} systemConfig={systemConfig} onUpdateConfig={onUpdateConfig} onSelectPrinter={() => {}} />
      
      <Modal isOpen={showOrderSuccessModal} onClose={() => setShowOrderSuccessModal(false)} title="Success">
          <div className="text-center py-4">
              <CheckCircleIcon className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
              <h4 className="text-2xl font-black uppercase">Invoice Saved</h4>
              <button onClick={() => { setShowOrderSuccessModal(false); resetBilling(); }} className="mt-8 w-full py-4 bg-indigo-600 text-white rounded-xl font-black">NEXT BILL</button>
          </div>
      </Modal>
    </div>
  );
};

export default Billing;

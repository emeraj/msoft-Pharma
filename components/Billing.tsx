
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
            navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
            })
            .then(s => setStream(s))
            .catch(err => {
                console.error("Camera error:", err);
                alert("Unable to access camera. Please check permissions.");
            });
        }
        
        return () => {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
                setStream(null);
            }
        };
    }, [isOpen]);

    useEffect(() => {
        let isMounted = true;
        const video = videoRef.current;
        
        if (video && stream) {
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                if (isMounted) {
                    video.play().catch(e => {
                        console.debug("Video play handled:", e.message);
                    });
                }
            };
        }

        return () => {
            isMounted = false;
            if (video) {
                video.pause();
                video.srcObject = null;
            }
        };
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
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
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
                        <div className="py-16 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
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
  const cartItemMrpInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const cartItemDiscInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Credit'>('Cash');
  const [showScanner, setShowScanner] = useState(!isPharmaMode && systemConfig.barcodeScannerOpenByDefault !== false);
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

  /**
   * QR Industrial Parser
   */
  const parseIndustrialQR = (val: string): string | null => {
      if (val.includes('/')) {
          const parts = val.split('/');
          if (parts.length >= 4) {
              return parts[3].trim();
          }
      }
      return null;
  };

  useEffect(() => {
    if (systemConfig.enableQuickPartQR) {
        qrInputRef.current?.focus();
    } else {
        searchInputRef.current?.focus();
    }
  }, [systemConfig.enableQuickPartQR]);

  useEffect(() => {
    if (!isPharmaMode && systemConfig.barcodeScannerOpenByDefault !== false) {
      setShowScanner(true);
    }
  }, [systemConfig.barcodeScannerOpenByDefault, isPharmaMode]);

  useEffect(() => { if (cart.length > 0 && startTimeRef.current === null) { startTimeRef.current = Date.now(); } else if (cart.length === 0) { startTimeRef.current = null; } }, [cart.length]);
  
  useEffect(() => {
    if (skipCartFocusRef.current) {
        skipCartFocusRef.current = false;
        lastAddedBatchIdRef.current = null;
        return;
    }

    if (lastAddedBatchIdRef.current) {
        const newItem = cart.find(item => item.batchId === lastAddedBatchIdRef.current);
        if (newItem) {
            let inputToFocus: HTMLInputElement | null | undefined = null;
            if (isPharmaMode && newItem.unitsPerStrip && newItem.unitsPerStrip > 1) { 
                inputToFocus = cartItemStripInputRefs.current.get(lastAddedBatchIdRef.current); 
            } else { 
                inputToFocus = cartItemTabInputRefs.current.get(lastAddedBatchIdRef.current); 
            }
            if (inputToFocus) { 
                inputToFocus.focus(); 
                inputToFocus.select(); 
            }
            lastAddedBatchIdRef.current = null;
        }
    }
  }, [cart, isPharmaMode]);

  useEffect(() => {
    if (editingBill) {
      setCustomerName(editingBill.customerName);
      const existingCust = customers.find(c => c.id === editingBill.customerId || c.name === editingBill.customerName);
      setSelectedCustomer(existingCust || null);
      setDoctorName(editingBill.doctorName || '');
      if (editingBill.paymentMode) { setPaymentMode(editingBill.paymentMode); }
      if (editingBill.salesmanId) { setSelectedSalesmanId(editingBill.salesmanId); } else { setSelectedSalesmanId(''); }
    } else {
      setCustomerName(''); setSelectedCustomer(null); setDoctorName(''); setPaymentMode('Cash'); setSelectedSalesmanId('');
    }
  }, [editingBill, customers]);

  const handleAddToCartLocal = async (product: Product, batch: Batch) => { 
    if (isSubscriptionExpired) { alert("Subscription Expired! Cannot add items to cart. Please renew."); return; }
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
        if (unitsPerStrip <= 1) { 
            const newLQty = existingItem.looseQty + 1;
            await onUpdateCartItem(existingItem.batchId, { 
                looseQty: newLQty, 
                quantity: newLQty, 
                total: newLQty * (existingItem.mrp) * (1 - (existingItem.discount || 0) / 100) 
            }); 
        } 
        else { 
            const newTotalUnits = existingItem.quantity + 1; 
            const newStripQty = Math.floor(newTotalUnits / unitsPerStrip); 
            const newLooseQty = newTotalUnits % unitsPerStrip; 
            await onUpdateCartItem(existingItem.batchId, { 
                stripQty: newStripQty, 
                looseQty: newLooseQty, 
                quantity: newTotalUnits, 
                total: newTotalUnits * (existingItem.mrp / unitsPerStrip) * (1 - (existingItem.discount || 0) / 100) 
            }); 
        } 
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
            discount: 0,
            gst: product.gst, 
            total: unitPrice, 
            addedAt: Date.now(),
            ...(isPharmaMode && product.isScheduleH && { isScheduleH: product.isScheduleH }), 
            ...(isPharmaMode && product.composition && { composition: product.composition }), 
            ...(isPharmaMode && product.unitsPerStrip && { unitsPerStrip: product.unitsPerStrip }), 
        }; 
        lastAddedBatchIdRef.current = newItem.batchId; 
        await onAddToCart(newItem); 
    } 
    setSearchTerm(''); 
    setSubstituteTarget(null);
    // After adding, focus the search bar for next item entry
    searchInputRef.current?.focus();
  };

  const handleBarcodeScan = (code: string) => {
    if (isSubscriptionExpired) { alert("Subscription Expired! Scanning is disabled."); return; }
    const product = products.find(p => p.barcode === code);
    if (product) {
        const batchesWithStock = product.batches.map(b => ({ ...b, liveStock: getLiveBatchStock(product, b) }));
        const batch = batchesWithStock.sort((a, b) => b.liveStock - a.liveStock)[0];
        if (batch) handleAddToCartLocal(product, batch);
        else alert("No batches found for this product.");
    } else alert(`Product with barcode ${code} not found.`);
  };

  const handleQrInputChange = (val: string) => {
    const parsedId = parseIndustrialQR(val);
    const searchVal = parsedId !== null ? parsedId : val;

    setQrInput(searchVal);
    if (searchVal.length >= 8) {
        const product = products.find(p => normalizeCode(p.barcode || "") === normalizeCode(searchVal));
        if (product) {
            const batchesWithStock = product.batches.map(b => ({ ...b, liveStock: getLiveBatchStock(product, b) }));
            const batch = [...batchesWithStock].sort((a, b) => b.liveStock - a.liveStock)[0];
            if (batch) {
                skipCartFocusRef.current = true;
                handleAddToCartLocal(product, batch);
                setScanResultFeedback({ name: product.name, batch: batch.batchNumber });
                setTimeout(() => setScanResultFeedback(null), 3000);
                
                setSearchTerm(product.name);
                setQrInput('');
                setTimeout(() => {
                    if (searchInputRef.current) {
                        searchInputRef.current.focus();
                        searchInputRef.current.setSelectionRange(0, searchInputRef.current.value.length);
                    }
                }, 20);
            }
        }
    }
  };

  const handleAiScanClick = () => {
      if (isFreePlan) {
          setShowUpgradeModal(true);
          return;
      }
      setShowTextScanner(true);
  };

  const handleTextScan = async (imageData: string) => {
    if (isSubscriptionExpired) { alert("Subscription Expired!"); return; }
    if (isFreePlan) { setShowUpgradeModal(true); return; }
    setIsOcrProcessing(true);
    try {
        const base64Data = imageData.split(',')[1];
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Strictly analyze this product label image. Extract: 1. Brand Name. 2. Part Number/Barcode. 3. Batch Number. 4. Expiry. Return JSON.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ inlineData: { mimeType: 'image/png', data: base64Data } }, { text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        if (!response.text) throw new Error("No response from AI");
        const detected = JSON.parse(response.text);
        const { name: dName, technicalCode: dCode, batch: dBatch } = detected;
        
        const normCode = dCode ? normalizeCode(dCode) : "";
        const normName = dName ? normalizeCode(dName) : "";
        let bestMatch = products.find(p => normCode !== "" && normalizeCode(p.barcode || "") === normCode);
        if (!bestMatch && normName !== "") {
            bestMatch = products.find(p => normalizeCode(p.name).includes(normName));
        }
        if (bestMatch) {
            let targetBatch = dBatch ? bestMatch.batches.find(b => normalizeCode(b.batchNumber) === normalizeCode(dBatch)) : undefined;
            if (!targetBatch) targetBatch = [...bestMatch.batches].sort((a, b) => getLiveBatchStock(bestMatch, b) - getLiveBatchStock(bestMatch, a))[0];
            if (targetBatch) {
                await handleAddToCartLocal(bestMatch, targetBatch);
                setShowTextScanner(false);
            }
        }
    } catch (e) {
        alert("Scan failed.");
    } finally {
        setIsOcrProcessing(false);
    }
  };

  const handleSaveBill = async (shouldPrint: boolean) => {
    if (isSubscriptionExpired) { alert("Subscription Expired!"); return; }
    if (cart.length === 0) { alert(t.billing.cartEmpty); return; }
    
    if (paymentMode === 'Credit') {
        const isWalkIn = !customerName.trim() || customerName.toLowerCase().includes('walk-in');
        if (isWalkIn) {
            alert("Customer record is mandatory for CREDIT transactions.");
            return;
        }
    }

    const billData: Omit<Bill, 'id' | 'billNumber'> = {
      date: new Date().toISOString(),
      customerName: customerName.trim() || (isPharmaMode ? t.billing.walkInPatient : t.billing.walkInCustomer),
      customerId: selectedCustomer?.id,
      doctorName: isPharmaMode ? doctorName.trim() : undefined,
      salesmanId: selectedSalesmanId || undefined,
      items: cart,
      subTotal: cart.reduce((s, i) => s + (i.total / (1 + i.gst / 100)), 0),
      totalGst: cart.reduce((s, i) => s + (i.total - (i.total / (1 + i.gst / 100))), 0),
      grandTotal: Math.round(cart.reduce((s, i) => s + i.total, 0)),
      paymentMode,
      operatorId: auth.currentUser?.uid,
      operatorName: auth.currentUser?.displayName || 'Staff'
    };

    const savedBill = isEditing ? await onUpdateBill!(editingBill!.id, billData, editingBill!) : await onGenerateBill(billData);

    if (savedBill) {
      setLastSavedBill(savedBill);
      setShowOrderSuccessModal(true);
      if (shouldPrint) {
        setBillToPrint(savedBill);
        setPrinterModalOpen(true);
        setShouldResetAfterPrint(true);
      } else {
        resetBilling();
      }
    }
  };

  const resetBilling = () => {
    setCustomerName(''); setSelectedCustomer(null); setDoctorName(''); setPaymentMode('Cash'); setSelectedSalesmanId('');
    setSearchTerm(''); setQrInput('');
    searchInputRef.current?.focus();
  };

  const handlePrinterSelection = async (printer: PrinterProfile) => {
      if (billToPrint) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            const printRoot = document.createElement('div');
            printWindow.document.body.appendChild(printRoot);
            const root = ReactDOM.createRoot(printRoot);
            if (printer.format === 'Thermal') root.render(<ThermalPrintableBill bill={billToPrint} companyProfile={companyProfile} systemConfig={systemConfig} />);
            else if (printer.format === 'A5') root.render(<PrintableA5Bill bill={billToPrint} companyProfile={companyProfile} systemConfig={systemConfig} />);
            else root.render(<PrintableBill bill={billToPrint} companyProfile={companyProfile} systemConfig={systemConfig} />);
            setTimeout(() => { printWindow.print(); printWindow.close(); if (shouldResetAfterPrint) resetBilling(); setBillToPrint(null); }, 500);
        }
      }
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
        if (prev.product < filteredProducts.length - 1) return { product: prev.product + 1, batch: 0 };
        return prev;
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title={
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <span className="flex items-center gap-2">
                {isEditing ? <PencilIcon className="h-5 w-5 text-amber-500" /> : <PlusIcon className="h-5 w-5 text-indigo-600" />}
                {isEditing ? t.billing.editBill : t.billing.createBill}
               </span>
               <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={handleAiScanClick} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all">
                        <CloudIcon className="h-5 w-5" /> AI Scan
                    </button>
                    <button onClick={() => setShowScanner(!showScanner)} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${showScanner ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'}`}>
                        <BarcodeIcon className="h-5 w-5" /> {showScanner ? 'Close Cam' : 'Scanner'}
                    </button>
               </div>
            </div>
          }>
            <div className="space-y-6">
              {showScanner && <div className="animate-fade-in"><EmbeddedScanner onScanSuccess={handleBarcodeScan} onClose={() => setShowScanner(false)} /></div>}

              {/* PAYMENT & CUSTOMER SECTION (Payment First) */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Step 1: Select Billing Type</label>
                    {paymentMode === 'Credit' && <span className="text-[9px] font-black text-rose-500 uppercase animate-pulse">! Specific Customer Mandatory</span>}
                </div>
                
                <div className="flex gap-3 mb-6">
                    <button 
                        onClick={() => setPaymentMode('Cash')} 
                        className={`flex-1 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all flex flex-col items-center gap-2 ${paymentMode === 'Cash' ? 'bg-indigo-600 text-white shadow-lg ring-4 ring-indigo-500/20' : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'}`}
                    >
                        <CashIcon className="h-5 w-5" /> <span>CASH SALE</span>
                    </button>
                    <button 
                        onClick={() => setPaymentMode('Credit')} 
                        className={`flex-1 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all flex flex-col items-center gap-2 ${paymentMode === 'Credit' ? 'bg-rose-600 text-white shadow-lg ring-4 ring-rose-500/20' : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'}`}
                    >
                        <SwitchHorizontalIcon className="h-5 w-5" /> <span>CREDIT SALE</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">
                            {isPharmaMode ? t.billing.patientName : t.billing.customerName} {paymentMode === 'Credit' && <span className="text-rose-500">*</span>}
                        </label>
                        <div className="relative">
                            <input type="text" value={customerName} onChange={e => { setCustomerName(e.target.value); setSelectedCustomer(null); setShowCustomerSuggestions(true); }} placeholder={isPharmaMode ? t.billing.walkInPatient : t.billing.walkInCustomer} className={`${inputStyle} w-full p-3 ${paymentMode === 'Credit' ? 'border-rose-300' : ''}`} />
                            <UserCircleIcon className={`absolute right-3 top-3 h-5 w-5 ${paymentMode === 'Credit' ? 'text-rose-400' : 'text-slate-400'}`} />
                        </div>
                        {showCustomerSuggestions && filteredCustomers.length > 0 && (
                            <ul className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                                {filteredCustomers.map(c => <li key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerName(c.name); setShowCustomerSuggestions(false); }} className="px-4 py-3 hover:bg-indigo-50 dark:hover:bg-slate-700 cursor-pointer border-b last:border-b-0 dark:border-slate-700 font-bold">{c.name}</li>)}
                            </ul>
                        )}
                        {customerName && !selectedCustomer && <button onClick={() => setAddCustomerModalOpen(true)} className="mt-1 text-[10px] font-black text-indigo-600 uppercase hover:underline">+ New Ledger Record</button>}
                    </div>
                    {isPharmaMode && <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">{t.billing.doctorName}</label><input type="text" value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Dr. Name" className={`${inputStyle} w-full p-3`} /></div>}
                </div>
              </div>

              {/* MANUAL PRODUCT SEARCH (Now above Cart) */}
              <div className="mt-10">
                <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                        <ReceiptIcon className="h-5 w-5 text-indigo-500" /> {t.billing.cartItems}
                    </h3>
                    <div className="flex gap-2 text-[10px] font-black uppercase text-slate-400">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{cart.length} ITEMS</span>
                    </div>
                </div>

                <div className="relative mb-4 group">
                    <div className="flex justify-between items-end mb-1">
                        <label className="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em]">Quick Product Entry (Manual Search)</label>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Step 2: Add Items</span>
                    </div>
                    <div className="relative">
                        <input 
                            ref={searchInputRef} 
                            type="text" 
                            placeholder="Type product name, company, or part number here..." 
                            value={searchTerm} 
                            onChange={e => { setSearchTerm(e.target.value); setActiveIndices({ product: 0, batch: 0 }); }} 
                            onKeyDown={handleSearchKeyDown} 
                            onFocus={e => e.currentTarget.select()}
                            className={`${inputStyle} w-full p-5 text-xl shadow-2xl h-16 border-2 border-indigo-100 dark:border-indigo-900/50 group-focus-within:border-indigo-500 transition-all`} 
                        />
                        <SearchIcon className="absolute right-5 top-5 h-7 w-7 text-indigo-400 animate-pulse" />
                        
                        {filteredProducts.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border-2 border-indigo-500 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden animate-fade-in">
                            {filteredProducts.map((product, pIdx) => {
                                const productBatches = [...product.batches].sort((a,b) => getExpiryDate(a.expiryDate).getTime() - getExpiryDate(b.expiryDate).getTime());
                                return (
                            <div key={product.id} className={`border-b last:border-b-0 dark:border-slate-700 ${activeIndices.product === pIdx ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}>
                                <div className="p-4 flex justify-between items-start">
                                    <div>
                                        <h4 className="font-black text-lg text-slate-800 dark:text-slate-100">{product.name}</h4>
                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{product.company} | Barcode: {product.barcode || 'N/A'}</p>
                                    </div>
                                    <button onClick={() => setSubstituteTarget(product)} className="text-[10px] font-black bg-teal-100 text-teal-700 px-3 py-1.5 rounded-lg hover:bg-teal-200 uppercase tracking-widest border border-teal-200">Alternatives</button>
                                </div>
                                <div className="flex overflow-x-auto p-4 pt-0 gap-3 no-scrollbar pb-6">
                                {productBatches.map((batch, bIdx) => {
                                    const liveStock = getLiveBatchStock(product, batch);
                                    const isActive = activeIndices.product === pIdx && activeIndices.batch === bIdx;
                                    return (
                                    <button key={batch.id} onClick={() => handleAddToCartLocal(product, batch)} className={`flex-shrink-0 p-3 rounded-xl border-2 text-left transition-all min-w-[160px] ${isActive ? 'border-indigo-600 bg-indigo-600 text-white shadow-xl scale-105' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-indigo-300'}`}>
                                        <div className="text-[10px] font-black uppercase tracking-tighter opacity-80 mb-1">B: {batch.batchNumber}</div>
                                        <div className="font-black text-lg">₹{(batch.saleRate || batch.mrp).toFixed(2)}</div>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className={`text-[11px] font-black ${isActive ? 'text-white' : (liveStock > 0 ? 'text-emerald-600' : 'text-rose-500')}`}>{formatStock(liveStock, product.unitsPerStrip)}</span>
                                            <span className={`text-[9px] font-bold opacity-60 ${isActive ? 'text-indigo-100' : ''}`}>EXP: {batch.expiryDate}</span>
                                        </div>
                                    </button>
                                    );
                                })}
                                </div>
                            </div>
                            )})}
                        </div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <table className="w-full text-[13px] text-left">
                    <thead className="bg-[#1e293b] text-slate-300 uppercase text-[10px] font-black tracking-widest">
                        {isPharmaMode ? (
                        <tr>
                            <th className="px-4 py-4">PRODUCT</th>
                            <th className="px-4 py-4 text-center">PACK</th>
                            <th className="px-4 py-4 text-center">BATCH</th>
                            <th className="px-4 py-4 text-center">STRI</th>
                            <th className="px-4 py-4 text-center">TAB.</th>
                            <th className="px-4 py-4 text-right">PRICE</th>
                            <th className="px-4 py-4 text-center">DISC%</th>
                            <th className="px-4 py-4 text-right">AMOUNT</th>
                            <th className="px-4 py-4 text-center"></th>
                        </tr>
                        ) : (
                        <tr>
                            <th className="px-4 py-4">{t.billing.product}</th>
                            <th className="px-4 py-4 text-center">{t.billing.qty}</th>
                            <th className="px-4 py-4 text-right">{t.billing.mrp}</th>
                            <th className="px-4 py-4 text-center">DISC%</th>
                            <th className="px-4 py-4 text-right">{t.billing.amount}</th>
                            <th className="px-4 py-4 text-center"></th>
                        </tr>
                        )}
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                        {cart.map(item => (
                        <tr key={item.batchId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                            <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-800 dark:text-slate-100">{item.productName}</div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-tighter">B: {item.batchNumber} | GST {item.gst}%</div>
                            </td>
                            {isPharmaMode ? (
                            <>
                                <td className="px-4 py-3.5 text-center font-medium text-slate-600 dark:text-slate-400">1 * {item.unitsPerStrip || 1}</td>
                                <td className="px-4 py-3.5 text-center"><div className="font-mono text-[11px] font-black text-indigo-600">{item.batchNumber}</div><div className="text-[9px] text-slate-400">EXP: {item.expiryDate}</div></td>
                                <td className="px-4 py-3.5"><div className="flex flex-col items-center"><input ref={el => { cartItemStripInputRefs.current.set(item.batchId, el); }} type="number" value={item.stripQty || ''} onChange={e => {
                                        const sQty = parseInt(e.target.value) || 0;
                                        const totalUnits = (sQty * (item.unitsPerStrip || 1)) + (item.looseQty || 0);
                                        onUpdateCartItem(item.batchId, { stripQty: sQty, quantity: totalUnits, total: totalUnits * (item.mrp / (item.unitsPerStrip || 1)) * (1 - (item.discount || 0) / 100) });
                                    }} onFocus={e => e.currentTarget.select()} className={`${cartInputStyle} w-14`} /></div></td>
                                <td className="px-4 py-3.5"><div className="flex flex-col items-center"><input ref={el => { cartItemTabInputRefs.current.set(item.batchId, el); }} type="number" value={item.looseQty || ''} onChange={e => {
                                        const lQty = parseInt(e.target.value) || 0;
                                        const totalUnits = ((item.stripQty || 0) * (item.unitsPerStrip || 1)) + lQty;
                                        onUpdateCartItem(item.batchId, { looseQty: lQty, quantity: totalUnits, total: totalUnits * (item.mrp / (item.unitsPerStrip || 1)) * (1 - (item.discount || 0) / 100) });
                                    }} onFocus={e => e.currentTarget.select()} className={`${cartInputStyle} w-14`} /></div></td>
                                <td className="px-4 py-3.5 text-right font-medium">{isMrpEditable ? <input ref={el => { cartItemMrpInputRefs.current.set(item.batchId, el); }} type="number" value={item.mrp || ''} onChange={e => {
                                        const newMrp = parseFloat(e.target.value) || 0;
                                        onUpdateCartItem(item.batchId, { mrp: newMrp, total: item.quantity * (newMrp / (item.unitsPerStrip || 1)) * (1 - (item.discount || 0) / 100) });
                                    }} onFocus={e => e.currentTarget.select()} className={`${cartInputStyle} w-20 text-right`} /> : `₹${item.mrp.toFixed(2)}`}</td>
                                <td className="px-4 py-3.5"><div className="flex flex-col items-center"><input ref={el => { cartItemDiscInputRefs.current.set(item.batchId, el); }} type="number" step="0.01" value={item.discount || ''} onChange={e => {
                                        const disc = parseFloat(e.target.value) || 0;
                                        onUpdateCartItem(item.batchId, { discount: disc, total: item.quantity * (item.mrp / (item.unitsPerStrip || 1)) * (1 - disc / 100) });
                                    }} onFocus={e => e.currentTarget.select()} className={`${cartInputStyle} w-14 border-indigo-200`} placeholder="0" /></div></td>
                            </>
                            ) : (
                            <>
                                <td className="px-4 py-3.5"><div className="flex items-center justify-center"><input ref={el => { cartItemTabInputRefs.current.set(item.batchId, el); }} type="number" value={item.quantity || ''} onChange={e => {
                                        const qty = parseInt(e.target.value) || 0;
                                        onUpdateCartItem(item.batchId, { quantity: qty, looseQty: qty, total: qty * item.mrp * (1 - (item.discount || 0) / 100) });
                                    }} onFocus={e => e.currentTarget.select()} className={`${cartInputStyle} w-16`} /></div></td>
                                <td className="px-4 py-3.5 text-right font-medium">{isMrpEditable ? <input ref={el => { cartItemMrpInputRefs.current.set(item.batchId, el); }} type="number" value={item.mrp || ''} onChange={e => {
                                        const newMrp = parseFloat(e.target.value) || 0;
                                        onUpdateCartItem(item.batchId, { mrp: newMrp, total: item.quantity * newMrp * (1 - (item.discount || 0) / 100) });
                                    }} onFocus={e => e.currentTarget.select()} className={`${cartInputStyle} w-20 text-right`} /> : `₹${item.mrp.toFixed(2)}`}</td>
                                <td className="px-4 py-3.5"><div className="flex flex-col items-center"><input ref={el => { cartItemDiscInputRefs.current.set(item.batchId, el); }} type="number" step="0.01" value={item.discount || ''} onChange={e => {
                                        const disc = parseFloat(e.target.value) || 0;
                                        onUpdateCartItem(item.batchId, { discount: disc, total: item.quantity * item.mrp * (1 - disc / 100) });
                                    }} onFocus={e => e.currentTarget.select()} className={`${cartInputStyle} w-14 border-indigo-200`} placeholder="0" /></div></td>
                            </>
                            )}
                            <td className="px-4 py-3.5 text-right font-black text-slate-900 dark:text-white">₹{item.total.toFixed(2)}</td>
                            <td className="px-4 py-3.5 text-center"><button onClick={() => onRemoveFromCart(item.batchId)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><TrashIcon className="h-5 w-5" /></button></td>
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
          <Card title="Summary & Checkout">
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <div className="flex justify-between text-sm text-slate-600 mb-2"><span>{t.billing.subtotal}</span><span className="font-bold">₹{cart.reduce((s,i) => s + (i.total / (1 + i.gst / 100)), 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-sm text-slate-600 mb-4"><span>{t.billing.totalGst}</span><span className="font-bold">₹{cart.reduce((s,i) => s + (i.total - (i.total / (1 + i.gst / 100))), 0).toFixed(2)}</span></div>
                <div className="border-t pt-4 flex justify-between items-end"><span className="text-lg font-black uppercase tracking-tighter">{t.billing.grandTotal}</span><span className="text-4xl font-black text-indigo-600">₹{Math.round(cart.reduce((s,i) => s + i.total, 0)).toFixed(2)}</span></div>
              </div>
              <div className="space-y-3">
                <button onClick={() => handleSaveBill(true)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-2xl font-black text-xl shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-3"><PrinterIcon className="h-7 w-7" /> {isEditing ? t.billing.updateAndPrint : t.billing.saveAndPrint}</button>
                <button onClick={() => handleSaveBill(false)} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-4 rounded-xl font-bold transition-all transform active:scale-95">{isEditing ? t.billing.updateOnly : t.billing.saveOnly}</button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal isOpen={isAddCustomerModalOpen} onClose={() => setAddCustomerModalOpen(false)} title="New Customer Entry">
         <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const nc = await onAddCustomer({ name: fd.get('name') as string, phone: fd.get('phone') as string, address: fd.get('address') as string, openingBalance: parseFloat(fd.get('openingBalance') as string) || 0 }); if (nc) { setSelectedCustomer(nc); setCustomerName(nc.name); setAddCustomerModalOpen(false); } }} className="space-y-4">
             <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name*</label><input name="name" className={inputStyle + " w-full p-2"} required /></div>
             <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label><input name="phone" className={inputStyle + " w-full p-2"} /></div>
             <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address</label><input name="address" className={inputStyle + " w-full p-2"} /></div>
             <div className="flex justify-end gap-2 pt-4"><button type="button" onClick={() => setAddCustomerModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-lg">Cancel</button><button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">Save</button></div>
         </form>
      </Modal>

      <PrinterSelectionModal isOpen={isPrinterModalOpen} onClose={() => { setPrinterModalOpen(false); setBillToPrint(null); if (shouldResetAfterPrint) resetBilling(); }} systemConfig={systemConfig} onUpdateConfig={onUpdateConfig} onSelectPrinter={handlePrinterSelection} />
      
      <Modal isOpen={showOrderSuccessModal} onClose={() => setShowOrderSuccessModal(false)} title="Invoice Finalized!" maxWidth="max-w-md">
          <div className="text-center py-4">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600"><CheckCircleIcon className="h-12 w-12" /></div>
              <h4 className="text-2xl font-black uppercase tracking-tighter">Order Success</h4>
              <div className="mt-8 flex flex-col gap-3">
                  <button onClick={() => { if (lastSavedBill) { setBillToPrint(lastSavedBill); setPrinterModalOpen(true); setShowOrderSuccessModal(false); } }} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg">PRINT INVOICE</button>
                  <button onClick={() => { setShowOrderSuccessModal(false); resetBilling(); }} className="w-full py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">START NEW SALE</button>
              </div>
          </div>
      </Modal>

      <TextScannerModal isOpen={showTextScanner} onClose={() => setShowTextScanner(false)} onScan={handleTextScan} isProcessing={isOcrProcessing} />
      <SubstituteModal isOpen={!!substituteTarget} onClose={() => setSubstituteTarget(null)} target={substituteTarget} substitutes={products.filter(p => p.id !== substituteTarget?.id && normalizeCode(p.composition || '') === normalizeCode(substituteTarget?.composition || ''))} onAdd={handleAddToCartLocal} getLiveBatchStock={getLiveBatchStock} formatStock={formatStock} />
      <UpgradeAiModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} featureName="AI Product Scanner" />
    </div>
  );
};

export default Billing;

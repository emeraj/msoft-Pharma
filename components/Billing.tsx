
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import type { Product, Batch, CartItem, Bill, CompanyProfile, SystemConfig, PrinterProfile, Customer, Salesman } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { TrashIcon, SwitchHorizontalIcon, PencilIcon, CameraIcon, PrinterIcon, CheckCircleIcon, ShareIcon, PlusIcon, UserCircleIcon, InformationCircleIcon, BarcodeIcon, XIcon, CloudIcon, SearchIcon } from './icons/Icons';
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
    formatStock: (stock: number, units?: number) => string;
}> = ({ isOpen, onClose, target, substitutes, onAdd, formatStock }) => {
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
                            const availableBatches = p.batches.filter(b => b.stock > 0);
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
                                        {availableBatches.map(b => (
                                            <div key={b.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-colors">
                                                <div className="text-xs">
                                                    <span className="font-mono text-slate-500 dark:text-slate-400">B: {b.batchNumber}</span>
                                                    <span className="mx-2 text-slate-300">|</span>
                                                    <span className="font-black text-indigo-600 dark:text-indigo-400">₹{b.mrp.toFixed(2)}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">Stock: {formatStock(b.stock, p.unitsPerStrip)}</span>
                                                    <button 
                                                        onClick={() => onAdd(p, b)}
                                                        className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg shadow-md hover:bg-indigo-700 active:scale-95 transition-all"
                                                    >
                                                        Add to Cart
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {availableBatches.length === 0 && (
                                            <div className="py-3 text-center border border-dashed border-rose-200 dark:border-rose-900/30 rounded-lg">
                                                <p className="text-[10px] text-rose-500 font-black uppercase tracking-widest">OUT OF STOCK</p>
                                            </div>
                                        )}
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
  customers: Customer[];
  salesmen?: Salesman[];
  companyProfile: CompanyProfile;
  systemConfig: SystemConfig;
  onGenerateBill: (bill: Omit<Bill, 'id' | 'billNumber'>) => Promise<Bill | null>;
  editingBill?: Bill | null;
  onUpdateBill?: (billId: string, billData: Omit<Bill, 'id'>, originalBill: Bill) => Promise<Bill | null>;
  onCancelEdit?: () => void;
  onAddCustomer: (customer: Omit<Customer, 'id' | 'balance'>) => Promise<Customer | null>;
  onAddSalesman?: (salesman: Omit<Salesman, 'id'>) => Promise<Salesman | null>;
  onUpdateConfig: (config: SystemConfig) => void;
  isSubscriptionExpired?: boolean;
  
  // Cloud Cart Sync Props
  cart: CartItem[];
  onAddToCart: (item: CartItem) => Promise<void>;
  onRemoveFromCart: (batchId: string) => Promise<void>;
  onUpdateCartItem: (batchId: string, updates: Partial<CartItem>) => Promise<void>;
}

const inputStyle = "bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

const Billing: React.FC<BillingProps> = ({ products, bills, customers, salesmen, onGenerateBill, companyProfile, systemConfig, editingBill, onUpdateBill, onCancelEdit, onAddCustomer, onAddSalesman, onUpdateConfig, isSubscriptionExpired, cart, onAddToCart, onRemoveFromCart, onUpdateCartItem }) => {
  const isPharmaMode = systemConfig.softwareMode === 'Pharma';
  const isEditing = !!editingBill;
  const isMrpEditable = systemConfig.mrpEditable !== false; 
  const t = getTranslation(systemConfig.language);
  const isFreePlan = (systemConfig.subscription?.planType || 'Free') === 'Free';

  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [isAddCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>('');
  const [isAddSalesmanModalOpen, setAddSalesmanModalOpen] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastAddedBatchIdRef = useRef<string | null>(null);
  
  const cartItemStripInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const cartItemTabInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const cartItemMrpInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

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

  const getExpiryDate = (expiryString: string): Date => {
      if (!expiryString) return new Date('9999-12-31');
      const [year, month] = expiryString.split('-').map(Number);
      return new Date(year, month, 0);
  };

  const formatStock = (stock: number, unitsPerStrip?: number): string => {
      if (stock === 0) return '0 U';
      if (!unitsPerStrip || unitsPerStrip <= 1) return `${stock} U`;
      const strips = Math.floor(stock / unitsPerStrip);
      const looseUnits = stock % unitsPerStrip;
      let result = '';
      if (strips > 0) result += `${strips} S`;
      if (looseUnits > 0) result += `${strips > 0 ? ' + ' : ''}${looseUnits} U`;
      return result || '0 U';
  };

  useEffect(() => {
    if (!isPharmaMode && systemConfig.barcodeScannerOpenByDefault !== false) {
      setShowScanner(true);
    }
  }, [systemConfig.barcodeScannerOpenByDefault, isPharmaMode]);

  useEffect(() => { if (cart.length > 0 && startTimeRef.current === null) { startTimeRef.current = Date.now(); } else if (cart.length === 0) { startTimeRef.current = null; } }, [cart.length]);
  
  useEffect(() => {
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
    const existingItem = cart.find(item => item.productId === product.id && item.batchId === batch.id); 
    const unitsPerStrip = (isPharmaMode && product.unitsPerStrip) ? product.unitsPerStrip : 1; 
    const sellingPrice = batch.saleRate || batch.mrp;
    
    if (existingItem) { 
        if (unitsPerStrip <= 1) { 
            const newLQty = existingItem.looseQty + 1;
            await onUpdateCartItem(existingItem.batchId, { 
                looseQty: newLQty, 
                quantity: newLQty, 
                total: newLQty * (existingItem.mrp) 
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
                total: newTotalUnits * (existingItem.mrp / unitsPerStrip) 
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
            gst: product.gst, 
            total: unitPrice, 
            addedAt: Date.now(), // Client-side timestamp for instant sorting
            ...(isPharmaMode && product.isScheduleH && { isScheduleH: product.isScheduleH }), 
            ...(isPharmaMode && product.composition && { composition: product.composition }), 
            ...(isPharmaMode && product.unitsPerStrip && { unitsPerStrip: product.unitsPerStrip }), 
        }; 
        lastAddedBatchIdRef.current = newItem.batchId; 
        await onAddToCart(newItem); 
    } 
    setSearchTerm(''); 
    setSubstituteTarget(null);
  };

  const handleBarcodeScan = (code: string) => {
    if (isSubscriptionExpired) { alert("Subscription Expired! Scanning is disabled."); return; }
    const product = products.find(p => p.barcode === code);
    if (product) {
        const batch = product.batches.find(b => b.stock > 0);
        if (batch) handleAddToCartLocal(product, batch);
        else alert("Out of stock.");
    } else alert(`Product with barcode ${code} not found.`);
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
        const prompt = `Strictly analyze this product label image. Extract with high precision: 1. Brand Name / Commercial Name. 2. Technical Code / SKU / Part Number / Barcode string. 3. Batch Number. 4. Expiry Date (YYYY-MM or MM/YY). Return ONLY valid JSON: { "name": "...", "technicalCode": "...", "batch": "...", "expiry": "..." }.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ inlineData: { mimeType: 'image/png', data: base64Data } }, { text: prompt }] }],
            config: { 
                responseMimeType: "application/json",
                responseSchema: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, technicalCode: { type: Type.STRING }, batch: { type: Type.STRING }, expiry: { type: Type.STRING } } }
            }
        });
        if (!response.text) throw new Error("No response from AI");
        const detected = JSON.parse(response.text);
        const { name: dName, technicalCode: dCode, batch: dBatch } = detected;
        if ((!dName || dName === "Unknown") && (!dCode || dCode === "Unknown")) {
            alert("Could not identify product.");
            setIsOcrProcessing(false);
            return;
        }
        const normCode = dCode !== "Unknown" ? normalizeCode(dCode) : "";
        const normName = dName !== "Unknown" ? normalizeCode(dName) : "";
        const normBatch = dBatch !== "Unknown" ? normalizeCode(dBatch) : "";
        let bestMatch = products.find(p => normCode !== "" && normalizeCode(p.barcode) === normCode);
        if (!bestMatch && normName !== "") {
            bestMatch = products.find(p => normalizeCode(p.name).includes(normName) || normName.includes(normalizeCode(p.name)));
        }
        if (bestMatch) {
            let targetBatch = dBatch !== "Unknown" ? bestMatch.batches.find(b => normalizeCode(b.batchNumber) === normBatch && b.stock > 0) : undefined;
            if (!targetBatch) targetBatch = [...bestMatch.batches].sort((a, b) => b.stock - a.stock).find(b => b.stock > 0);
            if (targetBatch) {
                await handleAddToCartLocal(bestMatch, targetBatch);
                setScanResultFeedback({ name: bestMatch.name, batch: targetBatch.batchNumber });
                setTimeout(() => setScanResultFeedback(null), 3000);
                setShowTextScanner(false);
            } else {
                alert(`Found ${bestMatch.name} but out of stock.`);
                setShowTextScanner(false);
            }
        } else {
            setSearchTerm(dCode !== "Unknown" ? dCode : dName);
            setShowTextScanner(false);
            alert(`Detected "${dCode !== "Unknown" ? dCode : dName}" but not in inventory.`);
        }
    } catch (e) {
        alert("Scan failed.");
    } finally {
        setIsOcrProcessing(false);
    }
  };

  const customerSuggestions = useMemo(() => { if (!customerName) return []; return customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).slice(0, 5); }, [customerName, customers]);
  const handleSelectCustomer = (customer: Customer) => { setCustomerName(customer.name); setSelectedCustomer(customer); setShowCustomerSuggestions(false); };
  
  const searchResults = useMemo(() => { 
    if (!searchTerm) return []; 
    const lowerSearchTerm = searchTerm.toLowerCase(); 
    const parts = lowerSearchTerm.split(/\s+/);
    const mainTerm = parts[0];
    const maybeMRP = parts.length > 1 ? parseFloat(parts[1]) : null;
    return products.filter(p => {
        const nameMatch = p.name.toLowerCase().includes(mainTerm) || (!isPharmaMode && p.barcode && p.barcode.toLowerCase().includes(mainTerm));
        if (!nameMatch) return false;
        if (maybeMRP !== null) return p.batches.some(b => Math.abs((b.saleRate || b.mrp) - maybeMRP) < 5);
        return true; 
    }).slice(0, 10); 
  }, [searchTerm, products, isPharmaMode]);

  const navigableBatchesByProduct = useMemo(() => { 
      const parts = searchTerm.toLowerCase().split(/\s+/);
      const maybeMRP = parts.length > 1 ? parseFloat(parts[1]) : null;
      return searchResults.map(p => {
          let batches = p.batches.filter(b => b.stock > 0);
          if (maybeMRP !== null) batches.sort((a, b) => Math.abs((a.saleRate || a.mrp) - maybeMRP) - Math.abs((b.saleRate || b.mrp) - maybeMRP));
          else batches.sort((a, b) => isPharmaMode ? (getExpiryDate(a.expiryDate).getTime() - getExpiryDate(b.expiryDate).getTime()) : 0);
          return batches;
      }); 
  }, [searchResults, isPharmaMode, searchTerm]);

  useEffect(() => { if (searchTerm && searchResults.length > 0) { const firstProductIndex = navigableBatchesByProduct.findIndex(batches => batches.length > 0); if (firstProductIndex !== -1) { setActiveIndices({ product: firstProductIndex, batch: 0 }); } else { setActiveIndices({ product: 0, batch: -1 }); } } else { setActiveIndices({ product: -1, batch: -1 }); } }, [searchTerm, searchResults, navigableBatchesByProduct]);
  
  const handleUpdateItemQty = async (batchId: string, stripQty: number, looseQty: number) => { 
      const item = cart.find(i => i.batchId === batchId);
      if (!item) return;
      const product = products.find(p => p.id === item.productId);
      const batch = product?.batches.find(b => b.id === batchId);
      if (!product || !batch) return;

      const unitsPerStrip = (isPharmaMode && product.unitsPerStrip) ? product.unitsPerStrip : 1; 
      let sQty = isPharmaMode && unitsPerStrip > 1 ? Math.max(0, stripQty) : 0; 
      let lQty = Math.max(0, looseQty); 

      if (isPharmaMode && unitsPerStrip > 1 && lQty >= unitsPerStrip) { 
          sQty += Math.floor(lQty / unitsPerStrip); 
          lQty = lQty % unitsPerStrip; 
      } 
      const totalUnits = (sQty * unitsPerStrip) + lQty; 

      if (totalUnits > 0 && totalUnits <= batch.stock) { 
          const unitPrice = item.mrp / (unitsPerStrip > 1 ? unitsPerStrip : 1); 
          await onUpdateCartItem(batchId, { stripQty: sQty, looseQty: lQty, quantity: totalUnits, total: totalUnits * unitPrice }); 
      } else if (totalUnits === 0) {
          await onRemoveFromCart(batchId);
      }
  };

  const updateCartItemMrp = async (batchId: string, updates: { mrp: number, stripQty: number, looseQty: number }) => { 
      const item = cart.find(i => i.batchId === batchId);
      if (!item) return;
      const { mrp, stripQty, looseQty } = updates; 
      const unitsPerStrip = item.unitsPerStrip || 1; 
      const totalUnits = (stripQty * unitsPerStrip) + looseQty; 
      const unitPrice = mrp / (unitsPerStrip > 1 ? unitsPerStrip : 1); 
      await onUpdateCartItem(batchId, { mrp, stripQty, looseQty, quantity: totalUnits, total: totalUnits * unitPrice }); 
  };
  
  const { subTotal, totalGst, grandTotal, roundOff } = useMemo(() => { let subTotal = 0; let totalGst = 0; cart.forEach(item => { const basePrice = item.total / (1 + item.gst / 100); subTotal += basePrice; totalGst += item.total - basePrice; }); const totalAmount = subTotal + totalGst; const grandTotal = Math.round(totalAmount); return { subTotal, totalGst, grandTotal, roundOff: grandTotal - totalAmount }; }, [cart]);

  const executePrint = useCallback(async (bill: Bill, printer: PrinterProfile, forceReset = false) => {
    const doReset = () => { if (isEditing) { if (onCancelEdit) onCancelEdit(); } else resetBillingForm(); setShouldResetAfterPrint(false); };
    const shouldReset = forceReset || shouldResetAfterPrint;

    if (printer.connectionType === 'bluetooth') {
        try {
            const connected = await BluetoothHelper.connect();
            if (connected) {
                const bytes = BluetoothHelper.generateEscPos(bill, companyProfile, isPharmaMode);
                await BluetoothHelper.printRaw(bytes);
                if (shouldReset) doReset();
                return;
            } else {
                alert("Direct connect failed.");
            }
        } catch (e) {
            console.error("Print Error", e);
        }
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        const rootEl = document.createElement('div'); printWindow.document.body.appendChild(rootEl);
        const root = ReactDOM.createRoot(rootEl);
        if (printer.format === 'Thermal') root.render(<ThermalPrintableBill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />);
        else if (printer.format === 'A5') {
            if (printer.orientation === 'Landscape') root.render(<PrintableA5LandscapeBill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />);
            else root.render(<PrintableA5Bill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />);
        } else root.render(<PrintableBill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />);
        setTimeout(() => { printWindow.print(); printWindow.close(); if (shouldReset) doReset(); }, 500);
    }
  }, [companyProfile, systemConfig, shouldResetAfterPrint, isEditing, onCancelEdit, isPharmaMode]);

  const handleSaveBill = useCallback(async (shouldPrint: boolean) => {
    if (isSubscriptionExpired) { alert("Subscription expired."); return; }
    if (cart.length === 0) { alert(t.billing.cartEmpty); return; }
    let savedBill: Bill | null = null;
    const isUpdate = isEditing && editingBill;
    const billData: any = { date: isUpdate ? editingBill.date : new Date().toISOString(), customerName: customerName || t.billing.walkInCustomer, customerId: selectedCustomer ? selectedCustomer.id : null, doctorName: doctorName.trim(), items: cart, subTotal, totalGst, grandTotal, roundOff, paymentMode, salesmanId: selectedSalesmanId || null };
    if (isUpdate && onUpdateBill) savedBill = await onUpdateBill(editingBill.id, { ...billData, billNumber: editingBill.billNumber }, editingBill); else if (!isUpdate && onGenerateBill) savedBill = await onGenerateBill(billData);
    if (savedBill) {
        if (shouldPrint) { const defaultPrinter = systemConfig.printers?.find(p => p.isDefault); if (defaultPrinter) executePrint(savedBill, defaultPrinter, true); else { setBillToPrint(savedBill); setShouldResetAfterPrint(true); setPrinterModalOpen(true); } } 
        else { if (isUpdate) { if(onCancelEdit) onCancelEdit(); return; } setLastSavedBill(savedBill); setShowOrderSuccessModal(true); }
    }
  }, [cart, isEditing, editingBill, onUpdateBill, customerName, selectedCustomer, doctorName, subTotal, totalGst, grandTotal, roundOff, onGenerateBill, systemConfig, executePrint, t, paymentMode, selectedSalesmanId, isSubscriptionExpired]);
  
  const resetBillingForm = () => { setCustomerName(''); setSelectedCustomer(null); setDoctorName(''); setPaymentMode('Cash'); setSelectedSalesmanId(''); startTimeRef.current = null; setOrderSeconds(0); };
  
  const handleKeyDown = (e: React.KeyboardEvent) => { 
    if (searchResults.length === 0) return; 
    const findNext = (current: { product: number; batch: number }) => { let { product, batch } = current; if (product === -1) return { product: 0, batch: navigableBatchesByProduct[0].length > 0 ? 0 : -1 }; const currentProductBatches = navigableBatchesByProduct[product]; if (batch < currentProductBatches.length - 1) return { product, batch: batch + 1 }; let nextProductIndex = product + 1; while (nextProductIndex < navigableBatchesByProduct.length && navigableBatchesByProduct[nextProductIndex].length === 0) nextProductIndex++; if (nextProductIndex < navigableBatchesByProduct.length) return { product: nextProductIndex, batch: 0 }; return current; }; 
    const findPrev = (current: { product: number; batch: number }) => { let { product, batch } = current; if (product === -1) return current; if (batch > 0) return { product, batch: batch - 1 }; let prevProductIndex = product - 1; while (prevProductIndex >= 0 && navigableBatchesByProduct[prevProductIndex].length === 0) prevProductIndex--; if (prevProductIndex >= 0) return { product: prevProductIndex, batch: navigableBatchesByProduct[prevProductIndex].length - 1 }; return current; }; 
    switch (e.key) { case 'ArrowDown': e.preventDefault(); setActiveIndices(findNext); break; case 'ArrowUp': e.preventDefault(); setActiveIndices(findPrev); break; case 'Enter': e.preventDefault(); if (activeIndices.product !== -1 && activeIndices.batch !== -1) { const product = searchResults[activeIndices.product]; const batch = navigableBatchesByProduct[activeIndices.product][activeIndices.batch]; if (product && batch) handleAddToCartLocal(product, batch); } break; case 'Escape': e.preventDefault(); setSearchTerm(''); break; default: break; } 
  };

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            handleSaveBill(true);
        }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [handleSaveBill]);

  const substitutes = useMemo(() => {
      if (!substituteTarget || !substituteTarget.composition) return [];
      const targetComp = substituteTarget.composition.toLowerCase().trim();
      return products.filter(p => p.id !== substituteTarget.id && p.composition && p.composition.toLowerCase().trim() === targetComp);
  }, [substituteTarget, products]);

  return (
    <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      {scanResultFeedback && (
          <div className="fixed top-20 right-4 z-[100] animate-bounce">
              <div className="bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 border-2 border-emerald-400">
                  <CheckCircleIcon className="h-6 w-6" />
                  <div><p className="font-black text-sm uppercase tracking-tighter">Identified & Added</p><p className="text-xs opacity-90">{scanResultFeedback.name}</p></div>
              </div>
          </div>
      )}
      <div className="lg:col-span-2">
        <Card title={
            <div className="flex justify-between items-center w-full">
                <span>{isEditing ? `${t.billing.editBill}` : t.billing.createBill}</span>
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800 animate-pulse">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Cloud Sync Active</span>
                </div>
            </div>
        }>
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex gap-2">
                <div className="relative flex-grow">
                    <input ref={searchInputRef} type="text" placeholder={isPharmaMode ? "Search Medicine or Composition..." : "Search Name or Barcode"} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={handleKeyDown} className={`${inputStyle} w-full px-4 py-3 text-lg font-medium`} />
                    {searchResults.length > 0 && searchTerm && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                        <ul>{searchResults.map((product, productIndex) => {
                            const isOutOfStock = navigableBatchesByProduct[productIndex].length === 0;
                            return (
                                <li key={product.id} className="border-b dark:border-slate-600 last:border-b-0">
                                    <div className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 flex justify-between items-center">
                                        <div className="flex flex-col"><span className={isOutOfStock ? 'text-rose-500' : ''}>{product.name} {isOutOfStock && '(Out of Stock)'}</span>{isPharmaMode && product.composition && <span className="text-[10px] text-slate-500 font-normal uppercase mt-0.5 tracking-tight">{product.composition}</span>}</div>
                                        {isPharmaMode && product.composition && (<button onClick={(e) => { e.stopPropagation(); setSubstituteTarget(product); }} className="px-3 py-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-lg text-[10px] font-black uppercase tracking-tighter hover:bg-indigo-200 transition-all flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 shadow-sm"><SwitchHorizontalIcon className="h-3 w-3" />Alternatives</button>)}
                                    </div>
                                    <ul className="pl-4 pb-2">
                                        {navigableBatchesByProduct[productIndex]?.map((batch, batchIndex) => { 
                                            const isActive = productIndex === activeIndices.product && batchIndex === activeIndices.batch; 
                                            const expiryDate = getExpiryDate(batch.expiryDate);
                                            const today = new Date(); today.setHours(0,0,0,0);
                                            const isExpired = expiryDate < today;
                                            return (
                                                <li key={batch.id} className={`px-4 py-2 flex justify-between items-center transition-colors rounded-md mx-2 my-1 ${isActive ? 'bg-indigo-200 dark:bg-indigo-700' : 'hover:bg-indigo-50 dark:hover:bg-slate-600 cursor-pointer'} ${isExpired ? 'opacity-70' : ''}`} onClick={() => handleAddToCartLocal(product, batch)} onMouseEnter={() => setActiveIndices({ product: productIndex, batch: batchIndex })}>
                                                    <div>{isPharmaMode && (<><span className={`text-sm font-bold ${isExpired ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>B: {batch.batchNumber}</span><span className={`text-xs ml-2 ${isExpired ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-500'}`}>Exp: {batch.expiryDate}</span></>)}</div>
                                                    <div className="flex items-center gap-3"><span className={`font-bold ${isExpired ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>₹{(batch.saleRate || batch.mrp).toFixed(2)}</span><span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${isExpired ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40' : 'bg-green-50 text-green-600 dark:bg-green-900/30'}`}>Stock: {isPharmaMode ? formatStock(batch.stock, product.unitsPerStrip) : `${batch.stock}`}</span></div>
                                                </li>
                                            ); 
                                        })}
                                    </ul>
                                </li>
                            );
                        })}</ul></div>)}
                </div>
                <div className="flex gap-1">
                    <button onClick={() => setShowScanner(true)} className="p-3 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex flex-col items-center justify-center min-w-[80px]"><BarcodeIcon className="h-6 w-6" /><span className="text-[10px] font-extrabold mt-1 uppercase tracking-tighter">BARCODE</span></button>
                    <button onClick={handleAiScanClick} className={`p-3 rounded-lg flex flex-col items-center justify-center min-w-[80px] transition-colors ${isFreePlan ? 'bg-slate-100 text-slate-400 grayscale' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}><CameraIcon className="h-6 w-6" /><span className="text-[10px] font-extrabold mt-1 uppercase tracking-tighter">AI SCAN</span></button>
                </div>
            </div>
          </div>
          <div className="mt-6"><h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">{t.billing.cartItems}</h3><div className="overflow-x-auto max-h-[calc(100vh-380px)]">{cart.length > 0 ? (<table className="w-full text-sm text-left text-slate-800 dark:text-slate-300"><thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700 sticky top-0"><tr><th scope="col" className="px-2 py-3">{t.billing.product}</th>{isPharmaMode && <th scope="col" className="px-2 py-3">{t.billing.pack}</th>}{isPharmaMode && <th scope="col" className="px-2 py-3">{t.billing.batch}</th>}{isPharmaMode && <th scope="col" className="px-2 py-3">{t.billing.strip}</th>}<th scope="col" className="px-2 py-3">{isPharmaMode ? t.billing.tabs : t.billing.qty}</th><th scope="col" className="px-2 py-3">{t.billing.mrp}</th><th scope="col" className="px-2 py-3">{t.billing.amount}</th><th scope="col" className="px-2 py-3">{t.billing.action}</th></tr></thead><tbody>{cart.map(item => (<tr key={item.batchId} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"><td className="px-2 py-3 font-medium text-slate-900 dark:text-white">{item.productName}{isPharmaMode && item.isScheduleH && <span className="ml-1 text-xs font-semibold text-orange-600 dark:text-orange-500">(Sch. H)</span>}</td>{isPharmaMode && <td className="px-2 py-3">{item.unitsPerStrip ? `1*${item.unitsPerStrip}`: '-'}</td>}{isPharmaMode && <td className="px-2 py-3">{item.batchNumber}</td>}{isPharmaMode && (<td className="px-2 py-3"><input ref={(el) => { cartItemStripInputRefs.current.set(item.batchId, el); }} type="text" inputMode="numeric" value={item.stripQty} onChange={e => handleUpdateItemQty(item.batchId, parseInt(e.target.value) || 0, item.looseQty)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); cartItemTabInputRefs.current.get(item.batchId)?.focus(); cartItemTabInputRefs.current.get(item.batchId)?.select(); } }} className={`w-14 p-1 text-center ${inputStyle}`} disabled={!item.unitsPerStrip || item.unitsPerStrip <= 1} /></td>)}<td className="px-2 py-3"><input ref={(el) => { cartItemTabInputRefs.current.set(item.batchId, el); }} type="text" inputMode="numeric" value={item.looseQty} onChange={e => handleUpdateItemQty(item.batchId, item.stripQty, parseInt(e.target.value) || 0)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (isMrpEditable) { cartItemMrpInputRefs.current.get(item.batchId)?.focus(); cartItemMrpInputRefs.current.get(item.batchId)?.select(); } else { searchInputRef.current?.focus(); searchInputRef.current?.select(); } } }} className={`w-14 p-1 text-center ${inputStyle}`} /></td><td className="px-2 py-3">{isMrpEditable ? (<input ref={(el) => { cartItemMrpInputRefs.current.set(item.batchId, el); }} type="number" step="0.01" value={item.mrp} onChange={(e) => updateCartItemMrp(item.batchId, { mrp: parseFloat(e.target.value) || 0, stripQty: item.stripQty, looseQty: item.looseQty })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchInputRef.current?.focus(); searchInputRef.current?.select(); } }} className={`w-20 p-1 text-center ${inputStyle}`} />) : (<span>₹{item.mrp.toFixed(2)}</span>)}</td><td className="px-2 py-3 font-semibold">₹{item.total.toFixed(2)}</td><td className="px-2 py-3"><div className="flex items-center gap-2"><button onClick={() => onRemoveFromCart(item.batchId)} className="text-red-500 hover:text-red-700"><TrashIcon className="h-5 w-5" /></button></div></td></tr>))}</tbody></table>) : (<div className="text-center py-10 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg"><p>{t.billing.cartEmpty}</p></div>)}</div></div>
        </Card>
      </div>
      <div className="lg:col-span-1">
        <Card title="Bill Summary" className="sticky top-20">
            {isSubscriptionExpired ? (
                <div className="bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-500 rounded-xl p-6 text-center animate-pulse-subtle">
                    <div className="flex justify-center mb-3"><div className="p-3 bg-rose-100 dark:bg-rose-900/40 rounded-full"><CloudIcon className="h-10 w-10 text-rose-600" /></div></div>
                    <h3 className="text-lg font-black text-rose-600 dark:text-rose-400 uppercase tracking-tighter">Billing Disabled</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">Your subscription has expired. Please renew.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="relative"><label className="block text-sm font-medium text-slate-800 dark:text-slate-200">{isPharmaMode ? t.billing.patientName : t.billing.customerName}</label><div className="flex gap-2"><div className="relative flex-grow"><input type="text" value={customerName} onChange={e => { setCustomerName(e.target.value); setSelectedCustomer(null); }} onFocus={() => setShowCustomerSuggestions(true)} onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)} placeholder={isPharmaMode ? t.billing.walkInPatient : t.billing.walkInCustomer} className={`mt-1 block w-full px-3 py-2 ${inputStyle}`} autoComplete="off" />{showCustomerSuggestions && customerSuggestions.length > 0 && (<ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">{customerSuggestions.map(customer => (<li key={customer.id} onClick={() => handleSelectCustomer(customer)} className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer text-sm text-slate-800 dark:text-slate-200">{customer.name}</li>))}</ul>)}</div><button onClick={() => setAddCustomerModalOpen(true)} className="mt-1 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><PlusIcon className="h-5 w-5" /></button></div></div>
                    {isPharmaMode && (<div><label className="block text-sm font-medium text-slate-800 dark:text-slate-200">{t.billing.doctorName}</label><input type="text" value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="e.g. Dr. Name" className={`mt-1 block w-full px-3 py-2 ${inputStyle}`} /></div>)}
                    <div className="border-t dark:border-slate-700 pt-4 space-y-2 text-slate-700 dark:text-slate-300"><div className="flex justify-between"><span>{t.billing.subtotal}</span><span>₹{subTotal.toFixed(2)}</span></div><div className="flex justify-between"><span>{t.billing.totalGst}</span><span>₹{totalGst.toFixed(2)}</span></div><div className="flex justify-between text-2xl font-bold text-slate-800 dark:text-slate-100 pt-2 border-t dark:border-slate-600 mt-2"><span>{t.billing.grandTotal}</span><span>₹{grandTotal.toFixed(2)}</span></div></div>
                    <div className="pt-2 flex gap-2"><button onClick={() => handleSaveBill(true)} disabled={cart.length === 0} className={`flex-1 text-white py-3 rounded-lg text-sm font-semibold shadow-md transition-colors duration-200 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-1 ${isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}><PrinterIcon className="h-5 w-5" /> {isEditing ? "Update & Print" : t.billing.saveAndPrint}</button><button onClick={() => handleSaveBill(false)} disabled={cart.length === 0} className={`flex-1 text-white py-3 rounded-lg text-sm font-semibold shadow-md transition-colors duration-200 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-1 ${isEditing ? 'bg-slate-600 hover:bg-slate-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{isEditing ? "Update Only" : "Save Only"}</button></div>
                </div>
            )}
        </Card>
      </div>
      <TextScannerModal isOpen={showTextScanner} onClose={() => setShowTextScanner(false)} onScan={handleTextScan} isProcessing={isOcrProcessing} />
      <SubstituteModal isOpen={!!substituteTarget} onClose={() => setSubstituteTarget(null)} target={substituteTarget} substitutes={substitutes} onAdd={handleAddToCartLocal} formatStock={formatStock} />
      <BarcodeScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} onScanSuccess={handleBarcodeScan} />
      <PrinterSelectionModal isOpen={isPrinterModalOpen} onClose={() => { setPrinterModalOpen(false); setBillToPrint(null); }} systemConfig={systemConfig} onUpdateConfig={onUpdateConfig} onSelectPrinter={(printer) => { if (billToPrint) { executePrint(billToPrint, printer); setBillToPrint(null); } }} />
      <UpgradeAiModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} featureName="Smart AI Bill Entry" />
    </div>
  );
};

export default Billing;

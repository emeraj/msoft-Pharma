
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import type { Product, Batch, CartItem, Bill, CompanyProfile, SystemConfig, PrinterProfile, Customer, Salesman } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { TrashIcon, SwitchHorizontalIcon, PencilIcon, CameraIcon, PrinterIcon, CheckCircleIcon, ShareIcon, PlusIcon, UserCircleIcon, InformationCircleIcon, BarcodeIcon, XIcon } from './icons/Icons';
import ThermalPrintableBill from './ThermalPrintableBill';
import PrintableA5Bill from './PrintableA5Bill';
import PrintableBill from './PrintableBill'; 
import PrinterSelectionModal from './PrinterSelectionModal';
import BarcodeScannerModal, { EmbeddedScanner } from './BarcodeScannerModal';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getTranslation } from '../utils/translationHelper';

// OCR Scanner Component - Manual Trigger with Part Number Focus
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
                const dataUrl = canvas.toDataURL('image/png', 0.9);
                onScan(dataUrl);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="AI Part Number Scanner" maxWidth="max-w-xl">
            <div className="space-y-4">
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border-4 border-indigo-600 shadow-2xl">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-2/3 h-1/4 border-4 border-red-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center">
                            <div className="text-[10px] text-white bg-red-500 px-3 py-0.5 rounded-full absolute -top-3 font-bold uppercase tracking-widest whitespace-nowrap">
                                TARGET PART NO
                            </div>
                            <div className={`w-full h-0.5 bg-red-500/50 ${isProcessing ? 'hidden' : 'animate-pulse'}`}></div>
                        </div>
                    </div>
                    {isProcessing && (
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white z-20">
                            <div className="animate-spin h-10 w-10 border-4 border-indigo-400 border-t-transparent rounded-full mb-3 shadow-lg"></div>
                            <p className="font-bold text-xs bg-indigo-600 px-3 py-1 rounded-full border border-indigo-400">ANALYZING PART NO...</p>
                        </div>
                    )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={handleCapture} 
                        disabled={isProcessing} 
                        className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        <CameraIcon className="h-7 w-7" /> CAPTURE & IDENTIFY
                    </button>
                    <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-xl flex items-start gap-3 border border-slate-200 dark:border-slate-600">
                        <InformationCircleIcon className="h-5 w-5 text-indigo-500 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Point at the Part Number</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                Center the **Part Number** label inside the box and tap Capture. The AI filters out price and generic text to find the exact item.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const MatchResolutionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    candidates: Array<{ product: Product; batch: Batch; score: number }>;
    onSelect: (product: Product, batch: Batch) => void;
}> = ({ isOpen, onClose, candidates, onSelect }) => {
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Select Correct Item" maxWidth="max-w-md">
            <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">Matches found based on Part No:</p>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                    {candidates.map((c, i) => (
                        <button key={i} onClick={() => onSelect(c.product, c.batch)} className="w-full p-4 border dark:border-slate-700 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-left transition-all active:scale-95 group">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-600">{c.product.name}</p>
                                    <p className="text-xs text-slate-500">{c.product.company}</p>
                                </div>
                                <span className="text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">₹{(c.batch.saleRate || c.batch.mrp).toFixed(2)}</span>
                            </div>
                            <div className="mt-2 text-[10px] text-slate-400 flex justify-between">
                                <span>Batch: {c.batch.batchNumber}</span>
                                <span>Exp: {c.batch.expiryDate}</span>
                            </div>
                        </button>
                    ))}
                </div>
                <button onClick={onClose} className="w-full py-3 bg-slate-200 dark:bg-slate-700 rounded-lg font-medium text-slate-700 dark:text-slate-300">Close</button>
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
}

const inputStyle = "bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
const modalInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";

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

const generateEscPosBill = (bill: Bill, profile: CompanyProfile, config: SystemConfig): number[] => {
    const commands: number[] = [];
    const ESC = 27; const GS = 29; const LF = 10; const PRINTER_WIDTH = 42; 
    const addBytes = (bytes: number[]) => { commands.push(...bytes); };
    const addText = (text: string) => {
        const safeText = text.replace(/₹/g, 'Rs.');
        for (let i = 0; i < safeText.length; i++) {
            let code = safeText.charCodeAt(i);
            if (code > 255) code = 63;
            commands.push(code);
        }
    };
    const addRow = (left: string, right: string) => {
        const space = PRINTER_WIDTH - left.length - right.length;
        if (space < 1) { addText(left + " " + right + "\n"); } else { addText(left + " ".repeat(space) + right + "\n"); }
    };
    addBytes([ESC, 64]);
    addBytes([ESC, 97, 1]); addBytes([ESC, 69, 1]); addText(profile.name + '\n'); addBytes([ESC, 69, 0]);
    addText(profile.address + '\n');
    if (profile.phone) addText('Ph: ' + profile.phone + '\n');
    if (profile.gstin) addText('GSTIN: ' + profile.gstin + '\n');
    addText('-'.repeat(PRINTER_WIDTH) + '\n');
    addBytes([ESC, 97, 0]); addText("TAX INVOICE\n"); addText('-'.repeat(PRINTER_WIDTH) + '\n');
    addRow('Bill No: ' + bill.billNumber, 'Date: ' + new Date(bill.date).toLocaleDateString());
    addText('Customer: ' + bill.customerName + '\n');
    addText('-'.repeat(PRINTER_WIDTH) + '\n');
    const col1W = 18; const col2W = 4; const col3W = 9; const col4W = 11;
    addBytes([ESC, 69, 1]);
    const headerLine = "Item".padEnd(col1W) + "Qty".padStart(col2W) + "Rate".padStart(col3W) + "Amount".padStart(col4W) + "\n";
    addText(headerLine);
    addBytes([ESC, 69, 0]);
    addText('-'.repeat(PRINTER_WIDTH) + '\n');
    bill.items.forEach((item, index) => {
        addBytes([ESC, 69, 1]); addText(`${index + 1}. ${item.productName}\n`); addBytes([ESC, 69, 0]);
        const qty = item.quantity.toString();
        const rate = (item.total / item.quantity > 0 ? (item.total / item.quantity).toFixed(2) : '0.00');
        const amount = item.total.toFixed(2);
        const spacer = " ".repeat(col1W);
        addText(spacer + qty.padStart(col2W) + rate.padStart(col3W) + amount.padStart(col4W) + "\n");
    });
    addText('-'.repeat(PRINTER_WIDTH) + '\n');
    addRow('Subtotal:', bill.subTotal.toFixed(2));
    addRow('Total GST:', bill.totalGst.toFixed(2));
    if (bill.roundOff && Math.abs(bill.roundOff) > 0.005) { addRow('Round Off:', (bill.roundOff > 0 ? '+' : '') + bill.roundOff.toFixed(2)); }
    addText('-'.repeat(PRINTER_WIDTH) + '\n');
    addBytes([ESC, 69, 1]); addText(`GRAND TOTAL:    Rs.${bill.grandTotal.toFixed(2)}\n`); addBytes([ESC, 69, 0]);
    addText('-'.repeat(PRINTER_WIDTH) + '\n');
    addText(" ".repeat(15) + "GST SUMMARY\n");
    addText( "Rate".padEnd(6) + "Taxable".padStart(12) + "CGST".padStart(12) + "SGST".padStart(12) + "\n");
    const gstMap = new Map<number, {taxable: number, tax: number}>();
    bill.items.forEach(item => {
        const taxable = item.total / (1 + item.gst/100);
        const tax = item.total - taxable;
        const existing = gstMap.get(item.gst) || {taxable: 0, tax: 0};
        gstMap.set(item.gst, {taxable: existing.taxable + taxable, tax: existing.tax + tax});
    });
    Array.from(gstMap.entries()).sort((a,b) => a[0] - b[0]).forEach(([rate, data]) => {
         addText(`${rate}%`.padEnd(6) + data.taxable.toFixed(2).padStart(12) + (data.tax/2).toFixed(2).padStart(12) + (data.tax/2).toFixed(2).padStart(12) + "\n");
    });
    addText('-'.repeat(PRINTER_WIDTH) + '\n');
    addBytes([ESC, 97, 1]);
    if(config.remarkLine1) addText(config.remarkLine1 + '\n');
    if(config.remarkLine2) addText(config.remarkLine2 + '\n');
    if (profile.upiId && bill.grandTotal > 0) {
        const upiStr = `upi://pay?pa=${profile.upiId}&pn=${encodeURIComponent(profile.name.substring(0, 20))}&am=${bill.grandTotal.toFixed(2)}&cu=INR`;
        const len = upiStr.length + 3; const pL = len % 256; const pH = Math.floor(len / 256);
        addText('\nScan to Pay using UPI\n');
        addBytes([GS, 40, 107, 4, 0, 49, 65, 50, 0]);
        addBytes([GS, 40, 107, 3, 0, 49, 67, 6]); 
        addBytes([GS, 40, 107, 3, 0, 49, 69, 48]);
        addBytes([GS, 40, 107, pL, pH, 49, 80, 48]);
        for (let i = 0; i < upiStr.length; i++) { commands.push(upiStr.charCodeAt(i)); }
        addBytes([GS, 40, 107, 3, 0, 49, 81, 48]);
        addText('\n');
    }
    addBytes([LF, LF, LF, LF, LF]); 
    addBytes([GS, 86, 66, 0]);
    return commands;
};

const Billing: React.FC<BillingProps> = ({ products, bills, customers, salesmen, onGenerateBill, companyProfile, systemConfig, editingBill, onUpdateBill, onCancelEdit, onAddCustomer, onAddSalesman }) => {
  const isPharmaMode = systemConfig.softwareMode === 'Pharma';
  const isEditing = !!editingBill;
  const isMrpEditable = systemConfig.mrpEditable !== false; 
  const t = getTranslation(systemConfig.language);

  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
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
  const activeItemRef = useRef<HTMLLIElement>(null);
  const [itemToEdit, setItemToEdit] = useState<{item: CartItem, maxStock: number} | null>(null);
  const [showOrderSuccessModal, setShowOrderSuccessModal] = useState(false);
  const [lastSavedBill, setLastSavedBill] = useState<Bill | null>(null);
  const [orderSeconds, setOrderSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  const [showTextScanner, setShowTextScanner] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [resolutionData, setResolutionData] = useState<{ isOpen: boolean; candidates: any[] }>({ isOpen: false, candidates: [] });

  useEffect(() => {
    if (isPharmaMode) { setShowScanner(false); } else { setShowScanner(systemConfig.barcodeScannerOpenByDefault !== false); }
  }, [systemConfig.barcodeScannerOpenByDefault, isPharmaMode]);

  useEffect(() => { if (cart.length > 0 && startTimeRef.current === null) { startTimeRef.current = Date.now(); } else if (cart.length === 0) { startTimeRef.current = null; } }, [cart.length]);
  
  useEffect(() => {
    if (lastAddedBatchIdRef.current) {
        const newItem = cart.find(item => item.batchId === lastAddedBatchIdRef.current);
        let inputToFocus: HTMLInputElement | null | undefined = null;
        if (newItem && isPharmaMode && newItem.unitsPerStrip && newItem.unitsPerStrip > 1) { inputToFocus = cartItemStripInputRefs.current.get(lastAddedBatchIdRef.current); } else { inputToFocus = cartItemTabInputRefs.current.get(lastAddedBatchIdRef.current); }
        if (inputToFocus) { inputToFocus.focus(); inputToFocus.select(); }
        lastAddedBatchIdRef.current = null;
    }
  }, [cart, isPharmaMode]);

  useEffect(() => {
    if (editingBill) {
      setCart(editingBill.items);
      setCustomerName(editingBill.customerName);
      const existingCust = customers.find(c => c.id === editingBill.customerId || c.name === editingBill.customerName);
      setSelectedCustomer(existingCust || null);
      setDoctorName(editingBill.doctorName || '');
      if (editingBill.paymentMode) { setPaymentMode(editingBill.paymentMode); }
      if (editingBill.salesmanId) { setSelectedSalesmanId(editingBill.salesmanId); } else { setSelectedSalesmanId(''); }
    } else {
      setCart([]); setCustomerName(''); setSelectedCustomer(null); setDoctorName(''); setPaymentMode('Cash'); setSelectedSalesmanId('');
    }
  }, [editingBill, customers]);

  const handleAddToCart = (product: Product, batch: Batch) => { 
    if (isPharmaMode) { 
        const expiry = getExpiryDate(batch.expiryDate); 
        const todayNoTime = new Date(); todayNoTime.setHours(0,0,0,0);
        if (expiry < todayNoTime) { alert(`Expired: ${product.name} (B: ${batch.batchNumber})`); return; } 
    } 
    const existingItem = cart.find(item => item.productId === product.id && item.batchId === batch.id); 
    const unitsPerStrip = (isPharmaMode && product.unitsPerStrip) ? product.unitsPerStrip : 1; 
    
    // Determine selling price: Use saleRate if available, else MRP
    const sellingPrice = batch.saleRate || batch.mrp;
    
    if (existingItem) { 
        if (unitsPerStrip <= 1) { updateCartItem(existingItem.batchId, 0, existingItem.looseQty + 1); } 
        else { const newTotalUnits = existingItem.quantity + 1; const newStripQty = Math.floor(newTotalUnits / unitsPerStrip); const newLooseQty = newTotalUnits % unitsPerStrip; updateCartItem(existingItem.batchId, newStripQty, newLooseQty); } 
    } else { 
        const unitPrice = sellingPrice / unitsPerStrip; 
        const newItem: CartItem = { productId: product.id, productName: product.name, batchId: batch.id, batchNumber: batch.batchNumber, expiryDate: batch.expiryDate, hsnCode: product.hsnCode, stripQty: 0, looseQty: 1, quantity: 1, mrp: sellingPrice, gst: product.gst, total: unitPrice, ...(isPharmaMode && product.isScheduleH && { isScheduleH: product.isScheduleH }), ...(isPharmaMode && product.composition && { composition: product.composition }), ...(isPharmaMode && product.unitsPerStrip && { unitsPerStrip: product.unitsPerStrip }), }; 
        lastAddedBatchIdRef.current = newItem.batchId; 
        setCart(currentCart => [...currentCart, newItem]); 
    } 
    setSearchTerm(''); 
  };

  const handleTextScan = async (imageData: string) => {
    const { Tesseract } = window as any;
    if (!Tesseract) return;
    setIsOcrProcessing(true);
    try {
        const { data: { text } } = await Tesseract.recognize(imageData, 'eng');
        const blacklist = ["COLD", "DRINK", "BOTTLE", "INGREDIENTS", "NUTRITION", "VALUE", "PRODUCT", "STORE", "KEEP", "PLACE", "MANUFACTURED", "BATCH", "EXP", "DATE", "PACK"];
        const words = text.split(/\s+/).map((w: string) => w.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
            .filter((w: string) => w.length >= 4 && !blacklist.some(b => w.includes(b)));
        
        const candidateMatches: Array<{ product: Product; batch: Batch; score: number }> = [];
        products.forEach(p => {
            let score = 0;
            const barcode = (p.barcode || '').toUpperCase();
            const name = p.name.toUpperCase();
            words.forEach((word: string) => {
                if (barcode === word) score += 100;
                else if (barcode.includes(word) && word.length >= 5) score += 60;
                else if (name.includes(word)) score += 20;
            });
            if (score > 0) {
                p.batches.forEach(b => {
                    if (b.stock <= 0) return;
                    candidateMatches.push({ product: p, batch: b, score });
                });
            }
        });

        candidateMatches.sort((a, b) => b.score - a.score);

        if (candidateMatches.length > 0) {
            const topMatch = candidateMatches[0];
            if (topMatch.score >= 100 || (candidateMatches.length === 1 && topMatch.score >= 60)) {
                handleAddToCart(topMatch.product, topMatch.batch);
                setShowTextScanner(false);
            } else if (topMatch.score >= 40) {
                setResolutionData({ isOpen: true, candidates: candidateMatches.slice(0, 5) });
                setShowTextScanner(false);
            } else {
                alert("Low confidence match. Try to hold the Part No center in the target box.");
            }
        } else {
            alert("No matching Part Number found in inventory. Please check focus.");
        }
    } catch (e) {
        console.error("AI Scan error:", e);
        alert("Scan failed. Try again.");
    } finally { setIsOcrProcessing(false); }
  };

  const handleBarcodeScan = (code: string) => {
    const product = products.find(p => p.barcode === code);
    if (product) {
        const batch = product.batches.find(b => b.stock > 0);
        if (batch) handleAddToCart(product, batch);
        else alert("Out of stock.");
    } else alert(`Product with barcode ${code} not found.`);
  };

  const customerSuggestions = useMemo(() => { if (!customerName) return []; return customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).slice(0, 5); }, [customerName, customers]);
  const handleSelectCustomer = (customer: Customer) => { setCustomerName(customer.name); setSelectedCustomer(customer); setShowCustomerSuggestions(false); };
  const handleAddNewCustomer = async (custData: Omit<Customer, 'id' | 'balance'>) => { const newCust = await onAddCustomer(custData); if (newCust) { setCustomerName(newCust.name); setSelectedCustomer(newCust); } return newCust; };
  const handleAddNewSalesman = async (data: Omit<Salesman, 'id'>) => { if (onAddSalesman) { const newSalesman = await onAddSalesman(data); if (newSalesman) { setSelectedSalesmanId(newSalesman.id); } return newSalesman; } return null; };
  const doctorList = useMemo(() => { const doctors = new Set<string>(); bills.forEach(bill => { if (bill.doctorName) { doctors.add(bill.doctorName); } }); return Array.from(doctors).sort(); }, [bills]);
  
  const searchResults = useMemo(() => { 
    if (!searchTerm) return []; 
    const lowerSearchTerm = searchTerm.toLowerCase(); 
    const parts = lowerSearchTerm.split(/\s+/);
    const mainTerm = parts[0];
    const maybeMRP = parts.length > 1 ? parseFloat(parts[1]) : null;
    return products.filter(p => {
        const nameMatch = p.name.toLowerCase().includes(mainTerm) || (!isPharmaMode && p.barcode && p.barcode.includes(mainTerm));
        if (!nameMatch) return false;
        if (maybeMRP !== null) return p.batches.some(b => b.stock > 0 && Math.abs((b.saleRate || b.mrp) - maybeMRP) < 2);
        return p.batches.some(b => b.stock > 0);
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

  useEffect(() => { if (searchTerm && searchResults.length > 0) { const firstProductIndex = navigableBatchesByProduct.findIndex(batches => batches.length > 0); if (firstProductIndex !== -1) { setActiveIndices({ product: firstProductIndex, batch: 0 }); } else { setActiveIndices({ product: -1, batch: -1 }); } } else { setActiveIndices({ product: -1, batch: -1 }); } }, [searchTerm, searchResults, navigableBatchesByProduct]);
  
  const updateCartItem = (batchId: string, stripQty: number, looseQty: number) => { setCart(currentCart => currentCart.map(item => { if (item.batchId === batchId) { const product = products.find(p => p.id === item.productId); const batch = product?.batches.find(b => b.id === batchId); if (!product || !batch) return item; const unitsPerStrip = (isPharmaMode && product.unitsPerStrip) ? product.unitsPerStrip : 1; let sQty = isPharmaMode && unitsPerStrip > 1 ? Math.max(0, stripQty) : 0; let lQty = Math.max(0, looseQty); if (isPharmaMode && unitsPerStrip > 1 && lQty >= unitsPerStrip) { sQty += Math.floor(lQty / unitsPerStrip); lQty = lQty % unitsPerStrip; } const totalUnits = (sQty * unitsPerStrip) + lQty; if (totalUnits > 0 && totalUnits <= batch.stock) { const unitPrice = item.mrp / (unitsPerStrip > 1 ? unitsPerStrip : 1); return { ...item, stripQty: sQty, looseQty: lQty, quantity: totalUnits, total: totalUnits * unitPrice }; } else if (totalUnits === 0) return { ...item, stripQty: 0, looseQty: 0, quantity: 0, total: 0 }; } return item; })); };
  const updateCartItemDetails = (batchId: string, updates: { mrp: number, stripQty: number, looseQty: number }) => { setCart(currentCart => currentCart.map(item => { if (item.batchId === batchId) { const { mrp, stripQty, looseQty } = updates; const unitsPerStrip = item.unitsPerStrip || 1; const totalUnits = (stripQty * unitsPerStrip) + looseQty; const unitPrice = mrp / (unitsPerStrip > 1 ? unitsPerStrip : 1); return { ...item, mrp, stripQty, looseQty, quantity: totalUnits, total: totalUnits * unitPrice }; } return item; })); };
  const openEditItemModal = (item: CartItem) => { const product = products.find(p => p.id === item.productId); const batch = product?.batches.find(b => b.id === item.batchId); if (product && batch) setItemToEdit({ item, maxStock: batch.stock }); else setItemToEdit({ item, maxStock: item.quantity + 100 }); };
  
  const { subTotal, totalGst, grandTotal, roundOff } = useMemo(() => { let subTotal = 0; let totalGst = 0; cart.forEach(item => { const basePrice = item.total / (1 + item.gst / 100); subTotal += basePrice; totalGst += item.total - basePrice; }); const totalAmount = subTotal + totalGst; const grandTotal = Math.round(totalAmount); return { subTotal, totalGst, grandTotal, roundOff: grandTotal - totalAmount }; }, [cart]);

  const executePrint = useCallback(async (bill: Bill, printer: PrinterProfile, forceReset = false) => {
    const doReset = () => { if (isEditing) { if (onCancelEdit) onCancelEdit(); } else resetBillingForm(); setShouldResetAfterPrint(false); };
    const shouldReset = forceReset || shouldResetAfterPrint;
    if (printer.connectionType === 'rawbt') {
        const data = generateEscPosBill(bill, companyProfile, systemConfig);
        const base64 = btoa(data.reduce((acc, byte) => acc + String.fromCharCode(byte), ''));
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (isAndroid) { const intentUrl = `intent:base64,${base64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`; const a = document.createElement('a'); a.href = intentUrl; a.style.display = 'none'; document.body.appendChild(a); a.click(); document.body.removeChild(a); } else { window.location.href = `rawbt:base64,${base64}`; }
        if (shouldReset) setTimeout(doReset, 1000);
        return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        const style = printWindow.document.createElement('style'); style.innerHTML = `@page { size: auto; margin: 0mm; } body { margin: 0; }`; printWindow.document.head.appendChild(style);
        const rootEl = document.createElement('div'); printWindow.document.body.appendChild(rootEl);
        const root = ReactDOM.createRoot(rootEl);
        if (printer.format === 'Thermal') root.render(<ThermalPrintableBill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />); else if (printer.format === 'A5') root.render(<PrintableA5Bill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />); else root.render(<PrintableBill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />);
        setTimeout(() => { printWindow.print(); printWindow.close(); if (shouldReset) doReset(); }, 500);
    }
  }, [companyProfile, systemConfig, shouldResetAfterPrint, isEditing, onCancelEdit]);

  const handleSaveBill = useCallback(async (shouldPrint: boolean) => {
    if (cart.length === 0) { alert(t.billing.cartEmpty); return; }
    let savedBill: Bill | null = null;
    const isUpdate = isEditing && editingBill;
    const salesmanName = salesmen?.find(s => s.id === selectedSalesmanId)?.name;
    const billData: any = { date: isUpdate ? editingBill.date : new Date().toISOString(), customerName: customerName || t.billing.walkInCustomer, customerId: selectedCustomer ? selectedCustomer.id : null, doctorName: doctorName.trim(), items: cart, subTotal, totalGst, grandTotal, roundOff, paymentMode, salesmanId: selectedSalesmanId || null, salesmanName: salesmanName || null, };
    if (isUpdate && onUpdateBill) savedBill = await onUpdateBill(editingBill.id, { ...billData, billNumber: editingBill.billNumber }, editingBill); else if (!isUpdate && onGenerateBill) savedBill = await onGenerateBill(billData);
    if (savedBill) {
        if (shouldPrint) { const defaultPrinter = systemConfig.printers?.find(p => p.isDefault); if (defaultPrinter) executePrint(savedBill, defaultPrinter, true); else { setBillToPrint(savedBill); setShouldResetAfterPrint(true); setPrinterModalOpen(true); } } 
        else { if (isUpdate) { if(onCancelEdit) onCancelEdit(); return; } if (startTimeRef.current) setOrderSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000)); setLastSavedBill(savedBill); setShowOrderSuccessModal(true); }
    }
  }, [cart, isEditing, editingBill, onUpdateBill, customerName, selectedCustomer, doctorName, subTotal, totalGst, grandTotal, roundOff, onGenerateBill, systemConfig, executePrint, t, paymentMode, selectedSalesmanId, salesmen]);
  
  const resetBillingForm = () => { setCart([]); setCustomerName(''); setSelectedCustomer(null); setDoctorName(''); setPaymentMode('Cash'); setSelectedSalesmanId(''); startTimeRef.current = null; setOrderSeconds(0); };
  
  const handleKeyDown = (e: React.KeyboardEvent) => { 
    if (searchResults.length === 0 || navigableBatchesByProduct.every(b => b.length === 0)) return; 
    const findNext = (current: { product: number; batch: number }) => { let { product, batch } = current; if (product === -1) { const firstProductIndex = navigableBatchesByProduct.findIndex(batches => batches.length > 0); return firstProductIndex !== -1 ? { product: firstProductIndex, batch: 0 } : current; } const currentProductBatches = navigableBatchesByProduct[product]; if (batch < currentProductBatches.length - 1) return { product, batch: batch + 1 }; let nextProductIndex = product + 1; while (nextProductIndex < navigableBatchesByProduct.length && navigableBatchesByProduct[nextProductIndex].length === 0) nextProductIndex++; if (nextProductIndex < navigableBatchesByProduct.length) return { product: nextProductIndex, batch: 0 }; const firstValidIndex = navigableBatchesByProduct.findIndex(batches => batches.length > 0); return firstValidIndex !== -1 ? { product: firstValidIndex, batch: 0 } : current; }; 
    const findPrev = (current: { product: number; batch: number }) => { let { product, batch } = current; if (product === -1) { let lastProductIndex = navigableBatchesByProduct.length - 1; while (lastProductIndex >= 0 && navigableBatchesByProduct[lastProductIndex].length === 0) lastProductIndex--; return lastProductIndex !== -1 ? { product: lastProductIndex, batch: navigableBatchesByProduct[lastProductIndex].length - 1 } : current; } if (batch > 0) return { product, batch: batch - 1 }; let prevProductIndex = product - 1; while (prevProductIndex >= 0 && navigableBatchesByProduct[prevProductIndex].length === 0) prevProductIndex--; if (prevProductIndex >= 0) return { product: prevProductIndex, batch: navigableBatchesByProduct[prevProductIndex].length - 1 }; let lastValidIndex = navigableBatchesByProduct.length - 1; while (lastValidIndex >= 0 && navigableBatchesByProduct[lastValidIndex].length === 0) lastValidIndex--; return lastValidIndex !== -1 ? { product: lastValidIndex, batch: navigableBatchesByProduct[lastValidIndex].length - 1 } : current; }; 
    switch (e.key) { case 'ArrowDown': e.preventDefault(); setActiveIndices(findNext); break; case 'ArrowUp': e.preventDefault(); setActiveIndices(findPrev); break; case 'Enter': e.preventDefault(); if (activeIndices.product !== -1 && activeIndices.batch !== -1) { const product = searchResults[activeIndices.product]; const batch = navigableBatchesByProduct[activeIndices.product][activeIndices.batch]; if (product && batch) handleAddToCart(product, batch); } break; case 'Escape': e.preventDefault(); setSearchTerm(''); break; default: break; } 
  };

  return (
    <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      <div className="lg:col-span-2">
        <Card title={isEditing ? `${t.billing.editBill}: ${editingBill?.billNumber}` : t.billing.createBill}>
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex gap-2">
                <div className="relative flex-grow">
                    <input ref={searchInputRef} type="text" placeholder={isPharmaMode ? "Search Name or Part No (e.g. Paracet 40)" : "Search Name or Barcode"} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={handleKeyDown} className={`${inputStyle} w-full px-4 py-3 text-lg font-medium`} />
                    {searchResults.length > 0 && searchTerm && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                        <ul>{searchResults.map((product, productIndex) => (navigableBatchesByProduct[productIndex]?.length > 0 && <li key={product.id} className="border-b dark:border-slate-600 last:border-b-0"><div className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200 flex justify-between items-center"><span>{product.name} {!isPharmaMode && product.barcode && <span className="text-xs font-mono text-slate-500">({product.barcode})</span>}</span></div><ul className="pl-4 pb-2">{navigableBatchesByProduct[productIndex]?.map((batch, batchIndex) => { const isActive = productIndex === activeIndices.product && batchIndex === activeIndices.batch; return (<li key={batch.id} ref={isActive ? activeItemRef : null} className={`px-4 py-2 flex justify-between items-center transition-colors rounded-md mx-2 my-1 ${isActive ? 'bg-indigo-200 dark:bg-indigo-700' : 'hover:bg-indigo-50 dark:hover:bg-slate-600 cursor-pointer'}`} onClick={() => handleAddToCart(product, batch)} onMouseEnter={() => setActiveIndices({ product: productIndex, batch: batchIndex })}><div>{isPharmaMode && (<><span className="text-slate-800 dark:text-slate-200">Batch: <span className="font-medium">{batch.batchNumber}</span></span><span className="text-sm ml-3 text-slate-600 dark:text-slate-400">Exp: {batch.expiryDate}</span></>)}</div><div className="flex items-center gap-4"><span className="text-slate-800 dark:text-slate-200">Rate: <span className="font-medium">₹{(batch.saleRate || batch.mrp).toFixed(2)}</span></span><span className="text-sm text-green-600 dark:text-green-400 font-semibold ml-3">Stock: {isPharmaMode ? formatStock(batch.stock, product.unitsPerStrip) : `${batch.stock} U`}</span></div></li>); })}</ul></li>))}</ul></div>)}
                </div>
                <button onClick={() => setShowTextScanner(true)} className="p-3 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-all flex flex-col items-center justify-center min-w-[80px] border-2 border-indigo-200" title="Scan Part No from Pack">
                    <CameraIcon className="h-6 w-6" />
                    <span className="text-[10px] font-extrabold mt-1 uppercase">AI SCAN</span>
                </button>
                <button onClick={() => setShowScanner(!showScanner)} className={`p-3 rounded-lg transition-colors border-2 ${showScanner ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'} flex flex-col items-center justify-center min-w-[80px]`} title={showScanner ? "Close Barcode" : "Scan Barcode"}>
                    <BarcodeIcon className="h-6 w-6" />
                    <span className="text-[10px] font-bold mt-1 uppercase">BARCODE</span>
                </button>
            </div>
          </div>
          <div className="mt-6"><h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">{t.billing.cartItems}</h3><div className="overflow-x-auto max-h-[calc(100vh-380px)]">{cart.length > 0 ? (<table className="w-full text-sm text-left text-slate-800 dark:text-slate-300"><thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700 sticky top-0"><tr><th scope="col" className="px-2 py-3">{t.billing.product}</th>{isPharmaMode && <th scope="col" className="px-2 py-3">{t.billing.pack}</th>}{isPharmaMode && <th scope="col" className="px-2 py-3">{t.billing.batch}</th>}{isPharmaMode && <th scope="col" className="px-2 py-3">{t.billing.strip}</th>}<th scope="col" className="px-2 py-3">{isPharmaMode ? t.billing.tabs : t.billing.qty}</th><th scope="col" className="px-2 py-3">{t.billing.mrp}</th><th scope="col" className="px-2 py-3">{t.billing.amount}</th><th scope="col" className="px-2 py-3">{t.billing.action}</th></tr></thead><tbody>{cart.map(item => (<tr key={item.batchId} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"><td className="px-2 py-3 font-medium text-slate-900 dark:text-white">{item.productName}{isPharmaMode && item.isScheduleH && <span className="ml-1 text-xs font-semibold text-orange-600 dark:text-orange-500">(Sch. H)</span>}</td>{isPharmaMode && <td className="px-2 py-3">{item.unitsPerStrip ? `1*${item.unitsPerStrip}`: '-'}</td>}{isPharmaMode && <td className="px-2 py-3">{item.batchNumber}</td>}{isPharmaMode && (<td className="px-2 py-3"><input ref={(el) => { cartItemStripInputRefs.current.set(item.batchId, el); }} type="text" inputMode="numeric" value={item.stripQty} onChange={e => updateCartItem(item.batchId, parseInt(e.target.value) || 0, item.looseQty)} className={`w-14 p-1 text-center ${inputStyle}`} disabled={!item.unitsPerStrip || item.unitsPerStrip <= 1} /></td>)}<td className="px-2 py-3"><input ref={(el) => { cartItemTabInputRefs.current.set(item.batchId, el); }} type="text" inputMode="numeric" value={item.looseQty} onChange={e => updateCartItem(item.batchId, item.stripQty, parseInt(e.target.value) || 0)} className={`w-14 p-1 text-center ${inputStyle}`} /></td><td className="px-2 py-3">{isMrpEditable ? (<input ref={(el) => { cartItemMrpInputRefs.current.set(item.batchId, el); }} type="number" step="0.01" value={item.mrp} onChange={(e) => updateCartItemDetails(item.batchId, { mrp: parseFloat(e.target.value) || 0, stripQty: item.stripQty, looseQty: item.looseQty })} className={`w-20 p-1 text-center ${inputStyle}`} />) : (<span>₹{item.mrp.toFixed(2)}</span>)}</td><td className="px-2 py-3 font-semibold">₹{item.total.toFixed(2)}</td><td className="px-2 py-3"><div className="flex items-center gap-2"><button onClick={() => openEditItemModal(item)} className="text-blue-500 hover:text-blue-700" title="Edit Item"><PencilIcon className="h-4 w-4" /></button><button onClick={() => setCart(cart.filter(i => i.batchId !== item.batchId))} className="text-red-500 hover:text-red-700" title="Remove Item"><TrashIcon className="h-5 w-5" /></button></div></td></tr>))}</tbody></table>) : (<div className="text-center py-10 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg"><p>{t.billing.cartEmpty}</p></div>)}</div></div>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <Card title="Bill Summary" className="sticky top-20">
            <div className="space-y-4">
                <div className={`pb-4 border-b dark:border-slate-700 ${systemConfig.maintainCustomerLedger && systemConfig.enableSalesman ? 'grid grid-cols-2 gap-4' : ''}`}>
                    {systemConfig.maintainCustomerLedger && (<div><label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Payment Mode</label><div className="flex gap-2 flex-wrap"><label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="paymentMode" value="Cash" checked={paymentMode === 'Cash'} onChange={() => setPaymentMode('Cash'} className="h-4 w-4 text-green-600 focus:ring-green-500 border-slate-300 rounded-full" /> <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Cash</span></label><label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="paymentMode" value="Credit" checked={paymentMode === 'Credit'} onChange={() => setPaymentMode('Credit'} className="h-4 w-4 text-red-600 focus:ring-red-500 border-slate-300 rounded-full" /> <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Credit</span></label></div></div>)}
                    {systemConfig.enableSalesman && (<div><label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Salesman</label><div className="flex gap-1"><select value={selectedSalesmanId} onChange={(e) => setSelectedSalesmanId(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm"><option value="">Select</option>{salesmen?.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}</select><button onClick={() => setAddSalesmanModalOpen(true)} className="p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors" title="Add Salesman"><PlusIcon className="h-4 w-4" /></button></div></div>)}
                </div>
                <div className="relative"><label htmlFor="customerName" className="block text-sm font-medium text-slate-800 dark:text-slate-200">{isPharmaMode ? t.billing.patientName : t.billing.customerName}</label><div className="flex gap-2"><div className="relative flex-grow"><input type="text" id="customerName" value={customerName} onChange={e => { setCustomerName(e.target.value); setSelectedCustomer(null); }} onFocus={() => setShowCustomerSuggestions(true)} onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)} placeholder={isPharmaMode ? t.billing.walkInPatient : t.billing.walkInCustomer} className={`mt-1 block w-full px-3 py-2 ${inputStyle}`} autoComplete="off" />{showCustomerSuggestions && customerSuggestions.length > 0 && (<ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">{customerSuggestions.map(customer => (<li key={customer.id} onClick={() => handleSelectCustomer(customer)} className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer text-sm text-slate-800 dark:text-slate-200">{customer.name} <span className="text-xs text-slate-500">({customer.phone || 'No Phone'})</span></li>))}</ul>)}</div><button onClick={() => setAddCustomerModalOpen(true)} className="mt-1 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors" title="Add New Customer"><PlusIcon className="h-5 w-5" /></button></div>{selectedCustomer && (<div className="mt-1 text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1"><UserCircleIcon className="h-3 w-3" /> Selected: {selectedCustomer.name}</div>)}</div>
                {isPharmaMode && (<div><label htmlFor="doctorName" className="block text-sm font-medium text-slate-800 dark:text-slate-200">{t.billing.doctorName}</label><input type="text" id="doctorName" value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="e.g. Dr. John Doe" className={`mt-1 block w-full px-3 py-2 ${inputStyle}`} list="doctor-list" /><datalist id="doctor-list">{doctorList.map(doc => <option key={doc} value={doc} />)}</datalist></div>)}
                <div className="border-t dark:border-slate-700 pt-4 space-y-2 text-slate-700 dark:text-slate-300"><div className="flex justify-between"><span>{t.billing.subtotal}</span><span>₹{subTotal.toFixed(2)}</span></div><div className="flex justify-between"><span>{t.billing.totalGst}</span><span>₹{totalGst.toFixed(2)}</span></div>{Math.abs(roundOff) > 0.005 && (<div className="flex justify-between text-sm text-slate-500 dark:text-slate-400"><span>Round Off</span><span>{roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}</span></div>)}<div className="flex justify-between text-2xl font-bold text-slate-800 dark:text-slate-100 pt-2 border-t dark:border-slate-600 mt-2"><span>{t.billing.grandTotal}</span><span>₹{grandTotal.toFixed(2)}</span></div></div>
                <div className="pt-2 flex gap-2"><button onClick={() => handleSaveBill(true)} disabled={cart.length === 0} className={`flex-1 text-white py-3 rounded-lg text-sm font-semibold shadow-md transition-colors duration-200 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-1 ${isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`} title="Save and Print (Alt+P)"><PrinterIcon className="h-5 w-5" /> {isEditing ? "Update & Print" : t.billing.saveAndPrint}</button><button onClick={() => handleSaveBill(false)} disabled={cart.length === 0} className={`flex-1 text-white py-3 rounded-lg text-sm font-semibold shadow-md transition-colors duration-200 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-1 ${isEditing ? 'bg-slate-600 hover:bg-slate-700' : 'bg-blue-600 hover:bg-blue-700'}`} title="Save Only (Alt+S)"><CheckCircleIcon className="h-5 w-5" /> {isEditing ? "Update Only" : "Save Only"}</button></div>
                {isEditing && (<button onClick={onCancelEdit} className="w-full bg-slate-500 text-white py-2 rounded-lg text-md font-semibold shadow-md hover:bg-slate-600 transition-colors duration-200 mt-2">{t.billing.cancelEdit}</button>)}
            </div>
        </Card>
      </div>
      
      <TextScannerModal isOpen={showTextScanner} onClose={() => setShowTextScanner(false)} onScan={handleTextScan} isProcessing={isOcrProcessing} />
      <BarcodeScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} onScanSuccess={handleBarcodeScan} />
      <MatchResolutionModal isOpen={resolutionData.isOpen} onClose={() => setResolutionData(prev => ({...prev, isOpen: false}))} candidates={resolutionData.candidates} onSelect={(p, b) => { handleAddToCart(p, b); setResolutionData(prev => ({...prev, isOpen: false})); }} />
      {itemToEdit && (<EditBillItemModal isOpen={!!itemToEdit} onClose={() => setItemToEdit(null)} item={itemToEdit.item} maxStock={itemToEdit.maxStock} onUpdate={updateCartItemDetails} systemConfig={systemConfig} />)}
      <OrderSuccessModal isOpen={showOrderSuccessModal} onClose={() => setShowOrderSuccessModal(false)} bill={lastSavedBill} timeTaken={orderSeconds} companyProfile={companyProfile} onPrint={() => { if (lastSavedBill) { const defaultPrinter = systemConfig.printers?.find(p => p.isDefault); if (defaultPrinter) executePrint(lastSavedBill, defaultPrinter, true); else { setBillToPrint(lastSavedBill); setPrinterModalOpen(true); } } }} onCreateNew={() => { resetBillingForm(); setShowOrderSuccessModal(false); }} />
      <PrinterSelectionModal isOpen={isPrinterModalOpen} onClose={() => { setPrinterModalOpen(false); if (shouldResetAfterPrint) { if(onCancelEdit) onCancelEdit(); setShouldResetAfterPrint(false); } setBillToPrint(null); }} systemConfig={systemConfig} onUpdateConfig={() => {}} onSelectPrinter={(printer) => { if (billToPrint) { executePrint(billToPrint, printer); setBillToPrint(null); } }} />
      <AddCustomerModal isOpen={isAddCustomerModalOpen} onClose={() => setAddCustomerModalOpen(false)} onAddCustomer={handleAddNewCustomer} initialName={customerName} />
      <AddSalesmanModal isOpen={isAddSalesmanModalOpen} onClose={() => setAddSalesmanModalOpen(false)} onAddSalesman={handleAddNewSalesman} />
    </div>
  );
};

const EditBillItemModal: React.FC<{ isOpen: boolean; onClose: () => void; item: CartItem; maxStock: number; onUpdate: (batchId: string, updates: { mrp: number, stripQty: number, looseQty: number }) => void; systemConfig: SystemConfig; }> = ({ isOpen, onClose, item, maxStock, onUpdate, systemConfig }) => {
    const [formState, setFormState] = useState({ mrp: item.mrp, stripQty: item.stripQty, looseQty: item.looseQty });
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const unitsPerStrip = item.unitsPerStrip || 1;
    const isMrpEditable = systemConfig.mrpEditable !== false;
    useEffect(() => { setFormState({ mrp: item.mrp, stripQty: item.stripQty, looseQty: item.looseQty }); }, [item, isOpen]);
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdate(item.batchId, { mrp: formState.mrp, stripQty: isPharmaMode && unitsPerStrip > 1 ? formState.stripQty : 0, looseQty: formState.looseQty });
        onClose();
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Item">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{item.productName}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Batch: {item.batchNumber} | Exp: {item.expiryDate}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Selling Price / MRP</label>
                        <input type="number" value={formState.mrp} onChange={e => setFormState({...formState, mrp: parseFloat(e.target.value) || 0})} className={`${modalInputStyle} ${!isMrpEditable ? 'opacity-70' : ''}`} readOnly={!isMrpEditable} />
                    </div>
                    {isPharmaMode && unitsPerStrip > 1 ? (
                        <>
                            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Strips</label><input type="number" value={formState.stripQty} onChange={e => setFormState({...formState, stripQty: parseInt(e.target.value) || 0})} className={modalInputStyle} /></div>
                            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Loose</label><input type="number" value={formState.looseQty} onChange={e => setFormState({...formState, looseQty: parseInt(e.target.value) || 0})} className={modalInputStyle} /></div>
                        </>
                    ) : (
                        <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Qty</label><input type="number" value={formState.looseQty} onChange={e => setFormState({...formState, looseQty: parseInt(e.target.value) || 0})} className={modalInputStyle} /></div>
                    )}
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700 mt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Cancel</button>
                    <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700">Update</button>
                </div>
            </form>
        </Modal>
    );
};

const OrderSuccessModal: React.FC<{ isOpen: boolean; onClose: () => void; bill: Bill | null; timeTaken: number; onPrint: () => void; onCreateNew: () => void; companyProfile: CompanyProfile; }> = ({ isOpen, onClose, bill, timeTaken, onPrint, onCreateNew, companyProfile }) => {
    if (!isOpen || !bill) return null;
    const upiId = companyProfile.upiId;
    const amount = bill.grandTotal.toFixed(2);
    const upiUrl = upiId ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(companyProfile.name)}&am=${amount}&cu=INR` : '';
    const qrCodeUrl = upiId ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUrl)}` : '';
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex justify-center items-center">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden p-6 text-center">
                {upiId && (
                    <div className="mb-4 bg-white p-2 rounded-lg border-2 border-slate-200 inline-block">
                        <img src={qrCodeUrl} alt="Payment QR" className="w-32 h-32" />
                    </div>
                )}
                <h2 className="text-2xl font-bold text-teal-700 dark:text-teal-400 mb-2">Order Completed!</h2>
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">Saved in {timeTaken}s • Total: ₹{bill.grandTotal}</div>
                <div className="w-full space-y-3">
                    <div className="flex gap-3">
                        <button onClick={onPrint} className="flex-1 bg-black text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"><PrinterIcon className="h-5 w-5" /> Print</button>
                        <button onClick={onCreateNew} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold">New Bill</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AddCustomerModal: React.FC<{ isOpen: boolean; onClose: () => void; onAddCustomer: (customer: Omit<Customer, 'id' | 'balance'>) => Promise<Customer | null>; initialName: string; }> = ({ isOpen, onClose, onAddCustomer, initialName }) => {
    const [name, setName] = useState(initialName);
    const [phone, setPhone] = useState('');
    const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); await onAddCustomer({ name, phone }); onClose(); };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Customer">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium mb-1">Name*</label><input type="text" value={name} onChange={e => setName(e.target.value)} className={modalInputStyle} required /></div>
                <div><label className="block text-sm font-medium mb-1">Mobile</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={modalInputStyle} /></div>
                <div className="flex justify-end gap-2 pt-4"><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button></div>
            </form>
        </Modal>
    );
};

const AddSalesmanModal: React.FC<{ isOpen: boolean; onClose: () => void; onAddSalesman: (salesman: Omit<Salesman, 'id'>) => Promise<Salesman | null>; }> = ({ isOpen, onClose, onAddSalesman }) => {
    const [name, setName] = useState('');
    const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); await onAddSalesman({ name }); onClose(); };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Salesman">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium mb-1">Name*</label><input type="text" value={name} onChange={e => setName(e.target.value)} className={modalInputStyle} required /></div>
                <div className="flex justify-end gap-2 pt-4"><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button></div>
            </form>
        </Modal>
    );
};

export default Billing;

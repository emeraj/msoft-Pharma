
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import type { Product, Batch, CartItem, Bill, CompanyProfile, SystemConfig, PrinterProfile } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { TrashIcon, SwitchHorizontalIcon, PencilIcon, CameraIcon, PrinterIcon, CheckCircleIcon, ShareIcon, HomeIcon } from './icons/Icons';
import ThermalPrintableBill from './ThermalPrintableBill';
import PrintableA5Bill from './PrintableA5Bill';
import PrintableBill from './PrintableBill'; // For A4
import BarcodeScannerModal, { EmbeddedScanner } from './BarcodeScannerModal';
import PrinterSelectionModal from './PrinterSelectionModal';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getTranslation } from '../utils/translationHelper';

interface BillingProps {
  products: Product[];
  bills: Bill[];
  companyProfile: CompanyProfile;
  systemConfig: SystemConfig;
  onGenerateBill: (bill: Omit<Bill, 'id' | 'billNumber'>) => Promise<Bill | null>;
  editingBill?: Bill | null;
  onUpdateBill?: (billId: string, billData: Omit<Bill, 'id'>, originalBill: Bill) => Promise<Bill | null>;
  onCancelEdit?: () => void;
}

const inputStyle = "bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
const modalInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";

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

// Helper to generate ESC/POS commands for Bluetooth printing as Bytes
const generateEscPosBill = (bill: Bill, profile: CompanyProfile, config: SystemConfig): number[] => {
    const commands: number[] = [];
    const ESC = 27;
    const GS = 29;
    const LF = 10;
    
    // Safe printable width for 80mm paper.
    // 42 chars allows for safe margins and ensures columns align perfectly.
    const PRINTER_WIDTH = 42; 

    const addBytes = (bytes: number[]) => {
        commands.push(...bytes);
    };

    const addText = (text: string) => {
        // Basic sanitization
        const safeText = text.replace(/₹/g, 'Rs.');
        for (let i = 0; i < safeText.length; i++) {
            let code = safeText.charCodeAt(i);
            if (code > 255) code = 63; // '?'
            commands.push(code);
        }
    };
    
    // Helper to create a line with left and right aligned text
    const addRow = (left: string, right: string) => {
        const space = PRINTER_WIDTH - left.length - right.length;
        if (space < 1) {
            addText(left + " " + right + "\n");
        } else {
            addText(left + " ".repeat(space) + right + "\n");
        }
    };
    
    const addCenter = (text: string) => {
        addBytes([ESC, 97, 1]); // Center
        addText(text + "\n");
        addBytes([ESC, 97, 0]); // Left
    };

    // Initialize Printer: ESC @
    addBytes([ESC, 64]);
    
    // --- Header ---
    addBytes([ESC, 97, 1]); // Center Align
    addBytes([ESC, 69, 1]); // Bold On
    addText(profile.name + '\n');
    addBytes([ESC, 69, 0]); // Bold Off
    
    addText(profile.address + '\n');
    if (profile.phone) addText('Ph: ' + profile.phone + '\n');
    if (profile.gstin) addText('GSTIN: ' + profile.gstin + '\n');
    addText('-'.repeat(PRINTER_WIDTH) + '\n');
    
    // --- Bill Details ---
    addBytes([ESC, 97, 0]); // Left Align
    addText("TAX INVOICE\n");
    addText('-'.repeat(PRINTER_WIDTH) + '\n');
    
    addRow('Bill No: ' + bill.billNumber, 'Date: ' + new Date(bill.date).toLocaleDateString());
    addText('Customer: ' + bill.customerName + '\n');
    addText('-'.repeat(PRINTER_WIDTH) + '\n');
    
    // --- Items ---
    // Column Layout for 42 chars:
    // Item (18)   Qty(4)  Rate(9)  Amt(11)
    const col1W = 18;
    const col2W = 4;
    const col3W = 9;
    const col4W = 11;

    addBytes([ESC, 69, 1]); // Bold
    const headerLine = "Item".padEnd(col1W) + "Qty".padStart(col2W) + "Rate".padStart(col3W) + "Amount".padStart(col4W) + "\n";
    addText(headerLine);
    addBytes([ESC, 69, 0]); // Bold Off
    addText('-'.repeat(PRINTER_WIDTH) + '\n');
    
    bill.items.forEach((item, index) => {
        // Item Row
        // 1. Name (Print on separate line if long, or just first line)
        addBytes([ESC, 69, 1]); // Bold On for Product Name
        addText(`${index + 1}. ${item.productName}\n`);
        addBytes([ESC, 69, 0]); // Bold Off
        
        // 2. Details Row
        const qty = item.quantity.toString();
        const rate = (item.total / item.quantity > 0 ? (item.total / item.quantity).toFixed(2) : '0.00');
        const amount = item.total.toFixed(2);
        
        const spacer = " ".repeat(col1W);
        const qtyStr = qty.padStart(col2W);
        const rateStr = rate.padStart(col3W);
        const amountStr = amount.padStart(col4W);
        
        addText(spacer + qtyStr + rateStr + amountStr + "\n");
    });
    addText('-'.repeat(PRINTER_WIDTH) + '\n');
    
    // --- Totals ---
    addRow('Subtotal:', bill.subTotal.toFixed(2));
    addRow('Total GST:', bill.totalGst.toFixed(2));
    addText('-'.repeat(PRINTER_WIDTH) + '\n');
    
    addBytes([ESC, 69, 1]); // Bold On
    addText(`GRAND TOTAL:    Rs.${bill.grandTotal.toFixed(2)}\n`);
    addBytes([ESC, 69, 0]); // Bold Off
    addText('-'.repeat(PRINTER_WIDTH) + '\n');
    
    // --- GST Summary ---
    // Use a simpler clean header
    const gstTitle = "GST SUMMARY";
    const padTitle = Math.max(0, Math.floor((PRINTER_WIDTH - gstTitle.length) / 2));
    addText(" ".repeat(padTitle) + gstTitle + "\n");
    addText(" ".repeat(padTitle) + "-".repeat(gstTitle.length) + "\n");

    // Rate(6) Taxable(12) CGST(12) SGST(12) = 42 chars
    const gstHeader = "Rate".padEnd(6) + "Taxable".padStart(12) + "CGST".padStart(12) + "SGST".padStart(12) + "\n";
    addText(gstHeader);
    
    const gstMap = new Map<number, {taxable: number, tax: number}>();
    bill.items.forEach(item => {
        const taxable = item.total / (1 + item.gst/100);
        const tax = item.total - taxable;
        const existing = gstMap.get(item.gst) || {taxable: 0, tax: 0};
        gstMap.set(item.gst, {taxable: existing.taxable + taxable, tax: existing.tax + tax});
    });
    
    Array.from(gstMap.entries()).sort((a,b) => a[0] - b[0]).forEach(([rate, data]) => {
         const rStr = `${rate}%`.padEnd(6);
         const tStr = data.taxable.toFixed(2).padStart(12);
         const cStr = (data.tax/2).toFixed(2).padStart(12);
         const sStr = (data.tax/2).toFixed(2).padStart(12);
         addText(rStr + tStr + cStr + sStr + "\n");
    });

    addText('-'.repeat(PRINTER_WIDTH) + '\n');

    // --- Footer ---
    addBytes([ESC, 97, 1]); // Center Align
    if(config.remarkLine1) addText(config.remarkLine1 + '\n');
    if(config.remarkLine2) addText(config.remarkLine2 + '\n');
    
    // --- QR Code for UPI ---
    if (profile.upiId && bill.grandTotal > 0) {
        const upiStr = `upi://pay?pa=${profile.upiId}&pn=${encodeURIComponent(profile.name.substring(0, 20))}&am=${bill.grandTotal.toFixed(2)}&cu=INR`;
        const len = upiStr.length + 3;
        const pL = len % 256;
        const pH = Math.floor(len / 256);
        
        addText('\n');
        addText('Scan to Pay using UPI\n');
        
        // Standard ESC/POS QR Code Commands
        addBytes([GS, 40, 107, 4, 0, 49, 65, 50, 0]);
        addBytes([GS, 40, 107, 3, 0, 49, 67, 6]); 
        addBytes([GS, 40, 107, 3, 0, 49, 69, 48]);
        addBytes([GS, 40, 107, pL, pH, 49, 80, 48]);
        for (let i = 0; i < upiStr.length; i++) {
            commands.push(upiStr.charCodeAt(i));
        }
        addBytes([GS, 40, 107, 3, 0, 49, 81, 48]);
        addText('\n');
    }
    
    // --- Feed Lines ---
    // Feed 5 lines to ensure cut does not damage content
    addBytes([LF, LF, LF, LF, LF]); 
    // Cut Paper
    addBytes([GS, 86, 66, 0]);

    return commands;
};

const bytesToHex = (bytes: number[] | Uint8Array): string => {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0').toUpperCase()).join('');
};

// Web Bluetooth Print Helper
const printViaWebBluetooth = async (data: Uint8Array, printerId?: string) => {
    const nav = navigator as any;
    if (!nav.bluetooth) {
        throw new Error("Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera.");
    }

    let device = null;

    if (printerId && nav.bluetooth.getDevices) {
        try {
            const devices = await nav.bluetooth.getDevices();
            if (devices && devices.length > 0) {
                const matchedDevice = devices.find((d: any) => d.id === printerId);
                if (matchedDevice) {
                    device = matchedDevice;
                }
            }
        } catch (e) {
            console.warn("Could not retrieve allowed devices:", e);
        }
    }

    if (!device) {
        try {
            device = await nav.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] 
            });
        } catch (e) {
            throw new Error("Device selection cancelled or failed.");
        }
    }

    if (!device) throw new Error("No device selected.");

    let server;
    try {
        server = await device.gatt.connect();
    } catch(e) {
        throw new Error("Could not connect to printer. Is it on and in range?");
    }

    if (!server) throw new Error("GATT Server not found.");

    let characteristic;
    try {
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
    } catch (e) {
         throw new Error("Printer service not found. Ensure it supports standard BLE printing.");
    }

    // Write Data in chunks with DELAY to prevent buffer overflow
    // Reduced chunk size and increased delay for higher reliability on mobile
    const CHUNK_SIZE = 40; 
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        await characteristic.writeValue(chunk);
        // Increase delay to allow printer to process buffer
        await new Promise(resolve => setTimeout(resolve, 40)); 
    }

    setTimeout(() => {
            if (device.gatt.connected) {
            device.gatt.disconnect();
        }
    }, 2000);
};

const ConnectingModal: React.FC<{ isOpen: boolean; printerName: string; printerId?: string }> = ({ isOpen, printerName, printerId }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex justify-center items-center backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center animate-fade-in-up">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">Connecting printer</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-8">We are trying to connect to your printer</p>
                
                <div className="flex justify-center mb-8 relative">
                     <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-100 dark:border-slate-700 border-t-slate-800 dark:border-t-white"></div>
                </div>
                
                <p className="font-medium text-slate-800 dark:text-slate-200">Connecting to your printer</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-mono">{printerName}{printerId ? ` (${printerId})` : ''}</p>
            </div>
            <style>{`
                @keyframes fade-in-up {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
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

interface EditBillItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: CartItem;
    maxStock: number;
    onUpdate: (batchId: string, updates: { mrp: number, stripQty: number, looseQty: number }) => void;
    systemConfig: SystemConfig;
}

const EditBillItemModal: React.FC<EditBillItemModalProps> = ({ isOpen, onClose, item, maxStock, onUpdate, systemConfig }) => {
    const [formState, setFormState] = useState({
        mrp: item.mrp,
        stripQty: item.stripQty,
        looseQty: item.looseQty
    });
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const unitsPerStrip = item.unitsPerStrip || 1;
    const isMrpEditable = systemConfig.mrpEditable !== false; // Default to true if undefined

    useEffect(() => {
        setFormState({ mrp: item.mrp, stripQty: item.stripQty, looseQty: item.looseQty });
    }, [item, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const totalRequested = (formState.stripQty * unitsPerStrip) + formState.looseQty;
        
        if (totalRequested <= 0) {
            alert("Quantity must be greater than 0");
            return;
        }
        if (totalRequested > maxStock) {
            alert(`Not enough stock. Available: ${maxStock} units`);
            return;
        }
        if (formState.mrp <= 0) {
            alert("MRP must be greater than 0");
            return;
        }

        onUpdate(item.batchId, {
            mrp: formState.mrp,
            stripQty: isPharmaMode && unitsPerStrip > 1 ? formState.stripQty : 0,
            looseQty: formState.looseQty
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Item">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{item.productName}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Batch: {item.batchNumber} | Exp: {item.expiryDate}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Available Stock: {formatStock(maxStock, unitsPerStrip)}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">MRP</label>
                        <input 
                            type="number" 
                            name="mrp" 
                            value={formState.mrp} 
                            onChange={handleChange} 
                            className={`${modalInputStyle} ${!isMrpEditable ? 'bg-slate-200 dark:bg-slate-700 cursor-not-allowed opacity-70' : ''}`} 
                            step="0.01" 
                            min="0.01"
                            readOnly={!isMrpEditable}
                        />
                    </div>
                    
                    {isPharmaMode && unitsPerStrip > 1 ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Strips</label>
                                <input 
                                    type="number" 
                                    name="stripQty" 
                                    value={formState.stripQty} 
                                    onChange={handleChange} 
                                    className={modalInputStyle} 
                                    min="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Loose Tabs</label>
                                <input 
                                    type="number" 
                                    name="looseQty" 
                                    value={formState.looseQty} 
                                    onChange={handleChange} 
                                    className={modalInputStyle} 
                                    min="0"
                                />
                            </div>
                        </>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
                            <input 
                                type="number" 
                                name="looseQty" 
                                value={formState.looseQty} 
                                onChange={handleChange} 
                                className={modalInputStyle} 
                                min="1"
                            />
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700 mt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200">Cancel</button>
                    <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700">Update</button>
                </div>
            </form>
        </Modal>
    );
};

const OrderSuccessModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    bill: Bill | null; 
    timeTaken: number;
    onPrint: () => void;
    onCreateNew: () => void;
    onEditOrder: () => void;
    companyProfile: CompanyProfile;
}> = ({ isOpen, onClose, bill, timeTaken, onPrint, onCreateNew, onEditOrder, companyProfile }) => {
    const [mobileNumber, setMobileNumber] = useState('');

    useEffect(() => {
        if (isOpen) {
            setMobileNumber('');
        }
    }, [isOpen]);

    if (!isOpen || !bill) return null;

    // Generate QR code for Bill Amount using UPI ID
    const upiId = companyProfile.upiId;
    const amount = bill.grandTotal.toFixed(2);
    const upiUrl = upiId 
        ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(companyProfile.name)}&am=${amount}&cu=INR`
        : '';
    
    const qrCodeUrl = upiId 
        ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUrl)}` 
        : '';

    const shareToWhatsApp = () => {
        if (!mobileNumber || !mobileNumber.trim()) {
            alert("Mobile Number is mandatory to share on WhatsApp.");
            return;
        }

        const text = `*TAX INVOICE*\n${companyProfile.name}\nBill No: ${bill.billNumber}\nDate: ${new Date(bill.date).toLocaleDateString()}\n\n*Items:*\n${bill.items.map(i => `${i.productName} x ${i.quantity} = ${i.total.toFixed(2)}`).join('\n')}\n\n*Total: ₹${bill.grandTotal.toFixed(2)}*\n\nThank you!`;
        
        let url = '';
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        let cleanNumber = mobileNumber.replace(/\D/g, '');
        if (cleanNumber.length === 10) {
            cleanNumber = '91' + cleanNumber;
        }
        
        if (isMobile) {
            url = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(text)}`;
        } else {
            url = `https://web.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(text)}`;
        }
        
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex justify-center items-center">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-fade-in-up">
                <div className="p-6 flex flex-col items-center text-center">
                    
                    {/* QR Code Section - Only show if UPI ID is present */}
                    {upiId && (
                        <div className="mb-4 bg-white p-2 rounded-lg border-2 border-slate-200 dark:border-slate-600">
                             <img 
                                src={qrCodeUrl} 
                                alt="Payment QR" 
                                className="w-40 h-40 object-contain"
                            />
                            <p className="text-xs text-slate-500 mt-1 font-medium">Scan to Pay ₹{amount}</p>
                        </div>
                    )}
                    
                    <div className="mb-2">
                        <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto" />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-teal-700 dark:text-teal-400 mb-2">Order Completed !</h2>
                    
                    <div className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-1">
                        Time For Order Creation (in seconds): {timeTaken}
                    </div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
                        Total Bill Amount: ₹{bill.grandTotal}
                    </div>

                    <div className="w-full mb-4">
                        <input
                            type="tel"
                            value={mobileNumber}
                            onChange={(e) => setMobileNumber(e.target.value)}
                            placeholder="Customer WhatsApp No.*"
                            className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-all text-center placeholder-slate-500 font-medium text-lg tracking-wide"
                        />
                    </div>
                    
                    <div className="w-full space-y-3">
                        <div className="flex gap-3">
                            <button onClick={shareToWhatsApp} className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition-colors">
                                <ShareIcon className="h-5 w-5" /> 
                                {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'Continue to WhatsApp' : 'Continue to WhatsApp Web'}
                            </button>
                            <button onClick={onPrint} className="flex-1 flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white py-3 rounded-lg font-semibold transition-colors">
                                <PrinterIcon className="h-5 w-5" /> Print Bill
                            </button>
                        </div>
                        
                        <button onClick={onCreateNew} className="w-full bg-[#004d40] hover:bg-[#00695c] text-white py-3 rounded-lg font-semibold transition-colors">
                            Create New Bill
                        </button>
                        
                        <button onClick={onEditOrder} className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-3 rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
                            Edit Order
                        </button>
                    </div>
                </div>
            </div>
             <style>{`
                @keyframes fade-in-up {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};


const Billing: React.FC<BillingProps> = ({ products, bills, onGenerateBill, companyProfile, systemConfig, editingBill, onUpdateBill, onCancelEdit }) => {
  const isPharmaMode = systemConfig.softwareMode === 'Pharma';
  const isEditing = !!editingBill;
  const t = getTranslation(systemConfig.language);

  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [isSubstituteModalOpen, setSubstituteModalOpen] = useState(false);
  const [substituteOptions, setSubstituteOptions] = useState<Product[]>([]);
  const [sourceProductForSub, setSourceProductForSub] = useState<Product | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastAddedBatchIdRef = useRef<string | null>(null);
  const cartItemStripInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const cartItemTabInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

  // Open scanner by default in Retail mode
  const [showScanner, setShowScanner] = useState(!isPharmaMode);
  
  // Printer Selection State
  const [isPrinterModalOpen, setPrinterModalOpen] = useState(false);
  const [billToPrint, setBillToPrint] = useState<Bill | null>(null);
  // To trigger reset after print flow
  const [shouldResetAfterPrint, setShouldResetAfterPrint] = useState(false);

  // Connection UI State
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingPrinterInfo, setConnectingPrinterInfo] = useState<{name: string, id: string}>({name: '', id: ''});

  // --- Keyboard Navigation State ---
  const [activeIndices, setActiveIndices] = useState<{ product: number; batch: number }>({ product: -1, batch: -1 });
  const activeItemRef = useRef<HTMLLIElement>(null);

  // --- Edit Item State ---
  const [itemToEdit, setItemToEdit] = useState<{item: CartItem, maxStock: number} | null>(null);

  // --- Success Toast State ---
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // --- Order Success Modal State ---
  const [showOrderSuccessModal, setShowOrderSuccessModal] = useState(false);
  const [lastSavedBill, setLastSavedBill] = useState<Bill | null>(null);
  const [orderSeconds, setOrderSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  // Track order start time
  useEffect(() => {
      if (cart.length > 0 && startTimeRef.current === null) {
          startTimeRef.current = Date.now();
      } else if (cart.length === 0) {
          startTimeRef.current = null;
      }
  }, [cart.length]);

  useEffect(() => {
    if (lastAddedBatchIdRef.current) {
        // Find the newly added item to decide which input to focus
        const newItem = cart.find(item => item.batchId === lastAddedBatchIdRef.current);
        let inputToFocus: HTMLInputElement | null | undefined = null;

        if (newItem && isPharmaMode && newItem.unitsPerStrip && newItem.unitsPerStrip > 1) {
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
  }, [cart, isPharmaMode]);

  useEffect(() => {
    if (editingBill) {
      setCart(editingBill.items);
      setCustomerName(editingBill.customerName);
      setDoctorName(editingBill.doctorName || '');
    } else {
      setCart([]);
      setCustomerName('');
      setDoctorName('');
    }
  }, [editingBill]);

  const doctorList = useMemo(() => {
    const doctors = new Set<string>();
    bills.forEach(bill => {
        if (bill.doctorName) {
            doctors.add(bill.doctorName);
        }
    });
    return Array.from(doctors).sort();
  }, [bills]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    return products
      .filter(p => 
        (p.name.toLowerCase().includes(lowerSearchTerm) ||
         (!isPharmaMode && p.barcode && p.barcode.includes(lowerSearchTerm))) &&
        p.batches.some(b => b.stock > 0 && (isPharmaMode ? getExpiryDate(b.expiryDate) >= today : true))
      )
      .slice(0, 10);
  }, [searchTerm, products, today, isPharmaMode]);
  
  const navigableBatchesByProduct = useMemo(() => {
    return searchResults.map(p =>
        p.batches
            .filter(b => b.stock > 0 && (isPharmaMode ? getExpiryDate(b.expiryDate) >= today : true))
            .sort((a, b) => isPharmaMode ? (getExpiryDate(a.expiryDate).getTime() - getExpiryDate(b.expiryDate).getTime()) : 0)
    );
  }, [searchResults, today, isPharmaMode]);

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

        const unitsPerStrip = (isPharmaMode && product.unitsPerStrip) ? product.unitsPerStrip : 1;
        
        // If it's not a strip-based product, strip quantity should always be 0.
        let sQty = isPharmaMode && unitsPerStrip > 1 ? Math.max(0, stripQty) : 0;
        let lQty = Math.max(0, looseQty);
        
        // Auto-correct loose quantity if it exceeds strip size and it's a strip-based product
        if (isPharmaMode && unitsPerStrip > 1 && lQty >= unitsPerStrip) {
            sQty += Math.floor(lQty / unitsPerStrip);
            lQty = lQty % unitsPerStrip;
        }

        const totalUnits = (sQty * unitsPerStrip) + lQty;

        if (totalUnits > 0 && totalUnits <= batch.stock) {
            const unitPrice = item.mrp / (unitsPerStrip > 1 ? unitsPerStrip : 1);
            const newTotal = totalUnits * unitPrice;
            return { ...item, stripQty: sQty, looseQty: lQty, quantity: totalUnits, total: newTotal };
        } else if (totalUnits === 0) {
            return { ...item, stripQty: 0, looseQty: 0, quantity: 0, total: 0 };
        }
      }
      return item;
    }));
  };

  const updateCartItemDetails = (batchId: string, updates: { mrp: number, stripQty: number, looseQty: number }) => {
      setCart(currentCart => currentCart.map(item => {
          if (item.batchId === batchId) {
              const { mrp, stripQty, looseQty } = updates;
              const unitsPerStrip = item.unitsPerStrip || 1;
              const totalUnits = (stripQty * unitsPerStrip) + looseQty;
              const unitPrice = mrp / (unitsPerStrip > 1 ? unitsPerStrip : 1);
              const total = totalUnits * unitPrice;
              return { ...item, mrp, stripQty, looseQty, quantity: totalUnits, total };
          }
          return item;
      }));
  };

  const openEditItemModal = (item: CartItem) => {
      const product = products.find(p => p.id === item.productId);
      const batch = product?.batches.find(b => b.id === item.batchId);
      if (product && batch) {
          setItemToEdit({ item, maxStock: batch.stock });
      } else {
          // Fallback if product not found (rare edge case or if items deleted but kept in bill)
          // For safety, assume max stock is current qty + some margin or just current qty if unavailable
          setItemToEdit({ item, maxStock: item.quantity + 100 }); 
      }
  };

  const handleAddToCart = (product: Product, batch: Batch) => {
    if (isPharmaMode) {
        const expiry = getExpiryDate(batch.expiryDate);
        if (expiry < today) {
          alert(`Cannot add expired batch.\nProduct: ${product.name}\nBatch: ${batch.batchNumber}\nExpired on: ${expiry.toLocaleDateString()}`);
          return;
        }
    }

    const existingItem = cart.find(item => item.productId === product.id && item.batchId === batch.id);
    const unitsPerStrip = (isPharmaMode && product.unitsPerStrip) ? product.unitsPerStrip : 1;
    
    if (existingItem) {
        // If it's not a strip-based product, just increment loose quantity.
        if (unitsPerStrip <= 1) {
            updateCartItem(existingItem.batchId, 0, existingItem.looseQty + 1);
        } else {
            // Otherwise, calculate based on total units
            const newTotalUnits = existingItem.quantity + 1;
            const newStripQty = Math.floor(newTotalUnits / unitsPerStrip);
            const newLooseQty = newTotalUnits % unitsPerStrip;
            updateCartItem(existingItem.batchId, newStripQty, newLooseQty);
        }
    } else {
      const unitPrice = batch.mrp / unitsPerStrip;
      const newItem: CartItem = {
        productId: product.id,
        productName: product.name,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        hsnCode: product.hsnCode,
        stripQty: 0,
        looseQty: 1,
        quantity: 1,
        mrp: batch.mrp,
        gst: product.gst,
        total: unitPrice,
        ...(isPharmaMode && product.isScheduleH && { isScheduleH: product.isScheduleH }),
        ...(isPharmaMode && product.composition && { composition: product.composition }),
        ...(isPharmaMode && product.unitsPerStrip && { unitsPerStrip: product.unitsPerStrip }),
      };
      lastAddedBatchIdRef.current = newItem.batchId;
      setCart(currentCart => [...currentCart, newItem]);
    }
    setSearchTerm('');
  };

  const removeFromCart = (batchId: string) => {
    setCart(cart.filter(item => item.batchId !== batchId));
  };

  const handleScanSuccess = (decodedText: string) => {
      if (isPharmaMode) {
          setSearchTerm(decodedText);
          setShowScanner(false); 
      } else {
          // Retail Mode Logic: Auto-add to cart
          const product = products.find(p => p.barcode === decodedText);
          if (product) {
               // Find first batch with stock
               const availableBatches = product.batches.filter(b => b.stock > 0);
               if (availableBatches.length > 0) {
                   handleAddToCart(product, availableBatches[0]);
               } else {
                   // Use a native notification if available or simple alert (careful with continuous scan flow)
                   // For improved UX, consider a non-blocking toast in future.
                   alert(`Product "${product.name}" is out of stock.`);
               }
          } else {
              alert(`Product with barcode "${decodedText}" not found.`);
          }
      }
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

  const printViaReactNative = async (bill: Bill, printer: PrinterProfile) => {
      // ... (Keep existing native print logic, it doesn't use translated strings in main UI)
      try {
        await window.BluetoothManager.connect(printer.id);
        const printerAPI = window.BluetoothEscposPrinter;
        const printCentered = async (text: string, isBold: boolean = false) => {
            await printerAPI.printText(text, {
                alignment: 1, widthtimes: isBold ? 1 : 0, heigthtimes: isBold ? 1 : 0, fonttype: isBold ? 1 : 0
            });
        };
        const printRow = async (left: string, right: string) => {
            const width = 42; 
            let space = width - left.length - right.length;
            if (space < 1) space = 1;
            await printerAPI.printText(left + " " + right + "\n", {});
        };
        await printCentered(companyProfile.name + "\n", true);
        await printCentered(companyProfile.address + "\n");
        if(companyProfile.phone) await printCentered("Ph: " + companyProfile.phone + "\n");
        if(companyProfile.gstin) await printCentered("GSTIN: " + companyProfile.gstin + "\n");
        await printerAPI.printText("-".repeat(42) + "\n", {});
        await printerAPI.printText(`Bill No: ${bill.billNumber}\n`, {});
        await printerAPI.printText(`Date: ${new Date(bill.date).toLocaleDateString()} ${new Date(bill.date).toLocaleTimeString()}\n`, {});
        await printerAPI.printText(`Name: ${bill.customerName}\n`, {});
        await printerAPI.printText("-".repeat(42) + "\n", {});
        for(const item of bill.items) {
             await printerAPI.printText(`${item.productName}\n`, { fonttype: 1 });
             const qtyRate = `${item.quantity} x ${item.mrp.toFixed(2)}`;
             const total = item.total.toFixed(2);
             await printRow(qtyRate, total);
        }
        await printerAPI.printText("-".repeat(42) + "\n", {});
        await printRow("Subtotal:", bill.subTotal.toFixed(2));
        await printRow("GST:", bill.totalGst.toFixed(2));
        await printerAPI.printText("\n", {});
        await printerAPI.printText(`Grand Total:       ${bill.grandTotal.toFixed(2)}\n`, { fonttype: 1, widthtimes: 1, heigthtimes: 1 });
        await printerAPI.printText("-".repeat(42) + "\n", {});
        if (systemConfig.remarkLine1) await printCentered(systemConfig.remarkLine1 + "\n");
        if (systemConfig.remarkLine2) await printCentered(systemConfig.remarkLine2 + "\n");
        if (companyProfile.upiId && bill.grandTotal > 0) {
             const upiStr = `upi://pay?pa=${companyProfile.upiId}&pn=${encodeURIComponent(companyProfile.name.substring(0, 20))}&am=${bill.grandTotal.toFixed(2)}&cu=INR`;
             await printCentered("Scan to Pay\n");
             try { await printerAPI.printQRCode(upiStr, 300, 1); } catch(e) { console.error("QR Print Error", e); }
             await printerAPI.printText("\n", {});
        }
        await printCentered("Thank you!\n\n\n");
      } catch (e) { console.error("Native Print Error:", e); alert("Printer Connection Error: " + String(e)); }
  };

  const executePrint = useCallback(async (bill: Bill, printer: PrinterProfile, forceReset = false) => {
    const doReset = () => {
        setCart([]);
        setCustomerName('');
        setDoctorName('');
        if (onCancelEdit && isEditing) {
            onCancelEdit();
        }
        setShouldResetAfterPrint(false);
    };
    const shouldReset = forceReset || shouldResetAfterPrint;
    
    // Handle RawBT App Intent Printing
    if (printer.connectionType === 'rawbt') {
        const data = generateEscPosBill(bill, companyProfile, systemConfig);
        const base64 = btoa(data.reduce((acc, byte) => acc + String.fromCharCode(byte), ''));
        
        const isAndroid = /Android/i.test(navigator.userAgent);
        
        if (isAndroid) {
             // Use Android Intent URL for better compatibility
             const intentUrl = `intent:base64,${base64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
             
             // Trigger via anchor click for better WebView support
             const a = document.createElement('a');
             a.href = intentUrl;
             a.style.display = 'none';
             document.body.appendChild(a);
             a.click();
             document.body.removeChild(a);
        } else {
             window.location.href = `rawbt:base64,${base64}`;
        }
        
        if (shouldReset) {
            setTimeout(doReset, 1000); // Increased timeout
        }
        return;
    }

    if (printer.format === 'Thermal' && window.BluetoothManager) {
        await printViaReactNative(bill, printer);
        if (shouldReset) doReset();
        return;
    }
    if (printer.format === 'Thermal' && (window as any).BluetoothLe && printer.id) {
        try {
            await (window as any).BluetoothLe.initialize();
            const data = generateEscPosBill(bill, companyProfile, systemConfig);
            const hexString = bytesToHex(data);
            await (window as any).BluetoothLe.write({ deviceId: printer.id, service: "000018f0-0000-1000-8000-00805f9b34fb", characteristic: "00002af1-0000-1000-8000-00805f9b34fb", value: hexString });
            if (shouldReset) doReset();
            return;
        } catch (err: any) { console.error("Capacitor BLE print failed", err); alert("Bluetooth LE print failed: " + err.message); }
    }
    if (printer.format === 'Thermal' && window.bluetoothSerial && printer.id) {
        try {
            const isConnected = await new Promise<boolean>((resolve) => { window.bluetoothSerial.isConnected(() => resolve(true), () => resolve(false)); });
            if (!isConnected) { await new Promise((resolve, reject) => { window.bluetoothSerial.connect(printer.id, resolve, reject); }); }
            const data = generateEscPosBill(bill, companyProfile, systemConfig);
            await new Promise((resolve, reject) => { window.bluetoothSerial.write(data, resolve, reject); });
             if (shouldReset) doReset();
            return;
        } catch (err) { console.error("Bluetooth print failed", err); alert("Bluetooth print failed. Falling back to system print dialog. Please check your printer connection."); }
    }
    if (printer.format === 'Thermal' && !window.bluetoothSerial && (navigator as any).bluetooth) {
        setIsConnecting(true);
        setConnectingPrinterInfo({name: printer.name, id: printer.id});
        try {
             const bytes = new Uint8Array(generateEscPosBill(bill, companyProfile, systemConfig));
             await printViaWebBluetooth(bytes, printer.id);
             if (shouldReset) doReset();
        } catch (e: any) { if (e.name !== 'NotFoundError' && !e.message?.includes('cancelled')) { alert("Printing failed: " + e.message); } } finally { setIsConnecting(false); }
        return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        const style = printWindow.document.createElement('style');
        style.innerHTML = `@page { size: auto; margin: 0mm; } body { margin: 0; }`;
        printWindow.document.head.appendChild(style);
        const rootEl = document.createElement('div');
        printWindow.document.body.appendChild(rootEl);
        const root = ReactDOM.createRoot(rootEl);
        if (printer.format === 'Thermal') { root.render(<ThermalPrintableBill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />); } else if (printer.format === 'A5') { root.render(<PrintableA5Bill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />); } else { root.render(<PrintableBill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />); }
        setTimeout(() => { printWindow.document.title = ' '; printWindow.print(); printWindow.close(); if (shouldReset) doReset(); }, 500);
    } else { alert("Please enable popups to print the bill."); if (shouldReset) doReset(); }
  }, [companyProfile, systemConfig, shouldResetAfterPrint, isEditing, onCancelEdit]);

  // ... (Keep other handlers handlePrinterSelection, handleUpdateConfig, handleSaveBill etc.) ...
  const handlePrinterSelection = (printer: PrinterProfile) => {
      if (billToPrint) {
          executePrint(billToPrint, printer); 
          setBillToPrint(null);
      }
  };
  const handleUpdateConfig = (newConfig: SystemConfig) => {
     if (auth.currentUser) {
         const configRef = doc(db, `users/${auth.currentUser.uid}/systemConfig`, 'config');
         updateDoc(configRef, newConfig as any);
     }
  };
  
  const handleSaveBill = useCallback(async (shouldPrint: boolean) => {
    if (cart.length === 0) { alert(t.billing.cartEmpty); return; }
    
    let savedBill: Bill | null = null;
    const isUpdate = isEditing && editingBill;
    
    // 1. Save Logic
    if (isUpdate && onUpdateBill) {
        const billData = { date: editingBill.date, customerName: customerName || t.billing.walkInCustomer, doctorName: doctorName.trim(), items: cart, subTotal, totalGst, grandTotal, billNumber: editingBill.billNumber };
        savedBill = await onUpdateBill(editingBill.id, billData, editingBill);
    } else if (!isUpdate && onGenerateBill) {
        const billData = { date: new Date().toISOString(), customerName: customerName || t.billing.walkInCustomer, doctorName: doctorName.trim(), items: cart, subTotal, totalGst, grandTotal };
        savedBill = await onGenerateBill(billData);
    }

    // 2. Post-Save Actions (Print or Reset)
    if (savedBill) {
        if (shouldPrint) {
            const defaultPrinter = systemConfig.printers?.find(p => p.isDefault);
            if (defaultPrinter) { 
                executePrint(savedBill, defaultPrinter, true); 
            } else { 
                setBillToPrint(savedBill); 
                setShouldResetAfterPrint(true); 
                setPrinterModalOpen(true); 
            }
        } else {
            // Save Only: Don't reset form yet, show Order Success Modal
            // Calculate time taken
            if (startTimeRef.current) {
                const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setOrderSeconds(seconds);
            } else {
                setOrderSeconds(0);
            }
            
            setLastSavedBill(savedBill);
            setShowOrderSuccessModal(true);
            
            // Show toast success message briefly
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 2500);
        }
    } else { 
        console.error("Failed to save/update bill."); 
        alert("There was an error saving the bill. Please try again."); 
    }
  }, [cart, isEditing, editingBill, onUpdateBill, customerName, doctorName, subTotal, totalGst, grandTotal, onGenerateBill, systemConfig, executePrint, t]);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        if (cart.length > 0) handleSaveBill(true);
      }
      if (event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (cart.length > 0) handleSaveBill(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length, handleSaveBill]);
  
  // ... (Keep keyboard nav logic handleKeyDown, handleStripQtyKeyDown, handleTabQtyKeyDown) ...
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (searchResults.length === 0 || navigableBatchesByProduct.every(b => b.length === 0)) return;
        const findNext = (current: { product: number; batch: number }) => {
            let { product, batch } = current;
            if (product === -1) { 
                const firstProductIndex = navigableBatchesByProduct.findIndex(batches => batches.length > 0);
                 return firstProductIndex !== -1 ? { product: firstProductIndex, batch: 0 } : current;
            }
            const currentProductBatches = navigableBatchesByProduct[product];
            if (batch < currentProductBatches.length - 1) { return { product, batch: batch + 1 }; }
            let nextProductIndex = product + 1;
            while (nextProductIndex < navigableBatchesByProduct.length && navigableBatchesByProduct[nextProductIndex].length === 0) { nextProductIndex++; }
            if (nextProductIndex < navigableBatchesByProduct.length) { return { product: nextProductIndex, batch: 0 }; }
            const firstValidIndex = navigableBatchesByProduct.findIndex(batches => batches.length > 0);
            return firstValidIndex !== -1 ? { product: firstValidIndex, batch: 0 } : current;
        };
        const findPrev = (current: { product: number; batch: number }) => {
            let { product, batch } = current;
            if (product === -1) { 
                let lastProductIndex = navigableBatchesByProduct.length - 1;
                while (lastProductIndex >= 0 && navigableBatchesByProduct[lastProductIndex].length === 0) { lastProductIndex--; }
                return lastProductIndex !== -1 ? { product: lastProductIndex, batch: navigableBatchesByProduct[lastProductIndex].length - 1 } : current;
            }
            if (batch > 0) { return { product, batch: batch - 1 }; }
            let prevProductIndex = product - 1;
            while (prevProductIndex >= 0 && navigableBatchesByProduct[prevProductIndex].length === 0) { prevProductIndex--; }
            if (prevProductIndex >= 0) { const prevProductBatches = navigableBatchesByProduct[prevProductIndex]; return { product: prevProductIndex, batch: prevProductBatches.length - 1 }; }
            let lastValidIndex = navigableBatchesByProduct.length - 1;
            while (lastValidIndex >= 0 && navigableBatchesByProduct[lastValidIndex].length === 0) { lastValidIndex--; }
            return lastValidIndex !== -1 ? { product: lastValidIndex, batch: navigableBatchesByProduct[lastValidIndex].length - 1 } : current;
        };
        switch (e.key) {
            case 'ArrowDown': e.preventDefault(); setActiveIndices(findNext); break;
            case 'ArrowUp': e.preventDefault(); setActiveIndices(findPrev); break;
            case 'Enter': e.preventDefault(); if (activeIndices.product !== -1 && activeIndices.batch !== -1) { const product = searchResults[activeIndices.product]; const batch = navigableBatchesByProduct[activeIndices.product][activeIndices.batch]; if (product && batch) { handleAddToCart(product, batch); } } break;
            case 'Escape': e.preventDefault(); setSearchTerm(''); break;
            default: break;
        }
    };
    const handleStripQtyKeyDown = (e: React.KeyboardEvent, batchId: string) => {
        if (e.key === 'Enter') { e.preventDefault(); const tabInput = cartItemTabInputRefs.current.get(batchId); if (tabInput) { tabInput.focus(); tabInput.select(); } }
    };
    const handleTabQtyKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); searchInputRef.current?.focus(); }
    };

    const resetBillingForm = () => {
        setCart([]);
        setCustomerName('');
        setDoctorName('');
        if (onCancelEdit && isEditing) {
            onCancelEdit();
        }
        startTimeRef.current = null;
        setOrderSeconds(0);
    };

  return (
    <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      {showSuccessToast && (
          <div className="fixed top-20 right-6 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in-down flex items-center gap-2">
              <CheckCircleIcon className="h-6 w-6" />
              <span className="font-medium">Bill Saved Successfully!</span>
          </div>
      )}
      <div className="lg:col-span-2">
        <Card title={isEditing ? `${t.billing.editBill}: ${editingBill?.billNumber}` : t.billing.createBill}>
            
          {showScanner && (
            <EmbeddedScanner 
                onScanSuccess={handleScanSuccess}
                onClose={() => setShowScanner(false)}
            />
          )}

          <div className="flex gap-2 mb-4">
            <div className="relative flex-grow">
                <input
                ref={searchInputRef}
                type="text"
                placeholder={isPharmaMode ? t.billing.searchPlaceholderPharma : t.billing.searchPlaceholderRetail}
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
                            <span>{product.name} {!isPharmaMode && product.barcode && <span className="text-xs font-mono text-slate-500">({product.barcode})</span>}</span>
                            {isPharmaMode && product.composition && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleFindSubstitutes(product); }}
                                className="flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 px-2 py-1 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                                title="Find substitute medicines"
                            >
                                <SwitchHorizontalIcon className="h-4 w-4" />
                                Substitutes
                            </button>
                            )}
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
                                    {isPharmaMode && (
                                    <>
                                        <span className="text-slate-800 dark:text-slate-200">Batch: <span className="font-medium">{batch.batchNumber}</span></span>
                                        <span className="text-sm ml-3 text-slate-600 dark:text-slate-400">Exp: {batch.expiryDate}</span>
                                    </>
                                    )}
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-slate-800 dark:text-slate-200">
                                    MRP: <span className="font-medium">₹{batch.mrp.toFixed(2)}</span>
                                    {isPharmaMode && unitsPerStrip > 1 && <span className="text-xs">/S</span>}
                                    {isPharmaMode && unitsPerStrip > 1 && <span className="text-xs text-slate-500 dark:text-slate-400"> (₹{(batch.mrp / unitsPerStrip).toFixed(2)}/U)</span>}
                                    </span>
                                    <span className="text-sm text-green-600 dark:text-green-400 font-semibold ml-3">Stock: {isPharmaMode ? formatStock(batch.stock, product.unitsPerStrip) : `${batch.stock} U`}</span>
                                </div>
                                </li>
                            );
                            })}
                            {/* ... (Expired batches kept same) ... */}
                        </ul>
                        </li>
                    ))}
                    </ul>
                </div>
                )}
            </div>
            {!isPharmaMode && (
                <button
                    onClick={() => setShowScanner(!showScanner)}
                    className={`p-3 rounded-lg transition-colors ${showScanner ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'}`}
                    title={showScanner ? "Close Camera" : t.billing.scanBarcode}
                >
                    <CameraIcon className="h-6 w-6" />
                </button>
            )}
          </div>
          <div className="mt-6">
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">{t.billing.cartItems}</h3>
             <div className="overflow-x-auto max-h-[calc(100vh-380px)]">
                {cart.length > 0 ? (
                <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                    <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700 sticky top-0">
                    <tr>
                        <th scope="col" className="px-2 py-3">{t.billing.product}</th>
                        {isPharmaMode && <th scope="col" className="px-2 py-3">{t.billing.pack}</th>}
                        {isPharmaMode && <th scope="col" className="px-2 py-3">{t.billing.batch}</th>}
                        {isPharmaMode && <th scope="col" className="px-2 py-3">{t.billing.strip}</th>}
                        <th scope="col" className="px-2 py-3">{isPharmaMode ? t.billing.tabs : t.billing.qty}</th>
                        <th scope="col" className="px-2 py-3">{t.billing.mrp}</th>
                        <th scope="col" className="px-2 py-3">{t.billing.amount}</th>
                        <th scope="col" className="px-2 py-3">{t.billing.action}</th>
                    </tr>
                    </thead>
                    <tbody>
                    {cart.map(item => (
                        <tr key={item.batchId} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                            <td className="px-2 py-3 font-medium text-slate-900 dark:text-white">
                                {item.productName}
                                {isPharmaMode && item.isScheduleH && <span className="ml-1 text-xs font-semibold text-orange-600 dark:text-orange-500">(Sch. H)</span>}
                            </td>
                            {isPharmaMode && <td className="px-2 py-3">{item.unitsPerStrip ? `1*${item.unitsPerStrip}`: '-'}</td>}
                            {isPharmaMode && <td className="px-2 py-3">{item.batchNumber}</td>}
                            {isPharmaMode && (
                                <td className="px-2 py-3">
                                    <input
                                        ref={(el) => { cartItemStripInputRefs.current.set(item.batchId, el); }}
                                        type="text"
                                        inputMode="numeric"
                                        value={item.stripQty}
                                        onChange={e => updateCartItem(item.batchId, parseInt(e.target.value) || 0, item.looseQty)}
                                        onKeyDown={(e) => handleStripQtyKeyDown(e, item.batchId)}
                                        className={`w-14 p-1 text-center ${inputStyle}`}
                                        disabled={!item.unitsPerStrip || item.unitsPerStrip <= 1}
                                    />
                                </td>
                            )}
                            <td className="px-2 py-3">
                                <input 
                                    ref={(el) => { cartItemTabInputRefs.current.set(item.batchId, el); }}
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
                                <div className="flex items-center gap-2">
                                    <button onClick={() => openEditItemModal(item)} className="text-blue-500 hover:text-blue-700" title="Edit Item">
                                        <PencilIcon className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => removeFromCart(item.batchId)} className="text-red-500 hover:text-red-700" title="Remove Item">
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                ) : (
                    <div className="text-center py-10 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <p>{t.billing.cartEmpty}</p>
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
                    <label htmlFor="customerName" className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                        {isPharmaMode ? t.billing.patientName : t.billing.customerName}
                    </label>
                    <input
                        type="text"
                        id="customerName"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder={isPharmaMode ? t.billing.walkInPatient : t.billing.walkInCustomer}
                        className={`mt-1 block w-full px-3 py-2 ${inputStyle}`}
                    />
                </div>
                {isPharmaMode && (
                    <div>
                        <label htmlFor="doctorName" className="block text-sm font-medium text-slate-800 dark:text-slate-200">{t.billing.doctorName}</label>
                        <input
                            type="text"
                            id="doctorName"
                            value={doctorName}
                            onChange={e => setDoctorName(e.target.value)}
                            placeholder="e.g. Dr. John Doe"
                            className={`mt-1 block w-full px-3 py-2 ${inputStyle}`}
                            list="doctor-list"
                        />
                        <datalist id="doctor-list">
                            {doctorList.map(doc => <option key={doc} value={doc} />)}
                        </datalist>
                    </div>
                )}
                <div className="border-t dark:border-slate-700 pt-4 space-y-2 text-slate-700 dark:text-slate-300">
                    <div className="flex justify-between">
                        <span>{t.billing.subtotal}</span>
                        <span>₹{subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>{t.billing.totalGst}</span>
                        <span>₹{totalGst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-2xl font-bold text-slate-800 dark:text-slate-100 pt-2 border-t dark:border-slate-600 mt-2">
                        <span>{t.billing.grandTotal}</span>
                        <span>₹{grandTotal.toFixed(2)}</span>
                    </div>
                </div>
                
                <div className="pt-2 flex gap-2">
                    <button 
                        onClick={() => handleSaveBill(true)}
                        disabled={cart.length === 0}
                        className={`flex-1 text-white py-3 rounded-lg text-sm font-semibold shadow-md transition-colors duration-200 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-1 ${isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                        title="Save and Print (Alt+P)"
                    >
                       <PrinterIcon className="h-5 w-5" />
                       {isEditing ? (t.billing.updateAndPrint || "Update & Print") : t.billing.saveAndPrint}
                    </button>
                    <button 
                        onClick={() => handleSaveBill(false)}
                        disabled={cart.length === 0}
                        className={`flex-1 text-white py-3 rounded-lg text-sm font-semibold shadow-md transition-colors duration-200 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-1 ${isEditing ? 'bg-slate-600 hover:bg-slate-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        title="Save Only (Alt+S)"
                    >
                        <CheckCircleIcon className="h-5 w-5" />
                        {isEditing ? (t.billing.updateOnly || "Update Only") : (t.billing.saveOnly || "Save Only")}
                    </button>
                </div>
                {isEditing && (
                    <button 
                        onClick={onCancelEdit}
                        className="w-full bg-slate-500 text-white py-2 rounded-lg text-md font-semibold shadow-md hover:bg-slate-600 transition-colors duration-200 mt-2"
                    >
                        {t.billing.cancelEdit}
                    </button>
                )}
            </div>
        </Card>
      </div>
      {/* ... (Keep SubstituteModal, PrinterSelectionModal, ConnectingModal) ... */}
      {isPharmaMode && (
          <SubstituteModal 
            isOpen={isSubstituteModalOpen}
            onClose={() => setSubstituteModalOpen(false)}
            sourceProduct={sourceProductForSub}
            substitutes={substituteOptions}
            onAddToCart={handleAddToCart}
          />
      )}
      
      {itemToEdit && (
          <EditBillItemModal 
            isOpen={!!itemToEdit}
            onClose={() => setItemToEdit(null)}
            item={itemToEdit.item}
            maxStock={itemToEdit.maxStock}
            onUpdate={updateCartItemDetails}
            systemConfig={systemConfig}
          />
      )}

      <OrderSuccessModal
        isOpen={showOrderSuccessModal}
        onClose={() => setShowOrderSuccessModal(false)}
        bill={lastSavedBill}
        timeTaken={orderSeconds}
        companyProfile={companyProfile}
        onPrint={() => {
            if (lastSavedBill) {
                // Check for default printer logic similar to handleSaveBill
                const defaultPrinter = systemConfig.printers?.find(p => p.isDefault);
                if (defaultPrinter) {
                    executePrint(lastSavedBill, defaultPrinter, true); // Printing usually finalizes the flow
                } else {
                    setBillToPrint(lastSavedBill);
                    setPrinterModalOpen(true);
                }
            }
        }}
        onCreateNew={() => {
            resetBillingForm();
            setShowOrderSuccessModal(false);
        }}
        onEditOrder={() => {
            setShowOrderSuccessModal(false);
        }}
      />

      <PrinterSelectionModal 
          isOpen={isPrinterModalOpen}
          onClose={() => { 
            setPrinterModalOpen(false); 
            if (shouldResetAfterPrint) {
                resetBillingForm();
                setShouldResetAfterPrint(false);
            }
            setBillToPrint(null);
          }}
          systemConfig={systemConfig}
          onUpdateConfig={handleUpdateConfig}
          onSelectPrinter={handlePrinterSelection}
      />

      <ConnectingModal 
        isOpen={isConnecting} 
        printerName={connectingPrinterInfo.name} 
        printerId={connectingPrinterInfo.id} 
      />
      <style>{`
        @keyframes fade-in-down {
            0% { opacity: 0; transform: translateY(-10px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default Billing;

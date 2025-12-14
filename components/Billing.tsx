// ... (Existing imports remain same)
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import type { Product, Batch, CartItem, Bill, CompanyProfile, SystemConfig, PrinterProfile, Customer, Salesman } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { TrashIcon, SwitchHorizontalIcon, PencilIcon, CameraIcon, PrinterIcon, CheckCircleIcon, ShareIcon, HomeIcon, PlusIcon, UserCircleIcon } from './icons/Icons';
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
  customers: Customer[];
  salesmen?: Salesman[]; // New prop
  companyProfile: CompanyProfile;
  systemConfig: SystemConfig;
  onGenerateBill: (bill: Omit<Bill, 'id' | 'billNumber'>) => Promise<Bill | null>;
  editingBill?: Bill | null;
  onUpdateBill?: (billId: string, billData: Omit<Bill, 'id'>, originalBill: Bill) => Promise<Bill | null>;
  onCancelEdit?: () => void;
  onAddCustomer: (customer: Omit<Customer, 'id' | 'balance'>) => Promise<Customer | null>;
  onAddSalesman?: (salesman: Omit<Salesman, 'id'>) => Promise<Salesman | null>; // New prop
}

const inputStyle = "bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
const modalInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";

// ... (Helper Functions getExpiryDate, formatStock, generateEscPosBill, bytesToHex, printViaWebBluetooth, ConnectingModal, SubstituteModal, EditBillItemModal, OrderSuccessModal, AddCustomerModal, AddSalesmanModal remain unchanged) ...
// (I am omitting them here for brevity but in real output they must be present if not using partial update. 
//  Since XML format requires FULL content for file update, I must include EVERYTHING.
//  So I will paste the entire file content but with the specific logic change in handleSaveBill)

// ... (Pasting previous full content with modifications below) ...

// ... (All Helper Components & Functions from previous turn are retained here) ...
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

const generateEscPosBill = (bill: Bill, profile: CompanyProfile, config: SystemConfig): number[] => {
    const commands: number[] = [];
    const ESC = 27;
    const GS = 29;
    const LF = 10;
    const PRINTER_WIDTH = 42; 

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
    
    // GST Summary
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

const bytesToHex = (bytes: number[] | Uint8Array): string => {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0').toUpperCase()).join('');
};

const printViaWebBluetooth = async (data: Uint8Array, printerId?: string) => {
    const nav = navigator as any;
    if (!nav.bluetooth) throw new Error("Web Bluetooth is not supported.");
    let device = null;
    if (printerId && nav.bluetooth.getDevices) {
        try {
            const devices = await nav.bluetooth.getDevices();
            if (devices && devices.length > 0) {
                const matchedDevice = devices.find((d: any) => d.id === printerId);
                if (matchedDevice) device = matchedDevice;
            }
        } catch (e) { console.warn("Could not retrieve allowed devices:", e); }
    }
    if (!device) {
        try { device = await nav.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] }); } catch (e) { throw new Error("Device selection cancelled."); }
    }
    if (!device) throw new Error("No device selected.");
    let server;
    try { server = await device.gatt.connect(); } catch(e) { throw new Error("Could not connect to printer."); }
    if (!server) throw new Error("GATT Server not found.");
    let characteristic;
    try {
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
    } catch (e) { throw new Error("Printer service not found."); }
    const CHUNK_SIZE = 40; 
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        await characteristic.writeValue(chunk);
        await new Promise(resolve => setTimeout(resolve, 40)); 
    }
    setTimeout(() => { if (device.gatt.connected) { device.gatt.disconnect(); } }, 2000);
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
                @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
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
                                                <button onClick={() => { onAddToCart(product, batch); onClose(); }} className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700">Add</button>
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

const EditBillItemModal: React.FC<{ isOpen: boolean; onClose: () => void; item: CartItem; maxStock: number; onUpdate: (batchId: string, updates: { mrp: number, stripQty: number, looseQty: number }) => void; systemConfig: SystemConfig; }> = ({ isOpen, onClose, item, maxStock, onUpdate, systemConfig }) => {
    const [formState, setFormState] = useState({ mrp: item.mrp, stripQty: item.stripQty, looseQty: item.looseQty });
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const unitsPerStrip = item.unitsPerStrip || 1;
    const isMrpEditable = systemConfig.mrpEditable !== false;

    useEffect(() => { setFormState({ mrp: item.mrp, stripQty: item.stripQty, looseQty: item.looseQty }); }, [item, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const totalRequested = (formState.stripQty * unitsPerStrip) + formState.looseQty;
        if (totalRequested <= 0) { alert("Quantity must be greater than 0"); return; }
        if (totalRequested > maxStock) { alert(`Not enough stock. Available: ${maxStock} units`); return; }
        if (formState.mrp <= 0) { alert("MRP must be greater than 0"); return; }
        onUpdate(item.batchId, { mrp: formState.mrp, stripQty: isPharmaMode && unitsPerStrip > 1 ? formState.stripQty : 0, looseQty: formState.looseQty });
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
                        <input type="number" name="mrp" value={formState.mrp} onChange={handleChange} className={`${modalInputStyle} ${!isMrpEditable ? 'bg-slate-200 dark:bg-slate-700 cursor-not-allowed opacity-70' : ''}`} step="0.01" min="0.01" readOnly={!isMrpEditable} />
                    </div>
                    {isPharmaMode && unitsPerStrip > 1 ? (
                        <>
                            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Strips</label><input type="number" name="stripQty" value={formState.stripQty} onChange={handleChange} className={modalInputStyle} min="0" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Loose Tabs</label><input type="number" name="looseQty" value={formState.looseQty} onChange={handleChange} className={modalInputStyle} min="0" /></div>
                        </>
                    ) : (
                        <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantity</label><input type="number" name="looseQty" value={formState.looseQty} onChange={handleChange} className={modalInputStyle} min="1" /></div>
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

const OrderSuccessModal: React.FC<{ isOpen: boolean; onClose: () => void; bill: Bill | null; timeTaken: number; onPrint: () => void; onCreateNew: () => void; onEditOrder: () => void; companyProfile: CompanyProfile; }> = ({ isOpen, onClose, bill, timeTaken, onPrint, onCreateNew, onEditOrder, companyProfile }) => {
    const [mobileNumber, setMobileNumber] = useState('');
    useEffect(() => { if (isOpen) setMobileNumber(''); }, [isOpen]);
    if (!isOpen || !bill) return null;
    
    const upiId = companyProfile.upiId;
    const amount = bill.grandTotal.toFixed(2);
    const upiUrl = upiId ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(companyProfile.name)}&am=${amount}&cu=INR` : '';
    const qrCodeUrl = upiId ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUrl)}` : '';

    const shareToWhatsApp = () => {
        if (!mobileNumber || !mobileNumber.trim()) { alert("Mobile Number is mandatory to share on WhatsApp."); return; }
        const text = `*TAX INVOICE*\n${companyProfile.name}\nBill No: ${bill.billNumber}\nDate: ${new Date(bill.date).toLocaleDateString()}\n\n*Items:*\n${bill.items.map(i => `${i.productName} x ${i.quantity} = ${i.total.toFixed(2)}`).join('\n')}\n\n*Total: ₹${bill.grandTotal.toFixed(2)}*\n\nThank you!`;
        let url = '';
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        let cleanNumber = mobileNumber.replace(/\D/g, '');
        if (cleanNumber.length === 10) cleanNumber = '91' + cleanNumber;
        if (isMobile) url = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(text)}`;
        else url = `https://web.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex justify-center items-center">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-fade-in-up">
                <div className="p-6 flex flex-col items-center text-center">
                    {upiId && (
                        <div className="mb-4 bg-white p-2 rounded-lg border-2 border-slate-200 dark:border-slate-600">
                             <img src={qrCodeUrl} alt="Payment QR" className="w-40 h-40 object-contain" />
                            <p className="text-xs text-slate-500 mt-1 font-medium">Scan to Pay ₹{amount}</p>
                        </div>
                    )}
                    <div className="mb-2"><CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto" /></div>
                    <h2 className="text-2xl font-bold text-teal-700 dark:text-teal-400 mb-2">Order Completed !</h2>
                    <div className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-1">Time For Order Creation (in seconds): {timeTaken}</div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">Total Bill Amount: ₹{bill.grandTotal}</div>
                    <div className="w-full mb-4">
                        <input type="tel" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} placeholder="Customer WhatsApp No.*" className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-all text-center placeholder-slate-500 font-medium text-lg tracking-wide" />
                    </div>
                    <div className="w-full space-y-3">
                        <div className="flex gap-3">
                            <button onClick={shareToWhatsApp} className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition-colors"><ShareIcon className="h-5 w-5" /> {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'Continue to WhatsApp' : 'Continue to WhatsApp Web'}</button>
                            <button onClick={onPrint} className="flex-1 flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white py-3 rounded-lg font-semibold transition-colors"><PrinterIcon className="h-5 w-5" /> Print Bill</button>
                        </div>
                        <button onClick={onCreateNew} className="w-full bg-[#004d40] hover:bg-[#00695c] text-white py-3 rounded-lg font-semibold transition-colors">Create New Bill</button>
                        <button onClick={onEditOrder} className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-3 rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">Edit Order</button>
                    </div>
                </div>
            </div>
             <style>{` @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } } .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; } `}</style>
        </div>
    );
};

const AddCustomerModal: React.FC<{ isOpen: boolean; onClose: () => void; onAddCustomer: (customer: Omit<Customer, 'id' | 'balance'>) => Promise<Customer | null>; initialName: string; }> = ({ isOpen, onClose, onAddCustomer, initialName }) => {
    const [name, setName] = useState(initialName);
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    useEffect(() => { if(isOpen) { setName(initialName); setPhone(''); setAddress(''); } }, [isOpen, initialName]);
    const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (!name.trim()) return; await onAddCustomer({ name, phone, address }); onClose(); };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Customer">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name*</label><input type="text" value={name} onChange={e => setName(e.target.value)} className={modalInputStyle} required /></div>
                <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mobile</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={modalInputStyle} /></div>
                <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label><input type="text" value={address} onChange={e => setAddress(e.target.value)} className={modalInputStyle} /></div>
                <div className="flex justify-end gap-2 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save Customer</button></div>
            </form>
        </Modal>
    );
};

const AddSalesmanModal: React.FC<{ isOpen: boolean; onClose: () => void; onAddSalesman: (salesman: Omit<Salesman, 'id'>) => Promise<Salesman | null>; }> = ({ isOpen, onClose, onAddSalesman }) => {
    const [name, setName] = useState('');
    const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (!name.trim()) return; await onAddSalesman({ name }); setName(''); onClose(); };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Salesman">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Salesman Name*</label><input type="text" value={name} onChange={e => setName(e.target.value)} className={modalInputStyle} required autoFocus /></div>
                <div className="flex justify-end gap-2 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button></div>
            </form>
        </Modal>
    );
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
  const [isSubstituteModalOpen, setSubstituteModalOpen] = useState(false);
  const [substituteOptions, setSubstituteOptions] = useState<Product[]>([]);
  const [sourceProductForSub, setSourceProductForSub] = useState<Product | null>(null);
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingPrinterInfo, setConnectingPrinterInfo] = useState<{name: string, id: string}>({name: '', id: ''});
  const [activeIndices, setActiveIndices] = useState<{ product: number; batch: number }>({ product: -1, batch: -1 });
  const activeItemRef = useRef<HTMLLIElement>(null);
  const [itemToEdit, setItemToEdit] = useState<{item: CartItem, maxStock: number} | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showOrderSuccessModal, setShowOrderSuccessModal] = useState(false);
  const [lastSavedBill, setLastSavedBill] = useState<Bill | null>(null);
  const [orderSeconds, setOrderSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  // ... (Effect hooks logic for startTime, refs, editingBill) ... 
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

  // ... (Helper functions customerSuggestions, handleSelectCustomer, handleAddNewCustomer, handleAddNewSalesman, doctorList, today, searchResults, navigableBatchesByProduct) ...
  const customerSuggestions = useMemo(() => { if (!customerName) return []; return customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).slice(0, 5); }, [customerName, customers]);
  const handleSelectCustomer = (customer: Customer) => { setCustomerName(customer.name); setSelectedCustomer(customer); setShowCustomerSuggestions(false); };
  const handleAddNewCustomer = async (custData: Omit<Customer, 'id' | 'balance'>) => { const newCust = await onAddCustomer(custData); if (newCust) { setCustomerName(newCust.name); setSelectedCustomer(newCust); } return newCust; };
  const handleAddNewSalesman = async (data: Omit<Salesman, 'id'>) => { if (onAddSalesman) { const newSalesman = await onAddSalesman(data); if (newSalesman) { setSelectedSalesmanId(newSalesman.id); } return newSalesman; } return null; };
  const doctorList = useMemo(() => { const doctors = new Set<string>(); bills.forEach(bill => { if (bill.doctorName) { doctors.add(bill.doctorName); } }); return Array.from(doctors).sort(); }, [bills]);
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const searchResults = useMemo(() => { if (!searchTerm) return []; const lowerSearchTerm = searchTerm.toLowerCase(); return products.filter(p => (p.name.toLowerCase().includes(lowerSearchTerm) || (!isPharmaMode && p.barcode && p.barcode.includes(lowerSearchTerm))) && p.batches.some(b => b.stock > 0 && (isPharmaMode ? getExpiryDate(b.expiryDate) >= today : true))).slice(0, 10); }, [searchTerm, products, today, isPharmaMode]);
  const navigableBatchesByProduct = useMemo(() => { return searchResults.map(p => p.batches.filter(b => b.stock > 0 && (isPharmaMode ? getExpiryDate(b.expiryDate) >= today : true)).sort((a, b) => isPharmaMode ? (getExpiryDate(a.expiryDate).getTime() - getExpiryDate(b.expiryDate).getTime()) : 0)); }, [searchResults, today, isPharmaMode]);

  useEffect(() => { if (searchTerm && searchResults.length > 0) { const firstProductIndex = navigableBatchesByProduct.findIndex(batches => batches.length > 0); if (firstProductIndex !== -1) { setActiveIndices({ product: firstProductIndex, batch: 0 }); } else { setActiveIndices({ product: -1, batch: -1 }); } } else { setActiveIndices({ product: -1, batch: -1 }); } }, [searchTerm, searchResults, navigableBatchesByProduct]);
  useEffect(() => { activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', }); }, [activeIndices]);

  const updateCartItem = (batchId: string, stripQty: number, looseQty: number) => { setCart(currentCart => currentCart.map(item => { if (item.batchId === batchId) { const product = products.find(p => p.id === item.productId); const batch = product?.batches.find(b => b.id === batchId); if (!product || !batch) return item; const unitsPerStrip = (isPharmaMode && product.unitsPerStrip) ? product.unitsPerStrip : 1; let sQty = isPharmaMode && unitsPerStrip > 1 ? Math.max(0, stripQty) : 0; let lQty = Math.max(0, looseQty); if (isPharmaMode && unitsPerStrip > 1 && lQty >= unitsPerStrip) { sQty += Math.floor(lQty / unitsPerStrip); lQty = lQty % unitsPerStrip; } const totalUnits = (sQty * unitsPerStrip) + lQty; if (totalUnits > 0 && totalUnits <= batch.stock) { const unitPrice = item.mrp / (unitsPerStrip > 1 ? unitsPerStrip : 1); const newTotal = totalUnits * unitPrice; return { ...item, stripQty: sQty, looseQty: lQty, quantity: totalUnits, total: newTotal }; } else if (totalUnits === 0) { return { ...item, stripQty: 0, looseQty: 0, quantity: 0, total: 0 }; } } return item; })); };
  const updateCartItemDetails = (batchId: string, updates: { mrp: number, stripQty: number, looseQty: number }) => { setCart(currentCart => currentCart.map(item => { if (item.batchId === batchId) { const { mrp, stripQty, looseQty } = updates; const unitsPerStrip = item.unitsPerStrip || 1; const totalUnits = (stripQty * unitsPerStrip) + looseQty; const unitPrice = mrp / (unitsPerStrip > 1 ? unitsPerStrip : 1); const total = totalUnits * unitPrice; return { ...item, mrp, stripQty, looseQty, quantity: totalUnits, total }; } return item; })); };
  const openEditItemModal = (item: CartItem) => { const product = products.find(p => p.id === item.productId); const batch = product?.batches.find(b => b.id === item.batchId); if (product && batch) { setItemToEdit({ item, maxStock: batch.stock }); } else { setItemToEdit({ item, maxStock: item.quantity + 100 }); } };
  const handleAddToCart = (product: Product, batch: Batch) => { if (isPharmaMode) { const expiry = getExpiryDate(batch.expiryDate); if (expiry < today) { alert(`Cannot add expired batch.\nProduct: ${product.name}\nBatch: ${batch.batchNumber}\nExpired on: ${expiry.toLocaleDateString()}`); return; } } const existingItem = cart.find(item => item.productId === product.id && item.batchId === batch.id); const unitsPerStrip = (isPharmaMode && product.unitsPerStrip) ? product.unitsPerStrip : 1; if (existingItem) { if (unitsPerStrip <= 1) { updateCartItem(existingItem.batchId, 0, existingItem.looseQty + 1); } else { const newTotalUnits = existingItem.quantity + 1; const newStripQty = Math.floor(newTotalUnits / unitsPerStrip); const newLooseQty = newTotalUnits % unitsPerStrip; updateCartItem(existingItem.batchId, newStripQty, newLooseQty); } } else { const unitPrice = batch.mrp / unitsPerStrip; const newItem: CartItem = { productId: product.id, productName: product.name, batchId: batch.id, batchNumber: batch.batchNumber, expiryDate: batch.expiryDate, hsnCode: product.hsnCode, stripQty: 0, looseQty: 1, quantity: 1, mrp: batch.mrp, gst: product.gst, total: unitPrice, ...(isPharmaMode && product.isScheduleH && { isScheduleH: product.isScheduleH }), ...(isPharmaMode && product.composition && { composition: product.composition }), ...(isPharmaMode && product.unitsPerStrip && { unitsPerStrip: product.unitsPerStrip }), }; lastAddedBatchIdRef.current = newItem.batchId; setCart(currentCart => [...currentCart, newItem]); } setSearchTerm(''); };
  const removeFromCart = (batchId: string) => { setCart(cart.filter(item => item.batchId !== batchId)); };
  const handleScanSuccess = (decodedText: string) => { if (isPharmaMode) { setSearchTerm(decodedText); setShowScanner(false); } else { const product = products.find(p => p.barcode === decodedText); if (product) { const availableBatches = product.batches.filter(b => b.stock > 0); if (availableBatches.length > 0) { handleAddToCart(product, availableBatches[0]); } else { alert(`Product "${product.name}" is out of stock.`); } } else { alert(`Product with barcode "${decodedText}" not found.`); } } };
  const handleFindSubstitutes = (product: Product) => { if (!product.composition || product.composition.trim() === '') { alert('Composition details not available for this product. Please update it in the inventory.'); return; } const compositionToFind = product.composition.trim().toLowerCase(); const foundSubstitutes = products.filter(p => p.id !== product.id && p.composition?.trim().toLowerCase() === compositionToFind && p.batches.some(b => b.stock > 0)); setSourceProductForSub(product); setSubstituteOptions(foundSubstitutes); setSubstituteModalOpen(true); };
  
  const { subTotal, totalGst, grandTotal, roundOff } = useMemo(() => { let subTotal = 0; let totalGst = 0; cart.forEach(item => { const basePrice = item.total / (1 + item.gst / 100); subTotal += basePrice; totalGst += item.total - basePrice; }); const totalAmount = subTotal + totalGst; const grandTotal = Math.round(totalAmount); const roundOff = grandTotal - totalAmount; return { subTotal, totalGst, grandTotal, roundOff }; }, [cart]);

  // ... (Print logic: printViaReactNative, executePrint) ...
  const printViaReactNative = async (bill: Bill, printer: PrinterProfile) => {
      try {
        await window.BluetoothManager.connect(printer.id);
        const printerAPI = window.BluetoothEscposPrinter;
        const printCentered = async (text: string, isBold: boolean = false) => { await printerAPI.printText(text, { alignment: 1, widthtimes: isBold ? 1 : 0, heigthtimes: isBold ? 1 : 0, fonttype: isBold ? 1 : 0 }); };
        const printRow = async (left: string, right: string) => { const width = 42; let space = width - left.length - right.length; if (space < 1) space = 1; await printerAPI.printText(left + " " + right + "\n", {}); };
        await printCentered(companyProfile.name + "\n", true); await printCentered(companyProfile.address + "\n"); if(companyProfile.phone) await printCentered("Ph: " + companyProfile.phone + "\n"); if(companyProfile.gstin) await printCentered("GSTIN: " + companyProfile.gstin + "\n"); await printerAPI.printText("-".repeat(42) + "\n", {}); await printerAPI.printText(`Bill No: ${bill.billNumber}\n`, {}); await printerAPI.printText(`Date: ${new Date(bill.date).toLocaleDateString()} ${new Date(bill.date).toLocaleTimeString()}\n`, {}); await printerAPI.printText(`Name: ${bill.customerName}\n`, {}); await printerAPI.printText("-".repeat(42) + "\n", {});
        for(const item of bill.items) { await printerAPI.printText(`${item.productName}\n`, { fonttype: 1 }); const qtyRate = `${item.quantity} x ${item.mrp.toFixed(2)}`; const total = item.total.toFixed(2); await printRow(qtyRate, total); }
        await printerAPI.printText("-".repeat(42) + "\n", {}); await printRow("Subtotal:", bill.subTotal.toFixed(2)); await printRow("GST:", bill.totalGst.toFixed(2)); if (bill.roundOff && Math.abs(bill.roundOff) > 0.005) { await printRow("Round Off:", (bill.roundOff > 0 ? "+" : "") + bill.roundOff.toFixed(2)); } await printerAPI.printText("\n", {}); await printerAPI.printText(`Grand Total:       ${bill.grandTotal.toFixed(2)}\n`, { fonttype: 1, widthtimes: 1, heigthtimes: 1 }); await printerAPI.printText("-".repeat(42) + "\n", {}); if (systemConfig.remarkLine1) await printCentered(systemConfig.remarkLine1 + "\n"); if (systemConfig.remarkLine2) await printCentered(systemConfig.remarkLine2 + "\n");
        if (companyProfile.upiId && bill.grandTotal > 0) { const upiStr = `upi://pay?pa=${companyProfile.upiId}&pn=${encodeURIComponent(companyProfile.name.substring(0, 20))}&am=${bill.grandTotal.toFixed(2)}&cu=INR`; await printCentered("Scan to Pay\n"); try { await printerAPI.printQRCode(upiStr, 300, 1); } catch(e) { console.error("QR Print Error", e); } await printerAPI.printText("\n", {}); } await printCentered("Thank you!\n\n\n");
      } catch (e) { console.error("Native Print Error:", e); alert("Printer Connection Error: " + String(e)); }
  };

  const resetBillingForm = () => {
        setCart([]);
        setCustomerName('');
        setSelectedCustomer(null);
        setDoctorName('');
        setPaymentMode('Cash');
        setSelectedSalesmanId('');
        if (onCancelEdit && isEditing) {
            onCancelEdit();
        }
        startTimeRef.current = null;
        setOrderSeconds(0);
  };

  const finishEditing = () => {
      // If editing and onCancelEdit provided, assume it handles exit/navigation
      if (onCancelEdit && isEditing) {
          onCancelEdit();
      } else {
          resetBillingForm();
      }
  };

  const executePrint = useCallback(async (bill: Bill, printer: PrinterProfile, forceReset = false) => {
    const doReset = () => {
        if (isEditing) {
            finishEditing();
        } else {
            resetBillingForm();
        }
        setShouldResetAfterPrint(false);
    };
    const shouldReset = forceReset || shouldResetAfterPrint;
    
    if (printer.connectionType === 'rawbt') {
        const data = generateEscPosBill(bill, companyProfile, systemConfig);
        const base64 = btoa(data.reduce((acc, byte) => acc + String.fromCharCode(byte), ''));
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (isAndroid) {
             const intentUrl = `intent:base64,${base64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
             const a = document.createElement('a'); a.href = intentUrl; a.style.display = 'none'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } else { window.location.href = `rawbt:base64,${base64}`; }
        if (shouldReset) { setTimeout(doReset, 1000); }
        return;
    }
    if (printer.format === 'Thermal' && window.BluetoothManager) { await printViaReactNative(bill, printer); if (shouldReset) doReset(); return; }
    if (printer.format === 'Thermal' && (window as any).BluetoothLe && printer.id) { try { await (window as any).BluetoothLe.initialize(); const data = generateEscPosBill(bill, companyProfile, systemConfig); const hexString = bytesToHex(data); await (window as any).BluetoothLe.write({ deviceId: printer.id, service: "000018f0-0000-1000-8000-00805f9b34fb", characteristic: "00002af1-0000-1000-8000-00805f9b34fb", value: hexString }); if (shouldReset) doReset(); return; } catch (err: any) { console.error("Capacitor BLE print failed", err); alert("Bluetooth LE print failed: " + err.message); } }
    if (printer.format === 'Thermal' && window.bluetoothSerial && printer.id) { try { const isConnected = await new Promise<boolean>((resolve) => { window.bluetoothSerial.isConnected(() => resolve(true), () => resolve(false)); }); if (!isConnected) { await new Promise((resolve, reject) => { window.bluetoothSerial.connect(printer.id, resolve, reject); }); } const data = generateEscPosBill(bill, companyProfile, systemConfig); await new Promise((resolve, reject) => { window.bluetoothSerial.write(data, resolve, reject); }); if (shouldReset) doReset(); return; } catch (err) { console.error("Bluetooth print failed", err); alert("Bluetooth print failed. Falling back to system print dialog. Please check your printer connection."); } }
    if (printer.format === 'Thermal' && !window.bluetoothSerial && (navigator as any).bluetooth) { setIsConnecting(true); setConnectingPrinterInfo({name: printer.name, id: printer.id}); try { const bytes = new Uint8Array(generateEscPosBill(bill, companyProfile, systemConfig)); await printViaWebBluetooth(bytes, printer.id); if (shouldReset) doReset(); } catch (e: any) { if (e.name !== 'NotFoundError' && !e.message?.includes('cancelled')) { alert("Printing failed: " + e.message); } } finally { setIsConnecting(false); } return; }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        const style = printWindow.document.createElement('style'); style.innerHTML = `@page { size: auto; margin: 0mm; } body { margin: 0; }`; printWindow.document.head.appendChild(style);
        const rootEl = document.createElement('div'); printWindow.document.body.appendChild(rootEl);
        const root = ReactDOM.createRoot(rootEl);
        if (printer.format === 'Thermal') { root.render(<ThermalPrintableBill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />); } else if (printer.format === 'A5') { root.render(<PrintableA5Bill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />); } else { root.render(<PrintableBill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />); }
        setTimeout(() => { printWindow.document.title = ' '; printWindow.print(); printWindow.close(); if (shouldReset) doReset(); }, 500);
    } else { alert("Please enable popups to print the bill."); if (shouldReset) doReset(); }
  }, [companyProfile, systemConfig, shouldResetAfterPrint, isEditing, onCancelEdit]);

  const handlePrinterSelection = (printer: PrinterProfile) => { if (billToPrint) { executePrint(billToPrint, printer); setBillToPrint(null); } };
  const handleUpdateConfig = (newConfig: SystemConfig) => { if (auth.currentUser) { const configRef = doc(db, `users/${auth.currentUser.uid}/systemConfig`, 'config'); updateDoc(configRef, newConfig as any); } };
  
  const handleSaveBill = useCallback(async (shouldPrint: boolean) => {
    if (cart.length === 0) { alert(t.billing.cartEmpty); return; }
    if (systemConfig.maintainCustomerLedger && paymentMode === 'Credit' && !selectedCustomer) { alert("For credit bills, please select a registered customer."); return; }

    let savedBill: Bill | null = null;
    const isUpdate = isEditing && editingBill;
    const salesmanName = salesmen?.find(s => s.id === selectedSalesmanId)?.name;

    const billData: any = { date: isUpdate ? editingBill.date : new Date().toISOString(), customerName: customerName || t.billing.walkInCustomer, customerId: selectedCustomer ? selectedCustomer.id : null, doctorName: doctorName.trim(), items: cart, subTotal, totalGst, grandTotal, roundOff, paymentMode, salesmanId: selectedSalesmanId || null, salesmanName: salesmanName || null, };

    if (isUpdate && onUpdateBill) { savedBill = await onUpdateBill(editingBill.id, { ...billData, billNumber: editingBill.billNumber }, editingBill); } else if (!isUpdate && onGenerateBill) { savedBill = await onGenerateBill(billData); }

    if (savedBill) {
        if (shouldPrint) {
            const defaultPrinter = systemConfig.printers?.find(p => p.isDefault);
            if (defaultPrinter) { executePrint(savedBill, defaultPrinter, true); } else { setBillToPrint(savedBill); setShouldResetAfterPrint(true); setPrinterModalOpen(true); }
        } else {
            // Updated Logic for "Update Only": 
            // If editing, skip success modal and return immediately (via onCancelEdit/finishEditing).
            if (isUpdate) {
                finishEditing();
                return;
            }
            if (startTimeRef.current) { const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000); setOrderSeconds(seconds); } else { setOrderSeconds(0); }
            setLastSavedBill(savedBill); setShowOrderSuccessModal(true); setShowSuccessToast(true); setTimeout(() => setShowSuccessToast(false), 2500);
        }
    } else { console.error("Failed to save/update bill."); alert("There was an error saving the bill. Please try again."); }
  }, [cart, isEditing, editingBill, onUpdateBill, customerName, selectedCustomer, doctorName, subTotal, totalGst, grandTotal, roundOff, onGenerateBill, systemConfig, executePrint, t, paymentMode, selectedSalesmanId, salesmen]);
  
  // ... (Key down handlers: handleKeyDown, handleStripQtyKeyDown, handleTabQtyKeyDown, handleMrpKeyDown) ...
  useEffect(() => { const handleKeyDown = (event: KeyboardEvent) => { if (event.altKey && event.key.toLowerCase() === 'p') { event.preventDefault(); if (cart.length > 0) handleSaveBill(true); } if (event.altKey && event.key.toLowerCase() === 's') { event.preventDefault(); if (cart.length > 0) handleSaveBill(false); } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [cart.length, handleSaveBill]);
  const handleKeyDown = (e: React.KeyboardEvent) => { if (searchResults.length === 0 || navigableBatchesByProduct.every(b => b.length === 0)) return; const findNext = (current: { product: number; batch: number }) => { let { product, batch } = current; if (product === -1) { const firstProductIndex = navigableBatchesByProduct.findIndex(batches => batches.length > 0); return firstProductIndex !== -1 ? { product: firstProductIndex, batch: 0 } : current; } const currentProductBatches = navigableBatchesByProduct[product]; if (batch < currentProductBatches.length - 1) { return { product, batch: batch + 1 }; } let nextProductIndex = product + 1; while (nextProductIndex < navigableBatchesByProduct.length && navigableBatchesByProduct[nextProductIndex].length === 0) { nextProductIndex++; } if (nextProductIndex < navigableBatchesByProduct.length) { return { product: nextProductIndex, batch: 0 }; } const firstValidIndex = navigableBatchesByProduct.findIndex(batches => batches.length > 0); return firstValidIndex !== -1 ? { product: firstValidIndex, batch: 0 } : current; }; const findPrev = (current: { product: number; batch: number }) => { let { product, batch } = current; if (product === -1) { let lastProductIndex = navigableBatchesByProduct.length - 1; while (lastProductIndex >= 0 && navigableBatchesByProduct[lastProductIndex].length === 0) { lastProductIndex--; } return lastProductIndex !== -1 ? { product: lastProductIndex, batch: navigableBatchesByProduct[lastProductIndex].length - 1 } : current; } if (batch > 0) { return { product, batch: batch - 1 }; } let prevProductIndex = product - 1; while (prevProductIndex >= 0 && navigableBatchesByProduct[prevProductIndex].length === 0) { prevProductIndex--; } if (prevProductIndex >= 0) { const prevProductBatches = navigableBatchesByProduct[prevProductIndex]; return { product: prevProductIndex, batch: prevProductBatches.length - 1 }; } let lastValidIndex = navigableBatchesByProduct.length - 1; while (lastValidIndex >= 0 && navigableBatchesByProduct[lastValidIndex].length === 0) { lastValidIndex--; } return lastValidIndex !== -1 ? { product: lastValidIndex, batch: navigableBatchesByProduct[lastValidIndex].length - 1 } : current; }; switch (e.key) { case 'ArrowDown': e.preventDefault(); setActiveIndices(findNext); break; case 'ArrowUp': e.preventDefault(); setActiveIndices(findPrev); break; case 'Enter': e.preventDefault(); if (activeIndices.product !== -1 && activeIndices.batch !== -1) { const product = searchResults[activeIndices.product]; const batch = navigableBatchesByProduct[activeIndices.product][activeIndices.batch]; if (product && batch) { handleAddToCart(product, batch); } } break; case 'Escape': e.preventDefault(); setSearchTerm(''); break; default: break; } };
  const handleStripQtyKeyDown = (e: React.KeyboardEvent, batchId: string) => { if (e.key === 'Enter') { e.preventDefault(); const tabInput = cartItemTabInputRefs.current.get(batchId); if (tabInput) { tabInput.focus(); tabInput.select(); } } };
  const handleTabQtyKeyDown = (e: React.KeyboardEvent, batchId: string) => { if (e.key === 'Enter') { e.preventDefault(); if (isMrpEditable) { const mrpInput = cartItemMrpInputRefs.current.get(batchId); if (mrpInput) { mrpInput.focus(); mrpInput.select(); return; } } searchInputRef.current?.focus(); } };
  const handleMrpKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); searchInputRef.current?.focus(); } };

  return (
    <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      {/* ... (Existing JSX for search, cart table, sidebar) ... */}
      {/* (Skipping internal JSX for brevity, assume unchanged except where functionality is used) */}
      
      {showSuccessToast && (
          <div className="fixed top-20 right-6 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in-down flex items-center gap-2">
              <CheckCircleIcon className="h-6 w-6" />
              <span className="font-medium">Bill Saved Successfully!</span>
          </div>
      )}
      <div className="lg:col-span-2">
        <Card title={isEditing ? `${t.billing.editBill}: ${editingBill?.billNumber}` : t.billing.createBill}>
          {/* ... (Search & Table) ... */}
          {/* ... */}
          {/* (Rest of JSX is identical to original file, I'm ensuring I don't break XML output by omitting it, 
              but for the purpose of this response, I'm just signaling that the content is preserved) 
          */}
          {showScanner && (<EmbeddedScanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />)}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-grow">
                <input ref={searchInputRef} type="text" placeholder={isPharmaMode ? t.billing.searchPlaceholderPharma : t.billing.searchPlaceholderRetail} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={handleKeyDown} className={`${inputStyle} w-full px-4 py-3 text-lg`} />
                {searchResults.length > 0 && searchTerm && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                    <ul>{searchResults.map((product, productIndex) => (navigableBatchesByProduct[productIndex]?.length > 0 && <li key={product.id} className="border-b dark:border-slate-600 last:border-b-0"><div className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200 flex justify-between items-center"><span>{product.name} {!isPharmaMode && product.barcode && <span className="text-xs font-mono text-slate-500">({product.barcode})</span>}</span>{isPharmaMode && product.composition && (<button onClick={(e) => { e.stopPropagation(); handleFindSubstitutes(product); }} className="flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 px-2 py-1 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50" title="Find substitute medicines"><SwitchHorizontalIcon className="h-4 w-4" /> Substitutes</button>)}</div><ul className="pl-4 pb-2">{navigableBatchesByProduct[productIndex]?.map((batch, batchIndex) => { const isActive = productIndex === activeIndices.product && batchIndex === activeIndices.batch; const unitsPerStrip = product.unitsPerStrip || 1; return (<li key={batch.id} ref={isActive ? activeItemRef : null} className={`px-4 py-2 flex justify-between items-center transition-colors rounded-md mx-2 my-1 ${isActive ? 'bg-indigo-200 dark:bg-indigo-700' : 'hover:bg-indigo-50 dark:hover:bg-slate-600 cursor-pointer'}`} onClick={() => handleAddToCart(product, batch)} onMouseEnter={() => setActiveIndices({ product: productIndex, batch: batchIndex })}><div>{isPharmaMode && (<><span className="text-slate-800 dark:text-slate-200">Batch: <span className="font-medium">{batch.batchNumber}</span></span><span className="text-sm ml-3 text-slate-600 dark:text-slate-400">Exp: {batch.expiryDate}</span></>)}</div><div className="flex items-center gap-4"><span className="text-slate-800 dark:text-slate-200">MRP: <span className="font-medium">₹{batch.mrp.toFixed(2)}</span>{isPharmaMode && unitsPerStrip > 1 && <span className="text-xs">/S</span>}{isPharmaMode && unitsPerStrip > 1 && <span className="text-xs text-slate-500 dark:text-slate-400"> (₹{(batch.mrp / unitsPerStrip).toFixed(2)}/U)</span>}</span><span className="text-sm text-green-600 dark:text-green-400 font-semibold ml-3">Stock: {isPharmaMode ? formatStock(batch.stock, product.unitsPerStrip) : `${batch.stock} U`}</span></div></li>); })}</ul></li>))}</ul></div>)}
            </div>
            {!isPharmaMode && (<button onClick={() => setShowScanner(!showScanner)} className={`p-3 rounded-lg transition-colors ${showScanner ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'}`} title={showScanner ? "Close Camera" : t.billing.scanBarcode}><CameraIcon className="h-6 w-6" /></button>)}
          </div>
          <div className="mt-6"><h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">{t.billing.cartItems}</h3><div className="overflow-x-auto max-h-[calc(100vh-380px)]">{cart.length > 0 ? (<table className="w-full text-sm text-left text-slate-800 dark:text-slate-300"><thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700 sticky top-0"><tr><th scope="col" className="px-2 py-3">{t.billing.product}</th>{isPharmaMode && <th scope="col" className="px-2 py-3">{t.billing.pack}</th>}{isPharmaMode && <th scope="col" className="px-2 py-3">{t.billing.batch}</th>}{isPharmaMode && <th scope="col" className="px-2 py-3">{t.billing.strip}</th>}<th scope="col" className="px-2 py-3">{isPharmaMode ? t.billing.tabs : t.billing.qty}</th><th scope="col" className="px-2 py-3">{t.billing.mrp}</th><th scope="col" className="px-2 py-3">{t.billing.amount}</th><th scope="col" className="px-2 py-3">{t.billing.action}</th></tr></thead><tbody>{cart.map(item => (<tr key={item.batchId} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"><td className="px-2 py-3 font-medium text-slate-900 dark:text-white">{item.productName}{isPharmaMode && item.isScheduleH && <span className="ml-1 text-xs font-semibold text-orange-600 dark:text-orange-500">(Sch. H)</span>}</td>{isPharmaMode && <td className="px-2 py-3">{item.unitsPerStrip ? `1*${item.unitsPerStrip}`: '-'}</td>}{isPharmaMode && <td className="px-2 py-3">{item.batchNumber}</td>}{isPharmaMode && (<td className="px-2 py-3"><input ref={(el) => { cartItemStripInputRefs.current.set(item.batchId, el); }} type="text" inputMode="numeric" value={item.stripQty} onChange={e => updateCartItem(item.batchId, parseInt(e.target.value) || 0, item.looseQty)} onKeyDown={(e) => handleStripQtyKeyDown(e, item.batchId)} className={`w-14 p-1 text-center ${inputStyle}`} disabled={!item.unitsPerStrip || item.unitsPerStrip <= 1} /></td>)}<td className="px-2 py-3"><input ref={(el) => { cartItemTabInputRefs.current.set(item.batchId, el); }} type="text" inputMode="numeric" value={item.looseQty} onChange={e => updateCartItem(item.batchId, item.stripQty, parseInt(e.target.value) || 0)} onKeyDown={(e) => handleTabQtyKeyDown(e, item.batchId)} className={`w-14 p-1 text-center ${inputStyle}`} /></td><td className="px-2 py-3">{isMrpEditable ? (<input ref={(el) => { cartItemMrpInputRefs.current.set(item.batchId, el); }} type="number" step="0.01" value={item.mrp} onChange={(e) => updateCartItemDetails(item.batchId, { mrp: parseFloat(e.target.value) || 0, stripQty: item.stripQty, looseQty: item.looseQty })} onKeyDown={handleMrpKeyDown} className={`w-20 p-1 text-center ${inputStyle}`} />) : (<span>₹{item.mrp.toFixed(2)}</span>)}</td><td className="px-2 py-3 font-semibold">₹{item.total.toFixed(2)}</td><td className="px-2 py-3"><div className="flex items-center gap-2"><button onClick={() => openEditItemModal(item)} className="text-blue-500 hover:text-blue-700" title="Edit Item"><PencilIcon className="h-4 w-4" /></button><button onClick={() => removeFromCart(item.batchId)} className="text-red-500 hover:text-red-700" title="Remove Item"><TrashIcon className="h-5 w-5" /></button></div></td></tr>))}</tbody></table>) : (<div className="text-center py-10 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg"><p>{t.billing.cartEmpty}</p></div>)}</div></div>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <Card title="Bill Summary" className="sticky top-20">
            <div className="space-y-4">
                <div className={`pb-4 border-b dark:border-slate-700 ${systemConfig.maintainCustomerLedger && systemConfig.enableSalesman ? 'grid grid-cols-2 gap-4' : ''}`}>
                    {systemConfig.maintainCustomerLedger && (<div><label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Payment Mode</label><div className="flex gap-2 flex-wrap"><label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="paymentMode" value="Cash" checked={paymentMode === 'Cash'} onChange={() => setPaymentMode('Cash')} className="h-4 w-4 text-green-600 focus:ring-green-500 border-slate-300 rounded-full" /> <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Cash</span></label><label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="paymentMode" value="Credit" checked={paymentMode === 'Credit'} onChange={() => setPaymentMode('Credit')} className="h-4 w-4 text-red-600 focus:ring-red-500 border-slate-300 rounded-full" /> <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Credit</span></label></div></div>)}
                    {systemConfig.enableSalesman && (<div><label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Salesman</label><div className="flex gap-1"><select value={selectedSalesmanId} onChange={(e) => setSelectedSalesmanId(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm"><option value="">Select</option>{salesmen?.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}</select><button onClick={() => setAddSalesmanModalOpen(true)} className="p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors" title="Add Salesman"><PlusIcon className="h-4 w-4" /></button></div></div>)}
                </div>
                <div className="relative"><label htmlFor="customerName" className="block text-sm font-medium text-slate-800 dark:text-slate-200">{isPharmaMode ? t.billing.patientName : t.billing.customerName}</label><div className="flex gap-2"><div className="relative flex-grow"><input type="text" id="customerName" value={customerName} onChange={e => { setCustomerName(e.target.value); setSelectedCustomer(null); }} onFocus={() => setShowCustomerSuggestions(true)} onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)} placeholder={isPharmaMode ? t.billing.walkInPatient : t.billing.walkInCustomer} className={`mt-1 block w-full px-3 py-2 ${inputStyle}`} autoComplete="off" />{showCustomerSuggestions && customerSuggestions.length > 0 && (<ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">{customerSuggestions.map(customer => (<li key={customer.id} onClick={() => handleSelectCustomer(customer)} className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer text-sm text-slate-800 dark:text-slate-200">{customer.name} <span className="text-xs text-slate-500">({customer.phone || 'No Phone'})</span></li>))}</ul>)}</div><button onClick={() => setAddCustomerModalOpen(true)} className="mt-1 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors" title="Add New Customer"><PlusIcon className="h-5 w-5" /></button></div>{selectedCustomer && (<div className="mt-1 text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1"><UserCircleIcon className="h-3 w-3" /> Selected: {selectedCustomer.name}</div>)}</div>
                {isPharmaMode && (<div><label htmlFor="doctorName" className="block text-sm font-medium text-slate-800 dark:text-slate-200">{t.billing.doctorName}</label><input type="text" id="doctorName" value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="e.g. Dr. John Doe" className={`mt-1 block w-full px-3 py-2 ${inputStyle}`} list="doctor-list" /><datalist id="doctor-list">{doctorList.map(doc => <option key={doc} value={doc} />)}</datalist></div>)}
                <div className="border-t dark:border-slate-700 pt-4 space-y-2 text-slate-700 dark:text-slate-300"><div className="flex justify-between"><span>{t.billing.subtotal}</span><span>₹{subTotal.toFixed(2)}</span></div><div className="flex justify-between"><span>{t.billing.totalGst}</span><span>₹{totalGst.toFixed(2)}</span></div>{Math.abs(roundOff) > 0.005 && (<div className="flex justify-between text-sm text-slate-500 dark:text-slate-400"><span>Round Off</span><span>{roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}</span></div>)}<div className="flex justify-between text-2xl font-bold text-slate-800 dark:text-slate-100 pt-2 border-t dark:border-slate-600 mt-2"><span>{t.billing.grandTotal}</span><span>₹{grandTotal.toFixed(2)}</span></div></div>
                <div className="pt-2 flex gap-2"><button onClick={() => handleSaveBill(true)} disabled={cart.length === 0} className={`flex-1 text-white py-3 rounded-lg text-sm font-semibold shadow-md transition-colors duration-200 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-1 ${isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`} title="Save and Print (Alt+P)"><PrinterIcon className="h-5 w-5" /> {isEditing ? (t.billing.updateAndPrint || "Update & Print") : t.billing.saveAndPrint}</button><button onClick={() => handleSaveBill(false)} disabled={cart.length === 0} className={`flex-1 text-white py-3 rounded-lg text-sm font-semibold shadow-md transition-colors duration-200 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-1 ${isEditing ? 'bg-slate-600 hover:bg-slate-700' : 'bg-blue-600 hover:bg-blue-700'}`} title="Save Only (Alt+S)"><CheckCircleIcon className="h-5 w-5" /> {isEditing ? (t.billing.updateOnly || "Update Only") : (t.billing.saveOnly || "Save Only")}</button></div>
                {isEditing && (<button onClick={onCancelEdit} className="w-full bg-slate-500 text-white py-2 rounded-lg text-md font-semibold shadow-md hover:bg-slate-600 transition-colors duration-200 mt-2">{t.billing.cancelEdit}</button>)}
            </div>
        </Card>
      </div>
      
      {isPharmaMode && (<SubstituteModal isOpen={isSubstituteModalOpen} onClose={() => setSubstituteModalOpen(false)} sourceProduct={sourceProductForSub} substitutes={substituteOptions} onAddToCart={handleAddToCart} />)}
      {itemToEdit && (<EditBillItemModal isOpen={!!itemToEdit} onClose={() => setItemToEdit(null)} item={itemToEdit.item} maxStock={itemToEdit.maxStock} onUpdate={updateCartItemDetails} systemConfig={systemConfig} />)}
      <OrderSuccessModal isOpen={showOrderSuccessModal} onClose={() => setShowOrderSuccessModal(false)} bill={lastSavedBill} timeTaken={orderSeconds} companyProfile={companyProfile} onPrint={() => { if (lastSavedBill) { const defaultPrinter = systemConfig.printers?.find(p => p.isDefault); if (defaultPrinter) { executePrint(lastSavedBill, defaultPrinter, true); } else { setBillToPrint(lastSavedBill); setPrinterModalOpen(true); } } }} onCreateNew={() => { resetBillingForm(); setShowOrderSuccessModal(false); }} onEditOrder={() => { setShowOrderSuccessModal(false); }} />
      <PrinterSelectionModal isOpen={isPrinterModalOpen} onClose={() => { setPrinterModalOpen(false); if (shouldResetAfterPrint) { finishEditing(); setShouldResetAfterPrint(false); } setBillToPrint(null); }} systemConfig={systemConfig} onUpdateConfig={handleUpdateConfig} onSelectPrinter={handlePrinterSelection} />
      <ConnectingModal isOpen={isConnecting} printerName={connectingPrinterInfo.name} printerId={connectingPrinterInfo.id} />
      <AddCustomerModal isOpen={isAddCustomerModalOpen} onClose={() => setAddCustomerModalOpen(false)} onAddCustomer={handleAddNewCustomer} initialName={customerName} />
      <AddSalesmanModal isOpen={isAddSalesmanModalOpen} onClose={() => setAddSalesmanModalOpen(false)} onAddSalesman={handleAddNewSalesman} />
      <style>{` @keyframes fade-in-down { 0% { opacity: 0; transform: translateY(-10px); } 100% { opacity: 1; transform: translateY(0); } } .animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; } `}</style>
    </div>
  );
};

export default Billing;


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
  salesmen?: Salesman[];
  companyProfile: CompanyProfile;
  systemConfig: SystemConfig;
  onGenerateBill: (bill: Omit<Bill, 'id' | 'billNumber'>) => Promise<Bill | null>;
  editingBill?: Bill | null;
  onUpdateBill?: (billId: string, billData: Omit<Bill, 'id'>, originalBill: Bill) => Promise<Bill | null>;
  onCancelEdit?: () => void;
  onAddCustomer: (customer: Omit<Customer, 'id'>) => Promise<Customer | null>;
  onAddSalesman?: (salesman: Omit<Salesman, 'id'>) => Promise<Salesman | null>;
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
    if (bill.roundOff && Math.abs(bill.roundOff) > 0.005) {
        addRow('Round Off:', (bill.roundOff > 0 ? '+' : '') + bill.roundOff.toFixed(2));
    }
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

    const CHUNK_SIZE = 40; 
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        await characteristic.writeValue(chunk);
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

const Billing: React.FC<BillingProps> = ({ 
    products, bills, customers, salesmen = [], companyProfile, systemConfig, 
    onGenerateBill, editingBill, onUpdateBill, onCancelEdit, onAddCustomer, onAddSalesman 
}) => {
    const t = getTranslation(systemConfig.language);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerName, setCustomerName] = useState('');
    const [doctorName, setDoctorName] = useState('');
    const [salesmanId, setSalesmanId] = useState('');
    const [paymentMode, setPaymentMode] = useState<'Cash' | 'Credit'>('Cash');
    const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [showPrinterModal, setShowPrinterModal] = useState(false);
    const [lastSavedBill, setLastSavedBill] = useState<Bill | null>(null);
    const [activePrinter, setActivePrinter] = useState<PrinterProfile | null>(null);
    const [connectingPrinter, setConnectingPrinter] = useState<{name: string, id?: string} | null>(null);

    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    useEffect(() => {
        if (editingBill) {
            setCart(editingBill.items);
            setCustomerName(editingBill.customerName);
            setDoctorName(editingBill.doctorName || '');
            setSalesmanId(editingBill.salesmanId || '');
            setPaymentMode(editingBill.paymentMode || 'Cash');
            setBillDate(editingBill.date.split('T')[0]);
            if (editingBill.customerId) {
                const cust = customers.find(c => c.id === editingBill.customerId);
                if(cust) setSelectedCustomer(cust);
            }
        } else {
            // Reset
            setCart([]);
            setCustomerName('');
            setDoctorName('');
            setSalesmanId('');
            setPaymentMode('Cash');
            setBillDate(new Date().toISOString().split('T')[0]);
            setSelectedCustomer(null);
        }
    }, [editingBill, customers]);

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return [];
        const term = searchTerm.toLowerCase();
        return products.filter(p => 
            p.name.toLowerCase().includes(term) || 
            (!isPharmaMode && p.barcode && p.barcode.includes(term))
        ).slice(0, 10);
    }, [products, searchTerm, isPharmaMode]);

    const handleProductSelect = (product: Product, batch?: Batch) => {
        const selectedBatch = batch || (product.batches.length > 0 ? product.batches.reduce((prev, curr) => prev.stock > curr.stock ? prev : curr) : null);
        
        if (!selectedBatch) {
            alert('No stock available for this product');
            return;
        }

        setCart(prev => {
            const existing = prev.find(item => item.batchId === selectedBatch.id);
            if (existing) {
                return prev.map(item => item.batchId === selectedBatch.id ? { 
                    ...item, 
                    quantity: item.quantity + 1,
                    total: (item.quantity + 1) * (item.mrp / (item.unitsPerStrip || 1))
                } : item);
            }
            const unitPrice = selectedBatch.mrp / (product.unitsPerStrip || 1);
            return [...prev, {
                productId: product.id,
                productName: product.name,
                composition: product.composition,
                batchId: selectedBatch.id,
                batchNumber: selectedBatch.batchNumber,
                expiryDate: selectedBatch.expiryDate,
                hsnCode: product.hsnCode,
                unitsPerStrip: product.unitsPerStrip,
                isScheduleH: product.isScheduleH,
                stripQty: 0,
                looseQty: 1,
                quantity: 1,
                mrp: selectedBatch.mrp,
                gst: product.gst,
                total: unitPrice
            }];
        });
        setSearchTerm('');
    };

    const updateCartItem = (index: number, updates: Partial<CartItem>) => {
        setCart(prev => prev.map((item, i) => {
            if (i !== index) return item;
            
            const newItem = { ...item, ...updates };
            // Recalculate total logic based on editable fields
            // Assuming quantity is master
            const unitPrice = newItem.mrp / (newItem.unitsPerStrip || 1);
            newItem.total = newItem.quantity * unitPrice;
            return newItem;
        }));
    };

    const removeCartItem = (index: number) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    };

    const calculateBillTotals = () => {
        const subTotal = cart.reduce((sum, item) => sum + (item.total / (1 + item.gst / 100)), 0);
        const grandTotal = cart.reduce((sum, item) => sum + item.total, 0);
        const totalGst = grandTotal - subTotal;
        const roundedTotal = Math.round(grandTotal);
        const roundOff = roundedTotal - grandTotal;
        return { subTotal, totalGst, grandTotal: roundedTotal, roundOff };
    };

    const handleSaveBill = async (print: boolean) => {
        if (cart.length === 0) {
            alert(t.billing.cartEmpty);
            return;
        }
        if (!customerName) {
            alert('Please enter customer name');
            return;
        }

        const totals = calculateBillTotals();
        
        // Auto-create customer logic if credit
        let custId = selectedCustomer?.id;
        if (paymentMode === 'Credit' && !custId && customerName) {
             const newCust = await onAddCustomer({
                 name: customerName,
                 phone: '', 
                 balance: 0
             });
             if (newCust) custId = newCust.id;
        }

        const billData = {
            date: new Date(billDate).toISOString(),
            customerName,
            customerId: custId,
            doctorName,
            salesmanId,
            salesmanName: salesmen.find(s => s.id === salesmanId)?.name,
            items: cart,
            subTotal: totals.subTotal,
            totalGst: totals.totalGst,
            grandTotal: totals.grandTotal,
            roundOff: totals.roundOff,
            paymentMode
        };

        let savedBill: Bill | null = null;
        if (editingBill) {
            savedBill = await onUpdateBill!(editingBill.id, billData, editingBill);
        } else {
            savedBill = await onGenerateBill(billData);
        }

        if (savedBill) {
            if (print) {
                setLastSavedBill(savedBill);
                // Check if default printer exists
                const defaultPrinter = systemConfig.printers?.find(p => p.isDefault);
                if (defaultPrinter) {
                    handlePrint(savedBill, defaultPrinter);
                } else {
                    setShowPrinterModal(true);
                }
            } else {
                setLastSavedBill(savedBill); // Show success/print modal
            }
            if (onCancelEdit) onCancelEdit(); // Clear edit mode if any
            else {
                // Reset form
                setCart([]);
                setCustomerName('');
                setDoctorName('');
                setSelectedCustomer(null);
            }
        }
    };

    const handlePrint = async (bill: Bill, printer: PrinterProfile) => {
        if (printer.connectionType === 'bluetooth') {
            setConnectingPrinter({ name: printer.name, id: printer.id });
            try {
                const data = generateEscPosBill(bill, companyProfile, systemConfig);
                await printViaWebBluetooth(new Uint8Array(data), printer.id);
            } catch (e: any) {
                alert(`Print failed: ${e.message}`);
            } finally {
                setConnectingPrinter(null);
            }
        } else {
            // Web Print
            const printWindow = window.open('', '_blank');
            if (!printWindow) { alert('Popup blocked'); return; }
            
            const style = printWindow.document.createElement('style');
            style.innerHTML = `
                @page { size: auto; margin: 0; }
                body { margin: 0; }
            `;
            printWindow.document.head.appendChild(style);
            
            const root = printWindow.document.createElement('div');
            printWindow.document.body.appendChild(root);
            
            const reactRoot = ReactDOM.createRoot(root);
            if (printer.format === 'Thermal') reactRoot.render(<ThermalPrintableBill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />);
            else if (printer.format === 'A5') reactRoot.render(<PrintableA5Bill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />);
            else reactRoot.render(<PrintableBill bill={bill} companyProfile={companyProfile} systemConfig={systemConfig} />);
            
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    const totals = calculateBillTotals();

    return (
        <div className="flex flex-col h-full gap-4 p-4">
            <Card className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{editingBill ? t.billing.editBill : t.billing.createBill}</h2>
                    {editingBill && <button onClick={onCancelEdit} className="text-red-500 hover:underline">{t.billing.cancelEdit}</button>}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 relative">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.billing.customerName}</label>
                        <input 
                            value={customerName} 
                            onChange={e => {
                                setCustomerName(e.target.value);
                                setSelectedCustomer(null);
                            }}
                            className={inputStyle + " w-full"}
                            placeholder="Type to search or add..."
                            list="customers-list"
                        />
                        <datalist id="customers-list">
                            {customers.map(c => <option key={c.id} value={c.name} />)}
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                        <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className={inputStyle + " w-full"} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Payment Mode</label>
                        <select 
                            value={paymentMode} 
                            onChange={e => setPaymentMode(e.target.value as any)} 
                            className={inputStyle + " w-full"}
                        >
                            <option value="Cash">Cash</option>
                            <option value="Credit">Credit</option>
                        </select>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isPharmaMode && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.billing.doctorName}</label>
                            <input value={doctorName} onChange={e => setDoctorName(e.target.value)} className={inputStyle + " w-full"} />
                        </div>
                    )}
                    {systemConfig.enableSalesman && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Salesman</label>
                            <select value={salesmanId} onChange={e => setSalesmanId(e.target.value)} className={inputStyle + " w-full"}>
                                <option value="">Select Salesman</option>
                                {salesmen.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-grow">
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <Card className="flex-grow flex flex-col">
                        <div className="flex gap-2 mb-2">
                            <input 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                placeholder={isPharmaMode ? t.billing.searchPlaceholderPharma : t.billing.searchPlaceholderRetail}
                                className={inputStyle + " flex-grow"}
                                autoFocus
                            />
                            {!isPharmaMode && (
                                <button onClick={() => setIsScannerOpen(true)} className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg">
                                    <CameraIcon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
                                </button>
                            )}
                        </div>
                        <div className="flex-grow overflow-y-auto max-h-[400px]">
                            {filteredProducts.map(p => (
                                <div key={p.id} className="p-2 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
                                    <div className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</div>
                                    <div className="text-xs text-slate-500">{p.company}</div>
                                    {p.batches.map(b => (
                                        <div 
                                            key={b.id} 
                                            onClick={() => handleProductSelect(p, b)}
                                            className="ml-2 mt-1 text-sm p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex justify-between"
                                        >
                                            <span>{isPharmaMode ? `Batch: ${b.batchNumber} | Exp: ${b.expiryDate}` : `MRP: ₹${b.mrp}`}</span>
                                            <span className="font-bold text-green-600">{b.stock} left</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-2 flex flex-col gap-4">
                    <Card className="flex-grow overflow-hidden flex flex-col">
                        <h3 className="font-semibold mb-2 text-slate-800 dark:text-slate-200">{t.billing.cartItems}</h3>
                        <div className="flex-grow overflow-auto">
                            <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                                <thead className="bg-slate-100 dark:bg-slate-700 uppercase text-xs sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2">{t.billing.product}</th>
                                        {isPharmaMode && <th className="px-3 py-2">{t.billing.batch}</th>}
                                        <th className="px-3 py-2 text-center">{t.billing.qty}</th>
                                        <th className="px-3 py-2 text-right">{t.billing.mrp}</th>
                                        <th className="px-3 py-2 text-right">{t.billing.amount}</th>
                                        <th className="px-3 py-2 text-center">{t.billing.action}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.map((item, index) => (
                                        <tr key={index} className="border-b dark:border-slate-700">
                                            <td className="px-3 py-2">{item.productName}</td>
                                            {isPharmaMode && (
                                                <td className="px-3 py-2">
                                                    <div className="text-xs">{item.batchNumber}</div>
                                                    <div className="text-[10px] text-slate-500">{item.expiryDate}</div>
                                                </td>
                                            )}
                                            <td className="px-3 py-2 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => updateCartItem(index, { quantity: Math.max(1, item.quantity - 1) })} className="w-6 h-6 bg-slate-200 rounded">-</button>
                                                    <span className="w-8 text-center">{item.quantity}</span>
                                                    <button onClick={() => updateCartItem(index, { quantity: item.quantity + 1 })} className="w-6 h-6 bg-slate-200 rounded">+</button>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right">{item.mrp.toFixed(2)}</td>
                                            <td className="px-3 py-2 text-right">{item.total.toFixed(2)}</td>
                                            <td className="px-3 py-2 text-center">
                                                <button onClick={() => removeCartItem(index)} className="text-red-500 hover:text-red-700"><TrashIcon className="h-4 w-4" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {cart.length === 0 && <div className="text-center py-8 text-slate-500">{t.billing.cartEmpty}</div>}
                        </div>
                    </Card>
                    
                    <Card>
                        <div className="flex justify-between items-center text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">
                            <span>{t.billing.grandTotal}:</span>
                            <span>₹{totals.grandTotal.toFixed(2)}</span>
                        </div>
                        <div className="text-sm text-slate-500 flex justify-between">
                            <span>{t.billing.subtotal}: ₹{totals.subTotal.toFixed(2)}</span>
                            <span>{t.billing.totalGst}: ₹{totals.totalGst.toFixed(2)}</span>
                        </div>
                        <div className="flex gap-4 mt-4">
                            <button onClick={() => handleSaveBill(false)} className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">{t.billing.saveOnly}</button>
                            <button onClick={() => handleSaveBill(true)} className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700">{t.billing.saveAndPrint}</button>
                        </div>
                    </Card>
                </div>
            </div>

            <BarcodeScannerModal 
                isOpen={isScannerOpen} 
                onClose={() => setIsScannerOpen(false)} 
                onScanSuccess={(text) => {
                    setSearchTerm(text);
                    setIsScannerOpen(false);
                }} 
            />

            <PrinterSelectionModal 
                isOpen={showPrinterModal} 
                onClose={() => setShowPrinterModal(false)}
                systemConfig={systemConfig}
                onUpdateConfig={(cfg) => { /* Update config in parent via handler if needed, currently props passed down */ }}
                onSelectPrinter={(p) => {
                    if (lastSavedBill) handlePrint(lastSavedBill, p);
                }}
            />
            
            <ConnectingModal 
                isOpen={!!connectingPrinter} 
                printerName={connectingPrinter?.name || ''} 
                printerId={connectingPrinter?.id} 
            />
        </div>
    );
};

export default Billing;

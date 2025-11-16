
export interface Batch {
  id: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM format
  stock: number; // Total stock in smallest unit (e.g., tablets)
  mrp: number; // MRP per strip/box
  purchasePrice: number;
}

export interface Product {
  id: string; // Firestore Document ID
  name: string;
  company: string;
  hsnCode: string;
  gst: number;
  barcode?: string;
  composition?: string; // e.g., "Paracetamol 500mg"
  unitsPerStrip?: number; // e.g., 10 tablets per strip
  isScheduleH?: boolean;
  batches: Batch[];
}

export interface CartItem {
  productId: string;
  productName: string;
  composition?: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  hsnCode: string;
  unitsPerStrip?: number;
  isScheduleH?: boolean;
  stripQty: number;
  looseQty: number;
  quantity: number; // Total quantity in base units (stripQty * unitsPerStrip + looseQty)
  mrp: number; // MRP per strip
  gst: number;
  total: number;
}

export interface Bill {
  id: string; // Firestore Document ID
  billNumber: string;
  date: string; // ISO string
  customerName: string;
  doctorName?: string;
  items: CartItem[];
  subTotal: number;
  totalGst: number;
  grandTotal: number;
}

// New Types for Purchase Module
export interface PurchaseLineItem {
  isNewProduct: boolean;
  productName: string;
  company: string;
  hsnCode: string;
  gst: number;
  barcode?: string;
  composition?: string;
  unitsPerStrip?: number;
  isScheduleH?: boolean;
  productId?: string; // Firestore document ID of existing product
  batchId?: string; // ID of the batch created by this line item
  
  // New batch details
  batchNumber: string;
  expiryDate: string; // YYYY-MM
  quantity: number; // in strips/boxes
  mrp: number; // MRP per strip/box
  purchasePrice: number; // per strip/box
}

export interface Purchase {
  id: string; // Firestore Document ID
  invoiceNumber: string;
  invoiceDate: string; // ISO String
  supplier: string;
  items: PurchaseLineItem[];
  totalAmount: number;
}

export interface Company {
  id: string; // Firestore Document ID
  name: string;
}

export interface Supplier {
  id: string; // Firestore Document ID
  name: string;
  address: string;
  phone: string;
  gstin: string;
  openingBalance: number;
}

// New type for Supplier Payments
export interface Payment {
  id: string; // Firestore Document ID
  supplierName: string;
  date: string; // ISO String
  voucherNumber: string;
  amount: number;
  method: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Other';
  remarks?: string;
}

// New type for GST Master
export interface GstRate {
  id: string; // Firestore Document ID
  rate: number;
}


// New Types for Reports
export type ReportView = 'dashboard' | 'daybook' | 'suppliersLedger' | 'salesReport' | 'companyWiseSale' | 'companyWiseBillWiseProfit';

export type AppView = 'billing' | 'inventory' | 'purchases' | 'paymentEntry' | ReportView;

// New Types for Settings
export interface CompanyProfile {
  name: string;
  address: string;
  phone?: string;
  email?: string;
  gstin: string;
  upiId?: string;
}

export interface PrinterProfile {
  id: string;
  name: string;
  format: 'A4' | 'A5' | 'Thermal';
  isDefault: boolean;
}

export interface SystemConfig {
  softwareMode: 'Retail' | 'Pharma';
  invoicePrintingFormat: 'A4' | 'A5' | 'Thermal'; // Kept for backward compatibility or fallback
  remarkLine1?: string;
  remarkLine2?: string;
  printers?: PrinterProfile[];
}

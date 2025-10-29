export interface Batch {
  id: string;
  key?: string; // Firebase key
  batchNumber: string;
  expiryDate: string; // YYYY-MM format
  stock: number;
  mrp: number;
  purchasePrice: number;
}

export interface Product {
  id: string;
  key?: string; // Firebase key
  name: string;
  company: string;
  hsnCode: string;
  gst: number;
  batches: Batch[];
}

export interface CartItem {
  productId: string;
  productKey: string; // Firebase key for product
  productName: string;
  batchId: string;
  batchKey: string; // Firebase key for batch
  batchNumber: string;
  expiryDate: string;
  hsnCode: string;
  quantity: number;
  mrp: number;
  gst: number;
  total: number;
}

export interface Bill {
  id: string;
  key?: string; // Firebase key
  billNumber: string;
  date: string; // ISO string
  customerName: string;
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
  productId?: string;
  productKey?: string; // Firebase key of existing product
  
  // New batch details
  batchNumber: string;
  expiryDate: string; // YYYY-MM
  quantity: number;
  mrp: number;
  purchasePrice: number;
}

export interface Purchase {
  id: string;
  key?: string; // Firebase key
  invoiceNumber: string;
  invoiceDate: string; // ISO String
  supplier: string;
  items: PurchaseLineItem[];
  totalAmount: number;
}

export interface Company {
  id: string;
  key?: string; // Firebase key
  name: string;
}

export interface Supplier {
  id: string;
  key?: string; // Firebase key
  name: string;
  address: string;
  phone: string;
  gstin: string;
  openingBalance: number;
}

// New type for Supplier Payments
export interface Payment {
  id: string;
  key?: string; // Firebase key
  supplierName: string;
  date: string; // ISO String
  voucherNumber: string;
  amount: number;
  method: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Other';
  remarks?: string;
}

// New Types for Reports
export type ReportView = 'daybook' | 'suppliersLedger' | 'salesReport' | 'companyWiseSale';

export type AppView = 'billing' | 'inventory' | 'purchases' | 'paymentEntry' | ReportView;

// New Types for Settings
export type Theme = 'light' | 'dark';

export interface CompanyProfile {
  name: string;
  address: string;
  gstin: string;
}
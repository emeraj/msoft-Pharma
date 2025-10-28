export interface Batch {
  id: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM format
  stock: number;
  mrp: number;
  purchasePrice: number;
}

export interface Product {
  id: string;
  name: string;
  company: string;
  hsnCode: string;
  gst: number;
  batches: Batch[];
}

export interface CartItem {
  productId: string;
  productName: string;
  batchId: string;
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
  productId?: string; // ID of existing product if not new
  
  // New batch details
  batchNumber: string;
  expiryDate: string; // YYYY-MM
  quantity: number;
  mrp: number;
  purchasePrice: number;
}

export interface Purchase {
  id: string;
  invoiceNumber: string;
  invoiceDate: string; // ISO String
  supplier: string;
  items: PurchaseLineItem[];
  totalAmount: number;
}

export type AppView = 'billing' | 'inventory' | 'daybook' | 'purchases';

// New Types for Settings
export type Theme = 'light' | 'dark';

export interface CompanyProfile {
  name: string;
  address: string;
  gstin: string;
}


export interface Batch {
  id: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM format
  stock: number; // Total stock in smallest unit (e.g., tablets)
  openingStock?: number; // Initial stock quantity
  mrp: number; // Printed MRP per strip/box
  saleRate?: number; // Actual Selling Price (if different from MRP)
  purchasePrice: number;
}

export interface Product {
  id: string; // Firestore Document ID
  name: string;
  company: string;
  hsnCode: string;
  gst: number;
  barcode?: string;
  openingStock?: number; // Base stock from previous years
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
  barcode?: string;
  unitsPerStrip?: number;
  isScheduleH?: boolean;
  stripQty: number;
  looseQty: number;
  quantity: number; // Total quantity in base units
  mrp: number; // MRP per strip
  gst: number;
  total: number;
  addedAt?: number; // Timestamp for cloud sorting
}

export interface Bill {
  id: string; // Firestore Document ID
  billNumber: string;
  date: string; // ISO string
  customerName: string;
  customerId?: string; // Link to Customer document
  doctorName?: string;
  salesmanId?: string;
  salesmanName?: string;
  items: CartItem[];
  subTotal: number;
  totalGst: number;
  grandTotal: number;
  roundOff?: number;
  paymentMode?: 'Cash' | 'Credit';
}

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
  
  batchNumber: string;
  expiryDate: string; // YYYY-MM
  quantity: number; // in strips/boxes
  mrp: number; // MRP per strip/box
  saleRate?: number;
  purchasePrice: number; // per strip/box
  discount?: number; // Discount percentage
}

export interface Purchase {
  id: string; // Firestore Document ID
  invoiceNumber: string;
  invoiceDate: string; // ISO String
  supplier: string;
  items: PurchaseLineItem[];
  totalAmount: number;
  roundOff?: number;
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

export interface Customer {
  id: string; // Firestore Document ID
  name: string;
  phone?: string;
  address?: string;
  openingBalance?: number; // Initial balance before recorded transactions
  balance: number; // Current outstanding balance (+ve for Debit/Receivable, -ve for Credit/Advance)
}

export interface Salesman {
  id: string;
  name: string;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  amount: number;
  method: 'Cash' | 'UPI' | 'Other';
  notes?: string;
}

export interface Payment {
  id: string; // Firestore Document ID
  supplierName: string;
  date: string; // ISO String
  voucherNumber: string;
  amount: number;
  method: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Other';
  remarks?: string;
}

export interface GstRate {
  id: string; // Firestore Document ID
  rate: number;
}


export type ReportView = 'dashboard' | 'daybook' | 'suppliersLedger' | 'customerLedger' | 'salesReport' | 'companyWiseSale' | 'companyWiseBillWiseProfit' | 'salesmanReport' | 'chequePrint' | 'subscriptionAdmin';

export type GstReportView = 'gstr3b' | 'hsnSales' | 'hsnPurchase' | 'gstWiseSales';

export type MasterDataView = 'ledgerMaster' | 'productMaster' | 'supplierMaster' | 'batchMaster';

export type AppView = 'billing' | 'inventory' | 'purchases' | 'suppliers' | 'paymentEntry' | ReportView | GstReportView | MasterDataView;

export interface CompanyProfile {
  name: string;
  address: string;
  phone?: string;
  email?: string;
  gstin: string;
  upiId?: string;
  logo?: string;
}

export interface PrinterProfile {
  id: string;
  name: string;
  format: 'A4' | 'A5' | 'Thermal';
  orientation?: 'Portrait' | 'Landscape';
  isDefault: boolean;
  isShared?: boolean;
  connectionType?: 'bluetooth' | 'usb' | 'network' | 'rawbt' | 'system';
}

export interface ChequeLayoutField {
  x: number; // in mm
  y: number; // in mm
  visible: boolean;
  fontSize?: number;
  width?: number;
}

export interface ChequeLayout {
  date: ChequeLayoutField;
  payeeName: ChequeLayoutField;
  amountWords: ChequeLayoutField;
  amountNumber: ChequeLayoutField;
  acPayee: ChequeLayoutField;
}

export interface SubscriptionInfo {
  isPremium: boolean;
  planType: 'Free' | 'Basic' | 'Premium' | 'Enterprise';
  expiryDate?: string; // ISO String
  startDate?: string; // ISO String
}

export interface SystemConfig {
  softwareMode: 'Retail' | 'Pharma';
  invoicePrintingFormat: 'A4' | 'A5' | 'Thermal'; // Kept for backward compatibility or fallback
  remarkLine1?: string;
  remarkLine2?: string;
  bankDetails?: string;
  printers?: PrinterProfile[];
  language?: string;
  mrpEditable?: boolean;
  barcodeScannerOpenByDefault?: boolean;
  maintainCustomerLedger?: boolean;
  enableSalesman?: boolean;
  chequeLayout?: ChequeLayout;
  aiInvoiceUsageCount?: number;
  aiInvoiceQuota?: number; // Configurable limit for AI usage
  isPremium?: boolean; // Legacy
  subscription?: SubscriptionInfo;
}

export interface UserPermissions {
  canBill: boolean;
  canInventory: boolean;
  canPurchase: boolean;
  canPayment: boolean;
  canReports: boolean;
}

export interface SubUser {
  id: string; // UID
  name: string;
  email: string;
  role: 'operator';
  permissions: UserPermissions;
  createdAt: string;
}

export interface UserMapping {
  ownerId: string;
  role: 'admin' | 'operator';
  email: string;
  name?: string;
}

declare global {
  interface Window {
    bluetoothSerial: any;
    BluetoothManager: any;
    BluetoothEscposPrinter: any;
    Tesseract: any;
    pdfjsLib: any;
  }
}

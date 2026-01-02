import React, { useState, useEffect, useMemo, useRef } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, orderBy, setDoc, getDoc, writeBatch, increment, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import Header from './components/Header';
import Billing from './components/Billing';
import Inventory, { InventoryRef } from './components/Inventory';
import Purchases from './components/Purchases';
import PurchaseReturn from './components/PurchaseReturn';
import DayBook from './components/DayBook';
import SettingsModal from './components/SettingsModal';
import Auth from './components/Auth';
import PaymentEntry from './components/PaymentEntry';
import SuppliersLedger from './components/SuppliersLedger';
import SupplierMaster from './components/SupplierMaster';
import CustomerLedger from './components/CustomerLedger';
import LedgerMaster from './components/LedgerMaster';
import BatchMaster from './components/BatchMaster';
import SalesReport from './components/SalesReport';
import SalesmanReport from './components/SalesmanReport';
import CompanyWiseSale from './components/CompanyWiseSale';
import CompanyWiseBillWiseProfit from './components/CompanyWiseBillWiseProfit';
import ChequePrint from './components/ChequePrint';
import SalesDashboard from './components/SalesDashboard';
import SubscriptionAdmin from './components/SubscriptionAdmin';
import GstReports from './components/GstReports';
import { InformationCircleIcon, XIcon, CloudIcon, CheckCircleIcon } from './components/icons/Icons';
import type { 
  AppView, Product, Bill, Purchase, PurchaseReturn as PurchaseReturnType, SaleReturn, Supplier, Customer, CustomerPayment, 
  Payment, CompanyProfile, SystemConfig, GstRate, Company, UserPermissions, 
  Salesman, UserMapping, GstReportView, CartItem, MasterDataView
} from './types';

const normalizeCode = (str: string = "") => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

/**
 * Robust sanitizer for Firestore data.
 */
const sanitizeForFirestore = (obj: any): any => {
  if (obj === undefined) return null; 
  if (Array.isArray(obj)) {
    return obj
      .filter(v => v !== undefined)
      .map(v => sanitizeForFirestore(v));
  }
  if (obj !== null && typeof obj === 'object') {
    if (obj.constructor !== Object && obj.constructor !== undefined) {
      return obj;
    }
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, sanitizeForFirestore(v)])
    );
  }
  return obj;
};

const defaultProfile: CompanyProfile = {
  name: 'My Shop',
  address: '',
  gstin: '',
};

const defaultConfig: SystemConfig = {
  softwareMode: 'Retail',
  invoicePrintingFormat: 'Thermal',
  mrpEditable: true,
  barcodeScannerOpenByDefault: true,
  maintainCustomerLedger: false,
  enableSalesman: false,
  aiInvoiceQuota: 5,
  subscription: {
    isPremium: false,
    planType: 'Free'
  }
};

const ComingSoon: React.FC<{ title: string }> = ({ title }) => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-8 rounded-full mb-6">
            <InformationCircleIcon className="h-16 w-16 text-indigo-600" />
        </div>
        <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">{title}</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md">This accounting module is currently under development and will be available in the next Pro update.</p>
    </div>
);

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<AppView>('billing');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | undefined>(undefined);
  const [isOperator, setIsOperator] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturnType[]>([]);
  const [saleReturns, setSaleReturns] = useState<SaleReturn[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<Payment[]>([]);
  const [gstRates, setGstRates] = useState<GstRate[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(defaultProfile);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(defaultConfig);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [currentLedgerCustomerId, setCurrentLedgerCustomerId] = useState<string | null>(null);
  const [currentLedgerSupplierId, setCurrentLedgerSupplierId] = useState<string | null>(null);
  
  const [cloudCart, setCloudCart] = useState<CartItem[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const mappingSnap = await getDoc(doc(db, 'userMappings', currentUser.uid));
        if (mappingSnap.exists()) {
          const mapping = mappingSnap.data() as UserMapping;
          if (mapping.role === 'operator') {
            setIsOperator(true); setDataOwnerId(mapping.ownerId);
            const subUserRef = doc(db, `users/${mapping.ownerId}/subUsers`, currentUser.uid);
            const subUserSnap = await getDoc(subUserRef);
            if (subUserSnap.exists()) setUserPermissions(subUserSnap.data().permissions);
          } else { setIsOperator(false); setDataOwnerId(currentUser.uid); setUserPermissions(undefined); }
        } else { setIsOperator(false); setDataOwnerId(currentUser.uid); setDoc(doc(db, 'userMappings', currentUser.uid), { ownerId: currentUser.uid, role: 'admin', email: currentUser.email || '', name: currentUser.displayName || '' }); }
      } else { setDataOwnerId(null); setProducts([]); setBills([]); setPurchases([]); }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!dataOwnerId) return;
    const basePath = `users/${dataOwnerId}`;
    const unsubProducts = onSnapshot(collection(db, `${basePath}/products`), (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product))));
    const unsubBills = onSnapshot(query(collection(db, `${basePath}/bills`), orderBy('date', 'desc')), (snap) => setBills(snap.docs.map(d => ({ id: d.id, ...d.data() } as Bill))));
    const unsubPurchases = onSnapshot(query(collection(db, `${basePath}/purchases`), orderBy('invoiceDate', 'desc')), (snap) => setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase))));
    const unsubReturns = onSnapshot(query(collection(db, `${basePath}/purchaseReturns`), orderBy('date', 'desc')), (snap) => setPurchaseReturns(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseReturnType))));
    const unsubSReturns = onSnapshot(query(collection(db, `${basePath}/saleReturns`), orderBy('date', 'desc')), (snap) => setSaleReturns(snap.docs.map(d => ({ id: d.id, ...d.data() } as SaleReturn))));
    const unsubSuppliers = onSnapshot(collection(db, `${basePath}/suppliers`), (snap) => setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier))));
    const unsubCustomers = onSnapshot(collection(db, `${basePath}/customers`), (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer))));
    const unsubSalesmen = onSnapshot(collection(db, `${basePath}/salesmen`), (snap) => setSalesmen(snap.docs.map(d => ({ id: d.id, ...d.data() } as Salesman))));
    const unsubPayments = onSnapshot(collection(db, `${basePath}/payments`), (snap) => setSupplierPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment))));
    const unsubCustPayments = onSnapshot(collection(db, `${basePath}/customerPayments`), (snap) => setCustomerPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerPayment))));
    const unsubGst = onSnapshot(collection(db, `${basePath}/gstRates`), (snap) => setGstRates(snap.docs.map(d => ({ id: d.id, ...d.data() } as GstRate))));
    const unsubCompanies = onSnapshot(collection(db, `${basePath}/companies`), (snap) => setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company))));
    const unsubProfile = onSnapshot(doc(db, `${basePath}/companyProfile`, 'profile'), (snap) => { if (snap.exists()) setCompanyProfile(snap.data() as CompanyProfile); });
    const unsubConfig = onSnapshot(doc(db, `${basePath}/systemConfig`, 'config'), (snap) => { if (snap.exists()) setSystemConfig(snap.data() as SystemConfig); });
    const unsubCart = onSnapshot(query(collection(db, `${basePath}/tempCart`), orderBy('addedAt', 'asc')), (snap) => {
        setCloudCart(snap.docs.map(d => d.data() as CartItem));
    });
    return () => { unsubProducts(); unsubBills(); unsubPurchases(); unsubReturns(); unsubSReturns(); unsubSuppliers(); unsubCustomers(); unsubPayments(); unsubGst(); unsubCompanies(); unsubProfile(); unsubConfig(); unsubCustPayments(); unsubSalesmen(); unsubCart(); };
  }, [dataOwnerId]);

  /**
   * RE-WRITE STOCK (Audit Utility)
   * Deep aggregates all history to fix stock discrepancies.
   * Logic: (Batch Opening) + (Purchases) - (Sales) - (Purchase Returns) + (Sales Returns)
   */
  const handleStockAudit = async () => {
    if (!dataOwnerId) return;
    if (!window.confirm("STOCK AUDIT: This will rebuild every product's current stock from your historical transaction ledger. Proceed with deep recalculation?")) return;

    try {
        let currentBatch = writeBatch(db);
        let operationsCount = 0;
        let totalFixed = 0;

        for (const product of products) {
            let productModified = false;
            const unitsPerStrip = product.unitsPerStrip || 1;
            const pBarcode = normalizeCode(product.barcode || "");
            const pName = product.name.toLowerCase().trim();
            const pCompany = product.company.toLowerCase().trim();

            const updatedBatches = (product.batches || []).map(b => {
                let auditStock = b.openingStock || 0;
                const bNum = normalizeCode(b.batchNumber);

                // 1. Audit Purchases (+ IN)
                purchases.forEach(pur => pur.items.forEach(item => {
                    const iBarcode = normalizeCode(item.barcode || "");
                    const isMatch = (item.productId === product.id) || 
                                   (pBarcode !== "" && iBarcode === pBarcode) ||
                                   (pBarcode === "" && iBarcode === "" && item.productName.toLowerCase().trim() === pName && item.company.toLowerCase().trim() === pCompany);
                    
                    if (isMatch && normalizeCode(item.batchNumber) === bNum) {
                        const conversion = item.unitsPerStrip || unitsPerStrip;
                        auditStock += (item.quantity * conversion);
                    }
                }));

                // 2. Audit Sales (- OUT)
                bills.forEach(bill => bill.items.forEach(item => {
                    if (item.productId === product.id && (item.batchId === b.id || normalizeCode(item.batchNumber) === bNum)) {
                        auditStock -= item.quantity;
                    }
                }));

                // 3. Audit Purchase Returns (- OUT)
                purchaseReturns.forEach(ret => ret.items.forEach(item => {
                    const iBarcode = normalizeCode(item.barcode || "");
                    const isMatch = (item.productId === product.id) || 
                                   (pBarcode !== "" && iBarcode === pBarcode) ||
                                   (pBarcode === "" && iBarcode === "" && item.productName.toLowerCase().trim() === pName && item.company.toLowerCase().trim() === pCompany);
                    
                    if (isMatch && normalizeCode(item.batchNumber) === bNum) {
                        const conversion = item.unitsPerStrip || unitsPerStrip;
                        auditStock -= (item.quantity * conversion);
                    }
                }));

                // 4. Audit Sale Returns (+ IN)
                saleReturns.forEach(sret => sret.items.forEach(item => {
                    if (item.productId === product.id && (item.batchId === b.id || normalizeCode(item.batchNumber) === bNum)) {
                        auditStock += item.quantity;
                    }
                }));

                if (b.stock !== auditStock) {
                    totalFixed++;
                    productModified = true;
                    return { ...b, stock: auditStock };
                }
                return b;
            });

            if (productModified) {
                const productRef = doc(db, `users/${dataOwnerId}/products`, product.id);
                currentBatch.update(productRef, { batches: updatedBatches });
                operationsCount++;

                if (operationsCount >= 450) {
                    await currentBatch.commit();
                    currentBatch = writeBatch(db);
                    operationsCount = 0;
                }
            }
        }

        if (operationsCount > 0) {
            await currentBatch.commit();
        }

        alert(totalFixed > 0 
            ? `Audit Successful! corrected ${totalFixed} mismatched batches.` 
            : "Audit Complete! Your live stock perfectly matches the transaction history.");
    } catch (e) {
        console.error("Audit error:", e);
        alert("Stock Re-write failed. Please try again.");
    }
  };

  const getNextAutoBarcode = (currentProducts: Product[]) => {
    const numericBarcodes = currentProducts
      .map(p => p.barcode)
      .filter(b => b && /^\d+$/.test(b) && b.length <= 6)
      .map(b => parseInt(b, 10));
    const max = numericBarcodes.length > 0 ? Math.max(...numericBarcodes) : 0;
    return String(max + 1).padStart(6, '0');
  };

  const handleAddProduct = async (productData: Omit<Product, 'id'>) => { 
    if (!dataOwnerId) return; 
    const finalData = { ...productData };
    if (!finalData.barcode || finalData.barcode.trim() === '') {
        finalData.barcode = getNextAutoBarcode(products);
    }
    await addDoc(collection(db, `users/${dataOwnerId}/products`), sanitizeForFirestore(finalData)); 
  };

  const handleUpdateProduct = async (id: string, productData: Partial<Product>) => { 
    if (!dataOwnerId) return; 
    await updateDoc(doc(db, `users/${dataOwnerId}/products`, id), sanitizeForFirestore(productData)); 
  };

  const handleDeleteProduct = async (id: string) => { 
    if (!dataOwnerId) return; 
    const isUsedInBills = bills.some(bill => bill.items.some(item => item.productId === id)); 
    if (isUsedInBills) { alert("Used in Sales"); return; } 
    const isUsedInPurchases = purchases.some(purchase => purchase.items.some(item => item.productId === id)); 
    if (isUsedInPurchases) { alert("Used in Purchases"); return; } 
    if (window.confirm('Delete product?')) { await deleteDoc(doc(db, `users/${dataOwnerId}/products`, id)); } 
  };

  const handleUpdateSupplier = async (id: string, data: Partial<Supplier>) => { if (!dataOwnerId) return; await updateDoc(doc(db, `users/${dataOwnerId}/suppliers`, id), sanitizeForFirestore(data)); };
  const handleDeleteSupplier = async (id: string) => { if (!dataOwnerId) return; const supplier = suppliers.find(s => s.id === id); if (!supplier) return; const isUsed = purchases.some(p => p.supplier === supplier.name); if (isUsed) { alert("Supplier has recorded purchases. Cannot delete."); return; } if (window.confirm('Delete supplier?')) { await deleteDoc(doc(db, `users/${dataOwnerId}/suppliers`, id)); } };

  const handleAddToCartCloud = async (item: CartItem) => {
      if (!dataOwnerId) return;
      const itemRef = doc(db, `users/${dataOwnerId}/tempCart`, item.batchId);
      const itemToSave = { ...item, addedAt: item.addedAt || Date.now() };
      await setDoc(itemRef, sanitizeForFirestore(itemToSave), { merge: true });
  };
  const handleRemoveFromCartCloud = async (batchId: string) => { if (!dataOwnerId) return; await deleteDoc(doc(db, `users/${dataOwnerId}/tempCart`, batchId)); };
  const handleUpdateCartItemCloud = async (batchId: string, updates: Partial<CartItem>) => { if (!dataOwnerId) return; await updateDoc(doc(db, `users/${dataOwnerId}/tempCart`, batchId), sanitizeForFirestore(updates)); };
  const handleClearCartCloud = async () => { if (!dataOwnerId) return; const batch = writeBatch(db); cloudCart.forEach(item => { batch.delete(doc(db, `users/${dataOwnerId}/tempCart`, item.batchId)); }); await batch.commit(); };

  const handleEditBill = (bill: Bill) => { setCloudCart([]); bill.items.forEach(item => handleAddToCartCloud(item)); setEditingBill(bill); setActiveView('billing'); };
  
  const handleDeleteBill = async (bill: Bill) => { 
    if (!dataOwnerId || !window.confirm("Delete this bill? This will restore stock levels.")) return; 
    try {
        const batch = writeBatch(db); 
        batch.delete(doc(db, `users/${dataOwnerId}/bills`, bill.id)); 
        const currentProducts = JSON.parse(JSON.stringify(products)) as Product[]; 
        const productUpdates = new Map<string, any[]>();

        for (const item of bill.items) { 
            const p = currentProducts.find(pr => pr.id === item.productId); 
            if (p) { 
                const bIdx = p.batches.findIndex(b => b.id === item.batchId); 
                if (bIdx !== -1) { 
                    p.batches[bIdx].stock += item.quantity; 
                    productUpdates.set(p.id, p.batches);
                } 
            } 
        } 
        productUpdates.forEach((batches, productId) => batch.update(doc(db, `users/${dataOwnerId}/products`, productId), sanitizeForFirestore({ batches })));

        if (bill.paymentMode === 'Credit' && bill.customerId) batch.update(doc(db, `users/${dataOwnerId}/customers`, bill.customerId), { balance: increment(-bill.grandTotal) }); 
        await batch.commit(); 
    } catch (e) { alert("Delete failed"); }
  };

  const handleDeletePurchase = async (purchase: Purchase) => {
    if (!dataOwnerId || !window.confirm("Delete this purchase? This will reduce stock levels.")) return;
    try {
        const batch = writeBatch(db);
        const currentProducts = JSON.parse(JSON.stringify(products)) as Product[];
        const productUpdates = new Map<string, any[]>();

        for (const item of purchase.items) {
            const pBarcode = normalizeCode(item.barcode || "");
            const pName = item.productName.toLowerCase().trim();
            const pCompany = item.company.toLowerCase().trim();

            const product = currentProducts.find(p => 
                p.id === item.productId || 
                (pBarcode !== "" && normalizeCode(p.barcode) === pBarcode) ||
                (pBarcode === "" && p.name.toLowerCase().trim() === pName && p.company.toLowerCase().trim() === pCompany)
            );

            if (product) {
                const iBatchNum = normalizeCode(item.batchNumber);
                const bIdx = product.batches.findIndex(b => 
                    normalizeCode(b.batchNumber) === iBatchNum && 
                    Math.abs(b.mrp - item.mrp) < 0.01
                );

                if (bIdx !== -1) {
                    const units = item.unitsPerStrip || product.unitsPerStrip || 1;
                    product.batches[bIdx].stock -= (item.quantity * units);
                    productUpdates.set(product.id, product.batches);
                }
            }
        }

        productUpdates.forEach((batches, productId) => {
            batch.update(doc(db, `users/${dataOwnerId}/products`, productId), sanitizeForFirestore({ batches }));
        });

        batch.delete(doc(db, `users/${dataOwnerId}/purchases`, purchase.id));
        await batch.commit();
        alert("Purchase deleted and stock updated.");
    } catch (e) { 
        console.error("Delete failed", e);
        alert("An error occurred while deleting the purchase."); 
    }
  };
  
  const handleUpdateConfig = (config: SystemConfig) => { if (dataOwnerId) setDoc(doc(db, `users/${dataOwnerId}/systemConfig`, 'config'), sanitizeForFirestore(config)); };
  const isGstView = (view: AppView): view is GstReportView => ['gstr3b', 'hsnSales', 'hsnPurchase', 'gstWiseSales'].includes(view);

  const handleGenerateBill = async (billData: Omit<Bill, 'id' | 'billNumber'>) => {
    if (!dataOwnerId) return null;
    try {
        const batch = writeBatch(db); const billsRef = collection(db, `users/${dataOwnerId}/bills`); const billNumber = `INV-${Date.now().toString().slice(-6)}`; const newBillRef = doc(billsRef); const newBill: Bill = { ...billData, id: newBillRef.id, billNumber }; batch.set(newBillRef, sanitizeForFirestore(newBill));
        const currentProducts = JSON.parse(JSON.stringify(products)) as Product[];
        const productUpdates = new Map<string, any[]>();
        for (const item of billData.items) { 
          const product = currentProducts.find(p => p.id === item.productId); 
          if (product) { 
            const bIdx = product.batches.findIndex(b => b.id === item.batchId); 
            if (bIdx !== -1) { 
              product.batches[bIdx].stock -= item.quantity; 
              productUpdates.set(product.id, product.batches); 
            } 
          } 
        }
        productUpdates.forEach((batches, productId) => batch.update(doc(db, `users/${dataOwnerId}/products`, productId), sanitizeForFirestore({ batches })));
        if (billData.paymentMode === 'Credit' && billData.customerId) batch.update(doc(db, `users/${dataOwnerId}/customers`, billData.customerId), { balance: increment(billData.grandTotal) });
        cloudCart.forEach(item => batch.delete(doc(db, `users/${dataOwnerId}/tempCart`, item.batchId)));
        await batch.commit(); return newBill;
    } catch (e) { alert("Failed"); return null; }
  };

  const handleAddPurchase = async (purchaseData: Omit<Purchase, 'id' | 'totalAmount'>) => {
      if (!dataOwnerId) return;
      try {
          const batch = writeBatch(db); const purchaseRef = doc(collection(db, `users/${dataOwnerId}/purchases`)); 
          const currentProducts = JSON.parse(JSON.stringify(products)) as Product[];
          const processedItems = purchaseData.items.map(item => {
              const iBarcode = normalizeCode(item.barcode);
              const iName = item.productName.toLowerCase().trim();
              const iCompany = item.company.toLowerCase().trim();
              let product = item.productId ? currentProducts.find(p => p.id === item.productId) : currentProducts.find(p => {
                  const pBarcode = normalizeCode(p.barcode);
                  if (iBarcode !== "" && pBarcode !== "") return pBarcode === iBarcode;
                  if (iBarcode === "" && pBarcode === "") return p.name.toLowerCase().trim() === iName && p.company.toLowerCase().trim() === iCompany;
                  return false;
              });

              if (product) {
                  const productRef = doc(db, `users/${dataOwnerId}/products`, product.id);
                  const existingBatchIndex = product.batches.findIndex(b => Math.abs(b.mrp - item.mrp) < 0.01);
                  const units = item.unitsPerStrip || product.unitsPerStrip || 1;
                  const quantityToAdd = item.quantity * units;
                  if (existingBatchIndex >= 0) {
                      product.batches[existingBatchIndex].stock += quantityToAdd;
                      product.batches[existingBatchIndex].purchasePrice = item.purchasePrice; 
                      product.batches[existingBatchIndex].batchNumber = item.batchNumber;
                      product.batches[existingBatchIndex].expiryDate = item.expiryDate;
                  } else { 
                      product.batches.push({ id: `batch_${Date.now()}_${Math.random()}`, batchNumber: item.batchNumber, expiryDate: item.expiryDate, stock: quantityToAdd, mrp: item.mrp, purchasePrice: item.purchasePrice, openingStock: 0 }); 
                  }
                  batch.update(productRef, sanitizeForFirestore({ batches: product.batches }));
                  return { ...item, productId: product.id };
              } else {
                  const productRef = doc(collection(db, `users/${dataOwnerId}/products`));
                  const newBatch = { id: `batch_${Date.now()}_${Math.random()}`, batchNumber: item.batchNumber, expiryDate: item.expiryDate, stock: item.quantity * (item.unitsPerStrip || 1), mrp: item.mrp, purchasePrice: item.purchasePrice, openingStock: 0 };
                  let barcodeToUse = item.barcode || '';
                  if (!barcodeToUse || barcodeToUse.trim() === '') barcodeToUse = getNextAutoBarcode(currentProducts);
                  const newProduct: Product = { id: productRef.id, name: item.productName, company: item.company, hsnCode: item.hsnCode, gst: item.gst, batches: [newBatch], barcode: barcodeToUse, ...(item.composition && { composition: item.composition }), ...(item.unitsPerStrip && { unitsPerStrip: item.unitsPerStrip }), ...(item.isScheduleH !== undefined && { isScheduleH: item.isScheduleH }) };
                  currentProducts.push(newProduct);
                  batch.set(productRef, sanitizeForFirestore(newProduct));
                  return { ...item, productId: productRef.id, barcode: barcodeToUse };
              }
          });

          let totalAmount = processedItems.reduce((sum, item) => {
              const itTotal = (item.quantity * item.purchasePrice) * (1 - (item.discount || 0)/100);
              return sum + itTotal + (itTotal * item.gst/100);
          }, 0);
          totalAmount += (purchaseData.roundOff || 0);
          const newPurchase: Purchase = { ...purchaseData, items: processedItems, totalAmount, id: purchaseRef.id }; 
          batch.set(purchaseRef, sanitizeForFirestore(newPurchase));
          await batch.commit();
      } catch(e) { console.error(e); alert("Error saving purchase"); }
  };

  const handleAddPurchaseReturn = async (returnData: Omit<PurchaseReturnType, 'id' | 'totalAmount'>) => {
    if (!dataOwnerId) return;
    try {
        const batch = writeBatch(db);
        const returnRef = doc(collection(db, `users/${dataOwnerId}/purchaseReturns`));
        const currentProducts = JSON.parse(JSON.stringify(products)) as Product[];
        
        let subtotal = 0;
        const processedItems = returnData.items.map(item => {
            const product = currentProducts.find(p => p.id === item.productId);
            if (product) {
                const bIdx = product.batches.findIndex(b => b.batchNumber === item.batchNumber);
                if (bIdx !== -1) {
                    const unitsPerStrip = item.unitsPerStrip || product.unitsPerStrip || 1;
                    product.batches[bIdx].stock -= (item.quantity * unitsPerStrip);
                    batch.update(doc(db, `users/${dataOwnerId}/products`, product.id), { batches: product.batches });
                }
            }
            const itemTotal = (item.quantity * item.purchasePrice) * (1 - item.discount / 100);
            subtotal += itemTotal + (itemTotal * item.gst / 100);
            return item;
        });

        const totalAmount = Math.round(subtotal + (returnData.roundOff || 0));
        const newReturn: PurchaseReturnType = { ...returnData, id: returnRef.id, totalAmount };
        batch.set(returnRef, sanitizeForFirestore(newReturn));
        await batch.commit();
        alert("Purchase Return recorded successfully!");
    } catch (e) { alert("Failed to save return."); }
  };

  const handleDeletePurchaseReturn = async (pr: PurchaseReturnType) => {
    if (!dataOwnerId || !window.confirm("Delete this return? Stock will be restored.")) return;
    try {
        const batch = writeBatch(db);
        const currentProducts = JSON.parse(JSON.stringify(products)) as Product[];
        for (const item of pr.items) {
            const product = currentProducts.find(p => p.id === item.productId);
            if (product) {
                const bIdx = product.batches.findIndex(b => b.batchNumber === item.batchNumber);
                if (bIdx !== -1) {
                    const unitsPerStrip = item.unitsPerStrip || product.unitsPerStrip || 1;
                    product.batches[bIdx].stock += (item.quantity * unitsPerStrip);
                    batch.update(doc(db, `users/${dataOwnerId}/products`, product.id), { batches: product.batches });
                }
            }
        }
        batch.delete(doc(db, `users/${dataOwnerId}/purchaseReturns`, pr.id));
        await batch.commit();
    } catch (e) { alert("Delete failed"); }
  };

  if (!user) return <Auth />;
  return (
    <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-200">
      <Header activeView={activeView} setActiveView={setActiveView} onOpenSettings={() => setIsSettingsOpen(true)} user={user} onLogout={() => signOut(auth)} systemConfig={systemConfig} userPermissions={userPermissions} isOperator={isOperator} />
      <div className="flex-grow">
        <main className="max-w-7xl mx-auto py-6">
          {/* Voucher Entry Views */}
          {(activeView === 'billing' || activeView === 'saleEntry') && (
            <Billing products={products} bills={bills} customers={customers} salesmen={salesmen} companyProfile={companyProfile} systemConfig={systemConfig} onGenerateBill={handleGenerateBill} onAddCustomer={async (c) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/customers`), sanitizeForFirestore({ ...c, balance: c.openingBalance || 0 })); return { id: r.id, ...c, balance: c.openingBalance || 0 }; }} onAddSalesman={async (s) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/salesmen`), sanitizeForFirestore(s)); return { id: r.id, ...s }; }} editingBill={editingBill} onUpdateBill={async (id, data) => { if (!dataOwnerId) return null; await updateDoc(doc(db, `users/${dataOwnerId}/bills`, id), sanitizeForFirestore(data)); return { id, ...data } as Bill; }} onCancelEdit={() => { setEditingBill(null); handleClearCartCloud(); setActiveView('billing'); }} onUpdateConfig={handleUpdateConfig} cart={cloudCart} onAddToCart={handleAddToCartCloud} onRemoveFromCart={handleRemoveFromCartCloud} onUpdateCartItem={handleUpdateCartItemCloud} />
          )}
          {(activeView === 'purchases' || activeView === 'purchaseEntry') && (
             <Purchases products={products} purchases={purchases} companies={companies} suppliers={suppliers} systemConfig={systemConfig} gstRates={gstRates} onAddPurchase={handleAddPurchase} onUpdatePurchase={(id, data) => updateDoc(doc(db, `users/${dataOwnerId}/purchases`, id), sanitizeForFirestore(data) as any)} onDeletePurchase={handleDeletePurchase} onAddSupplier={async (s) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/suppliers`), sanitizeForFirestore(s)); return { id: r.id, ...s }; }} editingPurchase={editingPurchase} onCancelEdit={() => setEditingPurchase(null)} onUpdateConfig={handleUpdateConfig} />
          )}
          {activeView === 'purchaseReturn' && (
            <PurchaseReturn products={products} returns={purchaseReturns} suppliers={suppliers} systemConfig={systemConfig} gstRates={gstRates} onAddReturn={handleAddPurchaseReturn} onDeleteReturn={handleDeletePurchaseReturn} />
          )}
          {activeView === 'inventory' && (<Inventory products={products} companies={companies} purchases={purchases} bills={bills} purchaseReturns={purchaseReturns} saleReturns={saleReturns} systemConfig={systemConfig} gstRates={gstRates} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct} onAddCompany={async (c) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/companies`), sanitizeForFirestore(c)); return { id: r.id, ...c }; }} />)}
          
          {/* Master Data Section */}
          {activeView === 'productMaster' && (<Inventory products={products} companies={companies} purchases={purchases} bills={bills} purchaseReturns={purchaseReturns} saleReturns={saleReturns} systemConfig={systemConfig} gstRates={gstRates} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct} onAddCompany={async (c) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/companies`), sanitizeForFirestore(c)); return { id: r.id, ...c }; }} initialTab="productMaster" />)}
          {activeView === 'ledgerMaster' && (<LedgerMaster customers={customers} suppliers={suppliers} salesmen={salesmen} systemConfig={systemConfig} onAddCustomer={async (c) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/customers`), sanitizeForFirestore({ ...c, balance: c.openingBalance || 0 })); return { id: r.id, ...c, balance: c.openingBalance || 0 }; }} onUpdateCustomer={async (id, d) => updateDoc(doc(db, `users/${dataOwnerId}/customers`, id), sanitizeForFirestore(d))} onAddSupplier={async (s) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/suppliers`), sanitizeForFirestore(s)); return { id: r.id, ...s }; }} onUpdateSupplier={handleUpdateSupplier} onDeleteSupplier={handleDeleteSupplier} onAddSalesman={async (s) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/salesmen`), sanitizeForFirestore(s)); return { id: r.id, ...s }; }} />)}
          {activeView === 'batchMaster' && (<BatchMaster products={products} systemConfig={systemConfig} onUpdateProduct={handleUpdateProduct} />)}

          {activeView === 'daybook' && (<DayBook bills={bills} products={products} companyProfile={companyProfile} systemConfig={systemConfig} onDeleteBill={handleDeleteBill} onEditBill={handleEditBill} onUpdateBillDetails={(id, updates) => updateDoc(doc(db, `users/${dataOwnerId}/bills`, id), sanitizeForFirestore(updates))} />)}
          {activeView === 'suppliersLedger' && (<SuppliersLedger suppliers={suppliers} purchases={purchases} payments={supplierPayments} companyProfile={companyProfile} initialSupplierId={currentLedgerSupplierId} onSupplierSelected={setCurrentLedgerSupplierId} onUpdateSupplier={handleUpdateSupplier} onAddPayment={async (p) => { const v = `VCH-${Date.now().toString().slice(-6)}`; const r = await addDoc(collection(db, `users/${dataOwnerId}/payments`), sanitizeForFirestore({...p, voucherNumber: v})); return {id: r.id, ...p, voucherNumber: v}; }} onDeletePurchase={handleDeletePurchase} onEditPurchase={(p) => { setEditingPurchase(p); setActiveView('purchases'); }} onUpdatePayment={(id, data) => updateDoc(doc(db, `users/${dataOwnerId}/payments`, id), sanitizeForFirestore(data) as any)} onDeletePayment={(id) => deleteDoc(doc(db, `users/${dataOwnerId}/payments`, id))} />)}
          {activeView === 'customerLedger' && (<CustomerLedger customers={customers} bills={bills} payments={customerPayments} companyProfile={companyProfile} initialCustomerId={currentLedgerCustomerId} onCustomerSelected={setCurrentLedgerCustomerId} onAddPayment={async (p) => { const b = writeBatch(db); b.set(doc(collection(db, `users/${dataOwnerId}/customerPayments`)), sanitizeForFirestore(p)); b.update(doc(db, `users/${dataOwnerId}/customers`, p.customerId), { balance: increment(-p.amount) }); await b.commit(); }} onUpdateCustomer={(id, d) => updateDoc(doc(db, `users/${dataOwnerId}/customers`, id), sanitizeForFirestore(d))} onEditBill={handleEditBill} onDeleteBill={handleDeleteBill} onUpdatePayment={(id, data) => updateDoc(doc(db, `users/${dataOwnerId}/customerPayments`, id), sanitizeForFirestore(data) as any)} onDeletePayment={(p) => deleteDoc(doc(db, `users/${dataOwnerId}/customerPayments`, p.id))} />)}
          {activeView === 'salesReport' && <SalesReport bills={bills} />}
          {activeView === 'salesmanReport' && <SalesmanReport bills={bills} salesmen={salesmen} />}
          {activeView === 'companyWiseSale' && <CompanyWiseSale bills={bills} products={products} systemConfig={systemConfig} />}
          {activeView === 'companyWiseBillWiseProfit' && <CompanyWiseBillWiseProfit bills={bills} products={products} />}
          {activeView === 'chequePrint' && <ChequePrint systemConfig={systemConfig} onUpdateConfig={handleUpdateConfig} />}
          {activeView === 'dashboard' && <SalesDashboard bills={bills} products={products} systemConfig={systemConfig} />}
          {activeView === 'subscriptionAdmin' && user.email === 'emeraj@gmail.com' && <SubscriptionAdmin />}
          {isGstView(activeView) && <GstReports view={activeView} bills={bills} purchases={purchases} />}
        </main>
      </div>
      <footer className="bg-white dark:bg-slate-800 border-t dark:border-slate-700 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>Developed by: <span className="font-semibold text-indigo-600 dark:text-indigo-400">M. Soft India</span> | 9890072651 | msoftindia.com</p>
        </div>
      </footer>
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        companyProfile={companyProfile} 
        onProfileChange={(p) => setDoc(doc(db, `users/${dataOwnerId}/companyProfile`, 'profile'), sanitizeForFirestore(p))} 
        systemConfig={systemConfig} 
        onSystemConfigChange={handleUpdateConfig} 
        onBackupData={() => { const backup = { products, bills, purchases, suppliers, customers, payments: supplierPayments, gstRates, companyProfile, systemConfig }; const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup)); const a = document.createElement('a'); a.href = dataStr; a.download = "backup.json"; a.click(); }} 
        onReWriteStock={handleStockAudit}
        gstRates={gstRates} 
        onAddGstRate={(r) => addDoc(collection(db, `users/${dataOwnerId}/gstRates`), sanitizeForFirestore({ rate: r }))} 
        onUpdateGstRate={(id, r) => updateDoc(doc(db, `users/${dataOwnerId}/gstRates`, id), sanitizeForFirestore({ rate: r }))} 
        onDeleteGstRate={(id) => deleteDoc(doc(db, `users/${dataOwnerId}/gstRates`, id))} 
      />
    </div>
  );
}
export default App;

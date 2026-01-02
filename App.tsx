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
  AppView, Product, Bill, Purchase, PurchaseReturn as PurchaseReturnType, Supplier, Customer, CustomerPayment, 
  Payment, CompanyProfile, SystemConfig, GstRate, Company, UserPermissions, 
  Salesman, UserMapping, GstReportView, CartItem, MasterDataView
} from './types';

const normalizeCode = (str: string = "") => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

const sanitizeForFirestore = (obj: any): any => {
  if (obj === undefined) return null; 
  if (Array.isArray(obj)) {
    return obj.filter(v => v !== undefined).map(v => sanitizeForFirestore(v));
  }
  if (obj !== null && typeof obj === 'object') {
    if (obj.constructor !== Object && obj.constructor !== undefined) return obj;
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, sanitizeForFirestore(v)])
    );
  }
  return obj;
};

const defaultProfile: CompanyProfile = { name: 'My Shop', address: '', gstin: '', };
const defaultConfig: SystemConfig = { softwareMode: 'Retail', invoicePrintingFormat: 'Thermal', mrpEditable: true, barcodeScannerOpenByDefault: true, maintainCustomerLedger: false, enableSalesman: false, aiInvoiceQuota: 5, subscription: { isPremium: false, planType: 'Free' } };

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
    const unsubSuppliers = onSnapshot(collection(db, `${basePath}/suppliers`), (snap) => setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier))));
    const unsubCustomers = onSnapshot(collection(db, `${basePath}/customers`), (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer))));
    const unsubSalesmen = onSnapshot(collection(db, `${basePath}/salesmen`), (snap) => setSalesmen(snap.docs.map(d => ({ id: d.id, ...d.data() } as Salesman))));
    const unsubPayments = onSnapshot(collection(db, `${basePath}/payments`), (snap) => setSupplierPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment))));
    const unsubCustPayments = onSnapshot(collection(db, `${basePath}/customerPayments`), (snap) => setCustomerPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerPayment))));
    const unsubGst = onSnapshot(collection(db, `${basePath}/gstRates`), (snap) => setGstRates(snap.docs.map(d => ({ id: d.id, ...d.data() } as GstRate))));
    const unsubCompanies = onSnapshot(collection(db, `${basePath}/companies`), (snap) => setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company))));
    const unsubProfile = onSnapshot(doc(db, `${basePath}/companyProfile`, 'profile'), (snap) => { if (snap.exists()) setCompanyProfile(snap.data() as CompanyProfile); });
    const unsubConfig = onSnapshot(doc(db, `${basePath}/systemConfig`, 'config'), (snap) => { if (snap.exists()) setSystemConfig(snap.data() as SystemConfig); });
    const unsubCart = onSnapshot(query(collection(db, `${basePath}/tempCart`), orderBy('addedAt', 'asc')), (snap) => setCloudCart(snap.docs.map(d => d.data() as CartItem)));
    return () => { unsubProducts(); unsubBills(); unsubPurchases(); unsubReturns(); unsubSuppliers(); unsubCustomers(); unsubPayments(); unsubGst(); unsubCompanies(); unsubProfile(); unsubConfig(); unsubCustPayments(); unsubSalesmen(); unsubCart(); };
  }, [dataOwnerId]);

  /**
   * RE-WRITE STOCK LOGIC
   * Professional audit trail matching 'Selected Item Stock' ledger.
   * This rebuilds the 'Current Stock' field from zero by processing history.
   */
  const handleReWriteStock = async () => {
    if (!dataOwnerId) return;
    if (!window.confirm("CRITICAL AUDIT: This will recalculate all stock levels for every product from your entire transaction history (Opening + Purchases - Sales - Returns). Proceed?")) return;

    try {
        let currentBatch = writeBatch(db);
        let operationsCount = 0;
        let totalCorrections = 0;

        // Iterate through every single product in the inventory
        for (const product of products) {
            let productModified = false;
            const unitsPerStrip = product.unitsPerStrip || 1;
            const pBarcode = normalizeCode(product.barcode || "");
            const pName = product.name.toLowerCase().trim();
            const pCompany = product.company.toLowerCase().trim();

            const updatedBatches = product.batches.map(b => {
                // Initialize with the batch's defined Opening Stock (the starting balance)
                let auditStock = b.openingStock || 0;
                const bNum = normalizeCode(b.batchNumber);

                // 1. Audit all matching Purchases (+ IN)
                purchases.forEach(pur => pur.items.forEach(item => {
                    const iBarcode = normalizeCode(item.barcode || "");
                    const isMatch = (item.productId === product.id) || 
                                   (pBarcode !== "" && iBarcode === pBarcode) ||
                                   (pBarcode === "" && iBarcode === "" && item.productName.toLowerCase().trim() === pName && item.company.toLowerCase().trim() === pCompany);
                    
                    if (isMatch && normalizeCode(item.batchNumber) === bNum) {
                        // Use item's units per strip if recorded, otherwise fallback to current product configuration
                        const conversion = item.unitsPerStrip || unitsPerStrip;
                        auditStock += (item.quantity * conversion);
                    }
                }));

                // 2. Audit all matching Sales (- OUT)
                bills.forEach(bill => bill.items.forEach(item => {
                    // Billing records are strictly linked to productId and batchId
                    const isMatch = (item.productId === product.id && (item.batchId === b.id || normalizeCode(item.batchNumber) === bNum));
                    if (isMatch) {
                        auditStock -= item.quantity;
                    }
                }));

                // 3. Audit all matching Purchase Returns (- OUT)
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

                // Check for discrepancies between the calculated audit stock and stored stock
                if (b.stock !== auditStock) {
                    totalCorrections++;
                    productModified = true;
                    return { ...b, stock: auditStock };
                }
                return b;
            });

            if (productModified) {
                const productRef = doc(db, `users/${dataOwnerId}/products`, product.id);
                currentBatch.update(productRef, { batches: updatedBatches });
                operationsCount++;

                // Firestore allows max 500 writes per batch. Commit and start new batch at 400 for safety.
                if (operationsCount >= 400) {
                    await currentBatch.commit();
                    currentBatch = writeBatch(db);
                    operationsCount = 0;
                }
            }
        }

        // Final commit for any remaining updates
        if (operationsCount > 0) {
            await currentBatch.commit();
        }

        if (totalCorrections > 0) {
            alert(`Audit Complete! Successfully recalculated and fixed ${totalCorrections} mismatched stock entries across your inventory.`);
        } else {
            alert("Audit Complete! All stock levels are already 100% in sync with your transaction ledger.");
        }
    } catch (e) {
        console.error("Re-Write Stock error:", e);
        alert("Inventory recalculation failed. Please check your network and try again.");
    }
  };

  const handleAddProduct = async (productData: Omit<Product, 'id'>) => { 
    if (!dataOwnerId) return; 
    const finalData = { ...productData };
    if (!finalData.barcode || finalData.barcode.trim() === '') {
        const numericBarcodes = products.map(p => p.barcode).filter(b => b && /^\d+$/.test(b) && b.length <= 6).map(b => parseInt(b, 10));
        const max = numericBarcodes.length > 0 ? Math.max(...numericBarcodes) : 0;
        finalData.barcode = String(max + 1).padStart(6, '0');
    }
    await addDoc(collection(db, `users/${dataOwnerId}/products`), sanitizeForFirestore(finalData)); 
  };

  const handleUpdateProduct = async (id: string, productData: Partial<Product>) => { if (!dataOwnerId) return; await updateDoc(doc(db, `users/${dataOwnerId}/products`, id), sanitizeForFirestore(productData)); };
  const handleDeleteProduct = async (id: string) => { if (!dataOwnerId) return; if (window.confirm('Delete product?')) await deleteDoc(doc(db, `users/${dataOwnerId}/products`, id)); };
  const handleUpdateConfig = (config: SystemConfig) => { if (dataOwnerId) setDoc(doc(db, `users/${dataOwnerId}/systemConfig`, 'config'), sanitizeForFirestore(config)); };

  const handleGenerateBill = async (billData: Omit<Bill, 'id' | 'billNumber'>) => {
    if (!dataOwnerId) return null;
    try {
      const batch = writeBatch(db);
      const billNumber = `INV-${Date.now().toString().slice(-6)}`;
      const billRef = doc(collection(db, `users/${dataOwnerId}/bills`));
      const newBill = { ...billData, billNumber, id: billRef.id };
      batch.set(billRef, sanitizeForFirestore(newBill));
      for (const item of billData.items) {
        const productRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const updatedBatches = product.batches.map(b => {
            if (b.id === item.batchId) {
              return { ...b, stock: (b.stock || 0) - item.quantity };
            }
            return b;
          });
          batch.update(productRef, { batches: updatedBatches });
        }
      }
      cloudCart.forEach(item => {
        batch.delete(doc(db, `users/${dataOwnerId}/tempCart`, item.batchId));
      });
      await batch.commit();
      return newBill as Bill;
    } catch (e) {
      console.error(e);
      alert("Failed to generate bill.");
      return null;
    }
  };

  const handleAddToCartCloud = async (item: CartItem) => {
    if (!dataOwnerId) return;
    await setDoc(doc(db, `users/${dataOwnerId}/tempCart`, item.batchId), sanitizeForFirestore(item));
  };

  const handleRemoveFromCartCloud = async (batchId: string) => {
    if (!dataOwnerId) return;
    await deleteDoc(doc(db, `users/${dataOwnerId}/tempCart`, batchId));
  };

  const handleUpdateCartItemCloud = async (batchId: string, updates: Partial<CartItem>) => {
    if (!dataOwnerId) return;
    await updateDoc(doc(db, `users/${dataOwnerId}/tempCart`, batchId), sanitizeForFirestore(updates));
  };

  const handleAddPurchase = async (purchaseData: Omit<Purchase, 'id' | 'totalAmount'>) => {
    if (!dataOwnerId) return;
    try {
      const batch = writeBatch(db);
      const purchaseRef = doc(collection(db, `users/${dataOwnerId}/purchases`));
      let totalAmount = 0;
      purchaseData.items.forEach(item => {
        const itemTotal = (item.quantity * item.purchasePrice) * (1 - (item.discount || 0) / 100);
        totalAmount += itemTotal * (1 + (item.gst / 100));
      });
      totalAmount += (purchaseData.roundOff || 0);
      const finalPurchase = { ...purchaseData, totalAmount, id: purchaseRef.id };
      batch.set(purchaseRef, sanitizeForFirestore(finalPurchase));
      for (const item of purchaseData.items) {
        if (item.productId) {
          const productRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
          const product = products.find(p => p.id === item.productId);
          if (product) {
            const unitsPerStrip = product.unitsPerStrip || 1;
            const incomingUnits = item.quantity * unitsPerStrip;
            let batchExists = false;
            const updatedBatches = product.batches.map(b => {
              if (b.batchNumber === item.batchNumber) {
                batchExists = true;
                return { ...b, stock: (b.stock || 0) + incomingUnits, purchasePrice: item.purchasePrice, mrp: item.mrp };
              }
              return b;
            });
            if (!batchExists) {
              updatedBatches.push({
                id: `batch_${Date.now()}_${Math.random()}`,
                batchNumber: item.batchNumber,
                expiryDate: item.expiryDate,
                stock: incomingUnits,
                purchasePrice: item.purchasePrice,
                mrp: item.mrp,
                openingStock: 0
              });
            }
            batch.update(productRef, { batches: updatedBatches });
          }
        }
      }
      await batch.commit();
      alert("Purchase recorded successfully.");
    } catch (e) {
      console.error(e);
      alert("Failed to add purchase.");
    }
  };

  const handleDeletePurchase = async (purchase: Purchase) => {
    if (!dataOwnerId || !window.confirm("Delete purchase and reverse stock?")) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, `users/${dataOwnerId}/purchases`, purchase.id));
      for (const item of purchase.items) {
        if (item.productId) {
          const productRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
          const product = products.find(p => p.id === item.productId);
          if (product) {
            const unitsPerStrip = product.unitsPerStrip || 1;
            const unitsToRemove = item.quantity * unitsPerStrip;
            const updatedBatches = product.batches.map(b => {
              if (b.batchNumber === item.batchNumber) {
                return { ...b, stock: Math.max(0, (b.stock || 0) - unitsToRemove) };
              }
              return b;
            });
            batch.update(productRef, { batches: updatedBatches });
          }
        }
      }
      await batch.commit();
    } catch (e) {
      console.error(e);
      alert("Failed to delete purchase.");
    }
  };

  const handleAddPurchaseReturn = async (returnData: Omit<PurchaseReturnType, 'id' | 'totalAmount'>) => {
    if (!dataOwnerId) return;
    try {
      const batch = writeBatch(db);
      const returnRef = doc(collection(db, `users/${dataOwnerId}/purchaseReturns`));
      let totalAmount = 0;
      returnData.items.forEach(item => {
        const itemTotal = (item.quantity * item.purchasePrice) * (1 - (item.discount || 0) / 100);
        totalAmount += itemTotal * (1 + (item.gst / 100));
      });
      totalAmount += (returnData.roundOff || 0);
      const finalReturn = { ...returnData, totalAmount, id: returnRef.id };
      batch.set(returnRef, sanitizeForFirestore(finalReturn));
      for (const item of returnData.items) {
        const productRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const unitsPerStrip = product.unitsPerStrip || 1;
          const unitsToRemove = item.quantity * unitsPerStrip;
          const updatedBatches = product.batches.map(b => {
            if (b.batchNumber === item.batchNumber) {
              return { ...b, stock: Math.max(0, (b.stock || 0) - unitsToRemove) };
            }
            return b;
          });
          batch.update(productRef, { batches: updatedBatches });
        }
      }
      await batch.commit();
      alert("Return recorded and stock updated.");
    } catch (e) {
      console.error(e);
      alert("Failed to process return.");
    }
  };

  const handleDeletePurchaseReturn = async (pr: PurchaseReturnType) => {
    if (!dataOwnerId || !window.confirm("Delete return and restore stock?")) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, `users/${dataOwnerId}/purchaseReturns`, pr.id));
      for (const item of pr.items) {
        const productRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const unitsPerStrip = product.unitsPerStrip || 1;
          const unitsToAdd = item.quantity * unitsPerStrip;
          const updatedBatches = product.batches.map(b => {
            if (b.batchNumber === item.batchNumber) {
              return { ...b, stock: (b.stock || 0) + unitsToAdd };
            }
            return b;
          });
          batch.update(productRef, { batches: updatedBatches });
        }
      }
      await batch.commit();
    } catch (e) {
      console.error(e);
      alert("Failed to delete return.");
    }
  };

  const handleDeleteBill = async (bill: Bill) => {
    if (!dataOwnerId || !window.confirm(`Delete Bill ${bill.billNumber} and restore stock?`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, `users/${dataOwnerId}/bills`, bill.id));
      for (const item of bill.items) {
        const productRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const updatedBatches = product.batches.map(b => {
            if (b.id === item.batchId) {
              return { ...b, stock: (b.stock || 0) + item.quantity };
            }
            return b;
          });
          batch.update(productRef, { batches: updatedBatches });
        }
      }
      await batch.commit();
    } catch (e) {
      console.error(e);
      alert("Failed to delete bill.");
    }
  };

  const handleEditBill = (bill: Bill) => {
    setEditingBill(bill);
    setActiveView('billing');
  };

  if (!user) return <Auth />;
  return (
    <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-200">
      <Header activeView={activeView} setActiveView={setActiveView} onOpenSettings={() => setIsSettingsOpen(true)} user={user} onLogout={() => signOut(auth)} systemConfig={systemConfig} userPermissions={userPermissions} isOperator={isOperator} />
      <div className="flex-grow">
        <main className="max-w-7xl mx-auto py-6">
          {(activeView === 'billing' || activeView === 'saleEntry') && (
            <Billing products={products} bills={bills} customers={customers} salesmen={salesmen} companyProfile={companyProfile} systemConfig={systemConfig} onGenerateBill={handleGenerateBill} onAddCustomer={async (c) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/customers`), sanitizeForFirestore({ ...c, balance: c.openingBalance || 0 })); return { id: r.id, ...c, balance: c.openingBalance || 0 }; }} onAddSalesman={async (s) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/salesmen`), sanitizeForFirestore(s)); return { id: r.id, ...s }; }} editingBill={editingBill} onUpdateBill={async (id, data) => { if (!dataOwnerId) return null; await updateDoc(doc(db, `users/${dataOwnerId}/bills`, id), sanitizeForFirestore(data)); return { id, ...data } as Bill; }} onCancelEdit={() => { setEditingBill(null); setActiveView('billing'); }} onUpdateConfig={handleUpdateConfig} cart={cloudCart} onAddToCart={handleAddToCartCloud} onRemoveFromCart={handleRemoveFromCartCloud} onUpdateCartItem={handleUpdateCartItemCloud} />
          )}
          {(activeView === 'purchases' || activeView === 'purchaseEntry') && (
             <Purchases products={products} purchases={purchases} companies={companies} suppliers={suppliers} systemConfig={systemConfig} gstRates={gstRates} onAddPurchase={handleAddPurchase} onUpdatePurchase={(id, data) => updateDoc(doc(db, `users/${dataOwnerId}/purchases`, id), sanitizeForFirestore(data) as any)} onDeletePurchase={handleDeletePurchase} onAddSupplier={async (s) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/suppliers`), sanitizeForFirestore(s)); return { id: r.id, ...s }; }} editingPurchase={editingPurchase} onCancelEdit={() => setEditingPurchase(null)} onUpdateConfig={handleUpdateConfig} />
          )}
          {activeView === 'purchaseReturn' && (
            <PurchaseReturn products={products} returns={purchaseReturns} suppliers={suppliers} systemConfig={systemConfig} gstRates={gstRates} onAddReturn={handleAddPurchaseReturn} onDeleteReturn={handleDeletePurchaseReturn} />
          )}
          {activeView === 'inventory' && (<Inventory products={products} companies={companies} purchases={purchases} bills={bills} purchaseReturns={purchaseReturns} systemConfig={systemConfig} gstRates={gstRates} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct} onAddCompany={async (c) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/companies`), sanitizeForFirestore(c)); return { id: r.id, ...c }; }} />)}
          {activeView === 'productMaster' && (<Inventory products={products} companies={companies} purchases={purchases} bills={bills} purchaseReturns={purchaseReturns} systemConfig={systemConfig} gstRates={gstRates} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct} onAddCompany={async (c) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/companies`), sanitizeForFirestore(c)); return { id: r.id, ...c }; }} initialTab="productMaster" />)}
          {activeView === 'daybook' && (<DayBook bills={bills} products={products} companyProfile={companyProfile} systemConfig={systemConfig} onDeleteBill={handleDeleteBill} onEditBill={handleEditBill} onUpdateBillDetails={(id, updates) => updateDoc(doc(db, `users/${dataOwnerId}/bills`, id), sanitizeForFirestore(updates))} />)}
          {activeView === 'dashboard' && <SalesDashboard bills={bills} products={products} systemConfig={systemConfig} />}
        </main>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} companyProfile={companyProfile} onProfileChange={(p) => setDoc(doc(db, `users/${dataOwnerId}/companyProfile`, 'profile'), sanitizeForFirestore(p))} systemConfig={systemConfig} onSystemConfigChange={handleUpdateConfig} onBackupData={() => {}} onReWriteStock={handleReWriteStock} gstRates={gstRates} onAddGstRate={() => {}} onUpdateGstRate={() => {}} onDeleteGstRate={() => {}} />
    </div>
  );
}
export default App;

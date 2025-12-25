import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, orderBy, setDoc, getDoc, writeBatch, increment } from 'firebase/firestore';
import { auth, db } from './firebase';
import Header from './components/Header';
import Billing from './components/Billing';
import Inventory from './components/Inventory';
import Purchases from './components/Purchases';
import DayBook from './components/DayBook';
import SettingsModal from './components/SettingsModal';
import Auth from './components/Auth';
import PaymentEntry from './components/PaymentEntry';
import SuppliersLedger from './components/SuppliersLedger';
import CustomerLedger from './components/CustomerLedger';
import SalesReport from './components/SalesReport';
import SalesmanReport from './components/SalesmanReport';
import CompanyWiseSale from './components/CompanyWiseSale';
import CompanyWiseBillWiseProfit from './components/CompanyWiseBillWiseProfit';
import ChequePrint from './components/ChequePrint';
import SalesDashboard from './components/SalesDashboard';
import SubscriptionAdmin from './components/SubscriptionAdmin';
import SubscriptionAlert from './components/SubscriptionAlert';
import type { 
  AppView, Product, Bill, Purchase, Supplier, Customer, CustomerPayment, 
  Payment, CompanyProfile, SystemConfig, GstRate, Company, UserPermissions, 
  Salesman, UserMapping
} from './types';

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

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<AppView>('billing');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | undefined>(undefined);
  const [isOperator, setIsOperator] = useState(false);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<Payment[]>([]);
  const [gstRates, setGstRates] = useState<GstRate[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  
  // Config State
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(defaultProfile);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(defaultConfig);

  // Edit & Navigation State
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [currentLedgerCustomerId, setCurrentLedgerCustomerId] = useState<string | null>(null);
  const [currentLedgerSupplierId, setCurrentLedgerSupplierId] = useState<string | null>(null);

  // Auth & User Mapping Logic
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const mappingRef = doc(db, 'userMappings', currentUser.uid);
        const mappingSnap = await getDoc(mappingRef);
        
        const basicMapping = {
            ownerId: currentUser.uid,
            role: 'admin',
            email: currentUser.email || '',
            name: currentUser.displayName || ''
        };

        if (mappingSnap.exists()) {
          const mapping = mappingSnap.data() as UserMapping;
          if (!mapping.email || !mapping.name) {
              updateDoc(mappingRef, { email: currentUser.email, name: currentUser.displayName || mapping.name || '' });
          }

          if (mapping.role === 'operator') {
            setIsOperator(true);
            setDataOwnerId(mapping.ownerId);
            const subUserRef = doc(db, `users/${mapping.ownerId}/subUsers`, currentUser.uid);
            const subUserSnap = await getDoc(subUserRef);
            if (subUserSnap.exists()) {
               setUserPermissions(subUserSnap.data().permissions);
            }
          } else {
            setIsOperator(false);
            setDataOwnerId(currentUser.uid);
            setUserPermissions(undefined);
          }
        } else {
          setIsOperator(false);
          setDataOwnerId(currentUser.uid);
          setDoc(mappingRef, basicMapping);
        }
      } else {
        setDataOwnerId(null);
        setProducts([]);
        setBills([]);
        setPurchases([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!dataOwnerId) return;
    const basePath = `users/${dataOwnerId}`;

    const unsubProducts = onSnapshot(collection(db, `${basePath}/products`), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    const unsubBills = onSnapshot(query(collection(db, `${basePath}/bills`), orderBy('date', 'desc')), (snap) => {
      setBills(snap.docs.map(d => ({ id: d.id, ...d.data() } as Bill)));
    });

    const unsubPurchases = onSnapshot(query(collection(db, `${basePath}/purchases`), orderBy('invoiceDate', 'desc')), (snap) => {
      setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase)));
    });

    const unsubSuppliers = onSnapshot(collection(db, `${basePath}/suppliers`), (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
    });

    const unsubCustomers = onSnapshot(collection(db, `${basePath}/customers`), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });

    const unsubSalesmen = onSnapshot(collection(db, `${basePath}/salesmen`), (snap) => {
      setSalesmen(snap.docs.map(d => ({ id: d.id, ...d.data() } as Salesman)));
    });

    const unsubPayments = onSnapshot(collection(db, `${basePath}/payments`), (snap) => {
      setSupplierPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
    });
    
    const unsubCustPayments = onSnapshot(collection(db, `${basePath}/customerPayments`), (snap) => {
      setCustomerPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerPayment)));
    });

    const unsubGst = onSnapshot(collection(db, `${basePath}/gstRates`), (snap) => {
      setGstRates(snap.docs.map(d => ({ id: d.id, ...d.data() } as GstRate)));
    });

    const unsubCompanies = onSnapshot(collection(db, `${basePath}/companies`), (snap) => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company)));
    });

    const unsubProfile = onSnapshot(doc(db, `${basePath}/companyProfile`, 'profile'), (snap) => {
      if (snap.exists()) setCompanyProfile(snap.data() as CompanyProfile);
    });

    const unsubConfig = onSnapshot(doc(db, `${basePath}/systemConfig`, 'config'), (snap) => {
      if (snap.exists()) {
          const cfg = snap.data() as SystemConfig;
          if (cfg.subscription?.isPremium && cfg.subscription.expiryDate) {
              const expiry = new Date(cfg.subscription.expiryDate);
              if (expiry < new Date()) {
                  cfg.subscription.isPremium = false;
                  cfg.subscription.planType = 'Free';
              }
          }
          setSystemConfig(cfg);
      }
    });

    return () => {
      unsubProducts(); unsubBills(); unsubPurchases(); unsubSuppliers(); unsubCustomers();
      unsubPayments(); unsubGst(); unsubCompanies(); unsubProfile(); unsubConfig();
      unsubCustPayments(); unsubSalesmen();
    };
  }, [dataOwnerId]);

  const handleAddProduct = async (productData: Omit<Product, 'id'>) => {
    if (!dataOwnerId) return;
    await addDoc(collection(db, `users/${dataOwnerId}/products`), productData);
  };

  const handleUpdateProduct = async (id: string, productData: Partial<Product>) => {
    if (!dataOwnerId) return;
    await updateDoc(doc(db, `users/${dataOwnerId}/products`, id), productData);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!dataOwnerId) return;
    const isUsedInBills = bills.some(bill => bill.items.some(item => item.productId === id));
    if (isUsedInBills) { alert("Used in Sales"); return; }
    const isUsedInPurchases = purchases.some(purchase => purchase.items.some(item => item.productId === id));
    if (isUsedInPurchases) { alert("Used in Purchases"); return; }
    if (window.confirm('Delete product?')) { await deleteDoc(doc(db, `users/${dataOwnerId}/products`, id)); }
  };

  const handleGenerateBill = async (billData: Omit<Bill, 'id' | 'billNumber'>) => {
    if (!dataOwnerId) return null;
    try {
        const batch = writeBatch(db);
        const billsRef = collection(db, `users/${dataOwnerId}/bills`);
        const billNumber = `INV-${Date.now().toString().slice(-6)}`;
        const newBillRef = doc(billsRef);
        const newBill: Bill = { ...billData, id: newBillRef.id, billNumber };
        batch.set(newBillRef, newBill);
        const productUpdates = new Map<string, any[]>();
        const currentProducts = JSON.parse(JSON.stringify(products)) as Product[];
        for (const item of billData.items) {
            const product = currentProducts.find(p => p.id === item.productId);
            if (product) {
                const batchIndex = product.batches.findIndex(b => b.id === item.batchId);
                if (batchIndex !== -1) {
                    product.batches[batchIndex].stock -= item.quantity;
                    productUpdates.set(product.id, product.batches);
                }
            }
        }
        productUpdates.forEach((batches, productId) => {
            const pRef = doc(db, `users/${dataOwnerId}/products`, productId);
            batch.update(pRef, { batches });
        });
        if (billData.paymentMode === 'Credit' && billData.customerId) {
            const custRef = doc(db, `users/${dataOwnerId}/customers`, billData.customerId);
            batch.update(custRef, { balance: increment(billData.grandTotal) });
        }
        await batch.commit();
        return newBill;
    } catch (e) { alert("Failed"); return null; }
  };

  const handleAddPurchase = async (purchaseData: Omit<Purchase, 'id' | 'totalAmount'>) => {
      if (!dataOwnerId) return;
      try {
          const batch = writeBatch(db);
          const purchaseRef = doc(collection(db, `users/${dataOwnerId}/purchases`));
          let totalAmount = 0;
          const itemsWithIds = purchaseData.items.map(item => {
              const itemTotal = (item.quantity * item.purchasePrice) * (1 - (item.discount || 0)/100);
              const tax = itemTotal * (item.gst / 100);
              totalAmount += itemTotal + tax;
              return { ...item };
          });
          totalAmount += (purchaseData.roundOff || 0);
          const newPurchase: Purchase = { ...purchaseData, items: itemsWithIds, totalAmount, id: purchaseRef.id };
          batch.set(purchaseRef, newPurchase);
          const currentProducts = JSON.parse(JSON.stringify(products)) as Product[];
          let runningMaxBarcode = 0;
          currentProducts.forEach(p => { if (p.barcode && /^\d+$/.test(p.barcode)) { const num = parseInt(p.barcode, 10); if (num > runningMaxBarcode) runningMaxBarcode = num; } });
          for (const item of itemsWithIds) {
              let product = item.productId ? currentProducts.find(p => p.id === item.productId) : currentProducts.find(p => p.name === item.productName && p.company === item.company);
              if (product) {
                  const productRef = doc(db, `users/${dataOwnerId}/products`, product.id);
                  const existingBatchIndex = product.batches.findIndex(b => b.batchNumber.trim().toLowerCase() === item.batchNumber.trim().toLowerCase() && Math.abs(b.mrp - item.mrp) < 0.01);
                  const units = item.unitsPerStrip || product.unitsPerStrip || 1;
                  const quantityToAdd = item.quantity * units;
                  if (existingBatchIndex >= 0) {
                      product.batches[existingBatchIndex].stock += quantityToAdd;
                      product.batches[existingBatchIndex].purchasePrice = item.purchasePrice; 
                  } else {
                      product.batches.push({ id: `batch_${Date.now()}_${Math.random()}`, batchNumber: item.batchNumber, expiryDate: item.expiryDate, stock: quantityToAdd, mrp: item.mrp, purchasePrice: item.purchasePrice, openingStock: 0 });
                  }
                  batch.update(productRef, { batches: product.batches });
              } else {
                  const productRef = doc(collection(db, `users/${dataOwnerId}/products`));
                  const newBatch = { id: `batch_${Date.now()}_${Math.random()}`, batchNumber: item.batchNumber, expiryDate: item.expiryDate, stock: item.quantity * (item.unitsPerStrip || 1), mrp: item.mrp, purchasePrice: item.purchasePrice, openingStock: 0 };
                  let itemBarcode = item.barcode || (++runningMaxBarcode).toString().padStart(6, '0');
                  const newProduct: Product = { id: productRef.id, name: item.productName, company: item.company, hsnCode: item.hsnCode, gst: item.gst, batches: [newBatch], barcode: itemBarcode, ...(item.composition && { composition: item.composition }), ...(item.unitsPerStrip && { unitsPerStrip: item.unitsPerStrip }), ...(item.isScheduleH !== undefined && { isScheduleH: item.isScheduleH }) };
                  batch.set(productRef, newProduct);
              }
          }
          await batch.commit();
      } catch(e) { alert("Error"); }
  };

  const handleEditBill = (bill: Bill) => { setEditingBill(bill); setActiveView('billing'); };
  const handleDeleteBill = async (bill: Bill) => {
      if (!dataOwnerId || !window.confirm("Delete?")) return;
      const batch = writeBatch(db);
      batch.delete(doc(db, `users/${dataOwnerId}/bills`, bill.id));
      const currentProducts = JSON.parse(JSON.stringify(products)) as Product[];
      for (const item of bill.items) {
          const product = currentProducts.find(p => p.id === item.productId);
          if (product) {
              const bIdx = product.batches.findIndex(b => b.id === item.batchId);
              if (bIdx !== -1) {
                  product.batches[bIdx].stock += item.quantity;
                  batch.update(doc(db, `users/${dataOwnerId}/products`, product.id), { batches: product.batches });
              }
          }
      }
      if (bill.paymentMode === 'Credit' && bill.customerId) {
          batch.update(doc(db, `users/${dataOwnerId}/customers`, bill.customerId), { balance: increment(-bill.grandTotal) });
      }
      await batch.commit();
  };

  const handleAddSupplier = async (supplierData: Omit<Supplier, 'id'>) => {
      if (!dataOwnerId) return null;
      const ref = await addDoc(collection(db, `users/${dataOwnerId}/suppliers`), supplierData);
      return { id: ref.id, ...supplierData };
  };

  const handleUpdateSupplier = async (id: string, data: Omit<Supplier, 'id'>) => {
      if (!dataOwnerId) return;
      await updateDoc(doc(db, `users/${dataOwnerId}/suppliers`, id), data);
  };

  const handleAddCustomer = async (custData: Omit<Customer, 'id' | 'balance'>) => {
      if (!dataOwnerId) return null;
      const ref = await addDoc(collection(db, `users/${dataOwnerId}/customers`), { ...custData, balance: custData.openingBalance || 0 });
      return { id: ref.id, ...custData, balance: custData.openingBalance || 0 };
  };

  const handleUpdateCustomer = async (id: string, data: Partial<Customer>) => {
      if (!dataOwnerId) return;
      await updateDoc(doc(db, `users/${dataOwnerId}/customers`, id), data);
  };

  const handleAddCustomerPayment = async (paymentData: Omit<CustomerPayment, 'id'>) => {
      if (!dataOwnerId) return;
      const batch = writeBatch(db);
      batch.set(doc(collection(db, `users/${dataOwnerId}/customerPayments`)), paymentData);
      batch.update(doc(db, `users/${dataOwnerId}/customers`, paymentData.customerId), { balance: increment(-paymentData.amount) });
      await batch.commit();
  };

  if (!user) return <Auth />;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-200">
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenSettings={() => setIsSettingsOpen(true)}
        user={user}
        onLogout={() => signOut(auth)}
        systemConfig={systemConfig}
        userPermissions={userPermissions}
        isOperator={isOperator}
      />

      <main className="max-w-7xl mx-auto py-6">
        {activeView === 'billing' && (
          <Billing
            products={products}
            bills={bills}
            customers={customers}
            salesmen={salesmen}
            companyProfile={companyProfile}
            systemConfig={systemConfig}
            onGenerateBill={handleGenerateBill}
            onAddCustomer={handleAddCustomer}
            onAddSalesman={async (s) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/salesmen`), s); return { id: r.id, ...s }; }}
            editingBill={editingBill}
            onUpdateBill={async (id, data, orig) => {
                if (!dataOwnerId) return null;
                const b = writeBatch(db);
                b.update(doc(db, `users/${dataOwnerId}/bills`, id), data);
                await b.commit();
                return { id, ...data } as Bill;
            }}
            onCancelEdit={() => { setEditingBill(null); setActiveView('billing'); }}
          />
        )}
        {activeView === 'inventory' && (
          <Inventory
            products={products}
            purchases={purchases}
            bills={bills}
            systemConfig={systemConfig}
            gstRates={gstRates}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        )}
        {activeView === 'purchases' && (
          <Purchases
            products={products}
            purchases={purchases}
            companies={companies}
            suppliers={suppliers}
            systemConfig={systemConfig}
            gstRates={gstRates}
            onAddPurchase={handleAddPurchase}
            onUpdatePurchase={(id, data) => updateDoc(doc(db, `users/${dataOwnerId}/purchases`, id), data as any)}
            onDeletePurchase={(p) => deleteDoc(doc(db, `users/${dataOwnerId}/purchases`, p.id))}
            onAddSupplier={handleAddSupplier}
            editingPurchase={editingPurchase}
            onCancelEdit={() => setEditingPurchase(null)}
            onUpdateConfig={(cfg) => setDoc(doc(db, `users/${dataOwnerId}/systemConfig`, 'config'), cfg)}
          />
        )}
        {activeView === 'daybook' && (
          <DayBook
            bills={bills}
            companyProfile={companyProfile}
            systemConfig={systemConfig}
            onDeleteBill={handleDeleteBill}
            onEditBill={handleEditBill}
            onUpdateBillDetails={(id, updates) => updateDoc(doc(db, `users/${dataOwnerId}/bills`, id), updates)}
          />
        )}
        {activeView === 'suppliersLedger' && (
          <SuppliersLedger
            suppliers={suppliers}
            purchases={purchases}
            payments={supplierPayments}
            companyProfile={companyProfile}
            initialSupplierId={currentLedgerSupplierId}
            onSupplierSelected={setCurrentLedgerSupplierId}
            onUpdateSupplier={handleUpdateSupplier}
            onAddPayment={async (p) => { const v = `VCH-${Date.now().toString().slice(-6)}`; const r = await addDoc(collection(db, `users/${dataOwnerId}/payments`), {...p, voucherNumber: v}); return {id: r.id, ...p, voucherNumber: v}; }}
            onDeletePurchase={(p) => deleteDoc(doc(db, `users/${dataOwnerId}/purchases`, p.id))}
            onEditPurchase={(p) => { setEditingPurchase(p); setActiveView('purchases'); }}
            onUpdatePayment={(id, data) => updateDoc(doc(db, `users/${dataOwnerId}/payments`, id), data as any)}
            onDeletePayment={(id) => deleteDoc(doc(db, `users/${dataOwnerId}/payments`, id))}
          />
        )}
        {activeView === 'paymentEntry' && (
          <PaymentEntry
            suppliers={suppliers}
            payments={supplierPayments}
            companyProfile={companyProfile}
            onAddPayment={async (p) => { const v = `VCH-${Date.now().toString().slice(-6)}`; const r = await addDoc(collection(db, `users/${dataOwnerId}/payments`), {...p, voucherNumber: v}); return {id: r.id, ...p, voucherNumber: v}; }}
            onUpdatePayment={(id, data) => updateDoc(doc(db, `users/${dataOwnerId}/payments`, id), data as any)}
            onDeletePayment={(id) => deleteDoc(doc(db, `users/${dataOwnerId}/payments`, id))}
          />
        )}
        {activeView === 'customerLedger' && (
          <CustomerLedger
            customers={customers}
            bills={bills}
            payments={customerPayments}
            companyProfile={companyProfile}
            initialCustomerId={currentLedgerCustomerId}
            onCustomerSelected={setCurrentLedgerCustomerId}
            onAddPayment={handleAddCustomerPayment}
            onUpdateCustomer={handleUpdateCustomer}
            onEditBill={handleEditBill}
            onDeleteBill={handleDeleteBill}
            onUpdatePayment={(id, data) => updateDoc(doc(db, `users/${dataOwnerId}/customerPayments`, id), data as any)}
            onDeletePayment={(p) => deleteDoc(doc(db, `users/${dataOwnerId}/customerPayments`, p.id))}
          />
        )}
        {activeView === 'salesReport' && <SalesReport bills={bills} />}
        {activeView === 'salesmanReport' && <SalesmanReport bills={bills} salesmen={salesmen} />}
        {activeView === 'companyWiseSale' && <CompanyWiseSale bills={bills} products={products} systemConfig={systemConfig} />}
        {activeView === 'companyWiseBillWiseProfit' && <CompanyWiseBillWiseProfit bills={bills} products={products} />}
        {activeView === 'chequePrint' && <ChequePrint systemConfig={systemConfig} onUpdateConfig={(cfg) => setDoc(doc(db, `users/${dataOwnerId}/systemConfig`, 'config'), cfg)} />}
        {activeView === 'dashboard' && <SalesDashboard bills={bills} products={products} systemConfig={systemConfig} />}
        {activeView === 'subscriptionAdmin' && user.email === 'emeraj@gmail.com' && <SubscriptionAdmin />}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        companyProfile={companyProfile}
        onProfileChange={(p) => setDoc(doc(db, `users/${dataOwnerId}/companyProfile`, 'profile'), p)}
        systemConfig={systemConfig}
        onSystemConfigChange={(c) => setDoc(doc(db, `users/${dataOwnerId}/systemConfig`, 'config'), c)}
        onBackupData={() => {
            const backup = { products, bills, purchases, suppliers, customers, payments: supplierPayments, gstRates, companyProfile, systemConfig };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
            const a = document.createElement('a'); a.href = dataStr; a.download = "backup.json"; a.click();
        }}
        gstRates={gstRates}
        onAddGstRate={(r) => addDoc(collection(db, `users/${dataOwnerId}/gstRates`), { rate: r })}
        onUpdateGstRate={(id, r) => updateDoc(doc(db, `users/${dataOwnerId}/gstRates`, id), { rate: r })}
        onDeleteGstRate={(id) => deleteDoc(doc(db, `users/${dataOwnerId}/gstRates`, id))}
      />

      <SubscriptionAlert systemConfig={systemConfig} />
    </div>
  );
}

export default App;

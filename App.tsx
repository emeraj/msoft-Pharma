
import React, { useState, useEffect, useMemo } from 'react';
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
import GstReports from './components/GstReports';
import { InformationCircleIcon, XIcon, CloudIcon, CheckCircleIcon } from './components/icons/Icons';
import type { 
  AppView, Product, Bill, Purchase, Supplier, Customer, CustomerPayment, 
  Payment, CompanyProfile, SystemConfig, GstRate, Company, UserPermissions, 
  Salesman, UserMapping, GstReportView
} from './types';

const normalizeCode = (str: string = "") => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

/**
 * Removes 'undefined' properties recursively to comply with Firestore data requirements.
 */
const sanitizeForFirestore = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  if (obj !== null && typeof obj === 'object') {
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

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<AppView>('billing');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | undefined>(undefined);
  const [isOperator, setIsOperator] = useState(false);
  const [showRenewOverlay, setShowRenewOverlay] = useState(false);
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
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(defaultProfile);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(defaultConfig);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [currentLedgerCustomerId, setCurrentLedgerCustomerId] = useState<string | null>(null);
  const [currentLedgerSupplierId, setCurrentLedgerSupplierId] = useState<string | null>(null);

  const subscriptionStatus = useMemo(() => {
    if (!systemConfig.subscription?.isPremium || !systemConfig.subscription?.expiryDate) return { isExpiring: false, isExpired: false, daysLeft: 0 };
    const expiry = new Date(systemConfig.subscription.expiryDate); const today = new Date(); const diffTime = expiry.getTime() - today.getTime(); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { isExpiring: diffDays <= 15 && diffDays > 0, isExpired: diffDays <= 0, daysLeft: diffDays };
  }, [systemConfig.subscription]);

  const upiId = "9890072651@upi"; const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent("M. Soft India")}&am=5000&cu=INR`; const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUrl)}`;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const mappingRef = doc(db, 'userMappings', currentUser.uid);
        const mappingSnap = await getDoc(mappingRef);
        if (mappingSnap.exists()) {
          const mapping = mappingSnap.data() as UserMapping;
          if (mapping.role === 'operator') {
            setIsOperator(true); setDataOwnerId(mapping.ownerId);
            const subUserRef = doc(db, `users/${mapping.ownerId}/subUsers`, currentUser.uid);
            const subUserSnap = await getDoc(subUserRef);
            if (subUserSnap.exists()) setUserPermissions(subUserSnap.data().permissions);
          } else { setIsOperator(false); setDataOwnerId(currentUser.uid); setUserPermissions(undefined); }
        } else { setIsOperator(false); setDataOwnerId(currentUser.uid); setDoc(mappingRef, { ownerId: currentUser.uid, role: 'admin', email: currentUser.email || '', name: currentUser.displayName || '' }); }
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
    const unsubSuppliers = onSnapshot(collection(db, `${basePath}/suppliers`), (snap) => setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier))));
    const unsubCustomers = onSnapshot(collection(db, `${basePath}/customers`), (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer))));
    const unsubSalesmen = onSnapshot(collection(db, `${basePath}/salesmen`), (snap) => setSalesmen(snap.docs.map(d => ({ id: d.id, ...d.data() } as Salesman))));
    const unsubPayments = onSnapshot(collection(db, `${basePath}/payments`), (snap) => setSupplierPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment))));
    const unsubCustPayments = onSnapshot(collection(db, `${basePath}/customerPayments`), (snap) => setCustomerPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerPayment))));
    const unsubGst = onSnapshot(collection(db, `${basePath}/gstRates`), (snap) => setGstRates(snap.docs.map(d => ({ id: d.id, ...d.data() } as GstRate))));
    const unsubCompanies = onSnapshot(collection(db, `${basePath}/companies`), (snap) => setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company))));
    const unsubProfile = onSnapshot(doc(db, `${basePath}/companyProfile`, 'profile'), (snap) => { if (snap.exists()) setCompanyProfile(snap.data() as CompanyProfile); });
    const unsubConfig = onSnapshot(doc(db, `${basePath}/systemConfig`, 'config'), (snap) => { if (snap.exists()) setSystemConfig(snap.data() as SystemConfig); });
    return () => { unsubProducts(); unsubBills(); unsubPurchases(); unsubSuppliers(); unsubCustomers(); unsubPayments(); unsubGst(); unsubCompanies(); unsubProfile(); unsubConfig(); unsubCustPayments(); unsubSalesmen(); };
  }, [dataOwnerId]);

  const handleAddProduct = async (productData: Omit<Product, 'id'>) => { if (!dataOwnerId) return; await addDoc(collection(db, `users/${dataOwnerId}/products`), sanitizeForFirestore(productData)); };
  const handleUpdateProduct = async (id: string, productData: Partial<Product>) => { if (!dataOwnerId) return; await updateDoc(doc(db, `users/${dataOwnerId}/products`, id), sanitizeForFirestore(productData)); };
  const handleDeleteProduct = async (id: string) => { if (!dataOwnerId) return; const isUsedInBills = bills.some(bill => bill.items.some(item => item.productId === id)); if (isUsedInBills) { alert("Used in Sales"); return; } const isUsedInPurchases = purchases.some(purchase => purchase.items.some(item => item.productId === id)); if (isUsedInPurchases) { alert("Used in Purchases"); return; } if (window.confirm('Delete product?')) { await deleteDoc(doc(db, `users/${dataOwnerId}/products`, id)); } };

  const handleGenerateBill = async (billData: Omit<Bill, 'id' | 'billNumber'>) => {
    if (!dataOwnerId) return null;
    try {
        const batch = writeBatch(db); const billsRef = collection(db, `users/${dataOwnerId}/bills`); const billNumber = `INV-${Date.now().toString().slice(-6)}`; const newBillRef = doc(billsRef); const newBill: Bill = { ...billData, id: newBillRef.id, billNumber }; batch.set(newBillRef, sanitizeForFirestore(newBill));
        const productUpdates = new Map<string, any[]>(); const currentProducts = JSON.parse(JSON.stringify(products)) as Product[];
        for (const item of billData.items) { const product = currentProducts.find(p => p.id === item.productId); if (product) { const bIdx = product.batches.findIndex(b => b.id === item.batchId); if (bIdx !== -1) { product.batches[bIdx].stock -= item.quantity; productUpdates.set(product.id, product.batches); } } }
        productUpdates.forEach((batches, productId) => batch.update(doc(db, `users/${dataOwnerId}/products`, productId), { batches }));
        if (billData.paymentMode === 'Credit' && billData.customerId) batch.update(doc(db, `users/${dataOwnerId}/customers`, billData.customerId), { balance: increment(billData.grandTotal) });
        await batch.commit(); return newBill;
    } catch (e) { alert("Failed"); return null; }
  };

  const handleAddPurchase = async (purchaseData: Omit<Purchase, 'id' | 'totalAmount'>) => {
      if (!dataOwnerId) return;
      try {
          const batch = writeBatch(db); const purchaseRef = doc(collection(db, `users/${dataOwnerId}/purchases`)); let totalAmount = 0;
          const itemsWithIds = purchaseData.items.map(item => { const itTotal = (item.quantity * item.purchasePrice) * (1 - (item.discount || 0)/100); totalAmount += itTotal + (itTotal * item.gst/100); return { ...item }; });
          totalAmount += (purchaseData.roundOff || 0); const newPurchase: Purchase = { ...purchaseData, items: itemsWithIds, totalAmount, id: purchaseRef.id }; batch.set(purchaseRef, sanitizeForFirestore(newPurchase));
          const currentProducts = JSON.parse(JSON.stringify(products)) as Product[];
          for (const item of itemsWithIds) {
              const iBarcode = normalizeCode(item.barcode);
              const iName = item.productName.toLowerCase().trim();
              const iCompany = item.company.toLowerCase().trim();
              let product = item.productId 
                ? currentProducts.find(p => p.id === item.productId) 
                : currentProducts.find(p => {
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
                  } else { product.batches.push({ id: `batch_${Date.now()}_${Math.random()}`, batchNumber: item.batchNumber, expiryDate: item.expiryDate, stock: quantityToAdd, mrp: item.mrp, purchasePrice: item.purchasePrice, openingStock: 0 }); }
                  batch.update(productRef, { batches: product.batches });
              } else {
                  const productRef = doc(collection(db, `users/${dataOwnerId}/products`));
                  const newBatch = { id: `batch_${Date.now()}_${Math.random()}`, batchNumber: item.batchNumber, expiryDate: item.expiryDate, stock: item.quantity * (item.unitsPerStrip || 1), mrp: item.mrp, purchasePrice: item.purchasePrice, openingStock: 0 };
                  const newProduct: Product = { id: productRef.id, name: item.productName, company: item.company, hsnCode: item.hsnCode, gst: item.gst, batches: [newBatch], barcode: item.barcode || '', ...(item.composition && { composition: item.composition }), ...(item.unitsPerStrip && { unitsPerStrip: item.unitsPerStrip }), ...(item.isScheduleH !== undefined && { isScheduleH: item.isScheduleH }) };
                  batch.set(productRef, sanitizeForFirestore(newProduct));
              }
          }
          await batch.commit();
      } catch(e) { alert("Error"); }
  };

  const handleEditBill = (bill: Bill) => { setEditingBill(bill); setActiveView('billing'); };
  /* Fix: Corrected 'billData.customerId' to 'bill.customerId' in handleDeleteBill (line 198) */
  const handleDeleteBill = async (bill: Bill) => { if (!dataOwnerId || !window.confirm("Delete?")) return; const batch = writeBatch(db); batch.delete(doc(db, `users/${dataOwnerId}/bills`, bill.id)); const currentProducts = JSON.parse(JSON.stringify(products)) as Product[]; for (const item of bill.items) { const p = currentProducts.find(pr => pr.id === item.productId); if (p) { const bIdx = p.batches.findIndex(b => b.id === item.batchId); if (bIdx !== -1) { p.batches[bIdx].stock += item.quantity; batch.update(doc(db, `users/${dataOwnerId}/products`, p.id), { batches: p.batches }); } } } if (bill.paymentMode === 'Credit' && bill.customerId) batch.update(doc(db, `users/${dataOwnerId}/customers`, bill.customerId), { balance: increment(-bill.grandTotal) }); await batch.commit(); };
  const handleUpdateConfig = (config: SystemConfig) => { if (dataOwnerId) setDoc(doc(db, `users/${dataOwnerId}/systemConfig`, 'config'), sanitizeForFirestore(config)); };
  
  const isGstView = (view: AppView): view is GstReportView => ['gstr3b', 'hsnSales', 'hsnPurchase', 'gstWiseSales'].includes(view);

  if (!user) return <Auth />;
  return (
    <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-200">
      <Header activeView={activeView} setActiveView={setActiveView} onOpenSettings={() => setIsSettingsOpen(true)} user={user} onLogout={() => signOut(auth)} systemConfig={systemConfig} userPermissions={userPermissions} isOperator={isOperator} />
      
      <div className="flex-grow">
        {(subscriptionStatus.isExpiring || subscriptionStatus.isExpired) && !isOperator && (<div className={`sticky top-16 z-30 flex flex-col sm:flex-row items-center justify-between px-6 py-3 shadow-md animate-pulse-subtle ${subscriptionStatus.isExpired ? 'bg-rose-600 text-white' : 'bg-amber-500 text-slate-900'}`}><div className="flex items-center gap-3 mb-2 sm:mb-0"><InformationCircleIcon className="h-6 w-6" /><p className="text-sm font-black uppercase tracking-tight">{subscriptionStatus.isExpired ? 'CRITICAL: Subscription Expired! Renew immediately.' : `Attention: Your Premium Subscription expires in ${subscriptionStatus.daysLeft} days.`}</p></div><button onClick={() => setShowRenewOverlay(true)} className={`px-6 py-1.5 rounded-full font-black text-xs uppercase tracking-widest shadow-lg ${subscriptionStatus.isExpired ? 'bg-white text-rose-600 hover:bg-slate-100' : 'bg-slate-900 text-white'}`}>Renew Now</button></div>)}
        {showRenewOverlay && (<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"><div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border-4 border-indigo-600 relative animate-fade-in-up"><button onClick={() => setShowRenewOverlay(false)} className="absolute top-4 right-4 text-slate-400"><XIcon className="h-6 w-6" /></button><div className="p-6 text-center"><div className="flex justify-center mb-4"><div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full"><CloudIcon className="h-10 w-10 text-indigo-600" /></div></div><h3 className="text-xl font-black uppercase tracking-tighter">Renew Premium</h3><p className="text-xs text-slate-500 mt-1">Tag Your Business to the Cloud</p><div className="mt-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-dashed border-indigo-300"><img src={qrCodeUrl} alt="Payment QR" className="w-48 h-48 mx-auto border-4 border-white rounded-lg" /><p className="mt-3 text-2xl font-black text-indigo-600">₹5,000 <span className="text-xs font-normal">/ Year</span></p></div><div className="mt-6 space-y-3"><p className="text-[11px] text-slate-600">Scan using any UPI App</p><div className="bg-indigo-50 dark:bg-indigo-900/20 py-2 px-4 rounded-lg flex items-center justify-center gap-2"><CheckCircleIcon className="h-4 w-4 text-indigo-500" /><span className="text-xs font-bold">WhatsApp Screenshot: 9890072651</span></div></div></div></div></div>)}
        
        <main className="max-w-7xl mx-auto py-6">
          {activeView === 'billing' && (<Billing products={products} bills={bills} customers={customers} salesmen={salesmen} companyProfile={companyProfile} systemConfig={systemConfig} onGenerateBill={handleGenerateBill} onAddCustomer={async (c) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/customers`), sanitizeForFirestore({ ...c, balance: c.openingBalance || 0 })); return { id: r.id, ...c, balance: c.openingBalance || 0 }; }} onAddSalesman={async (s) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/salesmen`), sanitizeForFirestore(s)); return { id: r.id, ...s }; }} editingBill={editingBill} onUpdateBill={async (id, data) => { if (!dataOwnerId) return null; await updateDoc(doc(db, `users/${dataOwnerId}/bills`, id), sanitizeForFirestore(data)); return { id, ...data } as Bill; }} onCancelEdit={() => { setEditingBill(null); setActiveView('billing'); }} onUpdateConfig={handleUpdateConfig} isSubscriptionExpired={subscriptionStatus.isExpired} />)}
          {activeView === 'inventory' && (<Inventory products={products} companies={companies} purchases={purchases} bills={bills} systemConfig={systemConfig} gstRates={gstRates} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct} onAddCompany={async (c) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/companies`), sanitizeForFirestore(c)); return { id: r.id, ...c }; }} />)}
          {activeView === 'purchases' && (<Purchases products={products} purchases={purchases} companies={companies} suppliers={suppliers} systemConfig={systemConfig} gstRates={gstRates} onAddPurchase={handleAddPurchase} onUpdatePurchase={(id, data) => updateDoc(doc(db, `users/${dataOwnerId}/purchases`, id), sanitizeForFirestore(data) as any)} onDeletePurchase={(p) => deleteDoc(doc(db, `users/${dataOwnerId}/purchases`, p.id))} onAddSupplier={async (s) => { const r = await addDoc(collection(db, `users/${dataOwnerId}/suppliers`), sanitizeForFirestore(s)); return { id: r.id, ...s }; }} editingPurchase={editingPurchase} onCancelEdit={() => setEditingPurchase(null)} onUpdateConfig={handleUpdateConfig} isSubscriptionExpired={subscriptionStatus.isExpired} />)}
          {activeView === 'daybook' && (<DayBook bills={bills} products={products} companyProfile={companyProfile} systemConfig={systemConfig} onDeleteBill={handleDeleteBill} onEditBill={handleEditBill} onUpdateBillDetails={(id, updates) => updateDoc(doc(db, `users/${dataOwnerId}/bills`, id), sanitizeForFirestore(updates))} />)}
          {activeView === 'suppliersLedger' && (<SuppliersLedger suppliers={suppliers} purchases={purchases} payments={supplierPayments} companyProfile={companyProfile} initialSupplierId={currentLedgerSupplierId} onSupplierSelected={setCurrentLedgerSupplierId} onUpdateSupplier={(id, d) => updateDoc(doc(db, `users/${dataOwnerId}/suppliers`, id), sanitizeForFirestore(d))} onAddPayment={async (p) => { const v = `VCH-${Date.now().toString().slice(-6)}`; const r = await addDoc(collection(db, `users/${dataOwnerId}/payments`), sanitizeForFirestore({...p, voucherNumber: v})); return {id: r.id, ...p, voucherNumber: v}; }} onDeletePurchase={(p) => deleteDoc(doc(db, `users/${dataOwnerId}/purchases`, p.id))} onEditPurchase={(p) => { setEditingPurchase(p); setActiveView('purchases'); }} onUpdatePayment={(id, data) => updateDoc(doc(db, `users/${dataOwnerId}/payments`, id), sanitizeForFirestore(data) as any)} onDeletePayment={(id) => deleteDoc(doc(db, `users/${dataOwnerId}/payments`, id))} />)}
          {activeView === 'paymentEntry' && (<PaymentEntry suppliers={suppliers} payments={supplierPayments} companyProfile={companyProfile} onAddPayment={async (p) => { const v = `VCH-${Date.now().toString().slice(-6)}`; const r = await addDoc(collection(db, `users/${dataOwnerId}/payments`), sanitizeForFirestore({...p, voucherNumber: v})); return {id: r.id, ...p, voucherNumber: v}; }} onUpdatePayment={(id, data) => updateDoc(doc(db, `users/${dataOwnerId}/payments`, id), sanitizeForFirestore(data) as any)} onDeletePayment={(id) => deleteDoc(doc(db, `users/${dataOwnerId}/payments`, id))} />)}
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
          <p>
            Developed by: <span className="font-semibold text-indigo-600 dark:text-indigo-400">M. Soft India</span>
            <span className="mx-2">|</span>
            Contact: <a href="tel:9890072651" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">9890072651</a>
            <span className="mx-2">|</span>
            Visit: <a href="http://msoftindia.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">msoftindia.com</a>
          </p>
        </div>
      </footer>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} companyProfile={companyProfile} onProfileChange={(p) => setDoc(doc(db, `users/${dataOwnerId}/companyProfile`, 'profile'), sanitizeForFirestore(p))} systemConfig={systemConfig} onSystemConfigChange={handleUpdateConfig} onBackupData={() => { const backup = { products, bills, purchases, suppliers, customers, payments: supplierPayments, gstRates, companyProfile, systemConfig }; const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup)); const a = document.createElement('a'); a.href = dataStr; a.download = "backup.json"; a.click(); }} gstRates={gstRates} onAddGstRate={(r) => addDoc(collection(db, `users/${dataOwnerId}/gstRates`), sanitizeForFirestore({ rate: r }))} onUpdateGstRate={(id, r) => updateDoc(doc(db, `users/${dataOwnerId}/gstRates`, id), sanitizeForFirestore({ rate: r }))} onDeleteGstRate={(id) => deleteDoc(doc(db, `users/${dataOwnerId}/gstRates`, id))} />
      <style>{` @keyframes pulse-subtle { 0%, 100% { opacity: 1; } 50% { opacity: 0.92; } } .animate-pulse-subtle { animation: pulse-subtle 3s infinite ease-in-out; } @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-up { animation: fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; } `}</style>
    </div>
  );
}

export default App;

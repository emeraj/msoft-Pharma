import React, { useState, useEffect } from 'react';
import type { AppView, Product, Batch, Bill, Purchase, PurchaseLineItem, Theme, CompanyProfile, Company, Supplier, Payment } from './types';
import Header from './components/Header';
import Billing from './components/Billing';
import Inventory from './components/Inventory';
import DayBook from './components/DayBook';
import Purchases from './components/Purchases';
import SettingsModal from './components/SettingsModal';
import Auth from './components/Auth';
import Card from './components/common/Card';
import { database, auth } from './firebase';
// Fix: Import firebase compat for types and v8 API
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import 'firebase/compat/auth';
import SuppliersLedger from './components/SuppliersLedger';
import SalesReport from './components/SalesReport';
import CompanyWiseSale from './components/CompanyWiseSale';
import PaymentEntry from './components/PaymentEntry';


const App: React.FC = () => {
  // Fix: Use firebase.User type from compat import
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeView, setActiveView] = useState<AppView>('billing');
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({ name: 'Pharma - Retail', address: '123 Health St, Wellness City', gstin: 'ABCDE12345FGHIJ'});

  useEffect(() => {
    // Fix: Use v8 compat API for onAuthStateChanged
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    if (!currentUser) {
      // Clear data when user logs out
      setProducts([]);
      setBills([]);
      setPurchases([]);
      setCompanies([]);
      setSuppliers([]);
      setPayments([]);
      setCompanyProfile({ name: 'Pharma - Retail', address: '123 Health St, Wellness City', gstin: 'ABCDE12345FGHIJ' });
      setDataLoading(true); // Reset loading state for next login
      setPermissionError(null); // Clear any existing errors
      return;
    }

    setDataLoading(true);
    setPermissionError(null);
    const uid = currentUser.uid;

    const parseProductsSnapshot = (snapshot: firebase.database.DataSnapshot, setter: Function) => {
        const data = snapshot.val();
        if (data) {
            const list = Object.entries(data).map(([key, value]: [string, any]) => ({
                ...value,
                key,
                batches: value.batches ? Object.entries(value.batches).map(([batchKey, batchValue]: [string, any]) => ({...batchValue, key: batchKey})) : []
            }));
            setter(list);
        } else {
            setter([]);
        }
    };

    const parseGenericListSnapshot = (snapshot: firebase.database.DataSnapshot, setter: Function) => {
        const data = snapshot.val();
        if (data) {
            const list = Object.entries(data).map(([key, value]: [string, any]) => ({
                ...value,
                key,
            }));
            setter(list);
        } else {
            setter([]);
        }
    };

    // Fix: Use v8 compat API for database references and listeners
    const productsRef = database.ref(`users/${uid}/products`);
    const billsRef = database.ref(`users/${uid}/bills`);
    const purchasesRef = database.ref(`users/${uid}/purchases`);
    const companiesRef = database.ref(`users/${uid}/companies`);
    const suppliersRef = database.ref(`users/${uid}/suppliers`);
    const paymentsRef = database.ref(`users/${uid}/payments`);
    const profileRef = database.ref(`users/${uid}/companyProfile`);

    productsRef.on('value', (snapshot) => parseProductsSnapshot(snapshot, setProducts));
    billsRef.on('value', (snapshot) => parseGenericListSnapshot(snapshot, setBills));
    purchasesRef.on('value', (snapshot) => parseGenericListSnapshot(snapshot, setPurchases));
    companiesRef.on('value', (snapshot) => parseGenericListSnapshot(snapshot, setCompanies));
    suppliersRef.on('value', (snapshot) => parseGenericListSnapshot(snapshot, setSuppliers));
    paymentsRef.on('value', (snapshot) => parseGenericListSnapshot(snapshot, setPayments));
    profileRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) setCompanyProfile(data);
    });

    Promise.all([productsRef.get(), billsRef.get(), purchasesRef.get(), profileRef.get(), companiesRef.get(), suppliersRef.get(), paymentsRef.get()])
      .then(() => setDataLoading(false))
      .catch((error: any) => {
        console.error("Error fetching initial data:", error);
        if (error.code === 'PERMISSION_DENIED') {
          setPermissionError("Permission Denied: Could not fetch your data from the database. This is likely due to incorrect Firebase security rules.");
        } else {
           setPermissionError(`Could not connect to the database. Error: ${error.message}`);
        }
        setDataLoading(false);
      });

    return () => {
      // Detach listeners
      productsRef.off();
      billsRef.off();
      purchasesRef.off();
      profileRef.off();
      companiesRef.off();
      suppliersRef.off();
      paymentsRef.off();
    };
  }, [currentUser]);


  useEffect(() => {
    localStorage.setItem('theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);
  
  const handleLogout = () => {
    // Fix: Use v8 compat API for signOut
    auth.signOut();
  };

  const PermissionErrorComponent: React.FC = () => (
    <div className="flex-grow flex items-center justify-center p-4">
        <Card title="Database Permission Error" className="max-w-2xl w-full text-center border-2 border-red-500/50">
            <p className="text-red-600 dark:text-red-400 mb-4">{permissionError}</p>
            <div className="text-left bg-slate-100 dark:bg-slate-800 p-4 rounded-lg my-4">
                <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 mb-2">How to Fix</h3>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                    This application requires specific security rules to be set in your Firebase project to protect your data.
                </p>
                <ol className="list-decimal list-inside space-y-2 text-slate-700 dark:text-slate-300">
                    <li>Open your Firebase project console.</li>
                    <li>Navigate to <strong>Realtime Database</strong> &gt; <strong>Rules</strong> tab.</li>
                    <li>Replace the content of the editor with the following:</li>
                </ol>
                <pre className="bg-black text-white p-3 rounded-md text-sm mt-3 overflow-x-auto">
                    <code>
{`{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid"
      }
    }
  }
}`}
                    </code>
                </pre>
                 <p className="mt-4 text-sm text-slate-500">
                    After applying these rules, please <strong>refresh this page</strong>.
                </p>
                 <p className="mt-2 text-xs text-slate-500">
                    (This information is also available in the <code className="bg-slate-200 dark:bg-slate-700 p-1 rounded">firebase.ts</code> file.)
                </p>
            </div>
            <button
                onClick={handleLogout}
                className="mt-4 px-6 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow hover:bg-slate-700 transition-colors"
            >
                Logout
            </button>
        </Card>
    </div>
  );

  const handleProfileChange = (profile: CompanyProfile) => {
    if (!currentUser) return;
    // Fix: Use v8 compat API for set
    database.ref(`users/${currentUser.uid}/companyProfile`).set(profile);
    setCompanyProfile(profile);
  };

  const handleAddProduct = (productData: Omit<Product, 'id' | 'batches'>, firstBatchData: Omit<Batch, 'id'>) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const updates: { [key: string]: any } = {};

    // Ensure company exists
    const companyName = productData.company.trim();
    if (companyName && !companies.some(c => c.name.toLowerCase() === companyName.toLowerCase())) {
        const newCompanyRef = database.ref(`users/${uid}/companies`).push();
        updates[`/users/${uid}/companies/${newCompanyRef.key}`] = {
            id: `comp_${Date.now()}`,
            name: companyName
        };
    }

    const newProductRef = database.ref(`users/${uid}/products`).push();
    const newBatchRef = database.ref(`users/${uid}/products/${newProductRef.key}/batches`).push();
    
    updates[`/users/${uid}/products/${newProductRef.key}`] = {
        ...productData,
        id: `prod_${Date.now()}`,
        batches: {
            [newBatchRef.key!]: { ...firstBatchData, id: `batch_${Date.now()}` }
        }
    };
    
    database.ref().update(updates);
  };

  const handleAddBatch = (productId: string, batchData: Omit<Batch, 'id'>) => {
    if (!currentUser) return;
    const product = products.find(p => p.id === productId);
    if (!product || !product.key) return;
    
    // Fix: Use v8 compat API for push and set
    const batchesRef = database.ref(`users/${currentUser.uid}/products/${product.key}/batches`);
    const newBatchRef = batchesRef.push();
    newBatchRef.set({ ...batchData, id: `batch_${Date.now()}` });
  };
  
  const handleGenerateBill = async (billData: Omit<Bill, 'id' | 'billNumber'>): Promise<Bill | null> => {
    if (!currentUser) return null;
    const uid = currentUser.uid;
    // Fix: Use v8 compat API for push
    const billListRef = database.ref(`users/${uid}/bills`);
    const newBillRef = billListRef.push();
    
    const newBillNumber = `B${(bills.length + 1).toString().padStart(4, '0')}`;
    const newBill: Bill = { ...billData, id: `bill_${newBillRef.key}`, billNumber: newBillNumber };
    
    const updates: { [key: string]: any } = {};
    updates[`/users/${uid}/bills/${newBillRef.key}`] = newBill;

    billData.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const batch = product?.batches.find(b => b.id === item.batchId);
        if (product && batch) {
            updates[`/users/${uid}/products/${item.productKey}/batches/${item.batchKey}/stock`] = batch.stock - item.quantity;
        }
    });

    try {
        // Fix: Use v8 compat API for update
        await database.ref().update(updates);
        return newBill;
    } catch (error) {
        console.error("Failed to generate bill: ", error);
        return null;
    }
  };

  const handleAddSupplier = async (supplierData: Omit<Supplier, 'id'>): Promise<Supplier | null> => {
    if (!currentUser) return null;
    const uid = currentUser.uid;
    const newSupplierRef = database.ref(`users/${uid}/suppliers`).push();
    const newSupplier: Supplier = {
        ...supplierData,
        id: `supp_${Date.now()}`,
        key: newSupplierRef.key!
    };
    await newSupplierRef.set(newSupplier);
    return newSupplier;
  };

  const handlePurchaseEntry = async (purchaseData: Omit<Purchase, 'id' | 'totalAmount' | 'items'> & { items: PurchaseLineItem[] }) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const updates: { [key: string]: any } = {};
    const uniqueIdSuffix = () => `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Collect and create new companies if necessary
    const newCompanies = new Set<string>();
    purchaseData.items.forEach(item => {
        if (item.isNewProduct) {
            const companyName = item.company.trim();
            if (companyName && !companies.some(c => c.name.toLowerCase() === companyName.toLowerCase())) {
                newCompanies.add(companyName);
            }
        }
    });

    for (const companyName of newCompanies) {
        const newCompanyRef = database.ref(`users/${uid}/companies`).push();
        updates[`/users/${uid}/companies/${newCompanyRef.key}`] = {
            id: `comp_${uniqueIdSuffix()}`,
            name: companyName,
        };
    }

    purchaseData.items.forEach(item => {
        const newBatchData = {
            id: `batch_${uniqueIdSuffix()}`, batchNumber: item.batchNumber, expiryDate: item.expiryDate,
            stock: item.quantity, mrp: item.mrp, purchasePrice: item.purchasePrice,
        };
        if (item.isNewProduct) {
            // Fix: Use v8 compat API for push
            const newProductRef = database.ref(`users/${uid}/products`).push();
            const newBatchRef = database.ref(`users/${uid}/products/${newProductRef.key}/batches`).push();
            updates[`/users/${uid}/products/${newProductRef.key}`] = {
                id: `prod_${uniqueIdSuffix()}`, name: item.productName, company: item.company,
                hsnCode: item.hsnCode, gst: item.gst,
                batches: { [newBatchRef.key!]: newBatchData }
            };
        } else if (item.productKey) {
            const newBatchRef = database.ref(`users/${uid}/products/${item.productKey}/batches`).push();
            updates[`/users/${uid}/products/${item.productKey}/batches/${newBatchRef.key}`] = newBatchData;
        }
    });
    
    const totalAmount = purchaseData.items.reduce((total, item) => total + (item.purchasePrice * item.quantity), 0);
    const newPurchaseRef = database.ref(`users/${uid}/purchases`).push();
    updates[`/users/${uid}/purchases/${newPurchaseRef.key}`] = { ...purchaseData, id: `purch_${newPurchaseRef.key}`, totalAmount };
    // Fix: Use v8 compat API for update
    await database.ref().update(updates);
  };

  const handleAddPayment = async (paymentData: Omit<Payment, 'id' | 'key' | 'voucherNumber'>): Promise<Payment | null> => {
    if (!currentUser) return null;
    const uid = currentUser.uid;
    const paymentsRef = database.ref(`users/${uid}/payments`);
    const newPaymentRef = paymentsRef.push();
    
    // Generate voucher number
    const snapshot = await paymentsRef.get();
    const count = snapshot.exists() ? snapshot.numChildren() : 0;
    const voucherPrefix = 'PV-';
    const newVoucherNumber = `${voucherPrefix}${(count + 1).toString().padStart(4, '0')}`;
    
    const newPayment: Payment = {
      ...paymentData,
      id: `pay_${newPaymentRef.key}`,
      key: newPaymentRef.key!,
      voucherNumber: newVoucherNumber,
    };
    
    await newPaymentRef.set(newPayment);
    return newPayment;
  };

  const handleUpdatePayment = async (paymentKey: string, paymentData: Omit<Payment, 'id' | 'key'>) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const paymentRef = database.ref(`users/${uid}/payments/${paymentKey}`);
    await paymentRef.update(paymentData);
  };

  const handleDeletePayment = async (paymentKey: string) => {
    if (!currentUser) return;
    if (window.confirm('Are you sure you want to delete this payment record? This action cannot be undone.')) {
      const uid = currentUser.uid;
      const paymentRef = database.ref(`users/${uid}/payments/${paymentKey}`);
      await paymentRef.remove();
    }
  };

  const renderView = () => {
    if (authLoading || (currentUser && dataLoading)) {
      return <div className="flex-grow flex justify-center items-center h-full text-xl text-slate-600 dark:text-slate-400">Loading...</div>;
    }
    if (!currentUser) {
        return <Auth />;
    }
    if (permissionError) {
        return <PermissionErrorComponent />;
    }
    switch (activeView) {
      case 'billing': return <Billing products={products} onGenerateBill={handleGenerateBill} companyProfile={companyProfile}/>;
      case 'purchases': return <Purchases products={products} purchases={purchases} onAddPurchase={handlePurchaseEntry} companies={companies} suppliers={suppliers} onAddSupplier={handleAddSupplier} />;
      case 'paymentEntry': return <PaymentEntry suppliers={suppliers} payments={payments} onAddPayment={handleAddPayment} onUpdatePayment={handleUpdatePayment} onDeletePayment={handleDeletePayment} companyProfile={companyProfile} />;
      case 'inventory': return <Inventory products={products} onAddProduct={handleAddProduct} onAddBatch={handleAddBatch} companies={companies} />;
      case 'daybook': return <DayBook bills={bills} />;
      case 'suppliersLedger': return <SuppliersLedger suppliers={suppliers} purchases={purchases} payments={payments} companyProfile={companyProfile} />;
      case 'salesReport': return <SalesReport bills={bills} />;
      case 'companyWiseSale': return <CompanyWiseSale bills={bills} products={products} />;
      default: return <Billing products={products} onGenerateBill={handleGenerateBill} companyProfile={companyProfile} />;
    }
  };

  return (
    <div className={`flex flex-col min-h-screen bg-slate-100 dark:bg-slate-900`}>
      {currentUser && (
        <Header 
          user={currentUser}
          onLogout={handleLogout}
          activeView={activeView} 
          setActiveView={setActiveView} 
          onOpenSettings={() => setSettingsModalOpen(true)} 
        />
      )}
      <main className="flex-grow flex flex-col">
        {renderView()}
      </main>
      {currentUser && (
        <footer className="bg-white dark:bg-slate-800 text-center p-4 text-sm text-slate-600 dark:text-slate-400 border-t dark:border-slate-700">
          Developed by: M. Soft India | Contact: 9890072651 | Visit: <a href="http://webs.msoftindia.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">webs.msoftindia.com</a>
        </footer>
      )}
      {currentUser && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          theme={theme}
          onThemeChange={setTheme}
          companyProfile={companyProfile}
          onProfileChange={handleProfileChange}
        />
      )}
    </div>
  );
};

export default App;
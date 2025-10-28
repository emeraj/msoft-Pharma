import React, { useState, useEffect } from 'react';
import type { AppView, Product, Batch, Bill, Purchase, PurchaseLineItem, Theme, CompanyProfile } from './types';
import Header from './components/Header';
import Billing from './components/Billing';
import Inventory from './components/Inventory';
import DayBook from './components/DayBook';
import Purchases from './components/Purchases';
import SettingsModal from './components/SettingsModal';
import Auth from './components/Auth';
import { database, auth } from './firebase';
// Fix: Import firebase compat for types and v8 API
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';


const App: React.FC = () => {
  // Fix: Use firebase.User type from compat import
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeView, setActiveView] = useState<AppView>('billing');
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  
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
      setCompanyProfile({ name: 'Pharma - Retail', address: '123 Health St, Wellness City', gstin: 'ABCDE12345FGHIJ' });
      setDataLoading(true); // Reset loading state for next login
      return;
    }

    setDataLoading(true);
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
    const profileRef = database.ref(`users/${uid}/companyProfile`);

    productsRef.on('value', (snapshot) => parseProductsSnapshot(snapshot, setProducts));
    billsRef.on('value', (snapshot) => parseGenericListSnapshot(snapshot, setBills));
    purchasesRef.on('value', (snapshot) => parseGenericListSnapshot(snapshot, setPurchases));
    profileRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) setCompanyProfile(data);
    });

    Promise.all([productsRef.get(), billsRef.get(), purchasesRef.get(), profileRef.get()])
      .then(() => setDataLoading(false))
      .catch(error => {
        console.error("Error fetching initial data:", error);
        alert("Could not connect to the database. Please check your connection and Firebase security rules.");
        setDataLoading(false);
      });

    return () => {
      // Detach listeners
      productsRef.off();
      billsRef.off();
      purchasesRef.off();
      profileRef.off();
    };
  }, [currentUser]);


  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  
  const handleLogout = () => {
    // Fix: Use v8 compat API for signOut
    auth.signOut();
  };

  const handleProfileChange = (profile: CompanyProfile) => {
    if (!currentUser) return;
    // Fix: Use v8 compat API for set
    database.ref(`users/${currentUser.uid}/companyProfile`).set(profile);
    setCompanyProfile(profile);
  };

  const handleAddProduct = (productData: Omit<Product, 'id' | 'batches'>, firstBatchData: Omit<Batch, 'id'>) => {
    if (!currentUser) return;
    // Fix: Use v8 compat API for push and set
    const productListRef = database.ref(`users/${currentUser.uid}/products`);
    const newProductRef = productListRef.push();
    const newBatchRef = database.ref(`users/${currentUser.uid}/products/${newProductRef.key}/batches`).push();
    
    newProductRef.set({
        ...productData,
        id: `prod_${Date.now()}`,
        batches: {
            [newBatchRef.key!]: { ...firstBatchData, id: `batch_${Date.now()}` }
        }
    });
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

  const handlePurchaseEntry = async (purchaseData: Omit<Purchase, 'id' | 'totalAmount' | 'items'> & { items: PurchaseLineItem[] }) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const updates: { [key: string]: any } = {};
    const uniqueIdSuffix = () => `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
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

  const renderView = () => {
    if (authLoading || (currentUser && dataLoading)) {
      return <div className="flex justify-center items-center h-full text-xl text-slate-600 dark:text-slate-400">Loading...</div>;
    }
    if (!currentUser) {
        return <Auth />;
    }
    switch (activeView) {
      case 'billing': return <Billing products={products} onGenerateBill={handleGenerateBill} companyProfile={companyProfile}/>;
      case 'purchases': return <Purchases products={products} purchases={purchases} onAddPurchase={handlePurchaseEntry} />;
      case 'inventory': return <Inventory products={products} onAddProduct={handleAddProduct} onAddBatch={handleAddBatch} />;
      case 'daybook': return <DayBook bills={bills} />;
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

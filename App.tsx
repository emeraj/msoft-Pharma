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
import { ref, onValue, set, push, update, get, off } from "firebase/database";
import { onAuthStateChanged, signOut, User } from "firebase/auth";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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
    const unsubscribe = onAuthStateChanged(auth, user => {
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

    const onDataFetch = (snapshot: any, setter: Function) => {
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

    const productsRef = ref(database, `users/${uid}/products`);
    const billsRef = ref(database, `users/${uid}/bills`);
    const purchasesRef = ref(database, `users/${uid}/purchases`);
    const profileRef = ref(database, `users/${uid}/companyProfile`);

    const unsubscribeProducts = onValue(productsRef, (snapshot) => onDataFetch(snapshot, setProducts));
    const unsubscribeBills = onValue(billsRef, (snapshot) => onDataFetch(snapshot, setBills));
    const unsubscribePurchases = onValue(purchasesRef, (snapshot) => onDataFetch(snapshot, setPurchases));
    const unsubscribeProfile = onValue(profileRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setCompanyProfile(data);
    });

    Promise.all([get(productsRef), get(billsRef), get(purchasesRef), get(profileRef)])
      .then(() => setDataLoading(false))
      .catch(error => {
        console.error("Error fetching initial data:", error);
        alert("Could not connect to the database. Please check your connection and Firebase security rules.");
        setDataLoading(false);
      });

    return () => {
      // Detach listeners
      off(productsRef);
      off(billsRef);
      off(purchasesRef);
      off(profileRef);
    };
  }, [currentUser]);


  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  
  const handleLogout = () => {
    signOut(auth);
  };

  const handleProfileChange = (profile: CompanyProfile) => {
    if (!currentUser) return;
    set(ref(database, `users/${currentUser.uid}/companyProfile`), profile);
    setCompanyProfile(profile);
  };

  const handleAddProduct = (productData: Omit<Product, 'id' | 'batches'>, firstBatchData: Omit<Batch, 'id'>) => {
    if (!currentUser) return;
    const productListRef = ref(database, `users/${currentUser.uid}/products`);
    const newProductRef = push(productListRef);
    const newBatchRef = push(ref(database, `users/${currentUser.uid}/products/${newProductRef.key}/batches`));
    
    set(newProductRef, {
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
    
    const batchesRef = ref(database, `users/${currentUser.uid}/products/${product.key}/batches`);
    const newBatchRef = push(batchesRef);
    set(newBatchRef, { ...batchData, id: `batch_${Date.now()}` });
  };
  
  const handleGenerateBill = async (billData: Omit<Bill, 'id' | 'billNumber'>): Promise<Bill | null> => {
    if (!currentUser) return null;
    const uid = currentUser.uid;
    const billListRef = ref(database, `users/${uid}/bills`);
    const newBillRef = push(billListRef);
    
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
        await update(ref(database), updates);
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
            const newProductRef = push(ref(database, `users/${uid}/products`));
            const newBatchRef = push(ref(database, `users/${uid}/products/${newProductRef.key}/batches`));
            updates[`/users/${uid}/products/${newProductRef.key}`] = {
                id: `prod_${uniqueIdSuffix()}`, name: item.productName, company: item.company,
                hsnCode: item.hsnCode, gst: item.gst,
                batches: { [newBatchRef.key!]: newBatchData }
            };
        } else if (item.productKey) {
            const newBatchRef = push(ref(database, `users/${uid}/products/${item.productKey}/batches`));
            updates[`/users/${uid}/products/${item.productKey}/batches/${newBatchRef.key}`] = newBatchData;
        }
    });
    
    const totalAmount = purchaseData.items.reduce((total, item) => total + (item.purchasePrice * item.quantity), 0);
    const newPurchaseRef = push(ref(database, `users/${uid}/purchases`));
    updates[`/users/${uid}/purchases/${newPurchaseRef.key}`] = { ...purchaseData, id: `purch_${newPurchaseRef.key}`, totalAmount };
    await update(ref(database), updates);
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
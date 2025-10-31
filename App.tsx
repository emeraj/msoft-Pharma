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
import { db, auth } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  arrayUnion,
  Unsubscribe
} from 'firebase/firestore';
import SuppliersLedger from './components/SuppliersLedger';
import SalesReport from './components/SalesReport';
import CompanyWiseSale from './components/CompanyWiseSale';
import PaymentEntry from './components/PaymentEntry';


const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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

    const createListener = (collectionName: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
      const collRef = collection(db, `users/${uid}/${collectionName}`);
      return onSnapshot(collRef, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setter(list);
      }, (error) => {
        console.error(`Error fetching ${collectionName}:`, error);
        if (error.code === 'permission-denied') {
          setPermissionError("Permission Denied: Could not fetch your data from the database. This is likely due to incorrect Firestore security rules.");
          setDataLoading(false);
        }
      });
    };
    
    const unsubscribers: Unsubscribe[] = [
        createListener('products', setProducts),
        createListener('bills', setBills),
        createListener('purchases', setPurchases),
        createListener('companies', setCompanies),
        createListener('suppliers', setSuppliers),
        createListener('payments', setPayments),
    ];

    const profileRef = doc(db, `users/${uid}/companyProfile`, 'profile');
    const unsubProfile = onSnapshot(profileRef, (doc) => {
        if (doc.exists()) {
            setCompanyProfile(doc.data() as CompanyProfile);
        }
    });
    unsubscribers.push(unsubProfile);

    // Check for initial data load / permission
    getDocs(collection(db, `users/${uid}/products`))
      .then(() => setDataLoading(false))
      .catch((error: any) => {
        if (error.code === 'permission-denied') {
          setPermissionError("Permission Denied: Could not fetch your data from the database. This is likely due to incorrect Firestore security rules.");
        } else {
           setPermissionError(`Could not connect to the database. Error: ${error.message}`);
        }
        setDataLoading(false);
      });

    return () => {
      unsubscribers.forEach(unsub => unsub());
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
    signOut(auth);
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
                    <li>Navigate to <strong>Firestore Database</strong> &gt; <strong>Rules</strong> tab.</li>
                    <li>Replace the content of the editor with the following:</li>
                </ol>
                <pre className="bg-black text-white p-3 rounded-md text-sm mt-3 overflow-x-auto">
                    <code>
{`service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
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
    const profileRef = doc(db, `users/${currentUser.uid}/companyProfile`, 'profile');
    setDoc(profileRef, profile);
    setCompanyProfile(profile);
  };

  const handleAddProduct = async (productData: Omit<Product, 'id' | 'batches'>, firstBatchData: Omit<Batch, 'id'>) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const batch = writeBatch(db);

    // Ensure company exists
    const companyName = productData.company.trim();
    const companyExists = companies.some(c => c.name.toLowerCase() === companyName.toLowerCase());
    
    if (companyName && !companyExists) {
        const newCompanyRef = doc(collection(db, `users/${uid}/companies`));
        batch.set(newCompanyRef, { name: companyName });
    }

    const newProductRef = doc(collection(db, `users/${uid}/products`));
    const newProductData = {
        ...productData,
        batches: [{ ...firstBatchData, id: `batch_${Date.now()}` }]
    };
    batch.set(newProductRef, newProductData);
    
    await batch.commit();
  };

  const handleAddBatch = async (productId: string, batchData: Omit<Batch, 'id'>) => {
    if (!currentUser) return;
    const productRef = doc(db, `users/${currentUser.uid}/products`, productId);
    await updateDoc(productRef, {
        batches: arrayUnion({ ...batchData, id: `batch_${Date.now()}` })
    });
  };
  
  const handleGenerateBill = async (billData: Omit<Bill, 'id' | 'billNumber'>): Promise<Bill | null> => {
    if (!currentUser) return null;
    const uid = currentUser.uid;
    
    const billsCollectionRef = collection(db, `users/${uid}/bills`);
    const newBillNumber = `B${(bills.length + 1).toString().padStart(4, '0')}`;
    
    const batch = writeBatch(db);
    
    const newBillRef = doc(billsCollectionRef);
    const newBill: Omit<Bill, 'id'> = { ...billData, billNumber: newBillNumber };
    batch.set(newBillRef, newBill);

    for (const item of billData.items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
            const newBatches = product.batches.map(b => 
                b.id === item.batchId ? { ...b, stock: b.stock - item.quantity } : b
            );
            const productRef = doc(db, `users/${uid}/products`, product.id);
            batch.update(productRef, { batches: newBatches });
        }
    }

    try {
        await batch.commit();
        return { ...newBill, id: newBillRef.id };
    } catch (error) {
        console.error("Failed to generate bill: ", error);
        return null;
    }
  };

  const handleAddSupplier = async (supplierData: Omit<Supplier, 'id'>): Promise<Supplier | null> => {
    if (!currentUser) return null;
    const uid = currentUser.uid;
    const suppliersCollectionRef = collection(db, `users/${uid}/suppliers`);
    const docRef = await addDoc(suppliersCollectionRef, supplierData);
    return { ...supplierData, id: docRef.id };
  };

  const handleUpdateSupplier = async (supplierId: string, supplierData: Omit<Supplier, 'id'>) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const supplierRef = doc(db, `users/${uid}/suppliers`, supplierId);
    try {
        await updateDoc(supplierRef, supplierData);
        alert('Supplier updated successfully.');
    } catch (error) {
        console.error("Error updating supplier:", error);
        alert('Failed to update supplier.');
    }
  };

  const handleAddPurchase = async (purchaseData: Omit<Purchase, 'id' | 'totalAmount' | 'items'> & { items: PurchaseLineItem[] }) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const batch = writeBatch(db);
    const uniqueIdSuffix = () => `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
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
        const newCompanyRef = doc(collection(db, `users/${uid}/companies`));
        batch.set(newCompanyRef, { name: companyName });
    }

    const itemsWithProductIds: PurchaseLineItem[] = [];

    for (const item of purchaseData.items) {
        const batchId = `batch_${uniqueIdSuffix()}`;
        const newBatchData = {
            id: batchId, batchNumber: item.batchNumber, expiryDate: item.expiryDate,
            stock: item.quantity, mrp: item.mrp, purchasePrice: item.purchasePrice,
        };
        const finalItem = {...item, batchId};

        if (item.isNewProduct) {
            const newProductRef = doc(collection(db, `users/${uid}/products`));
            batch.set(newProductRef, {
                name: item.productName, company: item.company, hsnCode: item.hsnCode, gst: item.gst,
                batches: [newBatchData]
            });
            finalItem.productId = newProductRef.id;
            finalItem.isNewProduct = false; // Mark as not new for future edits
        } else if (item.productId) {
            const productRef = doc(db, `users/${uid}/products`, item.productId);
            batch.update(productRef, { batches: arrayUnion(newBatchData) });
        }
        itemsWithProductIds.push(finalItem);
    }
    
    const totalAmount = purchaseData.items.reduce((total, item) => total + (item.purchasePrice * item.quantity), 0);
    const newPurchaseRef = doc(collection(db, `users/${uid}/purchases`));
    batch.set(newPurchaseRef, { ...purchaseData, totalAmount, items: itemsWithProductIds });
    await batch.commit();
  };

  const handleUpdatePurchase = async (
    purchaseId: string,
    updatedPurchaseData: Omit<Purchase, 'id'>,
    originalPurchase: Purchase
  ) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const batch = writeBatch(db);
    const uniqueIdSuffix = () => `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Revert stock changes from original purchase by grouping items by product
    const originalItemsByProduct = originalPurchase.items.reduce((acc, item) => {
        if (item.productId) {
            acc[item.productId] = (acc[item.productId] || []).concat(item);
        }
        return acc;
    }, {} as Record<string, PurchaseLineItem[]>);

    for (const productId in originalItemsByProduct) {
        const product = products.find(p => p.id === productId);
        if (!product) {
            console.warn(`Product with ID ${productId} not found while reverting purchase.`);
            continue;
        }

        let newBatches = [...product.batches];
        for(const item of originalItemsByProduct[productId]) {
            if (item.batchId) {
                newBatches = newBatches.filter(b => b.id !== item.batchId);
            } else {
                console.warn("Reverting old purchase item without batchId. Using property matching.", item);
                const batchIndex = newBatches.findIndex(b => 
                    b.batchNumber === item.batchNumber && 
                    b.mrp === item.mrp && 
                    b.purchasePrice === item.purchasePrice);

                if (batchIndex > -1) {
                    newBatches.splice(batchIndex, 1);
                }
            }
        }
        const productRef = doc(db, `users/${uid}/products`, product.id);
        batch.update(productRef, { batches: newBatches });
    }

    const updatedItemsWithProductIds: PurchaseLineItem[] = [];

    // Apply stock changes for the updated purchase
    for (const item of updatedPurchaseData.items) {
        const newBatchId = `batch_${uniqueIdSuffix()}`;
        const newBatchData = {
            id: newBatchId, batchNumber: item.batchNumber, expiryDate: item.expiryDate,
            stock: item.quantity, mrp: item.mrp, purchasePrice: item.purchasePrice,
        };
        const finalItem = {...item, batchId: newBatchId};

        if (item.isNewProduct) {
             const newProductRef = doc(collection(db, `users/${uid}/products`));
             batch.set(newProductRef, {
                 name: item.productName, company: item.company, hsnCode: item.hsnCode, gst: item.gst,
                 batches: [newBatchData]
             });
             finalItem.productId = newProductRef.id;
             finalItem.isNewProduct = false; // Mark as not new for future edits
        } else if (item.productId) {
            const productRef = doc(db, `users/${uid}/products`, item.productId);
            batch.update(productRef, { batches: arrayUnion(newBatchData) });
        }
        updatedItemsWithProductIds.push(finalItem);
    }
    
    const purchaseRef = doc(db, `users/${uid}/purchases`, purchaseId);
    batch.update(purchaseRef, {...updatedPurchaseData, items: updatedItemsWithProductIds});
    
    try {
      await batch.commit();
      alert("Purchase updated successfully and stock adjusted.");
    } catch(error) {
      console.error("Error updating purchase:", error);
      alert("Failed to update purchase. Check console for details.");
    }
  };

  const handleDeletePurchase = async (purchase: Purchase) => {
    if (!currentUser || !purchase.id) return;
    if (!window.confirm(`Are you sure you want to delete Invoice #${purchase.invoiceNumber}? This will also remove the associated stock from your inventory.`)) return;

    const uid = currentUser.uid;
    const batch = writeBatch(db);

    // Group items by product to correctly revert stock
    const itemsByProduct = purchase.items.reduce((acc, item) => {
        if (item.productId) {
            acc[item.productId] = (acc[item.productId] || []).concat(item);
        }
        return acc;
    }, {} as Record<string, PurchaseLineItem[]>);

    for (const productId in itemsByProduct) {
        const product = products.find(p => p.id === productId);
        if (!product) {
            console.warn(`Product with ID ${productId} not found while deleting purchase.`);
            continue;
        }

        let newBatches = [...product.batches];
        for (const item of itemsByProduct[productId]) {
            if (item.batchId) {
                newBatches = newBatches.filter(b => b.id !== item.batchId);
            } else {
                console.warn("Deleting old purchase item without batchId. Using property matching.", item);
                const batchIndex = newBatches.findIndex(b => 
                    b.batchNumber === item.batchNumber && 
                    b.mrp === item.mrp && 
                    b.purchasePrice === item.purchasePrice);
                
                if (batchIndex > -1) {
                    newBatches.splice(batchIndex, 1);
                }
            }
        }
        
        const productRef = doc(db, `users/${uid}/products`, product.id);
        batch.update(productRef, { batches: newBatches });
    }
    
    const purchaseRef = doc(db, `users/${uid}/purchases`, purchase.id);
    batch.delete(purchaseRef);

    try {
      await batch.commit();
      alert("Purchase deleted successfully and stock adjusted.");
    } catch(error) {
      console.error("Error deleting purchase:", error);
      alert("Failed to delete purchase. Check console for details.");
    }
  };

  const handleAddPayment = async (paymentData: Omit<Payment, 'id' | 'voucherNumber'>): Promise<Payment | null> => {
    if (!currentUser) return null;
    const uid = currentUser.uid;
    const paymentsCollectionRef = collection(db, `users/${uid}/payments`);
    
    const count = payments.length;
    const voucherPrefix = 'PV-';
    const newVoucherNumber = `${voucherPrefix}${(count + 1).toString().padStart(4, '0')}`;
    
    const newPaymentData = { ...paymentData, voucherNumber: newVoucherNumber };
    const docRef = await addDoc(paymentsCollectionRef, newPaymentData);
    return { ...newPaymentData, id: docRef.id };
  };

  const handleUpdatePayment = async (paymentId: string, paymentData: Omit<Payment, 'id'>) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const paymentRef = doc(db, `users/${uid}/payments`, paymentId);
    try {
        await updateDoc(paymentRef, paymentData);
    } catch(err) {
        console.error("Failed to update payment", err);
        alert("Error: Could not update the payment record.");
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!currentUser || !paymentId) return;
    if (window.confirm('Are you sure you want to delete this payment record? This action cannot be undone.')) {
        try {
            const uid = currentUser.uid;
            const paymentRef = doc(db, `users/${uid}/payments`, paymentId);
            await deleteDoc(paymentRef);
        } catch(err) {
            console.error("Failed to delete payment", err);
            alert("Error: Could not delete the payment record.");
        }
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
      case 'purchases': return <Purchases products={products} purchases={purchases} onAddPurchase={handleAddPurchase} onUpdatePurchase={handleUpdatePurchase} onDeletePurchase={handleDeletePurchase} companies={companies} suppliers={suppliers} onAddSupplier={handleAddSupplier} />;
      case 'paymentEntry': return <PaymentEntry suppliers={suppliers} payments={payments} onAddPayment={handleAddPayment} onUpdatePayment={handleUpdatePayment} onDeletePayment={handleDeletePayment} companyProfile={companyProfile} />;
      case 'inventory': return <Inventory products={products} onAddProduct={handleAddProduct} onAddBatch={handleAddBatch} companies={companies} />;
      case 'daybook': return <DayBook bills={bills} />;
      case 'suppliersLedger': return <SuppliersLedger suppliers={suppliers} purchases={purchases} payments={payments} companyProfile={companyProfile} onUpdateSupplier={handleUpdateSupplier} />;
      case 'salesReport': return <SalesReport bills={bills} />;
      case 'companyWiseSale': return <CompanyWiseSale bills={bills} products={products} />;
      default: return <Billing products={products} onGenerateBill={handleGenerateBill} companyProfile={companyProfile}/>;
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
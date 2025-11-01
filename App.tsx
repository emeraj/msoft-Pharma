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
import SalesDashboard from './components/SalesDashboard';


const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeView, setActiveView] = useState<AppView>('dashboard');
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
  
  const handleDeleteBatch = async (productId: string, batchId: string) => {
    if (!currentUser) return;

    // 1. Check if batch is used in any bills
    const isInBill = bills.some(bill => 
      bill.items.some(item => item.batchId === batchId)
    );

    if (isInBill) {
      alert('Cannot delete batch: This batch is part of a sales record.');
      return;
    }

    // 2. Check if batch is part of any purchase record
    const isInPurchase = purchases.some(purchase => 
      purchase.items.some(item => item.batchId === batchId)
    );

    if (isInPurchase) {
      alert('Cannot delete batch: This batch is linked to a purchase entry. Please edit or delete the corresponding purchase to remove this batch.');
      return;
    }
    
    // 3. Find the product and update its batches array
    const productToUpdate = products.find(p => p.id === productId);
    if (!productToUpdate) {
      alert('Error: Product not found.');
      return;
    }
    
    const updatedBatches = productToUpdate.batches.filter(b => b.id !== batchId);

    try {
      const productRef = doc(db, `users/${currentUser.uid}/products`, productId);
      await updateDoc(productRef, { batches: updatedBatches });
      alert('Batch deleted successfully.');
    } catch (error) {
      console.error("Error deleting batch:", error);
      alert('Failed to delete batch.');
    }
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
    const fbBatch = writeBatch(db);
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
        fbBatch.set(newCompanyRef, { name: companyName });
    }

    const itemsWithIds: PurchaseLineItem[] = [];

    for (const item of purchaseData.items) {
        let finalItem = { ...item };

        if (item.isNewProduct) {
            const newBatchId = `batch_${uniqueIdSuffix()}`;
            const newBatchData = {
                id: newBatchId, batchNumber: item.batchNumber, expiryDate: item.expiryDate,
                stock: item.quantity, mrp: item.mrp, purchasePrice: item.purchasePrice,
            };
            const newProductRef = doc(collection(db, `users/${uid}/products`));
            fbBatch.set(newProductRef, {
                name: item.productName, company: item.company, hsnCode: item.hsnCode, gst: item.gst,
                batches: [newBatchData]
            });
            finalItem.productId = newProductRef.id;
            finalItem.batchId = newBatchId;
            finalItem.isNewProduct = false;
        } else if (item.productId) {
            const product = products.find(p => p.id === item.productId);
            if (!product) {
                console.error("Product not found for purchase item", item);
                continue;
            }

            const existingBatch = product.batches.find(b => b.batchNumber === item.batchNumber);
            const productRef = doc(db, `users/${uid}/products`, item.productId);

            if (existingBatch) {
                // Batch found! Update stock and other details.
                const updatedBatches = product.batches.map(b => 
                    b.id === existingBatch.id 
                    ? { 
                        ...b, 
                        stock: b.stock + item.quantity,
                        mrp: item.mrp,
                        purchasePrice: item.purchasePrice,
                        expiryDate: item.expiryDate
                      } 
                    : b
                );
                fbBatch.update(productRef, { batches: updatedBatches });
                finalItem.batchId = existingBatch.id; // Link purchase to the existing batch
            } else {
                // Batch not found. Create a new one for this product.
                const newBatchId = `batch_${uniqueIdSuffix()}`;
                const newBatchData = {
                    id: newBatchId, batchNumber: item.batchNumber, expiryDate: item.expiryDate,
                    stock: item.quantity, mrp: item.mrp, purchasePrice: item.purchasePrice,
                };
                fbBatch.update(productRef, { batches: arrayUnion(newBatchData) });
                finalItem.batchId = newBatchId; // Link purchase to the new batch
            }
        }
        itemsWithIds.push(finalItem);
    }
    
    const totalAmount = purchaseData.items.reduce((total, item) => total + (item.purchasePrice * item.quantity), 0);
    const newPurchaseRef = doc(collection(db, `users/${uid}/purchases`));
    fbBatch.set(newPurchaseRef, { ...purchaseData, totalAmount, items: itemsWithIds });
    await fbBatch.commit();
  };

  const handleUpdatePurchase = async (
    purchaseId: string,
    updatedPurchaseData: Omit<Purchase, 'id'>,
    originalPurchase: Purchase
  ) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const fbBatch = writeBatch(db);
    const uniqueIdSuffix = () => `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Use a map to hold the next state of products being modified.
    const productsToUpdate = new Map<string, Product>();

    const getMutableProduct = (productId: string): Product | null => {
        if (productsToUpdate.has(productId)) {
            return productsToUpdate.get(productId)!;
        }
        const p = products.find(prod => prod.id === productId);
        if (p) {
            const pCopy = JSON.parse(JSON.stringify(p)); // Deep copy to avoid mutating state
            productsToUpdate.set(productId, pCopy);
            return pCopy;
        }
        return null;
    };

    // 1. REVERT STAGE: Simulate subtracting quantities from original purchase.
    for (const item of originalPurchase.items) {
        if (!item.productId || !item.batchId) continue;
        const product = getMutableProduct(item.productId);
        if (!product) continue;
        
        const batchIndex = product.batches.findIndex(b => b.id === item.batchId);
        if (batchIndex > -1) {
            product.batches[batchIndex].stock -= item.quantity;
        }
    }

    // 2. APPLY STAGE: Simulate adding/updating quantities from new purchase data.
    const updatedItemsWithIds: PurchaseLineItem[] = [];
    for (const item of updatedPurchaseData.items) {
        let finalItem = { ...item };
        
        if (item.isNewProduct) {
            const newBatchId = `batch_${uniqueIdSuffix()}`;
            const newProductRef = doc(collection(db, `users/${uid}/products`));
            fbBatch.set(newProductRef, {
                name: item.productName, company: item.company, hsnCode: item.hsnCode, gst: item.gst,
                batches: [{
                    id: newBatchId, batchNumber: item.batchNumber, expiryDate: item.expiryDate,
                    stock: item.quantity, mrp: item.mrp, purchasePrice: item.purchasePrice,
                }]
            });
            finalItem.productId = newProductRef.id;
            finalItem.batchId = newBatchId;
            finalItem.isNewProduct = false;
        } else if (item.productId) {
            const product = getMutableProduct(item.productId);
            if (!product) continue;

            const batchIndex = product.batches.findIndex(b => b.batchNumber === item.batchNumber);

            if (batchIndex > -1) { // Batch found, update it.
                product.batches[batchIndex].stock += item.quantity;
                product.batches[batchIndex].mrp = item.mrp;
                product.batches[batchIndex].purchasePrice = item.purchasePrice;
                product.batches[batchIndex].expiryDate = item.expiryDate;
                finalItem.batchId = product.batches[batchIndex].id;
            } else { // Batch not found, create it.
                const newBatchId = `batch_${uniqueIdSuffix()}`;
                product.batches.push({
                    id: newBatchId, batchNumber: item.batchNumber, expiryDate: item.expiryDate,
                    stock: item.quantity, mrp: item.mrp, purchasePrice: item.purchasePrice,
                });
                finalItem.batchId = newBatchId;
            }
        }
        updatedItemsWithIds.push(finalItem);
    }
    
    // 3. COMMIT STAGE: Write all calculated changes to the batch.
    for (const [productId, product] of productsToUpdate.entries()) {
        const productRef = doc(db, `users/${uid}/products`, productId);
        // Prevent negative stock, just in case.
        product.batches.forEach(b => { if (b.stock < 0) b.stock = 0; });
        fbBatch.update(productRef, { batches: product.batches });
    }
    
    const purchaseRef = doc(db, `users/${uid}/purchases`, purchaseId);
    fbBatch.update(purchaseRef, {...updatedPurchaseData, items: updatedItemsWithIds});
    
    try {
      await fbBatch.commit();
      alert("Purchase updated successfully and stock adjusted.");
    } catch(error) {
      console.error("Error updating purchase:", error);
      alert("Failed to update purchase. Check console for details.");
    }
  };

  const handleDeletePurchase = async (purchase: Purchase) => {
    if (!currentUser || !purchase.id) return;
    if (!window.confirm(`Are you sure you want to delete Invoice #${purchase.invoiceNumber}? This will subtract the purchased quantities from your inventory.`)) return;

    const uid = currentUser.uid;
    const fbBatch = writeBatch(db);

    for (const item of purchase.items) {
        if (!item.productId || !item.batchId) {
            console.warn("Cannot revert stock for purchase item without productId or batchId", item);
            continue;
        }

        const product = products.find(p => p.id === item.productId);
        if (!product) {
            console.warn(`Product with ID ${item.productId} not found while deleting purchase.`);
            continue;
        }

        // Find the batch and subtract the quantity
        const updatedBatches = product.batches.map(b => {
            if (b.id === item.batchId) {
                const newStock = b.stock - item.quantity;
                return { ...b, stock: newStock < 0 ? 0 : newStock }; // Prevent negative stock
            }
            return b;
        });

        const productRef = doc(db, `users/${uid}/products`, product.id);
        fbBatch.update(productRef, { batches: updatedBatches });
    }
    
    const purchaseRef = doc(db, `users/${uid}/purchases`, purchase.id);
    fbBatch.delete(purchaseRef);

    try {
      await fbBatch.commit();
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
      case 'dashboard': return <SalesDashboard bills={bills} products={products} />;
      case 'billing': return <Billing products={products} onGenerateBill={handleGenerateBill} companyProfile={companyProfile}/>;
      case 'purchases': return <Purchases products={products} purchases={purchases} onAddPurchase={handleAddPurchase} onUpdatePurchase={handleUpdatePurchase} onDeletePurchase={handleDeletePurchase} companies={companies} suppliers={suppliers} onAddSupplier={handleAddSupplier} />;
      case 'paymentEntry': return <PaymentEntry suppliers={suppliers} payments={payments} onAddPayment={handleAddPayment} onUpdatePayment={handleUpdatePayment} onDeletePayment={handleDeletePayment} companyProfile={companyProfile} />;
      case 'inventory': return <Inventory products={products} onAddProduct={handleAddProduct} onAddBatch={handleAddBatch} onDeleteBatch={handleDeleteBatch} companies={companies} purchases={purchases} bills={bills} />;
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
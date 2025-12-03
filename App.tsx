
import React, { useState, useEffect } from 'react';
import type { AppView, Product, Batch, Bill, Purchase, PurchaseLineItem, CompanyProfile, Company, Supplier, Payment, CartItem, SystemConfig, GstRate, UserPermissions, SubUser } from './types';
import Header from './components/Header';
import Billing from './components/Billing';
import Inventory from './components/Inventory';
import DayBook from './components/DayBook';
import Purchases from './components/Purchases';
import SettingsModal from './components/SettingsModal';
import Auth from './components/Auth';
import Card from './components/common/Card';
import { db, auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
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
  getDoc
} from 'firebase/firestore';
import type { Unsubscribe, QuerySnapshot, DocumentData } from 'firebase/firestore';
import SuppliersLedger from './components/SuppliersLedger';
import SalesReport from './components/SalesReport';
import CompanyWiseSale from './components/CompanyWiseSale';
import PaymentEntry from './components/PaymentEntry';
import SalesDashboard from './components/SalesDashboard';
import CompanyWiseBillWiseProfit from './components/CompanyWiseBillWiseProfit';
import GstMaster from './components/GstMaster';

const initialCompanyProfile: CompanyProfile = {
  name: 'Medico - Retail',
  address: '123 Cloud Ave, Tech City',
  phone: '',
  email: '',
  gstin: 'ABCDE12345FGHIJ',
  upiId: ''
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Multi-User State
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | undefined>(undefined);
  const [isOperator, setIsOperator] = useState(false);

  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [gstRates, setGstRates] = useState<GstRate[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(initialCompanyProfile);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    softwareMode: 'Pharma',
    invoicePrintingFormat: 'A5',
    remarkLine1: 'Thank you for your visit!',
    remarkLine2: 'Get Well Soon.',
    language: 'en',
    mrpEditable: true,
    barcodeScannerOpenByDefault: true,
  });
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      // Reset state on logout/login
      if (!user) {
          setDataOwnerId(null);
          setIsOperator(false);
          setUserPermissions(undefined);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    document.title = 'Cloud - Retail';
  }, []);

  // Handle Browser Back Button Navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) {
        setActiveView(event.state.view);
        if (event.state.view !== 'billing') {
            setEditingBill(null);
        }
      } 
    };

    window.addEventListener('popstate', handlePopState);
    if (!window.history.state) {
        window.history.replaceState({ view: 'dashboard' }, '', '');
    }
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (view: AppView) => {
    if (view === activeView) return;
    setActiveView(view);
    window.history.pushState({ view }, '', '');
  };

  // --- Logic to Determine Data Owner and Permissions ---
  useEffect(() => {
      const resolveUserRole = async () => {
          if (!currentUser) return;
          
          try {
              // Check global user mapping to see if this is a sub-user
              const mappingDoc = await getDoc(doc(db, 'userMappings', currentUser.uid));
              
              if (mappingDoc.exists()) {
                  // It is an Operator
                  const data = mappingDoc.data();
                  const ownerId = data.ownerId;
                  
                  // Fetch specific permissions from the parent's subUser collection
                  const subUserDoc = await getDoc(doc(db, `users/${ownerId}/subUsers`, currentUser.uid));
                  
                  if (subUserDoc.exists()) {
                      const subUserData = subUserDoc.data() as SubUser;
                      setDataOwnerId(ownerId);
                      setIsOperator(true);
                      setUserPermissions(subUserData.permissions);
                      
                      // If current view is not allowed, redirect
                      if (activeView === 'dashboard' && !subUserData.permissions.canReports) navigateTo('billing');
                  } else {
                      // Orphaned mapping? Treat as normal user or error
                      setDataOwnerId(currentUser.uid);
                      setIsOperator(false);
                  }
              } else {
                  // It is an Admin (Main User)
                  setDataOwnerId(currentUser.uid);
                  setIsOperator(false);
                  setUserPermissions(undefined); // Admin has implied full permissions
              }
          } catch (e) {
              console.error("Error resolving user role:", e);
              // Fallback to own data to prevent lockouts if offline/error, though permissions might fail if rules enforce it
              setDataOwnerId(currentUser.uid);
          }
      };

      if (currentUser) {
          resolveUserRole();
      }
  }, [currentUser]);


  // --- Data Fetching ---
  useEffect(() => {
    if (!currentUser || !dataOwnerId) {
      setProducts([]);
      setBills([]);
      setPurchases([]);
      setCompanies([]);
      setSuppliers([]);
      setPayments([]);
      setGstRates([]);
      setCompanyProfile(initialCompanyProfile);
      setSystemConfig({
        softwareMode: 'Pharma',
        invoicePrintingFormat: 'A5',
        remarkLine1: 'Thank you for your visit!',
        remarkLine2: 'Get Well Soon.',
        language: 'en',
        mrpEditable: true,
        barcodeScannerOpenByDefault: true,
      });
      setDataLoading(!!currentUser); // Keep loading if user exists but owner not resolved
      setPermissionError(null);
      return;
    }

    setDataLoading(true);
    setPermissionError(null);
    
    // Use dataOwnerId for all data fetches
    const uid = dataOwnerId;

    const createListener = (collectionName: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
      const collRef = collection(db, `users/${uid}/${collectionName}`);
      return onSnapshot(collRef, (snapshot: QuerySnapshot<DocumentData>) => {
        const list = snapshot.docs.map(doc => {
          const data = doc.data() || {};
          if (collectionName === 'products' && !Array.isArray(data.batches)) {
            data.batches = [];
          }
          if ((collectionName === 'bills' || collectionName === 'purchases') && !Array.isArray(data.items)) {
            data.items = [];
          }
          return { ...data, id: doc.id };
        });
        setter(list as any[]);
      }, (error) => {
        console.error(`Error fetching ${collectionName}:`, error);
        if (error.code === 'permission-denied') {
          setPermissionError("Permission Denied. If you are an operator, ask the admin to check permissions. If you are an admin, please update Firestore Security Rules.");
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
        createListener('gstRates', setGstRates),
    ];

    const profileRef = doc(db, `users/${uid}/companyProfile`, 'profile');
    const unsubProfile = onSnapshot(profileRef, (doc) => {
        if (doc.exists()) {
            const dbProfile = doc.data();
            if (dbProfile && typeof dbProfile === 'object' && !Array.isArray(dbProfile)) {
                setCompanyProfile({ ...initialCompanyProfile, ...dbProfile });
            }
        } else {
            setCompanyProfile(initialCompanyProfile);
        }
    });
    unsubscribers.push(unsubProfile);
    
    const configRef = doc(db, `users/${uid}/systemConfig`, 'config');
    const unsubConfig = onSnapshot(configRef, (doc) => {
        if (doc.exists()) {
            const configData = doc.data();
            if (configData && typeof configData === 'object' && !Array.isArray(configData)) {
                setSystemConfig(prev => ({...prev, ...(configData as Partial<SystemConfig>)}));
            }
        }
    });
    unsubscribers.push(unsubConfig);

    // Check for initial data load / permission
    getDocs(collection(db, `users/${uid}/products`))
      .then(() => setDataLoading(false))
      .catch((error: any) => {
        if (error.code === 'permission-denied') {
          setPermissionError("Permission Denied. Please check Firestore Security Rules.");
        } else {
           setPermissionError(`Could not connect to the database. Error: ${error.message}`);
        }
        setDataLoading(false);
      });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [currentUser, dataOwnerId]); // Dependency on dataOwnerId

  const handleLogout = () => {
    signOut(auth);
  };

  const PermissionErrorComponent: React.FC = () => (
    <div className="flex-grow flex items-center justify-center p-4">
        <Card title="Database Permission Error" className="max-w-4xl w-full text-center border-2 border-red-500/50">
            <p className="text-red-600 dark:text-red-400 mb-4 font-semibold">{permissionError}</p>
            <div className="text-left bg-slate-100 dark:bg-slate-800 p-4 rounded-lg my-4">
                <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 mb-2">Action Required (For Admins)</h3>
                <p className="mb-4 text-slate-700 dark:text-slate-300">
                    To support User Management (Operators) and secure your data, copy the rules below and paste them into your <strong>Firebase Console &gt; Firestore Database &gt; Rules</strong> tab.
                </p>
                <pre className="bg-black text-green-400 p-4 rounded-md text-xs sm:text-sm mt-3 overflow-x-auto font-mono leading-relaxed">
                    <code>
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }
    
    function isOperator(userId) {
      return request.auth != null && exists(/databases/$(database)/documents/users/$(userId)/subUsers/$(request.auth.uid));
    }

    // 1. User Mappings
    match /userMappings/{mappingId} {
      allow read: if request.auth != null && request.auth.uid == mappingId;
      allow write: if request.auth != null; 
    }

    // 2. User Data Scope
    match /users/{userId} {
      
      // Admin Collections (Protected)
      match /subUsers/{subUserId} {
        allow read: if isOwner(userId) || (request.auth != null && request.auth.uid == subUserId);
        allow write: if isOwner(userId);
      }
      
      match /companyProfile/{document=**} {
        allow read: if isOwner(userId) || isOperator(userId);
        allow write: if isOwner(userId);
      }
      
      match /systemConfig/{document=**} {
        allow read: if isOwner(userId) || isOperator(userId);
        allow write: if isOwner(userId);
      }
      
      match /gstRates/{document=**} {
        allow read: if isOwner(userId) || isOperator(userId);
        allow write: if isOwner(userId);
      }

      // Operational Collections (Read/Write for both)
      match /products/{document=**} { allow read, write: if isOwner(userId) || isOperator(userId); }
      match /bills/{document=**} { allow read, write: if isOwner(userId) || isOperator(userId); }
      match /purchases/{document=**} { allow read, write: if isOwner(userId) || isOperator(userId); }
      match /suppliers/{document=**} { allow read, write: if isOwner(userId) || isOperator(userId); }
      match /payments/{document=**} { allow read, write: if isOwner(userId) || isOperator(userId); }
      match /companies/{document=**} { allow read, write: if isOwner(userId) || isOperator(userId); }
    }
  }
}`}
                    </code>
                </pre>
            </div>
            <button
                onClick={handleLogout}
                className="mt-4 px-6 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow hover:bg-slate-700 transition-colors"
            >
                Logout & Retry
            </button>
        </Card>
    </div>
  );

  const handleProfileChange = (profile: CompanyProfile) => {
    if (!dataOwnerId) return;
    const profileRef = doc(db, `users/${dataOwnerId}/companyProfile`, 'profile');
    setDoc(profileRef, profile);
    setCompanyProfile(profile);
  };
  
  const handleSystemConfigChange = (config: SystemConfig) => {
    if (!dataOwnerId) return;
    const configRef = doc(db, `users/${dataOwnerId}/systemConfig`, 'config');
    setDoc(configRef, config);
    setSystemConfig(config);
  };

  // --- CRUD Handlers (Updated to use dataOwnerId) ---

  const handleAddProduct = async (productData: Omit<Product, 'id' | 'batches'>, firstBatchData: Omit<Batch, 'id'>) => {
    if (!dataOwnerId) return;
    const batch = writeBatch(db);

    const companyName = productData.company.trim();
    const companyExists = companies.some(c => c.name.toLowerCase() === companyName.toLowerCase());
    
    if (companyName && !companyExists) {
        const newCompanyRef = doc(collection(db, `users/${dataOwnerId}/companies`));
        batch.set(newCompanyRef, { name: companyName });
    }

    const newProductData = {
        ...productData,
        batches: [{ ...firstBatchData, id: `batch_${Date.now()}` }]
    };
    
    if (systemConfig.softwareMode === 'Retail' && (!newProductData.barcode || newProductData.barcode.trim() === '')) {
      let maxBarcodeNum = 0;
      products.forEach(p => {
        if (p.barcode && /^\d+$/.test(p.barcode) && p.barcode.length < 8) {
          const barcodeNum = parseInt(p.barcode, 10);
          if (barcodeNum > maxBarcodeNum) maxBarcodeNum = barcodeNum;
        }
      });
      newProductData.barcode = String(maxBarcodeNum + 1).padStart(6, '0');
    }

    const newProductRef = doc(collection(db, `users/${dataOwnerId}/products`));
    batch.set(newProductRef, newProductData);
    await batch.commit();
  };
  
  const handleUpdateProduct = async (productId: string, productData: any) => {
    if (!dataOwnerId) return;
    const product = products.find(p => p.id === productId);
    const updates: any = { ...productData };
    const batchFields = ['mrp', 'purchasePrice', 'stock'];
    const hasBatchUpdates = batchFields.some(f => f in updates);

    if (hasBatchUpdates && product && product.batches.length === 1) {
        const updatedBatch = { ...product.batches[0] };
        if ('mrp' in updates) updatedBatch.mrp = updates.mrp;
        if ('purchasePrice' in updates) updatedBatch.purchasePrice = updates.purchasePrice;
        if ('stock' in updates) updatedBatch.stock = updates.stock;
        updates.batches = [updatedBatch];
        batchFields.forEach(f => delete updates[f]);
    } else {
        batchFields.forEach(f => delete updates[f]);
    }

    const productRef = doc(db, `users/${dataOwnerId}/products`, productId);
    try { await updateDoc(productRef, updates); } catch (error) { console.error(error); alert("Failed to update product."); }
  };

  const handleAddBatch = async (productId: string, batchData: Omit<Batch, 'id'>) => {
    if (!dataOwnerId) return;
    const productRef = doc(db, `users/${dataOwnerId}/products`, productId);
    await updateDoc(productRef, {
        batches: arrayUnion({ ...batchData, id: `batch_${Date.now()}` })
    });
  };
  
  const handleDeleteBatch = async (productId: string, batchId: string) => {
    if (!dataOwnerId) return;
    const isInBill = bills.some(bill => bill.items.some(item => item.batchId === batchId));
    if (isInBill) { alert('Cannot delete batch: Part of sales record.'); return; }
    const isInPurchase = purchases.some(purchase => purchase.items.some(item => item.batchId === batchId));
    if (isInPurchase) { alert('Cannot delete batch: Part of purchase record.'); return; }
    
    const productToUpdate = products.find(p => p.id === productId);
    if (!productToUpdate) return;
    const updatedBatches = productToUpdate.batches.filter(b => b.id !== batchId);
    try {
      const productRef = doc(db, `users/${dataOwnerId}/products`, productId);
      await updateDoc(productRef, { batches: updatedBatches });
      alert('Batch deleted successfully.');
    } catch (error) { console.error(error); alert('Failed to delete batch.'); }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!dataOwnerId) return;
    const inBill = bills.some(bill => bill.items.some(item => item.productId === productId));
    if (inBill) { alert(`Cannot delete product. Used in sales.`); return; }
    const inPurchase = purchases.some(purchase => purchase.items.some(item => item.productId === productId));
    if (inPurchase) { alert(`Cannot delete product. Used in purchases.`); return; }

    try {
        const productRef = doc(db, `users/${dataOwnerId}/products`, productId);
        await deleteDoc(productRef);
        alert(`Product deleted successfully.`);
    } catch (error) { console.error(error); alert(`Failed to delete product.`); }
  };

  const handleBulkAddProducts = async (newProducts: Omit<Product, 'id' | 'batches'>[]): Promise<{success: number; skipped: number}> => {
    if (!dataOwnerId) return { success: 0, skipped: 0 };
    const batch = writeBatch(db);
    const existingProductKeys = new Set(products.map(p => `${p.name.trim().toLowerCase()}|${p.company.trim().toLowerCase()}`));
    const newCompanyNames = new Set<string>();
    let successCount = 0;
    let skippedCount = 0;

    for (const productData of newProducts) {
        const key = `${productData.name.trim().toLowerCase()}|${productData.company.trim().toLowerCase()}`;
        if (existingProductKeys.has(key)) { skippedCount++; continue; }

        const companyName = productData.company.trim();
        const companyExists = companies.some(c => c.name.toLowerCase() === companyName.toLowerCase());
        
        if (companyName && !companyExists && !newCompanyNames.has(companyName.toLowerCase())) {
            const newCompanyRef = doc(collection(db, `users/${dataOwnerId}/companies`));
            batch.set(newCompanyRef, { name: companyName });
            newCompanyNames.add(companyName.toLowerCase());
        }

        const newProductRef = doc(collection(db, `users/${dataOwnerId}/products`));
        batch.set(newProductRef, { ...productData, batches: [] });
        existingProductKeys.add(key);
        successCount++;
    }
    if (successCount > 0) await batch.commit();
    return { success: successCount, skipped: skippedCount };
  };

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen text-slate-600 dark:text-slate-400">Loading...</div>;
  }

  if (!currentUser) {
    return <Auth />;
  }

  if (permissionError) {
    return <PermissionErrorComponent />;
  }

  // --- Helper to check permissions ---
  const canAccess = (view: AppView) => {
      if (!isOperator) return true; // Admin has full access
      if (!userPermissions) return false;
      
      if (view === 'billing') return userPermissions.canBill;
      if (view === 'inventory') return userPermissions.canInventory;
      if (view === 'purchases') return userPermissions.canPurchase;
      if (view === 'paymentEntry') return userPermissions.canPayment;
      if (['dashboard', 'daybook', 'suppliersLedger', 'salesReport', 'companyWiseSale', 'companyWiseBillWiseProfit'].includes(view)) return userPermissions.canReports;
      return false;
  };

  return (
    <div className={`min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-200 font-sans flex flex-col`}>
      <Header 
        activeView={activeView} 
        setActiveView={(view) => {
            if (canAccess(view)) navigateTo(view);
            else alert("You do not have permission to access this section.");
        }} 
        onOpenSettings={() => setSettingsModalOpen(true)} 
        user={currentUser}
        onLogout={handleLogout}
        systemConfig={systemConfig}
        userPermissions={userPermissions}
        isOperator={isOperator}
      />
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 flex-grow w-full">
        {dataLoading ? (
           <div className="flex justify-center py-20">
               <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600"></div>
           </div>
        ) : (
          <>
            {activeView === 'dashboard' && canAccess('dashboard') && <SalesDashboard bills={bills} products={products} systemConfig={systemConfig} />}
            
            {activeView === 'billing' && canAccess('billing') && (
              <Billing 
                products={products} 
                bills={bills}
                companyProfile={companyProfile}
                systemConfig={systemConfig}
                onGenerateBill={async (billData) => {
                    if (!dataOwnerId) return null;
                    try {
                        const billRef = doc(collection(db, `users/${dataOwnerId}/bills`));
                        let maxBillNum = 0;
                        bills.forEach(b => {
                            const num = parseInt(b.billNumber.replace(/\D/g, ''));
                            if (!isNaN(num) && num > maxBillNum) maxBillNum = num;
                        });
                        const billNumber = `B${String(maxBillNum + 1).padStart(4, '0')}`;
                        const newBill = { ...billData, billNumber, id: billRef.id };
                        const batch = writeBatch(db);
                        batch.set(billRef, newBill);

                        for (const item of billData.items) {
                            const productRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
                            const product = products.find(p => p.id === item.productId);
                            if (product) {
                                const updatedBatches = product.batches.map(b => {
                                    if (b.id === item.batchId) return { ...b, stock: b.stock - item.quantity };
                                    return b;
                                });
                                batch.update(productRef, { batches: updatedBatches });
                            }
                        }
                        await batch.commit();
                        return newBill as Bill;
                    } catch (e) { console.error(e); return null; }
                }}
                editingBill={editingBill}
                onUpdateBill={async (billId, billData, originalBill) => {
                    if (!dataOwnerId) return null;
                    try {
                        const batch = writeBatch(db);
                        const billRef = doc(db, `users/${dataOwnerId}/bills`, billId);
                        
                        // Revert old stock
                        const stockChanges = new Map<string, number>();
                        originalBill.items.forEach(item => stockChanges.set(item.batchId, (stockChanges.get(item.batchId) || 0) + item.quantity));
                        // Subtract new stock
                        billData.items.forEach(item => stockChanges.set(item.batchId, (stockChanges.get(item.batchId) || 0) - item.quantity));
                        
                        const productChanges = new Map<string, Map<string, number>>();
                        stockChanges.forEach((change, batchId) => {
                            if (change === 0) return;
                            const product = products.find(p => p.batches.some(b => b.id === batchId));
                            if (product) {
                                if (!productChanges.has(product.id)) productChanges.set(product.id, new Map());
                                productChanges.get(product.id)!.set(batchId, change);
                            }
                        });
                        
                        productChanges.forEach((batchMap, productId) => {
                            const product = products.find(p => p.id === productId);
                            if (product) {
                                const updatedBatches = product.batches.map(b => {
                                    const change = batchMap.get(b.id);
                                    return change !== undefined ? { ...b, stock: b.stock + change } : b;
                                });
                                const productRef = doc(db, `users/${dataOwnerId}/products`, productId);
                                batch.update(productRef, { batches: updatedBatches });
                            }
                        });

                        batch.update(billRef, billData);
                        await batch.commit();
                        return { ...billData, id: billId } as Bill;
                    } catch (e) { console.error(e); return null; }
                }}
                onCancelEdit={() => { setEditingBill(null); navigateTo('daybook'); }}
              />
            )}
            
            {activeView === 'inventory' && canAccess('inventory') && (
              <Inventory 
                products={products}
                companies={companies}
                bills={bills}
                purchases={purchases}
                systemConfig={systemConfig}
                companyProfile={companyProfile}
                gstRates={gstRates}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onAddBatch={handleAddBatch}
                onDeleteBatch={handleDeleteBatch}
                onDeleteProduct={handleDeleteProduct}
                onBulkAddProducts={handleBulkAddProducts}
              />
            )}
            
            {activeView === 'purchases' && canAccess('purchases') && (
              <Purchases 
                products={products}
                purchases={purchases}
                companies={companies}
                suppliers={suppliers}
                systemConfig={systemConfig}
                gstRates={gstRates}
                onAddPurchase={async (purchaseData) => {
                    if (!dataOwnerId) return;
                    const batch = writeBatch(db);
                    const purchaseRef = doc(collection(db, `users/${dataOwnerId}/purchases`));
                    batch.set(purchaseRef, purchaseData);
                    
                    for (const item of purchaseData.items) {
                        if (item.isNewProduct) {
                            let productId = item.productId;
                            if (!productId) {
                                const newProductRef = doc(collection(db, `users/${dataOwnerId}/products`));
                                productId = newProductRef.id;
                                const newProduct: any = {
                                    name: item.productName,
                                    company: item.company,
                                    hsnCode: item.hsnCode,
                                    gst: item.gst,
                                    batches: []
                                };
                                if(item.barcode) newProduct.barcode = item.barcode;
                                if(item.composition) newProduct.composition = item.composition;
                                if(item.unitsPerStrip) newProduct.unitsPerStrip = item.unitsPerStrip;
                                if(item.isScheduleH) newProduct.isScheduleH = item.isScheduleH;
                                batch.set(newProductRef, newProduct);
                                
                                const companyExists = companies.some(c => c.name.toLowerCase() === item.company.toLowerCase());
                                if (!companyExists) {
                                     const newCompanyRef = doc(collection(db, `users/${dataOwnerId}/companies`));
                                     batch.set(newCompanyRef, { name: item.company });
                                }
                            }
                            const newBatch: Batch = {
                                id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                batchNumber: item.batchNumber,
                                expiryDate: item.expiryDate,
                                stock: item.quantity * (item.unitsPerStrip || 1),
                                mrp: item.mrp,
                                purchasePrice: item.purchasePrice
                            };
                            const productRef = doc(db, `users/${dataOwnerId}/products`, productId!);
                            if (item.productId) batch.update(productRef, { batches: arrayUnion(newBatch) });
                        } else {
                             if (item.productId) {
                                const newBatch: Batch = {
                                    id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                    batchNumber: item.batchNumber,
                                    expiryDate: item.expiryDate,
                                    stock: item.quantity * (item.unitsPerStrip || (products.find(p=>p.id===item.productId)?.unitsPerStrip) || 1),
                                    mrp: item.mrp,
                                    purchasePrice: item.purchasePrice
                                };
                                const productRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
                                batch.update(productRef, { batches: arrayUnion(newBatch) });
                             }
                        }
                    }
                    await batch.commit();
                }}
                onUpdatePurchase={async (id, data) => {
                    if (!dataOwnerId) return;
                    const purchaseRef = doc(db, `users/${dataOwnerId}/purchases`, id);
                    await updateDoc(purchaseRef, data);
                }}
                onDeletePurchase={async (purchase) => {
                    if (!dataOwnerId) return;
                    if (!window.confirm("Delete this purchase record? Stock will NOT be automatically reverted.")) return;
                    const purchaseRef = doc(db, `users/${dataOwnerId}/purchases`, purchase.id);
                    await deleteDoc(purchaseRef);
                }}
                onAddSupplier={async (supplierData) => {
                    if (!dataOwnerId) return null;
                    try {
                        const docRef = await addDoc(collection(db, `users/${dataOwnerId}/suppliers`), supplierData);
                        return { id: docRef.id, ...supplierData } as Supplier;
                    } catch (e) { console.error(e); return null; }
                }}
              />
            )}
            
            {activeView === 'paymentEntry' && canAccess('paymentEntry') && (
              <PaymentEntry 
                suppliers={suppliers}
                payments={payments}
                companyProfile={companyProfile}
                onAddPayment={async (paymentData) => {
                    if (!dataOwnerId) return null;
                    try {
                        const voucherNumber = `PV-${Date.now().toString().slice(-6)}`;
                        const newPayment = { ...paymentData, voucherNumber };
                        const docRef = await addDoc(collection(db, `users/${dataOwnerId}/payments`), newPayment);
                        return { id: docRef.id, ...newPayment } as Payment;
                    } catch (e) { console.error(e); return null; }
                }}
                onUpdatePayment={async (id, data) => {
                    if (!dataOwnerId) return;
                    const ref = doc(db, `users/${dataOwnerId}/payments`, id);
                    await updateDoc(ref, data);
                }}
                onDeletePayment={async (id) => {
                    if (!dataOwnerId) return;
                    if (!window.confirm("Delete this payment record?")) return;
                    const ref = doc(db, `users/${dataOwnerId}/payments`, id);
                    await deleteDoc(ref);
                }}
              />
            )}

            {activeView === 'daybook' && canAccess('daybook') && (
              <DayBook 
                bills={bills} 
                companyProfile={companyProfile}
                systemConfig={systemConfig}
                onDeleteBill={async (bill) => {
                    if (!dataOwnerId) return;
                    if (!window.confirm(`Delete Bill ${bill.billNumber}? Stock will be restored.`)) return;
                    const batch = writeBatch(db);
                    const billRef = doc(db, `users/${dataOwnerId}/bills`, bill.id);
                    batch.delete(billRef);
                    
                    for (const item of bill.items) {
                        const product = products.find(p => p.id === item.productId);
                        if (product) {
                            const productRef = doc(db, `users/${dataOwnerId}/products`, product.id);
                            const updatedBatches = product.batches.map(b => {
                                if (b.id === item.batchId) return { ...b, stock: b.stock + item.quantity };
                                return b;
                            });
                            batch.update(productRef, { batches: updatedBatches });
                        }
                    }
                    await batch.commit();
                }}
                onEditBill={(bill) => { setEditingBill(bill); navigateTo('billing'); }}
                onUpdateBillDetails={async (billId, updates) => {
                    if (!dataOwnerId) return;
                    const billRef = doc(db, `users/${dataOwnerId}/bills`, billId);
                    await updateDoc(billRef, updates);
                }}
              />
            )}

            {activeView === 'suppliersLedger' && canAccess('suppliersLedger') && (
              <SuppliersLedger 
                suppliers={suppliers}
                purchases={purchases}
                payments={payments}
                companyProfile={companyProfile}
                onUpdateSupplier={async (id, data) => {
                    if (!dataOwnerId) return;
                    const ref = doc(db, `users/${dataOwnerId}/suppliers`, id);
                    await updateDoc(ref, data);
                }}
              />
            )}

            {activeView === 'salesReport' && canAccess('salesReport') && <SalesReport bills={bills} />}
            {activeView === 'companyWiseSale' && canAccess('companyWiseSale') && <CompanyWiseSale bills={bills} products={products} systemConfig={systemConfig} />}
            {activeView === 'companyWiseBillWiseProfit' && canAccess('companyWiseBillWiseProfit') && <CompanyWiseBillWiseProfit bills={bills} products={products} />}
          </>
        )}
      </main>

      <footer className="bg-white dark:bg-slate-800 border-t dark:border-slate-700 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>
            Developed by: <span className="font-semibold text-indigo-600 dark:text-indigo-400">M. Soft India</span>
            <span className="mx-2">|</span>
            Contact: <a href="tel:9890072651" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">9890072651</a>
            <span className="mx-2">|</span>
            Visit: <a href="http://webs.msoftindia.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">webs.msoftindia.com</a>
          </p>
        </div>
      </footer>

      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        companyProfile={companyProfile}
        onProfileChange={handleProfileChange}
        systemConfig={systemConfig}
        onSystemConfigChange={handleSystemConfigChange}
        onBackupData={() => {
            const data = { products, bills, purchases, companies, suppliers, payments, companyProfile, systemConfig };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }}
        gstRates={gstRates}
        onAddGstRate={async (rate) => {
            if (!dataOwnerId) return;
            await addDoc(collection(db, `users/${dataOwnerId}/gstRates`), { rate });
        }}
        onUpdateGstRate={async (id, newRate) => {
            if (!dataOwnerId) return;
            await updateDoc(doc(db, `users/${dataOwnerId}/gstRates`, id), { rate: newRate });
        }}
        onDeleteGstRate={async (id, rateValue) => {
            if (!dataOwnerId) return;
            const usedInProducts = products.some(p => p.gst === rateValue);
            if (usedInProducts) { alert(`Cannot delete GST Rate ${rateValue}% as it is used in some products.`); return; }
            await deleteDoc(doc(db, `users/${dataOwnerId}/gstRates`, id));
        }}
      />
    </div>
  );
};

export default App;

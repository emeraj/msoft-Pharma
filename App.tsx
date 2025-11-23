
import React, { useState, useEffect } from 'react';
import type { AppView, Product, Batch, Bill, Purchase, PurchaseLineItem, CompanyProfile, Company, Supplier, Payment, CartItem, SystemConfig, GstRate } from './types';
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
  arrayUnion
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
  });
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
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
      // If state exists and has view, update view
      if (event.state && event.state.view) {
        setActiveView(event.state.view);
        // Clear editing state if navigating away from billing
        if (event.state.view !== 'billing') {
            setEditingBill(null);
        }
      } 
      // Note: We intentionally do NOT set fallback to dashboard here.
      // If event.state is null, it means we popped out of our history stack (or are at initial).
      // In a mobile context, letting this happen allows the browser to exit or go back to previous page,
      // which effectively implements "Exit on Back" when at the root.
    };

    window.addEventListener('popstate', handlePopState);
    
    // Initialize history state on mount if not present
    if (!window.history.state) {
        window.history.replaceState({ view: 'dashboard' }, '', '');
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigation helper to push state
  const navigateTo = (view: AppView) => {
    if (view === activeView) return;
    setActiveView(view);
    // Push new state
    window.history.pushState({ view }, '', '');
  };

  useEffect(() => {
    if (!currentUser) {
      // Clear data when user logs out
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
      });
      setDataLoading(true); // Reset loading state for next login
      setPermissionError(null); // Clear any existing errors
      return;
    }

    setDataLoading(true);
    setPermissionError(null);
    const uid = currentUser.uid;

    const createListener = (collectionName: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
      const collRef = collection(db, `users/${uid}/${collectionName}`);
      return onSnapshot(collRef, (snapshot: QuerySnapshot<DocumentData>) => {
        const list = snapshot.docs.map(doc => {
          const data = doc.data() || {};
          
          // Defensive initialization for required array fields to prevent runtime errors
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
        createListener('gstRates', setGstRates),
    ];

    const profileRef = doc(db, `users/${uid}/companyProfile`, 'profile');
    const unsubProfile = onSnapshot(profileRef, (doc) => {
        if (doc.exists()) {
            const dbProfile = doc.data();
            // GUARD against malformed data (e.g., non-object) before spreading.
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
            // GUARD against malformed data (e.g., non-object) before spreading.
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
  
  const handleSystemConfigChange = (config: SystemConfig) => {
    if (!currentUser) return;
    const configRef = doc(db, `users/${currentUser.uid}/systemConfig`, 'config');
    setDoc(configRef, config);
    setSystemConfig(config);
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

    const newProductData = {
        ...productData,
        batches: [{ ...firstBatchData, id: `batch_${Date.now()}` }]
    };
    
    // Auto-generate barcode in Retail mode if left blank (Fallback logic)
    if (systemConfig.softwareMode === 'Retail' && (!newProductData.barcode || newProductData.barcode.trim() === '')) {
      let maxBarcodeNum = 0;
      products.forEach(p => {
        // Only consider numeric barcodes with length < 8 to identify internal sequence
        // This ignores commercial barcodes like EAN-13 (13 digits) or UPC (12 digits)
        if (p.barcode && /^\d+$/.test(p.barcode) && p.barcode.length < 8) {
          const barcodeNum = parseInt(p.barcode, 10);
          if (barcodeNum > maxBarcodeNum) {
            maxBarcodeNum = barcodeNum;
          }
        }
      });
      const newBarcodeNum = maxBarcodeNum + 1;
      newProductData.barcode = String(newBarcodeNum).padStart(6, '0');
    }

    const newProductRef = doc(collection(db, `users/${uid}/products`));
    batch.set(newProductRef, newProductData);
    
    await batch.commit();
  };
  
  const handleUpdateProduct = async (productId: string, productData: any) => {
    if (!currentUser) return;
    
    const product = products.find(p => p.id === productId);
    const updates: any = { ...productData };
    
    // Handle batch updates for single-batch products (e.g., from Edit Product modal)
    const batchFields = ['mrp', 'purchasePrice', 'stock'];
    const hasBatchUpdates = batchFields.some(f => f in updates);

    if (hasBatchUpdates && product && product.batches.length === 1) {
        const updatedBatch = { ...product.batches[0] };
        if ('mrp' in updates) updatedBatch.mrp = updates.mrp;
        if ('purchasePrice' in updates) updatedBatch.purchasePrice = updates.purchasePrice;
        if ('stock' in updates) updatedBatch.stock = updates.stock;
        
        updates.batches = [updatedBatch];
        
        // Clean up root level update object
        batchFields.forEach(f => delete updates[f]);
    } else {
        // Safety cleanup
        batchFields.forEach(f => delete updates[f]);
    }

    const productRef = doc(db, `users/${currentUser.uid}/products`, productId);
    try {
        await updateDoc(productRef, updates);
    } catch (error) {
        console.error("Error updating product:", error);
        alert("Failed to update product details.");
    }
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

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!currentUser) return;

    // Check if product exists in any bills
    const inBill = bills.some(bill => bill.items.some(item => item.productId === productId));
    if (inBill) {
        alert(`Cannot delete "${productName}": This product is part of one or more sales records. Deleting it would corrupt your sales history.`);
        return;
    }

    // Check if product exists in any purchases
    const inPurchase = purchases.some(purchase => purchase.items.some(item => item.productId === productId));
    if (inPurchase) {
        alert(`Cannot delete "${productName}": This product is part of one or more purchase records. Deleting it would corrupt your purchase history.`);
        return;
    }

    try {
        const productRef = doc(db, `users/${currentUser.uid}/products`, productId);
        await deleteDoc(productRef);
        alert(`Product "${productName}" has been deleted successfully.`);
    } catch (error) {
        console.error("Error deleting product:", error);
        alert(`Failed to delete product "${productName}".`);
    }
  };

  const handleBulkAddProducts = async (newProducts: Omit<Product, 'id' | 'batches'>[]): Promise<{success: number; skipped: number}> => {
    if (!currentUser) return { success: 0, skipped: 0 };
    const uid = currentUser.uid;
    const batch = writeBatch(db);

    const existingProductKeys = new Set(products.map(p => `${p.name.trim().toLowerCase()}|${p.company.trim().toLowerCase()}`));
    const newCompanyNames = new Set<string>();

    let successCount = 0;
    let skippedCount = 0;

    for (const productData of newProducts) {
        const key = `${productData.name.trim().toLowerCase()}|${productData.company.trim().toLowerCase()}`;
        if (existingProductKeys.has(key)) {
            skippedCount++;
            continue;
        }

        // Add new company if needed
        const companyName = productData.company.trim();
        const companyExists = companies.some(c => c.name.toLowerCase() === companyName.toLowerCase());
        
        if (companyName && !companyExists && !newCompanyNames.has(companyName.toLowerCase())) {
            const newCompanyRef = doc(collection(db, `users/${uid}/companies`));
            batch.set(newCompanyRef, { name: companyName });
            newCompanyNames.add(companyName.toLowerCase());
        }

        const newProductRef = doc(collection(db, `users/${uid}/products`));
        
        batch.set(newProductRef, {
            ...productData,
            batches: [] 
        });
        existingProductKeys.add(key);
        successCount++;
    }

    if (successCount > 0) {
        await batch.commit();
    }
    
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

  return (
    <div className={`min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-200 font-sans flex flex-col`}>
      <Header 
        activeView={activeView} 
        setActiveView={navigateTo} 
        onOpenSettings={() => setSettingsModalOpen(true)} 
        user={currentUser}
        onLogout={handleLogout}
        systemConfig={systemConfig}
      />
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 flex-grow w-full">
        {dataLoading ? (
           <div className="flex justify-center py-20">
               <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600"></div>
           </div>
        ) : (
          <>
            {activeView === 'dashboard' && <SalesDashboard bills={bills} products={products} systemConfig={systemConfig} />}
            
            {activeView === 'billing' && (
              <Billing 
                products={products} 
                bills={bills}
                companyProfile={companyProfile}
                systemConfig={systemConfig}
                onGenerateBill={async (billData) => {
                    if (!currentUser) return null;
                    try {
                        const billRef = doc(collection(db, `users/${currentUser.uid}/bills`));
                        let maxBillNum = 0;
                        bills.forEach(b => {
                            const num = parseInt(b.billNumber.replace(/\D/g, ''));
                            if (!isNaN(num) && num > maxBillNum) maxBillNum = num;
                        });
                        const nextBillNum = maxBillNum + 1;
                        const billNumber = `B${String(nextBillNum).padStart(4, '0')}`;

                        const newBill = { ...billData, billNumber, id: billRef.id };
                        
                        const batch = writeBatch(db);
                        batch.set(billRef, newBill);

                        for (const item of billData.items) {
                            const productRef = doc(db, `users/${currentUser.uid}/products`, item.productId);
                            const product = products.find(p => p.id === item.productId);
                            if (product) {
                                const updatedBatches = product.batches.map(b => {
                                    if (b.id === item.batchId) {
                                        return { ...b, stock: b.stock - item.quantity };
                                    }
                                    return b;
                                });
                                batch.update(productRef, { batches: updatedBatches });
                            }
                        }
                        
                        await batch.commit();
                        return newBill as Bill;
                    } catch (e) {
                        console.error("Error saving bill", e);
                        return null;
                    }
                }}
                editingBill={editingBill}
                onUpdateBill={async (billId, billData, originalBill) => {
                    if (!currentUser) return null;
                    try {
                        const batch = writeBatch(db);
                        const billRef = doc(db, `users/${currentUser.uid}/bills`, billId);
                        
                        const stockChanges = new Map<string, number>();
                        
                        originalBill.items.forEach(item => {
                            const current = stockChanges.get(item.batchId) || 0;
                            stockChanges.set(item.batchId, current + item.quantity);
                        });
                        
                        billData.items.forEach(item => {
                            const current = stockChanges.get(item.batchId) || 0;
                            stockChanges.set(item.batchId, current - item.quantity);
                        });
                        
                        const productChanges = new Map<string, Map<string, number>>();
                        stockChanges.forEach((change, batchId) => {
                            if (change === 0) return;
                            const product = products.find(p => p.batches.some(b => b.id === batchId));
                            if (product) {
                                if (!productChanges.has(product.id)) {
                                    productChanges.set(product.id, new Map());
                                }
                                productChanges.get(product.id)!.set(batchId, change);
                            }
                        });
                        
                        productChanges.forEach((batchMap, productId) => {
                            const product = products.find(p => p.id === productId);
                            if (product) {
                                const updatedBatches = product.batches.map(b => {
                                    const change = batchMap.get(b.id);
                                    if (change !== undefined) {
                                        return { ...b, stock: b.stock + change };
                                    }
                                    return b;
                                });
                                const productRef = doc(db, `users/${currentUser.uid}/products`, productId);
                                batch.update(productRef, { batches: updatedBatches });
                            }
                        });

                        batch.update(billRef, billData);
                        await batch.commit();
                        return { ...billData, id: billId } as Bill;
                    } catch (e) {
                        console.error("Error updating bill", e);
                        return null;
                    }
                }}
                onCancelEdit={() => {
                    setEditingBill(null);
                    navigateTo('daybook');
                }}
              />
            )}
            
            {activeView === 'inventory' && (
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
            
            {activeView === 'purchases' && (
              <Purchases 
                products={products}
                purchases={purchases}
                companies={companies}
                suppliers={suppliers}
                systemConfig={systemConfig}
                gstRates={gstRates}
                onAddPurchase={async (purchaseData) => {
                    if (!currentUser) return;
                    const batch = writeBatch(db);
                    const purchaseRef = doc(collection(db, `users/${currentUser.uid}/purchases`));
                    
                    batch.set(purchaseRef, purchaseData);
                    
                    for (const item of purchaseData.items) {
                        if (item.isNewProduct) {
                            let productId = item.productId;
                            
                            if (!productId) {
                                const newProductRef = doc(collection(db, `users/${currentUser.uid}/products`));
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
                                     const newCompanyRef = doc(collection(db, `users/${currentUser.uid}/companies`));
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
                            
                            const productRef = doc(db, `users/${currentUser.uid}/products`, productId!);
                            if (item.productId) {
                                batch.update(productRef, { batches: arrayUnion(newBatch) });
                            }
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
                                const productRef = doc(db, `users/${currentUser.uid}/products`, item.productId);
                                batch.update(productRef, { batches: arrayUnion(newBatch) });
                             }
                        }
                    }
                    
                    await batch.commit();
                }}
                onUpdatePurchase={async (id, data, originalPurchase) => {
                    if (!currentUser) return;
                    const purchaseRef = doc(db, `users/${currentUser.uid}/purchases`, id);
                    await updateDoc(purchaseRef, data);
                }}
                onDeletePurchase={async (purchase) => {
                    if (!currentUser) return;
                    if (!window.confirm("Delete this purchase record? Stock will NOT be automatically reverted.")) return;
                    const purchaseRef = doc(db, `users/${currentUser.uid}/purchases`, purchase.id);
                    await deleteDoc(purchaseRef);
                }}
                onAddSupplier={async (supplierData) => {
                    if (!currentUser) return null;
                    try {
                        const docRef = await addDoc(collection(db, `users/${currentUser.uid}/suppliers`), supplierData);
                        return { id: docRef.id, ...supplierData } as Supplier;
                    } catch (e) {
                        console.error("Error adding supplier", e);
                        return null;
                    }
                }}
              />
            )}
            
            {activeView === 'paymentEntry' && (
              <PaymentEntry 
                suppliers={suppliers}
                payments={payments}
                companyProfile={companyProfile}
                onAddPayment={async (paymentData) => {
                    if (!currentUser) return null;
                    try {
                        const voucherNumber = `PV-${Date.now().toString().slice(-6)}`;
                        const newPayment = { ...paymentData, voucherNumber };
                        const docRef = await addDoc(collection(db, `users/${currentUser.uid}/payments`), newPayment);
                        return { id: docRef.id, ...newPayment } as Payment;
                    } catch (e) {
                        console.error("Error adding payment", e);
                        return null;
                    }
                }}
                onUpdatePayment={async (id, data) => {
                    if (!currentUser) return;
                    const ref = doc(db, `users/${currentUser.uid}/payments`, id);
                    await updateDoc(ref, data);
                }}
                onDeletePayment={async (id) => {
                    if (!currentUser) return;
                    if (!window.confirm("Delete this payment record?")) return;
                    const ref = doc(db, `users/${currentUser.uid}/payments`, id);
                    await deleteDoc(ref);
                }}
              />
            )}

            {activeView === 'daybook' && (
              <DayBook 
                bills={bills} 
                companyProfile={companyProfile}
                systemConfig={systemConfig}
                onDeleteBill={async (bill) => {
                    if (!currentUser) return;
                    if (!window.confirm(`Delete Bill ${bill.billNumber}? Stock will be restored.`)) return;
                    
                    const batch = writeBatch(db);
                    const billRef = doc(db, `users/${currentUser.uid}/bills`, bill.id);
                    batch.delete(billRef);
                    
                    for (const item of bill.items) {
                        const product = products.find(p => p.id === item.productId);
                        if (product) {
                            const productRef = doc(db, `users/${currentUser.uid}/products`, product.id);
                            const updatedBatches = product.batches.map(b => {
                                if (b.id === item.batchId) {
                                    return { ...b, stock: b.stock + item.quantity };
                                }
                                return b;
                            });
                            batch.update(productRef, { batches: updatedBatches });
                        }
                    }
                    
                    await batch.commit();
                }}
                onEditBill={(bill) => {
                    setEditingBill(bill);
                    navigateTo('billing');
                }}
                onUpdateBillDetails={async (billId, updates) => {
                    if (!currentUser) return;
                    const billRef = doc(db, `users/${currentUser.uid}/bills`, billId);
                    await updateDoc(billRef, updates);
                }}
              />
            )}

            {activeView === 'suppliersLedger' && (
              <SuppliersLedger 
                suppliers={suppliers}
                purchases={purchases}
                payments={payments}
                companyProfile={companyProfile}
                onUpdateSupplier={async (id, data) => {
                    if (!currentUser) return;
                    const ref = doc(db, `users/${currentUser.uid}/suppliers`, id);
                    await updateDoc(ref, data);
                }}
              />
            )}

            {activeView === 'salesReport' && <SalesReport bills={bills} />}
            
            {activeView === 'companyWiseSale' && <CompanyWiseSale bills={bills} products={products} systemConfig={systemConfig} />}
            
            {activeView === 'companyWiseBillWiseProfit' && <CompanyWiseBillWiseProfit bills={bills} products={products} />}

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
            const data = {
                products,
                bills,
                purchases,
                companies,
                suppliers,
                payments,
                companyProfile,
                systemConfig
            };
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
            if (!currentUser) return;
            await addDoc(collection(db, `users/${currentUser.uid}/gstRates`), { rate });
        }}
        onUpdateGstRate={async (id, newRate) => {
            if (!currentUser) return;
            await updateDoc(doc(db, `users/${currentUser.uid}/gstRates`, id), { rate: newRate });
        }}
        onDeleteGstRate={async (id, rateValue) => {
            if (!currentUser) return;
            const usedInProducts = products.some(p => p.gst === rateValue);
            if (usedInProducts) {
                alert(`Cannot delete GST Rate ${rateValue}% as it is used in some products.`);
                return;
            }
            await deleteDoc(doc(db, `users/${currentUser.uid}/gstRates`, id));
        }}
      />
    </div>
  );
};

export default App;

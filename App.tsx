
import React, { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { auth, db } from './firebase';
import Header from './components/Header';
import Auth from './components/Auth';
import Inventory from './components/Inventory';
import Billing from './components/Billing';
import Purchases from './components/Purchases';
import PaymentEntry from './components/PaymentEntry';
import DayBook from './components/DayBook';
import SuppliersLedger from './components/SuppliersLedger';
import SalesReport from './components/SalesReport';
import CompanyWiseSale from './components/CompanyWiseSale';
import CompanyWiseBillWiseProfit from './components/CompanyWiseBillWiseProfit';
import SettingsModal from './components/SettingsModal';
import SalesDashboard from './components/SalesDashboard';
import type { 
  AppView, 
  Product, 
  Bill, 
  Purchase, 
  Supplier, 
  Payment, 
  Company, 
  CompanyProfile, 
  SystemConfig, 
  GstRate, 
  Batch, 
  PurchaseLineItem,
  PrinterProfile
} from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<AppView>('billing');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [gstRates, setGstRates] = useState<GstRate[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({ name: 'My Shop', address: '', gstin: '' });
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({ softwareMode: 'Retail', invoicePrintingFormat: 'Thermal' });

  // Edit States
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  // Auth Effect
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Data Listeners Effect
  useEffect(() => {
    if (!user) {
        setProducts([]); setBills([]); setPurchases([]); setSuppliers([]); setPayments([]); setCompanies([]); setGstRates([]);
        return;
    }
    const uid = user.uid;

    const unsubProducts = db.collection(`users/${uid}/products`).onSnapshot((snap) => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });
    const unsubBills = db.collection(`users/${uid}/bills`).onSnapshot((snap) => {
        setBills(snap.docs.map(d => ({ id: d.id, ...d.data() } as Bill)));
    });
    const unsubPurchases = db.collection(`users/${uid}/purchases`).onSnapshot((snap) => {
        setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase)));
    });
    const unsubSuppliers = db.collection(`users/${uid}/suppliers`).onSnapshot((snap) => {
        setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
    });
    const unsubPayments = db.collection(`users/${uid}/payments`).onSnapshot((snap) => {
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
    });
    const unsubCompanies = db.collection(`users/${uid}/companies`).onSnapshot((snap) => {
        setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company)));
    });
    const unsubGst = db.collection(`users/${uid}/gstRates`).onSnapshot((snap) => {
        setGstRates(snap.docs.map(d => ({ id: d.id, ...d.data() } as GstRate)));
    });
    const unsubProfile = db.doc(`users/${uid}/profile/main`).onSnapshot((snap) => {
        if (snap.exists) setCompanyProfile(snap.data() as CompanyProfile);
    });
    const unsubConfig = db.doc(`users/${uid}/systemConfig/config`).onSnapshot((snap) => {
        if (snap.exists) setSystemConfig(snap.data() as SystemConfig);
    });

    return () => {
        unsubProducts(); unsubBills(); unsubPurchases(); unsubSuppliers(); unsubPayments(); unsubCompanies(); unsubGst(); unsubProfile(); unsubConfig();
    };
  }, [user]);

  // --- Inventory Handlers ---

  const handleAddProduct = async (productData: Omit<Product, 'id' | 'batches'>, firstBatch: Omit<Batch, 'id'>) => {
    if (!user) return;
    const batchId = `batch_${Date.now()}`;
    const newProduct = {
      ...productData,
      batches: [{ id: batchId, ...firstBatch }]
    };
    await db.collection(`users/${user.uid}/products`).add(newProduct);
    
    // Add company if not exists
    if (!companies.some(c => c.name.toLowerCase() === productData.company.toLowerCase())) {
      await db.collection(`users/${user.uid}/companies`).add({ name: productData.company });
    }
  };

  const handleUpdateProduct = async (productId: string, productData: Partial<Omit<Product, 'id' | 'batches'>>) => {
    if (!user) return;
    await db.doc(`users/${user.uid}/products/${productId}`).update(productData);
  };

  const handleAddBatch = async (productId: string, batch: Omit<Batch, 'id'>) => {
    if (!user) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const newBatch = { id: `batch_${Date.now()}`, ...batch };
    const updatedBatches = [...product.batches, newBatch];
    
    await db.doc(`users/${user.uid}/products/${productId}`).update({ batches: updatedBatches });
  };

  const handleDeleteBatch = async (productId: string, batchId: string) => {
    if (!user) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const updatedBatches = product.batches.filter(b => b.id !== batchId);
    await db.doc(`users/${user.uid}/products/${productId}`).update({ batches: updatedBatches });
  };

  const handleDeleteProduct = async (productId: string) => {
      if (!user) return;
      await db.doc(`users/${user.uid}/products/${productId}`).delete();
  };

  const handleBulkAddProducts = async (productsToAdd: Omit<Product, 'id' | 'batches'>[]): Promise<{success: number; skipped: number}> => {
    if (!user) return { success: 0, skipped: 0 };
    const batch = db.batch();
    let count = 0;
    let skipped = 0;

    const existingProducts = products; // Using state
    
    for (const prod of productsToAdd) {
        // Simple duplicate check by name and company
        const exists = existingProducts.some(p => p.name.toLowerCase() === prod.name.toLowerCase() && p.company.toLowerCase() === prod.company.toLowerCase());
        if (exists) {
            skipped++;
            continue;
        }

        const newDocRef = db.collection(`users/${user.uid}/products`).doc();
        batch.set(newDocRef, {
            ...prod,
            batches: [] // Initialize with empty batches
        });
        count++;
        
        // Add company if needed (optimistic, might duplicate in batch but simple set)
        if (!companies.some(c => c.name.toLowerCase() === prod.company.toLowerCase())) {
             const companyRef = db.collection(`users/${user.uid}/companies`).doc();
             batch.set(companyRef, { name: prod.company });
        }
    }
    await batch.commit();
    return { success: count, skipped };
  };


  // --- Billing Handlers ---

  const handleGenerateBill = async (billData: Omit<Bill, 'id' | 'billNumber'>): Promise<Bill | null> => {
    if (!user) return null;
    const uid = user.uid;
    
    try {
        const fbBatch = db.batch();
        
        // 1. Generate Bill Number
        // Simple logic: Count existing bills for today or just total count + 1
        const billNumber = `B${(bills.length + 1).toString().padStart(5, '0')}`;
        
        // 2. Update Stocks
        for (const item of billData.items) {
            const productRef = db.doc(`users/${uid}/products/${item.productId}`);
            const product = products.find(p => p.id === item.productId);
            if (!product) continue; // Should ideally throw error

            const updatedBatches = product.batches.map(b => {
                if (b.id === item.batchId) {
                    return { ...b, stock: b.stock - item.quantity };
                }
                return b;
            });
            fbBatch.update(productRef, { batches: updatedBatches });
        }
        
        // 3. Create Bill
        const newBillRef = db.collection(`users/${uid}/bills`).doc();
        const newBill = { ...billData, billNumber, id: newBillRef.id };
        fbBatch.set(newBillRef, newBill);
        
        await fbBatch.commit();
        return newBill;
    } catch (e) {
        console.error(e);
        alert("Failed to generate bill");
        return null;
    }
  };

  const handleUpdateBill = async (billId: string, billData: Omit<Bill, 'id'>, originalBill: Bill): Promise<Bill | null> => {
      if (!user) return null;
      const uid = user.uid;

      try {
          const fbBatch = db.batch();

          const productUpdates = new Map<string, Batch[]>();
          
          const getBatches = (prodId: string) => {
              if (productUpdates.has(prodId)) return productUpdates.get(prodId)!;
              const p = products.find(pr => pr.id === prodId);
              return p ? [...p.batches] : [];
          };

          // Revert old
          for (const item of originalBill.items) {
              const batches = getBatches(item.productId);
              const batchIndex = batches.findIndex(b => b.id === item.batchId);
              if (batchIndex > -1) {
                  batches[batchIndex] = { ...batches[batchIndex], stock: batches[batchIndex].stock + item.quantity };
                  productUpdates.set(item.productId, batches);
              }
          }

          // Apply new
          for (const item of billData.items) {
              const batches = getBatches(item.productId);
              const batchIndex = batches.findIndex(b => b.id === item.batchId);
              if (batchIndex > -1) {
                  batches[batchIndex] = { ...batches[batchIndex], stock: batches[batchIndex].stock - item.quantity };
                  productUpdates.set(item.productId, batches);
              }
          }

          // Commit product updates
          for (const [pid, batches] of productUpdates.entries()) {
              fbBatch.update(db.doc(`users/${uid}/products/${pid}`), { batches });
          }

          // Update Bill
          fbBatch.update(db.doc(`users/${uid}/bills/${billId}`), billData);

          await fbBatch.commit();
          return { id: billId, ...billData };

      } catch (e) {
          console.error("Update bill failed", e);
          return null;
      }
  };

  const handleDeleteBill = async (bill: Bill) => {
    if (!user || !confirm("Are you sure you want to delete this bill? Stocks will be reverted.")) return;
    const uid = user.uid;
    const fbBatch = db.batch();
    
    const productUpdates = new Map<string, Batch[]>();
    const getBatches = (prodId: string) => {
        if (productUpdates.has(prodId)) return productUpdates.get(prodId)!;
        const p = products.find(pr => pr.id === prodId);
        return p ? [...p.batches] : [];
    };

    for (const item of bill.items) {
        const batches = getBatches(item.productId);
        const batchIndex = batches.findIndex(b => b.id === item.batchId);
        if (batchIndex > -1) {
            batches[batchIndex] = { ...batches[batchIndex], stock: batches[batchIndex].stock + item.quantity };
            productUpdates.set(item.productId, batches);
        }
    }

    for (const [pid, batches] of productUpdates.entries()) {
        fbBatch.update(db.doc(`users/${uid}/products/${pid}`), { batches });
    }
    fbBatch.delete(db.doc(`users/${uid}/bills/${bill.id}`));
    
    await fbBatch.commit();
  };
  
  const handleUpdateBillDetails = async (billId: string, updates: Partial<Bill>) => {
      if (!user) return;
      await db.doc(`users/${user.uid}/bills/${billId}`).update(updates);
  };

  // --- Purchase Handlers ---

  const handleAddPurchase = async (purchaseData: Omit<Purchase, 'id' | 'totalAmount' | 'items'> & { items: PurchaseLineItem[] }): Promise<boolean> => {
    if (!user) return false;
    const uid = user.uid;
    
    try {
        const fbBatch = db.batch();
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
            const newCompanyRef = db.collection(`users/${uid}/companies`).doc();
            fbBatch.set(newCompanyRef, { name: companyName });
        }

        const productsToUpdate = new Map<string, Product>();
        
        const getMutableProduct = (productId: string): Product | null => {
            if (productsToUpdate.has(productId)) {
                return productsToUpdate.get(productId)!;
            }
            const p = products.find(prod => prod.id === productId);
            if (p) {
                const pCopy = JSON.parse(JSON.stringify(p)); 
                productsToUpdate.set(productId, pCopy);
                return pCopy;
            }
            return null;
        };

        const itemsWithIds: PurchaseLineItem[] = [];

        for (const item of purchaseData.items) {
            let finalItem = { ...item };
            const unitsPerStrip = item.unitsPerStrip || 1;
            const totalUnitsToAdd = item.quantity * unitsPerStrip;

            if (item.isNewProduct) {
                const newBatchId = `batch_${uniqueIdSuffix()}`;
                const newBatchData = {
                    id: newBatchId, batchNumber: item.batchNumber, expiryDate: item.expiryDate,
                    stock: totalUnitsToAdd, mrp: item.mrp, purchasePrice: item.purchasePrice,
                };

                let barcode = item.barcode;
                if (systemConfig.softwareMode === 'Retail' && (!barcode || barcode.trim() === '')) {
                     let maxBarcodeNum = 0;
                     products.forEach(p => {
                        if (p.barcode && !isNaN(parseInt(p.barcode, 10))) {
                          const barcodeNum = parseInt(p.barcode, 10);
                          if (barcodeNum > maxBarcodeNum) maxBarcodeNum = barcodeNum;
                        }
                      });
                      barcode = String(maxBarcodeNum + 1).padStart(6, '0');
                }

                const newProductRef = db.collection(`users/${uid}/products`).doc();
                fbBatch.set(newProductRef, {
                    name: item.productName, company: item.company, hsnCode: item.hsnCode, gst: item.gst,
                    composition: item.composition, unitsPerStrip: item.unitsPerStrip,
                    isScheduleH: item.isScheduleH,
                    batches: [newBatchData],
                    barcode: barcode || null
                });
                finalItem.productId = newProductRef.id;
                finalItem.batchId = newBatchId;
                finalItem.isNewProduct = false;
            } else if (item.productId) {
                const product = getMutableProduct(item.productId);
                if (!product) {
                    console.error("Product not found for purchase item", item);
                    continue;
                }

                const existingBatchIndex = product.batches.findIndex(b => b.batchNumber === item.batchNumber);

                if (existingBatchIndex > -1) {
                    const b = product.batches[existingBatchIndex];
                    b.stock += totalUnitsToAdd;
                    b.mrp = item.mrp;
                    b.purchasePrice = item.purchasePrice;
                    b.expiryDate = item.expiryDate;
                    finalItem.batchId = b.id;
                } else {
                    const newBatchId = `batch_${uniqueIdSuffix()}`;
                    const newBatchData = {
                        id: newBatchId, batchNumber: item.batchNumber, expiryDate: item.expiryDate,
                        stock: totalUnitsToAdd, mrp: item.mrp, purchasePrice: item.purchasePrice,
                    };
                    product.batches.push(newBatchData);
                    finalItem.batchId = newBatchId; 
                }
            }
            itemsWithIds.push(finalItem);
        }
        
        for (const [productId, product] of productsToUpdate.entries()) {
            const productRef = db.doc(`users/${uid}/products/${productId}`);
            product.batches.forEach(b => { if (b.stock < 0) b.stock = 0; });
            fbBatch.update(productRef, { batches: product.batches });
        }
        
        const totalAmount = purchaseData.items.reduce((total, item) => total + (item.purchasePrice * item.quantity), 0);
        const newPurchaseRef = db.collection(`users/${uid}/purchases`).doc();
        fbBatch.set(newPurchaseRef, { ...purchaseData, totalAmount, items: itemsWithIds });
        
        await fbBatch.commit();
        alert('Purchase saved successfully!');
        return true;

    } catch (error: any) {
        console.error("Error saving purchase:", error);
        alert(`Failed to save purchase: ${error.message}`);
        return false;
    }
  };

  const handleUpdatePurchase = async (
    purchaseId: string,
    updatedPurchaseData: Omit<Purchase, 'id'>,
    originalPurchase: Purchase
  ): Promise<boolean> => {
    if (!user) return false;
    const uid = user.uid;
    
    try {
        const fbBatch = db.batch();
        const uniqueIdSuffix = () => `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const productsToUpdate = new Map<string, Product>();

        const getMutableProduct = (productId: string): Product | null => {
            if (productsToUpdate.has(productId)) {
                return productsToUpdate.get(productId)!;
            }
            const p = products.find(prod => prod.id === productId);
            if (p) {
                const pCopy = JSON.parse(JSON.stringify(p));
                productsToUpdate.set(productId, pCopy);
                return pCopy;
            }
            return null;
        };

        // 1. REVERT
        for (const item of originalPurchase.items) {
            if (!item.productId || !item.batchId) continue;
            const product = getMutableProduct(item.productId);
            if (!product) continue;
            
            const batchIndex = product.batches.findIndex(b => b.id === item.batchId);
            if (batchIndex > -1) {
                const unitsPerStrip = item.unitsPerStrip || product.unitsPerStrip || 1;
                const totalUnitsToRevert = item.quantity * unitsPerStrip;
                product.batches[batchIndex].stock -= totalUnitsToRevert;
            }
        }

        // 2. APPLY
        const updatedItemsWithIds: PurchaseLineItem[] = [];
        for (const item of updatedPurchaseData.items) {
            let finalItem = { ...item };
            
            if (item.isNewProduct) {
                const newBatchId = `batch_${uniqueIdSuffix()}`;
                const totalUnitsToAdd = item.quantity * (item.unitsPerStrip || 1);

                let barcode = item.barcode;
                if (systemConfig.softwareMode === 'Retail' && (!barcode || barcode.trim() === '')) {
                     let maxBarcodeNum = 0;
                     products.forEach(p => {
                        if (p.barcode && !isNaN(parseInt(p.barcode, 10))) {
                          const barcodeNum = parseInt(p.barcode, 10);
                          if (barcodeNum > maxBarcodeNum) maxBarcodeNum = barcodeNum;
                        }
                      });
                      barcode = String(maxBarcodeNum + 1).padStart(6, '0');
                }

                const newProductRef = db.collection(`users/${uid}/products`).doc();
                fbBatch.set(newProductRef, {
                    name: item.productName, company: item.company, hsnCode: item.hsnCode, gst: item.gst,
                    composition: item.composition, unitsPerStrip: item.unitsPerStrip,
                    isScheduleH: item.isScheduleH,
                    batches: [{
                        id: newBatchId, batchNumber: item.batchNumber, expiryDate: item.expiryDate,
                        stock: totalUnitsToAdd, mrp: item.mrp, purchasePrice: item.purchasePrice,
                    }],
                    barcode: barcode || null
                });
                finalItem.productId = newProductRef.id;
                finalItem.batchId = newBatchId;
                finalItem.isNewProduct = false;
            } else if (item.productId) {
                const product = getMutableProduct(item.productId);
                if (!product) continue;
                
                const unitsPerStrip = item.unitsPerStrip || product.unitsPerStrip || 1;
                const totalUnitsToAdd = item.quantity * unitsPerStrip;

                const batchIndex = product.batches.findIndex(b => b.batchNumber === item.batchNumber);

                if (batchIndex > -1) {
                    product.batches[batchIndex].stock += totalUnitsToAdd;
                    product.batches[batchIndex].mrp = item.mrp;
                    product.batches[batchIndex].purchasePrice = item.purchasePrice;
                    product.batches[batchIndex].expiryDate = item.expiryDate;
                    finalItem.batchId = product.batches[batchIndex].id;
                } else {
                    const newBatchId = `batch_${uniqueIdSuffix()}`;
                    product.batches.push({
                        id: newBatchId, batchNumber: item.batchNumber, expiryDate: item.expiryDate,
                        stock: totalUnitsToAdd, mrp: item.mrp, purchasePrice: item.purchasePrice,
                    });
                    finalItem.batchId = newBatchId;
                }
            }
            updatedItemsWithIds.push(finalItem);
        }
        
        for (const [productId, product] of productsToUpdate.entries()) {
            const productRef = db.doc(`users/${uid}/products/${productId}`);
            product.batches.forEach(b => { if (b.stock < 0) b.stock = 0; });
            fbBatch.update(productRef, { batches: product.batches });
        }
        
        const purchaseRef = db.doc(`users/${uid}/purchases/${purchaseId}`);
        fbBatch.update(purchaseRef, {...updatedPurchaseData, items: updatedItemsWithIds});
        
        await fbBatch.commit();
        alert("Purchase updated successfully and stock adjusted.");
        return true;
    } catch(error: any) {
      console.error("Error updating purchase:", error);
      alert(`Failed to update purchase: ${error.message}`);
      return false;
    }
  };

  const handleDeletePurchase = async (purchase: Purchase) => {
      if (!user || !confirm("Are you sure? This will revert the stock added by this purchase.")) return;
      const uid = user.uid;
      const fbBatch = db.batch();

      // Simplified Revert: reduce stock. Note: This does NOT delete products created by this purchase.
      for (const item of purchase.items) {
        if (item.productId && item.batchId) {
            const product = products.find(p => p.id === item.productId);
            if (product) {
                const batchIndex = product.batches.findIndex(b => b.id === item.batchId);
                if (batchIndex > -1) {
                    const units = item.unitsPerStrip || product.unitsPerStrip || 1;
                    const reduceBy = item.quantity * units;
                    const updatedBatches = [...product.batches];
                    updatedBatches[batchIndex].stock = Math.max(0, updatedBatches[batchIndex].stock - reduceBy);
                    fbBatch.update(db.doc(`users/${uid}/products/${item.productId}`), { batches: updatedBatches });
                }
            }
        }
      }
      fbBatch.delete(db.doc(`users/${uid}/purchases/${purchase.id}`));
      await fbBatch.commit();
  };

  // --- Supplier & Payments ---

  const handleAddSupplier = async (supplierData: Omit<Supplier, 'id'>): Promise<Supplier | null> => {
      if (!user) return null;
      const ref = await db.collection(`users/${user.uid}/suppliers`).add(supplierData);
      return { id: ref.id, ...supplierData };
  };

  const handleUpdateSupplier = async (id: string, data: Omit<Supplier, 'id'>) => {
      if (!user) return;
      await db.doc(`users/${user.uid}/suppliers/${id}`).update(data);
  };

  const handleAddPayment = async (payment: Omit<Payment, 'id' | 'voucherNumber'>): Promise<Payment | null> => {
      if (!user) return null;
      // Generate simple voucher number
      const voucherNumber = `V${Date.now().toString().slice(-6)}`;
      const ref = await db.collection(`users/${user.uid}/payments`).add({ ...payment, voucherNumber });
      return { id: ref.id, ...payment, voucherNumber };
  };

  const handleUpdatePayment = async (id: string, payment: Omit<Payment, 'id'>) => {
      if (!user) return;
      await db.doc(`users/${user.uid}/payments/${id}`).update(payment);
  };

  const handleDeletePayment = async (id: string) => {
      if (!user) return;
      await db.doc(`users/${user.uid}/payments/${id}`).delete();
  };

  // --- Settings & GST ---

  const handleProfileChange = async (profile: CompanyProfile) => {
      if (!user) return;
      await db.doc(`users/${user.uid}/profile/main`).set(profile);
  };

  const handleSystemConfigChange = async (config: SystemConfig) => {
      if (!user) return;
      await db.doc(`users/${user.uid}/systemConfig/config`).set(config);
  };

  const handleBackupData = () => {
      const data = { products, bills, purchases, suppliers, payments, companies, gstRates, companyProfile, systemConfig };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
  };

  const handleAddGstRate = async (rate: number) => {
      if (!user) return;
      await db.collection(`users/${user.uid}/gstRates`).add({ rate });
  };

  const handleUpdateGstRate = async (id: string, rate: number) => {
      if (!user) return;
      await db.doc(`users/${user.uid}/gstRates/${id}`).update({ rate });
  };

  const handleDeleteGstRate = async (id: string) => {
      if (!user) return;
      await db.doc(`users/${user.uid}/gstRates/${id}`).delete();
  };


  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400">Loading...</div>;
  if (!user) return <Auth />;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-200 font-sans">
      <Header 
        activeView={activeView} 
        setActiveView={setActiveView} 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        user={user}
        onLogout={() => auth.signOut()}
        systemConfig={systemConfig}
      />
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {activeView === 'dashboard' && <SalesDashboard bills={bills} products={products} />}
        
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
        
        {activeView === 'billing' && (
            <Billing 
                products={products}
                bills={bills}
                companyProfile={companyProfile}
                systemConfig={systemConfig}
                onGenerateBill={handleGenerateBill}
                editingBill={editingBill}
                onUpdateBill={handleUpdateBill}
                onCancelEdit={() => setEditingBill(null)}
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
                onUpdatePurchase={handleUpdatePurchase}
                onDeletePurchase={handleDeletePurchase}
                onAddSupplier={handleAddSupplier}
            />
        )}
        
        {activeView === 'paymentEntry' && (
            <PaymentEntry
                suppliers={suppliers}
                payments={payments}
                companyProfile={companyProfile}
                onAddPayment={handleAddPayment}
                onUpdatePayment={handleUpdatePayment}
                onDeletePayment={handleDeletePayment}
            />
        )}

        {activeView === 'daybook' && (
            <DayBook
                bills={bills}
                companyProfile={companyProfile}
                systemConfig={systemConfig}
                onDeleteBill={handleDeleteBill}
                onEditBill={(bill) => { setEditingBill(bill); setActiveView('billing'); }}
                onUpdateBillDetails={handleUpdateBillDetails}
            />
        )}

        {activeView === 'suppliersLedger' && (
            <SuppliersLedger 
                suppliers={suppliers}
                purchases={purchases}
                payments={payments}
                companyProfile={companyProfile}
                onUpdateSupplier={handleUpdateSupplier}
            />
        )}
        
        {activeView === 'salesReport' && <SalesReport bills={bills} />}
        
        {activeView === 'companyWiseSale' && <CompanyWiseSale bills={bills} products={products} systemConfig={systemConfig} />}
        
        {activeView === 'companyWiseBillWiseProfit' && <CompanyWiseBillWiseProfit bills={bills} products={products} />}

      </main>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        companyProfile={companyProfile}
        onProfileChange={handleProfileChange}
        systemConfig={systemConfig}
        onSystemConfigChange={handleSystemConfigChange}
        onBackupData={handleBackupData}
        gstRates={gstRates}
        onAddGstRate={handleAddGstRate}
        onUpdateGstRate={handleUpdateGstRate}
        onDeleteGstRate={handleDeleteGstRate}
      />
    </div>
  );
};

export default App;

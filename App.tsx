
import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';
import Header from './components/Header';
import Auth from './components/Auth';
import Billing from './components/Billing';
import Inventory from './components/Inventory';
import Purchases from './components/Purchases';
import PaymentEntry from './components/PaymentEntry';
import SettingsModal from './components/SettingsModal';
import SalesDashboard from './components/SalesDashboard';
import DayBook from './components/DayBook';
import SuppliersLedger from './components/SuppliersLedger';
import CustomerLedger from './components/CustomerLedger';
import SalesReport from './components/SalesReport';
import SalesmanReport from './components/SalesmanReport';
import CompanyWiseSale from './components/CompanyWiseSale';
import CompanyWiseBillWiseProfit from './components/CompanyWiseBillWiseProfit';
import ChequePrint from './components/ChequePrint';
import { AppView, Product, Bill, Customer, Supplier, Purchase, Payment, CompanyProfile, SystemConfig, GstRate, Salesman, CustomerPayment, UserPermissions, UserMapping } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<AppView>('billing');
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]); // Supplier Payments
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]); // Customer Payments
  const [gstRates, setGstRates] = useState<GstRate[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);

  // Config State
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({ name: 'My Shop', address: '', gstin: '' });
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({ softwareMode: 'Retail', invoicePrintingFormat: 'Thermal' });

  // Multi-User State
  const [userRole, setUserRole] = useState<'admin' | 'operator'>('admin');
  const [dataOwnerId, setDataOwnerId] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<UserPermissions | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Resolve Role and Data Owner
        try {
            // Check if user is an operator (exists in userMappings)
            const mappingRef = doc(db, 'userMappings', currentUser.uid);
            const mappingSnap = await getDoc(mappingRef);
            
            if (mappingSnap.exists()) {
                const mapping = mappingSnap.data() as UserMapping;
                setUserRole(mapping.role);
                setDataOwnerId(mapping.ownerId);
                
                if (mapping.role === 'operator') {
                    // Fetch permissions
                    const subUserRef = doc(db, `users/${mapping.ownerId}/subUsers`, currentUser.uid);
                    const subUserSnap = await getDoc(subUserRef);
                    if (subUserSnap.exists()) {
                        setUserPermissions(subUserSnap.data().permissions);
                    }
                }
            } else {
                // Default to Admin/Owner
                setUserRole('admin');
                setDataOwnerId(currentUser.uid);
                setUserPermissions(undefined);
            }
        } catch (e) {
            console.error("Error resolving user role", e);
            // Fallback
            setUserRole('admin');
            setDataOwnerId(currentUser.uid);
        }
      } else {
        setDataOwnerId('');
      }
      setLoading(false);
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
    const unsubBills = onSnapshot(collection(db, `${basePath}/bills`), (snap) => {
      setBills(snap.docs.map(d => ({ id: d.id, ...d.data() } as Bill)));
    });
    const unsubCustomers = onSnapshot(collection(db, `${basePath}/customers`), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });
    const unsubSuppliers = onSnapshot(collection(db, `${basePath}/suppliers`), (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
    });
    const unsubPurchases = onSnapshot(collection(db, `${basePath}/purchases`), (snap) => {
      setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase)));
    });
    const unsubPayments = onSnapshot(collection(db, `${basePath}/payments`), (snap) => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
    });
    const unsubCustPayments = onSnapshot(collection(db, `${basePath}/customerPayments`), (snap) => {
      setCustomerPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerPayment)));
    });
    const unsubSalesmen = onSnapshot(collection(db, `${basePath}/salesmen`), (snap) => {
        setSalesmen(snap.docs.map(d => ({ id: d.id, ...d.data() } as Salesman)));
    });
    
    // Config Listeners
    const unsubProfile = onSnapshot(doc(db, `${basePath}/companyProfile`, 'profile'), (snap) => {
        if (snap.exists()) setCompanyProfile(snap.data() as CompanyProfile);
    });
    const unsubConfig = onSnapshot(doc(db, `${basePath}/systemConfig`, 'config'), (snap) => {
        if (snap.exists()) setSystemConfig(snap.data() as SystemConfig);
    });
    const unsubGst = onSnapshot(collection(db, `${basePath}/gstRates`), (snap) => {
        setGstRates(snap.docs.map(d => ({ id: d.id, ...d.data() } as GstRate)));
    });

    return () => {
      unsubProducts(); unsubBills(); unsubCustomers(); unsubSuppliers();
      unsubPurchases(); unsubPayments(); unsubProfile(); unsubConfig(); unsubGst();
      unsubCustPayments(); unsubSalesmen();
    };
  }, [dataOwnerId]);

  // Handlers
  const handleGenerateBill = async (billData: Omit<Bill, 'id' | 'billNumber'>) => {
      if (!dataOwnerId) return null;
      try {
          // Generate Bill Number
          const count = bills.length + 1;
          const billNumber = `INV-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
          
          const batch = writeBatch(db);
          
          // 1. Create Bill
          const billRef = doc(collection(db, `users/${dataOwnerId}/bills`));
          const newBill = { ...billData, billNumber, id: billRef.id }; // Add ID locally for return
          batch.set(billRef, { ...billData, billNumber });

          // 2. Update Stock
          for (const item of billData.items) {
              const productRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
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

          // 3. Update Customer Balance (if credit)
          if (systemConfig.maintainCustomerLedger && billData.paymentMode === 'Credit' && billData.customerId) {
              const customerRef = doc(db, `users/${dataOwnerId}/customers`, billData.customerId);
              const customer = customers.find(c => c.id === billData.customerId);
              if (customer) {
                  const newBalance = (customer.balance || 0) + billData.grandTotal;
                  batch.update(customerRef, { balance: newBalance });
              }
          }

          await batch.commit();
          return newBill;
      } catch (e) {
          console.error("Error generating bill", e);
          return null;
      }
  };

  const handleUpdateBill = async (billId: string, billData: Omit<Bill, 'id'>, originalBill: Bill) => {
        if (!dataOwnerId) return null;
        try {
            const batch = writeBatch(db);
            const billRef = doc(db, `users/${dataOwnerId}/bills`, billId);
            
            // 1. Revert Stock from Original Bill
            for (const item of originalBill.items) {
                const productRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    const bIndex = product.batches.findIndex(b => b.id === item.batchId);
                    if (bIndex >= 0) {
                        product.batches[bIndex].stock += item.quantity;
                    }
                }
            }

            // 2. Deduct Stock for New Items
            const productUpdates = new Map<string, Product>();
            
            originalBill.items.forEach(item => {
                const p = productUpdates.get(item.productId) || JSON.parse(JSON.stringify(products.find(prod => prod.id === item.productId)!));
                if (p) {
                    const b = p.batches.find((batch: any) => batch.id === item.batchId);
                    if (b) b.stock += item.quantity;
                    productUpdates.set(item.productId, p);
                }
            });

            billData.items.forEach(item => {
                const p = productUpdates.get(item.productId) || JSON.parse(JSON.stringify(products.find(prod => prod.id === item.productId)!));
                if (p) {
                    const b = p.batches.find((batch: any) => batch.id === item.batchId);
                    if (b) b.stock -= item.quantity;
                    productUpdates.set(item.productId, p);
                }
            });

            productUpdates.forEach((p, pid) => {
                const pRef = doc(db, `users/${dataOwnerId}/products`, pid);
                batch.update(pRef, { batches: p.batches });
            });

            // 3. Update Bill Document
            batch.update(billRef, billData);

            await batch.commit();
            return { id: billId, ...billData };
        } catch (e) {
            console.error("Error updating bill", e);
            return null;
        }
  };

  const handleAddProduct = async (product: Omit<Product, 'id'>) => {
      await addDoc(collection(db, `users/${dataOwnerId}/products`), product);
  };

  const handleUpdateProduct = async (id: string, data: Partial<Product>) => {
      await updateDoc(doc(db, `users/${dataOwnerId}/products`, id), data);
  };

  const handleDeleteProduct = async (id: string) => {
      if (window.confirm("Are you sure you want to delete this product?")) {
          await deleteDoc(doc(db, `users/${dataOwnerId}/products`, id));
      }
  };

  const handleAddPurchase = async (purchaseData: Omit<Purchase, 'id' | 'totalAmount'>) => {
      try {
          const batch = writeBatch(db);
          
          // 1. Create Purchase Record
          const purchaseRef = doc(collection(db, `users/${dataOwnerId}/purchases`));
          batch.set(purchaseRef, purchaseData);

          // 2. Process Items (Create/Update Products & Batches)
          for (const item of purchaseData.items) {
              const quantityToAdd = item.quantity; 
              
              if (item.isNewProduct) {
                  const newProdRef = doc(collection(db, `users/${dataOwnerId}/products`));
                  const newBatch = {
                      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                      batchNumber: item.batchNumber,
                      expiryDate: item.expiryDate,
                      stock: quantityToAdd,
                      mrp: item.mrp,
                      purchasePrice: item.purchasePrice,
                      openingStock: 0
                  };
                  batch.set(newProdRef, {
                      name: item.productName,
                      company: item.company,
                      hsnCode: item.hsnCode,
                      gst: item.gst,
                      barcode: item.barcode || null,
                      composition: item.composition || null,
                      unitsPerStrip: item.unitsPerStrip || 1,
                      isScheduleH: item.isScheduleH || false,
                      batches: [newBatch]
                  });
              } else if (item.productId) {
                  const productRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
                  const product = products.find(p => p.id === item.productId);
                  
                  if (product) {
                      const existingBatchIndex = product.batches.findIndex(b => b.batchNumber === item.batchNumber);
                      let updatedBatches = [...product.batches];

                      if (existingBatchIndex >= 0) {
                          updatedBatches[existingBatchIndex].stock += quantityToAdd;
                          updatedBatches[existingBatchIndex].mrp = item.mrp;
                          updatedBatches[existingBatchIndex].purchasePrice = item.purchasePrice;
                      } else {
                          updatedBatches.push({
                              id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                              batchNumber: item.batchNumber,
                              expiryDate: item.expiryDate,
                              stock: quantityToAdd,
                              mrp: item.mrp,
                              purchasePrice: item.purchasePrice,
                              openingStock: 0
                          });
                      }
                      batch.update(productRef, { batches: updatedBatches });
                  }
              }
          }

          // 3. Update Supplier Balance
          const supplier = suppliers.find(s => s.name === purchaseData.supplier);
          if (supplier) {
              const supplierRef = doc(db, `users/${dataOwnerId}/suppliers`, supplier.id);
              // Note: Usually we recalculate balance dynamically in Ledger, but if we track static field:
              // batch.update(supplierRef, { openingBalance: (supplier.openingBalance || 0) + purchaseData.totalAmount });
          }

          await batch.commit();
          alert("Purchase saved successfully!");
      } catch (e) {
          console.error("Error saving purchase", e);
          alert("Failed to save purchase.");
      }
  };

  const handleUpdatePurchase = async (id: string, updatedData: Omit<Purchase, 'id'>, originalPurchase: Purchase) => {
      alert("Update Purchase logic not fully implemented in this demo.");
  };

  const handleAddPayment = async (paymentData: Omit<Payment, 'id' | 'voucherNumber'>) => {
      const count = payments.length + 1;
      const voucherNumber = `VCH-${String(count).padStart(4, '0')}`;
      const newPayment = { ...paymentData, voucherNumber };
      const docRef = await addDoc(collection(db, `users/${dataOwnerId}/payments`), newPayment);
      return { id: docRef.id, ...newPayment };
  };

  const handleAddCustomer = async (data: Omit<Customer, 'id' | 'balance'>) => {
      const newCust = { ...data, balance: 0, openingBalance: 0 };
      const ref = await addDoc(collection(db, `users/${dataOwnerId}/customers`), newCust);
      return { id: ref.id, ...newCust };
  };

  const handleAddSalesman = async (data: Omit<Salesman, 'id'>) => {
      const ref = await addDoc(collection(db, `users/${dataOwnerId}/salesmen`), data);
      return { id: ref.id, ...data };
  };

  // --- Secure Deletion Handlers ---

  const onDeleteBill = async (bill: Bill) => {
      if (!dataOwnerId) return;
      if (!window.confirm(`Are you sure you want to delete bill ${bill.billNumber}? Stock will be restored.`)) return;

      try {
          const batch = writeBatch(db);
          const billRef = doc(db, `users/${dataOwnerId}/bills`, bill.id);
          batch.delete(billRef);

          // Restore Stock
          for (const item of bill.items) {
              const product = products.find(p => p.id === item.productId);
              if (product) {
                  const updatedBatches = product.batches.map(b => {
                      if (b.id === item.batchId) return { ...b, stock: b.stock + item.quantity };
                      return b;
                  });
                  const prodRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
                  batch.update(prodRef, { batches: updatedBatches });
              }
          }

          // Revert Customer Balance
          if (bill.paymentMode === 'Credit' && bill.customerId) {
              const custRef = doc(db, `users/${dataOwnerId}/customers`, bill.customerId);
              const customer = customers.find(c => c.id === bill.customerId);
              if (customer) {
                  batch.update(custRef, { balance: customer.balance - bill.grandTotal });
              }
          }

          await batch.commit();
      } catch(e) {
          console.error("Error deleting bill", e);
          alert("Failed to delete bill.");
      }
  };

  const handleDeletePurchase = async (purchase: Purchase) => {
      if (!dataOwnerId) return;
      if (!window.confirm(`Delete Purchase Invoice ${purchase.invoiceNumber}? Stock will be deducted.`)) return;
      
      try {
          // Note: Full stock revert logic is complex (what if stock already sold?). 
          // For now we just delete the document.
          await deleteDoc(doc(db, `users/${dataOwnerId}/purchases`, purchase.id));
      } catch (e) {
          console.error("Error deleting purchase", e);
      }
  };

  const handleDeleteSupplierPayment = async (id: string) => {
      if (!dataOwnerId) return;
      if (!window.confirm("Are you sure you want to delete this payment entry?")) return;
      await deleteDoc(doc(db, `users/${dataOwnerId}/payments`, id));
  };

  const handleDeleteCustomerPayment = async (payment: CustomerPayment) => {
      if (!dataOwnerId) return;
      if (!window.confirm("Are you sure you want to delete this receipt? Customer balance will be adjusted.")) return;
      
      try {
          await deleteDoc(doc(db, `users/${dataOwnerId}/customerPayments`, payment.id));
          
          const customerRef = doc(db, `users/${dataOwnerId}/customers`, payment.customerId);
          const customer = customers.find(c => c.id === payment.customerId);
          if (customer) {
              await updateDoc(customerRef, { balance: customer.balance + payment.amount });
          }
      } catch (e) {
          console.error("Error deleting receipt", e);
      }
  };

  const handleDeleteGstRate = async (id: string) => {
      if (!dataOwnerId) return;
      if (!window.confirm("Are you sure you want to delete this GST rate?")) return;
      await deleteDoc(doc(db, `users/${dataOwnerId}/gstRates`, id));
  };

  const onBackupData = () => {
      const backup = {
          products, bills, customers, suppliers, purchases, payments, companyProfile, systemConfig, gstRates
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "backup_" + new Date().toISOString() + ".json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Auth />;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-200">
      <Header 
        activeView={activeView} 
        setActiveView={setActiveView} 
        onOpenSettings={() => setSettingsOpen(true)}
        user={user}
        onLogout={() => signOut(auth)}
        systemConfig={systemConfig}
        userPermissions={userPermissions}
        isOperator={userRole === 'operator'}
      />
      
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
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
                onAddSalesman={handleAddSalesman}
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
                companies={[]} 
                suppliers={suppliers} 
                systemConfig={systemConfig}
                gstRates={gstRates}
                onAddPurchase={handleAddPurchase}
                onUpdatePurchase={handleUpdatePurchase}
                onDeletePurchase={handleDeletePurchase}
                onAddSupplier={async (s) => { const ref = await addDoc(collection(db, `users/${dataOwnerId}/suppliers`), s); return {id: ref.id, ...s} as Supplier; }}
                onUpdateConfig={(cfg) => setDoc(doc(db, `users/${dataOwnerId}/systemConfig`, 'config'), cfg)}
            />
        )}
        {activeView === 'paymentEntry' && (
            <PaymentEntry 
                suppliers={suppliers}
                payments={payments}
                companyProfile={companyProfile}
                onAddPayment={handleAddPayment}
                onUpdatePayment={(id, data) => updateDoc(doc(db, `users/${dataOwnerId}/payments`, id), data)}
                onDeletePayment={handleDeleteSupplierPayment}
            />
        )}
        {activeView === 'dashboard' && <SalesDashboard bills={bills} products={products} systemConfig={systemConfig} />}
        {activeView === 'daybook' && (
            <DayBook 
                bills={bills} 
                companyProfile={companyProfile} 
                systemConfig={systemConfig}
                onDeleteBill={onDeleteBill}
                onEditBill={() => alert("Edit Bill via Billing screen")} 
                onUpdateBillDetails={(id, data) => updateDoc(doc(db, `users/${dataOwnerId}/bills`, id), data)}
            />
        )}
        {activeView === 'suppliersLedger' && (
            <SuppliersLedger 
                suppliers={suppliers} 
                purchases={purchases} 
                payments={payments} 
                companyProfile={companyProfile}
                onUpdateSupplier={(id, data) => updateDoc(doc(db, `users/${dataOwnerId}/suppliers`, id), data)}
                onAddPayment={handleAddPayment}
            />
        )}
        {activeView === 'customerLedger' && (
            <CustomerLedger 
                customers={customers} 
                bills={bills} 
                payments={customerPayments} 
                companyProfile={companyProfile}
                onAddPayment={async (p) => { await addDoc(collection(db, `users/${dataOwnerId}/customerPayments`), p); }}
                onUpdateCustomer={async (id, d) => { await updateDoc(doc(db, `users/${dataOwnerId}/customers`, id), d); }}
                onEditBill={() => {}} 
                onDeleteBill={onDeleteBill}
                onUpdatePayment={async (id, d) => { await updateDoc(doc(db, `users/${dataOwnerId}/customerPayments`, id), d); }}
                onDeletePayment={handleDeleteCustomerPayment}
            />
        )}
        {activeView === 'salesReport' && <SalesReport bills={bills} />}
        {activeView === 'salesmanReport' && <SalesmanReport bills={bills} salesmen={salesmen} />}
        {activeView === 'companyWiseSale' && <CompanyWiseSale bills={bills} products={products} systemConfig={systemConfig} />}
        {activeView === 'companyWiseBillWiseProfit' && <CompanyWiseBillWiseProfit bills={bills} products={products} />}
        {activeView === 'chequePrint' && <ChequePrint systemConfig={systemConfig} onUpdateConfig={(cfg) => setDoc(doc(db, `users/${dataOwnerId}/systemConfig`, 'config'), cfg)} />}
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setSettingsOpen(false)}
        companyProfile={companyProfile}
        onProfileChange={(p) => setDoc(doc(db, `users/${dataOwnerId}/companyProfile`, 'profile'), p)}
        systemConfig={systemConfig}
        onSystemConfigChange={(c) => setDoc(doc(db, `users/${dataOwnerId}/systemConfig`, 'config'), c)}
        onBackupData={onBackupData}
        gstRates={gstRates}
        onAddGstRate={(r) => addDoc(collection(db, `users/${dataOwnerId}/gstRates`), { rate: r })}
        onUpdateGstRate={(id, r) => updateDoc(doc(db, `users/${dataOwnerId}/gstRates`, id), { rate: r })}
        onDeleteGstRate={handleDeleteGstRate}
      />
    </div>
  );
};

export default App;

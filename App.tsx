
// ... existing imports ...
import React, { useState, useEffect } from 'react';
import type { AppView, Product, Batch, Bill, Purchase, PurchaseLineItem, CompanyProfile, Company, Supplier, Payment, CartItem, SystemConfig, GstRate, UserPermissions, SubUser, Customer, CustomerPayment, Salesman } from './types';
import Header from './components/Header';
import Billing from './components/Billing';
import Inventory from './components/Inventory';
import DayBook from './components/DayBook';
import Purchases from './components/Purchases';
import SettingsModal from './components/SettingsModal';
import Auth from './components/Auth';
import SalesDashboard from './components/SalesDashboard';
import PaymentEntry from './components/PaymentEntry';
import SuppliersLedger from './components/SuppliersLedger';
import CustomerLedger from './components/CustomerLedger';
import SalesReport from './components/SalesReport';
import CompanyWiseSale from './components/CompanyWiseSale';
import CompanyWiseBillWiseProfit from './components/CompanyWiseBillWiseProfit';
import SalesmanReport from './components/SalesmanReport';
import ChequePrint from './components/ChequePrint';
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

const initialCompanyProfile: CompanyProfile = {
  name: 'My Shop',
  address: '',
  gstin: '',
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [gstRates, setGstRates] = useState<GstRate[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  
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
    maintainCustomerLedger: false,
    enableSalesman: false,
    aiInvoiceQuota: 5,
  });
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Resolve Data Owner
        try {
            const mappingRef = doc(db, 'userMappings', user.uid);
            const mappingSnap = await getDoc(mappingRef);
            
            if (mappingSnap.exists()) {
                const data = mappingSnap.data();
                setDataOwnerId(data.ownerId);
                setIsOperator(data.role === 'operator');
                
                if (data.role === 'operator') {
                    // Fetch permissions
                    const subUserRef = doc(db, `users/${data.ownerId}/subUsers`, user.uid);
                    const subUserSnap = await getDoc(subUserRef);
                    if (subUserSnap.exists()) {
                        setUserPermissions(subUserSnap.data().permissions);
                    }
                }
            } else {
                // Assume Admin (Owner)
                setDataOwnerId(user.uid);
                setIsOperator(false);
                setUserPermissions(undefined);
            }
        } catch (e) {
            console.error("Error resolving user role:", e);
            // Fallback to self as owner if mapping fails (e.g. legacy user)
            setDataOwnerId(user.uid);
        }
      } else {
        setDataOwnerId(null);
        setProducts([]);
        setBills([]);
        setPurchases([]);
        setCompanies([]);
        setSuppliers([]);
        setPayments([]);
        setCustomers([]);
        setCustomerPayments([]);
        setSalesmen([]);
        setGstRates([]);
        setCompanyProfile(initialCompanyProfile);
        setIsOperator(false);
        setUserPermissions(undefined);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!dataOwnerId) {
        if (!authLoading && currentUser) setDataLoading(false); 
        return;
    }

    setDataLoading(true);
    const userId = dataOwnerId;

    const unsubProducts = onSnapshot(collection(db, `users/${userId}/products`), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    const unsubBills = onSnapshot(collection(db, `users/${userId}/bills`), (snapshot) => {
      setBills(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bill)));
    });
    const unsubPurchases = onSnapshot(collection(db, `users/${userId}/purchases`), (snapshot) => {
      setPurchases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase)));
    });
    const unsubCompanies = onSnapshot(collection(db, `users/${userId}/companies`), (snapshot) => {
      setCompanies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company)));
    });
    const unsubSuppliers = onSnapshot(collection(db, `users/${userId}/suppliers`), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });
    const unsubPayments = onSnapshot(collection(db, `users/${userId}/payments`), (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    });
    const unsubCustomers = onSnapshot(collection(db, `users/${userId}/customers`), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });
    const unsubCustPayments = onSnapshot(collection(db, `users/${userId}/customerPayments`), (snapshot) => {
      setCustomerPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerPayment)));
    });
    const unsubSalesmen = onSnapshot(collection(db, `users/${userId}/salesmen`), (snapshot) => {
      setSalesmen(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Salesman)));
    });
    const unsubGst = onSnapshot(collection(db, `users/${userId}/gstRates`), (snapshot) => {
      setGstRates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GstRate)));
    });

    // Fetch Profile & Config (Single Documents)
    const profileRef = doc(db, `users/${userId}/companyProfile`, 'profile');
    const unsubProfile = onSnapshot(profileRef, (doc) => {
        if (doc.exists()) setCompanyProfile(doc.data() as CompanyProfile);
    });

    const configRef = doc(db, `users/${userId}/systemConfig`, 'config');
    const unsubConfig = onSnapshot(configRef, (doc) => {
        if (doc.exists()) setSystemConfig(doc.data() as SystemConfig);
    });

    setDataLoading(false);

    return () => {
      unsubProducts(); unsubBills(); unsubPurchases(); unsubCompanies();
      unsubSuppliers(); unsubPayments(); unsubCustomers(); unsubCustPayments();
      unsubSalesmen(); unsubGst(); unsubProfile(); unsubConfig();
    };
  }, [dataOwnerId]);

  const handleUpdateCustomer = async (customerId: string, data: Partial<Customer>) => {
    if (!dataOwnerId) return;
    try {
        const customerRef = doc(db, `users/${dataOwnerId}/customers`, customerId);
        
        // If openingBalance is being updated, we need to adjust the current balance
        if (data.openingBalance !== undefined) {
            const customerDoc = await getDoc(customerRef);
            if (customerDoc.exists()) {
                const currentData = customerDoc.data() as Customer;
                const oldOpening = currentData.openingBalance || 0;
                const diff = data.openingBalance - oldOpening;
                // Adjust current balance by the difference in opening balance
                data.balance = (currentData.balance || 0) + diff;
            }
        }
        
        await updateDoc(customerRef, data);
    } catch (e) {
        console.error("Error updating customer:", e);
        alert("Failed to update customer details.");
    }
  };

  const navigateTo = (view: AppView) => {
    setActiveView(view);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const canAccess = (view: AppView): boolean => {
    if (!isOperator) return true; // Admin has full access
    if (!userPermissions) return false;

    switch (view) {
      case 'billing': return userPermissions.canBill;
      case 'inventory': return userPermissions.canInventory;
      case 'purchases': return userPermissions.canPurchase;
      case 'paymentEntry': return userPermissions.canPayment;
      case 'dashboard':
      case 'daybook':
      case 'suppliersLedger':
      case 'customerLedger':
      case 'salesReport':
      case 'companyWiseSale':
      case 'companyWiseBillWiseProfit':
      case 'salesmanReport':
      case 'chequePrint':
        return userPermissions.canReports;
      default: return true;
    }
  };

  // --- Handlers for Bill and Payment Operations ---

  const handleDeleteBill = async (bill: Bill) => {
      if (!dataOwnerId) return;
      if (!window.confirm(`Delete Bill ${bill.billNumber}? Stock will be restored.`)) return;
      const batch = writeBatch(db);
      const billRef = doc(db, `users/${dataOwnerId}/bills`, bill.id);
      batch.delete(billRef);
      
      // Restore Stock
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

      // Update Customer Balance
      if (systemConfig.maintainCustomerLedger && bill.paymentMode === 'Credit') {
          let customer = bill.customerId ? customers.find(c => c.id === bill.customerId) : null;
          if (!customer) {
              const cleanName = bill.customerName.trim();
              if (cleanName) {
                  customer = customers.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
              }
          }
          
          if (customer) {
              const customerRef = doc(db, `users/${dataOwnerId}/customers`, customer.id);
              const newBalance = (customer.balance || 0) - bill.grandTotal;
              batch.update(customerRef, { balance: newBalance });
          }
      }

      await batch.commit();
  };

  const handleEditBill = (bill: Bill) => {
      setEditingBill(bill);
      navigateTo('billing');
  };

  const handleUpdateCustomerPayment = async (id: string, data: Omit<CustomerPayment, 'id'>) => {
      if (!dataOwnerId) return;
      try {
          const batch = writeBatch(db);
          const paymentRef = doc(db, `users/${dataOwnerId}/customerPayments`, id);
          
          // Find old payment to calculate difference
          const oldPayment = customerPayments.find(p => p.id === id);
          if (!oldPayment) return;

          const diff = data.amount - oldPayment.amount; 
          // Balance = Receivable. Payment reduces Receivable. 
          // If new amount is higher (positive diff), balance should reduce more (subtract diff).
          
          const customer = customers.find(c => c.id === data.customerId);
          if (customer) {
              const custRef = doc(db, `users/${dataOwnerId}/customers`, customer.id);
              batch.update(custRef, { balance: customer.balance - diff });
          }

          batch.update(paymentRef, data);
          await batch.commit();
      } catch(e) { console.error(e); }
  };

  const handleDeleteCustomerPayment = async (payment: CustomerPayment) => {
      if (!dataOwnerId) return;
      if (!window.confirm("Delete this payment? Customer balance will increase.")) return;
      
      try {
          const batch = writeBatch(db);
          const paymentRef = doc(db, `users/${dataOwnerId}/customerPayments`, payment.id);
          
          const customer = customers.find(c => c.id === payment.customerId);
          if (customer) {
              const custRef = doc(db, `users/${dataOwnerId}/customers`, customer.id);
              // Revert balance: Balance = Current + Payment Amount (since payment reduced it)
              batch.update(custRef, { balance: customer.balance + payment.amount });
          }
          
          batch.delete(paymentRef);
          await batch.commit();
      } catch(e) { console.error(e); }
  };

  // --- End Handlers ---

  const handleAddProduct = async (productData: Omit<Product, 'id' | 'batches'>, firstBatch: Omit<Batch, 'id'>) => {
    if (!dataOwnerId) return;
    try {
        const batchId = `batch_${Date.now()}`;
        const newBatch = { ...firstBatch, id: batchId };
        const newProduct = { ...productData, batches: [newBatch] };
        
        await addDoc(collection(db, `users/${dataOwnerId}/products`), newProduct);
        
        // Add company if not exists
        const companyExists = companies.some(c => c.name.toLowerCase() === productData.company.toLowerCase());
        if (!companyExists) {
            await addDoc(collection(db, `users/${dataOwnerId}/companies`), { name: productData.company });
        }
    } catch (e) {
        console.error("Error adding product:", e);
        alert("Failed to add product.");
    }
  };

  const handleUpdateProduct = async (productId: string, productData: any) => {
    if (!dataOwnerId) return;
    try {
        await updateDoc(doc(db, `users/${dataOwnerId}/products`, productId), productData);
    } catch (e) {
        console.error("Error updating product:", e);
        alert("Failed to update product.");
    }
  };

  const handleAddBatch = async (productId: string, batchData: Omit<Batch, 'id'>) => {
    if (!dataOwnerId) return;
    try {
        const productRef = doc(db, `users/${dataOwnerId}/products`, productId);
        const batchId = `batch_${Date.now()}`;
        const newBatch = { ...batchData, id: batchId };
        await updateDoc(productRef, {
            batches: arrayUnion(newBatch)
        });
    } catch (e) {
        console.error("Error adding batch:", e);
        alert("Failed to add batch.");
    }
  };

  const handleDeleteBatch = async (productId: string, batchId: string) => {
    if (!dataOwnerId) return;
    try {
        const product = products.find(p => p.id === productId);
        if (product) {
            const updatedBatches = product.batches.filter(b => b.id !== batchId);
            await updateDoc(doc(db, `users/${dataOwnerId}/products`, productId), { batches: updatedBatches });
        }
    } catch (e) {
        console.error("Error deleting batch:", e);
        alert("Failed to delete batch.");
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!dataOwnerId) return;
    try {
        await deleteDoc(doc(db, `users/${dataOwnerId}/products`, productId));
    } catch (e) {
        console.error("Error deleting product:", e);
        alert("Failed to delete product.");
    }
  };

  const handleBulkAddProducts = async (productsData: any[]): Promise<{success: number; skipped: number}> => {
      if (!dataOwnerId) return { success: 0, skipped: 0 };
      // Placeholder for bulk add logic
      alert("Bulk add functionality to be implemented.");
      return { success: 0, skipped: 0 };
  };

  const handleSystemConfigChange = async (newConfig: SystemConfig) => {
      if (!dataOwnerId) return;
      try {
          const configRef = doc(db, `users/${dataOwnerId}/systemConfig`, 'config');
          await setDoc(configRef, newConfig); 
          setSystemConfig(newConfig);
      } catch(e) {
          console.error("Error updating config", e);
      }
  };

  const handleProfileChange = async (newProfile: CompanyProfile) => {
      if (!dataOwnerId) return;
      try {
          const profileRef = doc(db, `users/${dataOwnerId}/companyProfile`, 'profile');
          await setDoc(profileRef, newProfile);
          setCompanyProfile(newProfile);
      } catch (e) {
          console.error("Error updating profile", e);
      }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-slate-900"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600"></div></div>;
  }

  if (!currentUser) {
    return <Auth />;
  }

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
                customers={customers}
                salesmen={salesmen}
                companyProfile={companyProfile}
                systemConfig={systemConfig}
                onAddCustomer={async (custData) => {
                    if (!dataOwnerId) return null;
                    try {
                        const newCustRef = doc(collection(db, `users/${dataOwnerId}/customers`));
                        // Balance starts equal to opening balance if provided
                        const openingBalance = custData.openingBalance || 0;
                        const newCustomer = { 
                            ...custData, 
                            openingBalance: openingBalance,
                            balance: openingBalance 
                        };
                        await setDoc(newCustRef, newCustomer);
                        return { id: newCustRef.id, ...newCustomer };
                    } catch (e) {
                        console.error("Error adding customer:", e);
                        return null;
                    }
                }}
                onAddSalesman={async (salesmanData) => {
                    if (!dataOwnerId) return null;
                    try {
                        const newSalesmanRef = doc(collection(db, `users/${dataOwnerId}/salesmen`));
                        await setDoc(newSalesmanRef, salesmanData);
                        return { id: newSalesmanRef.id, ...salesmanData };
                    } catch(e) {
                        console.error("Error adding salesman", e);
                        return null;
                    }
                }}
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

                        if (systemConfig.maintainCustomerLedger && billData.paymentMode === 'Credit') {
                            const customerId = billData.customerId;
                            const cleanName = billData.customerName.trim();
                            
                            if (customerId) {
                                const customerRef = doc(db, `users/${dataOwnerId}/customers`, customerId);
                                const existingCustomer = customers.find(c => c.id === customerId);
                                const newBalance = (existingCustomer?.balance || 0) + billData.grandTotal;
                                batch.update(customerRef, { balance: newBalance });
                            } else if (cleanName && cleanName.toLowerCase() !== 'walk-in customer' && cleanName.toLowerCase() !== 'walk-in patient') {
                                const existingCustomer = customers.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
                                if (existingCustomer) {
                                     const customerRef = doc(db, `users/${dataOwnerId}/customers`, existingCustomer.id);
                                     const newBalance = (existingCustomer.balance || 0) + billData.grandTotal;
                                     batch.update(customerRef, { balance: newBalance });
                                } else {
                                     const newCustomerRef = doc(collection(db, `users/${dataOwnerId}/customers`));
                                     batch.set(newCustomerRef, { 
                                         name: cleanName, 
                                         balance: billData.grandTotal,
                                         openingBalance: 0
                                     });
                                }
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
                        
                        const stockChanges = new Map<string, number>();
                        originalBill.items.forEach(item => stockChanges.set(item.batchId, (stockChanges.get(item.batchId) || 0) + item.quantity));
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

                        if (systemConfig.maintainCustomerLedger) {
                            const balanceAdjustments = new Map<string, number>();
                            if (originalBill.paymentMode === 'Credit') {
                                let cust = originalBill.customerId ? customers.find(c => c.id === originalBill.customerId) : null;
                                if (!cust) {
                                    const origName = originalBill.customerName.trim();
                                    cust = customers.find(c => c.name.toLowerCase() === origName.toLowerCase());
                                }
                                if (cust) balanceAdjustments.set(cust.id, (balanceAdjustments.get(cust.id) || 0) - originalBill.grandTotal);
                            }
                            if (billData.paymentMode === 'Credit') {
                                let custId = billData.customerId;
                                let existingCust = custId ? customers.find(c => c.id === custId) : null;
                                if (!existingCust) {
                                    const newName = billData.customerName.trim();
                                    existingCust = customers.find(c => c.name.toLowerCase() === newName.toLowerCase());
                                }
                                if (existingCust) {
                                    custId = existingCust.id;
                                    balanceAdjustments.set(custId, (balanceAdjustments.get(custId) || 0) + billData.grandTotal);
                                } else {
                                    const newName = billData.customerName.trim();
                                    if (newName) {
                                        const newCustRef = doc(collection(db, `users/${dataOwnerId}/customers`));
                                        batch.set(newCustRef, { name: newName, balance: billData.grandTotal, openingBalance: 0 });
                                    }
                                }
                            }
                            balanceAdjustments.forEach((change, custId) => {
                                if (change !== 0) {
                                    const cust = customers.find(c => c.id === custId);
                                    if (cust) {
                                        const ref = doc(db, `users/${dataOwnerId}/customers`, custId);
                                        batch.update(ref, { balance: cust.balance + change });
                                    }
                                }
                            });
                        }

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
                onUpdateConfig={handleSystemConfigChange}
                onAddPurchase={async (purchaseData) => {
                    if (!dataOwnerId) return;
                    const batch = writeBatch(db);
                    const purchaseRef = doc(collection(db, `users/${dataOwnerId}/purchases`));
                    batch.set(purchaseRef, purchaseData);
                    
                    for (const item of purchaseData.items) {
                        const quantity = item.quantity * (item.unitsPerStrip || (item.productId ? products.find(p=>p.id===item.productId)?.unitsPerStrip : 1) || 1);
                        const newBatch: Batch = {
                            id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            batchNumber: item.batchNumber,
                            expiryDate: item.expiryDate,
                            stock: quantity,
                            openingStock: quantity, 
                            mrp: item.mrp,
                            purchasePrice: item.purchasePrice
                        };

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
                                    batches: [newBatch]
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
                            } else {
                                const productRef = doc(db, `users/${dataOwnerId}/products`, productId);
                                batch.update(productRef, { batches: arrayUnion(newBatch) });
                            }
                        } else {
                             if (item.productId) {
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
                onDeleteBill={handleDeleteBill}
                onEditBill={handleEditBill}
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
            
            {activeView === 'customerLedger' && canAccess('customerLedger') && (
              <CustomerLedger 
                customers={customers}
                bills={bills}
                payments={customerPayments}
                companyProfile={companyProfile}
                onAddPayment={async (paymentData) => {
                    if (!dataOwnerId) return;
                    const batch = writeBatch(db);
                    const newPaymentRef = doc(collection(db, `users/${dataOwnerId}/customerPayments`));
                    batch.set(newPaymentRef, paymentData);
                    
                    const customer = customers.find(c => c.id === paymentData.customerId);
                    if (customer) {
                        const custRef = doc(db, `users/${dataOwnerId}/customers`, customer.id);
                        batch.update(custRef, { balance: customer.balance - paymentData.amount });
                    }
                    
                    await batch.commit();
                }}
                onUpdateCustomer={handleUpdateCustomer}
                onEditBill={handleEditBill}
                onDeleteBill={handleDeleteBill}
                onUpdatePayment={handleUpdateCustomerPayment}
                onDeletePayment={handleDeleteCustomerPayment}
              />
            )}

            {activeView === 'salesReport' && canAccess('salesReport') && <SalesReport bills={bills} />}
            {activeView === 'companyWiseSale' && canAccess('companyWiseSale') && <CompanyWiseSale bills={bills} products={products} systemConfig={systemConfig} />}
            {activeView === 'companyWiseBillWiseProfit' && canAccess('companyWiseBillWiseProfit') && <CompanyWiseBillWiseProfit bills={bills} products={products} />}
            {activeView === 'salesmanReport' && canAccess('salesmanReport') && <SalesmanReport bills={bills} salesmen={salesmen} />}
            
            {activeView === 'chequePrint' && canAccess('chequePrint') && (
                <ChequePrint 
                    systemConfig={systemConfig}
                    onUpdateConfig={handleSystemConfigChange}
                />
            )}
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
            Visit: <a href="https://msoftindia.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">https://msoftindia.com</a>
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
            const data = { products, bills, purchases, companies, suppliers, payments, customers, customerPayments, companyProfile, systemConfig, salesmen };
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

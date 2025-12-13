import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, orderBy, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import Header from './components/Header';
import Billing from './components/Billing';
import Inventory from './components/Inventory';
import Purchases from './components/Purchases';
import DayBook from './components/DayBook';
import SettingsModal from './components/SettingsModal';
import Auth from './components/Auth';
import PaymentEntry from './components/PaymentEntry';
import SuppliersLedger from './components/SuppliersLedger';
import CustomerLedger from './components/CustomerLedger';
import SalesReport from './components/SalesReport';
import SalesmanReport from './components/SalesmanReport';
import CompanyWiseSale from './components/CompanyWiseSale';
import CompanyWiseBillWiseProfit from './components/CompanyWiseBillWiseProfit';
import ChequePrint from './components/ChequePrint';
import SalesDashboard from './components/SalesDashboard';
import type { 
  AppView, Product, Bill, Purchase, Supplier, Customer, CustomerPayment, 
  Payment, CompanyProfile, SystemConfig, GstRate, Company, UserPermissions, 
  Salesman, UserMapping
} from './types';

const defaultProfile: CompanyProfile = {
  name: 'My Shop',
  address: '',
  gstin: '',
};

const defaultConfig: SystemConfig = {
  softwareMode: 'Retail',
  invoicePrintingFormat: 'Thermal',
  mrpEditable: true,
  barcodeScannerOpenByDefault: true,
  maintainCustomerLedger: false,
  enableSalesman: false,
  aiInvoiceQuota: 5
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<AppView>('billing');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | undefined>(undefined);
  const [isOperator, setIsOperator] = useState(false);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<Payment[]>([]);
  const [gstRates, setGstRates] = useState<GstRate[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  
  // Config State
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(defaultProfile);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(defaultConfig);

  // Auth & User Mapping Logic
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Check if user is an operator or admin
        const mappingRef = doc(db, 'userMappings', currentUser.uid);
        const mappingSnap = await getDoc(mappingRef);
        
        if (mappingSnap.exists()) {
          const mapping = mappingSnap.data() as UserMapping;
          if (mapping.role === 'operator') {
            setIsOperator(true);
            setDataOwnerId(mapping.ownerId);
            
            // Fetch permissions
            const subUserRef = doc(db, `users/${mapping.ownerId}/subUsers`, currentUser.uid);
            const subUserSnap = await getDoc(subUserRef);
            if (subUserSnap.exists()) {
               setUserPermissions(subUserSnap.data().permissions);
            }
          } else {
            // Admin
            setIsOperator(false);
            setDataOwnerId(currentUser.uid);
            setUserPermissions(undefined);
          }
        } else {
          // Assume Admin/Owner if no mapping exists (legacy or new owner)
          setIsOperator(false);
          setDataOwnerId(currentUser.uid);
          // Create mapping for self
          setDoc(mappingRef, { ownerId: currentUser.uid, role: 'admin' });
        }
      } else {
        setDataOwnerId(null);
        setProducts([]);
        setBills([]);
        setPurchases([]);
        // ... clear other state
      }
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

    const unsubBills = onSnapshot(query(collection(db, `${basePath}/bills`), orderBy('date', 'desc')), (snap) => {
      setBills(snap.docs.map(d => ({ id: d.id, ...d.data() } as Bill)));
    });

    const unsubPurchases = onSnapshot(query(collection(db, `${basePath}/purchases`), orderBy('invoiceDate', 'desc')), (snap) => {
      setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase)));
    });

    const unsubSuppliers = onSnapshot(collection(db, `${basePath}/suppliers`), (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
    });

    const unsubCustomers = onSnapshot(collection(db, `${basePath}/customers`), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });

    const unsubSalesmen = onSnapshot(collection(db, `${basePath}/salesmen`), (snap) => {
      setSalesmen(snap.docs.map(d => ({ id: d.id, ...d.data() } as Salesman)));
    });

    const unsubPayments = onSnapshot(collection(db, `${basePath}/payments`), (snap) => {
      setSupplierPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
    });
    
    const unsubCustPayments = onSnapshot(collection(db, `${basePath}/customerPayments`), (snap) => {
      setCustomerPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerPayment)));
    });

    const unsubGst = onSnapshot(collection(db, `${basePath}/gstRates`), (snap) => {
      setGstRates(snap.docs.map(d => ({ id: d.id, ...d.data() } as GstRate)));
    });

    const unsubCompanies = onSnapshot(collection(db, `${basePath}/companies`), (snap) => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company)));
    });

    const unsubProfile = onSnapshot(doc(db, `${basePath}/companyProfile`, 'profile'), (snap) => {
      if (snap.exists()) setCompanyProfile(snap.data() as CompanyProfile);
    });

    const unsubConfig = onSnapshot(doc(db, `${basePath}/systemConfig`, 'config'), (snap) => {
      if (snap.exists()) setSystemConfig(snap.data() as SystemConfig);
    });

    return () => {
      unsubProducts(); unsubBills(); unsubPurchases(); unsubSuppliers(); unsubCustomers();
      unsubPayments(); unsubGst(); unsubCompanies(); unsubProfile(); unsubConfig();
      unsubCustPayments(); unsubSalesmen();
    };
  }, [dataOwnerId]);

  // --- Handlers ---

  const handleAddProduct = async (productData: Omit<Product, 'id'>) => {
    if (!dataOwnerId) return;
    await addDoc(collection(db, `users/${dataOwnerId}/products`), productData);
  };

  const handleUpdateProduct = async (id: string, productData: Partial<Product>) => {
    if (!dataOwnerId) return;
    await updateDoc(doc(db, `users/${dataOwnerId}/products`, id), productData);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!dataOwnerId) return;
    if (window.confirm('Delete product?')) {
        await deleteDoc(doc(db, `users/${dataOwnerId}/products`, id));
    }
  };

  const handleGenerateBill = async (billData: Omit<Bill, 'id' | 'billNumber'>) => {
    if (!dataOwnerId) return null;
    
    try {
        const batch = writeBatch(db);
        
        // 1. Generate Bill Number
        const billsRef = collection(db, `users/${dataOwnerId}/bills`);
        const billNumber = `INV-${Date.now().toString().slice(-6)}`;
        const newBillRef = doc(billsRef);
        
        const newBill: Bill = { ...billData, id: newBillRef.id, billNumber };
        batch.set(newBillRef, newBill);

        // 2. Deduct Stock
        const productUpdates = new Map<string, any[]>();
        const currentProducts = JSON.parse(JSON.stringify(products)) as Product[];

        for (const item of billData.items) {
            const product = currentProducts.find(p => p.id === item.productId);
            if (product) {
                const batchIndex = product.batches.findIndex(b => b.id === item.batchId);
                if (batchIndex !== -1) {
                    product.batches[batchIndex].stock -= item.quantity;
                    productUpdates.set(product.id, product.batches);
                }
            }
        }

        productUpdates.forEach((batches, productId) => {
            const pRef = doc(db, `users/${dataOwnerId}/products`, productId);
            batch.update(pRef, { batches });
        });

        // 3. Update Customer Balance if credit
        if (billData.paymentMode === 'Credit' && billData.customerId) {
            const custRef = doc(db, `users/${dataOwnerId}/customers`, billData.customerId);
            const customer = customers.find(c => c.id === billData.customerId);
            if (customer) {
                batch.update(custRef, { balance: customer.balance + billData.grandTotal });
            }
        }

        await batch.commit();
        return newBill;
    } catch (e) {
        console.error("Error generating bill", e);
        alert("Failed to generate bill");
        return null;
    }
  };

  const handleUpdateBill = async (billId: string, billData: Omit<Bill, 'id'>, originalBill: Bill) => {
      if (!dataOwnerId) return null;
      await updateDoc(doc(db, `users/${dataOwnerId}/bills`, billId), billData);
      return { ...billData, id: billId } as Bill;
  };

  const handleDeleteBill = async (bill: Bill) => {
      if (!dataOwnerId) return;
      if (!window.confirm("Delete Bill? Stock will be restored.")) return;

      const batch = writeBatch(db);
      const billRef = doc(db, `users/${dataOwnerId}/bills`, bill.id);
      batch.delete(billRef);

      // Restore Stock
      const currentProducts = JSON.parse(JSON.stringify(products)) as Product[];
      const productUpdates = new Map<string, any[]>();

      for (const item of bill.items) {
          const product = currentProducts.find(p => p.id === item.productId);
          if (product) {
              const batchIndex = product.batches.findIndex(b => b.id === item.batchId);
              if (batchIndex !== -1) {
                  product.batches[batchIndex].stock += item.quantity;
                  productUpdates.set(product.id, product.batches);
              }
          }
      }

      productUpdates.forEach((batches, productId) => {
          const pRef = doc(db, `users/${dataOwnerId}/products`, productId);
          batch.update(pRef, { batches });
      });

      // Restore Customer Balance if Credit
      if (bill.paymentMode === 'Credit' && bill.customerId) {
          const customer = customers.find(c => c.id === bill.customerId);
          if (customer) {
              const custRef = doc(db, `users/${dataOwnerId}/customers`, bill.customerId);
              batch.update(custRef, { balance: customer.balance - bill.grandTotal });
          }
      }

      await batch.commit();
  };

  const handleAddPurchase = async (purchaseData: Omit<Purchase, 'id' | 'totalAmount'>) => {
      if (!dataOwnerId) return;
      
      try {
          const batch = writeBatch(db);
          
          const purchaseRef = doc(collection(db, `users/${dataOwnerId}/purchases`));
          
          let totalAmount = 0;
          const itemsWithIds = purchaseData.items.map(item => {
              const itemTotal = (item.quantity * item.purchasePrice) * (1 - (item.discount || 0)/100);
              const tax = itemTotal * (item.gst / 100);
              totalAmount += itemTotal + tax;
              return { ...item };
          });
          
          totalAmount += (purchaseData.roundOff || 0);

          const newPurchase: Purchase = { 
              ...purchaseData, 
              items: itemsWithIds, 
              totalAmount,
              id: purchaseRef.id
          };
          batch.set(purchaseRef, newPurchase);

          const currentProducts = JSON.parse(JSON.stringify(products)) as Product[];
          
          for (const item of itemsWithIds) {
              let product = currentProducts.find(p => p.name === item.productName && p.company === item.company);
              let productRef;
              
              if (product) {
                  productRef = doc(db, `users/${dataOwnerId}/products`, product.id);
                  const newBatch = {
                      id: `batch_${Date.now()}_${Math.random()}`,
                      batchNumber: item.batchNumber,
                      expiryDate: item.expiryDate,
                      stock: item.quantity * (item.unitsPerStrip || 1),
                      mrp: item.mrp,
                      purchasePrice: item.purchasePrice,
                      openingStock: 0 
                  };
                  product.batches.push(newBatch);
                  batch.update(productRef, { batches: product.batches });
              } else {
                  productRef = doc(collection(db, `users/${dataOwnerId}/products`));
                  const newBatch = {
                      id: `batch_${Date.now()}_${Math.random()}`,
                      batchNumber: item.batchNumber,
                      expiryDate: item.expiryDate,
                      stock: item.quantity * (item.unitsPerStrip || 1),
                      mrp: item.mrp,
                      purchasePrice: item.purchasePrice,
                      openingStock: 0
                  };
                  const newProduct: Product = {
                      id: productRef.id,
                      name: item.productName,
                      company: item.company,
                      hsnCode: item.hsnCode,
                      gst: item.gst,
                      barcode: item.barcode,
                      composition: item.composition,
                      unitsPerStrip: item.unitsPerStrip,
                      isScheduleH: item.isScheduleH,
                      batches: [newBatch]
                  };
                  batch.set(productRef, newProduct);
              }
          }

          await batch.commit();

      } catch(e) {
          console.error(e);
          alert("Error saving purchase");
      }
  };

  const handleDeletePurchase = async (purchase: Purchase) => {
      if (!dataOwnerId) return;
      if (!window.confirm(`Delete Purchase Invoice ${purchase.invoiceNumber}? Stock will be reversed and deducted from inventory.`)) return;
      
      try {
          const batchWrite = writeBatch(db);
          
          const purchaseRef = doc(db, `users/${dataOwnerId}/purchases`, purchase.id);
          batchWrite.delete(purchaseRef);

          const productUpdates = new Map<string, any[]>(); 
          const tempProducts = JSON.parse(JSON.stringify(products)) as Product[];

          for (const item of purchase.items) {
              let product: Product | undefined;

              if (item.productId) {
                  product = tempProducts.find(p => p.id === item.productId);
              }
              
              if (!product) {
                  product = tempProducts.find(p => p.name === item.productName && p.company === item.company);
              }

              if (product) {
                  const batchIndex = product.batches.findIndex(b => b.batchNumber === item.batchNumber);
                  
                  if (batchIndex !== -1) {
                      const batch = product.batches[batchIndex];
                      const units = item.unitsPerStrip || (product.unitsPerStrip || 1);
                      batch.stock = batch.stock - (item.quantity * units);
                      
                      if (batch.openingStock !== undefined) {
                          batch.openingStock = Math.max(0, batch.openingStock - (item.quantity * units));
                      }

                      productUpdates.set(product.id, product.batches);
                  }
              }
          }

          productUpdates.forEach((batches, productId) => {
              const productRef = doc(db, `users/${dataOwnerId}/products`, productId);
              batchWrite.update(productRef, { batches: batches });
          });

          await batchWrite.commit();
      } catch (e) {
          console.error("Error deleting purchase", e);
          alert("Failed to delete purchase.");
      }
  };

  const handleAddSupplier = async (supplierData: Omit<Supplier, 'id'>) => {
      if (!dataOwnerId) return null;
      const ref = await addDoc(collection(db, `users/${dataOwnerId}/suppliers`), supplierData);
      return { id: ref.id, ...supplierData };
  };

  const handleUpdateSupplier = async (id: string, data: Omit<Supplier, 'id'>) => {
      if (!dataOwnerId) return;
      await updateDoc(doc(db, `users/${dataOwnerId}/suppliers`, id), data);
  };

  const handleAddSupplierPayment = async (paymentData: Omit<Payment, 'id' | 'voucherNumber'>) => {
      if (!dataOwnerId) return null;
      const voucherNumber = `VCH-${Date.now().toString().slice(-6)}`;
      const ref = await addDoc(collection(db, `users/${dataOwnerId}/payments`), { ...paymentData, voucherNumber });
      return { id: ref.id, ...paymentData, voucherNumber };
  };

  const handleDeleteSupplierPayment = async (id: string) => {
      if (!dataOwnerId) return;
      if (window.confirm("Delete payment?")) {
          await deleteDoc(doc(db, `users/${dataOwnerId}/payments`, id));
      }
  };

  const handleUpdateSupplierPayment = async (id: string, data: Omit<Payment, 'id'>) => {
      if (!dataOwnerId) return;
      await updateDoc(doc(db, `users/${dataOwnerId}/payments`, id), data);
  };

  const handleAddCustomer = async (custData: Omit<Customer, 'id' | 'balance'>) => {
      if (!dataOwnerId) return null;
      const ref = await addDoc(collection(db, `users/${dataOwnerId}/customers`), { ...custData, balance: custData.openingBalance || 0 });
      return { id: ref.id, ...custData, balance: custData.openingBalance || 0 };
  };

  const handleUpdateCustomer = async (id: string, data: Partial<Customer>) => {
      if (!dataOwnerId) return;
      await updateDoc(doc(db, `users/${dataOwnerId}/customers`, id), data);
  };

  const handleAddCustomerPayment = async (paymentData: Omit<CustomerPayment, 'id'>) => {
      if (!dataOwnerId) return;
      const batch = writeBatch(db);
      
      const payRef = doc(collection(db, `users/${dataOwnerId}/customerPayments`));
      batch.set(payRef, paymentData);

      const custRef = doc(db, `users/${dataOwnerId}/customers`, paymentData.customerId);
      const customer = customers.find(c => c.id === paymentData.customerId);
      if (customer) {
          batch.update(custRef, { balance: customer.balance - paymentData.amount });
      }

      await batch.commit();
  };

  const handleAddGstRate = async (rate: number) => {
      if (!dataOwnerId) return;
      await addDoc(collection(db, `users/${dataOwnerId}/gstRates`), { rate });
  };

  const handleUpdateGstRate = async (id: string, rate: number) => {
      if (!dataOwnerId) return;
      await updateDoc(doc(db, `users/${dataOwnerId}/gstRates`, id), { rate });
  };

  const handleDeleteGstRate = async (id: string) => {
      if (!dataOwnerId) return;
      await deleteDoc(doc(db, `users/${dataOwnerId}/gstRates`, id));
  };

  const handleAddSalesman = async (salesman: Omit<Salesman, 'id'>) => {
      if (!dataOwnerId) return null;
      const ref = await addDoc(collection(db, `users/${dataOwnerId}/salesmen`), salesman);
      return { id: ref.id, ...salesman };
  };

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-200">
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenSettings={() => setIsSettingsOpen(true)}
        user={user}
        onLogout={() => signOut(auth)}
        systemConfig={systemConfig}
        userPermissions={userPermissions}
        isOperator={isOperator}
      />

      <main className="max-w-7xl mx-auto py-6">
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
            companies={companies}
            suppliers={suppliers}
            systemConfig={systemConfig}
            gstRates={gstRates}
            onAddPurchase={handleAddPurchase}
            onUpdatePurchase={(id, data) => {/* Implement Update logic */ console.log(id, data)}}
            onDeletePurchase={handleDeletePurchase}
            onAddSupplier={handleAddSupplier}
            onUpdateConfig={(cfg) => {
                if (dataOwnerId) {
                    setDoc(doc(db, `users/${dataOwnerId}/systemConfig`, 'config'), cfg);
                }
            }}
          />
        )}
        {activeView === 'daybook' && (
          <DayBook
            bills={bills}
            companyProfile={companyProfile}
            systemConfig={systemConfig}
            onDeleteBill={handleDeleteBill}
            onEditBill={(bill) => {/* Implement logic to switch to Billing with bill data */}}
            onUpdateBillDetails={(id, updates) => updateDoc(doc(db, `users/${dataOwnerId}/bills`, id), updates)}
          />
        )}
        {activeView === 'suppliersLedger' && (
          <SuppliersLedger
            suppliers={suppliers}
            purchases={purchases}
            payments={supplierPayments}
            companyProfile={companyProfile}
            onUpdateSupplier={handleUpdateSupplier}
            onAddPayment={handleAddSupplierPayment}
          />
        )}
        {activeView === 'paymentEntry' && (
          <PaymentEntry
            suppliers={suppliers}
            payments={supplierPayments}
            companyProfile={companyProfile}
            onAddPayment={handleAddSupplierPayment}
            onUpdatePayment={handleUpdateSupplierPayment}
            onDeletePayment={handleDeleteSupplierPayment}
          />
        )}
        {activeView === 'customerLedger' && (
          <CustomerLedger
            customers={customers}
            bills={bills}
            payments={customerPayments}
            companyProfile={companyProfile}
            onAddPayment={handleAddCustomerPayment}
            onUpdateCustomer={handleUpdateCustomer}
            onEditBill={(bill) => {/* Navigate to Billing */}}
            onDeleteBill={handleDeleteBill}
            onUpdatePayment={(id, data) => {/* update customer payment */}}
            onDeletePayment={(payment) => {/* delete customer payment */}}
          />
        )}
        {activeView === 'salesReport' && <SalesReport bills={bills} />}
        {activeView === 'salesmanReport' && <SalesmanReport bills={bills} salesmen={salesmen} />}
        {activeView === 'companyWiseSale' && <CompanyWiseSale bills={bills} products={products} systemConfig={systemConfig} />}
        {activeView === 'companyWiseBillWiseProfit' && <CompanyWiseBillWiseProfit bills={bills} products={products} />}
        {activeView === 'chequePrint' && (
            <ChequePrint 
                systemConfig={systemConfig} 
                onUpdateConfig={(cfg) => {
                    if(dataOwnerId) setDoc(doc(db, `users/${dataOwnerId}/systemConfig`, 'config'), cfg);
                }} 
            />
        )}
        {activeView === 'dashboard' && <SalesDashboard bills={bills} products={products} systemConfig={systemConfig} />}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        companyProfile={companyProfile}
        onProfileChange={(p) => {
            if(dataOwnerId) setDoc(doc(db, `users/${dataOwnerId}/companyProfile`, 'profile'), p);
        }}
        systemConfig={systemConfig}
        onSystemConfigChange={(c) => {
            if(dataOwnerId) setDoc(doc(db, `users/${dataOwnerId}/systemConfig`, 'config'), c);
        }}
        onBackupData={() => {
            const backup = { products, bills, purchases, suppliers, customers, payments: supplierPayments, gstRates, companyProfile, systemConfig };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "backup.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        }}
        gstRates={gstRates}
        onAddGstRate={handleAddGstRate}
        onUpdateGstRate={handleUpdateGstRate}
        onDeleteGstRate={handleDeleteGstRate}
      />
    </div>
  );
}

export default App;

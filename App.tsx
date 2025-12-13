
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
    aiInvoiceUsageCount: 0,
  });
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  
  // Track where to return after editing a bill
  const [editReturnView, setEditReturnView] = useState<AppView | null>(null);
  // Track selected customer in Ledger to persist state across views
  const [ledgerCustomerId, setLedgerCustomerId] = useState<string | null>(null);

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
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as SystemConfig;
            setSystemConfig(data);
            
            // Check and set default AI Quota fields if missing
            if (data.aiInvoiceQuota === undefined || data.aiInvoiceUsageCount === undefined) {
                updateDoc(configRef, {
                    aiInvoiceQuota: data.aiInvoiceQuota ?? 5,
                    aiInvoiceUsageCount: data.aiInvoiceUsageCount ?? 0
                });
            }
        } else {
            // First time login - set defaults
            const defaultConfig: SystemConfig = {
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
                aiInvoiceUsageCount: 0,
            };
            setDoc(configRef, defaultConfig);
            setSystemConfig(defaultConfig);
        }
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
    const docRef = doc(db, `users/${dataOwnerId}/customers`, customerId);
    await updateDoc(docRef, data);
  };

  const handleAddCustomer = async (data: Omit<Customer, 'id' | 'balance'>): Promise<Customer | null> => {
    if (!dataOwnerId) return null;
    const docRef = await addDoc(collection(db, `users/${dataOwnerId}/customers`), { ...data, balance: data.openingBalance || 0 });
    return { id: docRef.id, ...data, balance: data.openingBalance || 0 };
  };

  const handleAddSalesman = async (data: Omit<Salesman, 'id'>): Promise<Salesman | null> => {
    if (!dataOwnerId) return null;
    const docRef = await addDoc(collection(db, `users/${dataOwnerId}/salesmen`), data);
    return { id: docRef.id, ...data };
  };

  const handleGenerateBill = async (billData: Omit<Bill, 'id' | 'billNumber'>): Promise<Bill | null> => {
    if (!dataOwnerId) return null;
    try {
      // 1. Generate Bill Number
      const billCount = bills.length + 1;
      const billNumber = `B-${String(billCount).padStart(4, '0')}`;
      
      const newBill: Bill = { ...billData, billNumber, id: '' }; // ID will be set by addDoc

      const batch = writeBatch(db);

      // 2. Create Bill Document
      const billRef = doc(collection(db, `users/${dataOwnerId}/bills`));
      batch.set(billRef, { ...newBill, id: billRef.id }); // Ensure ID is saved in doc if needed

      // 3. Update Product Stock (SALE: Minus Qty)
      // Batch Logic: batch.qty = batch.qty - sale.qty
      for (const item of billData.items) {
        const productRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
        const product = products.find(p => p.id === item.productId);
        
        if (product) {
          const updatedBatches = product.batches.map(b => {
            if (b.id === item.batchId) {
                // Determine quantity to deduct based on unitsPerStrip logic handled in Billing
                // item.quantity is the total units
                return { ...b, stock: b.stock - item.quantity };
            }
            return b;
          });
          batch.update(productRef, { batches: updatedBatches });
        }
      }

      // 4. Update Customer Balance if needed
      if (newBill.paymentMode === 'Credit' && newBill.customerId) {
          const customerRef = doc(db, `users/${dataOwnerId}/customers`, newBill.customerId);
          const customer = customers.find(c => c.id === newBill.customerId);
          if (customer) {
              const newBalance = customer.balance + newBill.grandTotal;
              batch.update(customerRef, { balance: newBalance });
          }
      }

      await batch.commit();
      return { ...newBill, id: billRef.id };
    } catch (e) {
      console.error("Error generating bill:", e);
      return null;
    }
  };

  const handleUpdateBill = async (billId: string, updatedBillData: Omit<Bill, 'id'>, originalBill: Bill): Promise<Bill | null> => {
      if (!dataOwnerId) return null;
      try {
          const batch = writeBatch(db);
          const billRef = doc(db, `users/${dataOwnerId}/bills`, billId);
          
          // 1. Revert Stock from Original Bill (Delete Sale effect: Add Qty back)
          // Relation: ProductId + BatchNo (implicitly via BatchId)
          for (const item of originalBill.items) {
              const productRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
              const product = products.find(p => p.id === item.productId);
              if (product) {
                  const updatedBatches = product.batches.map(b => {
                      if (b.id === item.batchId) {
                          return { ...b, stock: b.stock + item.quantity };
                      }
                      return b;
                  });
                  batch.update(productRef, { batches: updatedBatches });
              }
          }
          
          // Revert Customer Balance
          if (originalBill.paymentMode === 'Credit' && originalBill.customerId) {
              const custRef = doc(db, `users/${dataOwnerId}/customers`, originalBill.customerId);
              const customer = customers.find(c => c.id === originalBill.customerId);
              if (customer) {
                  batch.update(custRef, { balance: customer.balance - originalBill.grandTotal });
              }
          }

          // Commit Revert First (to safely handle potential same-doc updates if splitting logic)
          await batch.commit();

          // 2. Apply New Bill (New Sale: Minus Qty)
          const batch2 = writeBatch(db);
          batch2.update(billRef, updatedBillData);

          for (const item of updatedBillData.items) {
              const product = products.find(p => p.id === item.productId);
              if (product) {
                  // Optimization: Since we just committed the revert, 'products' state might not be updated yet in local React state.
                  // However, for consistency in this flow, we calculate the net difference manually or assume optimistic UI.
                  // For safety in this "Edit" flow:
                  // We fetch the 'reverted' state locally.
                  const originalItem = originalBill.items.find(i => i.batchId === item.batchId);
                  const returnedStock = originalItem ? originalItem.quantity : 0;
                  
                  // Calculate stock based on CURRENT state + REVERTED qty - NEW qty
                  const updatedBatches = product.batches.map(b => {
                      if (b.id === item.batchId) {
                          return { ...b, stock: b.stock + returnedStock - item.quantity };
                      }
                      return b;
                  });
                  const prodRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
                  batch2.update(prodRef, { batches: updatedBatches });
              }
          }

          if (updatedBillData.paymentMode === 'Credit' && updatedBillData.customerId) {
              const custRef = doc(db, `users/${dataOwnerId}/customers`, updatedBillData.customerId);
              const customer = customers.find(c => c.id === updatedBillData.customerId);
              if (customer) {
                  // Adjust balance: (Current - OldBill) + NewBill. 
                  // Since we reverted old bill in Step 1, balance in DB is (Current - OldBill). 
                  // But 'customer' object here is stale (has Current).
                  // So: NewDBBalance = (StaleBalance - OldBill) + NewBill
                  let bal = customer.balance;
                  if (originalBill.paymentMode === 'Credit' && originalBill.customerId === updatedBillData.customerId) {
                      bal -= originalBill.grandTotal;
                  }
                  batch2.update(custRef, { balance: bal + updatedBillData.grandTotal });
              }
          }

          await batch2.commit();
          return { id: billId, ...updatedBillData } as Bill;

      } catch (e) {
          console.error(e);
          return null;
      }
  };

  const onDeleteBill = async (bill: Bill) => {
      if (!dataOwnerId) return;
      if (!window.confirm("Are you sure you want to delete this bill? Stock will be restored.")) return;

      const batch = writeBatch(db);
      const billRef = doc(db, `users/${dataOwnerId}/bills`, bill.id);
      batch.delete(billRef);

      // Restore Stock (Delete Sale: Add Qty)
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
  };

  const handleUpdateBillDetails = async (billId: string, updates: Partial<Pick<Bill, 'customerName' | 'doctorName'>>) => {
      if (!dataOwnerId) return;
      await updateDoc(doc(db, `users/${dataOwnerId}/bills`, billId), updates);
  };

  const handleAddProduct = async (product: Omit<Product, 'id' | 'batches'>, firstBatch: Omit<Batch, 'id'>) => {
      if (!dataOwnerId) return;
      
      const newBatch: Batch = { ...firstBatch, id: Date.now().toString(), openingStock: firstBatch.stock };
      const newProduct = { ...product, batches: [newBatch] };
      
      const docRef = await addDoc(collection(db, `users/${dataOwnerId}/products`), newProduct);
      
      // Update Company List
      if (!companies.some(c => c.name === product.company)) {
          addDoc(collection(db, `users/${dataOwnerId}/companies`), { name: product.company });
      }
  };

  const handleUpdateProduct = async (productId: string, productData: any) => {
      if (!dataOwnerId) return;
      await updateDoc(doc(db, `users/${dataOwnerId}/products`, productId), productData);
  };

  const handleDeleteProduct = async (productId: string) => {
      if (!dataOwnerId) return;
      await deleteDoc(doc(db, `users/${dataOwnerId}/products`, productId));
  };

  const handleAddBatch = async (productId: string, batch: Omit<Batch, 'id'>) => {
      if (!dataOwnerId) return;
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const newBatch = { ...batch, id: Date.now().toString() };
      const updatedBatches = [...product.batches, newBatch];
      
      await updateDoc(doc(db, `users/${dataOwnerId}/products`, productId), { batches: updatedBatches });
  };

  const handleDeleteBatch = async (productId: string, batchId: string) => {
      if (!dataOwnerId) return;
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const updatedBatches = product.batches.filter(b => b.id !== batchId);
      await updateDoc(doc(db, `users/${dataOwnerId}/products`, productId), { batches: updatedBatches });
  };

  const handleBulkAddProducts = async (productsData: any[]): Promise<{success: number, skipped: number}> => {
      if (!dataOwnerId) return { success: 0, skipped: 0 };
      let success = 0;
      let skipped = 0;
      
      const batch = writeBatch(db);
      let opCount = 0;

      for (const p of productsData) {
          if (opCount >= 450) { 
              await batch.commit();
              opCount = 0;
          }
          const docRef = doc(collection(db, `users/${dataOwnerId}/products`));
          batch.set(docRef, { ...p, batches: [] }); 
          success++;
          opCount++;
      }
      if (opCount > 0) await batch.commit();
      
      return { success, skipped };
  };

  const handleAddPurchase = async (purchaseData: Omit<Purchase, 'id' | 'totalAmount'>) => {
      if (!dataOwnerId) return;
      
      try {
          const batch = writeBatch(db);
          const purchaseId = doc(collection(db, `users/${dataOwnerId}/purchases`)).id;
          
          let totalAmount = 0;
          
          // Workflow: Purchase (+ Qty)
          // Relation: ProductId + BatchNo
          for (const item of purchaseData.items) {
              const units = item.unitsPerStrip || 1;
              const quantityToAdd = item.quantity * units; // Convert to base units
              
              const lineTotal = item.quantity * item.purchasePrice * (1 + item.gst/100);
              totalAmount += lineTotal;

              if (item.isNewProduct) {
                  // Create New Product
                  const newProdRef = doc(collection(db, `users/${dataOwnerId}/products`));
                  const newBatch = {
                      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                      batchNumber: item.batchNumber,
                      expiryDate: item.expiryDate,
                      stock: quantityToAdd,
                      mrp: item.mrp,
                      purchasePrice: item.purchasePrice,
                      openingStock: quantityToAdd
                  };
                  batch.set(newProdRef, {
                      name: item.productName,
                      company: item.company,
                      hsnCode: item.hsnCode,
                      gst: item.gst,
                      barcode: item.barcode || null, // Sanitize: undefined to null
                      composition: item.composition || null,
                      unitsPerStrip: item.unitsPerStrip || 1,
                      isScheduleH: item.isScheduleH || false,
                      batches: [newBatch]
                  });
              } else if (item.productId) {
                  // Existing Product: Check if batch exists
                  const prodRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
                  const product = products.find(p => p.id === item.productId);
                  if (product) {
                      const existingBatchIndex = product.batches.findIndex(b => b.batchNumber === item.batchNumber);
                      let updatedBatches = [...product.batches];
                      
                      if (existingBatchIndex >= 0) {
                          // Batch Exists: Add to Stock (Purchase + Qty)
                          const existingBatch = updatedBatches[existingBatchIndex];
                          updatedBatches[existingBatchIndex] = {
                              ...existingBatch,
                              stock: existingBatch.stock + quantityToAdd,
                              purchasePrice: item.purchasePrice, // Update latest purchase price
                              mrp: item.mrp // Update latest MRP
                          };
                      } else {
                          // New Batch for existing product
                          updatedBatches.push({
                              id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                              batchNumber: item.batchNumber,
                              expiryDate: item.expiryDate,
                              stock: quantityToAdd,
                              mrp: item.mrp,
                              purchasePrice: item.purchasePrice,
                              openingStock: quantityToAdd
                          });
                      }
                      batch.update(prodRef, { batches: updatedBatches });
                  }
              }
          }

          const finalTotal = totalAmount + (purchaseData.roundOff || 0);

          const purchaseRef = doc(db, `users/${dataOwnerId}/purchases`, purchaseId);
          batch.set(purchaseRef, { ...purchaseData, totalAmount: finalTotal });

          // Update Supplier Balance (Purchase = Credit)
          const supplier = suppliers.find(s => s.name === purchaseData.supplier);
          if (supplier) {
              const suppRef = doc(db, `users/${dataOwnerId}/suppliers`, supplier.id);
              batch.update(suppRef, { openingBalance: (supplier.openingBalance || 0) + finalTotal });
          }

          await batch.commit();
      } catch (e) {
          console.error("Error adding purchase", e);
      }
  };

  const handleUpdatePurchase = async (id: string, updatedData: Omit<Purchase, 'id'>, originalPurchase: Purchase) => {
      if (!dataOwnerId) return;
      try {
          const batch = writeBatch(db);
          const purchaseRef = doc(db, `users/${dataOwnerId}/purchases`, id);

          // 1. Revert Original Purchase (Delete Effect: Minus Stock)
          for (const item of originalPurchase.items) {
              const product = products.find(p => p.id === item.productId || (!item.productId && p.name === item.productName));
              if (product) {
                  const units = item.unitsPerStrip || product.unitsPerStrip || 1;
                  const qtyToRemove = item.quantity * units;
                  
                  const updatedBatches = product.batches.map(b => {
                      if (b.batchNumber === item.batchNumber) {
                          return { ...b, stock: b.stock - qtyToRemove };
                      }
                      return b;
                  });
                  const prodRef = doc(db, `users/${dataOwnerId}/products`, product.id);
                  batch.update(prodRef, { batches: updatedBatches });
              }
          }

          // Revert Supplier Balance
          const oldSupplier = suppliers.find(s => s.name === originalPurchase.supplier);
          if (oldSupplier) {
              const suppRef = doc(db, `users/${dataOwnerId}/suppliers`, oldSupplier.id);
              batch.update(suppRef, { openingBalance: oldSupplier.openingBalance - originalPurchase.totalAmount });
          }

          await batch.commit();

          // 2. Apply New Purchase (Add Effect: Plus Stock)
          // Note: Logic similar to handleAddPurchase but updating an existing purchase doc
          const batch2 = writeBatch(db);
          batch2.update(purchaseRef, updatedData);

          let newTotalAmount = 0;

          for (const item of updatedData.items) {
              const lineTotal = item.quantity * item.purchasePrice * (1 + item.gst/100);
              newTotalAmount += lineTotal;

              const product = products.find(p => p.id === item.productId || (!item.productId && p.name === item.productName));
              if (product) {
                  // In this update flow, we assume we fetch the LATEST product state locally which is 'almost' correct 
                  // but technically we just subtracted stock in the previous batch commit.
                  // However, React state 'products' won't reflect that instantly.
                  // So we must manually adjust based on the same logic:
                  // Correct Stock = (LocalStateStock - OldQty) + NewQty
                  
                  // Find what we subtracted in step 1
                  const oldItem = originalPurchase.items.find(i => 
                      (i.productId === product.id) && (i.batchNumber === item.batchNumber)
                  );
                  const oldQtyBase = oldItem ? (oldItem.quantity * (oldItem.unitsPerStrip || 1)) : 0;
                  
                  const newUnits = item.unitsPerStrip || product.unitsPerStrip || 1;
                  const newQtyBase = item.quantity * newUnits;

                  const updatedBatches = product.batches.map(b => {
                      if (b.batchNumber === item.batchNumber) {
                          // The 'b.stock' here is from React state, which still has the Old Qty.
                          // So: Stock = CurrentState - OldQty + NewQty
                          return { ...b, stock: b.stock - oldQtyBase + newQtyBase };
                      }
                      return b;
                  });
                  const prodRef = doc(db, `users/${dataOwnerId}/products`, product.id);
                  batch2.update(prodRef, { batches: updatedBatches });
              }
          }

          // Apply New Supplier Balance
          // Note: updatedData.totalAmount is passed from the form, ensure it's correct or recalc.
          const finalTotal = updatedData.totalAmount; // Assuming form sends correct total
          
          const newSupplier = suppliers.find(s => s.name === updatedData.supplier);
          if (newSupplier) {
              let currentBal = newSupplier.openingBalance;
              if (originalPurchase.supplier === updatedData.supplier) {
                  currentBal -= originalPurchase.totalAmount; // Already deducted in Step 1 batch, but applied to a potentially stale object if same supplier
              }
              batch2.update(doc(db, `users/${dataOwnerId}/suppliers`, newSupplier.id), { 
                  openingBalance: currentBal + finalTotal 
              });
          }

          await batch2.commit();

      } catch (e) {
          console.error("Error updating purchase", e);
      }
  };

  const handleDeletePurchase = async (purchase: Purchase) => {
      if (!dataOwnerId) return;
      if (!window.confirm(`Delete Purchase Invoice ${purchase.invoiceNumber}? Stock will be deducted.`)) return;
      
      try {
          const batch = writeBatch(db);
          const purchaseRef = doc(db, `users/${dataOwnerId}/purchases`, purchase.id);
          batch.delete(purchaseRef);

          // Workflow: Delete Purchase -> Reverse Purchase -> Minus Stock
          for (const item of purchase.items) {
              // Find product by ID or Name
              const product = products.find(p => p.id === item.productId || (!item.productId && p.name === item.productName));
              
              if (product) {
                  const units = item.unitsPerStrip || product.unitsPerStrip || 1;
                  const qtyToRemove = item.quantity * units;

                  const updatedBatches = product.batches.map(b => {
                      // Strict matching on Batch Number
                      if (b.batchNumber === item.batchNumber) {
                          return { ...b, stock: b.stock - qtyToRemove };
                      }
                      return b;
                  });
                  const prodRef = doc(db, `users/${dataOwnerId}/products`, product.id);
                  batch.update(prodRef, { batches: updatedBatches });
              }
          }

          // Reverse Supplier Balance (Debit the supplier account)
          const supplier = suppliers.find(s => s.name === purchase.supplier);
          if (supplier) {
              const suppRef = doc(db, `users/${dataOwnerId}/suppliers`, supplier.id);
              batch.update(suppRef, { openingBalance: supplier.openingBalance - purchase.totalAmount });
          }

          await batch.commit();
      } catch (e) {
          console.error("Error deleting purchase", e);
          alert("Failed to delete purchase.");
      }
  };

  const handleAddSupplier = async (data: Omit<Supplier, 'id'>) => {
      if (!dataOwnerId) return null;
      const docRef = await addDoc(collection(db, `users/${dataOwnerId}/suppliers`), data);
      return { id: docRef.id, ...data };
  };

  const handleUpdateSupplier = async (id: string, data: Omit<Supplier, 'id'>) => {
      if (!dataOwnerId) return;
      await updateDoc(doc(db, `users/${dataOwnerId}/suppliers`, id), data);
  };

  const handleAddPayment = async (payment: Omit<Payment, 'id' | 'voucherNumber'>) => {
      if (!dataOwnerId) return null;
      const voucherNumber = `V-${Date.now().toString().slice(-6)}`;
      const docRef = await addDoc(collection(db, `users/${dataOwnerId}/payments`), { ...payment, voucherNumber });
      
      // Update Supplier Balance (Payment decreases balance)
      const supplier = suppliers.find(s => s.name === payment.supplierName);
      if (supplier) {
          await updateDoc(doc(db, `users/${dataOwnerId}/suppliers`, supplier.id), {
              openingBalance: (supplier.openingBalance || 0) - payment.amount
          });
      }
      return { id: docRef.id, voucherNumber, ...payment };
  };

  const handleAddCustomerPayment = async (payment: Omit<CustomerPayment, 'id'>) => {
      if (!dataOwnerId) return;
      await addDoc(collection(db, `users/${dataOwnerId}/customerPayments`), payment);
      
      const customerRef = doc(db, `users/${dataOwnerId}/customers`, payment.customerId);
      const customer = customers.find(c => c.id === payment.customerId);
      if (customer) {
          await updateDoc(customerRef, { balance: customer.balance - payment.amount });
      }
  };

  const handleUpdateCustomerPayment = async (id: string, data: Omit<CustomerPayment, 'id'>) => {
      if (!dataOwnerId) return;
      // Need old payment to adjust balance diff
      const oldPayment = customerPayments.find(p => p.id === id);
      if (oldPayment) {
          const diff = data.amount - oldPayment.amount;
          const customerRef = doc(db, `users/${dataOwnerId}/customers`, data.customerId);
          const customer = customers.find(c => c.id === data.customerId);
          if (customer) {
              await updateDoc(customerRef, { balance: customer.balance - diff });
          }
      }
      await updateDoc(doc(db, `users/${dataOwnerId}/customerPayments`, id), data);
  };

  const handleDeleteCustomerPayment = async (payment: CustomerPayment) => {
      if (!dataOwnerId) return;
      await deleteDoc(doc(db, `users/${dataOwnerId}/customerPayments`, payment.id));
      
      const customerRef = doc(db, `users/${dataOwnerId}/customers`, payment.customerId);
      const customer = customers.find(c => c.id === payment.customerId);
      if (customer) {
          await updateDoc(customerRef, { balance: customer.balance + payment.amount });
      }
  };

  // Render logic...
  if (authLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!currentUser) return <Auth />;
  if (dataLoading) return <div className="flex h-screen items-center justify-center">Loading Data...</div>;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-200">
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenSettings={() => setSettingsModalOpen(true)}
        user={currentUser}
        onLogout={() => signOut(auth)}
        systemConfig={systemConfig}
        userPermissions={userPermissions}
        isOperator={isOperator}
      />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeView === 'dashboard' && (
            <SalesDashboard bills={bills} products={products} systemConfig={systemConfig} />
        )}
        
        {activeView === 'billing' && (!isOperator || userPermissions?.canBill) && (
            <Billing 
                products={products}
                bills={bills}
                customers={customers}
                salesmen={salesmen}
                companyProfile={companyProfile}
                systemConfig={systemConfig}
                onGenerateBill={handleGenerateBill}
                onUpdateBill={handleUpdateBill}
                editingBill={editingBill}
                onCancelEdit={() => { setEditingBill(null); if(editReturnView) setActiveView(editReturnView); }}
                onAddCustomer={handleAddCustomer}
                onAddSalesman={handleAddSalesman}
            />
        )}

        {activeView === 'inventory' && (!isOperator || userPermissions?.canInventory) && (
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

        {activeView === 'purchases' && (!isOperator || userPermissions?.canPurchase) && (
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
                onUpdateConfig={(cfg) => setSystemConfig(cfg)}
            />
        )}

        {activeView === 'paymentEntry' && (!isOperator || userPermissions?.canPayment) && (
            <PaymentEntry 
                suppliers={suppliers}
                payments={payments}
                companyProfile={companyProfile}
                onAddPayment={handleAddPayment}
                onUpdatePayment={(id, p) => console.log('Update payment not impl yet')}
                onDeletePayment={(id) => console.log('Delete payment not impl yet')}
            />
        )}

        {/* Reports Views */}
        {activeView === 'daybook' && (!isOperator || userPermissions?.canReports) && (
            <DayBook 
                bills={bills}
                companyProfile={companyProfile}
                systemConfig={systemConfig}
                onDeleteBill={onDeleteBill}
                onEditBill={(bill) => { setEditingBill(bill); setEditReturnView('daybook'); setActiveView('billing'); }}
                onUpdateBillDetails={handleUpdateBillDetails}
            />
        )}

        {activeView === 'suppliersLedger' && (!isOperator || userPermissions?.canReports) && (
            <SuppliersLedger 
                suppliers={suppliers}
                purchases={purchases}
                payments={payments}
                companyProfile={companyProfile}
                onUpdateSupplier={handleUpdateSupplier}
                onAddPayment={handleAddPayment}
            />
        )}

        {activeView === 'customerLedger' && (!isOperator || userPermissions?.canReports) && (
            <CustomerLedger 
                customers={customers}
                bills={bills}
                payments={customerPayments}
                companyProfile={companyProfile}
                initialCustomerId={ledgerCustomerId}
                onCustomerSelected={setLedgerCustomerId}
                onAddPayment={handleAddCustomerPayment}
                onUpdateCustomer={handleUpdateCustomer}
                onEditBill={(bill) => { setEditingBill(bill); setEditReturnView('customerLedger'); setActiveView('billing'); }}
                onDeleteBill={onDeleteBill}
                onUpdatePayment={handleUpdateCustomerPayment}
                onDeletePayment={handleDeleteCustomerPayment}
            />
        )}

        {activeView === 'salesReport' && (!isOperator || userPermissions?.canReports) && (
            <SalesReport bills={bills} />
        )}

        {activeView === 'salesmanReport' && (!isOperator || userPermissions?.canReports) && (
            <SalesmanReport bills={bills} salesmen={salesmen} />
        )}

        {activeView === 'companyWiseSale' && (!isOperator || userPermissions?.canReports) && (
            <CompanyWiseSale bills={bills} products={products} systemConfig={systemConfig} />
        )}

        {activeView === 'companyWiseBillWiseProfit' && (!isOperator || userPermissions?.canReports) && (
            <CompanyWiseBillWiseProfit bills={bills} products={products} />
        )}

        {activeView === 'chequePrint' && (!isOperator || userPermissions?.canReports) && (
            <ChequePrint systemConfig={systemConfig} onUpdateConfig={(cfg) => setSystemConfig(cfg)} />
        )}

      </main>

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        companyProfile={companyProfile}
        onProfileChange={async (p) => { if (dataOwnerId) await setDoc(doc(db, `users/${dataOwnerId}/companyProfile`, 'profile'), p); }}
        systemConfig={systemConfig}
        onSystemConfigChange={async (c) => { if (dataOwnerId) await setDoc(doc(db, `users/${dataOwnerId}/systemConfig`, 'config'), c); }}
        onBackupData={() => {
            const data = { products, bills, purchases, companies, suppliers, customers, payments, systemConfig, companyProfile };
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `backup_${new Date().toISOString()}.json`;
            link.click();
        }}
        gstRates={gstRates}
        onAddGstRate={async (r) => { if (dataOwnerId) await addDoc(collection(db, `users/${dataOwnerId}/gstRates`), { rate: r }); }}
        onUpdateGstRate={async (id, r) => { if (dataOwnerId) await updateDoc(doc(db, `users/${dataOwnerId}/gstRates`, id), { rate: r }); }}
        onDeleteGstRate={async (id) => { if (dataOwnerId) await deleteDoc(doc(db, `users/${dataOwnerId}/gstRates`, id)); }}
      />
    </div>
  );
};

export default App;

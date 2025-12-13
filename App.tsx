import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  query,
  orderBy
} from 'firebase/firestore';

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
import CompanyWiseSale from './components/CompanyWiseSale';
import CompanyWiseBillWiseProfit from './components/CompanyWiseBillWiseProfit';
import SalesmanReport from './components/SalesmanReport';
import ChequePrint from './components/ChequePrint';

import { 
  Product, 
  Bill, 
  Purchase, 
  Supplier, 
  Customer, 
  CustomerPayment, 
  Payment, 
  CompanyProfile, 
  SystemConfig, 
  AppView, 
  GstRate, 
  Salesman,
  Company,
  UserPermissions
} from './types';

const defaultSystemConfig: SystemConfig = {
  softwareMode: 'Retail',
  invoicePrintingFormat: 'Thermal',
  mrpEditable: true,
  barcodeScannerOpenByDefault: true,
  maintainCustomerLedger: true,
  enableSalesman: false,
  language: 'en'
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'operator'>('admin');
  const [userPermissions, setUserPermissions] = useState<UserPermissions | undefined>(undefined);
  
  const [activeView, setActiveView] = useState<AppView>('billing');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]); // Supplier Payments
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [gstRates, setGstRates] = useState<GstRate[]>([]);
  
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({ name: '', address: '', gstin: '' });
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(defaultSystemConfig);

  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Resolve Data Owner
        try {
          const mappingRef = doc(db, 'userMappings', currentUser.uid);
          const mappingSnap = await getDoc(mappingRef);
          
          if (mappingSnap.exists()) {
            const data = mappingSnap.data();
            setDataOwnerId(data.ownerId);
            setUserRole(data.role);
            if (data.role === 'operator') {
               const subUserRef = doc(db, `users/${data.ownerId}/subUsers`, currentUser.uid);
               const subUserSnap = await getDoc(subUserRef);
               if (subUserSnap.exists()) {
                   setUserPermissions(subUserSnap.data().permissions);
               }
            }
          } else {
            // Assume Admin/Owner if no mapping exists (Legacy or First-time)
            setDataOwnerId(currentUser.uid);
            setUserRole('admin');
            await setDoc(mappingRef, { ownerId: currentUser.uid, role: 'admin' });
          }
        } catch (e) {
          console.error("Error resolving user role:", e);
          // Fallback
          setDataOwnerId(currentUser.uid);
          setUserRole('admin');
        }
      } else {
        setDataOwnerId(null);
        setProducts([]);
        setBills([]);
        setPurchases([]);
        setSuppliers([]);
        setCustomers([]);
        setCustomerPayments([]);
        setPayments([]);
        setSalesmen([]);
        setCompanies([]);
        setGstRates([]);
        setEditingBill(null);
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

    const unsubCustPayments = onSnapshot(collection(db, `${basePath}/customerPayments`), (snap) => {
      setCustomerPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerPayment)));
    });

    const unsubPayments = onSnapshot(collection(db, `${basePath}/payments`), (snap) => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
    });

    const unsubSalesmen = onSnapshot(collection(db, `${basePath}/salesmen`), (snap) => {
      setSalesmen(snap.docs.map(d => ({ id: d.id, ...d.data() } as Salesman)));
    });

    const unsubCompanies = onSnapshot(collection(db, `${basePath}/companies`), (snap) => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company)));
    });

    const unsubGst = onSnapshot(collection(db, `${basePath}/gstRates`), (snap) => {
      setGstRates(snap.docs.map(d => ({ id: d.id, ...d.data() } as GstRate)));
    });

    const unsubProfile = onSnapshot(doc(db, `${basePath}/companyProfile`, 'profile'), (snap) => {
      if (snap.exists()) setCompanyProfile(snap.data() as CompanyProfile);
    });

    const unsubConfig = onSnapshot(doc(db, `${basePath}/systemConfig`, 'config'), (snap) => {
      if (snap.exists()) setSystemConfig({ ...defaultSystemConfig, ...snap.data() });
    });

    return () => {
      unsubProducts(); unsubBills(); unsubPurchases(); unsubSuppliers(); 
      unsubCustomers(); unsubCustPayments(); unsubPayments(); unsubSalesmen();
      unsubCompanies(); unsubGst(); unsubProfile(); unsubConfig();
    };
  }, [dataOwnerId]);

  // --- Handlers ---

  const handleAddProduct = async (productData: Omit<Product, 'id'>) => {
    if (!dataOwnerId) return;
    await addDoc(collection(db, `users/${dataOwnerId}/products`), productData);
    
    // Check and add company if new
    if (!companies.some(c => c.name.toLowerCase() === productData.company.toLowerCase())) {
        await addDoc(collection(db, `users/${dataOwnerId}/companies`), { name: productData.company });
    }
  };

  const handleUpdateProduct = async (id: string, updates: Partial<Product>) => {
    if (!dataOwnerId) return;
    await updateDoc(doc(db, `users/${dataOwnerId}/products`, id), updates);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!dataOwnerId) return;
    await deleteDoc(doc(db, `users/${dataOwnerId}/products`, id));
  };

  const handleGenerateBill = async (billData: Omit<Bill, 'id' | 'billNumber'>): Promise<Bill | null> => {
    if (!dataOwnerId) return null;
    
    // Generate Bill Number
    const count = bills.length + 1;
    const billNumber = `BILL-${String(count).padStart(4, '0')}`;
    const fullBill = { ...billData, billNumber };

    const batch = writeBatch(db);
    
    // 1. Save Bill
    const billRef = doc(collection(db, `users/${dataOwnerId}/bills`));
    batch.set(billRef, fullBill);

    // 2. Update Stock
    for (const item of fullBill.items) {
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

    // 3. Update Customer Balance (if applicable)
    if (systemConfig.maintainCustomerLedger && fullBill.customerId) {
        const customerRef = doc(db, `users/${dataOwnerId}/customers`, fullBill.customerId);
        const customer = customers.find(c => c.id === fullBill.customerId);
        if (customer) {
            const currentBalance = customer.balance || 0;
            const newBalance = currentBalance + fullBill.grandTotal; // Debit increases
            batch.update(customerRef, { balance: newBalance });
        }
    }

    await batch.commit();
    return { id: billRef.id, ...fullBill };
  };

  const handleUpdateBill = async (id: string, billData: Omit<Bill, 'id'>, originalBill: Bill): Promise<Bill | null> => {
      if (!dataOwnerId) return null;
      
      const batch = writeBatch(db);
      const billRef = doc(db, `users/${dataOwnerId}/bills`, id);
      batch.update(billRef, billData);

      // Revert stock from original bill
      for (const item of originalBill.items) {
          const productRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
          const product = products.find(p => p.id === item.productId);
          if (product) {
              const bIndex = product.batches.findIndex(b => b.id === item.batchId);
              if (bIndex !== -1) {
                  product.batches[bIndex].stock += item.quantity;
                  // We can't batch update same doc multiple times easily in loop logic without careful merging
                  // Simplified: we assume re-fetch or optimistically we handle complex merge.
                  // For robustness in this snippet, we just queue updates. 
                  // Warning: Multiple updates to same doc in one batch is not allowed. 
                  // Correct way: Calculate net change for each product batch.
              }
          }
      }
      
      // Calculate net changes (Simplification: We will just write the final state if possible, but Firestore batch limits.
      // Better approach for update is: Revert old stock -> Apply new stock.
      // Since we can't do logic inside batch easily without reading, we assume products state is fresh.)
      
      // A more robust way given the complexity is to let the user correct stock manually or 
      // handle simple cases. For this app, let's implement a 'smart' update.
      
      // Map to store latest batch state for products involved
      const productBatchMap = new Map<string, any[]>();
      
      // 1. Revert Old
      for (const item of originalBill.items) {
          const pid = item.productId;
          let batches = productBatchMap.get(pid);
          if (!batches) {
              const p = products.find(prod => prod.id === pid);
              if (p) batches = [...p.batches];
          }
          
          if (batches) {
              const bIndex = batches.findIndex((b: any) => b.id === item.batchId);
              if (bIndex !== -1) {
                  batches[bIndex].stock += item.quantity;
              }
              productBatchMap.set(pid, batches);
          }
      }

      // 2. Apply New
      for (const item of billData.items) {
          const pid = item.productId;
          let batches = productBatchMap.get(pid);
          if (!batches) {
              const p = products.find(prod => prod.id === pid);
              if (p) batches = [...p.batches];
          }
          
          if (batches) {
              const bIndex = batches.findIndex((b: any) => b.id === item.batchId);
              if (bIndex !== -1) {
                  batches[bIndex].stock -= item.quantity;
              }
              productBatchMap.set(pid, batches);
          }
      }

      // 3. Commit Product Updates
      productBatchMap.forEach((batches, pid) => {
          const pRef = doc(db, `users/${dataOwnerId}/products`, pid);
          batch.update(pRef, { batches });
      });

      // 4. Update Customer Ledger
      if (systemConfig.maintainCustomerLedger) {
          // Revert old balance effect
          if (originalBill.customerId) {
              const oldCustRef = doc(db, `users/${dataOwnerId}/customers`, originalBill.customerId);
              // Note: This logic assumes 'customers' state is fresh.
              // We need to calculate net diff.
              // To be safe, we only support updating ledger if customer matches or handle simple switch.
              // For now, simpler: Update current customer only.
          }
          
          if (billData.customerId) {
               const custRef = doc(db, `users/${dataOwnerId}/customers`, billData.customerId);
               const cust = customers.find(c => c.id === billData.customerId);
               if (cust) {
                   // If same customer, diff amount. If diff customer, handle separately (complex).
                   if (originalBill.customerId === billData.customerId) {
                       const diff = billData.grandTotal - originalBill.grandTotal;
                       batch.update(custRef, { balance: (cust.balance || 0) + diff });
                   } else {
                       // Handle switch: Credit old, Debit new
                       if (originalBill.customerId) {
                           const oldCust = customers.find(c => c.id === originalBill.customerId);
                           if (oldCust) {
                               const oldRef = doc(db, `users/${dataOwnerId}/customers`, originalBill.customerId);
                               batch.update(oldRef, { balance: (oldCust.balance || 0) - originalBill.grandTotal });
                           }
                       }
                       batch.update(custRef, { balance: (cust.balance || 0) + billData.grandTotal });
                   }
               }
          }
      }

      await batch.commit();
      setEditingBill(null);
      return { id, ...billData } as Bill;
  };

  const handleAddPurchase = async (purchaseData: Omit<Purchase, 'id' | 'totalAmount'>) => {
    if (!dataOwnerId) return;
    
    // Calculate total amount
    const totalAmount = purchaseData.items.reduce((sum, item) => {
        const taxable = item.purchasePrice * item.quantity * (1 - (item.discount || 0)/100);
        const tax = taxable * (item.gst / 100);
        return sum + taxable + tax;
    }, 0) + (purchaseData.roundOff || 0);

    const fullPurchase = { ...purchaseData, totalAmount };
    const batch = writeBatch(db);

    // 1. Save Purchase
    const purchaseRef = doc(collection(db, `users/${dataOwnerId}/purchases`));
    batch.set(purchaseRef, fullPurchase);

    // 2. Update/Create Products & Batches
    const productUpdates = new Map<string, any>(); // Map to store batched product updates

    // Create a temporary lookup to handle multiple items for same product
    const tempProducts = [...products];

    for (const item of fullPurchase.items) {
        let product = item.productId 
            ? tempProducts.find(p => p.id === item.productId)
            : tempProducts.find(p => p.name === item.productName && p.company === item.company);

        // New Batch Object
        const newBatch = {
            id: item.batchId || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            stock: item.quantity * (item.unitsPerStrip || 1),
            openingStock: item.quantity * (item.unitsPerStrip || 1), // Track purchase qty as opening for this batch context
            mrp: item.mrp,
            purchasePrice: item.purchasePrice
        };

        if (product) {
            // Update Existing Product
            // Check if we already have a pending update for this product in our map
            let batches = productUpdates.get(product.id)?.batches || product.batches;
            
            // Check if batch exists (merge stock) or add new
            const existingBatchIndex = batches.findIndex((b: any) => b.batchNumber === item.batchNumber);
            if (existingBatchIndex !== -1) {
                // Update existing batch stock
                const existingBatch = batches[existingBatchIndex];
                batches[existingBatchIndex] = {
                    ...existingBatch,
                    stock: existingBatch.stock + newBatch.stock,
                    // Update prices if needed? Usually purchase updates latest cost
                    purchasePrice: newBatch.purchasePrice,
                    mrp: newBatch.mrp
                };
            } else {
                batches.push(newBatch);
            }
            
            productUpdates.set(product.id, { batches });
            // Update temp array for subsequent items in loop
            product.batches = batches; 
        } else {
            // Create New Product
            const newProductRef = doc(collection(db, `users/${dataOwnerId}/products`));
            const newProductData = {
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
            batch.set(newProductRef, newProductData);
            
            // Add to temp array
            tempProducts.push({ id: newProductRef.id, ...newProductData });
            
            // Handle Company creation if needed
            if (!companies.some(c => c.name.toLowerCase() === item.company.toLowerCase())) {
                 const compRef = doc(collection(db, `users/${dataOwnerId}/companies`));
                 batch.set(compRef, { name: item.company });
                 companies.push({ id: compRef.id, name: item.company }); // Optimistic update for loop
            }
        }
    }

    // Apply product updates to batch
    productUpdates.forEach((data, productId) => {
        const ref = doc(db, `users/${dataOwnerId}/products`, productId);
        batch.update(ref, data);
    });

    // 3. Update Supplier Ledger
    // Find supplier
    const supplier = suppliers.find(s => s.name === fullPurchase.supplier);
    if (supplier) {
        // We don't need to update 'openingBalance' field on supplier for every purchase.
        // The ledger is calculated dynamically from purchases and payments.
        // However, if you want a static balance field for quick lookup:
        // const newBalance = (supplier.openingBalance || 0) + totalAmount; // Credit increases balance (liability)
        // batch.update(doc(db, `users/${dataOwnerId}/suppliers`, supplier.id), { balance: newBalance });
    } else {
        // Create supplier if not exists
        const supRef = doc(collection(db, `users/${dataOwnerId}/suppliers`));
        batch.set(supRef, { 
            name: fullPurchase.supplier, 
            address: '', phone: '', gstin: '', 
            openingBalance: 0 
        });
    }

    await batch.commit();
  };

  const handleUpdatePurchase = async (id: string, updatedData: Omit<Purchase, 'id'>, originalPurchase: Purchase) => {
      // For now, simple alert as reversal logic is complex.
      // In real app: Revert original purchase effects -> Apply new purchase effects.
      // Or: Delete original (revert) -> Add new.
      alert("Update Purchase is not fully implemented in this demo due to complexity of stock reversal. Please delete and re-entry.");
  };

  // The requested function
  const handleDeletePurchase = async (purchase: Purchase) => {
      if (!dataOwnerId) return;
      if (!window.confirm(`Delete Purchase Invoice ${purchase.invoiceNumber}? Stock will be reversed and deducted from inventory.`)) return;
      
      try {
          const batchWrite = writeBatch(db);
          
          // 1. Delete Purchase Document
          const purchaseRef = doc(db, `users/${dataOwnerId}/purchases`, purchase.id);
          batchWrite.delete(purchaseRef);

          // 2. Reverse Stock Logic
          const productUpdates = new Map<string, any[]>(); 

          // Create a temporary lookup for products
          const tempProducts = JSON.parse(JSON.stringify(products)) as Product[];

          for (const item of purchase.items) {
              let product: Product | undefined;

              // Try finding by ID first
              if (item.productId) {
                  product = tempProducts.find(p => p.id === item.productId);
              }
              
              // Fallback: Find by Name & Company if ID not found
              if (!product) {
                  product = tempProducts.find(p => p.name === item.productName && p.company === item.company);
              }

              if (product) {
                  // Find the specific batch
                  const batchIndex = product.batches.findIndex(b => b.batchNumber === item.batchNumber);
                  
                  if (batchIndex !== -1) {
                      const batch = product.batches[batchIndex];
                      
                      // Deduct from Current Stock
                      batch.stock = Math.max(0, batch.stock - item.quantity);
                      
                      // Deduct from Opening Stock if applicable
                      if (batch.openingStock !== undefined) {
                          batch.openingStock = Math.max(0, batch.openingStock - item.quantity);
                      } else {
                          batch.openingStock = 0;
                      }

                      // Mark this product for update
                      productUpdates.set(product.id, product.batches);
                  }
              }
          }

          // Apply all product batch updates
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

  const handleAddPayment = async (paymentData: Omit<Payment, 'id' | 'voucherNumber'>) => {
      if (!dataOwnerId) return null;
      // Generate Voucher No
      const count = payments.length + 1;
      const voucherNumber = `VCH-${String(count).padStart(4, '0')}`;
      const fullPayment = { ...paymentData, voucherNumber };
      
      const ref = await addDoc(collection(db, `users/${dataOwnerId}/payments`), fullPayment);
      return { id: ref.id, ...fullPayment };
  };

  const handleUpdatePayment = async (id: string, data: Omit<Payment, 'id'>) => {
      if (!dataOwnerId) return;
      await updateDoc(doc(db, `users/${dataOwnerId}/payments`, id), data);
  };

  const handleDeletePayment = async (id: string) => {
      if (!dataOwnerId) return;
      if (!window.confirm("Delete this payment voucher?")) return;
      await deleteDoc(doc(db, `users/${dataOwnerId}/payments`, id));
  };

  const handleAddCustomer = async (data: Omit<Customer, 'id' | 'balance'>): Promise<Customer | null> => {
      if (!dataOwnerId) return null;
      const fullData = { ...data, balance: data.openingBalance || 0 };
      const ref = await addDoc(collection(db, `users/${dataOwnerId}/customers`), fullData);
      return { id: ref.id, ...fullData };
  };

  const handleUpdateCustomer = async (id: string, data: Partial<Customer>) => {
      if (!dataOwnerId) return;
      await updateDoc(doc(db, `users/${dataOwnerId}/customers`, id), data);
  };

  const handleAddCustomerPayment = async (payment: Omit<CustomerPayment, 'id'>) => {
      if (!dataOwnerId) return;
      const batch = writeBatch(db);
      
      // 1. Add Payment Record
      const payRef = doc(collection(db, `users/${dataOwnerId}/customerPayments`));
      batch.set(payRef, payment);

      // 2. Update Customer Balance (Credit balance decreases, i.e., subtraction from positive debit balance)
      const custRef = doc(db, `users/${dataOwnerId}/customers`, payment.customerId);
      const customer = customers.find(c => c.id === payment.customerId);
      if (customer) {
          batch.update(custRef, { balance: (customer.balance || 0) - payment.amount });
      }

      await batch.commit();
  };

  const handleUpdateCustomerPayment = async (id: string, data: Omit<CustomerPayment, 'id'>) => {
      if (!dataOwnerId) return;
      const oldPayment = customerPayments.find(p => p.id === id);
      if (!oldPayment) return;

      const batch = writeBatch(db);
      
      // Update Payment
      const payRef = doc(db, `users/${dataOwnerId}/customerPayments`, id);
      batch.update(payRef, data);

      // Adjust Customer Balance
      // Revert old: Add back amount
      // Apply new: Subtract new amount
      if (oldPayment.customerId === data.customerId) {
          const custRef = doc(db, `users/${dataOwnerId}/customers`, data.customerId);
          const customer = customers.find(c => c.id === data.customerId);
          if (customer) {
              const netChange = oldPayment.amount - data.amount; // e.g. 500 - 400 = 100. Balance increases by 100 (less paid)
              batch.update(custRef, { balance: (customer.balance || 0) + netChange });
          }
      }

      await batch.commit();
  };

  const handleDeleteCustomerPayment = async (payment: CustomerPayment) => {
      if (!dataOwnerId) return;
      if (!window.confirm("Delete this receipt? Customer balance will increase.")) return;

      const batch = writeBatch(db);
      batch.delete(doc(db, `users/${dataOwnerId}/customerPayments`, payment.id));
      
      // Revert balance (Add amount back to debit balance)
      const custRef = doc(db, `users/${dataOwnerId}/customers`, payment.customerId);
      const customer = customers.find(c => c.id === payment.customerId);
      if (customer) {
          batch.update(custRef, { balance: (customer.balance || 0) + payment.amount });
      }
      
      await batch.commit();
  };

  const handleDeleteBill = async (bill: Bill) => {
      if (!dataOwnerId) return;
      if (!window.confirm(`Delete Bill ${bill.billNumber}? Stock will be restored.`)) return;

      const batch = writeBatch(db);
      
      // 1. Delete Bill
      batch.delete(doc(db, `users/${dataOwnerId}/bills`, bill.id));

      // 2. Restore Stock
      for (const item of bill.items) {
          const prodRef = doc(db, `users/${dataOwnerId}/products`, item.productId);
          const product = products.find(p => p.id === item.productId);
          if (product) {
              const updatedBatches = product.batches.map(b => {
                  if (b.id === item.batchId) return { ...b, stock: b.stock + item.quantity };
                  return b;
              });
              batch.update(prodRef, { batches: updatedBatches });
          }
      }

      // 3. Revert Customer Ledger if Credit
      if (bill.paymentMode === 'Credit' && bill.customerId && systemConfig.maintainCustomerLedger) {
          const custRef = doc(db, `users/${dataOwnerId}/customers`, bill.customerId);
          const customer = customers.find(c => c.id === bill.customerId);
          if (customer) {
              batch.update(custRef, { balance: (customer.balance || 0) - bill.grandTotal });
          }
      }

      await batch.commit();
  };

  const handleAddSalesman = async (data: Omit<Salesman, 'id'>) => {
      if (!dataOwnerId) return null;
      const ref = await addDoc(collection(db, `users/${dataOwnerId}/salesmen`), data);
      return { id: ref.id, ...data };
  };

  const handleUpdateConfig = async (newConfig: SystemConfig) => {
      if (!dataOwnerId) return;
      await setDoc(doc(db, `users/${dataOwnerId}/systemConfig`, 'config'), newConfig);
  };

  const handleUpdateProfile = async (newProfile: CompanyProfile) => {
      if (!dataOwnerId) return;
      await setDoc(doc(db, `users/${dataOwnerId}/companyProfile`, 'profile'), newProfile);
  };

  const handleLogout = async () => {
      await signOut(auth);
  };

  const handleBackupData = () => {
      const data = {
          products, bills, purchases, suppliers, customers, payments, customerPayments,
          companyProfile, systemConfig, gstRates
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
        onLogout={handleLogout}
        systemConfig={systemConfig}
        userPermissions={userPermissions}
        isOperator={userRole === 'operator'}
      />
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {activeView === 'billing' && (
          <Billing 
            products={products}
            bills={bills}
            customers={customers}
            salesmen={salesmen}
            companyProfile={companyProfile}
            systemConfig={systemConfig}
            onGenerateBill={handleGenerateBill}
            editingBill={editingBill}
            onUpdateBill={handleUpdateBill}
            onCancelEdit={() => { setEditingBill(null); setActiveView('billing'); }}
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
            onUpdatePurchase={handleUpdatePurchase}
            onDeletePurchase={handleDeletePurchase}
            onAddSupplier={handleAddSupplier}
            onUpdateConfig={handleUpdateConfig}
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

        {activeView === 'dashboard' && (
            <SalesDashboard 
                bills={bills} 
                products={products}
                systemConfig={systemConfig}
            />
        )}

        {activeView === 'daybook' && (
            <DayBook 
                bills={bills} 
                companyProfile={companyProfile} 
                systemConfig={systemConfig}
                onDeleteBill={handleDeleteBill}
                onEditBill={(bill) => { setEditingBill(bill); setActiveView('billing'); }}
                onUpdateBillDetails={async (id, updates) => {
                    if (dataOwnerId) await updateDoc(doc(db, `users/${dataOwnerId}/bills`, id), updates);
                }}
            />
        )}

        {activeView === 'suppliersLedger' && (
            <SuppliersLedger 
                suppliers={suppliers}
                purchases={purchases}
                payments={payments}
                companyProfile={companyProfile}
                onUpdateSupplier={handleUpdateSupplier}
                onAddPayment={handleAddPayment}
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
                onEditBill={(bill) => { setEditingBill(bill); setActiveView('billing'); }}
                onDeleteBill={handleDeleteBill}
                onUpdatePayment={handleUpdateCustomerPayment}
                onDeletePayment={handleDeleteCustomerPayment}
            />
        )}

        {activeView === 'salesReport' && (
            <SalesReport bills={bills} />
        )}

        {activeView === 'salesmanReport' && (
            <SalesmanReport bills={bills} salesmen={salesmen} />
        )}

        {activeView === 'companyWiseSale' && (
            <CompanyWiseSale bills={bills} products={products} systemConfig={systemConfig} />
        )}

        {activeView === 'companyWiseBillWiseProfit' && (
            <CompanyWiseBillWiseProfit bills={bills} products={products} />
        )}

        {activeView === 'chequePrint' && (
            <ChequePrint systemConfig={systemConfig} onUpdateConfig={handleUpdateConfig} />
        )}
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        companyProfile={companyProfile}
        onProfileChange={handleUpdateProfile}
        systemConfig={systemConfig}
        onSystemConfigChange={handleUpdateConfig}
        onBackupData={handleBackupData}
        gstRates={gstRates}
        onAddGstRate={async (rate) => { if(dataOwnerId) await addDoc(collection(db, `users/${dataOwnerId}/gstRates`), { rate }); }}
        onUpdateGstRate={async (id, rate) => { if(dataOwnerId) await updateDoc(doc(db, `users/${dataOwnerId}/gstRates`, id), { rate }); }}
        onDeleteGstRate={async (id) => { if(dataOwnerId) await deleteDoc(doc(db, `users/${dataOwnerId}/gstRates`, id)); }}
      />
    </div>
  );
};

export default App;


import React, { useState } from 'react';
import type { AppView, Product, Batch, Bill, Purchase, PurchaseLineItem } from './types';
import Header from './components/Header';
import Billing from './components/Billing';
import Inventory from './components/Inventory';
import DayBook from './components/DayBook';
import Purchases from './components/Purchases';

// Mock Data
const initialProducts: Product[] = [
  {
    id: 'prod_1', name: 'Paracetamol 500mg', company: 'Cipla', hsnCode: '3004', gst: 12,
    batches: [
      { id: 'b1_1', batchNumber: 'P500A', expiryDate: '2025-12', stock: 150, mrp: 25.50, purchasePrice: 18.00 },
      { id: 'b1_2', batchNumber: 'P500B', expiryDate: '2026-06', stock: 200, mrp: 26.00, purchasePrice: 18.50 },
    ]
  },
  {
    id: 'prod_2', name: 'Aspirin 75mg', company: 'Sun Pharma', hsnCode: '3004', gst: 12,
    batches: [
      { id: 'b2_1', batchNumber: 'ASP75X', expiryDate: '2024-10', stock: 80, mrp: 15.00, purchasePrice: 10.20 },
    ]
  },
  {
    id: 'prod_3', name: 'Vitamin C 1000mg', company: 'Abbott', hsnCode: '3004', gst: 18,
    batches: [
      { id: 'b3_1', batchNumber: 'VTC1K', expiryDate: '2025-08', stock: 300, mrp: 99.00, purchasePrice: 75.00 },
    ]
  },
   {
    id: 'prod_4', name: 'Cetirizine 10mg', company: 'Dr. Reddy\'s', hsnCode: '3004', gst: 5,
    batches: [
      { id: 'b4_1', batchNumber: 'CET10-R', expiryDate: '2026-02', stock: 250, mrp: 32.00, purchasePrice: 24.50 },
    ]
  },
];


const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>('billing');
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const handleAddProduct = (productData: Omit<Product, 'id' | 'batches'>, firstBatchData: Omit<Batch, 'id'>) => {
    const newProduct: Product = {
      ...productData,
      id: `prod_${Date.now()}`,
      batches: [{ ...firstBatchData, id: `batch_${Date.now()}` }],
    };
    setProducts([...products, newProduct]);
  };

  const handleAddBatch = (productId: string, batchData: Omit<Batch, 'id'>) => {
    setProducts(products.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          batches: [...p.batches, { ...batchData, id: `batch_${Date.now()}` }],
        };
      }
      return p;
    }));
  };
  
  const handleGenerateBill = (billData: Omit<Bill, 'id' | 'billNumber'>): Bill => {
    // 1. Create the new bill
    const newBill: Bill = {
        ...billData,
        id: `bill_${Date.now()}`,
        billNumber: `B${(bills.length + 1).toString().padStart(4, '0')}`
    };
    setBills(prevBills => [...prevBills, newBill]);

    // 2. Update inventory stock
    const updatedProducts = products.map(product => {
        const relevantItems = billData.items.filter(item => item.productId === product.id);
        if (relevantItems.length === 0) return product;

        const updatedBatches = product.batches.map(batch => {
            const itemInBill = relevantItems.find(item => item.batchId === batch.id);
            if (itemInBill) {
                return { ...batch, stock: batch.stock - itemInBill.quantity };
            }
            return batch;
        });

        return { ...product, batches: updatedBatches };
    });
    setProducts(updatedProducts);

    // 3. Return the new bill so the billing component can use it
    return newBill;
  };

  const handlePurchaseEntry = (purchaseData: Omit<Purchase, 'id' | 'totalAmount' | 'items'> & { items: PurchaseLineItem[] }) => {
    let updatedProducts = [...products];

    purchaseData.items.forEach(item => {
      // Use a more unique ID
      const uniqueIdSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const newBatch: Omit<Batch, 'id'> = {
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        stock: item.quantity,
        mrp: item.mrp,
        purchasePrice: item.purchasePrice,
      };

      if (item.isNewProduct) {
        const newProduct: Product = {
          id: `prod_${uniqueIdSuffix}`,
          name: item.productName,
          company: item.company,
          hsnCode: item.hsnCode,
          gst: item.gst,
          batches: [{ ...newBatch, id: `batch_${uniqueIdSuffix}` }],
        };
        updatedProducts.push(newProduct);
      } else {
        const productIndex = updatedProducts.findIndex(p => p.id === item.productId);
        if (productIndex !== -1) {
          const existingProduct = updatedProducts[productIndex];
          updatedProducts[productIndex] = {
            ...existingProduct,
            batches: [
              ...existingProduct.batches,
              { ...newBatch, id: `batch_${uniqueIdSuffix}` },
            ],
          };
        }
      }
    });

    setProducts(updatedProducts);

    const totalAmount = purchaseData.items.reduce((total, item) => total + (item.purchasePrice * item.quantity), 0);
    const newPurchase: Purchase = {
        ...purchaseData,
        id: `purch_${Date.now()}`,
        totalAmount,
    };
    setPurchases(prev => [newPurchase, ...prev]);
  };

  const renderView = () => {
    switch (activeView) {
      case 'billing':
        return <Billing products={products} onGenerateBill={handleGenerateBill}/>;
      case 'purchases':
        return <Purchases products={products} purchases={purchases} onAddPurchase={handlePurchaseEntry} />;
      case 'inventory':
        return <Inventory products={products} onAddProduct={handleAddProduct} onAddBatch={handleAddBatch} />;
      case 'daybook':
        return <DayBook bills={bills} />;
      default:
        return <Billing products={products} onGenerateBill={handleGenerateBill} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <Header activeView={activeView} setActiveView={setActiveView} />
      <main>
        {renderView()}
      </main>
    </div>
  );
};

export default App;
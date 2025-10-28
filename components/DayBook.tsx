import React, { useState, useMemo } from 'react';
import type { Bill } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';

interface DayBookProps {
  bills: Bill[];
}

const DayBook: React.FC<DayBookProps> = ({ bills }) => {
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const today = new Date().toISOString().split('T')[0];
  
  const todaysBills = useMemo(() => {
    return bills.filter(bill => bill.date.startsWith(today)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bills, today]);

  const totalSales = useMemo(() => {
    return todaysBills.reduce((total, bill) => total + bill.grandTotal, 0);
  }, [todaysBills]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
        <Card>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Day Book - {new Date().toLocaleDateString()}</h1>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                <div className="bg-indigo-50 dark:bg-indigo-900/50 p-4 rounded-lg">
                    <p className="text-sm text-indigo-800 dark:text-indigo-300 font-semibold">Total Bills Today</p>
                    <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-200">{todaysBills.length}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/50 p-4 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-300 font-semibold">Total Sales Today</p>
                    <p className="text-3xl font-bold text-green-900 dark:text-green-200">₹{totalSales.toFixed(2)}</p>
                </div>
            </div>
        </Card>

      <Card title="Today's Bills">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
            <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
              <tr>
                <th scope="col" className="px-6 py-3">Bill No.</th>
                <th scope="col" className="px-6 py-3">Time</th>
                <th scope="col" className="px-6 py-3">Customer</th>
                <th scope="col" className="px-6 py-3">Items</th>
                <th scope="col" className="px-6 py-3">Amount</th>
                <th scope="col" className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {todaysBills.map(bill => (
                <tr key={bill.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{bill.billNumber}</td>
                  <td className="px-6 py-4">{new Date(bill.date).toLocaleTimeString()}</td>
                  <td className="px-6 py-4">{bill.customerName}</td>
                  <td className="px-6 py-4 text-center">{bill.items.length}</td>
                  <td className="px-6 py-4 font-semibold">₹{bill.grandTotal.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => setSelectedBill(bill)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {todaysBills.length === 0 && (
                <div className="text-center py-10 text-slate-600 dark:text-slate-400">
                    <p>No bills have been generated today.</p>
                </div>
            )}
        </div>
      </Card>
      
      {selectedBill && (
        <BillDetailsModal
          isOpen={!!selectedBill}
          onClose={() => setSelectedBill(null)}
          bill={selectedBill}
        />
      )}
    </div>
  );
};

// --- Helper Component ---
const BillDetailsModal: React.FC<{ isOpen: boolean; onClose: () => void; bill: Bill; }> = ({ isOpen, onClose, bill }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Bill Details: ${bill.billNumber}`}>
            <div className="space-y-4 text-slate-800 dark:text-slate-300">
                <div className="flex justify-between text-sm">
                    <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">Customer: {bill.customerName}</p>
                        <p className="text-slate-600 dark:text-slate-400">Date: {new Date(bill.date).toLocaleString()}</p>
                    </div>
                </div>
                <div className="border-t dark:border-slate-700 pt-2">
                    <div className="max-h-60 overflow-y-auto">
                        <table className="w-full text-xs text-left">
                            <thead>
                                <tr>
                                    <th className="py-1">Product</th>
                                    <th className="py-1 text-center">Qty</th>
                                    <th className="py-1 text-right">Rate</th>
                                    <th className="py-1 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bill.items.map(item => (
                                    <tr key={item.batchId} className="border-b dark:border-slate-700">
                                        <td className="py-2">{item.productName} <span className="text-slate-500 dark:text-slate-400">({item.batchNumber})</span></td>
                                        <td className="py-2 text-center">{item.quantity}</td>
                                        <td className="py-2 text-right">₹{item.mrp.toFixed(2)}</td>
                                        <td className="py-2 text-right">₹{item.total.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="border-t dark:border-slate-700 pt-3 space-y-1 text-sm">
                    <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span >Subtotal:</span>
                        <span className="font-medium">₹{bill.subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Total GST:</span>
                        <span className="font-medium">₹{bill.totalGst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                        <span>Grand Total:</span>
                        <span>₹{bill.grandTotal.toFixed(2)}</span>
                    </div>
                </div>
                 <div className="flex justify-end pt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500">Close</button>
                </div>
            </div>
        </Modal>
    );
}

export default DayBook;

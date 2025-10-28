import React from 'react';
import type { Bill, CompanyProfile } from '../types';
import { PillIcon } from './icons/Icons';

interface PrintableBillProps {
  bill: Bill;
  companyProfile: CompanyProfile;
}

const PrintableBill: React.FC<PrintableBillProps> = ({ bill, companyProfile }) => {
  // Defensive check for items array
  const items = bill?.items || [];

  return (
    <div className="text-black text-xs font-sans">
      <header className="text-center mb-4">
        <PillIcon className="h-16 w-16 mx-auto mb-2 text-slate-800" />
        <h1 className="text-xl font-bold">{companyProfile.name}</h1>
        <p>{companyProfile.address}</p>
        <p>GSTIN: {companyProfile.gstin}</p>
        <h2 className="text-lg font-semibold mt-2 border-y-2 border-black py-1">TAX INVOICE</h2>
      </header>

      <div className="flex justify-between mb-2">
          <div>
              <p><strong>Bill No:</strong> {bill.billNumber}</p>
              <p><strong>Customer:</strong> {bill.customerName}</p>
          </div>
          <div>
              <p><strong>Date:</strong> {new Date(bill.date).toLocaleDateString()}</p>
              <p><strong>Time:</strong> {new Date(bill.date).toLocaleTimeString()}</p>
          </div>
      </div>

      <table className="w-full text-xs">
        <thead className="border-t-2 border-b-2 border-black">
          <tr>
            <th className="py-1 text-left">S.No</th>
            <th className="py-1 text-left">Product</th>
            <th className="py-1 text-left">HSN</th>
            <th className="py-1 text-left">Batch/Exp</th>
            <th className="py-1 text-center">Qty</th>
            <th className="py-1 text-right">Rate</th>
            <th className="py-1 text-right">GST%</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.batchId} className="border-b border-dashed border-black">
              <td className="py-1">{index + 1}</td>
              <td className="py-1">{item.productName}</td>
              <td className="py-1">{item.hsnCode}</td>
              <td className="py-1">{item.batchNumber} / {item.expiryDate}</td>
              <td className="py-1 text-center">{item.quantity}</td>
              <td className="py-1 text-right">{(item.mrp || 0).toFixed(2)}</td>
              <td className="py-1 text-right">{item.gst}%</td>
              <td className="py-1 text-right">{(item.total || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {items.length === 0 && (
          <div className="text-center py-4 border-b border-dashed border-black">
              <p>-- No items in this bill --</p>
          </div>
      )}

       <div className="mt-2 flex justify-end">
          <div className="w-1/2">
              <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{(bill.subTotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                  <span>Total GST:</span>
                  <span>₹{(bill.totalGst || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm border-t-2 border-b-2 border-black my-1 py-1">
                  <span>Grand Total:</span>
                  <span>₹{(bill.grandTotal || 0).toFixed(2)}</span>
              </div>
          </div>
      </div>

      <footer className="text-center mt-4 pt-2 border-t-2 border-black">
          <p className="font-semibold">Thank you for your visit!</p>
          <p>Get well soon.</p>
      </footer>
    </div>
  );
};

export default PrintableBill;
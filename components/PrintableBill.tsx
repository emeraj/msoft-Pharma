import React from 'react';
import type { Bill, CompanyProfile } from '../types';

interface PrintableBillProps {
  bill: Bill;
  companyProfile: CompanyProfile;
}

const PrintableBill: React.FC<PrintableBillProps> = ({ bill, companyProfile }) => {
  // Defensive check for items array
  const items = bill?.items || [];

  return (
    <div className="bg-white text-black font-sans p-4" style={{ width: '210mm', height: '148mm', boxSizing: 'border-box' }}>
      <div className="flex flex-col h-full">
        {/* Header Section */}
        <header className="flex justify-between items-start pb-2 border-b-2 border-black">
          <div className="w-2/3">
            <h1 className="text-2xl font-bold">{companyProfile.name}</h1>
            <p className="text-xs">{companyProfile.address}</p>
            <p className="text-xs"><strong>GSTIN:</strong> {companyProfile.gstin}</p>
          </div>
          <div className="w-1/3 text-right">
            <h2 className="text-xl font-semibold">TAX INVOICE</h2>
            <p className="text-xs mt-1"><strong>Bill No:</strong> {bill.billNumber}</p>
            <p className="text-xs"><strong>Date:</strong> {new Date(bill.date).toLocaleString()}</p>
          </div>
        </header>

        {/* Customer Details */}
        <div className="py-2">
          <p className="text-xs"><strong>To:</strong> {bill.customerName}</p>
        </div>

        {/* Items Table */}
        <main className="flex-grow">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-100">
              <tr className="border-y-2 border-black">
                <th className="p-1 text-left">S.No</th>
                <th className="p-1 text-left w-2/5">Product Name</th>
                <th className="p-1 text-left">HSN</th>
                <th className="p-1 text-left">Batch</th>
                <th className="p-1 text-left">Exp</th>
                <th className="p-1 text-center">Qty</th>
                <th className="p-1 text-right">MRP</th>
                <th className="p-1 text-center">GST%</th>
                <th className="p-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.batchId} className="border-b border-slate-300">
                  <td className="p-1 text-left">{index + 1}</td>
                  <td className="p-1 text-left">{item.productName}</td>
                  <td className="p-1 text-left">{item.hsnCode}</td>
                  <td className="p-1 text-left">{item.batchNumber}</td>
                  <td className="p-1 text-left">{item.expiryDate}</td>
                  <td className="p-1 text-center">{item.quantity}</td>
                  <td className="p-1 text-right">{(item.mrp || 0).toFixed(2)}</td>
                  <td className="p-1 text-center">{item.gst}%</td>
                  <td className="p-1 text-right font-medium">{(item.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
              <div className="text-center py-4 border-b border-slate-300">
                  <p>-- No items --</p>
              </div>
          )}
        </main>

        {/* Footer and Totals */}
        <footer className="pt-2 border-t-2 border-black">
          <div className="flex justify-between items-end">
            <div className="w-1/2 text-xs">
              <p className="font-semibold">Thank you for your visit!</p>
              <p>Get Well Soon.</p>
            </div>
            <div className="w-1/2">
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="p-1 text-right">Subtotal:</td>
                    <td className="p-1 text-right w-2/5">₹{(bill.subTotal || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="p-1 text-right">Total GST:</td>
                    <td className="p-1 text-right">₹{(bill.totalGst || 0).toFixed(2)}</td>
                  </tr>
                  <tr className="font-bold text-sm border-t-2 border-black">
                    <td className="p-1 text-right">Grand Total:</td>
                    <td className="p-1 text-right">₹{(bill.grandTotal || 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default PrintableBill;
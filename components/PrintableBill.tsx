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
    <div className="bg-white text-black font-sans text-xs" style={{ width: '210mm', height: '148mm', boxSizing: 'border-box' }}>
      <div className="flex flex-col h-full p-4">
        
        {/* Header Section */}
        <header className="flex justify-between items-start pb-2 border-b-2 border-gray-700">
          <div className="w-2/3">
            <h1 className="text-xl font-bold uppercase text-gray-800">{companyProfile.name}</h1>
            <p className="text-gray-600">{companyProfile.address}</p>
            <p className="text-gray-600"><strong>GSTIN:</strong> {companyProfile.gstin}</p>
          </div>
          <div className="w-1/3 text-right">
            <h2 className="text-lg font-bold text-gray-800">TAX INVOICE</h2>
            <p className="mt-1"><strong>Bill No:</strong> {bill.billNumber}</p>
            <p><strong>Date:</strong> {new Date(bill.date).toLocaleString()}</p>
          </div>
        </header>

        {/* Customer Details */}
        <section className="flex justify-between py-2 border-b border-gray-300">
            <div>
                <h3 className="font-semibold text-gray-700">Bill To:</h3>
                <p>{bill.customerName}</p>
            </div>
        </section>


        {/* Items Table */}
        <main className="flex-grow pt-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-400 bg-gray-100">
                <th className="p-1 font-semibold">S.No</th>
                <th className="p-1 font-semibold w-2/5">Product Name</th>
                <th className="p-1 font-semibold">HSN</th>
                <th className="p-1 font-semibold">Batch</th>
                <th className="p-1 font-semibold">Exp</th>
                <th className="p-1 font-semibold text-center">Qty</th>
                <th className="p-1 font-semibold text-right">MRP</th>
                <th className="p-1 font-semibold text-center">GST%</th>
                <th className="p-1 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.batchId} className="border-b border-gray-200 even:bg-gray-50">
                  <td className="p-1">{index + 1}</td>
                  <td className="p-1">{item.productName}</td>
                  <td className="p-1">{item.hsnCode}</td>
                  <td className="p-1">{item.batchNumber}</td>
                  <td className="p-1">{item.expiryDate}</td>
                  <td className="p-1 text-center">{item.quantity}</td>
                  <td className="p-1 text-right">{(item.mrp || 0).toFixed(2)}</td>
                  <td className="p-1 text-center">{item.gst}%</td>
                  <td className="p-1 text-right font-medium">{(item.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                  <p>-- No items in this bill --</p>
              </div>
          )}
        </main>

        {/* Footer and Totals */}
        <footer className="mt-auto pt-2 border-t-2 border-gray-700">
          <div className="flex justify-between items-end">
            <div className="w-1/2">
              <p className="font-semibold">Thank you for your visit!</p>
              <p>Get Well Soon.</p>
            </div>
            <div className="w-1/2">
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="text-right pr-4">Subtotal</td>
                    <td className="text-right font-medium w-32">₹{(bill.subTotal || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="text-right pr-4">Total GST</td>
                    <td className="text-right font-medium">₹{(bill.totalGst || 0).toFixed(2)}</td>
                  </tr>
                  <tr className="font-bold text-base border-t-2 border-gray-500">
                    <td className="text-right pr-4 pt-1">GRAND TOTAL</td>
                    <td className="text-right pt-1">₹{(bill.grandTotal || 0).toFixed(2)}</td>
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

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
    <div className="bg-white text-black font-sans" style={{ width: '210mm', height: '148mm', boxSizing: 'border-box', fontSize: '9pt' }}>
      <div className="flex flex-col h-full" style={{ padding: '8mm' }}>
        
        {/* Header Section */}
        <header className="flex justify-between items-start border-b-2" style={{ borderColor: '#333', paddingBottom: '2mm' }}>
          <div className="w-2/3">
            <h1 className="font-bold uppercase" style={{ fontSize: '14pt', color: '#1a202c' }}>{companyProfile.name}</h1>
            <p style={{ color: '#4a5568' }}>{companyProfile.address}</p>
            <p style={{ color: '#4a5568' }}><strong>GSTIN:</strong> {companyProfile.gstin}</p>
          </div>
          <div className="w-1/3 text-right">
            <h2 className="font-bold" style={{ fontSize: '12pt', color: '#1a202c' }}>TAX INVOICE</h2>
            <p className="mt-1"><strong>Bill No:</strong> {bill.billNumber}</p>
            <p><strong>Date:</strong> {new Date(bill.date).toLocaleString()}</p>
          </div>
        </header>

        {/* Customer Details */}
        <section className="flex justify-between border-b" style={{ borderColor: '#ccc', paddingTop: '2mm', paddingBottom: '2mm' }}>
            <div>
                <h3 className="font-semibold" style={{ color: '#2d3748' }}>Bill To:</h3>
                <p>{bill.customerName}</p>
            </div>
        </section>


        {/* Items Table */}
        <main className="flex-grow" style={{ paddingTop: '2mm' }}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 bg-gray-100" style={{ borderColor: '#666' }}>
                <th className="font-semibold" style={{ padding: '1mm 2mm' }}>S.No</th>
                <th className="font-semibold w-2/5" style={{ padding: '1mm 2mm' }}>Product Name</th>
                <th className="font-semibold" style={{ padding: '1mm 2mm' }}>HSN</th>
                <th className="font-semibold" style={{ padding: '1mm 2mm' }}>Batch</th>
                <th className="font-semibold" style={{ padding: '1mm 2mm' }}>Exp</th>
                <th className="font-semibold text-center" style={{ padding: '1mm 2mm' }}>Qty</th>
                <th className="font-semibold text-right" style={{ padding: '1mm 2mm' }}>MRP</th>
                <th className="font-semibold text-center" style={{ padding: '1mm 2mm' }}>GST%</th>
                <th className="font-semibold text-right" style={{ padding: '1mm 2mm' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.batchId} className="border-b even:bg-gray-50" style={{ borderColor: '#eee' }}>
                  <td style={{ padding: '1mm 2mm' }}>{index + 1}</td>
                  <td style={{ padding: '1mm 2mm' }}>{item.productName}</td>
                  <td style={{ padding: '1mm 2mm' }}>{item.hsnCode}</td>
                  <td style={{ padding: '1mm 2mm' }}>{item.batchNumber}</td>
                  <td style={{ padding: '1mm 2mm' }}>{item.expiryDate}</td>
                  <td className="text-center" style={{ padding: '1mm 2mm' }}>{item.quantity}</td>
                  <td className="text-right" style={{ padding: '1mm 2mm' }}>{(item.mrp || 0).toFixed(2)}</td>
                  <td className="text-center" style={{ padding: '1mm 2mm' }}>{item.gst}%</td>
                  <td className="font-medium text-right" style={{ padding: '1mm 2mm' }}>{(item.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
              <div className="text-center py-4" style={{ color: '#718096' }}>
                  <p>-- No items in this bill --</p>
              </div>
          )}
        </main>

        {/* Footer and Totals */}
        <footer className="mt-auto border-t-2" style={{ paddingTop: '2mm', borderColor: '#333' }}>
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
                    <td className="w-32 font-medium text-right">₹{(bill.subTotal || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="text-right pr-4">Total GST</td>
                    <td className="font-medium text-right">₹{(bill.totalGst || 0).toFixed(2)}</td>
                  </tr>
                  <tr className="font-bold border-t-2" style={{ fontSize: '10pt', borderColor: '#888' }}>
                    <td className="pt-1 pr-4 text-right">GRAND TOTAL</td>
                    <td className="pt-1 text-right">₹{(bill.grandTotal || 0).toFixed(2)}</td>
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
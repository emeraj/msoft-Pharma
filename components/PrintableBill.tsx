
import React from 'react';
import type { Bill, CompanyProfile, SystemConfig } from '../types';

interface PrintableBillProps {
  bill: Bill;
  companyProfile: CompanyProfile;
  systemConfig: SystemConfig;
}

const PrintableBill: React.FC<PrintableBillProps> = ({ bill, companyProfile, systemConfig }) => {
  const items = bill?.items || [];

  return (
    <div style={{
      width: '210mm',
      height: '297mm',
      boxSizing: 'border-box',
      backgroundColor: 'white',
      color: 'black',
      fontFamily: 'Arial, sans-serif',
      fontSize: '9pt',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8mm' }}>
        
        {/* Header */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '1.5pt solid #333',
          paddingBottom: '2mm',
        }}>
          <div style={{ width: '65%', display: 'flex', alignItems: 'center' }}>
            {companyProfile.logo && (
                <img 
                    src={companyProfile.logo} 
                    alt="Logo" 
                    style={{ height: '20mm', marginRight: '5mm', objectFit: 'contain' }} 
                />
            )}
            <div>
                <h1 style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14pt', margin: 0, color: '#1a202c' }}>
                {companyProfile.name}
                </h1>
                <p style={{ margin: '1mm 0 0 0', color: '#4a5568' }}>{companyProfile.address}</p>
                <p style={{ margin: '1mm 0 0 0', color: '#4a5568' }}>
                <strong style={{ fontWeight: 'bold' }}>GSTIN:</strong> {companyProfile.gstin}
                </p>
            </div>
          </div>
          <div style={{ width: '35%', textAlign: 'right' }}>
            <h2 style={{ fontWeight: 'bold', fontSize: '12pt', margin: 0, color: '#1a202c' }}>TAX INVOICE</h2>
            <p style={{ margin: '1.5mm 0 0 0' }}><strong style={{ fontWeight: 'bold' }}>Bill No:</strong> {bill.billNumber}</p>
            <p style={{ margin: '1mm 0 0 0' }}><strong style={{ fontWeight: 'bold' }}>Date:</strong> {new Date(bill.date).toLocaleString()}</p>
          </div>
        </header>

        {/* Customer Details */}
        <section style={{ borderBottom: '0.5pt solid #ccc', paddingTop: '2mm', paddingBottom: '2mm' }}>
          <div>
            <h3 style={{ fontWeight: 600, margin: 0, color: '#2d3748' }}>Bill To:</h3>
            <p style={{ margin: '1mm 0 0 0' }}>{bill.customerName}</p>
          </div>
        </section>

        {/* Items Table */}
        <main style={{ flexGrow: 1, paddingTop: '2mm', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ fontWeight: 'bold', padding: '1.5mm 2mm', textAlign: 'left', borderBottom: '1.5pt solid #666' }}>S.No</th>
                <th style={{ width: '35%', fontWeight: 'bold', padding: '1.5mm 2mm', textAlign: 'left', borderBottom: '1.5pt solid #666' }}>Product Name</th>
                <th style={{ fontWeight: 'bold', padding: '1.5mm 2mm', textAlign: 'left', borderBottom: '1.5pt solid #666' }}>HSN</th>
                <th style={{ fontWeight: 'bold', padding: '1.5mm 2mm', textAlign: 'left', borderBottom: '1.5pt solid #666' }}>Batch</th>
                <th style={{ fontWeight: 'bold', padding: '1.5mm 2mm', textAlign: 'left', borderBottom: '1.5pt solid #666' }}>Exp</th>
                <th style={{ fontWeight: 'bold', padding: '1.5mm 2mm', textAlign: 'center', borderBottom: '1.5pt solid #666' }}>Qty</th>
                <th style={{ fontWeight: 'bold', padding: '1.5mm 2mm', textAlign: 'right', borderBottom: '1.5pt solid #666' }}>MRP</th>
                <th style={{ fontWeight: 'bold', padding: '1.5mm 2mm', textAlign: 'center', borderBottom: '1.5pt solid #666' }}>GST%</th>
                <th style={{ fontWeight: 'bold', padding: '1.5mm 2mm', textAlign: 'right', borderBottom: '1.5pt solid #666' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.batchId} style={{ borderBottom: '0.5pt solid #eee' }}>
                  <td style={{ padding: '1.5mm 2mm', verticalAlign: 'top' }}>{index + 1}</td>
                  <td style={{ padding: '1.5mm 2mm', verticalAlign: 'top' }}>{item.productName}</td>
                  <td style={{ padding: '1.5mm 2mm', verticalAlign: 'top' }}>{item.hsnCode}</td>
                  <td style={{ padding: '1.5mm 2mm', verticalAlign: 'top' }}>{item.batchNumber}</td>
                  <td style={{ padding: '1.5mm 2mm', verticalAlign: 'top' }}>{item.expiryDate}</td>
                  <td style={{ padding: '1.5mm 2mm', textAlign: 'center', verticalAlign: 'top' }}>{item.quantity}</td>
                  <td style={{ padding: '1.5mm 2mm', textAlign: 'right', verticalAlign: 'top' }}>{(item.mrp || 0).toFixed(2)}</td>
                  <td style={{ padding: '1.5mm 2mm', textAlign: 'center', verticalAlign: 'top' }}>{item.gst}%</td>
                  <td style={{ padding: '1.5mm 2mm', textAlign: 'right', verticalAlign: 'top', fontWeight: 500 }}>{(item.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '10mm 0', color: '#718096' }}>
                  <p>-- No items in this bill --</p>
              </div>
          )}
        </main>

        {/* Footer */}
        <footer style={{ marginTop: 'auto', borderTop: '1.5pt solid #333', paddingTop: '2mm' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ width: '50%' }}>
                {systemConfig.remarkLine1 && <p style={{ fontWeight: 600, margin: 0 }}>{systemConfig.remarkLine1}</p>}
                {systemConfig.remarkLine2 && <p style={{ margin: '1mm 0 0 0' }}>{systemConfig.remarkLine2}</p>}
            </div>
            <div style={{ width: '50%', textAlign: 'right' }}>
              <div style={{ display: 'inline-block', minWidth: '80mm' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal</span>
                  <span style={{ fontWeight: 500, minWidth: '30mm', textAlign: 'right' }}>₹{(bill.subTotal || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1mm' }}>
                  <span>Total GST</span>
                  <span style={{ fontWeight: 500, minWidth: '30mm', textAlign: 'right' }}>₹{(bill.totalGst || 0).toFixed(2)}</span>
                </div>
                {bill.roundOff !== undefined && Math.abs(bill.roundOff) > 0.005 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1mm' }}>
                        <span>Round Off</span>
                        <span style={{ fontWeight: 500, minWidth: '30mm', textAlign: 'right' }}>{bill.roundOff > 0 ? '+' : ''}{bill.roundOff.toFixed(2)}</span>
                    </div>
                )}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 'bold',
                  fontSize: '11pt',
                  borderTop: '1.5pt solid #888',
                  marginTop: '1.5mm',
                  paddingTop: '1.5mm'
                }}>
                  <span>GRAND TOTAL</span>
                  <span>₹{(bill.grandTotal || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default PrintableBill;

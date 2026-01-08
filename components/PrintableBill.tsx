
import React, { useMemo } from 'react';
import type { Bill, CompanyProfile, SystemConfig } from '../types';

const toWords = (num: number): string => {
    const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    const numStr = num.toFixed(2);
    const [integerPartStr, decimalPartStr] = numStr.split('.');
    const integerPart = parseInt(integerPartStr, 10);
    const decimalPart = parseInt(decimalPartStr, 10);
    
    if (integerPart === 0 && decimalPart === 0) return 'Zero Only';
    
    const convert = (n: number): string => {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
        if (n < 1000) return a[Math.floor(n / 100)] + ' hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
        if (n < 100000) return convert(Math.floor(n / 1000)) + ' thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
        if (n < 10000000) return convert(Math.floor(n / 100000)) + ' lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
        return convert(Math.floor(n / 10000000)) + ' crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
    };
    
    let words = integerPart > 0 ? convert(integerPart) + ' Rupees' : '';
    if (decimalPart > 0) {
        words += (words ? ' and ' : '') + convert(decimalPart) + ' Paise';
    }
    
    return words.split(' ').filter(s => s).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') + ' Only';
};

interface PrintableBillProps {
  bill: Bill;
  companyProfile: CompanyProfile;
  systemConfig: SystemConfig;
}

const PrintableBill: React.FC<PrintableBillProps> = ({ bill, companyProfile, systemConfig }) => {
  const items = bill?.items || [];

  const gstBreakdown = useMemo(() => {
    const summary = new Map<string, { taxable: number; gstRate: number; amount: number; hsn: string }>();
    items.forEach(item => {
        const taxable = item.total / (1 + item.gst / 100);
        const existing = summary.get(item.hsnCode) || { taxable: 0, gstRate: item.gst, amount: 0, hsn: item.hsnCode };
        existing.taxable += taxable;
        existing.amount += (item.total - taxable);
        summary.set(item.hsnCode, existing);
    });
    return Array.from(summary.values());
  }, [items]);

  const styles: { [key: string]: React.CSSProperties } = {
    page: {
      width: '210mm',
      minHeight: '297mm',
      boxSizing: 'border-box',
      backgroundColor: 'white',
      color: 'black',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '10pt',
      padding: '8mm',
      lineHeight: '1.3'
    },
    outerBox: {
      border: '0.8pt solid black',
      display: 'flex',
      flexDirection: 'column',
    },
    headerRow: {
        display: 'flex',
        borderBottom: '0.8pt solid black',
    },
    headerColLeft: {
        width: '50%',
        borderRight: '0.8pt solid black',
        padding: '2mm',
    },
    headerColRight: {
        width: '50%',
        display: 'flex',
        flexDirection: 'column',
    },
    label: { fontSize: '7.5pt', color: '#000', marginBottom: '1mm' },
    value: { fontWeight: 'bold', fontSize: '9pt' },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        borderBottom: '0.8pt solid black'
    },
    th: {
        borderBottom: '0.8pt solid black',
        borderRight: '0.8pt solid black',
        padding: '1mm 2mm',
        fontSize: '8.5pt',
        textAlign: 'center',
        fontWeight: 'bold',
        height: '8mm'
    },
    td: {
        borderRight: '0.8pt solid black',
        padding: '1mm 2mm',
        fontSize: '9pt',
        verticalAlign: 'top',
        minHeight: '8mm'
    },
    gstTable: {
        width: '100%',
        borderCollapse: 'collapse',
        marginTop: '-0.1pt'
    },
    gstTh: {
        border: '0.8pt solid black',
        padding: '1mm',
        fontSize: '8pt',
        textAlign: 'center',
        fontWeight: 'bold'
    },
    gstTd: {
        border: '0.8pt solid black',
        padding: '1mm 2mm',
        fontSize: '8.5pt',
        textAlign: 'right'
    }
  };

  return (
    <div style={styles.page}>
      <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '2mm', fontSize: '11pt' }}>Tax Invoice</div>
      
      <div style={styles.outerBox}>
        {/* Row 1: Seller and Invoice Info */}
        <div style={styles.headerRow}>
          <div style={styles.headerColLeft}>
            <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>{companyProfile.name}</div>
            <div style={{ fontSize: '8.5pt', marginTop: '1mm' }}>{companyProfile.address}</div>
            <div style={{ marginTop: '2mm', fontSize: '8.5pt' }}>GSTIN/UIN: <strong>{companyProfile.gstin}</strong></div>
            <div style={{ fontSize: '8.5pt' }}>State Name: Maharashtra, Code: 27</div>
          </div>
          <div style={styles.headerColRight}>
            <div style={{ display: 'flex', borderBottom: '0.8pt solid black', height: '12mm' }}>
                <div style={{ flex: 1, borderRight: '0.8pt solid black', padding: '1mm 2mm' }}>
                    <div style={styles.label}>Invoice No.</div>
                    <div style={styles.value}>{bill.billNumber}</div>
                </div>
                <div style={{ flex: 1, padding: '1mm 2mm' }}>
                    <div style={styles.label}>Dated</div>
                    <div style={styles.value}>{new Date(bill.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</div>
                </div>
            </div>
            <div style={{ display: 'flex', borderBottom: '0.8pt solid black', height: '12mm' }}>
                <div style={{ flex: 1, borderRight: '0.8pt solid black', padding: '1mm 2mm' }}>
                    <div style={styles.label}>Delivery Note</div>
                    <div style={styles.value}>-</div>
                </div>
                <div style={{ flex: 1, padding: '1mm 2mm' }}>
                    <div style={styles.label}>Mode/Terms of Payment</div>
                    <div style={styles.value}>{bill.paymentMode || 'Cash'}</div>
                </div>
            </div>
            <div style={{ display: 'flex', height: '12mm' }}>
                <div style={{ flex: 1, borderRight: '0.8pt solid black', padding: '1mm 2mm' }}>
                    <div style={styles.label}>Reference No. & Date</div>
                    <div style={styles.value}>-</div>
                </div>
                <div style={{ flex: 1, padding: '1mm 2mm' }}>
                    <div style={styles.label}>Other References</div>
                    <div style={styles.value}>-</div>
                </div>
            </div>
          </div>
        </div>

        {/* Row 2: Consignee and Buyer side-by-side */}
        <div style={{ ...styles.headerRow, height: '35mm' }}>
           <div style={styles.headerColLeft}>
              <div style={styles.label}>Consignee (Ship to)</div>
              <div style={styles.value}>{bill.customerName}</div>
              <div style={{ fontSize: '8.5pt', marginTop: '1mm' }}>{bill.customerName} Agencies</div>
              <div style={{ fontSize: '8.5pt' }}>GSTIN/UIN: <strong>{companyProfile.gstin}</strong></div>
              <div style={{ fontSize: '8.5pt' }}>State Name: Maharashtra, Code: 27</div>
           </div>
           <div style={{ ...styles.headerColRight, padding: '2mm' }}>
              <div style={styles.label}>Buyer (Bill to)</div>
              <div style={styles.value}>{bill.customerName}</div>
              <div style={{ fontSize: '8.5pt', marginTop: '1mm' }}>Customer Address, {bill.customerName} City</div>
              <div style={{ marginTop: '1mm', fontSize: '8.5pt' }}>GSTIN/UIN: <strong>{companyProfile.gstin}</strong></div>
              <div style={{ fontSize: '8.5pt' }}>State Name: Maharashtra, Code: 27</div>
           </div>
        </div>

        {/* Items Table */}
        <table style={styles.table}>
            <thead>
                <tr style={{ height: '8mm' }}>
                    <th style={{ ...styles.th, width: '10mm' }}>Sl No.</th>
                    <th style={{ ...styles.th, textAlign: 'left' }}>Description of Goods</th>
                    <th style={{ ...styles.th, width: '25mm' }}>HSN/SAC</th>
                    <th style={{ ...styles.th, width: '25mm' }}>Quantity</th>
                    <th style={{ ...styles.th, width: '25mm' }}>Rate</th>
                    <th style={{ ...styles.th, width: '20mm' }}>Disc %</th>
                    <th style={{ ...styles.th, width: '30mm', borderRight: 0 }}>Amount</th>
                </tr>
            </thead>
            <tbody>
                {items.map((item, idx) => (
                    <tr key={idx} style={{ minHeight: '8mm' }}>
                        <td style={{ ...styles.td, textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ ...styles.td, fontWeight: 'bold' }}>{item.productName}</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>{item.hsnCode}</td>
                        <td style={{ ...styles.td, textAlign: 'center', fontWeight: 'bold' }}>{item.quantity} Nos</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{item.mrp.toFixed(2)}</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>{item.discount ? `${item.discount}%` : '-'}</td>
                        <td style={{ ...styles.td, textAlign: 'right', borderRight: 0, fontWeight: 'bold' }}>{item.total.toFixed(2)}</td>
                    </tr>
                ))}
                {/* Spacer row to ensure lines go down */}
                <tr style={{ height: '40mm' }}>
                    <td style={styles.td}></td>
                    <td style={styles.td}></td>
                    <td style={styles.td}></td>
                    <td style={styles.td}></td>
                    <td style={styles.td}></td>
                    <td style={styles.td}></td>
                    <td style={{ ...styles.td, borderRight: 0 }}></td>
                </tr>
                {/* Total Row */}
                <tr style={{ borderTop: '0.8pt solid black', fontWeight: 'bold', height: '8mm' }}>
                    <td style={styles.td}></td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>Total</td>
                    <td style={styles.td}></td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>{items.reduce((sum, i) => sum + i.quantity, 0)} Nos</td>
                    <td style={styles.td}></td>
                    <td style={styles.td}></td>
                    <td style={{ ...styles.td, borderRight: 0, textAlign: 'right', fontSize: '11pt' }}>₹ {bill.grandTotal.toFixed(2)}</td>
                </tr>
            </tbody>
        </table>

        {/* Amount Chargeable Section */}
        <div style={{ padding: '2mm', borderBottom: '0.8pt solid black' }}>
            <div style={{ fontSize: '8pt' }}>Amount Chargeable (in words)</div>
            <div style={{ fontWeight: 'bold', marginTop: '1mm', fontSize: '9.5pt' }}>INR {toWords(bill.grandTotal)}</div>
        </div>

        {/* GST Breakup Table */}
        <table style={styles.gstTable}>
            <thead>
                <tr>
                    <th style={{ ...styles.gstTh, width: '20%' }} rowSpan={2}>HSN/SAC</th>
                    <th style={{ ...styles.gstTh, width: '20%' }} rowSpan={2}>Taxable Value</th>
                    <th style={{ ...styles.gstTh, width: '25%' }} colSpan={2}>CGST</th>
                    <th style={{ ...styles.gstTh, width: '25%' }} colSpan={2}>SGST/UTGST</th>
                    <th style={{ ...styles.gstTh, width: '10%' }} rowSpan={2}>Total Tax Amount</th>
                </tr>
                <tr>
                    <th style={styles.gstTh}>Rate</th>
                    <th style={styles.gstTh}>Amount</th>
                    <th style={styles.gstTh}>Rate</th>
                    <th style={styles.gstTh}>Amount</th>
                </tr>
            </thead>
            <tbody>
                {gstBreakdown.map((row, i) => (
                    <tr key={i}>
                        <td style={{ ...styles.gstTd, textAlign: 'center' }}>{row.hsn}</td>
                        <td style={styles.gstTd}>{row.taxable.toFixed(2)}</td>
                        <td style={{ ...styles.gstTd, textAlign: 'center' }}>{(row.gstRate / 2)}%</td>
                        <td style={styles.gstTd}>{(row.amount / 2).toFixed(2)}</td>
                        <td style={{ ...styles.gstTd, textAlign: 'center' }}>{(row.gstRate / 2)}%</td>
                        <td style={styles.gstTd}>{(row.amount / 2).toFixed(2)}</td>
                        <td style={styles.gstTd}>{row.amount.toFixed(2)}</td>
                    </tr>
                ))}
                <tr style={{ fontWeight: 'bold' }}>
                    <td style={{ ...styles.gstTd, textAlign: 'right' }}>Total</td>
                    <td style={styles.gstTd}>{gstBreakdown.reduce((s, r) => s + r.taxable, 0).toFixed(2)}</td>
                    <td style={styles.gstTd}></td>
                    <td style={styles.gstTd}>{(gstBreakdown.reduce((s, r) => s + r.amount, 0) / 2).toFixed(2)}</td>
                    <td style={styles.gstTd}></td>
                    <td style={styles.gstTd}>{(gstBreakdown.reduce((s, r) => s + r.amount, 0) / 2).toFixed(2)}</td>
                    <td style={styles.gstTd}>{gstBreakdown.reduce((s, r) => s + r.amount, 0).toFixed(2)}</td>
                </tr>
            </tbody>
        </table>

        {/* Tax Amount In Words */}
        <div style={{ padding: '2mm', fontSize: '9pt', borderTop: '0.8pt solid black' }}>
            Tax Amount (in words) : <strong>INR {toWords(gstBreakdown.reduce((s, r) => s + r.amount, 0))}</strong>
        </div>

        {/* Declaration and Signature */}
        <div style={{ display: 'flex', borderTop: '0.8pt solid black', minHeight: '30mm' }}>
            <div style={{ width: '60%', borderRight: '0.8pt solid black', padding: '2mm' }}>
                <div style={{ fontSize: '8pt', textDecoration: 'underline' }}>Declaration</div>
                <div style={{ fontSize: '8pt', marginTop: '2mm' }}>
                    We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                </div>
            </div>
            <div style={{ width: '40%', padding: '2mm', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>for {companyProfile.name}</div>
                <div style={{ fontSize: '9pt', marginTop: '15mm' }}>Authorised Signatory</div>
            </div>
        </div>
      </div>
      
      {/* Footer Jurisdictions */}
      <div style={{ textAlign: 'center', marginTop: '4mm', fontSize: '8pt', textTransform: 'uppercase' }}>
        Subject to {companyProfile.address.split(',').pop()?.trim() || 'Local'} Jurisdiction
      </div>
      <div style={{ textAlign: 'center', fontSize: '8pt' }}>
        This is a Computer Generated Invoice
      </div>
    </div>
  );
};

export default PrintableBill;


import React, { useMemo } from 'react';
import type { Bill, CompanyProfile, SystemConfig } from '../types';

// Utility to convert number to words (Indian numbering system)
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

const PrintableA5LandscapeBill: React.FC<{ bill: Bill; companyProfile: CompanyProfile; systemConfig: SystemConfig; }> = ({ bill, companyProfile, systemConfig }) => {
    const items = bill?.items || [];
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    const gstSummary = useMemo(() => {
        const summary = new Map<number, { taxable: number; gst: number }>();
        bill.items.forEach(item => {
            const taxableAmount = item.total / (1 + item.gst / 100);
            const gstAmount = item.total - taxableAmount;
            const current = summary.get(item.gst) || { taxable: 0, gst: 0 };
            current.taxable += taxableAmount;
            current.gst += gstAmount;
            summary.set(item.gst, current);
        });
        return Array.from(summary.entries()).sort((a, b) => a[0] - b[0]);
    }, [bill.items]);

    const styles: { [key: string]: React.CSSProperties } = {
        page: {
            width: '210mm',
            height: '148mm',
            boxSizing: 'border-box',
            backgroundColor: 'white',
            color: 'black',
            fontFamily: 'Arial, sans-serif',
            fontSize: '9pt',
            display: 'flex',
            flexDirection: 'column',
            padding: '5mm',
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1.5pt solid black',
            paddingBottom: '2mm',
            marginBottom: '2mm',
        },
        main: { flexGrow: 1, overflow: 'hidden' },
        table: { width: '100%', borderCollapse: 'collapse', fontSize: '8pt' },
        th: { border: '0.5pt solid black', padding: '1mm', backgroundColor: '#f2f2f2', fontWeight: 'bold', textAlign: 'left' },
        td: { border: '0.5pt solid black', padding: '1mm' },
        footer: { borderTop: '1pt solid black', marginTop: '2mm', paddingTop: '1mm' },
        flex: { display: 'flex', justifyContent: 'space-between' }
    };

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <div style={{ width: '40%' }}>
                    <h1 style={{ fontSize: '14pt', margin: 0 }}>{companyProfile.name}</h1>
                    <p style={{ margin: 0, fontSize: '8pt' }}>{companyProfile.address}</p>
                    <p style={{ margin: 0, fontSize: '8pt' }}>GSTIN: {companyProfile.gstin}</p>
                </div>
                <div style={{ textAlign: 'center', width: '20%' }}>
                    <h2 style={{ fontSize: '11pt', margin: 0, textDecoration: 'underline' }}>TAX INVOICE</h2>
                </div>
                <div style={{ textAlign: 'right', width: '40%' }}>
                    <p style={{ margin: 0 }}>Bill #: <strong>{bill.billNumber}</strong></p>
                    <p style={{ margin: 0 }}>Date: {new Date(bill.date).toLocaleDateString()}</p>
                    <p style={{ margin: 0 }}>Customer: <strong>{bill.customerName}</strong></p>
                </div>
            </header>

            <main style={styles.main}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>S#</th>
                            <th style={{ ...styles.th, width: '35%' }}>Description</th>
                            <th style={styles.th}>HSN</th>
                            {isPharmaMode && <th style={styles.th}>Batch</th>}
                            {isPharmaMode && <th style={styles.th}>Exp</th>}
                            <th style={styles.th}>Qty</th>
                            <th style={styles.th}>Rate</th>
                            <th style={styles.th}>GST%</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={idx}>
                                <td style={styles.td}>{idx + 1}</td>
                                <td style={styles.td}>{item.productName}</td>
                                <td style={styles.td}>{item.hsnCode}</td>
                                {isPharmaMode && <td style={styles.td}>{item.batchNumber}</td>}
                                {isPharmaMode && <td style={styles.td}>{item.expiryDate}</td>}
                                <td style={styles.td}>{item.quantity}</td>
                                <td style={styles.td}>{item.mrp.toFixed(2)}</td>
                                <td style={styles.td}>{item.gst}%</td>
                                <td style={{ ...styles.td, textAlign: 'right' }}>{item.total.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </main>

            <footer style={styles.footer}>
                <div style={styles.flex}>
                    <div style={{ width: '60%', fontSize: '8pt' }}>
                        <p style={{ margin: 0 }}>Amount in Words: <em>{toWords(bill.grandTotal)}</em></p>
                        <div style={{ marginTop: '2mm' }}>
                            {gstSummary.map(([rate, vals]) => (
                                <span key={rate} style={{ marginRight: '4mm' }}>
                                    GST {rate}%: ₹{vals.gst.toFixed(2)}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div style={{ width: '30%', textAlign: 'right' }}>
                        <div style={styles.flex}><span>Subtotal:</span><span>₹{bill.subTotal.toFixed(2)}</span></div>
                        <div style={styles.flex}><span>Tax Amt:</span><span>₹{bill.totalGst.toFixed(2)}</span></div>
                        <div style={{ ...styles.flex, borderTop: '1pt solid black', fontWeight: 'bold', fontSize: '11pt', marginTop: '1mm' }}>
                            <span>NET AMT:</span><span>₹{bill.grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                <div style={{ ...styles.flex, marginTop: '5mm', alignItems: 'flex-end' }}>
                    <div style={{ fontSize: '7pt' }}>
                        {systemConfig.remarkLine1 && <p style={{ margin: 0 }}>{systemConfig.remarkLine1}</p>}
                        <p style={{ margin: 0 }}>E.& O.E.</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '8pt', marginBottom: '8mm' }}>For {companyProfile.name}</p>
                        <p style={{ borderTop: '0.5pt solid black', display: 'inline-block', padding: '0 5mm' }}>Auth. Signatory</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default PrintableA5LandscapeBill;

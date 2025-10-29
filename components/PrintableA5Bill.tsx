import React from 'react';
import type { Bill, CompanyProfile } from '../types';

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
    
    let words = integerPart > 0 ? convert(integerPart) + ' rupees' : '';
    if (decimalPart > 0) {
        words += (words ? ' and ' : '') + convert(decimalPart) + ' paise';
    }
    
    return words.split(' ').filter(s => s).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') + ' Only';
};


const PrintableA5Bill: React.FC<{ bill: Bill; companyProfile: CompanyProfile }> = ({ bill, companyProfile }) => {
    const items = bill?.items || [];

    const styles: { [key: string]: React.CSSProperties } = {
        page: {
            width: '148mm',
            height: '209mm', // Slightly less than 210mm to avoid overflow
            boxSizing: 'border-box',
            backgroundColor: 'white',
            color: '#1a202c',
            fontFamily: 'Arial, sans-serif',
            fontSize: '9pt',
            display: 'flex',
            flexDirection: 'column',
            padding: '8mm',
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #1a202c',
            paddingBottom: '3mm',
        },
        main: {
            flexGrow: 1,
            paddingTop: '3mm',
            overflow: 'hidden', // Prevents content from breaking page layout
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '8pt',
        },
        th: {
            fontWeight: 'bold',
            padding: '1.5mm',
            textAlign: 'left',
            borderBottom: '1.5px solid #4a5568',
            backgroundColor: '#edf2f7',
        },
        td: {
            padding: '1.5mm',
            borderBottom: '1px solid #e2e8f0',
            verticalAlign: 'top',
        },
        footer: {
            marginTop: 'auto', // Pushes footer to the bottom
            paddingTop: '3mm',
        },
        totalsContainer: {
            display: 'flex',
            justifyContent: 'flex-end',
        },
        totalsTable: {
            width: '50%',
        },
        totalsRow: {
            display: 'flex',
            justifyContent: 'space-between',
            padding: '1mm 0',
        },
        grandTotalRow: {
            display: 'flex',
            justifyContent: 'space-between',
            padding: '1.5mm 0',
            marginTop: '1.5mm',
            borderTop: '2px solid #1a202c',
            fontWeight: 'bold',
            fontSize: '11pt',
        },
    };

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <div>
                    <h1 style={{ fontWeight: 'bold', fontSize: '18pt', margin: 0 }}>{companyProfile.name}</h1>
                    <p style={{ margin: '1mm 0 0 0', color: '#4a5568' }}>{companyProfile.address}</p>
                    <p style={{ margin: '1mm 0 0 0', color: '#4a5568' }}><strong>GSTIN:</strong> {companyProfile.gstin}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <h2 style={{ fontSize: '14pt', fontWeight: 'bold', margin: 0 }}>TAX INVOICE</h2>
                    <p style={{ margin: '1.5mm 0 0 0' }}><strong>Bill No:</strong> {bill.billNumber}</p>
                    <p style={{ margin: '1mm 0 0 0' }}><strong>Date:</strong> {new Date(bill.date).toLocaleDateString()}</p>
                </div>
            </header>

            <section style={{ padding: '3mm 0', borderBottom: '1px solid #cbd5e0' }}>
                <h3 style={{ fontWeight: 600, margin: 0 }}>Bill To:</h3>
                <p style={{ margin: '1mm 0 0 0', fontSize: '10pt' }}>{bill.customerName}</p>
            </section>

            <main style={styles.main}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={{...styles.th, width: '5%'}}>#</th>
                            <th style={{...styles.th, width: '35%'}}>Item Description</th>
                            <th style={{...styles.th, width: '10%'}}>HSN</th>
                            <th style={{...styles.th, width: '10%'}}>Batch</th>
                            <th style={{...styles.th, width: '10%'}}>Exp.</th>
                            <th style={{...styles.th, textAlign: 'center', width: '5%'}}>Qty</th>
                            <th style={{...styles.th, textAlign: 'right', width: '10%'}}>Rate</th>
                            <th style={{...styles.th, textAlign: 'right', width: '15%'}}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.batchId}>
                                <td style={styles.td}>{index + 1}</td>
                                <td style={styles.td}>{item.productName}</td>
                                <td style={styles.td}>{item.hsnCode}</td>
                                <td style={styles.td}>{item.batchNumber}</td>
                                <td style={styles.td}>{item.expiryDate}</td>
                                <td style={{...styles.td, textAlign: 'center'}}>{item.quantity}</td>
                                <td style={{...styles.td, textAlign: 'right'}}>{item.mrp.toFixed(2)}</td>
                                <td style={{...styles.td, textAlign: 'right', fontWeight: '500'}}>{item.total.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </main>

            <footer style={styles.footer}>
                <div style={{ ...styles.totalsContainer }}>
                    <div style={styles.totalsTable}>
                        <div style={styles.totalsRow}>
                            <span>Subtotal</span>
                            <span>₹{bill.subTotal.toFixed(2)}</span>
                        </div>
                        <div style={styles.totalsRow}>
                            <span>Total GST</span>
                            <span>₹{bill.totalGst.toFixed(2)}</span>
                        </div>
                        <div style={styles.grandTotalRow}>
                            <span>Grand Total</span>
                            <span>₹{bill.grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                <div style={{ marginTop: '3mm', borderTop: '1px solid #cbd5e0', paddingTop: '2mm', fontSize: '8pt' }}>
                    <p style={{ margin: 0 }}><strong>Amount in Words:</strong> {toWords(bill.grandTotal)}</p>
                </div>
                <div style={{ marginTop: '5mm', textAlign: 'center', color: '#718096', fontSize: '8pt' }}>
                    <p>Thank you for your business!</p>
                </div>
            </footer>
        </div>
    );
};

export default PrintableA5Bill;

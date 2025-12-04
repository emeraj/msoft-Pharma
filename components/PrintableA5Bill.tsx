
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


const PrintableA5Bill: React.FC<{ bill: Bill; companyProfile: CompanyProfile; systemConfig: SystemConfig; }> = ({ bill, companyProfile, systemConfig }) => {
    const items = bill?.items || [];
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';

    const showUpiQr = companyProfile.upiId && companyProfile.upiId.trim() !== '' && bill.grandTotal > 0;

    const upiUrl = showUpiQr
        ? `upi://pay?pa=${companyProfile.upiId}&pn=${encodeURIComponent(companyProfile.name)}&am=${bill.grandTotal.toFixed(2)}&cu=INR`
        : '';

    const qrCodeUrl = showUpiQr
        ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUrl)}`
        : '';

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
        return Array.from(summary.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([rate, amounts]) => ({
                rate,
                taxable: amounts.taxable,
                cgst: amounts.gst / 2,
                sgst: amounts.gst / 2,
            }));
    }, [bill.items]);

    const styles: { [key: string]: React.CSSProperties } = {
        page: {
            width: '148mm',
            minHeight: '205mm', 
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
            overflow: 'hidden',
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
            marginTop: 'auto',
            paddingTop: '3mm',
            borderTop: '1px solid #cbd5e0',
        },
        summaryContainer: {
            display: 'flex',
            justifyContent: 'space-between',
        },
        totalsContainer: {
            width: '50%',
        },
        totalsRow: {
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0.5mm 0',
            fontSize: '9pt',
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
        gstSummaryTable: {
            width: '45%',
            fontSize: '7.5pt',
            borderCollapse: 'collapse',
        },
        gstTh: {
            border: '1px solid #a0aec0',
            padding: '1mm',
            backgroundColor: '#edf2f7',
            fontWeight: 'bold',
        },
        gstTd: {
            border: '1px solid #a0aec0',
            padding: '1mm',
            textAlign: 'right',
        },
        signatureSection: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: '10mm',
        }
    };

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {companyProfile.logo && (
                        <img 
                            src={companyProfile.logo} 
                            alt="Logo" 
                            style={{ height: '18mm', marginRight: '4mm', objectFit: 'contain' }} 
                        />
                    )}
                    <div>
                        <h1 style={{ fontWeight: 'bold', fontSize: '18pt', margin: 0 }}>{companyProfile.name}</h1>
                        <p style={{ margin: '1mm 0 0 0', color: '#4a5568' }}>{companyProfile.address}</p>
                        <p style={{ margin: '1mm 0 0 0', color: '#4a5568' }}><strong>GSTIN:</strong> {companyProfile.gstin}</p>
                    </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '5mm' }}>
                    <h2 style={{ fontSize: '14pt', fontWeight: 'bold', margin: 0 }}>TAX INVOICE</h2>
                    <p style={{ margin: '1.5mm 0 0 0' }}><strong>Bill No:</strong> {bill.billNumber}</p>
                    <p style={{ margin: '1mm 0 0 0' }}><strong>Date:</strong> {new Date(bill.date).toLocaleDateString()}</p>
                </div>
            </header>

            <section style={{ padding: '3mm 0', borderBottom: '1px solid #cbd5e0' }}>
                <h3 style={{ fontWeight: 600, margin: 0 }}>Bill To:</h3>
                <p style={{ margin: '1mm 0 0 0', fontSize: '10pt' }}>{bill.customerName}</p>
                {isPharmaMode && bill.doctorName && <p style={{ margin: '1mm 0 0 0', fontSize: '9pt', color: '#4a5568' }}><strong>Prescribed by:</strong> {bill.doctorName}</p>}
            </section>

            <main style={styles.main}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={{...styles.th, width: '4%'}}>#</th>
                            <th style={{...styles.th, width: isPharmaMode ? '38%' : '58%'}}>Item Description</th>
                            <th style={{...styles.th, width: '10%'}}>HSN</th>
                            {isPharmaMode && <th style={{...styles.th, width: '10%'}}>Batch</th>}
                            {isPharmaMode && <th style={{...styles.th, width: '10%'}}>Exp.</th>}
                            <th style={{...styles.th, textAlign: 'center', width: '6%'}}>Qty</th>
                            <th style={{...styles.th, textAlign: 'right', width: '11%'}}>MRP</th>
                            <th style={{...styles.th, textAlign: 'right', width: '11%'}}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.batchId}>
                                <td style={styles.td}>{index + 1}</td>
                                <td style={{...styles.td, fontFamily: '"Arial Narrow", Arial, sans-serif', fontWeight: 'bold', ...(isPharmaMode && {fontSize: '7.5pt'})}}>
                                    {item.productName}
                                    {isPharmaMode && item.isScheduleH && <span style={{ fontWeight: 'bold', color: '#C05621', fontSize: '7pt' }}> (Sch. H)</span>}
                                    {isPharmaMode && item.composition && <div style={{ fontSize: '7pt', color: '#4a5568', fontStyle: 'italic', fontWeight: 'normal' }}>{item.composition}</div>}
                                </td>
                                <td style={styles.td}>{item.hsnCode}</td>
                                {isPharmaMode && <td style={styles.td}>{item.batchNumber}</td>}
                                {isPharmaMode && <td style={styles.td}>{item.expiryDate}</td>}
                                <td style={{...styles.td, textAlign: 'center'}}>{item.quantity}</td>
                                <td style={{...styles.td, textAlign: 'right'}}>{item.mrp.toFixed(2)}</td>
                                <td style={{...styles.td, textAlign: 'right', fontWeight: 500}}>{item.total.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </main>

            <footer style={styles.footer}>
                <div style={styles.summaryContainer}>
                    <div style={styles.gstSummaryTable}>
                        <div style={{fontWeight: 'bold', marginBottom: '1mm'}}>GST Summary</div>
                        <table style={{width: '100%', borderCollapse: 'collapse'}}>
                           <thead>
                               <tr>
                                   <th style={{...styles.gstTh, textAlign: 'center'}}>Rate</th>
                                   <th style={{...styles.gstTh, textAlign: 'right'}}>Taxable</th>
                                   <th style={{...styles.gstTh, textAlign: 'right'}}>CGST</th>
                                   <th style={{...styles.gstTh, textAlign: 'right'}}>SGST</th>
                               </tr>
                           </thead>
                           <tbody>
                               {gstSummary.map(g => (
                                   <tr key={g.rate}>
                                       <td style={{...styles.gstTd, textAlign: 'center'}}>{g.rate}%</td>
                                       <td style={styles.gstTd}>{g.taxable.toFixed(2)}</td>
                                       <td style={styles.gstTd}>{g.cgst.toFixed(2)}</td>
                                       <td style={styles.gstTd}>{g.sgst.toFixed(2)}</td>
                                   </tr>
                               ))}
                           </tbody>
                        </table>
                    </div>
                    <div style={styles.totalsContainer}>
                        <div style={styles.totalsRow}>
                            <span>Subtotal:</span>
                            <span>₹{bill.subTotal.toFixed(2)}</span>
                        </div>
                        <div style={styles.totalsRow}>
                            <span>Total GST:</span>
                            <span>₹{bill.totalGst.toFixed(2)}</span>
                        </div>
                        <div style={styles.grandTotalRow}>
                            <span>Grand Total:</span>
                            <span>₹{bill.grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '3mm', borderTop: '1px solid #cbd5e0', paddingTop: '2mm', fontSize: '8.5pt' }}>
                    <p style={{ margin: 0 }}><strong>Amount in Words:</strong> {toWords(bill.grandTotal)}</p>
                </div>

                <div style={styles.signatureSection}>
                    <div style={{fontSize: '8pt', color: '#4a5568'}}>
                        <strong>Terms & Conditions:</strong>
                        <ol style={{margin: '1mm 0 0 0', paddingLeft: '4mm'}}>
                            <li>Goods once sold cannot be returned.</li>
                            <li>Please check expiry before leaving the counter.</li>
                        </ol>
                        <div style={{ marginTop: '5mm', fontStyle: 'italic', fontSize: '9pt' }}>
                            {systemConfig.remarkLine1 && <p style={{ margin: 0 }}>{systemConfig.remarkLine1}</p>}
                            {systemConfig.remarkLine2 && <p style={{ margin: '1mm 0 0 0' }}>{systemConfig.remarkLine2}</p>}
                            {systemConfig.bankDetails && <p style={{ margin: '1mm 0 0 0', fontWeight: 'bold' }}>Bank Details: {systemConfig.bankDetails}</p>}
                        </div>
                    </div>
                    {showUpiQr && (
                        <div style={{textAlign: 'center'}}>
                            <p style={{fontSize: '8pt', margin: '0 0 1mm 0'}}>Scan to Pay using UPI</p>
                            <img
                                src={qrCodeUrl}
                                alt="UPI QR Code"
                                style={{ width: '25mm', height: '25mm' }}
                            />
                        </div>
                    )}
                    <div style={{textAlign: 'center', fontSize: '9pt'}}>
                        <p style={{marginBottom: '15mm'}}>For {companyProfile.name}</p>
                        <p style={{borderTop: '1px solid #4a5568', paddingTop: '1mm', margin: 0}}>Authorised Signatory</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default PrintableA5Bill;
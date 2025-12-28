
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
        if (n < 100000) return convert(Math.floor(n / 1000)) + ' thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 100) : '');
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

    const showUpiQr = companyProfile.upiId && companyProfile.upiId.trim() !== '' && bill.grandTotal > 0;
    const upiUrl = showUpiQr ? `upi://pay?pa=${companyProfile.upiId}&pn=${encodeURIComponent(companyProfile.name)}&am=${bill.grandTotal.toFixed(2)}&cu=INR` : '';
    const qrCodeUrl = showUpiQr ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(upiUrl)}` : '';

    const styles: { [key: string]: React.CSSProperties } = {
        page: {
            width: '210mm',
            height: '148mm',
            boxSizing: 'border-box',
            backgroundColor: 'white',
            color: 'black',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '8.5pt',
            display: 'flex',
            flexDirection: 'column',
            padding: '4mm',
            border: '0.2pt solid black',
            lineHeight: '1.2',
            position: 'relative',
            overflow: 'hidden'
        },
        section: {
            border: '0.2pt solid black',
            marginBottom: '-0.2pt',
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '8pt',
        },
        th: {
            border: '0.2pt solid black',
            padding: '1mm',
            backgroundColor: '#f0f0f0',
            fontWeight: 'bold',
            textAlign: 'center',
        },
        td: {
            border: '0.2pt solid black',
            padding: '0.8mm 1mm',
            height: 'auto',
            minHeight: '6mm'
        },
        summaryTableTd: {
            border: '0.2pt solid black',
            padding: '0.5mm 2mm',
            fontSize: '8pt',
        }
    };

    return (
        <div style={styles.page}>
            {/* Header Section */}
            <div style={{...styles.section, display: 'flex', justifyContent: 'space-between', padding: '1mm 2mm'}}>
                <div style={{width: '40%'}}>
                    <h1 style={{fontSize: '14pt', margin: 0, fontWeight: 'bold'}}>{companyProfile.name}</h1>
                    <p style={{margin: 0, fontSize: '8pt'}}>{companyProfile.address}</p>
                    <p style={{margin: 0, fontSize: '8pt'}}>Ph.No: {companyProfile.phone || 'N/A'}</p>
                </div>
                <div style={{textAlign: 'center', alignSelf: 'center'}}>
                    <h2 style={{fontSize: '11pt', margin: 0, fontWeight: 'bold'}}>Tax Invoice</h2>
                    <p style={{margin: '1mm 0 0 0', fontSize: '7pt'}}>GSTIN: {companyProfile.gstin}</p>
                </div>
                <div style={{textAlign: 'right', width: '30%'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Invoice No. :</span> <span style={{fontWeight: 'bold'}}>{bill.billNumber}</span></div>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Inv. Date :</span> <span style={{fontWeight: 'bold'}}>{new Date(bill.date).toLocaleDateString()}</span></div>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Due Date :</span> <span style={{fontWeight: 'bold'}}>{new Date(bill.date).toLocaleDateString()}</span></div>
                </div>
            </div>

            {/* Shop/Buyer Section */}
            <div style={{...styles.section, padding: '1mm 2mm', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr'}}>
                <div>
                    <div style={{display: 'flex', gap: '2mm'}}>
                        <span style={{fontWeight: 'bold', minWidth: '20mm'}}>Shop Name:</span>
                        <span style={{fontWeight: 'bold'}}>{bill.customerName}</span>
                    </div>
                    <div style={{display: 'flex', gap: '2mm', marginTop: '0.5mm'}}>
                        <span style={{fontWeight: 'bold', minWidth: '20mm'}}>Address :</span>
                        <span>{bill.customerName} Address Details</span>
                    </div>
                </div>
                <div style={{borderLeft: '0.2pt solid black', paddingLeft: '2mm'}}>
                    <div>State Code: 27 Maharashtra</div>
                    <div style={{marginTop: '0.5mm'}}>GSTIN: 27XXXXX0000X1Z1</div>
                </div>
                <div style={{borderLeft: '0.2pt solid black', paddingLeft: '2mm', textAlign: 'right'}}>
                    <div>S/Man: {bill.salesmanName || 'CHANDU'}</div>
                    <div style={{marginTop: '0.5mm'}}>PAN No: </div>
                </div>
            </div>

            {/* Items Table - Fixed no empty lines logic */}
            <div style={{...styles.section, flexGrow: 1, overflow: 'hidden', borderBottom: 'none'}}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={{...styles.th, width: '3%'}}>Sr.</th>
                            <th style={{...styles.th, width: '30%', textAlign: 'left'}}>Description</th>
                            <th style={{...styles.th, width: '10%'}}>HSN Code</th>
                            <th style={{...styles.th, width: '5%'}}>Qty</th>
                            <th style={{...styles.th, width: '5%'}}>UOM</th>
                            <th style={{...styles.th, width: '8%'}}>MRP</th>
                            <th style={{...styles.th, width: '8%'}}>Rate</th>
                            <th style={{...styles.th, width: '10%'}}>Taxable Val</th>
                            <th style={{...styles.th, width: '4%'}}>C%</th>
                            <th style={{...styles.th, width: '6%'}}>CGST Amt</th>
                            <th style={{...styles.th, width: '4%'}}>S%</th>
                            <th style={{...styles.th, width: '6%'}}>SGST Amt</th>
                            <th style={{...styles.th, width: '10%'}}>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => {
                            const taxable = item.total / (1 + item.gst / 100);
                            const gstAmt = item.total - taxable;
                            return (
                                <tr key={idx}>
                                    <td style={{...styles.td, textAlign: 'center'}}>{idx + 1}</td>
                                    <td style={{...styles.td, fontWeight: 'bold'}}>{item.productName}</td>
                                    <td style={{...styles.td, textAlign: 'center'}}>{item.hsnCode}</td>
                                    <td style={{...styles.td, textAlign: 'center'}}>{item.quantity}</td>
                                    <td style={{...styles.td, textAlign: 'center'}}>PCS</td>
                                    <td style={{...styles.td, textAlign: 'right'}}>{item.mrp.toFixed(2)}</td>
                                    <td style={{...styles.td, textAlign: 'right'}}>{(taxable / item.quantity).toFixed(2)}</td>
                                    <td style={{...styles.td, textAlign: 'right'}}>{taxable.toFixed(2)}</td>
                                    <td style={{...styles.td, textAlign: 'center'}}>{(item.gst / 2)}</td>
                                    <td style={{...styles.td, textAlign: 'right'}}>{(gstAmt / 2).toFixed(2)}</td>
                                    <td style={{...styles.td, textAlign: 'center'}}>{(item.gst / 2)}</td>
                                    <td style={{...styles.td, textAlign: 'right'}}>{(gstAmt / 2).toFixed(2)}</td>
                                    <td style={{...styles.td, textAlign: 'right', fontWeight: 'bold'}}>{item.total.toFixed(2)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Totals Section */}
            <div style={{...styles.section, borderTop: '0.2pt solid black'}}>
                <div style={{display: 'flex'}}>
                    <div style={{flex: 1.5, borderRight: '0.2pt solid black', padding: '1mm 2mm', fontSize: '7pt', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
                        <div>
                            <p style={{margin: 0}}>Issued Under Section 31 of CGST Act 2017 and Maharashtra State GST Act 2017</p>
                            <p style={{margin: '1mm 0 0 0'}}>Goods once sold will not be taken back or exchanged.</p>
                        </div>
                        <div style={{marginTop: '1mm'}}>
                            <p style={{fontWeight: 'bold', margin: 0, fontSize: '7.5pt'}}>{systemConfig.bankDetails || 'HDFC A/C NO 50200081513801 IFSC CODE HDFC0001016'}</p>
                            <p style={{fontSize: '8.5pt', fontWeight: 'bold', marginTop: '1mm'}}>Rs.{toWords(bill.grandTotal)}</p>
                        </div>
                    </div>
                    
                    <div style={{flex: 0.5, borderRight: '0.2pt solid black', padding: '1mm', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                         {showUpiQr && <img src={qrCodeUrl} alt="QR" style={{height: '22mm', width: '22mm'}} />}
                    </div>

                    <div style={{flex: 1, padding: '0'}}>
                        <table style={{width: '100%', borderCollapse: 'collapse'}}>
                            <tbody>
                                <tr><td style={styles.summaryTableTd}>Gross</td><td style={{...styles.summaryTableTd, textAlign: 'right'}}>{bill.subTotal.toFixed(2)}</td></tr>
                                <tr><td style={styles.summaryTableTd}>Disc/Sch.</td><td style={{...styles.summaryTableTd, textAlign: 'right'}}>0.00</td></tr>
                                <tr><td style={styles.summaryTableTd}>GST Rs.</td><td style={{...styles.summaryTableTd, textAlign: 'right'}}>{bill.totalGst.toFixed(2)}</td></tr>
                                <tr><td style={styles.summaryTableTd}>Round +/-</td><td style={{...styles.summaryTableTd, textAlign: 'right'}}>{(bill.roundOff || 0).toFixed(2)}</td></tr>
                                <tr style={{backgroundColor: '#f0f0f0', fontWeight: 'bold'}}><td style={{...styles.summaryTableTd, borderBottom: 'none'}}>Net Rs.</td><td style={{...styles.summaryTableTd, borderBottom: 'none', textAlign: 'right', fontSize: '10.5pt'}}>{bill.grandTotal.toFixed(2)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Bottom Branding / Remarks Row */}
            <div style={{display: 'flex', justifyContent: 'space-between', padding: '1mm 0', fontSize: '7.5pt', borderTop: '0.2pt solid black', marginTop: '1mm'}}>
                <div style={{width: '30%'}}>M.Soft India@9890072651</div>
                <div style={{width: '40%', textAlign: 'center', fontWeight: 'bold'}}>Subject to Nanded. Jurisdiction (E. & OE)</div>
                <div style={{width: '30%', textAlign: 'right'}}>For {companyProfile.name}</div>
            </div>
        </div>
    );
};

export default PrintableA5LandscapeBill;

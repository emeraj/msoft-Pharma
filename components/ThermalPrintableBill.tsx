import React, { useMemo } from 'react';
import type { Bill, CompanyProfile, SystemConfig } from '../types';

const ThermalPrintableBill: React.FC<{ bill: Bill; companyProfile: CompanyProfile; systemConfig: SystemConfig; }> = ({ bill, companyProfile, systemConfig }) => {
    const items = bill?.items || [];
    const line = '-'.repeat(42);
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
        container: {
            backgroundColor: 'white',
            color: 'black',
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: '12px',
            lineHeight: '1.4',
            width: '72mm',
            padding: '3mm',
            boxSizing: 'border-box',
        },
        textCenter: { textAlign: 'center' },
        header: {
            fontWeight: 'bold',
            fontSize: '14px',
            textTransform: 'uppercase',
            margin: '0',
        },
        subHeader: {
            fontSize: '11px',
            margin: '2px 0',
        },
        line: {
            margin: '4px 0',
            fontSize: '11px',
        },
        flex: { display: 'flex' },
        fontBold: { fontWeight: 'bold' },
        flexGrow: { flexGrow: 1 },
        textRight: { textAlign: 'right' },
        justifyBetween: { justifyContent: 'space-between' },
        mt2: { marginTop: '8px' },
    };

    const PaddedRow: React.FC<{left: string, right: string, bold?: boolean}> = ({left, right, bold}) => (
        <div style={{...styles.flex, ...(bold && styles.fontBold)}}>
            <span>{left}</span>
            <span style={{...styles.flexGrow, ...styles.textRight}}>{right}</span>
        </div>
    );
    
    return (
        <pre style={styles.container}>
            <div style={styles.textCenter}>
                <h1 style={styles.header}>{companyProfile.name}</h1>
                <p style={styles.subHeader}>{companyProfile.address}</p>
                <p style={styles.subHeader}>GSTIN: {companyProfile.gstin}</p>
                <div style={styles.line}>{line}</div>
                <h2 style={{...styles.fontBold, ...styles.subHeader}}>TAX INVOICE</h2>
                <div style={styles.line}>{line}</div>
            </div>
            
            <div style={styles.subHeader}>
                <PaddedRow left={`Bill No: ${bill.billNumber}`} right={`Date: ${new Date(bill.date).toLocaleDateString()}`} />
                <div>Customer: {bill.customerName}</div>
                {isPharmaMode && bill.doctorName && <div>Doctor: {bill.doctorName}</div>}
            </div>

            <div style={styles.line}>{line}</div>

            {/* Header */}
            <div style={{ ...styles.flex, ...styles.fontBold, ...styles.subHeader }}>
                <div style={{width: '50%'}}>Item{isPharmaMode ? '/Batch' : ''}</div>
                <div style={{width: '15%', textAlign: 'center'}}>Qty</div>
                <div style={{width: '15%', textAlign: 'right'}}>Rate</div>
                <div style={{width: '20%', textAlign: 'right'}}>Amount</div>
            </div>

            <div style={styles.line}>{line}</div>

            {/* Items */}
            <div>
                {items.map((item, index) => (
                    <React.Fragment key={item.batchId}>
                        <div style={{ ...styles.flex, fontSize: '11px', fontWeight: 'bold' }}>
                            <div style={{width: '50%', fontFamily: '"Arial Narrow", Arial, sans-serif'}}>{index + 1}. {item.productName}</div>
                            <div style={{width: '15%', textAlign: 'center'}}>{item.quantity}</div>
                            <div style={{width: '15%', textAlign: 'right'}}>{item.mrp.toFixed(2)}</div>
                            <div style={{width: '20%', textAlign: 'right'}}>{item.total.toFixed(2)}</div>
                        </div>
                        {isPharmaMode && (
                            <div style={{ fontSize: '10px', paddingLeft: '12px', color: '#333' }}>
                                B:{item.batchNumber} E:{item.expiryDate}
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>

            <div style={styles.line}>{line}</div>

            {/* Totals */}
            <div style={{...styles.subHeader}}>
                <PaddedRow left="Subtotal:" right={(bill.subTotal || 0).toFixed(2)} />
                <PaddedRow left="Total GST:" right={(bill.totalGst || 0).toFixed(2)} />
            </div>
            
            <div style={styles.line}>{line}</div>
            
            <div style={{...styles.flex, ...styles.justifyBetween, ...styles.fontBold, fontSize: '14px', margin: '4px 0'}}>
                <span>GRAND TOTAL:</span>
                <span>₹{(bill.grandTotal || 0).toFixed(2)}</span>
            </div>

            <div style={styles.line}>{line}</div>

            {/* GST Summary */}
            <div style={{...styles.subHeader, ...styles.textCenter, ...styles.fontBold}}>GST Summary</div>
             <div style={{ ...styles.flex, ...styles.fontBold, ...styles.subHeader }}>
                <div style={{width: '25%', textAlign: 'center'}}>Rate</div>
                <div style={{width: '25%', textAlign: 'right'}}>Taxable</div>
                <div style={{width: '25%', textAlign: 'right'}}>CGST</div>
                <div style={{width: '25%', textAlign: 'right'}}>SGST</div>
            </div>
            {gstSummary.map(g => (
                 <div key={g.rate} style={{ ...styles.flex, ...styles.subHeader }}>
                    <div style={{width: '25%', textAlign: 'center'}}>{g.rate.toFixed(2)}%</div>
                    <div style={{width: '25%', textAlign: 'right'}}>{g.taxable.toFixed(2)}</div>
                    <div style={{width: '25%', textAlign: 'right'}}>{g.cgst.toFixed(2)}</div>
                    <div style={{width: '25%', textAlign: 'right'}}>{g.sgst.toFixed(2)}</div>
                </div>
            ))}


            <div style={styles.line}>{line}</div>

            <div style={{ ...styles.textCenter, ...styles.mt2, fontSize: '11px' }}>
                <p style={{margin: '2px 0'}}>Thank you for your visit!</p>
                <p style={{margin: '2px 0'}}>Get Well Soon.</p>
            </div>
        </pre>
    );
};

export default ThermalPrintableBill;
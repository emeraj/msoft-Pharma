import React from 'react';
import type { Bill, CompanyProfile } from '../types.ts';

const ThermalPrintableBill: React.FC<{ bill: Bill; companyProfile: CompanyProfile }> = ({ bill, companyProfile }) => {
    const items = bill?.items || [];
    const line = '-'.repeat(40);

    const styles: { [key: string]: React.CSSProperties } = {
        container: {
            backgroundColor: 'white',
            color: 'black',
            fontFamily: 'monospace',
            fontSize: '10px',
            width: '72mm',
            padding: '2mm',
        },
        textCenter: { textAlign: 'center' },
        header: {
            fontWeight: 'bold',
            fontSize: '12px',
            textTransform: 'uppercase',
        },
        my2: { margin: '8px 0' },
        text9: { fontSize: '9px' },
        flex: { display: 'flex' },
        fontBold: { fontWeight: 'bold' },
        flexGrow: { flexGrow: 1 },
        w8: { width: '32px' },
        w10: { width: '40px' },
        w12: { width: '48px' },
        textRight: { textAlign: 'right' },
        spaceY1: { marginTop: '4px' },
        justifyBetween: { justifyContent: 'space-between' },
        textSm: { fontSize: '14px' },
        mt2: { marginTop: '8px' },
        textGray700: { color: '#4a5568' },
        mr2: { marginRight: '8px' },
    };

    return (
        <div style={styles.container}>
            <div style={styles.textCenter}>
                <h1 style={styles.header}>{companyProfile.name}</h1>
                <p>{companyProfile.address}</p>
                <p>GSTIN: {companyProfile.gstin}</p>
                <p>{line}</p>
                <h2 style={styles.fontBold}>TAX INVOICE</h2>
                <p>{line}</p>
            </div>
            
            <div style={{ ...styles.my2, ...styles.text9 }}>
                <p>Bill No: {bill.billNumber}</p>
                <p>Date: {new Date(bill.date).toLocaleString()}</p>
                <p>Customer: {bill.customerName}</p>
            </div>

            <p>{line}</p>

            {/* Header */}
            <div style={{ ...styles.flex, ...styles.fontBold, ...styles.text9 }}>
                <div style={styles.flexGrow}>Item</div>
                <div style={{ ...styles.w8, ...styles.textCenter }}>Qty</div>
                <div style={{ ...styles.w10, ...styles.textRight }}>Rate</div>
                <div style={{ ...styles.w12, ...styles.textRight }}>Total</div>
            </div>

            <p>{line}</p>

            {/* Items */}
            <div style={styles.text9}>
                {items.map((item, index) => (
                    <div key={item.batchId} style={styles.spaceY1}>
                        <p>{index + 1}. {item.productName}</p>
                        {item.composition && <p style={{fontSize: '8px', color: '#4A5568', margin: '2px 0 0 10px', fontStyle: 'italic'}}>{item.composition}</p>}
                        <div style={styles.flex}>
                            <div style={{...styles.flexGrow, fontSize: '8px', color: '#4A5568'}}>
                                <span style={styles.mr2}>Batch:{item.batchNumber}</span>
                                <span>Exp:{item.expiryDate}</span>
                                <br />
                                <span style={styles.mr2}>HSN:{item.hsnCode}</span>
                                <span>GST:{item.gst}%</span>
                            </div>
                            <div style={{ ...styles.w8, ...styles.textCenter }}>{item.quantity}</div>
                            <div style={{ ...styles.w10, ...styles.textRight }}>{item.mrp.toFixed(2)}</div>
                            <div style={{ ...styles.w12, ...styles.textRight, ...styles.fontBold }}>{item.total.toFixed(2)}</div>
                        </div>
                    </div>
                ))}
            </div>

            <p>{line}</p>

            {/* Totals */}
            <div style={styles.text9}>
                <div style={{...styles.flex, ...styles.justifyBetween, ...styles.spaceY1}}>
                    <span>Subtotal:</span>
                    <span style={styles.fontBold}>{(bill.subTotal || 0).toFixed(2)}</span>
                </div>
                <div style={{...styles.flex, ...styles.justifyBetween, ...styles.spaceY1}}>
                    <span>Total GST:</span>
                    <span style={styles.fontBold}>{(bill.totalGst || 0).toFixed(2)}</span>
                </div>
            </div>
            
            <p>{line}</p>
            
            <div style={{...styles.flex, ...styles.justifyBetween, ...styles.fontBold, fontSize: '12px', margin: '4px 0'}}>
                <span>GRAND TOTAL:</span>
                <span>₹{(bill.grandTotal || 0).toFixed(2)}</span>
            </div>

            <p>{line}</p>

            <div style={{ ...styles.textCenter, ...styles.mt2 }}>
                <p>Thank you for your visit!</p>
                <p>Get Well Soon.</p>
            </div>
        </div>
    );
};

export default ThermalPrintableBill;
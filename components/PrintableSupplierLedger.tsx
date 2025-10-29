import React from 'react';
import type { Supplier, CompanyProfile } from '../types';

interface Transaction {
    date: Date;
    particulars: string;
    debit: number;
    credit: number;
}

interface PrintableSupplierLedgerProps {
  supplier: Supplier;
  transactions: Transaction[];
  companyProfile: CompanyProfile;
  openingBalance: number;
  dateRange: { from: string; to: string };
}

const PrintableSupplierLedger: React.FC<PrintableSupplierLedgerProps> = ({ supplier, transactions, companyProfile, openingBalance, dateRange }) => {
    
    let runningBalance = openingBalance;
    const totalDebit = transactions.reduce((sum, tx) => sum + tx.debit, 0);
    const totalCredit = transactions.reduce((sum, tx) => sum + tx.credit, 0);
    
    const formatDate = (dateString: string) => dateString ? new Date(dateString).toLocaleDateString() : 'Start';
    const periodString = `For period: ${formatDate(dateRange.from)} to ${formatDate(dateRange.to)}`;


    const styles: { [key: string]: React.CSSProperties } = {
        page: {
            width: '210mm',
            minHeight: '297mm',
            boxSizing: 'border-box',
            backgroundColor: 'white',
            color: 'black',
            fontFamily: 'Arial, sans-serif',
            fontSize: '10pt',
            display: 'flex',
            flexDirection: 'column',
            padding: '10mm',
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2pt solid #333',
            paddingBottom: '3mm',
        },
        main: {
            flexGrow: 1,
            paddingTop: '5mm',
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '9pt',
        },
        th: {
            fontWeight: 'bold',
            padding: '2mm',
            textAlign: 'left',
            borderBottom: '1.5pt solid #666',
            backgroundColor: '#f3f4f6',
        },
        td: {
            padding: '2mm',
            borderBottom: '0.5pt solid #eee',
            verticalAlign: 'top',
        },
        footer: {
            marginTop: 'auto',
            paddingTop: '5mm',
            borderTop: '2pt solid #333',
            fontSize: '9pt',
        },
    };

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <div style={{ width: '60%' }}>
                    <h1 style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '16pt', margin: 0 }}>
                        {companyProfile.name}
                    </h1>
                    <p style={{ margin: '1mm 0 0 0', color: '#4a5568' }}>{companyProfile.address}</p>
                    <p style={{ margin: '1mm 0 0 0', color: '#4a5568' }}><strong>GSTIN:</strong> {companyProfile.gstin}</p>
                </div>
                <div style={{ width: '40%', textAlign: 'right' }}>
                    <h2 style={{ fontWeight: 'bold', fontSize: '14pt', margin: 0 }}>Statement of Account</h2>
                    <p style={{ margin: '1.5mm 0 0 0' }}><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                    <p style={{ margin: '1mm 0 0 0', fontSize: '9pt' }}>{periodString}</p>
                </div>
            </header>

            <section style={{ paddingTop: '4mm', paddingBottom: '4mm', borderBottom: '0.5pt solid #ccc' }}>
                <h3 style={{ fontWeight: 600, margin: 0, color: '#2d3748' }}>To:</h3>
                <p style={{ margin: '1mm 0 0 0', fontWeight: 'bold' }}>{supplier.name}</p>
                <p style={{ margin: '1mm 0 0 0' }}>{supplier.address}</p>
                <p style={{ margin: '1mm 0 0 0' }}>{supplier.phone}</p>
                <p style={{ margin: '1mm 0 0 0' }}><strong>GSTIN:</strong> {supplier.gstin}</p>
            </section>

            <main style={styles.main}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={{ ...styles.th, width: '15%' }}>Date</th>
                            <th style={{ ...styles.th, width: '45%' }}>Particulars</th>
                            <th style={{ ...styles.th, textAlign: 'right', width: '15%' }}>Debit (₹)</th>
                            <th style={{ ...styles.th, textAlign: 'right', width: '15%' }}>Credit (₹)</th>
                            <th style={{ ...styles.th, textAlign: 'right', width: '15%' }}>Balance (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={styles.td}></td>
                            <td style={{ ...styles.td, fontStyle: 'italic' }}>Opening Balance</td>
                            <td style={styles.td}></td>
                            <td style={styles.td}></td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>{openingBalance.toFixed(2)}</td>
                        </tr>
                        {transactions.map((tx, index) => {
                            runningBalance = runningBalance + tx.debit - tx.credit;
                            return (
                                <tr key={index}>
                                    <td style={styles.td}>{tx.date.toLocaleDateString()}</td>
                                    <td style={styles.td}>{tx.particulars}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{tx.debit > 0 ? tx.debit.toFixed(2) : '-'}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{tx.credit > 0 ? tx.credit.toFixed(2) : '-'}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{runningBalance.toFixed(2)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                         <tr style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}>
                            <td style={{ ...styles.td, borderTop: '1.5pt solid #666'}} colSpan={2}>Closing Balance</td>
                            <td style={{ ...styles.td, textAlign: 'right', borderTop: '1.5pt solid #666' }}>{totalDebit.toFixed(2)}</td>
                            <td style={{ ...styles.td, textAlign: 'right', borderTop: '1.5pt solid #666' }}>{totalCredit.toFixed(2)}</td>
                            <td style={{ ...styles.td, textAlign: 'right', borderTop: '1.5pt solid #666' }}>{runningBalance.toFixed(2)}</td>
                         </tr>
                    </tfoot>
                </table>
            </main>
            
            <footer style={styles.footer}>
                <p style={{ margin: 0 }}>This is a computer-generated statement and does not require a signature.</p>
            </footer>
        </div>
    );
};

export default PrintableSupplierLedger;
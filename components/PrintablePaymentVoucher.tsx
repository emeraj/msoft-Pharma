
import React from 'react';
import type { Payment, CompanyProfile } from '../types';

interface PrintableVoucherProps {
  payment: Payment;
  companyProfile: CompanyProfile;
}

const toWords = (num: number): string => {
  const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const g = ['', 'thousand', 'lakh', 'crore'];

  const inWords = (n: number): string => {
    let str = '';
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
    } else {
      str += a[n];
    }
    return str.trim();
  };

  const numStr = num.toString();
  const [integerPart, decimalPart] = numStr.split('.');
  
  let result = '';
  let n = parseInt(integerPart, 10);
  let i = 0;
  
  if (n === 0) return 'Zero';

  while (n > 0) {
    let chunk;
    if (i === 0) {
      chunk = n % 1000;
      n = Math.floor(n / 1000);
    } else {
      chunk = n % 100;
      n = Math.floor(n / 100);
    }
    
    if (chunk) {
      if (i === 0 && chunk < 100) {
          result = inWords(chunk) + result;
      } else if (i === 0) {
          result = a[Math.floor(chunk / 100)] + ' hundred ' + inWords(chunk % 100) + result;
      } else {
          result = inWords(chunk) + ' ' + g[i] + ' ' + result;
      }
    }
    i++;
  }

  result = result.trim();

  if (decimalPart) {
    const paisa = parseInt(decimalPart.padEnd(2, '0'), 10);
    if (paisa > 0) {
      result += ' and ' + inWords(paisa) + ' paise';
    }
  }

  return result.split(' ').filter(s => s).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
};


const PrintablePaymentVoucher: React.FC<PrintableVoucherProps> = ({ payment, companyProfile }) => {
  const styles: { [key: string]: React.CSSProperties } = {
    page: {
      width: '210mm',
      height: '297mm',
      boxSizing: 'border-box',
      backgroundColor: 'white',
      color: 'black',
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: '12pt',
      padding: '15mm',
      border: '1px solid #ccc',
      display: 'flex',
      flexDirection: 'column',
    },
    header: {
      textAlign: 'center',
      borderBottom: '2px solid black',
      paddingBottom: '10px',
      marginBottom: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    },
    companyName: {
      fontSize: '24pt',
      fontWeight: 'bold',
      margin: 0,
    },
    companyAddress: {
      fontSize: '11pt',
      margin: '5px 0',
    },
    voucherTitle: {
      fontSize: '16pt',
      fontWeight: 'bold',
      margin: '10px 0',
      textDecoration: 'underline',
    },
    metaInfo: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '20px',
    },
    contentTable: {
      width: '100%',
      borderCollapse: 'collapse',
      border: '1px solid black',
      marginBottom: '20px',
    },
    tdLabel: {
      fontWeight: 'bold',
      padding: '10px',
      border: '1px solid black',
      width: '30%',
    },
    tdValue: {
      padding: '10px',
      border: '1px solid black',
      width: '70%',
    },
    amountInWords: {
        padding: '10px',
        border: '1px solid black',
        borderTop: 'none',
    },
    footer: {
      marginTop: 'auto',
      display: 'flex',
      justifyContent: 'space-between',
      paddingTop: '50px',
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        {companyProfile.logo && (
            <img 
                src={companyProfile.logo} 
                alt="Logo" 
                style={{ height: '20mm', marginBottom: '5px', objectFit: 'contain' }} 
            />
        )}
        <h1 style={styles.companyName}>{companyProfile.name}</h1>
        <p style={styles.companyAddress}>{companyProfile.address}</p>
        <h2 style={styles.voucherTitle}>PAYMENT VOUCHER</h2>
      </div>

      <div style={styles.metaInfo}>
        <span><strong>Voucher No:</strong> {payment.voucherNumber}</span>
        <span><strong>Date:</strong> {new Date(payment.date).toLocaleDateString()}</span>
      </div>

      <table style={styles.contentTable}>
        <tbody>
          <tr>
            <td style={styles.tdLabel}>Received by</td>
            <td style={styles.tdValue}>{payment.supplierName}</td>
          </tr>
          <tr>
            <td style={styles.tdLabel}>the sum of Rupees</td>
            <td style={styles.tdValue}>{toWords(payment.amount)} Only</td>
          </tr>
        </tbody>
      </table>
        <div style={styles.amountInWords}>
            <strong>By {payment.method}</strong> for an amount of <strong style={{fontSize: '14pt'}}>₹{payment.amount.toFixed(2)}</strong>
        </div>

       {payment.remarks && (
         <div style={{ marginTop: '20px', fontSize: '11pt' }}>
            <strong>Remarks:</strong>
            <p style={{ margin: '5px 0', paddingLeft: '10px', borderLeft: '2px solid #ccc' }}>{payment.remarks}</p>
        </div>
       )}

      <div style={styles.footer}>
        <span>____________________</span>
        <span>____________________</span>
      </div>
       <div style={{...styles.footer, paddingTop: '10px'}}>
        <span style={{paddingLeft: '30px'}}><strong>Prepared by</strong></span>
        <span style={{paddingRight: '35px'}}><strong>Receiver's Seal & Signature</strong></span>
      </div>
    </div>
  );
};

export default PrintablePaymentVoucher;
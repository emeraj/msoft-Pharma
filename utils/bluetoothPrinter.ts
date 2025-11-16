
import type { Bill, CompanyProfile, SystemConfig } from '../types';

const ESC = '\x1b';
const GS = '\x1d';
const LF = '\x0a';

// Helper to encode string to Uint8Array (simple ASCII/UTF-8 approximation)
const encode = (data: string) => {
  const buffer = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    buffer[i] = data.charCodeAt(i);
  }
  return buffer;
};

// Helper to concatenate Uint8Arrays
const concat = (...arrays: Uint8Array[]) => {
  const totalLength = arrays.reduce((acc, value) => acc + value.length, 0);
  const result = new Uint8Array(totalLength);
  let length = 0;
  for (const array of arrays) {
    result.set(array, length);
    length += array.length;
  }
  return result;
};

export const printBillOverBluetooth = async (bill: Bill, companyProfile: CompanyProfile, systemConfig: SystemConfig, macAddress: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!window.bluetoothSerial) {
            reject('Bluetooth plugin not available');
            return;
        }

        const commands: Uint8Array[] = [];
        const add = (str: string) => commands.push(encode(str));

        // Reset
        add(ESC + '@');
        
        // Center
        add(ESC + 'a' + '\x01');
        
        // Double height/width for title
        add(GS + '!' + '\x11');
        add(companyProfile.name.substring(0, 20) + LF);
        add(GS + '!' + '\x00'); // Normal

        add(companyProfile.address.substring(0, 32) + LF);
        if(companyProfile.phone) add('Ph: ' + companyProfile.phone + LF);
        if(companyProfile.gstin) add('GSTIN: ' + companyProfile.gstin + LF);
        add(LF);

        // Left align
        add(ESC + 'a' + '\x00');
        add('Bill No: ' + bill.billNumber + LF);
        add('Date: ' + new Date(bill.date).toLocaleDateString() + ' ' + new Date(bill.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + LF);
        add('Customer: ' + bill.customerName + LF);
        add('-'.repeat(32) + LF);

        // Items
        add('Item          Qty   Rate   Total' + LF);
        add('-'.repeat(32) + LF);
        
        bill.items.forEach(item => {
            add(item.productName.substring(0, 32) + LF);
            
            const qty = item.quantity.toString();
            const rate = item.mrp.toFixed(2);
            const total = item.total.toFixed(2);
            
            let line2 = "";
            // Simple padding logic for 32 columns
            // Qty at col 14 (length 4), Rate at col 19 (length 7), Total at col 27 (length 8 approx)
            
            line2 += " ".repeat(14 - 0); 
            line2 += qty.padStart(3, ' ');
            line2 += rate.padStart(8, ' ');
            line2 += total.padStart(7, ' ');
            
            add(line2 + LF);
        });
        
        add('-'.repeat(32) + LF);

        // Totals (Right align)
        add(ESC + 'a' + '\x02');
        add('Subtotal: ' + bill.subTotal.toFixed(2) + LF);
        add('GST: ' + bill.totalGst.toFixed(2) + LF);
        add(GS + '!' + '\x08'); // Bold
        add('Grand Total: ' + bill.grandTotal.toFixed(2) + LF);
        add(GS + '!' + '\x00');
        add('-'.repeat(32) + LF);

        // Footer (Center)
        add(ESC + 'a' + '\x01');
        if (systemConfig.remarkLine1) add(systemConfig.remarkLine1 + LF);
        add('Thank You!' + LF);
        add(LF + LF + LF); // Feed

        // Concatenate all commands
        const data = concat(...commands);

        const print = () => {
            window.bluetoothSerial.write(data, resolve, reject);
        };

        window.bluetoothSerial.isConnected(
            print,
            () => {
                window.bluetoothSerial.connect(macAddress, print, reject);
            }
        );
    });
};

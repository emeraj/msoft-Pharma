
import { Bill, CompanyProfile, SystemConfig } from '../types';

const ESC = '\x1B';
const GS = '\x1D';
const COMMANDS = {
  INIT: ESC + '@',
  ALIGN_LEFT: ESC + 'a' + '\x00',
  ALIGN_CENTER: ESC + 'a' + '\x01',
  ALIGN_RIGHT: ESC + 'a' + '\x02',
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  LF: '\x0A',
  CUT: GS + 'V' + '\x41' + '\x00', // Full cut
};

export const printBillOverBluetooth = async (
  bill: Bill, 
  companyProfile: CompanyProfile, 
  config: SystemConfig,
  macAddress: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const bt = window.bluetoothSerial;
    if (!bt) {
      return reject('Bluetooth plugin not available');
    }

    const c = COMMANDS;
    let data = c.INIT;

    // Helper to add text line
    const text = (str: string) => data += str + c.LF;
    const center = () => data += c.ALIGN_CENTER;
    const left = () => data += c.ALIGN_LEFT;
    const right = () => data += c.ALIGN_RIGHT;
    const bold = (on: boolean) => data += on ? c.BOLD_ON : c.BOLD_OFF;
    // 32 chars for standard 58mm printer
    const line = () => text('-'.repeat(32)); 

    // Header
    center();
    bold(true);
    text(companyProfile.name);
    bold(false);
    text(companyProfile.address);
    if(companyProfile.phone) text('Ph: ' + companyProfile.phone);
    if(companyProfile.gstin) text('GSTIN: ' + companyProfile.gstin);
    line();
    
    // Bill Details
    left();
    bold(true);
    text('TAX INVOICE');
    bold(false);
    text(`Bill No: ${bill.billNumber}`);
    text(`Date: ${new Date(bill.date).toLocaleString()}`);
    text(`Cust: ${bill.customerName}`);
    if(config.softwareMode === 'Pharma' && bill.doctorName) text(`Doc: ${bill.doctorName}`);
    line();

    // Items Header
    // Layout: Item (16) Qty(3) Amt(8) (Approx spaces)
    text('Item             Qty    Amt');
    line();

    // Items
    bill.items.forEach((item) => {
        // Simple truncation/padding for 32 cols
        const name = item.productName.substring(0, 16).padEnd(16, ' ');
        const qty = item.quantity.toString().padStart(3, ' ');
        const total = item.total.toFixed(2).padStart(8, ' ');
        text(`${name} ${qty} ${total}`);
        // If name was longer, print rest on next line
        if(item.productName.length > 16) {
             text(item.productName.substring(16));
        }
    });
    line();

    // Totals
    right();
    text(`SubTotal: ${bill.subTotal.toFixed(2)}`);
    text(`GST: ${bill.totalGst.toFixed(2)}`);
    bold(true);
    text(`Grand Total: ${bill.grandTotal.toFixed(2)}`);
    bold(false);
    line();

    // Footer
    center();
    if(config.remarkLine1) text(config.remarkLine1);
    if(config.remarkLine2) text(config.remarkLine2);
    text('Powered by BillingFast');
    
    // Feed paper a bit
    text(c.LF + c.LF); 

    // Printing Sequence
    const print = () => {
        bt.write(data, resolve, (err) => reject('Print Error: ' + JSON.stringify(err)));
    };

    bt.isConnected(
        () => {
            // Connected
            print();
        },
        () => {
            // Not connected, try to connect
            bt.connect(macAddress, () => {
                print();
            }, (err: any) => reject('Could not connect to printer. ' + JSON.stringify(err)));
        }
    );
  });
};


import type { Bill, CompanyProfile, SystemConfig } from '../types';

export const generateEscPosCommand = (bill: Bill, companyProfile: CompanyProfile, systemConfig: SystemConfig): string => {
    // ESC/POS Constants
    const ESC = '\x1B';
    const GS = '\x1D';
    const INIT = ESC + '@';
    const ALIGN_CENTER = ESC + 'a' + '\x01';
    const ALIGN_LEFT = ESC + 'a' + '\x00';
    const ALIGN_RIGHT = ESC + 'a' + '\x02';
    const BOLD_ON = ESC + 'E' + '\x01';
    const BOLD_OFF = ESC + 'E' + '\x00';
    
    let commands = INIT;
    
    // Helper to add line
    const addLine = (text: string) => commands += text + '\n';
    
    // Header
    commands += ALIGN_CENTER;
    commands += BOLD_ON;
    addLine(companyProfile.name);
    commands += BOLD_OFF;
    addLine(companyProfile.address);
    if (companyProfile.phone) addLine(`Ph: ${companyProfile.phone}`);
    if (companyProfile.gstin) addLine(`GSTIN: ${companyProfile.gstin}`);
    addLine('-'.repeat(32));
    
    // Title
    commands += BOLD_ON;
    addLine('TAX INVOICE');
    commands += BOLD_OFF;
    addLine('-'.repeat(32));
    
    // Details
    commands += ALIGN_LEFT;
    addLine(`Bill No: ${bill.billNumber}`);
    addLine(`Date: ${new Date(bill.date).toLocaleDateString()} ${new Date(bill.date).toLocaleTimeString()}`);
    addLine(`Customer: ${bill.customerName}`);
    if (bill.doctorName) addLine(`Doctor: ${bill.doctorName}`);
    addLine('-'.repeat(32));
    
    // Items Header
    // Assuming 32 char width for 58mm
    // Item (14) Qty(3) Price(6) Total(7)
    commands += BOLD_ON;
    addLine('Item           Qty  Price  Total');
    commands += BOLD_OFF;
    
    // Items
    bill.items.forEach(item => {
        let name = item.productName;
        // Truncate or pad name to 14 chars
        if (name.length > 14) name = name.substring(0, 14);
        else name = name.padEnd(14);
        
        const qty = item.quantity.toString().padStart(3);
        const price = item.mrp.toFixed(0).padStart(6);
        const total = item.total.toFixed(0).padStart(7);
        
        addLine(`${name} ${qty} ${price} ${total}`);
    });
    
    addLine('-'.repeat(32));
    
    // Summary
    commands += ALIGN_RIGHT;
    addLine(`Subtotal: ${bill.subTotal.toFixed(2)}`);
    addLine(`Total GST: ${bill.totalGst.toFixed(2)}`);
    commands += BOLD_ON;
    addLine(`Grand Total: ${bill.grandTotal.toFixed(2)}`);
    commands += BOLD_OFF;
    
    addLine('-'.repeat(32));
    
    // Footer
    commands += ALIGN_CENTER;
    if (systemConfig.remarkLine1) addLine(systemConfig.remarkLine1);
    if (systemConfig.remarkLine2) addLine(systemConfig.remarkLine2);
    
    // Feed lines for cutting
    addLine('');
    addLine('');
    addLine(''); 
    addLine(''); 
    
    // Optional Cut Command (GS V 66 n) - Feed n lines and cut
    // commands += GS + 'V' + '\x42' + '\x03'; 
    
    return commands;
};

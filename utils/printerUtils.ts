
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
    
    // Feed control
    const FEED_3_LINES = ESC + 'd' + '\x03'; // Print and feed 3 lines
    const CUT_PAPER = GS + 'V' + '\x42' + '\x00'; // Feed paper to cut position and cut (Function B)

    let commands = INIT;
    
    // Helper to add line
    const addLine = (text: string) => commands += text + '\n';
    
    // Helper to sanitize text (replace Rupee symbol, remove non-ASCII)
    const sanitize = (str: string) => str.replace(/₹/g, 'Rs.').normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

    // Header
    commands += ALIGN_CENTER;
    commands += BOLD_ON;
    addLine(sanitize(companyProfile.name));
    commands += BOLD_OFF;
    addLine(sanitize(companyProfile.address));
    if (companyProfile.phone) addLine(`Ph: ${sanitize(companyProfile.phone)}`);
    if (companyProfile.gstin) addLine(`GSTIN: ${sanitize(companyProfile.gstin)}`);
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
    addLine(`Customer: ${sanitize(bill.customerName)}`);
    if (bill.doctorName) addLine(`Doctor: ${sanitize(bill.doctorName)}`);
    addLine('-'.repeat(32));
    
    // Items Header
    // Assuming 32 char width for 58mm
    // Item (14) Qty(3) Price(6) Total(7)
    commands += BOLD_ON;
    addLine('Item           Qty  Price  Total');
    commands += BOLD_OFF;
    
    // Items
    bill.items.forEach(item => {
        let name = sanitize(item.productName);
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
    if (systemConfig.remarkLine1) addLine(sanitize(systemConfig.remarkLine1));
    if (systemConfig.remarkLine2) addLine(sanitize(systemConfig.remarkLine2));
    
    // Feed lines for cutting (Ensures paper comes out enough)
    commands += FEED_3_LINES;
    
    // Trigger Cut (If supported by printer)
    commands += CUT_PAPER;
    
    return commands;
};

export const sendToRawBt = (commands: string) => {
    // RawBT expects Base64 encoded data
    // We use window.btoa, so we must ensure commands are clean ASCII/binary (handled by sanitize above)
    try {
        const base64Data = btoa(commands);
        const intentUrl = `intent:base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.browser_fallback_url=https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter;end;`;
        window.location.href = intentUrl;
    } catch (e) {
        console.error("Error encoding data for RawBT:", e);
        alert("Error creating print command. Please ensure no special characters are used.");
    }
};

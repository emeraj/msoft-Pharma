
import { Bill, CompanyProfile, SystemConfig } from '../types';

const ESC = '\x1b';
const GS = '\x1d';
const LF = '\x0a';

export const generateReceipt = (bill: Bill, companyProfile: CompanyProfile, systemConfig: SystemConfig): string => {
  let buffer = '';

  // Helper to append string
  const append = (str: string) => { buffer += str; };
  // Helper to append bytes
  const appendBytes = (bytes: number[]) => { buffer += String.fromCharCode(...bytes); };

  // --- Commands ---
  // Initialize
  append(ESC + '@');
  
  // Center Align
  append(ESC + 'a' + '\x01');

  // Shop Name (Double Height & Width if supported, simple implementation here)
  // GS ! n (0-255) -> 17 = Double Height (bit 4) | Double Width (bit 0) ? No, 0x10 | 0x01 = 17? 
  // Actually standard is: 00010001 (17) for double w/h.
  append(GS + '!' + '\x11'); 
  append(companyProfile.name.substring(0, 15) + LF); // Limit length to avoid wrap mess in double mode
  append(GS + '!' + '\x00'); // Reset font

  // Address & GST
  append(companyProfile.address + LF);
  if (companyProfile.phone) append('Ph: ' + companyProfile.phone + LF);
  if (companyProfile.gstin) append('GSTIN: ' + companyProfile.gstin + LF);
  
  append(LF);

  // Left Align for Meta
  append(ESC + 'a' + '\x00');
  append('Bill No: ' + bill.billNumber + LF);
  append('Date: ' + new Date(bill.date).toLocaleDateString() + ' ' + new Date(bill.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + LF);
  append('Name: ' + bill.customerName + LF);
  if (systemConfig.softwareMode === 'Pharma' && bill.doctorName) {
      append('Dr: ' + bill.doctorName + LF);
  }

  // Divider
  append('-'.repeat(32) + LF);

  // Items Header
  // 32 cols: Item(14) Qty(4) Price(6) Total(8)
  append('Item          Qty   Rate   Total' + LF);
  append('-'.repeat(32) + LF);

  // Items
  bill.items.forEach(item => {
      const name = item.productName.substring(0, 32);
      append(name + LF);
      
      const qty = item.quantity.toString();
      const rate = item.mrp.toFixed(2);
      const total = item.total.toFixed(2);

      // Formatting spacing
      // Qty (Right align at 17)
      // Rate (Right align at 24)
      // Total (Right align at 32)
      
      // Simple manual padding for 32 chars width
      // Space for Item Name line is handled above.
      // Second line: "              10   100.00  1000.00"
      
      let line2 = "";
      // Pad left for Qty
      line2 += " ".repeat(14 - 0); // Start at col 14 (0-indexed 14th char)
      line2 += qty.padStart(3, ' ');
      line2 += rate.padStart(7, ' '); // 3 + 7 = 10 chars space
      line2 += total.padStart(8, ' ');
      
      append(line2 + LF);
  });

  append('-'.repeat(32) + LF);

  // Right Align for Totals
  append(ESC + 'a' + '\x02');
  append('Subtotal: ' + bill.subTotal.toFixed(2) + LF);
  append('GST: ' + bill.totalGst.toFixed(2) + LF);
  
  // Bold Total
  append(ESC + 'E' + '\x01');
  append('GRAND TOTAL: ' + bill.grandTotal.toFixed(2) + LF);
  append(ESC + 'E' + '\x00');
  
  append('-'.repeat(32) + LF);

  // Footer (Center)
  append(ESC + 'a' + '\x01');
  if (systemConfig.remarkLine1) append(systemConfig.remarkLine1 + LF);
  if (systemConfig.remarkLine2) append(systemConfig.remarkLine2 + LF);
  append('Thank You!' + LF);

  // Feed
  append(LF + LF + LF);
  
  // Cut (GS V 66 0)
  append(GS + 'V' + '\x42' + '\x00');

  // Encode to Base64
  return btoa(buffer);
};

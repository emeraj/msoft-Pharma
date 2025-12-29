
/**
 * Helper for Direct Web Bluetooth Printing to ESC/POS Thermal Printers
 */
export class BluetoothHelper {
  private static device: any = null;
  private static characteristic: any = null;
  private static _isConnected: boolean = false;

  static get isConnected(): boolean {
    return this._isConnected && this.device?.gatt?.connected;
  }

  /**
   * Request device and connect to the write characteristic
   */
  static async connect(): Promise<boolean> {
    try {
      if (this.isConnected && this.characteristic) return true;

      const serviceUuids = [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '0000ae30-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        'e7e11001-49f2-4d3d-9d33-317424647304',
      ];
      
      this.device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: serviceUuids
      });

      if (!this.device) return false;

      const server = await this.device.gatt?.connect();
      if (!server) throw new Error("GATT Server connection failed");

      this.characteristic = null;
      const services = await server.getPrimaryServices();
      
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          const writeChar = characteristics.find((c: any) => 
            c.properties.write || c.properties.writeWithoutResponse
          );
          
          if (writeChar) {
            this.characteristic = writeChar;
            break;
          }
        } catch (e) { continue; }
      }

      if (!this.characteristic) {
        throw new Error("No writable characteristic found.");
      }
      
      this._isConnected = true;

      this.device.addEventListener('gattserverdisconnected', () => {
        this.characteristic = null;
        this._isConnected = false;
      });

      return true;
    } catch (error: any) {
      if (error.name === 'NotFoundError' || error.message?.includes('User cancelled')) {
        console.log("Cancelled");
      } else {
        alert(`Bluetooth Error: ${error.message || 'Unknown error'}`);
      }
      this._isConnected = false;
      return false;
    }
  }

  static async printRaw(data: Uint8Array) {
    if (!this.characteristic) {
      const connected = await this.connect();
      if (!connected) throw new Error("Printer not connected");
    }

    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      if (this.characteristic.properties.writeWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
    }
  }

  static encodeText(text: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(text);
  }

  /**
   * Generates native ESC/POS QR code commands
   */
  private static generateQrCode(data: string): number[] {
    const cmds: number[] = [];
    const store_len = data.length + 3;
    const pl = store_len % 256;
    const ph = Math.floor(store_len / 256);

    // 1. Set QR Model
    cmds.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // 2. Set QR Size (6 is clear for 58mm)
    cmds.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06);
    // 3. Set Error Correction (Level L)
    cmds.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30);
    // 4. Store data
    cmds.push(0x1d, 0x28, 0x6b, pl, ph, 0x31, 0x50, 0x30);
    for (let i = 0; i < data.length; i++) {
        cmds.push(data.charCodeAt(i));
    }
    // 5. Print QR
    cmds.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    
    return cmds;
  }

  /**
   * Generate professional ESC/POS receipt bytes for thermal printers
   */
  static generateEscPos(bill: any, company: any, isPharma: boolean = false): Uint8Array {
    const width = 32; // Standard width for 58mm
    const line = "-".repeat(width) + "\n";
    
    let cmds: number[] = [
      0x1B, 0x40, // Initialize
    ];

    const addText = (t: string) => Array.from(this.encodeText(t)).forEach(b => cmds.push(b));
    const setCenter = () => cmds.push(0x1B, 0x61, 0x01);
    const setLeft = () => cmds.push(0x1B, 0x61, 0x00);
    const setRight = () => cmds.push(0x1B, 0x61, 0x02);
    const setBold = (on: boolean) => cmds.push(0x1B, 0x45, on ? 0x01 : 0x00);

    // 1. Header Section
    setCenter();
    setBold(true);
    addText(`${company.name.toUpperCase()}\n`);
    setBold(false);
    if (company.address) addText(`${company.address.substring(0, 64)}\n`);
    if (company.gstin) addText(`GST: ${company.gstin}\n`);
    addText(line);
    setBold(true);
    addText("TAX INVOICE\n");
    setBold(false);
    addText(line);

    // 2. Metadata Section
    setLeft();
    const dateStr = new Date(bill.date).toLocaleDateString();
    addText(`Bill: ${bill.billNumber}\n`);
    addText(`Date: ${dateStr}\n`);
    addText(`Cust: ${bill.customerName.substring(0, 20)}\n`);
    if (isPharma && bill.doctorName) {
        addText(`Doc : ${bill.doctorName.substring(0, 20)}\n`);
    }
    addText(line);

    // 3. Items Table Header (Item: 14, Qty: 4, Rate: 6, Amt: 8)
    setLeft();
    const hName = "Item".padEnd(14);
    const hQty = "Qty".padStart(4);
    const hRate = "Rate".padStart(6);
    const hAmt = "Amt".padStart(8);
    addText(`${hName}${hQty}${hRate}${hAmt}\n`);
    addText(line);

    // 4. Items List
    bill.items.forEach((item: any, idx: number) => {
        setLeft();
        setBold(true);
        // Multiline name if needed
        const fullName = `${idx + 1}.${item.productName.toUpperCase()}`;
        const namePart = fullName.substring(0, 14).padEnd(14);
        const qtyPart = item.quantity.toString().padStart(4);
        const ratePart = Math.round(item.mrp).toString().padStart(6);
        const amtPart = Math.round(item.total).toString().padStart(8);
        addText(`${namePart}${qtyPart}${ratePart}${amtPart}\n`);
        
        // If name was truncated, print the rest on next line
        if (fullName.length > 14) {
            addText(`  ${fullName.substring(14, 30)}\n`);
        }
        
        setBold(false);
        if (isPharma) {
            addText(`  B:${item.batchNumber} E:${item.expiryDate}\n`);
        }
    });

    addText(line);

    // 5. Totals Section
    setRight();
    addText(`Subtotal : ${bill.subTotal.toFixed(2)}\n`);
    addText(`GST Total: ${bill.totalGst.toFixed(2)}\n`);
    if (bill.roundOff && Math.abs(bill.roundOff) > 0.01) {
        addText(`RoundOff : ${bill.roundOff.toFixed(2)}\n`);
    }
    setBold(true);
    addText(`TOTAL: Rs. ${bill.grandTotal.toFixed(2)}\n`);
    setBold(false);
    addText(line);

    // 6. GST Summary
    setCenter();
    setBold(true);
    addText("GST Summary\n");
    setBold(false);
    // Rate (5), Taxable (9), CGST (9), SGST (9) - Total 32
    addText("Rate% Taxable  CGST   SGST\n");
    
    const summary = new Map<number, { taxable: number; gst: number }>();
    bill.items.forEach((item: any) => {
        const taxable = item.total / (1 + item.gst / 100);
        const gst = item.total - taxable;
        const current = summary.get(item.gst) || { taxable: 0, gst: 0 };
        current.taxable += taxable;
        current.gst += gst;
        summary.set(item.gst, current);
    });

    summary.forEach((val, rate) => {
        const rStr = `${rate}%`.padEnd(5);
        const tStr = Math.round(val.taxable).toString().padStart(8);
        const cStr = Math.round(val.gst/2).toString().padStart(7);
        const sStr = Math.round(val.gst/2).toString().padStart(7);
        addText(`${rStr}${tStr} ${cStr} ${sStr}\n`);
    });
    addText(line);

    // 7. UPI QR Code Section
    if (company.upiId && bill.grandTotal > 0) {
        setCenter();
        setBold(true);
        addText("SCAN TO PAY\n\n");
        setBold(false);
        const upiUrl = `upi://pay?pa=${company.upiId}&pn=${encodeURIComponent(company.name)}&am=${bill.grandTotal.toFixed(2)}&cu=INR`;
        const qrCmds = this.generateQrCode(upiUrl);
        qrCmds.forEach(c => cmds.push(c));
        addText("\n");
    }

    // 8. Footer
    setCenter();
    setBold(true);
    addText("THANK YOU! VISIT AGAIN\n");
    setBold(false);
    if (company.remarkLine1) addText(`${company.remarkLine1.substring(0, 32)}\n`);
    
    addText("\n\n\n\n"); // Feed paper
    cmds.push(0x1B, 0x69); // Partial cut (some printers)
    cmds.push(0x1D, 0x56, 0x01); // Feed and cut

    return new Uint8Array(cmds);
  }
}


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
   * Generate professional ESC/POS receipt bytes for 80mm (3-inch) printers
   * Character width: 42 (safe standard for 80mm)
   */
  static generateEscPos(bill: any, company: any, isPharma: boolean = false): Uint8Array {
    const lineChar = "-";
    const width = 42; // Standard width for 80mm/3-inch printers
    const line = lineChar.repeat(width) + "\n";
    
    let cmds: number[] = [
      0x1B, 0x40, // Initialize
    ];

    const addText = (t: string) => Array.from(this.encodeText(t)).forEach(b => cmds.push(b));
    const setCenter = () => cmds.push(0x1B, 0x61, 0x01);
    const setLeft = () => cmds.push(0x1B, 0x61, 0x00);
    const setRight = () => cmds.push(0x1B, 0x61, 0x02);
    const setBold = (on: boolean) => cmds.push(0x1B, 0x45, on ? 0x01 : 0x00);
    const setBig = (on: boolean) => cmds.push(0x1D, 0x21, on ? 0x11 : 0x00); // Double width/height

    // 1. Header Section
    setCenter();
    setBold(true);
    setBig(true);
    addText(`${company.name}\n`);
    setBig(false);
    setBold(false);
    addText(`${company.address?.substring(0, 80)}\n`);
    addText(`GST: ${company.gstin}\n`);
    addText(line);
    setBold(true);
    addText("TAX INVOICE\n");
    setBold(false);
    addText(line);

    // 2. Metadata Section
    setLeft();
    const dateStr = new Date(bill.date).toLocaleDateString();
    addText(`Bill No: ${bill.billNumber.padEnd(15)} Date: ${dateStr}\n`);
    addText(`Customer: ${bill.customerName}\n`);
    if (isPharma && bill.doctorName) {
        addText(`Doctor: ${bill.doctorName}\n`);
    }
    addText(line);

    // 3. Items Table Header
    // Column map: Index+Item (22), Qty (5), Rate (7), Amount (8) = 42
    addText("Item description          Qty   Rate    Amt\n");
    addText(line);

    // 4. Items List
    bill.items.forEach((item: any, idx: number) => {
        setLeft();
        setBold(true);
        // Product Name (truncated to 22 chars for the row)
        const displayName = `${idx + 1}. ${item.productName.substring(0, 18)}`;
        const namePart = displayName.padEnd(22);
        
        const qtyPart = item.quantity.toString().padStart(5);
        const ratePart = item.mrp.toFixed(1).padStart(7);
        const amtPart = item.total.toFixed(1).padStart(8);
        
        addText(`${namePart}${qtyPart}${ratePart}${amtPart}\n`);
        setBold(false);
        
        // Pharma specific batch/expiry info (indented)
        if (isPharma) {
            addText(`   Batch:${item.batchNumber} Exp:${item.expiryDate}\n`);
        }
    });

    addText(line);

    // 5. Totals Section
    setRight();
    const subTotal = (bill.subTotal || 0).toFixed(2);
    const totalGst = (bill.totalGst || 0).toFixed(2);
    const roundOff = (bill.roundOff || 0).toFixed(2);
    const grandTotal = (bill.grandTotal || 0).toFixed(2);

    addText(`Subtotal :  ${subTotal.padStart(10)}\n`);
    addText(`Total GST:  ${totalGst.padStart(10)}\n`);
    if (Math.abs(bill.roundOff) > 0.01) {
        addText(`Round Off:  ${roundOff.padStart(10)}\n`);
    }
    setBold(true);
    addText(`GRAND TOTAL: Rs. ${grandTotal.padStart(10)}\n`);
    setBold(false);
    addText(line);

    // 6. GST Breakdown Table
    setCenter();
    setBold(true);
    addText("GST TAX ANALYSIS\n");
    setBold(false);
    // Columns: Rate (6), Taxable (12), CGST (12), SGST (12) = 42
    addText("Rate %    Taxable      CGST      SGST\n");
    
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
        const rStr = `${rate}%`.padEnd(6);
        const tStr = val.taxable.toFixed(2).padStart(11);
        const cStr = (val.gst / 2).toFixed(2).padStart(10);
        const sStr = (val.gst / 2).toFixed(2).padStart(10);
        addText(`${rStr}${tStr}${cStr}${sStr}\n`);
    });
    
    addText(line);

    // 7. Footer
    setCenter();
    addText("THANK YOU! VISIT AGAIN\n");
    if (company.remarkLine1) addText(`${company.remarkLine1.substring(0, 42)}\n`);
    
    addText("\n\n\n\n\n"); // Feed paper
    cmds.push(0x1D, 0x56, 0x42, 0x00); // Cut paper (Full cut)

    return new Uint8Array(cmds);
  }
}

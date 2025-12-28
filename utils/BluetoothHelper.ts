
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

      // Standard Thermal Printer Service UUIDs
      const serviceUuids = ['000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb'];
      
      this.device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { name: 'BT-Printer' },
          { namePrefix: 'MPT' },
          { namePrefix: 'InnerPrinter' },
          { services: serviceUuids }
        ],
        optionalServices: serviceUuids
      });

      const server = await this.device.gatt?.connect();
      if (!server) throw new Error("GATT Server connection failed");

      // Try to find the write characteristic across common services
      for (const uuid of serviceUuids) {
        try {
          const service = await server.getPrimaryService(uuid);
          const characteristics = await service.getCharacteristics();
          const writeChar = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
          if (writeChar) {
            this.characteristic = writeChar;
            break;
          }
        } catch (e) { continue; }
      }

      if (!this.characteristic) throw new Error("No writable characteristic found on printer");
      
      this._isConnected = true;

      // Listen for disconnection
      this.device.addEventListener('gattserverdisconnected', () => {
        this.characteristic = null;
        this._isConnected = false;
        console.log("Printer disconnected");
      });

      return true;
    } catch (error: any) {
      // Gracefully handle user cancellation
      if (error.name === 'NotFoundError' || error.message?.includes('User cancelled')) {
        console.log("Bluetooth device selection was cancelled by the user.");
      } else {
        console.error("Bluetooth Connection Error:", error);
      }
      this._isConnected = false;
      return false;
    }
  }

  /**
   * Send ESC/POS bytes to the printer
   */
  static async printRaw(data: Uint8Array) {
    if (!this.characteristic) {
      const connected = await this.connect();
      if (!connected) throw new Error("Printer not connected");
    }

    // BLE MTU is usually small (~20 bytes). We chunk the data to ensure reliable delivery.
    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await this.characteristic!.writeValue(chunk);
    }
  }

  /**
   * Convert text to ESC/POS bytes (supports basic ASCII)
   */
  static encodeText(text: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(text);
  }

  /**
   * Generate simple ESC/POS receipt bytes
   */
  static generateEscPos(bill: any, company: any): Uint8Array {
    const line = "--------------------------------\n";
    let cmds: number[] = [
      0x1B, 0x40, // Initialize
      0x1B, 0x61, 0x01, // Center align
    ];

    const addText = (t: string) => Array.from(this.encodeText(t)).forEach(b => cmds.push(b));
    
    addText(`${company.name}\n`);
    addText(`${company.address?.substring(0, 32)}\n`);
    addText(`GST: ${company.gstin}\n`);
    addText(line);
    addText(`INVOICE: ${bill.billNumber}\n`);
    addText(`Date: ${new Date(bill.date).toLocaleDateString()}\n`);
    addText(line);
    
    cmds.push(0x1B, 0x61, 0x00); // Left align
    addText("Item            Qty      Amt\n");
    addText(line);

    bill.items.forEach((item: any) => {
        const name = item.productName.substring(0, 15).padEnd(16);
        const qty = item.quantity.toString().padStart(4);
        const amt = item.total.toFixed(2).padStart(10);
        addText(`${name}${qty}${amt}\n`);
    });

    addText(line);
    cmds.push(0x1B, 0x61, 0x02); // Right align
    addText(`SUBTOTAL: ${bill.subTotal.toFixed(2)}\n`);
    addText(`GST: ${bill.totalGst.toFixed(2)}\n`);
    addText(`TOTAL: ${bill.grandTotal.toFixed(2)}\n`);
    
    cmds.push(0x1B, 0x61, 0x01); // Center
    addText("\nThank You! Visit Again\n");
    addText("\n\n\n"); // Feed
    cmds.push(0x1D, 0x56, 0x41, 0x03); // Cut paper

    return new Uint8Array(cmds);
  }
}

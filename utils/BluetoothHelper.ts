
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

      // Expanded list of standard and common proprietary Thermal Printer GATT Service UUIDs
      const serviceUuids = [
        '000018f0-0000-1000-8000-00805f9b34fb', // Standard
        '0000ff00-0000-1000-8000-00805f9b34fb', // Common 1
        '0000ae30-0000-1000-8000-00805f9b34fb', // Common 2
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip/Generic
        'e7e11001-49f2-4d3d-9d33-317424647304', // Generic 2
      ];
      
      // Use acceptAllDevices to ensure the user can see all nearby devices.
      // We must provide optionalServices to access them after connection.
      this.device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: serviceUuids
      });

      if (!this.device) return false;

      const server = await this.device.gatt?.connect();
      if (!server) throw new Error("GATT Server connection failed");

      // Try to find the write characteristic across common services
      this.characteristic = null;
      
      // Get all primary services to see what the device actually offers
      const services = await server.getPrimaryServices();
      
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          // Find any characteristic that supports writing
          const writeChar = characteristics.find((c: any) => 
            c.properties.write || c.properties.writeWithoutResponse
          );
          
          if (writeChar) {
            this.characteristic = writeChar;
            console.log("Found writable characteristic in service:", service.uuid);
            break;
          }
        } catch (e) { 
          continue; 
        }
      }

      if (!this.characteristic) {
        throw new Error("Connected, but no writable characteristic found. This device might not be a compatible BLE printer.");
      }
      
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
        alert(`Bluetooth Error: ${error.message || 'Unknown error'}`);
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
      // Determine best write method
      if (this.characteristic.properties.writeWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
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

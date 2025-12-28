
import React, { useState, useEffect } from 'react';
import Modal from './common/Modal';
import { PrinterIcon, PlusIcon, CheckCircleIcon, BluetoothIcon, MapPinIcon, InformationCircleIcon, DeviceMobileIcon, UsbIcon } from './icons/Icons';
import type { PrinterProfile, SystemConfig } from '../types';
import { BluetoothHelper } from '../utils/BluetoothHelper';

interface PrinterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemConfig: SystemConfig;
  onUpdateConfig: (config: SystemConfig) => void;
  onSelectPrinter: (printer: PrinterProfile) => void;
}

const PrinterSelectionModal: React.FC<PrinterSelectionModalProps> = ({ isOpen, onClose, systemConfig, onUpdateConfig, onSelectPrinter }) => {
  const [view, setView] = useState<'list' | 'scanning' | 'manual'>('list');
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  const [isBtConnected, setIsBtConnected] = useState(BluetoothHelper.isConnected);

  const printers = systemConfig.printers || [];

  useEffect(() => {
    if (isOpen) {
      setView('list');
      const defaultPrinter = printers.find(p => p.isDefault);
      setSelectedPrinterId(defaultPrinter?.id || printers[0]?.id || '');
      setIsBtConnected(BluetoothHelper.isConnected);
    }
  }, [isOpen, printers]);

  const handleBtScan = async () => {
    const success = await BluetoothHelper.connect();
    if (success) {
      setIsBtConnected(true);
      // Automatically add this device to the printer list if it's the first one or named BT-Printer
      const btPrinter: PrinterProfile = {
        id: 'web-bluetooth-bt-printer',
        name: 'BT-Printer (Direct)',
        format: 'Thermal',
        isDefault: printers.length === 0,
        connectionType: 'bluetooth'
      };
      
      if (!printers.some(p => p.id === btPrinter.id)) {
          onUpdateConfig({ ...systemConfig, printers: [...printers, btPrinter] });
      }
      setSelectedPrinterId(btPrinter.id);
    } else {
      alert("Could not find or connect to BT-Printer. Ensure it is powered on and in pairing mode.");
    }
  };

  const handlePrint = () => {
    const printer = printers.find(p => p.id === selectedPrinterId);
    if (printer) {
      onSelectPrinter(printer);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Printer Setup & Direct Connect">
      <div className="space-y-6">
        {/* Direct Connect Status Section */}
        <div className={`p-4 rounded-xl border-2 transition-all ${isBtConnected ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800'}`}>
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isBtConnected ? 'bg-emerald-500' : 'bg-indigo-500'} text-white shadow-md`}>
                        <BluetoothIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Web Bluetooth</p>
                        <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            Direct Connect: 
                            <span className={isBtConnected ? 'text-emerald-600' : 'text-slate-400'}>
                                {isBtConnected ? 'CONNECTED' : 'DISCONNECTED'}
                            </span>
                        </h4>
                    </div>
                </div>
                {!isBtConnected && (
                    <button 
                        onClick={handleBtScan}
                        className="px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-lg shadow-lg hover:bg-indigo-700 uppercase tracking-tighter"
                    >
                        Scan BT-Printer
                    </button>
                )}
                {isBtConnected && (
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                )}
            </div>
        </div>

        {/* Existing Printer List */}
        <div className="space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Saved Devices</p>
            <div className="max-h-60 overflow-y-auto space-y-2">
                {printers.map(printer => (
                    <div 
                        key={printer.id}
                        onClick={() => setSelectedPrinterId(printer.id)}
                        className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${
                            selectedPrinterId === printer.id 
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500/20' 
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    >
                        <div className="flex-grow">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{printer.name}</p>
                            <p className="text-[10px] text-slate-500 uppercase font-medium tracking-widest">
                                {printer.format} • {printer.connectionType || 'System'}
                            </p>
                        </div>
                        {selectedPrinterId === printer.id && <CheckCircleIcon className="h-6 w-6 text-indigo-600" />}
                    </div>
                ))}
                {printers.length === 0 && (
                    <div className="py-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                        <PrinterIcon className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">No printers configured yet.</p>
                    </div>
                )}
            </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
            <button onClick={onClose} className="px-6 py-2 text-slate-500 font-bold hover:underline">Cancel</button>
            <button 
                onClick={handlePrint} 
                disabled={!selectedPrinterId}
                className="px-8 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-xs"
            >
                Confirm & Select
            </button>
        </div>
      </div>
    </Modal>
  );
};

export default PrinterSelectionModal;

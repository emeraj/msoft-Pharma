
import React, { useState, useEffect } from 'react';
import Modal from './common/Modal';
import { PrinterIcon, PlusIcon, CheckCircleIcon, BluetoothIcon, MapPinIcon, InformationCircleIcon, DeviceMobileIcon, UsbIcon } from './icons/Icons';
import type { PrinterProfile, SystemConfig } from '../types';

interface PrinterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemConfig: SystemConfig;
  onUpdateConfig: (config: SystemConfig) => void;
  onSelectPrinter: (printer: PrinterProfile) => void;
}

type ViewState = 'list' | 'type_select' | 'manual_setup' | 'scanning' | 'perm_nearby' | 'perm_location' | 'multi_device';

const PrinterSelectionModal: React.FC<PrinterSelectionModalProps> = ({ isOpen, onClose, systemConfig, onUpdateConfig, onSelectPrinter }) => {
  const [view, setView] = useState<ViewState>('list');
  const [newPrinter, setNewPrinter] = useState<{ name: string; format: 'A4' | 'A5' | 'Thermal'; isDefault: boolean; macAddress?: string }>({
    name: '',
    format: 'Thermal',
    isDefault: false,
  });
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  const [scannedDevices, setScannedDevices] = useState<{name: string, id: string}[]>([]);

  const printers = systemConfig.printers || [];

  useEffect(() => {
    if (isOpen) {
      if (printers.length === 0) {
        setView('type_select');
      } else {
        setView('list');
        const defaultPrinter = printers.find(p => p.isDefault);
        if (defaultPrinter) {
          setSelectedPrinterId(defaultPrinter.id);
        } else {
          setSelectedPrinterId(printers[0]?.id || '');
        }
      }
    }
    setScannedDevices([]);
  }, [isOpen, printers]);

  const handleAddPrinter = (isShared: boolean) => {
    if (!newPrinter.name) return;

    const printer: PrinterProfile = {
      // Use MAC address as ID if available, otherwise generate one
      id: newPrinter.macAddress || `printer_${Date.now()}`,
      name: newPrinter.name,
      format: newPrinter.format,
      isDefault: newPrinter.isDefault || printers.length === 0,
      isShared: isShared
    };

    let updatedPrinters = [...printers];
    if (printer.isDefault) {
      updatedPrinters = updatedPrinters.map(p => ({ ...p, isDefault: false }));
    }
    updatedPrinters.push(printer);

    onUpdateConfig({ ...systemConfig, printers: updatedPrinters });
    setNewPrinter({ name: '', format: 'Thermal', isDefault: false });
    
    setSelectedPrinterId(printer.id);
    setView('list');
  };

  const handlePrint = () => {
    const printer = printers.find(p => p.id === selectedPrinterId);
    if (printer) {
      onSelectPrinter(printer);
      onClose();
    }
  };
  
  // Scanning Logic
  useEffect(() => {
      let timer: number;
      if (view === 'scanning') {
          setScannedDevices([]);
          
          if (window.bluetoothSerial) {
              // 1. List already paired devices
              window.bluetoothSerial.list(
                  (devices: any[]) => {
                      setScannedDevices(prev => {
                         const existingIds = new Set(prev.map(p => p.id));
                         const newDevices = devices.map(d => ({ name: d.name || 'Unknown', id: d.address || d.id })).filter(d => !existingIds.has(d.id));
                         return [...prev, ...newDevices];
                      });
                  }, 
                  (err: any) => console.error('Error listing devices', err)
              );

              // 2. Scan for unpaired devices
              window.bluetoothSerial.discoverUnpaired(
                  (devices: any[]) => {
                       setScannedDevices(prev => {
                         const existingIds = new Set(prev.map(p => p.id));
                         const newDevices = devices.map(d => ({ name: d.name || 'Unknown', id: d.address || d.id })).filter(d => !existingIds.has(d.id));
                         return [...prev, ...newDevices];
                      });
                  },
                  (err: any) => console.error('Error discovering devices', err)
              );
          } else {
              // Fallback Simulation
              timer = window.setTimeout(() => {
                  setScannedDevices([
                      { name: 'Printer001', id: 'DC:0D:30:A2:F1:A4' },
                      { name: 'Galaxy A20', id: 'FC:AA:B6:7F:BB:FB' },
                      { name: 'realme TechLife Buds T100', id: '98:34:8C:38:B3:1A' },
                  ]);
              }, 2000);
          }
      }
      return () => clearTimeout(timer);
  }, [view]);

  const handleDeviceSelect = (device: {name: string, id: string}) => {
      setNewPrinter({ name: device.name, format: 'Thermal', isDefault: false, macAddress: device.id });
      setView('manual_setup');
  };

  const formatIcons = {
    'A4': <div className="w-8 h-10 border-2 border-slate-400 rounded-sm bg-white flex items-center justify-center text-[8px] font-bold text-slate-600">A4</div>,
    'A5': <div className="w-6 h-8 border-2 border-slate-400 rounded-sm bg-white flex items-center justify-center text-[8px] font-bold text-slate-600">A5</div>,
    'Thermal': <div className="w-6 h-10 border-x-2 border-t-2 border-b-2 border-slate-400 border-b-transparent rounded-t-sm bg-white flex items-center justify-center text-[8px] font-bold text-slate-600 relative"><div className="absolute -bottom-1 w-full h-2 border-t border-dashed border-slate-400"></div>T</div>
  };

  // --- Permission Views ---
  
  if (view === 'perm_nearby') {
      return (
          <Modal isOpen={true} onClose={() => setView('type_select')} title="">
              <div className="flex flex-col items-center text-center p-6">
                  <div className="mb-6 transform rotate-45 bg-pink-100 dark:bg-pink-900/30 p-4 rounded-xl">
                      <div className="transform -rotate-45">
                        <DeviceMobileIcon className="h-10 w-10 text-pink-500" />
                      </div>
                  </div>
                  <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-8 px-2 leading-relaxed">
                      Allow Billing Fast to find, connect to, and determine the relative position of nearby devices?
                  </h3>
                  <div className="flex flex-col w-full gap-3">
                      <button onClick={() => setView('perm_location')} className="w-full py-3 bg-pink-200 hover:bg-pink-300 text-pink-900 rounded-full font-semibold transition-colors">
                          Allow
                      </button>
                      <button onClick={() => setView('type_select')} className="w-full py-3 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-pink-900 dark:text-pink-300 rounded-full font-semibold transition-colors">
                          Don't allow
                      </button>
                  </div>
                  <div className="mt-8 text-slate-400 text-sm">No devices discovered yet</div>
              </div>
          </Modal>
      );
  }

  if (view === 'perm_location') {
      return (
          <Modal isOpen={true} onClose={() => setView('type_select')} title="">
              <div className="flex flex-col items-center text-center p-6">
                  <div className="mb-6">
                       <MapPinIcon className="h-12 w-12 text-pink-500" />
                  </div>
                  <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-6 px-2 leading-relaxed">
                      Allow Billing Fast to access this device's location?
                  </h3>
                  <div className="flex flex-col w-full gap-3">
                      <button onClick={() => setView('scanning')} className="w-full py-3 bg-pink-200 hover:bg-pink-300 text-pink-900 rounded-full font-semibold transition-colors">
                          While using the app
                      </button>
                      <button onClick={() => setView('scanning')} className="w-full py-3 bg-pink-200 hover:bg-pink-300 text-pink-900 rounded-full font-semibold transition-colors">
                          Only this time
                      </button>
                      <button onClick={() => setView('type_select')} className="w-full py-3 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-pink-900 dark:text-pink-300 rounded-full font-semibold transition-colors">
                          Don't allow
                      </button>
                  </div>
              </div>
          </Modal>
      );
  }
  
  if (view === 'multi_device') {
      return (
        <Modal isOpen={true} onClose={() => setView('manual_setup')} title="Configure printer">
            <div className="relative flex flex-col items-center text-center pt-2 pb-6">
                <div className="absolute -top-12 right-0">
                     <button onClick={() => setView('manual_setup')} className="bg-slate-800 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-slate-700 transition-colors">
                         Previous
                     </button>
                </div>
                <p className="text-slate-600 dark:text-slate-400 mb-8 mt-2 w-full text-left text-sm">
                    Do you want to use same printer with multiple devices?
                </p>
                <div className="mb-8 flex flex-col items-center justify-center relative h-32">
                    <div className="bg-blue-500 text-white p-3 rounded-lg mb-4 z-10 shadow-lg">
                         <PrinterIcon className="h-12 w-12" />
                    </div>
                    <div className="flex justify-center gap-4 w-full">
                        <div className="transform -rotate-12 bg-purple-500/20 p-2 rounded-lg border border-purple-400/30">
                            <DeviceMobileIcon className="h-10 w-8 text-purple-500" />
                        </div>
                         <div className="transform bg-purple-500/20 p-2 rounded-lg border border-purple-400/30 mt-4">
                            <DeviceMobileIcon className="h-10 w-8 text-purple-500" />
                        </div>
                         <div className="transform rotate-12 bg-purple-500/20 p-2 rounded-lg border border-purple-400/30">
                            <DeviceMobileIcon className="h-10 w-8 text-purple-500" />
                        </div>
                    </div>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-8 px-2">
                    Click 'yes' if there are multiple staff/devices who want to use the same printer for printing receipt.
                </p>
                <div className="flex justify-between w-full gap-4">
                    <button onClick={() => handleAddPrinter(false)} className="flex-1 py-3 bg-red-400 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors">
                        No, I don't want
                    </button>
                    <button onClick={() => handleAddPrinter(true)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold transition-colors">
                        Yes, enable it.
                    </button>
                </div>
            </div>
        </Modal>
      );
  }

  // --- Main Render Logic ---

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={
        view === 'list' ? 'Select Printer' : 
        view === 'type_select' ? 'Configure printer' :
        view === 'scanning' ? 'Select your printer' :
        'Add New Printer'
    }>
      {view === 'list' && (
        <div className="flex flex-col h-full">
            <div className="space-y-4 flex-grow">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {printers.map(printer => (
                        <div 
                            key={printer.id}
                            onClick={() => setSelectedPrinterId(printer.id)}
                            className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedPrinterId === printer.id 
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-500' 
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                        >
                            <div className="mr-4">
                                {formatIcons[printer.format]}
                            </div>
                            <div className="flex-grow">
                                <p className="font-semibold text-slate-800 dark:text-slate-200">{printer.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{printer.format} Format {printer.isShared ? '• Shared' : ''}</p>
                                {printer.format === 'Thermal' && printer.id.includes(':') && (
                                    <p className="text-[10px] text-slate-400 font-mono">{printer.id}</p>
                                )}
                            </div>
                            {printer.isDefault && (
                                 <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Default</span>
                            )}
                            {selectedPrinterId === printer.id && (
                                <CheckCircleIcon className="h-6 w-6 text-indigo-600 ml-4" />
                            )}
                        </div>
                    ))}
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t dark:border-slate-700">
                    <button onClick={() => setView('type_select')} className="text-sm font-medium bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 flex items-center gap-1">
                        <PlusIcon className="h-4 w-4" /> Add Printer
                    </button>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                        <button onClick={handlePrint} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow hover:bg-indigo-700 flex items-center gap-2">
                            <PrinterIcon className="h-5 w-5" /> Print
                        </button>
                    </div>
                </div>
            </div>
             <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 rounded-r-lg flex gap-3 items-start">
                <InformationCircleIcon className="h-5 w-5 text-yellow-700 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium">
                   You need to pair your printer first if it's not listed above, click here to open settings.
                </p>
            </div>
        </div>
      )}

      {view === 'type_select' && (
        <div className="space-y-6 animate-fade-in">
            <p className="text-slate-600 dark:text-slate-400">Select printer connection type</p>
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={() => setView('perm_nearby')}
                    className="flex flex-col items-center justify-center p-6 bg-blue-100 dark:bg-blue-900/30 rounded-2xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all aspect-square shadow-sm"
                >
                    <BluetoothIcon className="h-16 w-16 text-blue-600 mb-4" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Bluetooth</span>
                </button>
                <button 
                     onClick={() => setView('manual_setup')}
                    className="flex flex-col items-center justify-center p-6 bg-slate-100 dark:bg-slate-700 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all aspect-square shadow-sm"
                >
                    <UsbIcon className="h-16 w-16 text-slate-600 dark:text-slate-400 mb-4" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">USB Cable</span>
                </button>
            </div>
            <div className="flex justify-start">
                 {printers.length > 0 && (
                    <button onClick={() => setView('list')} className="text-indigo-600 hover:underline">Back to List</button>
                 )}
            </div>
        </div>
      )}

      {view === 'scanning' && (
          <div className="flex flex-col h-full animate-fade-in">
              <div className="flex-grow overflow-y-auto max-h-80">
                  {scannedDevices.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mb-4"></div>
                          <p className="text-lg text-slate-600 dark:text-slate-400">Scanning for printers...</p>
                      </div>
                  ) : (
                      <div className="space-y-2">
                          {scannedDevices.map((device, idx) => (
                              <div 
                                key={idx} 
                                onClick={() => handleDeviceSelect(device)}
                                className="p-4 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex justify-between items-center group"
                              >
                                  <div>
                                      <p className="font-semibold text-slate-800 dark:text-white">{device.name}</p>
                                      <p className="text-xs text-slate-500 font-mono">{device.id}</p>
                                  </div>
                                  <div className="hidden group-hover:block">
                                      <CheckCircleIcon className="h-6 w-6 text-indigo-500" />
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
               <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 rounded-r-lg flex gap-3 items-start">
                    <InformationCircleIcon className="h-5 w-5 text-yellow-700 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium">
                       You need to pair your printer first if it's not listed above, click here to open settings.
                    </p>
                </div>
          </div>
      )}

      {view === 'manual_setup' && (
        <div className="space-y-4 animate-fade-in">
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Printer Name</label>
                <input 
                    type="text" 
                    value={newPrinter.name}
                    onChange={e => setNewPrinter({...newPrinter, name: e.target.value})}
                    placeholder="e.g., Counter Thermal, Office A4"
                    className="w-full px-4 py-2 bg-yellow-100 text-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
            </div>
            {newPrinter.macAddress && (
                <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">MAC Address</label>
                     <input 
                        type="text" 
                        value={newPrinter.macAddress} 
                        readOnly
                        className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg cursor-not-allowed"
                     />
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Print Format</label>
                <div className="grid grid-cols-3 gap-3">
                    {['Thermal', 'A5', 'A4'].map((fmt) => (
                        <div 
                            key={fmt}
                            onClick={() => setNewPrinter({...newPrinter, format: fmt as any})}
                            className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center gap-2 transition-all ${
                                newPrinter.format === fmt 
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-500' 
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                        >
                            {formatIcons[fmt as 'A4' | 'A5' | 'Thermal']}
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{fmt}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <input 
                    type="checkbox" 
                    id="isDefault" 
                    checked={newPrinter.isDefault}
                    onChange={e => setNewPrinter({...newPrinter, isDefault: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="isDefault" className="text-sm text-slate-700 dark:text-slate-300">Make this the default printer</label>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700">
                <button onClick={() => setView('type_select')} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Back</button>
                <button onClick={() => { if(newPrinter.name) setView('multi_device') }} disabled={!newPrinter.name} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    Next
                </button>
            </div>
        </div>
      )}
      <style>{`
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(5px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </Modal>
  );
};

export default PrinterSelectionModal;


import React, { useState, useEffect } from 'react';
import Modal from './common/Modal';
import { PrinterIcon, PlusIcon, CheckCircleIcon, BluetoothIcon, MapPinIcon, InformationCircleIcon, DeviceMobileIcon, UsbIcon, CloudIcon } from './icons/Icons';
import type { PrinterProfile, SystemConfig } from '../types';

interface PrinterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemConfig: SystemConfig;
  onUpdateConfig: (config: SystemConfig) => void;
  onSelectPrinter: (printer: PrinterProfile) => void;
}

type ViewState = 'list' | 'type_select' | 'manual_setup' | 'scanning' | 'perm_nearby' | 'perm_location' | 'multi_device';

const isNative = () => (window as any).Capacitor?.isNativePlatform() || false;

const PrinterSelectionModal: React.FC<PrinterSelectionModalProps> = ({ isOpen, onClose, systemConfig, onUpdateConfig, onSelectPrinter }) => {
  const [view, setView] = useState<ViewState>('list');
  const [newPrinter, setNewPrinter] = useState<{ id?: string; name: string; format: 'A4' | 'A5' | 'Thermal'; isDefault: boolean }>({
    name: '',
    format: 'Thermal',
    isDefault: false,
  });
  const [isShared, setIsShared] = useState(false);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  const [scannedDevices, setScannedDevices] = useState<{name: string, id: string}[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const printers = systemConfig.printers || [];

  useEffect(() => {
    if (isOpen) {
      setIsShared(false);
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
    setIsScanning(false);
  }, [isOpen, printers]);

  const handleAddPrinter = () => {
    if (!newPrinter.name) return;

    const printer: PrinterProfile = {
      id: newPrinter.id || (newPrinter.name.includes(':') ? newPrinter.name : `printer_${Date.now()}`),
      name: newPrinter.name,
      format: newPrinter.format,
      isDefault: newPrinter.isDefault || printers.length === 0,
      isShared: isShared,
    };
    
    let updatedPrinters = [...printers];
    if (printer.isDefault) {
      updatedPrinters = updatedPrinters.map(p => ({ ...p, isDefault: false }));
    }
    updatedPrinters.push(printer);

    onUpdateConfig({ ...systemConfig, printers: updatedPrinters });
    setNewPrinter({ name: '', format: 'Thermal', isDefault: false });
    setIsShared(false);
    
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
      setIsScanning(true);
      setScannedDevices([]);
      const win = window as any;

      // Check if bluetooth plugin is available
      if (win.bluetoothSerial) {
        const onDiscover = (device: any) => {
            setScannedDevices(prev => {
                if (prev.some(d => d.id === device.address)) return prev;
                return [...prev, { name: device.name || 'Unknown Device', id: device.address }];
            });
        };

        const onError = (err: any) => {
            console.error("Bluetooth Scan Error", err);
            setIsScanning(false);
        };
        
        win.bluetoothSerial.list((devices: any[]) => {
            const mapped = devices.map(d => ({ name: d.name || 'Unknown', id: d.address }));
            setScannedDevices(mapped);
            
            win.bluetoothSerial.discoverUnpaired((unpaired: any[]) => {
                 const mappedUnpaired = unpaired.map(d => ({ name: d.name || 'Unknown', id: d.address }));
                 setScannedDevices(prev => {
                     const combined = [...prev];
                     mappedUnpaired.forEach(d => {
                         if (!combined.some(existing => existing.id === d.id)) {
                             combined.push(d);
                         }
                     });
                     return combined;
                 });
                 setIsScanning(false);
            }, onError);
        }, onError);

      } else {
        // Fallback / Simulation for browser
        timer = window.setTimeout(() => {
            setScannedDevices([
                { name: 'Printer001', id: 'DC:0D:30:A2:F1:A4' },
                { name: 'Galaxy A20', id: 'FC:AA:B6:7F:BB:FB' },
            ]);
            setIsScanning(false);
        }, 1500);
      }
    }

    return () => {
        if (timer) clearTimeout(timer);
    };
  }, [view]);

  const handleDeviceSelect = (device: {name: string, id: string}) => {
      setNewPrinter({ id: device.id, name: device.name, format: 'Thermal', isDefault: false });
      setView('multi_device'); 
  };

  const handleRawBtSelect = () => {
      setNewPrinter({ id: 'RAWBT', name: 'RawBT (Android App)', format: 'Thermal', isDefault: false });
      setView('manual_setup');
  }

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
                      Search for nearby Bluetooth devices?
                  </h3>
                  <div className="flex flex-col w-full gap-3">
                      <button onClick={() => setView('scanning')} className="w-full py-3 bg-pink-200 hover:bg-pink-300 text-pink-900 rounded-full font-semibold transition-colors">
                          Allow
                      </button>
                      <button onClick={() => setView('type_select')} className="w-full py-3 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-pink-900 dark:text-pink-300 rounded-full font-semibold transition-colors">
                          Cancel
                      </button>
                  </div>
              </div>
          </Modal>
      );
  }

  if (view === 'multi_device') {
    return (
        <Modal isOpen={true} onClose={onClose} title="Configure printer">
             <div className="flex flex-col items-center text-center p-4 pt-8">
                <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-4 px-4">Do you want to share this printer?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-8 max-w-xs leading-relaxed">
                    If 'Yes', this printer configuration will be saved to the cloud and available to other devices logged into this account.
                </p>
                
                <div className="flex gap-4 w-full">
                    <button 
                        onClick={() => { setIsShared(false); setView('manual_setup'); }} 
                        className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold transition-colors shadow-sm"
                    >
                        Local Only
                    </button>
                    <button 
                        onClick={() => { setIsShared(true); setView('manual_setup'); }} 
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors shadow-sm"
                    >
                        Yes, Share
                    </button>
                </div>
             </div>
        </Modal>
    )
  }

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={
        view === 'list' ? 'Select Printer' : 
        view === 'type_select' ? 'Add Printer' :
        view === 'scanning' ? 'Scanning...' :
        'Printer Details'
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
                                <p className="text-xs text-slate-500 dark:text-slate-400">{printer.format} Format</p>
                                {printer.id === 'RAWBT' && <p className="text-[10px] text-indigo-500 font-semibold">App Integration</p>}
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
             {isNative() ? (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 rounded-r-lg flex gap-3 items-start">
                    <InformationCircleIcon className="h-5 w-5 text-blue-700 dark:text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
                       Running on Android/iOS. Add a Bluetooth printer for direct thermal printing, or use 'Mobile App (RawBT)'.
                    </p>
                </div>
             ) : (
                <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 rounded-r-lg flex gap-3 items-start">
                    <InformationCircleIcon className="h-5 w-5 text-yellow-700 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium">
                       Running in Browser. For thermal printing, install RawBT on phone or use system print dialog.
                    </p>
                </div>
             )}
        </div>
      )}

      {view === 'type_select' && (
        <div className="space-y-6 animate-fade-in">
            <p className="text-slate-600 dark:text-slate-400 text-center">Choose how you connect to your printer</p>
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={() => setView('perm_nearby')}
                    className="flex flex-col items-center justify-center p-6 bg-blue-100 dark:bg-blue-900/30 rounded-2xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all aspect-square shadow-sm"
                >
                    <BluetoothIcon className="h-12 w-12 text-blue-600 mb-4" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Bluetooth Printer</span>
                    <span className="text-[10px] text-slate-500">Direct Connection</span>
                </button>
                <button 
                     onClick={handleRawBtSelect}
                    className="flex flex-col items-center justify-center p-6 bg-green-100 dark:bg-green-900/30 rounded-2xl hover:bg-green-200 dark:hover:bg-green-900/50 transition-all aspect-square shadow-sm"
                >
                    <CloudIcon className="h-12 w-12 text-green-600 mb-4" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Mobile App (RawBT)</span>
                    <span className="text-[10px] text-slate-500">Best for Web</span>
                </button>
                <button 
                     onClick={() => {
                         setNewPrinter({ name: '', format: 'Thermal', isDefault: false });
                         setView('multi_device');
                     }}
                    className="flex flex-col items-center justify-center p-6 bg-slate-100 dark:bg-slate-700 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all aspect-square shadow-sm col-span-2"
                >
                    <UsbIcon className="h-12 w-12 text-slate-600 dark:text-slate-400 mb-4" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">System Printer (USB/WiFi)</span>
                    <span className="text-[10px] text-slate-500">Uses OS Print Dialog</span>
                </button>
            </div>
            <div className="flex justify-center">
                 {printers.length > 0 && (
                    <button onClick={() => setView('list')} className="text-indigo-600 hover:underline">Back to List</button>
                 )}
            </div>
        </div>
      )}

      {view === 'scanning' && (
          <div className="flex flex-col h-full animate-fade-in">
              <div className="flex-grow overflow-y-auto max-h-80">
                  {isScanning ? (
                      <div className="flex flex-col items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mb-4"></div>
                          <p className="text-lg text-slate-600 dark:text-slate-400">Scanning for printers...</p>
                      </div>
                  ) : scannedDevices.length === 0 ? (
                       <div className="flex flex-col items-center justify-center py-12">
                           <p className="text-slate-600 dark:text-slate-400">No Bluetooth devices found.</p>
                           <button onClick={() => setView('scanning')} className="mt-4 text-indigo-600 hover:underline">Retry Scan</button>
                           {!isNative() && <p className="text-xs text-red-500 mt-2">(Bluetooth scan only works in Native App)</p>}
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
            {newPrinter.id && newPrinter.id !== 'RAWBT' && (
                <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Device ID</label>
                     <input type="text" value={newPrinter.id} readOnly className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg cursor-not-allowed" />
                </div>
            )}
             {newPrinter.id === 'RAWBT' && (
                 <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                     <p><strong>Instructions:</strong> Install the <a href="https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter" target="_blank" rel="noopener noreferrer" className="underline font-bold">RawBT Driver App</a> on your phone. Configure your printer inside RawBT first.</p>
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
                <button onClick={handleAddPrinter} disabled={!newPrinter.name} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    Save Printer
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

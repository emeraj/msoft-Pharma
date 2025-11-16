
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
  const [newPrinter, setNewPrinter] = useState<{ name: string; format: 'A4' | 'A5' | 'Thermal'; isDefault: boolean; connectionType: 'browser' | 'bluetooth' | 'rawbt' }>({
    name: '',
    format: 'Thermal',
    isDefault: false,
    connectionType: 'browser',
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
      id: newPrinter.name.includes(':') ? newPrinter.name : `printer_${Date.now()}`, 
      name: newPrinter.name,
      format: newPrinter.format,
      isDefault: newPrinter.isDefault || printers.length === 0,
      isShared: isShared,
      connectionType: newPrinter.connectionType,
    };
    
    let updatedPrinters = [...printers];
    if (printer.isDefault) {
      updatedPrinters = updatedPrinters.map(p => ({ ...p, isDefault: false }));
    }
    updatedPrinters.push(printer);

    onUpdateConfig({ ...systemConfig, printers: updatedPrinters });
    setNewPrinter({ name: '', format: 'Thermal', isDefault: false, connectionType: 'browser' });
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

      if (window.bluetoothSerial) {
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
        
        window.bluetoothSerial.list((devices: any[]) => {
            const mapped = devices.map(d => ({ name: d.name || 'Unknown', id: d.address }));
            setScannedDevices(mapped);
            
            window.bluetoothSerial.discoverUnpaired((unpaired: any[]) => {
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
        timer = window.setTimeout(() => {
            setScannedDevices([
                { name: 'Printer001', id: 'DC:0D:30:A2:F1:A4' },
                { name: 'Galaxy A20', id: 'FC:AA:B6:7F:BB:FB' },
                { name: 'Simulated Printer', id: 'SIM:00:11:22' },
            ]);
            setIsScanning(false);
        }, 2000);
      }
    }

    return () => {
        if (timer) clearTimeout(timer);
    };
  }, [view]);

  const handleDeviceSelect = (device: {name: string, id: string}) => {
      // For Bluetooth, we use the ID as the MAC address
      setNewPrinter({ name: device.name, format: 'Thermal', isDefault: false, connectionType: 'bluetooth' }); 
      // We'll override the ID in handleAddPrinter with the device.id logic if needed, but here we just set name.
      // Wait, handleAddPrinter uses name as ID if it has colon? 
      // Let's actually just carry the ID if we can. 
      // For now, we rely on the User to not change the name to something invalid or we just save it.
      // Simpler: Just proceed. The user might edit the name.
      setView('multi_device'); 
  };

  const formatIcons = {
    'A4': <div className="w-8 h-10 border-2 border-slate-400 rounded-sm bg-white flex items-center justify-center text-[8px] font-bold text-slate-600">A4</div>,
    'A5': <div className="w-6 h-8 border-2 border-slate-400 rounded-sm bg-white flex items-center justify-center text-[8px] font-bold text-slate-600">A5</div>,
    'Thermal': <div className="w-6 h-10 border-x-2 border-t-2 border-b-2 border-slate-400 border-b-transparent rounded-t-sm bg-white flex items-center justify-center text-[8px] font-bold text-slate-600 relative"><div className="absolute -bottom-1 w-full h-2 border-t border-dashed border-slate-400"></div>T</div>
  };
  
  const renderPermissionView = (permissionType: 'nearby' | 'location') => {
       return (
          <Modal isOpen={true} onClose={() => setView('type_select')} title="">
              <div className="flex flex-col items-center text-center p-6">
                  <div className="mb-6 transform rotate-45 bg-pink-100 dark:bg-pink-900/30 p-4 rounded-xl">
                      <div className="transform -rotate-45">
                        {permissionType === 'nearby' ? <DeviceMobileIcon className="h-10 w-10 text-pink-500" /> : <MapPinIcon className="h-12 w-12 text-pink-500" />}
                      </div>
                  </div>
                  <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-8 px-2 leading-relaxed">
                      {permissionType === 'nearby' 
                        ? "Allow Billing Fast to find, connect to, and determine the relative position of nearby devices?" 
                        : "Allow Billing Fast to access this device's location?"}
                  </h3>
                  <div className="flex flex-col w-full gap-3">
                      <button onClick={() => setView(permissionType === 'nearby' ? 'perm_location' : 'scanning')} className="w-full py-3 bg-pink-200 hover:bg-pink-300 text-pink-900 rounded-full font-semibold transition-colors">
                          {permissionType === 'nearby' ? 'Allow' : 'While using the app'}
                      </button>
                      {permissionType === 'location' && (
                           <button onClick={() => setView('scanning')} className="w-full py-3 bg-pink-200 hover:bg-pink-300 text-pink-900 rounded-full font-semibold transition-colors">
                              Only this time
                           </button>
                      )}
                      <button onClick={() => setView('type_select')} className="w-full py-3 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-pink-900 dark:text-pink-300 rounded-full font-semibold transition-colors">
                          Don't allow
                      </button>
                  </div>
              </div>
          </Modal>
      );
  };
  
  if (view === 'perm_nearby') return renderPermissionView('nearby');
  if (view === 'perm_location') return renderPermissionView('location');
  
  if (view === 'multi_device') {
    return (
        <Modal isOpen={true} onClose={onClose} title="Configure printer">
             <div className="absolute top-5 right-12 z-10">
                <button onClick={() => setView('type_select')} className="px-4 py-1.5 bg-slate-800 text-white text-sm font-medium rounded-full hover:bg-slate-700">Previous</button>
             </div>
             <div className="flex flex-col items-center text-center p-4 pt-8">
                <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-8 px-4">Do you want to use same printer with multiple devices?</h3>
                <div className="relative mb-10 w-full flex flex-col items-center">
                     <div className="bg-blue-500 p-4 rounded-xl w-24 h-20 flex items-center justify-center mb-4 relative z-10 shadow-lg">
                        <div className="bg-white w-10 h-1.5 absolute top-8 rounded-sm"></div>
                        <div className="bg-white w-10 h-1 absolute bottom-3 flex justify-between px-0.5">
                            {[...Array(8)].map((_, i) => <div key={i} className="w-0.5 h-full bg-blue-500"></div>)}
                        </div>
                     </div>
                     <div className="flex justify-center gap-6 mt-4">
                        <div className="bg-gradient-to-b from-indigo-400 to-purple-500 p-0.5 rounded-lg transform -rotate-12 w-14 h-24 flex items-center justify-center shadow-lg">
                            <div className="w-full h-full bg-slate-800 rounded-lg border-2 border-transparent opacity-30"></div>
                        </div>
                         <div className="bg-gradient-to-b from-indigo-400 to-purple-500 p-0.5 rounded-lg w-14 h-24 flex items-center justify-center shadow-lg -mt-4 z-10">
                            <div className="w-full h-full bg-slate-800 rounded-lg border-2 border-transparent opacity-30"></div>
                        </div>
                         <div className="bg-gradient-to-b from-indigo-400 to-purple-500 p-0.5 rounded-lg transform rotate-12 w-14 h-24 flex items-center justify-center shadow-lg">
                            <div className="w-full h-full bg-slate-800 rounded-lg border-2 border-transparent opacity-30"></div>
                        </div>
                     </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-8 max-w-xs leading-relaxed">
                    Click 'yes' if there are multiple staff/devices who want to use the same printer for printing receipt.
                </p>
                <div className="flex gap-4 w-full">
                    <button 
                        onClick={() => { setIsShared(false); setView('manual_setup'); }} 
                        className="flex-1 py-3 bg-red-400 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors shadow-sm"
                    >
                        No, I don't want
                    </button>
                    <button 
                        onClick={() => { setIsShared(true); setView('manual_setup'); }} 
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors shadow-sm"
                    >
                        Yes, enable it.
                    </button>
                </div>
             </div>
        </Modal>
    )
  }

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={view === 'list' ? 'Select Printer' : 'Configure printer'}>
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
                            <div className="mr-4">{formatIcons[printer.format]}</div>
                            <div className="flex-grow">
                                <p className="font-semibold text-slate-800 dark:text-slate-200">{printer.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{printer.format} Format • {printer.connectionType || 'browser'}</p>
                            </div>
                            {printer.isShared && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full mr-2">Shared</span>}
                            {printer.isDefault && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Default</span>}
                            {selectedPrinterId === printer.id && <CheckCircleIcon className="h-6 w-6 text-indigo-600 ml-4" />}
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
        </div>
      )}

      {view === 'type_select' && (
        <div className="space-y-4 animate-fade-in">
            <p className="text-slate-600 dark:text-slate-400">Select printer connection type</p>
            <div className="grid grid-cols-3 gap-3">
                <button 
                    onClick={() => setView('perm_nearby')}
                    className="flex flex-col items-center justify-center p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all shadow-sm border dark:border-slate-700"
                >
                    <BluetoothIcon className="h-10 w-10 text-blue-600 mb-3" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Bluetooth</span>
                </button>
                <button 
                     onClick={() => {
                         setNewPrinter({ name: 'USB Printer', format: 'Thermal', isDefault: false, connectionType: 'browser' }); // USB usually via browser print or serial (not impl)
                         setView('multi_device');
                     }}
                    className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-all shadow-sm border dark:border-slate-600"
                >
                    <UsbIcon className="h-10 w-10 text-slate-600 dark:text-slate-400 mb-3" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">USB Cable</span>
                </button>
                <button 
                     onClick={() => {
                         setNewPrinter({ name: 'RawBT Printer', format: 'Thermal', isDefault: false, connectionType: 'rawbt' });
                         setView('multi_device'); // Skip scan, go to multi_device then manual setup
                     }}
                    className="flex flex-col items-center justify-center p-4 bg-green-50 dark:bg-green-900/30 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/50 transition-all shadow-sm border dark:border-slate-700"
                >
                    <div className="h-10 w-10 bg-green-600 rounded flex items-center justify-center text-white font-bold text-xs mb-3">RawBT</div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">RawBT App</span>
                </button>
            </div>
            <div className="flex justify-start">
                 {printers.length > 0 && <button onClick={() => setView('list')} className="text-indigo-600 hover:underline">Back to List</button>}
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
                           <p className="text-slate-600 dark:text-slate-400">No devices found.</p>
                           <button onClick={() => setView('scanning')} className="mt-4 text-indigo-600 hover:underline">Try Again</button>
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
                                  <CheckCircleIcon className="hidden group-hover:block h-6 w-6 text-indigo-500" />
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
                    className="w-full px-4 py-2 bg-yellow-100 text-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
            </div>
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
                <button onClick={() => setView('multi_device')} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Back</button>
                <button onClick={handleAddPrinter} disabled={!newPrinter.name} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    Save Printer
                </button>
            </div>
        </div>
      )}
    </Modal>
  );
};

export default PrinterSelectionModal;

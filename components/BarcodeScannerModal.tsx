
import React, { useEffect, useRef, useState } from 'react';
import Modal from './common/Modal';
import { XIcon, CameraIcon } from './icons/Icons';

// Access Html5Qrcode from global window object
const { Html5Qrcode, Html5QrcodeSupportedFormats } = (window as any);

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  closeOnScan?: boolean;
}

const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ isOpen, onClose, onScanSuccess, closeOnScan = true }) => {
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const readerId = "reader-barcode-scanner";
  const scannerRef = useRef<any>(null);
  const isRunningRef = useRef(false);
  const lastScanRef = useRef<{text: string, time: number}>({text: '', time: 0});
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  const onScanSuccessRef = useRef(onScanSuccess);
  const onCloseRef = useRef(onClose);
  const closeOnScanRef = useRef(closeOnScan);

  useEffect(() => { onScanSuccessRef.current = onScanSuccess; }, [onScanSuccess]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { closeOnScanRef.current = closeOnScan; }, [closeOnScan]);

  useEffect(() => {
    if (isOpen) {
      const currentState = window.history.state || {};
      window.history.pushState({ ...currentState, scannerOpen: true }, '');
      const handlePopState = (event: PopStateEvent) => {
        if (!event.state?.scannerOpen) {
           onCloseRef.current();
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [isOpen]);

  const startScanner = async () => {
    if (!isOpen) return;
    
    // Clear previous state
    setError(null);
    setPermissionDenied(false);

    await new Promise(r => setTimeout(r, 300));
    const element = document.getElementById(readerId);
    if (!element) return;

    try {
        if (!Html5Qrcode) {
            setError("Scanner library not loaded. Please refresh.");
            return;
        }

        const html5QrCode = new Html5Qrcode(readerId);
        scannerRef.current = html5QrCode;

        const config = { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E
            ],
            aspectRatio: 1.0
        };

        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText: string) => {
                // Debounce duplicate scans
                const now = Date.now();
                if (decodedText === lastScanRef.current.text && now - lastScanRef.current.time < 2000) {
                    return;
                }
                lastScanRef.current = { text: decodedText, time: now };
                
                // Feedback
                setScanFeedback(decodedText);
                setTimeout(() => setScanFeedback(null), 1000);

                onScanSuccessRef.current(decodedText);
                
                if (closeOnScanRef.current) {
                    if (window.history.state?.scannerOpen) {
                        window.history.back();
                    } else {
                        onCloseRef.current();
                    }
                }
            },
            () => {}
        );
        
        isRunningRef.current = true;
    } catch (err: any) {
        console.error("Scanner start error:", err);
        // Explicitly check for permission denied errors
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.message?.toLowerCase().includes('permission')) {
             setPermissionDenied(true);
             setError(null); // Don't show generic error, show the permission UI
        } else {
             setError("Could not start camera. " + (err?.message || "Unknown error."));
        }
    }
  };

  useEffect(() => {
    if (isOpen) {
        startScanner();
    }

    return () => {
        if (scannerRef.current) {
            const scanner = scannerRef.current;
            if (isRunningRef.current) {
                scanner.stop().then(() => scanner.clear()).catch(() => {});
            } else {
                 try { scanner.clear(); } catch(e) {}
            }
            isRunningRef.current = false;
            scannerRef.current = null;
        }
    };
  }, [isOpen]);

  const handleManualClose = () => {
      if (window.history.state?.scannerOpen) {
          window.history.back();
      } else {
          onClose();
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="relative flex-grow flex flex-col justify-center overflow-hidden bg-black">
          {error && !permissionDenied && (
             <div className="absolute top-10 left-0 right-0 z-20 px-4 text-center">
                 <div className="inline-block bg-red-600 text-white px-4 py-2 rounded shadow-lg">{error}</div>
             </div>
          )}
          
          {/* Permission Request UI */}
          {permissionDenied && (
             <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/90 p-6">
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-lg text-center max-w-xs w-full shadow-2xl animate-fade-in">
                     <div className="mx-auto bg-red-100 dark:bg-red-900/50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                         <CameraIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
                     </div>
                     <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Permission Required</h3>
                     <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                         We need access to your camera to scan barcodes. Please allow access in your browser settings.
                     </p>
                     <button 
                        onClick={startScanner} 
                        className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors mb-3"
                     >
                         Retry Permission
                     </button>
                     <button 
                        onClick={handleManualClose} 
                        className="w-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 py-2 rounded-lg font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                     >
                         Close
                     </button>
                 </div>
             </div>
          )}
          
          {/* Fullscreen Scanner Container */}
          <div id={readerId} className="w-full h-full"></div>

          {/* Visual Overlay - Only show if no permission error */}
          {!permissionDenied && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Darkened borders */}
                <div className="absolute top-0 left-0 right-0 h-[calc(50%-125px)] bg-black/60"></div>
                <div className="absolute bottom-0 left-0 right-0 h-[calc(50%-125px)] bg-black/60"></div>
                <div className="absolute top-[calc(50%-125px)] left-0 w-[calc(50%-125px)] h-[250px] bg-black/60"></div>
                <div className="absolute top-[calc(50%-125px)] right-0 w-[calc(50%-125px)] h-[250px] bg-black/60"></div>

                {/* Scanning Box */}
                <div className="relative w-[250px] h-[250px] border-2 border-white/50 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                    {/* Corner markers */}
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-green-500 -mt-1 -ml-1"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-green-500 -mt-1 -mr-1"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-green-500 -mb-1 -ml-1"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-green-500 -mb-1 -mr-1"></div>
                    
                    {/* Laser Scan Line */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_4px_#ff0000] animate-scan-line"></div>
                </div>
            </div>
          )}

          {/* Success Feedback */}
          {scanFeedback && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500/90 text-white px-6 py-3 rounded-lg font-bold text-xl shadow-xl z-30 animate-bounce">
                  SCANNED: {scanFeedback}
              </div>
          )}
      </div>
      
      {/* Controls */}
      <div className="bg-black/80 p-6 flex flex-col items-center gap-4 pb-8 safe-area-bottom">
          <p className="text-white text-sm text-center opacity-80">
              {closeOnScan ? 'Align barcode within frame to scan' : 'Continuous Mode: Scan multiple items'}
          </p>
          <button 
            onClick={handleManualClose} 
            className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
              <XIcon className="h-8 w-8 text-black" />
          </button>
          <button onClick={handleManualClose} className="text-white text-sm font-medium">Close Scanner</button>
      </div>

      <style>{`
        @keyframes scan-line {
            0% { top: 0%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
        }
        .animate-scan-line {
            animation: scan-line 2s linear infinite;
        }
        @keyframes fade-in {
            0% { opacity: 0; transform: scale(0.95); }
            100% { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
            animation: fade-in 0.2s ease-out forwards;
        }
        .safe-area-bottom {
            padding-bottom: env(safe-area-inset-bottom, 20px);
        }
      `}</style>
    </div>
  );
};

export default BarcodeScannerModal;

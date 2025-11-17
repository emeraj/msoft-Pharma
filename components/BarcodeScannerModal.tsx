
import React, { useEffect, useRef, useState } from 'react';
import Modal from './common/Modal';
import { XIcon } from './icons/Icons';

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
  const [isFlashOn, setIsFlashOn] = useState(false);
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

  useEffect(() => {
    if (!isOpen) return;
    let html5QrCode: any = null;
    let isCancelled = false;

    const startScanner = async () => {
        await new Promise(r => setTimeout(r, 300));
        if (isCancelled) return;
        
        const element = document.getElementById(readerId);
        if (!element) return;

        try {
            if (!Html5Qrcode) {
                setError("Scanner library not loaded.");
                return;
            }

            html5QrCode = new Html5Qrcode(readerId);
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
                    if (isCancelled) return;

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
            
            if (!isCancelled) {
                isRunningRef.current = true;
                setError(null);
            } else {
                if (html5QrCode) html5QrCode.stop().catch(() => {});
            }
        } catch (err) {
            if (!isCancelled) {
                console.error("Scanner start error:", err);
                setError("Could not start camera. Ensure permissions are granted.");
            }
        }
    };

    startScanner();

    return () => {
        isCancelled = true;
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
          {error && (
             <div className="absolute top-10 left-0 right-0 z-20 px-4 text-center">
                 <div className="inline-block bg-red-600 text-white px-4 py-2 rounded shadow-lg">{error}</div>
             </div>
          )}
          
          {/* Fullscreen Scanner Container */}
          <div id={readerId} className="w-full h-full"></div>

          {/* Visual Overlay */}
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

          {/* Success Feedback */}
          {scanFeedback && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500/90 text-white px-6 py-3 rounded-lg font-bold text-xl shadow-xl z-30 animate-bounce">
                  SCANNED: {scanFeedback}
              </div>
          )}
      </div>
      
      {/* Controls */}
      <div className="bg-black/80 p-6 flex flex-col items-center gap-4 pb-8">
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
      `}</style>
    </div>
  );
};

export default BarcodeScannerModal;

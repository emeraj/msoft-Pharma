
import React, { useEffect, useRef, useState } from 'react';
import Modal from './common/Modal';
import { XIcon } from './icons/Icons';

// Access Html5Qrcode from global window object as it is loaded via script tag in index.html
const { Html5Qrcode, Html5QrcodeSupportedFormats } = (window as any);

// --- Shared Logic & UI ---

const useBarcodeScanner = (
    readerId: string, 
    isOpen: boolean, 
    onScanSuccess: (text: string) => void,
    onError?: (msg: string) => void
) => {
    const [error, setError] = useState<string | null>(null);
    const scannerRef = useRef<any>(null);
    const isRunningRef = useRef(false);
    const lastScanRef = useRef<{text: string, time: number}>({text: '', time: 0});
    
    // Beep sound function
    const playBeep = () => {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "sine";
        osc.frequency.setValueAtTime(1500, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    };

    useEffect(() => {
        if (!isOpen) return;

        let html5QrCode: any = null;
        let isCancelled = false;

        const startScanner = async () => {
            // Small delay to ensure DOM element exists
            await new Promise(r => setTimeout(r, 300));
            
            if (isCancelled) return;
            
            const element = document.getElementById(readerId);
            if (!element) return;

            try {
                if (!Html5Qrcode) {
                    const msg = "Scanner library not loaded.";
                    setError(msg);
                    if(onError) onError(msg);
                    return;
                }

                // Cleanup existing instance if any
                if (scannerRef.current) {
                    try {
                        await scannerRef.current.stop();
                        scannerRef.current.clear();
                    } catch (e) {
                        console.warn("Cleanup error", e);
                    }
                }

                html5QrCode = new Html5Qrcode(readerId);
                scannerRef.current = html5QrCode;

                const config = { 
                    fps: 10, 
                    qrbox: { width: 200, height: 100 }, // Rectangular box for barcodes, fits h-48
                    aspectRatio: 1.777778, // 16:9 aspect ratio
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.EAN_8,
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.CODE_39,
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E
                    ]
                };

                await html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText: string) => {
                        if (isCancelled) return;

                        const now = Date.now();
                        // Debounce duplicate scans (1.5s)
                        if (decodedText === lastScanRef.current.text && now - lastScanRef.current.time < 1500) {
                            return;
                        }
                        
                        lastScanRef.current = { text: decodedText, time: now };
                        playBeep();
                        onScanSuccess(decodedText);
                    },
                    () => {} 
                );
                
                if (!isCancelled) {
                    isRunningRef.current = true;
                    setError(null);
                } else {
                    if (html5QrCode) {
                        html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
                    }
                }

            } catch (err: any) {
                if (!isCancelled) {
                    console.error("Scanner start error:", err);
                    const msg = "Could not start camera. Please ensure camera permissions are granted.";
                    setError(msg);
                    if(onError) onError(msg);
                }
            }
        };

        startScanner();

        return () => {
            isCancelled = true;
            if (scannerRef.current) {
                const scanner = scannerRef.current;
                if (isRunningRef.current) {
                    scanner.stop()
                        .then(() => scanner.clear())
                        .catch((err: any) => console.warn("Scanner stop error:", err));
                } else {
                     try { scanner.clear(); } catch(e) {}
                }
                isRunningRef.current = false;
                scannerRef.current = null;
            }
        };
    }, [isOpen, readerId]);

    return { error };
};

interface ScannerUIProps {
    readerId: string;
    error: string | null;
    overlayText?: string;
}

const ScannerUI: React.FC<ScannerUIProps> = ({ readerId, error, overlayText }) => (
    <div className="flex flex-col items-center justify-center relative w-full">
        {error && <div className="text-red-500 mb-4 text-center px-4">{error}</div>}
        
        <div className="relative w-full rounded-xl overflow-hidden bg-black shadow-lg">
            <div id={readerId} className="w-full h-48 bg-black"></div>
            
            {/* Laser Effect Overlay */}
            {!error && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-3/4 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-scan-laser"></div>
                    <div className="absolute inset-0 border-2 border-white/20 rounded-xl"></div>
                    {/* Corner markers */}
                    <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-red-500/70 rounded-tl-lg"></div>
                    <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-red-500/70 rounded-tr-lg"></div>
                    <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-red-500/70 rounded-bl-lg"></div>
                    <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-red-500/70 rounded-br-lg"></div>
                </div>
            )}
            
            {/* Feedback Overlay */}
            {overlayText && (
                <div className="absolute top-4 left-0 right-0 flex justify-center z-10 animate-fade-in-up">
                    <div className="bg-green-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold flex items-center gap-2">
                         <span>✓ Scanned: {overlayText}</span>
                    </div>
                </div>
            )}
        </div>
        
        <style>{`
            #${readerId} video {
                object-fit: cover;
                width: 100% !important;
                height: 100% !important;
                border-radius: 0.75rem;
            }
            @keyframes scan-laser {
                0% { transform: translateY(-40px); opacity: 0; }
                10% { opacity: 1; }
                50% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateY(40px); opacity: 0; }
            }
            .animate-scan-laser {
                animation: scan-laser 2s linear infinite;
            }
             @keyframes fade-in-up {
                0% { opacity: 0; transform: translateY(10px); }
                100% { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
        `}</style>
    </div>
);

// --- Inline Component ---

export const EmbeddedScanner: React.FC<{
    onScanSuccess: (decodedText: string) => void;
    onClose: () => void;
}> = ({ onScanSuccess, onClose }) => {
    const readerId = "reader-barcode-inline";
    const [lastScanned, setLastScanned] = useState<string | null>(null);

    const handleSuccess = (text: string) => {
        setLastScanned(text);
        onScanSuccess(text);
        // Clear feedback after 2s
        setTimeout(() => setLastScanned(prev => prev === text ? null : prev), 2000);
    };

    const { error } = useBarcodeScanner(readerId, true, handleSuccess);

    return (
        <div className="mb-4 relative w-full">
            <button 
                onClick={onClose}
                className="absolute top-2 right-2 p-1 bg-black/50 rounded-full shadow-md z-20 hover:bg-black/70 text-white transition-colors backdrop-blur-sm"
                title="Close Camera"
            >
                <XIcon className="h-5 w-5" />
            </button>
            <ScannerUI readerId={readerId} error={error} overlayText={lastScanned || undefined} />
        </div>
    );
};

// --- Modal Component (Legacy) ---

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  closeOnScan?: boolean;
}

const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ isOpen, onClose, onScanSuccess, closeOnScan = true }) => {
  const readerId = "reader-barcode-modal";
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  // Refs for callbacks
  const onScanSuccessRef = useRef(onScanSuccess);
  const onCloseRef = useRef(onClose);
  const closeOnScanRef = useRef(closeOnScan);

  useEffect(() => { onScanSuccessRef.current = onScanSuccess; }, [onScanSuccess]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { closeOnScanRef.current = closeOnScan; }, [closeOnScan]);

  // Handle Hardware Back Button
  useEffect(() => {
    if (isOpen) {
      const currentState = window.history.state || {};
      window.history.pushState({ ...currentState, scannerOpen: true }, '');
      const handlePopState = (event: PopStateEvent) => {
        if (!event.state?.scannerOpen) onCloseRef.current();
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [isOpen]);

  const handleSuccess = (decodedText: string) => {
      setLastScanned(decodedText);
      onScanSuccessRef.current(decodedText);

      if (closeOnScanRef.current) {
        if (window.history.state?.scannerOpen) {
            window.history.back();
        } else {
            onCloseRef.current();
        }
      } else {
         setTimeout(() => setLastScanned(prev => prev === decodedText ? null : prev), 2000);
      }
  };

  const { error } = useBarcodeScanner(readerId, isOpen, handleSuccess);

  const handleManualClose = () => {
      if (window.history.state?.scannerOpen) {
          window.history.back();
      } else {
          onClose();
      }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleManualClose} title="Scan Barcode">
      <div className="flex flex-col items-center w-full">
         <div className="w-full max-w-sm">
            <ScannerUI readerId={readerId} error={error} overlayText={lastScanned || undefined} />
         </div>
         <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 text-center">
            {closeOnScan ? 'Point your camera at a barcode.' : 'Continuous Mode: Keep scanning to add items.'}
        </p>
         <button 
            onClick={handleManualClose} 
            className={`mt-6 px-8 py-3 rounded-full font-semibold transition-colors shadow-md ${
                closeOnScan 
                ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
        >
            {closeOnScan ? 'Cancel' : 'Done'}
        </button>
      </div>
    </Modal>
  );
};

export default BarcodeScannerModal;

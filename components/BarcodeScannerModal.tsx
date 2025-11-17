
import React, { useEffect, useRef, useState } from 'react';
import Modal from './common/Modal';

// Access Html5Qrcode from global window object as it is loaded via script tag in index.html
const { Html5Qrcode, Html5QrcodeSupportedFormats } = (window as any);

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  closeOnScan?: boolean;
}

const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ isOpen, onClose, onScanSuccess, closeOnScan = true }) => {
  const [error, setError] = useState<string | null>(null);
  const readerId = "reader-barcode-scanner";
  const scannerRef = useRef<any>(null);
  const isRunningRef = useRef(false);
  const lastScanRef = useRef<{text: string, time: number}>({text: '', time: 0});

  // Refs for callbacks to avoid effect re-triggering
  const onScanSuccessRef = useRef(onScanSuccess);
  const onCloseRef = useRef(onClose);
  const closeOnScanRef = useRef(closeOnScan);

  useEffect(() => { onScanSuccessRef.current = onScanSuccess; }, [onScanSuccess]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { closeOnScanRef.current = closeOnScan; }, [closeOnScan]);

  // Handle Hardware Back Button
  useEffect(() => {
    if (isOpen) {
      // Push a new state to history when modal opens
      const currentState = window.history.state || {};
      window.history.pushState({ ...currentState, scannerOpen: true }, '');

      const handlePopState = (event: PopStateEvent) => {
        // If back button is pressed (state changes), close the modal
        // We check if the new state lacks our 'scannerOpen' flag or just assume any pop closes it
        if (!event.state?.scannerOpen) {
           onCloseRef.current();
        }
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isOpen]);

  // Scanner Lifecycle
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
                ]
            };

            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText: string) => {
                    if (isCancelled) return;

                    const now = Date.now();
                    if (decodedText === lastScanRef.current.text && now - lastScanRef.current.time < 1500) {
                        return;
                    }
                    lastScanRef.current = { text: decodedText, time: now };

                    onScanSuccessRef.current(decodedText);
                    
                    if (closeOnScanRef.current) {
                        // Trigger back navigation to close if we pushed state
                        if (window.history.state?.scannerOpen) {
                            window.history.back();
                        } else {
                            onCloseRef.current();
                        }
                    }
                },
                () => {} // Ignore frame parse errors
            );
            
            if (!isCancelled) {
                isRunningRef.current = true;
                setError(null);
            } else {
                // If cancelled during start, stop immediately
                if (html5QrCode) {
                    html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
                }
            }

        } catch (err) {
            if (!isCancelled) {
                console.error("Scanner start error:", err);
                setError("Could not start camera.");
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
  }, [isOpen]);

  const handleManualClose = () => {
      // If we have pushed a history state, go back to close
      if (window.history.state?.scannerOpen) {
          window.history.back();
      } else {
          onClose();
      }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleManualClose} title="Scan Barcode">
      <div className="flex flex-col items-center justify-center">
        {error && <div className="text-red-500 mb-4 text-center px-4">{error}</div>}
        <div id={readerId} className="w-full max-w-sm overflow-hidden rounded-lg bg-black min-h-[250px]"></div>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 text-center">
            {closeOnScan ? 'Point your camera at a barcode to scan.' : 'Continuous Scan Mode: Point camera at barcode to add to cart.'}
        </p>
        <button onClick={handleManualClose} className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded hover:bg-slate-300 dark:hover:bg-slate-500">
            Cancel
        </button>
      </div>
    </Modal>
  );
};

export default BarcodeScannerModal;

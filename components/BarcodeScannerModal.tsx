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
  const scannerRef = useRef<any>(null);
  const lastScanRef = useRef<{text: string, time: number}>({text: '', time: 0});
  const readerId = "reader-barcode-scanner";
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Reset last scan
    lastScanRef.current = {text: '', time: 0};
    
    let html5QrCode: any = null;
    let isCancelled = false;

    const startScanner = async () => {
        // Give DOM time to render
        await new Promise(r => setTimeout(r, 300));
        
        if (isCancelled || !isMounted.current) return;
        
        const element = document.getElementById(readerId);
        if (!element) {
            // This happens if modal closed during the 300ms wait
            return;
        }

        try {
            // Cleanup any existing instance just in case
            if (scannerRef.current) {
                try {
                    await scannerRef.current.stop();
                    scannerRef.current.clear();
                } catch (e) {
                    // ignore cleanup errors of previous instance
                }
                scannerRef.current = null;
            }

            if (!Html5Qrcode) {
                setError("Scanner library not loaded. Please refresh the page.");
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

            if (isCancelled) return;

            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText: string) => {
                    if (isCancelled || !isMounted.current) return;

                    const now = Date.now();
                    if (decodedText === lastScanRef.current.text && now - lastScanRef.current.time < 1500) {
                        return;
                    }
                    lastScanRef.current = { text: decodedText, time: now };

                    onScanSuccess(decodedText);
                    if (closeOnScan) {
                        onClose();
                    }
                },
                () => {
                    // Ignore scan failure errors (happens every frame no code is found)
                }
            );

            if (isMounted.current && !isCancelled) {
                setError(null);
            }
        } catch (err) {
            if (isMounted.current && !isCancelled) {
                console.error("Error starting scanner", err);
                setError("Could not start camera. Please ensure camera permissions are granted.");
            }
        }
    };

    startScanner();

    return () => {
        isCancelled = true;
        if (html5QrCode) {
             // Attempt to stop. Note: we cannot await this in cleanup, but we trigger it.
             html5QrCode.stop().then(() => {
                try { html5QrCode?.clear(); } catch(e) {}
             }).catch((err: any) => {
                 console.warn("Scanner stop error (cleanup):", err);
                 try { html5QrCode?.clear(); } catch(e) {}
             });
             scannerRef.current = null;
        }
    };
  }, [isOpen, onScanSuccess, closeOnScan, onClose]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Scan Barcode">
      <div className="flex flex-col items-center justify-center">
        {error && <div className="text-red-500 mb-4 text-center px-4">{error}</div>}
        <div id={readerId} className="w-full max-w-sm overflow-hidden rounded-lg bg-black min-h-[250px]"></div>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 text-center">
            {closeOnScan ? 'Point your camera at a barcode to scan.' : 'Continuous Scan Mode: Point camera at barcode to add to cart.'}
        </p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded hover:bg-slate-300 dark:hover:bg-slate-500">
            Cancel
        </button>
      </div>
    </Modal>
  );
};

export default BarcodeScannerModal;
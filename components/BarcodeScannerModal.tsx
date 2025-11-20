
import React, { useEffect, useRef } from 'react';
import Modal from './common/Modal';
import { XIcon } from './icons/Icons';

// Access Html5Qrcode from global window object as it is loaded via script tag in index.html
const { Html5Qrcode, Html5QrcodeSupportedFormats } = (window as any);

interface ScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose?: () => void;
}

export const EmbeddedScanner: React.FC<ScannerProps> = ({ onScanSuccess, onClose }) => {
  const readerIdRef = useRef("reader-embedded-" + Math.random().toString(36).substring(2, 9));
  const readerId = readerIdRef.current;
  const scannerRef = useRef<any>(null);
  const isRunningRef = useRef(false);
  const lastScanRef = useRef<{text: string, time: number}>({text: '', time: 0});

  useEffect(() => {
    let html5QrCode: any = null;
    let isCancelled = false;

    const startScanner = async () => {
        // Small delay to ensure DOM element exists and layout is stable
        await new Promise(r => setTimeout(r, 100));
        
        if (isCancelled) return;
        
        const element = document.getElementById(readerId);
        if (!element) return;

        try {
            if (!Html5Qrcode) {
                console.error("Scanner library not loaded.");
                return;
            }
            
            // Cleanup any existing instance (e.g. hot reload)
            if (scannerRef.current) {
                 try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch(e) {}
            }

            html5QrCode = new Html5Qrcode(readerId);
            scannerRef.current = html5QrCode;

            const config = { 
                fps: 10, 
                qrbox: { width: 300, height: 180 }, // Larger box to fill the view as requested
                aspectRatio: 1.777778, 
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E
                ]
            };

            try {
                await html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText: string) => {
                        if (isCancelled) return;

                        const now = Date.now();
                        // Debounce: ignore duplicate scans within 2.5 seconds
                        if (decodedText === lastScanRef.current.text && now - lastScanRef.current.time < 2500) {
                            return;
                        }
                        lastScanRef.current = { text: decodedText, time: now };
                        
                        // Feedback: Beep sound
                        try {
                            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                            const oscillator = audioCtx.createOscillator();
                            const gainNode = audioCtx.createGain();
                            oscillator.connect(gainNode);
                            gainNode.connect(audioCtx.destination);
                            oscillator.type = "sine";
                            oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
                            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                            oscillator.start();
                            oscillator.stop(audioCtx.currentTime + 0.15);
                        } catch (e) {
                            // Ignore audio errors
                        }

                        onScanSuccess(decodedText);
                    },
                    () => {} // Ignore errors/failures per frame
                );
                
                if (!isCancelled) {
                    isRunningRef.current = true;
                } else {
                    // If cancelled during start, ensure we stop
                    if (html5QrCode) html5QrCode.stop().catch(() => {});
                }
            } catch (startErr: any) {
                if (isCancelled) return;
                // Swallow specific "interrupted" error caused by quick unmounting
                if (startErr?.message?.includes('The play() request was interrupted') || startErr?.name === 'AbortError') {
                    console.debug('Scanner playback interrupted (harmless)');
                } else {
                    console.warn("Scanner start error", startErr);
                }
            }

        } catch (err) {
            console.error("Scanner setup error", err);
        }
    };

    startScanner();

    return () => {
        isCancelled = true;
        if (scannerRef.current) {
            if (isRunningRef.current) {
                scannerRef.current.stop().then(() => {
                     try { scannerRef.current.clear(); } catch(e) {}
                }).catch(() => {});
            } else {
                try { scannerRef.current.clear(); } catch(e) {}
            }
            scannerRef.current = null;
            isRunningRef.current = false;
        }
    };
  }, [onScanSuccess, readerId]);

  return (
    <div className="relative w-full h-64 rounded-xl overflow-hidden bg-black border border-slate-700 shadow-sm group mb-4">
        <div id={readerId} className="w-full h-full"></div>
        
        {/* CSS Override for Video Object Fit to Ensure Cover */}
        <style>{`
            #${readerId} video {
                object-fit: cover !important;
                width: 100% !important;
                height: 100% !important;
                border-radius: 0.75rem;
            }
            #${readerId} canvas {
                display: none;
            }
        `}</style>

        {/* Overlay UI */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            {/* Scanning Area Marker - Matches qrbox dimensions */}
            <div className="relative" style={{ width: '300px', height: '180px' }}>
                {/* Dimmed Background using huge borders technique to create 'hole' */}
                <div className="absolute -inset-[1000px] border-[1000px] border-black/50 pointer-events-none"></div>
                
                {/* Box Border */}
                <div className="absolute inset-0 border border-white/20 rounded-lg shadow-sm"></div>
                
                {/* Corner Markers - Small & Clean */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-red-500 rounded-tl-sm"></div>
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-red-500 rounded-tr-sm"></div>
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-red-500 rounded-bl-sm"></div>
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-red-500 rounded-br-sm"></div>

                {/* Animated Laser Line */}
                <div className="absolute left-2 right-2 top-1/2 h-[1.5px] bg-red-500/90 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-scan-laser"></div>
            </div>
        </div>

        {/* Close Button */}
        {onClose && (
            <button 
                onClick={onClose} 
                className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm z-20 transition-colors"
                title="Close Camera"
            >
                <XIcon className="h-4 w-4" />
            </button>
        )}

        <style>{`
            @keyframes scan-laser {
                0% { transform: translateY(-85px); opacity: 0.3; }
                50% { opacity: 1; }
                100% { transform: translateY(85px); opacity: 0.3; }
            }
            .animate-scan-laser {
                animation: scan-laser 2s infinite linear;
            }
        `}</style>
    </div>
  );
};

// Legacy Modal Wrapper (for Inventory etc.)
const BarcodeScannerModal: React.FC<{ isOpen: boolean; onClose: () => void; onScanSuccess: (text: string) => void; closeOnScan?: boolean }> = ({ isOpen, onClose, onScanSuccess, closeOnScan = true }) => {
    if (!isOpen) return null;
    
    const handleScan = (text: string) => {
        onScanSuccess(text);
        if (closeOnScan) onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Scan Barcode">
            <div className="flex justify-center p-0">
               <div className="w-full">
                 <EmbeddedScanner onScanSuccess={handleScan} onClose={onClose} />
                 <p className="text-center text-sm text-slate-500 mt-2 pb-2">Position barcode within the frame</p>
               </div>
            </div>
        </Modal>
    );
};

export default BarcodeScannerModal;

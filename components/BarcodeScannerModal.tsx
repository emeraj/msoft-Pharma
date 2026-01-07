import React, { useEffect, useRef, useState } from 'react';
import Modal from './common/Modal';
import { XIcon } from './icons/Icons';

// Access Html5Qrcode from global window object as it is loaded via script tag in index.html
const { Html5Qrcode, Html5QrcodeSupportedFormats } = (window as any);

interface ScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose?: () => void;
}

// Global lock to prevent concurrent camera access across instances
let isCameraStarting = false;

export const EmbeddedScanner: React.FC<ScannerProps> = ({ onScanSuccess, onClose }) => {
  const readerIdRef = useRef("reader-embedded-" + Math.random().toString(36).substring(2, 9));
  const readerId = readerIdRef.current;
  const scannerRef = useRef<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use a ref for the callback to prevent effect re-triggering
  const onScanSuccessRef = useRef(onScanSuccess);
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    let isCancelled = false;
    let html5QrCode: any = null;

    const startScanner = async () => {
        // Wait if another instance is currently starting or cleaning up
        let attempts = 0;
        while (isCameraStarting && attempts < 20) {
            await new Promise(r => setTimeout(r, 150));
            attempts++;
            if (isCancelled) return;
        }

        isCameraStarting = true;
        
        // Safety delay to allow hardware to release from previous sessions
        await new Promise(r => setTimeout(r, 500));
        
        if (isCancelled) {
            isCameraStarting = false;
            return;
        }

        const element = document.getElementById(readerId);
        if (!element) {
            isCameraStarting = false;
            return;
        }

        try {
            if (!Html5Qrcode) {
                setErrorMessage("Scanner library not loaded.");
                isCameraStarting = false;
                return;
            }

            html5QrCode = new Html5Qrcode(readerId);
            scannerRef.current = html5QrCode;

            const config = { 
                fps: 10, 
                qrbox: { width: 250, height: 150 },
                aspectRatio: 1.777778,
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E
                ],
                videoConstraints: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: "environment"
                }
            };

            await html5QrCode.start(
                { facingMode: "environment" }, 
                config,
                (decodedText: string) => {
                    if (isCancelled) return;
                    // Beep and Callback
                    try {
                        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        const oscillator = audioCtx.createOscillator();
                        oscillator.connect(audioCtx.destination);
                        oscillator.type = "sine";
                        oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
                        oscillator.start();
                        oscillator.stop(audioCtx.currentTime + 0.1);
                    } catch (e) {}
                    onScanSuccessRef.current(decodedText);
                },
                () => {} // Ignored errors
            );
            
            setErrorMessage(null);
        } catch (err: any) {
            if (!isCancelled) {
                console.error("Scanner start error", err);
                let msg = "Could not start camera.";
                if (err?.name === 'NotReadableError' || err?.toString().includes('NotReadableError')) {
                    msg = "Camera hardware is busy. Close other camera apps and refresh.";
                } else if (err?.name === 'NotAllowedError') {
                    msg = "Camera permission denied.";
                }
                setErrorMessage(msg);
            }
        } finally {
            isCameraStarting = false;
        }
    };

    startScanner();

    return () => {
        isCancelled = true;
        const cleanup = async () => {
            if (html5QrCode) {
                try {
                    // Only stop if actually scanning to avoid the "Cannot stop, scanner is not running" error
                    // Most versions of html5-qrcode expose isScanning or state
                    if (html5QrCode.isScanning) {
                        await html5QrCode.stop();
                    } else {
                        // Fallback check: check if the video element inside is active
                        const video = document.querySelector(`#${readerId} video`) as HTMLVideoElement;
                        if (video && video.srcObject) {
                             await html5QrCode.stop();
                        }
                    }
                } catch (e) {
                    // Silently ignore "scanner not running" errors during cleanup
                    console.debug("Scanner stop suppressed", e);
                } finally {
                    try {
                        html5QrCode.clear();
                    } catch (e) {}
                    
                    // Manually force-kill all tracks on the reader element just in case
                    try {
                        const video = document.querySelector(`#${readerId} video`) as HTMLVideoElement;
                        if (video && video.srcObject) {
                            (video.srcObject as MediaStream).getTracks().forEach(t => {
                                t.stop();
                                console.debug("Track forced stop");
                            });
                        }
                    } catch (e) {}
                    
                    scannerRef.current = null;
                }
            }
        };
        cleanup();
    };
  }, [readerId]);

  return (
    <div className="relative w-full h-64 rounded-xl overflow-hidden bg-black border border-slate-700 shadow-sm group mb-4">
        <div id={readerId} className="w-full h-full"></div>
        {errorMessage && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 text-white p-6 text-center z-20">
                <div>
                    <p className="text-rose-400 font-black mb-2 uppercase tracking-tighter">Hardware Error</p>
                    <p className="text-xs opacity-80 leading-relaxed">{errorMessage}</p>
                    <button onClick={onClose} className="mt-4 px-6 py-2 bg-slate-700 rounded-lg text-xs font-bold hover:bg-slate-600 transition-colors">Close</button>
                </div>
            </div>
        )}
        {!errorMessage && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                <div className="relative" style={{ width: '250px', height: '150px' }}>
                    <div className="absolute inset-0 border border-white/40 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-md"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-md"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-md"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-md"></div>
                    <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-scan-laser"></div>
                </div>
            </div>
        )}
        <style>{`
            #${readerId} video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
            @keyframes scan-laser { 0% { transform: translateY(-75px); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateY(75px); opacity: 0; } }
            .animate-scan-laser { animation: scan-laser 2s infinite linear; }
        `}</style>
    </div>
  );
};

const BarcodeScannerModal: React.FC<{ isOpen: boolean; onClose: () => void; onScanSuccess: (text: string) => void; closeOnScan?: boolean }> = ({ isOpen, onClose, onScanSuccess, closeOnScan = true }) => {
    if (!isOpen) return null;
    const handleScan = (text: string) => { onScanSuccess(text); if (closeOnScan) onClose(); };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Scan Barcode">
            <div className="flex justify-center p-0">
               <div className="w-full">
                 <EmbeddedScanner onScanSuccess={handleScan} onClose={onClose} />
                 <p className="text-center text-xs font-bold text-slate-400 mt-2 pb-4 uppercase tracking-widest">Place Barcode in Center</p>
               </div>
            </div>
        </Modal>
    );
};

export default BarcodeScannerModal;

import React, { useEffect, useRef, useState } from 'react';
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use a ref for the callback to prevent effect re-triggering on parent re-renders
  const onScanSuccessRef = useRef(onScanSuccess);
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    let isCancelled = false;
    let html5QrCode: any = null;

    const startScanner = async () => {
        // Add a delay to allow previous scanner instances to fully teardown and release the camera.
        // This is critical for "NotReadableError" which often happens if camera is busy.
        await new Promise(r => setTimeout(r, 500));
        
        if (isCancelled) return;
        
        const element = document.getElementById(readerId);
        if (!element) return;

        try {
            if (!Html5Qrcode) {
                setErrorMessage("Scanner library not loaded.");
                return;
            }
            
            // Cleanup any existing instance if explicitly present
            if (scannerRef.current) {
                 try { 
                     if(isRunningRef.current) {
                        await scannerRef.current.stop();
                     }
                     scannerRef.current.clear(); 
                 } catch(e) {
                     console.warn("Cleanup error during start", e);
                 }
            }

            html5QrCode = new Html5Qrcode(readerId);
            scannerRef.current = html5QrCode;

            // Configuration: High Res, Back Camera, 16:9 aspect ratio
            const config = { 
                fps: 10, 
                qrbox: { width: 250, height: 150 }, // Small center box
                aspectRatio: 1.777778, // 16:9
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E
                ],
                videoConstraints: {
                    width: { ideal: 1280 }, // Reduced from 1920 for better compatibility
                    height: { ideal: 720 },
                    facingMode: { ideal: "environment" }, // Force back camera
                    focusMode: "continuous"
                }
            };

            await html5QrCode.start(
                { facingMode: "environment" }, 
                config,
                (decodedText: string) => {
                    if (isCancelled) return;

                    const now = Date.now();
                    if (decodedText === lastScanRef.current.text && now - lastScanRef.current.time < 2500) {
                        return;
                    }
                    lastScanRef.current = { text: decodedText, time: now };
                    
                    // Beep
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
                    } catch (e) {}

                    // Call the callback via ref
                    onScanSuccessRef.current(decodedText);
                },
                (err: any) => {
                    // Ignore scan errors (common during scanning)
                }
            );
            
            if (isCancelled) {
                await html5QrCode.stop();
                html5QrCode.clear();
            } else {
                isRunningRef.current = true;
                setErrorMessage(null);

                // --- Auto Zoom Logic ---
                setTimeout(async () => {
                    if (isCancelled) return;
                    try {
                        const videoElement = document.querySelector(`#${readerId} video`) as HTMLVideoElement;
                        if (videoElement && videoElement.srcObject) {
                            const stream = videoElement.srcObject as MediaStream;
                            const [track] = stream.getVideoTracks();
                            if (track) {
                                const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
                                if ('zoom' in capabilities) {
                                    const maxZoom = capabilities.zoom.max || 1;
                                    // Apply "thoda zoom" (half of max, clamped reasonably)
                                    let targetZoom = maxZoom / 2;
                                    if (targetZoom < 1.5) targetZoom = 1.5; 
                                    if (targetZoom > 2.5) targetZoom = 2.5; 
                                    if (maxZoom < targetZoom) targetZoom = maxZoom;

                                    await track.applyConstraints({
                                        advanced: [{ zoom: targetZoom } as any]
                                    });
                                }
                            }
                        }
                    } catch (zoomErr) {
                        // Zoom not supported, ignore
                    }
                }, 500); 
            }

        } catch (err: any) {
            if (isCancelled) {
                // Ensure cleanup if cancelled during start failure or interruption
                if (html5QrCode) {
                    try { html5QrCode.clear(); } catch (e) {}
                }
                return;
            }
            
            // Suppress specific "play() interrupted" error which happens on rapid unmounts
            if (err?.name === 'NotAllowedError' || err?.message?.includes('play() request was interrupted')) {
                 console.warn("Scanner start interrupted (benign):", err.message);
                 return; 
            }

            console.error("Scanner start error", err);
            
            let msg = "Could not start camera.";
            if (err?.name === 'NotReadableError' || err?.name === 'NotStartedError') {
                msg = "Camera is in use by another app or tab. Please close them and restart scanner.";
            } else if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
                msg = "Camera permission denied. Please allow access in browser settings.";
            } else {
                msg = `Camera error: ${err.message || err}`;
            }
            setErrorMessage(msg);
        }
    };

    startScanner();

    return () => {
        isCancelled = true;
        if (scannerRef.current) {
            const scanner = scannerRef.current;
            scannerRef.current = null;
            
            // Only stop if explicitly running. 
            // If starting (pending), let the start promise handle cleanup via isCancelled check.
            // This prevents "play() interrupted" errors when unmounting during start.
            if (isRunningRef.current) {
                isRunningRef.current = false;
                scanner.stop().then(() => {
                    try { scanner.clear(); } catch(e) {}
                }).catch((err: any) => {
                    console.warn("Stop failed during cleanup", err); 
                });
            }
        }
    };
  }, [readerId]); // Removed onScanSuccess from dependencies to prevent restart on parent re-render

  return (
    <div className="relative w-full h-64 rounded-xl overflow-hidden bg-black border border-slate-700 shadow-sm group mb-4">
        <div id={readerId} className="w-full h-full"></div>
        
        {errorMessage && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white p-4 text-center z-20">
                <div>
                    <p className="text-red-400 font-bold mb-2">Scanner Error</p>
                    <p className="text-sm">{errorMessage}</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-700 rounded hover:bg-slate-600">Close</button>
                </div>
            </div>
        )}

        <style>{`
            #${readerId} {
                width: 100% !important;
                height: 100% !important;
                overflow: hidden !important;
                border: none !important;
            }
            #${readerId} video {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                border-radius: 0 !important;
                margin: 0 !important;
            }
        `}</style>

        {/* Custom Overlay UI - Only show if no error */}
        {!errorMessage && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                <div className="relative" style={{ width: '250px', height: '150px' }}>
                    <div className="absolute inset-0 border border-white/40 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                    
                    {/* Corner Markers */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-md"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-md"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-md"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-md"></div>

                    {/* Laser */}
                    <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-scan-laser"></div>
                </div>
            </div>
        )}

        {onClose && (
            <button 
                onClick={onClose} 
                className="absolute top-3 right-3 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm z-20 transition-colors"
                title="Close Camera"
            >
                <XIcon className="h-5 w-5" />
            </button>
        )}

        <style>{`
            @keyframes scan-laser {
                0% { transform: translateY(-75px); opacity: 0; }
                50% { opacity: 1; }
                100% { transform: translateY(75px); opacity: 0; }
            }
            .animate-scan-laser {
                animation: scan-laser 2s infinite linear;
            }
        `}</style>
    </div>
  );
};

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
                 <p className="text-center text-sm text-slate-500 mt-2 pb-2">Align barcode within the frame</p>
               </div>
            </div>
        </Modal>
    );
};

export default BarcodeScannerModal;


import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import Modal from './common/Modal';
import { XIcon, ExpandIcon, CompressIcon } from './icons/Icons';

interface ScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose?: () => void;
}

export const EmbeddedScanner: React.FC<ScannerProps> = ({ onScanSuccess, onClose }) => {
  const readerIdRef = useRef("reader-embedded-" + Math.random().toString(36).substring(2, 9));
  const readerId = readerIdRef.current;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  const lastScanRef = useRef<{text: string, time: number}>({text: '', time: 0});
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Zoom State
  const [zoom, setZoom] = useState(1);
  const [zoomCap, setZoomCap] = useState<{min:number, max:number, step:number} | null>(null);
  const [showZoomControl, setShowZoomControl] = useState(false);
  
  // Stable callback ref
  const onScanSuccessRef = useRef(onScanSuccess);
  useEffect(() => { onScanSuccessRef.current = onScanSuccess; }, [onScanSuccess]);

  useEffect(() => {
    let isCancelled = false;

    const startScanner = async () => {
        // Small delay to ensure DOM element exists and layout is stable
        await new Promise(r => setTimeout(r, 100));
        
        if (isCancelled) return;
        
        const element = document.getElementById(readerId);
        if (!element) return;

        try {
            // Cleanup any existing instance
            if (scannerRef.current) {
                 try { 
                     if (isRunningRef.current) {
                        await scannerRef.current.stop(); 
                     }
                     scannerRef.current.clear(); 
                 } catch(e) {}
            }

            const html5QrCode = new Html5Qrcode(readerId);
            scannerRef.current = html5QrCode;

            // Dynamic QR Box based on view size - Optimized for 1D Barcodes
            const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
                const isLandscape = viewfinderWidth > viewfinderHeight;
                if (isLandscape) {
                    return {
                        width: Math.floor(viewfinderWidth * 0.7),
                        height: Math.floor(viewfinderHeight * 0.4) // Wider strip
                    };
                } else {
                    return {
                        width: Math.floor(viewfinderWidth * 0.8),
                        height: Math.floor(viewfinderWidth * 0.4)
                    };
                }
            };

            const config = { 
                fps: 25, // High FPS for faster scanning
                qrbox: qrboxFunction,
                useBarCodeDetectorIfSupported: true, // Use native hardware/OS scanner (Fast!)
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.CODE_93,
                    Html5QrcodeSupportedFormats.ITF
                ]
            };
            
            const onSuccess = (decodedText: string) => {
                if (isCancelled) return;

                const now = Date.now();
                // Debounce: ignore duplicate scans within 2.5 seconds
                if (decodedText === lastScanRef.current.text && now - lastScanRef.current.time < 2500) {
                    return;
                }
                lastScanRef.current = { text: decodedText, time: now };
                
                // Feedback: Beep sound
                try {
                    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                    if (AudioContext) {
                        const audioCtx = new AudioContext();
                        const oscillator = audioCtx.createOscillator();
                        const gainNode = audioCtx.createGain();
                        oscillator.connect(gainNode);
                        gainNode.connect(audioCtx.destination);
                        oscillator.type = "sine";
                        oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
                        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                        oscillator.start();
                        oscillator.stop(audioCtx.currentTime + 0.15);
                    }
                } catch (e) {
                    // Ignore audio errors
                }

                if (onScanSuccessRef.current) {
                    onScanSuccessRef.current(decodedText);
                }
            };
            
            const onInternalError = (errorMessage: string) => {
                // ignore
            };

            try {
                // FIX: Start with minimal constraints to pass library validation
                // The library throws error if object has >1 key.
                const startConstraints = { facingMode: "environment" };

                await html5QrCode.start(startConstraints, config, onSuccess, onInternalError);
                
                if (!isCancelled) {
                    isRunningRef.current = true;
                    
                    // --- UPGRADE STREAM QUALITY POST-START ---
                    // We manually access the track to apply high-res constraints and focus mode
                    // This bypasses the strict validation of the start() method
                    try {
                         const track = (html5QrCode as any).getRunningTrack();
                         if (track) {
                             const capabilities = track.getCapabilities();
                             
                             const constraintsToApply: any = {
                                 // Request 1080p ideal
                                 width: { ideal: 1920 },
                                 height: { ideal: 1080 },
                                 // Request continuous focus
                                 advanced: [{ focusMode: "continuous" }]
                             };
                             
                             await track.applyConstraints(constraintsToApply);

                             // --- AUTO-ZOOM LOGIC ---
                             if (capabilities && "zoom" in capabilities) {
                                 const { min, max, step } = capabilities.zoom;
                                 setZoomCap({ min, max, step });
                                 setShowZoomControl(true);

                                 // Calculate moderate zoom (approx 2x or half max)
                                 let targetZoom = 2.0;
                                 if (max) {
                                     const halfMax = max / 2;
                                     targetZoom = Math.min(halfMax, 3.0); // Cap at 3x
                                 }
                                 targetZoom = Math.max(min, Math.min(targetZoom, max));
                                 
                                 setZoom(targetZoom);
                                 
                                 await track.applyConstraints({
                                     advanced: [{ zoom: targetZoom }]
                                 });
                             }
                         }
                    } catch(e) {
                        console.debug("Failed to apply advanced camera constraints", e);
                    }
                } else {
                    // Cancelled during start
                    try { await html5QrCode.stop(); } catch(e) {}
                    try { html5QrCode.clear(); } catch(e) {}
                }
            } catch (startErr: any) {
                 const errorMessage = startErr?.message || startErr?.toString() || '';
                 const isInterrupted = errorMessage.includes('interrupted') || startErr?.name === 'AbortError' || errorMessage.includes('media was removed');

                 if (isInterrupted) {
                     console.debug('Scanner playback interrupted (harmless)');
                     return;
                 }
                 if (isCancelled) return;
                 
                 console.error("Scanner failed to start:", startErr);
                 alert("Could not start camera. Please ensure camera permissions are granted.");
                 return;
            }

        } catch (err) {
            console.error("Scanner setup error", err);
        }
    };

    startScanner();

    return () => {
        isCancelled = true;
        if (scannerRef.current) {
            const scanner = scannerRef.current;
            const wasRunning = isRunningRef.current;
            
            const cleanup = async () => {
                try {
                   if (wasRunning) {
                       await scanner.stop();
                   }
                   scanner.clear();
                } catch (e) {
                   console.debug("Scanner cleanup error (harmless)", e);
                }
            };
            cleanup();
            
            scannerRef.current = null;
            isRunningRef.current = false;
        }
    };
  }, [readerId]);

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newZoom = parseFloat(e.target.value);
      setZoom(newZoom);
      if (scannerRef.current) {
          try {
              const track = (scannerRef.current as any).getRunningTrack();
              if (track) {
                  track.applyConstraints({
                      advanced: [{ zoom: newZoom }]
                  });
              }
          } catch (err) {
              console.error("Failed to apply zoom", err);
          }
      }
  };

  return (
    <div className={`relative ${isFullScreen ? 'fixed inset-0 z-[100] w-screen h-screen bg-black' : 'w-full h-64 rounded-xl mb-4'} overflow-hidden bg-black border border-slate-700 shadow-sm group transition-all duration-300`}>
        <div id={readerId} className="w-full h-full"></div>
        
        <style>{`
            #${readerId} video {
                object-fit: cover !important;
                width: 100% !important;
                height: 100% !important;
                border-radius: ${isFullScreen ? '0' : '0.75rem'};
            }
            #${readerId} canvas {
                display: none;
            }
        `}</style>

        {/* Overlay UI */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            {/* Scanning Area Visuals */}
            <div className="relative transition-all duration-300" style={{ 
                width: isFullScreen ? '80%' : '70%', 
                height: isFullScreen ? '40%' : '40%', 
                maxWidth: '450px',
                maxHeight: '250px'
            }}>
                {/* Dimmed Background */}
                <div className="absolute -inset-[1000px] border-[1000px] border-black/50 pointer-events-none"></div>
                
                {/* Box Border */}
                <div className="absolute inset-0 border border-white/30 rounded-lg shadow-sm"></div>
                
                {/* Corner Markers */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-red-500 rounded-tl-md"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-red-500 rounded-tr-md"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-red-500 rounded-bl-md"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-red-500 rounded-br-md"></div>

                {/* Animated Laser Line */}
                <div className="absolute left-2 right-2 top-1/2 h-[2px] bg-red-500/90 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-scan-laser"></div>
            </div>
        </div>
        
        {/* Zoom Control */}
        {showZoomControl && zoomCap && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 w-64 max-w-[80%] bg-black/40 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-3 border border-white/10">
                <span className="text-white text-xs font-bold w-8 text-right">{zoom.toFixed(1)}x</span>
                <input 
                    type="range" 
                    min={zoomCap.min} 
                    max={zoomCap.max} 
                    step={zoomCap.step || 0.1} 
                    value={zoom} 
                    onChange={handleZoomChange}
                    className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <span className="text-white text-xs font-bold w-8 text-left">{zoomCap.max.toFixed(1)}x</span>
            </div>
        )}

        {/* Controls */}
        <div className="absolute top-4 right-4 flex gap-3 z-20">
            <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsFullScreen(!isFullScreen); }} 
                className="p-2.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-colors shadow-lg border border-white/10"
                title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
            >
                {isFullScreen ? <CompressIcon className="h-5 w-5" /> : <ExpandIcon className="h-5 w-5" />}
            </button>
            
            {onClose && (
                <button 
                    onClick={onClose} 
                    className="p-2.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-colors shadow-lg border border-white/10"
                    title="Close Camera"
                >
                    <XIcon className="h-5 w-5" />
                </button>
            )}
        </div>

        <style>{`
            @keyframes scan-laser {
                0% { transform: translateY(-50px); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateY(50px); opacity: 0; }
            }
            .animate-scan-laser {
                animation: scan-laser 1.5s infinite linear;
            }
        `}</style>
    </div>
  );
};

// Legacy Modal Wrapper
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

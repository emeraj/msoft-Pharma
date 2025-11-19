
import React, { useEffect, useRef, useState } from 'react';
import Modal from './common/Modal';
import { XIcon, ExpandIcon, CompressIcon } from './icons/Icons';

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
  const onScanSuccessRef = useRef(onScanSuccess);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Zoom State
  const [zoom, setZoom] = useState(1);
  const [zoomCap, setZoomCap] = useState<{min:number, max:number, step:number} | null>(null);
  const [showZoomControl, setShowZoomControl] = useState(false);

  // Keep callback ref fresh
  useEffect(() => {
      onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

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

            // Enable Native Barcode Detector for better performance on mobile
            html5QrCode = new Html5Qrcode(readerId, { 
                experimentalFeatures: { useBarCodeDetectorIfSupported: true },
                verbose: false
            });
            scannerRef.current = html5QrCode;

            // Dynamic QR Box based on view size
            const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
                // Use a larger portion of the screen for small barcodes
                const minEdgePercentage = isFullScreen ? 0.6 : 0.7; 
                const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
                const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
                return {
                    width: qrboxSize,
                    height: Math.floor(qrboxSize / 1.5) // Rectangular box (wider)
                };
            };

            const config = { 
                fps: 15, // Increased FPS for smoother scanning
                qrbox: qrboxFunction,
                aspectRatio: 1.0, // Square aspect ratio often uses more of the sensor
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
                // Request High Resolution & Continuous Focus
                const constraints = { 
                    facingMode: "environment",
                    width: { min: 1280, ideal: 1920 },
                    height: { min: 720, ideal: 1080 },
                    advanced: [{ focusMode: "continuous" }] // Try to force continuous focus for small objects
                };

                await html5QrCode.start(
                    constraints,
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

                        onScanSuccessRef.current(decodedText);
                    },
                    () => {} // Ignore errors/failures per frame
                );
                
                if (!isCancelled) {
                    isRunningRef.current = true;
                    
                    // Check for Zoom Capabilities
                    try {
                        const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
                        if (capabilities && capabilities.zoom) {
                            setZoomCap(capabilities.zoom);
                            setZoom(capabilities.zoom.min || 1);
                            setShowZoomControl(true);
                        }
                    } catch (e) {
                        console.debug("Zoom capabilities not supported", e);
                    }
                } else {
                    if (html5QrCode) html5QrCode.stop().catch(() => {});
                }
            } catch (startErr: any) {
                if (isCancelled) return;
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
            // Robust cleanup
            const stopAndClear = async () => {
                try {
                    if (isRunningRef.current) {
                         await scannerRef.current.stop();
                    }
                    scannerRef.current.clear();
                } catch(e) {
                    // ignore cleanup errors
                }
            };
            stopAndClear();
            scannerRef.current = null;
            isRunningRef.current = false;
        }
    };
  }, [readerId, isFullScreen]); // Removed onScanSuccess from dependency to prevent restart

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newZoom = parseFloat(e.target.value);
      setZoom(newZoom);
      if (scannerRef.current) {
          try {
              scannerRef.current.applyVideoConstraints({
                  advanced: [{ zoom: newZoom }]
              });
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
                width: isFullScreen ? '70%' : '60%', 
                height: isFullScreen ? '40%' : '50%',
                maxWidth: '400px',
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
                <span className="text-white text-xs font-bold w-8 text-right">{zoom}x</span>
                <input 
                    type="range" 
                    min={zoomCap.min} 
                    max={zoomCap.max} 
                    step={zoomCap.step} 
                    value={zoom} 
                    onChange={handleZoomChange}
                    className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <span className="text-white text-xs font-bold w-8 text-left">{zoomCap.max}x</span>
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
                0% { transform: translateY(-100px); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateY(100px); opacity: 0; }
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

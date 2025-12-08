
import React, { useState, useEffect, useRef } from 'react';
import type { SystemConfig, ChequeLayout, ChequeLayoutField } from '../types';
import Card from './common/Card';
import { PrinterIcon, CheckCircleIcon } from './icons/Icons';

interface ChequePrintProps {
  systemConfig: SystemConfig;
  onUpdateConfig: (config: SystemConfig) => void;
}

const inputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";

// Standard Cheque Size approx 203mm x 89mm (8 x 3.5 inches)
const CHEQUE_WIDTH_MM = 203;
const CHEQUE_HEIGHT_MM = 89;

// Default Layout
const defaultLayout: ChequeLayout = {
    date: { x: 160, y: 5, visible: true, width: 40 },
    payeeName: { x: 20, y: 18, visible: true, width: 150 },
    amountWords: { x: 25, y: 30, visible: true, width: 130 },
    amountNumber: { x: 165, y: 35, visible: true, width: 35 },
    acPayee: { x: 5, y: 5, visible: true },
};

// Utility to convert number to words (Simplified Indian style)
const toWords = (num: number): string => {
  const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const g = ['', 'thousand', 'lakh', 'crore'];

  const inWords = (n: number): string => {
    let str = '';
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
    } else {
      str += a[n];
    }
    return str.trim();
  };

  const numStr = num.toFixed(2);
  const [integerPartStr, decimalPartStr] = numStr.split('.');
  
  let result = '';
  let n = parseInt(integerPartStr, 10);
  let i = 0;
  
  if (n === 0) return 'Zero';

  while (n > 0) {
    let chunk;
    if (i === 0) { chunk = n % 1000; n = Math.floor(n / 1000); }
    else { chunk = n % 100; n = Math.floor(n / 100); }
    
    if (chunk) {
      if (i === 0 && chunk < 100) { result = inWords(chunk) + result; }
      else if (i === 0) { result = a[Math.floor(chunk / 100)] + ' hundred ' + inWords(chunk % 100) + result; }
      else { result = inWords(chunk) + ' ' + g[i] + ' ' + result; }
    }
    i++;
  }

  result = result.trim();
  return result.split(' ').filter(s => s).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') + ' Only';
};

const ChequePrint: React.FC<ChequePrintProps> = ({ systemConfig, onUpdateConfig }) => {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        name: '',
        amount: '0.00',
        acPayee: true
    });

    const [layout, setLayout] = useState<ChequeLayout>(systemConfig.chequeLayout || defaultLayout);
    const [draggingId, setDraggingId] = useState<keyof ChequeLayout | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [isLayoutChanged, setIsLayoutChanged] = useState(false);

    useEffect(() => {
        if (systemConfig.chequeLayout) {
            setLayout(systemConfig.chequeLayout);
        }
    }, [systemConfig.chequeLayout]);

    // Drag Logic
    const handleMouseDown = (e: React.MouseEvent, id: keyof ChequeLayout) => {
        setDraggingId(id);
        e.preventDefault();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!draggingId || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        
        // Calculate new position in mm relative to canvas
        // Mouse X relative to canvas left
        const relativeX = e.clientX - rect.left;
        const relativeY = e.clientY - rect.top;

        // Convert pixel to mm based on the scaling ratio
        // The canvas is rendered at 203mm width on screen (via CSS scale or direct pixel map)
        // Actually easier: We set canvas width to a specific pixel value that matches typical screen DPI for mm
        // 1mm approx 3.78px.
        const pxPerMm = rect.width / CHEQUE_WIDTH_MM;
        
        let x = relativeX / pxPerMm;
        let y = relativeY / pxPerMm;

        // Snap/Limit to boundaries
        x = Math.max(0, Math.min(x, CHEQUE_WIDTH_MM - 10)); // 10mm buffer
        y = Math.max(0, Math.min(y, CHEQUE_HEIGHT_MM - 5));

        setLayout(prev => ({
            ...prev,
            [draggingId]: { ...prev[draggingId], x, y }
        }));
        setIsLayoutChanged(true);
    };

    const handleMouseUp = () => {
        setDraggingId(null);
    };

    const saveLayout = () => {
        onUpdateConfig({ ...systemConfig, chequeLayout: layout });
        setIsLayoutChanged(false);
        alert('Cheque layout saved!');
    };

    const handlePrint = () => {
        window.print();
    };

    // Format Date with spaces (9 12 2025)
    const formattedDate = formData.date.split('-').reverse().join(' ').split('').join(' ');
    
    // Format Amount Number (*******22.00)
    const amountVal = parseFloat(formData.amount);
    const formattedAmount = isNaN(amountVal) ? '' : `*******${amountVal.toFixed(2)}`;
    const amountWords = isNaN(amountVal) ? '' : toWords(amountVal) + '.';

    const renderField = (id: keyof ChequeLayout, content: React.ReactNode, styleOverride: React.CSSProperties = {}) => {
        const field = layout[id];
        if (!field.visible) return null;

        return (
            <div
                style={{
                    position: 'absolute',
                    left: `${field.x}mm`,
                    top: `${field.y}mm`,
                    cursor: 'move',
                    userSelect: 'none',
                    border: '1px dashed transparent',
                    ...(draggingId === id ? { border: '1px dashed #6366f1', zIndex: 10 } : {}),
                    ...styleOverride
                }}
                onMouseDown={(e) => handleMouseDown(e, id)}
                className="hover:border-slate-400 p-1"
                title="Drag to reposition"
            >
                {content}
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-6 space-y-6" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <div className="flex justify-between items-center print:hidden">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Cheque Writer</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
                {/* Input Form */}
                <Card className="lg:col-span-1 h-fit">
                    <h3 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-300">Cheque Details</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-slate-300">Date</label>
                            <input 
                                type="date" 
                                value={formData.date} 
                                onChange={e => setFormData({...formData, date: e.target.value})}
                                className={inputStyle}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-slate-300">Payee Name</label>
                            <input 
                                type="text" 
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className={inputStyle}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-slate-300">Amount</label>
                            <input 
                                type="number" 
                                value={formData.amount} 
                                onChange={e => setFormData({...formData, amount: e.target.value})}
                                className={inputStyle}
                                step="0.01"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="acPayee"
                                checked={formData.acPayee}
                                onChange={e => setFormData({...formData, acPayee: e.target.checked})}
                                className="h-4 w-4 text-indigo-600 rounded"
                            />
                            <label htmlFor="acPayee" className="text-sm font-medium dark:text-slate-300">A/c Payee</label>
                        </div>
                    </div>
                    <div className="mt-6 flex flex-col gap-3">
                        <button onClick={handlePrint} className="w-full bg-slate-800 text-white py-2 rounded-lg hover:bg-slate-700 flex items-center justify-center gap-2">
                            <PrinterIcon className="h-5 w-5" /> Print
                        </button>
                        {isLayoutChanged && (
                            <button onClick={saveLayout} className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
                                <CheckCircleIcon className="h-5 w-5" /> Save Layout
                            </button>
                        )}
                    </div>
                </Card>

                {/* Canvas / Preview */}
                <div className="lg:col-span-2 flex flex-col items-center">
                    <div className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                        Drag items to position them for your cheque leaf.
                    </div>
                    
                    {/* The Cheque Canvas */}
                    <div 
                        ref={canvasRef}
                        className="relative bg-teal-50 shadow-lg border border-slate-300 print:border-none print:shadow-none print:bg-white"
                        style={{
                            width: '203mm',
                            height: '89mm',
                            // For screen scaling (optional if screen is small)
                            maxWidth: '100%',
                            overflow: 'hidden'
                        }}
                    >
                        {formData.acPayee && renderField('acPayee', (
                            <div className="border-b-2 border-l-2 border-black transform -rotate-12 px-2 text-sm font-bold w-max" style={{ height: '15mm', borderTop: '2px solid black' }}>
                                <div className="border-b-2 border-black w-full absolute top-1 left-0"></div>
                                <span className="relative top-2">A/c Payee</span>
                            </div>
                        ))}

                        {renderField('date', (
                            <div className="font-bold text-lg tracking-widest bg-yellow-300/30 print:bg-transparent px-1">
                                {formattedDate}
                            </div>
                        ))}

                        {renderField('payeeName', (
                            <div className="font-bold text-lg w-max min-w-[200px] print:min-w-0">
                                {formData.name || 'Payee Name'}
                            </div>
                        ))}

                        {renderField('amountWords', (
                            <div className="font-medium text-md w-full max-w-[120mm] leading-tight">
                                {amountWords}
                            </div>
                        ))}

                        {renderField('amountNumber', (
                            <div className="font-bold text-xl">
                                {formattedAmount}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Print-only section */}
            <div className="hidden print:block absolute top-0 left-0">
                 <div 
                    style={{
                        width: '203mm',
                        height: '89mm',
                        position: 'relative'
                    }}
                >
                    {formData.acPayee && layout.acPayee.visible && (
                        <div style={{ position: 'absolute', left: `${layout.acPayee.x}mm`, top: `${layout.acPayee.y}mm` }}>
                             <div style={{ borderTop: '2px solid black', borderBottom: '2px solid black', transform: 'rotate(-15deg)', padding: '2px 10px', fontWeight: 'bold', fontSize: '10pt' }}>
                                A/c Payee
                             </div>
                        </div>
                    )}
                    {layout.date.visible && (
                        <div style={{ position: 'absolute', left: `${layout.date.x}mm`, top: `${layout.date.y}mm`, fontSize: '12pt', letterSpacing: '4px', fontWeight: 'bold' }}>
                            {formattedDate}
                        </div>
                    )}
                    {layout.payeeName.visible && (
                        <div style={{ position: 'absolute', left: `${layout.payeeName.x}mm`, top: `${layout.payeeName.y}mm`, fontSize: '11pt', fontWeight: 'bold' }}>
                            {formData.name}
                        </div>
                    )}
                    {layout.amountWords.visible && (
                        <div style={{ position: 'absolute', left: `${layout.amountWords.x}mm`, top: `${layout.amountWords.y}mm`, fontSize: '10pt', width: '130mm' }}>
                            {amountWords}
                        </div>
                    )}
                    {layout.amountNumber.visible && (
                        <div style={{ position: 'absolute', left: `${layout.amountNumber.x}mm`, top: `${layout.amountNumber.y}mm`, fontSize: '12pt', fontWeight: 'bold' }}>
                            {formattedAmount}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @media print {
                    @page {
                        size: landscape;
                        margin: 0;
                    }
                    body * {
                        visibility: hidden;
                    }
                    .print\\:block, .print\\:block * {
                        visibility: visible;
                    }
                    .print\\:block {
                        position: absolute;
                        left: 0;
                        top: 0;
                    }
                }
            `}</style>
        </div>
    );
};

export default ChequePrint;

import React from 'react';
import type { Bill, CompanyProfile } from '../types';

const ThermalPrintableBill: React.FC<{ bill: Bill; companyProfile: CompanyProfile }> = ({ bill, companyProfile }) => {
    const items = bill?.items || [];

    const line = '-'.repeat(40);

    return (
        <div className="bg-white text-black font-mono text-[10px]" style={{ width: '72mm', padding: '2mm' }}>
            <div className="text-center">
                <h1 className="font-bold text-sm uppercase">{companyProfile.name}</h1>
                <p>{companyProfile.address}</p>
                <p>GSTIN: {companyProfile.gstin}</p>
                <p>{line}</p>
                <h2 className="font-bold">TAX INVOICE</h2>
                <p>{line}</p>
            </div>
            
            <div className="my-2 text-[9px]">
                <p>Bill No: {bill.billNumber}</p>
                <p>Date: {new Date(bill.date).toLocaleString()}</p>
                <p>Customer: {bill.customerName}</p>
            </div>

            <p>{line}</p>

            {/* Header */}
            <div className="flex font-bold text-[9px]">
                <div className="flex-grow">Item</div>
                <div className="w-8 text-center">Qty</div>
                <div className="w-10 text-right">Rate</div>
                <div className="w-12 text-right">Total</div>
            </div>

            <p>{line}</p>

            {/* Items */}
            <div className="space-y-1 text-[9px]">
                {items.map((item, index) => (
                    <div key={item.batchId}>
                        <p>{index + 1}. {item.productName}</p>
                        <div className="flex">
                            <div className="flex-grow text-[8px] text-gray-700">
                                <span className="mr-2">Batch:{item.batchNumber}</span>
                                <span>Exp:{item.expiryDate}</span>
                                <br />
                                <span className="mr-2">HSN:{item.hsnCode}</span>
                                <span>GST:{item.gst}%</span>
                            </div>
                            <div className="w-8 text-center">{item.quantity}</div>
                            <div className="w-10 text-right">{item.mrp.toFixed(2)}</div>
                            <div className="w-12 text-right font-bold">{item.total.toFixed(2)}</div>
                        </div>
                    </div>
                ))}
            </div>

            <p>{line}</p>

            {/* Totals */}
            <div className="space-y-1 text-[9px]">
                <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-bold">{(bill.subTotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Total GST:</span>
                    <span className="font-bold">{(bill.totalGst || 0).toFixed(2)}</span>
                </div>
            </div>
            
            <p>{line}</p>
            
            <div className="flex justify-between font-bold text-sm my-1">
                <span>GRAND TOTAL:</span>
                <span>₹{(bill.grandTotal || 0).toFixed(2)}</span>
            </div>

            <p>{line}</p>

            <div className="text-center mt-2">
                <p>Thank you for your visit!</p>
                <p>Get Well Soon.</p>
            </div>
        </div>
    );
};

export default ThermalPrintableBill;

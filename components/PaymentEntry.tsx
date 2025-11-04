import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import type { Supplier, Payment, CompanyProfile } from '../types.ts';
import Card from './common/Card.tsx';
import Modal from './common/Modal.tsx';
import { PencilIcon, TrashIcon, PrinterIcon } from './icons/Icons.tsx';
import PrintablePaymentVoucher from './PrintablePaymentVoucher.tsx';

interface PaymentEntryProps {
  suppliers: Supplier[];
  payments: Payment[];
  companyProfile: CompanyProfile;
  onAddPayment: (payment: Omit<Payment, 'id' | 'voucherNumber'>) => Promise<Payment | null>;
  onUpdatePayment: (id: string, payment: Omit<Payment, 'id'>) => void;
  onDeletePayment: (id: string) => void;
}

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
const formSelectStyle = `${formInputStyle} appearance-none`;
const formTextAreaStyle = `${formInputStyle} h-20 resize-none`;

const PaymentEntry: React.FC<PaymentEntryProps> = ({ suppliers, payments, companyProfile, onAddPayment, onUpdatePayment, onDeletePayment }) => {
    const initialFormState = {
        supplierName: '',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        method: 'Bank Transfer' as Payment['method'],
        remarks: '',
        voucherNumber: 'Auto',
    };

    const [formState, setFormState] = useState(initialFormState);
    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    const [lastAddedPayment, setLastAddedPayment] = useState<Payment | null>(null);

    useEffect(() => {
        if (editingPayment) {
            setFormState({
                supplierName: editingPayment.supplierName,
                date: editingPayment.date.split('T')[0],
                amount: String(editingPayment.amount),
                method: editingPayment.method,
                remarks: editingPayment.remarks || '',
                voucherNumber: editingPayment.voucherNumber,
            });
            window.scrollTo(0, 0);
        } else {
            setFormState(initialFormState);
        }
    }, [editingPayment]);

    const sortedPayments = useMemo(() => {
        // Fix: Corrected the sort comparison to use the date from object 'a'.
        return [...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [payments]);
    
    const resetForm = () => {
        setEditingPayment(null);
        setFormState(initialFormState);
    };

    const handleSavePayment = async () => {
        if (!formState.supplierName || !formState.date || !formState.amount) {
            alert("Please fill in Supplier, Date, and Amount.");
            return;
        }

        const paymentData = {
            supplierName: formState.supplierName,
            date: new Date(formState.date).toISOString(),
            amount: parseFloat(formState.amount),
            method: formState.method,
            remarks: formState.remarks,
        };

        if (editingPayment) {
            onUpdatePayment(editingPayment.id, {...paymentData, voucherNumber: editingPayment.voucherNumber});
        } else {
            const newPayment = await onAddPayment(paymentData);
            if (newPayment) {
                setLastAddedPayment(newPayment);
            }
        }
        resetForm();
    };

    const handlePrintVoucher = (payment: Payment) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            const rootEl = document.createElement('div');
            printWindow.document.body.appendChild(rootEl);
            const root = ReactDOM.createRoot(rootEl);
            
            root.render(<PrintablePaymentVoucher payment={payment} companyProfile={companyProfile} />);
            
            setTimeout(() => {
                printWindow.document.title = `Payment Voucher - ${payment.voucherNumber}`;
                printWindow.print();
                printWindow.close();
            }, 500);
        } else {
            alert("Please enable popups to print the voucher.");
        }
    };


    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card title={editingPayment ? `Editing Payment: ${editingPayment.voucherNumber}` : 'New Payment Entry'}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supplier*</label>
                        <select
                            value={formState.supplierName}
                            onChange={e => setFormState(prev => ({ ...prev, supplierName: e.target.value }))}
                            className={formSelectStyle}
                            required
                        >
                            <option value="">Select Supplier</option>
                            {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date*</label>
                        <input
                            type="date"
                            value={formState.date}
                            onChange={e => setFormState(prev => ({ ...prev, date: e.target.value }))}
                            className={formInputStyle}
                            required
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amount*</label>
                        <input
                            type="number"
                            value={formState.amount}
                            onChange={e => setFormState(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="0.00"
                            className={formInputStyle}
                            required
                            step="0.01"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Method*</label>
                        <select
                            value={formState.method}
                            onChange={e => setFormState(prev => ({ ...prev, method: e.target.value as Payment['method'] }))}
                            className={formSelectStyle}
                            required
                        >
                            <option value="Cash">Cash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div className="md:col-span-2 lg:col-span-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Remarks</label>
                        <textarea
                            value={formState.remarks}
                            onChange={e => setFormState(prev => ({ ...prev, remarks: e.target.value }))}
                            placeholder="Add any notes about the payment..."
                            className={formTextAreaStyle}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-4 mt-6 border-t dark:border-slate-700 pt-4">
                    {editingPayment && (
                        <button type="button" onClick={resetForm} className="px-4 py-2 bg-slate-500 text-white rounded-lg shadow hover:bg-slate-600 transition-colors">
                            Cancel Edit
                        </button>
                    )}
                    <button onClick={handleSavePayment} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 transition-colors">
                        {editingPayment ? 'Update Payment' : 'Save Payment'}
                    </button>
                </div>
            </Card>

            {lastAddedPayment && (
                <Card className="bg-green-50 dark:bg-green-900/50 border-l-4 border-green-500">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-green-800 dark:text-green-200">
                                Payment added successfully! (Voucher #{lastAddedPayment.voucherNumber})
                            </p>
                            <p className="text-sm text-green-700 dark:text-green-300">
                                Paid ₹{lastAddedPayment.amount.toFixed(2)} to {lastAddedPayment.supplierName}.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handlePrintVoucher(lastAddedPayment)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-green-700"
                            >
                                <PrinterIcon className="h-4 w-4" /> Print Voucher
                            </button>
                            <button onClick={() => setLastAddedPayment(null)} className="text-green-800 dark:text-green-200 hover:text-green-900 dark:hover:text-green-100">&times;</button>
                        </div>
                    </div>
                </Card>
            )}

            <Card title="Payment History">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                        <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="px-6 py-3">Voucher #</th>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Supplier</th>
                                <th className="px-6 py-3">Method</th>
                                <th className="px-6 py-3 text-right">Amount</th>
                                <th className="px-6 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPayments.map(p => (
                                <tr key={p.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                                    <td className="px-6 py-4 font-medium">{p.voucherNumber}</td>
                                    <td className="px-6 py-4">{new Date(p.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{p.supplierName}</td>
                                    <td className="px-6 py-4">{p.method}</td>
                                    <td className="px-6 py-4 font-bold text-right">₹{p.amount.toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center items-center gap-4">
                                            <button onClick={() => handlePrintVoucher(p)} title="Print Voucher" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                                                <PrinterIcon className="h-5 w-5" />
                                            </button>
                                            <button onClick={() => setEditingPayment(p)} title="Edit Payment" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                                                <PencilIcon className="h-5 w-5" />
                                            </button>
                                            <button onClick={() => onDeletePayment(p.id)} title="Delete Payment" className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {sortedPayments.length === 0 && <p className="text-center py-6 text-slate-600 dark:text-slate-400">No payment history found.</p>}
                </div>
            </Card>
        </div>
    );
};

export default PaymentEntry;

import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import type { Supplier, Payment, CompanyProfile } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PencilIcon, TrashIcon, PrinterIcon } from './icons/Icons';
import PrintablePaymentVoucher from './PrintablePaymentVoucher';

interface PaymentEntryProps {
  suppliers: Supplier[];
  payments: Payment[];
  companyProfile: CompanyProfile;
  onAddPayment: (payment: Omit<Payment, 'id' | 'key' | 'voucherNumber'>) => Promise<Payment | null>;
  onUpdatePayment: (key: string, payment: Omit<Payment, 'id' | 'key'>) => void;
  onDeletePayment: (key: string) => void;
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
        return [...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [payments]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(formState.amount);
        if (!formState.supplierName || !amount || amount <= 0) {
            alert('Please select a supplier and enter a valid amount.');
            return;
        }

        const paymentData = {
            supplierName: formState.supplierName,
            date: new Date(formState.date).toISOString(),
            amount,
            method: formState.method,
            remarks: formState.remarks,
            voucherNumber: formState.voucherNumber, // This is ignored for new payments
        };

        if (editingPayment && editingPayment.key) {
            onUpdatePayment(editingPayment.key, paymentData);
        } else {
            const newPayment = await onAddPayment(paymentData);
            if (newPayment) {
                setLastAddedPayment(newPayment); // Trigger print modal
            }
        }
        setEditingPayment(null);
    };

    const handleCancelEdit = () => {
        setEditingPayment(null);
    };

    const handlePrintVoucher = () => {
        if (!lastAddedPayment) return;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            const root = document.createElement('div');
            printWindow.document.body.appendChild(root);
            const reactRoot = ReactDOM.createRoot(root);
            reactRoot.render(
                <PrintablePaymentVoucher payment={lastAddedPayment} companyProfile={companyProfile} />
            );
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card title={editingPayment ? `Edit Payment Voucher: ${editingPayment.voucherNumber}` : "New Payment"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supplier*</label>
                            <select name="supplierName" value={formState.supplierName} onChange={e => setFormState({...formState, supplierName: e.target.value})} className={formSelectStyle} required>
                                <option value="" disabled>Select a supplier</option>
                                {suppliers.sort((a,b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date*</label>
                            <input name="date" type="date" value={formState.date} onChange={e => setFormState({...formState, date: e.target.value})} className={formInputStyle} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Voucher No.</label>
                            <input type="text" value={formState.voucherNumber} className={`${formInputStyle} bg-slate-200 dark:bg-slate-700 cursor-not-allowed`} readOnly />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amount*</label>
                            <input name="amount" type="number" value={formState.amount} onChange={e => setFormState({...formState, amount: e.target.value})} className={formInputStyle} required min="0.01" step="0.01" />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Payment Method*</label>
                            <select name="method" value={formState.method} onChange={e => setFormState({...formState, method: e.target.value as Payment['method']})} className={formSelectStyle} required>
                                <option>Bank Transfer</option>
                                <option>Cash</option>
                                <option>Cheque</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Remarks (Cheque No., Txn ID, etc.)</label>
                            <input name="remarks" value={formState.remarks} onChange={e => setFormState({...formState, remarks: e.target.value})} className={formInputStyle} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                        {editingPayment && (
                             <button type="button" onClick={handleCancelEdit} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
                        )}
                        <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded font-semibold hover:bg-green-700">
                            {editingPayment ? 'Update Payment' : 'Save Payment'}
                        </button>
                    </div>
                </form>
            </Card>

            <Card title="Recent Payments">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                        <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="px-4 py-3">Voucher #</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Supplier</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                                <th className="px-4 py-3">Method</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPayments.map(p => (
                                <tr key={p.key} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                    <td className="px-4 py-2 font-medium">{p.voucherNumber}</td>
                                    <td className="px-4 py-2">{new Date(p.date).toLocaleDateString()}</td>
                                    <td className="px-4 py-2">{p.supplierName}</td>
                                    <td className="px-4 py-2 text-right font-semibold">₹{p.amount.toFixed(2)}</td>
                                    <td className="px-4 py-2">{p.method}</td>
                                    <td className="px-4 py-2">
                                        <div className="flex gap-3">
                                            <button onClick={() => setEditingPayment(p)} title="Edit" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"><PencilIcon className="h-4 w-4" /></button>
                                            <button onClick={() => p.key && onDeletePayment(p.key)} title="Delete" className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"><TrashIcon className="h-4 w-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {payments.length === 0 && <p className="text-center py-6 text-slate-600 dark:text-slate-400">No payment records found.</p>}
                </div>
            </Card>
            
            <Modal isOpen={!!lastAddedPayment} onClose={() => setLastAddedPayment(null)} title="Payment Saved">
                <div className="text-center">
                    <p className="text-lg text-slate-800 dark:text-slate-200">
                        Payment voucher <span className="font-bold">{lastAddedPayment?.voucherNumber}</span> has been saved successfully.
                    </p>
                    <div className="mt-6 flex justify-center gap-4">
                        <button onClick={() => setLastAddedPayment(null)} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Close</button>
                        <button onClick={handlePrintVoucher} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700">
                            <PrinterIcon className="h-5 w-5"/> Print Voucher
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PaymentEntry;
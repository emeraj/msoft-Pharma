
import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import type { Customer, Bill, CustomerPayment, CompanyProfile } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { DownloadIcon, UserCircleIcon, PlusIcon, PrinterIcon } from './icons/Icons';
import PrintableCustomerLedger from './PrintableCustomerLedger';

// Helper for CSV Export
const exportToCsv = (filename: string, data: any[]) => {
  if (data.length === 0) {
    alert("No data to export.");
    return;
  }
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        if (/[",\n]/.test(cell)) {
          cell = `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    )
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

interface CustomerLedgerProps {
  customers: Customer[];
  bills: Bill[];
  payments: CustomerPayment[];
  companyProfile: CompanyProfile;
  onAddPayment: (payment: Omit<CustomerPayment, 'id'>) => Promise<void>;
}

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
const formSelectStyle = `${formInputStyle} appearance-none`;

const CustomerLedger: React.FC<CustomerLedgerProps> = ({ customers, bills, payments, companyProfile, onAddPayment }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Other'>('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.phone && c.phone.includes(searchTerm))
    );
  }, [customers, searchTerm]);

  const customerTransactions = useMemo(() => {
    if (!selectedCustomer) return [];
    
    // Only show bills where paymentMode is 'Credit'.
    // Cash bills do not affect the ledger balance.
    const customerBills = bills.filter(b => {
        const isThisCustomer = (b.customerId === selectedCustomer.id) || 
                               (!b.customerId && b.customerName.toLowerCase() === selectedCustomer.name.toLowerCase());
        
        return isThisCustomer && b.paymentMode === 'Credit';
    }).map(b => ({
        date: new Date(b.date),
        type: 'Bill',
        ref: b.billNumber,
        debit: b.grandTotal, // Bill increases receivable (Debit)
        credit: 0
    }));

    const customerPaymentsList = payments.filter(p => p.customerId === selectedCustomer.id).map(p => ({
        date: new Date(p.date),
        type: 'Payment',
        ref: p.method,
        debit: 0,
        credit: p.amount // Payment reduces receivable (Credit)
    }));

    // Combine and sort
    return [...customerBills, ...customerPaymentsList].sort((a, b) => a.date.getTime() - b.date.getTime());

  }, [selectedCustomer, bills, payments]);

  const handleExport = () => {
      const data = filteredCustomers.map(c => ({
          'Name': c.name,
          'Phone': c.phone || '',
          'Address': c.address || '',
          'Balance': c.balance.toFixed(2)
      }));
      exportToCsv('customer_ledger_summary', data);
  };

  const handleExportPdf = () => {
        if (!selectedCustomer) return;
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.title = ' ';
            const style = printWindow.document.createElement('style');
            style.innerHTML = `
                @page { 
                    size: A4;
                    margin: 0; 
                }
                body {
                    margin: 0;
                }
            `;
            printWindow.document.head.appendChild(style);
            
            const printRoot = document.createElement('div');
            printWindow.document.body.appendChild(printRoot);
            
            const root = ReactDOM.createRoot(printRoot);
            
            // Format transactions for the printable component
            const printableTransactions = customerTransactions.map(tx => ({
                date: tx.date,
                particulars: `${tx.type} - ${tx.ref}`,
                debit: tx.debit,
                credit: tx.credit,
                type: tx.type as any
            }));

            root.render(
                <PrintableCustomerLedger
                    customer={selectedCustomer}
                    transactions={printableTransactions}
                    companyProfile={companyProfile}
                />
            );
            
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
                printWindow.close();
            }, 1000);
        }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedCustomer || !paymentAmount) return;
      
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) {
          alert("Please enter a valid amount");
          return;
      }

      await onAddPayment({
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          date: new Date().toISOString(),
          amount: amount,
          method: paymentMethod,
          notes: paymentNotes
      });

      setPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');
      // Ideally update local selected customer balance visibly or rely on re-render from parent
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card title="Customer Ledger">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
            <input 
                type="text" 
                placeholder="Search Customer by Name or Phone..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={`${formInputStyle} max-w-md`}
            />
            <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors">
                <DownloadIcon className="h-5 w-5" /> Export Summary
            </button>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                    <tr>
                        <th className="px-6 py-3">Customer Name</th>
                        <th className="px-6 py-3">Phone</th>
                        <th className="px-6 py-3">Address</th>
                        <th className="px-6 py-3 text-right">Balance</th>
                        <th className="px-6 py-3 text-center">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredCustomers.map(customer => (
                        <tr key={customer.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                            <td className="px-6 py-4 font-medium">{customer.name}</td>
                            <td className="px-6 py-4">{customer.phone || '-'}</td>
                            <td className="px-6 py-4 truncate max-w-xs">{customer.address || '-'}</td>
                            <td className={`px-6 py-4 text-right font-bold ${customer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                ₹{Math.abs(customer.balance).toFixed(2)} {customer.balance > 0 ? 'Dr' : 'Cr'}
                            </td>
                            <td className="px-6 py-4 text-center">
                                <button 
                                    onClick={() => setSelectedCustomer(customer)}
                                    className="text-indigo-600 hover:underline font-medium"
                                >
                                    View Details
                                </button>
                            </td>
                        </tr>
                    ))}
                    {filteredCustomers.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-4">No customers found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </Card>

      {selectedCustomer && (
          <Modal isOpen={!!selectedCustomer} onClose={() => setSelectedCustomer(null)} title={`Ledger: ${selectedCustomer.name}`} maxWidth="max-w-4xl">
              <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                      <div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Current Balance</p>
                          <p className={`text-2xl font-bold ${selectedCustomer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              ₹{Math.abs(selectedCustomer.balance).toFixed(2)} {selectedCustomer.balance > 0 ? 'Dr (Receivable)' : 'Cr (Advance)'}
                          </p>
                      </div>
                      <button 
                        onClick={() => setPaymentModalOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow"
                      >
                          <PlusIcon className="h-5 w-5" /> Receive Payment
                      </button>
                  </div>

                  <div className="overflow-x-auto border dark:border-slate-700 rounded-lg max-h-[60vh]">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
                              <tr>
                                  <th className="px-4 py-2">Date</th>
                                  <th className="px-4 py-2">Particulars</th>
                                  <th className="px-4 py-2 text-right">Debit (Bill)</th>
                                  <th className="px-4 py-2 text-right">Credit (Payment)</th>
                              </tr>
                          </thead>
                          <tbody>
                              {customerTransactions.map((tx, idx) => (
                                  <tr key={idx} className="border-b dark:border-slate-700">
                                      <td className="px-4 py-2">{tx.date.toLocaleDateString()}</td>
                                      <td className="px-4 py-2">{tx.type} - {tx.ref}</td>
                                      <td className="px-4 py-2 text-right text-red-600">{tx.debit > 0 ? `₹${tx.debit.toFixed(2)}` : '-'}</td>
                                      <td className="px-4 py-2 text-right text-green-600">{tx.credit > 0 ? `₹${tx.credit.toFixed(2)}` : '-'}</td>
                                  </tr>
                              ))}
                              {customerTransactions.length === 0 && (
                                  <tr><td colSpan={4} className="text-center py-4">No transaction history.</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
                  
                  <div className="flex justify-end pt-2 gap-3">
                      <button 
                        onClick={handleExportPdf}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors border dark:border-slate-600"
                      >
                          <PrinterIcon className="h-5 w-5" /> Export to PDF
                      </button>
                      <button onClick={() => setSelectedCustomer(null)} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 dark:text-slate-200">Close</button>
                  </div>
              </div>
          </Modal>
      )}

      {isPaymentModalOpen && selectedCustomer && (
          <Modal isOpen={isPaymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Receive Payment">
              <form onSubmit={handleSavePayment} className="space-y-4">
                  <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Customer: <span className="font-bold">{selectedCustomer.name}</span></p>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amount Received</label>
                      <input 
                        type="number" 
                        value={paymentAmount} 
                        onChange={e => setPaymentAmount(e.target.value)} 
                        className={formInputStyle} 
                        required 
                        min="0"
                        step="0.01"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                      <select 
                        value={paymentMethod} 
                        onChange={e => setPaymentMethod(e.target.value as any)} 
                        className={formSelectStyle}
                      >
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="Other">Other</option>
                      </select>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                      <input 
                        type="text" 
                        value={paymentNotes} 
                        onChange={e => setPaymentNotes(e.target.value)} 
                        className={formInputStyle} 
                        placeholder="Optional remarks..."
                      />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                      <button type="button" onClick={() => setPaymentModalOpen(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg dark:text-slate-200">Cancel</button>
                      <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Save Payment</button>
                  </div>
              </form>
          </Modal>
      )}
    </div>
  );
};

export default CustomerLedger;


import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import type { Customer, Bill, CustomerPayment, CompanyProfile } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { DownloadIcon, UserCircleIcon, PlusIcon, PrinterIcon, PencilIcon } from './icons/Icons';
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
  onUpdateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
}

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
const formSelectStyle = `${formInputStyle} appearance-none`;

const EditCustomerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    customer: Customer;
    onUpdate: (id: string, data: Partial<Customer>) => Promise<void>;
}> = ({ isOpen, onClose, customer, onUpdate }) => {
    const [name, setName] = useState(customer.name);
    const [phone, setPhone] = useState(customer.phone || '');
    const [address, setAddress] = useState(customer.address || '');
    const [openingBalance, setOpeningBalance] = useState(String(customer.openingBalance || 0));

    useEffect(() => {
        setName(customer.name);
        setPhone(customer.phone || '');
        setAddress(customer.address || '');
        setOpeningBalance(String(customer.openingBalance || 0));
    }, [customer]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onUpdate(customer.id, { 
            name, 
            phone, 
            address,
            openingBalance: parseFloat(openingBalance) || 0 
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Customer Details">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className={formInputStyle} required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={formInputStyle} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                    <input type="text" value={address} onChange={e => setAddress(e.target.value)} className={formInputStyle} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Opening Balance (₹)</label>
                    <input type="number" step="0.01" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className={formInputStyle} />
                    <p className="text-xs text-slate-500 mt-1">Updating this will adjust the current outstanding balance.</p>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Update</button>
                </div>
            </form>
        </Modal>
    );
};

interface Transaction {
    date: Date;
    type: 'Bill' | 'Payment';
    ref: string;
    debit: number;
    credit: number;
}

const CustomerLedger: React.FC<CustomerLedgerProps> = ({ customers, bills, payments, companyProfile, onAddPayment, onUpdateCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Other'>('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  
  // Date Filtering for Ledger View
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.phone && c.phone.includes(searchTerm))
    );
  }, [customers, searchTerm]);

  // Ledger Calculation Logic
  const ledgerData = useMemo(() => {
    if (!selectedCustomer) return { transactions: [], summary: { opening: 0, sales: 0, receipts: 0, closing: 0 } };
    
    // 1. Gather all transactions
    const allTransactions: Transaction[] = [];
    
    // Bills
    bills.forEach(b => {
        const isThisCustomer = (b.customerId === selectedCustomer.id) || 
                               (!b.customerId && b.customerName.toLowerCase() === selectedCustomer.name.toLowerCase());
        
        if (isThisCustomer && b.paymentMode === 'Credit') {
            allTransactions.push({
                date: new Date(b.date),
                type: 'Bill',
                ref: b.billNumber,
                debit: b.grandTotal,
                credit: 0
            });
        }
    });

    // Payments
    payments.forEach(p => {
        if (p.customerId === selectedCustomer.id) {
            allTransactions.push({
                date: new Date(p.date),
                type: 'Payment',
                ref: `${p.method}${p.notes ? ` - ${p.notes}` : ''}`,
                debit: 0,
                credit: p.amount
            });
        }
    });

    // Sort by Date
    allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // 2. Filter by Date Range and Calculate Period Opening Balance
    let openingBalance = selectedCustomer.openingBalance || 0;
    
    // If no start date, opening balance is just the customer's initial opening balance
    // If start date is set, calculate balance up to that date
    if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        
        // Filter transactions BEFORE start date to adjust opening balance
        const prePeriodTransactions = allTransactions.filter(t => t.date < startDate);
        const prePeriodDebit = prePeriodTransactions.reduce((sum, t) => sum + t.debit, 0);
        const prePeriodCredit = prePeriodTransactions.reduce((sum, t) => sum + t.credit, 0);
        
        openingBalance = openingBalance + prePeriodDebit - prePeriodCredit;
    }

    // Filter transactions WITHIN the period
    let filteredTransactions = allTransactions;
    if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        filteredTransactions = filteredTransactions.filter(t => t.date >= startDate);
    }
    if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        filteredTransactions = filteredTransactions.filter(t => t.date <= endDate);
    }

    // 3. Calculate Period Totals
    const totalSales = filteredTransactions.reduce((sum, t) => sum + t.debit, 0);
    const totalReceipts = filteredTransactions.reduce((sum, t) => sum + t.credit, 0);
    const closingBalance = openingBalance + totalSales - totalReceipts;

    return {
        transactions: filteredTransactions,
        summary: {
            opening: openingBalance,
            sales: totalSales,
            receipts: totalReceipts,
            closing: closingBalance
        }
    };

  }, [selectedCustomer, bills, payments, fromDate, toDate]);

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
            
            // Re-map transactions for the print component which expects a simpler array
            const printableTransactions = ledgerData.transactions.map(tx => ({
                date: tx.date,
                particulars: `${tx.type} - ${tx.ref}`,
                debit: tx.debit,
                credit: tx.credit,
                type: tx.type
            }));

            // We pass the period's opening balance calculated here to the print component 
            // so it starts correctly.
            // Note: The PrintableCustomerLedger component logic needs to be aware of this initial balance.
            // Currently PrintableCustomerLedger calculates running balance from 0. 
            // I should update it or pass initialBalance prop. 
            // For now, I'll assume PrintableCustomerLedger is simple and just dump the rows.
            
            // To make it correct, insert an "Opening Balance" row at the start for printing
            printableTransactions.unshift({
                date: fromDate ? new Date(fromDate) : new Date(0), // Dummy date
                particulars: 'Opening Balance',
                debit: ledgerData.summary.opening > 0 ? ledgerData.summary.opening : 0,
                credit: ledgerData.summary.opening < 0 ? Math.abs(ledgerData.summary.opening) : 0,
                type: 'Bill' // Dummy type
            });

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
  };

  const formatCurrency = (val: number) => `₹${Math.abs(val).toFixed(2)}`;
  const formatDrCr = (val: number) => val >= 0 ? 'Dr' : 'Cr';

  // Running balance calculator for display
  let runningBalance = ledgerData.summary.opening;

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
                                <div className="flex items-center justify-center gap-4">
                                    <button 
                                        onClick={() => { setSelectedCustomer(customer); setFromDate(''); setToDate(''); }}
                                        className="text-indigo-600 hover:underline font-medium"
                                    >
                                        View Details
                                    </button>
                                    <button
                                        onClick={() => setEditingCustomer(customer)}
                                        className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
                                        title="Edit Customer"
                                    >
                                        <PencilIcon className="h-4 w-4" />
                                    </button>
                                </div>
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
          <Modal isOpen={!!selectedCustomer} onClose={() => setSelectedCustomer(null)} title={`Ledger for ${selectedCustomer.name}`} maxWidth="max-w-5xl">
              <div className="space-y-6">
                  
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-700">
                        <div className="flex flex-col border-r border-slate-700 pr-4">
                            <span className="text-slate-400 text-sm mb-1">Opening Balance</span>
                            <span className="text-xl font-bold">{formatCurrency(ledgerData.summary.opening)} <span className="text-sm font-normal text-slate-400">{formatDrCr(ledgerData.summary.opening)}</span></span>
                        </div>
                        <div className="flex flex-col border-r border-slate-700 px-4">
                            <span className="text-red-400 text-sm mb-1">Sales (Debit)</span>
                            <span className="text-xl font-bold">{formatCurrency(ledgerData.summary.sales)}</span>
                        </div>
                        <div className="flex flex-col border-r border-slate-700 px-4">
                            <span className="text-green-400 text-sm mb-1">Receipts (Credit)</span>
                            <span className="text-xl font-bold">{formatCurrency(ledgerData.summary.receipts)}</span>
                        </div>
                        <div className="flex flex-col pl-4">
                            <span className="text-slate-400 text-sm mb-1">Outstanding Balance</span>
                            <span className="text-2xl font-bold">{formatCurrency(ledgerData.summary.closing)} <span className="text-sm font-normal text-slate-400">{formatDrCr(ledgerData.summary.closing)}</span></span>
                        </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-700/30 p-3 rounded-lg border dark:border-slate-700">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Period:</label>
                            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="p-1.5 text-sm border rounded bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" />
                            <span className="text-slate-400">-</span>
                            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="p-1.5 text-sm border rounded bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" />
                        </div>
                        
                        <div className="flex gap-2">
                            <button 
                                onClick={handleExportPdf}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-800 dark:text-white rounded-lg text-sm transition-colors"
                            >
                                <PrinterIcon className="h-4 w-4" /> Print
                            </button>
                            <button 
                                onClick={() => setPaymentModalOpen(true)}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm text-sm"
                            >
                                <PlusIcon className="h-4 w-4" /> Receive Payment
                            </button>
                        </div>
                  </div>

                  {/* Transaction Table */}
                  <div className="overflow-hidden border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                      <div className="bg-slate-800 text-slate-200 px-4 py-3 font-semibold border-b border-slate-700 flex justify-between items-center">
                          <span>Transaction History {fromDate || toDate ? '(Period)' : ''}</span>
                      </div>
                      <div className="overflow-x-auto max-h-[500px]">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold sticky top-0 z-10 border-b dark:border-slate-700 shadow-sm">
                                  <tr>
                                      <th className="px-4 py-3">Date</th>
                                      <th className="px-4 py-3">Particulars</th>
                                      <th className="px-4 py-3 text-right text-red-600 dark:text-red-400">Debit (₹)</th>
                                      <th className="px-4 py-3 text-right text-green-600 dark:text-green-400">Credit (₹)</th>
                                      <th className="px-4 py-3 text-right">Balance (₹)</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                  {/* Opening Row */}
                                  <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                                      <td className="px-4 py-3 text-slate-500 italic">Opening</td>
                                      <td className="px-4 py-3 text-slate-500 italic">Opening Balance</td>
                                      <td className="px-4 py-3 text-right">-</td>
                                      <td className="px-4 py-3 text-right">-</td>
                                      <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                                          {formatCurrency(ledgerData.summary.opening)} {formatDrCr(ledgerData.summary.opening)}
                                      </td>
                                  </tr>
                                  
                                  {/* Transactions */}
                                  {ledgerData.transactions.map((tx, idx) => {
                                      runningBalance = runningBalance + tx.debit - tx.credit;
                                      return (
                                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                              <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">{tx.date.toLocaleDateString()}</td>
                                              <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                                                  {tx.type === 'Bill' ? `Bill - ${tx.ref}` : `Payment - ${tx.ref}`}
                                              </td>
                                              <td className="px-4 py-3 text-right text-red-600 font-medium">{tx.debit > 0 ? tx.debit.toFixed(2) : '-'}</td>
                                              <td className="px-4 py-3 text-right text-green-600 font-medium">{tx.credit > 0 ? tx.credit.toFixed(2) : '-'}</td>
                                              <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                                                  {Math.abs(runningBalance).toFixed(2)} {formatDrCr(runningBalance)}
                                              </td>
                                          </tr>
                                      );
                                  })}
                                  {ledgerData.transactions.length === 0 && (
                                      <tr><td colSpan={5} className="text-center py-8 text-slate-500">No transactions in this period.</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>
                  
                  <div className="flex justify-end">
                      <button onClick={() => setSelectedCustomer(null)} className="px-6 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 font-medium text-slate-800 dark:text-slate-200 transition-colors">Close</button>
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

      {editingCustomer && (
          <EditCustomerModal 
              isOpen={!!editingCustomer}
              onClose={() => setEditingCustomer(null)}
              customer={editingCustomer}
              onUpdate={onUpdateCustomer}
          />
      )}
    </div>
  );
};

export default CustomerLedger;

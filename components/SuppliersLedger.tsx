import React from 'react';
import type { Supplier, Purchase } from '../types';
import Card from './common/Card';

interface SuppliersLedgerProps {
  suppliers: Supplier[];
  purchases: Purchase[];
}

const SuppliersLedger: React.FC<SuppliersLedgerProps> = ({ suppliers, purchases }) => {
  return (
    <div className="p-4 sm:p-6">
      <Card title="Suppliers Ledger">
        <div className="text-center py-10 text-slate-600 dark:text-slate-400">
          <p className="text-lg">This feature is under construction.</p>
          <p>The Suppliers Ledger will provide detailed transaction histories for each supplier.</p>
        </div>
      </Card>
    </div>
  );
};

export default SuppliersLedger;

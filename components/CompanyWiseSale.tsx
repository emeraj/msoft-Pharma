import React from 'react';
import type { Bill, Product } from '../types';
import Card from './common/Card';

interface CompanyWiseSaleProps {
  bills: Bill[];
  products: Product[];
}

const CompanyWiseSale: React.FC<CompanyWiseSaleProps> = ({ bills, products }) => {
  return (
    <div className="p-4 sm:p-6">
      <Card title="Company-wise Sales Report">
        <div className="text-center py-10 text-slate-600 dark:text-slate-400">
          <p className="text-lg">This feature is under construction.</p>
          <p>This report will break down sales figures by product company.</p>
        </div>
      </Card>
    </div>
  );
};

export default CompanyWiseSale;

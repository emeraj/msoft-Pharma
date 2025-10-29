import React from 'react';
import type { Bill } from '../types';
import Card from './common/Card';

interface SalesReportProps {
  bills: Bill[];
}

const SalesReport: React.FC<SalesReportProps> = ({ bills }) => {
  return (
    <div className="p-4 sm:p-6">
      <Card title="Sales Report">
        <div className="text-center py-10 text-slate-600 dark:text-slate-400">
          <p className="text-lg">This feature is under construction.</p>
          <p>The Sales Report will offer detailed insights into sales data over different periods.</p>
        </div>
      </Card>
    </div>
  );
};

export default SalesReport;

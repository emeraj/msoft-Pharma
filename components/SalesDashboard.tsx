
import React, { useMemo } from 'react';
import type { Bill, Product } from '../types';
import Card from './common/Card';
import { ArchiveIcon, CashIcon, CubeIcon, ReceiptIcon, ChartBarIcon, ExclamationCircleIcon } from './icons/Icons';

interface SalesDashboardProps {
  bills: Bill[];
  products: Product[];
}

const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
}> = ({ title, value, icon, color }) => (
    <Card className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-200">{value}</p>
        </div>
    </Card>
);

const SalesDashboard: React.FC<SalesDashboardProps> = ({ bills, products }) => {
    
    const stats = useMemo(() => {
        const totalRevenue = bills.reduce((sum, bill) => sum + bill.grandTotal, 0);
        const totalBills = bills.length;
        const avgBillValue = totalBills > 0 ? totalRevenue / totalBills : 0;
        const totalItemsSold = bills.reduce((sum, bill) => sum + bill.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
        
        // Calculate low stock items count
        const lowStockCount = products.reduce((count, product) => {
            if (!product.lowStockThreshold || product.lowStockThreshold <= 0) return count;
            
            const currentStock = product.batches.reduce((sum, b) => sum + b.stock, 0);
            // Threshold logic: 
            // - For retail: threshold is in units, currentStock is in units.
            // - For pharma: threshold is stored in strips (user input), but currentStock is in units. 
            //   So compare stock <= threshold * unitsPerStrip
            const thresholdInBaseUnits = product.lowStockThreshold * (product.unitsPerStrip || 1);
            
            return currentStock <= thresholdInBaseUnits ? count + 1 : count;
        }, 0);

        return {
            totalRevenue,
            totalBills,
            avgBillValue,
            totalItemsSold,
            lowStockCount
        };
    }, [bills, products]);

    const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

    const monthlySalesData = useMemo(() => {
        const monthsMap = new Map<string, { label: string; sales: number }>();
        const today = new Date();

        // 1. Initialize the last 12 months in a map for efficient lookup
        for (let i = 11; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            // Use 'short' month and 2-digit year for clarity, e.g., "Jul '24"
            const label = date.toLocaleString('default', { month: 'short', year: '2-digit' });
            monthsMap.set(key, { label, sales: 0 });
        }
        
        // 2. Aggregate sales from bills
        bills.forEach(bill => {
            const billDate = new Date(bill.date);
            const monthKey = `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`;
            
            if (monthsMap.has(monthKey)) {
                const monthData = monthsMap.get(monthKey)!;
                monthData.sales += bill.grandTotal;
            }
        });
        
        // 3. Convert map values to an array for rendering
        return Array.from(monthsMap.values()).map(({ label, sales }) => ({
            month: label,
            sales,
        }));

    }, [bills]);
    
    const maxSale = useMemo(() => Math.max(...monthlySalesData.map(d => d.sales), 1), [monthlySalesData]);

    const topSellingProducts = useMemo(() => {
        const productSales: { [productId: string]: { name: string; company: string; quantity: number } } = {};

        bills.forEach(bill => {
            bill.items.forEach(item => {
                if (productSales[item.productId]) {
                    productSales[item.productId].quantity += item.quantity;
                } else {
                    const productInfo = products.find(p => p.id === item.productId);
                    productSales[item.productId] = {
                        name: item.productName,
                        company: productInfo?.company || 'Unknown',
                        quantity: item.quantity,
                    };
                }
            });
        });

        return Object.values(productSales)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);
    }, [bills, products]);

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Sales Dashboard</h1>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <StatCard title="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon={<CashIcon className="h-6 w-6 text-green-800 dark:text-green-200" />} color="bg-green-100 dark:bg-green-900/50" />
            <StatCard title="Total Bills" value={stats.totalBills.toLocaleString('en-IN')} icon={<ReceiptIcon className="h-6 w-6 text-blue-800 dark:text-blue-200" />} color="bg-blue-100 dark:bg-blue-900/50" />
            <StatCard title="Average Bill Value" value={formatCurrency(stats.avgBillValue)} icon={<ChartBarIcon className="h-6 w-6 text-indigo-800 dark:text-indigo-200" />} color="bg-indigo-100 dark:bg-indigo-900/50" />
            <StatCard title="Total Items Sold" value={stats.totalItemsSold.toLocaleString('en-IN')} icon={<CubeIcon className="h-6 w-6 text-yellow-800 dark:text-yellow-200" />} color="bg-yellow-100 dark:bg-yellow-900/50" />
            <StatCard title="Low Stock Items" value={stats.lowStockCount.toLocaleString('en-IN')} icon={<ExclamationCircleIcon className="h-6 w-6 text-red-800 dark:text-red-200" />} color="bg-red-100 dark:bg-red-900/50" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card title="Monthly Sales (Last 12 Months)" className="lg:col-span-2">
                <div className="h-72 w-full p-4 flex justify-around items-end gap-2 sm:gap-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    {monthlySalesData.map((data, index) => (
                        <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group">
                            <div 
                                className="w-full bg-indigo-400 dark:bg-indigo-500 rounded-t-md hover:bg-indigo-500 dark:hover:bg-indigo-400 transition-all duration-300"
                                style={{ height: `${(data.sales / maxSale) * 100}%` }}
                                title={`${data.month}: ${formatCurrency(data.sales)}`}
                            >
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white text-xs text-center p-1 bg-black/50 rounded-md -mt-8">
                                    {formatCurrency(data.sales)}
                                </div>
                            </div>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-2">{data.month}</span>
                        </div>
                    ))}
                </div>
            </Card>
            
            <Card title="Top 5 Selling Products">
                {topSellingProducts.length > 0 ? (
                    <ul className="space-y-4">
                        {topSellingProducts.map((product, index) => (
                            <li key={index} className="flex items-center gap-4">
                                <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-full font-bold text-slate-700 dark:text-slate-300">
                                    {index + 1}
                                </div>
                                <div className="flex-grow">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200">{product.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{product.company}</p>
                                </div>
                                <div className="font-bold text-lg text-indigo-600 dark:text-indigo-400">
                                    {product.quantity}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                        <ArchiveIcon className="h-12 w-12 mx-auto mb-2" />
                        <p>No sales data available yet.</p>
                    </div>
                )}
            </Card>
        </div>
        <style>{`
            @keyframes fade-in {
                0% { opacity: 0; transform: translateY(10px); }
                100% { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
        `}</style>
    </div>
  );
};

export default SalesDashboard;
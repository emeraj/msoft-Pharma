import React, { useMemo } from 'react';
import type { SystemConfig } from '../types';
import { InformationCircleIcon, CloudIcon } from './icons/Icons';

interface SubscriptionAlertProps {
    systemConfig: SystemConfig;
}

const SubscriptionAlert: React.FC<SubscriptionAlertProps> = ({ systemConfig }) => {
    const isExpired = useMemo(() => {
        if (!systemConfig.subscription?.expiryDate) return false;
        const expiry = new Date(systemConfig.subscription.expiryDate);
        return expiry < new Date();
    }, [systemConfig.subscription?.expiryDate]);

    if (!isExpired) return null;

    const upiId = "9890072651@upi"; // M. Soft India
    const amount = "5000";
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent("M. Soft India")}&am=${amount}&cu=INR`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUrl)}`;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border-4 border-rose-500 transform scale-100 transition-all">
                <div className="bg-rose-500 p-6 text-center">
                    <div className="inline-flex items-center justify-center p-3 bg-white/20 rounded-full mb-3">
                        <InformationCircleIcon className="h-10 w-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Subscription Expired</h2>
                </div>
                
                <div className="p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <p className="text-slate-600 dark:text-slate-300 font-medium">
                            Your professional plan has expired on <span className="font-black text-rose-500">
                                {new Date(systemConfig.subscription?.expiryDate!).toLocaleDateString()}
                            </span>.
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                            Please renew to continue using advanced features like Operators and AI Scanner.
                        </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-700 text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Renew Now via UPI</p>
                        <div className="inline-block bg-white p-2 rounded-xl shadow-inner mb-4">
                            <img src={qrCodeUrl} alt="Payment QR" className="w-48 h-48" />
                        </div>
                        <p className="text-3xl font-black text-indigo-600">₹5,000 <span className="text-sm font-normal text-slate-500">/ Year</span></p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <div className="bg-indigo-600 p-2 rounded-lg">
                                <CloudIcon className="h-5 w-5 text-white" />
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300">WhatsApp Screenshot</p>
                                <p className="text-lg font-black text-indigo-900 dark:text-indigo-100">9890072651</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 text-center border-t dark:border-slate-700">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Managed by M. Soft India</p>
                </div>
            </div>
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default SubscriptionAlert;
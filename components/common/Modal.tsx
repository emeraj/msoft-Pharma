
import React from 'react';
import { XIcon } from '../icons/Icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div 
        className={`bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full ${maxWidth} flex flex-col max-h-[90vh] relative animate-fade-in-up`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 pb-2 border-b dark:border-slate-700 flex-shrink-0">
          <h3 className="text-2xl font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
          <button 
            onClick={onClose}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6 pt-4 overflow-y-auto">
            {children}
        </div>
      </div>
      <style>{`
        @keyframes fade-in-up {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default Modal;

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ children, className = '', title }) => {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 sm:p-6 ${className}`}>
      {title && (
        typeof title === 'string' ? (
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4 pb-2 border-b dark:border-slate-700">{title}</h2>
        ) : (
          <div className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4 pb-2 border-b dark:border-slate-700">
            {title}
          </div>
        )
      )}
      {children}
    </div>
  );
};

export default Card;
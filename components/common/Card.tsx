import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '', title }) => {
  return (
    <div className={`bg-white rounded-lg shadow-md p-4 sm:p-6 ${className}`}>
      {title && <h2 className="text-xl font-semibold text-slate-800 mb-4 pb-2 border-b">{title}</h2>}
      {children}
    </div>
  );
};

export default Card;
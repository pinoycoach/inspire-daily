import React from 'react';

export const MessageBox = ({ message, type }: { message: string, type: 'success' | 'error' }) => {
  const isError = type === 'error';
  return (
    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl shadow-2xl text-white font-semibold transition-all duration-300 ${
      isError ? 'bg-red-600' : 'bg-green-600'
    }`}>
      {message}
    </div>
  );
};

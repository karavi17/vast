import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'loading';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (type !== 'loading') {
      setTimeout(() => hideToast(id), 4000);
    }
  }, [hideToast]);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border min-w-[300px] animate-in slide-in-from-right-full duration-300
              ${toast.type === 'success' ? 'bg-[#1a1a1a] border-green-500/50 text-green-400' : ''}
              ${toast.type === 'error' ? 'bg-[#1a1a1a] border-red-500/50 text-red-400' : ''}
              ${toast.type === 'info' ? 'bg-[#1a1a1a] border-blue-500/50 text-blue-400' : ''}
              ${toast.type === 'loading' ? 'bg-[#1a1a1a] border-zinc-700 text-white' : ''}
            `}
          >
            <div className="flex-shrink-0">
              {toast.type === 'success' && <CheckCircle size={20} />}
              {toast.type === 'error' && <AlertCircle size={20} />}
              {toast.type === 'info' && <Info size={20} />}
              {toast.type === 'loading' && <Loader2 size={20} className="animate-spin" />}
            </div>
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => hideToast(toast.id)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

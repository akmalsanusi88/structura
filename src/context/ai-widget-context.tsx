'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

type AiWidgetStatus = 'idle' | 'in-progress' | 'success' | 'error';

interface AiWidgetContextType {
  isVisible: boolean;
  message: string;
  status: AiWidgetStatus;
  showWidget: (message: string, status?: AiWidgetStatus, duration?: number) => void;
  hideWidget: () => void;
  updateWidget: (message: string, status?: AiWidgetStatus, duration?: number) => void;
}

const AiWidgetContext = createContext<AiWidgetContextType | undefined>(undefined);

export function AiWidgetProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<AiWidgetStatus>('idle');
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const hideWidget = useCallback(() => {
    setIsVisible(false);
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
  }, [timeoutId]);

  const showWidget = useCallback(
    (newMessage: string, newStatus: AiWidgetStatus = 'idle', duration: number = 5000) => {
      setMessage(newMessage);
      setStatus(newStatus);
      setIsVisible(true);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (newStatus === 'success' || newStatus === 'error') {
        const newTimeoutId = setTimeout(() => {
          hideWidget();
        }, duration);
        setTimeoutId(newTimeoutId);
      }
    },
    [hideWidget, timeoutId]
  );
  
  const updateWidget = useCallback(
    (newMessage: string, newStatus: AiWidgetStatus = 'idle', duration: number = 5000) => {
        showWidget(newMessage, newStatus, duration);
    }, [showWidget]
  );

  return (
    <AiWidgetContext.Provider value={{ isVisible, message, status, showWidget, hideWidget, updateWidget }}>
      {children}
    </AiWidgetContext.Provider>
  );
}

export function useAiWidget() {
  const context = useContext(AiWidgetContext);
  if (context === undefined) {
    throw new Error('useAiWidget must be used within an AiWidgetProvider');
  }
  return context;
}

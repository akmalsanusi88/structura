'use client';

import { motion, useDragControls } from 'framer-motion';
import { Bot, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useAiWidget } from '@/context/ai-widget-context';

export default function AiWidget() {
  const { isVisible, message, status, hideWidget } = useAiWidget();
  const dragControls = useDragControls();

  if (!isVisible) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'in-progress':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-400" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-400" />;
      default:
        return <Bot className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <motion.div
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ duration: 0.3 }}
      className="fixed bottom-5 right-5 z-[100] w-64 cursor-grab rounded-lg bg-gray-900/80 p-4 shadow-2xl backdrop-blur-md"
      onPointerDown={(e) => dragControls.start(e)}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 flex-shrink-0">{getStatusIcon()}</div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">AI Assistant</p>
          <p className="text-xs text-gray-300">{message}</p>
        </div>
      </div>
      <button
        onClick={hideWidget}
        className="absolute -right-1 -top-1 rounded-full bg-gray-700 p-0.5 text-white/50 hover:text-white"
      >
        <XCircle className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, X } from 'lucide-react';

interface UndoAction {
  id: string;
  label: string;
  onUndo: () => Promise<void> | void;
  onCommit?: () => Promise<void> | void;
  timestamp: number;
}

interface UndoContextType {
  showUndo: (action: Omit<UndoAction, 'id' | 'timestamp'>) => void;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [actionsStack, setActionsStack] = useState<UndoAction[]>([]);
  const [timeLeft, setTimeLeft] = useState(5);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentAction = actionsStack[actionsStack.length - 1] || null;

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const showUndo = (action: Omit<UndoAction, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substring(7);
    const newAction = { ...action, id, timestamp: Date.now() };
    
    setActionsStack(prev => [...prev, newAction]);
    setTimeLeft(5);
    
    // Reset timer for the new top action
    clearTimer();
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Commit the oldest action that timed out
          setActionsStack(prevStack => {
            const [oldest, ...rest] = prevStack;
            if (oldest?.onCommit) oldest.onCommit();
            return rest;
          });
          return 5; // Reset for next action in stack
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleUndo = async () => {
    if (currentAction) {
      await currentAction.onUndo();
      setActionsStack(prev => prev.slice(0, -1));
      setTimeLeft(5);
      if (actionsStack.length <= 1) {
        clearTimer();
      }
    }
  };

  const handleDismiss = () => {
    if (currentAction?.onCommit) currentAction.onCommit();
    setActionsStack(prev => prev.slice(0, -1));
    setTimeLeft(5);
    if (actionsStack.length <= 1) {
      clearTimer();
    }
  };

  return (
    <UndoContext.Provider value={{ showUndo }}>
      {children}
      <AnimatePresence>
        {currentAction && (
          <motion.div
            key={currentAction.id}
            initial={{ y: 100, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 100, opacity: 0, x: '-50%' }}
            className="fixed bottom-24 left-1/2 z-[100] w-[90%] max-w-md"
          >
            <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-white/10 dark:border-slate-200">
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 flex items-center justify-center">
                   <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="opacity-20"
                    />
                    <motion.circle
                      key={`timer-${currentAction.id}-${actionsStack.length}`}
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="88"
                      initial={{ strokeDashoffset: 0 }}
                      animate={{ strokeDashoffset: 88 }}
                      transition={{ duration: 5, ease: "linear" }}
                    />
                  </svg>
                  <span className="text-[10px] font-bold">{timeLeft}s</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{currentAction.label}</span>
                  {actionsStack.length > 1 && (
                    <span className="text-[10px] opacity-50 font-bold uppercase">+{actionsStack.length - 1} pendentes</span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUndo}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-bold active:scale-95 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Desfazer
                </button>
                <button 
                  onClick={handleDismiss}
                  className="p-1.5 hover:bg-white/10 dark:hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </UndoContext.Provider>
  );
}

export function useUndo() {
  const context = useContext(UndoContext);
  if (context === undefined) {
    throw new Error('useUndo must be used within an UndoProvider');
  }
  return context;
}

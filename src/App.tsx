import React, { useState, useEffect } from 'react';
import { SettingsProvider } from './contexts/SettingsContext';
import { UndoProvider } from './contexts/UndoContext';
import { EmployeeList } from './components/EmployeeList';
import { EmployeeDetail } from './components/EmployeeDetail';
import { CalendarView } from './components/CalendarView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { Users2, CalendarDays, Clock3, Settings2, DatabaseBackup, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './db';
import { useLiveQuery } from 'dexie-react-hooks';
import { BACKUP_KEY, restoreBackup } from './lib/backup';

type View = 'employees' | 'calendar' | 'history' | 'settings';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('employees');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  // Sync state with browser history (handles system back button)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state) {
        setCurrentView(event.state.view || 'employees');
        setSelectedEmployeeId(event.state.employeeId || null);
      } else {
        // Default state
        setCurrentView('employees');
        setSelectedEmployeeId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Initialize first state
    window.history.replaceState({ view: 'employees', employeeId: null }, '');

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToView = (view: View) => {
    setCurrentView(view);
    setSelectedEmployeeId(null);
    window.history.pushState({ view, employeeId: null }, '');
  };

  const navigateToEmployee = (id: number) => {
    setSelectedEmployeeId(id);
    window.history.pushState({ view: currentView, employeeId: id }, '');
  };

  const goBack = () => {
    window.history.back();
  };

  // Auto-backup logic
  const allData = useLiveQuery(async () => {
    const employees = await db.employees.toArray();
    const workEntries = await db.workEntries.toArray();
    return { employees, workEntries };
  }, []);

  useEffect(() => {
    if (allData && (allData.employees.length > 0 || allData.workEntries.length > 0)) {
      // Create backup in Dexie
      const backup = { ...allData, timestamp: Date.now() };
      db.backups.put({
        id: 1,
        data: JSON.stringify(backup),
        timestamp: Date.now()
      });
    }
  }, [allData]);

  // Check for empty DB and backup on mount
  useEffect(() => {
    const checkEmpty = async () => {
      const empCount = await db.employees.count();
      const entryCount = await db.workEntries.count();
      const backup = await db.backups.get(1);
      
      if (empCount === 0 && entryCount === 0 && backup) {
        setShowRestorePrompt(true);
      }
    };
    checkEmpty();
  }, []);

  const handleRestore = async () => {
    const success = await restoreBackup();
    if (success) {
      setShowRestorePrompt(false);
    }
  };

  const renderView = () => {
    if (selectedEmployeeId) {
      return (
        <EmployeeDetail 
          employeeId={selectedEmployeeId} 
          onBack={goBack} 
        />
      );
    }

    switch (currentView) {
      case 'employees':
        return <EmployeeList onSelectEmployee={navigateToEmployee} />;
      case 'calendar':
        return <CalendarView />;
      case 'history':
        return <HistoryView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <EmployeeList onSelectEmployee={navigateToEmployee} />;
    }
  };

  return (
    <div className="max-w-md mx-auto h-[100dvh] flex flex-col bg-slate-50 dark:bg-slate-950 shadow-2xl overflow-hidden relative">
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedEmployeeId ? `detail-${selectedEmployeeId}` : currentView}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full overflow-y-auto scroll-smooth"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showRestorePrompt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-3xl p-6 space-y-4 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                <DatabaseBackup className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold">Restaurar Dados?</h3>
              <p className="text-slate-500 text-sm">Identificamos um backup automático. Deseja restaurar seus funcionários e lançamentos?</p>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleRestore}
                  className="w-full py-3 rounded-xl font-bold text-white bg-emerald-600 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                >
                  Sim, Restaurar
                </button>
                <button
                  onClick={() => setShowRestorePrompt(false)}
                  className="w-full py-3 rounded-xl font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 active:scale-95 transition-all"
                >
                  Não, Começar do Zero
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <nav className="absolute bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-4 pb-6 flex justify-around items-center z-30 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <button
          onClick={() => navigateToView('employees')}
          className={`flex flex-col items-center gap-1 transition-all ${
            currentView === 'employees' && !selectedEmployeeId ? 'text-emerald-600 dark:text-emerald-400 scale-110' : 'text-slate-400'
          }`}
        >
          <Users2 className="w-7 h-7" />
          <span className="text-[10px] font-black uppercase tracking-tighter">Equipe</span>
        </button>
        
        <button
          onClick={() => navigateToView('calendar')}
          className={`flex flex-col items-center gap-1 transition-all ${
            currentView === 'calendar' ? 'text-emerald-600 dark:text-emerald-400 scale-110' : 'text-slate-400'
          }`}
        >
          <CalendarDays className="w-7 h-7" />
          <span className="text-[10px] font-black uppercase tracking-tighter">Agenda</span>
        </button>

        <button
          onClick={() => navigateToView('history')}
          className={`flex flex-col items-center gap-1 transition-all ${
            currentView === 'history' ? 'text-emerald-600 dark:text-emerald-400 scale-110' : 'text-slate-400'
          }`}
        >
          <Clock3 className="w-7 h-7" />
          <span className="text-[10px] font-black uppercase tracking-tighter">Histórico</span>
        </button>

        <button
          onClick={() => navigateToView('settings')}
          className={`flex flex-col items-center gap-1 transition-all ${
            currentView === 'settings' ? 'text-emerald-600 dark:text-emerald-400 scale-110' : 'text-slate-400'
          }`}
        >
          <Settings2 className="w-7 h-7" />
          <span className="text-[10px] font-black uppercase tracking-tighter">Ajustes</span>
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <UndoProvider>
        <AppContent />
      </UndoProvider>
    </SettingsProvider>
  );
}

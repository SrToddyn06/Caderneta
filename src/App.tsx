import React, { useState, useEffect } from 'react';
import { SettingsProvider } from './contexts/SettingsContext';
import { UndoProvider } from './contexts/UndoContext';
import { EmployeeList } from './components/EmployeeList';
import { EmployeeDetail } from './components/EmployeeDetail';
import { CalendarView } from './components/CalendarView';
import { StatsView } from './components/StatsView';
import { SettingsView } from './components/SettingsView';
import { Users2, CalendarDays, BarChart3, Settings2, DatabaseBackup, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './db';
import { useLiveQuery } from 'dexie-react-hooks';
import { BACKUP_KEY, restoreBackup } from './lib/backup';

import { App as CapApp } from '@capacitor/app';

type View = 'employees' | 'calendar' | 'history' | 'settings';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('employees');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  // Capacitor Back Button Handling
  useEffect(() => {
    const backListener = CapApp.addListener('backButton', () => {
      // If any modal is open (identified by fixed inset-0), close them first
      const hasOpenModal = !!document.querySelector('.fixed.inset-0');
      if (hasOpenModal) {
        window.dispatchEvent(new CustomEvent('close-modals'));
        return;
      }

      if (selectedEmployeeId || currentView !== 'employees') {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    });

    return () => {
      backListener.then(l => l.remove());
    };
  }, [selectedEmployeeId, currentView]);

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
      const timeout = setTimeout(() => {
        // Create backup in Dexie
        const backup = { ...allData, timestamp: Date.now() };
        db.backups.put({
          id: 1,
          data: JSON.stringify(backup),
          timestamp: Date.now()
        });
      }, 2000); // Debounce 2s
      
      return () => clearTimeout(timeout);
    }
  }, [allData]);

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
        return <StatsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <EmployeeList onSelectEmployee={navigateToEmployee} />;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto h-[100dvh] flex flex-col bg-slate-50 dark:bg-black shadow-2xl overflow-hidden relative safe-p-x">
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

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 dark:bg-black/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-4 pt-4 safe-bottom flex justify-around items-center z-40 shadow-[0_-8px_30px_rgba(0,0,0,0.15)]">
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
          <BarChart3 className="w-7 h-7" />
          <span className="text-[10px] font-black uppercase tracking-tighter">Resumo</span>
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

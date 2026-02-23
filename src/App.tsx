import React, { useState } from 'react';
import { SettingsProvider } from './contexts/SettingsContext';
import { EmployeeList } from './components/EmployeeList';
import { EmployeeDetail } from './components/EmployeeDetail';
import { CalendarView } from './components/CalendarView';
import { SettingsView } from './components/SettingsView';
import { Users, Calendar, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type View = 'employees' | 'calendar' | 'settings';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('employees');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  const renderView = () => {
    if (selectedEmployeeId) {
      return (
        <EmployeeDetail 
          employeeId={selectedEmployeeId} 
          onBack={() => setSelectedEmployeeId(null)} 
        />
      );
    }

    switch (currentView) {
      case 'employees':
        return <EmployeeList onSelectEmployee={setSelectedEmployeeId} />;
      case 'calendar':
        return <CalendarView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <EmployeeList onSelectEmployee={setSelectedEmployeeId} />;
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

      <nav className="absolute bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-4 pb-6 flex justify-around items-center z-30 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <button
          onClick={() => {
            setCurrentView('employees');
            setSelectedEmployeeId(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${
            currentView === 'employees' ? 'text-emerald-600 dark:text-emerald-400 scale-110' : 'text-slate-400'
          }`}
        >
          <Users className="w-7 h-7" />
          <span className="text-[10px] font-black uppercase tracking-tighter">Equipe</span>
        </button>
        
        <button
          onClick={() => {
            setCurrentView('calendar');
            setSelectedEmployeeId(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${
            currentView === 'calendar' ? 'text-emerald-600 dark:text-emerald-400 scale-110' : 'text-slate-400'
          }`}
        >
          <Calendar className="w-7 h-7" />
          <span className="text-[10px] font-black uppercase tracking-tighter">Agenda</span>
        </button>

        <button
          onClick={() => {
            setCurrentView('settings');
            setSelectedEmployeeId(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${
            currentView === 'settings' ? 'text-emerald-600 dark:text-emerald-400 scale-110' : 'text-slate-400'
          }`}
        >
          <SettingsIcon className="w-7 h-7" />
          <span className="text-[10px] font-black uppercase tracking-tighter">Ajustes</span>
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

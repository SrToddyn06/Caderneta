import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../db';
import { Moon, Sun, Type, ShieldAlert, Download, Upload, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function SettingsView() {
  const { settings, updateSettings } = useSettings();
  const [isConfirmingClear, setIsConfirmingClear] = React.useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = React.useState(false);

  const handleExportCSV = async () => {
    const employees = await db.employees.toArray();
    const entries = await db.workEntries.toArray();

    let csv = 'Tipo,ID,Nome/EmployeeID,Telefone/Data,Valor,Nota,Pago\n';
    
    employees.forEach(e => {
      csv += `Funcionario,${e.id},"${e.name}",${e.phone},${e.defaultAmountCents},,\n`;
    });

    entries.forEach(e => {
      csv += `Lancamento,${e.id},${e.employeeId},${e.dateIso},${e.amountCents},"${e.note}",${e.isPaid}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `caderneta_backup_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleClearAll = async () => {
    await db.workEntries.clear();
    await db.employees.clear();
    setIsConfirmingClear(false);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  if (!settings) return null;

  return (
    <div className="p-4 space-y-6 pb-32">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Configurações</h1>
        <p className="text-slate-500">Personalize sua experiência</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Aparência</h2>
        
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => updateSettings({ theme: 'light' })}
            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
              settings.theme === 'light' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <Sun className={settings.theme === 'light' ? 'text-emerald-600' : 'text-slate-400'} />
            <span className="font-bold">Claro</span>
          </button>
          <button
            onClick={() => updateSettings({ theme: 'dark' })}
            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
              settings.theme === 'dark' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <Moon className={settings.theme === 'dark' ? 'text-emerald-600' : 'text-slate-400'} />
            <span className="font-bold">Escuro</span>
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Tamanho da Letra</h2>
        <div className="flex bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
          {(['sm', 'md', 'lg'] as const).map((size) => (
            <button
              key={size}
              onClick={() => updateSettings({ fontSize: size })}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                settings.fontSize === size ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'
              }`}
            >
              {size === 'sm' ? 'Pequena' : size === 'md' ? 'Média' : 'Grande'}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Dados e Segurança</h2>
        
        <div className="space-y-3">
          <button
            onClick={handleExportCSV}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 active:scale-95 transition-all"
          >
            <div className="flex items-center gap-3">
              <Download className="text-emerald-500" />
              <span className="font-bold">Exportar Backup (CSV)</span>
            </div>
          </button>

          <button
            onClick={() => setIsConfirmingClear(true)}
            className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20 text-red-600 active:scale-95 transition-all"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5" />
              <span className="font-bold">Apagar Todos os Dados</span>
            </div>
          </button>
        </div>
      </section>

      <AnimatePresence>
        {isConfirmingClear && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-3xl p-6 space-y-4 shadow-2xl text-center"
            >
              <h3 className="text-xl font-bold text-red-600">Atenção!</h3>
              <p className="text-slate-500">Isso apagará TODOS os dados do aplicativo permanentemente. Esta ação não pode ser desfeita.</p>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleClearAll}
                  className="w-full py-3 rounded-xl font-bold text-white bg-red-600 shadow-lg shadow-red-600/20 active:scale-95 transition-all"
                >
                  Apagar Tudo
                </button>
                <button
                  onClick={() => setIsConfirmingClear(false)}
                  className="w-full py-3 rounded-xl font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 active:scale-95 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showSuccessMessage && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-24 left-4 right-4 bg-emerald-600 text-white p-4 rounded-2xl shadow-xl z-50 text-center font-bold"
          >
            Todos os dados foram apagados com sucesso.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-center pt-8 text-slate-400 text-sm">
        <p>Caderneta v1.0</p>
        <p>Desenvolvido para máxima simplicidade.</p>
      </div>
    </div>
  );
}

import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../db';
import { Moon, Sun, Type, ShieldAlert, Download, Upload, Trash2, X, FileJson, DatabaseBackup } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { downloadBackup, restoreBackup, BACKUP_KEY } from '../lib/backup';

export function SettingsView() {
  const { settings, updateSettings } = useSettings();
  const [isConfirmingClear, setIsConfirmingClear] = React.useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = React.useState(false);
  const [successText, setSuccessText] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUpdateSetting = async (newSettings: any) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateSettings(newSettings);
      // Optional: show a quick success indicator for critical settings
      if ('debtThresholdCents' in newSettings) {
        setSuccessText('Limite de alerta atualizado!');
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 2000);
      }
    } catch (err) {
      setSaveError('Erro ao salvar as configurações.');
      setTimeout(() => setSaveError(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSV = async () => {
    const employees = await db.employees.toArray();
    const entries = await db.workEntries.toArray();

    let csv = 'Tipo,ID,Nome/EmployeeID,Telefone/Data,Valor,Nota,Pago\n';
    
    employees.forEach(e => {
      csv += `Funcionario,${e.id},"${e.name.replace(/"/g, '""')}",${e.phone},${e.defaultAmountCents},,\n`;
    });

    entries.forEach(e => {
      csv += `Lancamento,${e.id},${e.employeeId},${e.dateIso},${e.amountCents},"${(e.note || '').replace(/"/g, '""')}",${e.isPaid}\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `caderneta_backup_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExportJSON = async () => {
    const employees = await db.employees.toArray();
    const workEntries = await db.workEntries.toArray();
    downloadBackup({ employees, workEntries, timestamp: Date.now() });
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const success = await restoreBackup(data);
        if (success) {
          setSuccessText('Arquivo importado com sucesso!');
          setShowSuccessMessage(true);
          setTimeout(() => setShowSuccessMessage(false), 3000);
        }
      } catch (err) {
        alert('Erro ao ler o arquivo JSON. Verifique se o formato está correto.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = async () => {
    await db.workEntries.clear();
    await db.employees.clear();
    setIsConfirmingClear(false);
    setSuccessText('Todos os dados foram apagados com sucesso.');
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  if (!settings) return null;

  return (
    <div className="p-4 space-y-6 pb-24">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Configurações</h1>
        <p className="text-slate-500">Personalize sua experiência</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Aparência</h2>
        
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleUpdateSetting({ theme: 'light' })}
            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
              settings.theme === 'light' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <Sun className={settings.theme === 'light' ? 'text-emerald-600' : 'text-slate-400'} />
            <span className="font-bold">Claro</span>
          </button>
          <button
            onClick={() => handleUpdateSetting({ theme: 'dark' })}
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
              onClick={() => handleUpdateSetting({ fontSize: size })}
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
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest text-red-500">Alertas de Dívida</h2>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <ShieldAlert className="text-red-500" />
              <span className="font-bold">Limite de Alerta</span>
            </div>
            <span className="text-xl font-black text-red-600">
              R$ {((settings.debtThresholdCents || 50000) / 100).toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="100"
            max="2000"
            step="50"
            value={(settings.debtThresholdCents || 50000) / 100}
            onChange={(e) => handleUpdateSetting({ debtThresholdCents: parseInt(e.target.value) * 100 })}
            className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Funcionários que ultrapassarem este valor serão destacados em vermelho na lista principal.
            </p>
            {isSaving && (
              <span className="text-[10px] font-black text-emerald-600 uppercase animate-pulse">Salvando...</span>
            )}
            {saveError && (
              <span className="text-[10px] font-black text-red-600 uppercase">{saveError}</span>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Dados e Segurança</h2>
        
        <div className="space-y-3">
          <button
            onClick={handleExportJSON}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 active:scale-95 transition-all"
          >
            <div className="flex items-center gap-3">
              <FileJson className="text-emerald-500" />
              <span className="font-bold">Exportar Backup (JSON)</span>
            </div>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 active:scale-95 transition-all"
          >
            <div className="flex items-center gap-3">
              <Upload className="text-emerald-500" />
              <span className="font-bold">Importar Arquivo JSON</span>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportJSON} 
              accept=".json" 
              className="hidden" 
            />
          </button>

          <button
            onClick={handleExportCSV}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 active:scale-95 transition-all"
          >
            <div className="flex items-center gap-3">
              <Download className="text-slate-400" />
              <span className="font-bold text-slate-500">Exportar Planilha (CSV)</span>
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
            {successText}
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

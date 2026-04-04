import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Employee } from '../db';
import { useSettings } from '../contexts/SettingsContext';
import { useUndo } from '../contexts/UndoContext';
import { Plus, Search, User, Phone, ChevronRight, Zap, UserCircle2, UserPlus, AlertTriangle, Pin, PinOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../lib/utils';

interface EmployeeListProps {
  onSelectEmployee: (id: number) => void;
}

interface EmployeeWithDebt extends Employee {
  debt: number;
}

export function EmployeeList({ onSelectEmployee }: EmployeeListProps) {
  const { settings } = useSettings();
  const { showUndo } = useUndo();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAmount, setNewAmount] = useState('0');
  const [showQuickSuccess, setShowQuickSuccess] = useState<string | null>(null);

  const DEBT_THRESHOLD = settings?.debtThresholdCents || 50000; // R$ 500,00

  const employees = useLiveQuery(
    async () => {
      const emps = await db.employees
        .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .toArray();
      
      const results = await Promise.all(emps.map(async (e) => {
        const unpaid = await db.workEntries
          .where('employeeId').equals(e.id!)
          .filter(entry => !entry.isPaid)
          .toArray();
        const debt = unpaid.reduce((acc, entry) => acc + entry.amountCents, 0);
        return { ...e, debt } as EmployeeWithDebt;
      }));
      
      // Sort: Pinned first, then by name
      return results.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return a.name.localeCompare(b.name);
      });
    },
    [searchTerm]
  );

  const totalDebt = useLiveQuery(
    async () => {
      const unpaidEntries = await db.workEntries.where('isPaid').equals(0).toArray();
      return unpaidEntries.reduce((acc, entry) => acc + entry.amountCents, 0);
    },
    []
  );

  const handleQuickAdd = async (e: React.MouseEvent, employee: EmployeeWithDebt) => {
    e.stopPropagation();
    if (!employee.id) return;

    const entryId = await db.workEntries.add({
      employeeId: employee.id,
      dateIso: new Date().toISOString().split('T')[0],
      amountCents: employee.defaultAmountCents,
      isPaid: 0,
      note: 'Lançamento Rápido',
      createdAt: Date.now()
    });

    showUndo({
      label: `Lançamento para ${employee.name}`,
      onUndo: async () => {
        await db.workEntries.delete(entryId as number);
      }
    });

    setShowQuickSuccess(employee.name);
    setTimeout(() => setShowQuickSuccess(null), 2000);
  };

  const handleTogglePin = async (e: React.MouseEvent, employee: EmployeeWithDebt) => {
    e.stopPropagation();
    if (!employee.id) return;
    const previousPinned = employee.isPinned;
    await db.employees.update(employee.id, { isPinned: previousPinned ? 0 : 1 });

    showUndo({
      label: previousPinned ? 'Funcionário desfixado' : 'Funcionário fixado',
      onUndo: async () => {
        await db.employees.update(employee.id!, { isPinned: previousPinned });
      }
    });
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatPhone(value);
    setNewPhone(formatted);
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    const employeeData = {
      name: newName,
      phone: newPhone,
      defaultAmountCents: Math.round(parseFloat(newAmount) * 100) || 0,
      createdAt: Date.now(),
      isPinned: 0
    };

    const id = await db.employees.add(employeeData);

    showUndo({
      label: `Funcionário ${newName} adicionado`,
      onUndo: async () => {
        await db.employees.delete(id as number);
      }
    });

    setNewName('');
    setNewPhone('');
    setNewAmount('0');
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col">
      <div className="p-4 space-y-4 sticky top-0 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Caderneta</h1>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar funcionário..."
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-2xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 opacity-70">Total em Aberto (Geral)</p>
          <p className="text-3xl font-black text-red-600 dark:text-red-400">
            {formatCurrency(totalDebt || 0)}
          </p>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all"
        >
          <UserPlus className="w-6 h-6" />
          <span>Novo Funcionário</span>
        </button>
      </div>

      <div className="px-4 pb-32 space-y-3">
        {employees === undefined ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
          ))
        ) : employees.length > 0 ? (
          employees.map((employee) => {
            const isHighDebt = employee.debt >= DEBT_THRESHOLD;
            return (
              <motion.div
                key={employee.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => employee.id && onSelectEmployee(employee.id)}
                className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all relative overflow-hidden ${
                  isHighDebt 
                    ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 shadow-lg shadow-red-500/10' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
              {isHighDebt && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ 
                    opacity: 1, 
                    x: 0,
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    scale: {
                      repeat: Infinity,
                      duration: 2,
                      ease: "easeInOut"
                    }
                  }}
                  className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-widest z-10 flex items-center gap-1"
                >
                  <AlertTriangle className="w-2 h-2" />
                  Limite Excedido
                </motion.div>
              )}
              
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    isHighDebt 
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' 
                      : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    <UserCircle2 className="w-6 h-6" />
                  </div>
                  {employee.isPinned === 1 && (
                    <div className="absolute -top-1 -right-1 bg-amber-400 text-white p-1 rounded-full shadow-sm border-2 border-white dark:border-slate-900">
                      <Pin className="w-2 h-2 fill-current" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold text-lg ${isHighDebt ? 'text-red-900 dark:text-red-100' : ''}`}>{employee.name}</h3>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-slate-500 text-xs flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {employee.phone || 'Sem telefone'}
                    </p>
                    <p className={`text-xs font-bold ${isHighDebt ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                      Dívida: {formatCurrency(employee.debt)}
                    </p>
                    {isHighDebt && (
                      <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-tighter animate-pulse">
                        ⚠️ Atenção: Dívida Elevada!
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleTogglePin(e, employee)}
                  className={`p-2 rounded-xl transition-all active:scale-90 ${
                    employee.isPinned 
                      ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' 
                      : 'text-slate-300 hover:text-slate-400'
                  }`}
                >
                  {employee.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                </button>
                <button
                  onClick={(e) => handleQuickAdd(e, employee)}
                  className={`flex flex-col items-center justify-center px-4 py-2 rounded-2xl active:scale-90 transition-all shadow-md group overflow-hidden relative ${
                    isHighDebt 
                      ? 'bg-red-600 text-white shadow-red-600/20' 
                      : 'bg-emerald-600 text-white shadow-emerald-600/20'
                  }`}
                  title="Lançamento Rápido"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <span className="text-[9px] font-black uppercase tracking-tighter leading-none mb-1 opacity-80">Lançar</span>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 fill-current" />
                    <span className="font-bold text-sm whitespace-nowrap">{formatCurrency(employee.defaultAmountCents)}</span>
                  </div>
                </button>
                <ChevronRight className={isHighDebt ? 'text-red-300' : 'text-slate-300'} />
              </div>
            </motion.div>
          );
        })
      ) : (
        <div className="text-center py-12 space-y-4">
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-300">
            <UserCircle2 className="w-10 h-10" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-slate-400">Nenhum funcionário encontrado</p>
            <p className="text-xs text-slate-500">Toque no botão acima para adicionar.</p>
          </div>
        </div>
      )}

        <AnimatePresence>
          {showQuickSuccess && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-xl font-bold z-50 whitespace-nowrap"
            >
              Lançamento feito para {showQuickSuccess}!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Novo Funcionário</h2>
                <button onClick={() => setIsAdding(false)} className="text-slate-400 p-2">
                  <Plus className="w-8 h-8 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddEmployee} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Nome</label>
                  <input
                    autoFocus
                    required
                    type="text"
                    maxLength={50}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Telefone</label>
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={newPhone}
                    onChange={handlePhoneChange}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Valor Padrão (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                >
                  Salvar Funcionário
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

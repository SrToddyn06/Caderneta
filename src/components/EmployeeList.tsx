import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Plus, Search, User, Phone, ChevronRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../lib/utils';

interface EmployeeListProps {
  onSelectEmployee: (id: number) => void;
}

export function EmployeeList({ onSelectEmployee }: EmployeeListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAmount, setNewAmount] = useState('0');
  const [showQuickSuccess, setShowQuickSuccess] = useState<string | null>(null);

  const employees = useLiveQuery(
    () => db.employees
      .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .toArray(),
    [searchTerm]
  );

  const totalDebt = useLiveQuery(
    async () => {
      const unpaidEntries = await db.workEntries.where('isPaid').equals(0).toArray();
      return unpaidEntries.reduce((acc, entry) => acc + entry.amountCents, 0);
    },
    []
  );

  const handleQuickAdd = async (e: React.MouseEvent, employee: any) => {
    e.stopPropagation();
    if (!employee.id) return;

    await db.workEntries.add({
      employeeId: employee.id,
      dateIso: new Date().toISOString().split('T')[0],
      amountCents: employee.defaultAmountCents,
      isPaid: 0,
      note: 'Lançamento Rápido',
      createdAt: Date.now()
    });

    setShowQuickSuccess(employee.name);
    setTimeout(() => setShowQuickSuccess(null), 2000);
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    await db.employees.add({
      name: newName,
      phone: newPhone,
      defaultAmountCents: Math.round(parseFloat(newAmount) * 100),
      createdAt: Date.now()
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
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Caderneta</h1>
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

        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
        >
          <Plus className="w-6 h-6" />
          Novo Funcionário
        </button>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-2xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 opacity-70">Total em Aberto (Geral)</p>
          <p className="text-3xl font-black text-red-600 dark:text-red-400">
            {formatCurrency(totalDebt || 0)}
          </p>
        </div>
      </div>

      <div className="px-4 pb-32 space-y-3">
        {employees?.map((employee) => (
          <motion.div
            key={employee.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => employee.id && onSelectEmployee(employee.id)}
            className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">{employee.name}</h3>
                <p className="text-slate-500 text-sm flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {employee.phone || 'Sem telefone'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleQuickAdd(e, employee)}
                className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl active:scale-90 transition-all"
                title="Lançamento Rápido"
              >
                <Zap className="w-5 h-5 fill-current" />
              </button>
              <ChevronRight className="text-slate-300" />
            </div>
          </motion.div>
        ))}

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

        {employees?.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <p>Nenhum funcionário encontrado.</p>
          </div>
        )}
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
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Telefone</label>
                  <input
                    type="tel"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
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

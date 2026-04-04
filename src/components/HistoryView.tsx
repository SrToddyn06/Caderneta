import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, Calendar as CalendarIcon, User, Search, Filter } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { motion } from 'motion/react';

export function HistoryView() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');

  const paidEntries = useLiveQuery(
    async () => {
      const entries = await db.workEntries
        .where('isPaid')
        .equals(1)
        .reverse()
        .sortBy('dateIso');

      const employeeIds = [...new Set(entries.map(e => e.employeeId))];
      const employees = await db.employees.where('id').anyOf(employeeIds).toArray();
      const employeeMap = new Map(employees.map(emp => [emp.id, emp.name]));

      return entries
        .map(entry => ({
          ...entry,
          employeeName: employeeMap.get(entry.employeeId) || 'Desconhecido'
        }))
        .filter(entry => {
          const date = entry.dateIso;
          const isWithinRange = date >= startDate && date <= endDate;
          const matchesSearch = 
            entry.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.note.toLowerCase().includes(searchTerm.toLowerCase());
          return isWithinRange && matchesSearch;
        });
    },
    [startDate, endDate, searchTerm]
  );

  const totalPaid = paidEntries?.reduce((acc, e) => acc + e.amountCents, 0) || 0;

  if (paidEntries === undefined) {
    return (
      <div className="p-4 space-y-6 pb-32">
        <header>
          <h1 className="text-3xl font-black tracking-tight">Histórico</h1>
          <p className="text-slate-500 font-bold">Carregando...</p>
        </header>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 safe-top space-y-6 pb-32 flex flex-col">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Histórico</h1>
        <p className="text-slate-500 font-bold">Pagamentos Realizados</p>
      </header>

      <div className="space-y-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-widest">Filtros de Período</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Início</label>
            <input
              type="date"
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fim</label>
            <input
              type="date"
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="relative pt-2">
          <Search className="absolute left-3 top-[calc(50%+4px)] -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Filtrar por funcionário..."
            className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-emerald-600 p-4 rounded-2xl shadow-lg shadow-emerald-600/20 text-white">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Pago no Período</p>
        <p className="text-3xl font-black">{formatCurrency(totalPaid)}</p>
      </div>

      <div className="space-y-3">
        {paidEntries?.map((entry) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">{entry.employeeName}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" /> {format(parseISO(entry.dateIso), 'dd/MM/yyyy')}
                  </p>
                  {entry.note && (
                    <p className="text-xs text-slate-400 italic truncate max-w-[120px]">
                      {entry.note}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(entry.amountCents)}
              </p>
              <p className="text-[10px] font-black text-emerald-500/50 uppercase">Pago</p>
            </div>
          </motion.div>
        ))}

        {paidEntries?.length === 0 && (
          <div className="text-center py-12 space-y-4">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-300">
              <History className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-slate-400">Nenhum pagamento encontrado</p>
              <p className="text-xs text-slate-500">Tente ajustar os filtros ou a busca.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Circle, User, Calendar as CalendarIcon, Wallet } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const entries = useLiveQuery(
    () => db.workEntries
      .where('dateIso')
      .between(format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd'), true, true)
      .toArray(),
    [currentMonth]
  );

  const selectedDayEntries = useLiveQuery(
    async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const dayEntries = await db.workEntries.where('dateIso').equals(dateStr).toArray();
      
      if (dayEntries.length === 0) return [];

      const employeeIds = [...new Set(dayEntries.map(e => e.employeeId))];
      const employees = await db.employees.where('id').anyOf(employeeIds).toArray();
      const employeeMap = new Map(employees.map(emp => [emp.id, emp.name]));

      return dayEntries.map(entry => ({
        ...entry,
        employeeName: employeeMap.get(entry.employeeId) || 'Desconhecido'
      }));
    },
    [selectedDate]
  );

  const pendingByEmployee = useLiveQuery(
    async () => {
      const unpaid = entries?.filter(e => !e.isPaid) || [];
      if (unpaid.length === 0) return [];

      const employeeIds = [...new Set(unpaid.map(e => e.employeeId))];
      const employees = await db.employees.where('id').anyOf(employeeIds).toArray();
      
      const employeeMap = new Map(employees.map(emp => [emp.id, emp.name]));

      const grouped = unpaid.reduce((acc, entry) => {
        const name = employeeMap.get(entry.employeeId) || 'Desconhecido';
        acc[name] = (acc[name] || 0) + entry.amountCents;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(grouped).map(([name, amount]) => ({ name, amount }));
    },
    [entries]
  );

  const getDayStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayEntries = entries?.filter(e => e.dateIso === dateStr);
    
    if (!dayEntries || dayEntries.length === 0) return null;
    
    const hasUnpaid = dayEntries.some(e => !e.isPaid);
    return hasUnpaid ? 'unpaid' : 'paid';
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const totalDayAmount = selectedDayEntries?.reduce((acc, e) => acc + e.amountCents, 0) || 0;

  return (
    <div className="p-4 safe-top space-y-6 pb-32 flex flex-col">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight capitalize">
            {format(currentMonth, 'MMMM', { locale: ptBR })}
          </h1>
          <p className="text-slate-500 font-bold">{format(currentMonth, 'yyyy')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-active active:scale-95">
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <button onClick={nextMonth} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-active active:scale-95">
            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </header>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-7 gap-1">
          {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((day, i) => (
            <div key={i} className="text-center text-[10px] font-black text-slate-400 py-2 uppercase tracking-tighter">
              {day}
            </div>
          ))}
          
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {days.map((day, i) => {
            const status = getDayStatus(day);
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDate);
            
            return (
              <button 
                key={i} 
                onClick={() => setSelectedDate(day)}
                className={`aspect-square flex flex-col items-center justify-center rounded-xl border transition-all relative ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-600 text-white z-10 scale-105 shadow-lg shadow-emerald-600/20'
                    : isToday 
                    ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900/30' 
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span className={`text-base font-black ${isSelected ? 'text-white' : isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {format(day, 'd')}
                </span>
                {!isSelected && status && (
                  <div className={`w-1.5 h-1.5 rounded-full absolute bottom-1.5 ${status === 'unpaid' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight">
            {isSameDay(selectedDate, new Date()) ? 'Hoje' : format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
          </h2>
          <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
              {formatCurrency(totalDayAmount)}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h2 className="text-xl font-bold">
              {isSameDay(selectedDate, new Date()) ? 'Hoje' : format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </h2>
            {selectedDayEntries && selectedDayEntries.length > 0 && (
              <p className="text-emerald-600 dark:text-emerald-400 font-black">
                Total: {formatCurrency(totalDayAmount)}
              </p>
            )}
          </div>
          
          <AnimatePresence mode="wait">
            {selectedDayEntries && selectedDayEntries.length > 0 ? (
              selectedDayEntries.map((entry, idx) => (
                <motion.div
                  key={entry.id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${entry.isPaid ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600'}`}>
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{entry.employeeName}</p>
                      <p className="text-xs text-slate-500">{entry.note || 'Sem observação'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black ${entry.isPaid ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(entry.amountCents)}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-50">
                      {entry.isPaid ? 'Recebido' : 'Pendente'}
                    </p>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-10 bg-slate-100/50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800"
              >
                <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-slate-300">
                  <Wallet className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-400">Nenhum registro p/ este dia</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <h2 className="text-xl font-black tracking-tight">Resumo Mensal</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-600/20 text-white">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Recebido</p>
            <p className="text-2xl font-black">
              {formatCurrency(entries?.filter(e => e.isPaid).reduce((acc, e) => acc + e.amountCents, 0) || 0)}
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Pendente</p>
            <p className="text-2xl font-black text-red-600">
              {formatCurrency(entries?.filter(e => !e.isPaid).reduce((acc, e) => acc + e.amountCents, 0) || 0)}
            </p>
          </div>
        </div>

        {pendingByEmployee && pendingByEmployee.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dívidas por Funcionário</h3>
            <div className="space-y-2">
              {pendingByEmployee.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{item.name}</span>
                  <span className="font-black text-red-600 text-sm">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

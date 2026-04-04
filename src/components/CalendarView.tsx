import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Circle } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

export function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
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
          <button onClick={prevMonth} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <ChevronLeft />
          </button>
          <button onClick={nextMonth} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <ChevronRight />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-2">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
          <div key={i} className="text-center text-xs font-black text-slate-400 py-2">
            {day}
          </div>
        ))}
        
        {/* Empty cells for padding */}
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {days.map((day, i) => {
          const status = getDayStatus(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <div 
              key={i} 
              className={`aspect-square flex flex-col items-center justify-center rounded-2xl border transition-all relative ${
                isToday 
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                  : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'
              }`}
            >
              <span className={`text-lg font-bold ${isToday ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                {format(day, 'd')}
              </span>
              {status && (
                <div className={`w-2 h-2 rounded-full mt-1 ${status === 'unpaid' ? 'bg-red-500' : 'bg-emerald-500'}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        <h2 className="text-xl font-bold mt-4">Resumo do Mês</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-500 uppercase">Total Pago</p>
            <p className="text-xl font-black text-emerald-600">
              {formatCurrency(entries?.filter(e => e.isPaid).reduce((acc, e) => acc + e.amountCents, 0) || 0)}
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-500 uppercase">Pendente</p>
            <p className="text-xl font-black text-red-600">
              {formatCurrency(entries?.filter(e => !e.isPaid).reduce((acc, e) => acc + e.amountCents, 0) || 0)}
            </p>
          </div>
        </div>

        {pendingByEmployee && pendingByEmployee.length > 0 && (
          <div className="space-y-3 pt-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Pendentes por Funcionário</h3>
            <div className="space-y-2">
              {pendingByEmployee.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="font-bold">{item.name}</span>
                  <span className="font-black text-red-600">{formatCurrency(item.amount) }</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

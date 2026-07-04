import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, User, Wallet } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { usePaymentLogs } from '../lib/paymentDatabase';

export function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const [paymentLogs] = usePaymentLogs();
  
  // Use indexed employees query for mapping IDs to names reactively
  const employees = useLiveQuery(() => db.employees.toArray(), []) || [];
  const employeeMap = useMemo(() => new Map(employees.map(emp => [String(emp.id), emp.name])), [employees]);

  // Filter local logs for the selected month Reactively in real-time
  const monthStr = format(currentMonth, 'yyyy-MM');
  const monthEntries = useMemo(() => {
    return paymentLogs.filter(log => log.date.startsWith(monthStr));
  }, [paymentLogs, monthStr]);

  // Cumulative unpaid entries up to the end of the selected month
  const cumulativeUnpaidEntries = useMemo(() => {
    const endOfMonthStr = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    return paymentLogs.filter(e => !e.isPaid && e.type !== 'pagamento' && e.date <= endOfMonthStr);
  }, [paymentLogs, currentMonth]);

  const totalPendingAmount = useMemo(() => {
    return cumulativeUnpaidEntries.reduce((acc, e) => acc + Math.round(e.value * 100), 0);
  }, [cumulativeUnpaidEntries]);

  // Filter logs for the selected day Reactively in real-time
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedDayEntries = useMemo(() => {
    return paymentLogs
      .filter(log => log.date === dateStr)
      .map(log => ({
        ...log,
        amountCents: Math.round(log.value * 100), // convert back to cents for existing currency helper expectations
        employeeName: employeeMap.get(String(log.employeeId)) || 'Desconhecido'
      }));
  }, [paymentLogs, dateStr, employeeMap]);

  // Map pending debt per employee (cumulative up to the end of selected month)
  const pendingByEmployee = useMemo(() => {
    if (cumulativeUnpaidEntries.length === 0) return [];

    const grouped = cumulativeUnpaidEntries.reduce((acc, entry) => {
      const name = employeeMap.get(String(entry.employeeId)) || 'Desconhecido';
      acc[name] = (acc[name] || 0) + Math.round(entry.value * 100);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([name, amount]) => ({ name, amount }));
  }, [cumulativeUnpaidEntries, employeeMap]);

  const getDayStatus = (date: Date) => {
    const dStr = format(date, 'yyyy-MM-dd');
    const dayEntries = paymentLogs.filter(e => e.date === dStr);
    
    if (dayEntries.length === 0) return null;
    
    const hasUnpaid = dayEntries.some(e => !e.isPaid);
    return hasUnpaid ? 'unpaid' : 'paid';
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const totalDayAmount = selectedDayEntries.reduce((acc, e) => acc + e.amountCents, 0);

  return (
    <div className="p-4 safe-top space-y-6 pb-32 flex flex-col">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight capitalize font-sans text-gray-900 dark:text-white">
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
          <AnimatePresence mode="wait">
            {selectedDayEntries && selectedDayEntries.length > 0 ? (
              selectedDayEntries.map((entry, idx) => {
                const isPayment = entry.type === 'pagamento';
                return (
                  <motion.div
                    key={entry.id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm transition-all ${
                      isPayment 
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isPayment 
                          ? 'bg-emerald-500 text-white' 
                          : entry.isPaid 
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' 
                            : 'bg-red-50 dark:bg-red-900/20 text-red-600'
                      }`}>
                        {isPayment ? <Wallet className="w-5 h-5" /> : <User className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{entry.employeeName}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          {entry.note || 'Sem observação'}
                          {isPayment && (
                            <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-300 ml-1 bg-emerald-100 dark:bg-emerald-900/40 px-1 py-0.5 rounded uppercase tracking-wider">
                              PAGAMENTO
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-black ${isPayment || entry.isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
                        {isPayment ? '+' : ''}{formatCurrency(entry.amountCents)}
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-50">
                        {isPayment ? 'Recebido' : entry.isPaid ? 'Recebido' : 'Pendente'}
                      </p>
                    </div>
                  </motion.div>
                );
              })
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
              {formatCurrency(monthEntries.filter(e => e.type === 'pagamento').reduce((acc, e) => acc + Math.round(e.value * 100), 0))}
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Pendente</p>
            <p className="text-2xl font-black text-red-600">
              {formatCurrency(totalPendingAmount)}
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

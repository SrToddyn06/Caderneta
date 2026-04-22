import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, isSameDay, parseISO, startOfYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, Users, Wallet, Calendar, ArrowUpRight, ArrowDownRight, Award } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { motion } from 'motion/react';

export function StatsView() {
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const stats = useLiveQuery(
    async () => {
      // Use indexed queries for better performance with large datasets
      const currentMonthStr = {
        start: format(currentMonthStart, 'yyyy-MM-dd'),
        end: format(currentMonthEnd, 'yyyy-MM-dd')
      };
      const lastMonthStr = {
        start: format(lastMonthStart, 'yyyy-MM-dd'),
        end: format(lastMonthEnd, 'yyyy-MM-dd')
      };

      const [currentMonthEntries, lastMonthEntries, allEmployees] = await Promise.all([
        db.workEntries.where('dateIso').between(currentMonthStr.start, currentMonthStr.end, true, true).toArray(),
        db.workEntries.where('dateIso').between(lastMonthStr.start, lastMonthStr.end, true, true).toArray(),
        db.employees.toArray()
      ]);

      const currentTotal = currentMonthEntries.filter(e => e.isPaid).reduce((acc, e) => acc + e.amountCents, 0);
      const lastTotal = lastMonthEntries.filter(e => e.isPaid).reduce((acc, e) => acc + e.amountCents, 0);
      
      let growth = 0;
      if (lastTotal > 0) {
        growth = ((currentTotal - lastTotal) / lastTotal) * 100;
      } else if (currentTotal > 0) {
        growth = 100;
      }
      
      // Group by day for the chart
      const daysInMonth = eachDayOfInterval({ start: currentMonthStart, end: currentMonthEnd });
      const chartData = daysInMonth.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayTotal = currentMonthEntries
          .filter(e => e.dateIso === dateStr && e.isPaid)
          .reduce((acc, e) => acc + e.amountCents, 0);
        
        return {
          day: format(day, 'dd'),
          amount: dayTotal / 100,
          fullDate: dateStr
        };
      }).filter(d => d.amount > 0 || parseInt(d.day) % 5 === 0);

      // Top employees (Current Month)
      const employeeStats = allEmployees.map(emp => {
        const empEntries = currentMonthEntries.filter(e => e.employeeId === emp.id && e.isPaid);
        const total = empEntries.reduce((acc, e) => acc + e.amountCents, 0);
        return { name: emp.name, total, count: empEntries.length };
      }).filter(e => e.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

      // Top Debtors (All Time)
      const debtorStats = await Promise.all(allEmployees.map(async emp => {
        const unpaidSub = await db.workEntries.where('employeeId').equals(emp.id!).filter(e => !e.isPaid).toArray();
        const total = unpaidSub.reduce((acc, e) => acc + e.amountCents, 0);
        return { name: emp.name, total };
      }));
      const topDebtors = debtorStats.filter(e => e.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

      return {
        currentTotal,
        lastTotal,
        growth,
        chartData,
        employeeStats,
        topDebtors,
        activeEmployees: allEmployees.length,
        totalEntries: currentMonthEntries.length
      };
    },
    []
  );

  if (!stats) return null;

  const getManagementTip = () => {
    if (stats.topDebtors.length > 0 && stats.currentTotal > 0) {
      const debtRatio = (stats.topDebtors.reduce((acc, d) => acc + d.total, 0) / stats.currentTotal);
      if (debtRatio > 0.3) return "Atenção: Suas dívidas pendentes estão altas em relação ao faturamento. Considere cobrar os acertos com mais frequência.";
    }
    
    if (stats.growth > 20) return "Excelente! Seu faturamento cresceu mais de 20%. Que tal reinvestir em novos equipamentos?";
    if (stats.growth < 0 && stats.lastTotal > 0) return "Este mês está abaixo do anterior. Analise quais dias foram mais fracos para entender o motivo.";
    
    const tips = [
      "Lançamentos rápidos diários evitam esquecimentos e erros no acerto final.",
      "Acompanhe o crescimento mensal para identificar os melhores meses do ano.",
      "Elogie seus melhores funcionários; eles são o motor do seu crescimento.",
      "Manter o faturamento organizado é o primeiro passo para o sucesso financeiro.",
      "Dica: Utilize a agenda para prever seus ganhos das próximas semanas."
    ];
    
    // Simple pseudo-random based on current month/total to avoid rotation on every click
    const tipIndex = (now.getMonth() + Math.floor(stats.currentTotal / 100)) % tips.length;
    return tips[tipIndex];
  };

  const managementTip = getManagementTip();

  return (
    <div className="p-4 safe-top space-y-6 pb-32 flex flex-col">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Estatísticas</h1>
        <p className="text-slate-500 font-bold">Desempenho Financeiro</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-emerald-600 rounded-3xl shadow-lg shadow-emerald-600/20 text-white col-span-2 relative overflow-hidden"
        >
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Receita Mensal (Paga)</p>
            <p className="text-4xl font-black">{formatCurrency(stats.currentTotal)}</p>
            <div className="mt-2 flex items-center gap-1">
              {stats.growth >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-emerald-300" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-300" />
              )}
              <span className="text-xs font-bold">
                {Math.abs(stats.growth).toFixed(1)}% em relação ao mês passado
              </span>
            </div>
          </div>
          <TrendingUp className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
        </motion.div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 mb-2">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">Equipe</p>
            <p className="text-xl font-black">{stats.activeEmployees}</p>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 mb-2">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">Registros</p>
            <p className="text-xl font-black">{stats.totalEntries}</p>
          </div>
        </div>
      </div>

      <section className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
          <Wallet className="w-4 h-4" /> Faturamento Diário
        </h2>
        <div className="h-64 w-full min-h-[256px] relative">
          <ResponsiveContainer width="100%" height="100%" debounce={100}>
            <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.2} />
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94A3B8' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94A3B8' }}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-3 rounded-2xl shadow-2xl text-xs font-bold border border-white/10 dark:border-slate-200">
                        <p className="opacity-70 mb-1">Dia {payload[0].payload.day}</p>
                        <p className="text-xl">{formatCurrency((payload[0].value as number) * 100)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {stats.chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.fullDate === format(now, 'yyyy-MM-dd') ? '#10b981' : '#3b82f6'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-500" /> Melhores do Mês (Ganhos)
        </h2>
        <div className="space-y-2">
          {stats.employeeStats.map((emp, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                   i === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'
                 }`}>
                  {i + 1}º
                </div>
                <div>
                  <p className="font-bold">{emp.name}</p>
                  <p className="text-[10px] text-slate-500">{emp.count} lançamentos pagos</p>
                </div>
              </div>
              <p className="font-black text-emerald-600">{formatCurrency(emp.total)}</p>
            </div>
          ))}
          {stats.employeeStats.length === 0 && (
            <p className="text-center py-4 text-xs text-slate-400 font-bold italic">Ainda não há dados suficientes.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-red-500" /> Maiores Dívidas (Total)
        </h2>
        <div className="space-y-2">
          {stats.topDebtors.map((emp, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                   i === 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                 }`}>
                  {i + 1}º
                </div>
                <div>
                  <p className="font-bold">{emp.name}</p>
                </div>
              </div>
              <p className="font-black text-red-600">{formatCurrency(emp.total)}</p>
            </div>
          ))}
          {stats.topDebtors.length === 0 && (
            <p className="text-center py-4 text-xs text-slate-400 font-bold italic">Nenhuma dívida pendente.</p>
          )}
        </div>
      </section>

      <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2.5rem] text-center border border-dashed border-slate-200 dark:border-slate-800">
        <p className="text-xs font-black text-slate-400 uppercase mb-1">Dica de Gestão</p>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 italic">
          "{managementTip}"
        </p>
      </div>
    </div>
  );
}

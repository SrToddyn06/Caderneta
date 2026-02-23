import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type WorkEntry } from '../db';
import { ArrowLeft, Trash2, CheckCircle2, Plus, Calendar as CalendarIcon, FileText, MoreVertical, MessageSquare, UserCog } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../lib/utils';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EmployeeDetailProps {
  employeeId: number;
  onBack: () => void;
}

export function EmployeeDetail({ employeeId, onBack }: EmployeeDetailProps) {
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Custom Modal States
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'success' | 'info';
  } | null>(null);

  const [partialPaymentModal, setPartialPaymentModal] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAmount, setEditAmount] = useState('');

  const employee = useLiveQuery(() => db.employees.get(employeeId), [employeeId]);
  const entries = useLiveQuery(
    () => db.workEntries.where('employeeId').equals(employeeId).reverse().sortBy('dateIso'),
    [employeeId]
  );

  const unpaidTotal = entries?.reduce((acc, entry) => acc + (entry.isPaid ? 0 : entry.amountCents), 0) || 0;

  const handleShareWhatsApp = () => {
    if (!employee) return;
    const message = `Olá ${employee.name}, aqui está o resumo da sua caderneta:\n\nSaldo Pendente: ${formatCurrency(unpaidTotal)}\n\nObrigado!`;
    const encoded = encodeURIComponent(message);
    const phone = employee.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
  };

  const startEditing = () => {
    if (!employee) return;
    setEditName(employee.name);
    setEditPhone(employee.phone || '');
    setEditAmount((employee.defaultAmountCents / 100).toString());
    setIsEditingProfile(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.employees.update(employeeId, {
      name: editName,
      phone: editPhone,
      defaultAmountCents: Math.round(parseFloat(editAmount) * 100)
    });
    setIsEditingProfile(false);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryAmount) return;

    await db.workEntries.add({
      employeeId,
      amountCents: Math.round(parseFloat(entryAmount) * 100),
      dateIso: entryDate,
      note: entryNote,
      isPaid: 0,
      createdAt: Date.now()
    });

    setEntryAmount('');
    setEntryNote('');
    setIsAddingEntry(false);
  };

  const handleMarkAllPaid = async () => {
    setConfirmModal({
      title: 'Marcar tudo como pago',
      message: 'Deseja marcar todos os lançamentos pendentes como pagos?',
      type: 'success',
      onConfirm: async () => {
        await db.workEntries.where('employeeId').equals(employeeId).modify({ isPaid: 1 });
        setConfirmModal(null);
      }
    });
  };

  const handlePartialPayment = async () => {
    setPartialAmount('');
    setPartialPaymentModal(true);
  };

  const executePartialPayment = async () => {
    let amountToAbate = Math.round(parseFloat(partialAmount) * 100);
    if (isNaN(amountToAbate) || amountToAbate <= 0) return;

    const unpaidEntries = await db.workEntries
      .where('employeeId')
      .equals(employeeId)
      .filter(e => !e.isPaid)
      .sortBy('dateIso');

    for (const entry of unpaidEntries) {
      if (amountToAbate <= 0) break;
      if (!entry.id) continue;

      if (amountToAbate >= entry.amountCents) {
        amountToAbate -= entry.amountCents;
        await db.workEntries.update(entry.id, { isPaid: 1 });
      } else {
        const remaining = entry.amountCents - amountToAbate;
        await db.workEntries.update(entry.id, { amountCents: amountToAbate, isPaid: 1 });
        await db.workEntries.add({
          employeeId,
          amountCents: remaining,
          dateIso: entry.dateIso,
          note: `${entry.note} (Restante de pagamento parcial)`,
          isPaid: 0,
          createdAt: Date.now()
        });
        amountToAbate = 0;
      }
    }
    setPartialPaymentModal(false);
  };

  const handleDeleteEmployee = async () => {
    setConfirmModal({
      title: 'Excluir Funcionário',
      message: 'Tem certeza que deseja excluir este funcionário e todos os seus registros? Esta ação não pode ser desfeita.',
      type: 'danger',
      onConfirm: async () => {
        await db.workEntries.where('employeeId').equals(employeeId).delete();
        await db.employees.delete(employeeId);
        setConfirmModal(null);
        onBack();
      }
    });
  };

  const togglePaid = async (entry: WorkEntry) => {
    if (!entry.id) return;
    await db.workEntries.update(entry.id, { isPaid: entry.isPaid ? 0 : 1 });
  };

  const deleteEntry = async (id: number) => {
    setConfirmModal({
      title: 'Excluir Lançamento',
      message: 'Deseja excluir este lançamento permanentemente?',
      type: 'danger',
      onConfirm: async () => {
        await db.workEntries.delete(id);
        setConfirmModal(null);
      }
    });
  };

  if (!employee) return null;

  return (
    <div className="flex flex-col bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-600 dark:text-slate-400">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex gap-2">
            {employee.phone && (
              <button onClick={handleShareWhatsApp} className="p-2 text-emerald-600 dark:text-emerald-400">
                <MessageSquare className="w-6 h-6" />
              </button>
            )}
            <button onClick={startEditing} className="p-2 text-slate-600 dark:text-slate-400">
              <UserCog className="w-6 h-6" />
            </button>
            <button onClick={handleDeleteEmployee} className="p-2 text-red-500">
              <Trash2 className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight">{employee.name}</h1>
          <p className="text-slate-500 font-medium">{employee.phone}</p>
        </div>

        <div className={unpaidTotal > 0 ? "mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl" : "mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl"}>
          <p className="text-sm font-bold uppercase tracking-widest opacity-60">Saldo Pendente</p>
          <p className={unpaidTotal > 0 ? "text-4xl font-black text-red-600 dark:text-red-400" : "text-4xl font-black text-emerald-600 dark:text-emerald-400"}>
            {formatCurrency(unpaidTotal)}
          </p>
          {unpaidTotal > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button 
                onClick={handleMarkAllPaid}
                className="bg-red-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all text-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                Tudo Pago
              </button>
              <button 
                onClick={handlePartialPayment}
                className="bg-amber-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                Parcial
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="p-4 space-y-4 pb-32">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Lançamentos</h2>
          <button 
            onClick={() => {
              setEntryAmount((employee.defaultAmountCents / 100).toString());
              setIsAddingEntry(true);
            }}
            className="bg-emerald-600 text-white p-2 rounded-full shadow-lg"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-3">
          {entries?.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                entry.isPaid 
                  ? 'bg-slate-100 dark:bg-slate-900/50 border-transparent opacity-60' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => togglePaid(entry)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    entry.isPaid 
                      ? 'bg-emerald-500 border-emerald-500 text-white' 
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {entry.isPaid && <CheckCircle2 className="w-5 h-5" />}
                </button>
                <div>
                  <p className="font-bold text-lg">{formatCurrency(entry.amountCents)}</p>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" /> {format(parseISO(entry.dateIso), 'dd/MM/yyyy')}
                  </p>
                  {entry.note && (
                    <p className="text-sm text-slate-400 italic flex items-center gap-1 mt-1">
                      <FileText className="w-3 h-3" /> {entry.note}
                    </p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => entry.id && deleteEntry(entry.id)}
                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
          
          {entries?.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p>Nenhum lançamento registrado.</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isAddingEntry && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Novo Lançamento</h2>
                <button onClick={() => setIsAddingEntry(false)} className="text-slate-400 p-2">
                  <Plus className="w-8 h-8 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddEntry} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Valor (R$)</label>
                  <input
                    autoFocus
                    required
                    type="number"
                    step="0.01"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-2xl font-bold"
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Data</label>
                  <input
                    type="date"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Observação (Opcional)</label>
                  <input
                    type="text"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={entryNote}
                    onChange={(e) => setEntryNote(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                >
                  Confirmar Lançamento
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {confirmModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-3xl p-6 space-y-4 shadow-2xl text-center"
            >
              <h3 className="text-xl font-bold">{confirmModal.title}</h3>
              <p className="text-slate-500">{confirmModal.message}</p>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={confirmModal.onConfirm}
                  className={`w-full py-3 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-all ${
                    confirmModal.type === 'danger' ? 'bg-red-600 shadow-red-600/20' : 'bg-emerald-600 shadow-emerald-600/20'
                  }`}
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setConfirmModal(null)}
                  className="w-full py-3 rounded-xl font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 active:scale-95 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {partialPaymentModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-3xl p-6 space-y-4 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-center">Pagamento Parcial</h3>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Valor Pago (R$)</label>
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xl font-bold"
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={executePartialPayment}
                  className="w-full py-3 rounded-xl font-bold text-white bg-amber-500 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  Processar Pagamento
                </button>
                <button
                  onClick={() => setPartialPaymentModal(false)}
                  className="w-full py-3 rounded-xl font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 active:scale-95 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isEditingProfile && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Editar Perfil</h2>
                <button onClick={() => setIsEditingProfile(false)} className="text-slate-400 p-2">
                  <Plus className="w-8 h-8 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Nome</label>
                  <input
                    required
                    type="text"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Telefone</label>
                  <input
                    type="tel"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Valor Padrão (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                >
                  Salvar Alterações
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

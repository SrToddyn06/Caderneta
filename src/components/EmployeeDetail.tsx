import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type WorkEntry } from '../db';
import { useSettings } from '../contexts/SettingsContext';
import { useUndo } from '../contexts/UndoContext';
import { ArrowLeft, Trash2, CheckCircle2, Plus, Calendar as CalendarIcon, FileText, MoreVertical, MessageSquare, UserCog, ReceiptText, Copy, Share2, MessageCircle, Send, Pin, PinOff, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../lib/utils';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EmployeeDetailProps {
  employeeId: number;
  onBack: () => void;
}

export function EmployeeDetail({ employeeId, onBack }: EmployeeDetailProps) {
  const { showUndo } = useUndo();
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

  const [receiptModal, setReceiptModal] = useState<{
    employeeName: string;
    amount: number;
    date: string;
    note?: string;
  } | null>(null);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAmount, setEditAmount] = useState('');

  const [editingEntry, setEditingEntry] = useState<WorkEntry | null>(null);
  const [editEntryAmount, setEditEntryAmount] = useState('');
  const [editEntryNote, setEditEntryNote] = useState('');
  const [editEntryDate, setEditEntryDate] = useState('');

  // Close modals on back button
  useEffect(() => {
    const handleClose = () => {
      setIsAddingEntry(false);
      setConfirmModal(null);
      setPartialPaymentModal(false);
      setIsEditingProfile(false);
      setEditingEntry(null);
      setReceiptModal(null);
    };
    window.addEventListener('close-modals', handleClose);
    return () => window.removeEventListener('close-modals', handleClose);
  }, []);

  const employee = useLiveQuery(() => db.employees.get(employeeId), [employeeId]);
  const entries = useLiveQuery(
    async () => {
      const results = await db.workEntries.where('employeeId').equals(employeeId).toArray();
      return results.sort((a, b) => b.dateIso.localeCompare(a.dateIso) || (b.id || 0) - (a.id || 0));
    },
    [employeeId]
  );

  const unpaidTotal = entries?.reduce((acc, entry) => acc + (entry.isPaid ? 0 : entry.amountCents), 0) || 0;

  const handleTogglePin = async () => {
    if (!employee) return;
    const previousPinned = employee.isPinned;
    await db.employees.update(employeeId, { isPinned: previousPinned ? 0 : 1 });

    showUndo({
      label: previousPinned ? 'Funcionário desfixado' : 'Funcionário fixado',
      onUndo: async () => {
        await db.employees.update(employeeId, { isPinned: previousPinned });
      }
    });
  };

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

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    const value = e.target.value;
    const formatted = formatPhone(value);
    setter(formatted);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    // Check for duplicate name (excluding current employee)
    const existing = await db.employees
      .where('name')
      .equals(editName)
      .filter(emp => emp.id !== employeeId)
      .first();
    
    if (existing) {
      alert('Já existe outro funcionário com este nome!');
      return;
    }

    const amount = Math.abs(parseFloat(editAmount) || 0);

    await db.employees.update(employeeId, {
      name: editName.trim(),
      phone: editPhone,
      defaultAmountCents: Math.round(amount * 100)
    });
    setIsEditingProfile(false);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryAmount) return;

    const amount = Math.abs(parseFloat(entryAmount) || 0);

    const entryId = await db.workEntries.add({
      employeeId,
      amountCents: Math.round(amount * 100),
      dateIso: entryDate,
      note: entryNote,
      isPaid: 0,
      createdAt: Date.now()
    });

    showUndo({
      label: 'Lançamento adicionado',
      onUndo: async () => {
        await db.workEntries.delete(entryId as number);
      }
    });

    setEntryAmount('');
    setEntryNote('');
    setIsAddingEntry(false);
  };

  const startEditingEntry = (entry: WorkEntry) => {
    setEditingEntry(entry);
    setEditEntryAmount((entry.amountCents / 100).toString());
    setEditEntryNote(entry.note);
    setEditEntryDate(entry.dateIso);
  };

  const handleUpdateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry?.id) return;

    const previousData = { ...editingEntry };
    const amount = Math.abs(parseFloat(editEntryAmount) || 0);
    const newData = {
      amountCents: Math.round(amount * 100),
      note: editEntryNote,
      dateIso: editEntryDate
    };

    await db.workEntries.update(editingEntry.id, newData);
    
    showUndo({
      label: 'Lançamento atualizado',
      onUndo: async () => {
        await db.workEntries.update(editingEntry.id!, previousData);
      }
    });

    setEditingEntry(null);
  };

  const handleMarkAllPaid = async () => {
    const totalToPay = unpaidTotal;
    const unpaidEntriesBefore = entries?.filter(e => !e.isPaid) || [];
    
    setConfirmModal({
      title: 'Marcar tudo como pago',
      message: `Deseja marcar todos os lançamentos pendentes (${formatCurrency(totalToPay)}) como pagos?`,
      type: 'success',
      onConfirm: async () => {
        const entryIds = unpaidEntriesBefore.map(e => e.id).filter((id): id is number => id !== undefined);
        await db.workEntries.where('id').anyOf(entryIds).modify({ isPaid: 1 });
        
        showUndo({
          label: 'Pagamento total realizado',
          onUndo: async () => {
            await db.workEntries.where('id').anyOf(entryIds).modify({ isPaid: 0 });
          }
        });

        setConfirmModal(null);
        if (employee) {
          setReceiptModal({
            employeeName: employee.name,
            amount: totalToPay,
            date: format(new Date(), 'yyyy-MM-dd'),
            note: 'Pagamento total de débitos'
          });
        }
      }
    });
  };

  const handlePartialPayment = async () => {
    setPartialAmount('');
    setPartialPaymentModal(true);
  };

  const executePartialPayment = async () => {
    let amountToAbate = Math.abs(Math.round(parseFloat(partialAmount) * 100));
    
    // Safety: prevent overpayment (brute force protection)
    if (amountToAbate > unpaidTotal) {
      amountToAbate = unpaidTotal;
    }
    
    const originalAmount = amountToAbate;
    if (isNaN(amountToAbate) || amountToAbate <= 0) return;

    const unpaidEntries = await db.workEntries
      .where('employeeId')
      .equals(employeeId)
      .filter(e => !e.isPaid)
      .sortBy('dateIso');

    const previousEntries = await db.workEntries.where('employeeId').equals(employeeId).toArray();
    const newEntriesCreated: number[] = [];

    await db.transaction('rw', [db.workEntries], async () => {
      for (const entry of unpaidEntries) {
        if (amountToAbate <= 0) break;
        if (!entry.id) continue;

        if (amountToAbate >= entry.amountCents) {
          amountToAbate -= entry.amountCents;
          await db.workEntries.update(entry.id, { isPaid: 1 });
        } else {
          const remaining = entry.amountCents - amountToAbate;
          await db.workEntries.update(entry.id, { amountCents: amountToAbate, isPaid: 1 });
          const newId = await db.workEntries.add({
            employeeId,
            amountCents: remaining,
            dateIso: entry.dateIso,
            note: `${entry.note} (Restante de pagamento parcial)`,
            isPaid: 0,
            createdAt: Date.now()
          });
          newEntriesCreated.push(newId as number);
          amountToAbate = 0;
        }
      }
    });

    showUndo({
      label: 'Pagamento parcial realizado',
      onUndo: async () => {
        // Restore previous state
        for (const oldEntry of previousEntries) {
          if (oldEntry.id) {
            await db.workEntries.put(oldEntry);
          }
        }
        // Delete any new entries created by the partial payment
        if (newEntriesCreated.length > 0) {
          await db.workEntries.bulkDelete(newEntriesCreated);
        }
      }
    });

    setPartialPaymentModal(false);
    if (employee) {
      setReceiptModal({
        employeeName: employee.name,
        amount: originalAmount,
        date: format(new Date(), 'yyyy-MM-dd'),
        note: 'Pagamento Parcial'
      });
    }
  };

  const handleDeleteEmployee = async () => {
    if (!employee) return;
    const employeeData = { ...employee };
    const employeeEntries = entries ? [...entries] : [];

    setConfirmModal({
      title: 'Excluir Funcionário',
      message: 'Tem certeza que deseja excluir este funcionário e todos os seus registros?',
      type: 'danger',
      onConfirm: async () => {
        await db.transaction('rw', [db.workEntries, db.employees], async () => {
          await db.workEntries.where('employeeId').equals(employeeId).delete();
          await db.employees.delete(employeeId);
        });
        
        showUndo({
          label: `Funcionário ${employeeData.name} excluído`,
          onUndo: async () => {
            const newId = await db.employees.add(employeeData);
            if (employeeEntries.length > 0) {
              const entriesToRestore = employeeEntries.map(e => ({ ...e, employeeId: newId as number }));
              await db.workEntries.bulkAdd(entriesToRestore);
            }
          }
        });

        setConfirmModal(null);
        onBack();
      }
    });
  };

  const togglePaid = async (entry: WorkEntry) => {
    if (!entry.id) return;
    const previousState = entry.isPaid;
    await db.workEntries.update(entry.id, { isPaid: previousState ? 0 : 1 });
    
    showUndo({
      label: previousState ? 'Lançamento marcado como pendente' : 'Lançamento marcado como pago',
      onUndo: async () => {
        await db.workEntries.update(entry.id!, { isPaid: previousState });
      }
    });
  };

  const deleteEntry = async (id: number) => {
    const entryToDelete = await db.workEntries.get(id);
    if (!entryToDelete) return;

    setConfirmModal({
      title: 'Excluir Lançamento',
      message: 'Deseja excluir este lançamento?',
      type: 'danger',
      onConfirm: async () => {
        await db.workEntries.delete(id);
        
        showUndo({
          label: 'Lançamento excluído',
          onUndo: async () => {
            await db.workEntries.add(entryToDelete);
          }
        });

        setConfirmModal(null);
      }
    });
  };

  const generateReceiptText = (data: any) => {
    return `📄 *COMPROVANTE DE PAGAMENTO*\n\n` +
           `👤 *Funcionário:* ${data.employeeName}\n` +
           `💰 *Valor:* ${formatCurrency(data.amount)}\n` +
           `📅 *Data:* ${format(parseISO(data.date), 'dd/MM/yyyy')}\n` +
           (data.note ? `📝 *Obs:* ${data.note}\n` : '') +
           `\n✅ Pagamento confirmado!`;
  };

  const handleCopyReceipt = (data: any) => {
    const text = generateReceiptText(data).replace(/\*/g, '');
    navigator.clipboard.writeText(text);
    // Use showUndo for a non-intrusive notification (even if not undoable)
    // Or just a simple state-based toast if we had one.
    // Let's use showUndo with a dummy onUndo to show the message.
    showUndo({
      label: 'Recibo copiado!',
      onUndo: () => {}
    });
  };

  const handleShareReceipt = (data: any) => {
    const text = generateReceiptText(data);
    const encoded = encodeURIComponent(text);
    const phone = employee?.phone.replace(/\D/g, '') || '';
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
  };

  if (!employee) return null;

  return (
    <div className="flex flex-col bg-slate-50 dark:bg-black pb-32">
      <header className="bg-white dark:bg-slate-900 p-4 safe-top border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-600 dark:text-slate-400">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex gap-2">
            <button 
              onClick={handleTogglePin} 
              className={`p-2 transition-all active:scale-90 ${
                employee.isPinned 
                  ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 rounded-xl' 
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {employee.isPinned ? <PinOff className="w-6 h-6" /> : <Pin className="w-6 h-6" />}
            </button>
            {employee.phone && (
              <button onClick={handleShareWhatsApp} className="p-2 text-emerald-600 dark:text-emerald-400 relative group">
                <MessageCircle className="w-7 h-7" />
                <Send className="w-3 h-3 absolute top-1 right-1 bg-white dark:bg-slate-900 rounded-full" />
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
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => startEditingEntry(entry)}
                  className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"
                  title="Editar Lançamento"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {entry.isPaid === 1 && (
                  <button 
                    onClick={() => setReceiptModal({
                      employeeName: employee.name,
                      amount: entry.amountCents,
                      date: entry.dateIso,
                      note: entry.note
                    })}
                    className="p-2 text-emerald-500 hover:text-emerald-600 transition-colors"
                    title="Gerar Recibo"
                  >
                    <ReceiptText className="w-5 h-5" />
                  </button>
                )}
                <button 
                  onClick={() => entry.id && deleteEntry(entry.id)}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl"
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl"
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
                    maxLength={50}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Telefone</label>
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={editPhone}
                    onChange={(e) => handlePhoneChange(e, setEditPhone)}
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

        {editingEntry && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Editar Lançamento</h2>
                <button onClick={() => setEditingEntry(null)} className="text-slate-400 p-2">
                  <Plus className="w-8 h-8 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleUpdateEntry} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Valor (R$)</label>
                  <input
                    autoFocus
                    required
                    type="number"
                    step="0.01"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-2xl font-bold"
                    value={editEntryAmount}
                    onChange={(e) => setEditEntryAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Data</label>
                  <input
                    type="date"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={editEntryDate}
                    onChange={(e) => setEditEntryDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Observação</label>
                  <input
                    type="text"
                    maxLength={100}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={editEntryNote}
                    onChange={(e) => setEditEntryNote(e.target.value)}
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

        {receiptModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-3xl p-6 space-y-4 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                  <ReceiptText className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Recibo Gerado</h3>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 font-mono text-[10px] whitespace-pre-wrap leading-relaxed">
                {generateReceiptText(receiptModal)}
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => handleShareReceipt(receiptModal)}
                  className="w-full py-3 rounded-xl font-bold text-white bg-emerald-600 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Compartilhar WhatsApp
                </button>
                <button
                  onClick={() => handleCopyReceipt(receiptModal)}
                  className="w-full py-3 rounded-xl font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copiar Texto
                </button>
                <button
                  onClick={() => setReceiptModal(null)}
                  className="w-full py-3 rounded-xl font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 active:scale-95 transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

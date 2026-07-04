import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useSettings } from '../contexts/SettingsContext';
import { useUndo } from '../contexts/UndoContext';
import { ArrowLeft, Trash2, CheckCircle2, Plus, Calendar as CalendarIcon, FileText, MoreVertical, MessageSquare, UserCog, ReceiptText, Copy, Share2, MessageCircle, Send, Pin, PinOff, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../lib/utils';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePaymentLogs, savePaymentLogs, getPaymentLogs, type PaymentLog } from '../lib/paymentDatabase';

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

  const [editingEntry, setEditingEntry] = useState<any | null>(null);
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
  
  const [paymentLogs, setPaymentLogs] = usePaymentLogs();

  const entries = useMemo(() => {
    return paymentLogs
      .filter(e => String(e.employeeId) === String(employeeId))
      .map(entry => ({
        ...entry,
        amountCents: Math.round(entry.value * 100),
        dateIso: entry.date
      }))
      .sort((a, b) => b.dateIso.localeCompare(a.dateIso) || String(b.id).localeCompare(String(a.id)));
  }, [paymentLogs, employeeId]);

  const unpaidTotal = entries
    ?.filter(entry => entry.type !== 'pagamento')
    .reduce((acc, entry) => acc + (entry.isPaid ? 0 : entry.amountCents), 0) || 0;

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
    const normalizedName = editName.trim();
    if (!normalizedName) return;

    // Check for duplicate name (case-insensitive, excluding current)
    const existing = await db.employees
      .filter(emp => emp.name.toLowerCase() === normalizedName.toLowerCase() && emp.id !== employeeId)
      .first();
    
    if (existing) {
      alert('Já existe outro funcionário com este nome!');
      return;
    }

    const amount = Math.abs(parseFloat(editAmount) || 0);

    await db.employees.update(employeeId, {
      name: normalizedName,
      phone: editPhone,
      defaultAmountCents: Math.round(amount * 100)
    });
    setIsEditingProfile(false);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryAmount) return;

    const amount = Math.abs(parseFloat(entryAmount) || 0);
    const newId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newLog: PaymentLog = {
      id: newId,
      employeeId: String(employeeId),
      value: amount,
      date: entryDate,
      type: 'diaria',
      note: entryNote,
      isPaid: 0,
      createdAt: Date.now()
    };

    const updatedLogs = [...paymentLogs, newLog];
    setPaymentLogs(updatedLogs);
    savePaymentLogs(updatedLogs);

    showUndo({
      label: 'Lançamento adicionado',
      onUndo: () => {
        const currentLogs = getPaymentLogs();
        const logsAfterUndo = currentLogs.filter(log => log.id !== newId);
        savePaymentLogs(logsAfterUndo);
      }
    });

    setEntryAmount('');
    setEntryNote('');
    setIsAddingEntry(false);
  };

  const startEditingEntry = (entry: any) => {
    setEditingEntry(entry);
    setEditEntryAmount((entry.amountCents / 100).toString());
    setEditEntryNote(entry.note);
    setEditEntryDate(entry.dateIso);
  };

  const handleUpdateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry?.id) return;

    const previousLogsState = [...paymentLogs];
    const amount = Math.abs(parseFloat(editEntryAmount) || 0);

    let updatedLogs = paymentLogs.map(log => {
      if (String(log.id) === String(editingEntry.id)) {
        return {
          ...log,
          value: amount,
          note: editEntryNote,
          date: editEntryDate
        };
      }
      return log;
    });

    // If the edited entry is a paid work entry, check if its linked payment needs adjustment
    const updatedEntry = updatedLogs.find(log => String(log.id) === String(editingEntry.id));
    if (updatedEntry && updatedEntry.isPaid && updatedEntry.type !== 'pagamento' && updatedEntry.paymentId) {
      // Check if it's an individual payment (or any payment that only pays this entry)
      const otherPaidEntries = paymentLogs.filter(log => String(log.id) !== String(editingEntry.id) && log.paymentId && String(log.paymentId) === String(updatedEntry.paymentId));
      if (otherPaidEntries.length === 0) {
        // Safe to update the single linked payment's value to match the new entry's value
        updatedLogs = updatedLogs.map(log => {
          if (String(log.id) === String(updatedEntry.paymentId)) {
            return { ...log, value: amount };
          }
          return log;
        });
      }
    }

    setPaymentLogs(updatedLogs);
    savePaymentLogs(updatedLogs);
    
    showUndo({
      label: 'Lançamento atualizado',
      onUndo: () => {
        savePaymentLogs(previousLogsState);
      }
    });

    setEditingEntry(null);
  };

  const handleMarkAllPaid = async () => {
    const totalToPay = unpaidTotal;
    const unpaidEntriesBefore = entries?.filter(e => !e.isPaid && e.type !== 'pagamento') || [];
    
    setConfirmModal({
      title: 'Marcar tudo como pago',
      message: `Deseja marcar todos os lançamentos pendentes (${formatCurrency(totalToPay)}) como pagos?`,
      type: 'success',
      onConfirm: async () => {
        const entryIds = unpaidEntriesBefore.map(e => String(e.id));
        const previousLogsState = [...paymentLogs];

        const paymentId = `pay-batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const batchPaymentLog: PaymentLog = {
          id: paymentId,
          employeeId: String(employeeId),
          value: totalToPay / 100, // convert back from cents to Reais
          date: format(new Date(), 'yyyy-MM-dd'), // payment date is today!
          type: 'pagamento',
          note: 'Pagamento total de débitos',
          isPaid: 1,
          createdAt: Date.now()
        };

        const updatedLogs = paymentLogs.map(log => {
          if (entryIds.includes(String(log.id))) {
            return { ...log, isPaid: 1, paymentId };
          }
          return log;
        });
        updatedLogs.push(batchPaymentLog);

        setPaymentLogs(updatedLogs);
        savePaymentLogs(updatedLogs);
        
        showUndo({
          label: 'Pagamento total realizado',
          onUndo: () => {
            savePaymentLogs(previousLogsState);
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

    const unpaidEntriesList = entries
      .filter(e => !e.isPaid && e.type !== 'pagamento')
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso));

    const previousLogsState = [...paymentLogs];
    let currentLogs = [...paymentLogs];
    let remainingToAbateCents = amountToAbate;

    const paymentId = `pay-partial-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const partialPaymentLog: PaymentLog = {
      id: paymentId,
      employeeId: String(employeeId),
      value: originalAmount / 100, // convert back from cents to Reais
      date: format(new Date(), 'yyyy-MM-dd'), // payment date is today!
      type: 'pagamento',
      note: 'Pagamento Parcial',
      isPaid: 1,
      createdAt: Date.now()
    };

    for (const entry of unpaidEntriesList) {
      if (remainingToAbateCents <= 0) break;

      const logIndex = currentLogs.findIndex(l => String(l.id) === String(entry.id));
      if (logIndex === -1) continue;

      const log = currentLogs[logIndex];
      const entryAmountCents = Math.round(log.value * 100);

      if (remainingToAbateCents >= entryAmountCents) {
        remainingToAbateCents -= entryAmountCents;
        currentLogs[logIndex] = { 
          ...log, 
          isPaid: 1, 
          paymentId,
          originalValue: log.originalValue ?? log.value
        };
      } else {
        const remainingCents = entryAmountCents - remainingToAbateCents;
        const origVal = log.originalValue ?? log.value;

        currentLogs[logIndex] = { 
          ...log, 
          value: remainingToAbateCents / 100, 
          isPaid: 1,
          paymentId,
          originalValue: origVal
        };
        const newLog: PaymentLog = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          employeeId: log.employeeId,
          value: remainingCents / 100,
          date: log.date,
          type: log.type,
          note: log.note ? `${log.note} (Restante de pagamento parcial)` : 'Restante de pagamento parcial',
          isPaid: 0,
          createdAt: Date.now(),
          originalValue: origVal,
          splitFromId: log.id
        };
        currentLogs.push(newLog);
        remainingToAbateCents = 0;
      }
    }

    currentLogs.push(partialPaymentLog);

    setPaymentLogs(currentLogs);
    savePaymentLogs(currentLogs);

    showUndo({
      label: 'Pagamento parcial realizado',
      onUndo: () => {
        savePaymentLogs(previousLogsState);
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
    const previousLogsState = [...paymentLogs];

    setConfirmModal({
      title: 'Excluir Funcionário',
      message: 'Tem certeza que deseja excluir este funcionário e todos os seus registros?',
      type: 'danger',
      onConfirm: async () => {
        const filteredLogs = paymentLogs.filter(log => String(log.employeeId) !== String(employeeId));
        setPaymentLogs(filteredLogs);
        savePaymentLogs(filteredLogs);

        await db.employees.delete(employeeId);
        
        showUndo({
          label: `Funcionário ${employeeData.name} excluído`,
          onUndo: async () => {
            await db.employees.add(employeeData);
            savePaymentLogs(previousLogsState);
          }
        });

        setConfirmModal(null);
        onBack();
      }
    });
  };

  const togglePaid = async (entry: any) => {
    if (!entry.id) return;
    const previousLogsState = [...paymentLogs];
    const previousState = entry.isPaid;
    const paymentId = `pay-ind-${entry.id}`;

    let updatedLogs: PaymentLog[] = [];

    if (!previousState) {
      // Toggle to PAID: set isPaid to 1, assign paymentId, and create a 'pagamento' log on today's date
      const paymentLogEntry: PaymentLog = {
        id: paymentId,
        employeeId: String(employeeId),
        value: entry.value,
        date: format(new Date(), 'yyyy-MM-dd'), // payment happened today!
        type: 'pagamento',
        note: entry.note ? `Pagamento de: ${entry.note}` : 'Pagamento de diária',
        isPaid: 1,
        createdAt: Date.now()
      };

      updatedLogs = paymentLogs.map(log => {
        if (String(log.id) === String(entry.id)) {
          return { ...log, isPaid: 1, paymentId };
        }
        return log;
      });
      updatedLogs.push(paymentLogEntry);
    } else {
      // Toggle to UNPAID: set isPaid to 0, clear paymentId, and handle split/batch payments gracefully
      const targetPaymentId = entry.paymentId || paymentId;
      const linkedPayment = paymentLogs.find(log => log.type === 'pagamento' && String(log.id) === String(targetPaymentId));
      const otherPaidEntries = paymentLogs.filter(log => String(log.id) !== String(entry.id) && log.paymentId && String(log.paymentId) === String(targetPaymentId));

      let tempLogs = [...paymentLogs];
      if (linkedPayment) {
        if (otherPaidEntries.length === 0) {
          // Only paid this entry, safely delete the payment record
          tempLogs = tempLogs.filter(log => String(log.id) !== String(linkedPayment.id));
        } else {
          // Paid multiple entries, reduce the payment's value by the entry's value
          tempLogs = tempLogs.map(log => {
            if (String(log.id) === String(linkedPayment.id)) {
              const newValue = Math.max(0, log.value - entry.value);
              return { ...log, value: newValue };
            }
            return log;
          }).filter(log => String(log.id) !== String(linkedPayment.id) || log.value > 0);
        }
      }

      // Update the entry itself to be unpaid and restore original split value if it was a partial payment
      updatedLogs = tempLogs.map(log => {
        if (String(log.id) === String(entry.id)) {
          const restoredValue = log.originalValue ?? log.value;
          return { ...log, isPaid: 0, paymentId: undefined, value: restoredValue };
        }
        return log;
      });

      // Remove any split-off remaining unpaid logs that were created from this original partial payment split
      updatedLogs = updatedLogs.filter(log => !log.splitFromId || String(log.splitFromId) !== String(entry.id));
    }

    setPaymentLogs(updatedLogs);
    savePaymentLogs(updatedLogs);
    
    showUndo({
      label: previousState ? 'Lançamento marcado como pendente' : 'Lançamento marcado como pago',
      onUndo: () => {
        savePaymentLogs(previousLogsState);
      }
    });
  };

  const deleteEntry = async (id: any) => {
    const entryToDelete = paymentLogs.find(l => String(l.id) === String(id));
    if (!entryToDelete) return;

    setConfirmModal({
      title: 'Excluir Lançamento',
      message: 'Deseja excluir este lançamento?',
      type: 'danger',
      onConfirm: async () => {
        const previousLogsState = [...paymentLogs];
        let updatedLogs = paymentLogs.filter(log => String(log.id) !== String(id));

        // If the deleted entry is a payment ('pagamento'), find any work entries paid by it,
        // mark them as unpaid, and clean up/restore any split logs.
        if (entryToDelete.type === 'pagamento') {
          const paidEntryIds: string[] = [];
          
          updatedLogs = updatedLogs.map(log => {
            if (log.paymentId && String(log.paymentId) === String(id)) {
              paidEntryIds.push(String(log.id));
              const restoredValue = log.originalValue ?? log.value;
              return { ...log, isPaid: 0, paymentId: undefined, value: restoredValue };
            }
            return log;
          });

          // Delete any split-off remaining unpaid logs associated with those restored work entries
          updatedLogs = updatedLogs.filter(log => !log.splitFromId || !paidEntryIds.includes(String(log.splitFromId)));
        } 
        // If the deleted entry is a regular work entry that is paid, adjust/delete the linked payment
        else if (entryToDelete.isPaid === 1) {
          const targetPaymentId = entryToDelete.paymentId;
          const linkedPayment = updatedLogs.find(log => log.type === 'pagamento' && String(log.id) === String(targetPaymentId));
          const otherPaidEntries = updatedLogs.filter(log => log.paymentId && String(log.paymentId) === String(targetPaymentId));

          if (linkedPayment) {
            if (otherPaidEntries.length === 0) {
              // Delete the payment completely if no other entry is paid by it
              updatedLogs = updatedLogs.filter(log => String(log.id) !== String(linkedPayment.id));
            } else {
              // Reduce payment's value by the deleted entry's value
              updatedLogs = updatedLogs.map(log => {
                if (String(log.id) === String(linkedPayment.id)) {
                  const newValue = Math.max(0, log.value - entryToDelete.value);
                  return { ...log, value: newValue };
                }
                return log;
              }).filter(log => String(log.id) !== String(linkedPayment.id) || log.value > 0);
            }
          }

          // Clean up any split-off remaining unpaid logs associated with this deleted entry
          updatedLogs = updatedLogs.filter(log => !log.splitFromId || String(log.splitFromId) !== String(entryToDelete.id));
        }

        setPaymentLogs(updatedLogs);
        savePaymentLogs(updatedLogs);
        
        showUndo({
          label: 'Lançamento excluído',
          onUndo: () => {
            savePaymentLogs(previousLogsState);
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
          {entries?.map((entry) => {
            const isPayment = entry.type === 'pagamento';
            
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                  isPayment
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30'
                    : entry.isPaid 
                      ? 'bg-slate-100 dark:bg-slate-900/50 border-transparent opacity-60' 
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-4">
                  {isPayment ? (
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                      <ReceiptText className="w-4 h-4" />
                    </div>
                  ) : (
                    <button 
                      onClick={() => togglePaid(entry)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
                        entry.isPaid 
                          ? 'bg-emerald-500 border-emerald-500 text-white' 
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {entry.isPaid && <CheckCircle2 className="w-5 h-5" />}
                    </button>
                  )}
                  <div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className={`font-bold text-lg ${isPayment ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                        {isPayment ? '+' : ''}{formatCurrency(entry.amountCents)}
                      </p>
                      {entry.originalValue && Math.round(entry.originalValue * 100) !== entry.amountCents && (
                        <span className="text-xs text-slate-400 font-medium">
                          (Original: {formatCurrency(Math.round(entry.originalValue * 100))})
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" /> {format(parseISO(entry.dateIso), 'dd/MM/yyyy')}
                      {isPayment && (
                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 ml-1 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                          PAGAMENTO
                        </span>
                      )}
                    </p>
                    {entry.note && (
                      <p className="text-sm text-slate-400 italic flex items-center gap-1 mt-1">
                        <FileText className="w-3 h-3" /> {entry.note}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!isPayment && (
                    <button 
                      onClick={() => startEditingEntry(entry)}
                      className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"
                      title="Editar Lançamento"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {(entry.isPaid === 1 || isPayment) && (
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
            );
          })}
          
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
                    maxLength={100}
                    placeholder="Ex: Diária de sábado"
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

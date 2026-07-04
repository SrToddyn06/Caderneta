import { useState, useEffect } from 'react';
import { db } from '../db';

export interface PaymentLog {
  id: string | number;
  employeeId: string;
  value: number; // in Reais (float)
  date: string; // YYYY-MM-DD
  type: string; // e.g., 'salario_base', 'hora_extra', 'bonus', 'diaria', etc.
  note: string; // preserve notes
  isPaid: number; // 0 for unpaid, 1 for paid
  createdAt: number;
  originalValue?: number; // the original value before any split/partial payments
  paymentId?: string | number; // references the 'pagamento' type entry that paid this
  splitFromId?: string | number; // the id of the original log this was split from
}

const LOCAL_STORAGE_KEY = 'payment_logs';
const MIGRATED_KEY = 'payment_logs_migrated_v1';

export function getPaymentLogs(): PaymentLog[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to parse payment logs:', e);
    return [];
  }
}

export function savePaymentLogs(logs: PaymentLog[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
    window.dispatchEvent(new Event('payment-logs-updated'));
  } catch (e) {
    console.error('Failed to save payment logs:', e);
  }
}

export function usePaymentLogs() {
  const [logs, setLogs] = useState<PaymentLog[]>(() => getPaymentLogs());

  useEffect(() => {
    const handleUpdate = () => {
      setLogs(getPaymentLogs());
    };
    window.addEventListener('payment-logs-updated', handleUpdate);
    return () => {
      window.removeEventListener('payment-logs-updated', handleUpdate);
    };
  }, []);

  return [logs, setLogs] as const;
}

// Migrate existing Dexie workEntries to LocalStorage logs if not done already
export async function migrateDexieToLocalStorage() {
  if (localStorage.getItem(MIGRATED_KEY) === 'true') {
    return;
  }

  try {
    const currentLogs = getPaymentLogs();
    const existingEntries = await db.workEntries.toArray();

    if (existingEntries.length > 0) {
      const migratedLogs: PaymentLog[] = existingEntries.map(entry => {
        // Try to map notes to suitable types if applicable, or default to 'diaria'
        let pType = 'diaria';
        const noteLower = (entry.note || '').toLowerCase();
        if (noteLower.includes('salario') || noteLower.includes('salário')) {
          pType = 'salario_base';
        } else if (noteLower.includes('extra')) {
          pType = 'hora_extra';
        } else if (noteLower.includes('bonus') || noteLower.includes('bônus')) {
          pType = 'bonus';
        }

        return {
          id: entry.id ? String(entry.id) : `${Date.now()}-${Math.random()}`,
          employeeId: String(entry.employeeId),
          value: entry.amountCents / 100, // map cents to Real numbers
          date: entry.dateIso,
          type: pType,
          note: entry.note || '',
          isPaid: entry.isPaid,
          createdAt: entry.createdAt || Date.now()
        };
      });

      // Merge avoiding duplicates
      const logMap = new Map<string | number, PaymentLog>();
      currentLogs.forEach(log => logMap.set(log.id, log));
      migratedLogs.forEach(log => logMap.set(log.id, log));

      savePaymentLogs(Array.from(logMap.values()));
    }

    localStorage.setItem(MIGRATED_KEY, 'true');
  } catch (err) {
    console.error('Failed to migrate Dexie to LocalStorage:', err);
  }
}

// Migrate old paid entries without paymentId to have an associated payment record
export function migratePaidEntriesToPaymentLogs() {
  try {
    const currentLogs = getPaymentLogs();
    let updated = false;
    const newLogs = [...currentLogs];

    currentLogs.forEach((log, index) => {
      // Find work entries (type !== 'pagamento') that are marked as paid (isPaid === 1) but have no paymentId
      if (log.isPaid === 1 && log.type !== 'pagamento' && !log.paymentId) {
        const paymentId = `pay-mig-${log.id}`;
        // Update the work entry to point to this paymentId
        const updatedLog = { ...log, paymentId };
        newLogs[index] = updatedLog;

        // Check if the corresponding 'pagamento' log already exists
        const exists = currentLogs.some(l => String(l.id) === String(paymentId));
        if (!exists) {
          const paymentEntry: PaymentLog = {
            id: paymentId,
            employeeId: log.employeeId,
            value: log.value,
            date: log.date, // use original date for old migrations
            type: 'pagamento',
            note: log.note ? `Pagamento de: ${log.note}` : 'Pagamento de diária',
            isPaid: 1,
            createdAt: log.createdAt || Date.now()
          };
          newLogs.push(paymentEntry);
        }
        updated = true;
      }
    });

    if (updated) {
      savePaymentLogs(newLogs);
    }
  } catch (err) {
    console.error('Failed to run paid entries paymentId migration:', err);
  }
}

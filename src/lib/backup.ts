import { db } from '../db';
import { getPaymentLogs, savePaymentLogs } from './paymentDatabase';

export const BACKUP_KEY = 'caderneta_auto_backup';

export async function createBackup() {
  const employees = await db.employees.toArray();
  const workEntries = await db.workEntries.toArray();
  const paymentLogs = getPaymentLogs();
  const backup = {
    employees,
    workEntries,
    paymentLogs,
    timestamp: Date.now()
  };
  
  // Save to Dexie instead of localStorage to avoid 5MB limit
  await db.backups.put({
    id: 1,
    data: JSON.stringify(backup),
    timestamp: Date.now()
  });
  
  return backup;
}

export async function restoreBackup(backupData?: any) {
  let data = backupData;
  
  if (!data) {
    const stored = await db.backups.get(1);
    if (stored) {
      data = JSON.parse(stored.data);
    }
  }

  if (!data || !data.employees) return false;

  try {
    await db.transaction('rw', [db.employees, db.workEntries], async () => {
      await db.employees.clear();
      await db.workEntries.clear();
      
      await db.employees.bulkAdd(data.employees);
      if (data.workEntries) {
        await db.workEntries.bulkAdd(data.workEntries);
      }
    });

    if (data.paymentLogs) {
      savePaymentLogs(data.paymentLogs);
    } else if (data.workEntries) {
      // Migrate old workEntries structure if restoring an older backup format
      const mappedLogs = data.workEntries.map((e: any) => ({
        id: String(e.id || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
        employeeId: String(e.employeeId),
        value: e.amountCents / 100,
        date: e.dateIso || new Date(e.createdAt || Date.now()).toISOString().split('T')[0],
        type: 'diaria',
        note: e.note || '',
        isPaid: e.isPaid ? 1 : 0,
        createdAt: e.createdAt || Date.now()
      }));
      savePaymentLogs(mappedLogs);
    }

    return true;
  } catch (error) {
    console.error('Failed to restore backup:', error);
    return false;
  }
}

export function downloadBackup(data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `caderneta_backup_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

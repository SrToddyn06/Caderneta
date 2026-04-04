import { db } from '../db';

export const BACKUP_KEY = 'caderneta_auto_backup';

export async function restoreBackup(backupData?: any) {
  let data = backupData;
  
  if (!data || !data.employees) return false;

  try {
    await db.transaction('rw', [db.employees, db.workEntries], async () => {
      await db.employees.clear();
      await db.workEntries.clear();
      
      await db.employees.bulkAdd(data.employees);
      await db.workEntries.bulkAdd(data.workEntries);
    });
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

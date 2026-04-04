import Dexie, { type Table } from 'dexie';

export interface Employee {
  id?: number;
  name: string;
  phone: string;
  defaultAmountCents: number;
  createdAt: number;
  isPinned?: number; // 0 or 1
}

export interface WorkEntry {
  id?: number;
  employeeId: number;
  dateIso: string; // YYYY-MM-DD
  amountCents: number;
  note: string;
  isPaid: number; // 0 for unpaid, 1 for paid (Dexie doesn't index booleans well in some envs, using 0/1)
  createdAt: number;
}

export interface Settings {
  id: number;
  fontSize: 'sm' | 'md' | 'lg';
  highContrast: boolean;
  theme: 'light' | 'dark';
  debtThresholdCents: number;
}

export class CadernetaDB extends Dexie {
  employees!: Table<Employee>;
  workEntries!: Table<WorkEntry>;
  settings!: Table<Settings>;

  constructor() {
    super('CadernetaDB');
    this.version(3).stores({
      employees: '++id, name, phone',
      workEntries: '++id, employeeId, dateIso, isPaid',
      settings: 'id'
    });
  }
}

export const db = new CadernetaDB();

// Initialize settings if not exists
db.on('ready', async () => {
  const count = await db.settings.count();
  if (count === 0) {
    await db.settings.add({
      id: 1,
      fontSize: 'md',
      highContrast: false,
      theme: 'light',
      debtThresholdCents: 50000 // R$ 500,00
    });
  }
});

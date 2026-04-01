import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Settings } from '../db';

interface SettingsContextType {
  settings: Settings | undefined;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const settings = useLiveQuery(() => db.settings.get(1));

  const updateSettings = async (newSettings: Partial<Settings>) => {
    try {
      const currentSettings = await db.settings.get(1);
      if (currentSettings) {
        await db.settings.put({ ...currentSettings, ...newSettings });
      } else {
        // Fallback if settings don't exist for some reason
        await db.settings.put({
          id: 1,
          fontSize: 'md',
          highContrast: false,
          theme: 'light',
          autoBackup: false,
          debtThresholdCents: 50000,
          ...newSettings
        } as Settings);
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (settings) {
      // Apply theme
      if (settings.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // Apply font size
      document.documentElement.setAttribute('data-font-size', settings.fontSize);
    }
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('Ambiente Web: Tratando permissão de notificação com fallback.');
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        // Safe check because inside iframe previews, Permission API might throw or be denied
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.log('Permissão de notificação do navegador indisponível ou negada (comum em iframes):', error);
        return true; // Fallback true for UI toggle behavior in preview/testing
      }
    }
    return true; // Fallback true if Notification API is not supported in this browser
  }

  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') {
      return true;
    }
    const request = await LocalNotifications.requestPermissions();
    return request.display === 'granted';
  } catch (error) {
    console.error('Erro ao verificar/solicitar permissões de notificação nativa:', error);
    return false;
  }
}

export async function scheduleDailyReminder(time: string = '18:00'): Promise<boolean> {
  const isNative = Capacitor.isNativePlatform();

  try {
    // 1. Cancel any existing reminder first
    await cancelDailyReminder();

    // 2. Request permission
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission && isNative) {
      console.warn('Permissão de notificação nativa não concedida.');
      return false;
    }

    // 3. Parse hour and minute from time string (e.g. "18:00")
    const [hourStr, minuteStr] = time.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if (isNaN(hour) || isNaN(minute)) {
      console.error('Formato de hora inválido. Esperado HH:MM');
      return false;
    }

    if (!isNative) {
      console.log(`Ambiente Web: Simulando lembrete diário agendado para às ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      return true;
    }

    // 4. Schedule recurring daily notification
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1800, // fixed ID for this recurring notification
          title: 'Caderneta Diária 📝',
          body: 'Hora de checar os valores do dia dos seus funcionários e anotar os serviços!',
          schedule: {
            on: {
              hour,
              minute,
            },
            allowWhileIdle: true, // critical for Android to show even if phone is idle/sleeping
          },
          smallIcon: 'res://ic_stat_icon', // custom status bar icon resource if available, defaults otherwise
          actionTypeId: '',
          extra: null,
        },
      ],
    });

    console.log(`Notificação diária agendada com sucesso no Android para às ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    return true;
  } catch (error) {
    console.error('Falha ao agendar notificação local diária:', error);
    return false;
  }
}

export async function cancelDailyReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.log('Ambiente Web: Cancelado simulação de lembrete diário.');
    return;
  }

  try {
    const pending = await LocalNotifications.getPending();
    const isScheduled = pending.notifications.some((n) => n.id === 1800);
    if (isScheduled) {
      await LocalNotifications.cancel({
        notifications: [{ id: 1800 }],
      });
      console.log('Lembrete diário agendado cancelado com sucesso.');
    }
  } catch (error) {
    console.error('Falha ao cancelar notificação local diária:', error);
  }
}

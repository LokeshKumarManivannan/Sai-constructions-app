import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import { useApi } from '@/lib/useApi';

export type Notification = {
  id: string;
  kind:
    | 'payment_due'
    | 'extra_work'
    | 'check_payment'
    | 'payment_confirmed'
    | 'photos'
    | 'document'
    | 'confirm_payment'
    | 'disputed'
    | 'overdue'
    | 'untagged'
    | 'extra_decided'
    | 'supervisor_spent'
    | 'bank_to_explain'
    | 'bank_statement_due'
    | 'bank_gap';
  action: boolean;
  project_id: string | null;
  project_name: string | null;
  at: string;
  amount_paise: number | null;
  name: string | null;
  due_date: string | null;
  status: string | null;
  by: string | null;
  count: number | null;
};

const KEY = 'sai.notifications.seen';

async function readSeen(): Promise<number> {
  const v = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  return v ? Number(v) : 0;
}

async function writeSeen(ms: number): Promise<void> {
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, String(ms));
  else await SecureStore.setItemAsync(KEY, String(ms));
}

/** Unread = things waiting on the customer + news since the list was last opened. */
export function useNotifications(enabled = true) {
  const list = useApi<Notification[]>(enabled ? '/notifications' : null);
  const [seen, setSeen] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void readSeen().then(setSeen);
    }, []),
  );

  const items = list.data ?? [];
  const isNew = (n: Notification) => n.action || new Date(n.at).getTime() > seen;
  const unread = items.filter(isNew).length;

  const markSeen = useCallback(async () => {
    const now = Date.now();
    await writeSeen(now);
    setSeen(now);
  }, []);

  return { items, unread, isNew, markSeen, loading: list.loading };
}

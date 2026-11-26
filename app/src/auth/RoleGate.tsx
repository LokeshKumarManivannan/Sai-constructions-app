import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';

import type { Role } from '@/lib/types';
import { Loading } from '@/ui/components';
import { useAuth } from './AuthContext';

export const homeFor = (role: Role) => `/${role}` as const;

/** Renders children only for the given role; otherwise sends the user to login or their own home. */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== role) return <Redirect href={homeFor(user.role)} />;
  return <>{children}</>;
}

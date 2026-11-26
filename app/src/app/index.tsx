import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';
import { homeFor } from '@/auth/RoleGate';
import { Loading } from '@/ui/components';

export default function Index() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={homeFor(user.role)} />;
}

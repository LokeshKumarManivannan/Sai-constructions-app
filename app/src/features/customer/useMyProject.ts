import { useApi } from '@/lib/useApi';
import type { Project } from '@/lib/types';

/** Phase 1: a customer sees their first (most recent) project. A picker comes when someone has two. */
export function useMyProject() {
  const { data, error, loading } = useApi<Project[]>('/projects');
  return { project: data?.[0] ?? null, error, loading: loading && !data };
}

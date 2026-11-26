import type { MilestoneStatus, ProjectStatus } from '@/lib/types';
import type { Tone } from './components';

export const milestoneTone: Record<MilestoneStatus, Tone> = {
  pending: 'neutral',
  done: 'warn',
  payment_due: 'bad',
  paid: 'good',
};

export const projectTone: Record<ProjectStatus, Tone> = {
  quote: 'warn',
  contract_signed: 'good',
  in_progress: 'good',
  handed_over: 'good',
  closed: 'neutral',
};

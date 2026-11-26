// Mirrors backend/app/schemas.py. Money is integer paise.
export type Role = 'owner' | 'supervisor' | 'customer';
export type Language = 'en' | 'ta';
export type Trade = 'civil' | 'painting' | 'carpentry' | 'plumbing' | 'electrical';
export type ProjectStatus = 'quote' | 'contract_signed' | 'in_progress' | 'handed_over' | 'closed';
export type MilestoneStatus = 'pending' | 'done' | 'payment_due' | 'paid';

export const TRADES: Trade[] = ['civil', 'painting', 'carpentry', 'plumbing', 'electrical'];
export const PROJECT_STATUSES: ProjectStatus[] = ['quote', 'contract_signed', 'in_progress', 'handed_over', 'closed'];

export interface User {
  id: string;
  phone: string;
  full_name: string;
  role: Role;
  language: Language;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  alt_phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  project_count: number;
}

export interface Project {
  id: string;
  customer_id: string;
  customer_name: string;
  name: string;
  site_address: string;
  google_maps_url: string | null;
  plot_size: string | null;
  floors: string | null;
  status: ProjectStatus;
  contract_value_paise: number;
  start_date: string | null;
  target_end_date: string | null;
}

export interface ProjectSite {
  id: string;
  name: string;
  site_address: string;
  google_maps_url: string | null;
  status: ProjectStatus;
  my_trades: Trade[];
}

export interface Milestone {
  id: string;
  project_id: string;
  seq: number;
  name: string;
  amount_due_paise: number;
  due_date: string | null;
  status: MilestoneStatus;
}

export interface Assignment {
  id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  user_phone: string;
  trade: Trade;
  active: boolean;
}

export interface Invite {
  id: string;
  project_id: string;
  phone: string;
  status: 'sent' | 'accepted' | 'revoked';
  expires_at: string;
  link: string;
}

export interface PublicInvite {
  company: string;
  project_name: string;
  phone_masked: string;
  usable: boolean;
}

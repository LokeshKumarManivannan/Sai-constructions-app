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

// ---------- payments (phase 2) ----------
export type PaymentMode = 'upi' | 'bank_transfer' | 'cheque' | 'cash';
export type PaymentStatus = 'unconfirmed' | 'confirmed' | 'disputed' | 'void';
export const PAYMENT_MODES: PaymentMode[] = ['upi', 'bank_transfer', 'cheque', 'cash'];

export interface Payment {
  id: string;
  project_id: string;
  milestone_id: string | null;
  milestone_name: string | null;
  amount_paise: number;
  mode: PaymentMode;
  reference: string | null;
  paid_on: string;
  note: string | null;
  proof_url: string | null;
  logged_by_role: Role;
  logged_by_name: string;
  status: PaymentStatus;
  confirmed_at: string | null;
  dispute_reason: string | null;
  receipt_no: number | null;
  corrects_id: string | null;
  created_at: string;
  can_confirm: boolean;
}

export interface Summary {
  contract_value_paise: number;
  approved_extras_paise: number;
  total_due_paise: number;
  paid_paise: number;
  outstanding_paise: number;
  awaiting_confirmation: number;
  cash_received_paise: number;
  cash_limit_paise: number;
  next_due: { milestone_id: string; name: string; amount_paise: number; due_date: string | null } | null;
}

export interface Receipt {
  company: string;
  receipt_no: number;
  project_name: string;
  customer_name: string;
  site_address: string;
  amount_paise: number;
  mode: PaymentMode;
  reference: string | null;
  paid_on: string;
  milestone_name: string | null;
  confirmed_at: string;
}

// ---------- change orders (phase 3) ----------
export type ChangeOrderStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'in_progress' | 'done';

export interface ChangeOrder {
  id: string;
  project_id: string;
  trade: Trade | null;
  title: string;
  description: string;
  amount_paise: number;
  photo_urls: string[];
  status: ChangeOrderStatus;
  version: number;
  revises_id: string | null;
  sent_at: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  reject_reason: string | null;
  created_at: string;
}

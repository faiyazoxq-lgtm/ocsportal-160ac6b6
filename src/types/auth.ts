export type AppRole = "dispatcher" | "engineer" | "boss";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
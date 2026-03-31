export interface Tenant {
  id: string;
  name: string;
  status: string;
  plan: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string | null;
  role: 'super_admin' | 'admin';
  login_id: string;
  email: string | null;
  password_hash: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface TenantSettings {
  tenant_id: string;
  line_account_limit: number;
  ai_usage_limit: number;
  allowed_features: string;
  created_at: string;
  updated_at: string;
}

export interface AuthPayload {
  user_id: string;
  tenant_id: string | null;
  role: 'super_admin' | 'admin';
  login_id: string;
  exp: number;
}

export interface SafeUser {
  id: string;
  tenant_id: string | null;
  role: 'super_admin' | 'admin';
  login_id: string;
  email: string | null;
  status: string;
  last_login_at: string | null;
}

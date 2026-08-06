import { api as apiClient } from '../lib/api/client';
import type { Paginated } from '../lib/api/types';
import { clearTokens, setTokens } from '../lib/api/tokens';

/** Mirrors SubscriptionPlanSerializer. */
export interface SubscriptionPlan {
  id: number;
  name: string;
  display_name?: string;
  /** A decimal, so DRF serialises it as a string. */
  price: number | string;
  max_websites: number;
  max_databases: number;
  storage_limit_mb: number;
  bandwidth_limit_mb: number;
  ssl_included?: boolean;
  custom_domains?: boolean;
  priority_support?: boolean;
  backup_frequency_days?: number;
}

/** Mirrors UserSubscriptionSerializer. */
/** The boolean flags a plan can carry. */
export type PlanFeature = 'ssl_included' | 'custom_domains' | 'priority_support';

export interface UserSubscription {
  id: number;
  plan: SubscriptionPlan;
  status?: string;
  started_at?: string;
  expires_at?: string | null;
  next_billing_date?: string | null;
  cancelled_at?: string | null;
  storage_used_mb?: number;
  storage_websites_mb?: number;
  storage_databases_mb?: number;
  bandwidth_used_mb?: number;
  is_active?: boolean;
}

export interface Website {
  id: string;
  name: string;
  description?: string;
  website_type: 'static' | 'php';
  status?: string;
  /** The nested domain carries the SSL state; there is no flag on the site. */
  domain?: {
    id: number;
    name: string;
    domain_type?: string;
    status?: string;
    ssl_enabled?: boolean;
    ssl_expires_at?: string | null;
  } | null;
  database?: { id: string; name: string } | null;
  git_repository?: string | null;
  deployment_branch?: string | null;
  build_command?: string | null;
  install_command?: string | null;
  output_directory?: string | null;
  storage_used_mb?: number | null;
  last_deployment?: string | null;
  total_visits?: number | null;
  environment_variables?: Record<string, string>;
  url?: string | null;
  created_at: string;
  updated_at?: string;
}

/** Mirrors DatabaseSerializer; the list endpoint sends a subset of it. */
export interface HostingDatabase {
  id: string;
  name: string;
  db_type?: string;
  status?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  size_mb?: number;
  error_message?: string | null;
  connection_info?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
}

/** Mirrors DomainSerializer. */
export interface Domain {
  id: number;
  name: string;
  domain_type?: string;
  status?: string;
  ssl_enabled?: boolean;
  ssl_expires_at?: string | null;
  is_available?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Deployment {
  id: string;
  /** Serialised as a nested object by the list endpoint, not a bare id. */
  website?: { id?: string; name?: string } | null;
  status: string;
  commit_hash?: string;
  commit_message?: string;
  build_log?: string;
  error_message?: string;
  deploy_time_seconds?: number | null;
  started_at: string;
  completed_at?: string | null;
}

/**
 * What /hosting/dashboard/ returns.
 *
 * Note the counts are nested under `stats`, not at the top level: the page
 * read stats.total_visits and always got undefined, so the Total Visits tile
 * has been showing 0 whatever the real figure.
 */
export interface DashboardStats {
  subscription?: {
    plan?: string;
    price?: number | string;
    limits?: {
      websites?: number;
      databases?: number;
      storage_mb?: number;
      bandwidth_mb?: number;
    };
  };
  usage?: {
    websites?: number;
    databases?: number;
    storage_mb?: number;
    bandwidth_mb?: number;
  };
  stats?: {
    total_websites?: number;
    active_websites?: number;
    total_visits?: number;
    bandwidth_used_mb?: number;
  };
  recent_activity?: unknown[];
}

/** Query parameters accepted by the list endpoints. */
type ListParams = { action?: string; status?: string; page?: number; page_size?: number };

type MaybePaginated<T> = Paginated<T> | T[];


// Hosting API Services
export const hostingApi = {
  // Subscription Plans
  getSubscriptionPlans: () => apiClient.get<MaybePaginated<SubscriptionPlan>>('/hosting/subscription-plans/'),
  
  // User Subscription
  getUserSubscription: () => apiClient.get<UserSubscription>('/hosting/subscriptions/current/'),
  upgradeSubscription: (planName: string) => apiClient.post('/hosting/subscriptions/upgrade/', { plan: planName }),
  
  // Dashboard
  getDashboardStats: () => apiClient.get<DashboardStats>('/hosting/dashboard/stats/'),
  
  // Websites
  getWebsites: () => apiClient.get<MaybePaginated<Website>>('/hosting/websites/'),
  createWebsite: (data: Partial<Website> & Record<string, unknown>) => apiClient.post<Website>('/hosting/websites/', data),
  getWebsite: (id: number | string) => apiClient.get<Website>(`/hosting/websites/${id}/`),
  updateWebsite: (id: number | string, data: Partial<Website>) => apiClient.patch<Website>(`/hosting/websites/${id}/`, data),
  deleteWebsite: (id: number | string) => apiClient.delete(`/hosting/websites/${id}/`),
  deployWebsite: (id: number | string) => apiClient.post(`/hosting/websites/${id}/deploy/`),
  
  // Website-specific endpoints
  getWebsiteDeployments: (websiteId: number | string) => apiClient.get(`/hosting/websites/${websiteId}/deployments/`),
  getWebsiteAnalytics: (websiteId: number | string, period = '7d') => apiClient.get(`/hosting/websites/${websiteId}/analytics/?period=${period}`),
  
  // Databases
  getDatabases: () => apiClient.get<MaybePaginated<HostingDatabase>>('/hosting/databases/'),
  createDatabase: (data: Record<string, unknown>) => apiClient.post<HostingDatabase>('/hosting/databases/', data),
  getDatabase: (id: number | string) => apiClient.get<HostingDatabase>(`/hosting/databases/${id}/`),
  updateDatabase: (id: number | string, data: Record<string, unknown>) => apiClient.patch<HostingDatabase>(`/hosting/databases/${id}/`, data),
  deleteDatabase: (id: number | string) => apiClient.delete(`/hosting/databases/${id}/`),
  changeDatabasePassword: (id: number | string, password: string) => apiClient.post(`/hosting/databases/${id}/change_password/`, { password }),
  
  // Domains
  getDomains: () => apiClient.get<MaybePaginated<Domain>>('/hosting/domains/'),
  getAvailableDomains: () => apiClient.get<MaybePaginated<Domain>>('/hosting/domains/available/'),
  createDomain: (data: Record<string, unknown>) => apiClient.post<Domain>('/hosting/domains/', data),
  getDomain: (id: number | string) => apiClient.get<Domain>(`/hosting/domains/${id}/`),
  updateDomain: (id: number | string, data: Partial<Domain>) => apiClient.patch<Domain>(`/hosting/domains/${id}/`, data),
  deleteDomain: (id: number | string) => apiClient.delete(`/hosting/domains/${id}/`),
  
  // Deployments
  getDeployments: () => apiClient.get<MaybePaginated<Deployment>>('/hosting/deployments/'),
  getDeployment: (id: number | string) => apiClient.get(`/hosting/deployments/${id}/`),
  
  // SSL Certificates
  getSSLCertificates: () => apiClient.get('/hosting/ssl-certificates/'),
  createSSLCertificate: (data: Record<string, unknown>) => apiClient.post('/hosting/ssl-certificates/', data),
  deleteSSLCertificate: (id: number | string) => apiClient.delete(`/hosting/ssl-certificates/${id}/`),
  renewSSLCertificate: (id: number | string) => apiClient.post(`/hosting/ssl-certificates/${id}/renew/`),
  
  // Analytics. getWebsiteAnalytics is declared with the website endpoints above;
  // the duplicate key here silently shadowed it with an identical body.
  getBandwidthUsage: (period = '30d') => 
    apiClient.get(`/hosting/analytics/bandwidth/?period=${period}`),
  
  // Backups
  getBackupJobs: () => apiClient.get('/hosting/backups/'),
  createBackupJob: (data: Record<string, unknown>) => apiClient.post('/hosting/backups/', data),
  restoreBackup: (id: number | string) => apiClient.post(`/hosting/backups/${id}/restore/`),
  
  // Invoices
  getInvoices: () => apiClient.get('/hosting/invoices/'),
  getInvoice: (id: number | string) => apiClient.get(`/hosting/invoices/${id}/`),
  
  // Activity Log
  getActivityLog: (params: ListParams = {}) =>
    apiClient.get('/hosting/activity-logs/', { params }),
  
  // Deployment Logs
  getDeploymentLogs: (websiteId: string | null = null, params: ListParams = {}) =>
    apiClient.get<MaybePaginated<Deployment>>('/hosting/deployments/', {
      params: { website: websiteId, ...params },
    }),
  uploadFiles: (websiteId: number | string, formData: FormData) => apiClient.post(`/hosting/websites/${websiteId}/upload_files/`, formData),
  uploadZip: (websiteId: number | string, formData: FormData) => apiClient.post(`/hosting/websites/${websiteId}/upload_zip/`, formData),
  // File management
  listFiles: (websiteId: number | string) => apiClient.get(`/hosting/websites/${websiteId}/list_files/`),
  deleteFile: (websiteId: number | string, filename: string) => apiClient.post(`/hosting/websites/${websiteId}/delete_file/`, { filename }),
  downloadFile: (websiteId: number | string, filename: string) => apiClient.get(`/hosting/websites/${websiteId}/download_file/?filename=${encodeURIComponent(filename)}`),
  };

// Auth API Services.
// login and logout previously called apiClient.setTokens and removeToken, which
// belonged to the old fetch client and do not exist on the shared one. Tokens
// are owned by lib/api/tokens now.
export const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    const response = await apiClient.post<{ access?: string; refresh?: string }>(
      '/auth/login/',
      credentials,
      { anonymous: true },
    );
    if (response?.access) setTokens(response.access, response.refresh);
    return response;
  },
  register: (userData: Record<string, unknown>) =>
    apiClient.post('/auth/register/', userData, { anonymous: true }),
  logout: async () => {
    try {
      await apiClient.post('/auth/logout/');
    } finally {
      clearTokens();
    }
  },
  getProfile: () => apiClient.get('/auth/profile/'),
  updateProfile: (data: Record<string, unknown>) => apiClient.patch('/auth/profile/', data),
  changePassword: (data: Record<string, unknown>) => apiClient.post('/auth/change-password/', data),
};

// Helper functions for subscription management
export const subscriptionHelpers = {
  // Check if user can create more websites
  canCreateWebsite: (userSubscription: UserSubscription | null, currentWebsites: unknown[]) => {
    if (!userSubscription || !userSubscription.plan) return false;
    return currentWebsites.length < userSubscription.plan.max_websites;
  },
  
  // Check if user can create more databases
  canCreateDatabase: (userSubscription: UserSubscription | null, currentDatabases: unknown[]) => {
    if (!userSubscription || !userSubscription.plan) return false;
    return currentDatabases.length < userSubscription.plan.max_databases;
  },
  
  // Get storage usage percentage
  getStorageUsagePercentage: (userSubscription: UserSubscription | null) => {
    if (!userSubscription || !userSubscription.plan) return 0;
    const used = userSubscription.storage_used_mb || 0;
    const limit = userSubscription.plan.storage_limit_mb;
    return Math.round((used / limit) * 100);
  },
  
  // Get bandwidth usage percentage
  getBandwidthUsagePercentage: (userSubscription: UserSubscription | null) => {
    if (!userSubscription || !userSubscription.plan) return 0;
    const used = userSubscription.bandwidth_used_mb || 0;
    const limit = userSubscription.plan.bandwidth_limit_mb;
    return Math.round((used / limit) * 100);
  },
  
  // Format storage size
  formatStorage: (sizeInMB: number) => {
    if (sizeInMB < 1024) return `${sizeInMB} MB`;
    return `${(sizeInMB / 1024).toFixed(1)} GB`;
  },
  
  // Get plan color for UI
  getPlanColor: (planName: string | null | undefined) => {
    const colors: Record<string, string> = {
      free: 'text-gray-600 bg-gray-100',
      developer: 'text-blue-600 bg-blue-100',
      pro: 'text-purple-600 bg-purple-100',
    };
    return colors[planName?.toLowerCase() ?? ''] || colors.free;
  },
  
  // Check if plan has feature
  /** The boolean feature flags a plan carries. */
  hasFeature: (userSubscription: UserSubscription | null, feature: PlanFeature) => {
    if (!userSubscription?.plan) return false;
    return userSubscription.plan[feature] === true;
  },
};

export default { hostingApi, authApi, subscriptionHelpers };

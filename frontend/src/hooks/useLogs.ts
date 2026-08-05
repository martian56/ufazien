import { useCallback, useEffect, useState } from 'react';
import { hostingApi, type Deployment } from '../utils/hostingApi';
import type { Paginated } from '../lib/api/types';
import { errorMessage } from '../lib/api/errors';

export interface ActivityLog {
  action: string;
  description: string;
  created_at: string;
  metadata?: {
    website_name?: string;
    database_name?: string;
    domain_name?: string;
    details?: string;
  } | null;
}

/** The deployment shape comes from the hosting API. */
export type DeploymentLog = Deployment;

export type LogLevel = 'info' | 'warning' | 'error';

export interface UnifiedLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  type: string;
  source: string;
  message: string;
  details: string;
  original: ActivityLog | DeploymentLog;
}

interface PageInfo {
  count: number;
  next: string | null;
  previous: string | null;
}

type ListParams = { action?: string; status?: string; page?: number; page_size?: number };

/** The list endpoints may paginate or return a bare array. */
function pageOf<T>(response: Paginated<T> | T[] | null | undefined): { items: T[]; info: PageInfo } {
  if (Array.isArray(response)) {
    return { items: response, info: { count: response.length, next: null, previous: null } };
  }
  if (!response) return { items: [], info: { count: 0, next: null, previous: null } };
  return {
    items: response.results ?? [],
    info: {
      count: response.count ?? 0,
      next: response.next ?? null,
      previous: response.previous ?? null,
    },
  };
}

export const useLogs = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [deploymentLogs, setDeploymentLogs] = useState<DeploymentLog[]>([]);
  const [pagination, setPagination] = useState<{ activity: PageInfo; deployment: PageInfo }>({
    activity: { count: 0, next: null, previous: null },
    deployment: { count: 0, next: null, previous: null },
  });

  const fetchActivityLogs = useCallback(async (params: ListParams = {}) => {
    try {
      const { items, info } = pageOf(
        (await hostingApi.getActivityLog(params)) as Paginated<ActivityLog> | ActivityLog[],
      );
      setActivityLogs(items);
      setPagination((prev) => ({ ...prev, activity: info }));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load activity logs'));
    }
  }, []);

  const fetchDeploymentLogs = useCallback(async (params: ListParams = {}) => {
    try {
      const { items, info } = pageOf(await hostingApi.getDeploymentLogs(null, params));
      setDeploymentLogs(items);
      setPagination((prev) => ({ ...prev, deployment: info }));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load deployment logs'));
    }
  }, []);

  const fetchAllLogs = useCallback(
    async (params: ListParams = {}) => {
      setLoading(true);
      setError(null);

      try {
        await Promise.all([fetchActivityLogs(params), fetchDeploymentLogs(params)]);
      } catch (err) {
        setError(errorMessage(err, 'Failed to load logs'));
      } finally {
        setLoading(false);
      }
    },
    [fetchActivityLogs, fetchDeploymentLogs],
  );

  const refreshLogs = () => {
    fetchAllLogs();
  };

  const nextPageNumber = (next: string | null): number | undefined => {
    if (!next) return undefined;
    const page = new URL(next, window.location.origin).searchParams.get('page');
    return page ? Number(page) : undefined;
  };

  const loadMoreActivity = async () => {
    const page = nextPageNumber(pagination.activity.next);
    if (!page) return;
    const { items, info } = pageOf(
      (await hostingApi.getActivityLog({ page })) as Paginated<ActivityLog> | ActivityLog[],
    );
    setActivityLogs((prev) => [...prev, ...items]);
    setPagination((prev) => ({ ...prev, activity: info }));
  };

  const loadMoreDeployment = async () => {
    const page = nextPageNumber(pagination.deployment.next);
    if (!page) return;
    const { items, info } = pageOf(await hostingApi.getDeploymentLogs(null, { page }));
    setDeploymentLogs((prev) => [...prev, ...items]);
    setPagination((prev) => ({ ...prev, deployment: info }));
  };

  useEffect(() => {
    fetchAllLogs();
  }, [fetchAllLogs]);

  // Transform logs into unified format for the UI
  const transformedLogs: UnifiedLog[] = [
    // Activity logs
    ...activityLogs.map((log) => ({
      id: `activity-${log.action}-${log.created_at}`,
      timestamp: log.created_at,
      level: getLogLevel(log.action),
      type: getLogType(log.action),
      source: getLogSource(log.action, log.metadata),
      message: log.description,
      details: log.metadata?.details || '',
      original: log,
    })),
    // Deployment logs
    ...deploymentLogs.map((deployment) => ({
      id: `deployment-${deployment.id}`,
      timestamp: deployment.started_at,
      level: getDeploymentLevel(deployment.status),
      type: 'website',
      source: deployment.website?.name || 'Unknown Website',
      message: getDeploymentMessage(deployment),
      details: deployment.error_message || deployment.build_log || '',
      original: deployment,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    loading,
    error,
    logs: transformedLogs,
    activityLogs,
    deploymentLogs,
    pagination,
    refreshLogs,
    fetchActivityLogs,
    fetchDeploymentLogs,
    loadMoreActivity,
    loadMoreDeployment,
  };
};

// Helper functions to transform backend data
function getLogLevel(action: string): LogLevel {
  const errorActions = ['website_deleted', 'database_deleted', 'subscription_cancelled'];
  const warningActions = ['ssl_expired', 'backup_failed'];

  if (errorActions.some((a) => action.includes(a))) return 'error';
  if (warningActions.some((a) => action.includes(a))) return 'warning';
  return 'info';
}

function getLogType(action: string): string {
  if (action.includes('website')) return 'website';
  if (action.includes('database')) return 'database';
  if (action.includes('ssl')) return 'ssl';
  if (action.includes('subscription')) return 'system';
  return 'system';
}

function getLogSource(action: string, metadata: ActivityLog['metadata']): string {
  if (metadata?.website_name) return metadata.website_name;
  if (metadata?.database_name) return metadata.database_name;
  if (metadata?.domain_name) return metadata.domain_name;
  if (action.includes('subscription')) return 'Subscription';
  return 'System';
}

function getDeploymentLevel(status: string): LogLevel {
  if (status === 'failed') return 'error';
  if (status === 'cancelled') return 'warning';
  return 'info';
}

function getDeploymentMessage(deployment: DeploymentLog): string {
  const messages: Record<string, string> = {
    queued: 'Deployment queued',
    building: 'Building website',
    deploying: 'Deploying website',
    success: 'Website deployed successfully',
    failed: 'Deployment failed',
    cancelled: 'Deployment cancelled',
  };

  const baseMessage = messages[deployment.status] || 'Deployment status updated';

  if (deployment.commit_message) {
    return `${baseMessage}: ${deployment.commit_message}`;
  }

  return baseMessage;
}

export default useLogs;

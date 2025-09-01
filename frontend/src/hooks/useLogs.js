import { useState, useEffect } from 'react';
import { hostingApi } from '../utils/hostingApi.js';

export const useLogs = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [deploymentLogs, setDeploymentLogs] = useState([]);
  const [pagination, setPagination] = useState({
    activity: { count: 0, next: null, previous: null },
    deployment: { count: 0, next: null, previous: null }
  });

  const fetchActivityLogs = async (params = {}) => {
    try {
      const response = await hostingApi.getActivityLog(params);
      setActivityLogs(response.results || response || []);
      setPagination(prev => ({
        ...prev,
        activity: {
          count: response.count || 0,
          next: response.next || null,
          previous: response.previous || null
        }
      }));
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      setError('Failed to load activity logs');
    }
  };

  const fetchDeploymentLogs = async (params = {}) => {
    try {
      const response = await hostingApi.getDeploymentLogs(null, params);
      setDeploymentLogs(response.results || response || []);
      setPagination(prev => ({
        ...prev,
        deployment: {
          count: response.count || 0,
          next: response.next || null,
          previous: response.previous || null
        }
      }));
    } catch (err) {
      console.error('Error fetching deployment logs:', err);
      setError('Failed to load deployment logs');
    }
  };

  const fetchAllLogs = async (params = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchActivityLogs(params),
        fetchDeploymentLogs(params)
      ]);
    } catch (err) {
      setError('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const refreshLogs = () => {
    fetchAllLogs();
  };

  const loadMoreActivity = async () => {
    if (!pagination.activity.next) return;
    // Determine next page number
    const url = new URL(pagination.activity.next, window.location.origin);
    const page = url.searchParams.get('page');
    const response = await hostingApi.getActivityLog({ page });
    setActivityLogs(prev => [...prev, ...(response.results || [])]);
    setPagination(prev => ({
      ...prev,
      activity: {
        count: response.count || 0,
        next: response.next || null,
        previous: response.previous || null
      }
    }));
  };

  const loadMoreDeployment = async () => {
    if (!pagination.deployment.next) return;
    const url = new URL(pagination.deployment.next, window.location.origin);
    const page = url.searchParams.get('page');
    const response = await hostingApi.getDeploymentLogs(null, { page });
    setDeploymentLogs(prev => [...prev, ...(response.results || [])]);
    setPagination(prev => ({
      ...prev,
      deployment: {
        count: response.count || 0,
        next: response.next || null,
        previous: response.previous || null
      }
    }));
  };

  useEffect(() => {
    fetchAllLogs();
  }, []);

  // Transform logs into unified format for the UI
  const transformedLogs = [
    // Activity logs
    ...activityLogs.map(log => ({
      id: `activity-${log.action}-${log.created_at}`,
      timestamp: log.created_at,
      level: getLogLevel(log.action),
      type: getLogType(log.action),
      source: getLogSource(log.action, log.metadata),
      message: log.description,
      details: log.metadata?.details || '',
      original: log
    })),
    // Deployment logs
    ...deploymentLogs.map(deployment => ({
      id: `deployment-${deployment.id}`,
      timestamp: deployment.started_at,
      level: getDeploymentLevel(deployment.status),
      type: 'website',
      source: deployment.website?.name || 'Unknown Website',
      message: getDeploymentMessage(deployment),
      details: deployment.error_message || deployment.build_log || '',
      original: deployment
    }))
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

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
  loadMoreDeployment
  };
};

// Helper functions to transform backend data
function getLogLevel(action) {
  const errorActions = ['website_deleted', 'database_deleted', 'subscription_cancelled'];
  const warningActions = ['ssl_expired', 'backup_failed'];
  
  if (errorActions.some(a => action.includes(a))) return 'error';
  if (warningActions.some(a => action.includes(a))) return 'warning';
  return 'info';
}

function getLogType(action) {
  if (action.includes('website')) return 'website';
  if (action.includes('database')) return 'database';
  if (action.includes('ssl')) return 'ssl';
  if (action.includes('subscription')) return 'system';
  return 'system';
}

function getLogSource(action, metadata) {
  if (metadata?.website_name) return metadata.website_name;
  if (metadata?.database_name) return metadata.database_name;
  if (metadata?.domain_name) return metadata.domain_name;
  if (action.includes('subscription')) return 'Subscription';
  return 'System';
}

function getDeploymentLevel(status) {
  if (status === 'failed') return 'error';
  if (status === 'cancelled') return 'warning';
  if (status === 'success') return 'info';
  return 'info';
}

function getDeploymentMessage(deployment) {
  const messages = {
    queued: 'Deployment queued',
    building: 'Building website',
    deploying: 'Deploying website',
    success: 'Website deployed successfully',
    failed: 'Deployment failed',
    cancelled: 'Deployment cancelled'
  };
  
  const baseMessage = messages[deployment.status] || 'Deployment status updated';
  
  if (deployment.commit_message) {
    return `${baseMessage}: ${deployment.commit_message}`;
  }
  
  return baseMessage;
}

export default useLogs;

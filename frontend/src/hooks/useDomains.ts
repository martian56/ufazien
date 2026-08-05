import { useCallback, useEffect, useState } from 'react';
import { hostingApi, type Domain } from '../utils/hostingApi';
import { toList } from '../lib/api/types';
import { errorMessage } from '../lib/api/errors';

export const useDomains = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [availableDomains, setAvailableDomains] = useState<Domain[]>([]);

  const fetchDomains = useCallback(async () => {
    try {
      setDomains(toList(await hostingApi.getDomains()));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load domains'));
    }
  }, []);

  const fetchAvailableDomains = useCallback(async () => {
    try {
      setAvailableDomains(toList(await hostingApi.getAvailableDomains()));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load available domains'));
    }
  }, []);

  const fetchAllDomains = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([fetchDomains(), fetchAvailableDomains()]);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load domain data'));
    } finally {
      setLoading(false);
    }
  }, [fetchDomains, fetchAvailableDomains]);

  const createDomain = async (domainData: Record<string, unknown>) => {
    const newDomain = await hostingApi.createDomain(domainData);
    setDomains((prev) => [newDomain, ...prev]);
    setAvailableDomains((prev) => [newDomain, ...prev]);
    return newDomain;
  };

  const deleteDomain = async (domainId: number) => {
    await hostingApi.deleteDomain(domainId);
    setDomains((prev) => prev.filter((domain) => domain.id !== domainId));
    setAvailableDomains((prev) => prev.filter((domain) => domain.id !== domainId));
    return true;
  };

  const updateDomain = async (domainId: number, updateData: Partial<Domain>) => {
    const updatedDomain = await hostingApi.updateDomain(domainId, updateData);
    const replace = (prev: Domain[]) =>
      prev.map((domain) => (domain.id === domainId ? updatedDomain : domain));
    setDomains(replace);
    setAvailableDomains(replace);
    return updatedDomain;
  };

  const checkDomainAvailability = (domainName: string) => {
    // Check if domain name already exists
    const existingDomain = domains.find((domain) => domain.name === domainName);
    if (existingDomain) {
      // Check if it's available (not used by any website)
      return availableDomains.some((domain) => domain.id === existingDomain.id);
    }
    return true; // New domain, available to create
  };

  const refreshDomains = () => {
    fetchAllDomains();
  };

  useEffect(() => {
    fetchAllDomains();
  }, [fetchAllDomains]);

  return {
    loading,
    error,
    domains,
    availableDomains,
    fetchDomains,
    fetchAvailableDomains,
    createDomain,
    deleteDomain,
    updateDomain,
    checkDomainAvailability,
    refreshDomains,
  };
};

export default useDomains;

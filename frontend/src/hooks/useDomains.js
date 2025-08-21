import { useState, useEffect } from 'react';
import { hostingApi } from '../utils/hostingApi.js';

export const useDomains = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [domains, setDomains] = useState([]);
  const [availableDomains, setAvailableDomains] = useState([]);

  const fetchDomains = async () => {
    try {
      const response = await hostingApi.getDomains();
      setDomains(response.results || response || []);
    } catch (err) {
      console.error('Error fetching domains:', err);
      setError('Failed to load domains');
    }
  };

  const fetchAvailableDomains = async () => {
    try {
      const response = await hostingApi.getAvailableDomains();
      setAvailableDomains(response.results || response || []);
    } catch (err) {
      console.error('Error fetching available domains:', err);
      setError('Failed to load available domains');
    }
  };

  const fetchAllDomains = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchDomains(),
        fetchAvailableDomains()
      ]);
    } catch (err) {
      setError('Failed to load domain data');
    } finally {
      setLoading(false);
    }
  };

  const createDomain = async (domainData) => {
    try {
      const newDomain = await hostingApi.createDomain(domainData);
      setDomains(prev => [newDomain, ...prev]);
      setAvailableDomains(prev => [newDomain, ...prev]);
      return newDomain;
    } catch (err) {
      console.error('Error creating domain:', err);
      throw err;
    }
  };

  const deleteDomain = async (domainId) => {
    try {
      await hostingApi.deleteDomain(domainId);
      setDomains(prev => prev.filter(domain => domain.id !== domainId));
      setAvailableDomains(prev => prev.filter(domain => domain.id !== domainId));
      return true;
    } catch (err) {
      console.error('Error deleting domain:', err);
      throw err;
    }
  };

  const updateDomain = async (domainId, updateData) => {
    try {
      const updatedDomain = await hostingApi.updateDomain(domainId, updateData);
      setDomains(prev => prev.map(domain => 
        domain.id === domainId ? updatedDomain : domain
      ));
      setAvailableDomains(prev => prev.map(domain => 
        domain.id === domainId ? updatedDomain : domain
      ));
      return updatedDomain;
    } catch (err) {
      console.error('Error updating domain:', err);
      throw err;
    }
  };

  const checkDomainAvailability = (domainName) => {
    // Check if domain name already exists
    const existingDomain = domains.find(domain => domain.name === domainName);
    if (existingDomain) {
      // Check if it's available (not used by any website)
      return availableDomains.some(domain => domain.id === existingDomain.id);
    }
    return true; // New domain, available to create
  };

  const refreshDomains = () => {
    fetchAllDomains();
  };

  useEffect(() => {
    fetchAllDomains();
  }, []);

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
    refreshDomains
  };
};

export default useDomains;

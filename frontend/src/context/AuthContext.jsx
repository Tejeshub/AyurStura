/**
 * Auth context - holds user, loading, login, register, logout.
 * Refreshes access token when needed (401 or on mount) so user stays logged in.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearUser = useCallback(() => {
    setUser(null);
  }, []);

  useEffect(() => {
    api.setOnUnauthorized(clearUser);
  }, [clearUser]);

  // On mount: try to get current user (uses access token cookie). If 401, try refresh then getMe again.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const me = await api.getMe();
        if (!cancelled) setUser(me);
      } catch (err) {
        if (err.response?.status === 401) {
          try {
            await api.refresh();
            const me = await api.getMe();
            if (!cancelled) setUser(me);
          } catch (_) {
            if (!cancelled) setUser(null);
          }
        } else {
          if (!cancelled) setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (data) => {
    await api.login(data);
    const me = await api.getMe();
    setUser(me);
    return me;
  }, []);

  const register = useCallback(async (data) => {
    await api.register(data);
    const me = await api.getMe();
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch (_) {}
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

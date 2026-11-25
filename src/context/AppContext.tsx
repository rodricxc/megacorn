import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { calculateEquityAllocation } from '../lib/equity';
import { dataService } from '../services';
import {
  DEFAULT_PUBLIC_CONFIG,
  type AuthUser,
} from '../services/dataService';
import type {
  AdminConfig,
  AuditLogEntry,
  BoardEntry,
  DrawResult,
  LotteryGame,
  PaymentConfig,
  PoolStats,
  PublicConfig,
  UserProfile,
} from '../types';
import { AppContext, type AppContextValue } from './useApp';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [publicConfig, setPublicConfig] = useState<PublicConfig>(
    DEFAULT_PUBLIC_CONFIG
  );
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [adminConfig, setAdminConfig] = useState<AdminConfig | null>(null);
  const [boardEntries, setBoardEntries] = useState<BoardEntry[]>([]);
  const [poolStats, setPoolStats] = useState<PoolStats>({
    pendingApprovalCount: 0,
    approvedCount: 0,
  });
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [games, setGames] = useState<LotteryGame[]>([]);
  const [drawResult, setDrawResult] = useState<DrawResult>({
    numbers: [],
    updatedAt: null,
    updatedBy: null,
  });
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    const unsub = dataService.onAuthChange((user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const refreshAll = useCallback(async () => {
    setDataLoading(true);
    try {
      const pub = await dataService.getPublicConfig();
      setPublicConfig(pub);

      if (!authUser) {
        setProfile(null);
        setPaymentConfig(null);
        setAdminConfig(null);
        setBoardEntries([]);
        setPoolStats({ pendingApprovalCount: 0, approvedCount: 0 });
        setAllUsers([]);
        setGames([]);
        setDrawResult({ numbers: [], updatedAt: null, updatedBy: null });
        setAuditLogs([]);
        return;
      }

      const userProf = await dataService.getUserProfile(authUser.uid);
      setProfile(userProf);

      const canReadPoolData =
        Boolean(userProf?.isModerator) ||
        userProf?.approvalStatus === 'pending' ||
        userProf?.approvalStatus === 'approved';

      if (canReadPoolData) {
        const [pay, board, stats, gameList, draw] = await Promise.all([
          dataService.getPaymentConfig(),
          dataService.getBoardEntries(),
          dataService.getPoolStats(),
          dataService.getGames(),
          dataService.getDrawResult(),
        ]);
        setPaymentConfig(pay);
        setBoardEntries(board);
        setPoolStats(stats);
        setGames(gameList);
        setDrawResult(draw);
      } else {
        setPaymentConfig(null);
        setBoardEntries([]);
        setPoolStats({ pendingApprovalCount: 0, approvedCount: 0 });
        setGames([]);
        setDrawResult({ numbers: [], updatedAt: null, updatedBy: null });
      }

      if (userProf?.isModerator) {
        const [adm, users, logs] = await Promise.all([
          dataService.getAdminConfig(),
          dataService.getAllUsers(),
          dataService.getAuditLogs(),
        ]);
        setAdminConfig(adm);
        setAllUsers(users);
        setAuditLogs(logs);
      } else {
        setAdminConfig(null);
        setAllUsers([]);
        setAuditLogs([]);
      }
    } finally {
      setDataLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        void refreshAll();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, refreshAll]);

  const boardEquity = useMemo(() => {
    const source = publicConfig.flags.poolClosed
      ? boardEntries
          .filter((b) => b.paymentStatus === 'confirmed' && b.paidQuotas > 0)
          .map((b) => ({
            uid: b.uid,
            displayName: b.displayName,
            requestedQuotas: b.paidQuotas,
            createdAt: b.createdAt,
          }))
      : boardEntries.map((b) => ({
          uid: b.uid,
          displayName: b.displayName,
          requestedQuotas: b.requestedQuotas,
          createdAt: b.createdAt,
        }));
    return calculateEquityAllocation(source, publicConfig.totalQuotas);
  }, [boardEntries, publicConfig.flags.poolClosed, publicConfig.totalQuotas]);

  const signOut = useCallback(async () => {
    await dataService.signOut();
    setProfile(null);
    setAdminConfig(null);
    setAllUsers([]);
    setAuditLogs([]);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      isDemoMode: dataService.isDemoMode,
      authLoading,
      dataLoading,
      authUser,
      profile,
      publicConfig,
      paymentConfig,
      adminConfig,
      boardEntries,
      poolStats,
      allUsers,
      games,
      drawResult,
      auditLogs,
      boardEquity,
      refreshAll,
      signOut,
    }),
    [
      authLoading,
      dataLoading,
      authUser,
      profile,
      publicConfig,
      paymentConfig,
      adminConfig,
      boardEntries,
      poolStats,
      allUsers,
      games,
      drawResult,
      auditLogs,
      boardEquity,
      refreshAll,
      signOut,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

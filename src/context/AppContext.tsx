import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  EquityCalculationResult,
  LotteryGame,
  PaymentConfig,
  PoolStats,
  PublicConfig,
  UserProfile,
} from '../types';

interface AppContextValue {
  isDemoMode: boolean;
  authLoading: boolean;
  dataLoading: boolean;
  authUser: AuthUser | null;
  profile: UserProfile | null;
  publicConfig: PublicConfig;
  paymentConfig: PaymentConfig | null;
  adminConfig: AdminConfig | null;
  boardEntries: BoardEntry[];
  poolStats: PoolStats;
  allUsers: UserProfile[];
  games: LotteryGame[];
  drawResult: DrawResult;
  auditLogs: AuditLogEntry[];
  boardEquity: EquityCalculationResult;
  refreshAll: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

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

      const [userProf, board, stats, gameList, draw] = await Promise.all([
        dataService.getUserProfile(authUser.uid),
        dataService.getBoardEntries(),
        dataService.getPoolStats(),
        dataService.getGames(),
        dataService.getDrawResult(),
      ]);

      setProfile(userProf);
      setBoardEntries(board);
      setPoolStats(stats);
      setGames(gameList);
      setDrawResult(draw);

      if (userProf) {
        const pay = await dataService.getPaymentConfig();
        setPaymentConfig(pay);
      } else {
        setPaymentConfig(null);
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
    if (!authLoading) {
      void refreshAll();
    }
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

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider');
  return ctx;
}

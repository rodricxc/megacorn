import { createContext, useContext } from 'react';
import type { AuthUser } from '../services/dataService';
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

export interface AppContextValue {
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

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider');
  return ctx;
}

import type { TourStep } from './types';

export type HRRole = 'org-admin' | 'manager' | 'employee' | 'partner-admin';

export interface SetupContext {
  prisma: {
    $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Promise<T>;
    $executeRawUnsafe(query: string, ...values: any[]): Promise<number>;
  };
  orgId: string;
  userMap: Map<string, string>;
}

export interface HRDocEntry {
  id: string;
  title: string;
  description: string;
  role: HRRole;
  route: string;
  tour: TourStep[];
  setup?: (ctx: SetupContext) => Promise<void>;
  /**
   * When true, `hr-runner` does not call `loginInPage` before the tour; the tour must sign in
   * (used for CSV rows that document the login flow).
   */
  skipPreLogin?: boolean;
}

import type { LiquidGlassPrefs } from '@/lib/ui/liquid-glass-prefs';

/** Stored in `users.ui_preferences` JSON */
export type UserUiPreferences = {
  liquidGlass?: Partial<LiquidGlassPrefs>;
  /** Per-workspace active brand filter: kit id, or `null` / omitted key = show all brands */
  activeBrandKitByWorkspace?: Record<string, string | null>;
};

export type UserPreferencesDto = {
  preferredWorkspaceId: string | null;
  recordingMicEnabled: boolean;
  uiPreferences: UserUiPreferences;
};

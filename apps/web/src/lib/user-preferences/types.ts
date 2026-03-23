import type { LiquidGlassPrefs } from '@/lib/ui/liquid-glass-prefs';

/** Stored in `users.ui_preferences` JSON */
export type UserUiPreferences = {
  liquidGlass?: Partial<LiquidGlassPrefs>;
};

export type UserPreferencesDto = {
  preferredWorkspaceId: string | null;
  recordingMicEnabled: boolean;
  uiPreferences: UserUiPreferences;
};

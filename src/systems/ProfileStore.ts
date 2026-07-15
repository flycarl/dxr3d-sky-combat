import {
  AIRCRAFT_STYLES,
  DEFAULT_CUSTOMIZATION,
  type AircraftCustomization,
  type AircraftPartId,
  type AircraftStyleId,
  isAircraftStyleId,
} from './Customization';

export type PlayerProfile = {
  coins: number;
  customization: AircraftCustomization;
};

export const PROFILE_STORAGE_KEY = 'dxr3d-player-profile-v1';

export const COIN_REWARDS = {
  pickup: 5,
  aiKill: 25,
  playerKill: 100,
} as const;

export const DEFAULT_PROFILE: PlayerProfile = {
  coins: 0,
  customization: { ...DEFAULT_CUSTOMIZATION },
};

function cloneProfile(profile: PlayerProfile): PlayerProfile {
  return {
    coins: Math.max(0, Math.floor(profile.coins)),
    customization: { ...profile.customization },
  };
}

function normalizeProfile(value: unknown): PlayerProfile {
  if (!value || typeof value !== 'object') return cloneProfile(DEFAULT_PROFILE);
  const candidate = value as Partial<PlayerProfile>;
  const customization = { ...DEFAULT_CUSTOMIZATION };
  const rawCustomization = candidate.customization;
  if (rawCustomization && typeof rawCustomization === 'object') {
    for (const part of Object.keys(customization) as AircraftPartId[]) {
      const rawStyle = (rawCustomization as Record<string, unknown>)[part];
      if (typeof rawStyle === 'string' && isAircraftStyleId(rawStyle)) customization[part] = rawStyle;
    }
  }
  return {
    coins: typeof candidate.coins === 'number' && Number.isFinite(candidate.coins) ? Math.max(0, Math.floor(candidate.coins)) : 0,
    customization,
  };
}

export function loadProfile(storage?: Storage): PlayerProfile {
  try {
    const raw = (storage ?? window.localStorage).getItem(PROFILE_STORAGE_KEY);
    if (!raw) return cloneProfile(DEFAULT_PROFILE);
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return cloneProfile(DEFAULT_PROFILE);
  }
}

export function saveProfile(profile: PlayerProfile, storage?: Storage): void {
  try {
    (storage ?? window.localStorage).setItem(PROFILE_STORAGE_KEY, JSON.stringify(cloneProfile(profile)));
  } catch {
    // Continue with the in-memory profile when browser storage is unavailable.
  }
}

export function awardCoins(profile: PlayerProfile, amount: number): PlayerProfile {
  return {
    ...profile,
    coins: Math.max(0, Math.floor(profile.coins + Math.max(0, amount))),
  };
}

export function spendForCustomization(
  profile: PlayerProfile,
  part: AircraftPartId,
  style: AircraftStyleId,
): { profile: PlayerProfile; ok: boolean; reason: 'applied' | 'insufficient-coins' | 'invalid-style' } {
  const styleDefinition = AIRCRAFT_STYLES[style];
  if (!styleDefinition) return { profile, ok: false, reason: 'invalid-style' };
  const cost = styleDefinition.cost;
  if (profile.coins < cost) return { profile, ok: false, reason: 'insufficient-coins' };
  return {
    profile: {
      coins: profile.coins - cost,
      customization: {
        ...profile.customization,
        [part]: style,
      },
    },
    ok: true,
    reason: 'applied',
  };
}

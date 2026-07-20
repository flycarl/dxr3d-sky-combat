import {
  AIRCRAFT_SKINS,
  DEFAULT_SKIN,
  type AircraftSkinId,
  isAircraftSkinId,
} from './Customization';

export type PlayerProfile = {
  playerName: string;
  coins: number;
  selectedSkin: AircraftSkinId;
  ownedSkins: AircraftSkinId[];
};

export const PROFILE_STORAGE_KEY = 'dxr3d-player-profile-v1';

export const COIN_REWARDS = {
  pickup: 5,
  aiKill: 25,
  playerKill: 100,
} as const;

export const DEFAULT_PROFILE: PlayerProfile = {
  playerName: '飞行员',
  coins: 0,
  selectedSkin: DEFAULT_SKIN,
  ownedSkins: [DEFAULT_SKIN],
};

export function normalizePlayerName(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_PROFILE.playerName;
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, 12);
  return normalized || DEFAULT_PROFILE.playerName;
}

function getStorage(storage?: Storage): Storage | null {
  try {
    return storage ?? window.localStorage;
  } catch {
    return null;
  }
}

function uniqueSkins(values: AircraftSkinId[]): AircraftSkinId[] {
  return Array.from(new Set([DEFAULT_SKIN, ...values]));
}

function cloneProfile(profile: PlayerProfile): PlayerProfile {
  const selectedSkin = isAircraftSkinId(profile.selectedSkin) ? profile.selectedSkin : DEFAULT_SKIN;
  return {
    playerName: normalizePlayerName(profile.playerName),
    coins: Math.max(0, Math.floor(profile.coins)),
    selectedSkin,
    ownedSkins: uniqueSkins(profile.ownedSkins.filter(isAircraftSkinId).concat(selectedSkin)),
  };
}

function migrateOldCustomization(value: Record<string, unknown>): AircraftSkinId {
  const oldCustomization = value.customization;
  if (!oldCustomization || typeof oldCustomization !== 'object') return DEFAULT_SKIN;
  const bodyStyle = (oldCustomization as Record<string, unknown>).body;
  return typeof bodyStyle === 'string' && isAircraftSkinId(bodyStyle) ? bodyStyle : DEFAULT_SKIN;
}

function normalizeProfile(value: unknown): PlayerProfile {
  if (!value || typeof value !== 'object') return cloneProfile(DEFAULT_PROFILE);
  const candidate = value as Partial<PlayerProfile> & Record<string, unknown>;
  const migratedSkin = migrateOldCustomization(candidate);
  const selectedSkin =
    typeof candidate.selectedSkin === 'string' && isAircraftSkinId(candidate.selectedSkin)
      ? candidate.selectedSkin
      : migratedSkin;
  const ownedSkins = Array.isArray(candidate.ownedSkins)
    ? candidate.ownedSkins.filter((skin): skin is AircraftSkinId => typeof skin === 'string' && isAircraftSkinId(skin))
    : [selectedSkin];

  return cloneProfile({
    playerName: normalizePlayerName(candidate.playerName),
    coins: typeof candidate.coins === 'number' && Number.isFinite(candidate.coins) ? candidate.coins : 0,
    selectedSkin,
    ownedSkins,
  });
}

export function loadProfile(storage?: Storage): PlayerProfile {
  try {
    const resolvedStorage = getStorage(storage);
    const raw = resolvedStorage?.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return cloneProfile(DEFAULT_PROFILE);
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return cloneProfile(DEFAULT_PROFILE);
  }
}

export function saveProfile(profile: PlayerProfile, storage?: Storage): void {
  try {
    getStorage(storage)?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(cloneProfile(profile)));
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

export function selectOrBuySkin(
  profile: PlayerProfile,
  skin: AircraftSkinId,
): { profile: PlayerProfile; ok: boolean; reason: 'selected' | 'purchased' | 'insufficient-coins' | 'invalid-skin' } {
  const skinDefinition = AIRCRAFT_SKINS[skin];
  if (!skinDefinition) return { profile, ok: false, reason: 'invalid-skin' };
  if (profile.ownedSkins.includes(skin)) {
    return {
      profile: {
        ...profile,
        selectedSkin: skin,
        ownedSkins: uniqueSkins(profile.ownedSkins),
      },
      ok: true,
      reason: 'selected',
    };
  }
  if (profile.coins < skinDefinition.cost) return { profile, ok: false, reason: 'insufficient-coins' };
  return {
    profile: {
      ...profile,
      coins: profile.coins - skinDefinition.cost,
      selectedSkin: skin,
      ownedSkins: uniqueSkins([...profile.ownedSkins, skin]),
    },
    ok: true,
    reason: 'purchased',
  };
}

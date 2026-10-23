// ============================================================================
// Due by Dusk · v0.6.00 — TypeScript Interfaces & Domain Types (`src/types/game.ts`)
// ============================================================================

export type ArthurAnimState = 'idle' | 'smug' | 'demand' | 'anger' | 'shock';

export interface CityData {
  id: string;
  name: string;
  province: string;
  x: number;
  y: number;
  mul: number;
  rival: string;
  record: number;
  buff: string;
  desc: string;
  subTheme: string;
  crops: string[];
}

export interface GeographicFeature {
  type: 'water' | 'river' | 'mountain';
  name: string;
  lx?: number;
  ly?: number;
  path: string;
}

export interface CountryData {
  code: 'CA' | 'BR' | 'FR' | 'JP';
  name: string;
  subtitle: string;
  flag: string;
  envStyle: string;
  worldLabelX: number;
  worldLabelY: number;
  worldPath: string;
  countryOutline: string;
  geographicFeatures: GeographicFeature[];
  cities: CityData[];
}

export interface LockedCountryData {
  code: string;
  name: string;
  labelX: number;
  labelY: number;
  path: string;
}

export interface CropDef {
  name: string;
  hp: number;
  val: number;
  r: number;
  top: number;
  color: string;
  light: string;
  shade: string;
  flesh: string;
  leaf: string;
  leafDark: string;
  juice: string;
  origin: string;
  unlockBill?: number;
}

export interface SkillNodeData {
  id: string;
  branch: 'core' | 'reap' | 'soil' | 'gold';
  name: string;
  x: number;
  y: number;
  cost: number;
  reqs: string[];
  reqMode?: 'all' | 'any';
  icon: string;
  summary: string;
  desc: string;
}

export interface MetaState {
  grit: number;
  diamonds: number;
  learnedSkills: string[];
  heir: Record<string, number>;
  lost: number;
  owned: number;
  best: number;
  sound: boolean;
  country: 'CA' | 'BR' | 'FR' | 'JP';
  cityId: string;
  cityRecords: Record<string, number>;
  cityOwned: Record<string, boolean>;
}

export interface FarmState {
  no: number;
  day: number;
  cash: number;
  shed: Record<string, number>;
  perks: string[];
  bill: number;
  due: number;
  paidTotal: number;
  billsPaid: number;
  lastEarn: number;
  lastCount: number;
  played: boolean;
  earned: number;
  harvested: number;
  pendingPerks: string[] | null;
  lastBest: number;
  lastBonus: number;
  bestChain: number;
}

export interface MigrationReport {
  fromVersion: number;
  toVersion: number;
  migratedAt: string;
  gritRefundedFromLegacySkills: number;
  legacySkillsConverted: string[];
  diamondsGrantedFromMilestones: number;
  backupKey: string;
  notes: string[];
}

export interface SavePayloadV2 {
  schemaVersion: 2;
  migrationId: string;
  migrationReport?: MigrationReport;
  meta: MetaState;
  farm: FarmState;
}

/**
 * Seed data for `LogisticsZone` table.
 *
 * Maps Indian pincode 3-digit prefixes to delivery zones + ETA. The seed
 * runs idempotently the first time the logistics service boots and inserts
 * any missing rows. Real shipping integrations (Shiprocket / Delhivery)
 * will replace this with live serviceability API calls in Phase 2.
 */
export interface LogisticsZoneSeed {
  pincodePrefix: string;
  zone: string;
  etaMinDays: number;
  etaMaxDays: number;
  codAvailable: boolean;
  state: string;
  city?: string;
}

export const SEED_ZONES: LogisticsZoneSeed[] = [
  { pincodePrefix: '110', zone: 'NEAR', etaMinDays: 2, etaMaxDays: 3, codAvailable: true, state: 'Delhi', city: 'New Delhi' },
  { pincodePrefix: '122', zone: 'NEAR', etaMinDays: 2, etaMaxDays: 3, codAvailable: true, state: 'Haryana', city: 'Gurgaon' },
  { pincodePrefix: '201', zone: 'NEAR', etaMinDays: 2, etaMaxDays: 4, codAvailable: true, state: 'Uttar Pradesh', city: 'Noida' },
  { pincodePrefix: '400', zone: 'NEAR', etaMinDays: 2, etaMaxDays: 3, codAvailable: true, state: 'Maharashtra', city: 'Mumbai' },
  { pincodePrefix: '411', zone: 'NEAR', etaMinDays: 2, etaMaxDays: 3, codAvailable: true, state: 'Maharashtra', city: 'Pune' },
  { pincodePrefix: '500', zone: 'MID', etaMinDays: 3, etaMaxDays: 4, codAvailable: true, state: 'Telangana', city: 'Hyderabad' },
  { pincodePrefix: '560', zone: 'MID', etaMinDays: 3, etaMaxDays: 5, codAvailable: true, state: 'Karnataka', city: 'Bangalore' },
  { pincodePrefix: '600', zone: 'MID', etaMinDays: 3, etaMaxDays: 5, codAvailable: true, state: 'Tamil Nadu', city: 'Chennai' },
  { pincodePrefix: '700', zone: 'FAR', etaMinDays: 5, etaMaxDays: 7, codAvailable: false, state: 'West Bengal', city: 'Kolkata' },
  { pincodePrefix: '781', zone: 'FAR', etaMinDays: 6, etaMaxDays: 8, codAvailable: false, state: 'Assam', city: 'Guwahati' },
];

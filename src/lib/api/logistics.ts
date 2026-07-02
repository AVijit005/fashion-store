import { apiClient } from "./client";

export interface EtaResult {
  pincode: string;
  zone: string;
  etaMinDays: number;
  etaMaxDays: number;
  codAvailable: boolean;
  source?: "db" | "fallback";
}

export const logisticsApi = {
  /**
   * Phase 1 (audit item 1.4): replaces the PDP's previous fake
   * `setTimeout`-based ETA. Returns the zone + delivery window + COD
   * availability for a 6-digit Indian pincode. Cached on the client for
   * 24h (per-pincode serviceability rarely changes).
   */
  getEta: (pincode: string) =>
    apiClient.get<EtaResult>("/logistics/eta", { pincode }),
};

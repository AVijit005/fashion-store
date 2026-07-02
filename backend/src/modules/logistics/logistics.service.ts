import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { SEED_ZONES } from './logistics.zone-seed';

export interface EtaResult {
  pincode: string;
  zone: string;
  etaMinDays: number;
  etaMaxDays: number;
  codAvailable: boolean;
  source: 'db' | 'fallback';
}

/**
 * Stub logistics service. Phase 1 (audit item 1.4): replaces the PDP's
 * `setTimeout`-based fake ETA with real backend data.
 *
 * Resolution strategy:
 *   1. Look up the 3-digit pincode prefix in the seeded LogisticsZone table.
 *   2. If not found, fall back to a coarse first-digit heuristic (NEAR / MID / FAR).
 *   3. If the first digit is 9 (NE islands / Andaman), the pincode is unserviceable.
 *
 * Phase 2 will swap the DB lookup for a real Shiprocket/Delhivery
 * serviceability API call. The controller surface (GET /logistics/eta?pincode=…)
 * stays the same.
 */
@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);
  private seeded = false;

  constructor(private readonly prisma: PrismaService) {}

  private async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    const count = await this.prisma.logisticsZone.count();
    if (count === 0) {
      await this.prisma.logisticsZone.createMany({ data: SEED_ZONES });
      this.logger.log(`Seeded ${SEED_ZONES.length} logistics zones`);
    }
    this.seeded = true;
  }

  async getEta(pincode: string): Promise<EtaResult> {
    if (!/^\d{6}$/.test(pincode)) {
      throw new BadRequestException('pincode must be 6 digits');
    }
    await this.ensureSeeded();

    const prefix = pincode.slice(0, 3);
    const exact = await this.prisma.logisticsZone.findUnique({
      where: { pincodePrefix: prefix },
    });
    if (exact) {
      return {
        pincode,
        zone: exact.zone,
        etaMinDays: exact.etaMinDays,
        etaMaxDays: exact.etaMaxDays,
        codAvailable: exact.codAvailable,
        source: 'db',
      };
    }

    const fallback = this.fallbackForPrefix(prefix);
    if (!fallback) {
      throw new NotFoundException(`Unserviceable pincode: ${pincode}`);
    }
    return { pincode, ...fallback, source: 'fallback' };
  }

  private fallbackForPrefix(
    prefix: string,
  ): Omit<EtaResult, 'pincode' | 'source'> | null {
    const first = prefix[0];
    if (['1', '2', '3', '4'].includes(first)) {
      return { zone: 'NEAR', etaMinDays: 3, etaMaxDays: 5, codAvailable: true };
    }
    if (['5', '6'].includes(first)) {
      return { zone: 'MID', etaMinDays: 4, etaMaxDays: 6, codAvailable: true };
    }
    if (['7', '8'].includes(first)) {
      return { zone: 'FAR', etaMinDays: 6, etaMaxDays: 8, codAvailable: false };
    }
    // First digit 9 = NE / Andaman — not serviceable by the stub.
    return null;
  }
}

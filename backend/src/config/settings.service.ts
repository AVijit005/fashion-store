import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

const CACHE_TTL_MS = 30_000;

export interface AppSettings {
  tax: {
    gstPercent: number;
    hsnCode: string;
  };
  shipping: {
    freeThreshold: number;
    flatRate: number;
  };
  studio: {
    customPrintMarkup: number;
  };
  refunds: {
    autoApproveWindowDays: number;
  };
}

const DEFAULTS: AppSettings = {
  tax: { gstPercent: 18, hsnCode: '6109' },
  shipping: { freeThreshold: 999, flatRate: 79 },
  studio: { customPrintMarkup: 200 },
  refunds: { autoApproveWindowDays: 15 },
};

/**
 * SettingsService — typed accessors over the `global_settings` table.
 *
 * Used to replace hardcoded constants that previously lived inline:
 *   - 18% GST (orders.service.ts)
 *   - ₹79 flat / ₹999 free shipping (orders.service.ts)
 *   - +₹200 custom-print markup (cart.service.ts)
 *   - 15-day return window (returns.service.ts — Phase 1B)
 *
 * Settings are cached in-memory for 30s. Admin endpoints can call
 * `invalidate()` after writing a new value to force a fresh read.
 *
 * Defaults are seeded on first boot so the service works out-of-the-box
 * even on an empty database.
 */
@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private cache: { value: AppSettings; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
  }

  private async seedDefaults(): Promise<void> {
    const rows: Array<[string, unknown]> = [
      ['tax.gstPercent', DEFAULTS.tax.gstPercent],
      ['tax.hsnCode', DEFAULTS.tax.hsnCode],
      ['shipping.freeThreshold', DEFAULTS.shipping.freeThreshold],
      ['shipping.flatRate', DEFAULTS.shipping.flatRate],
      ['studio.customPrintMarkup', DEFAULTS.studio.customPrintMarkup],
      ['refunds.autoApproveWindowDays', DEFAULTS.refunds.autoApproveWindowDays],
    ];
    try {
      for (const [key, value] of rows) {
        await this.prisma.globalSetting.upsert({
          where: { key },
          update: {},
          create: { key, value: value as object },
        });
      }
      this.logger.log(`Seeded ${rows.length} global settings rows`);
    } catch (e: any) {
      if (e?.code === 'P2021') {
        this.logger.warn('Skipping default settings seed: table does not exist yet.');
      } else {
        throw e;
      }
    }
  }

  async getAll(): Promise<AppSettings> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.value;
    }
    const rows = await this.prisma.globalSetting.findMany();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const value: AppSettings = {
      tax: {
        gstPercent: Number(map.get('tax.gstPercent') ?? DEFAULTS.tax.gstPercent),
        hsnCode: String(map.get('tax.hsnCode') ?? DEFAULTS.tax.hsnCode),
      },
      shipping: {
        freeThreshold: Number(map.get('shipping.freeThreshold') ?? DEFAULTS.shipping.freeThreshold),
        flatRate: Number(map.get('shipping.flatRate') ?? DEFAULTS.shipping.flatRate),
      },
      studio: {
        customPrintMarkup: Number(
          map.get('studio.customPrintMarkup') ?? DEFAULTS.studio.customPrintMarkup,
        ),
      },
      refunds: {
        autoApproveWindowDays: Number(
          map.get('refunds.autoApproveWindowDays') ?? DEFAULTS.refunds.autoApproveWindowDays,
        ),
      },
    };
    this.cache = { value, at: Date.now() };
    return value;
  }

  async invalidate(): Promise<void> {
    this.cache = null;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.prisma.globalSetting.upsert({
      where: { key },
      update: { value: value as object },
      create: { key, value: value as object },
    });
    await this.invalidate();
  }
}

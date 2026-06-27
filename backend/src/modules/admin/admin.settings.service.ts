import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

const DEFAULT_SETTINGS = {
  brandName: 'Ink Studio',
  tagline: 'Heavyweight cotton, custom prints, anime drops.',
  notifications: {
    newOrders: true,
    lowStock: true,
    studioRequests: true,
    refundRequests: true,
    dailyDigest: false,
    weeklyPerformance: true,
  },
  shipping: [
    { zone: 'India · Standard', rate: 'Free over ₹999 · ₹49 below', days: '3–5 days' },
    { zone: 'India · Express', rate: '₹149 flat', days: '1–2 days' },
    { zone: 'International · Asia', rate: '₹899 flat', days: '7–10 days' },
    { zone: 'International · Worldwide', rate: '₹1,499 flat', days: '10–14 days' },
  ],
  payments: [
    { id: 'upi', label: 'UPI · Razorpay', on: true, hint: 'Google Pay, PhonePe, Paytm' },
    { id: 'cards', label: 'Credit / Debit Cards', on: true, hint: 'Visa, Mastercard, RuPay, Amex' },
    { id: 'cod', label: 'Cash on Delivery', on: true, hint: 'Available within India' },
    { id: 'stripe', label: 'Stripe (international)', on: false, hint: 'Multi-currency, cards' },
    { id: 'applePay', label: 'Apple Pay', on: false },
  ],
  seo: {
    metaTitle: '{page} — Ink Studio',
    metaDesc: 'Heavyweight cotton, custom prints, and editorial anime drops from the Ink Studio.',
  },
  theme: {
    aesthetic: 'Paper & Ink',
    motionIntensity: 2,
  },
  security: {
    twoFactor: true,
    sessionTimeout: true,
    auditLog: true,
  },
};

function isObject(item: any): boolean {
  return (item !== null && typeof item === 'object' && !Array.isArray(item));
}

function deepMerge(target: any, source: any): any {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

@Injectable()
export class AdminSettingsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const existing = await this.prisma.globalSetting.findUnique({
      where: { key: 'admin_config' },
    });
    if (!existing) {
      await this.prisma.globalSetting.create({
        data: {
          key: 'admin_config',
          value: DEFAULT_SETTINGS,
        },
      });
    }
  }

  async getSettings() {
    const setting = await this.prisma.globalSetting.findUnique({
      where: { key: 'admin_config' },
    });
    if (setting) {
      return deepMerge(DEFAULT_SETTINGS, setting.value as any);
    }
    return DEFAULT_SETTINGS;
  }

  async updateSettings(newSettings: any) {
    const currentSettings = await this.getSettings();
    const updated = deepMerge(currentSettings, newSettings);

    await this.prisma.globalSetting.upsert({
      where: { key: 'admin_config' },
      update: { value: updated },
      create: { key: 'admin_config', value: updated },
    });

    return updated;
  }
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminSettingsService {
  private settings = {
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

  getSettings() {
    return this.settings;
  }

  updateSettings(newSettings: any) {
    this.settings = { ...this.settings, ...newSettings };
    return this.settings;
  }
}

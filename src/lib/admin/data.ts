// Mock dataset for the admin dashboard. Frontend-only — replace with
// real queries when the backend lands. Shapes are intentionally backend-ready.

export type OrderStatus =
  | "pending"
  | "paid"
  | "fulfilled"
  | "shipped"
  | "delivered"
  | "refunded"
  | "cancelled";
export type PaymentMethod = "upi" | "card" | "cod" | "netbank";
export type FulfillmentStage =
  | "received"
  | "picked"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered";

export type Order = {
  id: string;
  number: string;
  createdAt: string; // ISO
  customer: { name: string; email: string; id: string };
  status: OrderStatus;
  payment: PaymentMethod;
  total: number;
  itemsCount: number;
  city: string;
  channel: "web" | "instagram" | "store";
  fulfillment: FulfillmentStage;
  refundRequested?: boolean;
  returnRequested?: boolean;
  items: { name: string; sku: string; qty: number; price: number; image: string }[];
};

export type ProductStatus = "active" | "draft" | "scheduled" | "archived";
export type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  collection: string;
  price: number;
  compareAt?: number;
  stock: number;
  lowStockAt: number;
  status: ProductStatus;
  visible: boolean;
  featured: boolean;
  variants: number;
  scheduledFor?: string;
  image: string;
  views7d: number;
  units7d: number;
  conversion: number; // %
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinedAt: string;
  orders: number;
  spend: number;
  lastOrderAt: string;
  vip: boolean;
  loyalty: "bronze" | "silver" | "gold" | "platinum";
  segment: "new" | "returning" | "lapsed" | "vip";
  city: string;
  notes?: string;
  supportTickets: number;
};

export type Drop = {
  id: string;
  name: string;
  cover: string;
  startsAt: string;
  endsAt?: string;
  status: "scheduled" | "live" | "ended" | "draft";
  capsuleSize: number;
  sold: number;
  units: number;
  revenue: number;
  conversion: number;
  featured: boolean;
  lowStock: number;
};

export type StudioRequest = {
  id: string;
  ref: string;
  submittedAt: string;
  customer: { name: string; email: string };
  garment: string;
  printType: "screen" | "dtg" | "embroidery" | "puff";
  priority: "standard" | "rush" | "vip";
  status: "new" | "in_review" | "approved" | "in_production" | "shipped" | "rejected";
  revisions: number;
  preview: string;
  notes: string;
};

const IMG = (seed: string) => `https://images.unsplash.com/${seed}?auto=format&fit=crop&w=600&q=70`;

const PRODUCT_IMAGES = [
  IMG("photo-1620799140408-edc6dcb6d633"),
  IMG("photo-1591047139829-d91aecb6caea"),
  IMG("photo-1583743814966-8936f5b7be1a"),
  IMG("photo-1542291026-7eec264c27ff"),
  IMG("photo-1593030668932-a51d9fb43e84"),
  IMG("photo-1556821840-3a63f95609a7"),
];

const CUSTOMERS_RAW: Omit<Customer, "id">[] = [
  {
    name: "Arjun Mehta",
    email: "arjun.m@inkmail.co",
    phone: "+91 98201 12345",
    joinedAt: "2025-03-12",
    orders: 14,
    spend: 184320,
    lastOrderAt: "2026-05-22",
    vip: true,
    loyalty: "platinum",
    segment: "vip",
    city: "Mumbai",
    notes: "Prefers oversized fits. Owns 4 anime drops.",
    supportTickets: 1,
  },
  {
    name: "Saanvi Iyer",
    email: "saanvi@studio.in",
    phone: "+91 99876 54321",
    joinedAt: "2025-08-04",
    orders: 7,
    spend: 62100,
    lastOrderAt: "2026-05-19",
    vip: false,
    loyalty: "gold",
    segment: "returning",
    city: "Bengaluru",
    supportTickets: 0,
  },
  {
    name: "Rohan Kapoor",
    email: "rohan.k@gmail.com",
    phone: "+91 90123 45678",
    joinedAt: "2026-01-19",
    orders: 2,
    spend: 8400,
    lastOrderAt: "2026-05-12",
    vip: false,
    loyalty: "bronze",
    segment: "new",
    city: "Delhi",
    supportTickets: 0,
  },
  {
    name: "Ananya Rao",
    email: "ananya@designhouse.co",
    phone: "+91 95551 22330",
    joinedAt: "2024-11-02",
    orders: 22,
    spend: 296500,
    lastOrderAt: "2026-05-26",
    vip: true,
    loyalty: "platinum",
    segment: "vip",
    city: "Hyderabad",
    notes: "Personal stylist account. Bulk orders.",
    supportTickets: 2,
  },
  {
    name: "Karan Bhatt",
    email: "karan.bhatt@outlook.com",
    phone: "+91 98765 11220",
    joinedAt: "2025-06-22",
    orders: 5,
    spend: 41200,
    lastOrderAt: "2026-04-08",
    vip: false,
    loyalty: "silver",
    segment: "lapsed",
    city: "Pune",
    supportTickets: 0,
  },
  {
    name: "Diya Sharma",
    email: "diya.s@inkstudio.cc",
    phone: "+91 99001 88776",
    joinedAt: "2025-09-30",
    orders: 9,
    spend: 88900,
    lastOrderAt: "2026-05-21",
    vip: false,
    loyalty: "gold",
    segment: "returning",
    city: "Mumbai",
    supportTickets: 0,
  },
  {
    name: "Vihaan Singh",
    email: "vihaan.s@gmail.com",
    phone: "+91 90909 12321",
    joinedAt: "2026-02-14",
    orders: 1,
    spend: 2999,
    lastOrderAt: "2026-02-14",
    vip: false,
    loyalty: "bronze",
    segment: "new",
    city: "Chennai",
    supportTickets: 0,
  },
  {
    name: "Meera Joshi",
    email: "meera.j@founders.fund",
    phone: "+91 98777 44556",
    joinedAt: "2024-07-18",
    orders: 18,
    spend: 221400,
    lastOrderAt: "2026-05-25",
    vip: true,
    loyalty: "platinum",
    segment: "vip",
    city: "Mumbai",
    supportTickets: 1,
  },
];

export const customers: Customer[] = CUSTOMERS_RAW.map((c, i) => ({
  ...c,
  id: `cust_${1000 + i}`,
}));

const ORDER_STATUSES: OrderStatus[] = [
  "paid",
  "fulfilled",
  "shipped",
  "delivered",
  "pending",
  "refunded",
];
const PAY: PaymentMethod[] = ["upi", "card", "upi", "card", "cod", "netbank"];
const FULF: FulfillmentStage[] = [
  "received",
  "picked",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
];

export const orders: Order[] = Array.from({ length: 42 }, (_, i) => {
  const cust = customers[i % customers.length];
  const itemsCount = 1 + (i % 4);
  const items = Array.from({ length: itemsCount }, (_, j) => ({
    name: [
      "Heavy Cotton Tee",
      "Anime Drop No. 03",
      "Cropped Hoodie",
      "Print Studio Custom",
      "Cargo Trouser",
      "Boxy Crew",
    ][(i + j) % 6],
    sku: `INK-${((i + j) * 17) % 9999}`,
    qty: 1 + ((i + j) % 2),
    price: [1499, 2499, 3499, 4999, 2899, 1999][(i + j) % 6],
    image: PRODUCT_IMAGES[(i + j) % PRODUCT_IMAGES.length],
  }));
  const total = items.reduce((s, it) => s + it.price * it.qty, 0);
  const status = ORDER_STATUSES[i % ORDER_STATUSES.length];
  const fulfillment = FULF[Math.min(FULF.length - 1, i % FULF.length)];
  const daysAgo = i % 30;
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    id: `ord_${10000 + i}`,
    number: `#INK-${10240 - i}`,
    createdAt: date.toISOString(),
    customer: { id: cust.id, name: cust.name, email: cust.email },
    status,
    payment: PAY[i % PAY.length],
    total,
    itemsCount,
    city: cust.city,
    channel: (["web", "instagram", "store"] as const)[i % 3],
    fulfillment,
    refundRequested: i % 17 === 0,
    returnRequested: i % 13 === 0 && i > 0,
    items,
  };
});

export const products: Product[] = [
  {
    id: "p_1",
    name: "Heavy Cotton Tee — Bone",
    sku: "INK-HCT-BNE",
    category: "T-Shirts",
    collection: "Studio Staples",
    price: 1499,
    stock: 142,
    lowStockAt: 30,
    status: "active",
    visible: true,
    featured: true,
    variants: 6,
    image: PRODUCT_IMAGES[0],
    views7d: 4820,
    units7d: 184,
    conversion: 3.8,
  },
  {
    id: "p_2",
    name: "Anime Drop No. 03 — Kage",
    sku: "INK-AD3-KGE",
    category: "Drops",
    collection: "Anime Universe",
    price: 2499,
    compareAt: 2999,
    stock: 18,
    lowStockAt: 25,
    status: "active",
    visible: true,
    featured: true,
    variants: 4,
    image: PRODUCT_IMAGES[1],
    views7d: 9120,
    units7d: 96,
    conversion: 1.05,
  },
  {
    id: "p_3",
    name: "Cropped Hoodie — Charcoal",
    sku: "INK-CRH-CHR",
    category: "Hoodies",
    collection: "Studio Staples",
    price: 3499,
    stock: 67,
    lowStockAt: 20,
    status: "active",
    visible: true,
    featured: false,
    variants: 5,
    image: PRODUCT_IMAGES[2],
    views7d: 2410,
    units7d: 42,
    conversion: 1.7,
  },
  {
    id: "p_4",
    name: "Print Studio — Custom Tee",
    sku: "INK-PST-CUS",
    category: "Custom",
    collection: "Studio",
    price: 4999,
    stock: 0,
    lowStockAt: 0,
    status: "active",
    visible: true,
    featured: false,
    variants: 1,
    image: PRODUCT_IMAGES[3],
    views7d: 1820,
    units7d: 38,
    conversion: 2.1,
  },
  {
    id: "p_5",
    name: "Cargo Trouser — Olive",
    sku: "INK-CRG-OLV",
    category: "Bottoms",
    collection: "Studio Staples",
    price: 2899,
    stock: 8,
    lowStockAt: 15,
    status: "active",
    visible: true,
    featured: false,
    variants: 8,
    image: PRODUCT_IMAGES[4],
    views7d: 1980,
    units7d: 24,
    conversion: 1.2,
  },
  {
    id: "p_6",
    name: "Boxy Crew — Stone",
    sku: "INK-BXC-STN",
    category: "Sweats",
    collection: "Studio Staples",
    price: 1999,
    stock: 92,
    lowStockAt: 30,
    status: "active",
    visible: true,
    featured: false,
    variants: 5,
    image: PRODUCT_IMAGES[5],
    views7d: 2210,
    units7d: 58,
    conversion: 2.6,
  },
  {
    id: "p_7",
    name: "Drop 04 — Yoake Capsule",
    sku: "INK-DR4-YOA",
    category: "Drops",
    collection: "Anime Universe",
    price: 3299,
    stock: 0,
    lowStockAt: 0,
    status: "scheduled",
    visible: false,
    featured: true,
    variants: 4,
    scheduledFor: "2026-06-12",
    image: PRODUCT_IMAGES[0],
    views7d: 0,
    units7d: 0,
    conversion: 0,
  },
  {
    id: "p_8",
    name: "Workshop Tote — Natural",
    sku: "INK-WTT-NTR",
    category: "Accessories",
    collection: "Studio Staples",
    price: 899,
    stock: 240,
    lowStockAt: 50,
    status: "draft",
    visible: false,
    featured: false,
    variants: 1,
    image: PRODUCT_IMAGES[5],
    views7d: 0,
    units7d: 0,
    conversion: 0,
  },
  {
    id: "p_9",
    name: "Letterman Jacket — Ink",
    sku: "INK-LET-INK",
    category: "Outerwear",
    collection: "Studio Staples",
    price: 7499,
    compareAt: 8999,
    stock: 12,
    lowStockAt: 10,
    status: "active",
    visible: true,
    featured: false,
    variants: 3,
    image: PRODUCT_IMAGES[2],
    views7d: 1620,
    units7d: 14,
    conversion: 0.9,
  },
  {
    id: "p_10",
    name: "Wide Leg Denim — Indigo",
    sku: "INK-WLD-IND",
    category: "Bottoms",
    collection: "Studio Staples",
    price: 4199,
    stock: 34,
    lowStockAt: 20,
    status: "active",
    visible: true,
    featured: false,
    variants: 6,
    image: PRODUCT_IMAGES[3],
    views7d: 1290,
    units7d: 22,
    conversion: 1.7,
  },
];

export const drops: Drop[] = [
  {
    id: "d_1",
    name: "Anime Drop No. 03 — Kage",
    cover: PRODUCT_IMAGES[1],
    startsAt: "2026-05-20T18:00:00.000Z",
    endsAt: "2026-06-04T18:00:00.000Z",
    status: "live",
    capsuleSize: 200,
    sold: 168,
    units: 168,
    revenue: 419832,
    conversion: 4.2,
    featured: true,
    lowStock: 3,
  },
  {
    id: "d_2",
    name: "Drop 04 — Yoake Capsule",
    cover: PRODUCT_IMAGES[0],
    startsAt: "2026-06-12T18:00:00.000Z",
    status: "scheduled",
    capsuleSize: 150,
    sold: 0,
    units: 0,
    revenue: 0,
    conversion: 0,
    featured: true,
    lowStock: 0,
  },
  {
    id: "d_3",
    name: "Studio Custom — Spring Series",
    cover: PRODUCT_IMAGES[3],
    startsAt: "2026-04-01T10:00:00.000Z",
    endsAt: "2026-05-01T18:00:00.000Z",
    status: "ended",
    capsuleSize: 80,
    sold: 80,
    units: 80,
    revenue: 399920,
    conversion: 6.8,
    featured: false,
    lowStock: 0,
  },
  {
    id: "d_4",
    name: "Workwear Capsule",
    cover: PRODUCT_IMAGES[4],
    startsAt: "2026-07-01T18:00:00.000Z",
    status: "draft",
    capsuleSize: 120,
    sold: 0,
    units: 0,
    revenue: 0,
    conversion: 0,
    featured: false,
    lowStock: 0,
  },
];

export const studioRequests: StudioRequest[] = [
  {
    id: "sr_1",
    ref: "STU-0042",
    submittedAt: "2026-05-26T09:14:00Z",
    customer: { name: "Ananya Rao", email: "ananya@designhouse.co" },
    garment: "Heavy Cotton Tee — Bone",
    printType: "screen",
    priority: "vip",
    status: "new",
    revisions: 0,
    preview: PRODUCT_IMAGES[0],
    notes: "Two-color hand-drawn typography, back placement.",
  },
  {
    id: "sr_2",
    ref: "STU-0041",
    submittedAt: "2026-05-25T12:02:00Z",
    customer: { name: "Karan Bhatt", email: "karan.bhatt@outlook.com" },
    garment: "Cropped Hoodie — Charcoal",
    printType: "embroidery",
    priority: "rush",
    status: "in_review",
    revisions: 1,
    preview: PRODUCT_IMAGES[2],
    notes: "Chest embroidery, monogram K.B.",
  },
  {
    id: "sr_3",
    ref: "STU-0040",
    submittedAt: "2026-05-24T17:48:00Z",
    customer: { name: "Saanvi Iyer", email: "saanvi@studio.in" },
    garment: "Boxy Crew — Stone",
    printType: "puff",
    priority: "standard",
    status: "approved",
    revisions: 2,
    preview: PRODUCT_IMAGES[5],
    notes: "Puff print, oversized graphic across chest.",
  },
  {
    id: "sr_4",
    ref: "STU-0039",
    submittedAt: "2026-05-22T08:10:00Z",
    customer: { name: "Diya Sharma", email: "diya.s@inkstudio.cc" },
    garment: "Heavy Cotton Tee — Bone",
    printType: "dtg",
    priority: "standard",
    status: "in_production",
    revisions: 0,
    preview: PRODUCT_IMAGES[0],
    notes: "Full-color photographic print.",
  },
  {
    id: "sr_5",
    ref: "STU-0038",
    submittedAt: "2026-05-18T14:25:00Z",
    customer: { name: "Rohan Kapoor", email: "rohan.k@gmail.com" },
    garment: "Cargo Trouser — Olive",
    printType: "screen",
    priority: "standard",
    status: "shipped",
    revisions: 1,
    preview: PRODUCT_IMAGES[4],
    notes: "Small back-pocket print, single color.",
  },
  {
    id: "sr_6",
    ref: "STU-0037",
    submittedAt: "2026-05-15T11:00:00Z",
    customer: { name: "Vihaan Singh", email: "vihaan.s@gmail.com" },
    garment: "Workshop Tote — Natural",
    printType: "screen",
    priority: "standard",
    status: "rejected",
    revisions: 0,
    preview: PRODUCT_IMAGES[5],
    notes: "Copyrighted artwork, declined.",
  },
];

// ────────────────── Aggregates / analytics

export type KPI = {
  label: string;
  value: string;
  delta: number; // % vs last period
  spark: number[];
  hint?: string;
};

const seriesUp = (n: number, base: number, jitter: number) =>
  Array.from({ length: n }, (_, i) =>
    Math.max(0, Math.round(base + i * (base * 0.02) + Math.sin(i * 1.3) * jitter)),
  );

const seriesFlat = (n: number, base: number, jitter: number) =>
  Array.from({ length: n }, (_, i) => Math.max(0, Math.round(base + Math.cos(i * 0.7) * jitter)));

export const kpis: KPI[] = [
  {
    label: "Revenue",
    value: "₹14.82L",
    delta: 18.4,
    spark: seriesUp(14, 60, 22),
    hint: "Last 14 days",
  },
  {
    label: "Orders",
    value: "1,284",
    delta: 9.1,
    spark: seriesUp(14, 40, 14),
    hint: "Last 14 days",
  },
  { label: "AOV", value: "₹1,154", delta: 4.2, spark: seriesFlat(14, 32, 6), hint: "Last 14 days" },
  {
    label: "Conversion",
    value: "3.42%",
    delta: -0.6,
    spark: seriesFlat(14, 28, 4),
    hint: "Sitewide",
  },
];

export const revenueSeries = Array.from({ length: 30 }, (_, i) => {
  const base = 38000 + i * 1400;
  const noise = Math.sin(i * 0.9) * 9000 + Math.cos(i * 0.5) * 4000;
  return {
    day: i + 1,
    revenue: Math.round(base + noise),
    orders: Math.round(28 + i * 1.1 + Math.sin(i * 0.7) * 6),
  };
});

export const trafficSources = [
  { source: "Direct", visits: 18420, pct: 38, delta: 6.2 },
  { source: "Instagram", visits: 12140, pct: 25, delta: 14.1 },
  { source: "Google", visits: 9210, pct: 19, delta: -2.4 },
  { source: "Newsletter", visits: 4820, pct: 10, delta: 8.9 },
  { source: "Referral", visits: 3870, pct: 8, delta: 1.4 },
];

export const topCategories = [
  { name: "T-Shirts", revenue: 482100, units: 412, share: 32 },
  { name: "Hoodies", revenue: 391200, units: 184, share: 26 },
  { name: "Drops", revenue: 312800, units: 142, share: 21 },
  { name: "Bottoms", revenue: 184400, units: 96, share: 12 },
  { name: "Accessories", revenue: 132100, units: 224, share: 9 },
];

export const liveActivity = [
  {
    id: 1,
    time: "now",
    text: "Order #INK-10240 placed",
    meta: "₹4,998 · Mumbai",
    kind: "order" as const,
  },
  {
    id: 2,
    time: "2m ago",
    text: "Anime Drop No. 03 — Kage low stock",
    meta: "18 units left",
    kind: "stock" as const,
  },
  {
    id: 3,
    time: "4m ago",
    text: "Studio request STU-0042 submitted",
    meta: "Ananya Rao · VIP",
    kind: "studio" as const,
  },
  {
    id: 4,
    time: "7m ago",
    text: "Order #INK-10238 shipped",
    meta: "Tracking BD92113…",
    kind: "fulfillment" as const,
  },
  {
    id: 5,
    time: "11m ago",
    text: "New customer signup",
    meta: "vihaan.s@gmail.com",
    kind: "customer" as const,
  },
  {
    id: 6,
    time: "14m ago",
    text: "Refund processed for #INK-10221",
    meta: "₹2,499 · UPI",
    kind: "refund" as const,
  },
  {
    id: 7,
    time: "22m ago",
    text: "Drop 04 — Yoake added to wishlist",
    meta: "+14 wishlists today",
    kind: "wishlist" as const,
  },
  {
    id: 8,
    time: "31m ago",
    text: "Order #INK-10235 delivered",
    meta: "Hyderabad",
    kind: "fulfillment" as const,
  },
];

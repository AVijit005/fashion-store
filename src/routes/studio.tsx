import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Type, Image as ImageIcon, Trash2, Plus, ShoppingBag, LayoutTemplate } from "lucide-react";
import { useCart } from "@/lib/store/cart";
import { inr } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Print Studio — Ink Studio" },
      {
        name: "description",
        content: "Design your own tee, hoodie, mug, or tote. Live mockup, no minimums.",
      },
      { property: "og:title", content: "Print Studio — Ink Studio" },
      { property: "og:url", content: "/studio" },
    ],
    links: [{ rel: "canonical", href: "/studio" }],
  }),
  component: Studio,
});

type Layer =
  | { id: string; type: "text"; text: string; x: number; y: number; size: number; color: string }
  | { id: string; type: "image"; src: string; x: number; y: number; size: number };

const PRODUCTS = [
  {
    id: "tee",
    name: "Oversized Tee",
    price: 1299,
    mockup:
      "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=900&q=80&auto=format&fit=crop",
  },
  {
    id: "hoodie",
    name: "Heavy Hoodie",
    price: 2299,
    mockup:
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=900&q=80&auto=format&fit=crop",
  },
  {
    id: "mug",
    name: "Ceramic Mug",
    price: 349,
    mockup:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=900&q=80&auto=format&fit=crop",
  },
  {
    id: "tote",
    name: "Canvas Tote",
    price: 599,
    mockup:
      "https://images.unsplash.com/photo-1544816155-12df9643f363?w=900&q=80&auto=format&fit=crop",
  },
];

const COLORS = [
  { name: "Bone", hex: "#f5f3ee" },
  { name: "Graphite", hex: "#2d2d2d" },
  { name: "Ink", hex: "#0d0d0d" },
];

function Studio() {
  const [productId, setProductId] = useState("tee");
  const [color, setColor] = useState("Bone");
  const [layers, setLayers] = useState<Layer[]>([
    { id: "l1", type: "text", text: "INK", x: 50, y: 45, size: 64, color: "#0d0d0d" },
  ]);
  const [selected, setSelected] = useState<string | null>("l1");
  const [text, setText] = useState("INK");
  const [activeTab, setActiveTab] = useState<"product" | "templates">("product");
  const canvasRef = useRef<HTMLDivElement>(null);
  const add = useCart((s) => s.add);

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["creator-templates"],
    queryFn: () => apiClient.get("/studio/templates"),
  });

  const product = PRODUCTS.find((p) => p.id === productId)!;
  const colorHex = COLORS.find((c) => c.name === color)!.hex;
  const sel = layers.find((l) => l.id === selected);

  const update = (id: string, patch: Partial<Layer>) =>
    setLayers((ls) => ls.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)));

  const addText = () => {
    const id = `l${Date.now()}`;
    setLayers([
      ...layers,
      { id, type: "text", text: text || "NEW", x: 50, y: 50, size: 48, color: "#0d0d0d" },
    ]);
    setSelected(id);
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const id = `l${Date.now()}`;
      setLayers([
        ...layers,
        { id, type: "image", src: reader.result as string, x: 50, y: 50, size: 30 },
      ]);
      setSelected(id);
    };
    reader.readAsDataURL(f);
  };

  const remove = (id: string) => {
    setLayers(layers.filter((l) => l.id !== id));
    if (selected === id) setSelected(null);
  };

  const addToCart = () => {
    add({
      id: `custom-${productId}-${Date.now()}`,
      slug: product.id,
      name: `Custom ${product.name}`,
      image: product.mockup,
      price: product.price + 200,
      mrp: product.price + 200,
      size: "M",
      color,
      custom: true,
      customData: {
        productId,
        color,
        hex: colorHex,
        layers,
      },
    });
  };

  return (
    <div className="bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto max-w-[1480px] px-5 py-10 lg:px-10 lg:py-14">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Print studio</p>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] lg:text-7xl">
            Make it <span className="italic">yours.</span>
          </h1>
          <p className="mt-3 max-w-xl text-mute">
            Drop a product, add type and art, ship in 48 hours.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-6 px-5 py-10 lg:grid-cols-[280px_1fr_320px] lg:gap-8 lg:px-10">
        {/* Left: tools */}
        <aside className="space-y-8">
          <div className="flex border-b border-line mb-6">
            <button
              onClick={() => setActiveTab("product")}
              className={`flex-1 py-3 text-[11px] uppercase tracking-[0.22em] text-center transition ${activeTab === "product" ? "border-b-2 border-ink text-ink font-medium" : "text-mute hover:text-ink"}`}
            >
              Base Product
            </button>
            <button
              onClick={() => setActiveTab("templates")}
              className={`flex-1 py-3 text-[11px] uppercase tracking-[0.22em] text-center transition ${activeTab === "templates" ? "border-b-2 border-ink text-ink font-medium" : "text-mute hover:text-ink"}`}
            >
              Templates
            </button>
          </div>

          {activeTab === "product" ? (
            <div>
              <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-mute">Product</p>
              <div className="grid grid-cols-2 gap-2">
                {PRODUCTS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProductId(p.id)}
                    className={`border p-3 text-left transition ${productId === p.id ? "border-ink" : "border-line hover:border-graphite"}`}
                  >
                    <div className="aspect-square overflow-hidden bg-fog">
                      <img src={p.mockup} alt={p.name} className="h-full w-full object-cover" />
                    </div>
                    <p className="mt-2 text-[12px]">{p.name}</p>
                    <p className="text-[11px] tabular-nums text-mute">{inr(p.price)}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-mute">Creator Templates</p>
              {templates.length === 0 ? (
                <p className="text-sm text-mute">No templates available yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (t.designJson && Array.isArray(t.designJson.layers)) {
                          setLayers(t.designJson.layers);
                          if (t.designJson.productId) setProductId(t.designJson.productId);
                          if (t.designJson.color) setColor(t.designJson.color);
                        }
                      }}
                      className="border border-line p-3 text-left transition hover:border-graphite"
                    >
                      <div className="aspect-square overflow-hidden bg-fog flex items-center justify-center">
                        {t.previewImage ? (
                           <img src={t.previewImage} alt={t.title} className="h-full w-full object-cover" />
                        ) : (
                           <LayoutTemplate className="h-8 w-8 text-mute opacity-50" />
                        )}
                      </div>
                      <p className="mt-2 text-[12px] truncate">{t.title}</p>
                      <p className="text-[10px] text-mute truncate">{t.category || "General"}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-mute">Color</p>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setColor(c.name)}
                  className={`flex h-10 w-10 items-center justify-center border ${color === c.name ? "border-ink" : "border-line"}`}
                >
                  <span
                    className="h-6 w-6 rounded-full border border-line"
                    style={{ background: c.hex }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-mute">Add</p>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Your text"
                  className="flex-1 border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink"
                />
                <button
                  onClick={addText}
                  className="flex h-10 w-10 items-center justify-center border border-ink"
                >
                  <Type className="h-4 w-4" />
                </button>
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 border border-line py-3 text-[12px] uppercase tracking-[0.18em] hover:border-ink">
                <ImageIcon className="h-4 w-4" /> Upload image
                <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
              </label>
            </div>
          </div>
        </aside>

        {/* Canvas */}
        <div className="relative">
          <div
            ref={canvasRef}
            className="relative mx-auto aspect-[4/5] max-w-2xl overflow-hidden"
            style={{ background: colorHex }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelected(null);
            }}
          >
            <img
              src={product.mockup}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-multiply"
            />
            {layers.map((l) => (
              <motion.div
                key={l.id}
                drag
                dragMomentum={false}
                onPointerDown={() => setSelected(l.id)}
                onDragEnd={(_, info) => {
                  const r = canvasRef.current?.getBoundingClientRect();
                  if (!r) return;
                  update(l.id, {
                    x: l.x + (info.offset.x / r.width) * 100,
                    y: l.y + (info.offset.y / r.height) * 100,
                  });
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab select-none active:cursor-grabbing ${selected === l.id ? "outline outline-1 outline-offset-4 outline-ink" : ""}`}
                style={{ left: `${l.x}%`, top: `${l.y}%` }}
              >
                {l.type === "text" ? (
                  <p
                    style={{ fontSize: l.size, color: l.color, fontFamily: "Instrument Serif" }}
                    className="whitespace-nowrap leading-none"
                  >
                    {l.text}
                  </p>
                ) : (
                  <img src={l.src} alt="" style={{ width: `${l.size * 4}px` }} className="block" />
                )}
              </motion.div>
            ))}
            <div className="absolute right-4 top-4 bg-paper/90 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em]">
              Live mockup
            </div>
          </div>
        </div>

        {/* Right: layer + summary */}
        <aside className="space-y-6">
          <div className="border border-line p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Selected layer</p>
            {sel ? (
              <div className="mt-3 space-y-3">
                {sel.type === "text" && (
                  <>
                    <input
                      value={sel.text}
                      onChange={(e) => update(sel.id, { text: e.target.value })}
                      className="w-full border-b border-line bg-transparent py-2 text-sm outline-none focus:border-ink"
                    />
                    <div>
                      <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-mute">
                        Size · {sel.size}px
                      </p>
                      <input
                        type="range"
                        min={12}
                        max={140}
                        value={sel.size}
                        onChange={(e) => update(sel.id, { size: +e.target.value })}
                        className="w-full accent-ink"
                      />
                    </div>
                    <div className="flex gap-2">
                      {["#0d0d0d", "#f5f3ee", "#c84b1e", "#2f4a3a"].map((c) => (
                        <button
                          key={c}
                          onClick={() => update(sel.id, { color: c })}
                          className={`h-7 w-7 rounded-full border ${"color" in sel && sel.color === c ? "border-ink ring-2 ring-ink ring-offset-2 ring-offset-paper" : "border-line"}`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </>
                )}
                {sel.type === "image" && (
                  <div>
                    <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-mute">
                      Size · {sel.size}
                    </p>
                    <input
                      type="range"
                      min={10}
                      max={80}
                      value={sel.size}
                      onChange={(e) => update(sel.id, { size: +e.target.value })}
                      className="w-full accent-ink"
                    />
                  </div>
                )}
                <button
                  onClick={() => remove(sel.id)}
                  className="flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-mute hover:text-ink"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete layer
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-mute">Tap a layer to edit, or drag to reposition.</p>
            )}
          </div>

          <div className="border border-line p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Your build</p>
            <p className="mt-2 font-display text-3xl">{product.name}</p>
            <p className="text-[12px] text-mute">
              {color} · {layers.length} layer{layers.length === 1 ? "" : "s"}
            </p>
            <div className="mt-4 flex items-baseline justify-between">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Total</p>
              <p className="font-display text-3xl tabular-nums">{inr(product.price + 200)}</p>
            </div>
            <button
              onClick={addToCart}
              className="mt-4 flex w-full items-center justify-center gap-2 bg-ink py-4 text-[12px] uppercase tracking-[0.22em] text-paper"
            >
              <Plus className="h-4 w-4" /> Add to bag
            </button>
            <p className="mt-2 text-[11px] text-mute">
              Includes ₹200 custom print fee. Ships in 48h.
            </p>
          </div>

          <div className="border border-line p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Layers</p>
            <ul className="mt-3 space-y-1">
              {layers.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => setSelected(l.id)}
                    className={`flex w-full items-center justify-between gap-2 border px-3 py-2 text-left text-[13px] ${selected === l.id ? "border-ink" : "border-line"}`}
                  >
                    <span className="truncate">
                      {l.type === "text" ? `"${l.text}"` : "Image layer"}
                    </span>
                    <ShoppingBag className="h-3.5 w-3.5 opacity-0" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export type Category = {
  slug: string;
  name: string;
  group: "apparel" | "print" | "accessories";
  blurb: string;
  image: string;
};

export const categories: Category[] = [
  {
    slug: "oversized-tees",
    name: "Oversized Tees",
    group: "apparel",
    blurb: "Heavyweight cotton, boxy drape.",
    image:
      "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=900&q=80&auto=format&fit=crop",
  },
  {
    slug: "anime",
    name: "Anime Collection",
    group: "apparel",
    blurb: "Officially inspired editorial drops.",
    image:
      "https://images.unsplash.com/photo-1554568218-0f1715e72254?w=900&q=80&auto=format&fit=crop",
  },
  {
    slug: "graphic-tees",
    name: "Graphic Tees",
    group: "apparel",
    blurb: "Print-led, statement-first.",
    image:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900&q=80&auto=format&fit=crop",
  },
  {
    slug: "hoodies",
    name: "Hoodies",
    group: "apparel",
    blurb: "Heavyweight fleece, modern cut.",
    image:
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=900&q=80&auto=format&fit=crop",
  },
  {
    slug: "sweatshirts",
    name: "Sweatshirts",
    group: "apparel",
    blurb: "Brushed inside, clean outside.",
    image:
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=900&q=80&auto=format&fit=crop",
  },
  {
    slug: "jackets",
    name: "Jackets",
    group: "apparel",
    blurb: "Outerwear that finishes a fit.",
    image:
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=900&q=80&auto=format&fit=crop",
  },
  {
    slug: "mobile-covers",
    name: "Mobile Covers",
    group: "accessories",
    blurb: "Premium texture, exact fit.",
    image:
      "https://images.unsplash.com/photo-1592434134753-a70baf7979d5?w=900&q=80&auto=format&fit=crop",
  },
  {
    slug: "mugs",
    name: "Mugs",
    group: "print",
    blurb: "Ceramic, dishwasher safe.",
    image:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=900&q=80&auto=format&fit=crop",
  },
  {
    slug: "tote-bags",
    name: "Tote Bags",
    group: "print",
    blurb: "Daily carry, made better.",
    image:
      "https://images.unsplash.com/photo-1544816155-12df9643f363?w=900&q=80&auto=format&fit=crop",
  },
  {
    slug: "posters",
    name: "Posters",
    group: "print",
    blurb: "Wall-grade matte finish.",
    image:
      "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=900&q=80&auto=format&fit=crop",
  },
];

export const navGroups = [
  {
    label: "Men",
    columns: [
      {
        title: "Tops",
        links: ["Oversized Tees", "Graphic Tees", "Anime", "Hoodies", "Sweatshirts", "Jackets"],
      },
      { title: "Bottoms", links: ["Joggers", "Cargo Pants", "Shorts"] },
      {
        title: "Collections",
        links: ["New Arrivals", "Best Sellers", "Limited Drop", "Streetwear"],
      },
    ],
  },
  {
    label: "Women",
    columns: [
      { title: "Tops", links: ["Oversized Tees", "Crop Tops", "Hoodies", "Sweatshirts"] },
      { title: "Bottoms", links: ["Joggers", "Wide-Leg", "Shorts"] },
      { title: "Collections", links: ["New Arrivals", "Best Sellers", "Anime", "Streetwear"] },
    ],
  },
  {
    label: "Print Shop",
    columns: [
      {
        title: "Customize",
        links: ["Tees", "Hoodies", "Mugs", "Phone Cases", "Tote Bags", "Posters"],
      },
      { title: "Studio", links: ["Open Designer", "Templates", "Upload Art"] },
    ],
  },
];

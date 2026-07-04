import { PrismaClient, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COLORS = [
  { name: 'Bone', hex: '#f5f3ee' },
  { name: 'Fog', hex: '#e8e4dd' },
  { name: 'Graphite', hex: '#2d2d2d' },
  { name: 'Ink', hex: '#0d0d0d' },
  { name: 'Ember', hex: '#c84b1e' },
  { name: 'Forest', hex: '#2f4a3a' },
];

const CATEGORIES = [
  { name: 'Oversized Tees', slug: 'oversized-tees' },
  { name: 'Graphic Tees', slug: 'graphic-tees' },
  { name: 'Hoodies', slug: 'hoodies' },
  { name: 'Sweatshirts', slug: 'sweatshirts' },
  { name: 'Jackets', slug: 'jackets' },
  { name: 'Anime', slug: 'anime' },
  { name: 'Mobile Covers', slug: 'mobile-covers' },
  { name: 'Mugs', slug: 'mugs' },
  { name: 'Tote Bags', slug: 'tote-bags' },
  { name: 'Posters', slug: 'posters' },
];

const PHOTO_URLS = [
  "https://plus.unsplash.com/premium_photo-1673826949034-18367fc03955?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1635650804263-1a1941e14df5?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1588117260148-b47818741c74?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1688497831535-120bd47d9f9c?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1578854955076-970394ef2512?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1635650804483-2a77a8c9e728?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1559406041-c7d2b2e98690?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1721742733156-736e11c918bb?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1586396847415-2c76ae7e79fc?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1721637686340-de9f8cebda5a?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1636047250452-6772f6144b3d?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1663050629719-83e16832a804?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1611955874253-78c6c3959c41?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1623596305214-19f21cbf48ee?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1626781309887-cdfb9f258c64?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1727967030845-6d0f0124ceb1?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1508216310976-c518daae0cdc?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1721713168896-11db10d9740b?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1631902112544-2271267abb73?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1675186049419-d48f4b28fe7c?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1603189343302-e603f7add05a?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1574015974293-817f0ebebb74?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1562151270-c7d22ceb586a?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1695575576052-7c271876b075?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1596993100471-c3905dafa78e?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1538329972958-465d6d2144ed?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1664868839770-ef9a76e21ab6?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1580478491436-fd6a937acc9e?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1553544260-f87e671974ee?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1662532577856-e8ee8b138a8b?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1726843669720-46319c0e2326?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1549298222-1c31e8915347?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1613915617430-8ab0fd7c6baf?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1541130292430-a832637ddc0d?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1683817138481-dcdf64a40859?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1645996830739-8fe3df27c33f?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1604284195847-88dc4b5a9faa?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1664076458686-3449062080ac?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1673356302169-574db56b52cd?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1680292783974-a9a336c10366?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1673125510222-1a51e3a8ccb0?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1564557287817-3785e38ec1f5?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1685354218016-3899c9ef79ad?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1579572331145-5e53b299c64e?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1673827311290-d435f481152e?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1609873814058-a8928924184a?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1601063476271-a159c71ab0b3?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1578768079052-aa76e52ff62e?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1673356302125-c77491af8735?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1685354217981-26c14a211bf8?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1615397587950-3cbb55f95b77?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517942420142-6a296f9ee4b1?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1673356301340-4522591be5f7?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1611817757591-c3f345024273?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1513789181297-6f2ec112c0bc?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1542406775-ade58c52d2e4?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1673356302067-aac3b545a362?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1627225924765-552d49cf47ad?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1627225925683-1da7021732ea?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1627225793904-a2f900a6e4cf?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1673356301535-2cc45bcc79e4?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1622445275992-e7efb32d2257?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1716951735063-3d60c2c288e4?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1661110546797-d86cc72a2765?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1690406382707-16d9cc7a83d5?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1760998209708-5fc89d7983c0?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1676113421666-172e5520b7a6?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1647628632602-99542ede0930?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1671656349262-1e1d3e09735c?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1775234576197-b916f4115679?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1775234576241-54cbf57ffd74?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1775234576239-1dccd15d469f?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1690338237128-b32fedb44d55?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1775234576198-a1c680241c07?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1780565595413-16c7bc95af74?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1775234576215-4374ffe00b36?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1678935939959-b0b451c64996?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1698647861553-54943df8212b?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1704910719554-cd5ab8e322ff?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1595271444083-08084c6857c7?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1678937610603-bcb9a9454c64?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1612974904144-5c725b5c6e98?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1558278716-23d852a2f446?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1612781367540-433dff529376?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1733341987477-fc49264c6e38?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1620215175664-cb9a6f5b6103?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1626339277573-ff8da132c10b?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1616706723028-60e90556654e?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1678935939751-803a0f890d6e?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1559577085-3359613a0eac?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1559577093-3fd9d1f021a7?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1759717662127-8c164721e7c7?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1678935940361-571eceef12b6?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1564506153357-0e4482d2bea0?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1770513632261-5fa6ee3bfa9d?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1765489639034-3917ea575a4a?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1675186049302-a0dad4cf3412?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1516762689617-e1cffcef479d?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1501127122-f385ca6ddd9d?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1675186049435-00e5ab94c7c3?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1504198458649-3128b932f49e?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1769107805528-964f4de0e342?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1513188447171-ecf00455f051?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1722005865240-eecdbec17347?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1567113463300-102a7eb3cb26?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1759229874914-c1ffdb3ebd0c?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1657981190914-e7bc1cba612e?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1675003662484-ae1d7a0aa2fb?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1772549145407-dd62ea2ba581?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1769107805465-bfd41863f1a0?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1693901257178-b5fcb8f036a8?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1720877265969-efd780495996?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1759572095329-1dcf9522762b?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1547587091-d639c1c338b3?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1642718913492-27a6bee11161?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1682435561654-20d84cef00eb?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1682125177822-63c27a3830ea?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1779231387625-445308d5e893?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1665413642308-c5c1ed052d12?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1779449604530-89f5e6748b7e?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1710107446916-1b0c67a99042?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1512374382149-233c42b6a83b?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1543508282-6319a3e2621f?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1663100769321-9eb8fe5a8e6b?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=1200&q=80&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1779449604558-fb4ad80ce80b?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=1200&q=80&auto=format&fit=crop"
];

const NOUNS = [
  // Apparel
  { term: 'Oversized Hoodie', cat: 'hoodies' },
  { term: 'Heavyweight Tee', cat: 'oversized-tees' },
  { term: 'Bomber Jacket', cat: 'jackets' },
  { term: 'Denim Jacket', cat: 'jackets' },
  { term: 'Graphic Tee', cat: 'graphic-tees' },
  { term: 'Trench Coat', cat: 'jackets' },
  { term: 'Vintage Tee', cat: 'graphic-tees' },
  { term: 'Fleece Crew', cat: 'sweatshirts' },
  { term: 'Windbreaker', cat: 'jackets' },
  { term: 'Capsule Jacket', cat: 'anime' },
  { term: 'Distressed Hoodie', cat: 'hoodies' },
  { term: 'Utility Vest', cat: 'jackets' },
  { term: 'Boxy Tee', cat: 'oversized-tees' },
  { term: 'Zip-Up Hoodie', cat: 'hoodies' },
  { term: 'Varsity Jacket', cat: 'jackets' },
  { term: 'Cargo Jacket', cat: 'jackets' },
  { term: 'Mock Neck Crew', cat: 'sweatshirts' },
  { term: 'Anime Collab Tee', cat: 'anime' },
  { term: 'Essential Tee', cat: 'oversized-tees' },
  { term: 'Washed Hoodie', cat: 'hoodies' },
  // Accessories
  { term: 'Matte Mobile Cover', cat: 'mobile-covers' },
  { term: 'Armored Phone Case', cat: 'mobile-covers' },
  { term: 'Silicone Snap Case', cat: 'mobile-covers' },
  { term: 'Ceramic Studio Mug', cat: 'mugs' },
  { term: 'Matte Black Mug', cat: 'mugs' },
  { term: 'Heavyweight Canvas Tote', cat: 'tote-bags' },
  { term: 'Utility Tote Bag', cat: 'tote-bags' },
  { term: 'Manifesto Poster', cat: 'posters' },
  { term: 'Editorial Art Print', cat: 'posters' },
  { term: 'Archive Poster', cat: 'posters' }
];

const ADJECTIVES = ['Monolith', 'Void', 'Shogun', 'Crimson', 'Phantom', 'Yurei', 'Noir', 'Ronin', 'Strata', 'Echo', 'Horizon', 'Akira', 'Vortex', 'Nebula', 'Urban', 'Onyx', 'Cobalt', 'Apex', 'Nomad', 'Zenith', 'Kinetics', 'Aura', 'Ethereal', 'Paradox', 'Nova', 'Cyber', 'Neon', 'Lunar', 'Solstice', 'Eclipse', 'Vector', 'Quantum', 'Glitch', 'Kitsune', 'Mecha', 'Samurai', 'Drift', 'Ascent', 'Rebel', 'Rogue'];

const DESCRIPTIONS = [
  'Heavyweight 400gsm brushed fleece. Dropped shoulders, boxy fit, tonal embroidery.',
  '240gsm combed cotton. Garment-dyed for a lived-in feel and ultimate drape.',
  'Satin finish with intricate back embroidery. Premium hardware and ribbed trims.',
  'Overdyed 12oz denim. Cropped fit with raw hem detailing and silver hardware.',
  'Screen-printed vintage artwork on our signature washed cotton canvas.',
  'Cocoon silhouette in ultra-soft fleece. Features elongated drawstrings and hidden pockets.',
  'A modern, draped take on the classic trench. Water-resistant and incredibly sharp.',
  'Faded and distressed by hand. Features washed-out typography and dropped shoulders.',
  'Textured loopback fleece with a structured collar and paneled sleeves.',
  'Lightweight nylon shell. Technical design featuring utility pockets and mesh lining.',
  'Minimalist aesthetic. Premium weight cotton cut in an ultra-relaxed proportion.',
  'Neo-Tokyo inspired. High-collar mock neck jacket in technical water-repellent fabric.',
  'Sun-faded wash with hand-distressed edges. A vintage look that gets better with wear.',
  'Psychedelic back graphic print on washed black cotton.',
  'Tactical multi-pocket vest designed for layering over hoodies and tees.',
  'Garment washed for a vintage feel. Built to last through countless wears.',
  'Ultra-premium Japanese cotton blended with a touch of stretch for mobility.',
  'Architecturally structured with raw edges and subtle tonal branding.'
];

const TAGS_POOL = ['oversized', 'bestseller', 'trending', 'new', 'limited', 'anime', 'y2k', 'cyberpunk', 'essential'];

const PRODUCTS_MOCK: any[] = [];

// Generating 1000 aesthetic products
for (let i = 0; i < 1000; i++) {
  const adj = ADJECTIVES[i % ADJECTIVES.length];
  const nounObj = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const title = `${adj} ${nounObj.term}`;
  const slug = title.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '') + '-' + i;
  
  const desc = DESCRIPTIONS[Math.floor(Math.random() * DESCRIPTIONS.length)];
  const price = Math.floor(Math.random() * (7000 - 1200 + 1) + 1200);
  
  const img1 = PHOTO_IDS[Math.floor(Math.random() * PHOTO_IDS.length)];
  let img2 = PHOTO_IDS[Math.floor(Math.random() * PHOTO_IDS.length)];
  while(img2 === img1) { img2 = PHOTO_IDS[Math.floor(Math.random() * PHOTO_IDS.length)]; }

  const numTags = Math.floor(Math.random() * 3) + 1;
  const tags = [];
  for(let j=0; j<numTags; j++) {
    tags.push(TAGS_POOL[Math.floor(Math.random() * TAGS_POOL.length)]);
  }

  PRODUCTS_MOCK.push({
    slug,
    title,
    categorySlug: nounObj.cat,
    description: desc,
    price,
    imgIds: [img1, img2],
    tags: [...new Set(tags)],
    isFeatured: Math.random() > 0.8
  });
}

const COLLECTIONS_SEED = [
  { name: 'Summer Collection', slug: 'summer-collection', desc: 'Lightweight styles for hot seasons' },
  { name: 'Winter Drop', slug: 'winter-drop', desc: 'Heavyweight fleece and outerwear' },
  { name: 'Cyberpunk Core', slug: 'cyberpunk-core', desc: 'Techwear and futuristic aesthetics' },
  { name: 'Y2K Archives', slug: 'y2k-archives', desc: 'Nostalgic 2000s inspired pieces' },
  { name: 'Essentials', slug: 'essentials', desc: 'Minimalist everyday basics' },
  { name: 'Anime Collabs', slug: 'anime-collabs', desc: 'Exclusive anime inspired designs' },
];

async function main() {
  console.log('🌱 Seeding DB...');

  // Clean tables
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.collection.deleteMany({});
  await prisma.drop.deleteMany({});

  // Seed Categories
  const categoryMap = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const record = await prisma.category.create({
      data: { name: cat.name, slug: cat.slug },
    });
    categoryMap.set(cat.slug, record.id);
  }
  console.log(`✅ Seeded ${categoryMap.size} categories.`);

  // Seed Collections
  const collectionIds: string[] = [];
  for (const col of COLLECTIONS_SEED) {
    const record = await prisma.collection.create({
      data: {
        name: col.name,
        slug: col.slug,
        description: col.desc,
        isActive: true,
      },
    });
    collectionIds.push(record.id);
  }
  console.log(`✅ Seeded ${collectionIds.length} Collections.`);

  // Seed Drops
  const drop = await prisma.drop.create({
    data: {
      name: 'Anime Capsule Vol. 03',
      slug: 'anime-capsule-03',
      releaseDate: new Date(),
      isActive: true,
    },
  });
  console.log('✅ Seeded active Drop.');

  // Seed Products and Variants in chunks to bypass network latency
  const chunkSize = 50;
  for (let i = 0; i < PRODUCTS_MOCK.length; i += chunkSize) {
    const chunk = PRODUCTS_MOCK.slice(i, i + chunkSize);
    
    await Promise.all(chunk.map(async (p) => {
      const categoryId = categoryMap.get(p.categorySlug);
      if (!categoryId) return;

      const imageUrls = p.imgIds;

      // Pick 1-2 random collections
      const numCols = Math.floor(Math.random() * 2) + 1;
      const selectedCols = [];
      for(let j=0; j<numCols; j++) {
        selectedCols.push({ id: collectionIds[Math.floor(Math.random() * collectionIds.length)] });
      }

      const productRecord = await prisma.product.create({
        data: {
          title: p.title,
          slug: p.slug,
          description: p.description,
          basePrice: p.price,
          isFeatured: p.isFeatured,
          mediaUrls: imageUrls,
          status: ProductStatus.PUBLISHED,
          categoryId: categoryId,
          tags: p.tags,
          dropId: p.categorySlug === 'anime' ? drop.id : null,
          collections: { connect: selectedCols }
        },
      });

      const colors = COLORS.slice(0, 3);
      const variantsData = [];
      for (const color of colors) {
        for (const size of SIZES) {
          variantsData.push({
              productId: productRecord.id,
              sku: `${p.slug.toUpperCase().slice(0, 15)}-${Math.floor(Math.random()*100000)}-${color.name.toUpperCase().slice(0, 3)}-${size}`,
              size,
              color: color.name,
              stockQuantity: 50,
              mediaUrls: imageUrls,
              thumbnailUrl: imageUrls[0],
          });
        }
      }
      await prisma.productVariant.createMany({ data: variantsData });
    }));
    console.log(`✅ Seeded ${Math.min(i + chunkSize, PRODUCTS_MOCK.length)} / ${PRODUCTS_MOCK.length} products...`);
  }

  console.log(`✅ Seeded ${PRODUCTS_MOCK.length} products with aesthetic images & collections.`);
  console.log('🌱 Database Seeding Completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

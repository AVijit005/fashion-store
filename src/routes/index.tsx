import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/home/hero";
import { CategoryRail } from "@/components/home/category-rail";
import { DropFeature } from "@/components/home/drop-feature";
import { AnimeBand } from "@/components/home/anime-band";
import { FlashSale } from "@/components/home/flash-sale";
import { Lookbook } from "@/components/home/lookbook";
import { BestSellers } from "@/components/home/best-sellers";
import { StudioTeaser } from "@/components/home/studio-teaser";
import { TrustStrip } from "@/components/home/trust-strip";
import { TrendingNow } from "@/components/home/trending-now";
import { ShopByMood } from "@/components/home/shop-by-mood";
import { CreatorSpotlight } from "@/components/home/creator-spotlight";
import { RecentlyViewed } from "@/components/home/recently-viewed";
import { CommunityProof } from "@/components/home/community-proof";
import { ReelsStrip } from "@/components/home/reels-strip";
import { EditorialQuote } from "@/components/home/editorial-quote";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ink Studio — Heavyweight streetwear, anime drops, custom prints" },
      {
        name: "description",
        content:
          "A small-batch streetwear studio. Heavyweight cotton, editorial prints, and a print shop for one-of-one pieces.",
      },
      {
        property: "og:title",
        content: "Ink Studio — Heavyweight streetwear, anime drops, custom prints",
      },
      {
        property: "og:description",
        content: "Heavyweight cotton tees, anime drops, hoodies, jackets, and a print studio.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Hero />
      <CategoryRail />
      <DropFeature />
      <FlashSale />
      <TrendingNow />
      <AnimeBand />
      <ShopByMood />
      <BestSellers />
      <EditorialQuote />
      <Lookbook />
      <CreatorSpotlight />
      <ReelsStrip />
      <StudioTeaser />
      <RecentlyViewed />
      <CommunityProof />
      <TrustStrip />
    </>
  );
}

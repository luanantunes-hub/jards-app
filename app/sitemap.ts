import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = "https://jards.com.br";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE_URL}/blog`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/termos`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/privacidade`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("blog_posts" as any)
    .select("slug, publicado_em")
    .eq("status", "publicado");

  const postRoutes: MetadataRoute.Sitemap = ((posts ?? []) as { slug: string; publicado_em: string | null }[]).map(
    (post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: post.publicado_em ?? undefined,
      changeFrequency: "monthly",
      priority: 0.6,
    })
  );

  return [...staticRoutes, ...postRoutes];
}

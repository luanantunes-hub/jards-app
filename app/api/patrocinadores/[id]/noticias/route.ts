import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CACHE_DAYS = 7;
const PROVIDER = "google_news_rss";
const TERMS = ["patrocínio"];

type RSSArticle = {
  title: string;
  url: string;
  description: string | null;
  publishedAt: string | null;
  sourceName: string | null;
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRSS(xml: string): RSSArticle[] {
  const items: RSSArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
    const link =
      block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ||
      block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim();
    const rawDesc = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1];
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
    const sourceName = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() ?? null;

    if (!title || !link) continue;

    let publishedAt: string | null = null;
    if (pubDate) {
      try { publishedAt = new Date(pubDate).toISOString(); } catch { /* ignore */ }
    }

    const description = rawDesc ? stripHtml(rawDesc).slice(0, 300) || null : null;

    items.push({ title, url: link, description, publishedAt, sourceName });
  }
  return items;
}

async function fetchGoogleNews(companyName: string): Promise<RSSArticle[]> {
  const q = `"${companyName}" ${TERMS[0]}`;
  const params = new URLSearchParams({ q, hl: "pt-BR", gl: "BR", ceid: "BR:pt-BR" });
  const res = await fetch(`https://news.google.com/rss/search?${params.toString()}`, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
  });
  if (!res.ok) throw new Error(`Google News RSS respondeu ${res.status}`);
  return parseRSS(await res.text());
}

function isFresh(value: string | null | undefined) {
  if (!value) return false;
  return Date.now() - new Date(value).getTime() < CACHE_DAYS * 86_400_000;
}

function periodStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function getCompany(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("empresas").select("id, nome").eq("id", id).single();
  if (error || !data) return null;
  return data as { id: string; nome: string };
}

async function getState(id: string) {
  const admin = createAdminClient();
  const [{ data: items }, { data: query }] = await Promise.all([
    admin
      .from("news_items")
      .select("id, titulo, resumo, url_original, nome_veiculo, imagem_url, publicado_em, capturado_em")
      .eq("empresa_id", id)
      .order("publicado_em", { ascending: false, nullsFirst: false })
      .limit(10),
    admin
      .from("empresa_news_queries")
      .select("ultima_busca_em, proxima_busca_em, ultima_busca_status, ultima_busca_erro")
      .eq("empresa_id", id)
      .maybeSingle(),
  ]);
  return { items: items ?? [], query: query ?? null };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await requireUser()) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) return NextResponse.json({ error: "Patrocinador não encontrado" }, { status: 404 });
  const state = await getState(id);
  return NextResponse.json({
    items: state.items,
    lastSearchAt: state.query?.ultima_busca_em ?? null,
    status: state.query?.ultima_busca_status ?? "never",
    needsRefresh: !isFresh(state.query?.ultima_busca_em),
    hasCache: state.items.length > 0,
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await requireUser()) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) return NextResponse.json({ error: "Patrocinador não encontrado" }, { status: 404 });

  const admin = createAdminClient();
  const current = await getState(id);

  if (isFresh(current.query?.ultima_busca_em)) {
    return NextResponse.json({ items: current.items, refreshed: false, status: "fresh" });
  }

  // Registra uso (sem bloquear — RSS é gratuito, só monitorar)
  try {
    await admin.rpc("reserve_news_api_search", {
      p_provider: PROVIDER,
      p_periodo: periodStart(),
      p_limite: 10_000,
    });
  } catch {
    // A telemetria de uso não deve impedir a leitura das notícias via RSS.
  }

  try {
    const articles = await fetchGoogleNews(company.nome);
    const now = new Date().toISOString();

    const rows = articles
      .filter((a) => a.title && a.url)
      .map((a) => ({
        empresa_id: id,
        titulo: a.title,
        resumo: a.description,
        url_original: a.url,
        url_canonica: a.url,
        nome_veiculo: a.sourceName,
        imagem_url: null,
        publicado_em: a.publishedAt,
        capturado_em: now,
        expira_em: new Date(Date.now() + CACHE_DAYS * 86_400_000).toISOString(),
        relevancia: 80,
        updated_at: now,
      }));

    if (rows.length > 0) {
      const { error } = await admin
        .from("news_items")
        .upsert(rows, { onConflict: "empresa_id,url_canonica" });
      if (error) throw error;
    }

    await admin.from("empresa_news_queries").upsert({
      empresa_id: id,
      ultima_busca_em: now,
      proxima_busca_em: new Date(Date.now() + CACHE_DAYS * 86_400_000).toISOString(),
      ultima_busca_status: rows.length > 0 ? "success" : "empty",
      ultima_busca_erro: null,
      updated_at: now,
    });

    const next = await getState(id);
    return NextResponse.json({
      items: next.items,
      refreshed: true,
      status: rows.length > 0 ? "success" : "empty",
      lastSearchAt: now,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Falha desconhecida";
    await admin.from("empresa_news_queries").upsert({
      empresa_id: id,
      ultima_busca_status: "provider_error",
      ultima_busca_erro: message,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json(
      { items: current.items, refreshed: false, status: "provider_error", error: "Não foi possível atualizar as notícias" },
      { status: 502 },
    );
  }
}

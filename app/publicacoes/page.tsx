import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BannerCiclo from "@/components/site/BannerCiclo";
import { Capa, FOCO, Meta, ROTULO, Temas, TITULO_HOVER, fmtData, type PostResumo } from "@/components/blog/partes";

type Post = PostResumo;

export const metadata = {
  title: "Publicações — Jards",
  description: "Insights, descobertas e conversas interessantes sobre captação de recursos.",
};

export default async function BlogPublicPage() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("blog_posts" as any)
    .select("id, titulo, slug, tags, seo_descricao, imagem_capa, imagem_alt, publicado_em, conteudo")
    .eq("status", "publicado")
    .order("publicado_em", { ascending: false });

  const list = (posts ?? []) as Post[];
  // Hierarquia: o mais recente em destaque, os três seguintes em grade e o
  // resto numa lista enxuta.
  const [destaque, ...resto] = list;
  const grade = resto.slice(0, 3);
  const arquivo = resto.slice(3);

  return (
    <main>
      <section className="mx-auto max-w-pagina px-5 pt-12 pb-10 md:px-8 md:pt-20 md:pb-14">
        <p className={`${ROTULO} text-[#684DB0]`}>Publicações</p>
        <div className="mt-4 grid gap-5 md:grid-cols-12 md:items-end md:gap-10">
          <h1 className="text-[clamp(2.25rem,5.2vw,4.25rem)] leading-[1.02] font-bold tracking-[-0.035em] text-[#282525] md:col-span-8">
            Insights, descobertas e conversas sobre captação
          </h1>
          <p className="max-w-[38ch] text-base leading-relaxed text-black/55 md:col-span-4 md:pb-2 md:text-[1.0625rem]">
            O que aprendemos trabalhando com captação de recursos culturais no Brasil.
          </p>
        </div>
      </section>

      {!destaque && (
        <p className="mx-auto max-w-pagina border-t border-black/10 px-5 py-20 text-sm text-black/45 md:px-8">
          Nenhum texto publicado ainda.
        </p>
      )}

      {destaque && (
        <section aria-labelledby="destaque" className="mx-auto max-w-pagina px-5 md:px-8">
          <Link
            href={`/publicacoes/${destaque.slug}`}
            className={`group grid gap-6 border-t border-black/10 pt-6 md:grid-cols-12 md:gap-10 md:pt-10 ${FOCO}`}
          >
            <Capa post={destaque} prioridade className="aspect-[4/3] md:col-span-7 md:aspect-[5/4]" />
            <div className="flex flex-col md:col-span-5 md:justify-center md:py-6">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className={`${ROTULO} text-black/45`}>Mais recente</span>
                <Temas tags={destaque.tags} />
              </div>
              <h2
                id="destaque"
                className={`mt-4 text-[clamp(1.875rem,3.4vw,3rem)] leading-[1.06] font-bold tracking-[-0.03em] text-balance text-[#282525] ${TITULO_HOVER}`}
              >
                {destaque.titulo}
              </h2>
              {destaque.seo_descricao && (
                <p className="mt-5 max-w-[46ch] text-[1.0625rem] leading-relaxed text-black/55">{destaque.seo_descricao}</p>
              )}
              <Meta post={destaque} className="mt-6" />
              <span className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[#282525]">
                Ler o texto
                <i className="ph ph-arrow-right transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              </span>
            </div>
          </Link>
        </section>
      )}

      {grade.length > 0 && (
        <section aria-labelledby="mais-textos" className="mx-auto max-w-pagina px-5 pt-16 md:px-8 md:pt-24">
          <h2 id="mais-textos" className={`${ROTULO} border-t border-black/10 pt-4 text-black/45`}>Mais textos</h2>
          <ul className="mt-8 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {grade.map((post) => (
              <li key={post.id}>
                <Link href={`/publicacoes/${post.slug}`} className={`group flex flex-col ${FOCO}`}>
                  <Capa post={post} className="aspect-[4/3] sm:aspect-[4/5]" />
                  <Temas tags={post.tags} className="mt-5" />
                  <h3 className={`mt-2 text-[1.375rem] leading-[1.2] font-bold tracking-[-0.015em] text-balance text-[#282525] ${TITULO_HOVER}`}>
                    {post.titulo}
                  </h3>
                  {post.seo_descricao && (
                    <p className="mt-3 line-clamp-3 text-[0.9375rem] leading-relaxed text-black/55">{post.seo_descricao}</p>
                  )}
                  <Meta post={post} className="mt-4" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {arquivo.length > 0 && (
        <section aria-labelledby="arquivo" className="mx-auto max-w-pagina px-5 pt-16 md:px-8 md:pt-24">
          <h2 id="arquivo" className={`${ROTULO} border-t border-black/10 pt-4 text-black/45`}>Arquivo</h2>
          <ul className="mt-2 divide-y divide-black/[.08]">
            {arquivo.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/publicacoes/${post.slug}`}
                  className={`group grid gap-1.5 py-5 md:grid-cols-12 md:items-baseline md:gap-8 ${FOCO}`}
                >
                  <span className={`${ROTULO} text-black/45 md:col-span-2`}>{fmtData(post.publicado_em)}</span>
                  <span className={`text-lg leading-snug font-bold text-[#282525] md:col-span-7 ${TITULO_HOVER}`}>{post.titulo}</span>
                  <Temas tags={post.tags} className="md:col-span-3 md:text-right" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BannerCiclo />
    </main>
  );
}

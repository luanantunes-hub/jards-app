import type { DiaPublico } from "@/lib/producao/programacao";
import { MarcaDaSessao } from "@/components/producao/MarcaDaSessao";
import { textoSobreCor, type Bloco } from "@/lib/producao/site";
import { diaPorExtenso } from "@/components/producao/ProgramacaoPublicaView";

export type SiteParaDesenhar = {
  titulo: string; cor: string; espaco: string;
  menu: { slug: string; titulo: string }[];
  pagina: { slug: string; titulo: string; blocos: Bloco[] };
  programacao: DiaPublico[] | null;
};

/** O endereço de uma página do site: a de início é a raiz; as outras, /slug (no domínio da pessoa ou na prévia). */
const caminhoDe = (base: string, slug: string) => (slug === "inicio" ? base || "/" : `${base}/${slug}`);

function Programacao({ titulo, dias }: { titulo: string; dias: DiaPublico[] | null }) {
  return (
    <section aria-label={titulo || "Programação"}>
      {titulo && <h2 className="mb-3 text-[1.25rem] font-semibold tracking-[-.01em]">{titulo}</h2>}
      {!dias || dias.length === 0 ? (
        <p className="rounded border border-black/10 px-4 py-5 text-[0.9375rem] opacity-70">Nenhuma sessão marcada por enquanto. Volte em breve.</p>
      ) : (
        <div className="space-y-4">
          {dias.map(dia => (
            <div key={dia.dia}>
              <h3 className="mb-1.5 text-[0.75rem] font-medium uppercase tracking-[.08em] opacity-60">{diaPorExtenso(dia.dia)}</h3>
              <ul className="divide-y divide-black/10 overflow-hidden rounded border border-black/10">
                {dia.sessoes.map((sessao, indice) => (
                  <li key={`${sessao.inicio}-${sessao.sala}-${indice}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-3">
                    <span className="w-28 shrink-0 text-[0.9375rem] font-medium tabular-nums">{sessao.inicio} às {sessao.fim}</span>
                    <span className="min-w-0 flex-1 basis-40 text-[0.9375rem]">{sessao.titulo}{sessao.marca && <MarcaDaSessao marca={sessao.marca} />}</span>
                    <span className="text-[0.8125rem] opacity-60">{sessao.sala}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BlocoDoSite({ bloco, programacao }: { bloco: Bloco; programacao: DiaPublico[] | null }) {
  switch (bloco.tipo) {
    case "titulo":
      return <h2 className="text-[1.5rem] font-semibold tracking-[-.02em]">{bloco.texto}</h2>;
    case "texto":
      return <div className="space-y-3 text-[1rem] leading-relaxed">{bloco.texto.split(/\n{2,}/).map((paragrafo, indice) => <p key={indice} className="whitespace-pre-line">{paragrafo}</p>)}</div>;
    case "imagem":
      // eslint-disable-next-line @next/next/no-img-element -- imagem de endereço externo (https), sem otimização do Next
      return <img src={bloco.url} alt={bloco.alt} loading="lazy" referrerPolicy="no-referrer" className="h-auto max-w-full rounded" />;
    case "botao":
      return <a href={bloco.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded bg-[#282525] px-5 py-2.5 text-[0.9375rem] font-medium text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{bloco.rotulo}</a>;
    case "programacao":
      return <Programacao titulo={bloco.titulo} dias={programacao} />;
    case "contato":
      return (
        <dl className="space-y-1.5 text-[1rem]">
          {bloco.endereco && <div><dt className="sr-only">Endereço</dt><dd>{bloco.endereco}</dd></div>}
          {bloco.telefone && <div><dt className="sr-only">Telefone</dt><dd><a className="underline underline-offset-2" href={`tel:${bloco.telefone.replace(/[^\d+]/g, "")}`}>{bloco.telefone}</a></dd></div>}
          {bloco.email && <div><dt className="sr-only">E-mail</dt><dd><a className="underline underline-offset-2" href={`mailto:${bloco.email}`}>{bloco.email}</a></dd></div>}
        </dl>
      );
  }
}

/**
 * O site do espaço desenhado: cabeçalho com o título e o menu, e os blocos da página. Serve ao domínio da pessoa (`base` vazio)
 * e à prévia do painel (`base` é o caminho da prévia). `previa` marca o rascunho com uma faixa.
 */
export function SiteView({ site, base, previa }: { site: SiteParaDesenhar; base: string; previa?: boolean }) {
  const texto = textoSobreCor(site.cor);
  return (
    <div className="min-h-screen bg-white text-[#282525]">
      {previa && <p role="status" className="bg-[#282525] px-4 py-2 text-center text-[0.75rem] text-white">Prévia do rascunho: só quem está logado vê esta página.</p>}
      <header style={{ backgroundColor: site.cor, color: texto }}>
        <div className="mx-auto flex w-full max-w-[56rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
          <a href={caminhoDe(base, "inicio")} className="text-[1.125rem] font-semibold tracking-[-.01em] focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: texto }}>{site.titulo}</a>
          {site.menu.length > 1 && (
            <nav aria-label="Páginas do site">
              <ul className="flex flex-wrap gap-x-5 gap-y-1">
                {site.menu.map(item => (
                  <li key={item.slug}><a href={caminhoDe(base, item.slug)} aria-current={item.slug === site.pagina.slug ? "page" : undefined} className={`text-[0.875rem] underline-offset-4 hover:underline ${item.slug === site.pagina.slug ? "underline" : "opacity-90"}`} style={{ color: texto }}>{item.titulo}</a></li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[56rem] px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="sr-only">{site.pagina.titulo}</h1>
        {site.pagina.blocos.length === 0 ? (
          <p className="text-[0.9375rem] opacity-60">Esta página ainda não tem conteúdo.</p>
        ) : (
          <div className="space-y-8">
            {site.pagina.blocos.map((bloco, indice) => <BlocoDoSite key={indice} bloco={bloco} programacao={site.programacao} />)}
          </div>
        )}
      </main>
    </div>
  );
}

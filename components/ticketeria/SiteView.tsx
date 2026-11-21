import type { DiaPublico } from "@/lib/producao/programacao";
import { MarcaDaSessao } from "@/components/producao/MarcaDaSessao";
import { ContagemRegressiva } from "@/components/ticketeria/ContagemRegressiva";
import { enderecoDoMapa, enderecoDoVideo, textoSobreCor, type Bloco, type ColunaDoBloco } from "@/lib/ticketeria/site";
import { variaveisDoTema } from "@/lib/ticketeria/temas";
import { AgendaDoSite } from "@/components/ticketeria/AgendaDoSite";
import { MenuDoSite, RodapeDoSite } from "@/components/ticketeria/MenuERodapeDoSite";
import type { AparenciaDoSite } from "@/lib/ticketeria/aparencia";
import { DestaqueDoSite } from "@/components/ticketeria/DestaqueDoSite";
import type { ItemDaAgenda } from "@/lib/ticketeria/evento-site";
import { diaPorExtenso } from "@/components/producao/ProgramacaoPublicaView";

export type SiteParaDesenhar = {
  titulo: string; cor: string;
  /** O tema do site (lib/ticketeria/temas.ts); sem ele, o clássico. */
  tema?: string;
  menu: { slug: string; titulo: string }[];
  pagina: { slug: string; titulo: string; blocos: Bloco[] };
  /** A hora do servidor (ms), para a contagem regressiva começar certa; quem monta o site a traz de `agoraDoServidor`. */
  agora: number;
  /** Os eventos da Agenda (só quando a página tem um bloco de agenda). */
  agenda?: ItemDaAgenda[];
  /** O menu e o rodapé escolhidos para o site (sem eles, o clássico e o simples) e a página do primeiro evento publicado, para onde o botão de ingressos leva quando não tem endereço. */
  aparencia?: AparenciaDoSite;
  caminhoDoPrimeiroEvento?: string | null;
  /** A programação de cada espaço da Produção citado num bloco, pelo id do espaço. */
  programacoes: Record<string, DiaPublico[]>;
  /** As sessões de cada evento citado num bloco de ingressos, pelo id do evento. */
  ingressos?: Record<string, { id: string; quando: string; local: string; url: string }[]>;
};

/** O endereço de uma página do site: a de início é a raiz; as outras, /slug (no domínio da pessoa ou na prévia). */
const caminhoDe = (base: string, slug: string) => (slug === "inicio" ? base || "/" : `${base}/${slug}`);

function Programacao({ titulo, dias }: { titulo: string; dias: DiaPublico[] | null }) {
  return (
    <section aria-label={titulo || "Programação"}>
      {titulo && <h2 className="mb-3 text-[1.25rem] font-medium tracking-[-.01em]">{titulo}</h2>}
      {!dias || dias.length === 0 ? (
        <p className="rounded-[var(--site-raio)] border border-[color:var(--site-borda)] px-4 py-5 text-[0.9375rem] opacity-70">Nenhuma sessão marcada por enquanto. Volte em breve.</p>
      ) : (
        <div className="space-y-4">
          {dias.map(dia => (
            <div key={dia.dia}>
              <h3 className="mb-1.5 text-[0.75rem] font-normal uppercase tracking-[.08em] opacity-60">{diaPorExtenso(dia.dia)}</h3>
              <ul className="divide-y divide-[color:var(--site-borda)] overflow-hidden rounded-[var(--site-raio)] border border-[color:var(--site-borda)]">
                {dia.sessoes.map((sessao, indice) => (
                  <li key={`${sessao.inicio}-${sessao.sala}-${indice}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-3">
                    <span className="w-28 shrink-0 text-[0.9375rem] font-normal tabular-nums">{sessao.inicio} às {sessao.fim}</span>
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

/** As sessões de um evento à venda, cada uma com o botão que leva à página de compra. Sem sessão por vir, a frase de espera. */
export function IngressosDoEvento({ titulo, sessoes }: { titulo: string; sessoes: { id: string; quando: string; local: string; url: string }[] | null }) {
  return (
    <section aria-label={titulo || "Ingressos"}>
      {titulo && <h2 className="mb-3 text-[1.25rem] font-medium tracking-[-.01em]">{titulo}</h2>}
      {!sessoes || sessoes.length === 0 ? (
        <p className="rounded-[var(--site-raio)] border border-[color:var(--site-borda)] px-4 py-5 text-[0.9375rem] opacity-70">Nenhuma sessão à venda por enquanto. Volte em breve.</p>
      ) : (
        <ul className="divide-y divide-[color:var(--site-borda)] overflow-hidden rounded-[var(--site-raio)] border border-[color:var(--site-borda)]">
          {sessoes.map(sessao => (
            <li key={sessao.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
              <span className="min-w-0 flex-1 basis-56">
                <span className="block text-[0.9375rem] font-normal">{sessao.quando}</span>
                {sessao.local && <span className="block text-[0.8125rem] opacity-60">{sessao.local}</span>}
              </span>
              <a href={sessao.url} className="inline-flex min-h-11 items-center rounded-[var(--site-raio)] bg-[color:var(--site-botao)] px-5 py-2.5 text-[0.875rem] font-normal text-[color:var(--site-botao-texto)] transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2">Comprar ingressos</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


const BOTAO_CLARO = "inline-flex min-h-11 items-center rounded-[var(--site-raio)] bg-white px-5 py-2.5 text-[0.9375rem] font-normal text-[#282525] transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** A faixa de abertura: com imagem de fundo (escurecida, para o texto branco ler bem) ou na cor do tema. */
export function Capa({ bloco, cor }: { bloco: Pick<Extract<Bloco, { tipo: "capa" }>, "titulo" | "subtitulo" | "imagem" | "botao_rotulo" | "botao_url">; cor: string }) {
  const comImagem = bloco.imagem !== "";
  const texto = comImagem ? "#ffffff" : textoSobreCor(cor);
  return (
    <section aria-label={bloco.titulo} className="relative isolate overflow-hidden rounded-[var(--site-raio)]" style={{ backgroundColor: cor, color: texto }}>
      {comImagem && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem de endereço externo (https), sem otimização do Next */}
          <img src={bloco.imagem} alt="" loading="eager" referrerPolicy="no-referrer" className="absolute inset-0 -z-20 h-full w-full object-cover" />
          <span aria-hidden="true" className="absolute inset-0 -z-10 bg-black/55" />
        </>
      )}
      <div className="mx-auto flex max-w-[40rem] flex-col items-center gap-3 px-5 py-12 text-center sm:py-16">
        <h2 className="text-[1.75rem] font-medium leading-tight tracking-[-.02em] sm:text-[2.25rem]">{bloco.titulo}</h2>
        {bloco.subtitulo && <p className="text-[1rem] leading-relaxed opacity-90">{bloco.subtitulo}</p>}
        {bloco.botao_rotulo && (comImagem || texto === "#ffffff"
          ? <a href={bloco.botao_url} target="_blank" rel="noopener noreferrer" className={`mt-2 ${BOTAO_CLARO}`}>{bloco.botao_rotulo}</a>
          : <a href={bloco.botao_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center rounded-[var(--site-raio)] bg-[#282525] px-5 py-2.5 text-[0.9375rem] font-normal text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525]">{bloco.botao_rotulo}</a>)}
      </div>
    </section>
  );
}

function Coluna({ coluna }: { coluna: ColunaDoBloco }) {
  if (coluna.tipo === "imagem") {
    // eslint-disable-next-line @next/next/no-img-element -- imagem de endereço externo (https), sem otimização do Next
    return <img src={coluna.url} alt={coluna.alt} loading="lazy" referrerPolicy="no-referrer" className="h-auto w-full rounded-[var(--site-raio)]" />;
  }
  return <div className="space-y-3 text-[1rem] leading-relaxed">{coluna.texto.split(/\n{2,}/).map((paragrafo, indice) => <p key={indice} className="whitespace-pre-line">{paragrafo}</p>)}</div>;
}

function TituloDoBloco({ titulo }: { titulo: string }) {
  return titulo ? <h2 className="mb-3 text-[1.25rem] font-medium tracking-[-.01em]">{titulo}</h2> : null;
}

const SANDBOX_DO_QUADRO = "allow-scripts allow-same-origin allow-popups allow-presentation";

function BlocoDoSite({ bloco, cor, agora, base, semLinksDeEvento, agenda, programacoes, ingressos }: { bloco: Bloco; cor: string; agora: number; base: string; semLinksDeEvento: boolean; agenda: ItemDaAgenda[]; programacoes: Record<string, DiaPublico[]>; ingressos: Record<string, { id: string; quando: string; local: string; url: string }[]> }) {
  switch (bloco.tipo) {
    case "titulo":
      return <h2 className="text-[1.5rem] font-medium tracking-[-.02em]">{bloco.texto}</h2>;
    case "texto":
      return <div className="space-y-3 text-[1rem] leading-relaxed">{bloco.texto.split(/\n{2,}/).map((paragrafo, indice) => <p key={indice} className="whitespace-pre-line">{paragrafo}</p>)}</div>;
    case "imagem":
      // eslint-disable-next-line @next/next/no-img-element -- imagem de endereço externo (https), sem otimização do Next
      return <img src={bloco.url} alt={bloco.alt} loading="lazy" referrerPolicy="no-referrer" className="h-auto max-w-full rounded-[var(--site-raio)]" />;
    case "botao":
      return <a href={bloco.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-[var(--site-raio)] bg-[color:var(--site-botao)] px-5 py-2.5 text-[0.9375rem] font-normal text-[color:var(--site-botao-texto)] transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{bloco.rotulo}</a>;
    case "capa":
      return <DestaqueDoSite bloco={bloco} cor={cor} agenda={agenda} base={base} semLinks={semLinksDeEvento} agora={agora} />;
    case "colunas":
      return <div className="grid items-center gap-5 sm:grid-cols-2"><Coluna coluna={bloco.esquerda} /><Coluna coluna={bloco.direita} /></div>;
    case "galeria":
      return (
        <section aria-label={bloco.titulo || "Galeria"}>
          <TituloDoBloco titulo={bloco.titulo} />
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {bloco.imagens.map((imagem, indice) => (
              <li key={indice}>
                {/* eslint-disable-next-line @next/next/no-img-element -- imagem de endereço externo (https), sem otimização do Next */}
                <img src={imagem.url} alt={imagem.alt} loading="lazy" referrerPolicy="no-referrer" className="aspect-square w-full rounded-[var(--site-raio)] object-cover" />
              </li>
            ))}
          </ul>
        </section>
      );
    case "video":
      return (
        <section aria-label={bloco.titulo || "Vídeo"}>
          <TituloDoBloco titulo={bloco.titulo} />
          <iframe src={enderecoDoVideo(bloco)} title={bloco.titulo || "Vídeo"} loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox={SANDBOX_DO_QUADRO} className="aspect-video w-full rounded-[var(--site-raio)] border-0 bg-black/5" />
        </section>
      );
    case "mapa":
      return (
        <section aria-label={bloco.titulo || "Mapa"}>
          <TituloDoBloco titulo={bloco.titulo} />
          <iframe src={enderecoDoMapa(bloco.endereco)} title={bloco.titulo || `Mapa: ${bloco.endereco}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" sandbox={SANDBOX_DO_QUADRO} className="h-72 w-full rounded-[var(--site-raio)] border-0 bg-black/5 sm:h-80" />
          <p className="mt-1.5 text-[0.8125rem] opacity-60">{bloco.endereco}</p>
        </section>
      );
    case "contagem":
      return <ContagemRegressiva titulo={bloco.titulo} ate={bloco.ate} depois={bloco.depois} inicial={agora} />;
    case "faq":
      return (
        <section aria-label={bloco.titulo || "Perguntas frequentes"}>
          <TituloDoBloco titulo={bloco.titulo} />
          <div className="divide-y divide-[color:var(--site-borda)] overflow-hidden rounded-[var(--site-raio)] border border-[color:var(--site-borda)]">
            {bloco.itens.map((item, indice) => (
              <details key={indice} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-[0.9375rem] font-normal focus-visible:outline-2 focus-visible:outline-offset-[-2px]">
                  <span>{item.pergunta}</span>
                  <span aria-hidden="true" className="shrink-0 opacity-50 transition group-open:rotate-45">+</span>
                </summary>
                <p className="whitespace-pre-line px-4 pb-4 text-[0.9375rem] leading-relaxed opacity-80">{item.resposta}</p>
              </details>
            ))}
          </div>
        </section>
      );
    case "patrocinadores":
      return (
        <section aria-label={bloco.titulo || "Patrocinadores"}>
          {bloco.titulo && <h2 className="mb-3 text-center text-[0.8125rem] font-normal opacity-60">{bloco.titulo}</h2>}
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5">
            {bloco.itens.map((item, indice) => {
              // eslint-disable-next-line @next/next/no-img-element -- imagem de endereço externo (https), sem otimização do Next
              const logo = <img src={item.url} alt={item.alt} loading="lazy" referrerPolicy="no-referrer" className="h-12 w-auto max-w-[9rem] object-contain" />;
              return <li key={indice}>{item.link ? <a href={item.link} target="_blank" rel="noopener noreferrer sponsored" className="block focus-visible:outline-2 focus-visible:outline-offset-4">{logo}</a> : logo}</li>;
            })}
          </ul>
        </section>
      );
    case "agenda":
      return <AgendaDoSite titulo={bloco.titulo} layout={bloco.layout} itens={agenda} base={base} semLinks={semLinksDeEvento} agora={agora} />;
    case "programacao":
      return <Programacao titulo={bloco.titulo} dias={bloco.espaco_id ? programacoes[bloco.espaco_id] ?? null : null} />;
    case "ingressos":
      return <IngressosDoEvento titulo={bloco.titulo} sessoes={bloco.evento_id ? ingressos[bloco.evento_id] ?? null : null} />;
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

/** O quadro do site: o tema, o cabeçalho com o título e o menu, e o miolo da página (os blocos, ou a página de um evento). `paginaAtual` marca o item do menu em que a pessoa está (vazio: nenhum). */
export function QuadroDoSite({ site, base, previa, paginaAtual, children }: { site: Pick<SiteParaDesenhar, "titulo" | "cor" | "tema" | "menu" | "aparencia" | "caminhoDoPrimeiroEvento">; base: string; previa?: boolean; paginaAtual: string; children: React.ReactNode }) {
  return (
    <div className="site-tema min-h-screen" style={{ ...variaveisDoTema(site.tema, site.cor), backgroundColor: "var(--site-fundo)", color: "var(--site-texto)", fontFamily: "var(--site-fonte)" }}>
      <style>{".site-tema h1,.site-tema h2,.site-tema h3{font-family:var(--site-fonte-titulos)}"}</style>
      {previa && <p role="status" className="bg-[#282525] px-4 py-2 text-center text-[0.75rem] text-white">Prévia do rascunho: só quem está logado vê esta página.</p>}
      <MenuDoSite titulo={site.titulo} cor={site.cor} paginas={site.menu} paginaAtual={paginaAtual} base={base} aparencia={site.aparencia} caminhoDoPrimeiroEvento={site.caminhoDoPrimeiroEvento ?? null} />
      <main className="mx-auto w-full max-w-[56rem] px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <RodapeDoSite titulo={site.titulo} aparencia={site.aparencia} />
    </div>
  );
}

/**
 * O site da loja desenhado: cabeçalho com o título e o menu, e os blocos da página. Serve ao domínio da pessoa (`base` vazio)
 * e à prévia do painel (`base` é o caminho da prévia). `previa` marca o rascunho com uma faixa.
 */
export function SiteView({ site, base, previa }: { site: SiteParaDesenhar; base: string; previa?: boolean }) {
  return (
    <QuadroDoSite site={site} base={base} previa={previa} paginaAtual={site.pagina.slug}>
      <h1 className="sr-only">{site.pagina.titulo}</h1>
      {site.pagina.blocos.length === 0 ? (
        <p className="text-[0.9375rem] opacity-60">Esta página ainda não tem conteúdo.</p>
      ) : (
        <div className="space-y-8">
          {site.pagina.blocos.map((bloco, indice) => <BlocoDoSite key={indice} bloco={bloco} cor={site.cor} agora={site.agora} base={base} semLinksDeEvento={Boolean(previa)} agenda={site.agenda ?? []} programacoes={site.programacoes} ingressos={site.ingressos ?? {}} />)}
        </div>
      )}
    </QuadroDoSite>
  );
}

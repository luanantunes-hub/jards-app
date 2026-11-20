import { Capa, QuadroDoSite } from "@/components/ticketeria/SiteView";
import { dadosEstruturadosDoEvento, enderecoDoEvento, jsonParaScript } from "@/lib/ticketeria/evento-site";
import type { EventoNaApi, SessaoNaApi } from "@/lib/ticketeria/integracao";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import type { EventoPublicoDoDominio } from "@/lib/ticketeria/site-publico";

// A página de um evento no site da loja (C2; desenho aprovado pelo dono em 20/11/2026): a capa com o título, a classificação e o local; a descrição; e as sessões com preço, poucos ingressos,
// esgotado e o botão Comprar (a compra do Jards, em outra aba). Usa o tema e a cor do site. Leva os dados estruturados de evento para o Google.

function detalheDaSessao(s: SessaoNaApi): string | null {
  if (s.estado === "esgotada") return null;
  if (s.estado === "vendas_pausadas") return "Vendas pausadas";
  if (s.estado !== "aberta") return null;
  return s.poucos ? "poucos ingressos" : s.a_partir_de_centavos !== null ? `a partir de ${formatarMoeda(s.a_partir_de_centavos)}` : null;
}

function Sessao({ sessao }: { sessao: SessaoNaApi }) {
  const detalhe = detalheDaSessao(sessao);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--site-raio)] border border-[color:var(--site-borda)] px-4 py-3.5">
      <span className="min-w-0 flex-1 basis-56">
        <span className="block text-[0.9375rem] font-normal">{sessao.quando}</span>
        {(sessao.local || detalhe) && <span className="block text-[0.8125rem] opacity-60">{[sessao.local, detalhe].filter(Boolean).join(" · ")}</span>}
      </span>
      {sessao.estado === "aberta"
        ? <a href={sessao.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-[var(--site-raio)] bg-[color:var(--site-botao)] px-5 py-2.5 text-[0.875rem] font-normal text-[color:var(--site-botao-texto)] transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2">Comprar</a>
        : sessao.estado === "esgotada"
          ? <a href={sessao.url} target="_blank" rel="noopener noreferrer" className="text-[0.8125rem] underline underline-offset-2 opacity-70 hover:opacity-100">Esgotado · lista de espera</a>
          : <span className="text-[0.8125rem] opacity-60">Indisponível</span>}
    </li>
  );
}

export function EventoDoSiteView({ dados, host }: { dados: EventoPublicoDoDominio; host: string }) {
  const e: EventoNaApi = dados.evento;
  const local = e.sessoes[0]?.local ?? "";
  const subtitulo = [e.classificacao, local].filter(Boolean).join(" · ");
  const imagem = e.imagem && /^https:\/\//.test(e.imagem) ? e.imagem : "";
  const estruturados = dadosEstruturadosDoEvento(e, enderecoDoEvento(host, e.slug), dados.organizacao || dados.titulo);
  return (
    <QuadroDoSite site={dados} base="" paginaAtual="">
      <article className="space-y-8">
        <h1 className="sr-only">{e.titulo}</h1>
        <Capa bloco={{ tipo: "capa", titulo: e.titulo, subtitulo, imagem, botao_rotulo: "", botao_url: "" }} cor={dados.cor} />
        {e.descricao && <div className="space-y-3 text-[1rem] leading-relaxed">{e.descricao.split(/\n{2,}/).map((paragrafo, i) => <p key={i} className="whitespace-pre-line">{paragrafo}</p>)}</div>}
        <section aria-label="Sessões">
          <h2 className="mb-3 text-[1.25rem] font-medium tracking-[-.01em]">Sessões</h2>
          {e.sessoes.length === 0
            ? <p className="rounded-[var(--site-raio)] border border-[color:var(--site-borda)] px-4 py-5 text-[0.9375rem] opacity-70">Nenhuma sessão à venda por enquanto. Volte em breve.</p>
            : <ul className="space-y-2.5">{e.sessoes.map(s => <Sessao key={s.id} sessao={s} />)}</ul>}
        </section>
      </article>
      {estruturados.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonParaScript(estruturados) }} />}
    </QuadroDoSite>
  );
}

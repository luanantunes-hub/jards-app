"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { agruparPorMes, botaoDoItem, caminhoDoEvento, corDoEspaco, diasComSessao, filtrarAgenda, filtrosDaAgenda, gradeDoMes, linhasDaAgenda, partesDoInstante, periodoDoItem, seloDoItem, diaPorExtensoDaAgenda, type ItemDaAgenda, type LinhaDaAgenda } from "@/lib/ticketeria/evento-site";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import type { LayoutDaAgenda } from "@/lib/ticketeria/site";

// A agenda de eventos do site da loja, em cinco layouts (a biblioteca de seções, passo 2; desenhos aprovados pelo dono em 20/11/2026): carrossel, grade, lista por mês, calendário do mês e
// com filtros. Os cartões e as linhas leem do tema do site (cor, fonte, cantos, botão) e mostram o estado do evento: selo "Esgotado" ou "Últimos ingressos", botão que diz o que acontece
// depois ("Datas e ingressos", "Lista de espera"). Na prévia do editor (`semLinks`) nada leva a lugar nenhum: a página do evento só existe no site no ar.

const BOTAO = "inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--site-raio)] px-4 text-[0.8125rem] font-semibold transition";
const BOTAO_FORTE = `${BOTAO} bg-[color:var(--site-botao)] text-[color:var(--site-botao-texto)]`;
const BOTAO_SUAVE = `${BOTAO} border border-[color:var(--site-borda)] opacity-80`;
const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2";

/** O fundo do cartaz quando o evento não tem imagem: duas cores sorteadas do título, sempre as mesmas. */
function fundoDoCartaz(titulo: string): string {
  let h = 0;
  for (const c of titulo) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const matiz = h % 360;
  return `linear-gradient(160deg, hsl(${matiz} 42% 30%), hsl(${(matiz + 45) % 360} 48% 17%))`;
}

function Alvo({ href, className, children, rotulo }: { href: string | null; className: string; children: ReactNode; rotulo?: string }) {
  return href === null ? <div className={className}>{children}</div> : <a href={href} aria-label={rotulo} className={`${className} ${FOCO}`}>{children}</a>;
}

function Cartaz({ item, proporcao, titulo, semSelo }: { item: ItemDaAgenda; proporcao: string; titulo?: boolean; semSelo?: boolean }) {
  const selo = semSelo ? null : seloDoItem(item);
  return (
    <span className={`relative block w-full overflow-hidden rounded-[var(--site-raio)] ${proporcao}`} style={item.imagem ? undefined : { background: fundoDoCartaz(item.titulo) }}>
      {item.imagem && (
        // eslint-disable-next-line @next/next/no-img-element -- imagem de endereço externo (https), sem otimização do Next
        <img src={item.imagem} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {titulo && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent" />}
      {selo && <span className={`absolute left-2 top-2 rounded px-2 py-0.5 text-[0.6875rem] font-bold tracking-[.02em] text-white ${selo.tom === "esgotado" ? "bg-[#1f1b27]" : "bg-[#d9531e]"}`}>{selo.texto}</span>}
      {titulo && <span className="absolute inset-x-3 bottom-2.5 text-[1.125rem] font-medium leading-tight text-white [font-family:var(--site-fonte-titulos)] [text-shadow:0_1px_8px_rgba(0,0,0,.5)]">{item.titulo}</span>}
    </span>
  );
}

/** Cartaz e sinopse: imagem, título, duas linhas, o período em negrito, o espaço e o botão. */
function CartaoCartaz({ item, base, semLinks, agora }: { item: ItemDaAgenda; base: string; semLinks: boolean; agora: number }) {
  const botao = botaoDoItem(item.estado);
  const periodo = periodoDoItem(item, agora);
  return (
    <Alvo href={semLinks ? null : caminhoDoEvento(base, item.slug)} className="flex h-full min-w-0 flex-col gap-2 transition hover:opacity-90" rotulo={`${item.titulo}: ${botao.texto}`}>
      <Cartaz item={item} proporcao="aspect-[4/3]" />
      <h3 className="mt-1 text-[1.0625rem] font-medium leading-snug">{item.titulo}</h3>
      {item.descricao && <p className="line-clamp-2 text-[0.8125rem] opacity-75">{item.descricao}</p>}
      {periodo && <p className="text-[0.8125rem] font-bold">{periodo}</p>}
      <span className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="min-w-0 truncate text-[0.75rem] opacity-70">{item.lista[0]?.local_nome}</span>
        <span className={botao.forte ? BOTAO_FORTE : BOTAO_SUAVE}>{botao.texto}</span>
      </span>
    </Alvo>
  );
}

/** Foto com o título por cima e a cor do espaço: o período, o botão, o espaço com um pino colorido e uma listra na base. */
function CartaoFoto({ item, base, semLinks, agora }: { item: ItemDaAgenda; base: string; semLinks: boolean; agora: number }) {
  const botao = botaoDoItem(item.estado);
  const espaco = item.lista[0]?.local_nome ?? "";
  const cor = corDoEspaco(espaco);
  return (
    <Alvo href={semLinks ? null : caminhoDoEvento(base, item.slug)} className="flex h-full min-w-0 flex-col transition hover:opacity-90" rotulo={`${item.titulo}: ${botao.texto}`}>
      <Cartaz item={item} proporcao="aspect-[3/4]" titulo />
      <span className="flex items-center justify-between gap-2 pt-2.5 text-[0.8125rem]">
        <span className="font-bold">{periodoDoItem(item, agora)}</span>
        <span className={botao.forte ? BOTAO_FORTE : BOTAO_SUAVE}>{botao.texto}</span>
      </span>
      {espaco && <span className="mt-1 inline-flex items-center gap-1.5 text-[0.75rem] opacity-85"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: cor }} />{espaco}</span>}
      <span aria-hidden="true" className="mt-2 block h-1 rounded-b-[var(--site-raio)]" style={{ background: cor }} />
    </Alvo>
  );
}

/** O botão de uma sessão: comprar, lista de espera ou indisponível. */
function BotaoDaSessao({ linha, semLinks }: { linha: LinhaDaAgenda; semLinks: boolean }) {
  const { sessao } = linha;
  const texto = sessao.estado === "aberta" ? "Comprar" : sessao.estado === "esgotada" ? "Lista de espera" : "Indisponível";
  const classe = sessao.estado === "aberta" ? BOTAO_FORTE : BOTAO_SUAVE;
  if (semLinks || (sessao.estado !== "aberta" && sessao.estado !== "esgotada")) return <span className={classe}>{texto}</span>;
  return <a href={sessao.url} target="_blank" rel="noopener noreferrer" className={`${classe} ${FOCO}`}>{texto}</a>;
}

function DetalheDaSessao({ linha }: { linha: LinhaDaAgenda }) {
  const { sessao, item } = linha;
  const detalhe = sessao.estado === "esgotada" ? "esgotado" : sessao.poucos && sessao.estado === "aberta" ? "últimos ingressos" : sessao.estado === "aberta" && sessao.a_partir_de_centavos !== null ? `a partir de ${formatarMoeda(sessao.a_partir_de_centavos)}` : null;
  return <span className="block text-[0.75rem] opacity-70">{[linha.hora, sessao.local_nome, detalhe].filter(Boolean).join(" · ")}<span className="sr-only"> ({item.titulo})</span></span>;
}

function TituloDoEvento({ item, base, semLinks }: { item: ItemDaAgenda; base: string; semLinks: boolean }) {
  return semLinks
    ? <h3 className="text-[1.0625rem] font-medium leading-snug">{item.titulo}</h3>
    : <h3 className="text-[1.0625rem] font-medium leading-snug"><a href={caminhoDoEvento(base, item.slug)} className={`underline-offset-2 hover:underline ${FOCO}`}>{item.titulo}</a></h3>;
}

/** A linha de uma sessão, no estilo de pauta: o dia grande à esquerda, o título e os detalhes, o botão. */
function LinhaDePauta({ linha, base, semLinks }: { linha: LinhaDaAgenda; base: string; semLinks: boolean }) {
  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-b border-[color:var(--site-borda)] py-3.5 sm:grid-cols-[4rem_minmax(0,1fr)_auto]">
      <span className="text-center leading-none"><span className="block text-[1.75rem] [font-family:var(--site-fonte-titulos)]">{linha.dia}</span><span className="text-[0.6875rem] uppercase tracking-[.08em] opacity-70">{linha.semana}</span></span>
      <span className="min-w-0"><TituloDoEvento item={linha.item} base={base} semLinks={semLinks} /><DetalheDaSessao linha={linha} /></span>
      <span className="col-start-2 justify-self-start sm:col-start-auto"><BotaoDaSessao linha={linha} semLinks={semLinks} /></span>
    </li>
  );
}

/** Uma linha pequena (foto, título, hora e espaço, botão): a lista do dia escolhido no calendário. */
function LinhaCompacta({ linha, base, semLinks }: { linha: LinhaDaAgenda; base: string; semLinks: boolean }) {
  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-[color:var(--site-borda)] py-3">
      <span className="block w-14"><Cartaz item={linha.item} proporcao="aspect-square" semSelo /></span>
      <span className="min-w-0"><TituloDoEvento item={linha.item} base={base} semLinks={semLinks} /><DetalheDaSessao linha={linha} /></span>
      <span className="col-start-2 justify-self-start"><BotaoDaSessao linha={linha} semLinks={semLinks} /></span>
    </li>
  );
}

const Chip = ({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) => (
  <button type="button" aria-pressed={ativo} onClick={onClick} className={`min-h-9 rounded-full border px-3.5 text-[0.8125rem] transition ${FOCO} ${ativo ? "border-[color:var(--site-botao)] bg-[color:var(--site-botao)] text-[color:var(--site-botao-texto)]" : "border-[color:var(--site-borda)] hover:opacity-80"}`}>{children}</button>
);

function Carrossel({ itens, base, semLinks, agora }: { itens: ItemDaAgenda[]; base: string; semLinks: boolean; agora: number }) {
  const faixa = useRef<HTMLUListElement>(null);
  const mover = (passo: number) => faixa.current?.scrollBy({ left: passo * Math.max(240, (faixa.current?.clientWidth ?? 600) * 0.8), behavior: "smooth" });
  return (
    <div className="relative">
      <div className="mb-3 hidden justify-end gap-2 sm:flex">
        <button type="button" aria-label="Mostrar os anteriores" onClick={() => mover(-1)} className={`h-9 w-9 rounded-full border border-[color:var(--site-borda)] ${FOCO}`}>‹</button>
        <button type="button" aria-label="Mostrar os próximos" onClick={() => mover(1)} className={`h-9 w-9 rounded-full border border-[color:var(--site-borda)] ${FOCO}`}>›</button>
      </div>
      <ul ref={faixa} className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {itens.map(item => <li key={item.slug} className="w-[72%] shrink-0 snap-start sm:w-[16.5rem]"><CartaoCartaz item={item} base={base} semLinks={semLinks} agora={agora} /></li>)}
      </ul>
    </div>
  );
}

function Grade({ itens, base, semLinks, agora, foto = true }: { itens: ItemDaAgenda[]; base: string; semLinks: boolean; agora: number; foto?: boolean }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {itens.map(item => <li key={item.slug} className="min-w-0">{foto ? <CartaoFoto item={item} base={base} semLinks={semLinks} agora={agora} /> : <CartaoCartaz item={item} base={base} semLinks={semLinks} agora={agora} />}</li>)}
    </ul>
  );
}

function ListaPorMes({ itens, base, semLinks, ano }: { itens: ItemDaAgenda[]; base: string; semLinks: boolean; ano: number }) {
  const grupos = agruparPorMes(linhasDaAgenda(itens), ano);
  return (
    <div className="space-y-5">
      {grupos.map(g => (
        <div key={g.chave}>
          <h3 className="mb-1 text-[1rem] font-medium">{g.titulo}</h3>
          <ul>{g.linhas.map(l => <LinhaDePauta key={l.sessao.id} linha={l} base={base} semLinks={semLinks} />)}</ul>
        </div>
      ))}
    </div>
  );
}

const NOMES_DA_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function CalendarioDoMes({ itens, base, semLinks, agora }: { itens: ItemDaAgenda[]; base: string; semLinks: boolean; agora: number }) {
  const linhas = useMemo(() => linhasDaAgenda(itens), [itens]);
  const inicial = linhas[0]?.partes ?? partesDoInstante(new Date(agora).toISOString());
  const [mes, setMes] = useState<{ ano: number; mes: number }>({ ano: inicial?.ano ?? 2026, mes: inicial?.mes ?? 0 });
  const dias = useMemo(() => diasComSessao(linhas, mes.ano, mes.mes), [linhas, mes]);
  const [escolhido, setEscolhido] = useState<number | null>(linhas[0] ? linhas[0].partes.dia : null);
  const grade = gradeDoMes(mes.ano, mes.mes);
  const meses = [...new Set(linhas.map(l => l.partes.ano * 12 + l.partes.mes))];
  const atual = mes.ano * 12 + mes.mes;
  const ir = (passo: number) => { const n = atual + passo; const novo = { ano: Math.floor(n / 12), mes: n % 12 }; setMes(novo); const primeiro = diasComSessao(linhas, novo.ano, novo.mes); setEscolhido(primeiro.size > 0 ? Math.min(...primeiro.keys()) : null); };
  const doDia = escolhido !== null ? dias.get(escolhido) ?? [] : [];
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[1rem] font-medium" aria-live="polite">{grade.titulo}</span>
          <span className="flex gap-2">
            <button type="button" aria-label="Mês anterior" disabled={!meses.some(m => m < atual)} onClick={() => ir(-1)} className={`h-9 w-9 rounded-full border border-[color:var(--site-borda)] disabled:opacity-30 ${FOCO}`}>‹</button>
            <button type="button" aria-label="Próximo mês" disabled={!meses.some(m => m > atual)} onClick={() => ir(1)} className={`h-9 w-9 rounded-full border border-[color:var(--site-borda)] disabled:opacity-30 ${FOCO}`}>›</button>
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[0.75rem]">
          {NOMES_DA_SEMANA.map(n => <b key={n} className="py-1 text-[0.6875rem] font-normal opacity-60">{n}</b>)}
          {Array.from({ length: grade.vazios }, (_, i) => <span key={`v${i}`} />)}
          {Array.from({ length: grade.dias }, (_, i) => {
            const dia = i + 1;
            const tem = dias.has(dia);
            const ativo = escolhido === dia;
            return tem
              ? <button key={dia} type="button" aria-pressed={ativo} aria-label={`${dia}: ${dias.get(dia)?.length} ${dias.get(dia)?.length === 1 ? "sessão" : "sessões"}`} onClick={() => setEscolhido(dia)} className={`grid h-10 place-items-center rounded-[calc(var(--site-raio)*.6)] bg-[color:var(--site-botao)] font-bold text-[color:var(--site-botao-texto)] ${ativo ? "ring-2 ring-offset-2 ring-[color:var(--site-texto)]" : "opacity-85"} ${FOCO}`}>{dia}</button>
              : <span key={dia} className="grid h-10 place-items-center opacity-60">{dia}</span>;
          })}
        </div>
      </div>
      <div className="min-w-0">
        {escolhido !== null && doDia.length > 0
          ? <><h3 className="text-[0.9375rem] font-medium">{diaPorExtensoDaAgenda(doDia[0].partes)}</h3><ul>{doDia.map(l => <LinhaCompacta key={l.sessao.id} linha={l} base={base} semLinks={semLinks} />)}</ul></>
          : <p className="text-[0.875rem] opacity-70">Escolha um dia marcado para ver o que há nele.</p>}
      </div>
    </div>
  );
}

function ComFiltros({ itens, base, semLinks, agora, ano }: { itens: ItemDaAgenda[]; base: string; semLinks: boolean; agora: number; ano: number }) {
  const linhas = useMemo(() => linhasDaAgenda(itens), [itens]);
  const filtros = useMemo(() => filtrosDaAgenda(linhas, ano), [linhas, ano]);
  const [mes, setMes] = useState<string | null>(null);
  const [espaco, setEspaco] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const achados = filtrarAgenda(itens, { mes, espaco, busca });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filtros.meses.length > 1 && <><Chip ativo={mes === null} onClick={() => setMes(null)}>Todos os meses</Chip>{filtros.meses.map(m => <Chip key={m.chave} ativo={mes === m.chave} onClick={() => setMes(m.chave)}>{m.titulo}</Chip>)}</>}
        {filtros.espacos.length > 1 && <><span aria-hidden="true" className="mx-1 h-5 w-px bg-[color:var(--site-borda)]" /><Chip ativo={espaco === null} onClick={() => setEspaco(null)}>Todos os espaços</Chip>{filtros.espacos.map(e => <Chip key={e} ativo={espaco === e} onClick={() => setEspaco(e)}>{e}</Chip>)}</>}
        <input type="search" aria-label="Buscar por nome" placeholder="Buscar por nome" value={busca} onChange={e => setBusca(e.target.value)} maxLength={60} className="ml-auto min-h-9 w-full rounded-[var(--site-raio)] border border-[color:var(--site-borda)] bg-transparent px-3 text-[0.8125rem] sm:w-52" />
      </div>
      {achados.length === 0
        ? <p className="rounded-[var(--site-raio)] border border-[color:var(--site-borda)] px-4 py-5 text-[0.9375rem] opacity-80">Nenhum evento com esses filtros. <button type="button" onClick={() => { setMes(null); setEspaco(null); setBusca(""); }} className={`underline underline-offset-2 ${FOCO}`}>Limpar os filtros</button></p>
        : <Grade itens={achados} base={base} semLinks={semLinks} agora={agora} foto={false} />}
    </div>
  );
}

export function AgendaDoSite({ titulo, layout, itens, base, semLinks, agora }: { titulo: string; layout: LayoutDaAgenda; itens: ItemDaAgenda[]; base: string; semLinks: boolean; agora: number }) {
  const ano = partesDoInstante(new Date(agora).toISOString())?.ano ?? new Date(agora).getUTCFullYear();
  return (
    <section aria-label={titulo || "Agenda"}>
      {titulo && <h2 className="mb-3 text-[1.25rem] font-medium tracking-[-.01em]">{titulo}</h2>}
      {itens.length === 0 ? (
        <p className="rounded-[var(--site-raio)] border border-[color:var(--site-borda)] px-4 py-5 text-[0.9375rem] opacity-70">Nenhum evento em cartaz por enquanto. Volte em breve.</p>
      ) : layout === "carrossel" ? <Carrossel itens={itens} base={base} semLinks={semLinks} agora={agora} />
        : layout === "lista" ? <ListaPorMes itens={itens} base={base} semLinks={semLinks} ano={ano} />
        : layout === "calendario" ? <CalendarioDoMes itens={itens} base={base} semLinks={semLinks} agora={agora} />
        : layout === "filtros" ? <ComFiltros itens={itens} base={base} semLinks={semLinks} agora={agora} ano={ano} />
        : <Grade itens={itens} base={base} semLinks={semLinks} agora={agora} />}
    </section>
  );
}


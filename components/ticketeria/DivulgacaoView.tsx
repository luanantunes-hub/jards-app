"use client";

import { useState } from "react";
import { Check, Megaphone } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { CANAIS_DE_DIVULGACAO, CANAL_DA_IMPRENSA, ROTULO_SEM_ORIGEM, SEM_ORIGEM, enderecoDeDivulgacao, nomeDaAcaoNoLink, resumirDivulgacao, serieDoGrafico, type AcaoComResultado, type CamposDaAcao, type LinhaDaDivulgacao, type SessaoParaDivulgar } from "@/lib/ticketeria/divulgacao";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import { Aviso, CAMPO, ROTULO, Rodape } from "@/components/ticketeria/FolhasDosEventos";

// O painel Divulgação (a tela do produtor): de onde vieram as vendas, por canal, e a folha de criar um link de divulgação. Só desenho: os dados e as ações chegam por props.
// Segue o DESIGN.md da Ticketeria: rótulos pequenos em caixa alta, valores em tinta e tabulares, cantos de 12px, sem cor fora de estado e de gráfico.

const BORDA = "rgba(13,13,13,.08)";
// `relative`: o texto `sr-only` do cabeçalho (posicionado de forma absoluta) fica dentro da célula; solto, contava como parte da página e criava um segundo scroll, com espaço em branco, em listas compridas.
const CABECALHO = "relative px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";
const ROTULO_PEQUENO = "text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45";
const BOTAO_FINAL = "rounded-xl acao-principal px-4 py-2.5 text-[0.75rem] font-normal text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]";
const CANCELAR = "rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

function Indicador({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio?: string }) {
  return (
    <div className="min-w-0 rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
      <p className={ROTULO_PEQUENO}>{rotulo}</p>
      <p className="mt-1.5 text-[1.5rem] font-medium tabular-nums tracking-[-.02em] text-[#282525]">{valor}</p>
      {apoio && <p className="mt-1 text-[0.6875rem] text-black/40">{apoio}</p>}
    </div>
  );
}

/** O painel: o filtro de sessão, os três números e a tabela por canal. `sessaoId` nulo é "todas as sessões". */
export function DivulgacaoDaLoja({ linhas, sessoes, sessaoId, onSessao, onCriarLink }: {
  linhas: LinhaDaDivulgacao[]; sessoes: SessaoParaDivulgar[]; sessaoId: string | null; onSessao?: (id: string | null) => void; onCriarLink?: () => void;
}) {
  const resumo = resumirDivulgacao(linhas, sessaoId);
  const maior = Math.max(1, ...resumo.canais.map(c => c.porcento));
  const total = resumo.canais.length;
  return (
    <div className="space-y-4">
      <div className="w-full max-w-sm">
        <Dropdown ariaLabel="Sessão" value={sessaoId ?? ""} onChange={v => onSessao?.(v === "" ? null : v)} options={[{ value: "", label: "Todas as sessões" }, ...sessoes.map(s => ({ value: s.id, label: `${s.evento} · ${s.quando}` }))]} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Indicador rotulo="Ingressos vendidos" valor={String(resumo.ingressos)} />
        <Indicador rotulo="Vendido" valor={formatarMoeda(resumo.vendido_centavos)} apoio="já com os descontos de cupom" />
        <Indicador rotulo={ROTULO_SEM_ORIGEM} valor={`${resumo.sem_origem_porcento}%`} apoio="quem entrou por um link sem identificação" />
      </div>
      {total === 0 ? (
        <div className="rounded-xl border bg-white" style={{ borderColor: BORDA }}>
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <Megaphone size={28} className="mb-3 text-black/15" aria-hidden="true" />
            <p className="text-[0.875rem] font-medium text-black/55">Nenhuma venda ainda</p>
            <p className="mt-1.5 max-w-sm text-[0.75rem] leading-relaxed text-black/35">Crie um link de divulgação e cole onde for divulgar. Quando alguém comprar por ele, o canal aparece aqui.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
          <table className="w-full min-w-[40rem] border-collapse">
            <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Canal</th><th className={`${CABECALHO} text-right`}>Ingressos</th><th className={`${CABECALHO} text-right`}>Vendido</th><th className={CABECALHO}><span className="sr-only">Parte do total</span></th><th className={`${CABECALHO} text-right`}>Do total</th></tr></thead>
            <tbody className="divide-y divide-black/[.08]">
              {resumo.canais.map(c => (
                <tr key={c.chave}>
                  <td className={`${CELULA} ${c.chave === SEM_ORIGEM ? "text-black/50" : ""}`}>{c.rotulo}</td>
                  <td className={`${CELULA} text-right tabular-nums`}>{c.ingressos}</td>
                  <td className={`${CELULA} text-right tabular-nums`}>{formatarMoeda(c.vendido_centavos)}</td>
                  <td className={CELULA}><div className="h-2 w-44 rounded bg-[#EFECF6]" aria-hidden="true"><div className="h-2 rounded" style={{ width: `${(c.porcento / maior) * 100}%`, background: c.chave === SEM_ORIGEM ? "#CFCAD9" : "#7259B5" }} /></div></td>
                  <td className={`${CELULA} text-right tabular-nums`}>{c.porcento}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3.5" style={{ borderColor: "rgba(176,122,20,.25)", background: "#FFFBF2" }}>
        <p className="max-w-2xl text-[0.8125rem] text-black/60">Sempre que divulgar, use um link criado aqui. Assim cada venda chega com o nome do canal e você vê o que realmente trouxe gente.</p>
        <button type="button" onClick={onCriarLink} className="rounded-xl border bg-white px-3.5 py-2 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" style={{ borderColor: BORDA }}>Criar link</button>
      </div>
    </div>
  );
}

/** A folha de criar o link: a sessão, onde vai divulgar, um nome para a ação (opcional) e o link pronto para copiar. `origem` é o endereço do Jards (do navegador; nos testes, à mão). */
export function LinkDeDivulgacaoSheet({ sessoes, origem, sessaoInicial = null, canalInicial = "instagram", acaoInicial = "", copiadoDeInicio = false, onClose }: {
  sessoes: SessaoParaDivulgar[]; origem: string; sessaoInicial?: string | null; canalInicial?: string; acaoInicial?: string; copiadoDeInicio?: boolean; onClose: () => void;
}) {
  const abertas = sessoes.filter(s => s.a_venda);
  const [sessao, setSessao] = useState(sessaoInicial && abertas.some(s => s.id === sessaoInicial) ? sessaoInicial : abertas[0]?.id ?? "");
  const [canal, setCanal] = useState(canalInicial);
  const [acao, setAcao] = useState(acaoInicial);
  const [copiado, setCopiado] = useState(copiadoDeInicio);
  const [erro, setErro] = useState(false);
  const endereco = sessao ? enderecoDeDivulgacao(origem, sessao, canal, acao, true) : "";

  async function copiar() {
    try { await navigator.clipboard.writeText(endereco); setErro(false); setCopiado(true); setTimeout(() => setCopiado(false), 3000); } catch { setErro(true); }
  }

  return (
    <TopSheet titulo="Criar link de divulgação" onClose={onClose} footer={fechar => (
      <>
        <button type="button" onClick={fechar} className={CANCELAR}>Cancelar</button>
        <button type="button" onClick={() => void copiar()} disabled={!sessao} className={`${BOTAO_FINAL} inline-flex items-center gap-1.5 disabled:opacity-50`} aria-live="polite">
          {copiado && <Check size={13} aria-hidden="true" />}{erro ? "Não foi possível copiar" : copiado ? "Link copiado" : "Copiar link"}
        </button>
      </>
    )}>
      <div className="space-y-4">
        <p className="text-[0.8125rem] text-black/55">Um link para colar onde você for divulgar. Quem comprar por ele fica registrado nesse canal.</p>
        {abertas.length === 0 ? (
          <p className="rounded-xl border bg-white px-3 py-2 text-[0.75rem] text-black/55" style={{ borderColor: BORDA }}>Nenhuma sessão à venda. Crie uma sessão no evento para gerar o link.</p>
        ) : (
          <>
            <div><span className={ROTULO}>Sessão</span><Dropdown ariaLabel="Sessão do link" value={sessao} onChange={setSessao} options={abertas.map(s => ({ value: s.id, label: `${s.evento} · ${s.quando}` }))} /></div>
            <div>
              <span className={ROTULO}>Onde você vai divulgar</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Onde você vai divulgar">
                {CANAIS_DE_DIVULGACAO.map(c => (
                  <button key={c.valor} type="button" onClick={() => setCanal(c.valor)} aria-pressed={canal === c.valor}
                    className={`rounded-xl border px-3 py-1.5 text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${canal === c.valor ? "border-[#7259B5] bg-[#F5F2FB] font-normal text-[#1C0E33]" : "bg-white text-black/60 hover:bg-black/[.03]"}`}
                    style={canal === c.valor ? undefined : { borderColor: BORDA }}>{c.rotulo}</button>
                ))}
              </div>
            </div>
            <div><label className={ROTULO} htmlFor="dv-acao">Nome da ação (opcional)</label><input id="dv-acao" className={CAMPO} value={acao} onChange={e => setAcao(e.target.value)} placeholder="Stories do lote 2" maxLength={60} /></div>
            <div className="break-all rounded-xl bg-[#F6F5F8] px-4 py-3 text-[0.75rem] leading-relaxed text-black/60" aria-label="Link de divulgação">{endereco}</div>
          </>
        )}
      </div>
    </TopSheet>
  );
}

// ─── Ações e gasto (passo B) ────────────────────────────────────────────────

const dataCurta = (dia: string) => { const [, m, d] = dia.split("-"); return `${d}/${m}`; };
const periodoEmTexto = (inicio: string, fim: string) => (inicio === fim ? dataCurta(inicio) : `${dataCurta(inicio)} a ${dataCurta(fim)}`);

/** O gráfico de ingressos por dia, com uma faixa por ação em cima. Os dias sem venda ficam vazios; os rótulos de data saem de 7 em 7 dias. */
function GraficoDeVendas({ por_dia, acoes, hoje }: { por_dia: Record<string, number>; acoes: AcaoComResultado[]; hoje: string }) {
  const { dias, faixas } = serieDoGrafico(por_dia, acoes, hoje);
  if (dias.length === 0) return null;
  const W = 1000, ALTURA = 190, ESQ = 30, BASE = 22, LINHA = 12;
  const linhas = faixas.reduce((m, f) => Math.max(m, f.linha + 1), 0);
  const TOPO = 6 + linhas * LINHA;
  const maximo = Math.max(4, ...dias.map(d => d.ingressos));
  const h = ALTURA - TOPO - BASE;
  const largura = (W - ESQ) / dias.length;
  const marcas = [0, Math.ceil(maximo / 2), maximo];
  return (
    <svg viewBox={`0 0 ${W} ${ALTURA}`} width="100%" role="img" aria-label="Ingressos vendidos por dia, com as ações de divulgação marcadas" className="mt-3">
      {marcas.map(v => { const y = TOPO + h - (v / maximo) * h; return <g key={v}><line x1={ESQ} x2={W} y1={y} y2={y} stroke="rgba(13,13,13,.07)" /><text x={0} y={y + 4} fontSize="10" fill="rgba(13,13,13,.35)">{v}</text></g>; })}
      {faixas.map(f => <rect key={f.id} x={ESQ + f.de * largura} y={4 + f.linha * LINHA} width={(f.ate - f.de + 1) * largura} height={8} rx={4} fill="#D9A441" opacity={0.75}><title>{f.nome}</title></rect>)}
      {dias.map((d, i) => d.ingressos > 0 && <rect key={d.dia} x={ESQ + i * largura + largura * 0.18} y={TOPO + h - (d.ingressos / maximo) * h} width={largura * 0.64} height={(d.ingressos / maximo) * h} rx={Math.min(3, largura * 0.2)} fill="#7259B5"><title>{`${dataCurta(d.dia)}: ${d.ingressos}`}</title></rect>)}
      {dias.map((d, i) => i % 7 === 0 && <text key={`r${d.dia}`} x={ESQ + i * largura + 2} y={ALTURA - 6} fontSize="10" fill="rgba(13,13,13,.4)">{dataCurta(d.dia)}</text>)}
    </svg>
  );
}

/** As ações de divulgação: o gráfico de vendas por dia com as ações marcadas e a tabela com gasto, ingressos e custo por ingresso. */
export function AcoesDaLoja({ acoes, por_dia, hoje, onAbrir, onRegistrar }: { acoes: AcaoComResultado[]; por_dia: Record<string, number>; hoje: string; onAbrir?: (id: string) => void; onRegistrar?: () => void }) {
  const temVenda = Object.keys(por_dia).length > 0;
  if (acoes.length === 0 && !temVenda) {
    return (
      <div className="rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        <div className="flex flex-col items-center px-4 py-20 text-center">
          <Megaphone size={28} className="mb-3 text-black/15" aria-hidden="true" />
          <p className="text-[0.875rem] font-medium text-black/55">Nenhuma ação registrada</p>
          <p className="mt-1.5 max-w-sm text-[0.75rem] leading-relaxed text-black/35">Anote o que você fez para vender (um anúncio, os stories, um e-mail) e quanto gastou. Aqui você vê se as vendas subiram e quanto custou cada ingresso.</p>
          <button type="button" onClick={onRegistrar} className="mt-4 rounded-xl border bg-white px-3.5 py-2 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" style={{ borderColor: BORDA }}>Registrar ação</button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white px-5 pb-3 pt-4" style={{ borderColor: BORDA }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={ROTULO_PEQUENO}>Ingressos vendidos por dia</p>
          <p className="flex gap-4 text-[0.6875rem] text-black/50"><span><i className="mr-1.5 inline-block size-2 rounded-sm bg-[#7259B5]" aria-hidden="true" />Vendas</span><span><i className="mr-1.5 inline-block size-2 rounded-sm bg-[#D9A441]" aria-hidden="true" />Ações de divulgação</span></p>
        </div>
        {temVenda || acoes.length > 0 ? <GraficoDeVendas por_dia={por_dia} acoes={acoes} hoje={hoje} /> : null}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        <table className="w-full min-w-[44rem] border-collapse">
          <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Ação</th><th className={CABECALHO}>Canal</th><th className={CABECALHO}>Período</th><th className={`${CABECALHO} text-right`}>Gasto</th><th className={`${CABECALHO} text-right`}>Ingressos</th><th className={`${CABECALHO} text-right`}>Custo por ingresso</th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            {acoes.map(a => (
              <tr key={a.id}>
                <td className={CELULA}><button type="button" onClick={() => onAbrir?.(a.id)} className="rounded-xl text-left font-normal underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{a.nome}</button></td>
                <td className={`${CELULA} text-black/70`}>{a.rotulo_do_canal}</td>
                <td className={`${CELULA} tabular-nums text-black/70`}>{periodoEmTexto(a.inicio, a.fim)}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{formatarMoeda(a.gasto_centavos)}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{a.ingressos > 0 ? a.ingressos : <span className="text-black/35">—</span>}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{a.custo_por_ingresso_centavos !== null ? formatarMoeda(a.custo_por_ingresso_centavos) : <span className="text-black/35">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="max-w-3xl text-[0.75rem] leading-relaxed text-black/45">Isto mostra o que aconteceu junto, não prova que a ação causou a venda: quem viu um anúncio pode comprar dias depois, por outro caminho. Os ingressos de cada ação são os de quem comprou pelo link de divulgação com o mesmo nome; sem o link, aparece um traço.</p>
    </div>
  );
}

/** A folha de registrar ou editar uma ação: nome, onde divulgou, o período e quanto gastou. */
export function AcaoSheet({ editando, valores, erro, salvando, veiculos = [], eventos = [], onMudar, onClose, onSalvar, onApagar }: {
  editando: boolean; valores: CamposDaAcao; erro?: string | null; salvando?: boolean;
  /** Na imprensa: os veículos já marcados na casa (para reconhecer o mesmo) e os eventos (de qual a matéria fala). */ veiculos?: { nome: string; vezes: number }[]; eventos?: { id: string; titulo: string }[];
  onMudar?: <K extends keyof CamposDaAcao>(campo: K, valor: CamposDaAcao[K]) => void; onClose: () => void; onSalvar?: () => void; onApagar?: () => void;
}) {
  const imprensa = valores.canal === CANAL_DA_IMPRENSA;
  const nomeNoLink = imprensa ? null : nomeDaAcaoNoLink(valores.nome);
  return (
    <TopSheet titulo={editando ? "Editar ação" : "Registrar ação"} onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={!!salvando} rotulo={editando ? "Salvar" : "Registrar ação"} onSalvar={() => onSalvar?.()} onApagar={editando ? onApagar : undefined} rotuloApagar="Apagar" />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        {!imprensa && <div><label className={ROTULO} htmlFor="ac-nome">Nome da ação</label><input id="ac-nome" className={CAMPO} value={valores.nome} onChange={e => onMudar?.("nome", e.target.value)} placeholder="Stories do lote 2" maxLength={80} disabled={salvando} />
          {nomeNoLink && <p className="mt-1.5 text-[0.75rem] text-black/45">Para contar os ingressos, crie o link de divulgação com o nome da ação <span className="text-black/70">{nomeNoLink}</span>.</p>}</div>}
        <div>
          <span className={ROTULO}>Onde você divulgou</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Onde você divulgou">
            {CANAIS_DE_DIVULGACAO.map(c => (
              <button key={c.valor} type="button" disabled={salvando} onClick={() => onMudar?.("canal", c.valor)} aria-pressed={valores.canal === c.valor}
                className={`rounded-xl border px-3 py-1.5 text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${valores.canal === c.valor ? "border-[#7259B5] bg-[#F5F2FB] font-normal text-[#1C0E33]" : "bg-white text-black/60 hover:bg-black/[.03]"}`}
                style={valores.canal === c.valor ? undefined : { borderColor: BORDA }}>{c.rotulo}</button>
            ))}
          </div>
        </div>
        {imprensa ? (<>
          <CampoDoVeiculo valor={valores.veiculo ?? ""} veiculos={veiculos} desligado={!!salvando} onMudar={v => onMudar?.("veiculo", v)} />
          <div><label className={ROTULO} htmlFor="ac-assunto">Assunto (opcional)</label><input id="ac-assunto" className={CAMPO} value={valores.nome} onChange={e => onMudar?.("nome", e.target.value)} placeholder="agenda cultural, crítica, entrevista…" maxLength={60} disabled={salvando} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={ROTULO} htmlFor="ac-inicio">Saiu em</label><input id="ac-inicio" type="date" className={CAMPO} value={valores.inicio} onChange={e => onMudar?.("inicio", e.target.value)} disabled={salvando} /></div>
            {eventos.length > 0 && (
              <div>
                <span className={ROTULO}>De qual evento</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="De qual evento">
                  {[...eventos.map(e => ({ id: e.id as string | null, titulo: e.titulo })), { id: null, titulo: "Da casa toda" }].map(e => {
                    const on = (valores.eventoId ?? null) === e.id;
                    return <button key={e.id ?? "casa"} type="button" role="radio" aria-checked={on} disabled={salvando} onClick={() => onMudar?.("eventoId", e.id)}
                      className={`rounded-xl border px-3 py-1.5 text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${on ? "border-[#7259B5] bg-[#F5F2FB] font-normal text-[#1C0E33]" : "bg-white text-black/60 hover:bg-black/[.03]"}`}
                      style={on ? undefined : { borderColor: BORDA }}>{e.titulo}</button>;
                  })}
                </div>
              </div>
            )}
          </div>
          <p className="rounded-xl border bg-white px-3.5 py-2.5 text-[0.75rem] leading-relaxed text-black/55" style={{ borderColor: BORDA }}>Imprensa não tem gasto. O Jards reconhece o mesmo veículo quando ele aparece de novo e mede quanto ele pesa para o seu público pelas vendas do evento nos dias seguintes. O modelo trata como uma data que pode mexer na venda, como um feriado.</p>
        </>) : (<>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={ROTULO} htmlFor="ac-inicio">Começou em</label><input id="ac-inicio" type="date" className={CAMPO} value={valores.inicio} onChange={e => onMudar?.("inicio", e.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="ac-fim">Terminou em</label><input id="ac-fim" type="date" className={CAMPO} value={valores.fim} onChange={e => onMudar?.("fim", e.target.value)} disabled={salvando} /></div>
        </div>
        <div><label className={ROTULO} htmlFor="ac-gasto">Quanto gastou (opcional)</label><input id="ac-gasto" inputMode="decimal" className={CAMPO} value={valores.gasto} onChange={e => onMudar?.("gasto", e.target.value)} placeholder="150,00" disabled={salvando} /><p className="mt-1.5 text-[0.75rem] text-black/45">Em reais. Deixe em branco se não custou nada, como um e-mail.</p></div>
        </>)}
      </div>
    </TopSheet>
  );
}

/** O veículo da crítica ou matéria: o que já foi marcado na casa aparece enquanto se digita, com quantas vezes; escolher um deles garante que o Jards reconheça o mesmo veículo. */
function CampoDoVeiculo({ valor, veiculos, desligado, onMudar }: { valor: string; veiculos: { nome: string; vezes: number }[]; desligado: boolean; onMudar: (v: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const termo = valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const iguais = veiculos.filter(v => termo && v.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(termo)).slice(0, 5);
  const exato = veiculos.some(v => v.nome.toLowerCase() === valor.trim().toLowerCase());
  return (
    <div className="relative">
      <label className={ROTULO} htmlFor="ac-veiculo">Veículo</label>
      <input id="ac-veiculo" className={CAMPO} value={valor} onChange={e => { onMudar(e.target.value); setAberto(true); }} onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder="TV Tem, Folha de S.Paulo, portal da cidade…" maxLength={60} disabled={desligado} autoComplete="off" role="combobox" aria-expanded={aberto && iguais.length > 0} aria-controls="ac-veiculos" />
      {aberto && iguais.length > 0 && !exato && (
        <ul id="ac-veiculos" role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border bg-white shadow-lg" style={{ borderColor: BORDA }}>
          {iguais.map(v => (
            <li key={v.nome} role="option" aria-selected={false}>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onMudar(v.nome); setAberto(false); }} className="flex w-full items-center justify-between px-3.5 py-2 text-left text-[0.8125rem] text-[#282525] hover:bg-[#F5F2FB]">
                {v.nome}<span className="text-[0.75rem] text-black/45">{v.vezes === 1 ? "1 vez" : `já marcado ${v.vezes} vezes`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Plug } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso } from "@/components/ticketeria/FolhasDosEventos";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import { diaCurtoEHora } from "@/lib/ticketeria/vendas";

// As conexões de mídia (a aba "Conexões" da Divulgação): o Meta Ads e o Google Ads, de onde o Jards lê o gasto todo dia, e a folha de escolher a conta de anúncios. Só desenho: os dados e as ações
// chegam por props. Segue o DESIGN.md da Ticketeria: rótulos pequenos em caixa alta, cantos de 12px, sem cor fora de estado.

const BORDA = "rgba(13,13,13,.08)";
const ROTULO = "text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45";
const BOTAO = "rounded-xl border bg-white px-3.5 py-2 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const TEXTO = "rounded-xl px-3 py-2 text-[0.75rem] font-normal text-black/40 transition hover:text-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const CANCELAR = "rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const SALVAR = "rounded-xl acao-salvar px-4 py-2.5 text-[0.75rem] font-normal text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";

export type ConexaoDeMidia = {
  situacao: "escolher_conta" | "ativa" | "erro" | "desconectada"; conta_nome: string | null; moeda: string | null;
  ultima_leitura_em: string | null; ultimo_erro: string | null; lido_desde: string | null; gasto_30_dias_centavos: number;
};
export type EstadoDeMidia = { disponivel: boolean; conexao: ConexaoDeMidia | null };
/** Os mesmos tipos com o nome de antes (o Meta foi o primeiro provedor). */
export type ConexaoMeta = ConexaoDeMidia;
export type EstadoDoMeta = EstadoDeMidia;
export type ProvedorDoCartao = "meta" | "google_ads";
export const CARTOES: Record<ProvedorDoCartao, { nome: string; subtitulo: string; fonte: string }> = {
  meta: { nome: "Meta Ads", subtitulo: "Instagram e Facebook", fonte: "Meta" }, google_ads: { nome: "Google Ads", subtitulo: "Pesquisa e YouTube", fonte: "Google Ads" },
};
export type ContaParaEscolher = { id: string; nome: string; moeda: string; ativa: boolean; suportada: boolean };

const dataBr = (dia: string) => { const [a, m, d] = dia.split("-"); return `${d}/${m}/${a}`; };

function Etiqueta({ texto, cor }: { texto: string; cor: string }) {
  return <span className="inline-flex shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: cor + "47", color: cor }}>{texto}</span>;
}

function Dado({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio?: string }) {
  return <div className="min-w-0"><p className={ROTULO}>{rotulo}</p><p className="mt-1.5 text-[0.8125rem] text-[#282525]">{valor}</p>{apoio && <p className="mt-0.5 text-[0.6875rem] text-black/40">{apoio}</p>}</div>;
}

/** O cartão de uma plataforma de anúncios, em cada situação: sem as credenciais (em breve), sem conexão, escolher a conta, ativa ou com erro. */
export function CartaoDeAnuncios({ provedor, estado, ocupado = false, onConectar, onEscolherConta, onLer, onDesconectar }: {
  provedor: ProvedorDoCartao; estado: EstadoDeMidia; ocupado?: boolean; onConectar?: () => void; onEscolherConta?: () => void; onLer?: () => void; onDesconectar?: () => void;
}) {
  const c = estado.conexao;
  const { nome, subtitulo, fonte } = CARTOES[provedor];
  const cabecalho = (acao: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-[0.875rem] font-normal text-[#282525]">{nome}</p><p className="mt-0.5 text-[0.75rem] text-black/40">{subtitulo}</p></div>
      {acao}
    </div>
  );
  if (!estado.disponivel) {
    return <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>{cabecalho(<span className="text-[0.6875rem] text-black/30">Em breve</span>)}</div>;
  }
  if (!c || c.situacao === "desconectada") {
    return <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>{cabecalho(<button type="button" onClick={onConectar} disabled={ocupado} className={BOTAO} style={{ borderColor: BORDA }}>Conectar</button>)}</div>;
  }
  if (c.situacao === "escolher_conta") {
    return (
      <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
        {cabecalho(<button type="button" onClick={onEscolherConta} disabled={ocupado} className={BOTAO} style={{ borderColor: BORDA }}>Escolher a conta</button>)}
        <p className="mt-3 text-[0.75rem] text-black/55">Você entrou no {fonte}. Falta escolher a conta de anúncios que o Jards vai ler.</p>
      </div>
    );
  }
  if (c.situacao === "erro") {
    return (
      <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
        {cabecalho(<Etiqueta texto="PRECISA CONECTAR DE NOVO" cor="#B07A14" />)}
        <p role="alert" className="mt-3 text-[0.75rem] text-black/55">{c.ultimo_erro ?? `O acesso ao ${fonte} venceu ou foi retirado.`}</p>
        <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={onDesconectar} disabled={ocupado} className={TEXTO}>Desconectar</button><button type="button" onClick={onConectar} disabled={ocupado} className={BOTAO} style={{ borderColor: BORDA }}>Conectar de novo</button></div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
      {cabecalho(<Etiqueta texto="CONECTADO" cor="#2E8932" />)}
      <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-3" style={{ borderColor: BORDA }}>
        <Dado rotulo="Conta de anúncios" valor={c.conta_nome ?? "—"} apoio={c.moeda === "BRL" ? "Moeda: real (BRL)" : (c.moeda ?? undefined)} />
        <Dado rotulo="Última leitura" valor={c.ultima_leitura_em ? diaCurtoEHora(c.ultima_leitura_em) : "ainda não leu"} apoio="todo dia de manhã" />
        <Dado rotulo="Gasto lido nos últimos 30 dias" valor={formatarMoeda(c.gasto_30_dias_centavos)} apoio={c.lido_desde ? `desde ${dataBr(c.lido_desde)}` : undefined} />
      </div>
      {c.ultimo_erro && <p role="alert" className="mt-3 text-[0.75rem] text-[#B07A14]">{c.ultimo_erro}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onDesconectar} disabled={ocupado} className={TEXTO}>Desconectar</button>
        <button type="button" onClick={onEscolherConta} disabled={ocupado} className={BOTAO} style={{ borderColor: BORDA }}>Trocar conta</button>
        <button type="button" onClick={onLer} disabled={ocupado} className={BOTAO} style={{ borderColor: BORDA }}>{ocupado ? "Lendo…" : "Ler agora"}</button>
      </div>
    </div>
  );
}

/** O cartão do Meta Ads (o primeiro provedor): o mesmo cartão com o nome de antes. */
export function CartaoDoMeta({ meta, ...resto }: { meta: EstadoDeMidia; ocupado?: boolean; onConectar?: () => void; onEscolherConta?: () => void; onLer?: () => void; onDesconectar?: () => void }) {
  return <CartaoDeAnuncios provedor="meta" estado={meta} {...resto} />;
}

/** A aba Conexões: o Meta Ads e o Google Ads (e, em breve, o TikTok). `aviso` é a frase quando a volta do login não deu certo; `ocupado` é o provedor que está lendo ou conectando. */
export function ConexoesDaLoja({ estados, aviso, ocupado = null, onConectar, onEscolherConta, onLer, onDesconectar }: {
  estados: Record<ProvedorDoCartao, EstadoDeMidia>; aviso?: string | null; ocupado?: ProvedorDoCartao | null;
  onConectar?: (p: ProvedorDoCartao) => void; onEscolherConta?: (p: ProvedorDoCartao) => void; onLer?: (p: ProvedorDoCartao) => void; onDesconectar?: (p: ProvedorDoCartao) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-[0.8125rem] text-black/55">Traga os dados de onde você divulga. O Jards lê o gasto e os resultados sozinho, todo dia. Só leitura: nunca criamos nem mudamos anúncios.</p>
      {aviso && <Aviso texto={aviso} />}
      <div className="space-y-2.5">
        <p className={ROTULO}>Anúncios pagos</p>
        {(["meta", "google_ads"] as const).map(p => (
          <CartaoDeAnuncios key={p} provedor={p} estado={estados[p]} ocupado={ocupado === p} onConectar={() => onConectar?.(p)} onEscolherConta={() => onEscolherConta?.(p)} onLer={() => onLer?.(p)} onDesconectar={() => onDesconectar?.(p)} />
        ))}
        <div className="flex items-center justify-between rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
          <div><p className="text-[0.875rem] font-normal text-[#282525]">TikTok Ads</p><p className="mt-0.5 text-[0.75rem] text-black/40">Gasto e alcance</p></div>
          <span className="flex items-center gap-1.5 text-[0.6875rem] text-black/30"><Plug size={12} aria-hidden="true" />Em breve</span>
        </div>
      </div>
    </div>
  );
}

/** A folha de escolher a conta de anúncios. Conta em outra moeda (e conta que não está ativa na Meta) aparece apagada, sem poder escolher. */
export function EscolherContaSheet({ fonte = "Meta", contas, escolhida, erro, salvando, carregando, onEscolher, onClose, onSalvar }: {
  fonte?: string; contas: ContaParaEscolher[] | null; escolhida: string | null; erro?: string | null; salvando?: boolean; carregando?: boolean; onEscolher?: (id: string) => void; onClose: () => void; onSalvar?: () => void;
}) {
  const [interno, setInterno] = useState(escolhida);
  const atual = escolhida ?? interno;
  return (
    <TopSheet titulo="Escolha a conta de anúncios" onClose={onClose} footer={fechar => (
      <>
        <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
        <button type="button" onClick={onSalvar} disabled={salvando || !atual} className={SALVAR}>{salvando ? "Conectando…" : "Conectar esta conta"}</button>
      </>
    )}>
      <div className="space-y-3">
        <p className="text-[0.8125rem] text-black/55">Escolha a conta cujo gasto o Jards vai ler. Só lemos gasto e resultados; nunca criamos nem mudamos anúncios.</p>
        {erro && <Aviso texto={erro} />}
        {carregando || contas === null ? (
          <p className="text-[0.8125rem] text-black/40" aria-live="polite">Buscando as suas contas…</p>
        ) : contas.length === 0 ? (
          <p className="rounded-xl border bg-white px-3 py-2 text-[0.75rem] text-black/55" style={{ borderColor: BORDA }}>{fonte === "Meta" ? "O Meta" : `O ${fonte}`} não devolveu nenhuma conta de anúncios para este acesso.</p>
        ) : (
          <div className="space-y-2" role="radiogroup" aria-label="Contas de anúncios">
            {contas.map(c => {
              const pode = c.suportada && c.ativa;
              const marcada = atual === c.id;
              return (
                <button key={c.id} type="button" role="radio" aria-checked={marcada} disabled={!pode || salvando} onClick={() => { setInterno(c.id); onEscolher?.(c.id); }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${marcada ? "border-[#7259B5] bg-[#F5F2FB]" : "bg-white hover:bg-black/[.03]"} ${pode ? "" : "opacity-45"}`}
                  style={marcada ? undefined : { borderColor: BORDA }}>
                  <span className="min-w-0"><span className="block text-[0.8125rem] text-[#282525]">{c.nome}</span>
                    <span className="mt-0.5 block text-[0.6875rem] text-black/40">Conta {c.id.length > 8 ? `${c.id.slice(0, 4)} …${c.id.slice(-3)}` : c.id} · {c.moeda === "BRL" ? "real (BRL)" : c.moeda || "moeda desconhecida"}{!c.suportada ? " · não dá para somar com real ainda" : !c.ativa ? " · conta desativada na plataforma" : ""}</span></span>
                  <span aria-hidden="true" className={`size-4 shrink-0 rounded-full border-[1.5px] ${marcada ? "border-[5px] border-[#7259B5]" : "border-black/25"}`} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </TopSheet>
  );
}

// Relatório do patrocinador por link (P5.2). Sem login: o banco confere o
// link (fn_relatorio_patrocinador_publico) e devolve só o que o patrocinador
// vê. As fotos ficam no bucket privado; o servidor assina cada uma por dez
// minutos, depois de o link ser aceito pelo banco.

import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { CalendarDays, CheckCircle2, ExternalLink, Image as ImageIcon, LinkIcon, Target } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  marcosDoRelatorio,
  percentualDaMeta,
  percentualExecutado,
  ROTULO_DA_CONTRAPARTIDA,
  textoDoPeriodo,
  type RelatorioPublico,
} from "@/lib/prestacao/relatorio-patrocinador";
import { formatarValorCompleto } from "@/lib/valor";
import { AceiteDoRelatorio } from "./AceiteDoRelatorio";

export const metadata: Metadata = {
  title: "Relatório do projeto",
  robots: { index: false, follow: false },
};

const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const reais = (v: unknown) => formatarValorCompleto(Number(v) || 0);
const numero = (v: unknown) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

async function lerRelatorio(token: string): Promise<RelatorioPublico | null | "erro"> {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("fn_relatorio_patrocinador_publico", { p_token: token });
  if (error) return "erro";
  return (data as RelatorioPublico | null) ?? null;
}

async function assinarFotos(fotos: NonNullable<RelatorioPublico["fotos"]>): Promise<{ url: string; descricao: string | null; capturada_em: string | null }[]> {
  if (!fotos.length) return [];
  try {
    const { data } = await createAdminClient().storage.from("documentos").createSignedUrls(fotos.map(f => f.path), 600);
    return fotos.flatMap((f, i) => (data?.[i]?.signedUrl ? [{ url: data[i].signedUrl, descricao: f.descricao, capturada_em: f.capturada_em }] : []));
  } catch {
    return [];
  }
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAF9] px-4">
      <div className="max-w-[28rem] rounded-lg border bg-white px-6 py-8 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <h1 className="text-[1.0625rem] font-semibold text-[#282525]">{titulo}</h1>
        <p className="mt-2 text-[0.8125rem] text-black/55">{texto}</p>
      </div>
    </main>
  );
}

function Secao({ titulo, icone: Icone, children }: { titulo: string; icone: typeof Target; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-white px-5 py-5 md:px-6" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <h2 className="mb-3 flex items-center gap-2 text-[0.8125rem] font-semibold text-[#282525]">
        <Icone size={14} className="text-black/40" aria-hidden /> {titulo}
      </h2>
      {children}
    </section>
  );
}

export default async function RelatorioDoPatrocinador({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await lerRelatorio(token);
  if (r === "erro") return <Aviso titulo="Não foi possível abrir o relatório" texto="Tente de novo em instantes." />;
  if (!r) return <Aviso titulo="Link não encontrado" texto="Confira o endereço recebido ou peça um novo link a quem enviou o relatório." />;
  if (r.situacao === "revogado") return <Aviso titulo="Este link foi desativado" texto={`Peça um novo link a quem enviou o relatório para ${r.patrocinador}.`} />;
  if (r.situacao === "expirado") return <Aviso titulo="Este link expirou" texto={`Peça um novo link a quem enviou o relatório para ${r.patrocinador}.`} />;

  const p = r.prestacao!;
  const fotos = await assinarFotos(r.fotos ?? []);
  const marcos = marcosDoRelatorio(p);
  const percentual = percentualExecutado(r.execucao);
  const periodo = textoDoPeriodo(r);
  const metas = r.metas ?? [];
  const contrapartidas = r.contrapartidas ?? [];
  const ativacoes = r.ativacoes ?? [];

  return (
    <main className="min-h-screen bg-[#FAFAF9] px-4 py-8 md:py-12">
      <div className="mx-auto max-w-[48rem] space-y-4">
        <header className="px-1">
          <div className="flex items-center gap-3">
            {r.organizacao?.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element -- logo da organização, de outra origem
              <img src={r.organizacao.avatar_url} alt={`Logo de ${r.organizacao.nome ?? "quem enviou"}`} className="h-10 w-10 rounded-full border object-cover" style={{ borderColor: "rgba(13,13,13,.08)" }} />
            )}
            <p className="text-[0.75rem] text-black/50">{r.organizacao?.nome ?? ""}</p>
          </div>
          <p className="mt-6 text-[0.625rem] font-semibold uppercase tracking-[.14em] text-black/35">Relatório para {r.patrocinador}</p>
          <h1 className="mt-1 text-[1.75rem] font-bold tracking-[-.02em] text-[#282525] [text-wrap:balance]">{p.titulo}</h1>
          <p className="mt-1 text-[0.8125rem] text-black/50">
            {[p.proponente, p.regime, p.identificador_oficial].filter(Boolean).join(" · ")}
          </p>
          {periodo && <p className="mt-1 text-[0.75rem] text-black/45">{periodo}</p>}
        </header>

        {r.mensagem && (
          <p className="whitespace-pre-line rounded-lg border bg-white px-5 py-4 text-[0.875rem] leading-relaxed text-black/70" style={{ borderColor: "rgba(13,13,13,.08)" }}>{r.mensagem}</p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Secao titulo="Execução" icone={Target}>
            <p className={`text-[1.375rem] font-semibold tabular-nums ${Number(r.execucao?.executado) ? "text-[#282525]" : "text-black/30"}`}>{reais(r.execucao?.executado)}</p>
            <p className="text-[0.75rem] text-black/50">
              executados{Number(r.execucao?.orcamento) > 0 ? ` de ${reais(r.execucao?.orcamento)} do orçamento` : ""}
              {r.execucao?.despesas ? `, em ${r.execucao.despesas} ${r.execucao.despesas === 1 ? "despesa comprovada" : "despesas comprovadas"}` : ""}
            </p>
            {percentual !== null && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/[.07]" role="img" aria-label={`${percentual}% executado`}>
                <div className="h-full rounded-full bg-[#2E8932]" style={{ width: `${percentual}%` }} />
              </div>
            )}
            {r.atividades && r.atividades.total > 0 && (
              <p className="mt-3 text-[0.75rem] text-black/55">{r.atividades.realizadas} de {r.atividades.total} atividades realizadas</p>
            )}
          </Secao>
          <Secao titulo="Marcos" icone={CalendarDays}>
            {marcos.length === 0 ? <p className="text-[0.75rem] text-black/45">Sem datas registradas ainda.</p> : (
              <ol className="space-y-2">
                {marcos.map(m => (
                  <li key={m.rotulo} className="flex items-baseline justify-between gap-3 text-[0.75rem]">
                    <span className="text-black/65">{m.rotulo}</span>
                    <span className="tabular-nums text-black/80">{dataBr(m.data)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Secao>
        </div>

        {metas.length > 0 && (
          <Secao titulo="Metas" icone={Target}>
            <ul className="space-y-3">
              {metas.map((m, i) => {
                const pct = percentualDaMeta(m);
                return (
                  <li key={i} className="text-[0.75rem]">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-black/75">{m.descricao}</span>
                      <span className="shrink-0 tabular-nums text-black/55">
                        {m.realizado === null ? "—" : numero(m.realizado)} de {numero(m.previsto)}{m.unidade ? ` ${m.unidade}` : ""}
                      </span>
                    </div>
                    {pct !== null && (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/[.07]" aria-hidden>
                        <div className="h-full rounded-full bg-[#2E8932]" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Secao>
        )}

        {contrapartidas.length > 0 && (
          <Secao titulo="Contrapartidas" icone={CheckCircle2}>
            <ul className="divide-y divide-black/[.05]">
              {contrapartidas.map((c, i) => {
                const s = ROTULO_DA_CONTRAPARTIDA[c.status] ?? { rotulo: c.status, cor: "#6B6B6B" };
                return (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[0.75rem] first:pt-0 last:pb-0">
                    <span className="min-w-0 text-black/75">{c.titulo}</span>
                    <span className="flex items-center gap-2">
                      {(c.entregue_em || c.prazo) && <span className="tabular-nums text-black/40">{c.entregue_em ? `entregue em ${dataBr(c.entregue_em)}` : `até ${dataBr(c.prazo)}`}</span>}
                      <span className="rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: s.cor + "47", color: s.cor }}>{s.rotulo}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Secao>
        )}

        {ativacoes.length > 0 && (
          <Secao titulo="Ativações" icone={LinkIcon}>
            <ul className="space-y-1.5 text-[0.75rem]">
              {ativacoes.map((a, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3">
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 text-black/75 underline decoration-black/20 underline-offset-2 hover:text-[#282525]">
                      <span className="truncate">{a.titulo || "Evidência"}</span> <ExternalLink size={11} aria-hidden />
                    </a>
                  ) : <span className="text-black/75">{a.titulo || "Evidência"}</span>}
                  {a.capturada_em && <span className="shrink-0 tabular-nums text-black/40">{dataBr(a.capturada_em)}</span>}
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {fotos.length > 0 && (
          <Secao titulo="Fotos" icone={ImageIcon}>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {fotos.map((f, i) => (
                <li key={i} className="overflow-hidden rounded-md border bg-black/[.03]" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- link temporário do Storage, sem otimização */}
                  <img src={f.url} alt={f.descricao || `Foto da execução${f.capturada_em ? ` em ${dataBr(f.capturada_em)}` : ""}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  {(f.descricao || f.capturada_em) && (
                    <p className="truncate px-2 py-1.5 text-[0.625rem] text-black/55">{[f.descricao, dataBr(f.capturada_em)].filter(Boolean).join(" · ")}</p>
                  )}
                </li>
              ))}
            </ul>
          </Secao>
        )}

        <AceiteDoRelatorio token={token} patrocinador={r.patrocinador} aceite={r.aceite ?? null} />

        <p className="px-1 pb-4 text-[0.625rem] text-black/35">
          Relatório enviado por {r.organizacao?.nome ?? "quem cuida do projeto"} pelo Jards. Este link vale até {dataBr(r.expira_em)}.
        </p>
      </div>
    </main>
  );
}

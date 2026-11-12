"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, HeartHandshake } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import type { SituacaoDoVoluntario } from "@/lib/producao/estados";
import { DIAS_DO_LINK_DE_VOLUNTARIOS, resumoDosVoluntarios, ROTULO_DA_SITUACAO_DO_VOLUNTARIO } from "@/lib/producao/voluntarios";

type Link = { id: string; titulo: string | null; vagas: number | null; expira_em: string | null; revogado_em: string | null };
type Voluntario = { id: string; nome: string; email: string | null; telefone: string | null; disponibilidade: string | null; situacao: SituacaoDoVoluntario; pessoa_id: string | null; created_at: string };

const BOTAO = "flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const BOTAO_PEQUENO = "h-8 rounded border border-black/12 bg-white px-2.5 text-[0.6875rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const CAMPO = "h-10 w-full rounded border border-black/[.14] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/50 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

function LinkSheet({ temporadaId, organizationId, ativo, onClose, onGerou }: { temporadaId: string; organizationId: string; ativo: Link | null; onClose: () => void; onGerou: () => void }) {
  const [titulo, setTitulo] = useState(ativo?.titulo ?? "");
  const [vagas, setVagas] = useState(ativo?.vagas ? String(ativo.vagas) : "");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    const semLimite = vagas.trim() === "";
    const quantas = semLimite ? 0 : Number(vagas); // 0 = sem limite
    if (!semLimite && (!Number.isInteger(quantas) || quantas < 1 || quantas > 5000)) { setErro("As vagas são um número de 1 a 5.000, ou deixe vazio para não limitar."); return; }
    setGerando(true);
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).rpc("fn_producao_voluntarios_gerar_link", {
      p_temporada: temporadaId, p_dias: DIAS_DO_LINK_DE_VOLUNTARIOS, p_titulo: titulo.trim(), p_vagas: quantas,
    });
    setGerando(false);
    if (error || typeof data !== "string") { setErro(error?.code === "42501" ? "Você não pode criar links aqui." : "Não foi possível gerar o link. Tente de novo."); return; }
    setUrl(`${window.location.origin}/voluntario/${data}`);
    onGerou();
  }

  async function copiar() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { setErro("Não foi possível copiar. Selecione o link e copie à mão."); }
  }

  void organizationId;
  return (
    <TopSheet
      titulo={ativo ? "Novo link de voluntários" : "Link de voluntários"}
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={gerando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{url ? "Fechar" : "Cancelar"}</button>
          {!url && <button type="button" onClick={() => void gerar()} disabled={gerando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{gerando ? "Gerando…" : "Gerar link"}</button>}
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {!url ? (
          <>
            <p className="text-[0.75rem] text-black/55">Um link só para a temporada inteira: quem recebe se inscreve pelo celular, sem conta, e você aprova depois. Vale {DIAS_DO_LINK_DE_VOLUNTARIOS} dias.{ativo ? " Gerar um novo desativa o link anterior." : ""}</p>
            <div>
              <label className={ROTULO} htmlFor="vol-titulo">Título da chamada (opcional)</label>
              <input id="vol-titulo" className={CAMPO} value={titulo} maxLength={120} onChange={event => setTitulo(event.target.value)} disabled={gerando} placeholder="Seja voluntário" />
            </div>
            <div>
              <label className={ROTULO} htmlFor="vol-vagas">Limite de inscrições (opcional)</label>
              <input id="vol-vagas" inputMode="numeric" className={CAMPO} value={vagas} onChange={event => setVagas(event.target.value.replace(/\D/g, ""))} disabled={gerando} placeholder="Sem limite" />
            </div>
          </>
        ) : (
          <>
            <p className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}>O link aparece só agora. Copie e divulgue antes de fechar; depois, para ter o endereço de novo, gere um link novo.</p>
            <p className="break-all rounded border bg-black/[.03] px-3 py-2.5 text-[0.75rem] text-[#282525]" style={{ borderColor: "rgba(13,13,13,.1)" }}>{url}</p>
            <button type="button" onClick={() => void copiar()} className={BOTAO}><Copy size={13} aria-hidden="true" /> {copiado ? "Copiado" : "Copiar link"}</button>
          </>
        )}
      </div>
    </TopSheet>
  );
}

/** Os voluntários da temporada (PD7.11): o link de inscrição, quem se inscreveu e a decisão da produção (aprovar põe a pessoa na equipe). */
export function VoluntariosDaTemporada({ organizationId, temporadaId, podeEditar }: { organizationId: string; temporadaId: string; podeEditar: boolean }) {
  const [link, setLink] = useState<Link | null | undefined>(undefined);
  const [lista, setLista] = useState<Voluntario[] | null>(null);
  const [folha, setFolha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [trabalhando, setTrabalhando] = useState<string | null>(null);
  const [agora] = useState(() => Date.now());

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [lk, vol] = await Promise.all([
        producao.from("producao_voluntarios_links").select("id, titulo, vagas, expira_em, revogado_em").eq("temporada_id", temporadaId).maybeSingle(),
        producao.from("producao_voluntarios").select("id, nome, email, telefone, disponibilidade, situacao, pessoa_id, created_at").eq("temporada_id", temporadaId).order("created_at", { ascending: false }),
      ]);
      if (!ativo) return;
      setLink(lk.data ?? null);
      setLista(vol.data ?? []);
      setErro(lk.error || vol.error ? "Não foi possível carregar os voluntários. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [temporadaId, versao]);

  const resumo = useMemo(() => resumoDosVoluntarios(lista ?? []), [lista]);
  const linkAtivo = !!link && !link.revogado_em && !!link.expira_em && new Date(link.expira_em).getTime() > agora;

  async function aprovar(id: string) {
    setTrabalhando(id);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).rpc("fn_producao_voluntario_aprovar", { p_voluntario: id });
    setTrabalhando(null);
    if (error) { setErro(error.code === "42501" ? "Você não pode aprovar voluntários aqui." : "Não foi possível aprovar. Tente de novo."); return; }
    setVersao(atual => atual + 1);
  }

  async function mudarSituacao(id: string, situacao: SituacaoDoVoluntario) {
    setTrabalhando(id);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_voluntarios").update({ situacao }).eq("id", id);
    setTrabalhando(null);
    if (error) { setErro("Não foi possível salvar. Tente de novo."); return; }
    setVersao(atual => atual + 1);
  }

  async function desativarLink() {
    if (!link) return;
    setTrabalhando("link");
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_voluntarios_links").update({ revogado_em: new Date().toISOString() }).eq("id", link.id);
    setTrabalhando(null);
    if (error) { setErro("Não foi possível desativar o link. Tente de novo."); return; }
    setVersao(atual => atual + 1);
  }

  return (
    <section aria-labelledby="voluntarios" className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="voluntarios" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Voluntários</h2>
        {podeEditar && <button type="button" onClick={() => setFolha(true)} className={BOTAO}><HeartHandshake size={13} aria-hidden="true" /> {link ? "Novo link" : "Criar link de inscrição"}</button>}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {lista === null || link === undefined ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : (
        <>
          {link && (
            <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-black/55">
              <span>{linkAtivo ? `Inscrições abertas até ${new Date(link.expira_em as string).toLocaleDateString("pt-BR")}` : "Inscrições encerradas"}{link.vagas ? ` · limite de ${link.vagas}` : ""}</span>
              {podeEditar && linkAtivo && <button type="button" onClick={() => void desativarLink()} disabled={trabalhando === "link"} className="text-[0.6875rem] font-medium text-black/55 underline underline-offset-2 hover:text-[#282525] disabled:opacity-50">Encerrar inscrições</button>}
            </p>
          )}
          {lista.length === 0 ? (
            <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-[0.8125rem] font-medium text-black/55">Nenhuma inscrição ainda</p>
              <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">{link ? "Divulgue o link de inscrição. Quem se inscrever aparece aqui para você aprovar." : "Crie um link de inscrição e divulgue. Quem se inscrever aparece aqui para você aprovar; quem for aprovado entra na equipe como apoio."}</p>
            </div>
          ) : (
            <>
              <p className="mb-2 text-[0.75rem] tabular-nums text-black/55">{resumo.inscritos} {resumo.inscritos === 1 ? "inscrito" : "inscritos"} · {resumo.aprovados} {resumo.aprovados === 1 ? "aprovado" : "aprovados"} · {resumo.recusados} {resumo.recusados === 1 ? "recusado" : "recusados"}</p>
              <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                {lista.map(voluntario => (
                  <li key={voluntario.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{voluntario.nome}</p>
                      <p className="truncate text-[0.6875rem] text-black/45">{[voluntario.email, voluntario.telefone, voluntario.disponibilidade].filter(Boolean).join(" · ")}</p>
                    </div>
                    <span className="w-20 text-[0.75rem] text-black/65">{ROTULO_DA_SITUACAO_DO_VOLUNTARIO[voluntario.situacao]}</span>
                    {podeEditar && (
                      <span className="flex gap-1.5">
                        {voluntario.situacao !== "aprovado" && <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando === voluntario.id} onClick={() => void aprovar(voluntario.id)}>Aprovar</button>}
                        {voluntario.situacao === "inscrito" && <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando === voluntario.id} onClick={() => void mudarSituacao(voluntario.id, "recusado")}>Recusar</button>}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {folha && <LinkSheet temporadaId={temporadaId} organizationId={organizationId} ativo={link ?? null} onClose={() => setFolha(false)} onGerou={() => setVersao(atual => atual + 1)} />}
    </section>
  );
}

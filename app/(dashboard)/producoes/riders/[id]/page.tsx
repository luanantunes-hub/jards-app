"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Download, Pencil, Plus } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { SECOES_DO_RIDER, type SecaoDoRider } from "@/lib/producao/estados";
import { lerLinhaDoRider, ROTULO_DA_SECAO } from "@/lib/producao/rider";
import { lerNumero } from "@/lib/producao/inventario";
import { montarPdf } from "@/lib/producao/pdf-texto";
import { DetailBackLink, DetailNotFound, DetailPageContent, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";

type Rider = { id: string; nome: string; palco_largura_min_m: number | null; palco_profundidade_min_m: number | null; observacoes: string | null };
type Linha = { id: string; secao: SecaoDoRider; texto: string; quantidade: number | null; obrigatorio: boolean; ordem: number };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const metros = (n: number | null) => (n === null ? "" : String(Math.round(n * 100) / 100).replace(".", ","));
const textoDaLinha = (linha: Linha) => `${linha.quantidade ? `${linha.quantidade.toLocaleString("pt-BR")} × ` : ""}${linha.texto}${linha.obrigatorio ? "" : " (desejável)"}`;

function LinhaSheet({ organizationId, riderId, secaoInicial, linha, proximaOrdem, onClose, onSaved }: {
  organizationId: string; riderId: string; secaoInicial: SecaoDoRider; linha?: Linha; proximaOrdem: number; onClose: () => void; onSaved: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [secao, setSecao] = useState<string>(linha?.secao ?? secaoInicial);
  const [texto, setTexto] = useState(linha?.texto ?? "");
  const [quantidade, setQuantidade] = useState(linha?.quantidade?.toString() ?? "");
  const [obrigatorio, setObrigatorio] = useState(linha?.obrigatorio ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerLinhaDoRider({ secao, texto, quantidade, obrigatorio });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = linha
      ? await producao.from("producao_rider_itens").update(leitura.linha).eq("id", linha.id)
      : await producao.from("producao_rider_itens").insert({ organization_id: organizationId, rider_id: riderId, ordem: proximaOrdem, ...leitura.linha });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode mudar este rider." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!linha) return;
    confirmDelete({
      title: "Apagar linha do rider?",
      description: `"${linha.texto}" sai do rider.`,
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_rider_itens").delete().eq("id", linha.id);
        if (error) throw new Error("Não foi possível apagar a linha.");
        onSaved();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={linha ? "Editar linha" : "Nova linha"}
      onClose={onClose}
      footer={fechar => (
        <>
          {linha && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : "Salvar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div>
            <span className={ROTULO}>Seção</span>
            <Dropdown value={secao} onChange={setSecao} options={SECOES_DO_RIDER.map(valor => ({ value: valor, label: ROTULO_DA_SECAO[valor] }))} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="linha-quantidade">Quantidade</label>
            <input id="linha-quantidade" inputMode="numeric" className={CAMPO} value={quantidade} onChange={event => setQuantidade(event.target.value)} placeholder="—" disabled={salvando} />
          </div>
        </div>
        <div>
          <label className={ROTULO} htmlFor="linha-texto">O que a casa providencia</label>
          <textarea id="linha-texto" autoFocus rows={3} className="w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50" value={texto} onChange={event => setTexto(event.target.value)} maxLength={500} placeholder="Seis refletores de LED com mesa de luz" disabled={salvando} />
        </div>
        <label className="flex items-center gap-2 text-[0.8125rem] text-[#282525]"><input type="checkbox" checked={obrigatorio} onChange={event => setObrigatorio(event.target.checked)} disabled={salvando} className="h-4 w-4 accent-[#7259B5]" /> É necessário (sem marcar, vira desejável)</label>
      </div>
    </TopSheet>
  );
}

function DadosSheet({ rider, onClose, onSaved }: { rider: Rider; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(rider.nome);
  const [largura, setLargura] = useState(metros(rider.palco_largura_min_m));
  const [profundidade, setProfundidade] = useState(metros(rider.palco_profundidade_min_m));
  const [observacoes, setObservacoes] = useState(rider.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const l = lerNumero(largura), p = lerNumero(profundidade);
    const lado = (valor: number | null | "invalido") => valor === null || (valor !== "invalido" && valor >= 0.5 && valor <= 500);
    if (nome.trim() === "" || nome.trim().length > 200) { setErro("Dê um nome ao rider (até 200 letras)."); return; }
    if (!lado(l) || !lado(p)) { setErro("As medidas do palco ficam entre 0,5 e 500 metros (ou vazias)."); return; }
    if (observacoes.length > 4000) { setErro("As observações podem ter até 4.000 letras."); return; }
    setSalvando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_riders").update({
      nome: nome.trim(), palco_largura_min_m: l === "invalido" ? null : l, palco_profundidade_min_m: p === "invalido" ? null : p, observacoes: observacoes.trim() === "" ? null : observacoes.trim(),
    }).eq("id", rider.id);
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode mudar este rider." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  return (
    <TopSheet
      titulo="Dados do rider"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : "Salvar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div><label className={ROTULO} htmlFor="rider-nome">Nome</label><input id="rider-nome" autoFocus className={CAMPO} value={nome} onChange={event => setNome(event.target.value)} maxLength={200} disabled={salvando} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={ROTULO} htmlFor="rider-largura">Palco: largura mínima (m)</label><input id="rider-largura" inputMode="decimal" className={CAMPO} value={largura} onChange={event => setLargura(event.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="rider-profundidade">Palco: profundidade mínima (m)</label><input id="rider-profundidade" inputMode="decimal" className={CAMPO} value={profundidade} onChange={event => setProfundidade(event.target.value)} disabled={salvando} /></div>
        </div>
        <div>
          <label className={ROTULO} htmlFor="rider-obs">Observações</label>
          <textarea id="rider-obs" rows={4} className="w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50" value={observacoes} onChange={event => setObservacoes(event.target.value)} maxLength={4000} disabled={salvando} />
        </div>
      </div>
    </TopSheet>
  );
}

/** O rider: as linhas por seção (palco, som, luz, energia, camarim, catering, geral), editáveis, e o PDF para mandar à casa. */
export default function RiderPage() {
  const { id } = useParams<{ id: string }>();
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const router = useRouter();
  const { confirmDelete } = useDeleteConfirm();
  const [rider, setRider] = useState<Rider | null | undefined>(undefined);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [folha, setFolha] = useState<{ linha?: Linha; secao: SecaoDoRider } | null>(null);
  const [dados, setDados] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [rid, lin] = await Promise.all([
        producao.from("producao_riders").select("id, nome, palco_largura_min_m, palco_profundidade_min_m, observacoes").eq("id", id).eq("organization_id", organizationId).maybeSingle(),
        producao.from("producao_rider_itens").select("id, secao, texto, quantidade, obrigatorio, ordem").eq("rider_id", id).order("ordem").order("created_at"),
      ]);
      if (!ativo) return;
      setRider(rid.error ? null : (rid.data as Rider | null));
      setLinhas((lin.data ?? []) as Linha[]);
    })();
    return () => { ativo = false; };
  }, [id, organizationId, versao]);

  const porSecao = useMemo(() => SECOES_DO_RIDER.map(secao => ({ secao, linhas: linhas.filter(linha => linha.secao === secao) })), [linhas]);
  const proximaOrdem = linhas.reduce((maior, linha) => Math.max(maior, linha.ordem), -10) + 10;

  async function baixarPdf() {
    if (!rider) return;
    setGerando(true);
    setErro(null);
    try {
      const medidas = rider.palco_largura_min_m && rider.palco_profundidade_min_m ? `Palco mínimo: ${metros(rider.palco_largura_min_m)} × ${metros(rider.palco_profundidade_min_m)} m` : undefined;
      const bytes = await montarPdf({
        titulo: rider.nome,
        subtitulo: medidas,
        secoes: [
          ...porSecao.filter(grupo => grupo.linhas.length > 0).map(grupo => ({ titulo: ROTULO_DA_SECAO[grupo.secao], linhas: grupo.linhas.map(textoDaLinha) })),
          ...(rider.observacoes ? [{ titulo: "Observações", linhas: rider.observacoes.split(/\r?\n/).filter(Boolean) }] : []),
        ],
        rodape: "Rider técnico · Jards",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      link.download = `${rider.nome.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "rider"}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      setErro("Não foi possível gerar o PDF. Tente de novo.");
    }
    setGerando(false);
  }

  function apagarRider() {
    if (!rider) return;
    confirmDelete({
      title: "Apagar rider?",
      description: `"${rider.nome}" e as linhas dele saem. A planta continua.`,
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_riders").delete().eq("id", rider.id);
        if (error) throw new Error("Não foi possível apagar o rider.");
        router.push("/producoes/riders");
      },
    });
  }

  if (rider === undefined) return <DetailPageSkeleton />;
  if (rider === null) return <DetailNotFound title="Rider não encontrado" description="Ele pode ter sido apagado ou você não tem acesso." backHref="/producoes/riders" backLabel="Voltar aos riders" />;

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <DetailBackLink href="/producoes/riders" label="Riders" />
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{rider.nome}</h1>
              <p className="mt-1 text-[0.75rem] text-black/45">{rider.palco_largura_min_m && rider.palco_profundidade_min_m ? `Palco mínimo ${metros(rider.palco_largura_min_m)} × ${metros(rider.palco_profundidade_min_m)} m` : "Sem medidas mínimas do palco"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {podeEditar && <button type="button" onClick={() => setDados(true)} className="inline-flex h-10 items-center gap-1.5 rounded border border-black/[.12] px-3.5 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><Pencil size={13} aria-hidden="true" /> Dados</button>}
              <PrimaryListAction onClick={() => void baixarPdf()} disabled={gerando}><Download size={13} aria-hidden="true" /> {gerando ? "Gerando…" : "Baixar PDF"}</PrimaryListAction>
            </div>
          </div>
        </div>
      </header>
      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div className="space-y-8">
          {porSecao.map(grupo => (
            <section key={grupo.secao} aria-label={ROTULO_DA_SECAO[grupo.secao]}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{ROTULO_DA_SECAO[grupo.secao]}</h2>
                {podeEditar && <button type="button" onClick={() => setFolha({ secao: grupo.secao })} className="inline-flex h-8 items-center gap-1 rounded px-2 text-[0.6875rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Plus size={12} aria-hidden="true" /> Linha</button>}
              </div>
              {grupo.linhas.length === 0 ? (
                <p className="rounded border bg-white px-4 py-3 text-[0.75rem] text-black/40" style={{ borderColor: "rgba(13,13,13,.06)" }}>Nada nesta seção.</p>
              ) : (
                <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  {grupo.linhas.map(linha => (
                    <li key={linha.id}>
                      <button type="button" disabled={!podeEditar} onClick={() => setFolha({ linha, secao: linha.secao })} className="flex w-full items-baseline gap-3 px-4 py-2.5 text-left transition enabled:hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                        <span className="w-12 shrink-0 text-right text-[0.75rem] tabular-nums text-black/45">{linha.quantidade ? `${linha.quantidade.toLocaleString("pt-BR")} ×` : ""}</span>
                        <span className="min-w-0 flex-1 text-[0.8125rem] text-[#282525]">{linha.texto}</span>
                        {!linha.obrigatorio && <span className="shrink-0 text-[0.6875rem] text-black/40">desejável</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          {rider.observacoes && (
            <section aria-label="Observações">
              <h2 className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Observações</h2>
              <p className="whitespace-pre-wrap rounded border bg-white px-4 py-3 text-[0.8125rem] text-[#282525]" style={{ borderColor: "rgba(13,13,13,.08)" }}>{rider.observacoes}</p>
            </section>
          )}
          {podeEditar && <div className="pt-2"><button type="button" onClick={apagarRider} className="text-[0.75rem] font-medium text-black/45 underline underline-offset-2 hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5]">Apagar este rider</button></div>}
        </div>
      </DetailPageContent>
      {folha && organizationId && <LinhaSheet organizationId={organizationId} riderId={rider.id} secaoInicial={folha.secao} linha={folha.linha} proximaOrdem={proximaOrdem} onClose={() => setFolha(null)} onSaved={recarregar} />}
      {dados && <DadosSheet rider={rider} onClose={() => setDados(false)} onSaved={recarregar} />}
    </div>
  );
}

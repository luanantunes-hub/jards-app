"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Check, Layers, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CotaPatrocinio } from "@/lib/supabase/types";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CampoValor } from "@/components/ui/CampoValor";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { AnchoredPopover, useAnchoredPopover } from "@/components/ui/AnchoredPopover";
import { PropostaOperacionalModal, type PropostaOperacionalDraft } from "@/components/projects/PropostaOperacionalModal";
import { FecharNegocioSheet } from "@/components/captacoes/FechamentoNegociacao";
import { cotaTemDisponibilidade, formatCotaValor } from "@/lib/cotas";
import { propostaAtivaDe } from "@/lib/propostas";
import { MENSAGEM_VALOR_INVALIDO, formatarValorBRL, lerValorBRL } from "@/lib/valor";

export type PropostaDaNegociacaoRow = PropostaOperacionalDraft & { status: string; created_at: string };

type Captacao = {
  id: string;
  status: string;
  projeto_id: string | null;
  organization_id: string | null;
  valor_solicitado: number | null;
  valor_aprovado: number | null;
};

const CRIAR_NOVA_COTA = "__criar_nova_cota__";

function moeda(valor: number | null | undefined) {
  return valor == null ? "—" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Supabase sem a tipagem das RPCs e tabelas usadas aqui.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/**
 * Topo da negociação: Cota (opcional) → Proposta → Venda num bloco só.
 * Com projeto, o valor é a proposta simplificada; sem projeto, é só o valor.
 * "Fechar negócio" (FechamentoNegociacao) é o único caminho para ganhar: registra a venda (com
 * proposta), aprova a negociação e o banco cria o cliente.
 */
export function PropostaDaNegociacao({ captacao, empresaNome, projetoNome, propostas, onChanged, onRecusar }: {
  captacao: Captacao;
  empresaNome: string;
  projetoNome: string | null;
  propostas: PropostaDaNegociacaoRow[];
  onChanged: () => Promise<void> | void;
  /** Recusa (confirmação e novo ciclo) fica na tela, que segue montada enquanto recarrega. */
  onRecusar: () => void;
}) {
  const db: Db = useMemo(() => createClient(), []);
  const menu = useAnchoredPopover();
  const [cotas, setCotas] = useState<CotaPatrocinio[]>([]);
  const [editando, setEditando] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [completa, setCompleta] = useState(false);

  const comProjeto = Boolean(captacao.projeto_id);
  const proposta = propostaAtivaDe(propostas);
  const cota = proposta?.cota_id ? cotas.find(item => item.id === proposta.cota_id) ?? null : null;

  useEffect(() => {
    if (!captacao.projeto_id) return;
    let ativo = true;
    db.from("cotas_patrocinio").select("*").eq("projeto_id", captacao.projeto_id).order("ordem")
      .then(({ data }: { data: CotaPatrocinio[] | null }) => { if (ativo) setCotas(data ?? []); });
    return () => { ativo = false; };
  }, [captacao.projeto_id, db]);

  if (captacao.status === "aprovado" || captacao.status === "recusado") {
    const ganho = captacao.status === "aprovado";
    return (
      <div className="flex h-11 items-center gap-2 rounded border px-4" style={{ borderColor: ganho ? "#2E893240" : "#D94E4E40", background: "#fff" }}>
        {ganho && <Check size={13} className="text-[#2E8932]" aria-hidden="true" />}
        <span className="text-[0.75rem] font-bold tabular-nums" style={{ color: ganho ? "#2E8932" : "#B23A3A" }}>
          {ganho ? `Negócio fechado · ${moeda(captacao.valor_aprovado ?? captacao.valor_solicitado)}` : "Negociação recusada"}
        </span>
      </div>
    );
  }

  function marcarRecusada() {
    menu.fechar();
    onRecusar();
  }

  const valor = captacao.valor_solicitado;

  return (
    <>
      <div className="flex h-11 items-stretch overflow-hidden rounded border border-black/[.12] bg-white">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="flex items-center gap-3 px-4 text-left transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#7259B5]"
          aria-label={`${comProjeto ? "Proposta" : "Valor"}: ${valor != null ? moeda(valor) : "definir valor"}. Editar`}
        >
          <span>
            <span className="block max-w-[11rem] truncate text-[0.5625rem] font-semibold uppercase tracking-wide text-black/35">
              {comProjeto ? "Proposta" : "Valor"}{cota && <span className="font-normal normal-case tracking-normal"> · {cota.nome}</span>}
            </span>
            <span className={`block text-[0.75rem] font-bold tabular-nums ${valor != null ? "text-[#B07A14]" : "text-black/40"}`}>{valor != null ? moeda(valor) : "Definir valor"}</span>
          </span>
          <Pencil size={11} className="text-black/25" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={event => menu.abrir(event, 230)}
          aria-label="Mais opções da proposta"
          className="flex w-9 items-center justify-center border-l border-black/[.08] text-black/40 transition hover:bg-black/[.03] hover:text-black/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#7259B5]"
        >
          <MoreHorizontal size={14} aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setFechando(true)}
        className="flex h-11 items-center gap-2 rounded bg-[#2E8932] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98]"
      >
        <Check size={13} aria-hidden="true" /> Fechar negócio
      </button>

      <AnchoredPopover pos={menu.pos} onClose={menu.fechar}>
        <div className="-m-2 flex flex-col">
          {comProjeto && (
            <button type="button" onClick={() => { menu.fechar(); setCompleta(true); }}
              className="rounded px-3 py-2 text-left text-[0.8125rem] text-black/70 transition hover:bg-black/[.04] focus-visible:bg-black/[.04] focus-visible:outline-none">
              Abrir proposta completa
            </button>
          )}
          <button type="button" onClick={marcarRecusada}
            className="rounded px-3 py-2 text-left text-[0.8125rem] text-[#B23A3A] transition hover:bg-black/[.04] focus-visible:bg-black/[.04] focus-visible:outline-none">
            Marcar como recusada
          </button>
        </div>
      </AnchoredPopover>

      {editando && (
        <ValorSheet db={db} captacao={captacao} empresaNome={empresaNome} comProjeto={comProjeto} cotas={cotas} cotaAtual={proposta?.cota_id ?? ""}
          onAbrirCompleta={() => setCompleta(true)} onClose={() => setEditando(false)} onChanged={onChanged} />
      )}
      {fechando && (
        <FecharNegocioSheet captacao={captacao} empresaNome={empresaNome}
          propostaAceitaId={proposta?.status === "aceita" ? proposta.id ?? null : null}
          onClose={() => setFechando(false)} onChanged={onChanged} />
      )}
      {completa && captacao.projeto_id && (
        <PropostaOperacionalModal
          projetoId={captacao.projeto_id}
          projetoNome={projetoNome ?? "Projeto"}
          proposta={proposta}
          cotas={cotas}
          captacoes={[]}
          inscricoes={[]}
          fixedCase={{ kind: "negociacao", id: captacao.id, titulo: projetoNome ?? "Projeto", complemento: empresaNome }}
          valorInicial={valor}
          onClose={() => setCompleta(false)}
          onSaved={() => void onChanged()}
        />
      )}
    </>
  );
}

function ValorSheet({ db, captacao, empresaNome, comProjeto, cotas, cotaAtual, onAbrirCompleta, onClose, onChanged }: {
  db: Db;
  captacao: Captacao;
  empresaNome: string;
  comProjeto: boolean;
  cotas: CotaPatrocinio[];
  cotaAtual: string;
  onAbrirCompleta: () => void;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [cotaId, setCotaId] = useState(cotaAtual);
  const [valorTexto, setValorTexto] = useState(() => formatarValorBRL(captacao.valor_solicitado));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campoValor = useId();
  const lido = lerValorBRL(valorTexto);

  async function salvar(close: () => void) {
    if (!lido.valido) { setErro(MENSAGEM_VALOR_INVALIDO); return; }
    setSalvando(true);
    setErro(null);
    const { error } = await db.rpc("fn_salvar_proposta_simplificada", {
      p_captacao_id: captacao.id, p_valor: lido.valor, p_cota_id: comProjeto ? cotaId || null : null, p_alterar_cota: comProjeto,
    });
    setSalvando(false);
    if (error) { setErro(error.message || "Não foi possível salvar. Tente novamente."); return; }
    await onChanged();
    close();
  }

  return (
    <BottomSheet
      titulo={comProjeto ? "Proposta" : "Valor da negociação"}
      subtitulo={empresaNome}
      onClose={onClose}
      footer={close => (
        <>
          {comProjeto && (
            <button type="button" onClick={() => { close(); onAbrirCompleta(); }} disabled={salvando}
              className="mr-auto rounded px-1 py-2 text-[0.75rem] font-medium text-[#7259B5] transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50">
              Abrir proposta completa
            </button>
          )}
          <button type="button" onClick={close} disabled={salvando}
            className="rounded px-2 py-2 text-[0.75rem] font-medium text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={() => void salvar(close)} disabled={salvando}
            className="min-h-10 rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:opacity-40">
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </>
      )}
    >
      <div className={`grid gap-4 ${comProjeto ? "sm:grid-cols-2" : ""}`}>
        {comProjeto && (
          <div>
            <p className="mb-1.5 text-[0.6875rem] font-medium text-black/45">Cota <span className="font-normal text-black/30">(opcional)</span></p>
            <CustomDropdown value={cotaId}
              onChange={value => {
                if (value === CRIAR_NOVA_COTA) { window.open(`/projetos/${captacao.projeto_id}?tab=proposta`, "_blank"); return; }
                setCotaId(value);
                const escolhida = cotas.find(item => item.id === value);
                if (escolhida) setValorTexto(formatarValorBRL(escolhida.valor));
              }}
              className="[&>button]:w-full" compact icon={<Layers size={13} />} portalZIndex={70}
              placeholder={cotas.length === 0 ? "Nenhuma cota neste projeto" : "Sem cota"}
              options={[
                ...(cotas.length > 0 ? [{ value: "", label: "Sem cota" }] : []),
                ...cotas.map(item => ({
                  value: item.id,
                  label: `${item.nome}${item.modelo === "produto" && item.produto_nome ? ` · ${item.produto_nome}` : ""} · ${formatCotaValor(item)}`,
                  disabled: !cotaTemDisponibilidade(item) && item.id !== cotaAtual,
                })),
                { value: CRIAR_NOVA_COTA, label: "Criar nova cota…", icon: <Plus size={12} /> },
              ]} />
          </div>
        )}
        <div>
          <label htmlFor={campoValor} className="mb-1.5 block text-[0.6875rem] font-medium text-black/45">Valor</label>
          <CampoValor id={campoValor} value={valorTexto} onChange={texto => { setValorTexto(texto); setErro(null); }} invalido={!lido.valido} autoFocus />
        </div>
      </div>
      {erro && <p role="alert" className="mt-4 rounded border border-[#D94E4E]/25 bg-white px-3 py-2 text-[0.75rem] text-[#B23A3A]">{erro}</p>}
    </BottomSheet>
  );
}

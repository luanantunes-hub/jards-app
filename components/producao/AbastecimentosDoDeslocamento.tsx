"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { APAGAR, BOTAO, CAMPO, CANCELAR, Erro, ROTULO, SALVAR } from "@/components/producao/estilosDoBordero";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { formatarReais, lerValorEmReais } from "@/lib/producao/bordero";
import { lerAbastecimento, resumoDosAbastecimentos } from "@/lib/producao/abastecimento";
import { COMBUSTIVEIS_DO_VEICULO, type CombustivelDoVeiculo } from "@/lib/producao/estados";
import { ROTULO_DO_COMBUSTIVEL } from "@/lib/producao/veiculos";

type Linha = { id: string; litros: number; combustivel: CombustivelDoVeiculo; posto: string | null; quando: string };

const OPCOES_DO_COMBUSTIVEL = COMBUSTIVEIS_DO_VEICULO.map(combustivel => ({ value: combustivel, label: ROTULO_DO_COMBUSTIVEL[combustivel] }));
const paraCampo = (numero: number) => String(numero).replace(".", ",");
const litros = (numero: number) => numero.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const quandoEmTexto = (instante: string) => new Date(instante).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Um abastecimento: litros, combustível, posto e, para quem tem a permissão de dinheiro, o valor pago. */
function AbastecimentoSheet({ organizationId, deslocamentoId, linha, valorAtual, comDinheiro, onClose, onSalvou }: {
  organizationId: string; deslocamentoId: string; linha: Linha | null; valorAtual: number | null; comDinheiro: boolean; onClose: () => void; onSalvou: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [quantidade, setQuantidade] = useState(linha ? paraCampo(linha.litros) : "");
  const [combustivel, setCombustivel] = useState<string>(linha?.combustivel ?? "diesel_s10");
  const [posto, setPosto] = useState(linha?.posto ?? "");
  const [valor, setValor] = useState(valorAtual !== null ? paraCampo(valorAtual) : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerAbastecimento({ litros: quantidade, combustivel, posto, valor: comDinheiro ? valor : "" }, lerValorEmReais);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { litros: l, combustivel: c, posto: p, valor: v } = leitura.abastecimento;
    let id = linha?.id ?? null;
    if (linha) {
      const { error } = await producao.from("producao_abastecimentos").update({ litros: l, combustivel: c, posto: p }).eq("id", linha.id);
      if (error) { setSalvando(false); setErro("Não foi possível salvar o abastecimento. Tente de novo."); return; }
    } else {
      const { data, error } = await producao.from("producao_abastecimentos").insert({ organization_id: organizationId, deslocamento_id: deslocamentoId, litros: l, combustivel: c, posto: p }).select("id").single();
      if (error || !data) { setSalvando(false); setErro(error?.code === "42501" ? "Você não pode mudar este deslocamento." : "Não foi possível registrar o abastecimento. Tente de novo."); return; }
      id = data.id;
    }
    if (comDinheiro && id) {
      const { error } = v === null
        ? await producao.from("producao_abastecimento_valores").delete().eq("abastecimento_id", id)
        : await producao.from("producao_abastecimento_valores").upsert({ abastecimento_id: id, organization_id: organizationId, valor: v }, { onConflict: "abastecimento_id" });
      if (error) { setSalvando(false); setErro("O abastecimento foi salvo, mas não foi possível gravar o valor. Tente de novo."); onSalvou(); return; }
    }
    setSalvando(false);
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!linha) return;
    confirmDelete({
      title: "Apagar abastecimento?",
      description: `${litros(linha.litros)} L de ${ROTULO_DO_COMBUSTIVEL[linha.combustivel].toLowerCase()} saem do deslocamento, com o valor.`,
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_abastecimentos").delete().eq("id", linha.id);
        if (error) throw new Error("Não foi possível apagar o abastecimento.");
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={linha ? "Editar abastecimento" : "Novo abastecimento"}
      onClose={onClose}
      footer={fechar => (
        <>
          {linha && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : linha ? "Salvar" : "Registrar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO} htmlFor="abastecimento-litros">Litros</label>
            <input id="abastecimento-litros" inputMode="decimal" autoFocus className={CAMPO} value={quantidade} onChange={evento => setQuantidade(evento.target.value)} placeholder="45,3" disabled={salvando} />
          </div>
          <div>
            <span className={ROTULO}>Combustível</span>
            <Dropdown value={combustivel} onChange={setCombustivel} options={OPCOES_DO_COMBUSTIVEL} />
          </div>
        </div>
        <div>
          <label className={ROTULO} htmlFor="abastecimento-posto">Posto (opcional)</label>
          <input id="abastecimento-posto" className={CAMPO} value={posto} onChange={evento => setPosto(evento.target.value)} maxLength={200} disabled={salvando} />
        </div>
        {comDinheiro && (
          <div>
            <label className={ROTULO} htmlFor="abastecimento-valor">Valor pago, em reais (opcional)</label>
            <input id="abastecimento-valor" inputMode="decimal" className={CAMPO} value={valor} onChange={evento => setValor(evento.target.value)} placeholder="280,50" disabled={salvando} />
          </div>
        )}
      </div>
    </TopSheet>
  );
}

/** Os abastecimentos de um deslocamento (PD6.4): o que o motorista registrou e o que a produção digita, com o total de litros e, para quem tem a permissão de dinheiro, o valor e o preço médio do litro. */
export function AbastecimentosDoDeslocamento({ organizationId, deslocamento, podeEditar, onClose, onMudou }: {
  organizationId: string; deslocamento: { id: string; rotulo: string }; podeEditar: boolean; onClose: () => void; onMudou: () => void;
}) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [valores, setValores] = useState<Map<string, number>>(new Map());
  const [comDinheiro, setComDinheiro] = useState(false);
  const [editando, setEditando] = useState<Linha | "novo" | null>(null);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [lin, din] = await Promise.all([
        producao.from("producao_abastecimentos").select("id, litros, combustivel, posto, quando").eq("deslocamento_id", deslocamento.id).order("quando"),
        producao.rpc("auth_producao_pode", { p_org: organizationId, p_acao: "dinheiro" }),
      ]);
      const ids = (lin.data ?? []).map(item => item.id);
      // Quem não tem a permissão de dinheiro recebe a lista vazia (o banco esconde), então nem se pergunta.
      const val = din.data === true && ids.length > 0 ? await producao.from("producao_abastecimento_valores").select("abastecimento_id, valor").in("abastecimento_id", ids) : { data: [] as { abastecimento_id: string; valor: number }[] };
      if (!ativo) return;
      setErro(lin.error ? "Não foi possível carregar os abastecimentos. Recarregue a página." : null);
      setLinhas((lin.data ?? []).map(item => ({ ...item, litros: Number(item.litros) })));
      setComDinheiro(din.data === true);
      setValores(new Map((val.data ?? []).map(item => [item.abastecimento_id, Number(item.valor)])));
    })();
    return () => { ativo = false; };
  }, [deslocamento.id, organizationId, versao]);

  const salvou = useCallback(() => { setVersao(atual => atual + 1); onMudou(); }, [onMudou]);
  const resumo = useMemo(() => resumoDosAbastecimentos((linhas ?? []).map(linha => ({ litros: linha.litros, valor: valores.get(linha.id) ?? null }))), [linhas, valores]);
  const partesDoResumo = [
    `${resumo.quantidade} ${resumo.quantidade === 1 ? "abastecimento" : "abastecimentos"}`,
    `${litros(resumo.litros)} L`,
    ...(comDinheiro && resumo.valorCentavos > 0 ? [formatarReais(resumo.valorCentavos)] : []),
    ...(comDinheiro && resumo.precoDoLitroCentavos !== null ? [`${formatarReais(resumo.precoDoLitroCentavos)} por litro`] : []),
  ];

  return (
    <>
      <TopSheet
        titulo={`Abastecimentos · ${deslocamento.rotulo}`}
        onClose={onClose}
        footer={fechar => (
          <>
            <button type="button" onClick={fechar} className={CANCELAR}>Fechar</button>
            {podeEditar && <button type="button" onClick={() => setEditando("novo")} className={BOTAO}><Plus size={13} aria-hidden="true" /> Novo abastecimento</button>}
          </>
        )}
      >
        <div className="space-y-4">
          {erro && <Erro texto={erro} />}
          {linhas === null ? (
            <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
          ) : linhas.length === 0 ? (
            <p className="text-[0.8125rem] text-black/55">Nenhum abastecimento neste deslocamento. O motorista registra pela folha dele, e a produção também pode digitar aqui.</p>
          ) : (
            <>
              <p className="text-[0.75rem] tabular-nums text-black/55" role="status">{partesDoResumo.join(" · ")}</p>
              {comDinheiro && resumo.semValor > 0 && resumo.semValor < resumo.quantidade && <p className="text-[0.6875rem] text-black/45">{resumo.semValor === 1 ? "Um abastecimento ainda está sem valor" : `${resumo.semValor} abastecimentos ainda estão sem valor`}; ele{resumo.semValor === 1 ? "" : "s"} fica{resumo.semValor === 1 ? "" : "m"} fora do preço médio.</p>}
              <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                {linhas.map(linha => {
                  const valor = valores.get(linha.id);
                  return (
                    <li key={linha.id} className="flex items-start gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.8125rem] font-medium tabular-nums text-[#282525]">{litros(linha.litros)} L · {ROTULO_DO_COMBUSTIVEL[linha.combustivel]}{comDinheiro && valor !== undefined ? ` · ${formatarReais(Math.round(valor * 100))}` : ""}</span>
                        <span className="mt-0.5 block text-[0.6875rem] text-black/45">{[linha.posto, quandoEmTexto(linha.quando)].filter(Boolean).join(" · ")}</span>
                      </span>
                      {podeEditar && (
                        <button type="button" onClick={() => setEditando(linha)} aria-label={`Editar o abastecimento de ${litros(linha.litros)} litros`} title="Editar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Pencil size={13} aria-hidden="true" /></button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </TopSheet>
      {editando && (
        <AbastecimentoSheet organizationId={organizationId} deslocamentoId={deslocamento.id} linha={editando === "novo" ? null : editando}
          valorAtual={editando === "novo" ? null : valores.get(editando.id) ?? null} comDinheiro={comDinheiro} onClose={() => setEditando(null)} onSalvou={salvou} />
      )}
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, TriangleAlert } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { APAGAR, BOTAO, CAMPO, CANCELAR, Erro, ROTULO, SALVAR } from "@/components/producao/estilosDoBordero";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import type { CategoriaDoOrcamento } from "@/lib/producao/estados";
import { emCentavos, formatarReais, lerValorEmReais } from "@/lib/producao/bordero";
import { ROTULO_DA_CATEGORIA_DO_ORCAMENTO } from "@/lib/producao/orcamento";
import {
  lerPedido, mensagemDoErroDePedido, pedidoApagavel, pedidoEditavel, pendenciaEditavel, pendenciaVencida, planilhaDosPedidos,
  ROTULO_DA_SITUACAO_DO_PEDIDO, totaisDosPedidos, type PedidoDaTemporada,
} from "@/lib/producao/pedidos";

export type LinhaDisponivel = { id: string; rotulo: string };

const paraCampo = (valor: number) => String(valor).replace(".", ",");
const dia = (data: string) => data.split("-").reverse().join("/");

export function PedidoSheet({ organizationId, temporadaId, pedido, linhas, onClose, onSalvou }: {
  organizationId: string; temporadaId: string; pedido: PedidoDaTemporada | null; linhas: LinhaDisponivel[]; onClose: () => void; onSalvou: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const editavel = pedido === null || pedidoEditavel(pedido.situacao);
  const [descricao, setDescricao] = useState(pedido?.descricao ?? "");
  const [favorecido, setFavorecido] = useState(pedido?.favorecido ?? "");
  const [valor, setValor] = useState(pedido ? paraCampo(pedido.valor) : "");
  const [justificativa, setJustificativa] = useState(pedido?.justificativa ?? "");
  const [linhaId, setLinhaId] = useState(pedido?.orcamento_linha_id ?? "");
  const [pendencia, setPendencia] = useState(pedido?.pendencia ?? "");
  const [pendenciaAte, setPendenciaAte] = useState(pedido?.pendencia_ate ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const podePendencia = pedido === null || pendenciaEditavel(pedido.situacao);

  async function salvar(fechar: () => void) {
    const leitura = lerPedido({ descricao, favorecido, valor, justificativa, pendencia, pendenciaAte }, lerValorEmReais);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const soPendencia = { pendencia: leitura.valor.pendencia, pendencia_ate: leitura.valor.pendencia_ate };
    const { error } = pedido
      ? await producao.from("producao_pedidos").update(editavel ? { ...leitura.valor, orcamento_linha_id: linhaId || null } : soPendencia).eq("id", pedido.id)
      : await producao.from("producao_pedidos").insert({ organization_id: organizationId, temporada_id: temporadaId, ...leitura.valor, orcamento_linha_id: linhaId || null });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDePedido(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!pedido) return;
    confirmDelete({
      title: "Apagar pedido?",
      description: `O pedido "${pedido.descricao}" (${formatarReais(emCentavos(pedido.valor))}) sai da temporada. Isso não pode ser desfeito.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_pedidos").delete().eq("id", pedido.id);
        if (error) throw new Error(mensagemDoErroDePedido(error));
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={pedido ? `Pedido: ${pedido.descricao}` : "Novo pedido de pagamento"}
      onClose={onClose}
      footer={fechar => (
        <>
          {pedido && pedidoApagavel(pedido.situacao) && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          {podePendencia && <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : pedido ? "Salvar" : "Criar pedido"}</button>}
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        {!editavel && <p className="rounded border bg-white px-3 py-2 text-[0.6875rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.1)" }}>O pedido está {ROTULO_DA_SITUACAO_DO_PEDIDO[pedido.situacao].toLowerCase()}: o que foi pedido não muda. Só a próxima pendência. Para ajustar o pedido, retire-o da aprovação ou reabra-o.</p>}
        {pedido?.motivo_recusa && <p className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>Recusado: {pedido.motivo_recusa}</p>}
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <div>
            <label className={ROTULO} htmlFor="ped-descricao">O que precisa ser pago</label>
            <input id="ped-descricao" className={CAMPO} value={descricao} maxLength={120} onChange={event => setDescricao(event.target.value)} disabled={salvando || !editavel} placeholder="Cachê do diretor" />
          </div>
          <div>
            <label className={ROTULO} htmlFor="ped-valor">Valor (R$)</label>
            <input id="ped-valor" inputMode="decimal" className={CAMPO} value={valor} onChange={event => setValor(event.target.value)} disabled={salvando || !editavel} placeholder="5.000,00" />
          </div>
        </div>
        <div>
          <label className={ROTULO} htmlFor="ped-favorecido">Quem vai receber</label>
          <input id="ped-favorecido" className={CAMPO} value={favorecido} maxLength={120} onChange={event => setFavorecido(event.target.value)} disabled={salvando || !editavel} placeholder="Pessoa, empresa ou companhia" />
        </div>
        {linhas.length > 0 && (
          <div>
            <span className={ROTULO}>Linha do orçamento (opcional)</span>
            <Dropdown ariaLabel="Linha do orçamento do pedido" value={linhaId} onChange={setLinhaId} disabled={salvando || !editavel} options={[{ value: "", label: "Nenhuma" }, ...linhas.map(item => ({ value: item.id, label: item.rotulo }))]} />
          </div>
        )}
        <div>
          <label className={ROTULO} htmlFor="ped-justificativa">Justificativa</label>
          <textarea id="ped-justificativa" rows={2} className={`${CAMPO} h-auto min-h-[3.5rem] py-2`} value={justificativa} maxLength={400} onChange={event => setJustificativa(event.target.value)} disabled={salvando || !editavel} placeholder="Por que este pagamento é necessário" />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <div>
            <label className={ROTULO} htmlFor="ped-pendencia">Próxima pendência</label>
            <input id="ped-pendencia" className={CAMPO} value={pendencia} maxLength={200} onChange={event => setPendencia(event.target.value)} disabled={salvando || !podePendencia} placeholder="Falta a nota do fornecedor" />
          </div>
          <div>
            <label className={ROTULO} htmlFor="ped-pendencia-ate">Até</label>
            <input id="ped-pendencia-ate" type="date" className={CAMPO} value={pendenciaAte} onChange={event => setPendenciaAte(event.target.value)} disabled={salvando || !podePendencia} />
          </div>
        </div>
      </div>
    </TopSheet>
  );
}

/** Os pedidos de pagamento de uma temporada (PD5.4): quem pede, quem aprova dentro da alçada e o pagamento. Só aparece a quem tem a permissão de dinheiro. */
export function PedidosDaTemporada({ organizationId, temporadaId, temporadaTitulo, podeEditar }: { organizationId: string; temporadaId: string; temporadaTitulo: string; podeEditar: boolean }) {
  const [comDinheiro, setComDinheiro] = useState<boolean | null>(null);
  const [pedidos, setPedidos] = useState<PedidoDaTemporada[]>([]);
  const [linhas, setLinhas] = useState<LinhaDisponivel[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [folha, setFolha] = useState<{ pedido: PedidoDaTemporada | null } | null>(null);
  const [hoje] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const { data } = await producao.rpc("auth_producao_pode", { p_org: organizationId, p_acao: "dinheiro" });
      if (!ativo) return;
      setComDinheiro(data === true);
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  useEffect(() => {
    if (!comDinheiro) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [ped, orc] = await Promise.all([
        producao.from("producao_pedidos").select("id, orcamento_linha_id, solicitante_id, descricao, favorecido, valor, justificativa, situacao, aprovado_por, aprovado_em, motivo_recusa, pendencia, pendencia_ate").eq("temporada_id", temporadaId).order("created_at", { ascending: false }),
        producao.from("producao_orcamentos").select("id, nome").eq("temporada_id", temporadaId).order("created_at"),
      ]);
      const orcamentos = (orc.data ?? []) as { id: string; nome: string }[];
      const lin = orcamentos.length > 0 ? await producao.from("producao_orcamento_linhas").select("id, orcamento_id, categoria, descricao").in("orcamento_id", orcamentos.map(item => item.id)).order("descricao") : { data: [], error: null };
      if (!ativo) return;
      const nomeDoOrcamento = new Map(orcamentos.map(item => [item.id, item.nome]));
      setPedidos((ped.data ?? []) as PedidoDaTemporada[]);
      setLinhas(((lin.data ?? []) as { id: string; orcamento_id: string; categoria: CategoriaDoOrcamento; descricao: string }[]).map(item => ({
        id: item.id, rotulo: `${orcamentos.length > 1 ? `${nomeDoOrcamento.get(item.orcamento_id) ?? ""} · ` : ""}${ROTULO_DA_CATEGORIA_DO_ORCAMENTO[item.categoria]} · ${item.descricao}`,
      })));
      setCarregado(true);
      setErro(ped.error || orc.error || lin.error ? "Não foi possível carregar os pedidos. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [comDinheiro, temporadaId, versao]);

  const rotuloDaLinha = useMemo(() => new Map(linhas.map(item => [item.id, item.rotulo])), [linhas]);
  const totais = useMemo(() => totaisDosPedidos(pedidos, hoje), [pedidos, hoje]);

  if (!comDinheiro || !carregado) return null;

  const mudou = () => setVersao(atual => atual + 1);

  function baixar() {
    const arquivo = new Blob([planilhaDosPedidos({ temporada: temporadaTitulo, hoje, pedidos, rotuloDaLinha: id => rotuloDaLinha.get(id) ?? "Linha apagada" })], { type: "text/csv;charset=utf-8" });
    const endereco = URL.createObjectURL(arquivo);
    const ancora = document.createElement("a");
    ancora.href = endereco;
    ancora.download = "pedidos.csv";
    ancora.click();
    URL.revokeObjectURL(endereco);
  }

  const resumo = [
    { rotulo: "Aguardando aprovação", valor: totais.aguardandoCentavos },
    { rotulo: "Aprovado, a pagar", valor: totais.aprovadoAPagarCentavos },
    { rotulo: "Pago", valor: totais.pagoCentavos },
  ];

  return (
    <section aria-labelledby="pedidos-da-temporada" className="mt-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="pedidos-da-temporada" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Pedidos de pagamento</h2>
        <div className="flex flex-wrap items-center gap-2">
          {pedidos.length > 0 && <button type="button" onClick={baixar} className={BOTAO}><Download size={13} aria-hidden="true" /> Planilha</button>}
          {podeEditar && <button type="button" onClick={() => setFolha({ pedido: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Pedido</button>}
        </div>
      </div>
      {erro && <div className="mb-2"><Erro texto={erro} /></div>}
      {pedidos.length === 0 ? (
        <p className="rounded border bg-white px-5 py-6 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhum pedido de pagamento. Quem precisa pagar algo cria o pedido, quem tem alçada aprova, e o pedido só vira pago com o lançamento do pagamento ligado a ele.</p>
      ) : (
        <div className="space-y-3">
          <dl className="grid gap-2 sm:grid-cols-3">
            {resumo.map(item => (
              <div key={item.rotulo} className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <dt className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{item.rotulo}</dt>
                <dd className={`mt-1 text-[1.0625rem] font-medium tabular-nums ${item.valor === 0 ? "text-black/30" : "text-[#282525]"}`} title={formatarReais(item.valor)}>{formatarReais(item.valor)}</dd>
              </div>
            ))}
          </dl>
          {totais.pendenciasVencidas > 0 && <p className="flex items-start gap-1.5 rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}><TriangleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" /> {totais.pendenciasVencidas} {totais.pendenciasVencidas === 1 ? "pedido com a pendência vencida" : "pedidos com a pendência vencida"}.</p>}
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {pedidos.map(pedido => {
              const vencida = pendenciaVencida(pedido, hoje);
              return (
                <li key={pedido.id}>
                  <Link href={`/producoes/pedidos/${pedido.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]">
                    <div className="min-w-0 flex-1 basis-64">
                      <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{pedido.descricao}</p>
                      <p className="truncate text-[0.6875rem] tabular-nums text-black/45">{formatarReais(emCentavos(pedido.valor))}{pedido.favorecido ? ` para ${pedido.favorecido}` : ""}</p>
                      {pedido.pendencia && <p className={`mt-0.5 truncate text-[0.6875rem] ${vencida ? "text-[#B23B3B]" : "text-[#B07A14]"}`}>Pendência: {pedido.pendencia}{pedido.pendencia_ate ? ` · até ${dia(pedido.pendencia_ate)}${vencida ? " (vencida)" : ""}` : ""}</p>}
                    </div>
                    <span className="rounded border px-2 py-1 text-[0.6875rem] font-medium text-[#282525]" style={{ borderColor: "rgba(13,13,13,.25)" }}>{ROTULO_DA_SITUACAO_DO_PEDIDO[pedido.situacao]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {folha && <PedidoSheet organizationId={organizationId} temporadaId={temporadaId} pedido={folha.pedido} linhas={linhas} onClose={() => setFolha(null)} onSalvou={mudou} />}
    </section>
  );
}

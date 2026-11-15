"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Plus, TriangleAlert } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { APAGAR, BOTAO, BOTAO_PEQUENO, CAMPO, CANCELAR, Erro, ROTULO, SALVAR } from "@/components/producao/estilosDoBordero";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { FORMAS_DO_ACERTO, PAPEIS_NO_ACERTO, type FormaDoAcerto, type PapelNoAcerto } from "@/lib/producao/estados";
import { formatarReais, lerValorEmReais } from "@/lib/producao/bordero";
import {
  calcularAcerto, lerAcerto, mensagemDoErroDeAcerto, MODELOS_DE_PARTE, percentualUsado, planilhaDoAcerto, ROTULO_DA_FORMA_DO_ACERTO, ROTULO_DA_SITUACAO_DO_ACERTO,
  ROTULO_DO_PAPEL_NO_ACERTO, textoDoAcerto, type AcertoDoBordero,
} from "@/lib/producao/acerto-bordero";

const dataCurta = (dia: string) => dia.split("-").reverse().join("/");

function ParteSheet({ organizationId, borderoId, parte, onClose, onSalvou }: { organizationId: string; borderoId: string; parte: AcertoDoBordero | null; onClose: () => void; onSalvou: () => void }) {
  const { confirmDelete } = useDeleteConfirm();
  const [nome, setNome] = useState(parte?.parte ?? "");
  const [papel, setPapel] = useState<PapelNoAcerto>(parte?.papel ?? "outra");
  const [forma, setForma] = useState<FormaDoAcerto>(parte?.forma ?? "percentual");
  const [valor, setValor] = useState(parte && parte.forma !== "resto" ? String(parte.valor).replace(".", ",") : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerAcerto({ parte: nome, papel, forma, valor }, lerValorEmReais);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = parte
      ? await producao.from("producao_bordero_acertos").update(leitura.valor).eq("id", parte.id)
      : await producao.from("producao_bordero_acertos").insert({ organization_id: organizationId, bordero_id: borderoId, ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeAcerto(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!parte) return;
    confirmDelete({
      title: "Apagar parte do acerto?",
      description: `${parte.parte} sai do acerto deste borderô.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_bordero_acertos").delete().eq("id", parte.id);
        if (error) throw new Error(mensagemDoErroDeAcerto(error));
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={parte ? "Editar parte" : "Nova parte do acerto"}
      onClose={onClose}
      footer={fechar => (
        <>
          {parte && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : parte ? "Salvar" : "Adicionar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div>
          <label className={ROTULO} htmlFor="acerto-parte">Quem recebe</label>
          <input id="acerto-parte" className={CAMPO} value={nome} maxLength={80} onChange={event => setNome(event.target.value)} disabled={salvando} placeholder="Companhia" />
          {!parte && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MODELOS_DE_PARTE.map(modelo => <button key={modelo.parte} type="button" className={BOTAO_PEQUENO} onClick={() => { setNome(modelo.parte); setPapel(modelo.papel); setForma(modelo.forma); }}>{modelo.parte}</button>)}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={ROTULO}>Papel</span>
            <Dropdown ariaLabel="Papel da parte" value={papel} onChange={novo => setPapel(novo as PapelNoAcerto)} disabled={salvando} options={PAPEIS_NO_ACERTO.map(item => ({ value: item, label: ROTULO_DO_PAPEL_NO_ACERTO[item] }))} />
          </div>
          <div>
            <span className={ROTULO}>Como recebe</span>
            <Dropdown ariaLabel="Forma do acerto" value={forma} onChange={novo => setForma(novo as FormaDoAcerto)} disabled={salvando} options={FORMAS_DO_ACERTO.map(item => ({ value: item, label: ROTULO_DA_FORMA_DO_ACERTO[item] }))} />
          </div>
        </div>
        {forma !== "resto" && (
          <div>
            <label className={ROTULO} htmlFor="acerto-valor">{forma === "percentual" ? "Porcentagem do líquido (%)" : "Valor (R$)"}</label>
            <input id="acerto-valor" inputMode="decimal" className={CAMPO} value={valor} onChange={event => setValor(event.target.value)} disabled={salvando} placeholder={forma === "percentual" ? "50" : "2.000,00"} />
          </div>
        )}
        <p className="rounded border bg-white px-3 py-2 text-[0.6875rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.1)" }}>
          {forma === "resto" ? "Esta parte recebe o que sobrar do líquido depois das outras. Só uma parte pode ser assim." : "Digite o que está combinado em contrato. O app calcula e registra; o pagamento é feito por você, fora do app."}
        </p>
      </div>
    </TopSheet>
  );
}

function PagamentoSheet({ parte, onClose, onSalvou }: { parte: AcertoDoBordero; onClose: () => void; onSalvou: () => void }) {
  const [dia, setDia] = useState(parte.pago_em ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gravar(valor: string | null, fechar: () => void) {
    if (valor !== null && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) { setErro("Escolha a data em que o pagamento foi feito."); return; }
    setSalvando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_bordero_acertos").update({ pago_em: valor }).eq("id", parte.id);
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeAcerto(error)); return; }
    onSalvou();
    fechar();
  }

  return (
    <TopSheet
      titulo={`Pagamento: ${parte.parte}`}
      onClose={onClose}
      footer={fechar => (
        <>
          {parte.pago_em && <button type="button" onClick={() => void gravar(null, fechar)} disabled={salvando} className={APAGAR}>Tirar a data</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void gravar(dia, fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : "Salvar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div>
          <label className={ROTULO} htmlFor="acerto-pago">Pago em</label>
          <input id="acerto-pago" type="date" className={CAMPO} value={dia} onChange={event => setDia(event.target.value)} disabled={salvando} />
        </div>
      </div>
    </TopSheet>
  );
}

/** O acerto de contas de um borderô (PD7.9): quanto cabe a cada parte do líquido. O app calcula, registra, aprova e exporta; não paga. Só aparece a quem tem a permissão de dinheiro. */
export function AcertoDeContasDoBordero({ organizationId, borderoId, borderoFechado, sessaoRotulo, liquidoCentavos, podeEditar }: { organizationId: string; borderoId: string; borderoFechado: boolean; sessaoRotulo: string; liquidoCentavos: number; podeEditar: boolean }) {
  const [acertos, setAcertos] = useState<AcertoDoBordero[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [folhaParte, setFolhaParte] = useState<{ parte: AcertoDoBordero | null } | null>(null);
  const [folhaPagamento, setFolhaPagamento] = useState<AcertoDoBordero | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_bordero_acertos").select("id, parte, papel, forma, valor, situacao, aprovado_em, pago_em").eq("bordero_id", borderoId);
      if (!ativo) return;
      setAcertos(data ?? []);
      setCarregado(true);
      setErro(error ? "Não foi possível carregar o acerto. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [borderoId, versao]);

  const recarregar = () => setVersao(atual => atual + 1);
  const contas = useMemo(() => calcularAcerto(liquidoCentavos, acertos), [liquidoCentavos, acertos]);
  const usado = useMemo(() => percentualUsado(acertos), [acertos]);

  async function mudar(id: string, valores: { situacao: "proposto" | "aprovado" }) {
    setTrabalhando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_bordero_acertos").update(valores).eq("id", id);
    setTrabalhando(false);
    if (error) { setErro(mensagemDoErroDeAcerto(error)); return; }
    recarregar();
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(textoDoAcerto({ sessao: sessaoRotulo, liquidoCentavos, contas })); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { setErro("Não foi possível copiar. Selecione o texto e copie à mão."); }
  }

  function baixar() {
    const arquivo = new Blob([planilhaDoAcerto({ sessao: sessaoRotulo, liquidoCentavos, contas })], { type: "text/csv;charset=utf-8" });
    const endereco = URL.createObjectURL(arquivo);
    const ancora = document.createElement("a");
    ancora.href = endereco;
    ancora.download = "acerto-de-contas.csv";
    ancora.click();
    URL.revokeObjectURL(endereco);
  }

  if (!carregado) return <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />;

  return (
    <section aria-labelledby="bordero-acerto">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="bordero-acerto" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Acerto de contas</h2>
        <div className="flex flex-wrap items-center gap-2">
          {acertos.length > 0 && <button type="button" onClick={() => void copiar()} className={BOTAO}><Copy size={13} aria-hidden="true" /> {copiado ? "Copiado" : "Copiar acerto"}</button>}
          {acertos.length > 0 && <button type="button" onClick={baixar} className={BOTAO}><Download size={13} aria-hidden="true" /> Planilha</button>}
          {podeEditar && <button type="button" onClick={() => setFolhaParte({ parte: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Parte</button>}
        </div>
      </div>
      {erro && <div className="mb-2"><Erro texto={erro} /></div>}

      {acertos.length === 0 ? (
        <p className="rounded border bg-white px-5 py-5 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhuma parte no acerto. Acrescente quem recebe do líquido (companhia, casa, patrocinador) com a porcentagem ou o valor do contrato.</p>
      ) : (
        <div className="overflow-x-auto rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-black/[.06]">
                {["Parte", "Combinado", "A receber", "Situação"].map((titulo, indice) => <th key={titulo} scope="col" className={`px-4 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45 ${indice === 2 ? "text-right" : ""}`}>{titulo}</th>)}
                {podeEditar && <th scope="col" className="px-3 py-2.5"><span className="sr-only">Ações</span></th>}
              </tr>
            </thead>
            <tbody>
              {contas.linhas.map(linha => {
                const parte = acertos.find(item => item.id === linha.id) ?? null;
                const aprovado = linha.situacao === "aprovado";
                return (
                  <tr key={linha.id} className="border-b border-black/[.06] last:border-b-0">
                    <th scope="row" className="px-4 py-2 text-left">
                      <span className="block text-[0.8125rem] font-medium text-[#282525]">{linha.parte}</span>
                      <span className="block text-[0.6875rem] font-normal text-black/45">{ROTULO_DO_PAPEL_NO_ACERTO[linha.papel]}</span>
                    </th>
                    <td className="px-4 py-2 text-[0.8125rem] tabular-nums text-black/65">{linha.forma === "resto" ? "O que sobra" : linha.forma === "percentual" ? `${linha.valor.toLocaleString("pt-BR")}% do líquido` : `${formatarReais(Math.round(linha.valor * 100))} fixo`}</td>
                    <td className={`px-4 py-2 text-right text-[0.8125rem] tabular-nums ${linha.valorCentavos === 0 ? "text-black/30" : "text-[#282525]"}`}>{formatarReais(linha.valorCentavos)}</td>
                    <td className="px-4 py-2 text-[0.75rem] text-black/65">
                      {linha.pago_em ? `Pago em ${dataCurta(linha.pago_em)}` : ROTULO_DA_SITUACAO_DO_ACERTO[linha.situacao]}
                    </td>
                    {podeEditar && parte && (
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {!aprovado && <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando} onClick={() => setFolhaParte({ parte })}>Editar</button>}
                          {!aprovado && <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando || !borderoFechado} title={borderoFechado ? undefined : "Feche o borderô para aprovar"} onClick={() => void mudar(linha.id, { situacao: "aprovado" })}>Aprovar</button>}
                          {aprovado && <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando} onClick={() => setFolhaPagamento(parte)}>{linha.pago_em ? "Mudar data" : "Anotar pagamento"}</button>}
                          {aprovado && !linha.pago_em && <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando} onClick={() => void mudar(linha.id, { situacao: "proposto" })}>Desaprovar</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {acertos.length > 0 && (
        <div className="mt-2 space-y-2">
          <p className="text-[0.6875rem] tabular-nums text-black/45">Distribuído: {formatarReais(contas.totalCentavos)} de {formatarReais(Math.max(0, liquidoCentavos))} · porcentagens: {usado.toLocaleString("pt-BR")}% de 100%{!borderoFechado ? " · feche o borderô para aprovar" : ""}</p>
          {contas.avisos.map(aviso => <p key={aviso} className="flex items-start gap-1.5 rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}><TriangleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" /> {aviso}</p>)}
        </div>
      )}

      {folhaParte && <ParteSheet organizationId={organizationId} borderoId={borderoId} parte={folhaParte.parte} onClose={() => setFolhaParte(null)} onSalvou={recarregar} />}
      {folhaPagamento && <PagamentoSheet parte={folhaPagamento} onClose={() => setFolhaPagamento(null)} onSalvou={recarregar} />}
    </section>
  );
}

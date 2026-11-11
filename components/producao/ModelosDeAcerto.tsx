"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import {
  chaveParaCampo, DESTINO_DO_ACERTO, lerCampo, lerModelo, MODELO_PADRAO, ROTULO_DA_VISIBILIDADE, ROTULO_DO_TIPO_DE_CAMPO, type CampoDoModelo,
} from "@/lib/producao/acerto";
import { DESTINOS_DO_ACERTO, LADOS_DO_ACERTO, TIPOS_DE_CAMPO_DO_ACERTO, VISIBILIDADES_DO_ACERTO, type LadoDoAcerto } from "@/lib/producao/estados";

type Modelo = { id: string; nome: string; lado: LadoDoAcerto; campos: CampoDoModelo[] };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/50";
const ROTULO_DO_LADO: Record<LadoDoAcerto, string> = { casa: "A casa que recebe preenche", companhia: "A companhia preenche" };

const camposDoJson = (valor: unknown): CampoDoModelo[] =>
  (Array.isArray(valor) ? valor : []).flatMap(entrada => { const leitura = lerCampo((entrada ?? {}) as Partial<Record<keyof CampoDoModelo, unknown>>); return leitura.ok ? [leitura.campo] : []; });

function ModeloSheet({ organizationId, modelo, onClose, onSaved }: { organizationId: string; modelo?: Modelo; onClose: () => void; onSaved: () => void }) {
  const { confirmDelete } = useDeleteConfirm();
  const [nome, setNome] = useState(modelo?.nome ?? "");
  const [lado, setLado] = useState<string>(modelo?.lado ?? "casa");
  const [campos, setCampos] = useState<(CampoDoModelo & { opcoesTexto: string })[]>((modelo?.campos ?? []).map(campo => ({ ...campo, opcoesTexto: campo.opcoes.join(", ") })));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mudar = (indice: number, parte: Partial<CampoDoModelo & { opcoesTexto: string }>) => setCampos(atual => atual.map((campo, i) => (i === indice ? { ...campo, ...parte } : campo)));
  const mover = (indice: number, passo: number) => setCampos(atual => {
    const destino = indice + passo;
    if (destino < 0 || destino >= atual.length) return atual;
    const copia = [...atual];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    return copia;
  });
  const acrescentar = () => setCampos(atual => [...atual, {
    chave: chaveParaCampo("campo", new Set(atual.map(campo => campo.chave))), secao: atual.at(-1)?.secao ?? "Geral", rotulo: "", tipo: "texto", opcoes: [], destino: "livre", visibilidade: "opcional", ajuda: "", opcoesTexto: "",
  }]);

  async function salvar(fechar: () => void) {
    const usadas = new Set<string>();
    const prontos = campos.map(campo => {
      // O campo novo ganha a chave do nome que a pessoa deu (a chave de campo que já existia não muda).
      const chave = campo.chave.startsWith("campo") && campo.rotulo.trim() !== "" ? chaveParaCampo(campo.rotulo, usadas) : campo.chave;
      usadas.add(chave);
      return { chave, secao: campo.secao, rotulo: campo.rotulo, tipo: campo.tipo, opcoes: campo.tipo === "escolha" ? campo.opcoesTexto.split(",") : [], destino: campo.destino, visibilidade: campo.visibilidade, ajuda: campo.ajuda };
    });
    const leitura = lerModelo(nome, prontos);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const dados = { nome: leitura.nome, lado: lado as LadoDoAcerto, campos: leitura.campos };
    const { error } = modelo
      ? await producao.from("producao_modelos_acerto").update(dados).eq("id", modelo.id)
      : await producao.from("producao_modelos_acerto").insert({ organization_id: organizationId, ...dados });
    setSalvando(false);
    if (error) { setErro(error.code === "23505" ? "Já existe um modelo com esse nome." : error.code === "42501" ? "Você não pode mudar os modelos." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!modelo) return;
    confirmDelete({
      title: "Apagar modelo?",
      description: `"${modelo.nome}" sai da lista. Os acertos que já nasceram dele continuam como estão.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_modelos_acerto").delete().eq("id", modelo.id);
        if (error) throw new Error("Não foi possível apagar o modelo.");
        onSaved();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={modelo ? "Editar modelo de acerto" : "Novo modelo de acerto"}
      onClose={onClose}
      footer={fechar => (
        <>
          {modelo && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : modelo ? "Salvar" : "Criar modelo"}</button>
        </>
      )}
    >
      <div className="space-y-5">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={ROTULO} htmlFor="modelo-nome">Nome do modelo</label><input id="modelo-nome" autoFocus className={CAMPO} value={nome} onChange={event => setNome(event.target.value)} maxLength={120} disabled={salvando} /></div>
          <div><span className={ROTULO}>Quem preenche</span><Dropdown ariaLabel="Quem preenche" value={lado} onChange={setLado} disabled={salvando} options={LADOS_DO_ACERTO.map(valor => ({ value: valor, label: ROTULO_DO_LADO[valor] }))} /></div>
        </div>
        <p className="text-[0.6875rem] text-black/45">Cada campo diz o que a casa vê (oculto, só lê, opcional ou obrigatório) e para onde a resposta aprovada vai: um campo da ficha da sala ou do espaço, ou só o acerto. Um acerto copia os campos quando nasce, então mudar o modelo depois não muda acerto já enviado.</p>
        <ul className="space-y-3">
          {campos.map((campo, indice) => (
            <li key={campo.chave + indice} className="rounded border bg-white p-3" style={{ borderColor: "rgba(13,13,13,.1)" }}>
              <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
                <div><label className={ROTULO} htmlFor={`c${indice}-rotulo`}>Nome do campo</label><input id={`c${indice}-rotulo`} className={CAMPO} value={campo.rotulo} onChange={event => mudar(indice, { rotulo: event.target.value })} maxLength={200} disabled={salvando} /></div>
                <div><label className={ROTULO} htmlFor={`c${indice}-secao`}>Seção</label><input id={`c${indice}-secao`} className={CAMPO} value={campo.secao} onChange={event => mudar(indice, { secao: event.target.value })} maxLength={60} disabled={salvando} /></div>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <div><span className={ROTULO}>Tipo</span><Dropdown ariaLabel="Tipo do campo" value={campo.tipo} onChange={valor => mudar(indice, { tipo: valor as CampoDoModelo["tipo"] })} disabled={salvando} options={TIPOS_DE_CAMPO_DO_ACERTO.map(valor => ({ value: valor, label: ROTULO_DO_TIPO_DE_CAMPO[valor] }))} /></div>
                <div><span className={ROTULO}>A casa vê</span><Dropdown ariaLabel="O que a casa vê" value={campo.visibilidade} onChange={valor => mudar(indice, { visibilidade: valor as CampoDoModelo["visibilidade"] })} disabled={salvando} options={VISIBILIDADES_DO_ACERTO.map(valor => ({ value: valor, label: ROTULO_DA_VISIBILIDADE[valor] }))} /></div>
                <div>
                  <span className={ROTULO}>Resposta aprovada vai para</span>
                  <Dropdown ariaLabel="Destino do campo" value={campo.destino} onChange={valor => {
                    const exigido = DESTINO_DO_ACERTO[valor as CampoDoModelo["destino"]].tipo;
                    mudar(indice, { destino: valor as CampoDoModelo["destino"], ...(exigido ? { tipo: exigido } : {}) });
                  }} disabled={salvando} options={DESTINOS_DO_ACERTO.map(valor => ({ value: valor, label: DESTINO_DO_ACERTO[valor].rotulo }))} />
                </div>
              </div>
              {campo.tipo === "escolha" && <div className="mt-2"><label className={ROTULO} htmlFor={`c${indice}-opcoes`}>Opções (separadas por vírgula)</label><input id={`c${indice}-opcoes`} className={CAMPO} value={campo.opcoesTexto} onChange={event => mudar(indice, { opcoesTexto: event.target.value })} placeholder="127 V, 220 V" disabled={salvando} /></div>}
              <div className="mt-2"><label className={ROTULO} htmlFor={`c${indice}-ajuda`}>Dica para a casa (opcional)</label><input id={`c${indice}-ajuda`} className={CAMPO} value={campo.ajuda} onChange={event => mudar(indice, { ajuda: event.target.value })} maxLength={300} disabled={salvando} /></div>
              <div className="mt-2 flex items-center gap-1">
                <button type="button" onClick={() => mover(indice, -1)} disabled={indice === 0 || salvando} aria-label="Subir o campo" className="flex h-8 w-8 items-center justify-center rounded text-black/45 hover:bg-black/[.05] disabled:opacity-30"><ArrowUp size={14} aria-hidden="true" /></button>
                <button type="button" onClick={() => mover(indice, 1)} disabled={indice === campos.length - 1 || salvando} aria-label="Descer o campo" className="flex h-8 w-8 items-center justify-center rounded text-black/45 hover:bg-black/[.05] disabled:opacity-30"><ArrowDown size={14} aria-hidden="true" /></button>
                <button type="button" onClick={() => setCampos(atual => atual.filter((_, i) => i !== indice))} disabled={salvando} aria-label="Tirar o campo" className="ml-auto flex h-8 w-8 items-center justify-center rounded text-black/35 hover:bg-black/[.05] hover:text-[#B23B3B]"><Trash2 size={14} aria-hidden="true" /></button>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" onClick={acrescentar} disabled={salvando || campos.length >= 80} className="inline-flex h-10 items-center gap-1.5 rounded border border-black/[.12] px-3.5 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50"><Plus size={13} aria-hidden="true" /> Acrescentar campo</button>
      </div>
    </TopSheet>
  );
}

/** Os modelos de acerto técnico da organização (PD4.1): campos com seção, tipo, destino e o que a casa vê. */
export function ModelosDeAcerto({ organizationId, podeEditar }: { organizationId: string; podeEditar: boolean }) {
  const [modelos, setModelos] = useState<Modelo[] | null>(null);
  const [folha, setFolha] = useState<{ modelo?: Modelo } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_modelos_acerto").select("id, nome, lado, campos").eq("organization_id", organizationId).order("nome");
      if (!ativo) return;
      setModelos((data ?? []).map(item => ({ id: item.id, nome: item.nome, lado: item.lado, campos: camposDoJson(item.campos) })));
      setErro(error ? "Não foi possível carregar os modelos. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  async function criarPadrao() {
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_modelos_acerto").insert({ organization_id: organizationId, nome: MODELO_PADRAO.nome, lado: MODELO_PADRAO.lado, campos: MODELO_PADRAO.campos });
    if (error) { setErro(error.code === "23505" ? "O modelo padrão já existe. Edite o que você já tem." : error.code === "42501" ? "Você não pode criar modelos." : "Não foi possível criar o modelo. Tente de novo."); return; }
    setVersao(atual => atual + 1);
  }

  return (
    <section aria-labelledby="modelos-de-acerto">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="modelos-de-acerto" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Modelos de acerto técnico</h2>
        {podeEditar && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void criarPadrao()} className="inline-flex h-10 items-center gap-1.5 rounded border border-black/[.12] px-3.5 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Criar o modelo padrão</button>
            <PrimaryListAction onClick={() => setFolha({})}><Plus size={13} aria-hidden="true" /> Novo modelo</PrimaryListAction>
          </div>
        )}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {modelos === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : modelos.length === 0 ? (
        <p className="rounded border bg-white px-4 py-5 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Um modelo é a lista de perguntas que a casa responde: boca de cena, canais da mesa, energia, carga e descarga, horários. Comece pelo modelo padrão e ajuste.</p>
      ) : (
        <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {modelos.map(modelo => (
            <li key={modelo.id}>
              <button type="button" disabled={!podeEditar} onClick={() => setFolha({ modelo })} className="flex w-full flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-3 text-left transition enabled:hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                <span className="min-w-0 flex-1 basis-56 truncate text-[0.8125rem] font-medium text-[#282525]">{modelo.nome}</span>
                <span className="text-[0.6875rem] text-black/45">{ROTULO_DO_LADO[modelo.lado]} · {modelo.campos.length} {modelo.campos.length === 1 ? "campo" : "campos"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {folha && <ModeloSheet organizationId={organizationId} modelo={folha.modelo} onClose={() => setFolha(null)} onSaved={() => setVersao(atual => atual + 1)} />}
    </section>
  );
}

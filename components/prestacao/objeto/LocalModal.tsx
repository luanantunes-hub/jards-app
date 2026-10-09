"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { MunicipioCombobox, type MunicipioEscolhido } from "@/components/prestacao/objeto/MunicipioCombobox";
import { ehBrasil, erroDoLocal, LIMITE_JUSTIFICATIVA_LOCAL, STATUS_LOCAL, UFS, type StatusLocal } from "@/lib/prestacao/objeto";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoLocal } from "@/lib/supabase/types";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";

/** Cria ou edita um local de realização: onde, quando e a situação, como o Salic pede. */
export function LocalModal({ prestacaoId, local, onClose, onSaved }: {
  prestacaoId: string;
  local: PrestacaoLocal | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [pais, setPais] = useState(local?.pais ?? "Brasil");
  const [uf, setUf] = useState(local?.uf ?? "");
  const [municipio, setMunicipio] = useState<MunicipioEscolhido>({
    nome: local?.municipio ?? "",
    ibge: local?.municipio_ibge ?? null,
    latitude: local?.latitude === null || local?.latitude === undefined ? null : Number(local.latitude),
    longitude: local?.longitude === null || local?.longitude === undefined ? null : Number(local.longitude),
  });
  const [espaco, setEspaco] = useState(local?.espaco ?? "");
  const [inicio, setInicio] = useState(local?.inicio ?? "");
  const [fim, setFim] = useState(local?.fim ?? "");
  const [status, setStatus] = useState<StatusLocal>(local?.status ?? "previsto");
  const [justificativa, setJustificativa] = useState(local?.justificativa ?? "");
  // Núcleo (LIE, aba GRADE): endereço, responsável e telefone. "Mais detalhes" abre quando há algo preenchido.
  const [endereco, setEndereco] = useState(local?.endereco ?? "");
  const [responsavel, setResponsavel] = useState(local?.responsavel ?? "");
  const [telefone, setTelefone] = useState(local?.telefone ?? "");
  const [maisDetalhes, setMaisDetalhes] = useState(Boolean(local?.endereco || local?.responsavel || local?.telefone));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const brasil = ehBrasil(pais);
  const pede = STATUS_LOCAL.find(s => s.id === status)?.pedeJustificativa ?? false;
  const mostrarJustificativa = pede || justificativa.trim().length > 0;

  async function salvar() {
    const campos = {
      pais: pais.trim() || "Brasil",
      uf: brasil ? uf || null : null,
      municipio: municipio.nome.trim() || null,
      espaco: espaco.trim() || null,
      inicio: inicio || null,
      fim: fim || null,
      status,
      justificativa: justificativa.trim() || null,
    };
    const problema = erroDoLocal(campos);
    const doNucleo = { endereco: endereco.trim() || null, responsavel: responsavel.trim() || null, telefone: telefone.trim() || null };
    if (problema) { setErro(problema); return; }
    // Código e coordenadas só valem para o município escolhido da lista, no Brasil.
    const doIbge = brasil && municipio.ibge
      ? { municipio_ibge: municipio.ibge, latitude: municipio.latitude, longitude: municipio.longitude }
      : { municipio_ibge: null, latitude: null, longitude: null };
    setSalvando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do objeto ainda não estão no tipo Database
    const tabela = (supabase as any).from("prestacao_locais");
    const { error } = local
      ? await tabela.update({ ...campos, ...doIbge, ...doNucleo }).eq("id", local.id)
      : await tabela.insert({ ...campos, ...doIbge, ...doNucleo, prestacao_id: prestacaoId });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível salvar o local")); return; }
    onSaved();
  }

  return (
    <ModalPrestacao
      titulo={local ? "Editar local" : "Novo local de realização"}
      subtitulo="Onde o projeto acontece e se aconteceu"
      onClose={onClose}
      largura="max-w-[34rem]"
      rodape={<>
        <span />
        <div className="flex items-center gap-4">
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
            {local ? "Salvar" : "Criar local"}
          </button>
        </div>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        {brasil && (
          <label>
            <span className={ROTULO}>UF</span>
            <Dropdown
              value={uf}
              onChange={valor => { if (valor !== uf) setMunicipio({ nome: "", ibge: null, latitude: null, longitude: null }); setUf(valor); }}
              ariaLabel="UF"
              placeholder="Escolha a UF"
              options={UFS.map(([sigla, nome]) => ({ value: sigla, label: `${sigla} · ${nome}` }))}
            />
          </label>
        )}
        {brasil ? (
          <div>
            <span className={ROTULO}>Município</span>
            <MunicipioCombobox uf={uf} valor={municipio} onChange={setMunicipio} />
          </div>
        ) : (
          <label className="sm:col-span-2">
            <span className={ROTULO}>Cidade</span>
            <input value={municipio.nome} onChange={e => setMunicipio({ nome: e.target.value, ibge: null, latitude: null, longitude: null })} maxLength={120} placeholder="Buenos Aires" className={CAMPO} />
          </label>
        )}
        <label className="sm:col-span-2">
          <span className={ROTULO}>Espaço (opcional)</span>
          <input value={espaco} onChange={e => setEspaco(e.target.value)} maxLength={200} placeholder="Ex.: Teatro Municipal, escolas da rede estadual" className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Início</span>
          <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Fim</span>
          <input type="date" value={fim} onChange={e => setFim(e.target.value)} min={inicio || undefined} className={CAMPO} />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className={ROTULO}>Situação</legend>
          <div role="radiogroup" aria-label="Situação do local" className="grid grid-cols-2 gap-2">
            {STATUS_LOCAL.map(s => {
              const ativo = status === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => { setStatus(s.id); setErro(""); }}
                  className={`min-h-10 rounded border bg-white px-3 py-2 text-left text-[0.75rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${ativo ? "" : "border-black/[.1] text-black/50 hover:bg-black/[.03]"}`}
                  style={ativo ? { borderColor: s.cor, color: s.cor } : undefined}
                >
                  {s.rotulo}
                </button>
              );
            })}
          </div>
        </fieldset>
        {mostrarJustificativa && (
          <label className="sm:col-span-2">
            <span className={ROTULO}>Justificativa{pede ? "" : " (opcional)"}</span>
            <textarea
              value={justificativa}
              onChange={e => { setJustificativa(e.target.value); setErro(""); }}
              rows={3}
              maxLength={LIMITE_JUSTIFICATIVA_LOCAL}
              placeholder={status === "outras_fontes" ? "Quem pagou e como" : "Por que não aconteceu"}
              className="w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10"
            />
            <span className="mt-1 block text-right text-[0.625rem] tabular-nums text-black/35">{justificativa.length}/{LIMITE_JUSTIFICATIVA_LOCAL} · limite do Salic</span>
          </label>
        )}
        <div className="border-t pt-3 sm:col-span-2" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <button type="button" onClick={() => setMaisDetalhes(aberto => !aberto)} aria-expanded={maisDetalhes}
            className="-ml-1 inline-flex min-h-9 items-center gap-1.5 rounded px-1 text-[0.75rem] font-medium text-black/55 transition hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
            <ChevronDown size={13} aria-hidden className={`transition-transform duration-200 motion-reduce:transition-none ${maisDetalhes ? "rotate-180" : ""}`} />
            Mais detalhes
          </button>
          {maisDetalhes && (
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={ROTULO}>Endereço</span>
                <input value={endereco} onChange={e => setEndereco(e.target.value)} maxLength={300} placeholder="Rua, número, bairro" className={CAMPO} />
              </label>
              <label>
                <span className={ROTULO}>Responsável no local</span>
                <input value={responsavel} onChange={e => setResponsavel(e.target.value)} maxLength={200} placeholder="Quem coordena o projeto ali" className={CAMPO} />
              </label>
              <label>
                <span className={ROTULO}>Telefone</span>
                <input value={telefone} onChange={e => setTelefone(e.target.value)} maxLength={40} inputMode="tel" placeholder="(00) 0000-0000" className={CAMPO} />
              </label>
              <p className="text-[0.625rem] text-black/40 sm:col-span-2">Na Lei de Incentivo ao Esporte, o local é o núcleo da grade de atividades.</p>
            </div>
          )}
        </div>
        <details className="sm:col-span-2" open={!brasil}>
          <summary className="cursor-pointer text-[0.6875rem] text-black/45 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Fora do Brasil</summary>
          <label className="mt-2 block">
            <span className={ROTULO}>País</span>
            <input value={pais} onChange={e => setPais(e.target.value)} maxLength={80} placeholder="Brasil" className={CAMPO} />
          </label>
        </details>
        {erro && <p role="alert" className="text-[0.75rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}

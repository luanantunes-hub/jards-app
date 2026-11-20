"use client";

import { useEffect, useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { SITUACOES_DA_LICENCA, TIPOS_DE_LICENCA } from "@/lib/producao/estados";
import {
  avisosDaLicenca, lerLicenca, prazoDaLicenca, resumoDasLicencas, ROTULO_DA_SITUACAO_DA_LICENCA, ROTULO_DO_TIPO_DE_LICENCA, textoDoPrazo, type LicencaDaData,
} from "@/lib/producao/licencas";
import { diaEMes } from "@/lib/producao/agenda";

type PessoaOpcao = { id: string; nome: string };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

function LicencaSheet({ organizationId, dataId, pessoas, licenca, onClose, onSaved }: {
  organizationId: string; dataId: string; pessoas: PessoaOpcao[]; licenca?: LicencaDaData; onClose: () => void; onSaved: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [tipo, setTipo] = useState<string>(licenca?.tipo ?? "alvara");
  const [situacao, setSituacao] = useState<string>(licenca?.situacao ?? "a_pedir");
  const [responsavelId, setResponsavelId] = useState(licenca?.responsavel_pessoa_id ?? "");
  const [diasAntes, setDiasAntes] = useState(licenca?.prazo_dias == null ? "" : String(Math.abs(licenca.prazo_dias)));
  const [validade, setValidade] = useState(licenca?.validade ?? "");
  const [protocolo, setProtocolo] = useState(licenca?.protocolo ?? "");
  const [notas, setNotas] = useState(licenca?.notas ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Prazo depois da data (dias positivos) só vem do banco; a folha edita "dias antes".
  const depois = licenca?.prazo_dias != null && licenca.prazo_dias > 0;

  async function salvar(fechar: () => void) {
    const leitura = lerLicenca({ tipo, situacao, responsavelId, diasAntes, validade, protocolo, notas });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    if (depois && licenca) leitura.licenca.prazo_dias = licenca.prazo_dias; // o prazo depois da data não é editado aqui
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = licenca
      ? await producao.from("producao_licencas").update(leitura.licenca).eq("id", licenca.id)
      : await producao.from("producao_licencas").insert({ organization_id: organizationId, data_id: dataId, ...leitura.licenca });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode mudar as licenças desta data." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!licenca) return;
    confirmDelete({
      title: "Apagar licença?",
      description: `${ROTULO_DO_TIPO_DE_LICENCA[licenca.tipo]} e a tarefa dela saem desta data.`,
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_licencas").delete().eq("id", licenca.id);
        if (error) throw new Error("Não foi possível apagar a licença.");
        onSaved();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={licenca ? "Editar licença" : "Nova licença"}
      onClose={onClose}
      footer={fechar => (
        <>
          {licenca && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : licenca ? "Salvar" : "Criar licença"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div><span className={ROTULO}>Licença</span><Dropdown ariaLabel="Tipo da licença" value={tipo} onChange={setTipo} disabled={salvando} options={TIPOS_DE_LICENCA.map(valor => ({ value: valor, label: ROTULO_DO_TIPO_DE_LICENCA[valor] }))} /></div>
          <div><span className={ROTULO}>Situação</span><Dropdown ariaLabel="Situação da licença" value={situacao} onChange={setSituacao} disabled={salvando} options={SITUACOES_DA_LICENCA.map(valor => ({ value: valor, label: ROTULO_DA_SITUACAO_DA_LICENCA[valor] }))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={ROTULO}>Quem cuida (opcional)</span>
            <Dropdown ariaLabel="Responsável pela licença" value={responsavelId} onChange={setResponsavelId} disabled={salvando} options={[{ value: "", label: "Ninguém ainda" }, ...pessoas.map(pessoa => ({ value: pessoa.id, label: pessoa.nome }))]} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="lic-dias">Pedir até (dias antes da data)</label>
            <input id="lic-dias" inputMode="numeric" className={CAMPO} value={diasAntes} onChange={event => setDiasAntes(event.target.value)} placeholder="30" disabled={salvando || depois} />
            {depois && <p className="mt-1 text-[0.6875rem] text-black/45">O prazo desta licença é depois da data e fica como está.</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={ROTULO} htmlFor="lic-protocolo">Protocolo (opcional)</label><input id="lic-protocolo" className={CAMPO} value={protocolo} onChange={event => setProtocolo(event.target.value)} maxLength={100} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="lic-validade">Vale até (opcional)</label><input id="lic-validade" type="date" className={CAMPO} value={validade} onChange={event => setValidade(event.target.value)} disabled={salvando} /></div>
        </div>
        <div><label className={ROTULO} htmlFor="lic-notas">Notas (opcional)</label><textarea id="lic-notas" rows={2} className="w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50" value={notas} onChange={event => setNotas(event.target.value)} maxLength={500} disabled={salvando} /></div>
      </div>
    </TopSheet>
  );
}

/** As licenças e liberações da data (PD4.9): alvará, AVCB, ECAD, SBAT, Juizado de Menores, via pública, filmagem. */
export function LicencasDaData({ organizationId, dataId, dataDoEvento, podeEditar }: { organizationId: string; dataId: string; dataDoEvento: string; podeEditar: boolean }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [licencas, setLicencas] = useState<LicencaDaData[] | null>(null);
  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [folha, setFolha] = useState<{ licenca?: LicencaDaData } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [lic, pes] = await Promise.all([
        producao.from("producao_licencas").select("id, tipo, situacao, responsavel_pessoa_id, prazo_dias, validade, protocolo, notas").eq("data_id", dataId).order("created_at"),
        producao.from("producao_pessoas").select("id, nome").eq("organization_id", organizationId).eq("arquivada", false).order("nome"),
      ]);
      if (!ativo) return;
      setLicencas((lic.data ?? []) as LicencaDaData[]);
      setPessoas((pes.data ?? []) as PessoaOpcao[]);
      setErro(lic.error ? "Não foi possível carregar as licenças. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [dataId, organizationId, versao]);

  const nomeDe = (id: string | null) => pessoas.find(pessoa => pessoa.id === id)?.nome ?? null;

  return (
    <section aria-labelledby="licencas-da-data" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="licencas-da-data" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Licenças e liberações</h2>
          {licencas !== null && licencas.length > 0 && <p className="mt-1 text-[0.6875rem] text-black/45">{resumoDasLicencas(licencas)}</p>}
        </div>
        {podeEditar && <PrimaryListAction onClick={() => setFolha({})}><Plus size={13} aria-hidden="true" /> Nova licença</PrimaryListAction>}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {licencas === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : licencas.length === 0 ? (
        <p className="rounded border bg-white px-4 py-5 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Alvará, bombeiros, ECAD, SBAT, Juizado de Menores, via pública, filmagem: cadastre o que esta data exige. Cada licença em aberto vira uma tarefa com prazo.</p>
      ) : (
        <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {licencas.map(licenca => {
            const prazo = prazoDaLicenca(dataDoEvento, licenca.prazo_dias);
            const avisos = avisosDaLicenca(licenca, dataDoEvento, hoje);
            return (
              <li key={licenca.id}>
                <button type="button" disabled={!podeEditar} onClick={() => setFolha({ licenca })} className="flex w-full flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-2.5 text-left transition enabled:hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  <span className="min-w-0 flex-1 basis-48">
                    <span className="block truncate text-[0.8125rem] font-medium text-[#282525]">{ROTULO_DO_TIPO_DE_LICENCA[licenca.tipo]}</span>
                    <span className="block truncate text-[0.6875rem] text-black/45">
                      {[nomeDe(licenca.responsavel_pessoa_id), prazo ? `pedir até ${diaEMes(prazo)} (${textoDoPrazo(licenca.prazo_dias)})` : null, licenca.protocolo ? `protocolo ${licenca.protocolo}` : null, licenca.validade ? `vale até ${diaEMes(licenca.validade)}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="w-24 text-right text-[0.6875rem] font-medium text-black/55">{ROTULO_DA_SITUACAO_DA_LICENCA[licenca.situacao]}</span>
                </button>
                {avisos.map(aviso => <p key={aviso} className="flex items-center gap-2 px-4 pb-2.5 text-[0.6875rem] text-[#B07A14]"><TriangleAlert size={12} aria-hidden="true" /> {aviso}</p>)}
              </li>
            );
          })}
        </ul>
      )}
      {folha && <LicencaSheet organizationId={organizationId} dataId={dataId} pessoas={pessoas} licenca={folha.licenca} onClose={() => setFolha(null)} onSaved={() => setVersao(atual => atual + 1)} />}
    </section>
  );
}

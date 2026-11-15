"use client";

import { useEffect, useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { carregarMunicipios, MunicipioCombobox, type MunicipioEscolhido } from "@/components/prestacao/objeto/MunicipioCombobox";
import { lerEspaco, lerSala, TIPOS_DE_ESPACO_SUGERIDOS, UFS } from "@/lib/producao/espacos";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

export type EspacoEditavel = {
  id: string; nome: string; tipo: string; proprio: boolean; movel: boolean; endereco: string | null; uf: string | null; capacidade: number | null; arquivado: boolean;
  municipio_ibge: string | null; latitude: number | null; longitude: number | null;
};
export type SalaEditavel = { id: string; espaco_id: string; nome: string; capacidade: number | null; arquivada: boolean };

function Rodape({ fechar, salvando, rotulo, onSalvar }: { fechar: () => void; salvando: boolean; rotulo: string; onSalvar: () => void }) {
  return (
    <>
      <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
      <button type="button" onClick={onSalvar} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : rotulo}</button>
    </>
  );
}

function Erro({ texto }: { texto: string | null }) {
  return texto ? <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{texto}</p> : null;
}

/** Cadastro e edição de um espaço (teatro, casa de show, praça, lona de circo…). */
export function EspacoSheet({ organizationId, espaco, onClose, onSaved }: { organizationId: string; espaco?: EspacoEditavel; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(espaco?.nome ?? "");
  const [tipo, setTipo] = useState(espaco?.tipo ?? "Teatro");
  const [endereco, setEndereco] = useState(espaco?.endereco ?? "");
  const [uf, setUf] = useState(espaco?.uf ?? "");
  const [capacidade, setCapacidade] = useState(espaco?.capacidade?.toString() ?? "");
  const [municipio, setMunicipio] = useState<MunicipioEscolhido>({ nome: "", ibge: espaco?.municipio_ibge ?? null, latitude: espaco?.latitude ?? null, longitude: espaco?.longitude ?? null });
  const [proprio, setProprio] = useState(espaco?.proprio ?? false);
  const [movel, setMovel] = useState(espaco?.movel ?? false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O espaço guarda o código do município; o nome vem da tabela do IBGE.
  useEffect(() => {
    const codigo = espaco?.municipio_ibge;
    if (!codigo) return;
    let ativo = true;
    carregarMunicipios().then(tabela => {
      const achado = tabela.municipios.find(item => item[0] === codigo);
      if (ativo && achado) setMunicipio(atual => (atual.nome === "" ? { ...atual, nome: achado[1] } : atual));
    }).catch(() => undefined);
    return () => { ativo = false; };
  }, [espaco?.municipio_ibge]);

  async function salvar(fechar: () => void, arquivado = espaco?.arquivado ?? false) {
    const leitura = lerEspaco({ nome, tipo, proprio, movel, endereco, uf, capacidade });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const comMunicipio = leitura.espaco.uf !== null && municipio.ibge !== null;
    const dados = {
      ...leitura.espaco, arquivado,
      municipio_ibge: comMunicipio ? municipio.ibge : null,
      latitude: comMunicipio ? municipio.latitude : null,
      longitude: comMunicipio ? municipio.longitude : null,
    };
    const { error } = espaco
      ? await producao.from("producao_espacos").update(dados).eq("id", espaco.id)
      : await producao.from("producao_espacos").insert({ organization_id: organizationId, ...dados });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode salvar espaços aqui." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  return (
    <TopSheet
      titulo={espaco ? "Editar espaço" : "Novo espaço"}
      onClose={onClose}
      footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo={espaco ? "Salvar" : "Criar espaço"} onSalvar={() => void salvar(fechar)} />}
    >
      <div className="space-y-4">
        <Erro texto={erro} />
        <div>
          <label className={ROTULO} htmlFor="espaco-nome">Nome</label>
          <input id="espaco-nome" autoFocus className={CAMPO} value={nome} onChange={event => setNome(event.target.value)} placeholder="Teatro Municipal" maxLength={200} disabled={salvando} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO} htmlFor="espaco-tipo">Tipo</label>
            <input id="espaco-tipo" list="tipos-de-espaco" className={CAMPO} value={tipo} onChange={event => setTipo(event.target.value)} maxLength={40} disabled={salvando} />
            <datalist id="tipos-de-espaco">{TIPOS_DE_ESPACO_SUGERIDOS.map(item => <option key={item} value={item} />)}</datalist>
          </div>
          <div>
            <label className={ROTULO} htmlFor="espaco-capacidade">Capacidade</label>
            <input id="espaco-capacidade" inputMode="numeric" className={CAMPO} value={capacidade} onChange={event => setCapacidade(event.target.value)} placeholder="450" disabled={salvando} />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div>
            <label className={ROTULO} htmlFor="espaco-endereco">Endereço</label>
            <input id="espaco-endereco" className={CAMPO} value={endereco} onChange={event => setEndereco(event.target.value)} maxLength={300} disabled={salvando} />
          </div>
          <div>
            <span className={ROTULO}>Estado</span>
            <Dropdown value={uf} onChange={valor => { setUf(valor); setMunicipio({ nome: "", ibge: null, latitude: null, longitude: null }); }} options={[{ value: "", label: "—" }, ...UFS.map(sigla => ({ value: sigla, label: sigla }))]} />
          </div>
        </div>
        {uf !== "" && (
          <div>
            <label className={ROTULO} htmlFor="espaco-municipio">Município</label>
            <MunicipioCombobox id="espaco-municipio" uf={uf} valor={municipio} onChange={setMunicipio} />
          </div>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-[0.8125rem] text-[#282525]"><input type="checkbox" checked={proprio} onChange={event => setProprio(event.target.checked)} disabled={salvando} className="h-4 w-4 accent-[#7259B5]" /> É nosso (a organização administra)</label>
          <label className="flex items-center gap-2 text-[0.8125rem] text-[#282525]"><input type="checkbox" checked={movel} onChange={event => setMovel(event.target.checked)} disabled={salvando} className="h-4 w-4 accent-[#7259B5]" /> Móvel (lona, palco itinerante)</label>
        </div>
        {espaco && (
          <button type="button" disabled={salvando} onClick={() => void salvar(() => undefined, !espaco.arquivado).then(onClose)} className="text-[0.75rem] font-medium text-black/55 underline underline-offset-2 hover:text-black/75 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            {espaco.arquivado ? "Desarquivar este espaço" : "Arquivar este espaço"}
          </button>
        )}
      </div>
    </TopSheet>
  );
}

/** Cadastro e edição de uma sala de um espaço. */
export function SalaSheet({ organizationId, espacoId, sala, onClose, onSaved }: { organizationId: string; espacoId: string; sala?: SalaEditavel; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(sala?.nome ?? "");
  const [capacidade, setCapacidade] = useState(sala?.capacidade?.toString() ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void, arquivada = sala?.arquivada ?? false) {
    const leitura = lerSala({ nome, capacidade });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const dados = { ...leitura.sala, arquivada };
    const { error } = sala
      ? await producao.from("producao_salas").update(dados).eq("id", sala.id)
      : await producao.from("producao_salas").insert({ organization_id: organizationId, espaco_id: espacoId, ...dados });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode salvar salas aqui." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  return (
    <TopSheet
      titulo={sala ? "Editar sala" : "Nova sala"}
      onClose={onClose}
      footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo={sala ? "Salvar" : "Criar sala"} onSalvar={() => void salvar(fechar)} />}
    >
      <div className="space-y-4">
        <Erro texto={erro} />
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div>
            <label className={ROTULO} htmlFor="sala-nome">Nome</label>
            <input id="sala-nome" autoFocus className={CAMPO} value={nome} onChange={event => setNome(event.target.value)} placeholder="Sala Principal" maxLength={200} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="sala-capacidade">Capacidade</label>
            <input id="sala-capacidade" inputMode="numeric" className={CAMPO} value={capacidade} onChange={event => setCapacidade(event.target.value)} disabled={salvando} />
          </div>
        </div>
        {sala && (
          <button type="button" disabled={salvando} onClick={() => void salvar(() => undefined, !sala.arquivada).then(onClose)} className="text-[0.75rem] font-medium text-black/55 underline underline-offset-2 hover:text-black/75 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            {sala.arquivada ? "Desarquivar esta sala" : "Arquivar esta sala"}
          </button>
        )}
      </div>
    </TopSheet>
  );
}

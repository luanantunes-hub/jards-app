"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { lerFichaDaSala, lerFichaDoEspaco, type FichaDaSala, type FichaDoEspaco } from "@/lib/producao/ficha";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const AREA = "w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const MINI = "mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const emTexto = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

function Rodape({ fechar, salvando, onSalvar }: { fechar: () => void; salvando: boolean; onSalvar: () => void }) {
  return (
    <>
      <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
      <button type="button" onClick={onSalvar} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : "Salvar"}</button>
    </>
  );
}

function Erro({ texto }: { texto: string | null }) {
  return texto ? <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{texto}</p> : null;
}

/** A ficha do espaço: funcionamento, acessibilidade, carga e descarga e o contato de quem cuida. */
export function FichaDoEspacoSheet({ organizationId, espacoId, ficha, onClose, onSaved }: { organizationId: string; espacoId: string; ficha: Partial<FichaDoEspaco> | null; onClose: () => void; onSaved: () => void }) {
  const [funcionamento, setFuncionamento] = useState(ficha?.funcionamento ?? "");
  const [acessibilidade, setAcessibilidade] = useState(ficha?.acessibilidade ?? "");
  const [cargaDescarga, setCargaDescarga] = useState(ficha?.carga_descarga ?? "");
  const [docaAltura, setDocaAltura] = useState(emTexto(ficha?.doca_altura_m));
  const [veiculoMax, setVeiculoMax] = useState(emTexto(ficha?.veiculo_max_m));
  const [contatoNome, setContatoNome] = useState(ficha?.contato_nome ?? "");
  const [contatoTelefone, setContatoTelefone] = useState(ficha?.contato_telefone ?? "");
  const [contatoEmail, setContatoEmail] = useState(ficha?.contato_email ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerFichaDoEspaco({ funcionamento, acessibilidade, cargaDescarga, docaAltura, veiculoMax, contatoNome, contatoTelefone, contatoEmail });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_espaco_fichas").upsert({ espaco_id: espacoId, organization_id: organizationId, ...leitura.ficha }, { onConflict: "espaco_id" });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode mudar a ficha deste espaço." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  return (
    <TopSheet titulo="Ficha do espaço" onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={salvando} onSalvar={() => void salvar(fechar)} />}>
      <div className="space-y-4">
        <Erro texto={erro} />
        <div><label className={ROTULO} htmlFor="esp-func">Funcionamento (dias e horários)</label><textarea id="esp-func" rows={2} className={AREA} value={funcionamento} onChange={event => setFuncionamento(event.target.value)} maxLength={2000} disabled={salvando} /></div>
        <div><label className={ROTULO} htmlFor="esp-acess">Acessibilidade</label><textarea id="esp-acess" rows={2} className={AREA} value={acessibilidade} onChange={event => setAcessibilidade(event.target.value)} maxLength={2000} disabled={salvando} placeholder="Rampa, banheiro adaptado, lugares reservados…" /></div>
        <div><label className={ROTULO} htmlFor="esp-carga">Carga e descarga</label><textarea id="esp-carga" rows={2} className={AREA} value={cargaDescarga} onChange={event => setCargaDescarga(event.target.value)} maxLength={2000} disabled={salvando} placeholder="Onde o caminhão para, por qual porta entra o equipamento…" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={ROTULO} htmlFor="esp-doca">Altura da doca (m)</label><input id="esp-doca" inputMode="decimal" className={CAMPO} value={docaAltura} onChange={event => setDocaAltura(event.target.value)} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="esp-veiculo">Veículo máximo (m de comprimento)</label><input id="esp-veiculo" inputMode="decimal" className={CAMPO} value={veiculoMax} onChange={event => setVeiculoMax(event.target.value)} disabled={salvando} /></div>
        </div>
        <div>
          <p className={MINI}>Contato de quem cuida do espaço</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className={ROTULO} htmlFor="esp-cn">Nome</label><input id="esp-cn" className={CAMPO} value={contatoNome} onChange={event => setContatoNome(event.target.value)} maxLength={200} disabled={salvando} /></div>
            <div><label className={ROTULO} htmlFor="esp-ct">Telefone</label><input id="esp-ct" inputMode="tel" className={CAMPO} value={contatoTelefone} onChange={event => setContatoTelefone(event.target.value)} maxLength={40} disabled={salvando} /></div>
            <div><label className={ROTULO} htmlFor="esp-ce">E-mail</label><input id="esp-ce" inputMode="email" className={CAMPO} value={contatoEmail} onChange={event => setContatoEmail(event.target.value)} maxLength={254} disabled={salvando} /></div>
          </div>
        </div>
      </div>
    </TopSheet>
  );
}

/** A ficha técnica da sala: palco, som, luz, energia e camarins, com as medidas em número. */
export function FichaDaSalaSheet({ organizationId, salaId, nomeDaSala, ficha, onClose, onSaved }: { organizationId: string; salaId: string; nomeDaSala: string; ficha: Partial<FichaDaSala> | null; onClose: () => void; onSaved: () => void }) {
  const [palcoBoca, setPalcoBoca] = useState(emTexto(ficha?.palco_boca_m));
  const [palcoProfundidade, setPalcoProfundidade] = useState(emTexto(ficha?.palco_profundidade_m));
  const [palcoAltura, setPalcoAltura] = useState(emTexto(ficha?.palco_altura_m));
  const [palcoPiso, setPalcoPiso] = useState(ficha?.palco_piso ?? "");
  const [somSistema, setSomSistema] = useState(ficha?.som_sistema ?? "");
  const [somCanais, setSomCanais] = useState(emTexto(ficha?.som_canais_entrada));
  const [luzDescricao, setLuzDescricao] = useState(ficha?.luz_descricao ?? "");
  const [luzRefletores, setLuzRefletores] = useState(emTexto(ficha?.luz_refletores));
  const [energiaKva, setEnergiaKva] = useState(emTexto(ficha?.energia_kva));
  const [energiaTensao, setEnergiaTensao] = useState(emTexto(ficha?.energia_tensao_v));
  const [energiaFases, setEnergiaFases] = useState(emTexto(ficha?.energia_fases));
  const [camarinsQuantidade, setCamarinsQuantidade] = useState(emTexto(ficha?.camarins_quantidade));
  const [camarinsCapacidade, setCamarinsCapacidade] = useState(emTexto(ficha?.camarins_capacidade));
  const [notas, setNotas] = useState(ficha?.notas ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerFichaDaSala({ palcoBoca, palcoProfundidade, palcoAltura, palcoPiso, somSistema, somCanais, luzDescricao, luzRefletores, energiaKva, energiaTensao, energiaFases, camarinsQuantidade, camarinsCapacidade, notas });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_sala_fichas").upsert({ sala_id: salaId, organization_id: organizationId, ...leitura.ficha }, { onConflict: "sala_id" });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode mudar a ficha desta sala." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  const num = (id: string, rotulo: string, valor: string, mudar: (v: string) => void, modo: "numeric" | "decimal" = "decimal") => (
    <div><label className={ROTULO} htmlFor={id}>{rotulo}</label><input id={id} inputMode={modo} className={CAMPO} value={valor} onChange={event => mudar(event.target.value)} disabled={salvando} /></div>
  );

  return (
    <TopSheet titulo={`Ficha técnica · ${nomeDaSala}`} onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={salvando} onSalvar={() => void salvar(fechar)} />}>
      <div className="space-y-5">
        <Erro texto={erro} />
        <div>
          <p className={MINI}>Palco</p>
          <div className="grid grid-cols-3 gap-3">
            {num("sala-boca", "Boca de cena (m)", palcoBoca, setPalcoBoca)}
            {num("sala-prof", "Profundidade (m)", palcoProfundidade, setPalcoProfundidade)}
            {num("sala-alt", "Altura útil (m)", palcoAltura, setPalcoAltura)}
          </div>
          <div className="mt-3"><label className={ROTULO} htmlFor="sala-piso">Piso</label><input id="sala-piso" className={CAMPO} value={palcoPiso} onChange={event => setPalcoPiso(event.target.value)} maxLength={200} placeholder="Madeira, linóleo preto…" disabled={salvando} /></div>
        </div>
        <div>
          <p className={MINI}>Som</p>
          <div className="grid grid-cols-[1fr_9rem] gap-3">
            <div><label className={ROTULO} htmlFor="sala-som">Sistema</label><input id="sala-som" className={CAMPO} value={somSistema} onChange={event => setSomSistema(event.target.value)} maxLength={500} placeholder="Line array, mesa digital 32 canais…" disabled={salvando} /></div>
            {num("sala-canais", "Canais de entrada", somCanais, setSomCanais, "numeric")}
          </div>
        </div>
        <div>
          <p className={MINI}>Luz</p>
          <div className="grid grid-cols-[1fr_9rem] gap-3">
            <div><label className={ROTULO} htmlFor="sala-luz">Descrição</label><input id="sala-luz" className={CAMPO} value={luzDescricao} onChange={event => setLuzDescricao(event.target.value)} maxLength={500} placeholder="Refletores de LED, mesa com 48 canais…" disabled={salvando} /></div>
            {num("sala-refletores", "Refletores", luzRefletores, setLuzRefletores, "numeric")}
          </div>
        </div>
        <div>
          <p className={MINI}>Energia</p>
          <div className="grid grid-cols-3 gap-3">
            {num("sala-kva", "Potência (kVA)", energiaKva, setEnergiaKva)}
            {num("sala-tensao", "Tensão (V)", energiaTensao, setEnergiaTensao, "numeric")}
            {num("sala-fases", "Fases (1 a 3)", energiaFases, setEnergiaFases, "numeric")}
          </div>
        </div>
        <div>
          <p className={MINI}>Camarins</p>
          <div className="grid grid-cols-2 gap-3">
            {num("sala-cam", "Quantidade", camarinsQuantidade, setCamarinsQuantidade, "numeric")}
            {num("sala-camcap", "Capacidade total (pessoas)", camarinsCapacidade, setCamarinsCapacidade, "numeric")}
          </div>
        </div>
        <div><label className={ROTULO} htmlFor="sala-notas">Notas</label><textarea id="sala-notas" rows={3} className={AREA} value={notas} onChange={event => setNotas(event.target.value)} maxLength={4000} disabled={salvando} /></div>
      </div>
    </TopSheet>
  );
}

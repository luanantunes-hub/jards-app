"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { lerHospedagem, lerQuarto, listaDeQuartos, periodoDaHospedagem, pessoasSemQuarto, vagasDoQuarto } from "@/lib/producao/hospedagem";

type Hospedagem = { id: string; hotel: string; endereco: string | null; entrada: string | null; saida: string | null; localizador: string | null; notas: string | null };
type Quarto = { id: string; hospedagem_id: string; nome: string; capacidade: number };
type Ocupante = { id: string; hospedagem_id: string; quarto_id: string; pessoa_id: string };
type Pessoa = { id: string; nome: string };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const BOTAO = "flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";

function HospedagemSheet({ organizationId, temporadaId, hospedagem, onClose, onSaved }: {
  organizationId: string; temporadaId: string; hospedagem: Hospedagem | null; onClose: () => void; onSaved: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [hotel, setHotel] = useState(hospedagem?.hotel ?? "");
  const [endereco, setEndereco] = useState(hospedagem?.endereco ?? "");
  const [entrada, setEntrada] = useState(hospedagem?.entrada ?? "");
  const [saida, setSaida] = useState(hospedagem?.saida ?? "");
  const [localizador, setLocalizador] = useState(hospedagem?.localizador ?? "");
  const [notas, setNotas] = useState(hospedagem?.notas ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerHospedagem({ hotel, endereco, entrada, saida, localizador, notas });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = hospedagem
      ? await producao.from("producao_hospedagens").update(leitura.hospedagem).eq("id", hospedagem.id)
      : await producao.from("producao_hospedagens").insert({ ...leitura.hospedagem, organization_id: organizationId, temporada_id: temporadaId });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode salvar hospedagens aqui." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!hospedagem) return;
    confirmDelete({
      title: "Apagar hospedagem?",
      description: `"${hospedagem.hotel}", os quartos e quem está neles saem da temporada.`,
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_hospedagens").delete().eq("id", hospedagem.id);
        if (error) throw new Error("Não foi possível apagar a hospedagem.");
        onSaved();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={hospedagem ? "Editar hospedagem" : "Nova hospedagem"}
      onClose={onClose}
      footer={fechar => (
        <>
          {hospedagem && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : hospedagem ? "Salvar" : "Criar hospedagem"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <label className={ROTULO} htmlFor="hosp-hotel">Hotel</label>
          <input id="hosp-hotel" autoFocus className={CAMPO} value={hotel} onChange={event => setHotel(event.target.value)} placeholder="Hotel Central" maxLength={200} disabled={salvando} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO} htmlFor="hosp-entrada">Entrada (opcional)</label>
            <input id="hosp-entrada" type="date" className={CAMPO} value={entrada} onChange={event => setEntrada(event.target.value)} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="hosp-saida">Saída (opcional)</label>
            <input id="hosp-saida" type="date" className={CAMPO} value={saida} onChange={event => setSaida(event.target.value)} disabled={salvando} />
          </div>
        </div>
        <div>
          <label className={ROTULO} htmlFor="hosp-endereco">Endereço (opcional)</label>
          <input id="hosp-endereco" className={CAMPO} value={endereco} onChange={event => setEndereco(event.target.value)} maxLength={300} disabled={salvando} />
        </div>
        <div>
          <label className={ROTULO} htmlFor="hosp-localizador">Localizador ou reserva (opcional)</label>
          <input id="hosp-localizador" className={CAMPO} value={localizador} onChange={event => setLocalizador(event.target.value)} maxLength={80} disabled={salvando} />
        </div>
        <div>
          <label className={ROTULO} htmlFor="hosp-notas">Notas (opcional)</label>
          <textarea id="hosp-notas" rows={3} className="w-full resize-none rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50" value={notas} onChange={event => setNotas(event.target.value)} maxLength={2000} disabled={salvando} />
        </div>
        <p className="text-[0.6875rem] text-black/40">Os quartos e quem dorme em cada um você monta depois de criar a hospedagem.</p>
      </div>
    </TopSheet>
  );
}

function CartaoDaHospedagem({ organizationId, hospedagem, quartos, ocupantes, pessoas, nomes, podeEditar, onEditar, onMudou }: {
  organizationId: string; hospedagem: Hospedagem; quartos: Quarto[]; ocupantes: Ocupante[]; pessoas: Pessoa[]; nomes: ReadonlyMap<string, string>;
  podeEditar: boolean; onEditar: () => void; onMudou: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [nomeNovo, setNomeNovo] = useState("");
  const [capacidadeNova, setCapacidadeNova] = useState("2");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const semQuarto = useMemo(() => pessoasSemQuarto(pessoas, ocupantes), [pessoas, ocupantes]);
  const periodo = periodoDaHospedagem(hospedagem.entrada, hospedagem.saida);

  async function executar(acao: () => PromiseLike<{ error: { code?: string } | null }>, mensagem: string) {
    setOcupado(true);
    setErro(null);
    const { error } = await acao();
    setOcupado(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode mudar a hospedagem." : mensagem); return false; }
    onMudou();
    return true;
  }

  async function novoQuarto() {
    const leitura = lerQuarto({ nome: nomeNovo, capacidade: capacidadeNova });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    const ok = await executar(() => clienteDaProducao(createClient()).from("producao_quartos").insert({ ...leitura.quarto, organization_id: organizationId, hospedagem_id: hospedagem.id }), "Não foi possível criar o quarto. Tente de novo.");
    if (ok) setNomeNovo("");
  }

  function apagarQuarto(quarto: Quarto) {
    confirmDelete({
      title: "Apagar quarto?",
      description: `O quarto ${quarto.nome} sai da hospedagem. Quem estava nele fica sem quarto.`,
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_quartos").delete().eq("id", quarto.id);
        if (error) throw new Error("Não foi possível apagar o quarto.");
        onMudou();
      },
    });
  }

  async function porPessoa(quarto: Quarto, pessoaId: string) {
    if (!pessoaId) return;
    await executar(() => clienteDaProducao(createClient()).from("producao_ocupantes").insert({ organization_id: organizationId, hospedagem_id: hospedagem.id, quarto_id: quarto.id, pessoa_id: pessoaId }),
      "Não foi possível pôr a pessoa no quarto. Veja se ainda há vaga.");
  }

  async function copiarLista() {
    try {
      await navigator.clipboard.writeText(listaDeQuartos(hospedagem, quartos, ocupantes, nomes));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro("Não foi possível copiar. Selecione e copie a lista à mão.");
    }
  }

  return (
    <div className="rounded border bg-white p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[0.875rem] font-semibold text-[#282525]">{hospedagem.hotel}</p>
          <p className="mt-0.5 text-[0.6875rem] text-black/45">{[periodo, hospedagem.endereco, hospedagem.localizador ? `localizador ${hospedagem.localizador}` : null].filter(Boolean).join(" · ") || "sem datas nem endereço"}</p>
          {hospedagem.notas && <p className="mt-1 text-[0.6875rem] text-black/45">{hospedagem.notas}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {quartos.length > 0 && <button type="button" onClick={() => void copiarLista()} className={BOTAO}><Copy size={13} aria-hidden="true" /> {copiado ? "Copiada" : "Copiar lista"}</button>}
          {podeEditar && <button type="button" onClick={onEditar} aria-label={`Editar ${hospedagem.hotel}`} title="Editar" className="flex h-10 w-10 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Pencil size={13} aria-hidden="true" /></button>}
        </div>
      </div>
      {erro && <p role="alert" className="mt-3 rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {quartos.length === 0 ? (
        <p className="mt-3 text-[0.75rem] text-black/45">Nenhum quarto ainda. {podeEditar ? "Crie os quartos e ponha quem dorme em cada um." : ""}</p>
      ) : (
        <ul className="mt-3 divide-y divide-black/[.06] rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {quartos.map(quarto => {
            const doQuarto = ocupantes.filter(ocupante => ocupante.quarto_id === quarto.id);
            const vagas = vagasDoQuarto(quarto, ocupantes);
            return (
              <li key={quarto.id} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.8125rem] font-medium text-[#282525]">Quarto {quarto.nome} <span className="font-normal text-black/45">· {quarto.capacidade} {quarto.capacidade === 1 ? "lugar" : "lugares"}{vagas > 0 ? `, ${vagas} ${vagas === 1 ? "vaga" : "vagas"}` : ", completo"}</span></p>
                  {podeEditar && <button type="button" onClick={() => apagarQuarto(quarto)} aria-label={`Apagar o quarto ${quarto.nome}`} title="Apagar quarto" className="flex h-10 w-10 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Trash2 size={13} aria-hidden="true" /></button>}
                </div>
                {doQuarto.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {doQuarto.map(ocupante => (
                      <li key={ocupante.id} className="flex items-center gap-1 rounded border bg-white py-1 pl-2.5 pr-1 text-[0.75rem] text-[#282525]" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                        {nomes.get(ocupante.pessoa_id) ?? "Pessoa"}
                        {podeEditar && <button type="button" disabled={ocupado} onClick={() => void executar(() => clienteDaProducao(createClient()).from("producao_ocupantes").delete().eq("id", ocupante.id), "Não foi possível tirar a pessoa do quarto.")} aria-label={`Tirar ${nomes.get(ocupante.pessoa_id) ?? "a pessoa"} do quarto`} title="Tirar do quarto" className="flex h-6 w-6 items-center justify-center rounded text-black/40 transition hover:bg-black/[.05] hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-50"><X size={12} aria-hidden="true" /></button>}
                      </li>
                    ))}
                  </ul>
                )}
                {podeEditar && vagas > 0 && semQuarto.length > 0 && (
                  <div className="mt-2 max-w-xs">
                    <Dropdown value="" onChange={valor => void porPessoa(quarto, valor)} options={[{ value: "", label: "Pôr uma pessoa neste quarto" }, ...semQuarto.map(pessoa => ({ value: pessoa.id, label: pessoa.nome }))]} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {quartos.length > 0 && semQuarto.length > 0 && <p className="mt-2 text-[0.6875rem] text-black/45">Sem quarto: {semQuarto.map(pessoa => pessoa.nome).join(", ")}.</p>}
      {podeEditar && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="w-40">
            <label className={ROTULO} htmlFor={`quarto-nome-${hospedagem.id}`}>Novo quarto</label>
            <input id={`quarto-nome-${hospedagem.id}`} className={CAMPO} value={nomeNovo} onChange={event => setNomeNovo(event.target.value)} placeholder="101" maxLength={100} disabled={ocupado} />
          </div>
          <div className="w-24">
            <label className={ROTULO} htmlFor={`quarto-capacidade-${hospedagem.id}`}>Lugares</label>
            <input id={`quarto-capacidade-${hospedagem.id}`} inputMode="numeric" className={CAMPO} value={capacidadeNova} onChange={event => setCapacidadeNova(event.target.value)} disabled={ocupado} />
          </div>
          <button type="button" onClick={() => void novoQuarto()} disabled={ocupado} className={BOTAO}><Plus size={13} aria-hidden="true" /> Adicionar quarto</button>
        </div>
      )}
    </div>
  );
}

/** A hospedagem da temporada (PD6.7): o hotel, os quartos e quem dorme em cada um, com a lista de quartos para mandar ao hotel. */
export function HospedagemDaTemporada({ organizationId, temporadaId, podeEditar }: { organizationId: string; temporadaId: string; podeEditar: boolean }) {
  const [hospedagens, setHospedagens] = useState<Hospedagem[] | null>(null);
  const [quartos, setQuartos] = useState<Quarto[]>([]);
  const [ocupantes, setOcupantes] = useState<Ocupante[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [folha, setFolha] = useState<{ hospedagem: Hospedagem | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const { data: hosp, error } = await producao.from("producao_hospedagens")
        .select("id, hotel, endereco, entrada, saida, localizador, notas").eq("temporada_id", temporadaId).order("entrada", { nullsFirst: false });
      if (!ativo) return;
      const ids = (hosp ?? []).map(item => item.id);
      const [qua, ocu, pes] = ids.length === 0
        ? [{ data: [] as Quarto[] }, { data: [] as Ocupante[] }, { data: [] as Pessoa[] }]
        : await Promise.all([
          producao.from("producao_quartos").select("id, hospedagem_id, nome, capacidade").in("hospedagem_id", ids).order("nome"),
          producao.from("producao_ocupantes").select("id, hospedagem_id, quarto_id, pessoa_id").in("hospedagem_id", ids),
          producao.from("producao_pessoas").select("id, nome").eq("organization_id", organizationId).eq("arquivada", false).order("nome"),
        ]);
      if (!ativo) return;
      setHospedagens(hosp ?? []);
      setQuartos(qua.data ?? []);
      setOcupantes(ocu.data ?? []);
      setPessoas(pes.data ?? []);
      setErro(error ? "Não foi possível carregar a hospedagem. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [temporadaId, organizationId, versao]);

  const nomes = useMemo(() => new Map(pessoas.map(pessoa => [pessoa.id, pessoa.nome])), [pessoas]);
  const recarregar = () => setVersao(atual => atual + 1);

  return (
    <section aria-labelledby="hospedagem" className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="hospedagem" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Hospedagem</h2>
        {podeEditar && <button type="button" onClick={() => setFolha({ hospedagem: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Nova hospedagem</button>}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {hospedagens === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : hospedagens.length === 0 ? (
        <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem] font-medium text-black/55">Nenhuma hospedagem nesta temporada</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Cadastre o hotel, crie os quartos e ponha quem dorme em cada um. A lista de quartos sai pronta para mandar ao hotel.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {hospedagens.map(hospedagem => (
            <CartaoDaHospedagem key={hospedagem.id} organizationId={organizationId} hospedagem={hospedagem} quartos={quartos.filter(quarto => quarto.hospedagem_id === hospedagem.id)}
              ocupantes={ocupantes.filter(ocupante => ocupante.hospedagem_id === hospedagem.id)} pessoas={pessoas} nomes={nomes} podeEditar={podeEditar}
              onEditar={() => setFolha({ hospedagem })} onMudou={recarregar} />
          ))}
        </div>
      )}
      {folha && <HospedagemSheet organizationId={organizationId} temporadaId={temporadaId} hospedagem={folha.hospedagem} onClose={() => setFolha(null)} onSaved={recarregar} />}
    </section>
  );
}

"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { movimentoDeQuarto, pessoasSemQuarto, vagasDoQuarto } from "@/lib/producao/hospedagem";

type Quarto = { id: string; nome: string; capacidade: number };
type Ocupante = { id: string; quarto_id: string; pessoa_id: string };
type Pessoa = { id: string; nome: string };

const BORDA = { borderColor: "rgba(13,13,13,.12)" };

/**
 * O mapa de quartos (PD6.8): as pessoas arrastadas para dentro dos quartos, ou tiradas para "Sem quarto". No celular, onde arrastar
 * não funciona bem, toca-se na pessoa e depois no quarto de destino. O banco confere a capacidade; aqui só se evita o pedido que
 * ele recusaria.
 */
export function MapaDeQuartos({ organizationId, hospedagemId, hotel, quartos, ocupantes, pessoas, podeEditar, onClose, onMudou }: {
  organizationId: string; hospedagemId: string; hotel: string; quartos: Quarto[]; ocupantes: Ocupante[]; pessoas: Pessoa[];
  podeEditar: boolean; onClose: () => void; onMudou: () => void;
}) {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nomes = new Map(pessoas.map(pessoa => [pessoa.id, pessoa.nome]));
  const semQuarto = pessoasSemQuarto(pessoas, ocupantes);
  const ordenados = [...quartos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));

  async function mover(pessoaId: string, destino: string | null) {
    setEscolhida(null); setArrastando(null); setSobre(null);
    const movimento = movimentoDeQuarto(quartos, ocupantes, pessoaId, destino);
    if (!movimento.ok) { setErro(movimento.motivo); return; }
    if (movimento.acao === "nada") return;
    setOcupado(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const atual = ocupantes.find(ocupante => ocupante.pessoa_id === pessoaId);
    if (atual) {
      const { error } = await producao.from("producao_ocupantes").delete().eq("id", atual.id);
      if (error) { setOcupado(false); setErro(error.code === "42501" ? "Você não pode mudar os quartos." : "Não foi possível mover a pessoa. Tente de novo."); return; }
    }
    if (destino) {
      const { error } = await producao.from("producao_ocupantes").insert({ organization_id: organizationId, hospedagem_id: hospedagemId, quarto_id: destino, pessoa_id: pessoaId });
      if (error) {
        // O banco recusou (por exemplo, o quarto lotou enquanto isso): devolve a pessoa ao quarto de antes.
        if (atual) await producao.from("producao_ocupantes").insert({ organization_id: organizationId, hospedagem_id: hospedagemId, quarto_id: atual.quarto_id, pessoa_id: pessoaId });
        setOcupado(false);
        setErro("Não foi possível pôr a pessoa nesse quarto. Veja se ainda há vaga.");
        onMudou();
        return;
      }
    }
    setOcupado(false);
    onMudou();
  }

  const chip = (pessoa: Pessoa) => {
    const marcada = escolhida === pessoa.id;
    return (
      <li key={pessoa.id}>
        <button type="button" draggable={podeEditar && !ocupado} disabled={!podeEditar || ocupado} aria-pressed={marcada}
          onClick={() => setEscolhida(atual => (atual === pessoa.id ? null : pessoa.id))}
          onDragStart={event => { event.dataTransfer.setData("text/plain", pessoa.id); event.dataTransfer.effectAllowed = "move"; setArrastando(pessoa.id); setErro(null); }}
          onDragEnd={() => { setArrastando(null); setSobre(null); }}
          className={`flex min-h-10 cursor-grab items-center gap-1.5 rounded border px-2.5 text-left text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:cursor-default ${marcada ? "border-[#282525] bg-[#282525] text-white" : "border-black/[.16] bg-white text-[#282525] hover:bg-black/[.04]"} ${arrastando === pessoa.id ? "opacity-40" : ""}`}>
          {podeEditar && <GripVertical size={12} aria-hidden="true" className={marcada ? "text-white/60" : "text-black/30"} />}
          {pessoa.nome}
        </button>
      </li>
    );
  };

  /** O que um destino faz com a pessoa escolhida (toque) ou arrastada: soltar nele. */
  const alvo = (destino: string | null) => ({
    onDragOver: (event: React.DragEvent) => { if (podeEditar) { event.preventDefault(); setSobre(destino ?? "sem"); } },
    onDragLeave: () => setSobre(atual => (atual === (destino ?? "sem") ? null : atual)),
    onDrop: (event: React.DragEvent) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain") || arrastando; if (id) void mover(id, destino); },
  });

  return (
    <TopSheet
      titulo={`Mapa de quartos · ${hotel}`}
      onClose={onClose}
      footer={fechar => <button type="button" onClick={fechar} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Fechar</button>}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <p className="text-[0.75rem] text-black/55">{podeEditar ? "Arraste uma pessoa para o quarto. No celular, toque na pessoa e depois no quarto." : "Quem dorme em cada quarto."}</p>

        <section aria-label="Sem quarto" {...alvo(null)} className={`rounded border p-3 transition ${sobre === "sem" ? "bg-black/[.04]" : "bg-white"}`} style={BORDA}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Sem quarto ({semQuarto.length})</h3>
            {escolhida && ocupantes.some(ocupante => ocupante.pessoa_id === escolhida) && podeEditar && (
              <button type="button" onClick={() => void mover(escolhida, null)} disabled={ocupado} className="h-9 rounded border border-black/[.16] px-3 text-[0.75rem] font-medium text-[#282525] hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]">Tirar do quarto</button>
            )}
          </div>
          {semQuarto.length === 0 ? <p className="mt-2 text-[0.75rem] text-black/40">Todos já têm quarto.</p> : <ul className="mt-2 flex flex-wrap gap-2">{semQuarto.map(chip)}</ul>}
        </section>

        {ordenados.length === 0 ? (
          <p className="text-[0.8125rem] text-black/55">Crie os quartos na hospedagem para montar o mapa.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {ordenados.map(quarto => {
              const doQuarto = ocupantes.filter(ocupante => ocupante.quarto_id === quarto.id);
              const vagas = vagasDoQuarto(quarto, ocupantes);
              const podeReceber = escolhida !== null && podeEditar && movimentoDeQuarto(quartos, ocupantes, escolhida, quarto.id).ok;
              return (
                <section key={quarto.id} aria-label={`Quarto ${quarto.nome}`} {...alvo(quarto.id)}
                  className={`rounded border p-3 transition ${sobre === quarto.id ? "border-[#282525] bg-black/[.04]" : "bg-white"}`} style={sobre === quarto.id ? undefined : BORDA}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[0.8125rem] font-medium text-[#282525]">Quarto {quarto.nome} <span className="font-normal tabular-nums text-black/45">· {doQuarto.length}/{quarto.capacidade}</span></h3>
                    {podeReceber && escolhida && !doQuarto.some(ocupante => ocupante.pessoa_id === escolhida) && (
                      <button type="button" onClick={() => void mover(escolhida, quarto.id)} disabled={ocupado} className="h-9 rounded bg-[#282525] px-3 text-[0.75rem] font-medium text-white hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Pôr {nomes.get(escolhida)?.split(" ")[0]} aqui</button>
                    )}
                  </div>
                  {doQuarto.length === 0 ? (
                    <p className="mt-2 text-[0.75rem] text-black/40">Vago · {vagas} {vagas === 1 ? "vaga" : "vagas"}</p>
                  ) : (
                    <ul className="mt-2 flex flex-wrap gap-2">{doQuarto.map(ocupante => chip({ id: ocupante.pessoa_id, nome: nomes.get(ocupante.pessoa_id) ?? "Pessoa" }))}</ul>
                  )}
                  {doQuarto.length > 0 && vagas > 0 && <p className="mt-2 text-[0.6875rem] text-black/40">{vagas} {vagas === 1 ? "vaga" : "vagas"}</p>}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </TopSheet>
  );
}

"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { mensagemDoErroDoEvento } from "@/lib/ticketeria/eventos";
import { NOME_DA_SALA_PADRAO, lerNomeDaSala, nomeDaPrimeiraAoDividir, proximoNomeDeSala, type SalaDoEspaco } from "@/lib/ticketeria/salas";
import { MODELOS_DE_SALA, modeloDeSala, resumoDoModelo } from "@/lib/ticketeria/modelos-de-sala";
import { aplicarModeloNaSala, copiarSetoresDaSala } from "@/lib/ticketeria/modelos-de-sala-cliente";
import { Aviso, CAMPO, ROTULO, Rodape } from "@/components/ticketeria/FolhasDosEventos";

/**
 * A folha da sala: o nome, e arquivar. Um espaço tem de 1 a várias salas (um cinema tem de 2 a 6); cada sala tem os seus setores e o seu mapa.
 * Ao criar a segunda sala, a "Sala única" passa a se chamar "Sala 1" (se o produtor ainda não a renomeou).
 */
export function SalaSheet({ organizationId, localId, nomeDoLocal, salasDoLocal, setoresPorSala = {}, sala, onClose, onSaved, onAviso }: {
  organizationId: string; localId: string; nomeDoLocal: string; salasDoLocal: readonly SalaDoEspaco[];
  /** Quantos setores em uso cada sala tem: só uma sala vazia pode começar de um modelo ou de uma cópia. */
  setoresPorSala?: Record<string, number>; sala?: SalaDoEspaco; onClose: () => void; onSaved: () => void; /** Um aviso para a página (a sala ficou criada, mas o modelo não entrou inteiro). */ onAviso?: (texto: string) => void;
}) {
  const [nome, setNome] = useState(sala?.nome ?? proximoNomeDeSala(salasDoLocal.map(item => item.nome)));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emUso = salasDoLocal.filter(item => !item.arquivado);
  // De onde a sala parte: em branco, de um modelo ("modelo:teatro") ou da cópia de outra sala ("copia:<id>"). Só quando a sala é nova ou ainda está vazia.
  const [partida, setPartida] = useState("branco");
  const podePartir = !sala || ((setoresPorSala[sala.id] ?? 0) === 0 && !sala.arquivado);
  const comSetores = salasDoLocal.filter(item => item.id !== sala?.id && !item.arquivado && (setoresPorSala[item.id] ?? 0) > 0);
  const opcoesDePartida = [
    { value: "branco", label: "Em branco" },
    ...MODELOS_DE_SALA.map(modelo => ({ value: `modelo:${modelo.id}`, label: `Modelo: ${modelo.nome}` })),
    ...comSetores.map(outra => ({ value: `copia:${outra.id}`, label: `Copiar a ${outra.nome}` })),
  ];
  const modeloEscolhido = partida.startsWith("modelo:") ? modeloDeSala(partida.slice(7)) : undefined;
  const copiaEscolhida = partida.startsWith("copia:") ? comSetores.find(item => item.id === partida.slice(6)) : undefined;

  async function gravar(fechar: () => void, mudanca?: { arquivado: boolean }) {
    const leitura = lerNomeDaSala(nome);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const ticketeria = clienteDaTicketeria(createClient());
    let erroDoBanco: { code?: string; message?: string } | null = null;
    let salaId = sala?.id ?? "";
    if (sala) {
      ({ error: erroDoBanco } = await ticketeria.from("ticketeria_salas").update({ nome: leitura.nome, ...mudanca }).eq("id", sala.id));
    } else {
      // Dividir o espaço em salas: a única (ainda com o nome padrão) vira "Sala 1", e a nova entra depois da última.
      const unica = emUso.length === 1 ? emUso[0] : null;
      if (unica && nomeDaPrimeiraAoDividir(unica.nome) !== unica.nome) {
        const { error } = await ticketeria.from("ticketeria_salas").update({ nome: nomeDaPrimeiraAoDividir(unica.nome) }).eq("id", unica.id);
        if (error) erroDoBanco = error;
      }
      if (!erroDoBanco) {
        const ordem = salasDoLocal.reduce((maior, item) => Math.max(maior, item.ordem), -1) + 1;
        const { data, error } = await ticketeria.from("ticketeria_salas").insert({ organization_id: organizationId, local_id: localId, nome: leitura.nome, ordem }).select("id").single();
        erroDoBanco = error;
        salaId = data?.id ?? "";
      }
    }
    if (erroDoBanco) { setSalvando(false); setErro(mensagemDoErroDoEvento(erroDoBanco)); return; }
    // Os setores de partida (modelo ou cópia). A sala já está gravada: se isto falhar, a página avisa e o resto se completa à mão.
    if (podePartir && salaId && (modeloEscolhido || copiaEscolhida)) {
      const falha = modeloEscolhido ? await aplicarModeloNaSala(ticketeria, organizationId, localId, salaId, modeloEscolhido) : await copiarSetoresDaSala(ticketeria, organizationId, localId, copiaEscolhida!.id, salaId);
      if (falha) onAviso?.(`A sala foi gravada, mas os setores de partida não entraram inteiros: ${falha}`);
    }
    setSalvando(false);
    onSaved();
    fechar();
  }

  const podeArquivar = sala && (sala.arquivado || emUso.length > 1);

  return (
    <TopSheet
      titulo={sala ? "Editar sala" : "Nova sala"}
      etiqueta={nomeDoLocal}
      onClose={onClose}
      footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo={sala ? "Salvar" : "Criar sala"} onSalvar={() => void gravar(fechar)} onApagar={podeArquivar ? () => void gravar(fechar, { arquivado: !sala.arquivado }) : undefined} rotuloApagar={sala?.arquivado ? "Tirar do arquivo" : "Arquivar"} arquivar />}
    >
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <div><label className={ROTULO} htmlFor="sa-nome">Nome</label><input id="sa-nome" autoFocus className={CAMPO} value={nome} onChange={e => setNome(e.target.value)} placeholder="Sala 2" maxLength={120} disabled={salvando} /></div>
        {podePartir && (
          <div>
            <span className={ROTULO}>Começar de</span>
            <Dropdown ariaLabel="Começar a sala de" value={partida} onChange={setPartida} disabled={salvando} options={opcoesDePartida} />
            <p className="mt-1.5 text-[0.75rem] text-black/50">
              {modeloEscolhido ? `${modeloEscolhido.descricao} (${resumoDoModelo(modeloEscolhido)}) Dá para ajustar depois, setor a setor.` : copiaEscolhida ? `Cria os mesmos setores de ${copiaEscolhida.nome}, com os mapas e os lugares bloqueados.` : "Sem setores: você monta depois, em Espaços."}
            </p>
          </div>
        )}
        <p className="text-[0.75rem] text-black/55">
          {sala ? "Cada sala tem os seus setores e o seu mapa. As sessões escolhem em qual sala acontecem." : emUso.length === 1 && emUso[0].nome === NOME_DA_SALA_PADRAO ? "A sala atual passa a se chamar “Sala 1”. Cada sala tem os seus setores e o seu mapa." : "Cada sala tem os seus setores e o seu mapa. As sessões escolhem em qual sala acontecem."}
        </p>
        {sala && emUso.length <= 1 && !sala.arquivado && <p className="text-[0.75rem] text-black/45">É a única sala em uso: o espaço precisa de ao menos uma, por isso ela não se arquiva.</p>}
      </div>
    </TopSheet>
  );
}

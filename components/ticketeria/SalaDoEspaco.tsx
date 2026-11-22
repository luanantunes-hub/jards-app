"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { mensagemDoErroDoEvento } from "@/lib/ticketeria/eventos";
import { NOME_DA_SALA_PADRAO, lerNomeDaSala, nomeDaPrimeiraAoDividir, proximoNomeDeSala, type SalaDoEspaco } from "@/lib/ticketeria/salas";
import { Aviso, CAMPO, ROTULO, Rodape } from "@/components/ticketeria/FolhasDosEventos";

/**
 * A folha da sala: o nome, e arquivar. Um espaço tem de 1 a várias salas (um cinema tem de 2 a 6); cada sala tem os seus setores e o seu mapa.
 * Ao criar a segunda sala, a "Sala única" passa a se chamar "Sala 1" (se o produtor ainda não a renomeou).
 */
export function SalaSheet({ organizationId, localId, nomeDoLocal, salasDoLocal, sala, onClose, onSaved }: {
  organizationId: string; localId: string; nomeDoLocal: string; salasDoLocal: readonly SalaDoEspaco[]; sala?: SalaDoEspaco; onClose: () => void; onSaved: () => void;
}) {
  const [nome, setNome] = useState(sala?.nome ?? proximoNomeDeSala(salasDoLocal.map(item => item.nome)));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emUso = salasDoLocal.filter(item => !item.arquivado);

  async function gravar(fechar: () => void, mudanca?: { arquivado: boolean }) {
    const leitura = lerNomeDaSala(nome);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const ticketeria = clienteDaTicketeria(createClient());
    let erroDoBanco: { code?: string; message?: string } | null = null;
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
        ({ error: erroDoBanco } = await ticketeria.from("ticketeria_salas").insert({ organization_id: organizationId, local_id: localId, nome: leitura.nome, ordem }));
      }
    }
    setSalvando(false);
    if (erroDoBanco) { setErro(mensagemDoErroDoEvento(erroDoBanco)); return; }
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
        <p className="text-[0.75rem] text-black/55">
          {sala ? "Cada sala tem os seus setores e o seu mapa. As sessões escolhem em qual sala acontecem." : emUso.length === 1 && emUso[0].nome === NOME_DA_SALA_PADRAO ? "A sala atual passa a se chamar “Sala 1”. Cada sala tem os seus setores e o seu mapa." : "Cada sala tem os seus setores e o seu mapa. As sessões escolhem em qual sala acontecem."}
        </p>
        {sala && emUso.length <= 1 && !sala.arquivado && <p className="text-[0.75rem] text-black/45">É a única sala em uso: o espaço precisa de ao menos uma, por isso ela não se arquiva.</p>}
      </div>
    </TopSheet>
  );
}

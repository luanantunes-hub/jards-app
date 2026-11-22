// A parte que grava (no navegador, com a sessão de quem edita): cria os setores de uma sala a partir de um modelo ou copiando os de outra sala.

import type { ClienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { mensagemDoErroDoEvento } from "@/lib/ticketeria/eventos";
import { lerMapa, mensagemDoErroDoMapa, paraSalvar } from "@/lib/ticketeria/mapa";
import { mapaDoSetorDoModelo, type ModeloDeSala } from "@/lib/ticketeria/modelos-de-sala";

type Erro = { code?: string; message?: string };
const frase = (erro: Erro) => (erro.message?.includes("mapa_") ? mensagemDoErroDoMapa(erro) : mensagemDoErroDoEvento(erro));

/** Cria os setores do modelo na sala. Devolve null se deu certo, ou a frase do primeiro erro (o que já foi criado fica: dá para completar à mão). */
export async function aplicarModeloNaSala(ticketeria: ClienteDaTicketeria, organizationId: string, localId: string, salaId: string, modelo: ModeloDeSala): Promise<string | null> {
  for (const [i, setor] of modelo.setores.entries()) {
    const { data, error } = await ticketeria.from("ticketeria_setores").insert({ organization_id: organizationId, local_id: localId, sala_id: salaId, nome: setor.nome, lugares: setor.lugares, ordem: i }).select("id").single();
    if (error || !data) return frase(error ?? {});
    if (setor.numerado) {
      const { error: erroDoMapa } = await ticketeria.rpc("fn_ticketeria_salvar_mapa", { p_setor: data.id, p_fileiras: paraSalvar(mapaDoSetorDoModelo(setor)), p_corredor: setor.corredor ?? true });
      if (erroDoMapa) return frase(erroDoMapa);
    }
  }
  return null;
}

/** Copia os setores em uso de uma sala para outra (nome, lugares e, nos numerados, o mapa inteiro com os lugares bloqueados). Devolve null se deu certo, ou a frase do erro. */
export async function copiarSetoresDaSala(ticketeria: ClienteDaTicketeria, organizationId: string, localId: string, deSalaId: string, paraSalaId: string): Promise<string | null> {
  const { data: origem, error } = await ticketeria.from("ticketeria_setores").select("id, nome, lugares, numerado, corredor_no_meio, ordem").eq("sala_id", deSalaId).eq("arquivado", false).order("ordem").order("nome");
  if (error || !origem) return frase(error ?? {});
  for (const [i, setor] of origem.entries()) {
    const { data, error: erroDoSetor } = await ticketeria.from("ticketeria_setores").insert({ organization_id: organizationId, local_id: localId, sala_id: paraSalaId, nome: setor.nome, lugares: setor.lugares, ordem: i }).select("id").single();
    if (erroDoSetor || !data) return frase(erroDoSetor ?? {});
    if (!setor.numerado) continue;
    const { data: mapa, error: erroDaLeitura } = await ticketeria.rpc("fn_ticketeria_mapa_do_setor", { p_setor: setor.id });
    if (erroDaLeitura) return frase(erroDaLeitura);
    const fileiras = lerMapa(mapa);
    if (fileiras.length === 0) continue;
    const { error: erroDoMapa } = await ticketeria.rpc("fn_ticketeria_salvar_mapa", { p_setor: data.id, p_fileiras: paraSalvar(fileiras), p_corredor: setor.corredor_no_meio });
    if (erroDoMapa) return frase(erroDoMapa);
  }
  return null;
}

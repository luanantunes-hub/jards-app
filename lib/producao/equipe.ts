// A equipe da produção (plano do módulo, PD1.9): os rótulos e a leitura dos campos das telas de
// pessoas e vínculos. Sem tela e sem banco.

import { lerAlcada } from "@/lib/producao/permissoes";
import type { SituacaoDoVinculo } from "@/lib/producao/estados";

export const ROTULO_DA_SITUACAO_DO_VINCULO: Record<SituacaoDoVinculo, string> = {
  prevista: "Prevista",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
};

/** O tipo principal da pessoa (`producao_pessoas.tipo`): o catálogo é daqui, o banco só confere a forma. */
export const TIPOS_DE_PESSOA = ["equipe", "elenco", "tecnica", "apoio"] as const;
export type TipoDePessoa = (typeof TIPOS_DE_PESSOA)[number];
export const ROTULO_DO_TIPO_DE_PESSOA: Record<TipoDePessoa, string> = {
  equipe: "Equipe",
  elenco: "Elenco",
  tecnica: "Técnica",
  apoio: "Apoio",
};

/** O tipo vindo do banco, com rótulo mesmo quando não está no catálogo (tipo novo ou antigo). */
export function rotuloDoTipoDePessoa(tipo: string): string {
  return ROTULO_DO_TIPO_DE_PESSOA[tipo as TipoDePessoa] ?? tipo;
}

export type LeituraDaPessoa =
  | { ok: true; pessoa: { nome: string; nome_artistico: string | null; email: string | null; telefone: string | null; tipo: string } }
  | { ok: false; erro: string };

const EMAIL = /^[^@\s]+@[^@\s]+$/;
const vazioParaNulo = (texto: string) => (texto.trim() === "" ? null : texto.trim());

/** Confere o formulário da pessoa com as regras do banco (nome de 1 a 200 letras, e-mail com arroba, telefone até 40). */
export function lerPessoa(campos: { nome: string; nomeArtistico: string; email: string; telefone: string; tipo: string }): LeituraDaPessoa {
  const nome = campos.nome.trim();
  if (nome.length === 0) return { ok: false, erro: "Informe o nome." };
  if (nome.length > 200) return { ok: false, erro: "O nome pode ter até 200 letras." };
  const nomeArtistico = vazioParaNulo(campos.nomeArtistico);
  if (nomeArtistico && nomeArtistico.length > 200) return { ok: false, erro: "O nome artístico pode ter até 200 letras." };
  const email = vazioParaNulo(campos.email);
  if (email && (email.length > 254 || !EMAIL.test(email))) return { ok: false, erro: "Esse e-mail não parece certo." };
  const telefone = vazioParaNulo(campos.telefone);
  if (telefone && telefone.length > 40) return { ok: false, erro: "O telefone pode ter até 40 caracteres." };
  return { ok: true, pessoa: { nome, nome_artistico: nomeArtistico, email, telefone, tipo: campos.tipo } };
}

/** Função e grupo do vínculo: a função é obrigatória (até 80 letras), o grupo é opcional. */
export function lerVinculo(campos: { funcao: string; grupo: string }): { ok: true; funcao: string; grupo: string | null } | { ok: false; erro: string } {
  const funcao = campos.funcao.trim();
  if (funcao.length === 0) return { ok: false, erro: "Informe a função da pessoa na temporada." };
  if (funcao.length > 80) return { ok: false, erro: "A função pode ter até 80 letras." };
  const grupo = vazioParaNulo(campos.grupo);
  if (grupo && grupo.length > 80) return { ok: false, erro: "O grupo pode ter até 80 letras." };
  return { ok: true, funcao, grupo };
}

/** O cachê ou a diária digitados ("1.500,00"); vazio ou zero = sem valor. */
export function lerValorDaEquipe(texto: string): { ok: true; valor: number | null } | { ok: false; erro: string } {
  const leitura = lerAlcada(texto);
  return leitura.ok ? { ok: true, valor: leitura.alcada } : leitura;
}

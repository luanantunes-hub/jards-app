// Espaços e salas da produção (plano do módulo, PD1.2/PD1.5): leitura e conferência do que a tela cadastra, com as mesmas
// regras do banco. Sem tela e sem banco.

export const UFS: readonly string[] = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

/** Sugestões de tipo (o banco aceita qualquer texto de até 40 letras). */
export const TIPOS_DE_ESPACO_SUGERIDOS: readonly string[] = [
  "Teatro", "Casa de show", "Centro cultural", "Sala de cinema", "Praça", "Rua", "Lona de circo", "Galpão", "Igreja", "Outro",
];

export type EspacoLido = {
  nome: string; tipo: string; proprio: boolean; movel: boolean; endereco: string | null; uf: string | null; capacidade: number | null;
};

export type LeituraDoEspaco = { ok: true; espaco: EspacoLido } | { ok: false; erro: string };

function inteiro(texto: string): number | null | "invalido" {
  const limpo = texto.trim();
  if (limpo === "") return null;
  if (!/^\d{1,7}$/.test(limpo)) return "invalido";
  return Number(limpo);
}

/** O espaço como o banco aceita: nome até 200, tipo até 40, endereço até 300, UF de duas letras e capacidade inteira. */
export function lerEspaco(campos: { nome: string; tipo: string; proprio: boolean; movel: boolean; endereco: string; uf: string; capacidade: string }): LeituraDoEspaco {
  const nome = campos.nome.trim();
  if (nome === "") return { ok: false, erro: "Informe o nome do espaço." };
  if (nome.length > 200) return { ok: false, erro: "O nome pode ter até 200 letras." };
  const tipo = campos.tipo.trim();
  if (tipo === "") return { ok: false, erro: "Informe o tipo do espaço." };
  if (tipo.length > 40) return { ok: false, erro: "O tipo pode ter até 40 letras." };
  const endereco = campos.endereco.trim();
  if (endereco.length > 300) return { ok: false, erro: "O endereço pode ter até 300 letras." };
  const uf = campos.uf.trim().toUpperCase();
  if (uf !== "" && !UFS.includes(uf)) return { ok: false, erro: "Escolha um estado da lista." };
  const capacidade = inteiro(campos.capacidade);
  if (capacidade === "invalido") return { ok: false, erro: "A capacidade é um número inteiro." };
  return { ok: true, espaco: { nome, tipo, proprio: campos.proprio, movel: campos.movel, endereco: endereco === "" ? null : endereco, uf: uf === "" ? null : uf, capacidade } };
}

export type LeituraDaSala = { ok: true; sala: { nome: string; capacidade: number | null } } | { ok: false; erro: string };

export function lerSala(campos: { nome: string; capacidade: string }): LeituraDaSala {
  const nome = campos.nome.trim();
  if (nome === "") return { ok: false, erro: "Informe o nome da sala." };
  if (nome.length > 200) return { ok: false, erro: "O nome pode ter até 200 letras." };
  const capacidade = inteiro(campos.capacidade);
  if (capacidade === "invalido") return { ok: false, erro: "A capacidade é um número inteiro." };
  return { ok: true, sala: { nome, capacidade } };
}

/** "Teatro Municipal · Sala Principal" ou só o espaço. */
export function rotuloDoLugar(espaco: string | null, sala: string | null): string {
  return [espaco, sala].filter(Boolean).join(" · ");
}

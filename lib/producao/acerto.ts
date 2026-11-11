// O acerto técnico (plano do módulo, PD4.1 e PD4.2): o modelo (campos com seção, tipo, destino e o que o terceiro vê), os
// itens de um acerto e a leitura das respostas de quem preenche pelo link, sem conta. Sem tela e sem banco.

import {
  DESTINOS_DO_ACERTO, TIPOS_DE_CAMPO_DO_ACERTO, VISIBILIDADES_DO_ACERTO,
  type DestinoDoAcerto, type TipoDeCampoDoAcerto, type VisibilidadeDoAcerto,
} from "@/lib/producao/estados";

export const ROTULO_DO_TIPO_DE_CAMPO: Record<TipoDeCampoDoAcerto, string> = {
  texto: "Texto", numero: "Número", escolha: "Escolha", sim_nao: "Sim ou não", data: "Data", hora: "Hora",
};
export const ROTULO_DA_VISIBILIDADE: Record<VisibilidadeDoAcerto, string> = {
  oculto: "Oculto para a casa", leitura: "A casa só lê", opcional: "A casa preenche (opcional)", obrigatorio: "A casa preenche (obrigatório)",
};

/** Para onde a resposta aprovada vai: "livre" fica no acerto; os outros gravam na ficha da sala ou do espaço da data. */
export const DESTINO_DO_ACERTO: Record<DestinoDoAcerto, { rotulo: string; tipo: TipoDeCampoDoAcerto | null; minimo?: number; maximo?: number }> = {
  livre: { rotulo: "Só no acerto", tipo: null },
  sala_palco_boca_m: { rotulo: "Ficha da sala: boca de cena (m)", tipo: "numero", minimo: 0, maximo: 200 },
  sala_palco_profundidade_m: { rotulo: "Ficha da sala: profundidade do palco (m)", tipo: "numero", minimo: 0, maximo: 200 },
  sala_palco_altura_m: { rotulo: "Ficha da sala: altura do palco (m)", tipo: "numero", minimo: 0, maximo: 100 },
  sala_som_canais_entrada: { rotulo: "Ficha da sala: canais de entrada da mesa", tipo: "numero", minimo: 0, maximo: 256 },
  sala_luz_refletores: { rotulo: "Ficha da sala: refletores", tipo: "numero", minimo: 0, maximo: 5000 },
  sala_energia_kva: { rotulo: "Ficha da sala: potência instalada (kVA)", tipo: "numero", minimo: 0, maximo: 100000 },
  sala_energia_tensao_v: { rotulo: "Ficha da sala: tensão (V)", tipo: "numero", minimo: 100, maximo: 1000 },
  sala_camarins_quantidade: { rotulo: "Ficha da sala: camarins", tipo: "numero", minimo: 0, maximo: 100 },
  espaco_carga_descarga: { rotulo: "Ficha do espaço: carga e descarga", tipo: "texto" },
  espaco_doca_altura_m: { rotulo: "Ficha do espaço: altura da doca (m)", tipo: "numero", minimo: 0, maximo: 20 },
};

/** Destinos que são números inteiros no banco. */
const DESTINOS_INTEIROS: ReadonlySet<DestinoDoAcerto> = new Set(["sala_som_canais_entrada", "sala_luz_refletores", "sala_energia_tensao_v", "sala_camarins_quantidade"]);

export type CampoDoModelo = {
  chave: string; secao: string; rotulo: string; tipo: TipoDeCampoDoAcerto; opcoes: string[]; destino: DestinoDoAcerto; visibilidade: VisibilidadeDoAcerto; ajuda: string;
};

const SLUG = /^[a-z0-9_]{1,40}$/;

export type LeituraDoCampo = { ok: true; campo: CampoDoModelo } | { ok: false; erro: string };

/** Um campo como o banco guarda: seção até 60, rótulo até 200, ajuda até 300, escolha com 2 a 12 opções, destino coerente com o tipo. */
export function lerCampo(entrada: Partial<Record<keyof CampoDoModelo, unknown>>): LeituraDoCampo {
  const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");
  const chave = texto(entrada.chave), secao = texto(entrada.secao), rotulo = texto(entrada.rotulo), ajuda = texto(entrada.ajuda);
  const tipo = texto(entrada.tipo), destino = texto(entrada.destino), visibilidade = texto(entrada.visibilidade);
  if (!SLUG.test(chave)) return { ok: false, erro: "A chave do campo usa letras minúsculas, números e _ (até 40)." };
  if (secao === "" || secao.length > 60) return { ok: false, erro: "A seção tem de 1 a 60 letras." };
  if (rotulo === "" || rotulo.length > 200) return { ok: false, erro: "O nome do campo tem de 1 a 200 letras." };
  if (ajuda.length > 300) return { ok: false, erro: "A dica pode ter até 300 letras." };
  if (!(TIPOS_DE_CAMPO_DO_ACERTO as readonly string[]).includes(tipo)) return { ok: false, erro: "Escolha o tipo do campo." };
  if (!(DESTINOS_DO_ACERTO as readonly string[]).includes(destino)) return { ok: false, erro: "Escolha o destino do campo." };
  if (!(VISIBILIDADES_DO_ACERTO as readonly string[]).includes(visibilidade)) return { ok: false, erro: "Escolha o que a casa vê neste campo." };
  const exigido = DESTINO_DO_ACERTO[destino as DestinoDoAcerto].tipo;
  if (exigido !== null && exigido !== tipo) return { ok: false, erro: `O destino "${DESTINO_DO_ACERTO[destino as DestinoDoAcerto].rotulo}" pede um campo do tipo ${ROTULO_DO_TIPO_DE_CAMPO[exigido].toLowerCase()}.` };
  let opcoes: string[] = [];
  if (tipo === "escolha") {
    opcoes = (Array.isArray(entrada.opcoes) ? entrada.opcoes : []).map(texto).filter(item => item !== "");
    if (opcoes.length < 2 || opcoes.length > 12 || opcoes.some(item => item.length > 80)) return { ok: false, erro: "Um campo de escolha tem de 2 a 12 opções de até 80 letras." };
    if (new Set(opcoes).size !== opcoes.length) return { ok: false, erro: "As opções de uma escolha não se repetem." };
  }
  return { ok: true, campo: { chave, secao, rotulo, tipo: tipo as TipoDeCampoDoAcerto, opcoes, destino: destino as DestinoDoAcerto, visibilidade: visibilidade as VisibilidadeDoAcerto, ajuda } };
}

export type LeituraDoModelo = { ok: true; nome: string; campos: CampoDoModelo[] } | { ok: false; erro: string };

/** O modelo: nome até 120 e de 1 a 80 campos, com chaves que não se repetem. */
export function lerModelo(nome: string, campos: readonly unknown[]): LeituraDoModelo {
  const limpo = nome.trim();
  if (limpo === "" || limpo.length > 120) return { ok: false, erro: "O nome do modelo tem de 1 a 120 letras." };
  if (campos.length === 0 || campos.length > 80) return { ok: false, erro: "O modelo tem de 1 a 80 campos." };
  const lidos: CampoDoModelo[] = [];
  for (const [indice, entrada] of campos.entries()) {
    const leitura = lerCampo((entrada ?? {}) as Partial<Record<keyof CampoDoModelo, unknown>>);
    if (!leitura.ok) return { ok: false, erro: `Campo ${indice + 1}: ${leitura.erro}` };
    lidos.push(leitura.campo);
  }
  if (new Set(lidos.map(campo => campo.chave)).size !== lidos.length) return { ok: false, erro: "Há dois campos com a mesma chave." };
  return { ok: true, nome: limpo, campos: lidos };
}

const campo = (secao: string, chave: string, rotulo: string, tipo: TipoDeCampoDoAcerto, destino: DestinoDoAcerto, visibilidade: VisibilidadeDoAcerto, extra: Partial<CampoDoModelo> = {}): CampoDoModelo =>
  ({ chave, secao, rotulo, tipo, opcoes: [], destino, visibilidade, ajuda: "", ...extra });

/** O modelo que vem pronto: a casa recebe o espetáculo e confirma o que tem. A organização copia e ajusta. */
export const MODELO_PADRAO: { nome: string; lado: "casa" | "companhia"; campos: CampoDoModelo[] } = {
  nome: "Acerto técnico: a casa recebe",
  lado: "casa",
  campos: [
    campo("O que o espetáculo pede", "pede_boca", "Boca de cena que o cenário pede (m)", "numero", "livre", "leitura"),
    campo("O que o espetáculo pede", "pede_canais", "Canais de som que o espetáculo usa", "numero", "livre", "leitura"),
    campo("Palco", "palco_boca", "Boca de cena da sala (m)", "numero", "sala_palco_boca_m", "obrigatorio"),
    campo("Palco", "palco_profundidade", "Profundidade do palco (m)", "numero", "sala_palco_profundidade_m", "obrigatorio"),
    campo("Palco", "palco_altura", "Altura útil do palco (m)", "numero", "sala_palco_altura_m", "opcional"),
    campo("Som", "som_canais", "Canais de entrada da mesa", "numero", "sala_som_canais_entrada", "obrigatorio"),
    campo("Luz", "luz_refletores", "Refletores disponíveis", "numero", "sala_luz_refletores", "opcional"),
    campo("Energia", "energia_kva", "Potência instalada (kVA)", "numero", "sala_energia_kva", "obrigatorio"),
    campo("Energia", "energia_tensao", "Tensão (V)", "numero", "sala_energia_tensao_v", "opcional", { ajuda: "Por exemplo, 127 ou 220." }),
    campo("Camarins", "camarins", "Quantidade de camarins", "numero", "sala_camarins_quantidade", "opcional"),
    campo("Carga e descarga", "carga_descarga", "Como é a carga e descarga", "texto", "espaco_carga_descarga", "obrigatorio", { ajuda: "Acesso, porta, doca, onde o caminhão para." }),
    campo("Carga e descarga", "doca_altura", "Altura da doca (m)", "numero", "espaco_doca_altura_m", "opcional"),
    campo("Horários", "chegada", "Hora de chegada da equipe para a montagem", "hora", "livre", "obrigatorio"),
    campo("Horários", "abertura", "Hora de abertura da casa ao público", "hora", "livre", "opcional"),
    campo("Horários", "observacoes", "Observações", "texto", "livre", "opcional"),
  ],
};

// ─── Itens de um acerto ─────────────────────────────────────────────────────

export type ItemDoAcerto = CampoDoModelo & {
  id: string; situacao: "pendente" | "respondido" | "aprovado" | "recusado"; valor_atual: string | null; resposta: string | null; motivo: string | null;
};

/** O que a casa pode preencher agora: campos de preencher que ainda estão pendentes ou foram recusados. */
export function itemEditavel(item: Pick<ItemDoAcerto, "visibilidade" | "situacao">): boolean {
  return (item.visibilidade === "opcional" || item.visibilidade === "obrigatorio") && (item.situacao === "pendente" || item.situacao === "recusado");
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Lê um valor digitado conforme o tipo do campo; devolve o texto guardado ("" quando vazio) ou o erro. */
export function lerValorDoCampo(item: Pick<CampoDoModelo, "tipo" | "opcoes" | "destino">, bruto: unknown): { ok: true; valor: string } | { ok: false; erro: string } {
  const texto = typeof bruto === "string" ? bruto.trim() : typeof bruto === "number" ? String(bruto) : "";
  if (texto === "") return { ok: true, valor: "" };
  switch (item.tipo) {
    case "texto":
      return texto.length > 2000 ? { ok: false, erro: "Use até 2.000 letras." } : { ok: true, valor: texto };
    case "numero": {
      const numero = Number(texto.replace(",", "."));
      if (!Number.isFinite(numero) || !/^-?\d+([.,]\d+)?$/.test(texto)) return { ok: false, erro: "Informe um número." };
      const faixa = DESTINO_DO_ACERTO[item.destino];
      if (DESTINOS_INTEIROS.has(item.destino) && !Number.isInteger(numero)) return { ok: false, erro: "Informe um número inteiro." };
      if ((faixa.minimo !== undefined && numero < faixa.minimo) || (faixa.maximo !== undefined && numero > faixa.maximo)) return { ok: false, erro: `O valor fica entre ${faixa.minimo} e ${faixa.maximo}.` };
      if (Math.abs(numero) > 1e9) return { ok: false, erro: "Número grande demais." };
      return { ok: true, valor: String(numero) };
    }
    case "escolha":
      return item.opcoes.includes(texto) ? { ok: true, valor: texto } : { ok: false, erro: "Escolha uma das opções." };
    case "sim_nao":
      return texto === "sim" || texto === "nao" ? { ok: true, valor: texto } : { ok: false, erro: "Responda sim ou não." };
    case "data":
      return DATA.test(texto) && !Number.isNaN(Date.parse(`${texto}T00:00:00Z`)) ? { ok: true, valor: texto } : { ok: false, erro: "Informe uma data." };
    case "hora":
      return HORA.test(texto) ? { ok: true, valor: texto } : { ok: false, erro: "Informe a hora, como 18:30." };
  }
}

export type RespostasLidas =
  | { ok: true; respostas: { id: string; valor: string }[] }
  | { ok: false; erros: Record<string, string> };

/**
 * As respostas da casa: só vale item que ela pode preencher agora (o servidor nunca confia no que o pedido diz de outros
 * itens); campo obrigatório pendente ou recusado não pode ficar vazio; valor vazio de campo opcional é ignorado. Devolve as
 * respostas a gravar ou o erro de cada item.
 */
export function lerRespostas(itens: readonly ItemDoAcerto[], entrada: Record<string, unknown>): RespostasLidas {
  const erros: Record<string, string> = {};
  const respostas: { id: string; valor: string }[] = [];
  for (const item of itens) {
    if (!itemEditavel(item)) continue;
    const leitura = lerValorDoCampo(item, entrada[item.id]);
    if (!leitura.ok) { erros[item.id] = leitura.erro; continue; }
    if (leitura.valor === "") {
      if (item.visibilidade === "obrigatorio") erros[item.id] = "Campo obrigatório.";
      continue;
    }
    respostas.push({ id: item.id, valor: leitura.valor });
  }
  return Object.keys(erros).length > 0 ? { ok: false, erros } : { ok: true, respostas };
}

/** O nome de quem responde: de 2 a 120 letras. O e-mail é opcional, mas, se vier, tem de parecer um. */
export function lerRespondente(nome: unknown, email: unknown): { ok: true; nome: string; email: string | null } | { ok: false; erro: string } {
  const n = typeof nome === "string" ? nome.trim() : "";
  const e = typeof email === "string" ? email.trim() : "";
  if (n.length < 2 || n.length > 120) return { ok: false, erro: "Informe o seu nome." };
  if (e !== "" && (e.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) return { ok: false, erro: "O e-mail não parece certo." };
  return { ok: true, nome: n, email: e === "" ? null : e };
}

/** O resumo da resposta para quem revisa: quantos itens esperam revisão. */
export function resumoDaRevisao(itens: readonly Pick<ItemDoAcerto, "situacao">[]): string {
  const respondidos = itens.filter(item => item.situacao === "respondido").length;
  const aprovados = itens.filter(item => item.situacao === "aprovado").length;
  const recusados = itens.filter(item => item.situacao === "recusado").length;
  const partes = [`${respondidos} para revisar`, `${aprovados} aprovados`];
  if (recusados > 0) partes.push(`${recusados} recusados`);
  return partes.join(", ") + ".";
}

/** A chave de um campo novo, tirada do nome ("Boca de cena (m)" vira "boca_de_cena_m") e sem repetir as que já existem. */
export function chaveParaCampo(rotulo: string, usadas: ReadonlySet<string>): string {
  const base = rotulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 36) || "campo";
  if (!usadas.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const candidata = `${base}_${n}`;
    if (!usadas.has(candidata)) return candidata;
  }
  return `${base}_${usadas.size + 1}`.slice(0, 40);
}

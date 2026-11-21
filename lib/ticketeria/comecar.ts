// O onboarding da Ticketeria ("Começar"): o produtor diz como trabalha, responde duas perguntas e sai com o primeiro evento
// pronto, em rascunho. Quem cria tudo é o banco, numa só chamada (fn_ticketeria_comecar, migration ticketeria_comecar); aqui
// fica o que a tela precisa antes de chamar: as perguntas por perfil, a conferência dos campos, a divisão da meia-entrada
// (a mesma conta do banco) e as mensagens de erro. Sem imports de servidor: roda nos testes (tests/ticketeria-comecar.test.ts).

export type PerfilDoProdutor = "espaco" | "turne" | "unico" | "festival";

export const PERFIS: readonly PerfilDoProdutor[] = ["espaco", "turne", "unico", "festival"];

export const PERFIL: Record<PerfilDoProdutor, {
  titulo: string; descricao: string; pergunta: string; apoio: string; rotuloDoNome: string; exemploDoNome: string;
  rotuloDoLugar: string; exemploDoLugar: string; rotuloDaData: string;
}> = {
  espaco: {
    titulo: "Tenho um espaço", descricao: "Teatro, casa de show, galeria. Vários eventos no mesmo lugar.",
    pergunta: "Qual é o seu espaço?", apoio: "Você cadastra uma vez. Todo evento novo já nasce nele.",
    rotuloDoNome: "Primeiro evento", exemploDoNome: "Hamlet, temporada de março",
    rotuloDoLugar: "Nome do espaço", exemploDoLugar: "Teatro Municipal", rotuloDaData: "Primeira data",
  },
  turne: {
    titulo: "Circulo com um espetáculo", descricao: "A mesma obra em várias cidades e datas.",
    pergunta: "Qual é o espetáculo?", apoio: "Comece pela primeira data. As outras você soma depois.",
    rotuloDoNome: "Nome do espetáculo", exemploDoNome: "O Auto da Compadecida",
    rotuloDoLugar: "Primeiro lugar", exemploDoLugar: "Teatro Guaíra", rotuloDaData: "Primeira data",
  },
  unico: {
    titulo: "Faço um evento único", descricao: "Uma festa, um show, uma palestra.",
    pergunta: "Conta do seu evento", apoio: "Só o essencial. O resto fica para depois.",
    rotuloDoNome: "Nome do evento", exemploDoNome: "Show de lançamento",
    rotuloDoLugar: "Onde", exemploDoLugar: "Casa de Cultura", rotuloDaData: "Quando",
  },
  festival: {
    titulo: "Organizo um festival", descricao: "Vários dias ou atrações, no mesmo lugar.",
    pergunta: "Qual é o festival?", apoio: "Um evento com uma sessão por dia, no mesmo lugar.",
    rotuloDoNome: "Nome do festival", exemploDoNome: "Festival de Inverno",
    rotuloDoLugar: "Onde", exemploDoLugar: "Parque da Cidade", rotuloDaData: "Primeiro dia",
  },
};

export type RespostasDoComecar = {
  perfil: PerfilDoProdutor | null;
  evento: string;
  lugar: string;
  cidade: string;
  lugares: string;
  data: string; // AAAA-MM-DD
  hora: string; // HH:MM
  dias: string;
  gratuito: boolean;
  preco: string; // em reais, como digitado ("60" ou "59,90")
  meia: boolean;
};

export const RESPOSTAS_VAZIAS: RespostasDoComecar = {
  perfil: null, evento: "", lugar: "", cidade: "", lugares: "", data: "", hora: "20:00", dias: "2", gratuito: false, preco: "", meia: true,
};

/** Os três passos com perguntas (o quarto é o evento pronto). */
export type PassoDoComecar = "perfil" | "evento" | "ingresso";

/** Data de hoje em Brasília (AAAA-MM-DD), a mesma conta do banco. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/** Reais digitados ("59,90", "60", "1.200,50") em centavos; null se não for um valor. */
export function centavosDe(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(limpo)) return null;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const valor = Math.round(Number(normal) * 100);
  return Number.isFinite(valor) ? valor : null;
}

const inteiro = (texto: string) => (/^\d+$/.test(texto.trim()) ? Number(texto.trim()) : null);

/** A mensagem do primeiro campo a acertar no passo, ou null quando dá para seguir. */
export function conferirPasso(passo: PassoDoComecar, r: RespostasDoComecar, hoje: string = hojeEmBrasilia()): string | null {
  if (passo === "perfil") return r.perfil ? null : "Escolha uma opção para continuar";
  if (passo === "evento") {
    if (!r.perfil) return "Escolha como você trabalha";
    if (!r.evento.trim()) return "Dê um nome ao evento";
    if (r.evento.trim().length > 200) return "O nome pode ter até 200 caracteres";
    if (!r.lugar.trim()) return r.perfil === "espaco" ? "Diga o nome do espaço" : "Diga onde vai ser";
    const lugares = inteiro(r.lugares);
    if (!lugares || lugares < 1) return "Diga quantos lugares há";
    if (lugares > 200000) return "São no máximo 200.000 lugares";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data)) return "Escolha a data";
    if (r.data < hoje) return "A data já passou";
    if (!/^\d{2}:\d{2}$/.test(r.hora)) return "Escolha o horário";
    if (r.perfil === "festival") {
      const dias = inteiro(r.dias);
      if (!dias || dias < 1 || dias > 31) return "O festival pode ter de 1 a 31 dias";
    }
    return null;
  }
  if (r.gratuito) return null;
  const centavos = centavosDe(r.preco);
  if (centavos === null || centavos <= 0) return "Diga o preço da inteira, ou marque gratuito";
  if (centavos > 10000000) return "O preço pode ir até R$ 100.000";
  return null;
}

/** Como o banco divide os lugares: 40% meia (Lei 12.933/2013) e o resto inteira; sem meia abaixo de 3 lugares ou no gratuito. */
export function divisaoDosLugares(lugares: number, meia: boolean, gratuito: boolean): { inteira: number; meia: number } {
  if (gratuito || !meia || lugares < 3) return { inteira: lugares, meia: 0 };
  const m = Math.floor(lugares * 0.4);
  return { inteira: lugares - m, meia: m };
}

/** O preço da meia: metade da inteira, arredondada, nunca abaixo de 1 centavo (a mesma conta do banco). */
export const precoDaMeia = (inteira: number) => Math.max(1, Math.round(inteira / 2));

/** Os argumentos de fn_ticketeria_comecar. Chamar só depois de conferirPasso devolver null nos três passos. */
export function argumentosDoComecar(organizationId: string, r: RespostasDoComecar) {
  return {
    p_org: organizationId,
    p_perfil: r.perfil as PerfilDoProdutor,
    p_evento: r.evento.trim(),
    p_local: r.lugar.trim(),
    p_cidade: r.cidade.trim() || null,
    p_lugares: Number(r.lugares.trim()),
    p_data: r.data,
    p_hora: r.hora,
    p_dias: r.perfil === "festival" ? Number(r.dias.trim()) : null,
    p_preco_centavos: r.gratuito ? 0 : (centavosDe(r.preco) ?? 0),
    p_meia: !r.gratuito && r.meia,
  };
}

export type ResultadoDoComecar = { loja_id: string; evento_id: string; local_id: string; sessoes: number; meia: number; inteira: number };

const ERROS: Record<string, string> = {
  sem_permissao: "Só quem edita a Ticketeria pode criar eventos. Peça a quem administra a organização.",
  data_no_passado: "A data já passou. Escolha outra.",
  perfil_invalido: "Escolha como você trabalha.",
  evento_sem_nome: "Dê um nome ao evento.",
  local_sem_nome: "Diga onde vai ser.",
  lugares_invalidos: "Diga quantos lugares há.",
  sem_data: "Escolha a data e o horário.",
  dias_invalidos: "O festival pode ter de 1 a 31 dias.",
  preco_invalido: "Confira o preço.",
};

export function mensagemDoErroDoComecar(erro: { message?: string } | null | undefined): string {
  const codigo = Object.keys(ERROS).find(chave => erro?.message?.includes(chave));
  return codigo ? ERROS[codigo] : "Não foi possível criar o evento. Tente de novo.";
}

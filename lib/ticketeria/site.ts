// O site público da loja na Ticketeria (veio da Produção na T1, 18/11/2026; desenho da PD12.1 e PD12.1b): os blocos fixos de
// uma página (sem HTML livre), o endereço da página, e o domínio da pessoa (como lê o que ela digita e os registros de DNS que
// ela precisa criar). Sem tela e sem banco.

// ─── Blocos ─────────────────────────────────────────────────────────────────

export const TIPOS_DE_BLOCO = ["capa", "titulo", "texto", "colunas", "imagem", "galeria", "video", "mapa", "botao", "contagem", "faq", "patrocinadores", "programacao", "ingressos", "agenda", "contato"] as const;
export type TipoDeBloco = (typeof TIPOS_DE_BLOCO)[number];

/** Os cinco jeitos do destaque do alto da página (a biblioteca de seções, passo 3; desenhos aprovados pelo dono em 20/11/2026). O bloco segue com o tipo "capa" no banco. */
export const LAYOUTS_DO_DESTAQUE = ["tela_cheia", "dividido", "carrossel", "proximo", "cartao"] as const;
export type LayoutDoDestaque = (typeof LAYOUTS_DO_DESTAQUE)[number];
export const LAYOUT_PADRAO_DO_DESTAQUE: LayoutDoDestaque = "tela_cheia";
export const ROTULO_DO_LAYOUT_DO_DESTAQUE: Record<LayoutDoDestaque, { nome: string; frase: string }> = {
  tela_cheia: { nome: "Imagem de tela cheia", frase: "Foto, título, uma frase e até dois botões." },
  dividido: { nome: "Dividido", frase: "Texto e imagem lado a lado, com data e local." },
  carrossel: { nome: "Carrossel", frase: "Até cinco destaques que passam sozinhos." },
  proximo: { nome: "Próximo evento", frase: "Puxa sozinho o próximo evento publicado." },
  cartao: { nome: "Cartão sobreposto", frase: "Imagem com um cartão que apresenta a companhia." },
};
export const MAX_SLIDES_DO_DESTAQUE = 5;
export type SlideDoDestaque = { titulo: string; frase: string; imagem: string; botao_rotulo: string; botao_url: string };

/** Os cinco jeitos de mostrar a agenda de eventos (a biblioteca de seções, passo 2; desenhos aprovados pelo dono em 20/11/2026). */
export const LAYOUTS_DA_AGENDA = ["carrossel", "grade", "lista", "calendario", "filtros"] as const;
export type LayoutDaAgenda = (typeof LAYOUTS_DA_AGENDA)[number];
export const LAYOUT_PADRAO_DA_AGENDA: LayoutDaAgenda = "grade";
export const ROTULO_DO_LAYOUT_DA_AGENDA: Record<LayoutDaAgenda, { nome: string; frase: string }> = {
  carrossel: { nome: "Carrossel", frase: "Cartões em fila, com setas e deslizar no celular." },
  grade: { nome: "Grade", frase: "Cartões em colunas, com a cor de cada espaço." },
  lista: { nome: "Lista por mês", frase: "Uma linha por sessão, agrupada por mês." },
  calendario: { nome: "Calendário do mês", frase: "Os dias com programação ficam marcados." },
  filtros: { nome: "Com filtros", frase: "Filtra por mês e por espaço, e busca pelo nome." },
};

export const ROTULO_DO_TIPO_DE_BLOCO: Record<TipoDeBloco, string> = {
  capa: "Destaque do alto", titulo: "Título", texto: "Texto", colunas: "Duas colunas", imagem: "Imagem", galeria: "Galeria", video: "Vídeo", mapa: "Mapa", botao: "Botão com link",
  agenda: "Agenda de eventos", contagem: "Contagem regressiva", faq: "Perguntas frequentes", patrocinadores: "Patrocinadores", programacao: "Programação de um espaço (Produção)", ingressos: "Ingressos de um evento", contato: "Contato",
};

/** Os grupos do seletor "Acrescentar bloco", na ordem em que aparecem (desenho aprovado pelo dono em 20/11/2026). */
export const GRUPOS_DE_BLOCOS: { titulo: string; tipos: readonly TipoDeBloco[] }[] = [
  { titulo: "Conteúdo", tipos: ["capa", "titulo", "texto", "colunas", "imagem", "galeria"] },
  { titulo: "Mídia e local", tipos: ["video", "mapa", "contato"] },
  { titulo: "Venda e confiança", tipos: ["ingressos", "agenda", "botao", "contagem", "faq", "patrocinadores", "programacao"] },
];

/** Uma das duas colunas do bloco "Duas colunas": um texto ou uma imagem. */
export type ColunaDoBloco = { tipo: "texto"; texto: string } | { tipo: "imagem"; url: string; alt: string };
export type ImagemDaGaleria = { url: string; alt: string };
export type PerguntaFrequente = { pergunta: string; resposta: string };
export type Patrocinador = { url: string; alt: string; link: string };

export type Bloco =
  | { tipo: "titulo"; texto: string }
  | { tipo: "texto"; texto: string }
  | { tipo: "imagem"; url: string; alt: string }
  | { tipo: "botao"; rotulo: string; url: string }
  /** A faixa de abertura da página: título, subtítulo, imagem de fundo (https, opcional) e um botão (opcional, rótulo e endereço juntos). */
  | { tipo: "capa"; layout: LayoutDoDestaque; titulo: string; subtitulo: string; imagem: string; botao_rotulo: string; botao_url: string; botao2_rotulo: string; botao2_url: string; chamada: string; info: string; slides: SlideDoDestaque[] }
  | { tipo: "colunas"; esquerda: ColunaDoBloco; direita: ColunaDoBloco }
  | { tipo: "galeria"; titulo: string; imagens: ImagemDaGaleria[] }
  /** Só YouTube e Vimeo: guarda o provedor e o id do vídeo (nunca um endereço livre); o endereço do player sai de `enderecoDoVideo`. */
  | { tipo: "video"; titulo: string; provedor: "youtube" | "vimeo"; id: string }
  /** O mapa do Google para um endereço digitado (o endereço do mapa sai de `enderecoDoMapa`). */
  | { tipo: "mapa"; titulo: string; endereco: string }
  /** Quanto falta para um instante (ISO, em UTC); passado o instante, mostra `depois`. */
  | { tipo: "contagem"; titulo: string; ate: string; depois: string }
  | { tipo: "faq"; titulo: string; itens: PerguntaFrequente[] }
  | { tipo: "patrocinadores"; titulo: string; itens: Patrocinador[] }
  /** As sessões confirmadas de um espaço da Produção da mesma organização; sem espaço, o bloco não mostra nada. */
  | { tipo: "programacao"; titulo: string; espaco_id: string | null }
  /** As sessões de um evento publicado da mesma organização, cada uma com o botão de comprar (a página de compra do Jards); sem evento, o bloco não mostra nada. */
  | { tipo: "ingressos"; titulo: string; evento_id: string | null }
  /** A lista dos eventos publicados da loja com sessão por vir, cada um com a próxima sessão, o preço e o link para a página do evento. */
  | { tipo: "agenda"; titulo: string; layout: LayoutDaAgenda }
  | { tipo: "contato"; email: string; telefone: string; endereco: string };

export const MAX_BLOCOS_POR_PAGINA = 60;

const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O endereço de um link ou de uma imagem do site: só https (nada de javascript:, data: ou http solto), até 500 letras. */
export function lerUrlHttps(bruto: unknown): { ok: true; url: string } | { ok: false } {
  const valor = texto(bruto);
  if (valor.length === 0 || valor.length > 500) return { ok: false };
  try {
    const url = new URL(valor);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.hostname.length === 0) return { ok: false };
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false };
  }
}

/** Uma imagem (endereço https e texto alternativo), como a galeria e os patrocinadores a guardam. */
function lerImagem(entrada: unknown, rotulo: string): { ok: true; imagem: ImagemDaGaleria } | { ok: false; erro: string } {
  const i = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  const url = lerUrlHttps(i.url), alt = texto(i.alt);
  if (!url.ok) return { ok: false, erro: `${rotulo}: o endereço da imagem tem de começar com https://.` };
  if (alt === "" || alt.length > 200) return { ok: false, erro: `${rotulo}: descreva a imagem em até 200 letras (texto alternativo).` };
  return { ok: true, imagem: { url: url.url, alt } };
}

function lerColuna(entrada: unknown, qual: string): { ok: true; coluna: ColunaDoBloco } | { ok: false; erro: string } {
  const c = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  if (c.tipo === "texto") {
    const t = texto(c.texto);
    return t === "" || t.length > 2000 ? { ok: false, erro: `O texto da coluna ${qual} tem de ter de 1 a 2.000 letras.` } : { ok: true, coluna: { tipo: "texto", texto: t } };
  }
  if (c.tipo === "imagem") {
    const l = lerImagem(c, `Coluna ${qual}`);
    return l.ok ? { ok: true, coluna: { tipo: "imagem", ...l.imagem } } : l;
  }
  return { ok: false, erro: `Escolha texto ou imagem para a coluna ${qual}.` };
}

const ID_DO_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;
const ID_DO_VIMEO = /^\d{6,12}$/;

/** O provedor e o id de um vídeo, a partir do que a pessoa cola (watch, youtu.be, shorts, embed, vimeo.com/ID, player.vimeo.com) ou de "provedor:id"; nulo se não for do YouTube nem do Vimeo. */
export function lerVideo(bruto: string): { provedor: "youtube" | "vimeo"; id: string } | null {
  const t = bruto.trim();
  const direto = /^(youtube|vimeo):(.+)$/.exec(t);
  if (direto) return (direto[1] === "youtube" ? ID_DO_YOUTUBE : ID_DO_VIMEO).test(direto[2]) ? { provedor: direto[1] as "youtube" | "vimeo", id: direto[2] } : null;
  let url: URL;
  try { url = new URL(t); } catch { return null; }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const partes = url.pathname.split("/").filter(Boolean);
  if (host === "youtu.be") return partes[0] && ID_DO_YOUTUBE.test(partes[0]) ? { provedor: "youtube", id: partes[0] } : null;
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = partes[0] === "watch" ? url.searchParams.get("v") : ["embed", "shorts", "live", "v"].includes(partes[0] ?? "") ? partes[1] : null;
    return id && ID_DO_YOUTUBE.test(id) ? { provedor: "youtube", id } : null;
  }
  if (host === "vimeo.com") return partes[0] && ID_DO_VIMEO.test(partes[0]) ? { provedor: "vimeo", id: partes[0] } : null;
  if (host === "player.vimeo.com") return partes[0] === "video" && partes[1] && ID_DO_VIMEO.test(partes[1]) ? { provedor: "vimeo", id: partes[1] } : null;
  return null;
}

/** O endereço do player para o iframe: sempre de um destes dois domínios, e o id já conferido. */
export function enderecoDoVideo(bloco: { provedor: "youtube" | "vimeo"; id: string }): string {
  return bloco.provedor === "youtube" ? `https://www.youtube-nocookie.com/embed/${bloco.id}` : `https://player.vimeo.com/video/${bloco.id}`;
}

/** O endereço do mapa (Google Maps, sem chave) para o iframe. */
export const enderecoDoMapa = (endereco: string) => `https://www.google.com/maps?q=${encodeURIComponent(endereco)}&output=embed`;

export type LeituraDoBloco = { ok: true; bloco: Bloco } | { ok: false; erro: string };

/** Um bloco como o site guarda: o tipo vem da lista, os textos têm limite, link e imagem só em https, e a imagem exige texto alternativo. */
/** Lê o botão de um destaque: o texto e o endereço (https) vêm juntos, ou nenhum dos dois. */
function lerBotaoDoDestaque(rotulo: unknown, url: unknown, nome: string): { ok: true; rotulo: string; url: string } | { ok: false; erro: string } {
  const r = texto(rotulo), u = texto(url);
  if ((r === "") !== (u === "")) return { ok: false, erro: `O ${nome} precisa do texto e do endereço juntos (ou de nenhum dos dois).` };
  if (r === "") return { ok: true, rotulo: "", url: "" };
  if (r.length > 60) return { ok: false, erro: `O texto do ${nome} tem de ter de 1 a 60 letras.` };
  const l = lerUrlHttps(u);
  return l.ok ? { ok: true, rotulo: r, url: l.url } : { ok: false, erro: `O endereço do ${nome} tem de começar com https://.` };
}

function lerImagemDoDestaque(bruto: unknown, nome: string): { ok: true; url: string } | { ok: false; erro: string } {
  const i = texto(bruto);
  if (i === "") return { ok: true, url: "" };
  const l = lerUrlHttps(i);
  return l.ok ? { ok: true, url: l.url } : { ok: false, erro: `O endereço da ${nome} tem de começar com https://.` };
}

/** O destaque do alto: o layout (sem ele, a imagem de tela cheia) e os campos que ele usa. O carrossel tem de 1 a 5 destaques; o "próximo evento" não pede título (vem do evento). */
function lerDestaque(e: Record<string, unknown>): LeituraDoBloco {
  if (e.layout !== undefined && e.layout !== null && typeof e.layout !== "string") return { ok: false, erro: "Escolha um dos layouts do destaque." };
  const bruto = typeof e.layout === "string" ? e.layout.trim() : "";
  if (bruto !== "" && !(LAYOUTS_DO_DESTAQUE as readonly string[]).includes(bruto)) return { ok: false, erro: "Escolha um dos layouts do destaque." };
  const layout = bruto === "" ? LAYOUT_PADRAO_DO_DESTAQUE : (bruto as LayoutDoDestaque);
  const titulo = texto(e.titulo), subtitulo = texto(e.subtitulo), chamada = texto(e.chamada), info = texto(e.info);
  const semTitulo = layout === "proximo" || layout === "carrossel";
  if (titulo.length > 120 || (titulo === "" && !semTitulo)) return { ok: false, erro: "O título da capa tem de ter de 1 a 120 letras." };
  if (subtitulo.length > 200) return { ok: false, erro: "O subtítulo da capa pode ter até 200 letras." };
  if (chamada.length > 40) return { ok: false, erro: "A chamada pode ter até 40 letras." };
  if (info.length > 120) return { ok: false, erro: "A linha de informação pode ter até 120 letras." };
  const imagem = lerImagemDoDestaque(e.imagem, "imagem de fundo");
  if (!imagem.ok) return imagem;
  const botao = lerBotaoDoDestaque(e.botao_rotulo, e.botao_url, "botão da capa");
  if (!botao.ok) return botao;
  const botao2 = lerBotaoDoDestaque(e.botao2_rotulo, e.botao2_url, "segundo botão");
  if (!botao2.ok) return botao2;
  const slides: SlideDoDestaque[] = [];
  if (layout === "carrossel") {
    const lista = Array.isArray(e.slides) ? e.slides : [];
    if (lista.length < 1 || lista.length > MAX_SLIDES_DO_DESTAQUE) return { ok: false, erro: `O carrossel precisa de 1 a ${MAX_SLIDES_DO_DESTAQUE} destaques.` };
    for (const [n, bruto] of lista.entries()) {
      const x = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
      const t = texto(x.titulo), f = texto(x.frase);
      if (t === "" || t.length > 120) return { ok: false, erro: `Destaque ${n + 1}: o título tem de ter de 1 a 120 letras.` };
      if (f.length > 200) return { ok: false, erro: `Destaque ${n + 1}: a frase pode ter até 200 letras.` };
      const im = lerImagemDoDestaque(x.imagem, `imagem do destaque ${n + 1}`);
      if (!im.ok) return im;
      const bt = lerBotaoDoDestaque(x.botao_rotulo, x.botao_url, `botão do destaque ${n + 1}`);
      if (!bt.ok) return bt;
      slides.push({ titulo: t, frase: f, imagem: im.url, botao_rotulo: bt.rotulo, botao_url: bt.url });
    }
  }
  return { ok: true, bloco: { tipo: "capa", layout, titulo, subtitulo, imagem: imagem.url, botao_rotulo: botao.rotulo, botao_url: botao.url, botao2_rotulo: botao2.rotulo, botao2_url: botao2.url, chamada, info, slides } };
}

export function lerBloco(entrada: unknown): LeituraDoBloco {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  switch (e.tipo) {
    case "titulo": {
      const t = texto(e.texto);
      return t === "" || t.length > 120 ? { ok: false, erro: "O título tem de 1 a 120 letras." } : { ok: true, bloco: { tipo: "titulo", texto: t } };
    }
    case "texto": {
      const t = texto(e.texto);
      return t === "" || t.length > 5000 ? { ok: false, erro: "O texto tem de 1 a 5.000 letras." } : { ok: true, bloco: { tipo: "texto", texto: t } };
    }
    case "imagem": {
      const url = lerUrlHttps(e.url), alt = texto(e.alt);
      if (!url.ok) return { ok: false, erro: "O endereço da imagem tem de começar com https://." };
      if (alt === "" || alt.length > 200) return { ok: false, erro: "Descreva a imagem em até 200 letras (texto alternativo)." };
      return { ok: true, bloco: { tipo: "imagem", url: url.url, alt } };
    }
    case "botao": {
      const url = lerUrlHttps(e.url), rotulo = texto(e.rotulo);
      if (rotulo === "" || rotulo.length > 60) return { ok: false, erro: "O texto do botão tem de 1 a 60 letras." };
      if (!url.ok) return { ok: false, erro: "O endereço do botão tem de começar com https://." };
      return { ok: true, bloco: { tipo: "botao", rotulo, url: url.url } };
    }
    case "programacao": {
      const titulo = texto(e.titulo), espaco = texto(e.espaco_id);
      if (titulo.length > 120) return { ok: false, erro: "O título da programação pode ter até 120 letras." };
      if (espaco !== "" && !UUID.test(espaco)) return { ok: false, erro: "Escolha o espaço da programação." };
      return { ok: true, bloco: { tipo: "programacao", titulo, espaco_id: espaco === "" ? null : espaco.toLowerCase() } };
    }
    case "ingressos": {
      const titulo = texto(e.titulo), evento = texto(e.evento_id);
      if (titulo.length > 120) return { ok: false, erro: "O título dos ingressos pode ter até 120 letras." };
      if (evento !== "" && !UUID.test(evento)) return { ok: false, erro: "Escolha o evento dos ingressos." };
      return { ok: true, bloco: { tipo: "ingressos", titulo, evento_id: evento === "" ? null : evento.toLowerCase() } };
    }
    case "contato": {
      const email = texto(e.email), telefone = texto(e.telefone), endereco = texto(e.endereco);
      if (email === "" && telefone === "" && endereco === "") return { ok: false, erro: "Informe ao menos um contato: e-mail, telefone ou endereço." };
      if (email !== "" && (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) return { ok: false, erro: "O e-mail do contato não parece certo." };
      if (telefone.length > 40) return { ok: false, erro: "O telefone pode ter até 40 letras." };
      if (endereco.length > 200) return { ok: false, erro: "O endereço pode ter até 200 letras." };
      return { ok: true, bloco: { tipo: "contato", email, telefone, endereco } };
    }
    case "capa": return lerDestaque(e);
    case "colunas": {
      const esquerda = lerColuna(e.esquerda, "da esquerda"), direita = lerColuna(e.direita, "da direita");
      if (!esquerda.ok) return esquerda;
      if (!direita.ok) return direita;
      return { ok: true, bloco: { tipo: "colunas", esquerda: esquerda.coluna, direita: direita.coluna } };
    }
    case "galeria": {
      const titulo = texto(e.titulo);
      if (titulo.length > 120) return { ok: false, erro: "O título da galeria pode ter até 120 letras." };
      const entradas = Array.isArray(e.imagens) ? e.imagens : [];
      if (entradas.length < 2 || entradas.length > 12) return { ok: false, erro: "A galeria leva de 2 a 12 imagens." };
      const imagens: ImagemDaGaleria[] = [];
      for (const [n, entrada] of entradas.entries()) {
        const l = lerImagem(entrada, `Imagem ${n + 1}`);
        if (!l.ok) return l;
        imagens.push(l.imagem);
      }
      return { ok: true, bloco: { tipo: "galeria", titulo, imagens } };
    }
    case "video": {
      const titulo = texto(e.titulo);
      if (titulo.length > 120) return { ok: false, erro: "O título do vídeo pode ter até 120 letras." };
      const v = lerVideo(typeof e.url === "string" ? e.url : e.provedor && e.id ? `${e.provedor}:${e.id}` : "");
      if (!v) return { ok: false, erro: "Cole o endereço de um vídeo do YouTube ou do Vimeo." };
      return { ok: true, bloco: { tipo: "video", titulo, provedor: v.provedor, id: v.id } };
    }
    case "mapa": {
      const titulo = texto(e.titulo), endereco = texto(e.endereco);
      if (titulo.length > 120) return { ok: false, erro: "O título do mapa pode ter até 120 letras." };
      if (endereco === "" || endereco.length > 200) return { ok: false, erro: "Escreva o endereço do mapa, com até 200 letras." };
      return { ok: true, bloco: { tipo: "mapa", titulo, endereco } };
    }
    case "contagem": {
      const titulo = texto(e.titulo), depois = texto(e.depois), ate = texto(e.ate);
      if (titulo.length > 120) return { ok: false, erro: "O título da contagem pode ter até 120 letras." };
      if (depois.length > 120) return { ok: false, erro: "A frase de depois da contagem pode ter até 120 letras." };
      const instante = Date.parse(ate);
      if (ate === "" || !Number.isFinite(instante) || !/^\d{4}-\d{2}-\d{2}T/.test(ate)) return { ok: false, erro: "Escolha o dia e a hora do fim da contagem." };
      return { ok: true, bloco: { tipo: "contagem", titulo, ate: new Date(instante).toISOString(), depois } };
    }
    case "faq": {
      const titulo = texto(e.titulo);
      if (titulo.length > 120) return { ok: false, erro: "O título das perguntas pode ter até 120 letras." };
      const entradas = Array.isArray(e.itens) ? e.itens : [];
      if (entradas.length < 1 || entradas.length > 20) return { ok: false, erro: "Escreva de 1 a 20 perguntas." };
      const itens: PerguntaFrequente[] = [];
      for (const [n, entrada] of entradas.entries()) {
        const i = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
        const pergunta = texto(i.pergunta), resposta = texto(i.resposta);
        if (pergunta === "" || pergunta.length > 200) return { ok: false, erro: `Pergunta ${n + 1}: escreva a pergunta, com até 200 letras.` };
        if (resposta === "" || resposta.length > 2000) return { ok: false, erro: `Pergunta ${n + 1}: escreva a resposta, com até 2.000 letras.` };
        itens.push({ pergunta, resposta });
      }
      return { ok: true, bloco: { tipo: "faq", titulo, itens } };
    }
    case "patrocinadores": {
      const titulo = texto(e.titulo);
      if (titulo.length > 120) return { ok: false, erro: "O título dos patrocinadores pode ter até 120 letras." };
      const entradas = Array.isArray(e.itens) ? e.itens : [];
      if (entradas.length < 1 || entradas.length > 12) return { ok: false, erro: "Escreva de 1 a 12 patrocinadores." };
      const itens: Patrocinador[] = [];
      for (const [n, entrada] of entradas.entries()) {
        const i = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
        const l = lerImagem(i, `Patrocinador ${n + 1}`);
        if (!l.ok) return l;
        const link = texto(i.link);
        let urlDoLink = "";
        if (link !== "") { const u = lerUrlHttps(link); if (!u.ok) return { ok: false, erro: `Patrocinador ${n + 1}: o endereço do site tem de começar com https://.` }; urlDoLink = u.url; }
        itens.push({ ...l.imagem, link: urlDoLink });
      }
      return { ok: true, bloco: { tipo: "patrocinadores", titulo, itens } };
    }
    case "agenda": {
      const titulo = texto(e.titulo);
      if (e.layout !== undefined && e.layout !== null && typeof e.layout !== "string") return { ok: false, erro: "Escolha um dos layouts da agenda." };
      const bruto = typeof e.layout === "string" ? e.layout.trim() : "";
      if (bruto !== "" && !(LAYOUTS_DA_AGENDA as readonly string[]).includes(bruto)) return { ok: false, erro: "Escolha um dos layouts da agenda." };
      const layout = bruto === "" ? LAYOUT_PADRAO_DA_AGENDA : (bruto as LayoutDaAgenda);
      return titulo.length > 120 ? { ok: false, erro: "O título da agenda pode ter até 120 letras." } : { ok: true, bloco: { tipo: "agenda", titulo, layout } };
    }
    default:
      return { ok: false, erro: "Escolha o tipo do bloco." };
  }
}

export type LeituraDosBlocos = { ok: true; blocos: Bloco[] } | { ok: false; erro: string };

/** Os blocos de uma página: de 0 a 60, cada um válido. O erro diz qual bloco. */
export function lerBlocos(entradas: readonly unknown[]): LeituraDosBlocos {
  if (entradas.length > MAX_BLOCOS_POR_PAGINA) return { ok: false, erro: `A página aceita até ${MAX_BLOCOS_POR_PAGINA} blocos.` };
  const blocos: Bloco[] = [];
  for (const [indice, entrada] of entradas.entries()) {
    const leitura = lerBloco(entrada);
    if (!leitura.ok) return { ok: false, erro: `Bloco ${indice + 1}: ${leitura.erro}` };
    blocos.push(leitura.bloco);
  }
  return { ok: true, blocos };
}

/** Os blocos que vêm do banco, para desenhar: o que não passa na leitura some (o banco só confere que é uma lista). */
export function blocosDoJson(json: unknown): Bloco[] {
  return (Array.isArray(json) ? json : []).flatMap(entrada => { const leitura = lerBloco(entrada); return leitura.ok ? [leitura.bloco] : []; }).slice(0, MAX_BLOCOS_POR_PAGINA);
}

/** O endereço da página a partir do título ("Quem somos" vira "quem-somos"); vazio vira "pagina". */
export function slugDaPagina(titulo: string, usados: ReadonlySet<string> = new Set()): string {
  const base = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36).replace(/-+$/g, "") || "pagina";
  if (!usados.has(base)) return base;
  for (let n = 2; n < 100; n++) if (!usados.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${usados.size + 1}`;
}

/** A cor do tema ("#RRGGBB"); outra coisa vira o grafite do Jards. */
export function corDoTema(cor: unknown): string {
  return typeof cor === "string" && /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#282525";
}

/** Branco ou grafite, o que fica mais legível sobre a cor do tema (contraste pela luminância). */
export function textoSobreCor(cor: string): "#ffffff" | "#282525" {
  const n = parseInt(corDoTema(cor).slice(1), 16);
  const canal = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const luminancia = 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
  return luminancia > 0.4 ? "#282525" : "#ffffff";
}

// ─── Domínio ────────────────────────────────────────────────────────────────

/** Os endereços do próprio Jards: nunca viram domínio de site (o site abre só no domínio da pessoa). */
const DOMINIOS_DO_JARDS = ["jards.com.br", "vercel.app", "vercel.com", "localhost", "local", "internal", "test", "invalid", "example"];

export type LeituraDoDominio = { ok: true; dominio: string } | { ok: false; erro: string };

/**
 * O domínio como a pessoa digita ("https://www.Casa.com.br/" vira "www.casa.com.br"): sem endereço, caminho, porta nem ponto
 * final; letras minúsculas; com ao menos um ponto; rótulos de até 63 letras. Recusa IP, o domínio do Jards e endereços de teste.
 */
export function lerDominio(bruto: string): LeituraDoDominio {
  let d = bruto.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
  if (d === "") return { ok: false, erro: "Informe o domínio do site, como www.casa.com.br." };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(d)) return { ok: false, erro: "Use o nome do domínio, não o número IP." };
  if (d.length > 253 || !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d)) return { ok: false, erro: "Esse domínio não parece certo. Escreva só o nome, como www.casa.com.br." };
  if (DOMINIOS_DO_JARDS.some(proibido => d === proibido || d.endsWith(`.${proibido}`))) return { ok: false, erro: "Este endereço é do próprio Jards. Use o domínio da sua casa, festival ou companhia." };
  d = d.normalize("NFC");
  return { ok: true, dominio: d };
}

/** O host de um pedido ("Casa.com.br:443" vira "casa.com.br"), para achar o site. Vazio se não for um nome. */
export function hostDoPedido(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

const SEGUNDOS_NIVEIS = new Set(["com.br", "org.br", "net.br", "art.br", "tv.br", "gov.br", "edu.br", "mus.br", "co.uk", "org.uk", "com.au", "com.ar", "com.pt", "co.nz", "co.za"]);

/** O domínio "raiz" (sem www nem outro prefixo)? Nele o DNS usa um registro A; num prefixo, um CNAME. */
export function ehDominioRaiz(dominio: string): boolean {
  const partes = dominio.split(".");
  return partes.length === 2 || (partes.length === 3 && SEGUNDOS_NIVEIS.has(partes.slice(1).join(".")));
}

export type RegistroDeDns = { tipo: "A" | "CNAME" | "TXT"; nome: string; valor: string; para: "apontar" | "provar" };

/** Os valores padrão da Vercel; o servidor usa os que a API dela devolve para o domínio quando existem. */
export const REGISTRO_A_PADRAO = "76.76.21.21";
export const REGISTRO_CNAME_PADRAO = "cname.vercel-dns.com";

/** O prefixo do TXT de posse: prova que quem cadastrou o domínio controla o DNS dele. */
export const PREFIXO_DA_PROVA = "_jards-verificacao";

/**
 * Os dois registros que a pessoa cria no DNS: um que aponta o domínio para o Jards (A no raiz, CNAME no resto) e um TXT com o
 * código de verificação, que prova que ela controla o DNS. Os valores de apontar podem vir da API da Vercel.
 */
export function registrosDeDns(dominio: string, token: string, apontar?: { a?: string; cname?: string }): RegistroDeDns[] {
  const raiz = ehDominioRaiz(dominio);
  return [
    raiz
      ? { tipo: "A", nome: "@ (o próprio domínio)", valor: apontar?.a ?? REGISTRO_A_PADRAO, para: "apontar" }
      : { tipo: "CNAME", nome: dominio.split(".")[0], valor: apontar?.cname ?? REGISTRO_CNAME_PADRAO, para: "apontar" },
    { tipo: "TXT", nome: `${PREFIXO_DA_PROVA}.${dominio}`, valor: token, para: "provar" },
  ];
}

/** Onde procurar o TXT de posse no DNS. */
export const nomeDaProva = (dominio: string) => `${PREFIXO_DA_PROVA}.${dominio}`;

/** O TXT do DNS (uma lista de pedaços por registro) tem o token? */
export function provaConfere(registros: readonly (readonly string[])[], token: string): boolean {
  return registros.some(partes => partes.join("").trim() === token);
}

/** Os espaços da Produção que os blocos de programação mostram, sem repetir. */
export function espacosDosBlocos(blocos: readonly Bloco[]): string[] {
  return [...new Set(blocos.flatMap(bloco => (bloco.tipo === "programacao" && bloco.espaco_id ? [bloco.espaco_id] : [])))];
}

/** Os eventos que os blocos de ingressos mostram, sem repetir. */
export function eventosDosBlocos(blocos: readonly Bloco[]): string[] {
  return [...new Set(blocos.flatMap(bloco => (bloco.tipo === "ingressos" && bloco.evento_id ? [bloco.evento_id] : [])))];
}

/** Ordem simples de um item do menu do site: início primeiro, o resto pela ordem e pelo título. */
export function ordemDasPaginas<T extends { slug: string; ordem: number; titulo: string }>(paginas: readonly T[]): T[] {
  return [...paginas].sort((a, b) => Number(b.slug === "inicio") - Number(a.slug === "inicio") || a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, "pt-BR"));
}

/**
 * O pedido é para o próprio Jards (o app, as páginas públicas, os previews da Vercel) ou para o domínio de uma pessoa? Tudo o que
 * não é do Jards é tratado como domínio de site: se não tem site ativo, a página responde "não encontrado" (o app nunca abre em
 * endereço que não conhece).
 */
export function ehHostDoApp(host: string, urlDoApp?: string): boolean {
  const h = hostDoPedido(host);
  if (h === "" || h === "localhost" || h === "127.0.0.1" || h.endsWith(".localhost")) return true;
  if (h === "jards.com.br" || h.endsWith(".jards.com.br") || h.endsWith(".vercel.app")) return true;
  if (urlDoApp) {
    try {
      const doApp = new URL(urlDoApp).hostname.toLowerCase();
      if (h === doApp || h === `www.${doApp}` || `www.${h}` === doApp) return true;
    } catch {
      // URL do app mal escrita: só valem os endereços acima.
    }
  }
  return false;
}

// ─── SEO ────────────────────────────────────────────────────────────────────

export type LeituraDoSeo = { ok: true; descricao: string | null; imagem_url: string | null } | { ok: false; erro: string };

/** A descrição (até 300 letras) e a imagem de compartilhamento (https) da página; vazio é "sem". */
export function lerSeo(campos: { descricao: string; imagem: string }): LeituraDoSeo {
  const descricao = campos.descricao.trim();
  if (descricao.length > 300) return { ok: false, erro: "A descrição pode ter até 300 letras." };
  const imagem = campos.imagem.trim();
  if (imagem === "") return { ok: true, descricao: descricao === "" ? null : descricao, imagem_url: null };
  const url = lerUrlHttps(imagem);
  if (!url.ok) return { ok: false, erro: "O endereço da imagem tem de começar com https://." };
  return { ok: true, descricao: descricao === "" ? null : descricao, imagem_url: url.url };
}

const escapaXml = (texto: string) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** O endereço completo de uma página do site no domínio da pessoa (a de início é a raiz). */
export const enderecoDaPagina = (host: string, slug: string) => (slug === "inicio" ? `https://${host}/` : `https://${host}/${slug}`);

/** O sitemap.xml do domínio: as páginas publicadas, com a data da última publicação. */
export function sitemapDoSite(host: string, paginas: readonly { slug: string; publicada_em: string | null }[], eventos: readonly { slug: string; atualizado_em: string }[] = []): string {
  const daspaginas = paginas.map(pagina => `  <url><loc>${escapaXml(enderecoDaPagina(host, pagina.slug))}</loc>${pagina.publicada_em ? `<lastmod>${escapaXml(pagina.publicada_em.slice(0, 10))}</lastmod>` : ""}</url>`);
  const dosEventos = eventos.map(evento => `  <url><loc>${escapaXml(`https://${host}/e/${evento.slug}`)}</loc><lastmod>${escapaXml(evento.atualizado_em.slice(0, 10))}</lastmod></url>`);
  const itens = [...daspaginas, ...dosEventos].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${itens}\n</urlset>\n`;
}

/** O robots.txt do domínio: libera tudo e aponta o sitemap quando o site está no ar; fecha quando não. */
export function robotsDoSite(host: string, noAr: boolean): string {
  return noAr ? `User-agent: *\nAllow: /\nSitemap: https://${host}/sitemap.xml\n` : "User-agent: *\nDisallow: /\n";
}


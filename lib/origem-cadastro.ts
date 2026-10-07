// Origem do cadastro: de qual campanha (utm) e de qual clique de anúncio
// (gclid) veio cada conta. As utm ficam com a conta para medição interna;
// o identificador do clique só fica com o aceite do aviso de cookies, porque
// é ele que vai para o Google Ads como conversão (ver §10 da Política).

export const CAMPOS_CAMPANHA = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export const CAMPOS_CLIQUE = ["gclid", "gbraid", "wbraid"] as const;

type Campo = (typeof CAMPOS_CAMPANHA)[number] | (typeof CAMPOS_CLIQUE)[number];

export type OrigemCadastro = Partial<Record<Campo, string>> & { capturada_em?: string };

// Nomes das ações de conversão no Google Ads. Precisam bater letra por letra
// com as ações criadas em Metas > Conversões.
export const CONVERSAO_CADASTRO = "Cadastro Jards";
export const CONVERSAO_ASSINATURA = "Assinatura Jards";

// Valor mensal de cada plano pago, o mesmo de /meu-plano.
export const PRECO_MENSAL: Record<string, number> = { basico: 62.9, profissional: 92.8 };

// O Google Ads recusa conversões de cliques com mais de 90 dias.
export const JANELA_CLIQUE_DIAS = 90;

const CHAVE_CONSENTIMENTO = "jards_consentimento_cookies";
// A mesma versão de public/consentimento.js: aceite de versão antiga não vale.
const VERSAO_CONSENTIMENTO = 2;
const LIMITE = 200;

export function lerOrigem(params: URLSearchParams, incluirClique: boolean, agora = new Date()): OrigemCadastro | null {
  const origem: OrigemCadastro = {};
  const campos: readonly Campo[] = incluirClique ? [...CAMPOS_CAMPANHA, ...CAMPOS_CLIQUE] : CAMPOS_CAMPANHA;
  for (const campo of campos) {
    const valor = params.get(campo)?.trim();
    if (valor) origem[campo] = valor.slice(0, LIMITE);
  }
  if (Object.keys(origem).length === 0) return null;
  origem.capturada_em = agora.toISOString();
  return origem;
}

// Mesma escolha gravada pelo aviso de cookies (public/consentimento.js).
export function consentiuMedicao(): boolean {
  try {
    const escolha = JSON.parse(localStorage.getItem(CHAVE_CONSENTIMENTO) ?? "null");
    return escolha?.versao === VERSAO_CONSENTIMENTO && escolha.analytics === true;
  } catch {
    return false;
  }
}

export function anexarOrigem(url: URL, origem: OrigemCadastro | null) {
  if (!origem) return;
  for (const campo of [...CAMPOS_CAMPANHA, ...CAMPOS_CLIQUE]) {
    const valor = origem[campo];
    if (valor) url.searchParams.set(campo, valor);
  }
}

export type Conversao = { gclid: string; nome: string; quando: Date; valor?: number | null };

export type UsuarioComOrigem = {
  id: string;
  created_at: string;
  email_confirmed_at?: string | null;
  origem: OrigemCadastro;
};

export type PrimeiroPagamento = { user_id: string; processed_at: string };

// Cadastro conta quando o e-mail foi confirmado; assinatura, no primeiro
// pagamento aprovado, com o valor mensal do plano atual.
export function montarConversoes(
  usuarios: UsuarioComOrigem[],
  pagamentos: PrimeiroPagamento[],
  planos: Record<string, string | null>,
  agora = new Date(),
): Conversao[] {
  const limite = agora.getTime() - JANELA_CLIQUE_DIAS * 24 * 60 * 60 * 1000;
  const primeiroPagamento = new Map<string, string>();
  for (const pagamento of pagamentos) {
    const atual = primeiroPagamento.get(pagamento.user_id);
    if (!atual || pagamento.processed_at < atual) primeiroPagamento.set(pagamento.user_id, pagamento.processed_at);
  }

  const conversoes: Conversao[] = [];
  for (const usuario of usuarios) {
    const gclid = usuario.origem.gclid;
    if (!gclid || !usuario.email_confirmed_at) continue;
    const clique = new Date(usuario.origem.capturada_em ?? usuario.created_at).getTime();
    if (clique < limite) continue;

    conversoes.push({ gclid, nome: CONVERSAO_CADASTRO, quando: new Date(usuario.email_confirmed_at) });

    const pago = primeiroPagamento.get(usuario.id);
    if (pago) {
      const plano = planos[usuario.id];
      conversoes.push({
        gclid,
        nome: CONVERSAO_ASSINATURA,
        quando: new Date(pago),
        valor: plano ? PRECO_MENSAL[plano] ?? null : null,
      });
    }
  }
  return conversoes.sort((a, b) => a.quando.getTime() - b.quando.getTime());
}

const FORMATO_HORA = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function celula(valor: string) {
  return /[",\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

// Modelo "Importar conversões de cliques" do Google Ads.
export function csvConversoesGoogleAds(conversoes: Conversao[]): string {
  const linhas = [
    "Parameters:TimeZone=America/Sao_Paulo",
    "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
    ...conversoes.map((c) =>
      [
        celula(c.gclid),
        celula(c.nome),
        FORMATO_HORA.format(c.quando),
        c.valor != null ? c.valor.toFixed(2) : "",
        c.valor != null ? "BRL" : "",
      ].join(","),
    ),
  ];
  return linhas.join("\n") + "\n";
}

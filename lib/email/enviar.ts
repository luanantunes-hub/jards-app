import type { EmailProvider } from "./config";
import { getEmailConnection, getValidEmailAccessToken } from "./connections";
import { montarMensagemDoGmail, podeEnviarPelaConexao, type PedidoDeEnvio } from "./envio";
import { enviarPeloGmail } from "./google";
import { enviarPelaMicrosoft, responderPelaMicrosoft } from "./microsoft";
import { NOME_DO_PROVEDOR } from "./conversas";

/** A mensagem a que o e-mail responde, como o provedor a conhece. */
export type MensagemRespondida = { messageId: string; threadId: string | null; internetMessageId: string | null };

export type CodigoDoErroDeEnvio = "sem-conexao" | "sem-permissao" | "provedor";

/** Falha ao enviar, com o motivo: a rota e o agendador decidem o que fazer (reconectar, tentar de novo). */
export class ErroDeEnvio extends Error {
  constructor(readonly codigo: CodigoDoErroDeEnvio, mensagem: string) {
    super(mensagem);
  }
}

/**
 * Envia pela caixa da própria pessoa (Gmail ou Outlook), então a cópia fica em Enviados e a próxima sincronização
 * a traz de volta. Exige a permissão de envio: quem conectou antes de ela ser pedida precisa reconectar.
 */
export async function enviarPelaConta(userId: string, provider: EmailProvider, pedido: Pick<PedidoDeEnvio, "para" | "cc" | "cco" | "assunto" | "texto" | "fonte">, resposta: MensagemRespondida | null): Promise<void> {
  const nome = NOME_DO_PROVEDOR[provider];
  const conexao = await getEmailConnection(userId, provider);
  if (!conexao) throw new ErroDeEnvio("sem-conexao", `Conecte seu ${nome} em Configurações › Minhas ferramentas para enviar.`);
  if (!podeEnviarPelaConexao(provider, conexao.scopes)) {
    throw new ErroDeEnvio("sem-permissao", `Reconecte seu ${nome} em Configurações › Minhas ferramentas e autorize o envio de e-mails.`);
  }

  const accessToken = await getValidEmailAccessToken(userId, provider);
  try {
    if (provider === "google") {
      const raw = montarMensagemDoGmail({
        de: conexao.provider_account_email ?? "",
        para: pedido.para,
        cc: pedido.cc,
        cco: pedido.cco,
        assunto: pedido.assunto,
        texto: pedido.texto,
        fonte: pedido.fonte,
        respondendoA: resposta?.internetMessageId ?? null,
      });
      await enviarPeloGmail(accessToken, raw, resposta?.threadId ?? null);
    } else if (resposta) {
      await responderPelaMicrosoft(accessToken, resposta.messageId, pedido);
    } else {
      await enviarPelaMicrosoft(accessToken, pedido);
    }
  } catch (erro) {
    throw new ErroDeEnvio("provedor", erro instanceof Error ? erro.message : `Falha ao enviar pelo ${nome}.`);
  }
}

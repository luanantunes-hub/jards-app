// O aviso da lista de espera, do lado do servidor: o banco marca e devolve as próximas pessoas da fila, o e-mail sai para cada uma e, se algum não sair, aquela
// pessoa volta para a vez (assim ninguém perde o aviso por uma falha de e-mail). As portas (banco e e-mail) são injetadas: a lógica é testada sem rede e sem banco.

import { emailDoAviso } from "@/lib/ticketeria/espera";

export type PessoaParaAvisar = { id: string; nome: string; email: string; token: string; quantidade: number };
export type DadosDoAviso = { evento: string; ingresso: string; quando: string };

export type PortasDoAviso = {
  /** fn_ticketeria_espera_avisar: marca e devolve as próximas pessoas da fila. Os erros do banco saem como Error com o nome (sem_lugar...). */
  avisar(loja: string, sessao: string, ingresso: string, quantas: number): Promise<PessoaParaAvisar[]>;
  /** fn_ticketeria_espera_desfazer_aviso. */
  desfazer(ids: string[]): Promise<void>;
  /** O nome do evento e do ingresso e o dia e a hora da sessão, para o e-mail. */
  dados(sessao: string, ingresso: string): Promise<DadosDoAviso>;
  enviarEmail(para: string, mensagem: { assunto: string; texto: string; html: string }): Promise<boolean>;
  /** O endereço da página de compra da sessão e o da página de sair da lista (com o token da pessoa). */
  enderecoDeCompra(sessao: string): string;
  enderecoParaSair(token: string): string;
  registrarErro?(erro: unknown): void;
};

export type ResultadoDoAviso = { avisadas: number; falharam: number };

export async function avisarEspera(entrada: { loja: string; sessao: string; ingresso: string; quantas: number }, portas: PortasDoAviso): Promise<ResultadoDoAviso> {
  const pessoas = await portas.avisar(entrada.loja, entrada.sessao, entrada.ingresso, entrada.quantas);
  if (pessoas.length === 0) return { avisadas: 0, falharam: 0 };
  const falharam: string[] = [];
  try {
    const dados = await portas.dados(entrada.sessao, entrada.ingresso);
    for (const p of pessoas) {
      try {
        const ok = await portas.enviarEmail(p.email, emailDoAviso({ nome: p.nome, ...dados, enderecoDeCompra: portas.enderecoDeCompra(entrada.sessao), enderecoParaSair: portas.enderecoParaSair(p.token) }));
        if (!ok) falharam.push(p.id);
      } catch (erro) {
        portas.registrarErro?.(erro);
        falharam.push(p.id);
      }
    }
  } catch (erro) {
    // Sem os dados do e-mail ninguém foi avisado: todos voltam para a vez.
    portas.registrarErro?.(erro);
    falharam.splice(0, falharam.length, ...pessoas.map(p => p.id));
  }
  if (falharam.length > 0) {
    try { await portas.desfazer(falharam); } catch (erro) { portas.registrarErro?.(erro); }
  }
  return { avisadas: pessoas.length - falharam.length, falharam: falharam.length };
}

// O parcelamento no cartão como o produtor o escolhe (Recebimentos): até quantas vezes a loja oferece (`ticketeria_lojas.parcelas_max`, 1 = só à vista, até 6). Só texto e conta,
// sem banco e sem tela (roda no navegador e nos testes). Tela aprovada pelo dono em 20/11/2026.

import { PARCELAS_MAXIMAS } from "@/lib/ticketeria/estados";

/** As escolhas da folha, de 1 (só à vista) até o máximo que as faixas de custo cobrem. */
export const ESCOLHAS_DE_PARCELAS: readonly number[] = Array.from({ length: PARCELAS_MAXIMAS }, (_, i) => i + 1);

/** O valor guardado na loja, conferido: inteiro de 1 a 6; qualquer outra coisa vira 1 (só à vista). */
export function parcelasDaLoja(valor: unknown): number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 1 && valor <= PARCELAS_MAXIMAS ? valor : 1;
}

/** "Só à vista" ou "Até 3x". */
export const rotuloDaEscolha = (n: number): string => (n <= 1 ? "Só à vista" : `Até ${n}x`);

/** A frase do cartão da página: o que o comprador vê hoje. */
export function frasesDoParcelamento(max: number): string {
  return max <= 1
    ? "Hoje o comprador paga o cartão à vista. Você pode deixá-lo dividir em até 6 vezes, sem juros para ele."
    : `O comprador pode dividir em até ${max}x, sem juros para ele. O custo das parcelas sai do valor que você recebe.`;
}

/** O aviso da folha: quem arca com o custo e quando o dinheiro chega. */
export const AVISO_DO_PARCELAMENTO =
  "O custo do cartão parcelado (taxa do Asaas, que muda com o contrato) sai do valor que você recebe. O comprador paga tudo no ato, mas o dinheiro das parcelas cai mês a mês na sua conta.";

/** O erro do banco ao gravar o parcelamento, numa frase. */
export function mensagemDoErroDoParcelamento(erro: { code?: string; message?: string }): string {
  if (erro.code === "42501") return "Você não pode mudar a Ticketeria desta organização.";
  return "Não foi possível salvar o parcelamento. Tente de novo.";
}

"""O job semanal do modelo de marketing: para cada loja com dados prontos, baixa a tabela semanal, ajusta o modelo e devolve o resultado ao Jards.

Uso: MODELO_BASE_URL=https://jards.com.br MODELO_TOKEN=… python modelo/rodar.py [id-da-loja]
Uma falha numa loja não derruba as outras (a frase vai ao Jards e aparece na aba Modelo). O código de saída é 1 só se não deu para falar com o Jards ou se TODAS as lojas falharam.
"""
from __future__ import annotations

import os
import sys

from cliente import ClienteDoJards, ErroDoJards
from mmm import SemDadosSuficientes, ajustar

FRASE_DE_FALHA_PADRAO = "O modelo não conseguiu rodar esta semana. O Jards tenta de novo na próxima segunda."


def processar_loja(cliente: ClienteDoJards, loja: str) -> bool:
    """Ajusta e envia uma loja. True se o resultado foi gravado; False se a rodada falhou (e a falha foi registrada)."""
    try:
        resultado = ajustar(cliente.tabela(loja))
    except SemDadosSuficientes as e:
        print(f"[{loja}] sem dados suficientes: {e}")
        cliente.enviar_falha(loja, str(e))
        return False
    except ErroDoJards:
        raise
    except Exception as e:  # o modelo pode falhar de muitas formas (convergência, dado estranho): registra a frase e segue com as outras lojas
        print(f"[{loja}] o ajuste falhou: {type(e).__name__}")
        cliente.enviar_falha(loja, FRASE_DE_FALHA_PADRAO)
        return False
    resposta = cliente.enviar_resultado(loja, resultado)
    print(f"[{loja}] gravado: confiança {resposta.get('confianca')}, {resultado['semanas']} semanas, r-hat {resultado['diagnosticos']['r_hat_maximo']}")
    return True


def main(argv: list[str]) -> int:
    base, token = os.environ.get("MODELO_BASE_URL", ""), os.environ.get("MODELO_TOKEN", "")
    if not base or not token:
        print("Faltam MODELO_BASE_URL e MODELO_TOKEN.", file=sys.stderr)
        return 1
    try:
        cliente = ClienteDoJards(base, token)
        lojas = [{"id": argv[1]}] if len(argv) > 1 else cliente.lojas_prontas()
        if not lojas:
            print("Nenhuma loja com dados prontos esta semana.")
            return 0
        resultados = [processar_loja(cliente, str(l["id"])) for l in lojas]
    except (ErroDoJards, ValueError) as e:
        print(f"Não deu para falar com o Jards: {e}", file=sys.stderr)
        return 1
    print(f"{sum(resultados)} de {len(resultados)} lojas gravadas.")
    return 0 if any(resultados) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))

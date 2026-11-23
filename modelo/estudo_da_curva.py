"""Estudo da curva da casa: quando a venda de verdade se concentra perto da data (mais da metade nas duas últimas semanas), usar a CURVA DA CASA no controle de proximidade, no lugar
da rampa padrão, deixa o modelo mais perto da verdade? Roda o modelo duas vezes nos mesmos dados inventados (uma com a rampa, outra com a curva verdadeira) e compara o erro.
Uso: python estudo_da_curva.py"""
from __future__ import annotations

import numpy as np

from dados_sinteticos import gerar
from mmm import ajustar

CURVA = [0.35, 0.22, 0.13, 0.09, 0.07, 0.05, 0.04, 0.03, 0.02]  # semana da sessão, 1 antes, ..., 8 antes (a da tela 47)


def rodar(com_curva: bool, semente: int) -> dict:
    tabela, verdade = gerar(semanas=104, semente=semente, com_controles=True, curva_da_proximidade=CURVA)
    if com_curva:
        c = np.asarray(CURVA) / max(CURVA)
        for i, linha in enumerate(tabela):
            ate = (13 - 1 - i % 13) % 13
            linha["controles"]["proximidade"] = round(float(c[ate]) if ate <= 8 else 0.0, 4)
    r = ajustar(tabela, draws=600, tune=600)
    erro_canais = float(np.mean([abs(c["porcento"] - verdade[c["canal"]]) for c in r["canais"]]))
    prox = next((p["porcento"] for p in r["base"]["partes"] if p["chave"] == "proximidade"), 0.0)
    return {"erro_medio_canais": round(erro_canais, 2), "proximidade": prox, "proximidade_verdade": round(verdade["parte:proximidade"], 2)}


if __name__ == "__main__":
    for semente in (7, 11, 21):
        print(semente, "rampa:", rodar(False, semente), "| curva da casa:", rodar(True, semente), flush=True)

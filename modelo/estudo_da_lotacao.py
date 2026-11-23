"""Estudo da lotação: quando a procura passa da lotação (as sessões esgotam), a venda bate no teto e o modelo pode achar que o anúncio rende pouco. Mede o erro de cada canal em três jeitos:
o modelo sem saber do teto, o modelo com a coluna "esgotou" como controle (para rodar este estudo, recoloque o grupo "esgotou" em GRUPOS_DE_CONTROLE de mmm.py) (a parte do que estava à venda que já tinha esgotado) e, como referência, os mesmos dados SEM teto (o melhor possível).
Uso: python estudo_da_lotacao.py"""
from __future__ import annotations

import copy

import numpy as np

from dados_sinteticos import gerar
from mmm import ajustar


def erro(r: dict, verdade: dict) -> float:
    return float(np.mean([abs(c["porcento"] - verdade[c["canal"]]) for c in r["canais"]]))


def soma(r: dict) -> float:
    return round(sum(c["porcento"] for c in r["canais"]), 1)


if __name__ == "__main__":
    for semente in (7, 11, 21):
        livre, verdade = gerar(semanas=104, semente=semente)
        teto = float(np.quantile([l["ingressos"] for l in livre], 0.75))  # um quarto das semanas esgota
        com_teto, _ = gerar(semanas=104, semente=semente, lotacao=teto)
        sem_controle = copy.deepcopy(com_teto)
        for linha in sem_controle:
            linha.pop("controles", None)
        r_livre = ajustar(livre, draws=600, tune=600)
        r_sem = ajustar(sem_controle, draws=600, tune=600)
        r_com = ajustar(com_teto, draws=600, tune=600)
        semanas = sum(1 for l in com_teto if l["controles"]["esgotou"] > 0)
        print(f"semente {semente} ({semanas} semanas esgotadas): verdade dos canais {round(sum(v for k, v in verdade.items() if k != 'base'), 1)}% | "
              f"sem teto: erro {erro(r_livre, verdade):.2f}, canais {soma(r_livre)}% | com teto e sem o controle: erro {erro(r_sem, verdade):.2f}, canais {soma(r_sem)}% | "
              f"com teto e o controle: erro {erro(r_com, verdade):.2f}, canais {soma(r_com)}%", flush=True)

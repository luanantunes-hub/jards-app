"""Estudo da urgência: "restam poucos lugares" faz comprar mais rápido (Jørgensen e Zaccour, Journal of Economic Dynamics & Control, 2019). É "venda puxa venda", como o boca a boca
(estudo_do_boca_a_boca.py), mas cresce até esgotar em vez de sumir no fim. A pergunta: o modelo separa os dois, ou só mede a soma?

Dois tamanhos de sala: uma grande (os eventos vendem até metade dos lugares; aí z e z(1 − z) andam quase juntos) e uma que chega perto de lotar (aí as duas formas se afastam).
Em cada uma, três mundos (só boca a boca, só urgência, os dois) e dois modelos: só o controle "boca" (z(1 − z)) e os dois controles ("boca" e "urgencia" = z).
Uso: python estudo_da_urgencia.py"""
from __future__ import annotations

import numpy as np

import mmm
from dados_sinteticos import VERDADE, gerar
from mmm import ajustar

SEMANAS = 104
BOCA = {"parte": "boca", "chaves": ["boca"], "extra": False}
URGENCIA = {"parte": "urgencia", "chaves": ["urgencia"], "extra": False}
# Sala: público (lugares por evento) e a força da urgência que dá cerca de 10% das vendas.
SALAS = {"grande": (4000.0, 80.0), "lota": (2000.0, 40.0)}


def erro(r: dict, verdade: dict) -> float:
    return float(np.mean([abs(c["porcento"] - verdade[c["canal"]]) for c in r["canais"]]))


def parte(r: dict, chave: str) -> tuple[float, str]:
    p = next((x for x in r["base"]["partes"] if x["chave"] == chave), None)
    return (p["porcento"], f"{p['porcento']:.1f}% [{p['baixo']:.1f}; {p['alto']:.1f}]") if p else (0.0, "—")


if __name__ == "__main__":
    originais = list(mmm.GRUPOS_DE_CONTROLE)
    for sala, (publico, forca_da_urgencia) in SALAS.items():
        for mundo, boca, urgencia in (("só boca", 0.03, None), ("só urgência", None, forca_da_urgencia), ("os dois", 0.03, forca_da_urgencia)):
            for semente in (7, 11, 21):
                tabela, verdade = gerar(semanas=SEMANAS, semente=semente, com_controles=True, boca_a_boca=boca, urgencia=urgencia, publico=publico)
                vb, vu = verdade.get("parte:boca", 0.0), verdade.get("parte:urgencia", 0.0)
                linha = [f"sala {sala} | {mundo} | semente {semente} | verdade: boca {vb:.1f}%, urgência {vu:.1f}%, soma {vb + vu:.1f}%"]
                for nome, extras in (("só boca", [BOCA]), ("boca + urgência", [BOCA, URGENCIA])):
                    mmm.GRUPOS_DE_CONTROLE = [*originais[:3], *extras, *originais[3:]]
                    r = ajustar(tabela, draws=600, tune=600)
                    pb, tb = parte(r, "boca")
                    pu, tu = parte(r, "urgencia")
                    linha.append(f"modelo {nome}: boca {tb}, urgência {tu}, soma {pb + pu:.1f}%, proximidade {parte(r, 'proximidade')[1]}, erro dos canais {erro(r, verdade):.2f}, r-hat {r['diagnosticos']['r_hat_maximo']}")
                mmm.GRUPOS_DE_CONTROLE = originais
                print(" || ".join(linha), flush=True)

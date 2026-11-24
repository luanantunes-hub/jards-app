"""Estudo do boca a boca: quando quem já comprou puxa novas vendas (Bass, 1969; Jørgensen, Kort e Zaccour, Automatica 2006), o modelo de marketing erra os canais? E um controle
"boca" (z(1 − z), com z = a parte dos lugares já vendida do evento antes da semana) mede o boca a boca sem inventá-lo onde ele não existe?

Para cada força de boca a boca (0 = não existe) e cada semente, compara o modelo como está (sem o controle) com o modelo com o controle. A verdade de cada canal sai de dois jeitos:
DIRETA (o que o anúncio vende sozinho) e TOTAL (com o boca a boca que as vendas do anúncio puxam depois, medida pelo contrafactual: o mesmo mundo sem o canal).
Uso: python estudo_do_boca_a_boca.py"""
from __future__ import annotations

import copy

import numpy as np

import mmm
from dados_sinteticos import VERDADE, gerar
from mmm import ajustar

SEMANAS = 104
GRUPO_DA_BOCA = {"parte": "boca", "chaves": ["boca"], "extra": False}


def erro(r: dict, verdade: dict) -> float:
    return float(np.mean([abs(c["porcento"] - verdade[c["canal"]]) for c in r["canais"]]))


def soma(r: dict) -> float:
    return round(sum(c["porcento"] for c in r["canais"]), 1)


def parte(r: dict, chave: str) -> str:
    p = next((x for x in r["base"]["partes"] if x["chave"] == chave), None)
    return f"{p['porcento']:.1f}% [{p['baixo']:.1f}; {p['alto']:.1f}]" if p else "—"


def verdade_total(semente: int, forca: float) -> dict[str, float]:
    """O efeito total de cada canal (com o boca a boca que ele puxa): o que o mundo vende a menos sem ele, em % das vendas."""
    cheio, _ = gerar(semanas=SEMANAS, semente=semente, com_controles=True, boca_a_boca=forca)
    total = sum(l["ingressos"] for l in cheio)
    saida = {}
    for canal in VERDADE:
        sem, _ = gerar(semanas=SEMANAS, semente=semente, com_controles=True, boca_a_boca=forca, sem_canal=canal)
        saida[canal] = (total - sum(l["ingressos"] for l in sem)) / total * 100
    return saida


if __name__ == "__main__":
    grupos_originais = list(mmm.GRUPOS_DE_CONTROLE)
    for forca in (0.0, 0.03, 0.06):
        for semente in (7, 11, 21):
            tabela, direta = gerar(semanas=SEMANAS, semente=semente, com_controles=True, boca_a_boca=forca)
            total = verdade_total(semente, forca)
            sem_controle = copy.deepcopy(tabela)
            for linha in sem_controle:
                linha["controles"].pop("boca", None)
            mmm.GRUPOS_DE_CONTROLE = grupos_originais
            r_sem = ajustar(sem_controle, draws=600, tune=600)
            mmm.GRUPOS_DE_CONTROLE = [*grupos_originais[:3], GRUPO_DA_BOCA, *grupos_originais[3:]]
            r_com = ajustar(tabela, draws=600, tune=600)
            print(f"boca {forca} semente {semente}: boca de verdade {direta.get('parte:boca', 0):.1f}% | canais direta {sum(direta[c] for c in VERDADE):.1f}%, total {sum(total.values()):.1f}% | "
                  f"SEM controle: erro direta {erro(r_sem, direta):.2f}, total {erro(r_sem, total):.2f}, canais {soma(r_sem)}%, proximidade {parte(r_sem, 'proximidade')}, r-hat {r_sem['diagnosticos']['r_hat_maximo']} | "
                  f"COM controle: erro direta {erro(r_com, direta):.2f}, total {erro(r_com, total):.2f}, canais {soma(r_com)}%, boca {parte(r_com, 'boca')}, proximidade {parte(r_com, 'proximidade')}, r-hat {r_com['diagnosticos']['r_hat_maximo']}", flush=True)

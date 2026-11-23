"""Estudo do EFEITO TOTAL do anúncio: o modelo mede o que cada canal vende sozinho, mas com boca a boca e urgência o anúncio vende mais, porque quem ele traz traz outros e a sala
que enche acelera o resto (ESTUDO-DO-BOCA-A-BOCA.md). A conta proposta, feita no Jards (que tem as sessões): tira as vendas do canal semana a semana (o `por_semana` do resultado), refaz a
parte vendida de cada sessão e, com a força medida do boca a boca e da urgência (`efeito_por_unidade`), soma o que deixaria de vender por isso, semana após semana.

Aqui as sessões são os blocos de 13 semanas de dados_sinteticos.py (uma sessão no fim de cada bloco, com `publico` lugares), e a verdade sai do contrafactual: o mesmo mundo, com o mesmo
sorteio, sem o canal. Compara o erro do efeito DIRETO (o que a tela mostra hoje) e o da conta do efeito TOTAL contra o efeito total verdadeiro.
Uso: python estudo_do_efeito_total.py"""
from __future__ import annotations

import numpy as np

from dados_sinteticos import VERDADE, gerar
from mmm import ajustar

SEMANAS = 104


def total_verdadeiro(semente: int, kw: dict) -> dict[str, float]:
    cheio, _ = gerar(semanas=SEMANAS, semente=semente, com_controles=True, **kw)
    soma = sum(l["ingressos"] for l in cheio)
    return {c: (soma - sum(l["ingressos"] for l in gerar(semanas=SEMANAS, semente=semente, com_controles=True, sem_canal=c, **kw)[0])) / soma * 100 for c in VERDADE}


def total_estimado(tabela: list[dict], r: dict, publico: float) -> dict[str, float]:
    """A conta do efeito total: para cada canal, a semana sem ele vende o que vendia menos o canal menos o que o boca a boca e a urgência perdem (com a parte vendida refeita)."""
    y = np.array([l["ingressos"] for l in tabela], dtype=float)
    z = np.array([l["controles"]["urgencia"] for l in tabela], dtype=float)
    por = {p["chave"]: p.get("efeito_por_unidade") or 0.0 for p in r["base"]["partes"]}
    bb, bu = por.get("boca", 0.0), por.get("urgencia", 0.0)
    saida = {}
    for c in r["canais"]:
        canal = np.array(c["por_semana"], dtype=float)
        sem = np.zeros_like(y)
        acumulado = 0.0
        for t in range(len(y)):
            if t % 13 == 0:
                acumulado = 0.0
            z2 = min(1.0, acumulado / publico)
            perdido = bb * (z[t] * (1 - z[t]) - z2 * (1 - z2)) + bu * (z[t] - z2)
            sem[t] = max(0.0, y[t] - canal[t] - perdido)
            acumulado += sem[t]
        saida[c["canal"]] = float((y - sem).sum() / y.sum() * 100)
    return saida


def erro(est: dict[str, float], verdade: dict[str, float]) -> float:
    return float(np.mean([abs(est[c] - verdade[c]) for c in verdade if c in est]))


if __name__ == "__main__":
    for nome, kw, publico in (("sala grande, boca a boca e urgência", {"boca_a_boca": 0.03, "urgencia": 80.0, "publico": 4000.0}, 4000.0),
                              ("sala que lota, boca a boca e urgência", {"boca_a_boca": 0.03, "urgencia": 40.0, "publico": 2000.0}, 2000.0),
                              ("sem boca a boca nem urgência", {"boca_a_boca": 0.0, "urgencia": 0.0, "publico": 4000.0}, 4000.0)):
        for semente in (7, 11, 21):
            tabela, _ = gerar(semanas=SEMANAS, semente=semente, com_controles=True, **kw)
            verdade = total_verdadeiro(semente, kw)
            r = ajustar(tabela, draws=600, tune=600)
            direto = {c["canal"]: c["porcento"] for c in r["canais"]}
            total = total_estimado(tabela, r, publico)
            print(f"{nome} | semente {semente} | total verdadeiro dos canais {sum(verdade.values()):.1f}% | DIRETO: soma {sum(direto.values()):.1f}%, erro {erro(direto, verdade):.2f} | "
                  f"TOTAL pela conta: soma {sum(total.values()):.1f}%, erro {erro(total, verdade):.2f} | por canal (verdade/direto/total): "
                  + ", ".join(f"{c} {verdade[c]:.1f}/{direto.get(c, 0):.1f}/{total.get(c, 0):.1f}" for c in VERDADE) + f" | r-hat {r['diagnosticos']['r_hat_maximo']}", flush=True)

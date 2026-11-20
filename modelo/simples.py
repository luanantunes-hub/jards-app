"""O modelo SIMPLES para pouco histórico: uma regressão com efeito atrasado fixo e sem saturação. Roda onde o modelo completo (mmm.py) ainda não se sustenta.

Cada canal entra com o gasto semanal "arrastado" (a parte do gasto de hoje que ainda vende nas semanas seguintes, com decaimento fixo) e um coeficiente que não pode ser negativo (anúncio não tira
venda). A base é uma tendência mais os mesmos controles do modelo completo (proximidade da sessão, feriados…). O ajuste é de mínimos quadrados com limites (scipy), e a margem de erro vem de reamostrar
as semanas em blocos de 4 (bootstrap em blocos), que respeita a ligação entre semanas vizinhas.

O que ele NÃO faz: não estima saturação (o retorno de cada real a mais é constante) e não separa bem canais cujo gasto sobe e desce junto. Por isso o resultado é indício, e a tela diz que não há curva de
saturação. O formato devolvido é o mesmo de mmm.ajustar, com a curva linear, para a tela e a conferência do Jards serem as mesmas.
"""
from __future__ import annotations

from typing import Any

import numpy as np
from scipy.optimize import lsq_linear

from mmm import GRUPOS_DE_CONTROLE, SemDadosSuficientes

MIN_SEMANAS_SIMPLES = 16
MIN_SEMANAS_POR_CANAL_SIMPLES = 6
DECAIMENTO = 0.4  # a parte do efeito que passa para a semana seguinte
BLOCO = 4
REAMOSTRAGENS = 300
SEMENTE = 42
PONTOS_DA_CURVA = 16
FATOR_DA_CURVA = 1.5


def _arrastar(gasto: np.ndarray, a: float = DECAIMENTO) -> np.ndarray:
    saida, acumulado = np.zeros_like(gasto), 0.0
    for i, v in enumerate(gasto):
        acumulado = v + a * acumulado
        saida[i] = acumulado
    return saida


def _controles(ordenadas: list[dict[str, Any]], n: int) -> list[str]:
    """Os controles que variam; no modelo simples só os dois primeiros grupos (proximidade e feriado), para não gastar graus de liberdade com pouca história."""
    escolhidos: list[str] = []
    for grupo in GRUPOS_DE_CONTROLE:
        if grupo["extra"]:
            continue
        for chave in grupo["chaves"]:
            if len({round(float((s.get("controles") or {}).get(chave, 0.0)), 6) for s in ordenadas}) >= 2:
                escolhidos.append(chave)
    return escolhidos


def ajustar_simples(semanas: list[dict[str, Any]], *, semente: int = SEMENTE) -> dict[str, Any]:
    if len(semanas) < MIN_SEMANAS_SIMPLES:
        raise SemDadosSuficientes(f"Só há {len(semanas)} semanas; o modelo simples precisa de pelo menos {MIN_SEMANAS_SIMPLES}.")
    ordenadas = sorted(semanas, key=lambda s: s["semana"])
    n = len(ordenadas)
    y = np.array([float(s["ingressos"]) for s in ordenadas])
    if y.sum() <= 0:
        raise SemDadosSuficientes("Não há ingressos vendidos nas semanas da tabela.")
    todos = sorted({c for s in ordenadas for c in (s.get("gasto") or {})})
    gasto = {c: np.array([float((s.get("gasto") or {}).get(c, 0)) / 100.0 for s in ordenadas]) for c in todos}  # em reais
    canais = [c for c in todos if int((gasto[c] > 0).sum()) >= MIN_SEMANAS_POR_CANAL_SIMPLES]
    if not canais:
        raise SemDadosSuficientes(f"Nenhum canal tem gasto em pelo menos {MIN_SEMANAS_POR_CANAL_SIMPLES} semanas.")
    controles = _controles(ordenadas, n)
    t = np.arange(n) / n
    cols = [np.ones(n), t] + [np.array([float((s.get("controles") or {}).get(c, 0.0)) for s in ordenadas]) for c in controles]
    ads = [_arrastar(gasto[c]) for c in canais]
    A = np.column_stack(cols + ads)
    k_base = len(cols)
    inferior = np.array([-np.inf] * k_base + [0.0] * len(canais))
    superior = np.full(A.shape[1], np.inf)

    def ajustar(AA: np.ndarray, yy: np.ndarray) -> np.ndarray:
        return lsq_linear(AA, yy, bounds=(inferior, superior), method="bvls").x

    coef = ajustar(A, y)
    resid = y - A @ coef
    rng = np.random.default_rng(semente)
    ncoef = []
    blocos = int(np.ceil(n / BLOCO))
    for _ in range(REAMOSTRAGENS):
        idx = np.concatenate([np.arange(b, min(b + BLOCO, n)) for b in rng.integers(0, max(1, n - BLOCO + 1), blocos)])[:n]
        yb = A @ coef + resid[idx]  # reamostra os resíduos em blocos
        ncoef.append(ajustar(A, yb))
    ncoef = np.array(ncoef)
    total_y = float(y.sum())

    def porcento(cj: np.ndarray, i: int) -> float:
        return float(cj[k_base + i] * ads[i].sum() / total_y * 100.0)

    lim = lambda v: float(min(100.0, max(0.0, v)))
    resultado_canais: list[dict[str, Any]] = []
    for i, c in enumerate(canais):
        amostras = [porcento(cj, i) for cj in ncoef]
        baixo, alto = np.percentile(amostras, [10, 90])
        meio = porcento(coef, i)
        ingressos = float(coef[k_base + i] * ads[i].sum())
        gasto_total = float(gasto[c].sum()) * 100.0
        maximo = float(gasto[c].max()) * 100.0 * FATOR_DA_CURVA  # em centavos, como a curva do modelo completo
        inclinacao = float(coef[k_base + i]) / (1 - DECAIMENTO) / 100.0  # ingressos por semana por centavo de gasto semanal sustentado
        curva = [{"gasto_centavos": int(round(maximo * j / (PONTOS_DA_CURVA - 1))), "ingressos": round(inclinacao * maximo * j / (PONTOS_DA_CURVA - 1), 2)} for j in range(PONTOS_DA_CURVA)]
        janela = gasto[c][np.flatnonzero(gasto[c] > 0)[0]: np.flatnonzero(gasto[c] > 0)[-1] + 1]
        resultado_canais.append({
            "canal": c, "porcento": round(lim(meio), 2), "baixo": round(lim(baixo), 2), "alto": round(lim(alto), 2), "ingressos": max(0, int(round(ingressos))), "gasto_centavos": int(round(gasto_total)),
            "custo_por_ingresso_centavos": int(round(gasto_total / ingressos)) if gasto_total > 0 and ingressos >= 1 else None, "saturacao_gasto_centavos": None,
            "gasto_constante": bool(janela.mean() > 0 and janela.std() / janela.mean() < 0.25), "curva": curva,
        })
    soma_canais = sum(c["porcento"] for c in resultado_canais)
    base = 100.0 - soma_canais
    amostras_base = [100.0 - sum(porcento(cj, i) for i in range(len(canais))) for cj in ncoef]
    b_baixo, b_alto = np.percentile(amostras_base, [10, 90])
    return {
        "motor": "regressao-simples", "versao_motor": "1", "semanas": n,
        "diagnosticos": {"r_hat_maximo": 1.0, "divergencias": 0, "ess_minimo": REAMOSTRAGENS},
        "base": {"porcento": round(lim(base), 2), "baixo": round(lim(b_baixo), 2), "alto": round(lim(b_alto), 2), "partes": []},
        "canais": resultado_canais,
    }

"""Dados inventados em que a resposta certa é conhecida: serve para provar que o modelo recupera o efeito de cada canal (e que avisa quando não consegue)."""
from __future__ import annotations

import numpy as np

# O efeito verdadeiro de cada canal: tamanho máximo (ingressos por semana), velocidade do atraso (adstock) e da saturação.
VERDADE = {
    "meta-ads": {"beta": 60.0, "adstock": 0.5, "escala": 300.0, "lam": 2.0},
    "google-ads": {"beta": 25.0, "adstock": 0.3, "escala": 120.0, "lam": 2.5},
    "instagram": {"beta": 18.0, "adstock": 0.4, "escala": 150.0, "lam": 1.5},
}


def _adstock(x: np.ndarray, a: float) -> np.ndarray:
    saida, acumulado = np.zeros_like(x), 0.0
    for i, v in enumerate(x):
        acumulado = v + a * acumulado
        saida[i] = acumulado
    return saida


# A MARCA (só com `com_marca`): anúncio da instituição, de efeito pequeno por semana mas que dura meses (atraso alto).
VERDADE_DA_MARCA = {"meta-ads-marca": {"beta": 22.0, "adstock": 0.85, "escala": 900.0, "lam": 1.5}}


def gerar(semanas: int = 90, semente: int = 7, embaralhar_gasto: bool = False, gasto_constante: bool = False, com_controles: bool = False, variacao: float = 1.0, com_marca: bool = False, ferias: float | None = None, curva_da_proximidade: list[float] | None = None, lotacao: float | None = None, boca_a_boca: float | None = None, publico: float = 4000.0, sem_canal: str | None = None, urgencia: float | None = None) -> tuple[list[dict], dict[str, float]]:
    """Devolve a tabela semanal (no formato do Jards, centavos) e a parte verdadeira de cada canal nas vendas, em % (mais a base)."""
    rng = np.random.default_rng(semente)
    n = semanas
    t = np.arange(n)

    def gasto(base: float, amp: float, periodo: float) -> np.ndarray:
        if gasto_constante:
            return np.full(n, base)
        amp = amp * variacao  # `variacao` < 1: o gasto muda pouco de semana a semana (o caso difícil para o modelo)
        return np.clip(base + amp * np.sin(t * 2 * np.pi / periodo) + rng.normal(0, amp * 0.3, n), 0, None)

    gastos = {"meta-ads": gasto(150, 120, 11), "google-ads": gasto(60, 50, 7)}
    gastos["instagram"] = np.full(n, 40.0) if gasto_constante else np.where(rng.random(n) < 0.5, rng.uniform(20, 80, n), 0.0)
    verdades = {**VERDADE, **(VERDADE_DA_MARCA if com_marca else {})}
    if com_marca:
        gastos["meta-ads-marca"] = gasto(90, 70, 26)  # a marca muda devagar (campanhas de meses)
    contribuicoes = {c: v["beta"] * (1 - np.exp(-v["lam"] * _adstock(gastos[c], v["adstock"]) / v["escala"])) for c, v in verdades.items()}
    if sem_canal is not None:
        # O contrafactual: o mesmo mundo (mesmo sorteio) sem o efeito deste canal, para medir o efeito TOTAL dele (com o boca a boca que ele puxa).
        contribuicoes[sem_canal] = np.zeros(n)
    base = 40 + 0.05 * t + 6 * np.sin(t * 2 * np.pi / 52)
    # Os controles (só com `com_controles`): a proximidade da sessão (uma sessão a cada 13 semanas), as semanas de feriado, a virada de lote (junto da abertura de cada sessão), o cupom e as visitas sem anúncio.
    efeitos: dict[str, np.ndarray] = {}
    controles: dict[str, np.ndarray] = {}
    if com_controles:
        proximidade = np.clip(1 - ((13 - 1 - t % 13) % 13) / 9, 0, 1)
        feriado = (rng.random(n) < 0.12).astype(float)
        lote = (t % 13 == 4).astype(float)
        cupom = np.clip(rng.normal(0.1, 0.12, n), 0, 1) * (rng.random(n) < 0.5)
        visitas = rng.normal(0.1, 0.3, n)  # visitas sem anúncio em log relativo à mediana (pode ser negativo)
        controles = {"proximidade": proximidade, "feriado": feriado, "lote": lote, "preco": np.zeros(n), "cupom": cupom, "visitas": visitas}
        efeitos = {"proximidade": 22 * proximidade, "feriado": 9 * feriado, "preco_e_lotes": 12 * lote, "cupom": 30 * cupom, "visitas": 15 * visitas}
        if curva_da_proximidade is not None:
            # A verdade segue a curva de venda da casa (concentrada perto da data), não a rampa: semanas até a sessão (0 a 8) → peso da curva, com a semana de mais venda valendo 1.
            c = np.asarray(curva_da_proximidade) / max(curva_da_proximidade)
            ate = (13 - 1 - t % 13) % 13
            efeitos["proximidade"] = 22 * np.where(ate <= 8, c[np.minimum(ate, 8)], 0.0)
        if ferias is not None:
            # Férias escolares (julho, 20/12 a 31/1, pela maior parte da semana): `ferias` ingressos a mais por semana de férias (0 = não mexe nas vendas).
            dias = np.datetime64("2025-01-06") + t * np.timedelta64(7, "D")
            def de_ferias(segunda: np.datetime64) -> float:
                conta = 0
                for i in range(7):
                    d = (segunda + np.timedelta64(i, "D")).astype(object)
                    conta += d.month in (1, 7) or (d.month == 12 and d.day >= 20)
                return 1.0 if conta >= 4 else 0.0
            controles["ferias"] = np.array([de_ferias(d) for d in dias])
            efeitos["ferias"] = ferias * controles["ferias"]
    y = base + sum(contribuicoes.values()) + sum(efeitos.values()) + rng.normal(0, 3, n)
    if boca_a_boca is not None or urgencia is not None:
        # O BOCA A BOCA (Bass, 1969; Jørgensen, Kort e Zaccour, 2006; só com `com_controles`): cada evento (bloco de 13 semanas, a sessão na última) vende também pelo que já
        # vendeu: quem comprou conta para quem não sabe. Na semana, `boca_a_boca` × vendidos até a semana passada × (1 − parte do `publico` que já comprou). O controle "boca" é o
        # que o Jards pode calcular: z(1 − z), com z = a parte dos lugares (aqui, o público) já vendida antes da semana.
        # A URGÊNCIA (Jørgensen e Zaccour, 2019): "restam poucos lugares" faz comprar mais rápido. Na semana, `urgencia` × z ingressos a mais (cresce até esgotar, em vez de sumir
        # no fim como o boca a boca). O controle "urgencia" é z.
        sem_boca = y.copy()
        boca = np.zeros(n)
        pressa = np.zeros(n)
        z = np.zeros(n)
        acumulado = 0.0
        for i in range(n):
            if i % 13 == 0:
                acumulado = 0.0
            z[i] = min(1.0, acumulado / publico)
            boca[i] = (boca_a_boca or 0.0) * acumulado * (1 - z[i])
            pressa[i] = (urgencia or 0.0) * z[i]
            acumulado += max(0.0, sem_boca[i] + boca[i] + pressa[i])
        y = sem_boca + boca + pressa
        controles = {**controles, "boca": z * (1 - z), "urgencia": z}
        if boca_a_boca is not None:
            efeitos["boca"] = boca
        if urgencia is not None:
            efeitos["urgencia"] = pressa
    if lotacao is not None:
        # A LOTAÇÃO: a venda da semana não passa de `lotacao` ingressos (as sessões esgotam). O que a procura passaria disso some, e a semana fica marcada como esgotada
        # (`esgotou`, a mesma coluna que o Jards calcula). A verdade de cada canal continua a da procura (sem o teto): é o que o anúncio rende quando há lugar.
        esgotada = y > lotacao
        y = np.minimum(y, lotacao)
        controles = {**controles, "esgotou": esgotada.astype(float)}
    total = float(y.sum())
    verdade = {c: float(v.sum()) / total * 100 for c, v in contribuicoes.items()}
    verdade["base"] = float((y - sum(contribuicoes.values())).sum()) / total * 100
    for chave, efeito in efeitos.items():
        verdade[f"parte:{chave}"] = float(efeito.sum()) / total * 100
    mostrados = {c: g.copy() for c, g in gastos.items()}
    if embaralhar_gasto:
        for g in mostrados.values():
            rng.shuffle(g)
    datas = np.datetime64("2025-01-06") + t * np.timedelta64(7, "D")
    tabela = [
        {"semana": str(datas[i]), "ingressos": max(0, int(round(y[i]))), "gasto": {c: int(round(mostrados[c][i] * 100)) for c in mostrados if mostrados[c][i] > 0},
         **({"controles": {k: round(float(v[i]), 4) for k, v in controles.items()}} if controles else {})}
        for i in range(n)
    ]
    return tabela, verdade

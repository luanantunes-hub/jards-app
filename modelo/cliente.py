"""O cliente do Jards: o job só fala com o Jards por três rotas protegidas por um token estreito (MODELO_TOKEN). Nunca recebe a chave do banco."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Any

TENTATIVAS = 3
TEMPO_MAXIMO_EM_SEGUNDOS = 120


class ErroDoJards(Exception):
    """A resposta do Jards não foi a esperada (o texto nunca traz o token)."""


class ClienteDoJards:
    def __init__(self, base: str, token: str) -> None:
        if not base.startswith("https://") and not base.startswith("http://localhost"):
            raise ValueError("MODELO_BASE_URL precisa começar com https://")
        if len(token) < 32:
            raise ValueError("MODELO_TOKEN precisa ter pelo menos 32 caracteres")
        self._base = base.rstrip("/")
        self._token = token

    def _pedir(self, metodo: str, caminho: str, corpo: dict[str, Any] | None = None) -> dict[str, Any]:
        dados = json.dumps(corpo).encode("utf-8") if corpo is not None else None
        ultimo: Exception | None = None
        for tentativa in range(TENTATIVAS):
            requisicao = urllib.request.Request(
                f"{self._base}{caminho}", data=dados, method=metodo,
                headers={"authorization": f"Bearer {self._token}", "content-type": "application/json", "user-agent": "jards-modelo/1"},
            )
            try:
                with urllib.request.urlopen(requisicao, timeout=TEMPO_MAXIMO_EM_SEGUNDOS) as r:
                    return json.loads(r.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                # 4xx não melhora tentando de novo (token errado, corpo recusado); 5xx pode ser passageiro.
                detalhe = e.read().decode("utf-8", errors="replace")[:200]
                if e.code < 500:
                    raise ErroDoJards(f"{metodo} {caminho}: HTTP {e.code} {detalhe}") from None
                ultimo = ErroDoJards(f"{metodo} {caminho}: HTTP {e.code}")
            except (urllib.error.URLError, TimeoutError) as e:
                ultimo = ErroDoJards(f"{metodo} {caminho}: {type(e).__name__}")
            time.sleep(2 ** (tentativa + 1))
        raise ultimo or ErroDoJards(f"{metodo} {caminho}: falhou")

    def lojas_prontas(self) -> list[dict[str, Any]]:
        return list(self._pedir("GET", "/api/ticketeria/modelo/prontas").get("lojas", []))

    def tabela(self, loja: str) -> list[dict[str, Any]]:
        return list(self._pedir("GET", f"/api/ticketeria/modelo/lojas/{loja}/tabela").get("semanas", []))

    def enviar_resultado(self, loja: str, resultado: dict[str, Any]) -> dict[str, Any]:
        return self._pedir("POST", f"/api/ticketeria/modelo/lojas/{loja}/resultado", resultado)

    def enviar_falha(self, loja: str, motivo: str) -> dict[str, Any]:
        return self._pedir("POST", f"/api/ticketeria/modelo/lojas/{loja}/resultado", {"falhou": True, "motivo": motivo[:300]})

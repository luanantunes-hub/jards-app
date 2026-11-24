"""Recorta o fundo de papel de um quadro: devolve um RGBA com o fundo transparente."""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def estima_fundo(rgb, mascara_fg, sigma=48):
    """A vinheta do papel: média suavizada só do que não é personagem, preenchida por dentro."""
    w = (~mascara_fg).astype(np.float32)[..., None]
    num = ndi.gaussian_filter(rgb * w, sigma=(sigma, sigma, 0))
    den = ndi.gaussian_filter(w, sigma=(sigma, sigma, 0))
    return num / np.maximum(den, 1e-3)


def recorta(caminho, lim0=16, lim1=52, buraco_max=260):
    rgb = np.asarray(Image.open(caminho).convert("RGB")).astype(np.float32)
    # 1ª passada: o fundo como a mediana grosseira por coluna e linha, só para achar o que é personagem
    grosso = np.broadcast_to(np.median(rgb, axis=(0, 1)), rgb.shape)
    fg = np.sqrt(((rgb - grosso) ** 2).sum(-1)) > 40
    fg = ndi.binary_dilation(fg, iterations=4)
    # 2ª passada: a vinheta de verdade
    fundo = estima_fundo(rgb, fg)
    dist = np.sqrt(((rgb - fundo) ** 2).sum(-1))
    a = np.clip((dist - lim0) / (lim1 - lim0), 0, 1)
    a = a * a * (3 - 2 * a)                     # suave nas bordas
    # buracos pequenos dentro dos personagens (brilhos, claros do tecido) voltam a ser opacos
    solido = a > 0.5
    fora = ndi.label(~solido)[0]
    borda = np.unique(np.concatenate([fora[0], fora[-1], fora[:, 0], fora[:, -1]]))
    tam = np.bincount(fora.ravel())
    pequenos = np.isin(fora, [i for i in range(1, len(tam)) if i not in borda and tam[i] < buraco_max])
    a = np.where(pequenos, 1.0, a)
    # cor do primeiro plano sem o creme misturado nas bordas
    af = np.maximum(a, 1e-3)[..., None]
    cor = np.clip((rgb - fundo * (1 - af)) / af, 0, 255)
    cor = np.where(a[..., None] > 0.02, cor, 0)
    return np.dstack([cor, a * 255]).astype(np.uint8)


if __name__ == "__main__":
    import sys
    quadro = recorta(sys.argv[1])
    Image.fromarray(quadro, "RGBA").save(sys.argv[2])
    for nome, fundo in [("branco", (255, 255, 255)), ("magenta", (232, 98, 214)), ("escuro", (28, 14, 51))]:
        base = Image.new("RGBA", (quadro.shape[1], quadro.shape[0]), fundo + (255,))
        base.alpha_composite(Image.fromarray(quadro, "RGBA"))
        base.convert("RGB").save(sys.argv[2].replace(".png", f"-{nome}.png"))
    print("ok", quadro.shape, "opaco %.1f%%" % (100 * (quadro[..., 3] > 200).mean()))

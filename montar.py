#!/usr/bin/env python3
"""Monta as duas saídas do Sábado Premiado a partir de web/.

  artefato/sabado-premiado.html  página única (CSS e JS embutidos), modo demonstração, rotas #, para publicar como artefato
  publicar/                      pasta pronta para a Vercel (modo e chaves vindos de config.producao.js, se existir)

Uso: python3 montar.py
"""
import pathlib, re, shutil

AQUI = pathlib.Path(__file__).parent
WEB = AQUI / "web"
JS = ["logos.js", "config.js", "util.js", "api-demo.js", "api-supabase.js", "app.js"]
ler = lambda n: (WEB / n).read_text(encoding="utf-8")

# ---------- artefato ----------
css = ler("styles.css")
partes = [
    "<title>Sábado Premiado</title>",
    '<meta name="claude:viewport-fit-sides" content="cover">',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;600;700&family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@600;700&display=swap">',
    f"<style>\n{css}\n</style>",
    '<div id="app"></div>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>',
]
for n in JS:
    codigo = ler(n)
    if n == "config.js":
        codigo = re.sub(r'MODO: "\w+"', 'MODO: "demo"', codigo)
        codigo = re.sub(r'ROTAS: "\w+"', 'ROTAS: "hash"', codigo)
    codigo = codigo.replace("</script", "<\\/script")
    partes.append("<script>\n" + codigo + "\n</script>")
(AQUI / "artefato").mkdir(exist_ok=True)
saida = AQUI / "artefato" / "sabado-premiado.html"
saida.write_text("\n".join(partes) + "\n", encoding="utf-8")
print(saida, len(saida.read_bytes()) // 1024, "KB")

# ---------- pasta para hospedar ----------
pub = AQUI / "publicar"
pub.mkdir(exist_ok=True)
for n in JS + ["styles.css", "index.html", "vercel.json", "config-remota.js"]:
    shutil.copy(WEB / n, pub / n)
prod = AQUI / "config.producao.js"
if prod.exists():
    shutil.copy(prod, pub / "config.js")
    print("config.js de produção aplicado")
else:
    print("sem config.producao.js: a pasta publicar/ sai em modo demonstração")
print(pub)

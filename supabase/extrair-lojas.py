import re, json, collections
def tit(t):
    t = re.sub(r"\s+", " ", t).strip().title()
    t = re.sub(r"\b(Da|Das|De|Do|Dos|E)\b", lambda m: m.group(1).lower(), t)
    t = re.sub(r"-(Df|Go|Mg)\b", lambda m: "-" + m.group(1).upper(), t)
    t = re.sub(r" - (Df|Go|Mg)\b", lambda m: "-" + m.group(1).upper(), t)
    return t[:1].upper() + t[1:]
L = [l.strip() for l in open("lojas.txt", encoding="utf-8").read().replace("–", "-").splitlines()]
band = uf = None; lojas = []; i = 0
MAP = {"TESOURA DE OURO": "tesoura", "MAGAZINE DA ECONOMIA": "magazine", "FREE CENTER": "free", "OUTLET FAMÍLIA": None}
while i < len(L):
    l = L[i]
    m = re.match(r"RELAÇÃO DE EMPRESAS\s+(.+?)\s*-\s*(DF|GO|MG)", l)
    if m: band = MAP.get(re.sub(r"\s+", " ", m.group(1)).upper(), "x"); uf = m.group(2); i += 1; continue
    m = re.search(r"\(\s*(MATRIZ|FILIAL)\s*(\d+)\)", l)
    if m and band is not None and band != "x":
        bloco = []; j = i + 1
        while j < len(L) and not re.search(r"\(\s*(MATRIZ|FILIAL)\s*\d+\)", L[j]) and not L[j].startswith("RELAÇÃO"):
            if L[j]: bloco.append(L[j])
            j += 1
        cnpj = next((re.sub(r"\D", "", x) for x in bloco if re.match(r"CN[PJ]{2}", x.upper())), "")
        cep = next((x.split(":", 1)[1].strip() for x in bloco if x.upper().startswith("CEP")), "")
        info = [x for x in bloco if not re.match(r"(CNPJ|CNJP|INSC|FONE|CEP|IE)\b", x, re.I)]
        end, bairro, cid = (info + ["", "", ""])[:3]
        lojas.append({"bandeira": band, "uf": uf, "filial": int(m.group(2)), "bairro": tit(bairro), "cidade": tit(cid), "endereco": f"{tit(end)}, {tit(bairro)}, {tit(cid)}{', CEP ' + cep if cep else ''}", "cnpj": cnpj})
        i = j; continue
    i += 1
print(collections.Counter((x["bandeira"], x["uf"]) for x in lojas), len(lojas))
print([x for x in lojas if len(x["cnpj"]) != 14])
NOMES = {"tesoura": "Tesoura de Ouro", "magazine": "Magazine da Economia", "free": "Free Center"}
cont = collections.Counter()
for x in lojas:
    base = f'{NOMES[x["bandeira"]]} {x["bairro"]}'
    cont[base] += 1
for x in lojas:
    base = f'{NOMES[x["bandeira"]]} {x["bairro"]}'
    cidade = re.split(r"\s*-\s*(?:DF|GO|MG)\b", x["cidade"], flags=re.I)[0].strip()
    if cidade.lower().startswith("bras"): cidade = "Brasília"
    x["nome"] = base if cont[base] == 1 else (f'{NOMES[x["bandeira"]]} {cidade}' if x["bairro"].lower() == "centro" else f'{base} · {cidade}')
    x["cidade_nome"] = cidade
    x["pin"] = str({"tesoura": 1000, "magazine": 2000, "free": 3000}[x["bandeira"]] + len([y for y in lojas[:lojas.index(x)+1] if y["bandeira"] == x["bandeira"]]))
c2 = collections.Counter(x["nome"] for x in lojas)
for x in lojas:
    if c2[x["nome"]] > 1: x["nome"] += f' ({x["filial"]:02d})'
json.dump(lojas, open("lojas-gto.json", "w"), ensure_ascii=False, indent=1)
for x in lojas[:3] + lojas[50:52] + lojas[-2:]: print(x["pin"], x["nome"], "|", x["endereco"][:70], "|", x["cnpj"])

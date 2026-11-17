// Copiar para ../config.producao.js e ajustar o domínio. O montar.py coloca este arquivo como config.js em publicar/.
window.CONFIG = {
  MODO: "servidor",          // "servidor" = PostgREST próprio da GTO. Se usarem Supabase: MODO "supabase" + SUPABASE_URL + SUPABASE_ANON
  ROTAS: "path",
  API_URL: "/api",           // mesma origem do site (nginx encaminha /api para a API)
  SUPABASE_URL: "",
  SUPABASE_ANON: "",
  BASE_URL: "https://sabadopremiado.tesouradeouro.com.br",
  CAMPANHA: "Sábado Premiado",
  REGRAS: "Vale só no sábado e só na loja indicada. Cada cupom vale uma vez, para o CPF cadastrado. Válido mediante compra.",
  LGPD: "Autorizo a {MARCA} a usar meus dados (nome, CPF e WhatsApp) para esta ação e para me enviar ofertas. Posso pedir a exclusão a qualquer momento.",
  // as 3 bandeiras do grupo: nome, cores da página da influencer e campanha de fim de ano (termos no rodapé da página).
  // LOGO: chave em logos.js (vazio = nome escrito nas cores da marca, até chegar o logo oficial).
  // Campanha sem TERMOS: o rodapé e o passo 4 não aparecem para aquela bandeira.
  BANDEIRAS: {
    tesoura: {
      NOME: "Tesoura de Ouro", CURTO: "Tesoura", LOGO: "tesouraBranco", LOGO_CLARO: "tesouraAzul",
      COR: "#001D7E", COR2: "#0B2A93", COR_ESC: "#00124F", DESTAQUE: "#BF9556", DESTAQUE_ESC: "#9C7438", CLARO: "#F5E2C4",
      CAMPANHA: "Ano novo, Sonho novo", PREMIO: "R$ 150 mil",
      SITE: "https://www.sonhonovo.tesouradeouro.com.br", SITE_TEXTO: "sonhonovo.tesouradeouro.com.br", WHATSAPP: "(61) 99646-8372",
      TERMOS: "Para maiores de 18 anos, com CPF válido, residentes no DF, GO ou MG. Compras: 30/10 a 31/12 de 2026, nas lojas físicas Tesoura de Ouro e no e-commerce oficial (www.tesouradeouro.com.br). Informe o CPF no caixa ou checkout. Cadastro das compras no site ou pelo WhatsApp (61) 99646-8372 até 31/12/2026. A cada R$150,00 no mesmo cupom fiscal, você ganha 1 Número da Sorte para concorrer, pela Loteria Federal de 10/01/2027, a 1 cartão pré-pago de R$150.000,00 (sugestão de uso: compra de carro) e a 2 vouchers CVC de R$6.000,00 cada. Os Números da Sorte vêm em dobro a cada R$150,00 pagos com TesouraCard. Nas lojas físicas, a cada R$150,00 pagos com TesouraCard no mesmo cupom fiscal, você também ganha 1 raspadinha virtual para concorrer na hora a vale-compras de R$50,00, R$100,00 ou R$150,00 (700 no total). A raspadinha é liberada em até 48h úteis após a análise da nota, e a distribuição acaba quando o estoque terminar. Não é permitido somar cupons fiscais, e valores residuais são desprezados. Limites por CPF: até 100 Números da Sorte e 1 prêmio no sorteio; até 2 vale-compras na raspadinha. Antes de participar, consulte as lojas participantes, as demais condições de participação e premiação e os Certificados de Autorização SPA/MF nº 04.053609/2026 e 05.053570/2026 nos regulamentos completos em www.sonhonovo.tesouradeouro.com.br. Imagens ilustrativas. GUARDE SEUS CUPONS FISCAIS.",
    },
    magazine: {
      NOME: "Magazine da Economia", CURTO: "Magazine", LOGO: "", LOGO_CLARO: "",
      COR: "#A3005F", COR2: "#C4007A", COR_ESC: "#5E0037", DESTAQUE: "#FFCB08", DESTAQUE_ESC: "#8A6A00", CLARO: "#FFF1A8",
      CAMPANHA: "Natal Premiado", PREMIO: "",
      SITE: "", SITE_TEXTO: "", WHATSAPP: "",
      TERMOS: "",
    },
    free: {
      NOME: "Free Center Calçados", CURTO: "Free Center", LOGO: "", LOGO_CLARO: "",
      COR: "#B8441A", COR2: "#D9531F", COR_ESC: "#5A1F08", DESTAQUE: "#FFC48C", DESTAQUE_ESC: "#8A4A10", CLARO: "#FFE9D6",
      CAMPANHA: "Virada de Sorte", PREMIO: "",
      SITE: "", SITE_TEXTO: "", WHATSAPP: "",
      TERMOS: "",
    },
  },
};

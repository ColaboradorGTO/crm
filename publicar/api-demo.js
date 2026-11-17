// Bateria de demonstração: mesmas funções da API real (api-supabase.js), com os dados guardados no navegador.
// Serve para o artefato, para a apresentação e para testar sem banco. As regras aqui espelham supabase/schema.sql.
(() => {
  const CHAVE = "sabado-premiado-demo-v9";
  const PIN_ADMIN = "1234";
  let S = null;
  let memoria = null;

  // ---------- dados de exemplo ----------
  // lojas reais do grupo (listagem da Caliane, 13/10/2026): bandeira, nome, bairro ou cidade, endereço, CNPJ, PIN do balcão
  const LOJAS_GTO = [["tesoura", "Tesoura de Ouro Recanto das Emas 1", "Recanto das Emas 1", "Av Avenida Recanto das Emas Quadra 103 Lote 1, Recanto das Emas 1, Brasília-DF, CEP 72.600-300", "36769602000155", "1001"], ["tesoura", "Tesoura de Ouro Ceilândia 1", "Ceilândia 1", "Qnm 18 Conjunto C S/N Lote 01 Lojas 01 e 02 Sala 103 Lotes 03 e 05, Ceilândia 1, Brasília-DF, CEP 72.210-180", "36769602000236", "1002"], ["tesoura", "Tesoura de Ouro Taguatinga Centro", "Taguatinga Centro", "C 8 Lote 07 Loja 01 e Sobreloja Lote 08 Loja Terrea, Taguatinga Centro, Brasília-DF, CEP 72.010-080", "36769602000317", "1003"], ["tesoura", "Tesoura de Ouro Setor Central Comercial", "Gama 3", "Bloco 06 S/N Lotes 42 44 46 48 50 52 54 56 58 60 Terreo e Subsolo, Setor Central Comercial, Gama 3, CEP 72.404-902", "36769602000589", "1004"], ["tesoura", "Tesoura de Ouro Recanto das Emas 2", "Recanto das Emas 2", "Avenida Recanto das Emas Quadra 103 Lote 17 Loja 09 e Subsolo da Loja 10, Recanto das Emas 2, Brasilia-DF, CEP 72.600-330", "36769602000740", "1005"], ["tesoura", "Tesoura de Ouro Samambaia Sul 2", "Samambaia Sul 2", "Qn 310 Conjunto 01 Lote 02, Samambaia Sul 2, Brasilia-DF, CEP 72 306-701", "36769602000821", "1006"], ["tesoura", "Tesoura de Ouro Brazlândia", "Brazlândia", "Quadra 04 Lote 03 Loja 02 Lt 05 Lj 1 Sl104 Lote 07 Lj 01, Brazlândia, Brasília-DF, CEP 72 710-040", "36769602001046", "1007"], ["tesoura", "Tesoura de Ouro Samambaia Norte 1", "Samambaia Norte 1", "Qn 208 Conjunto B Lote 02 Loja 01 02 03 e 04, Samambaia Norte 1, Brasília-DF, CEP 72.316-512", "36769602001127", "1008"], ["tesoura", "Tesoura de Ouro São Sebastião", "São Sebastião", "R 48 Lote 91 Loja 01/02 e Lote 101, São Sebastião, Brasília-DF, CEP 71.691-010", "36769602001208", "1009"], ["tesoura", "Tesoura de Ouro Sobradinho", "Sobradinho", "Q 12 Comercio Local Cl 7ª Terreo, Sobradinho, Brasília-DF, CEP 73.011-020", "36769602001550", "1010"], ["tesoura", "Tesoura de Ouro Planaltina 1", "Planaltina 1", "Area Shd Bloco B Projecao J S/N Loja Terrea e Sobreloja Setor de Hoteis e Diversoes, Planaltina 1, Brasília-DF, CEP 73.310-208", "36769602002522", "1011"], ["tesoura", "Tesoura de Ouro Taguatinga Norte (Comercial Norte)", "Taguatinga Norte (Comercial Norte)", "Cnb 6 Lote 06 Salao Comercial Loja 01 e 02, Taguatinga Norte (Comercial Norte), Brasília-DF, CEP 72 115-065", "36769602002603", "1012"], ["tesoura", "Tesoura de Ouro Paranoá", "Paranoá", "Q 17 Conjunto 11 S/N Lote 07 Loja 01/02, Paranoá, Brasília-DF, CEP 71.571-700", "36769602002875", "1013"], ["tesoura", "Tesoura de Ouro Santa Maria", "Santa Maria", "Cl 114 Lotes C D F Lojas 134F 213 e Sobreloja, Santa Maria, Brasília-DF, CEP 72 544-200", "36769602002956", "1014"], ["tesoura", "Tesoura de Ouro Taguacenter", "Taguacenter", "Cng 4 Lotes 14/15 Loja 01 e 02, Taguacenter, Brasília-DF, CEP 72.130-045", "36769602003090", "1015"], ["tesoura", "Tesoura de Ouro Núcleo Bandeirante", "Núcleo Bandeirante", "Av Central Blocos 380/510 (Lado Par) Lote 460 Loja Terreo, Núcleo Bandeirante, Brasília-DF, CEP 71.720-510", "36769602005700", "1016"], ["tesoura", "Tesoura de Ouro Riacho Fundo I", "Riacho Fundo I", "Cln 7 Bloco A (Comercio) S/N Lote 01 Lojas 01 02 03 Salas 101 A 105 Lote 02/03 Lojas 06 07 13 14 e 15, Riacho Fundo I, Brasília-DF, CEP 71.805-541", "36769602006277", "1017"], ["tesoura", "Tesoura de Ouro Planaltina 2 Df", "Planaltina 2 Df", "Area Shd Bloco Lote 01 Loja 01 Lote 02 Loja 01 e Apto 01 Lote 03-05 e 06 Lote 07 e 09 Loja 01 Lote 08 Loja 01- Setor de Hoteis e Diversoes), Planaltina 2 Df, Brasília-DF, CEP 73.310-235", "36769602002360", "1018"], ["tesoura", "Tesoura de Ouro Jk Shopping- Ceilândia", "Jk Shopping- Ceilândia", "Qnm 34 Area Especial 1, Sn, Jk Shopping- Ceilândia, Brasília-DF, CEP 72.145-450", "36769602013486", "1019"], ["tesoura", "Tesoura de Ouro Águas Claras", "Águas Claras", "Qs 09 Rua 123 Lote 01, Águas Claras, Brasilia-DF, CEP 71.977-720", "36769602003170", "1020"], ["tesoura", "Tesoura de Ouro Anapolis 2", "Anapolis 2", "Rua Engenheiro Portela, 222 Qd S/N, Centro, Anapolis 2-GO, CEP 75.024-902", "36769602000406", "1021"], ["tesoura", "Tesoura de Ouro Jardim Todos Os Santos Ii", "Senador Canedo", "Av Dom Emanuel Lote 01 e Rua Gov. Ary Ribeiro Valadao Lote 02 Quadra 1H, Jardim Todos Os Santos Ii, Senador Canedo-GO, CEP 75.261-306", "36769602000660", "1022"], ["tesoura", "Tesoura de Ouro Santo Antônio do Descoberto-GO", "", "Quadra 55 S/N Lote 05 Loja 01, Santo Antônio do Descoberto-GO, , CEP 72.900-332", "36769602003332", "1023"], ["tesoura", "Tesoura de Ouro Jardim Oriente", "Valparaiso de Goias 1", "Rua 01 (Quadras 56 A 61) Sn Quadra 61 Lote 14, 15 e 16, Jardim Oriente, Valparaiso de Goias 1-GO, CEP 72.870-201", "36769602003502", "1024"], ["tesoura", "Tesoura de Ouro Carrilho", "Goianesia", "Avenida Goias N° 243 Quadra 82 Lote 34 e Parte 13, Carrilho, Goianesia-GO, CEP 776.380-745", "36769602003685", "1025"], ["tesoura", "Tesoura de Ouro Mansoes Centro Oeste", "Águas Lindas de Goias 2", "Alameda Santa Luzia S/N Qd 00 Lote 06-B-02 Loja 46, Mansoes Centro Oeste, Águas Lindas de Goias 2-GO, CEP 72.915-705", "36769602003766", "1026"], ["tesoura", "Tesoura de Ouro Jardim Brasília", "Águas Lindas 1", "Quadra 31 N° 15 Lote16 e 17 S/N, Jardim Brasília, Águas Lindas 1-GO, CEP 72.915-045", "36769602003847", "1027"], ["tesoura", "Tesoura de Ouro Setor Norte · Planaltina 1", "Planaltina 1", "Quadra Qc 3 S/N Mc Loja 06A 07A e 07B Loja 01 e 06, Setor Norte, Planaltina 1-GO, CEP 73.751-250", "36769602003928", "1028"], ["tesoura", "Tesoura de Ouro Formosa", "Formosa", "Rua Visconde de Porto Seguro N° 600, Centro, Formosa-GO, CEP 73.801-010", "36769602004061", "1029"], ["tesoura", "Tesoura de Ouro Setor Centro", "Cristalina", "Rua Goias Nº Sn Quadra21 Lote 16 Loja 02, Setor Centro, Cristalina-GO, CEP 73.850-000", "36769602004223", "1030"], ["tesoura", "Tesoura de Ouro Parque Estrela Dalva Vi", "Novo Gama", "Quadra 482 Sn Lote 24, Parque Estrela Dalva Vi, Novo Gama-GO, CEP 72.860-445", "36769602006943", "1031"], ["tesoura", "Tesoura de Ouro Cidade Ocidental", "Cidade Ocidental", "Sq 16 Quadra 4 Sn Lotes 27 e 28, Centro, Cidade Ocidental-GO, CEP 72.880-594", "36769602007834", "1032"], ["tesoura", "Tesoura de Ouro Luziania", "Luziania", "Rua do Comercio 129 e 143 e Rua Joaquim Mendonca Roriz 38, Centro, Luziania-GO, CEP 72.800-010", "36769602008130", "1033"], ["tesoura", "Tesoura de Ouro Independencia", "Setor Garavelo", "Rua 22 S/N Qd 50 Lotes 08-10-15 e 18 Lojas 03/04, Independencia, Setor Garavelo-GO, CEP 74 967-150", "36769602008300", "1034"], ["tesoura", "Tesoura de Ouro Setor Garavelo", "Aparecida de Goiânia", "Av da Igualdade Rua 21 S/N Qd 16, Setor Garavelo, Aparecida de Goiânia-GO, CEP 74.930-530", "36769602008482", "1035"], ["tesoura", "Tesoura de Ouro Parque Esplanada Iii", "Valparaíso", "Quadra 1 S/N Lote 1 Br040 Km12 Gleba F Loja 265A, Parque Esplanada Iii, Valparaíso, CEP 72.876-30 - GO", "36769602008644", "1036"], ["tesoura", "Tesoura de Ouro Caldas Novas", "Caldas Novas", "Avenida Coronel Bento Godoy S/N Quadra 15 Lote 07, Centro, Caldas Novas-GO, CEP 75.680-021", "36769602009616", "1037"], ["tesoura", "Tesoura de Ouro Setor Norte · Planaltina 2", "Planaltina 2", "Quadra Qa 3Mc Lote 04, Mr Lote 03 Terreo e Mr Lote 04 S/N, Setor Norte, Planaltina 2-GO, CEP 73.751-203", "36769602010037", "1038"], ["tesoura", "Tesoura de Ouro Setor Central", "Catalão", "Av 20 de Agosto N° 1486 Quadra25 Lote 20, Setor Central, Catalão-GO, CEP 75.701-010", "36769602010380", "1039"], ["tesoura", "Tesoura de Ouro Vila Jayara", "Anápolis 3", "Av Fernando Costa N 49, Vila Jayara, Anápolis 3-GO, CEP 75.064-780", "36769602011190", "1040"], ["tesoura", "Tesoura de Ouro Itumbiara", "Itumbiara", "Pc da Republica S/N Quadra 52 Lote 01 Nr 64/65, Centro, Itumbiara-GO, CEP 75.503-260", "36769602011785", "1041"], ["tesoura", "Tesoura de Ouro Jataí", "Jataí", "Av Goiás N 1336 Quadra 35 Lote 02 - B, Centro, Jataí-GO, CEP 75.800-133", "36769602012080", "1042"], ["tesoura", "Tesoura de Ouro Vila Padre Eterno", "Trindade", "Av Manoel Monteiro N° 1017 Quadra 26 Lote 03, Vila Padre Eterno, Trindade-GO, CEP 75.388-238", "36769602012161", "1043"], ["tesoura", "Tesoura de Ouro Uruacu", "Uruacu", "Avenida Av. Tocantins, 108, Centro, Uruacu-GO, CEP 76.400-000", "36769602012676", "1044"], ["tesoura", "Tesoura de Ouro Porangatu", "Porangatu", "Avenida Adelino Americo de Azevedo, 266, Centro, Porangatu-GO, CEP 76.550-005", "36769602012757", "1045"], ["tesoura", "Tesoura de Ouro Paracatu", "Paracatu", "Avenida Olegario Maciel, 540, Centro, Paracatu-MG, CEP 38.600-208", "36769602012404", "1046"], ["tesoura", "Tesoura de Ouro Araguari", "Araguari", "Rua Rui Barbosa, S/N, Centro, Araguari-MG, CEP 38.440-222", "36769602012595", "1047"], ["magazine", "Magazine da Economia Planaltina", "Planaltina", "Shd Projeção S/N H 1ª Térreo Lj A, Planaltina, Brasilia-DF, CEP 73.310-226", "36769602000902", "2001"], ["magazine", "Magazine da Economia Itapoã Ii", "Itapoã Ii", "Quadra Ql 4 Conjunto I Lotes 6 e 7 Conj H Lotes 11 e 13, Itapoã Ii, Brasilia-DF, CEP 71.590-647", "36769602001399", "2002"], ["magazine", "Magazine da Economia São Sebastião", "São Sebastião", "Av Central Lote 510, São Sebastião, Brasilia-DF, CEP 71.693-090", "36769602001470", "2003"], ["magazine", "Magazine da Economia Ceilândia 2", "Ceilândia 2", "Qnn 2 Conjunto H S/N Lote 1 e 3, Ceilândia 2, Brasilia-DF, CEP 72.220-028", "36769602001631", "2004"], ["magazine", "Magazine da Economia Riacho Fundo I", "Riacho Fundo I", "Qn 7 Conjunto 2 Lote 20 Lote 22 Loja 01, Riacho Fundo I, Brasilia-DF, CEP 71.805-702", "36769602001712", "2005"], ["magazine", "Magazine da Economia Recanto das Emas", "Recanto das Emas", "Quadra 104 Avenida Recanto das Emas Lotes 1 e 2, Recanto das Emas, Brasilia-DF, CEP 72.600-400", "36769602001801", "2006"], ["magazine", "Magazine da Economia Brazlândia", "Brazlândia", "Quadra 1 Lote 02, Brazlândia, Brasilia-DF, CEP 72.705-010", "36769602001984", "2007"], ["magazine", "Magazine da Economia Sobradinho", "Sobradinho", "Quadra Central Bloco 12 Lotes 14/15 Slj 03 e 04, Sobradinho, Brasilia-DF, CEP 73.010-522", "36769602004495", "2008"], ["magazine", "Magazine da Economia Samambaia Norte 1", "Samambaia Norte 1", "Qn 210 Conjunto C S/N Lote 5 6 e 7, Samambaia Norte 1, Brasilia-DF, CEP 72.316-523", "36769602004576", "2009"], ["magazine", "Magazine da Economia Santa Maria", "Santa Maria", "Quadra Cl 114 Lotes C D F Loja 102 e Sobreloja, Santa Maria, Brasilia-DF, CEP 72.544-200", "36769602006358", "2010"], ["magazine", "Magazine da Economia Paranoá", "Paranoá", "Quadra 17 Conjunto 9 Lote 08 Loja 01 e Subsolo Lote 09 Loja 01, Paranoá, Brasilia-DF, CEP 71.571-710", "36769602011866", "2011"], ["magazine", "Magazine da Economia Samambaia Norte 3", "Samambaia Norte 3", "Quadra 202 Conjunto 3 S/N Lote 07 e 08 Loja 06, Samambaia Norte 3, Brasilia-DF, CEP 72.316-043", "36769602012242", "2012"], ["magazine", "Magazine da Economia Luziânia", "Luziânia", "Rua do Comercio N°168, Centro, Luziânia- Go, CEP 72.800-010", "36769602003251", "2013"], ["magazine", "Magazine da Economia Indepedencia", "Aparecida de Goiania", "Av Independencia S/N Quadra 56 Lote 01-08/13-16 Loja 05, Indepedencia, Aparecida de Goiania-GO, CEP 72.967-145", "36769602004142", "2014"], ["magazine", "Magazine da Economia Santo Antonio do Descoberto", "Santo Antonio do Descoberto", "Quadra 55 S/N Lote 09, Centro, Santo Antonio do Descoberto-GO, CEP 72.900-332", "36769602006609", "2015"], ["magazine", "Magazine da Economia Jardim Brasilia", "Águas Lindas de Goiás", "Qd. 27 S/N Lote 19 e Sobreloja Lote 21, Jardim Brasilia, Águas Lindas de Goiás-GO, CEP 72.915-039", "36769602006781", "2016"], ["magazine", "Magazine da Economia Formosa", "Formosa", "Rua Visconde de Porto Seguro Nº 681 Loja A, Centro, Formosa-GO, CEP 73.801-010", "36769602007249", "2017"], ["magazine", "Magazine da Economia Jardim Todos Os Santos Ii", "Senador Canedo", "Av Dom Emanuel S/N Quadra 1H Lote 23, Jardim Todos Os Santos Ii, Senador Canedo-GO, CEP 75.261-306", "36769602007320", "2018"], ["magazine", "Magazine da Economia Jardim Oriente", "Valparaiso de Goias", "Rua 01 Quadra 62 S/N Lote 12 Loja 02 Lote 14 Loja 03 e Sobreloja, Jardim Oriente, Valparaiso de Goias-GO, CEP 72.870-223", "36769602007672", "2019"], ["magazine", "Magazine da Economia Setor Garavelo", "Aparecida de Goiania", "Av da Igualdade Esquina Com Rua 19C S/N Quadra 111 Lote 01, Setor Garavelo, Aparecida de Goiania-GO, CEP 74.930-530", "36769602008210", "2020"], ["magazine", "Magazine da Economia Setor Leste", "Planaltina", "Quadra Qa 4 Mc S/N Lote 09 e 11 Parte Loja C, Setor Leste, Planaltina-GO, CEP 73.752-104", "36769602008806", "2021"], ["magazine", "Magazine da Economia Parque Estrela Dalva Vi", "Novo Gama", "Quadra 482 S/N Lote 39 Loja 01, Parque Estrela Dalva Vi, Novo Gama-GO, CEP 72.860-445", "36769602008997", "2022"], ["magazine", "Magazine da Economia Cristalina", "Cristalina", "Rua Goiás N° 45 Quadra 29 Lote 19, Centro, Cristalina-GO, CEP 73.850-000", "36769602010460", "2023"], ["magazine", "Magazine da Economia Jardim do Inga", "Luziânia", "Rua Brasilia Quadra 58 S/N Lote 10, Jardim do Inga, Luziânia-GO, CEP 72.850-020", "36769602011432", "2024"], ["magazine", "Magazine da Economia Cidade Ocidental", "Cidade Ocidental", "Quadra Sq 16 Quadra 8 S/N Lote 28 e 29, Centro, Cidade Ocidental-GO, CEP 72.880-600", "36769602011513", "2025"], ["free", "Free Center Paranoá", "Paranoá", "Av Paranoa Area Comercial Quadra 17 Conjunto 11 Lote 02 Loja 01, Paranoá, Brasilia-DF, CEP 71.571-825", "36769602002107", "3001"], ["free", "Free Center Samambaia Norte", "Samambaia Norte", "Qs 412 Conjunto D Lote 01 Galpao 01, Samambaia Norte, Brasilia-DF, CEP 72.320-554", "36769602004738", "3002"], ["free", "Free Center Recanto das Emas", "Recanto das Emas", "Av Recanto Quadra 203 Lote 14 Loja 01, Recanto das Emas, Brasilia-DF, CEP 72.610-321", "36769602004819", "3003"], ["free", "Free Center São Sebastião", "São Sebastião", "Rua do Comercio S/N Lote 341 e 351 Centro, São Sebastião, Brasilia-DF, CEP 71.691-010", "36769602005033", "3004"], ["free", "Free Center Nucleo Bandeirante", "Nucleo Bandeirante", "Av Central Blocos 525/635 (Lado Impar) S/N Lote 535 Loja Terreo, Nucleo Bandeirante, Brasilia-DF, CEP 71.710-520", "36769602005386", "3005"], ["free", "Free Center Santa Maria", "Santa Maria", "Q Cl 114 Lotes C D F Loja 04F Terreo, Santa Maria, Brasilia-DF, CEP 72.544-200", "36769602005467", "3006"], ["free", "Free Center Ceilândia Norte", "Ceilândia Norte", "Q Qnm 18 Cj D Lt 1 S/N, Ceilândia Norte, Brasilia-DF, CEP 72.210-184", "36769602005629", "3007"], ["free", "Free Center Planaltina 1", "Planaltina 1", "Shd Bloco G S/N Loja 4 5 6 11 12 e 13, Planaltina 1, Brasilia-DF, CEP 73.310-223", "36769602005890", "3008"], ["free", "Free Center Gama", "Gama", "St Scc Bloco 7 Lotes 1/13 Loja A B C Setor Central, Gama, Brasilia-DF, CEP 72.404-070", "36769602006510", "3009"], ["free", "Free Center Sobradinho I", "Sobradinho I", "Quadra Central Bloco 10 S/N Lotes 01 e 02 Loja 01 Apartamentos 01 02 e 03, Sobradinho I, Brasilia-DF, CEP 73.010-520", "36769602009020", "3010"], ["free", "Free Center Águas Claras-DF Plaza", "Águas Claras-DF Plaza", "Rua Copaiba Lote 01 Loja 70 A 73 e 78 A 81, Águas Claras-DF Plaza, Brasilia-DF, CEP 71.919-540", "36769602009292", "3011"], ["free", "Free Center Asa Norte - Conjunto Nacional", "Asa Norte - Conjunto Nacional", "St Sdn Conjunto A S/N Lojas T-20 e T-23 T-23A e T-24, Asa Norte - Conjunto Nacional, Brasilia-DF, CEP 70.077-900", "36769602009705", "3012"], ["free", "Free Center Brazlândia", "Brazlândia", "Quadra 04 Lote 23 Loja 01 e Sobreloja Setor Norte, Brazlândia, Brasilia-DF, CEP 72.710-040", "36769602009969", "3013"], ["free", "Free Center Zona Industrial (Guara)", "Zona Industrial (Guara)", "Tr Sia Trecho 10 Lote 05 Loja 33 e 35, Zona Industrial (Guara), Brasilia-DF, CEP 71.200-100", "36769602010894", "3014"], ["free", "Free Center Setor Residencial Leste (Planaltina 2)", "Setor Residencial Leste (Planaltina 2)", "Quadra 4 Conjunto H Lote 60 Loja 01 e 02, Setor Residencial Leste (Planaltina 2), Brasilia-DF, CEP 73.360-408", "36769602011009", "3015"], ["free", "Free Center Jardim Brasilia", "Águas Lindas de Goiás 1", "Quadra 27 S/N Lote 18 Loja Terrea, Jardim Brasilia, Águas Lindas de Goiás 1-GO, CEP 72.915-039", "36769602003413", "3016"], ["free", "Free Center Mansoes Centro Oeste", "Águas Lindas de Goiás 2", "Al Santa Luzia S/N Quadra 00 Lote 06-B-02 Loja 43, Mansoes Centro Oeste, Águas Lindas de Goiás 2-GO, CEP 72.915-705", "36769602004304", "3017"], ["free", "Free Center Parque Estrela Vi", "Novo Gama", "Quadra 490 S/N Lote 04, Parque Estrela Vi, Novo Gama-GO, CEP 72.860-453", "36769602006862", "3018"], ["free", "Free Center Jardim Oriente", "Valparaiso de Goias 1", "Rua 1 (Quadras 62 A 66) S/N Quadra 63 Lote 11, Jardim Oriente, Valparaiso de Goias 1-GO, CEP 72.870-223", "36769602007168", "3019"], ["free", "Free Center Setor Norte", "Planaltina", "Quadra Qa 3 Mc Lote 03 e Mr Lotes 03 Sobreloja S/N, Setor Norte, Planaltina-GO, CEP 73.751-203", "36769602007591", "3020"], ["free", "Free Center Formosa", "Formosa", "Rua Visconde de Porto Seguro Nº 615A, Centro, Formosa-GO, CEP 73.801-010", "36769602007753", "3021"], ["free", "Free Center Luziânia", "Luziânia", "Rua do Comercio (Comendador Germano Roriz) N° 110, Centro, Luziânia-GO, CEP 72.800-010", "36769602007915", "3022"], ["free", "Free Center Parque Esplanada Iii", "Valparaiso de Goias 2", "Quadra 1 S/N Br 040 Km 12 Gleba F Lote 01 Loja 262/264/265, Parque Esplanada Iii, Valparaiso de Goias 2-GO, CEP 72.876-301", "36769602008563", "3023"], ["free", "Free Center Cidade Ocidental", "Cidade Ocidental", "Sq 18 Quadra 01 S/N Lote 35 Terreo e Subsolo Lote 70 Terreo Edif Carla, Centro, Cidade Ocidental-GO, CEP 72.880-616", "36769602008725", "3024"], ["free", "Free Center Setor Centro", "Cristalina", "Rua Goias S/N Quadra 22 Lote 09 Loja Terrea, Setor Centro, Cristalina-GO, CEP 72.850-000", "36769602009373", "3025"], ["free", "Free Center Carrilho", "Goianesia", "Avenida Goias N° 259 Quadra 82 Lote 26, Carrilho, Goianesia-GO, CEP 76.380-745", "36769602009535", "3026"], ["free", "Free Center Caldas Novas", "Caldas Novas", "Av Coronel Bento de Godoy Com Rua Jose Borges S/N Quadra 23 Lote 1A, Centro, Caldas Novas-GO, CEP 75.680-021", "36769602010207", "3027"], ["free", "Free Center Setor Garavelo", "Aparecida de Goiania", "Avenida da Igualdade, S/N Quadra 111 Lote 01, Setor Garavelo, Aparecida de Goiania-GO, CEP 74.930-530", "36769602012404", "3028"], ["free", "Free Center Inhumas", "Inhumas", "Pc Belarmino Essado S/N Quadra 52 Lote 17, Centro, Inhumas-GO, CEP 75.400-525", "36769602013567", "3029"]];
  const NOMES = ["Ana Clara Ribeiro", "Bruna Martins", "Carla Souza", "Daniela Costa", "Elaine Rocha", "Fernanda Lima", "Gabriela Alves", "Helena Duarte", "Isabela Moura", "Juliana Freitas", "Karina Mendes", "Larissa Nunes", "Mariana Teixeira", "Natália Prado", "Olívia Campos", "Patrícia Gomes", "Rafaela Barros", "Sabrina Araújo", "Tatiane Pires", "Vanessa Lopes", "Yasmin Cardoso", "Amanda Viana", "Bianca Moreira", "Camila Dias", "Débora Santos", "Eduarda Melo", "Flávia Rezende", "Giovana Castro", "Jéssica Farias", "Ana Paula Siqueira"];
  const PRIMEIROS = ["Maria", "José", "Antônia", "Francisca", "Joana", "Luciana", "Rosângela", "Cláudia", "Edna", "Marcos", "Paulo", "Sandra", "Adriana", "Kátia", "Simone", "Raimunda", "Valéria", "Cristiane", "Lúcia", "Aline", "Priscila", "Thaís", "Renata", "Josefa"];
  const SOBREN = ["Silva", "Santos", "Oliveira", "Souza", "Pereira", "Lima", "Ferreira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Araújo", "Carvalho", "Gomes", "Ribeiro"];

  // as 6 últimas da lista ainda estão entrando (sem cupons); as outras 24 já estão no ar
  const ETAPAS_SEED = Array(24).fill("no_ar").concat(["aprovada", "gravacao", "gravacao", "kit", "contrato", "convidada"]);
  function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
  function cpfAleatorio(r) {
    const d = Array.from({ length: 9 }, () => Math.floor(r() * 10));
    for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += d[i] * (t + 1 - i); d.push(((s * 10) % 11) % 10); }
    return d.join("");
  }

  function semente() {
    const r = rng(20261128);
    const st = { sabados: [], lojas: [], influencers: [], cadastros: [], base: [], fimdeano: [], tokens: [], cfg: { teste: true }, seq: { loja: 0, inf: 0, cad: 0 } };
    st.sabados = [
      { id: 1, n: 1, data: "2026-11-28", label: "Black Friday", meta: 50, fixo: 1000 },
      { id: 2, n: 2, data: "2026-12-05", label: "Abertura do Natal", meta: 70, fixo: 1500 },
      { id: 3, n: 3, data: "2026-12-12", label: "Natal", meta: 130, fixo: 1500 },
    ];
    LOJAS_GTO.forEach(([bandeira, nome, cidade, endereco, cnpj, pin], i) => st.lojas.push({ id: i + 1, bandeira, nome, cidade, endereco, horario: "9h às 18h", pin, cnpj }));
    st.seq.loja = LOJAS_GTO.length;
    // influencers de exemplo espalhadas nas 3 bandeiras (18 Tesoura, 6 Magazine, 6 Free Center)
    const fila = { tesoura: [], magazine: [], free: [] };
    st.lojas.forEach((l) => fila[l.bandeira].push(l.id));
    const lojaDaInf = (i) => { const b = ["tesoura", "tesoura", "magazine", "free", "tesoura"][i % 5]; return fila[b].shift(); };
    const prefixos = [];
    NOMES.forEach((nome, i) => {
      const prefixo = U.gerarPrefixo(nome, prefixos); prefixos.push(prefixo);
      st.influencers.push({ id: i + 1, nome, slug: prefixo.toLowerCase(), prefixo, instagram: "@" + U.semAcento(nome).toLowerCase().replace(/\s+/g, "."), whatsapp: "", loja_id: lojaDaInf(i), sabado_id: 1, lote: 100, meta: 50, foto: "", ativo: true, seq: 0, criado_em: "2026-11-13T10:00:00", etapa: ETAPAS_SEED[i], notas: "" });
    });
    st.seq.inf = NOMES.length;
    // cadastros simulados do 1º sábado: emissões de 21 a 28/11 e uso no dia 28
    const dias = ["2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"];
    const peso = [6, 3, 3, 5, 14, 10, 22, 37];
    const totalPeso = peso.reduce((a, b) => a + b, 0);
    st.influencers.forEach((inf) => {
      if (inf.etapa !== "no_ar") return;
      const emitidos = 18 + Math.floor(r() * 82);
      const taxaUso = 0.35 + r() * 0.45;
      for (let k = 0; k < emitidos; k++) {
        let x = r() * totalPeso, di = 0; while (x > peso[di]) { x -= peso[di]; di++; }
        const dia = dias[Math.min(di, dias.length - 1)];
        inf.seq++;
        const cpf = cpfAleatorio(r);
        const usado = r() < taxaUso;
        const h = 9 + Math.floor(r() * 9), m = Math.floor(r() * 60);
        st.cadastros.push({
          id: ++st.seq.cad, codigo: U.codigo(inf.prefixo, inf.seq), influencer_id: inf.id, sabado_id: 1, loja_id: inf.loja_id, bandeira: st.lojas[inf.loja_id - 1].bandeira,
          nome: `${PRIMEIROS[Math.floor(r() * PRIMEIROS.length)]} ${SOBREN[Math.floor(r() * SOBREN.length)]}`, cpf, whatsapp: "6199" + String(1000000 + Math.floor(r() * 8999999)), bairro: "",
          criado_em: `${dia}T${String(dia === "2026-11-28" ? 7 + Math.floor(r() * 2) : 8 + Math.floor(r() * 13)).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}:00`,
          status: usado ? "usado" : "emitido", usado_em: usado ? `2026-11-28T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00` : null,
          cupom_fiscal: null, valor: usado ? Math.round(60 + r() * 340) : null, nfce_chave: null, origem: "",
        });
        if (usado) {
          const l = st.lojas[inf.loja_id - 1], nnf = 10000 + Math.floor(r() * 89999);
          const ch = (inf.loja_id >= 18 ? "52" : "53") + "2611" + l.cnpj + "65" + "001" + String(nnf).padStart(9, "0") + "1" + String(Math.floor(r() * 99999999)).padStart(8, "0") + "0";
          const ult = st.cadastros[st.cadastros.length - 1];
          Object.assign(ult, { nfce_chave: ch, cupom_fiscal: "NFC-e " + nnf, origem: "pdv" });
        }
        if (r() < 0.42) st.base.push(cpf); // já era cliente na base da GTO
      }
    });
    // campanha de fim de ano (30/10 a 31/12): parte de quem pegou o cupom também cadastrou nota; o resto só está no sorteio
    const notaFA = (cpf, nome, loja, quem, bandeira) => {
      const dia = 1 + Math.floor(r() * 30), mes = r() < 0.45 ? 11 : 12;
      st.fimdeano.push({ bandeira, cpf, nome, nota: String(100000 + Math.floor(r() * 899999)), data: `2026-${mes}-${String(dia).padStart(2, "0")}T${String(9 + Math.floor(r() * 9)).padStart(2, "0")}:00:00-03:00`, valor: Math.round(quem * (150 + r() * 330)), loja });
    };
    st.cadastros.forEach((c) => {
      const chance = c.status === "usado" ? 0.55 : 0.22;
      if (r() < chance) { const n = 1 + Math.floor(r() * (c.status === "usado" ? 3 : 2)); for (let k = 0; k < n; k++) notaFA(c.cpf, c.nome, st.lojas[c.loja_id - 1].nome, 1.15, c.bandeira); }
    });
    for (let k = 0; k < 1400; k++) {
      const cpf = cpfAleatorio(r), nome = `${PRIMEIROS[Math.floor(r() * PRIMEIROS.length)]} ${SOBREN[Math.floor(r() * SOBREN.length)]}`, lj = st.lojas[Math.floor(r() * st.lojas.length)];
      const n = 1 + (r() < 0.25 ? 1 : 0); for (let j = 0; j < n; j++) notaFA(cpf, nome, lj.nome, 1, lj.bandeira);
    }
    return st;
  }

  function carregar() {
    if (S) return S;
    try { const t = localStorage.getItem(CHAVE); if (t) S = JSON.parse(t); } catch (e) { /* sem acesso ao armazenamento */ }
    if (!S) S = memoria || semente();
    return S;
  }
  function gravar() { memoria = S; try { localStorage.setItem(CHAVE, JSON.stringify(S)); } catch (e) { /* segue em memória */ } }
  const espera = (v) => new Promise((ok) => setTimeout(() => ok(JSON.parse(JSON.stringify(v))), 120));
  const falha = (msg) => Promise.reject(new Error(msg));
  const admOk = (pin) => String(pin) === PIN_ADMIN;
  const porId = (lista, id) => lista.find((x) => x.id === +id);

  // tokens do PDV: com algum importado, o cadastro recebe o próximo token livre da influencer (todo token tem influencer)
  // modo tokens vale por bandeira (basta um token de alguma influencer da bandeira)
  const bandInf = (infId) => { const i = porId(S.influencers, infId); const l = i && porId(S.lojas, i.loja_id); return (l && l.bandeira) || "tesoura"; };
  const tokensAtivos = (band) => (S.tokens || []).some((t) => bandInf(t.influencer_id) === band);
  const tokensLivres = (infId) => (S.tokens || []).filter((t) => !t.cadastro_id && t.influencer_id === infId);
  function cupomCompleto(c) {
    const inf = porId(S.influencers, c.influencer_id), loja = porId(S.lojas, c.loja_id), sab = porId(S.sabados, c.sabado_id);
    return { codigo: c.codigo, status: c.status, nome: c.nome, cpf_mascara: U.mascaraCPF(c.cpf), influencer: inf ? inf.nome : "", loja_id: c.loja_id, loja_nome: loja ? loja.nome : "", sabado_data: sab ? sab.data : null, sabado_n: sab ? sab.n : null, usado_em: c.usado_em, cupom_fiscal: c.cupom_fiscal, valor: c.valor, nfce_chave: c.nfce_chave || null, origem: c.origem || "" };
  }
  // confere a nota fiscal (chave NFC-e) contra a loja e o mês do sábado; devolve erro em texto ou ""
  function conferirNota(nf, c) {
    const loja = porId(S.lojas, c.loja_id), sab = porId(S.sabados, c.sabado_id);
    if (loja && loja.cnpj && nf.cnpj !== loja.cnpj) return `A nota é de outro CNPJ (${U.fmtCNPJ(nf.cnpj)}), não da ${loja.nome}.`;
    if (sab && nf.aamm !== sab.data.slice(2, 4) + sab.data.slice(5, 7)) return `A nota é de outro mês (${nf.aamm.slice(2)}/${nf.aamm.slice(0, 2)}).`;
    const dono = S.cadastros.find((x) => x.nfce_chave === nf.chave && x.id !== c.id);
    if (dono) return `Esta nota já foi usada no cupom ${dono.codigo}.`;
    return "";
  }
  function checar(c, loja) {
    const motivos = [];
    const sab = porId(S.sabados, c.sabado_id);
    if (c.status === "usado") motivos.push(`Cupom já usado em ${U.horaBR(c.usado_em)}.`);
    if (c.loja_id !== loja.id) { const l = porId(S.lojas, c.loja_id); motivos.push(`Cupom de outra loja: ${l ? l.nome : ""}.`); }
    const foraDoDia = sab && sab.data !== U.hojeISO();
    if (foraDoDia && !S.cfg.teste) motivos.push(`Cupom vale só no sábado ${U.dataBR(sab.data)}.`);
    return { valido: motivos.length === 0, motivos, aviso_teste: foraDoDia && S.cfg.teste ? `Modo teste: a data (${U.dataBR(sab.data)}) não está sendo conferida.` : "" };
  }

  window.API = {
    modo: "demo",
    pinDemo: { admin: PIN_ADMIN, loja: "1001" },

    lpInfo(slug) {
      carregar();
      const inf = S.influencers.find((i) => i.slug === String(slug || "").toLowerCase());
      if (!inf || !inf.ativo) return falha("Página não encontrada.");
      const loja = porId(S.lojas, inf.loja_id), sab = porId(S.sabados, inf.sabado_id);
      const emitidos = S.cadastros.filter((c) => c.influencer_id === inf.id && c.sabado_id === inf.sabado_id).length;
      const disp = Math.max(0, inf.lote - emitidos);
      return espera({ influencer: { nome: inf.nome, slug: inf.slug, prefixo: inf.prefixo, instagram: inf.instagram, foto: inf.foto }, loja, sabado: sab, lote: inf.lote, emitidos, disponiveis: tokensAtivos(loja.bandeira || "tesoura") ? Math.min(disp, tokensLivres(inf.id).length) : disp });
    },

    cadastrar({ slug, nome, cpf, whatsapp, bairro, aceite }) {
      carregar();
      const inf = S.influencers.find((i) => i.slug === String(slug || "").toLowerCase() && i.ativo);
      if (!inf) return falha("Página não encontrada.");
      cpf = U.so(cpf);
      if (!String(nome || "").trim() || String(nome).trim().length < 3) return falha("Informe o seu nome.");
      if (!U.cpfValido(cpf)) return falha("CPF inválido. Confira os números.");
      if (U.so(whatsapp).length < 10) return falha("Informe um WhatsApp com DDD.");
      if (!aceite) return falha("Para pegar o cupom, marque a autorização de uso dos dados.");
      const loja = porId(S.lojas, inf.loja_id), sab = porId(S.sabados, inf.sabado_id);
      const existe = S.cadastros.find((c) => c.cpf === cpf && c.sabado_id === inf.sabado_id && (c.bandeira || "tesoura") === (loja.bandeira || "tesoura"));
      if (existe) {
        const dono = porId(S.influencers, existe.influencer_id);
        return espera({ codigo: existe.codigo, ja_existia: true, outra_influencer: existe.influencer_id !== inf.id ? dono.nome : "", influencer: dono.nome, loja: porId(S.lojas, existe.loja_id), sabado: porId(S.sabados, existe.sabado_id) });
      }
      const emitidos = S.cadastros.filter((c) => c.influencer_id === inf.id && c.sabado_id === inf.sabado_id).length;
      if (emitidos >= inf.lote) return falha(`Os cupons da ${U.primeiroNome(inf.nome)} para este sábado acabaram.`);
      let codigo, tok = null;
      if (tokensAtivos(loja.bandeira || "tesoura")) {
        tok = tokensLivres(inf.id)[0];
        if (!tok) return falha(`Os cupons da ${U.primeiroNome(inf.nome)} para este sábado acabaram.`);
        codigo = tok.codigo;
      } else { inf.seq++; codigo = U.codigo(inf.prefixo, inf.seq); }
      const c = { id: ++S.seq.cad, bandeira: loja.bandeira || "tesoura", codigo, influencer_id: inf.id, sabado_id: inf.sabado_id, loja_id: inf.loja_id, nome: String(nome).trim(), cpf, whatsapp: U.so(whatsapp), bairro: String(bairro || "").trim(), criado_em: new Date().toISOString(), status: "emitido", usado_em: null, cupom_fiscal: null, valor: null };
      S.cadastros.push(c); if (tok) tok.cadastro_id = c.id; gravar();
      return espera({ codigo: c.codigo, ja_existia: false, outra_influencer: "", influencer: inf.nome, loja, sabado: sab });
    },

    balcaoEntrar(pin) {
      carregar();
      const loja = S.lojas.find((l) => l.pin === String(pin).trim());
      return loja ? espera({ loja }) : falha("PIN da loja não encontrado.");
    },

    balcaoBuscar(pin, termo) {
      carregar();
      const loja = S.lojas.find((l) => l.pin === String(pin));
      if (!loja) return falha("Sessão da loja expirou. Entre de novo.");
      const t = U.normCodigo(termo), d = U.so(termo);
      let achados = [];
      if (d.length === 11 && /^\d+$/.test(t)) achados = S.cadastros.filter((c) => c.cpf === d);
      else achados = S.cadastros.filter((c) => U.normCodigo(c.codigo) === t);
      if (!achados.length) return falha(d.length === 11 ? "Nenhum cupom para este CPF." : "Cupom não encontrado. Confira as letras e os números.");
      // prioriza o cupom desta loja ainda não usado
      achados.sort((a, b) => (b.loja_id === loja.id) - (a.loja_id === loja.id) || (a.status === "emitido" ? -1 : 1));
      const c = achados[0];
      return espera({ cupom: cupomCompleto(c), ...checar(c, loja) });
    },

    balcaoValidar(pin, codigo, cupomFiscal, valor) {
      carregar();
      const loja = S.lojas.find((l) => l.pin === String(pin));
      if (!loja) return falha("Sessão da loja expirou. Entre de novo.");
      const c = S.cadastros.find((x) => U.normCodigo(x.codigo) === U.normCodigo(codigo));
      if (!c) return falha("Cupom não encontrado.");
      const ch = checar(c, loja);
      if (!ch.valido) return falha(ch.motivos.join(" "));
      if (!String(cupomFiscal || "").trim()) return falha("Leia o QR do cupom fiscal ou digite o número da nota.");
      const nf = U.lerNFCe(cupomFiscal);
      if (nf) { const erro = conferirNota(nf, c); if (erro) return falha(erro); }
      c.status = "usado"; c.usado_em = new Date().toISOString(); c.origem = "balcao";
      c.cupom_fiscal = nf ? "NFC-e " + nf.numero : String(cupomFiscal).trim(); c.nfce_chave = nf ? nf.chave : null;
      c.valor = +String(valor || "0").replace(/\./g, "").replace(",", ".") || null;
      gravar();
      return espera({ ok: true, cupom: cupomCompleto(c) });
    },

    balcaoRecentes(pin) {
      carregar();
      const loja = S.lojas.find((l) => l.pin === String(pin));
      if (!loja) return espera([]);
      return espera(S.cadastros.filter((c) => c.loja_id === loja.id && c.status === "usado").sort((a, b) => String(b.usado_em).localeCompare(a.usado_em)).slice(0, 8).map(cupomCompleto));
    },

    admEntrar(pin) { return admOk(pin) ? espera(true) : falha("PIN incorreto."); },

    dados(pin, sabadoId, band) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada. Entre de novo.");
      const sid = +sabadoId || null;
      const lojas = S.lojas.filter((l) => !band || l.bandeira === band), lojasIds = new Set(lojas.map((l) => l.id));
      const base = new Set(S.base);
      const temBase = S.base.length > 0;
      const infs = S.influencers.filter((i) => lojasIds.has(i.loja_id)).map((i) => {
        const cs = S.cadastros.filter((c) => c.influencer_id === i.id && (!sid || c.sabado_id === sid));
        const us = cs.filter((c) => c.status === "usado");
        return { ...i, emitidos: cs.length, usados: us.length, novos: temBase ? us.filter((c) => !base.has(c.cpf)).length : null, ultimo: cs.reduce((m, c) => (c.criado_em > m ? c.criado_em : m), "") };
      });
      const serie = {};
      S.cadastros.filter((c) => (!sid || c.sabado_id === sid) && (!band || c.bandeira === band)).forEach((c) => {
        const d1 = c.criado_em.slice(0, 10); (serie[d1] = serie[d1] || { dia: d1, emitidos: 0, usados: 0 }).emitidos++;
        if (c.usado_em) { const d2 = c.usado_em.slice(0, 10); (serie[d2] = serie[d2] || { dia: d2, emitidos: 0, usados: 0 }).usados++; }
      });
      return espera({ sabados: S.sabados, lojas, influencers: infs, serie: Object.values(serie).sort((a, b) => a.dia.localeCompare(b.dia)), base_total: S.base.length, teste: S.cfg.teste });
    },

    salvarInfluencer(pin, o) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada.");
      if (!String(o.nome || "").trim()) return falha("Informe o nome da influencer.");
      if (!porId(S.lojas, o.loja_id)) return falha("Escolha a loja.");
      if (!porId(S.sabados, o.sabado_id)) return falha("Escolha o sábado.");
      let inf = o.id ? porId(S.influencers, o.id) : null;
      const outros = S.influencers.filter((i) => !inf || i.id !== inf.id).map((i) => i.prefixo);
      let prefixo = U.normCodigo(o.prefixo || "");
      if (!prefixo) prefixo = U.gerarPrefixo(o.nome, outros);
      if (outros.includes(prefixo)) return falha(`O prefixo ${prefixo} já é de outra influencer.`);
      if (inf && inf.prefixo !== prefixo && S.cadastros.some((c) => c.influencer_id === inf.id)) return falha("Não dá para trocar o prefixo de quem já tem cupons emitidos.");
      const campos = { nome: String(o.nome).trim(), prefixo, slug: prefixo.toLowerCase(), instagram: o.instagram || "", whatsapp: U.so(o.whatsapp), loja_id: +o.loja_id, sabado_id: +o.sabado_id, lote: Math.max(1, +o.lote || 100), meta: Math.max(1, +o.meta || 50), foto: o.foto === undefined ? (inf ? inf.foto : "") : (o.foto || ""), ativo: o.ativo !== false, etapa: o.etapa || (inf && inf.etapa) || "convidada", notas: o.notas != null ? String(o.notas) : (inf && inf.notas) || "" };
      if (inf) Object.assign(inf, campos);
      else { inf = { id: ++S.seq.inf, seq: 0, criado_em: new Date().toISOString(), ...campos }; S.influencers.push(inf); }
      gravar();
      return espera(inf);
    },

    async importarInfluencers(pin, linhas) {
      carregar();
      if (!admOk(pin)) throw new Error("Sessão expirada.");
      const res = { criadas: [], erros: [] };
      for (const [i, l] of linhas.entries()) {
        const ac = U.acharLoja(S.lojas, l.loja, l.bandeira);
        const sab = S.sabados.find((x) => String(x.n) === String(l.sabado || 1));
        if (!ac.loja) { res.erros.push(`Linha ${i + 1}: ${ac.erro}.`); continue; }
        const loja = ac.loja;
        try {
          const inf = await this.salvarInfluencer(pin, { nome: l.nome, instagram: l.instagram, whatsapp: l.whatsapp, loja_id: loja.id, sabado_id: sab ? sab.id : 1, lote: l.lote || 100, meta: l.meta || (sab ? sab.meta : 50) });
          res.criadas.push(inf.prefixo);
        } catch (e) { res.erros.push(`Linha ${i + 1}: ${e.message}`); }
      }
      return res;
    },

    salvarLoja(pin, o) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada.");
      if (!String(o.nome || "").trim()) return falha("Informe o nome da loja.");
      const pinLoja = String(o.pin || "").trim();
      if (!/^\d{4,6}$/.test(pinLoja)) return falha("O PIN da loja precisa ter de 4 a 6 números.");
      if (S.lojas.some((l) => l.pin === pinLoja && l.id !== +o.id)) return falha("Esse PIN já é de outra loja.");
      let loja = o.id ? porId(S.lojas, o.id) : null;
      const cnpj = U.so(o.cnpj);
      if (cnpj && cnpj.length !== 14) return falha("O CNPJ precisa ter 14 números.");
      if (o.bandeira && !["tesoura", "magazine", "free"].includes(o.bandeira)) return falha("Escolha a bandeira da loja.");
      const campos = { nome: o.nome.trim(), cidade: o.cidade || "", endereco: o.endereco || "", horario: o.horario || "", pin: pinLoja, cnpj, bandeira: o.bandeira || (loja && loja.bandeira) || "tesoura" };
      if (loja) Object.assign(loja, campos); else { loja = { id: ++S.seq.loja, ...campos }; S.lojas.push(loja); }
      gravar();
      return espera(loja);
    },

    salvarSabado(pin, o) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada.");
      const s = porId(S.sabados, o.id);
      if (!s) return falha("Sábado não encontrado.");
      Object.assign(s, { data: o.data, label: o.label, meta: +o.meta || s.meta, fixo: +o.fixo || s.fixo });
      gravar();
      return espera(s);
    },

    cadastros(pin, f = {}) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada.");
      const b = U.semAcento(f.busca || "").toLowerCase().trim(), bd = U.so(f.busca);
      let l = S.cadastros.filter((c) => (!+f.sabado_id || c.sabado_id === +f.sabado_id) && (!+f.influencer_id || c.influencer_id === +f.influencer_id) && (!+f.loja_id || c.loja_id === +f.loja_id) && (!f.bandeira || c.bandeira === f.bandeira) && (!f.status || c.status === f.status));
      if (b) l = l.filter((c) => c.codigo.toLowerCase().includes(b) || U.semAcento(c.nome).toLowerCase().includes(b) || (bd.length >= 4 && c.cpf.includes(bd)));
      const base = new Set(S.base);
      l = l.sort((a, b2) => String(b2.criado_em).localeCompare(a.criado_em));
      return espera({ total: l.length, linhas: l.slice(0, 500).map((c) => ({ ...cupomCompleto(c), cpf: c.cpf, whatsapp: c.whatsapp, criado_em: c.criado_em, cliente_novo: S.base.length ? !base.has(c.cpf) : null })) });
    },

    baseCpfs(pin, cpfs, substituir) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada.");
      const novos = cpfs.map(U.so).filter((c) => c.length === 11);
      S.base = substituir ? [...new Set(novos)] : [...new Set([...S.base, ...novos])];
      gravar();
      return espera({ total: S.base.length, lidos: novos.length });
    },

    // notas escaneadas no clube (Rock): CPF + chave da NFC-e + data + valor. Dá baixa no cupom do CPF.
    importarNotas(pin, linhas) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada.");
      const r = { usados: 0, ja_usados: 0, sem_cupom: 0, recusadas: 0, detalhes: [] };
      linhas.forEach((l, i) => {
        const cpf = U.so(l.cpf), nf = U.lerNFCe(l.chave), quando = U.dataISO(l.data);
        if (!U.cpfValido(cpf) || !nf) { r.recusadas++; r.detalhes.push(`Linha ${i + 1}: CPF ou chave da nota inválidos.`); return; }
        const cs = S.cadastros.filter((c) => c.cpf === cpf).filter((c) => { const sb = porId(S.sabados, c.sabado_id); return !quando || sb.data === quando.slice(0, 10); });
        if (!cs.length) { r.sem_cupom++; return; }
        const c = cs.find((x) => x.status === "emitido") || cs[0];
        if (c.status === "usado") { r.ja_usados++; return; }
        const erro = conferirNota(nf, c);
        if (erro) { r.recusadas++; r.detalhes.push(`Linha ${i + 1} (${c.codigo}): ${erro}`); return; }
        Object.assign(c, { status: "usado", usado_em: quando || new Date().toISOString(), origem: "rock", nfce_chave: nf.chave, cupom_fiscal: "NFC-e " + nf.numero, valor: +String(l.valor || "0").replace(/\./g, "").replace(",", ".") || null });
        r.usados++;
      });
      gravar();
      return espera(r);
    },

    // vendas do PDV com cupom: cupom; CPF; nota (chave ou número); data; valor. Dá baixa pelo código do cupom.
    importarVendas(pin, linhas) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada.");
      const r = { usados: 0, ja_usados: 0, sem_cupom: 0, recusadas: 0, detalhes: [] };
      linhas.forEach((l, i) => {
        const cod = U.normCodigo(l.cupom), cpf = U.so(l.cpf), nf = U.lerNFCe(l.nota), quando = U.dataISO(l.data);
        const c = S.cadastros.find((x) => U.normCodigo(x.codigo) === cod);
        if (!c) { r.sem_cupom++; r.detalhes.push(`Linha ${i + 1}: o cupom ${cod || "(vazio)"} foi usado no caixa sem cadastro na página. Não conta para a meta.`); return; }
        if (cpf && cpf !== c.cpf) { r.recusadas++; r.detalhes.push(`Linha ${i + 1} (${c.codigo}): CPF da venda diferente do CPF do cadastro.`); return; }
        if (c.status === "usado") { r.ja_usados++; return; }
        if (nf) { const erro = conferirNota(nf, c); if (erro) { r.recusadas++; r.detalhes.push(`Linha ${i + 1} (${c.codigo}): ${erro}`); return; } }
        Object.assign(c, { status: "usado", usado_em: quando || new Date().toISOString(), origem: "pdv", nfce_chave: nf ? nf.chave : null, cupom_fiscal: nf ? "NFC-e " + nf.numero : String(l.nota || "").trim() || null, valor: +String(l.valor || "0").replace(/\./g, "").replace(",", ".") || null });
        r.usados++;
      });
      gravar();
      return espera(r);
    },

    importarTokens(pin, linhas, substituir) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada.");
      if (!S.tokens) S.tokens = [];
      const limpas = new Set();
      const r = { importados: 0, repetidos: 0, recusados: 0, detalhes: [] };
      const det = (m) => { r.recusados++; if (r.detalhes.length < 12) r.detalhes.push(m); };
      linhas.forEach((l, i) => {
        const cod = String(l.token || "").trim(), norm = U.normCodigo(cod), alvo = U.semAcento(String(l.influencer || "")).toLowerCase().trim();
        if (norm.length < 3) return det(`Linha ${i + 1}: token vazio ou curto demais.`);
        if (!alvo) return det(`Linha ${i + 1}: ${cod} sem influencer. Todo token precisa ser de uma influencer.`);
        const inf = S.influencers.find((x) => x.prefixo.toLowerCase() === alvo || x.slug === alvo || U.semAcento(x.nome).toLowerCase() === alvo) || S.influencers.find((x) => U.semAcento(U.primeiroNome(x.nome)).toLowerCase() === alvo);
        if (!inf) return det(`Linha ${i + 1}: influencer "${l.influencer}" não encontrada.`);
        const infId = inf.id;
        if (substituir && !limpas.has(infId)) { S.tokens = S.tokens.filter((t) => t.cadastro_id || t.influencer_id !== infId); limpas.add(infId); }
        if (S.tokens.some((t) => U.normCodigo(t.codigo) === norm)) { r.repetidos++; return; }
        if (S.cadastros.some((c) => U.normCodigo(c.codigo) === norm)) return det(`Linha ${i + 1}: ${cod} já é um cupom emitido.`);
        S.tokens.push({ codigo: cod, influencer_id: infId, cadastro_id: null, importado_em: new Date().toISOString() });
        r.importados++;
      });
      gravar();
      return espera({ ...r, total: S.tokens.length, livres: S.tokens.filter((t) => !t.cadastro_id).length });
    },

    tokens(pin) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada.");
      const T = S.tokens || [];
      return espera({ total: T.length, livres: T.filter((t) => !t.cadastro_id).length,
        influencers: [...S.influencers].sort((a, b) => a.nome.localeCompare(b.nome)).map((i) => { const m = T.filter((t) => t.influencer_id === i.id); return { id: i.id, nome: i.nome, prefixo: i.prefixo, total: m.length, livres: m.filter((t) => !t.cadastro_id).length }; }) });
    },

    // campanha de fim de ano: CPF; nome; nota; data; valor; loja. Uma linha por nota; repetida (mesmo CPF e nota) é ignorada.
    importarFimDeAno(pin, linhas, substituir, band) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada.");
      if (!["tesoura", "magazine", "free"].includes(band)) return falha("Escolha de qual bandeira é a campanha.");
      if (!S.fimdeano) S.fimdeano = [];
      if (substituir) S.fimdeano = S.fimdeano.filter((x) => x.bandeira !== band);
      const ja = new Set(S.fimdeano.map((x) => x.cpf + "|" + x.nota + "|" + x.bandeira));
      const r = { importadas: 0, repetidas: 0, recusadas: 0, detalhes: [] };
      linhas.forEach((l, i) => {
        let cpf = U.so(l.cpf); if (cpf.length >= 9 && cpf.length <= 10) cpf = cpf.padStart(11, "0"); // o Excel tira o zero à esquerda
        if (!U.cpfValido(cpf)) { r.recusadas++; if (r.detalhes.length < 12) r.detalhes.push(`Linha ${i + 1}: CPF inválido.`); return; }
        const nf = U.lerNFCe(l.nota), nota = nf ? nf.chave : String(l.nota || "").trim() || `sem-nota-${l.data}-${l.valor}`;
        if (ja.has(cpf + "|" + nota + "|" + band)) { r.repetidas++; return; }
        ja.add(cpf + "|" + nota + "|" + band);
        S.fimdeano.push({ bandeira: band, cpf, nome: String(l.nome || "").trim(), nota, data: U.dataISO(l.data) || null, valor: U.valorNum(l.valor), loja: String(l.loja || "").trim() });
        r.importadas++;
      });
      gravar();
      const daB = S.fimdeano.filter((x) => x.bandeira === band);
      return espera({ ...r, total_notas: daB.length, total_cpfs: new Set(daB.map((x) => x.cpf)).size });
    },

    // cruzamento por CPF: página da influencer x campanha de fim de ano (mesma conta de adm_comparativo no banco)
    comparativo(pin, sabadoId, band) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada.");
      const fa = new Map();
      (S.fimdeano || []).filter((n) => !band || n.bandeira === band).forEach((n) => { const x = fa.get(n.cpf) || { notas: 0, valor: 0, lista: [] }; x.notas++; x.valor += +n.valor || 0; x.lista.push(n); fa.set(n.cpf, x); });
      const primeiro = new Map();
      S.cadastros.filter((c) => !band || c.bandeira === band).forEach((c) => { if (!primeiro.has(c.cpf) || c.criado_em < primeiro.get(c.cpf)) primeiro.set(c.cpf, c.criado_em); });
      const lp = new Map();
      S.cadastros.filter((c) => (!sabadoId || c.sabado_id === +sabadoId) && (!band || c.bandeira === band)).sort((a, b) => String(a.criado_em).localeCompare(b.criado_em)).forEach((c) => { if (!lp.has(c.cpf)) lp.set(c.cpf, c); });
      const t = { lp: lp.size, lp_usaram: 0, lp_valor_cupom: 0, fa_cpfs: fa.size, fa_notas: 0, fa_valor: 0, ambos: 0, ambos_notas: 0, ambos_valor: 0, ambos_pos_valor: 0, ambos_pos_notas: 0, ambos_usaram: 0, so_fa: 0, so_fa_valor: 0 };
      fa.forEach((x, cpf) => { t.fa_notas += x.notas; t.fa_valor += x.valor; if (!lp.has(cpf)) { t.so_fa++; t.so_fa_valor += x.valor; } });
      const porInf = new Map(), pessoas = [];
      lp.forEach((c) => {
        const f = fa.get(c.cpf), ini = new Date(primeiro.get(c.cpf)).getTime();
        const pos = f ? f.lista.filter((n) => !n.data || new Date(n.data).getTime() >= ini) : [];
        const posValor = pos.reduce((a, n) => a + (+n.valor || 0), 0);
        if (c.status === "usado") { t.lp_usaram++; t.lp_valor_cupom += +c.valor || 0; }
        if (f) { t.ambos++; t.ambos_notas += f.notas; t.ambos_valor += f.valor; t.ambos_pos_valor += posValor; t.ambos_pos_notas += pos.length; if (c.status === "usado") t.ambos_usaram++; }
        const inf = porId(S.influencers, c.influencer_id);
        const z = porInf.get(inf.id) || { id: inf.id, nome: inf.nome, slug: inf.slug, prefixo: inf.prefixo, loja_id: inf.loja_id, lp: 0, usaram: 0, valor_cupom: 0, ambos: 0, fa_notas: 0, fa_valor: 0, pos_valor: 0 };
        z.lp++; if (c.status === "usado") { z.usaram++; z.valor_cupom += +c.valor || 0; }
        if (f) { z.ambos++; z.fa_notas += f.notas; z.fa_valor += f.valor; z.pos_valor += posValor; }
        porInf.set(inf.id, z);
        pessoas.push({ cpf: c.cpf, nome: c.nome, codigo: c.codigo, influencer: inf.nome, loja: (porId(S.lojas, c.loja_id) || {}).nome || "", cadastro: c.criado_em, status: c.status, valor_cupom: c.valor, fa_notas: f ? f.notas : 0, fa_valor: f ? f.valor : 0, pos_valor: posValor });
      });
      return espera({ totais: t, influencers: [...porInf.values()].sort((a, b) => b.fa_valor - a.fa_valor || a.nome.localeCompare(b.nome)), pessoas: pessoas.sort((a, b) => b.fa_valor - a.fa_valor) });
    },

    definirTeste(pin, teste) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada.");
      S.cfg.teste = !!teste; gravar();
      return espera({ teste: S.cfg.teste });
    },

    // chaves da API de relatórios (demonstração: a chave é só de mostra, não consulta nada)
    chavesApi(pin) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada.");
      return espera((S.chaves || []).map((c) => ({ ...c, influencer: (porId(S.influencers, c.influencer_id) || {}).nome || null })));
    },
    criarChaveApi(pin, o) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada.");
      if (!String(o.nome || "").trim()) return falha("Informe o nome de quem vai usar a chave.");
      if (o.escopo === "influencer" && !porId(S.influencers, +o.influencer)) return falha("Escolha a influencer da chave.");
      const hex = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
      S.chaves = S.chaves || [];
      const id = S.chaves.reduce((m, c) => Math.max(m, c.id), 0) + 1;
      S.chaves.push({ id, nome: String(o.nome).trim(), escopo: o.escopo, influencer_id: o.escopo === "influencer" ? +o.influencer : null, bandeira: o.bandeira || null, inicio: "sp_" + hex.slice(0, 4) + "…", ativa: true, expira_em: o.expira_em || null, criada_em: new Date().toISOString(), ultimo_uso: null, usos: 0 });
      gravar();
      return espera({ chave: "sp_" + hex, aviso: "Guarde esta chave agora. Ela não será mostrada de novo." });
    },
    revogarChaveApi(pin, id) {
      carregar();
      if (!admOk(pin)) return falha("Sessão expirada.");
      const c = (S.chaves || []).find((x) => x.id === +id);
      if (c) { c.ativa = false; gravar(); }
      return espera(!!c);
    },

    reiniciarDemo(pin) {
      if (!admOk(pin)) return falha("Sessão expirada.");
      S = semente(); gravar();
      return espera(true);
    },
  };
})();

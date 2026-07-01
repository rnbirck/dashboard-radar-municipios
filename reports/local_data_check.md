# Relatório de verificação — Dados locais vs Excels oficiais

**Gerado em:** 2026-06-30T22:50:43Z
**Fonte Excel:** `C:\Users\rnbirck\PROJETOS\CEI\cei\ranking_municipios\DB\data`

## 1. Arquivos Excel

[OK] base_final_municipio.xlsx  (301,715 bytes)  SHA256=f280fa692785474ee9d0a1f38a96a32934302223ec2ad161e819f08bfdddd089
[OK] base_educacao.xlsx  (982,737 bytes)  SHA256=4601fa57a94b19a1c2a4999bb85bbf57ef756f08a5cda24a0188c9a48a82de82
[OK] base_financas.xlsx  (1,617,767 bytes)  SHA256=36f282ab72b7bae3d307b8d84bc70650378aa732dffd4fdb8a2a7ba9249fdcf1
[OK] base_meio_ambiente.xlsx  (1,148,740 bytes)  SHA256=0d2b5b6be89399e1cbf5607f5288ed97d3ffe005cf8ebdceff9bd723b9810c94
[OK] base_saude.xlsx  (1,363,687 bytes)  SHA256=8df24a309322898ece0b9a8e20e40dba1bd750ef57b5d7a27e5db4757129179c
[OK] base_seguranca.xlsx  (1,376,118 bytes)  SHA256=cbb66923e8c9efc40256553fce61da45a7b4d813ee9c237cc893af48f0406403
[OK] base_socioeconomico.xlsx  (1,661,965 bytes)  SHA256=522f28478ce65becb788a1709fea2877079a2c563683f0640f13da4b5e529f34
[OK] pesos_dimensoes_pca.xlsx  (7,933 bytes)  SHA256=9a35d2eba549bbdae447ae467b1cd2afccdc6fa5f390e77aaa9ae68e0ab5943f
[OK] regressao_rf_previsoes.xlsx  (518,633 bytes)  SHA256=662714f086b65d9887fe3661dbd4c79c2a9195aba6d49ec5df6adfe5c2e215ac

## 2. Tabelas no PostgreSQL local

Total de tabelas em public: 78

[OK] ranking_municipios: 2485 rows
[FAIL] base_educacao: AUSENTE
[FAIL] base_financas: AUSENTE
[FAIL] base_meio_ambiente: AUSENTE
[FAIL] base_saude: AUSENTE
[FAIL] base_seguranca: AUSENTE
[FAIL] base_socioeconomico: AUSENTE
[FAIL] pesos_dimensoes_pca: AUSENTE
[FAIL] regressao_rf_previsoes: AUSENTE
[FAIL] dash_municipios_resumo: AUSENTE
[FAIL] dash_municipio_categoria_historico: AUSENTE
[FAIL] dash_municipio_indicadores: AUSENTE
[FAIL] mv_municipio_indicador_mediana_regiao: AUSENTE

## 3. Comparacao: ranking_municipios vs base_final_municipio.xlsx

Excel: 2485 linhas, 13 colunas
Local:  2485 linhas

[OK] Colunas identicas entre Excel e banco local
**nota_final:** 2,485 divergencias de 2,485 (100.00%)
  Diferenca maxima: 0.42380013
  Diferenca mediana: 0.07141553

**ranking_regiao_funcional:** 1,956 divergencias de 2,485 (78.71%)

Amostra (ate 20 divergencias de ranking):
  4300034 Aceguá 2023 RF6: Excel=6.0 Local=7.0
  4300034 Aceguá 2024 RF6: Excel=6.0 Local=8.0
  4300034 Aceguá 2025 RF6: Excel=4.0 Local=3.0
  4300059 Água Santa 2022 RF9: Excel=82.0 Local=92.0
  4300059 Água Santa 2023 RF9: Excel=108.0 Local=115.0
  4300059 Água Santa 2024 RF9: Excel=113.0 Local=112.0
  4300059 Água Santa 2025 RF9: Excel=109.0 Local=110.0
  4300109 Agudo 2021 RF8: Excel=39.0 Local=44.0
  4300109 Agudo 2022 RF8: Excel=43.0 Local=48.0
  4300109 Agudo 2023 RF8: Excel=36.0 Local=38.0
  4300109 Agudo 2024 RF8: Excel=35.0 Local=42.0
  4300109 Agudo 2025 RF8: Excel=38.0 Local=39.0
  4300208 Ajuricaba 2021 RF7: Excel=6.0 Local=7.0
  4300208 Ajuricaba 2022 RF7: Excel=6.0 Local=8.0
  4300208 Ajuricaba 2023 RF7: Excel=6.0 Local=9.0
  4300208 Ajuricaba 2024 RF7: Excel=8.0 Local=7.0
  4300208 Ajuricaba 2025 RF7: Excel=19.0 Local=24.0
  4300307 Alecrim 2021 RF7: Excel=71.0 Local=72.0
  4300307 Alecrim 2022 RF7: Excel=66.0 Local=64.0
  4300307 Alecrim 2023 RF7: Excel=75.0 Local=74.0

[WARN]  VERIFICACAO: Divergencias encontradas — o banco local NAO reflete os Excels.

## 4. Validacao: Picada Cafe (IBGE 4314423) / RF3

[OK] Picada Cafe: 5 registros encontrados
  2021: rank=1, score=7.8242, corede=Hortênsias
  2022: rank=1, score=7.8576, corede=Hortênsias
  2023: rank=5, score=7.4766, corede=Hortênsias
  2024: rank=1, score=7.8328, corede=Hortênsias
  2025: rank=2, score=7.8212, corede=Hortênsias

RF3 municipios em 2025 (banco local): 49
  [OK] 49 conforme esperado.

Picada Cafe rank 2025: 2/49
  [OK] Rank 2 conforme esperado.
## 5. Tabelas derivadas (dash_*, mv_*)

[FAIL] dash_municipios_resumo: AUSENTE
[FAIL] dash_municipio_categoria_historico: AUSENTE
[FAIL] dash_municipio_indicadores: AUSENTE
[FAIL] mv_municipio_indicador_mediana_regiao: AUSENTE

## 6. Resumo dos Excels

| Arquivo | Linhas | Colunas | SHA256 (primeiros 16) |
| --- | --- | --- | --- |
| base_educacao.xlsx | 12425 | 14 | 4601fa57a94b19a1 |
| base_final_municipio.xlsx | 2485 | 13 | f280fa692785474e |
| base_financas.xlsx | 19880 | 14 | 36f282ab72b7bae3 |
| base_meio_ambiente.xlsx | 14910 | 14 | 0d2b5b6be89399e1 |
| base_saude.xlsx | 17395 | 14 | 8df24a309322898e |
| base_seguranca.xlsx | 17395 | 14 | cbb66923e8c9efc4 |
| base_socioeconomico.xlsx | 19880 | 14 | 522f28478ce65bec |
| pesos_dimensoes_pca.xlsx | 41 | 3 | 9a35d2eba549bbda |
| regressao_rf_previsoes.xlsx | 2485 | 22 | 662714f086b65d98 |

Cobertura:
  Indicadores (pesos_dimensoes_pca): 41
  [OK] 41 indicadores
  base_educacao.xlsx: 5 indicadores unicos
  base_financas.xlsx: 8 indicadores unicos
  base_meio_ambiente.xlsx: 6 indicadores unicos
  base_saude.xlsx: 7 indicadores unicos
  base_seguranca.xlsx: 7 indicadores unicos
  base_socioeconomico.xlsx: 8 indicadores unicos

## 7. Conclusao

[FAIL] **FAIL** — 17 verificacao(oes) falharam.
O banco local NAO reflete os Excels oficiais.
Nao execute carga enquanto houver falhas.

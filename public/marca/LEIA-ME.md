# Marca Bevilaqua

Usada por `src/components/layout/marca.tsx` na topbar, no painel do login e
no rodapé da sidebar.

| arquivo | versão | fundo |
|---|---|---|
| `bevilaqua-simbolo.png` | símbolo, preto + verde | claro |
| `bevilaqua-simbolo-claro.png` | símbolo, branco + verde | escuro |
| `bevilaqua-completo.png` | símbolo + palavra, preto + verde | claro |
| `bevilaqua-completo-claro.png` | símbolo + palavra, branco + verde | escuro |

## Origem

Vieram do Drive institucional, da pasta da marca:
`logo original.png` (preto + verde) e `logo verde e branca.png` (branco +
verde), ambos PNG com fundo transparente, 1334x611.

As versões de símbolo **não existiam**. Foram obtidas por recorte do
arquivo oficial, não por redesenho: no original há uma faixa transparente
separando o símbolo (y 0–317) da palavra (y 335–610), então o corte é
exato e não altera um pixel do desenho.

## Por que quatro e não um

O verde (`#a9cf44`) é o mesmo nos dois fundos, mas o preto precisa virar
branco no tema escuro. Recolorir por CSS trocaria as duas cores juntas e
descaracterizaria a marca, então cada versão é um arquivo próprio. A troca
é feita por classe do Tailwind, sem JavaScript.

## Se um dia trocar a marca

Basta substituir os quatro arquivos mantendo os nomes. Se vierem em SVG —
que escala melhor —, troque também a extensão em `ARQUIVOS`, no topo de
`marca.tsx`. Nenhum outro arquivo referencia estes caminhos.

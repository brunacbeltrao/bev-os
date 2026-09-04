# Arquivos da marca Bevilaqua

O componente `src/components/layout/marca.tsx` procura os quatro arquivos
abaixo. Enquanto não existirem, cada tela volta a mostrar o texto que
mostrava antes — nada quebra, a marca só não aparece.

| arquivo | versão | onde é usado |
|---|---|---|
| `bevilaqua-simbolo.svg` | símbolo, **preto + verde** | topbar no tema claro |
| `bevilaqua-simbolo-claro.svg` | símbolo, **branco + verde** | topbar no tema escuro |
| `bevilaqua-completo.svg` | símbolo + palavra, **preto + verde** | rodapé da sidebar (tema claro) |
| `bevilaqua-completo-claro.svg` | símbolo + palavra, **branco + verde** | painel do login e rodapé no tema escuro |

## Por que quatro e não um

O verde (`#a9cf44`) é o mesmo nos dois fundos, mas o preto precisa virar
branco no tema escuro. Recolorir por CSS trocaria as duas cores juntas e
descaracterizaria a marca, então cada versão é um arquivo próprio.

## Formato

SVG de preferência — escala sem borrar e pesa menos. PNG com fundo
transparente também funciona: basta trocar a extensão em `marca.tsx`.
Sem margem em volta: o espaçamento é dado pelo layout.

# Sorteio Black Friday — landing page

Endereço: **https://links.rosanabijoux.com/sorteio/**

| Arquivo | O que é |
|---|---|
| `index.html` | a página (CSS e JS dentro dela) |
| `regulamento.html` | regulamento + privacidade do sorteio (**minuta**, campos em destaque a preencher) |
| `apps-script.gs` | o código que grava os cadastros na planilha do Google |
| `modelo-*.webp/jpg` | foto do topo (recorte de `FOTOS/1000620909.jpg`) |
| `pf-marlett.woff2` | fonte dos títulos (PF Marlett, só os caracteres latinos) |

Tudo o que muda fica no bloco `CONFIG`, no fim de `index.html`.

## 1. Ligar a planilha (uma vez, ~5 minutos)

1. Crie uma planilha nova no Google Planilhas (ex.: "Sorteio Black Friday — cadastros").
2. Menu **Extensões → Apps Script**. Apague o que estiver lá e cole o conteúdo de `apps-script.gs`. Salve.
3. **Implantar → Nova implantação** → engrenagem → **App da Web**.
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
4. Autorize com a conta do Google da loja e copie a **URL do app da Web** (termina em `/exec`).
5. Teste: abra essa URL no navegador. Tem que aparecer `{"ok":true,"servico":"sorteio-black-friday"}`.
6. Cole a URL em `PLANILHA_URL`, no `CONFIG` de `index.html`.

A aba **Cadastros** é criada sozinha no primeiro cadastro. Se mudar o script depois, use
**Implantar → Gerenciar implantações → editar → Nova versão** (a URL continua a mesma).

Enquanto `PLANILHA_URL` estiver vazia, o formulário avisa "O cadastro ainda não está aberto",
e não finge que gravou.

## 2. Antes de divulgar

- [ ] **Autorização do sorteio.** Promoção comercial por sorteio precisa de autorização prévia do
      Ministério da Fazenda (Lei 5.768/71), mesmo gratuita. Validar com advogado ou empresa de promoções.
- [ ] `regulamento.html`: preencher os trechos em destaque e apagar o aviso de minuta.
- [ ] `CONFIG`: `RAZAO_SOCIAL`, `CNPJ`, `DATA_SORTEIO` (ou deixar `null` = "em breve").
- [ ] Fim dos cadastros: `FIM_CADASTROS` no `CONFIG` **e** no `apps-script.gs` (a mesma data; se a página
      ficar só com `DATA_SORTEIO`, ponha essa data no script). Depois dela a página fecha o formulário e o
      script recusa cadastro.
- [ ] Mudou o texto do regulamento? Troque `VERSAO_REGULAMENTO` (vai para a planilha com cada aceite) e a
      data no rodapé do regulamento.
- [ ] Sorteio novo reaproveitando a página: troque `ID_SORTEIO`, senão quem participou do anterior vê
      "cadastro feito" no aparelho.
- [ ] Conferir se `GRUPO_VIP` é o grupo certo (é o mesmo link da página grupovip).
- [ ] Avaliações reais do Google em `AVALIACOES`, `NOTA_GOOGLE`, `TOTAL_AVALIACOES`.
- [ ] `META_PIXEL_ID` e `GA4_ID`, se for anunciar — e ajustar o trecho "Medição da página" no §9 do regulamento.
- [ ] Tirar o `<meta name="robots" content="noindex">` de `index.html` e `regulamento.html`.
- [ ] Testar no celular, no 4G: cadastro → aparece na planilha → botão do grupo → confirmação.

## Eventos de rastreamento

| Quando | Meta Pixel | GA4 |
|---|---|---|
| cadastro gravado na planilha | `Lead` | `generate_lead` |
| clique no botão do grupo VIP | `entrou_grupo_vip` (custom) | `entrou_grupo_vip` |
| botão "Quero participar" do topo | `cta_topo` (custom) | `cta_topo` |
| compartilhar | `compartilhar` (custom) | `compartilhar` |

Links de divulgação com UTM, ex.: `https://links.rosanabijoux.com/sorteio/?utm_source=instagram&utm_medium=stories&utm_campaign=sorteio-bf`.
As UTMs vão para a planilha junto com o cadastro.

## Sobre o "entrou no grupo"

A página só sabe que a pessoa **clicou** no botão do grupo (coluna "Clicou no grupo VIP em").
Quem de fato está no grupo se confere no WhatsApp, no dia do sorteio.

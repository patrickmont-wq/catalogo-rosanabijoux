# Sorteio Black Friday — landing page

Endereço: **https://links.rosanabijoux.com/sorteio/**

| Arquivo | O que é |
|---|---|
| `index.html` | a página (CSS e JS dentro dela) |
| `regulamento.html` | regulamento + privacidade do sorteio (versão de 21/10/2026; as datas de fim e do sorteio são anunciadas depois, com 7 dias de antecedência) |
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

**Mudou alguma coluna** (perguntas novas, como em 21/10)? O script recusa gravar numa aba **Cadastros** com o
cabeçalho antigo (os dados iriam para as colunas erradas). Renomeie a aba antiga (ex.: "Cadastros antigos"):
a próxima inscrição cria a aba nova com o cabeçalho certo. **Ordem:** primeiro o script novo publicado (Nova
versão), depois a página nova no ar — a página nova manda campos que o script antigo recusa.

Colunas desde 21/10: Data · Nome · WhatsApp · E-mail · Se ganhar, vai usar para · Já comprou na Rosana ·
Aceitou regulamento (versão) · Aceitou ofertas (versão; **vazio = não aceitou**) · Clicou no grupo VIP em ·
5 UTMs · Página · (P/Q: conferência dos grupos VIP). Para mandar ofertas, filtre só quem tem a coluna
"Aceitou ofertas" preenchida.

## 2. Antes de divulgar

- [x] `regulamento.html` preenchido (21/10). Ao definir as datas: anunciar com 7 dias de antecedência
      (§2) e pôr `DATA_SORTEIO`/`FIM_CADASTROS` no `CONFIG` e no script.
- [x] `CONFIG`: `RAZAO_SOCIAL`, `CNPJ`. `DATA_SORTEIO` = `null` ("em breve") por enquanto.
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
- [x] `noindex` tirado de `index.html` e `regulamento.html` (21/10).
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
Quem de fato está no grupo se confere no dia do sorteio — ver a seção abaixo.

## No dia do sorteio: conferir quem está nos grupos VIP

O script da planilha lê, pela Evolution, todos os grupos que têm **"VIP" no nome** e marca em cada cadastro
se a pessoa está em algum deles. Grupo VIP novo entra sozinho, desde que tenha "VIP" no nome.

**Uma vez só (atualizar o script):** na planilha, Extensões → Apps Script → apague tudo, cole o `apps-script.gs`
novo e salve. Não precisa reimplantar o app da Web; o formulário continua igual. Recarregue a planilha: aparece
o menu **Sorteio**.

**No dia, depois de fechar as inscrições:**

1. **Conecte o WhatsApp que está nos grupos VIP** no gerenciador da Evolution (Evolution Manager → nova
   instância → ler o QR code). Use uma instância SEPARADA, sem webhook — não a do Agente Disparo, senão as
   suas conversas pessoais entram no Inbox.
2. Na planilha: **Sorteio → Configurar Evolution** e informe o endereço da Evolution (com `https://`), o nome
   da instância, o **token dessa instância** (nunca a chave global da Evolution) e o filtro (`VIP`). Faça isso
   sem compartilhar a tela: o que você digita aparece. A chave não fica na planilha, mas **qualquer editor da
   planilha consegue vê-la** no Apps Script — por isso o passo 5.
   Na primeira vez o Google pede uma autorização nova (acesso a serviço externo): é o script falando com a
   Evolution.
3. **Sorteio → Conferir grupos VIP.** Ele lê os grupos e **mostra a lista com quantos membros cada um tem
   antes de gravar**. Se aparecer um grupo que não é do sorteio (um VIP antigo, por exemplo), responda Não e
   use um filtro mais específico em Configurar Evolution (ex.: `VIP Rosana`). Evite renomear grupo: o
   WhatsApp avisa todos os membros. Responda a confirmação logo: se a janela sumir (o Google corta a execução
   em 6 minutos), nada foi gravado — é só rodar de novo. Confirmando, aparece:
   - na aba **Cadastros**, as colunas **"Está no grupo VIP?"** (SIM/NÃO, com a hora da conferência) e
     **"Grupos VIP"** (em quais);
   - a aba **Membros VIP**, com todo mundo que está nos grupos.
   Com muitos grupos grandes leva alguns segundos a mais.
4. **A conferência que vale é uma só, feita antes do primeiro sorteio** — anote a hora que aparece no título da
   coluna "Está no grupo VIP?". Não rode de novo no meio do sorteio (mudaria o SIM de quem já foi sorteada).
   Sorteie no Google entre 2 e a última linha. Se a linha sorteada estiver com **NÃO** ou com a coluna **em
   branco** (cadastro que entrou depois da conferência), ela não vale: sorteie de novo.
5. Ao terminar: **Sorteio → Esquecer chave da Evolution**, e desconecte e apague a instância na Evolution.

Se os cadastros ainda estiverem abertos (`FIM_CADASTROS` vazio ou no futuro), a conferência avisa e pergunta
se é um teste.

Se alguma resposta da Evolution vier estranha (formato diferente, grupo sem ninguém, página em vez de dados), a
conferência **para sem gravar nada** e diz o motivo — melhor do que marcar NÃO em quem está no grupo.

**Se o aviso disser "participantes SEM número":** o WhatsApp esconde o número de parte dos membros em alguns
grupos (o "LID"). Esses não dá para cruzar automaticamente; se a sorteada estiver com NÃO, procure o número
dela à mão no grupo (Dados do grupo → lupa → últimos 4 dígitos) antes de sortear de novo.

**Teste antes do dia:** rode a conferência uma vez com poucos cadastros para ver se os números vêm.

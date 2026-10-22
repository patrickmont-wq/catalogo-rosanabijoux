# Simulador de frete (página Todas as informações)

A página pergunta o frete por um Apps Script (`apps-script.gs`). A calculadora da loja não deixa outra
página ler a resposta, e a Cloudflare da loja recusa (403) o servidor do Agente Disparo.

## Ligar (uma vez, ~3 minutos)

1. Abra https://script.google.com → **Novo projeto**. Apague o que estiver lá, cole `apps-script.gs` e salve
   (nome: "Simulador de frete").
2. **Implantar → Nova implantação** → engrenagem → **App da Web**.
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
3. Autorize e copie a **URL do app da Web** (termina em `/exec`).
4. Teste: abra a URL no navegador. Funcionando: `{"ok":true,"opcoes":[...],"teste":true}`.
   Se aparecer `"causa":"http-403"`, a loja também recusa o Google.
5. Cole a URL em `var API = ''` no script do simulador, no fim de `todas-as-informacoes.html`.

Se mudar o script depois: **Implantar → Gerenciar implantações → editar → Nova versão** (a URL continua a mesma).

A peça de referência (`VARIANTE` no script, R$ 2,90) precisa continuar existindo com esse preço; se mudar,
atualize `VARIANTE` no script e `PRECO_REFERENCIA` na página.

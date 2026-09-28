# Granaê × Open Finance

Com isso, os gastos e ganhos das suas contas e cartões entram sozinhos no Granaê. Quem faz a ponte com o Open Finance Brasil é o **Pluggy**, pelo conector gratuito **MeuPluggy**. Ele é gratuito para quem acessa os próprios dados.

```
Banco ──Open Finance──▶ MeuPluggy ──▶ Pluggy ──webhook──▶ Cloud Function ──▶ Firestore ──ao vivo──▶ Granaê (todos os aparelhos)
```

- A chave do Pluggy fica só na Cloud Function, como segredo do Firebase. Ela nunca vai para o navegador.
- O app escuta `users/{uid}/apps/granae_of` com `onSnapshot`. Assim que o Pluggy avisa que há lançamento novo, ele aparece em segundos no celular e no computador.
- Só os e-mails liberados em `OF_EMAILS` podem usar a função.

## 1. Conectar seus bancos no MeuPluggy (uma vez)

1. Crie a conta em <https://meu.pluggy.ai>.
2. Conecte cada banco pelo Open Finance. A autorização é feita no app do próprio banco.

## 2. Pegar as credenciais do Pluggy

1. Crie a conta em <https://dashboard.pluggy.ai>. O teste é de 15 dias, mas o MeuPluggy continua funcionando depois.
2. Crie uma **Application** (Development).
3. Em *Customization / Connectors*, deixe o conector **MeuPluggy** ativo.
4. Copie o `CLIENT_ID` e o `CLIENT_SECRET`.

## 3. Publicar a função

**Jeito rápido:** um comando faz tudo o que está abaixo. Ele testa as credenciais antes de publicar, gera a senha do webhook e grava os segredos. Funciona no Windows, macOS e Linux.

```bash
node _openfinance/configurar.js
```

Jeito manual, passo a passo:

O projeto já usa Cloud Functions em `southamerica-east1` (plano Blaze), então nada muda na conta.

```bash
cd _openfinance
npm --prefix functions install
firebase login

firebase functions:secrets:set PLUGGY_CLIENT_ID       # cole o client id
firebase functions:secrets:set PLUGGY_CLIENT_SECRET   # cole o client secret
openssl rand -hex 24                                  # gera uma senha para o webhook
firebase functions:secrets:set PLUGGY_WEBHOOK_KEY     # cole a senha gerada acima

firebase deploy --only functions:granae-of
```

Durante o deploy, o Firebase pergunta o valor de **`OF_EMAILS`**. Digite o e-mail da sua conta MedTech (vários e-mails podem ser separados por vírgula). O valor fica gravado em `functions/.env.medtech-c658c`, que não vai para o Git.

O deploy usa um *codebase* separado (`granae-of`), então não mexe nas funções que já existem (`gemini`, `aigateway`, `mtAcesso`...).

Funções publicadas:

| Função | Para quê |
|---|---|
| `openfinance` | chamada pelo app (callable): connect token, registrar banco, sincronizar, desconectar |
| `pluggyWebhook` | recebe o aviso do Pluggy e enfileira a sincronização (responde na hora) |
| `openfinanceSyncJob` | consome a fila (Pub/Sub `openfinance-sync`) e grava o resumo no Firestore |
| `openfinanceCron` | rede de segurança: sincroniza a cada 6 h, caso algum webhook se perca |

## 4. Regras do Firestore

- O app lê `users/{uid}/apps/granae_of`, no mesmo padrão de `users/{uid}/apps/granae`. Se as regras já liberam `users/{uid}/apps/{app}` para o dono, não precisa mudar nada. Se liberam app por app, inclua `granae_of` (só leitura para o dono já basta).
- `openfinance_users` e `openfinance_items` são usadas só pelo servidor. Não precisam de regra, e o bloqueio padrão está certo.

## 5. Usar

No Granaê, abra **Categorias → Open Finance → Conectar banco**, escolha **MeuPluggy** e autorize. Na primeira conexão, o app pergunta se deve trazer os últimos 90 dias.

No Resumo aparece a faixa **"Banco ao vivo · atualizado há X min"**. Tocar nela força uma sincronização.

## O que a importação faz

- **Não duplica.** Cada lançamento do banco tem um id fixo (`of_<id do Pluggy>`). Se você já tinha digitado o gasto à mão (mesmo valor e tipo, até 3 dias de diferença), o lançamento manual é vinculado em vez de ser copiado.
- **Respeita suas escolhas.** Suas regras automáticas ("UBER → Transporte") valem primeiro. Categoria editada no app não é sobrescrita. Lançamento excluído não volta.
- **Pagamento de fatura e transferência entre contas suas** entram como transferência, fora dos totais, porque o gasto já entrou pelo cartão.
- **Parcelas** chegam como "Loja (2/10)" e aparecem em Compromissos.
- **Saldo da conta** bate com o do banco.
- Contas e cartões do banco viram contas no Granaê. Nome e cor podem ser editados.

## Quanto "tempo real" é possível

- O Granaê reage **em segundos** quando o Pluggy recebe dados novos (webhook → Firestore → tela).
- A frequência com que o Pluggy consulta o banco é o que limita. No **MeuPluggy (gratuito)**, a atualização é **diária**. O botão "Sincronizar agora" pede uma atualização, mas o MeuPluggy pode recusar.
- Para atualizações várias vezes ao dia, é preciso um plano pago do Pluggy com conectores diretos dos bancos. O código já funciona com eles: basta liberar os conectores na Application.
- Compras no cartão costumam aparecer depois de algumas horas ou no dia seguinte, conforme o banco repassa ao Open Finance.

## Testes

```bash
cd _openfinance/functions && npm test
```

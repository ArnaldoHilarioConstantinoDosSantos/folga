# Folga — Finanças pessoais

**[▶ Abrir a demonstração](https://arnaldohilarioconstantinodossantos.github.io/folga/)** — entre com qualquer e-mail e senha; os dados de exemplo ficam só no seu navegador.

![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)

Aplicação web de organização financeira pessoal. Mostra quanto entra, quanto sai, para onde o dinheiro vai, quanto sobra e o que já está comprometido nos próximos meses.

**Situação atual:** o app roda completo em modo demonstração (dados no navegador) e foi testado assim. A integração com o Supabase — banco, login real, Google e recuperação de senha — está implementada, mas **ainda não foi executada contra um projeto real**. Veja [Limitações conhecidas](#limitações-conhecidas).

## Sumário

- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Como rodar](#como-rodar)
- [Modo demonstração](#modo-demonstração)
- [Conectando ao Supabase](#conectando-ao-supabase)
- [Publicando](#publicando)
- [Arquitetura](#arquitetura)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Banco de dados](#banco-de-dados)
- [Regras de cálculo](#regras-de-cálculo)
- [Design](#design)
- [Testes](#testes)
- [Segurança](#segurança)
- [Limitações conhecidas](#limitações-conhecidas)
- [Solução de problemas](#solução-de-problemas)

## Funcionalidades

| Tela | Rota | O que faz |
|---|---|---|
| Dashboard | `/` | Saldo do mês, receitas, despesas, economia e gastos previstos; gráfico de evolução (3, 6 ou 12 meses); distribuição da renda em rosca; previsão do fim do mês; insights; saúde financeira; próximos vencimentos; orçamento |
| Lançamentos | `/lancamentos` | Todas as receitas e despesas, com busca e filtros por período, tipo, categoria, forma de pagamento e situação |
| Receitas | `/receitas` | Lançamentos de receita e cadastro da renda mensal (salário, renda extra) |
| Despesas | `/despesas` | Lançamentos de despesa, separados em fixos, variáveis e parcelas |
| Gastos Fixos | `/gastos-fixos` | Contas recorrentes (mensal, semanal ou anual), com pago/pendente por ocorrência e percentual da renda comprometido |
| Cartões | `/cartoes` | Cartões de crédito com limite, utilizado e disponível |
| Fatura | `/cartoes/:id` | Compras por fatura, pagamento e reabertura |
| Parcelamentos | `/parcelamentos` | Compras parceladas; as parcelas são geradas automaticamente, mês a mês |
| Calendário | `/calendario` | Vencimentos, faturas, parcelas e receitas previstas por dia |
| Despesas futuras | `/despesas-futuras` | O que já está comprometido nos próximos 6 ou 12 meses |
| Orçamento | `/orcamento` | Limites por categoria (alerta em 80%, destaque acima de 100%) e planejamento do mês com planejado x realizado |
| Metas | `/metas` | Metas com depósitos, retiradas e previsão de conclusão; reserva de emergência com meses de cobertura |
| Contas e patrimônio | `/contas` | Contas e carteiras com saldo, transferências entre contas e evolução do patrimônio |
| Relatórios | `/relatorios` | Totais e gráficos por período, categoria, conta e cartão; comparação entre dois meses |
| Categorias | `/categorias` | Categorias e subcategorias com ícone e cor |
| Configurações | `/configuracoes` | Perfil, tema, senha, dados de exemplo e recomeçar do zero |

Em todas as telas:

- **Novo lançamento** — botão no topo (desktop) ou flutuante (celular). A opção "Adicionar outro" mantém o formulário aberto para registrar vários gastos em sequência.
- **Alertas** no sino: conta perto do vencimento ou atrasada, orçamento em 80% ou ultrapassado, cartão perto do limite, meta quase concluída, saldo projetado negativo.
- **Tema** claro, escuro ou o do sistema.
- **Onboarding** no primeiro acesso: renda, contas, cartões, gastos fixos e objetivo. No fim, o primeiro planejamento mensal é montado sozinho.

Autenticação: login, cadastro, logout e recuperação de senha em `/entrar`, `/cadastro`, `/recuperar-senha` e `/redefinir-senha`. Rotas privadas redirecionam para o login e voltam ao destino original depois de entrar.

## Tecnologias

| Papel | Biblioteca | Versão |
|---|---|---|
| Interface | React | 19 |
| Build e servidor de desenvolvimento | Vite | 8 |
| Linguagem | TypeScript (modo `strict`) | 7 |
| Rotas | React Router | 7 |
| Cache e carregamento de dados | TanStack Query | 5 |
| Estilos | Tailwind CSS | 4 |
| Gráficos | Recharts | 3 |
| Ícones | Lucide | 1 |
| Banco e autenticação | Supabase (`supabase-js`) | 2 |
| Testes | Vitest | 5 |

Não há biblioteca de datas nem de formulários: datas são strings `YYYY-MM-DD` tratadas em [`src/utils/date.ts`](src/utils/date.ts), e os formulários usam estado do React.

## Como rodar

Pré-requisito: Node.js em versão atual. O projeto foi desenvolvido com Node 24.11 e npm 11.6.

```bash
npm install
npm run dev
```

O endereço aparece no terminal — normalmente `http://localhost:5173`.

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com recarga automática |
| `npm run build` | Verifica os tipos e gera a versão de produção em `dist/` |
| `npm run preview` | Serve a pasta `dist/` localmente, para conferir o build |
| `npm run typecheck` | Só a verificação de tipos |
| `npm test` | Testes dos cálculos financeiros |

## Modo demonstração

Sem as variáveis do Supabase, o app entra em modo demonstração:

- **Login:** qualquer e-mail e senha entram. Não há servidor; nenhuma senha é guardada.
- **Dados:** ficam no `localStorage` do navegador. A primeira visita já vem com sete meses de movimentações fictícias (seis fechados e o atual), geradas em relação à data de hoje.
- **Indisponível neste modo:** login com Google, recuperação e troca de senha. Os botões existem e explicam o motivo.

Chaves usadas no `localStorage`:

| Chave | Conteúdo |
|---|---|
| `folga:db:v1` | Todas as tabelas, em JSON |
| `folga:session` | Usuário da sessão local |
| `folga:theme` | Preferência de tema (existe também com Supabase) |

Dois cuidados:

- O `localStorage` é separado por endereço. Se o Vite subir em outra porta (`5174` porque a `5173` estava ocupada), o navegador trata como outro site e você verá uma conta nova, sem os dados da anterior.
- Limpar os dados do site no navegador apaga tudo.

Em **Configurações** há duas ações para os dados, nos dois modos: *Carregar dados de exemplo* substitui tudo pelos dados fictícios, e *Recomeçar do zero* apaga tudo e volta ao onboarding.

## Conectando ao Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No painel, abra **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e execute. O script cria as tabelas, os índices, as políticas de RLS e o gatilho que cria o perfil quando alguém se cadastra. Pode ser executado mais de uma vez. Exige PostgreSQL 15 ou mais recente.
3. Copie `.env.example` para `.env` e preencha com os valores de **Project Settings → API**:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

4. Em **Authentication → URL Configuration**:
   - *Site URL*: o endereço do app (`http://localhost:5173` em desenvolvimento).
   - *Redirect URLs*: adicione `http://localhost:5173/redefinir-senha`, destino do link de recuperação de senha.
5. Reinicie o `npm run dev`. As variáveis só são lidas quando o servidor sobe.

A partir daí o login é real e os dados vão para o seu projeto. Uma conta nova recebe as categorias padrão e começa pelo onboarding. Os dados do modo demonstração **não são migrados** — continuam no navegador.

Por padrão o Supabase exige confirmação de e-mail no cadastro; o app mostra a tela "Confirme seu e-mail" nesse caso. Para testar sem isso, desative em **Authentication → Providers → Email → Confirm email**.

### Login com Google

O botão já está no app. Para ativar:

1. No Google Cloud Console, crie uma credencial OAuth do tipo "Aplicativo da Web".
2. No Supabase, em **Authentication → Providers → Google**, informe o *Client ID* e o *Client Secret*.
3. De volta ao Google Cloud, cadastre como URI de redirecionamento autorizado o endereço de *callback* que o Supabase mostra nessa mesma tela.

## Publicando

`npm run build` gera arquivos estáticos em `dist/`, que podem ser servidos por qualquer hospedagem estática. Três pontos:

- **Variáveis de ambiente** entram no código durante o build. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` na hospedagem *antes* de gerar o build; sem elas, a versão publicada sai em modo demonstração.
- **Rotas:** o app usa rotas no navegador (`/lancamentos`, `/metas`…). A hospedagem precisa devolver `index.html` para qualquer caminho desconhecido, senão recarregar a página numa rota interna dá erro 404.
- **Supabase:** troque o *Site URL* pelo domínio publicado e adicione `https://seu-dominio/redefinir-senha` às *Redirect URLs*. No Google Cloud, nada muda — o redirecionamento continua sendo o do Supabase.

## Arquitetura

```
 Telas (pages/)  ──lê──▶  useFinance()  ◀── FinanceContext ◀── TanStack Query ◀──┐
       │                                                                          │
       │ escreve                                                                  │
       ▼                                                                          │
   useDb()  ──▶  operations.ts  ──▶  Driver  ──▶  Supabase  ou  localStorage  ────┘
                 (várias tabelas)   (interface)
```

**Leitura.** [`FinanceContext`](src/contexts/FinanceContext.tsx) carrega todas as tabelas do usuário de uma vez, uma consulta por tabela, e entrega um único objeto `FinanceData`. Enquanto carrega mostra o esqueleto; se falhar, o erro com "Tentar novamente". As telas, por isso, só tratam o estado "sem dados".

**Cálculo.** Tudo o que aparece na tela — resumo do mês, faturas, saúde financeira, insights, alertas — sai de funções puras em [`src/utils/`](src/utils/), que recebem `FinanceData` e a data de hoje. Não tocam em rede nem em estado, e são elas que os testes cobrem.

**Escrita.** [`useDb`](src/hooks/useDb.ts) oferece `create`, `update`, `remove` e `run`. Cada chamada mostra o aviso de sucesso ou de erro e devolve `undefined` quando falha, então o formulário só fecha se der certo. Operações que mexem em mais de uma tabela (criar parcelamento, pagar fatura, concluir o onboarding) ficam em [`operations.ts`](src/services/operations.ts) e devolvem a lista de tabelas alteradas, para o cache ser atualizado.

**Troca de banco.** Telas e cálculos só conhecem a interface [`Driver`](src/services/db/types.ts). A escolha entre Supabase e `localStorage` acontece em um único ponto, [`src/services/db/index.ts`](src/services/db/index.ts). A autenticação segue o mesmo desenho em [`auth.ts`](src/services/auth.ts). O driver local reproduz as regras de exclusão em cascata do schema SQL, para os dois modos se comportarem igual.

**Inicialização.** A cada login, [`bootstrap`](src/services/operations.ts) garante que o perfil existe, cria as categorias padrão na primeira vez e gera os lançamentos dos recorrentes até o mês atual.

**Carregamento sob demanda.** Cada tela é um módulo separado (`React.lazy`), então a biblioteca de gráficos só é baixada quando uma tela com gráfico abre.

## Estrutura de pastas

```
src/
  main.tsx              ponto de entrada e provedores globais
  App.tsx               rotas e proteção de rotas privadas
  index.css             tokens de cor, temas e animações

  types/index.ts        tipos do domínio, com os mesmos nomes das colunas do banco

  utils/                funções puras
    finance.ts            resumo do mês, categorias, contas, cartões, parcelas,
                          orçamento, metas, compromissos futuros, saúde financeira
    insights.ts           insights do mês e frases de tendência
    notifications.ts      alertas
    recurring.ts          ocorrências de recorrentes e projeção de meses futuros
    date.ts  money.ts     datas e dinheiro no padrão brasileiro
    labels.ts             rótulos em português e cores
    finance.test.ts       testes

  services/
    db/                   interface Driver + drivers Supabase e localStorage
    auth.ts               autenticação (Supabase ou sessão local)
    operations.ts         operações que tocam várias tabelas
    seed.ts               categorias padrão e dados de exemplo

  contexts/             sessão, dados, mês selecionado, tema, avisos, modal de lançamento
  hooks/useDb.ts        escrita de dados
  lib/                  cliente Supabase, cliente de cache, mapa de ícones

  components/
    ui/                   Button, Card, Modal, Form (Input, Select, MoneyInput, Toggle), Feedback
    charts/               FinancialChart (barras, linhas, áreas) e DonutChart
    …                     StatCard, TransactionTable, TransactionModal, MonthSelector,
                          BudgetProgress, GoalCard, CreditCardCard, CategoryCard,
                          EmptyState, ConfirmDialog, NotificationBell, HealthPanel…

  layouts/              AppLayout (menu lateral e barra inferior) e AuthLayout
  pages/                uma tela por arquivo; auth/ para login e cadastro

supabase/schema.sql     tabelas, índices, RLS e gatilhos
```

## Banco de dados

Todas as tabelas têm `id` (UUID), `user_id`, `created_at` e `updated_at`. Valores monetários são inteiros em centavos (`*_cents`).

| Tabela | Guarda | Observações |
|---|---|---|
| `profiles` | Nome, dia de recebimento, objetivo, se concluiu o onboarding | Uma linha por usuário, criada por gatilho no cadastro |
| `accounts` | Contas e carteiras | `type`: corrente, salário, digital, carteira, poupança, investimentos |
| `categories` | Categorias e subcategorias | `parent_id` aponta para a categoria principal |
| `transactions` | Todas as receitas e despesas | Centro do modelo; ver abaixo |
| `recurring_transactions` | Gastos fixos e renda mensal | `frequency`: mensal, semanal, anual |
| `credit_cards` | Cartões | Limite, dia de fechamento e de vencimento |
| `installments` | Compras parceladas | As parcelas ficam em `transactions` |
| `budgets` | Limite mensal por categoria | Um por categoria |
| `financial_goals` | Metas | `kind = 'emergency'` marca a reserva de emergência |
| `goal_contributions` | Depósitos e retiradas das metas | Valor negativo é retirada |
| `monthly_plans` | Planejamento do mês | `allocations` em JSON; um plano por mês |
| `transfers` | Transferências entre contas | Não contam como receita nem despesa |
| `notifications` | Alertas dispensados | Os alertas em si são calculados no app |

Em `transactions`, três colunas dizem de onde o lançamento veio:

- `card_id` — compra no cartão; entra na fatura.
- `installment_id` — parcela de uma compra parcelada (com `installment_number` e `installment_total`).
- `recurring_id` — gerado por um gasto fixo ou renda mensal.

O que acontece ao excluir:

| Ao excluir | Efeito |
|---|---|
| Categoria | Subcategorias e limite de orçamento são excluídos; lançamentos ficam sem categoria |
| Conta | Transferências da conta são excluídas; lançamentos ficam sem conta |
| Cartão | Lançamentos ficam sem cartão |
| Parcelamento | Todas as parcelas são excluídas, inclusive as pagas |
| Gasto fixo | Lançamentos pendentes são removidos; os pagos ficam, sem vínculo |
| Meta | Depósitos são excluídos |

Diferenças em relação à lista de tabelas sugerida no pedido original: `recurring_expenses` virou `recurring_transactions`, para a renda usar o mesmo mecanismo dos gastos fixos; `credit_card_transactions` é uma *view* sobre `transactions`; e `transfers` foi acrescentada.

## Regras de cálculo

### Realizado e previsto

Um lançamento é **realizado** quando está marcado como pago, ou quando é uma compra no cartão com data até hoje — o gasto já aconteceu, mesmo sem a fatura paga. Todo o resto é **previsto**.

| Indicador | Cálculo |
|---|---|
| Receitas | Receitas realizadas do mês |
| Despesas | Despesas realizadas do mês |
| Saldo do mês / Economia | Receitas − despesas |
| Percentual de economia | Saldo ÷ receitas |
| Gastos previstos | Despesas previstas do mês |
| Saldo projetado | Saldo + receitas previstas − despesas previstas |

A despesa entra no mês da **data do lançamento**. Uma compra no cartão em 28/09 é despesa de setembro, ainda que a fatura vença em outubro.

### Cartões

- **Fatura da compra:** se o dia da compra é posterior ao dia de fechamento, vai para a fatura do mês seguinte. Com fechamento no dia 13, uma compra em 13/09 entra na fatura de setembro e uma em 14/09, na de outubro.
- **Vencimento:** se o dia de vencimento é maior que o de fechamento, vence no mesmo mês da fatura; senão, no mês seguinte. Fechamento 28 e vencimento 5: a fatura de setembro vence em 05/10.
- **Limite utilizado:** soma de tudo que está no cartão e ainda não foi pago, incluindo parcelas futuras.
- **Pagar a fatura** marca as compras como pagas, debita a conta escolhida e libera o limite. Dá para reabrir.

### Parcelamentos

O total é dividido em centavos inteiros; os centavos que sobram vão para as primeiras parcelas, então a soma é sempre exata (R$ 100,00 em 3x = 33,34 + 33,33 + 33,33). Cada parcela é uma despesa na mesma data dos meses seguintes; dia 31 em mês mais curto vira o último dia.

### Gastos fixos e renda mensal

- A cada login, as ocorrências até o mês atual são gravadas como lançamentos pendentes. É assim que os gastos fixos aparecem sozinhos quando o mês vira.
- Meses futuros não são gravados: são projetados em memória para a previsão, o calendário e as despesas futuras.
- Um gasto fixo ou renda cadastrado agora começa no mês atual, sem preencher meses passados. A exceção é um lançamento com data antiga marcado como "Repetir todo mês": ele gera as ocorrências daquela data até hoje.
- Editar um recorrente atualiza os lançamentos pendentes dele deste mês em diante; os pagos não mudam.
- Para comparar com a renda, tudo vira valor mensal: semanal × 52 ÷ 12 e anual ÷ 12.

### Contas e patrimônio

- **Saldo da conta** = saldo inicial + receitas pagas − despesas pagas ± transferências − depósitos em metas feitos a partir dela.
- **Patrimônio** = saldo das contas + contas de investimento + reserva de emergência + demais metas.

### Orçamento e planejamento

- O gasto de uma categoria principal inclui o das subcategorias, e conta só o realizado.
- Alerta a partir de **80%** do limite; acima de **100%**, o limite aparece como ultrapassado.
- No planejamento do mês, só as linhas ligadas a uma categoria têm "realizado". Linhas livres, como "Reserva", ficam só com o valor planejado.
- O primeiro planejamento, montado no onboarding, soma os gastos fixos por categoria com uma sugestão para os variáveis (alimentação 12%, transporte 8%, lazer 6%, compras 5% e saúde 4% da renda), reserva 15% para o objetivo e deixa o restante como "Livre".

### Metas e reserva de emergência

- **Ritmo:** depósitos dos últimos 90 dias ÷ 3.
- **Previsão de conclusão:** quanto falta ÷ ritmo, arredondado para cima em meses.
- **Cobertura da reserva:** valor guardado ÷ média mensal de despesas, calculada sobre os últimos três meses fechados que têm despesa.

### Saúde financeira

Cinco indicadores independentes, sem nota única:

| Indicador | Saudável | Atenção | Crítico |
|---|---|---|---|
| Gastos fixos ÷ renda | até 50% | até 65% | acima de 65% |
| Economia ÷ renda | 20% ou mais | 10% ou mais | abaixo de 10% |
| Cartões: utilizado ÷ limite | até 30% | até 60% | acima de 60% |
| Evolução das despesas (dois últimos meses fechados) | caiu ou igual | subiu até 10% | subiu mais de 10% |
| Reserva de emergência | 6 meses ou mais | 3 meses ou mais | menos de 3 meses |

No mês em andamento, o indicador de economia usa a **projeção** para o fim do mês. A economia "até agora", no dia 2, seria quase 100% e não diria nada.

### Insights e comparações

Todos os textos são gerados a partir dos lançamentos. No mês em andamento, as comparações usam o período do dia 1 até hoje contra o **mesmo período** do mês anterior — comparar meio mês com um mês inteiro mostraria sempre queda.

Uma variação por categoria só vira insight quando é relevante: queda de pelo menos R$ 20, ou alta de pelo menos 10% e R$ 20.

### Alertas

| Alerta | Quando aparece |
|---|---|
| Conta perto do vencimento | Vence em até 3 dias |
| Conta atrasada | Venceu e não está paga |
| Orçamento em alerta / ultrapassado | 80% / acima de 100% do limite |
| Cartão perto do limite | 80% ou mais do limite utilizado |
| Fatura alta | Fatura aberta em 80% ou mais do limite |
| Meta quase concluída | 90% ou mais, ainda não concluída |
| Saldo projetado negativo | Projeção do mês abaixo de zero |

Dispensar um alerta grava a chave dele em `notifications`. A chave inclui o mês quando faz sentido, então o alerta de orçamento volta no mês seguinte se o limite for atingido de novo.

### Despesas futuras

Cada despesa pendente é classificada em parcela, gasto fixo, cartão ou outra conta. Compras avulsas no cartão entram no mês em que a **fatura vence**; as demais, no mês da própria data. O percentual comprometido usa a renda mensal cadastrada.

## Design

- **Cores por papel.** Todas as cores são variáveis CSS em [`src/index.css`](src/index.css) — fundo, superfície, texto, marca, positivo, negativo, alerta. O tema escuro redefine as mesmas variáveis; nenhum componente tem cor fixa.
- **Tema.** A preferência fica no `localStorage` e é aplicada antes da primeira pintura, por um script em [`index.html`](index.html), para a página não piscar no tema errado.
- **Categorias.** Dez cores, cada uma com um tom próprio para o tema claro e o escuro. Oito vêm de uma paleta montada para continuar distinguível por pessoas com daltonismo; marrom e cinza foram acrescentadas depois, sem essa validação. O banco guarda só o nome da cor (`blue`, `orange`…).
- **Gráficos.** Um único eixo por gráfico, legenda sempre que há mais de uma série, tooltip ao passar o mouse e uma tabela equivalente para leitores de tela.
- **Estados.** Estados de saúde e de alerta aparecem com ícone e texto, nunca só pela cor.
- **Formatos.** Dinheiro como `R$ 1.250,00`, datas como `DD/MM/AAAA`, toda a interface em português.
- **Campo de valor.** Os dígitos entram pela direita, como nos apps de banco: digitar `1250` mostra `12,50`.
- **Responsivo.** Menu lateral a partir de 1024 px; abaixo disso, barra inferior com botão flutuante e o menu completo em "Mais".

## Testes

```bash
npm test
```

São 20 testes em [`src/utils/finance.test.ts`](src/utils/finance.test.ts), todos sobre os cálculos:

- formatação e leitura de valores em reais; divisão de parcelas sem perder centavos;
- datas atravessando o ano e meses curtos;
- ocorrências mensais, semanais e anuais de recorrentes, com início e fim;
- realizado x previsto, saldo projetado e distribuição da renda;
- fatura pela data de fechamento, vencimento e limite utilizado;
- saldo de contas com transferências e depósitos em metas;
- orçamento com subcategorias, previsão de metas, insights e alertas dispensados;
- despesas futuras por mês e por tipo.

Não há testes automatizados de interface no repositório. As telas foram conferidas manualmente e com um roteiro em navegador real (Chrome), em modo demonstração: as 15 telas em desktop e em largura de celular, sem erros no console, e o fluxo login → lançamento → parcelamento → fatura → tema → onboarding → recarregar → logout.

## Segurança

- **Row Level Security** em todas as tabelas, com a política "só as próprias linhas" valendo para leitura, inserção, alteração e exclusão.
- O papel `anon` (visitante não autenticado) não tem permissão em nenhuma tabela.
- As chaves estrangeiras entre tabelas incluem o `user_id`. Uma linha não consegue apontar para um registro de outro usuário, mesmo conhecendo o ID dele.
- O `user_id` é preenchido pelo banco (`auth.uid()`), não pelo cliente.
- A chave usada no front-end é a `anon`, pública por definição: quem protege os dados é a RLS, não o segredo da chave. **Nunca** coloque a chave `service_role` no `.env` deste projeto.
- O arquivo `.env` está no `.gitignore`.

## Limitações conhecidas

- **Supabase não verificado.** O `schema.sql`, o driver do Supabase, o login real, o Google e a recuperação de senha nunca foram executados contra um projeto real. Erros de sintaxe ou de permissão podem aparecer na primeira execução.
- **Operações em várias tabelas não são transações.** Criar um parcelamento, por exemplo, grava a compra e depois as parcelas em chamadas separadas. Se a segunda falhar, a compra é desfeita; nas demais operações, uma falha no meio pode deixar dados parciais.
- **Todos os dados são carregados no navegador.** Funciona bem para o volume de uma pessoa — alguns milhares de lançamentos —, mas não foi pensado para dezenas de milhares.
- **Recorrentes são gerados só no login** ou ao criar e editar um recorrente. Com o app aberto durante a virada do mês, os lançamentos do novo mês aparecem depois de recarregar.
- **Sem importação nem exportação** (CSV, OFX) e sem migração dos dados do modo demonstração para o Supabase.
- **Sem uso offline** quando conectado ao Supabase.
- **Categoria "Investimentos" é despesa.** O que é lançado nela não aumenta o saldo de nenhuma conta. Para o valor aparecer no patrimônio, registre uma transferência para uma conta do tipo investimentos.

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Abri o app e meus dados sumiram (modo demonstração) | O Vite subiu em outra porta | Feche o outro servidor e use o endereço original, ou rode `npm run dev -- --port 5173 --strictPort` |
| "Banco de dados não configurado" | O `schema.sql` não foi executado | Rode o script no SQL Editor do Supabase |
| Preenchi o `.env` e continua em modo demonstração | O servidor não foi reiniciado, ou o nome das variáveis está diferente | Confira os nomes exatos e reinicie o `npm run dev` |
| "Confirme seu e-mail antes de entrar" | O Supabase exige confirmação no cadastro | Abra o link do e-mail ou desative a confirmação no painel |
| "O login com Google ainda não foi ativado" | Provedor Google desligado no Supabase | Siga [Login com Google](#login-com-google) |
| Link de recuperação de senha abre a página errada | Endereço fora das *Redirect URLs* | Adicione `…/redefinir-senha` em Authentication → URL Configuration |
| Erro 404 ao recarregar uma tela no site publicado | A hospedagem não devolve `index.html` para rotas internas | Configure o redirecionamento de todas as rotas para `index.html` |

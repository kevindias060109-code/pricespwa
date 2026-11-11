# Doceria & Financas (PWA)

Next.js 14 + Supabase (Auth, Postgres, Storage, RLS) + OpenAI (Responses API, so no servidor) + Pluggy (sandbox).

> **Status honesto:** o codigo foi escrito mas **ainda nao foi executado** (sem `npm install`, sem build, sem teste contra Supabase/OpenAI/Pluggy). Siga o checklist de testes em `docs/TESTES.md` antes de usar com dados reais.

## 1. Seguranca primeiro
1. **Revogue** as chaves que foram coladas em texto (OpenAI e `sb_secret_...`) e gere novas.
2. Coloque as novas somente em `.env.local` e nas variaveis da Vercel. Nunca no GitHub.

## 2. Instalar
```bash
npm install
cp .env.example .env.local   # preencha as chaves
npm run dev
```

## 3. Banco (Supabase > SQL Editor)
1. Rode `supabase/001_schema_rls.sql`, depois `002_estoque_notas_storage.sql` e `003_app_settings.sql` (tabela das configuracoes da tela).
   - Se o projeto Supabase ja tem tabelas, **revise antes** (nada e apagado, mas nomes podem colidir).
2. Authentication > URL Configuration: *Site URL* = seu dominio; adicione `https://SEU_DOMINIO/definir-senha` e `http://localhost:3000/definir-senha` em *Redirect URLs*.
3. Authentication > Providers > Email: **desative "Allow new users to sign up"** (so o ADM convida).
4. Crie SUA conta (Authentication > Users > Add user), copie o UUID e rode:
   ```sql
   update public.profiles set role='owner', can_personal=true, can_bakery=true where id='SEU_UUID';
   ```
5. (Recomendado) Configure SMTP proprio em Authentication > SMTP para os convites.

## 4. Variaveis de ambiente
| Variavel | Onde | Observacao |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | publica | URL do projeto |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | publica | chave publishable |
| SUPABASE_SECRET_KEY | **servidor** | ignora RLS; so em rotas apos checar permissao |
| SETTINGS_ENCRYPTION_KEY | **servidor** | 32 bytes em base64; criptografa as chaves salvas na tela. Gere uma vez: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| APP_URL | servidor | dominio publico (usado no link do convite) |
| OPENAI_API_KEY / OPENAI_MODEL | servidor | **opcionais**: cadastre em `/admin/configuracoes` (a tela tem prioridade) |
| PLUGGY_CLIENT_ID / SECRET | servidor | **opcionais**: idem, sandbox primeiro |

So as 4 primeiras (Supabase + `SETTINGS_ENCRYPTION_KEY`) precisam ficar na Vercel: sao o que permite ao app abrir o banco e ler o resto. OpenAI e Pluggy podem ser cadastradas e trocadas pela tela, sem redeploy.

## 5. Deploy (Vercel)
1. Suba para um repositorio **privado** (o `.gitignore` ja exclui `.env*`).
2. Importe na Vercel, cadastre as variaveis acima, deploy. HTTPS e automatico.
3. Atualize `APP_URL` e as Redirect URLs do Supabase com o dominio final.
4. Android: Chrome > "Instalar app". iPhone: Safari > Compartilhar > "Adicionar a Tela de Inicio".

## 6. Como funciona
- **Acesso:** `profiles.role/can_personal/can_bakery`. Financeiro pessoal e isolado por usuario (nem admin ve o de outro). Doceria e compartilhada pela equipe com permissao.
- **Configuracoes:** `/admin/configuracoes` (so o ADM principal). Salva OpenAI/Pluggy criptografadas (AES-256-GCM) em `app_settings`, sem policy de leitura (so o backend le). Nunca devolve a chave completa ao navegador; o teste de conexao nao gasta tokens. Prioridade: valor da tela > variavel de ambiente > padrao.
- **Convites:** `/admin` (so ADM principal) -> `inviteUserByEmail` -> usuario define senha em `/definir-senha`.
- **IA:** `/api/ai/chat` usa Responses API com ferramentas que consultam o banco **com a sessao do usuario** (RLS vale). Gravacoes viram "acoes pendentes" e so executam apos o botao Confirmar (`/api/ai/confirm`).
- **Notas fiscais:** upload -> IA extrai -> voce confere e associa itens a ingredientes -> `confirm_document` (RPC atomica) cria despesa + entradas de estoque. Duplicidade: hash do arquivo, chave de acesso e indice por documento.
- **Estoque:** trigger recalcula quantidade e custo medio a cada movimentacao.
- **Pluggy:** rotas `/api/pluggy/*` prontas (connect token, registrar item, sincronizar sem duplicar). Falta a tela do widget (`react-pluggy-connect`), ver `docs/TESTES.md`.
- **PWA:** `manifest.webmanifest`, `sw.js` (so cacheia arquivos estaticos; nunca `/api` nem paginas privadas), `offline.html`.

## 7. Manutencao
- Rotacione chaves a cada troca de equipe. OpenAI/Pluggy: troque em `/admin/configuracoes` (vale na hora). Supabase e `SETTINGS_ENCRYPTION_KEY`: atualize na Vercel e redeploy (trocar a `SETTINGS_ENCRYPTION_KEY` exige recadastrar as chaves da tela).
- Backups: Supabase > Database > Backups (planos pagos) ou `pg_dump` periodico.
- `audit_log` registra convites, mudancas de permissao, notas, sincronizacoes e acoes da IA.
- Para novas tabelas: crie com RLS ligado e policy usando `has_bakery()`/`has_personal()`.
- Troque o modelo em Configuracoes se quiser reduzir custo; o limite de mensagens/ferramentas esta em `app/api/ai/chat/route.js`.

## 8. Limitacoes conhecidas
- Telas de cadastro sao genericas (`lib/modules.js`); nao ha dashboard grafico.
- Sem rate limit proprio nas rotas de IA (adicione Vercel/Upstash se abrir para muitos usuarios).
- Sem tela do widget Pluggy e sem categorizacao/conciliacao automatica ainda.
- Ao cancelar/editar movimentacoes de estoque nao ha estorno automatico (faca um ajuste).

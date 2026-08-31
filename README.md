# KAYG CPA — Painel Financeiro e Operacional

Plataforma financeira 100% client-side, publicada como site estático (SPA) no
**GitHub Pages** e conectada ao **Supabase** na nuvem. Funciona no celular e
no PC, 24/7, sem depender de nenhum servidor local ligado.

- **Frontend:** Next.js 14 (App Router, TypeScript strict, export estático)
- **Estilo:** Tailwind CSS
- **Backend/Banco:** Supabase (Postgres + Auth + Realtime), acessado direto do navegador
- **Hospedagem:** GitHub Pages (grátis)
- **CI/CD:** GitHub Actions (build + deploy automático a cada push na `main`)

---

## 1. Pré-requisitos

- Uma conta no [GitHub](https://github.com)
- Uma conta no [Supabase](https://supabase.com) (plano gratuito é suficiente)
- Node.js 20+ instalado (apenas se quiser rodar localmente)

---

## 2. Passo a passo — Criar o repositório no GitHub

1. Crie um repositório novo no GitHub chamado, por exemplo, `kayg-cpa`.
   - Pode ser **público** (necessário no plano gratuito para usar GitHub Pages
     sem custo, a menos que você tenha GitHub Pro/Team/Enterprise).
2. Envie todo o conteúdo desta pasta para o repositório:
   ```bash
   git init
   git add .
   git commit -m "Primeira versão do KAYG CPA"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/kayg-cpa.git
   git push -u origin main
   ```
3. No repositório, vá em **Settings → Pages**:
   - Em **Source**, selecione **Deploy from a branch**.
   - Em **Branch**, selecione `gh-pages` e a pasta `/ (root)`.
   - Salve. (A branch `gh-pages` só vai existir depois do primeiro deploy
     automático via GitHub Actions — veja o passo 4.)

---

## 3. Passo a passo — Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto.
2. Depois que o projeto for criado, vá em **SQL Editor** (menu lateral).
3. Abra o arquivo `supabase/schema.sql` deste projeto, copie **todo** o
   conteúdo, cole no SQL Editor e clique em **Run**.
   - Isso cria todas as tabelas (`usuarios`, `operacoes`, `extrato`, `metas`,
     `activity_feed`), as triggers (`checar_progresso_metas_qtd_dep` e o
     fan-out do `activity_feed`), a view de saldo e as políticas de segurança
     (RLS — Row Level Security).
4. Vá em **Authentication → Providers** e confirme que o login por
   **Email/Senha** está habilitado.
5. Crie os usuários (você e seu sócio) em **Authentication → Users → Add user**
   (ou habilite o cadastro público, se preferir).
6. Vá em **Project Settings → API** e copie:
   - **Project URL** → você vai usar como `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → você vai usar como `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 4. Passo a passo — Cadastrar as Secrets no GitHub

1. No repositório do GitHub, vá em **Settings → Secrets and variables → Actions**.
2. Clique em **New repository secret** e cadastre:
   - Nome: `NEXT_PUBLIC_SUPABASE_URL` — Valor: a Project URL copiada do Supabase.
   - Nome: `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Valor: a anon public key copiada do Supabase.
3. Pronto. O workflow `.github/workflows/deploy.yml` já está configurado para
   ler essas Secrets automaticamente a cada `push` na branch `main`, rodar os
   testes, buildar o projeto (`npm run build`) e publicar o resultado
   (pasta `out/`) na branch `gh-pages`.
4. Após o primeiro push, acompanhe o progresso em **Actions** (aba do
   repositório). Quando o workflow terminar com sucesso, seu site estará em:
   ```
   https://SEU-USUARIO.github.io/kayg-cpa/
   ```

---

## 5. Rodando localmente (opcional)

```bash
npm install
cp .env.example .env.local   # preencha com suas chaves do Supabase
npm run dev                  # http://localhost:3000
```

Para rodar os testes unitários do núcleo financeiro:

```bash
npm run test
```

Para gerar o build estático localmente (mesma saída publicada no GitHub Pages):

```bash
npm run build
# arquivos finais em ./out
```

---

## 6. Estrutura do projeto

```
kayg-cpa/
├── app/
│   ├── layout.tsx            # layout raiz + fix de roteamento GitHub Pages
│   ├── page.tsx               # redireciona para /login ou /extrato
│   ├── login/page.tsx          # tela de login (banner + formulário)
│   └── extrato/
│       ├── page.tsx
│       └── ExtratoClient.tsx   # dashboard, formulário de operações e extrato
├── lib/
│   ├── money.ts                # núcleo matemático financeiro (parse/format/soma)
│   ├── supabase.ts             # cliente Supabase browser (com fallback seguro)
│   └── database.types.ts       # tipos do banco (Relationships/Views/Functions)
├── supabase/
│   └── schema.sql              # schema completo (tabelas, triggers, RLS, realtime)
├── __tests__/
│   └── money.test.ts           # suíte de testes unitários do núcleo financeiro
├── public/
│   ├── banner-login.jpg        # arte oficial "KAYG CPA"
│   └── 404.html                # fallback de roteamento para GitHub Pages
├── .github/workflows/deploy.yml
└── next.config.js              # output: 'export', trailingSlash, basePath
```

---

## 7. Notas técnicas importantes

- **Zero-bug no F5 do celular:** o GitHub Pages não sabe nada sobre as rotas
  internas do Next.js. Ao atualizar a página em `/extrato`, o servidor
  procuraria um arquivo físico e devolveria 404. Resolvemos isso com
  `trailingSlash: true` (cada rota vira uma pasta com `index.html` de
  verdade) **e** um `public/404.html` de segurança que redireciona qualquer
  caminho desconhecido de volta para o app.
- **Sessão persistente:** o cliente Supabase usa `localStorage` para manter
  você logado mesmo depois de fechar a aba do navegador no celular.
- **Sem tela branca sem as chaves:** se as Secrets ainda não tiverem sido
  configuradas, o app carrega normalmente e exibe um aviso na tela de login
  e no dashboard, em vez de quebrar o build ou a renderização.
- **Tempo real:** novas operações inseridas por você ou pelo seu sócio
  aparecem automaticamente na tela do outro, via Supabase Realtime.

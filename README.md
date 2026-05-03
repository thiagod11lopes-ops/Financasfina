# Finanças

Aplicação web de gestão financeira familiar (React + TypeScript + Vite). Os dados ficam no **navegador** (localStorage); não há servidor próprio.

## Requisitos

- [Node.js](https://nodejs.org/) 20 ou superior (recomendado 22)

## Desenvolvimento local

```bash
npm ci
npm run dev
```

Abre o endereço indicado no terminal (por defeito `http://localhost:5173`).

## Build de produção

```bash
npm run build
npm run preview
```

## Publicar o código no GitHub

### Opção A — script (recomendado no Windows)

1. Instale o [GitHub CLI](https://cli.github.com/) se ainda não tiver: `winget install GitHub.cli`
2. Na pasta do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publicar-github.ps1
```

Na primeira execução abre-se o browser para **iniciar sessão** na GitHub; depois o script cria o repositório público (nome editável) e faz `push` do ramo `main`.

### Opção B — manual

1. Crie um repositório vazio no GitHub (sem README gerado pelo site, se já tiver ficheiros locais).
2. Na pasta do projeto:

```bash
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

(O ramo local já deve ser `main`; o repositório local já tem histórico Git.)

## GitHub Actions

- **CI** (`.github/workflows/ci.yml`): em cada push ou pull request para `main`/`master`, instala dependências e corre `npm run build`.
- **Deploy GitHub Pages** (`.github/workflows/pages.yml`): opcional. Em **Settings → Pages → Build and deployment**, a **Source** tem de ser **GitHub Actions** (não “Deploy from a branch”). O workflow tem dois jobs (`build` + `deploy`); sem a source correta, o deploy falha com X vermelho. Depois do primeiro sucesso, o site fica em `https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/`. O build usa `VITE_BASE` igual ao nome do repositório.

Se o nome do repositório no URL for diferente do que o GitHub expõe em `github.event.repository.name`, ajuste a variável `VITE_BASE` no ficheiro `pages.yml` (deve ser o segmento após `github.io`, com barras: `/meu-repo/`).

### Onde está o endereço em Settings → Pages

O GitHub **nem sempre mostra** um campo com o link até existir **pelo menos um deploy concluído com sucesso**.

1. Abre **Actions** e confirma que o workflow **Deploy GitHub Pages** terminou a verde (job **deploy** incluído).
2. Volta a **Settings → Pages**. Às vezes o link aparece como **“Visit site”** ou texto do tipo *Your site is live at …* junto de **Build and deployment**.
3. Mesmo que a interface não mostre, o endereço de um **repositório de projeto** (não o `username.github.io` especial) é sempre:

   `https://SEU_UTILIZADOR.github.io/NOME_EXATO_DO_REPOSITORIO/`

   Substitui pelo que vês no URL do repositório: `https://github.com/SEU_UTILIZADOR/NOME_EXATO_DO_REPOSITORIO`.

4. Repositório **público**: Pages neste modo costuma ser gratuito. Se o repo for **privado**, em contas gratuitas o GitHub pode não publicar o site como esperado; nesse caso torna o repositório público ou consulta os planos do GitHub.

### Página em branco no GitHub Pages

Abre o site → **Ver código-fonte da página** (View Page Source). Se aparecer `src="/src/main.tsx"`, o GitHub está a servir o **`index.html` da raiz do repositório** (modo **Filial** / deploy a partir de ramo), **não** o site gerado pelo workflow a partir da pasta `dist/`.

**Correção:** em **Settings → Pages → Fonte**, escolhe **GitHub Actions** (não “Filial”). Espera o workflow **Deploy GitHub Pages** ficar verde. Depois do código-fonte deve passar a referenciar algo como `/NOME_DO_REPO/assets/index-….js`.

## Licença

Uso pessoal / familiar; defina uma licença se quiser reutilização pública.

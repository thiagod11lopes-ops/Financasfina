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

1. Crie um repositório vazio no GitHub (sem README gerado pelo site, se já tiver ficheiros locais).
2. Na pasta do projeto:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

Substitua o URL pelo do seu repositório.

## GitHub Actions

- **CI** (`.github/workflows/ci.yml`): em cada push ou pull request para `main`/`master`, instala dependências e corre `npm run build`.
- **Deploy GitHub Pages** (`.github/workflows/pages.yml`): opcional. Em **Settings → Pages**, escolha **Source: GitHub Actions**. Após o primeiro deploy, o site fica em `https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/`. O workflow define `VITE_BASE` com o nome do repositório para os recursos carregarem bem nesse caminho.

Se o nome do repositório no URL for diferente do que o GitHub expõe em `github.event.repository.name`, ajuste a variável `VITE_BASE` no ficheiro `pages.yml` (deve ser o segmento após `github.io`, com barras: `/meu-repo/`).

## Licença

Uso pessoal / familiar; defina uma licença se quiser reutilização pública.

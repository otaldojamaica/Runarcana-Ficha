# Runarcana | Ficha de personagem

Ficha digital de personagem para Runarcana, feita com React, Vite e Tailwind CSS. Os dados são salvos no armazenamento local do navegador e permanecem neste dispositivo e navegador.

## Requisitos

- Node.js 20 ou superior
- npm

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build
npm run preview
```

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie este projeto para a branch `main`.
2. No repositório, abra **Settings > Pages**.
3. Em **Build and deployment**, selecione **GitHub Actions** como fonte.
4. Acesse a aba **Actions** e aguarde a execução de `Deploy to GitHub Pages`.

O site será publicado na URL exibida pelo GitHub Pages. O deploy é executado automaticamente a cada push para `main`.

## Privacidade dos dados

A ficha não envia os dados para um servidor. Ela usa `localStorage` no navegador atual; limpar os dados do navegador remove a ficha salva. Use a opção de exportação do navegador ou mantenha cópias dos dados importantes antes de trocar de dispositivo.

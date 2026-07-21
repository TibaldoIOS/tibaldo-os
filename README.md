# React + Vite

## Soldes du personnel de ménage

L'écran **Balances** rapproche directement deux sources à chaque ouverture ou
actualisation : le Google Sheet publié (heures, linge et achats remboursables)
et la table Supabase `cleaner_payments` (virements saisis manuellement).

Le calcul appliqué par personne est :

`solde = heures × 15 € + linge × 3 € + achats - virements`

Les noms Jennifer, Rachida et Gaëlle sont normalisés pour éviter qu'une variante
d'orthographe crée un second solde. La logique testable se trouve dans
`src/services/cleanerBalanceService.js` et se vérifie avec `npm test`.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

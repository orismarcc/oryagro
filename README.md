# OryAgro

Gestão agrícola em PWA para o produtor anotar o que faz em cada lote (adubação, defensivo, colheita, compra), controlar estoque e finanças e consultar guias técnicos por cultura — inclusive sem sinal no campo.

- Produção: https://oryagro.vercel.app
- Stack: React 19 + Vite 6 + Tailwind 4 + Supabase (Postgres, Auth, Storage) + Vercel

## Rodar localmente
```bash
cp .env.example .env.local   # preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm ci
npm run dev
```

## Antes de commitar
```bash
npm test
npm run lint
npm run build
```

## Publicar
```bash
npm run build && git push && vercel --prod
```

Regras do projeto (infraestrutura, segurança, modelo de dados, convenções): veja [`CLAUDE.md`](CLAUDE.md).

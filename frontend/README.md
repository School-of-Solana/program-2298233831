# Frontend - Solana Blog dApp

A minimal React (Vite) frontend for a Solana blog program built with Anchor. Users can:
- Connect wallet
- Initialize profile (PDA)
- Create, edit, delete posts
- Refresh and list their posts

## Prerequisites
- Node.js 18+ (or 20+)
- A Solana wallet (e.g., Phantom) set to Devnet

## Quick Start (Dev)
```bash
cd frontend
npm i
npm run dev
# open http://localhost:5173
```

## RPC Endpoint
The app uses an HTTP RPC URL defined in `src/solana.ts`:
```ts
export const CLUSTER_URL = "https://api.devnet.solana.com";
```
Optionally replace it with your provider (e.g., Helius/Alchemy):
```ts
export const CLUSTER_URL = "https://devnet.helius-rpc.com/?api-key=YOUR_KEY";
```

## Program ID
The Program ID used by the frontend is read from `src/idl/blog.json` → `metadata.address`.
Ensure it matches your deployed program:
- Anchor program `declare_id!(...)` in `anchor_project/programs/blog/src/lib.rs`
- `anchor_project/Anchor.toml` → `[programs.devnet].blog`
- `frontend/src/idl/blog.json` → `metadata.address`

## Build & Preview
```bash
npm run build
npm run preview
```

## Deploy (Vercel)
Using CLI:
```bash
vercel --prod --cwd "$(pwd)" --confirm
```
Or connect the `frontend` directory in the Vercel dashboard. Framework: Vite, Output: `dist`.

## Troubleshooting
- Blank page after connect: ensure wallet is on Devnet and RPC URL is reachable.
- “Program does not exist” on write actions: confirm the Program ID in `blog.json` matches your Devnet deployment.
- Slow transactions on Devnet: try a faster RPC and/or increase priority fees on backend paths if needed.

TODO
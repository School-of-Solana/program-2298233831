# Anchor Project - Solana Blog Program

A simple Anchor program demonstrating PDAs, account init, update, and close:
- Profile PDA: `["profile", author]`
- Post PDA: `["post", author, post_id_le]`
- Instructions: `initialize_profile`, `create_post`, `update_post`, `delete_post`

## Tooling
- Anchor (code uses `anchor-lang = 0.31.1`)
- Anchor CLI version is pinned via `Anchor.toml`:
  ```toml
  [toolchain]
  anchor_version = "0.31.1"
  ```
- Solana CLI/Agave: use a version compatible with your environment. Localnet testing recommended.
- Rust Toolchain: recent stable (tests have been run with 1.76+)

## Localnet - Build, Deploy, Test
Terminal A:
```bash
solana-test-validator -r
```
Terminal B:
```bash
cd anchor_project
anchor build

# Ensure local Program ID matches the keypair
solana-keygen pubkey target/deploy/blog-keypair.json
# If needed, copy it to Anchor.toml -> [programs.localnet].blog

# Deploy to localnet
solana program deploy -u localhost target/deploy/blog.so \
  --program-id target/deploy/blog-keypair.json

# Run tests (set local RPC + wallet)
export ANCHOR_PROVIDER_URL=http://127.0.0.1:8899
export ANCHOR_WALLET=$HOME/.config/solana/id.json

# TS tests
npm test
# (runs ts-mocha -p tsconfig.json tests/blog.ts --timeout 200000)

# JS tests
npx mocha tests/blog.js --timeout 200000
```

## Devnet - Deploy (optional)
```bash
cd anchor_project
# Use your preferred Devnet RPC
solana config set --url https://api.devnet.solana.com
# Deploy
solana program deploy --use-rpc target/deploy/blog.so \
  --program-id target/deploy/blog-keypair.json
```
After deployment, synchronize Program ID in three places:
1) `programs/blog/src/lib.rs` → `declare_id!(...)`
2) `Anchor.toml` → `[programs.devnet].blog` (Devnet)
3) `frontend/src/idl/blog.json` → `metadata.address`

## Notes
- If you see “program does not exist” in tests, it means localnet was not deployed or Program ID mismatched.
- Network/TPU timeouts on Devnet are common. Prefer localnet for development and CI tests.

TODO
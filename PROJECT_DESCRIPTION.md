# Project Description

**Deployed Frontend URL:** https://yu4n-blog-25hoef5ce-yu4ns-projects.vercel.app

**Solana Program ID:** 3gsZTNkyfJnnTmvfKahT67Y8KY8iXUAqDSKvHkzkPPb3

## Project Overview

### Description
A decentralized blog dApp on Solana. Each user can create a personal profile (Profile) and create/manage their posts (Post) via PDAs. Post data is stored on-chain (with length limits for title and content). Anyone can read posts, but only the author can update or delete them. This project demonstrates Anchor fundamentals: PDA usage, account initialization, state updates, and authorization checks.

### Key Features
- Create personal Profile
- Publish Posts: title and content
- Update Posts (author only)
- Delete Posts (author only)
- List all posts of the connected wallet (frontend)
  
### How to Use the dApp
1. Connect your wallet (e.g., Phantom)
2. Click “Initialize Profile”
3. Enter post title and content, then click “Publish”
4. Click “Refresh My Posts” to fetch on-chain data
5. Update/Delete can be extended in the UI as needed

## Program Architecture
Built with Anchor. Each user has a `Profile` account tracking `last_post_id`. Every post is a PDA derived from `author` and `post_id`, ensuring deterministic addressing and isolation across users.

### PDA Usage
- `Profile PDA`: `seeds = ["profile", author]`  
  Stores the author pubkey and the latest incrementing post ID (`last_post_id`).
- `Post PDA`: `seeds = ["post", author, post_id_le_8bytes]`  
  One account per post; `post_id` increments per author.

### Program Instructions
- `initialize_profile()` - Creates a unique Profile for the caller (fails if exists)
- `create_post(post_id, title, content)` - Creates a post; requires `post_id = last_post_id + 1`; title/content length limits enforced
- `update_post(post_id, new_title: Option<String>, new_content: Option<String>)` - Update (author only)
- `delete_post(post_id)` - Delete (author only), closes account to refund rent

### Account Structure
```rust
#[account]
pub struct Profile {
    pub author: Pubkey,     // Owner wallet
    pub last_post_id: u64,  // Latest post id for this author
}

#[account]
pub struct Post {
    pub author: Pubkey,     // Author
    pub id: u64,            // Post ID (per-author increment)
    pub title: String,      // Title (<= 64)
    pub content: String,    // Content (<= 1024)
    pub created_at: i64,    // Unix created at
    pub updated_at: i64,    // Unix updated at
}
```

## Testing

### Test Coverage
TypeScript tests cover both happy and unhappy paths.

**Happy Path Tests:**
- Initialize Profile succeeds
- Create Post succeeds: ID increments, content stored correctly
- Update Post succeeds: author-only

**Unhappy Path Tests:**
- Duplicate Profile initialization fails
- Non-author update fails (Unauthorized)

### Running Tests
```bash
# Local validator + local deployment + JS/TS tests

# 1) Start a fresh local validator (in Terminal A)
solana-test-validator -r

# 2) Build the program (Terminal B)
cd anchor_project
anchor build

# 3) Ensure the local Program ID matches the keypair
# Copy this pubkey into Anchor.toml [programs.localnet].blog if needed
solana-keygen pubkey target/deploy/blog-keypair.json

# 4) Deploy to localnet
solana program deploy -u localhost target/deploy/blog.so \
  --program-id target/deploy/blog-keypair.json

# 5) Run tests against localnet
export ANCHOR_PROVIDER_URL=http://127.0.0.1:8899
export ANCHOR_WALLET=$HOME/.config/solana/id.json

# Option A: run TS tests
npm test
# (This runs: ts-mocha -p tsconfig.json tests/blog.ts --timeout 200000)

# Option B: run JS tests
npx mocha tests/blog.js --timeout 200000
```

### Additional Notes for Evaluators
- PDAs provide a clean, per-author namespace for posts to avoid conflicts.
- Frontend uses Vite + React and interacts with the program via raw instructions and RPC queries (due to web bundler compatibility constraints).

import type { AnchorProvider, Idl } from "@coral-xyz/anchor";
import idl from "./idl/blog.json";

export const CLUSTER_URL = "https://api.devnet.solana.com";
const IDL_ADDRESS: string | undefined = (idl as any)?.metadata?.address;
export const PROGRAM_ID_STR: string =
  (import.meta as any)?.env?.VITE_PROGRAM_ID ??
  IDL_ADDRESS ??
  "3gsZTNkyfJnnTmvfKahT67Y8KY8iXUAqDSKvHkzkPPb3";

// Debug print to ensure value is present and valid
// eslint-disable-next-line no-console
console.log("[solana] PROGRAM_ID_STR =", PROGRAM_ID_STR);

export let PROGRAM_ID_BASE58 = PROGRAM_ID_STR;

export function getProvider(): AnchorProvider {
  throw new Error("Use getProviderAsync() in browser");
}

export async function getProviderAsync(): Promise<AnchorProvider> {
  const mod = await import("@coral-xyz/anchor");
  const anyWindow = window as any;
  if (!anyWindow.solana) {
    throw new Error("No wallet found. Please install Phantom or a Solana wallet.");
  }
  const connection = new mod.web3.Connection(CLUSTER_URL, "processed");
  const raw = anyWindow.solana;
  if (!raw.publicKey) {
    throw new Error("Wallet not connected.");
  }
  const normalizedWallet = {
    publicKey: new mod.web3.PublicKey(raw.publicKey.toBase58()),
    signTransaction: (tx: any) => raw.signTransaction(tx),
    signAllTransactions: (txs: any[]) => raw.signAllTransactions(txs)
  } as any;
  return new mod.AnchorProvider(connection, normalizedWallet, {
    commitment: "confirmed",
  });
}

export async function getProgramAsync(provider: AnchorProvider) {
  const mod = await import("@coral-xyz/anchor");
  const address = PROGRAM_ID_BASE58;
  // Debug logs
  // eslint-disable-next-line no-console
  console.log("[solana] constructing Program with:", {
    address,
    wallet: (provider.wallet as any)?.publicKey?.toBase58?.()
  });
  const programId = new mod.web3.PublicKey(address);
  return new mod.Program(idl as Idl, programId, provider);
}

export async function deriveProfilePda(author: any) {
  const mod = await import("@coral-xyz/anchor");
  const [pda] = mod.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), author.toBuffer()],
    new mod.web3.PublicKey(PROGRAM_ID_BASE58)
  );
  return pda;
}

export async function derivePostPda(author: any, id: bigint) {
  const mod = await import("@coral-xyz/anchor");
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(id);
  const [pda] = mod.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("post"), author.toBuffer(), idBuf],
    new mod.web3.PublicKey(PROGRAM_ID_BASE58)
  );
  return pda;
}

// ----- Raw instruction path (bypass Program constructor) -----
async function sha256First8Bytes(input: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash).slice(0, 8);
}

function encodeU32LE(n: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, n, true);
  return new Uint8Array(buf);
}

function encodeU64LE(n: bigint): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Number(n & BigInt(0xffffffff)), true);
  view.setUint32(4, Number((n >> BigInt(32)) & BigInt(0xffffffff)), true);
  return new Uint8Array(buf);
}

function encodeString(s: string): Uint8Array {
  const enc = new TextEncoder();
  const bytes = enc.encode(s);
  const len = encodeU32LE(bytes.length);
  const out = new Uint8Array(4 + bytes.length);
  out.set(len, 0);
  out.set(bytes, 4);
  return out;
}

export async function buildInitializeProfileIx(author: any) {
  const mod = await import("@coral-xyz/anchor");
  const programId = new mod.web3.PublicKey(PROGRAM_ID_BASE58);
  const discriminator = await sha256First8Bytes("global:initialize_profile");
  const data = discriminator; // no args
  const profile = await deriveProfilePda(author);
  return new mod.web3.TransactionInstruction({
    programId,
    keys: [
      { pubkey: profile, isSigner: false, isWritable: true },
      { pubkey: author, isSigner: true, isWritable: true },
      { pubkey: mod.web3.SystemProgram.programId, isSigner: false, isWritable: false }
    ],
    data
  });
}

export async function buildCreatePostIx(author: any, postId: bigint, title: string, content: string) {
  const mod = await import("@coral-xyz/anchor");
  const programId = new mod.web3.PublicKey(PROGRAM_ID_BASE58);
  const discriminator = await sha256First8Bytes("global:create_post");
  const profile = await deriveProfilePda(author);
  const post = await derivePostPda(author, postId);
  const argPostId = encodeU64LE(postId);
  const argTitle = encodeString(title);
  const argContent = encodeString(content);
  const data = new Uint8Array(discriminator.length + argPostId.length + argTitle.length + argContent.length);
  let o = 0;
  data.set(discriminator, o); o += discriminator.length;
  data.set(argPostId, o); o += argPostId.length;
  data.set(argTitle, o); o += argTitle.length;
  data.set(argContent, o);
  return new mod.web3.TransactionInstruction({
    programId,
    keys: [
      { pubkey: profile, isSigner: false, isWritable: true },
      { pubkey: post, isSigner: false, isWritable: true },
      { pubkey: author, isSigner: true, isWritable: true },
      { pubkey: mod.web3.SystemProgram.programId, isSigner: false, isWritable: false }
    ],
    data
  });
}

function encodeOptionString(value: string | null | undefined): Uint8Array {
  if (value === null || value === undefined) {
    // None -> tag 0
    return new Uint8Array([0]);
  }
  // Some -> tag 1 + string
  const str = encodeString(value);
  const out = new Uint8Array(1 + str.length);
  out[0] = 1;
  out.set(str, 1);
  return out;
}

export async function buildUpdatePostIx(author: any, postId: bigint, newTitle: string | null, newContent: string | null) {
  const mod = await import("@coral-xyz/anchor");
  const programId = new mod.web3.PublicKey(PROGRAM_ID_BASE58);
  const discriminator = await sha256First8Bytes("global:update_post");
  const profile = await deriveProfilePda(author);
  const post = await derivePostPda(author, postId);
  const argPostId = encodeU64LE(postId);
  const optTitle = encodeOptionString(newTitle);
  const optContent = encodeOptionString(newContent);
  const data = new Uint8Array(discriminator.length + argPostId.length + optTitle.length + optContent.length);
  let o = 0;
  data.set(discriminator, o); o += discriminator.length;
  data.set(argPostId, o); o += argPostId.length;
  data.set(optTitle, o); o += optTitle.length;
  data.set(optContent, o);
  return new mod.web3.TransactionInstruction({
    programId,
    keys: [
      { pubkey: profile, isSigner: false, isWritable: false },
      { pubkey: post, isSigner: false, isWritable: true },
      { pubkey: author, isSigner: true, isWritable: true }
    ],
    data
  });
}

export async function buildDeletePostIx(author: any, postId: bigint) {
  const mod = await import("@coral-xyz/anchor");
  const programId = new mod.web3.PublicKey(PROGRAM_ID_BASE58);
  const discriminator = await sha256First8Bytes("global:delete_post");
  const profile = await deriveProfilePda(author);
  const post = await derivePostPda(author, postId);
  const argPostId = encodeU64LE(postId);
  const data = new Uint8Array(discriminator.length + argPostId.length);
  data.set(discriminator, 0);
  data.set(argPostId, discriminator.length);
  return new mod.web3.TransactionInstruction({
    programId,
    keys: [
      { pubkey: profile, isSigner: false, isWritable: false },
      { pubkey: post, isSigner: false, isWritable: true },
      { pubkey: author, isSigner: true, isWritable: true }
    ],
    data
  });
}

export async function sendInstructions(author: any, ixs: any[]) {
  const mod = await import("@coral-xyz/anchor");
  const connection = new mod.web3.Connection(CLUSTER_URL, "processed");
  // Add compute budget to speed up inclusion (esp. on busier clusters)
  const cuLimitIx = mod.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 });
  const cuPriceIx = mod.web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 });
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new mod.web3.Transaction({ feePayer: author, blockhash, lastValidBlockHeight });
  tx.add(cuLimitIx, cuPriceIx, ...ixs);
  const signed = await (window as any).solana.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
    maxRetries: 2
  });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "processed");
  return sig;
}

// ----- Fetch posts without Program client -----
function readU32LE(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}
function readU64LE(view: DataView, offset: number): bigint {
  return view.getBigUint64(offset, true);
}
function readI64LE(view: DataView, offset: number): bigint {
  return view.getBigInt64(offset, true);
}
function decodeString(view: DataView, offset: number): { value: string; next: number } {
  const len = readU32LE(view, offset);
  const start = offset + 4;
  const end = start + len;
  const bytes = new Uint8Array(view.buffer, view.byteOffset + start, len);
  const value = new TextDecoder().decode(bytes);
  return { value, next: end };
}

export async function fetchPostsByAuthor(author: any) {
  const mod = await import("@coral-xyz/anchor");
  const connection = new mod.web3.Connection(CLUSTER_URL, "processed");
  const programId = new mod.web3.PublicKey(PROGRAM_ID_BASE58);
  const accounts = await connection.getProgramAccounts(programId, {
    filters: [
      {
        memcmp: {
          offset: 8, // author starts at byte 8
          bytes: author.toBase58(),
        },
      },
    ],
  });

  // Compute Post account discriminator to filter out Profile accounts
  const postDisc = await sha256First8Bytes("account:Post");

  const posts: Array<{
    publicKey: any;
    account: {
      author: any;
      id: bigint;
      title: string;
      content: string;
      createdAt: bigint;
      updatedAt: bigint;
    };
  }> = [];

  for (const acc of accounts) {
    const data = acc.account.data as unknown as Uint8Array;
    if (!data || data.length < 8 + 32 + 8) continue;
    // Check discriminator matches Post
    let isPost = true;
    for (let i = 0; i < 8; i++) {
      if (data[i] !== postDisc[i]) {
        isPost = false;
        break;
      }
    }
    if (!isPost) continue; // skip non-Post accounts (e.g., Profile)

    try {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      let o = 8; // skip discriminator
      const authorBytes = new Uint8Array(data.buffer, data.byteOffset + o, 32);
      const authorPk = new mod.web3.PublicKey(authorBytes);
      o += 32;
      const idBig = readU64LE(view, o); o += 8;
      // Defensive decode for variable-length strings
      if (o + 4 > data.length) continue;
      const t = decodeString(view, o); o = t.next;
      if (o + 4 > data.length) continue;
      const c = decodeString(view, o); o = c.next;
      if (o + 16 > data.length) continue;
      const createdBig = readI64LE(view, o); o += 8;
      const updatedBig = readI64LE(view, o); o += 8;
      posts.push({
        publicKey: acc.pubkey,
        account: {
          author: authorPk,
          id: idBig,
          title: t.value,
          content: c.value,
          createdAt: createdBig,
          updatedAt: updatedBig,
        },
      });
    } catch {
      // Skip malformed accounts
      continue;
    }
  }
  return posts;
}

export async function fetchProfileByAuthor(author: any) {
  const mod = await import("@coral-xyz/anchor");
  const connection = new mod.web3.Connection(CLUSTER_URL, "processed");
  const programId = new mod.web3.PublicKey(PROGRAM_ID_BASE58);
  const profilePda = await deriveProfilePda(author);
  const info = await connection.getAccountInfo(profilePda);
  if (!info || !info.data) return null;
  const data = info.data as unknown as Uint8Array;
  if (data.length < 8 + 32 + 8) return null;
  // Check Profile discriminator
  const profDisc = await sha256First8Bytes("account:Profile");
  for (let i = 0; i < 8; i++) {
    if (data[i] !== profDisc[i]) return null;
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = 8; // discriminator
  o += 32; // author Pubkey
  const lastPostId = readU64LE(view, o);
  return {
    publicKey: profilePda,
    account: {
      author,
      lastPostId, // bigint
    },
  };
}


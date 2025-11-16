import { useCallback, useEffect, useState } from "react";
import { AnchorProvider, BN, web3 } from "@coral-xyz/anchor";
import { derivePostPda, deriveProfilePda, getProgramAsync, getProviderAsync, buildInitializeProfileIx, buildCreatePostIx, buildDeletePostIx, buildUpdatePostIx, sendInstructions, fetchPostsByAuthor, fetchProfileByAuthor } from "./solana";

type Post = {
  publicKey: web3.PublicKey;
  account: {
    author: web3.PublicKey;
    id: BN;
    title: string;
    content: string;
    createdAt: BN;
    updatedAt: BN;
  };
};

export function App() {
  const [provider, setProvider] = useState<AnchorProvider | null>(null);
  const [connected, setConnected] = useState(false);
  const [pubkey, setPubkey] = useState<web3.PublicKey | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const formatError = useCallback((e: any) => {
    try {
      const logs: string[] | undefined =
        e?.logs ||
        e?.simulationResponse?.logs ||
        e?.error?.logs ||
        e?.data?.logs;
      if (logs && Array.isArray(logs)) {
        const joined = logs.join("\n");
        if (joined.includes("already in use")) return "Profile already exists. No need to initialize again.";
        if (joined.includes("InvalidNextPostId")) return "Publish failed: Non-sequential post ID. Please refresh and try again.";
        if (joined.includes("TitleTooLong")) return "Publish failed: Title too long.";
        if (joined.includes("ContentTooLong")) return "Publish failed: Content too long.";
        if (joined.includes("Unauthorized")) return "Operation failed: Unauthorized.";
        if (joined.includes("InstructionFallbackNotFound")) return "Call failed: Instruction not found. Please refresh and retry.";
      }
      const msg: string =
        e?.message ||
        e?.toString?.() ||
        "Transaction failed. Please try again later.";
      return msg.length > 180 ? "Transaction failed. Please try again later." : msg;
    } catch {
      return "Transaction failed. Please try again later.";
    }
  }, []);

  useEffect(() => {
    const w = (window as any).solana;
    if (w && w.isPhantom) {
      w.connect({ onlyIfTrusted: true }).catch(() => {});
      w.on("connect", () => {
        setConnected(true);
        setPubkey(w.publicKey);
        getProviderAsync()
          .then((p) => setProvider(p))
          .catch((e) => {
            console.error(e);
            alert("Wallet connected, but failed to create Provider. Check console and network.");
          });
      });
      w.on("disconnect", () => {
        setConnected(false);
        setPubkey(null);
        setProvider(null);
      });
      if (w.publicKey) {
        setConnected(true);
        setPubkey(w.publicKey);
        getProviderAsync()
          .then((p) => setProvider(p))
          .catch((e) => {
            console.error(e);
            alert("Wallet detected, but failed to create Provider. Check console.");
          });
      }
    }
  }, []);

  const connect = useCallback(async () => {
    const w = (window as any).solana;
    if (!w) {
      alert("Please install a Solana wallet (e.g., Phantom).");
      return;
    }
    await w.connect();
  }, []);

  const initProfile = useCallback(async () => {
    if (!pubkey) {
      alert("Please connect your wallet first.");
      return;
    }
    setLoading(true);
    try {
      const ix = await buildInitializeProfileIx(pubkey);
      await sendInstructions(pubkey, [ix]);
      alert("Profile initialized.");
    } catch (e: any) {
      console.error(e);
      alert(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [pubkey, formatError]);

  const createPost = useCallback(async () => {
    if (!pubkey) {
      alert("Please connect your wallet first.");
      return;
    }
    if (!title.trim() || !content.trim()) {
      alert("Title and content are required.");
      return;
    }
    setLoading(true);
    try {
      // 以 Profile.last_post_id 为准（删除文章后也能连续）
      const profile = await fetchProfileByAuthor(pubkey);
      const nextId = new BN(((profile?.account.lastPostId ?? 0n) + 1n).toString());
      const ix = await buildCreatePostIx(pubkey, BigInt(nextId.toString()), title, content);
      await sendInstructions(pubkey, [ix]);

      setTitle("");
      setContent("");
      // 直接刷新文章列表，避免依赖尚未初始化的 refreshPosts
      const raw = await fetchPostsByAuthor(pubkey);
      const mapped: Post[] = raw.map((r: any) => ({
        publicKey: r.publicKey,
        account: {
          author: r.account.author,
          id: new BN((r.account.id as bigint).toString()),
          title: r.account.title,
          content: r.account.content,
          createdAt: new BN((r.account.createdAt as bigint).toString()),
          updatedAt: new BN((r.account.updatedAt as bigint).toString()),
        }
      }));
      mapped.sort((a, b) => Number(b.account.createdAt.sub(a.account.createdAt)));
      setPosts(mapped);
    } catch (e: any) {
      console.error(e);
      alert(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [pubkey, title, content, formatError]);

  const refreshPosts = useCallback(async () => {
    if (!pubkey) {
      alert("Please connect your wallet first.");
      return;
    }
    setLoading(true);
    try {
      const raw = await fetchPostsByAuthor(pubkey);
      // map to UI Post type with BN
      const mapped: Post[] = raw.map((r: any) => ({
        publicKey: r.publicKey,
        account: {
          author: r.account.author,
          id: new BN((r.account.id as bigint).toString()),
          title: r.account.title,
          content: r.account.content,
          createdAt: new BN((r.account.createdAt as bigint).toString()),
          updatedAt: new BN((r.account.updatedAt as bigint).toString()),
        }
      }));
      mapped.sort((a, b) => Number(b.account.createdAt.sub(a.account.createdAt)));
      setPosts(mapped);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [pubkey]);

  const startEdit = useCallback((p: Post) => {
    setEditingId(p.account.id.toString());
    setEditTitle(p.account.title);
    setEditContent(p.account.content);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  }, []);

  const saveEdit = useCallback(async (p: Post) => {
    if (!pubkey) {
      alert("Please connect your wallet first.");
      return;
    }
    const newTitle = editTitle.trim();
    const newContent = editContent.trim();
    const titleChanged = newTitle !== p.account.title;
    const contentChanged = newContent !== p.account.content;
    if (!titleChanged && !contentChanged) {
      alert("No changes detected.");
      return;
    }
    setLoading(true);
    try {
      const ix = await buildUpdatePostIx(
        pubkey,
        BigInt(p.account.id.toString()),
        titleChanged ? newTitle : null,
        contentChanged ? newContent : null
      );
      await sendInstructions(pubkey, [ix]);
      // refresh list
      const raw = await fetchPostsByAuthor(pubkey);
      const mapped: Post[] = raw.map((r: any) => ({
        publicKey: r.publicKey,
        account: {
          author: r.account.author,
          id: new BN((r.account.id as bigint).toString()),
          title: r.account.title,
          content: r.account.content,
          createdAt: new BN((r.account.createdAt as bigint).toString()),
          updatedAt: new BN((r.account.updatedAt as bigint).toString()),
        }
      }));
      mapped.sort((a, b) => Number(b.account.createdAt.sub(a.account.createdAt)));
      setPosts(mapped);
      cancelEdit();
    } catch (e: any) {
      console.error(e);
      alert(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [pubkey, editTitle, editContent, formatError, cancelEdit]);

  const onDelete = useCallback(async (p: Post) => {
    if (!pubkey) {
      alert("Please connect your wallet first.");
      return;
    }
    const yes = confirm(`Delete post #${p.account.id.toString()}? This action cannot be undone.`);
    if (!yes) return;
    setLoading(true);
    try {
      const ix = await buildDeletePostIx(pubkey, BigInt(p.account.id.toString()));
      await sendInstructions(pubkey, [ix]);
      // 刷新列表
      const raw = await fetchPostsByAuthor(pubkey);
      const mapped: Post[] = raw.map((r: any) => ({
        publicKey: r.publicKey,
        account: {
          author: r.account.author,
          id: new BN((r.account.id as bigint).toString()),
          title: r.account.title,
          content: r.account.content,
          createdAt: new BN((r.account.createdAt as bigint).toString()),
          updatedAt: new BN((r.account.updatedAt as bigint).toString()),
        }
      }));
      mapped.sort((a, b) => Number(b.account.createdAt.sub(a.account.createdAt)));
      setPosts(mapped);
    } catch (e: any) {
      console.error(e);
      alert(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [pubkey, formatError]);

  return (
    <div style={{ maxWidth: 720, margin: "24px auto", padding: 16 }}>
      <h2>Solana Blog dApp</h2>
      {!connected ? (
        <button onClick={connect}>Connect Wallet</button>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Connected: {pubkey?.toBase58()}</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button disabled={!connected || loading} onClick={initProfile}>
          Initialize Profile
        </button>
        <button disabled={!connected || loading} onClick={refreshPosts}>
          Refresh My Posts
        </button>
      </div>

      <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Create New Post</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            placeholder="Title (max 64 chars)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={64}
          />
          <textarea
            placeholder="Content (max 1024 chars)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            maxLength={1024}
          />
          <button disabled={!connected || loading} onClick={createPost}>
            Publish
          </button>
        </div>
      </div>

      <div>
        <h3 style={{ marginTop: 0 }}>My Posts</h3>
        {posts.length === 0 ? (
          <div style={{ color: "#888" }}>No posts yet</div>
        ) : (
          posts.map((p) => (
            <div key={p.publicKey.toBase58()} style={{ borderBottom: "1px solid #eee", padding: "12px 0" }}>
              {editingId === p.account.id.toString() ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={64}
                    placeholder="Title (max 64 chars)"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={6}
                    maxLength={1024}
                    placeholder="Content (max 1024 chars)"
                  />
                </div>
              ) : (
                <>
                  <div style={{ fontWeight: 600 }}>{p.account.title}</div>
                  <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{p.account.content}</div>
                </>
              )}
              <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
                #{p.account.id.toString()} · {new Date(Number(p.account.createdAt.toString()) * 1000).toLocaleString()}
              </div>
              <div style={{ marginTop: 8 }}>
                {editingId === p.account.id.toString() ? (
                  <>
                    <button disabled={!connected || loading} onClick={() => saveEdit(p)} style={{ marginRight: 8 }}>
                      Save
                    </button>
                    <button disabled={loading} onClick={cancelEdit}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button disabled={!connected || loading} onClick={() => startEdit(p)} style={{ marginRight: 8 }}>
                      Edit
                    </button>
                    <button disabled={!connected || loading} onClick={() => onDelete(p)}>
                  Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}



const anchor = require("@coral-xyz/anchor");
const { BN, web3 } = anchor;
const { expect } = require("chai");

describe("blog program (js)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Blog;
  const wallet = provider.wallet;

  const findProfilePda = (author) => {
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), author.toBuffer()],
      program.programId
    );
  };

  const findPostPda = (author, id) => {
    const idBn = BN.isBN(id) ? id : new BN(id);
    const idBuf = Buffer.from(idBn.toArray("le", 8));
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from("post"), author.toBuffer(), idBuf],
      program.programId
    );
  };

  it("initializes profile", async () => {
    const [profilePda] = findProfilePda(wallet.publicKey);
    await program.methods
      .initializeProfile()
      .accounts({
        profile: profilePda,
        author: wallet.publicKey,
      })
      .rpc();
    const profile = await program.account.profile.fetch(profilePda);
    expect(profile.author.toBase58()).to.equal(wallet.publicKey.toBase58());
    expect(profile.lastPostId.toNumber()).to.equal(0);
  });

  it("creates and updates a post", async () => {
    const [profilePda] = findProfilePda(wallet.publicKey);
    const postId = 1;
    const [postPda] = findPostPda(wallet.publicKey, postId);
    await program.methods
      .createPost(new BN(postId), "Hello", "First content")
      .accounts({
        profile: profilePda,
        post: postPda,
        author: wallet.publicKey,
      })
      .rpc();
    let post = await program.account.post.fetch(postPda);
    expect(post.id.toNumber()).to.equal(postId);
    expect(post.title).to.equal("Hello");
    expect(post.content).to.equal("First content");
    await program.methods
      .updatePost(new BN(postId), "Updated title", null)
      .accounts({
        profile: profilePda,
        post: postPda,
        author: wallet.publicKey,
      })
      .rpc();
    post = await program.account.post.fetch(postPda);
    expect(post.title).to.equal("Updated title");
  });

  it("fails to initialize duplicate profile", async () => {
    const [profilePda] = findProfilePda(wallet.publicKey);
    let threw = false;
    try {
      await program.methods
        .initializeProfile()
        .accounts({
          profile: profilePda,
          author: wallet.publicKey,
        })
        .rpc();
    } catch (_) {
      threw = true;
    }
    expect(threw).to.equal(true);
  });

  it("prevents unauthorized update", async () => {
    const other = web3.Keypair.generate();
    const [profilePda] = findProfilePda(wallet.publicKey);
    const [postPda] = findPostPda(wallet.publicKey, 1);
    let threw = false;
    try {
      await program.methods
        .updatePost(new BN(1), null, "Hacked")
        .accounts({
          profile: profilePda,
          post: postPda,
          author: other.publicKey,
        })
        .signers([other])
        .rpc();
    } catch (_) {
      threw = true;
    }
    expect(threw).to.equal(true);
  });

  it("rejects non-sequential create (InvalidNextPostId)", async () => {
    const [profilePda] = findProfilePda(wallet.publicKey);
    const badPostId = 3; // next allowed is 2
    const [badPostPda] = findPostPda(wallet.publicKey, badPostId);
    let threw = false;
    try {
      await program.methods
        .createPost(new BN(badPostId), "Bad Id", "This should fail")
        .accounts({
          profile: profilePda,
          post: badPostPda,
          author: wallet.publicKey,
        })
        .rpc();
    } catch (_) {
      threw = true;
    }
    expect(threw).to.equal(true);
  });

  it("deletes a post by author", async () => {
    const [profilePda] = findProfilePda(wallet.publicKey);
    const postId = 1;
    const [postPda] = findPostPda(wallet.publicKey, postId);
    await program.methods
      .deletePost(new BN(postId))
      .accounts({
        profile: profilePda,
        post: postPda,
        author: wallet.publicKey,
      })
      .rpc();
    let closed = false;
    try {
      await program.account.post.fetch(postPda);
    } catch (_) {
      closed = true;
    }
    expect(closed).to.equal(true);
  });

  it("prevents unauthorized delete", async () => {
    // create a new post with id 2
    const [profilePda] = findProfilePda(wallet.publicKey);
    const nextPostId = 2;
    const [post2Pda] = findPostPda(wallet.publicKey, nextPostId);
    await program.methods
      .createPost(new BN(nextPostId), "Second", "Second content")
      .accounts({
        profile: profilePda,
        post: post2Pda,
        author: wallet.publicKey,
      })
      .rpc();
    const attacker = web3.Keypair.generate();
    let threw = false;
    try {
      await program.methods
        .deletePost(new BN(nextPostId))
        .accounts({
          profile: profilePda,
          post: post2Pda,
          author: attacker.publicKey,
        })
        .signers([attacker])
        .rpc();
    } catch (_) {
      threw = true;
    }
    expect(threw).to.equal(true);
  });
});



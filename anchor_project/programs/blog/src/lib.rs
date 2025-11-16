use anchor_lang::prelude::*;

declare_id!("3gsZTNkyfJnnTmvfKahT67Y8KY8iXUAqDSKvHkzkPPb3");

const TITLE_MAX_LEN: usize = 64;
const CONTENT_MAX_LEN: usize = 1024;

#[program]
pub mod blog {
    use super::*;

    pub fn initialize_profile(ctx: Context<InitializeProfile>) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        profile.author = ctx.accounts.author.key();
        profile.last_post_id = 0;
        Ok(())
    }

    pub fn create_post(
        ctx: Context<CreatePost>,
        post_id: u64,
        title: String,
        content: String,
    ) -> Result<()> {
        require!(
            post_id == ctx.accounts.profile.last_post_id.checked_add(1).ok_or(ErrorCode::Overflow)?,
            ErrorCode::InvalidNextPostId
        );
        require!(title.len() <= TITLE_MAX_LEN, ErrorCode::TitleTooLong);
        require!(content.len() <= CONTENT_MAX_LEN, ErrorCode::ContentTooLong);

        let post = &mut ctx.accounts.post;
        post.author = ctx.accounts.author.key();
        post.id = post_id;
        post.title = title;
        post.content = content;
        let now = Clock::get()?.unix_timestamp;
        post.created_at = now;
        post.updated_at = now;

        let profile = &mut ctx.accounts.profile;
        profile.last_post_id = post_id;

        Ok(())
    }

    pub fn update_post(
        ctx: Context<UpdatePost>,
        _post_id: u64,
        new_title: Option<String>,
        new_content: Option<String>,
    ) -> Result<()> {
        require_keys_eq!(ctx.accounts.post.author, ctx.accounts.author.key(), ErrorCode::Unauthorized);

        let post = &mut ctx.accounts.post;
        if let Some(t) = new_title {
            require!(t.len() <= TITLE_MAX_LEN, ErrorCode::TitleTooLong);
            post.title = t;
        }
        if let Some(c) = new_content {
            require!(c.len() <= CONTENT_MAX_LEN, ErrorCode::ContentTooLong);
            post.content = c;
        }
        post.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn delete_post(ctx: Context<DeletePost>, _post_id: u64) -> Result<()> {
        require_keys_eq!(ctx.accounts.post.author, ctx.accounts.author.key(), ErrorCode::Unauthorized);
        // The account will be closed automatically to the author via the `close = author` constraint.
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeProfile<'info> {
    #[account(
        init,
        payer = author,
        seeds = [b"profile", author.key().as_ref()],
        bump,
        space = 8 + Profile::INIT_SPACE
    )]
    pub profile: Account<'info, Profile>,
    #[account(mut)]
    pub author: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(post_id: u64, title: String, content: String)]
pub struct CreatePost<'info> {
    #[account(
        mut,
        seeds = [b"profile", author.key().as_ref()],
        bump,
        constraint = profile.author == author.key() @ ErrorCode::Unauthorized
    )]
    pub profile: Account<'info, Profile>,
    #[account(
        init,
        payer = author,
        seeds = [b"post", author.key().as_ref(), &post_id.to_le_bytes()],
        bump,
        space = 8 + Post::INIT_SPACE
    )]
    pub post: Account<'info, Post>,
    #[account(mut)]
    pub author: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(post_id: u64, new_title: Option<String>, new_content: Option<String>)]
pub struct UpdatePost<'info> {
    #[account(
        seeds = [b"profile", author.key().as_ref()],
        bump,
        constraint = profile.author == author.key() @ ErrorCode::Unauthorized
    )]
    pub profile: Account<'info, Profile>,
    #[account(
        mut,
        seeds = [b"post", author.key().as_ref(), &post_id.to_le_bytes()],
        bump,
        has_one = author
    )]
    pub post: Account<'info, Post>,
    pub author: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(post_id: u64)]
pub struct DeletePost<'info> {
    #[account(
        seeds = [b"profile", author.key().as_ref()],
        bump,
        constraint = profile.author == author.key() @ ErrorCode::Unauthorized
    )]
    pub profile: Account<'info, Profile>,
    #[account(
        mut,
        close = author,
        seeds = [b"post", author.key().as_ref(), &post_id.to_le_bytes()],
        bump,
        has_one = author
    )]
    pub post: Account<'info, Post>,
    #[account(mut)]
    pub author: Signer<'info>,
}

#[account]
pub struct Profile {
    pub author: Pubkey,
    pub last_post_id: u64,
}

impl Profile {
    pub const INIT_SPACE: usize = 32 + 8;
}

#[account]
pub struct Post {
    pub author: Pubkey,
    pub id: u64,
    pub title: String,
    pub content: String,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Post {
    pub const INIT_SPACE: usize = 32 + 8 + (4 + TITLE_MAX_LEN) + (4 + CONTENT_MAX_LEN) + 8 + 8;
}

#[error_code]
pub enum ErrorCode {
    #[msg("The provided post_id does not match the next valid id.")]
    InvalidNextPostId,
    #[msg("Title exceeds maximum length.")]
    TitleTooLong,
    #[msg("Content exceeds maximum length.")]
    ContentTooLong,
    #[msg("Unauthorized action.")]
    Unauthorized,
    #[msg("Integer overflow occurred.")]
    Overflow,
}



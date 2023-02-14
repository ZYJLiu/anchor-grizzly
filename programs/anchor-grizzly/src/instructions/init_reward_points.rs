// initialize reward points mint account for a merchant
use crate::*;

#[derive(Accounts)]
pub struct InitRewardPoints<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [MERCHANT_SEED.as_bytes(), authority.key().as_ref()],
        bump,
        constraint = merchant.authority == authority.key()
    )]
    pub merchant: Account<'info, MerchantState>,
    #[account(
        init,
        seeds = [REWARD_POINTS_SEED.as_bytes(), merchant.key().as_ref()],
        bump,
        payer = authority,
        mint::decimals = 6,
        mint::authority = reward_points_mint,

    )]
    pub reward_points_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn init_reward_points_handler(
    ctx: Context<InitRewardPoints>,
    reward_points_basis_points: u16,
) -> Result<()> {
    ctx.accounts.merchant.reward_points_mint = ctx.accounts.reward_points_mint.key();
    ctx.accounts.merchant.reward_points_basis_points = reward_points_basis_points;
    msg!(
        "reward points mint: {}",
        ctx.accounts.merchant.reward_points_mint
    );
    msg!("reward points basis points: {}", reward_points_basis_points);
    Ok(())
}

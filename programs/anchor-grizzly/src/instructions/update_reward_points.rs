// update reward points basis points, % minted at checkout
use crate::*;

#[derive(Accounts)]
pub struct UpdateRewardPoints<'info> {
    // authority of merchant account
    #[account(mut)]
    pub authority: Signer<'info>,

    // merchant account
    #[account(
        mut,
        seeds = [MERCHANT_SEED.as_bytes(), authority.key().as_ref()],
        bump,
        constraint = merchant.authority == authority.key()
    )]
    pub merchant: Account<'info, MerchantState>,
}

pub fn update_reward_points_handler(
    ctx: Context<UpdateRewardPoints>,
    reward_points_basis_points: u16,
) -> Result<()> {
    ctx.accounts.merchant.reward_points_basis_points = reward_points_basis_points;
    Ok(())
}

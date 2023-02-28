// update loyalty discount basis points
use crate::*;

#[derive(Accounts)]
pub struct UpdateLoyaltyPoints<'info> {
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

pub fn update_loyalty_points_handler(
    ctx: Context<UpdateLoyaltyPoints>,
    loyalty_discount_basis_points: u16,
) -> Result<()> {
    ctx.accounts.merchant.loyalty_discount_basis_points = loyalty_discount_basis_points;
    Ok(())
}

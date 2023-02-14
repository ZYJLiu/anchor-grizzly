// initialize a new merchant account
use crate::*;

#[derive(Accounts)]
pub struct InitMerchant<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [MERCHANT_SEED.as_bytes(), authority.key().as_ref()],
        bump,
        payer = authority,
        space = MerchantState::LEN
    )]
    pub merchant: Account<'info, MerchantState>,
    pub system_program: Program<'info, System>,
}

pub fn init_merchant_handler(ctx: Context<InitMerchant>) -> Result<()> {
    ctx.accounts.merchant.authority = ctx.accounts.authority.key();
    msg!("authority: {}", &ctx.accounts.authority.key());
    Ok(())
}

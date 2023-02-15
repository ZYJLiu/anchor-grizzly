// initialize a new merchant account
use crate::*;

#[derive(Accounts)]
pub struct InitMerchant<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    // initialize a new merchant account
    #[account(
        init,
        seeds = [MERCHANT_SEED.as_bytes(), authority.key().as_ref()],
        bump,
        payer = authority,
        space = MerchantState::LEN
    )]
    pub merchant: Account<'info, MerchantState>,

    // "usdc" mint account
    #[account(
        address = USDC_MINT_PLACEHOLDER
    )]
    pub usdc_mint_placeholder: Account<'info, Mint>,

    // init "usdc" token account as payment destination for merchant if one does not exist
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = usdc_mint_placeholder,
        associated_token::authority = authority
    )]
    pub payment_destination: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn init_merchant_handler(ctx: Context<InitMerchant>) -> Result<()> {
    ctx.accounts.merchant.authority = ctx.accounts.authority.key();
    ctx.accounts.merchant.payment_destination = ctx.accounts.payment_destination.key();
    msg!("authority: {}", &ctx.accounts.authority.key());
    msg!(
        "payment destination: {}",
        &ctx.accounts.payment_destination.key()
    );
    Ok(())
}

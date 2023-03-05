// mint reward points, use to airdrop customers reward points
use crate::*;

#[derive(Accounts)]
pub struct MintRewardPoints<'info> {
    // authority of merchant account
    #[account(mut)]
    pub authority: Signer<'info>,

    // customer getting reward points
    pub customer: SystemAccount<'info>,

    // merchant account
    #[account(
        seeds = [MERCHANT_SEED.as_bytes(), authority.key().as_ref()],
        bump,
        constraint = merchant.authority == authority.key()
    )]
    pub merchant: Account<'info, MerchantState>,

    // merchant's reward points mint
    #[account(
        mut,
        seeds = [REWARD_POINTS_SEED.as_bytes(), merchant.key().as_ref()],
        bump,
        address = merchant.reward_points_mint,
    )]
    pub reward_points_mint: Account<'info, Mint>,

    // init customer's reward points token account if one does not exist
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = reward_points_mint,
        associated_token::authority = customer
    )]
    pub customer_reward_token_account: Box<Account<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn mint_reward_points_handler(ctx: Context<MintRewardPoints>, amount: u64) -> Result<()> {
    // reward points mint PDA is also mint authority
    let merchant = ctx.accounts.merchant.key();
    let signer_seeds: &[&[&[u8]]] = &[&[
        REWARD_POINTS_SEED.as_bytes(),
        merchant.as_ref(),
        &[*ctx.bumps.get("reward_points_mint").unwrap()],
    ]];

    // mint reward points to customer
    msg!("Minting Reward Points Tokens");
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.reward_points_mint.to_account_info(),
            to: ctx.accounts.customer_reward_token_account.to_account_info(),
            authority: ctx.accounts.reward_points_mint.to_account_info(),
        },
        signer_seeds,
    );
    mint_to(cpi_ctx, amount)?;
    Ok(())
}

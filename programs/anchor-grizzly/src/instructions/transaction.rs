// transaction, customer pays merchant, customer minted reward points
use crate::*;

#[derive(Accounts)]
pub struct Transaction<'info> {
    #[account(mut)]
    pub customer: Signer<'info>,

    /// CHECK: Used for merchant account PDA seed
    pub authority: SystemAccount<'info>,

    // merchant account
    #[account(
        seeds = [MERCHANT_SEED.as_bytes(), authority.key().as_ref()],
        bump,
        constraint = merchant.authority == authority.key()
    )]
    pub merchant: Account<'info, MerchantState>,

    // merchant's payment destination
    #[account(
        mut,
        token::mint = USDC_MINT_PLACEHOLDER,
        address = merchant.payment_destination,
    )]
    pub payment_destination: Account<'info, TokenAccount>,

    // customer's usdc token account
    #[account(
        mut,
        token::mint = USDC_MINT_PLACEHOLDER,
        constraint = customer_usdc_token_account.owner == customer.key()
    )]
    pub customer_usdc_token_account: Account<'info, TokenAccount>,

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
        payer = customer,
        associated_token::mint = reward_points_mint,
        associated_token::authority = customer
    )]
    pub customer_reward_token_account: Box<Account<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn transaction_handler(ctx: Context<Transaction>, amount: u64) -> Result<()> {
    // reward points mint PDA is also mint authority
    let merchant = ctx.accounts.merchant.key();
    let signer_seeds: &[&[&[u8]]] = &[&[
        REWARD_POINTS_SEED.as_bytes(),
        merchant.as_ref(),
        &[*ctx.bumps.get("reward_points_mint").unwrap()],
    ]];

    // transfer payment from customer to merchant
    msg!("Transfer Tokens");
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.customer_usdc_token_account.to_account_info(),
            authority: ctx.accounts.customer.to_account_info(),
            to: ctx.accounts.payment_destination.to_account_info(),
        },
    );
    transfer(cpi_ctx, amount)?;

    // calculate reward points
    let reward_amount = amount
        .checked_mul(ctx.accounts.merchant.reward_points_basis_points as u64)
        .unwrap()
        .checked_div(10000)
        .unwrap();

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
    mint_to(cpi_ctx, reward_amount)?;

    Ok(())
}

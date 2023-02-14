// initialize reward points mint account for a merchant
use crate::*;

#[derive(Accounts)]
pub struct InitRewardPoints<'info> {
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

    // create mint to represent reward points for merchant
    #[account(
        init,
        seeds = [REWARD_POINTS_SEED.as_bytes(), merchant.key().as_ref()],
        bump,
        payer = authority,
        mint::decimals = 6,
        mint::authority = reward_points_mint,

    )]
    pub reward_points_mint: Account<'info, Mint>,

    // create metadata account for reward points mint
    /// CHECK: initialize metadata account for reward points mint via CPI to token-metadata program
    #[account(
        mut,
        address=find_metadata_account(&reward_points_mint.key()).0
    )]
    pub metadata_account: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn init_reward_points_handler(
    ctx: Context<InitRewardPoints>,
    reward_points_basis_points: u16,
    uri: String,
    name: String,
    symbol: String,
) -> Result<()> {
    // update merchant account with reward points mint and basis points
    ctx.accounts.merchant.reward_points_mint = ctx.accounts.reward_points_mint.key();
    ctx.accounts.merchant.reward_points_basis_points = reward_points_basis_points;

    // reward points mint PDA used to sign for metadata account creation CPI
    let merchant = ctx.accounts.merchant.key();
    let signer_seeds: &[&[&[u8]]] = &[&[
        REWARD_POINTS_SEED.as_bytes(),
        merchant.as_ref(),
        &[*ctx.bumps.get("reward_points_mint").unwrap()],
    ]];

    create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.reward_points_mint.to_account_info(),
                mint_authority: ctx.accounts.reward_points_mint.to_account_info(),
                update_authority: ctx.accounts.reward_points_mint.to_account_info(),
                payer: ctx.accounts.authority.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            &signer_seeds,
        ),
        DataV2 {
            name: name,
            symbol: symbol,
            uri: uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        },
        true,
        true,
        None,
    )?;

    Ok(())
}

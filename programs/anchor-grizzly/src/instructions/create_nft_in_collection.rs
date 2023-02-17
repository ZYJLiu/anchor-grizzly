// create merchant collection nft for nft loyalty program
// note this instruction requires requesting extra compute units
use crate::*;

#[derive(Accounts)]
pub struct CreateNftInCollection<'info> {
    #[account(mut)]
    pub customer: Signer<'info>,

    /// CHECK: Used for merchant account PDA seed
    pub authority: SystemAccount<'info>,

    // merchant account
    #[account(
        mut,
        seeds = [MERCHANT_SEED.as_bytes(), authority.key().as_ref()],
        bump,
        constraint = merchant.authority == authority.key()
    )]
    pub merchant: Account<'info, MerchantState>,

    // collection nft for merchant loyalty program
    #[account(
        mut,
        seeds = [LOYALTY_NFT_SEED.as_bytes(), merchant.key().as_ref()],
        bump,
        address = merchant.loyalty_collection_mint
    )]
    pub loyalty_collection_mint: Account<'info, Mint>,

    // collection metadata account
    /// CHECK:
    #[account(
        mut,
        address=find_metadata_account(&loyalty_collection_mint.key()).0
    )]
    pub collection_metadata_account: UncheckedAccount<'info>,

    /// CHECK: collection master edition account
    #[account(
        mut,
        address=find_master_edition_account(&loyalty_collection_mint.key()).0
    )]
    pub collection_master_edition: UncheckedAccount<'info>,

    #[account(
        init,
        seeds = [LOYALTY_NFT_SEED.as_bytes(), merchant.key().as_ref(), customer.key().as_ref()],
        bump,
        payer = customer,
        mint::decimals = 0,
        mint::authority = loyalty_collection_mint,
        mint::freeze_authority = loyalty_collection_mint
    )]
    pub customer_nft_mint: Account<'info, Mint>,

    // create customer metadata account for loyalty nft
    /// CHECK:
    #[account(
        mut,
        address=find_metadata_account(&customer_nft_mint.key()).0
    )]
    pub metadata_account: UncheckedAccount<'info>,

    /// CHECK: master edition account
    #[account(
        mut,
        address=find_master_edition_account(&customer_nft_mint.key()).0
    )]
    pub master_edition: UncheckedAccount<'info>,

    // token account for collection nft
    #[account(
        init_if_needed,
        payer = customer,
        associated_token::mint = customer_nft_mint,
        associated_token::authority = customer
    )]
    pub token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_nft_in_collection_handler(
    ctx: Context<CreateNftInCollection>,
    uri: String,
    name: String,
    symbol: String,
) -> Result<()> {
    // PDA for signing
    let merchant = ctx.accounts.merchant.key();
    let signer_seeds: &[&[&[u8]]] = &[&[
        LOYALTY_NFT_SEED.as_bytes(),
        merchant.as_ref(),
        &[*ctx.bumps.get("loyalty_collection_mint").unwrap()],
    ]];

    // mint 1 nft to customer token account
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.customer_nft_mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.loyalty_collection_mint.to_account_info(),
        },
        signer_seeds,
    );
    mint_to(cpi_ctx, 1)?;

    // create metadata account
    create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.customer_nft_mint.to_account_info(),
                mint_authority: ctx.accounts.loyalty_collection_mint.to_account_info(),
                update_authority: ctx.accounts.loyalty_collection_mint.to_account_info(),
                payer: ctx.accounts.customer.to_account_info(),
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

    // create master edition account
    create_master_edition_v3(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMasterEditionV3 {
                payer: ctx.accounts.customer.to_account_info(),
                mint: ctx.accounts.customer_nft_mint.to_account_info(),
                edition: ctx.accounts.master_edition.to_account_info(),
                mint_authority: ctx.accounts.loyalty_collection_mint.to_account_info(),
                update_authority: ctx.accounts.loyalty_collection_mint.to_account_info(),
                metadata: ctx.accounts.metadata_account.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            &signer_seeds,
        ),
        None,
    )?;

    set_and_verify_sized_collection_item(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            SetAndVerifySizedCollectionItem {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                collection_authority: ctx.accounts.loyalty_collection_mint.to_account_info(),
                payer: ctx.accounts.customer.to_account_info(),
                update_authority: ctx.accounts.loyalty_collection_mint.to_account_info(),
                collection_mint: ctx.accounts.loyalty_collection_mint.to_account_info(),
                collection_metadata: ctx.accounts.collection_metadata_account.to_account_info(),
                collection_master_edition: ctx.accounts.collection_master_edition.to_account_info(),
            },
            &signer_seeds,
        ),
        None,
    )?;

    Ok(())
}

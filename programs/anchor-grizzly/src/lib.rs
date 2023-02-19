use anchor_lang::{
    prelude::*,
    solana_program::{pubkey, pubkey::Pubkey},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3,
        set_and_verify_sized_collection_item, sign_metadata, CreateMasterEditionV3,
        CreateMetadataAccountsV3, Metadata, MetadataAccount, SetAndVerifySizedCollectionItem,
        SignMetadata,
    },
    token::{mint_to, transfer, Mint, MintTo, Token, TokenAccount, Transfer},
};
use mpl_token_metadata::{
    pda::{find_master_edition_account, find_metadata_account},
    state::{CollectionDetails, Creator, DataV2},
};

mod instructions;
use instructions::*;
mod state;
use state::*;

declare_id!("44scmiH8GNTAq9G7i3xQZ3Upg6juJVqwbPvjFG5ySZjn");

#[constant]
pub const USDC_MINT_PLACEHOLDER: Pubkey = pubkey!("1oveQg3XfAfY2Rw1SpwvTe5tVnaphWRXiNB9pcZE96c");
pub const MERCHANT_SEED: &str = "MERCHANT";
pub const REWARD_POINTS_SEED: &str = "REWARD_POINTS";
pub const LOYALTY_NFT_SEED: &str = "LOYALTY_NFT";

#[program]
pub mod anchor_grizzly {
    use super::*;

    pub fn init_merchant(ctx: Context<InitMerchant>) -> Result<()> {
        instructions::init_merchant_handler(ctx)
    }

    pub fn init_reward_points(
        ctx: Context<InitRewardPoints>,
        reward_points_basis_points: u16,
        uri: String,
        name: String,
        symbol: String,
    ) -> Result<()> {
        instructions::init_reward_points_handler(ctx, reward_points_basis_points, uri, name, symbol)
    }

    pub fn transaction(ctx: Context<Transaction>, amount: u64) -> Result<()> {
        instructions::transaction_handler(ctx, amount)
    }

    // create NFT, use as collection NFT
    pub fn create_collection_nft(
        ctx: Context<CreateCollectionNft>,
        loyalty_discount_basis_points: u16,
        uri: String,
        name: String,
        symbol: String,
    ) -> Result<()> {
        instructions::create_collection_nft_handler(
            ctx,
            loyalty_discount_basis_points,
            uri,
            name,
            symbol,
        )
    }

    // create NFT, use as collection NFT
    pub fn create_nft_in_collection(
        ctx: Context<CreateNftInCollection>,
        uri: String,
        name: String,
        symbol: String,
    ) -> Result<()> {
        instructions::create_nft_in_collection_handler(ctx, uri, name, symbol)
    }

    pub fn initialize(ctx: Context<Initialize>, data: u64) -> Result<()> {
        let optional_account = &mut ctx.accounts.new_account;

        if let Some(account) = optional_account {
            account.data = data;
            msg!("Changed data to: {}!", data); // Message will show up in the tx logs
        } else {
            msg!("Optional Account not provided"); // Message will show up in the tx logs
            msg!(
                "Value of ctx.accounts.new_account: {:?}",
                ctx.accounts.new_account
            );
        }
        Ok(())
    }

    pub fn token_metadata(ctx: Context<TokenMetadata>) -> Result<()> {
        msg!("{}", &ctx.accounts.metadata_account.data.name);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = signer, space = 8 + 8)]
    pub new_account: Option<Account<'info, NewAccount>>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TokenMetadata<'info> {
    #[account(
        seeds = [
            b"metadata",
            Metadata::id().as_ref(),
            mint.key().as_ref()
        ],
        seeds::program = Metadata::id(),
        bump,
    )]
    pub metadata_account: Account<'info, MetadataAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub signer: Signer<'info>,
}

#[derive(Debug)]
#[account]
pub struct NewAccount {
    data: u64,
}

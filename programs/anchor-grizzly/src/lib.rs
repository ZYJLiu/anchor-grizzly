use anchor_lang::{
    prelude::*,
    solana_program::{pubkey, pubkey::Pubkey},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3,
        set_and_verify_sized_collection_item, sign_metadata, CreateMasterEditionV3,
        CreateMetadataAccountsV3, Metadata, SetAndVerifySizedCollectionItem, SignMetadata,
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

declare_id!("4m2iCzvckHmiXf4bV4xHckVAE2tMNLt2GgUziSr7uTiF");

#[constant]
pub const USDC_MINT_PLACEHOLDER: Pubkey = pubkey!("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
// pub const USDC_MINT_PLACEHOLDER: Pubkey = pubkey!("1oveQg3XfAfY2Rw1SpwvTe5tVnaphWRXiNB9pcZE96c");
pub const MERCHANT_SEED: &str = "MERCHANT";
pub const REWARD_POINTS_SEED: &str = "REWARD_POINTS";
pub const LOYALTY_NFT_SEED: &str = "LOYALTY_NFT";

#[program]
pub mod anchor_grizzly {
    use super::*;

    // init merchant account
    pub fn init_merchant(ctx: Context<InitMerchant>) -> Result<()> {
        instructions::init_merchant_handler(ctx)
    }

    // init reward points mint
    pub fn init_reward_points(
        ctx: Context<InitRewardPoints>,
        reward_points_basis_points: u16,
        uri: String,
        name: String,
        symbol: String,
    ) -> Result<()> {
        instructions::init_reward_points_handler(ctx, reward_points_basis_points, uri, name, symbol)
    }

    // transfer usdc tokens from customer to merchant, mint reward points to customer
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

    // create NFT in collection
    pub fn create_nft_in_collection(
        ctx: Context<CreateNftInCollection>,
        uri: String,
        name: String,
        symbol: String,
    ) -> Result<()> {
        instructions::create_nft_in_collection_handler(ctx, uri, name, symbol)
    }

    // update reward points reward basis points (% minted at checkout)
    pub fn update_reward_points(
        ctx: Context<UpdateRewardPoints>,
        reward_points_basis_points: u16,
    ) -> Result<()> {
        instructions::update_reward_points_handler(ctx, reward_points_basis_points)
    }

    // update loyalty discount basis points (% discount at checkout for holding)
    pub fn update_loyalty_points(
        ctx: Context<UpdateLoyaltyPoints>,
        loyalty_discount_basis_points: u16,
    ) -> Result<()> {
        instructions::update_loyalty_points_handler(ctx, loyalty_discount_basis_points)
    }

    // mint reward points to customer, used for airdropping reward points to customers
    pub fn mint_reward_points(ctx: Context<MintRewardPoints>, amount: u64) -> Result<()> {
        instructions::mint_reward_points_handler(ctx, amount)
    }
}

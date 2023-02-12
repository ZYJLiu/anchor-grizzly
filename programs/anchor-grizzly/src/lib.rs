use anchor_lang::prelude::*;
use anchor_spl::{
    metadata::{Metadata, MetadataAccount},
    token::Mint,
};

declare_id!("7QjqmxnTCSn7kY64Zh8wpjCVmyx3MkHWgqs3ctYaQQAD");

#[program]
pub mod anchor_grizzly {
    use super::*;

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

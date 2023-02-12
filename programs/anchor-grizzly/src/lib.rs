use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

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
        }
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

#[account]
pub struct NewAccount {
    data: u64,
}

use crate::*;

#[account]
pub struct MerchantState {
    pub authority: Pubkey,               // 32
    pub payment_destination: Pubkey,     // 32
    pub reward_points_mint: Pubkey,      // 32
    pub reward_points_basis_points: u16, // 2
    pub loyalty_collection_mint: Pubkey, // 32
}

impl MerchantState {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 2 + 32;
}

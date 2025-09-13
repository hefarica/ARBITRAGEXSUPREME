// ArbitrageX Pro 2025 - Solana Arbitrage Program
// Implementación en Rust para Solana blockchain con Anchor framework
// Optimizado para Serum, Raydium, Orca, Jupiter, Meteora

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use pyth_sdk_solana::load_price_feed_from_account_info;

declare_id!("ArbitXPro2025SolanaArbitrageProgram11111111");

#[program]
pub mod solana_arbitrage {
    use super::*;

    /// Inicializa el programa de arbitraje para Solana
    pub fn initialize(ctx: Context<Initialize>, bump: u8) -> Result<()> {
        let arbitrage_state = &mut ctx.accounts.arbitrage_state;
        arbitrage_state.authority = ctx.accounts.authority.key();
        arbitrage_state.bump = bump;
        arbitrage_state.min_profit_bps = 25; // 0.25% para Solana (ultra rápido)
        arbitrage_state.max_slippage_bps = 50; // 0.5% max slippage
        arbitrage_state.is_paused = false;
        arbitrage_state.total_volume = 0;
        arbitrage_state.total_profit = 0;
        arbitrage_state.executed_trades = 0;
        
        msg!("Solana Arbitrage Program initialized successfully");
        Ok(())
    }

    /// Ejecuta arbitraje simple entre dos DEXs
    pub fn execute_simple_arbitrage(
        ctx: Context<ExecuteArbitrage>,
        token_a_amount: u64,
        min_token_b_amount: u64,
        route: ArbitrageRoute,
    ) -> Result<()> {
        let arbitrage_state = &mut ctx.accounts.arbitrage_state;
        require!(!arbitrage_state.is_paused, ErrorCode::ProgramPaused);

        // Validar que tenemos suficientes tokens
        require!(
            ctx.accounts.user_token_a_account.amount >= token_a_amount,
            ErrorCode::InsufficientBalance
        );

        let clock = Clock::get()?;
        let start_time = clock.unix_timestamp;

        // Primera swap: Token A -> Token B en DEX 1
        let first_swap_result = execute_swap_on_dex(
            &ctx.accounts,
            &route.first_dex,
            token_a_amount,
            min_token_b_amount,
            false, // A -> B
        )?;

        // Segunda swap: Token B -> Token A en DEX 2 (completar arbitraje)
        let second_swap_result = execute_swap_on_dex(
            &ctx.accounts,
            &route.second_dex,
            first_swap_result,
            token_a_amount, // Debe ser mayor para generar profit
            true, // B -> A
        )?;

        // Calcular profit
        let profit = second_swap_result.saturating_sub(token_a_amount);
        let min_profit = (token_a_amount * arbitrage_state.min_profit_bps as u64) / 10000;
        
        require!(profit >= min_profit, ErrorCode::InsufficientProfit);

        // Actualizar estadísticas
        arbitrage_state.total_volume = arbitrage_state.total_volume.saturating_add(token_a_amount);
        arbitrage_state.total_profit = arbitrage_state.total_profit.saturating_add(profit);
        arbitrage_state.executed_trades = arbitrage_state.executed_trades.saturating_add(1);

        let end_time = Clock::get()?.unix_timestamp;
        let execution_time = end_time - start_time;

        emit!(ArbitrageExecuted {
            user: ctx.accounts.authority.key(),
            token_a: ctx.accounts.token_a_mint.key(),
            token_b: ctx.accounts.token_b_mint.key(),
            amount_in: token_a_amount,
            amount_out: second_swap_result,
            profit,
            execution_time,
            first_dex: route.first_dex,
            second_dex: route.second_dex,
        });

        Ok(())
    }

    /// Ejecuta arbitraje triangular (A -> B -> C -> A)
    pub fn execute_triangular_arbitrage(
        ctx: Context<ExecuteTriangularArbitrage>,
        token_a_amount: u64,
        route: TriangularRoute,
    ) -> Result<()> {
        let arbitrage_state = &mut ctx.accounts.arbitrage_state;
        require!(!arbitrage_state.is_paused, ErrorCode::ProgramPaused);

        let clock = Clock::get()?;
        let start_time = clock.unix_timestamp;

        // Primera swap: A -> B
        let amount_b = execute_triangular_swap(
            &ctx.accounts,
            &route.first_swap,
            token_a_amount,
        )?;

        // Segunda swap: B -> C
        let amount_c = execute_triangular_swap(
            &ctx.accounts,
            &route.second_swap,
            amount_b,
        )?;

        // Tercera swap: C -> A (completar triángulo)
        let final_amount_a = execute_triangular_swap(
            &ctx.accounts,
            &route.third_swap,
            amount_c,
        )?;

        // Calcular profit
        let profit = final_amount_a.saturating_sub(token_a_amount);
        let min_profit = (token_a_amount * arbitrage_state.min_profit_bps as u64) / 10000;
        
        require!(profit >= min_profit, ErrorCode::InsufficientProfit);

        // Actualizar estadísticas
        arbitrage_state.total_volume = arbitrage_state.total_volume.saturating_add(token_a_amount);
        arbitrage_state.total_profit = arbitrage_state.total_profit.saturating_add(profit);
        arbitrage_state.executed_trades = arbitrage_state.executed_trades.saturating_add(1);

        let end_time = Clock::get()?.unix_timestamp;
        let execution_time = end_time - start_time;

        emit!(TriangularArbitrageExecuted {
            user: ctx.accounts.authority.key(),
            token_a: ctx.accounts.token_a_mint.key(),
            token_b: ctx.accounts.token_b_mint.key(),
            token_c: ctx.accounts.token_c_mint.key(),
            amount_in: token_a_amount,
            amount_out: final_amount_a,
            profit,
            execution_time,
        });

        Ok(())
    }

    /// Ejecuta arbitraje usando Jupiter aggregator
    pub fn execute_jupiter_arbitrage(
        ctx: Context<ExecuteJupiterArbitrage>,
        token_a_amount: u64,
        jupiter_route: JupiterRoute,
    ) -> Result<()> {
        let arbitrage_state = &mut ctx.accounts.arbitrage_state;
        require!(!arbitrage_state.is_paused, ErrorCode::ProgramPaused);

        // Usar Jupiter para encontrar la mejor ruta
        let swap_result = execute_jupiter_swap(
            &ctx.accounts,
            &jupiter_route,
            token_a_amount,
        )?;

        let profit = swap_result.saturating_sub(token_a_amount);
        let min_profit = (token_a_amount * arbitrage_state.min_profit_bps as u64) / 10000;
        
        require!(profit >= min_profit, ErrorCode::InsufficientProfit);

        // Actualizar estadísticas
        arbitrage_state.total_profit = arbitrage_state.total_profit.saturating_add(profit);
        arbitrage_state.executed_trades = arbitrage_state.executed_trades.saturating_add(1);

        emit!(JupiterArbitrageExecuted {
            user: ctx.accounts.authority.key(),
            amount_in: token_a_amount,
            amount_out: swap_result,
            profit,
            route_markets: jupiter_route.markets,
        });

        Ok(())
    }

    /// Actualiza configuración del programa
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_min_profit_bps: u16,
        new_max_slippage_bps: u16,
    ) -> Result<()> {
        let arbitrage_state = &mut ctx.accounts.arbitrage_state;
        
        require!(new_min_profit_bps >= 5 && new_min_profit_bps <= 200, ErrorCode::InvalidConfig);
        require!(new_max_slippage_bps >= 10 && new_max_slippage_bps <= 500, ErrorCode::InvalidConfig);
        
        arbitrage_state.min_profit_bps = new_min_profit_bps;
        arbitrage_state.max_slippage_bps = new_max_slippage_bps;
        
        msg!("Config updated: min_profit_bps={}, max_slippage_bps={}", 
             new_min_profit_bps, new_max_slippage_bps);
        Ok(())
    }

    /// Pausa/despausa el programa
    pub fn set_pause_state(ctx: Context<SetPauseState>, is_paused: bool) -> Result<()> {
        let arbitrage_state = &mut ctx.accounts.arbitrage_state;
        arbitrage_state.is_paused = is_paused;
        
        msg!("Program pause state set to: {}", is_paused);
        Ok(())
    }

    /// Retira tokens de emergencia
    pub fn emergency_withdraw(
        ctx: Context<EmergencyWithdraw>,
        amount: u64,
    ) -> Result<()> {
        let arbitrage_state = &ctx.accounts.arbitrage_state;
        let authority_key = arbitrage_state.authority;
        let bump = arbitrage_state.bump;

        let authority_seeds = &[
            ARBITRAGE_STATE_SEED.as_bytes(),
            authority_key.as_ref(),
            &[bump],
        ];
        let signer = &[&authority_seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.program_token_account.to_account_info(),
            to: ctx.accounts.authority_token_account.to_account_info(),
            authority: ctx.accounts.arbitrage_state.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::transfer(cpi_ctx, amount)?;

        msg!("Emergency withdrawal executed: {} tokens", amount);
        Ok(())
    }
}

// Helper functions

/// Ejecuta swap en un DEX específico
fn execute_swap_on_dex(
    accounts: &ExecuteArbitrage,
    dex_type: &DexType,
    amount_in: u64,
    min_amount_out: u64,
    reverse: bool,
) -> Result<u64> {
    match dex_type {
        DexType::Serum => execute_serum_swap(accounts, amount_in, min_amount_out, reverse),
        DexType::Raydium => execute_raydium_swap(accounts, amount_in, min_amount_out, reverse),
        DexType::Orca => execute_orca_swap(accounts, amount_in, min_amount_out, reverse),
        DexType::Meteora => execute_meteora_swap(accounts, amount_in, min_amount_out, reverse),
    }
}

/// Ejecuta swap en Serum DEX
fn execute_serum_swap(
    _accounts: &ExecuteArbitrage,
    amount_in: u64,
    _min_amount_out: u64,
    _reverse: bool,
) -> Result<u64> {
    // Implementación específica para Serum
    // Serum usa order book model
    msg!("Executing Serum swap with amount: {}", amount_in);
    
    // Placeholder - implementar lógica real de Serum
    let amount_out = (amount_in * 998) / 1000; // Simular 0.2% fee
    Ok(amount_out)
}

/// Ejecuta swap en Raydium AMM
fn execute_raydium_swap(
    _accounts: &ExecuteArbitrage,
    amount_in: u64,
    _min_amount_out: u64,
    _reverse: bool,
) -> Result<u64> {
    // Implementación específica para Raydium AMM
    msg!("Executing Raydium swap with amount: {}", amount_in);
    
    // Placeholder - implementar lógica real de Raydium
    let amount_out = (amount_in * 997) / 1000; // Simular 0.3% fee
    Ok(amount_out)
}

/// Ejecuta swap en Orca AMM
fn execute_orca_swap(
    _accounts: &ExecuteArbitrage,
    amount_in: u64,
    _min_amount_out: u64,
    _reverse: bool,
) -> Result<u64> {
    // Implementación específica para Orca
    msg!("Executing Orca swap with amount: {}", amount_in);
    
    // Placeholder - implementar lógica real de Orca
    let amount_out = (amount_in * 9975) / 10000; // Simular 0.25% fee
    Ok(amount_out)
}

/// Ejecuta swap en Meteora
fn execute_meteora_swap(
    _accounts: &ExecuteArbitrage,
    amount_in: u64,
    _min_amount_out: u64,
    _reverse: bool,
) -> Result<u64> {
    // Implementación específica para Meteora
    msg!("Executing Meteora swap with amount: {}", amount_in);
    
    // Placeholder - implementar lógica real de Meteora
    let amount_out = (amount_in * 999) / 1000; // Simular 0.1% fee
    Ok(amount_out)
}

/// Ejecuta swap triangular individual
fn execute_triangular_swap(
    _accounts: &ExecuteTriangularArbitrage,
    swap_info: &SwapInfo,
    amount_in: u64,
) -> Result<u64> {
    msg!("Executing triangular swap: {:?} with amount: {}", swap_info.dex_type, amount_in);
    
    // Implementar lógica específica según el DEX
    let amount_out = match swap_info.dex_type {
        DexType::Serum => (amount_in * 998) / 1000,
        DexType::Raydium => (amount_in * 997) / 1000,
        DexType::Orca => (amount_in * 9975) / 10000,
        DexType::Meteora => (amount_in * 999) / 1000,
    };
    
    Ok(amount_out)
}

/// Ejecuta swap usando Jupiter aggregator
fn execute_jupiter_swap(
    _accounts: &ExecuteJupiterArbitrage,
    jupiter_route: &JupiterRoute,
    amount_in: u64,
) -> Result<u64> {
    msg!("Executing Jupiter aggregated swap with {} markets", jupiter_route.markets.len());
    
    // Jupiter encuentra automáticamente la mejor ruta
    // Placeholder - implementar integración real con Jupiter
    let amount_out = (amount_in * 9985) / 10000; // Simular mejor pricing via Jupiter
    Ok(amount_out)
}

// Account structs

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = ArbitrageState::LEN,
        seeds = [ARBITRAGE_STATE_SEED.as_bytes(), authority.key().as_ref()],
        bump
    )]
    pub arbitrage_state: Account<'info, ArbitrageState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteArbitrage<'info> {
    #[account(
        mut,
        seeds = [ARBITRAGE_STATE_SEED.as_bytes(), authority.key().as_ref()],
        bump = arbitrage_state.bump
    )]
    pub arbitrage_state: Account<'info, ArbitrageState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// Token A mint
    pub token_a_mint: Account<'info, anchor_spl::token::Mint>,
    /// Token B mint
    pub token_b_mint: Account<'info, anchor_spl::token::Mint>,
    
    /// User's token A account
    #[account(mut)]
    pub user_token_a_account: Account<'info, TokenAccount>,
    /// User's token B account
    #[account(mut)]
    pub user_token_b_account: Account<'info, TokenAccount>,
    
    /// Program's token A account
    #[account(mut)]
    pub program_token_a_account: Account<'info, TokenAccount>,
    /// Program's token B account
    #[account(mut)]
    pub program_token_b_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ExecuteTriangularArbitrage<'info> {
    #[account(
        mut,
        seeds = [ARBITRAGE_STATE_SEED.as_bytes(), authority.key().as_ref()],
        bump = arbitrage_state.bump
    )]
    pub arbitrage_state: Account<'info, ArbitrageState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// Token mints
    pub token_a_mint: Account<'info, anchor_spl::token::Mint>,
    pub token_b_mint: Account<'info, anchor_spl::token::Mint>,
    pub token_c_mint: Account<'info, anchor_spl::token::Mint>,
    
    /// User token accounts
    #[account(mut)]
    pub user_token_a_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_b_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_c_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ExecuteJupiterArbitrage<'info> {
    #[account(
        mut,
        seeds = [ARBITRAGE_STATE_SEED.as_bytes(), authority.key().as_ref()],
        bump = arbitrage_state.bump
    )]
    pub arbitrage_state: Account<'info, ArbitrageState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// Jupiter program and accounts
    /// CHECK: Jupiter program validation
    pub jupiter_program: UncheckedAccount<'info>,
    
    /// Token accounts for Jupiter swap
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub destination_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [ARBITRAGE_STATE_SEED.as_bytes(), authority.key().as_ref()],
        bump = arbitrage_state.bump,
        has_one = authority
    )]
    pub arbitrage_state: Account<'info, ArbitrageState>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetPauseState<'info> {
    #[account(
        mut,
        seeds = [ARBITRAGE_STATE_SEED.as_bytes(), authority.key().as_ref()],
        bump = arbitrage_state.bump,
        has_one = authority
    )]
    pub arbitrage_state: Account<'info, ArbitrageState>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(
        mut,
        seeds = [ARBITRAGE_STATE_SEED.as_bytes(), authority.key().as_ref()],
        bump = arbitrage_state.bump,
        has_one = authority
    )]
    pub arbitrage_state: Account<'info, ArbitrageState>,
    
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub program_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

// State accounts

#[account]
pub struct ArbitrageState {
    pub authority: Pubkey,
    pub bump: u8,
    pub min_profit_bps: u16,
    pub max_slippage_bps: u16,
    pub is_paused: bool,
    pub total_volume: u64,
    pub total_profit: u64,
    pub executed_trades: u64,
    pub reserved: [u8; 64], // Para futuras extensiones
}

impl ArbitrageState {
    pub const LEN: usize = 8 + 32 + 1 + 2 + 2 + 1 + 8 + 8 + 8 + 64;
}

// Data structures

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ArbitrageRoute {
    pub first_dex: DexType,
    pub second_dex: DexType,
    pub slippage_tolerance: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TriangularRoute {
    pub first_swap: SwapInfo,
    pub second_swap: SwapInfo,
    pub third_swap: SwapInfo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SwapInfo {
    pub dex_type: DexType,
    pub market_address: Pubkey,
    pub slippage_tolerance: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct JupiterRoute {
    pub markets: Vec<Pubkey>,
    pub slippage_bps: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum DexType {
    Serum,
    Raydium,
    Orca,
    Meteora,
}

// Events

#[event]
pub struct ArbitrageExecuted {
    pub user: Pubkey,
    pub token_a: Pubkey,
    pub token_b: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub profit: u64,
    pub execution_time: i64,
    pub first_dex: DexType,
    pub second_dex: DexType,
}

#[event]
pub struct TriangularArbitrageExecuted {
    pub user: Pubkey,
    pub token_a: Pubkey,
    pub token_b: Pubkey,
    pub token_c: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub profit: u64,
    pub execution_time: i64,
}

#[event]
pub struct JupiterArbitrageExecuted {
    pub user: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub profit: u64,
    pub route_markets: Vec<Pubkey>,
}

// Error codes

#[error_code]
pub enum ErrorCode {
    #[msg("Program is currently paused")]
    ProgramPaused,
    #[msg("Insufficient token balance")]
    InsufficientBalance,
    #[msg("Profit below minimum threshold")]
    InsufficientProfit,
    #[msg("Invalid configuration parameters")]
    InvalidConfig,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Invalid DEX type")]
    InvalidDexType,
    #[msg("Market not found")]
    MarketNotFound,
    #[msg("Unauthorized access")]
    Unauthorized,
}

// Constants

pub const ARBITRAGE_STATE_SEED: &str = "arbitrage_state";
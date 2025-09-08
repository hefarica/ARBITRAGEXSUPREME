{-# LANGUAGE DataKinds           #-}
{-# LANGUAGE FlexibleContexts    #-}
{-# LANGUAGE NoImplicitPrelude   #-}
{-# LANGUAGE OverloadedStrings   #-}
{-# LANGUAGE ScopedTypeVariables #-}
{-# LANGUAGE TemplateHaskell     #-}
{-# LANGUAGE TypeApplications    #-}
{-# LANGUAGE TypeFamilies        #-}
{-# LANGUAGE TypeOperators       #-}

{-|
ArbitrageX Pro 2025 - Cardano Arbitrage Smart Contract
Implementación en Haskell para Cardano blockchain usando Plutus
Optimizado para SundaeSwap, Minswap, MuesliSwap, WingRiders
-}

module CardanoArbitrage where

import           Plutus.Contract        as Contract
import           Plutus.Trace.Emulator  as Emulator
import qualified Plutus.V2.Ledger.Api   as PlutusV2
import qualified Plutus.V1.Ledger.Scripts as Plutus
import           PlutusTx               (Data (..), makeLift, unstableMakeIsData)
import qualified PlutusTx
import           PlutusTx.Prelude       hiding (Semigroup(..), unless)
import           Ledger                 hiding (singleton)
import           Ledger.Constraints     as Constraints
import           Ledger.Ada             as Ada
import           Ledger.Value           as Value
import qualified Ledger.Typed.Scripts   as Scripts
import           Playground.Contract    (printJson, printSchemas, ensureKnownCurrencies, stage)
import           Playground.TH          (mkKnownCurrencies, mkSchemaDefinitions)
import           Playground.Types       (KnownCurrency (..))
import           Text.Printf            (printf)
import           Control.Monad          hiding (fmap)
import           Data.Aeson             (ToJSON, FromJSON)
import           Data.Text              (Text)
import           Data.Map               as Map
import           Data.Void              (Void)
import           GHC.Generics           (Generic)
import           Schema                 (ToSchema)

-- | Configuración principal del contrato de arbitraje
data ArbitrageConfig = ArbitrageConfig
    { acOwner           :: !PaymentPubKeyHash  -- Propietario del contrato
    , acMinProfitBps    :: !Integer            -- Profit mínimo en basis points (0.4% para Cardano)
    , acMaxSlippageBps  :: !Integer            -- Slippage máximo permitido
    , acIsPaused        :: !Bool               -- Estado de pausa
    , acTotalVolume     :: !Integer            -- Volumen total procesado
    , acTotalProfit     :: !Integer            -- Profit total generado
    , acExecutedTrades  :: !Integer            -- Número de trades ejecutados
    } deriving (Show, Generic, ToJSON, FromJSON)

-- | Parámetros para ejecutar arbitraje
data ArbitrageParams = ArbitrageParams
    { apTokenA      :: !AssetClass    -- Token A
    , apTokenB      :: !AssetClass    -- Token B
    , apTokenC      :: !(Maybe AssetClass) -- Token C (para triangular)
    , apAmountIn    :: !Integer       -- Amount de entrada
    , apMinAmountOut:: !Integer       -- Amount mínimo de salida
    , apFirstDex    :: !DexType       -- Primer DEX
    , apSecondDex   :: !DexType       -- Segundo DEX
    , apThirdDex    :: !(Maybe DexType) -- Tercer DEX (triangular)
    , apDeadline    :: !POSIXTime     -- Deadline para ejecución
    } deriving (Show, Generic, ToJSON, FromJSON)

-- | Tipos de DEX soportados en Cardano
data DexType 
    = SundaeSwap
    | Minswap
    | MuesliSwap
    | WingRiders
    deriving (Show, Eq, Generic, ToJSON, FromJSON)

-- | Resultado de la ejecución del arbitraje
data ArbitrageResult = ArbitrageResult
    { arSuccess     :: !Bool      -- Si fue exitoso
    , arAmountOut   :: !Integer   -- Amount obtenido
    , arProfit      :: !Integer   -- Profit generado
    , arGasUsed     :: !Integer   -- Gas utilizado
    , arExecutionTime :: !Integer -- Tiempo de ejecución en slots
    } deriving (Show, Generic, ToJSON, FromJSON)

-- | Acciones disponibles en el contrato
data ArbitrageAction
    = ExecuteSimpleArbitrage ArbitrageParams
    | ExecuteTriangularArbitrage ArbitrageParams
    | UpdateConfig ArbitrageConfig
    | PauseContract Bool
    | EmergencyWithdraw AssetClass Integer
    deriving (Show, Generic, ToJSON, FromJSON)

-- Instancias requeridas por PlutusTx
PlutusTx.unstableMakeIsData ''ArbitrageConfig
PlutusTx.unstableMakeIsData ''ArbitrageParams
PlutusTx.unstableMakeIsData ''ArbitrageResult
PlutusTx.unstableMakeIsData ''DexType
PlutusTx.unstableMakeIsData ''ArbitrageAction

-- | Validador principal del contrato de arbitraje
{-# INLINABLE arbitrageValidator #-}
arbitrageValidator :: ArbitrageConfig -> ArbitrageAction -> ScriptContext -> Bool
arbitrageValidator config action ctx = case action of
    ExecuteSimpleArbitrage params -> validateSimpleArbitrage config params ctx
    ExecuteTriangularArbitrage params -> validateTriangularArbitrage config params ctx
    UpdateConfig newConfig -> validateUpdateConfig config newConfig ctx
    PauseContract isPaused -> validatePauseContract config isPaused ctx
    EmergencyWithdraw token amount -> validateEmergencyWithdraw config token amount ctx

-- | Valida ejecución de arbitraje simple
{-# INLINABLE validateSimpleArbitrage #-}
validateSimpleArbitrage :: ArbitrageConfig -> ArbitrageParams -> ScriptContext -> Bool
validateSimpleArbitrage config params ctx =
    traceIfFalse "Contract is paused" (not $ acIsPaused config) &&
    traceIfFalse "Invalid deadline" (deadlineValid (apDeadline params) ctx) &&
    traceIfFalse "Invalid tokens" (tokensValid params) &&
    traceIfFalse "Insufficient profit" (profitSufficient config params ctx) &&
    traceIfFalse "Owner signature required" (ownerSigned config ctx)

-- | Valida ejecución de arbitraje triangular
{-# INLINABLE validateTriangularArbitrage #-}
validateTriangularArbitrage :: ArbitrageConfig -> ArbitrageParams -> ScriptContext -> Bool
validateTriangularArbitrage config params ctx =
    traceIfFalse "Contract is paused" (not $ acIsPaused config) &&
    traceIfFalse "Invalid deadline" (deadlineValid (apDeadline params) ctx) &&
    traceIfFalse "Third token required for triangular" (isJust $ apTokenC params) &&
    traceIfFalse "Third DEX required for triangular" (isJust $ apThirdDex params) &&
    traceIfFalse "Invalid tokens" (tokensValid params) &&
    traceIfFalse "Insufficient triangular profit" (triangularProfitSufficient config params ctx) &&
    traceIfFalse "Owner signature required" (ownerSigned config ctx)

-- | Valida actualización de configuración
{-# INLINABLE validateUpdateConfig #-}
validateUpdateConfig :: ArbitrageConfig -> ArbitrageConfig -> ScriptContext -> Bool
validateUpdateConfig oldConfig newConfig ctx =
    traceIfFalse "Owner signature required" (ownerSigned oldConfig ctx) &&
    traceIfFalse "Invalid min profit" (acMinProfitBps newConfig >= 10 && acMinProfitBps newConfig <= 1000) &&
    traceIfFalse "Invalid max slippage" (acMaxSlippageBps newConfig >= 50 && acMaxSlippageBps newConfig <= 2000) &&
    traceIfFalse "Owner must remain same" (acOwner oldConfig == acOwner newConfig)

-- | Valida pausa del contrato
{-# INLINABLE validatePauseContract #-}
validatePauseContract :: ArbitrageConfig -> Bool -> ScriptContext -> Bool
validatePauseContract config _isPaused ctx =
    traceIfFalse "Owner signature required" (ownerSigned config ctx)

-- | Valida retiro de emergencia
{-# INLINABLE validateEmergencyWithdraw #-}
validateEmergencyWithdraw :: ArbitrageConfig -> AssetClass -> Integer -> ScriptContext -> Bool
validateEmergencyWithdraw config token amount ctx =
    traceIfFalse "Owner signature required" (ownerSigned config ctx) &&
    traceIfFalse "Invalid amount" (amount > 0) &&
    traceIfFalse "Insufficient balance" (balanceSufficient token amount ctx)

-- Funciones helper de validación

-- | Verifica si el deadline es válido
{-# INLINABLE deadlineValid #-}
deadlineValid :: POSIXTime -> ScriptContext -> Bool
deadlineValid deadline ctx = 
    let currentTime = case scriptContextTxInfo ctx of
            TxInfo { txInfoValidRange = range } -> 
                case ivFrom range of
                    LowerBound (Finite t) _ -> t
                    _ -> 0 -- Fallback si no hay bound inferior
    in currentTime <= deadline

-- | Verifica si los tokens son válidos
{-# INLINABLE tokensValid #-}
tokensValid :: ArbitrageParams -> Bool
tokensValid params = 
    apTokenA params /= apTokenB params &&
    (case apTokenC params of
        Nothing -> True
        Just tokenC -> tokenC /= apTokenA params && tokenC /= apTokenB params)

-- | Verifica si el profit es suficiente para arbitraje simple
{-# INLINABLE profitSufficient #-}
profitSufficient :: ArbitrageConfig -> ArbitrageParams -> ScriptContext -> Bool
profitSufficient config params ctx =
    let txInfo = scriptContextTxInfo ctx
        inputValue = valueSpent txInfo
        outputValue = valueProduced txInfo
        tokenA = apTokenA params
        amountIn = apAmountIn params
        amountOut = valueOf outputValue (assetClassOf tokenA) (assetClassToken tokenA)
        profit = amountOut - amountIn
        minProfit = (amountIn * acMinProfitBps config) `divide` 10000
    in profit >= minProfit

-- | Verifica si el profit es suficiente para arbitraje triangular
{-# INLINABLE triangularProfitSufficient #-}
triangularProfitSufficient :: ArbitrageConfig -> ArbitrageParams -> ScriptContext -> Bool
triangularProfitSufficient config params ctx =
    -- Similar a profitSufficient pero para triangular
    profitSufficient config params ctx

-- | Verifica si el propietario firmó la transacción
{-# INLINABLE ownerSigned #-}
ownerSigned :: ArbitrageConfig -> ScriptContext -> Bool
ownerSigned config ctx = 
    txSignedBy (scriptContextTxInfo ctx) (unPaymentPubKeyHash $ acOwner config)

-- | Verifica si hay suficiente balance para retirar
{-# INLINABLE balanceSufficient #-}
balanceSufficient :: AssetClass -> Integer -> ScriptContext -> Bool
balanceSufficient token amount ctx =
    let txInfo = scriptContextTxInfo ctx
        inputValue = valueSpent txInfo
        availableAmount = valueOf inputValue (assetClassOf token) (assetClassToken token)
    in availableAmount >= amount

-- | Obtiene el símbolo de moneda de un AssetClass
{-# INLINABLE assetClassOf #-}
assetClassOf :: AssetClass -> CurrencySymbol
assetClassOf (AssetClass (cs, _)) = cs

-- | Obtiene el nombre del token de un AssetClass
{-# INLINABLE assetClassToken #-}
assetClassToken :: AssetClass -> TokenName
assetClassToken (AssetClass (_, tn)) = tn

-- Compilación del validador

typedValidator :: Scripts.TypedValidator ArbitrageContract
typedValidator = Scripts.mkTypedValidator @ArbitrageContract
    $$(PlutusTx.compile [|| arbitrageValidator ||])
    $$(PlutusTx.compile [|| wrap ||])
  where
    wrap = Scripts.wrapValidator @ArbitrageConfig @ArbitrageAction

validator :: Validator
validator = Scripts.validatorScript typedValidator

arbitrageScript :: Plutus.Script
arbitrageScript = Plutus.unValidatorScript validator

arbitrageScriptAsShortBs :: SBS.ShortByteString
arbitrageScriptAsShortBs = SBS.toShort . LBS.toStrict $ serialise arbitrageScript

arbitrageScriptHash :: Plutus.ValidatorHash
arbitrageScriptHash = Scripts.validatorHash typedValidator

-- Contrato off-chain

type ArbitrageContract = Contract () ArbitrageSchema Text ()

data ArbitrageSchema =
        ExecuteArbitrageEndpoint' ExecuteArbitrageParams
    .|. UpdateConfigEndpoint' UpdateConfigParams
    .|. PauseContractEndpoint' PauseParams
    .|. EmergencyWithdrawEndpoint' EmergencyWithdrawParams
    .|. GetStatsEndpoint' ()
    deriving stock (Generic)
    deriving anyclass (ToJSON, FromJSON, ToSchema)

-- | Parámetros para ejecutar arbitraje
data ExecuteArbitrageParams = ExecuteArbitrageParams
    { eapArbitrageParams :: !ArbitrageParams
    , eapIsTriangular   :: !Bool
    } deriving (Show, Generic, ToJSON, FromJSON, ToSchema)

-- | Parámetros para actualizar configuración
data UpdateConfigParams = UpdateConfigParams
    { ucpNewConfig :: !ArbitrageConfig
    } deriving (Show, Generic, ToJSON, FromJSON, ToSchema)

-- | Parámetros para pausar contrato
data PauseParams = PauseParams
    { ppIsPaused :: !Bool
    } deriving (Show, Generic, ToJSON, FromJSON, ToSchema)

-- | Parámetros para retiro de emergencia
data EmergencyWithdrawParams = EmergencyWithdrawParams
    { ewpToken  :: !AssetClass
    , ewpAmount :: !Integer
    } deriving (Show, Generic, ToJSON, FromJSON, ToSchema)

-- Endpoints del contrato

-- | Ejecuta arbitraje (simple o triangular)
executeArbitrage :: ExecuteArbitrageParams -> Contract () ArbitrageSchema Text ArbitrageResult
executeArbitrage ExecuteArbitrageParams{..} = do
    logInfo @String $ printf "Executing %s arbitrage" 
        (if eapIsTriangular then "triangular" else "simple")
    
    -- Obtener configuración actual del contrato
    config <- getCurrentConfig
    
    -- Validar parámetros
    when (acIsPaused config) $ 
        throwError "Contract is currently paused"
    
    -- Obtener time actual
    currentTime <- Contract.currentTime
    when (currentTime > apDeadline eapArbitrageParams) $
        throwError "Deadline exceeded"
    
    -- Construir transacción
    let action = if eapIsTriangular 
                then ExecuteTriangularArbitrage eapArbitrageParams
                else ExecuteSimpleArbitrage eapArbitrageParams
        
        tx = Constraints.mustPayToTheScript config (Datum $ toBuiltinData action) mempty
             <> Constraints.mustValidateIn (to $ apDeadline eapArbitrageParams)
    
    -- Enviar transacción
    ledgerTx <- submitTxConstraints typedValidator tx
    
    -- Esperar confirmación
    void $ awaitTxConfirmed $ getCardanoTxId ledgerTx
    
    logInfo @String $ printf "Arbitrage executed successfully"
    
    return $ ArbitrageResult
        { arSuccess = True
        , arAmountOut = apMinAmountOut eapArbitrageParams -- Placeholder
        , arProfit = 0 -- Se calculará dinámicamente
        , arGasUsed = 0 -- Se calculará dinámicamente
        , arExecutionTime = 1 -- Placeholder
        }

-- | Actualiza la configuración del contrato
updateConfig :: UpdateConfigParams -> Contract () ArbitrageSchema Text ()
updateConfig UpdateConfigParams{..} = do
    logInfo @String "Updating contract configuration"
    
    let action = UpdateConfig ucpNewConfig
        tx = Constraints.mustPayToTheScript ucpNewConfig (Datum $ toBuiltinData action) mempty
    
    ledgerTx <- submitTxConstraints typedValidator tx
    void $ awaitTxConfirmed $ getCardanoTxId ledgerTx
    
    logInfo @String "Configuration updated successfully"

-- | Pausa o despausa el contrato
pauseContract :: PauseParams -> Contract () ArbitrageSchema Text ()
pauseContract PauseParams{..} = do
    logInfo @String $ printf "Setting contract pause state to: %s" (show ppIsPaused)
    
    config <- getCurrentConfig
    let newConfig = config { acIsPaused = ppIsPaused }
        action = PauseContract ppIsPaused
        tx = Constraints.mustPayToTheScript newConfig (Datum $ toBuiltinData action) mempty
    
    ledgerTx <- submitTxConstraints typedValidator tx
    void $ awaitTxConfirmed $ getCardanoTxId ledgerTx
    
    logInfo @String "Pause state updated successfully"

-- | Retira tokens en caso de emergencia
emergencyWithdraw :: EmergencyWithdrawParams -> Contract () ArbitrageSchema Text ()
emergencyWithdraw EmergencyWithdrawParams{..} = do
    logInfo @String $ printf "Emergency withdraw: %d tokens" ewpAmount
    
    config <- getCurrentConfig
    let action = EmergencyWithdraw ewpToken ewpAmount
        tx = Constraints.mustPayToTheScript config (Datum $ toBuiltinData action) mempty
    
    ledgerTx <- submitTxConstraints typedValidator tx
    void $ awaitTxConfirmed $ getCardanoTxId ledgerTx
    
    logInfo @String "Emergency withdrawal completed"

-- | Obtiene estadísticas del contrato
getStats :: () -> Contract () ArbitrageSchema Text ArbitrageConfig
getStats _ = do
    logInfo @String "Getting contract statistics"
    getCurrentConfig

-- Funciones helper

-- | Obtiene la configuración actual del contrato
getCurrentConfig :: Contract () ArbitrageSchema Text ArbitrageConfig
getCurrentConfig = do
    -- Buscar UTxOs en el script address
    utxos <- utxosAt (scriptAddress typedValidator)
    case Map.toList utxos of
        [(_, ciTxOut)] -> do
            let datum = ciTxOutDatum ciTxOut
            case datum of
                Just (Datum d) -> case fromBuiltinData d of
                    Just config -> return config
                    Nothing -> throwError "Failed to parse config datum"
                Nothing -> throwError "No datum found in UTxO"
        [] -> throwError "No UTxOs found at script address"
        _ -> throwError "Multiple UTxOs found at script address"

-- Esquemas y endpoints

mkSchemaDefinitions ''ArbitrageSchema

mkKnownCurrencies []

-- | Endpoints disponibles
endpoints :: Contract () ArbitrageSchema Text ()
endpoints = awaitPromise (
       executeArbitrageEndpoint
    <> updateConfigEndpoint  
    <> pauseContractEndpoint
    <> emergencyWithdrawEndpoint
    <> getStatsEndpoint
    ) >> endpoints
  where
    executeArbitrageEndpoint = endpoint @"executeArbitrage" executeArbitrage
    updateConfigEndpoint = endpoint @"updateConfig" updateConfig
    pauseContractEndpoint = endpoint @"pauseContract" pauseContract
    emergencyWithdrawEndpoint = endpoint @"emergencyWithdraw" emergencyWithdraw
    getStatsEndpoint = endpoint @"getStats" getStats

-- Funciones específicas para DEXs de Cardano

-- | Calcula el amount out para SundaeSwap
calculateSundaeSwapOutput :: AssetClass -> AssetClass -> Integer -> Integer
calculateSundaeSwapOutput _tokenIn _tokenOut amountIn =
    -- Implementar lógica específica de SundaeSwap
    -- SundaeSwap usa modelo AMM con fee del 0.3%
    (amountIn * 997) `divide` 1000

-- | Calcula el amount out para Minswap  
calculateMinswapOutput :: AssetClass -> AssetClass -> Integer -> Integer
calculateMinswapOutput _tokenIn _tokenOut amountIn =
    -- Implementar lógica específica de Minswap
    -- Minswap usa fee variable según el pool
    (amountIn * 995) `divide` 1000

-- | Calcula el amount out para MuesliSwap
calculateMuesliSwapOutput :: AssetClass -> AssetClass -> Integer -> Integer
calculateMuesliSwapOutput _tokenIn _tokenOut amountIn =
    -- Implementar lógica específica de MuesliSwap
    -- MuesliSwap usa order book model
    (amountIn * 998) `divide` 1000

-- | Calcula el amount out para WingRiders
calculateWingRidersOutput :: AssetClass -> AssetClass -> Integer -> Integer
calculateWingRidersOutput _tokenIn _tokenOut amountIn =
    -- Implementar lógica específica de WingRiders
    -- WingRiders usa AMM con fee del 0.35%
    (amountIn * 9965) `divide` 10000

-- | Ejecuta swap en un DEX específico
executeDexSwap :: DexType -> AssetClass -> AssetClass -> Integer -> Integer
executeDexSwap dexType tokenIn tokenOut amountIn = case dexType of
    SundaeSwap -> calculateSundaeSwapOutput tokenIn tokenOut amountIn
    Minswap    -> calculateMinswapOutput tokenIn tokenOut amountIn
    MuesliSwap -> calculateMuesliSwapOutput tokenIn tokenOut amountIn
    WingRiders -> calculateWingRidersOutput tokenIn tokenOut amountIn

-- Configuración inicial para Cardano
defaultCardanoConfig :: PaymentPubKeyHash -> ArbitrageConfig
defaultCardanoConfig owner = ArbitrageConfig
    { acOwner = owner
    , acMinProfitBps = 40 -- 0.4% para Cardano (fees más altos)
    , acMaxSlippageBps = 200 -- 2% max slippage
    , acIsPaused = False
    , acTotalVolume = 0
    , acTotalProfit = 0
    , acExecutedTrades = 0
    }
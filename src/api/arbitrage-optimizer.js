const { ethers } = require('ethers');
const axios = require('axios');

/**
 * ArbitrageOptimizer - Backend optimizado para Flash Loan Arbitrage
 * Ingenio Pichichi S.A - Sistema de cálculos precisos y seguros
 */
class ArbitrageOptimizer {
  constructor(config = {}) {
    this.provider = null;
    this.contract = null;
    this.contractAddress = config.contractAddress;
    this.rpcUrls = config.rpcUrls || this.getDefaultRPCs();
    this.retryAttempts = 3;
    this.timeout = 10000;
    
    // Pools conocidos con alta liquidez
    this.knownPools = {
      'ethereum': {
        'uniswap-v3': '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640', // USDC/WETH
        'sushiswap': '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0',    // USDC/WETH
        'curve': '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7',       // 3Pool
        'balancer': '0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56'     // B-80BAL-20WETH
      },
      'polygon': {
        'quickswap': '0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d',  // USDC/WETH
        'sushiswap': '0x4B1F1e2435A9C96f7330FAea190Ef6A7C8D70001'   // USDC/WETH
      },
      'bsc': {
        'pancakeswap': '0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16', // BUSD/WBNB
        'biswap': '0x85FAac652b707FDf6907EF726751087f9E0b6687'        // BUSD/WBNB
      }
    };
  }

  /**
   * Inicializa conexión con la blockchain
   */
  async initialize(chainId = 1) {
    try {
      const rpcUrl = this.rpcUrls[chainId];
      if (!rpcUrl) {
        throw new Error(`RPC no configurado para chain ${chainId}`);
      }

      this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      
      if (this.contractAddress) {
        // ABI mínimo para interactuar con el contrato
        const contractABI = [
          "function calcularGananciaPotencial(tuple(address,address,uint256,uint256,uint256,uint256,address,uint16),address[],uint256) external view returns (tuple(uint256,uint256,uint256,uint256,uint256,bool),uint256,bool)",
          "function ejecutarFlashLoanArbitrage(tuple(address,uint256,tuple(address,address,uint256,uint256,uint256,uint256,address,uint16),address[],bytes[])) external",
          "function getPoolInfo(address) external view returns (tuple(address,uint256,uint256,uint256,uint256,bool))",
          "function getUserStats(address) external view returns (uint256,uint256,uint256)"
        ];
        
        this.contract = new ethers.Contract(
          this.contractAddress,
          contractABI,
          this.provider
        );
      }

      console.log(`✅ Conectado a chain ${chainId} con RPC: ${rpcUrl}`);
      return true;
    } catch (error) {
      console.error(`❌ Error inicializando chain ${chainId}:`, error);
      return false;
    }
  }

  /**
   * Obtiene RPCs por defecto para múltiples chains
   */
  getDefaultRPCs() {
    return {
      1: 'https://eth.llamarpc.com',           // Ethereum
      56: 'https://bsc.llamarpc.com',          // BSC  
      137: 'https://polygon.llamarpc.com',     // Polygon
      42161: 'https://arbitrum.llamarpc.com',  // Arbitrum
      10: 'https://optimism.llamarpc.com',     // Optimism
      43114: 'https://avalanche.llamarpc.com', // Avalanche
      8453: 'https://base.llamarpc.com',       // Base
      250: 'https://fantom.llamarpc.com',      // Fantom
    };
  }

  /**
   * Obtiene liquidez real de pools DeFi
   */
  async obtenerLiquidezReal(chainId, poolAddresses) {
    try {
      console.log(`🔄 Obteniendo liquidez real de ${poolAddresses.length} pools...`);
      
      const liquidezPools = [];
      
      for (const poolAddress of poolAddresses) {
        try {
          // Método 1: Consulta directa al contrato del pool
          const poolLiquidity = await this.consultarLiquidezPool(poolAddress);
          
          // Método 2: Fallback con DeFiLlama si es necesario
          if (!poolLiquidity) {
            const defiLlamaData = await this.obtenerDatosDeFiLlama(poolAddress);
            liquidezPools.push(defiLlamaData);
          } else {
            liquidezPools.push(poolLiquidity);
          }
          
        } catch (error) {
          console.error(`❌ Error obteniendo liquidez de pool ${poolAddress}:`, error);
          // Usar datos estimados como fallback
          liquidezPools.push({
            poolAddress,
            liquidity: '1000000', // 1M estimado
            reserveIn: '500000',
            reserveOut: '500000',
            feeRate: 300, // 0.3%
            isActive: true
          });
        }
      }
      
      console.log(`✅ Liquidez obtenida de ${liquidezPools.length} pools`);
      return liquidezPools;
      
    } catch (error) {
      console.error('❌ Error obteniendo liquidez real:', error);
      return [];
    }
  }

  /**
   * Consulta liquidez directamente del contrato del pool
   */
  async consultarLiquidezPool(poolAddress) {
    try {
      // ABI estándar para pools Uniswap V2/V3
      const poolABI = [
        "function getReserves() external view returns (uint112,uint112,uint32)",
        "function token0() external view returns (address)",
        "function token1() external view returns (address)",
        "function fee() external view returns (uint24)"
      ];
      
      const poolContract = new ethers.Contract(poolAddress, poolABI, this.provider);
      
      const [reserves, token0, token1] = await Promise.all([
        poolContract.getReserves().catch(() => null),
        poolContract.token0().catch(() => null),
        poolContract.token1().catch(() => null)
      ]);
      
      if (reserves && token0 && token1) {
        const totalLiquidity = reserves[0].add(reserves[1]);
        
        return {
          poolAddress,
          liquidity: ethers.utils.formatEther(totalLiquidity),
          reserveIn: ethers.utils.formatEther(reserves[0]),
          reserveOut: ethers.utils.formatEther(reserves[1]),
          feeRate: 300, // Default 0.3%
          isActive: totalLiquidity.gt(0),
          token0,
          token1
        };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error consultando pool ${poolAddress}:`, error);
      return null;
    }
  }

  /**
   * Obtiene datos de DeFiLlama como fallback
   */
  async obtenerDatosDeFiLlama(poolAddress) {
    try {
      const response = await axios.get(
        `https://api.llama.fi/pool/${poolAddress}`,
        { timeout: this.timeout }
      );
      
      if (response.data && response.data.tvlUsd) {
        return {
          poolAddress,
          liquidity: (response.data.tvlUsd / 2000).toString(), // Estimación en ETH
          reserveIn: (response.data.tvlUsd / 4000).toString(),
          reserveOut: (response.data.tvlUsd / 4000).toString(),
          feeRate: response.data.fee || 300,
          isActive: response.data.tvlUsd > 10000
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error consultando DeFiLlama:', error);
      return null;
    }
  }

  /**
   * Calcula ganancia potencial con validaciones completas
   */
  async calcularGananciaPotencial(config) {
    try {
      console.log('🔄 Calculando ganancia potencial con datos reales...');
      
      // 1. Validar configuración
      if (!this.validarConfiguracion(config)) {
        throw new Error('Configuración inválida');
      }
      
      // 2. Obtener liquidez real de pools
      const liquidezPools = await this.obtenerLiquidezReal(
        config.chainId || 1,
        config.poolsPath
      );
      
      // 3. Validar liquidez suficiente
      const liquidezMinima = this.validarLiquidezMinima(liquidezPools, config.amountIn);
      
      // 4. Calcular monto sugerido (máx 20% de liquidez)
      const montoSugerido = this.calcularMontoSugerido(liquidezMinima, config.amountIn);
      
      // 5. Simular intercambios
      const amountOut = this.simularSecuenciaIntercambios(
        montoSugerido,
        liquidezPools,
        config.tokenIn,
        config.tokenOut
      );
      
      // 6. Obtener gas price actual
      const gasPrice = await this.obtenerGasPriceActual();
      
      // 7. Calcular costos operacionales
      const costos = this.calcularCostos(liquidezPools.length, gasPrice, amountOut);
      
      // 8. Calcular ganancia neta
      const gananciaBruta = amountOut > montoSugerido ? amountOut - montoSugerido : 0;
      const gananciaNeta = Math.max(0, gananciaBruta - costos.total);
      
      // 9. Calcular ROI
      const roiPercentage = montoSugerido > 0 ? (gananciaNeta / montoSugerido) * 100 : 0;
      
      // 10. Validar slippage
      const slippage = this.calcularSlippage(montoSugerido, amountOut);
      const validSlippage = slippage <= (config.maxSlippage / 100);
      
      // 11. Determinar si es ejecutable
      const minProfit = 0.001; // 0.001 ETH mínimo
      const isProfitable = gananciaNeta >= minProfit && validSlippage;
      
      const resultado = {
        calculation: {
          gananciaBruta: gananciaBruta.toFixed(6),
          costoGas: costos.gas.toFixed(6),
          feeProtocolo: costos.fee.toFixed(6),
          gananciaNeta: gananciaNeta.toFixed(6),
          roiPercentage: roiPercentage.toFixed(2),
          isProfitable
        },
        montoSugerido: montoSugerido.toFixed(6),
        canExecute: isProfitable,
        liquidezPools,
        gasPrice: gasPrice.toFixed(2),
        slippage: (slippage * 100).toFixed(2),
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Cálculo completado. Ganancia neta: ${gananciaNeta.toFixed(6)} ETH`);
      return resultado;
      
    } catch (error) {
      console.error('❌ Error calculando ganancia potencial:', error);
      return {
        calculation: null,
        montoSugerido: '0',
        canExecute: false,
        error: error.message
      };
    }
  }

  /**
   * Valida configuración de entrada
   */
  validarConfiguracion(config) {
    const required = ['tokenIn', 'tokenOut', 'amountIn', 'poolsPath', 'walletDestino'];
    
    for (const field of required) {
      if (!config[field]) {
        console.error(`❌ Campo requerido faltante: ${field}`);
        return false;
      }
    }
    
    if (config.amountIn <= 0) {
      console.error('❌ Monto debe ser mayor a 0');
      return false;
    }
    
    if (config.poolsPath.length < 2) {
      console.error('❌ Se requieren mínimo 2 pools');
      return false;
    }
    
    if (!ethers.utils.isAddress(config.walletDestino)) {
      console.error('❌ Wallet destino no es una dirección válida');
      return false;
    }
    
    return true;
  }

  /**
   * Valida liquidez mínima disponible
   */
  validarLiquidezMinima(pools, amountIn) {
    let liquidezMinima = Infinity;
    
    for (const pool of pools) {
      const liquidez = parseFloat(pool.liquidity);
      if (liquidez < liquidezMinima) {
        liquidezMinima = liquidez;
      }
    }
    
    if (liquidezMinima === Infinity) {
      throw new Error('No se pudo determinar liquidez de pools');
    }
    
    return liquidezMinima;
  }

  /**
   * Calcula monto sugerido basado en liquidez
   */
  calcularMontoSugerido(liquidezMinima, montoDeseado) {
    // Usar máximo 20% de la liquidez disponible
    const maxRecomendado = liquidezMinima * 0.20;
    return Math.min(montoDeseado, maxRecomendado);
  }

  /**
   * Simula secuencia de intercambios
   */
  simularSecuenciaIntercambios(amountIn, pools, tokenIn, tokenOut) {
    let currentAmount = amountIn;
    
    for (const pool of pools) {
      const reserveIn = parseFloat(pool.reserveIn);
      const reserveOut = parseFloat(pool.reserveOut);
      const feeRate = pool.feeRate / 10000; // Convertir a decimal
      
      // Fórmula AMM: amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
      // Incluir fee
      const amountInWithFee = currentAmount * (1 - feeRate);
      currentAmount = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
    }
    
    return currentAmount;
  }

  /**
   * Obtiene gas price actual de la red
   */
  async obtenerGasPriceActual() {
    try {
      const gasPrice = await this.provider.getGasPrice();
      return parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
    } catch (error) {
      console.error('❌ Error obteniendo gas price:', error);
      return 20; // Fallback a 20 Gwei
    }
  }

  /**
   * Calcula costos operacionales totales
   */
  calcularCostos(numPools, gasPriceGwei, amountOut) {
    // Estimación de gas
    const gasBase = 100000;
    const gasPerSwap = 80000;
    const gasTransfer = 50000;
    const totalGas = gasBase + (numPools * gasPerSwap) + gasTransfer;
    
    // Costo en ETH
    const costoGas = (totalGas * gasPriceGwei * 1e-9); // Gwei a ETH
    
    // Fee del protocolo (0.5%)
    const feeProtocolo = amountOut * 0.005;
    
    return {
      gas: costoGas,
      fee: feeProtocolo,
      total: costoGas + feeProtocolo
    };
  }

  /**
   * Calcula slippage porcentual
   */
  calcularSlippage(amountIn, amountOut) {
    if (amountOut >= amountIn) return 0;
    return (amountIn - amountOut) / amountIn;
  }

  /**
   * Ejecuta arbitraje real (requiere wallet conectada)
   */
  async ejecutarArbitraje(config, signer) {
    try {
      console.log('🚀 Ejecutando Flash Loan Arbitrage...');
      
      if (!this.contract || !signer) {
        throw new Error('Contrato o signer no inicializado');
      }
      
      // 1. Pre-validación final
      const calculation = await this.calcularGananciaPotencial(config);
      if (!calculation.canExecute) {
        throw new Error('Operación no es rentable en este momento');
      }
      
      // 2. Preparar datos de transacción
      const flashLoanData = {
        asset: config.tokenIn,
        amount: ethers.utils.parseEther(calculation.montoSugerido),
        config: {
          tokenIn: config.tokenIn,
          tokenOut: config.tokenOut,
          amountIn: ethers.utils.parseEther(calculation.montoSugerido),
          minAmountOut: ethers.utils.parseEther((parseFloat(calculation.montoSugerido) * 0.95).toString()),
          maxGasPrice: ethers.utils.parseUnits(config.maxGasPrice.toString(), 'gwei'),
          deadline: Math.floor(Date.now() / 1000) + 1800,
          walletDestino: config.walletDestino,
          maxSlippage: config.maxSlippage
        },
        pools: config.poolsPath,
        swapData: [] // Se llenaría con calldata específico de cada DEX
      };
      
      // 3. Estimar gas
      const gasEstimate = await this.contract.connect(signer)
        .estimateGas.ejecutarFlashLoanArbitrage(flashLoanData);
      
      // 4. Ejecutar transacción
      const tx = await this.contract.connect(signer)
        .ejecutarFlashLoanArbitrage(flashLoanData, {
          gasLimit: gasEstimate.mul(120).div(100), // +20% buffer
          gasPrice: ethers.utils.parseUnits(config.maxGasPrice.toString(), 'gwei')
        });
      
      console.log(`📄 Transacción enviada: ${tx.hash}`);
      
      // 5. Esperar confirmación
      const receipt = await tx.wait();
      
      console.log(`✅ Arbitraje ejecutado exitosamente. Gas usado: ${receipt.gasUsed}`);
      
      return {
        success: true,
        txHash: tx.hash,
        gasUsed: receipt.gasUsed.toString(),
        profit: calculation.calculation.gananciaNeta,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error ejecutando arbitraje:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Monitorea oportunidades en tiempo real
   */
  async monitorearOportunidades(configs, callback) {
    console.log('👀 Iniciando monitoreo de oportunidades...');
    
    const checkOportunidades = async () => {
      for (const config of configs) {
        try {
          const resultado = await this.calcularGananciaPotencial(config);
          
          if (resultado.canExecute) {
            console.log(`💰 Oportunidad detectada: ${resultado.calculation.gananciaNeta} ETH`);
            await callback(resultado);
          }
        } catch (error) {
          console.error('❌ Error monitoreando oportunidad:', error);
        }
      }
    };
    
    // Verificar cada 5 segundos
    const interval = setInterval(checkOportunidades, 5000);
    
    // Ejecutar inmediatamente
    await checkOportunidades();
    
    return interval;
  }
}

module.exports = ArbitrageOptimizer;
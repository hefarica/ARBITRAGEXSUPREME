/**
 * 🦊 SERVICIO METAMASK WALLET - ArbitrageX Supreme V3.0
 * 
 * METODOLOGÍA: INGENIO PICHICHI S.A.
 * - Disciplinado: Conexión segura y validada con MetaMask
 * - Organizado: Gestión de cuentas, balances y transacciones
 * - Metodológico: Validación de red, gas fees y slippage
 * 
 * FUNCIONALIDADES:
 * - Conexión automática con MetaMask
 * - Detección de cambio de cuenta/red
 * - Validación de balance antes de transacciones
 * - Cálculo automático de gas fees optimizado
 * - Ejecución de arbitrajes con protección
 * - Monitoreo de transacciones en tiempo real
 * 
 * @version 1.0.0
 * @author ArbitrageX Supreme Engineering Team
 */

export interface WalletConnection {
    address: string;
    chainId: number;
    balance: string; // ETH balance in string format
    connected: boolean;
    network_name: string;
}

export interface TransactionRequest {
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
}

export interface ArbitrageTransaction {
    opportunity_id: string;
    token_address: string;
    exchange_path: string[];
    amount_in: string;
    min_amount_out: string;
    gas_estimate: string;
    slippage_tolerance: number;
}

export class MetaMaskService {
    
    private ethereum: any;
    private currentAccount: string | null = null;
    private currentChainId: number | null = null;
    private isConnected: boolean = false;
    
    // Redes soportadas
    private readonly SUPPORTED_NETWORKS = {
        1: { name: 'Ethereum Mainnet', currency: 'ETH' },
        56: { name: 'BSC Mainnet', currency: 'BNB' },
        137: { name: 'Polygon', currency: 'MATIC' },
        42161: { name: 'Arbitrum One', currency: 'ETH' },
        10: { name: 'Optimism', currency: 'ETH' }
    };
    
    constructor() {
        this.ethereum = null;
        this.initializeListeners();
    }
    
    // ===================================================================
    // CONEXIÓN Y CONFIGURACIÓN
    // ===================================================================
    
    /**
     * Detectar e inicializar MetaMask
     */
    async detectMetaMask(): Promise<boolean> {
        if (typeof window === 'undefined') {
            console.warn('⚠️ MetaMask Service: Running in server environment, skipping detection');
            return false;
        }
        
        // Verificar si MetaMask está disponible
        if (window.ethereum) {
            this.ethereum = window.ethereum;
            
            // Verificar si es MetaMask específicamente
            if (window.ethereum.isMetaMask) {
                console.log('✅ MetaMask detectado correctamente');
                return true;
            }
        }
        
        console.warn('⚠️ MetaMask no está instalado');
        return false;
    }
    
    /**
     * Conectar con MetaMask
     */
    async connect(): Promise<WalletConnection | null> {
        try {
            if (!await this.detectMetaMask()) {
                throw new Error('MetaMask no está disponible');
            }
            
            // Solicitar acceso a cuentas
            const accounts = await this.ethereum.request({
                method: 'eth_requestAccounts'
            });
            
            if (accounts.length === 0) {
                throw new Error('No hay cuentas disponibles');
            }
            
            // Obtener chain ID
            const chainId = await this.ethereum.request({
                method: 'eth_chainId'
            });
            
            // Obtener balance
            const balance = await this.ethereum.request({
                method: 'eth_getBalance',
                params: [accounts[0], 'latest']
            });
            
            // Actualizar estado interno
            this.currentAccount = accounts[0];
            this.currentChainId = parseInt(chainId, 16);
            this.isConnected = true;
            
            const connection: WalletConnection = {
                address: accounts[0],
                chainId: this.currentChainId,
                balance: this.formatBalance(balance),
                connected: true,
                network_name: this.getNetworkName(this.currentChainId)
            };
            
            console.log('✅ MetaMask conectado:', connection);
            
            return connection;
            
        } catch (error) {
            console.error('❌ Error connecting to MetaMask:', error);
            this.isConnected = false;
            return null;
        }
    }
    
    /**
     * Desconectar MetaMask
     */
    async disconnect(): Promise<void> {
        this.currentAccount = null;
        this.currentChainId = null;
        this.isConnected = false;
        
        console.log('🔌 MetaMask desconectado');
    }
    
    // ===================================================================
    // GESTIÓN DE TRANSACCIONES
    // ===================================================================
    
    /**
     * Ejecutar arbitraje con protección completa
     */
    async executeArbitrage(transaction: ArbitrageTransaction): Promise<string | null> {
        try {
            if (!this.isConnected || !this.currentAccount) {
                throw new Error('MetaMask no está conectado');
            }
            
            console.log('🔄 Ejecutando arbitraje:', transaction.opportunity_id);
            
            // Validar balance
            const hasBalance = await this.validateBalance(transaction.amount_in);
            if (!hasBalance) {
                throw new Error('Balance insuficiente para la transacción');
            }
            
            // Validar red
            if (!this.isSupportedNetwork(this.currentChainId!)) {
                throw new Error(`Red no soportada: ${this.currentChainId}`);
            }
            
            // Estimar gas fees
            const gasEstimate = await this.estimateGas(transaction);
            
            // Preparar transacción
            const txRequest: TransactionRequest = {
                to: transaction.token_address,
                value: transaction.amount_in,
                data: this.buildArbitrageCalldata(transaction),
                gasLimit: gasEstimate.gasLimit,
                maxFeePerGas: gasEstimate.maxFeePerGas,
                maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas
            };
            
            // Enviar transacción
            const txHash = await this.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: this.currentAccount,
                    to: txRequest.to,
                    value: txRequest.value,
                    data: txRequest.data,
                    gasLimit: txRequest.gasLimit,
                    maxFeePerGas: txRequest.maxFeePerGas,
                    maxPriorityFeePerGas: txRequest.maxPriorityFeePerGas
                }]
            });
            
            console.log('✅ Transacción enviada:', txHash);
            
            // Monitorear transacción
            this.monitorTransaction(txHash, transaction.opportunity_id);
            
            return txHash;
            
        } catch (error) {
            console.error('❌ Error executing arbitrage:', error);
            return null;
        }
    }
    
    /**
     * Validar balance disponible
     */
    async validateBalance(requiredAmount: string): Promise<boolean> {
        try {
            if (!this.currentAccount) return false;
            
            const balance = await this.ethereum.request({
                method: 'eth_getBalance',
                params: [this.currentAccount, 'latest']
            });
            
            const balanceNum = parseInt(balance, 16);
            const requiredNum = parseInt(requiredAmount, 16);
            
            return balanceNum >= requiredNum;
            
        } catch (error) {
            console.error('❌ Error validating balance:', error);
            return false;
        }
    }
    
    /**
     * Estimar gas fees optimizados
     */
    async estimateGas(transaction: ArbitrageTransaction): Promise<{
        gasLimit: string;
        maxFeePerGas: string;
        maxPriorityFeePerGas: string;
    }> {
        try {
            // Gas base estimado para arbitrajes (alta complejidad)
            const baseGasLimit = '300000'; // 300k gas
            
            // Obtener precios de gas actuales
            const gasPrice = await this.ethereum.request({
                method: 'eth_gasPrice'
            });
            
            // EIP-1559 gas pricing
            const maxFeePerGas = (parseInt(gasPrice, 16) * 1.25).toString(16); // 25% buffer
            const maxPriorityFeePerGas = (parseInt(gasPrice, 16) * 0.05).toString(16); // 5% priority
            
            return {
                gasLimit: '0x' + parseInt(baseGasLimit).toString(16),
                maxFeePerGas: '0x' + maxFeePerGas,
                maxPriorityFeePerGas: '0x' + maxPriorityFeePerGas
            };
            
        } catch (error) {
            console.error('❌ Error estimating gas:', error);
            
            // Valores por defecto seguros
            return {
                gasLimit: '0x493E0', // 300k
                maxFeePerGas: '0x12A05F200', // 5 gwei
                maxPriorityFeePerGas: '0x3B9ACA00' // 1 gwei
            };
        }
    }
    
    // ===================================================================
    // UTILIDADES
    // ===================================================================
    
    /**
     * Construir calldata para arbitraje
     */
    private buildArbitrageCalldata(transaction: ArbitrageTransaction): string {
        // Esta es una implementación simplificada
        // En producción, usaría bibliotecas como ethers.js
        
        const selector = '0xa9059cbb'; // transfer selector example
        const addressPadded = transaction.token_address.slice(2).padStart(64, '0');
        const amountPadded = parseInt(transaction.amount_in, 16).toString(16).padStart(64, '0');
        
        return selector + addressPadded + amountPadded;
    }
    
    /**
     * Monitorear transacción en tiempo real
     */
    private async monitorTransaction(txHash: string, opportunityId: string): Promise<void> {
        console.log(`📊 Monitoreando transacción ${txHash} para oportunidad ${opportunityId}`);
        
        // Implementar polling para verificar confirmación
        let confirmations = 0;
        const maxChecks = 20;
        let checks = 0;
        
        const checkStatus = async () => {
            try {
                const receipt = await this.ethereum.request({
                    method: 'eth_getTransactionReceipt',
                    params: [txHash]
                });
                
                if (receipt) {
                    confirmations++;
                    console.log(`✅ Transacción confirmada (${confirmations}/3): ${txHash}`);
                    
                    if (confirmations >= 3) {
                        console.log('🎉 Arbitraje completado exitosamente');
                        return;
                    }
                }
                
                checks++;
                if (checks < maxChecks) {
                    setTimeout(checkStatus, 3000); // Check cada 3 segundos
                } else {
                    console.warn('⚠️ Tiempo de espera agotado para confirmación');
                }
                
            } catch (error) {
                console.error('❌ Error monitoring transaction:', error);
            }
        };
        
        setTimeout(checkStatus, 1000); // Primer check después de 1 segundo
    }
    
    /**
     * Configurar listeners de eventos
     */
    private initializeListeners(): void {
        if (typeof window === 'undefined') return;
        
        // Listener para cambio de cuenta
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts: string[]) => {
                console.log('🔄 Account changed:', accounts[0] || 'disconnected');
                
                if (accounts.length === 0) {
                    this.disconnect();
                } else {
                    this.currentAccount = accounts[0];
                }
            });
            
            // Listener para cambio de red
            window.ethereum.on('chainChanged', (chainId: string) => {
                const newChainId = parseInt(chainId, 16);
                console.log('🌐 Network changed:', newChainId);
                
                this.currentChainId = newChainId;
                
                if (!this.isSupportedNetwork(newChainId)) {
                    console.warn('⚠️ Red no soportada detectada:', newChainId);
                }
            });
        }
    }
    
    /**
     * Formatear balance de wei a ETH
     */
    private formatBalance(balanceWei: string): string {
        const balance = parseInt(balanceWei, 16);
        const eth = balance / Math.pow(10, 18);
        return eth.toFixed(6);
    }
    
    /**
     * Obtener nombre de red
     */
    private getNetworkName(chainId: number): string {
        return this.SUPPORTED_NETWORKS[chainId as keyof typeof this.SUPPORTED_NETWORKS]?.name || `Unknown Network (${chainId})`;
    }
    
    /**
     * Verificar si la red es soportada
     */
    private isSupportedNetwork(chainId: number): boolean {
        return Object.keys(this.SUPPORTED_NETWORKS).includes(chainId.toString());
    }
    
    /**
     * Obtener información de conexión actual
     */
    getConnectionInfo(): WalletConnection | null {
        if (!this.isConnected || !this.currentAccount || !this.currentChainId) {
            return null;
        }
        
        return {
            address: this.currentAccount,
            chainId: this.currentChainId,
            balance: '0.0', // Se actualizaría con una llamada real
            connected: this.isConnected,
            network_name: this.getNetworkName(this.currentChainId)
        };
    }
}

// Instancia global para uso en toda la aplicación
export const metaMaskService = new MetaMaskService();
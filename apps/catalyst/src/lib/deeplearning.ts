/**
 * ArbitrageX Supreme - Deep Learning Engine
 * Ingenio Pichichi S.A. - Actividades 21-30
 * 
 * Sistema avanzado de machine learning con redes neuronales para predicción de arbitrajes
 */

// Types para Deep Learning
export interface NeuralNetworkConfig {
  inputSize: number
  hiddenLayers: number[]
  outputSize: number
  activationFunction: 'sigmoid' | 'tanh' | 'relu' | 'leakyRelu'
  learningRate: number
  momentum: number
  regularization: number
  dropout: number
}

export interface TrainingData {
  inputs: number[][]
  outputs: number[][]
  validation?: {
    inputs: number[][]
    outputs: number[][]
  }
}

export interface PredictionModel {
  id: string
  name: string
  type: 'price' | 'volatility' | 'opportunity' | 'risk'
  network: NeuralNetwork
  accuracy: number
  lastTrained: number
  trainingEpochs: number
  config: NeuralNetworkConfig
}

export interface MarketFeatures {
  // Price features
  currentPrice: number
  priceMA5: number
  priceMA20: number
  priceChange1h: number
  priceChange24h: number
  
  // Volume features
  volume1h: number
  volume24h: number
  volumeMA: number
  volumeRatio: number
  
  // Liquidity features
  totalLiquidity: number
  liquidityChange: number
  bidAskSpread: number
  marketDepth: number
  
  // Volatility features
  volatility1h: number
  volatility24h: number
  volatilityRatio: number
  
  // Gas and network
  gasPrice: number
  gasPriceMA: number
  blockTime: number
  networkCongestion: number
  
  // DEX specific
  dexTVL: number
  dexVolume: number
  dexFees: number
  protocolsActive: number
  
  // Time features
  hourOfDay: number
  dayOfWeek: number
  isWeekend: number
  
  // External factors
  btcPrice: number
  ethPrice: number
  marketSentiment: number
  newsVolume: number
}

/**
 * Neural Network Implementation
 */
export class NeuralNetwork {
  private config: NeuralNetworkConfig
  private weights: number[][][]
  private biases: number[][]
  private momentum: number[][][]
  private biaseMomentum: number[][]
  
  constructor(config: NeuralNetworkConfig) {
    this.config = config
    this.initializeWeights()
  }

  /**
   * Inicializar pesos y biases aleatoriamente
   */
  private initializeWeights(): void {
    this.weights = []
    this.biases = []
    this.momentum = []
    this.biaseMomentum = []

    const layers = [this.config.inputSize, ...this.config.hiddenLayers, this.config.outputSize]
    
    for (let i = 0; i < layers.length - 1; i++) {
      // Xavier initialization
      const limit = Math.sqrt(6 / (layers[i] + layers[i + 1]))
      
      // Weights
      const layerWeights = Array(layers[i]).fill(0).map(() =>
        Array(layers[i + 1]).fill(0).map(() =>
          (Math.random() * 2 - 1) * limit
        )
      )
      
      // Biases
      const layerBiases = Array(layers[i + 1]).fill(0).map(() =>
        Math.random() * 0.1 - 0.05
      )
      
      // Momentum
      const layerMomentum = Array(layers[i]).fill(0).map(() =>
        Array(layers[i + 1]).fill(0)
      )
      
      const layerBiaseMomentum = Array(layers[i + 1]).fill(0)
      
      this.weights.push(layerWeights)
      this.biases.push(layerBiases)
      this.momentum.push(layerMomentum)
      this.biaseMomentum.push(layerBiaseMomentum)
    }
  }

  /**
   * Función de activación
   */
  private activate(x: number): number {
    switch (this.config.activationFunction) {
      case 'sigmoid':
        return 1 / (1 + Math.exp(-x))
      case 'tanh':
        return Math.tanh(x)
      case 'relu':
        return Math.max(0, x)
      case 'leakyRelu':
        return x > 0 ? x : 0.01 * x
      default:
        return x
    }
  }

  /**
   * Derivada de la función de activación
   */
  private activateDerivative(x: number): number {
    switch (this.config.activationFunction) {
      case 'sigmoid':
        const sig = this.activate(x)
        return sig * (1 - sig)
      case 'tanh':
        const tanh = this.activate(x)
        return 1 - tanh * tanh
      case 'relu':
        return x > 0 ? 1 : 0
      case 'leakyRelu':
        return x > 0 ? 1 : 0.01
      default:
        return 1
    }
  }

  /**
   * Forward propagation
   */
  forward(inputs: number[]): number[] {
    let activations = [...inputs]
    
    for (let layer = 0; layer < this.weights.length; layer++) {
      const nextActivations = []
      
      for (let j = 0; j < this.weights[layer][0].length; j++) {
        let sum = this.biases[layer][j]
        
        for (let i = 0; i < activations.length; i++) {
          sum += activations[i] * this.weights[layer][i][j]
        }
        
        // Apply dropout during training (not implemented here for simplicity)
        nextActivations.push(this.activate(sum))
      }
      
      activations = nextActivations
    }
    
    return activations
  }

  /**
   * Entrenar la red neuronal con backpropagation
   */
  train(trainingData: TrainingData, epochs: number): {
    trainingLoss: number[]
    validationLoss: number[]
    accuracy: number
  } {
    const trainingLoss: number[] = []
    const validationLoss: number[] = []
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0
      
      // Shuffle training data
      const indices = Array.from({ length: trainingData.inputs.length }, (_, i) => i)
      this.shuffle(indices)
      
      for (const index of indices) {
        const input = trainingData.inputs[index]
        const target = trainingData.outputs[index]
        
        // Forward pass
        const activations = this.forwardDetailed(input)
        const output = activations[activations.length - 1]
        
        // Calculate loss (MSE)
        const loss = target.reduce((sum, t, i) => sum + Math.pow(t - output[i], 2), 0) / target.length
        totalLoss += loss
        
        // Backward pass
        this.backward(activations, target)
      }
      
      const avgLoss = totalLoss / trainingData.inputs.length
      trainingLoss.push(avgLoss)
      
      // Validation loss
      if (trainingData.validation) {
        const valLoss = this.calculateValidationLoss(trainingData.validation)
        validationLoss.push(valLoss)
      }
      
      // Log progress every 100 epochs
      if (epoch % 100 === 0) {
        console.log(`Epoch ${epoch}: Loss = ${avgLoss.toFixed(6)}`)
      }
    }
    
    // Calculate final accuracy
    const accuracy = this.calculateAccuracy(trainingData.inputs, trainingData.outputs)
    
    return { trainingLoss, validationLoss, accuracy }
  }

  /**
   * Forward pass with detailed activations for backpropagation
   */
  private forwardDetailed(inputs: number[]): number[][] {
    const activations = [inputs]
    
    for (let layer = 0; layer < this.weights.length; layer++) {
      const currentActivations = activations[activations.length - 1]
      const nextActivations = []
      
      for (let j = 0; j < this.weights[layer][0].length; j++) {
        let sum = this.biases[layer][j]
        
        for (let i = 0; i < currentActivations.length; i++) {
          sum += currentActivations[i] * this.weights[layer][i][j]
        }
        
        nextActivations.push(this.activate(sum))
      }
      
      activations.push(nextActivations)
    }
    
    return activations
  }

  /**
   * Backpropagation
   */
  private backward(activations: number[][], target: number[]): void {
    const layers = activations.length - 1
    const errors: number[][] = Array(layers).fill(0).map(() => [])
    
    // Output layer error
    const outputActivations = activations[layers]
    errors[layers - 1] = outputActivations.map((output, i) => 
      (target[i] - output) * this.activateDerivative(output)
    )
    
    // Hidden layer errors (backward)
    for (let layer = layers - 2; layer >= 0; layer--) {
      const layerErrors = []
      
      for (let i = 0; i < activations[layer + 1].length; i++) {
        let error = 0
        
        for (let j = 0; j < errors[layer + 1].length; j++) {
          error += errors[layer + 1][j] * this.weights[layer + 1][i][j]
        }
        
        layerErrors.push(error * this.activateDerivative(activations[layer + 1][i]))
      }
      
      errors[layer] = layerErrors
    }
    
    // Update weights and biases
    for (let layer = 0; layer < this.weights.length; layer++) {
      for (let i = 0; i < this.weights[layer].length; i++) {
        for (let j = 0; j < this.weights[layer][i].length; j++) {
          const gradient = this.config.learningRate * errors[layer][j] * activations[layer][i]
          
          // Momentum
          this.momentum[layer][i][j] = this.config.momentum * this.momentum[layer][i][j] + gradient
          
          // L2 regularization
          const regularization = this.config.regularization * this.weights[layer][i][j]
          
          this.weights[layer][i][j] += this.momentum[layer][i][j] - regularization
        }
      }
      
      // Update biases
      for (let j = 0; j < this.biases[layer].length; j++) {
        const gradient = this.config.learningRate * errors[layer][j]
        
        this.biaseMomentum[layer][j] = this.config.momentum * this.biaseMomentum[layer][j] + gradient
        this.biases[layer][j] += this.biaseMomentum[layer][j]
      }
    }
  }

  /**
   * Calcular loss de validación
   */
  private calculateValidationLoss(validation: { inputs: number[][], outputs: number[][] }): number {
    let totalLoss = 0
    
    for (let i = 0; i < validation.inputs.length; i++) {
      const output = this.forward(validation.inputs[i])
      const target = validation.outputs[i]
      
      const loss = target.reduce((sum, t, j) => sum + Math.pow(t - output[j], 2), 0) / target.length
      totalLoss += loss
    }
    
    return totalLoss / validation.inputs.length
  }

  /**
   * Calcular precisión
   */
  private calculateAccuracy(inputs: number[][], outputs: number[][]): number {
    let correct = 0
    
    for (let i = 0; i < inputs.length; i++) {
      const prediction = this.forward(inputs[i])
      const target = outputs[i]
      
      // Para clasificación: encontrar índice con mayor valor
      const predictedClass = prediction.indexOf(Math.max(...prediction))
      const targetClass = target.indexOf(Math.max(...target))
      
      if (predictedClass === targetClass) {
        correct++
      }
    }
    
    return (correct / inputs.length) * 100
  }

  /**
   * Shuffle array
   */
  private shuffle(array: number[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
  }

  /**
   * Exportar modelo
   */
  export(): any {
    return {
      config: this.config,
      weights: this.weights,
      biases: this.biases
    }
  }

  /**
   * Importar modelo
   */
  import(modelData: any): void {
    this.config = modelData.config
    this.weights = modelData.weights
    this.biases = modelData.biases
    
    // Reinitializar momentum
    this.momentum = this.weights.map(layer =>
      layer.map(row => Array(row.length).fill(0))
    )
    this.biaseMomentum = this.biases.map(layer =>
      Array(layer.length).fill(0)
    )
  }
}

/**
 * Deep Learning Manager para Arbitrajes
 */
export class ArbitrageDeepLearning {
  private models: Map<string, PredictionModel> = new Map()
  private featureHistory: MarketFeatures[] = []
  private trainingInProgress = false

  constructor() {
    this.initializeModels()
  }

  /**
   * Inicializar modelos por defecto
   */
  private initializeModels(): void {
    // Modelo de predicción de precios
    const priceModel: PredictionModel = {
      id: 'price-predictor',
      name: 'Price Movement Predictor',
      type: 'price',
      network: new NeuralNetwork({
        inputSize: 25, // Número de features
        hiddenLayers: [50, 30, 20],
        outputSize: 3, // Up, Down, Stable
        activationFunction: 'relu',
        learningRate: 0.001,
        momentum: 0.9,
        regularization: 0.001,
        dropout: 0.2
      }),
      accuracy: 0,
      lastTrained: 0,
      trainingEpochs: 0,
      config: {
        inputSize: 25,
        hiddenLayers: [50, 30, 20],
        outputSize: 3,
        activationFunction: 'relu',
        learningRate: 0.001,
        momentum: 0.9,
        regularization: 0.001,
        dropout: 0.2
      }
    }

    // Modelo de predicción de volatilidad
    const volatilityModel: PredictionModel = {
      id: 'volatility-predictor',
      name: 'Volatility Predictor',
      type: 'volatility',
      network: new NeuralNetwork({
        inputSize: 25,
        hiddenLayers: [40, 25, 15],
        outputSize: 1, // Volatility score 0-1
        activationFunction: 'sigmoid',
        learningRate: 0.0005,
        momentum: 0.85,
        regularization: 0.0005,
        dropout: 0.15
      }),
      accuracy: 0,
      lastTrained: 0,
      trainingEpochs: 0,
      config: {
        inputSize: 25,
        hiddenLayers: [40, 25, 15],
        outputSize: 1,
        activationFunction: 'sigmoid',
        learningRate: 0.0005,
        momentum: 0.85,
        regularization: 0.0005,
        dropout: 0.15
      }
    }

    // Modelo de detección de oportunidades
    const opportunityModel: PredictionModel = {
      id: 'opportunity-detector',
      name: 'Arbitrage Opportunity Detector',
      type: 'opportunity',
      network: new NeuralNetwork({
        inputSize: 25,
        hiddenLayers: [60, 40, 25, 10],
        outputSize: 4, // No opportunity, Low, Medium, High
        activationFunction: 'relu',
        learningRate: 0.002,
        momentum: 0.95,
        regularization: 0.002,
        dropout: 0.25
      }),
      accuracy: 0,
      lastTrained: 0,
      trainingEpochs: 0,
      config: {
        inputSize: 25,
        hiddenLayers: [60, 40, 25, 10],
        outputSize: 4,
        activationFunction: 'relu',
        learningRate: 0.002,
        momentum: 0.95,
        regularization: 0.002,
        dropout: 0.25
      }
    }

    this.models.set(priceModel.id, priceModel)
    this.models.set(volatilityModel.id, volatilityModel)
    this.models.set(opportunityModel.id, opportunityModel)
  }

  /**
   * Añadir datos de features al historial
   */
  addMarketFeatures(features: MarketFeatures): void {
    this.featureHistory.push(features)
    
    // Mantener solo las últimas 10,000 observaciones
    if (this.featureHistory.length > 10000) {
      this.featureHistory.shift()
    }
  }

  /**
   * Convertir features a array numérico normalizado
   */
  private featuresToArray(features: MarketFeatures): number[] {
    return [
      // Normalize prices (0-1 scale based on historical range)
      this.normalize(features.currentPrice, 0, 10000),
      this.normalize(features.priceMA5, 0, 10000),
      this.normalize(features.priceMA20, 0, 10000),
      this.normalize(features.priceChange1h, -100, 100),
      this.normalize(features.priceChange24h, -100, 100),
      
      // Normalize volumes
      this.normalize(features.volume1h, 0, 100000000),
      this.normalize(features.volume24h, 0, 1000000000),
      this.normalize(features.volumeMA, 0, 500000000),
      this.normalize(features.volumeRatio, 0, 10),
      
      // Normalize liquidity
      this.normalize(features.totalLiquidity, 0, 1000000000),
      this.normalize(features.liquidityChange, -50, 50),
      this.normalize(features.bidAskSpread, 0, 1),
      this.normalize(features.marketDepth, 0, 100000000),
      
      // Normalize volatility
      this.normalize(features.volatility1h, 0, 1),
      this.normalize(features.volatility24h, 0, 1),
      this.normalize(features.volatilityRatio, 0, 10),
      
      // Normalize gas and network
      this.normalize(features.gasPrice, 0, 500),
      this.normalize(features.gasPriceMA, 0, 500),
      this.normalize(features.blockTime, 0, 30),
      this.normalize(features.networkCongestion, 0, 1),
      
      // Time features (already normalized)
      features.hourOfDay / 24,
      features.dayOfWeek / 7,
      features.isWeekend,
      
      // External factors
      this.normalize(features.marketSentiment, -1, 1),
      this.normalize(features.newsVolume, 0, 1000)
    ]
  }

  /**
   * Normalizar valor al rango 0-1
   */
  private normalize(value: number, min: number, max: number): number {
    return Math.max(0, Math.min(1, (value - min) / (max - min)))
  }

  /**
   * Generar datos de entrenamiento sintéticos
   */
  private generateTrainingData(modelType: 'price' | 'volatility' | 'opportunity', samples: number): TrainingData {
    const inputs: number[][] = []
    const outputs: number[][] = []

    for (let i = 0; i < samples; i++) {
      // Generar features sintéticas realistas
      const features: MarketFeatures = {
        currentPrice: Math.random() * 5000 + 1000,
        priceMA5: Math.random() * 5000 + 1000,
        priceMA20: Math.random() * 5000 + 1000,
        priceChange1h: (Math.random() - 0.5) * 20,
        priceChange24h: (Math.random() - 0.5) * 100,
        volume1h: Math.random() * 10000000,
        volume24h: Math.random() * 100000000,
        volumeMA: Math.random() * 50000000,
        volumeRatio: Math.random() * 5 + 0.1,
        totalLiquidity: Math.random() * 500000000 + 1000000,
        liquidityChange: (Math.random() - 0.5) * 40,
        bidAskSpread: Math.random() * 0.01,
        marketDepth: Math.random() * 10000000,
        volatility1h: Math.random() * 0.1,
        volatility24h: Math.random() * 0.2,
        volatilityRatio: Math.random() * 3 + 0.5,
        gasPrice: Math.random() * 200 + 20,
        gasPriceMA: Math.random() * 200 + 20,
        blockTime: Math.random() * 20 + 5,
        networkCongestion: Math.random(),
        dexTVL: Math.random() * 1000000000,
        dexVolume: Math.random() * 100000000,
        dexFees: Math.random() * 1000000,
        protocolsActive: Math.floor(Math.random() * 50) + 150,
        hourOfDay: Math.floor(Math.random() * 24),
        dayOfWeek: Math.floor(Math.random() * 7),
        isWeekend: Math.random() > 0.7 ? 1 : 0,
        btcPrice: Math.random() * 20000 + 30000,
        ethPrice: Math.random() * 1000 + 1000,
        marketSentiment: (Math.random() - 0.5) * 2,
        newsVolume: Math.random() * 500
      }

      const input = this.featuresToArray(features)
      inputs.push(input)

      // Generar outputs basados en el tipo de modelo
      let output: number[]
      switch (modelType) {
        case 'price':
          // Predecir dirección del precio: [Up, Down, Stable]
          const priceChange = features.priceChange1h
          if (priceChange > 2) output = [1, 0, 0] // Up
          else if (priceChange < -2) output = [0, 1, 0] // Down
          else output = [0, 0, 1] // Stable
          break

        case 'volatility':
          // Predecir volatilidad normalizada
          output = [features.volatility1h * 10] // Scale to 0-1
          break

        case 'opportunity':
          // Predecir nivel de oportunidad basado en múltiples factores
          const score = (features.volatility1h * 2 + 
                        (300 - features.gasPrice) / 300 + 
                        features.volumeRatio) / 4
          
          if (score > 0.8) output = [0, 0, 0, 1] // High
          else if (score > 0.6) output = [0, 0, 1, 0] // Medium
          else if (score > 0.3) output = [0, 1, 0, 0] // Low
          else output = [1, 0, 0, 0] // No opportunity
          break

        default:
          output = [0]
      }

      outputs.push(output)
    }

    // Split training/validation 80/20
    const splitIndex = Math.floor(samples * 0.8)
    
    return {
      inputs: inputs.slice(0, splitIndex),
      outputs: outputs.slice(0, splitIndex),
      validation: {
        inputs: inputs.slice(splitIndex),
        outputs: outputs.slice(splitIndex)
      }
    }
  }

  /**
   * Entrenar modelo específico
   */
  async trainModel(modelId: string, epochs = 1000): Promise<{
    success: boolean
    accuracy: number
    trainingTime: number
    loss: number[]
  }> {
    const model = this.models.get(modelId)
    if (!model) {
      throw new Error(`Model ${modelId} not found`)
    }

    if (this.trainingInProgress) {
      throw new Error('Training already in progress')
    }

    this.trainingInProgress = true
    const startTime = Date.now()

    try {
      console.log(`🧠 Training model: ${model.name}`)
      
      // Generar datos de entrenamiento
      const trainingData = this.generateTrainingData(model.type, 5000)
      
      // Entrenar red neuronal
      const results = model.network.train(trainingData, epochs)
      
      // Actualizar modelo
      model.accuracy = results.accuracy
      model.lastTrained = Date.now()
      model.trainingEpochs = epochs

      const trainingTime = Date.now() - startTime

      console.log(`✅ Training completed: ${results.accuracy.toFixed(2)}% accuracy in ${trainingTime}ms`)

      return {
        success: true,
        accuracy: results.accuracy,
        trainingTime,
        loss: results.trainingLoss
      }
    } catch (error) {
      console.error('Training error:', error)
      throw error
    } finally {
      this.trainingInProgress = false
    }
  }

  /**
   * Hacer predicción con modelo
   */
  predict(modelId: string, features: MarketFeatures): {
    prediction: number[]
    confidence: number
    interpretation: string
  } {
    const model = this.models.get(modelId)
    if (!model) {
      throw new Error(`Model ${modelId} not found`)
    }

    const input = this.featuresToArray(features)
    const output = model.network.forward(input)
    
    // Calcular confianza (max probability)
    const confidence = Math.max(...output) * 100

    // Interpretar resultado según tipo de modelo
    let interpretation: string
    switch (model.type) {
      case 'price':
        const direction = output.indexOf(Math.max(...output))
        interpretation = direction === 0 ? 'Price Up' : 
                        direction === 1 ? 'Price Down' : 'Price Stable'
        break
      case 'volatility':
        interpretation = `Volatility: ${(output[0] * 100).toFixed(1)}%`
        break
      case 'opportunity':
        const level = output.indexOf(Math.max(...output))
        interpretation = ['No Opportunity', 'Low Opportunity', 'Medium Opportunity', 'High Opportunity'][level]
        break
      default:
        interpretation = 'Unknown'
    }

    return {
      prediction: output,
      confidence,
      interpretation
    }
  }

  // ============================================
  // API PÚBLICA
  // ============================================

  getModels(): PredictionModel[] {
    return Array.from(this.models.values())
  }

  getModel(modelId: string): PredictionModel | undefined {
    return this.models.get(modelId)
  }

  isTraining(): boolean {
    return this.trainingInProgress
  }

  getFeatureHistory(): MarketFeatures[] {
    return this.featureHistory.slice(-100) // Return last 100
  }

  /**
   * Entrenar todos los modelos
   */
  async trainAllModels(epochs = 500): Promise<Map<string, any>> {
    const results = new Map()
    
    for (const [modelId, model] of this.models) {
      try {
        console.log(`Training ${model.name}...`)
        const result = await this.trainModel(modelId, epochs)
        results.set(modelId, result)
      } catch (error) {
        console.error(`Failed to train ${model.name}:`, error)
        results.set(modelId, { success: false, error: error.message })
      }
    }
    
    return results
  }

  /**
   * Hacer predicción consolidada
   */
  makePredictions(features: MarketFeatures): {
    [key: string]: {
      prediction: number[]
      confidence: number
      interpretation: string
    }
  } {
    const results: any = {}
    
    for (const [modelId, model] of this.models) {
      try {
        results[modelId] = this.predict(modelId, features)
      } catch (error) {
        console.error(`Prediction failed for ${model.name}:`, error)
        results[modelId] = {
          prediction: [],
          confidence: 0,
          interpretation: 'Prediction failed'
        }
      }
    }
    
    return results
  }
}

// Exportar instancia singleton
export const arbitrageDeepLearning = new ArbitrageDeepLearning()
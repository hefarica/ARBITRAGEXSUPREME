// ArbitrageX Pro 2025 - Enhanced Logger
// Structured logging with performance monitoring

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  performance?: {
    startTime: number;
    duration: number;
  };
}

export class Logger {
  constructor(private service: string) {}

  private createLogEntry(
    level: string,
    message: string,
    context?: LogContext,
    error?: Error,
    performance?: { startTime: number; duration: number }
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      service: this.service,
      message,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    if (performance) {
      entry.performance = performance;
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    // In production, this would go to your logging service
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(entry));
    } else {
      // Pretty print for development
      const color = this.getColorForLevel(entry.level);
      console.log(
        `${color}[${entry.timestamp}] ${entry.level} (${entry.service}): ${entry.message}\x1b[0m`
      );
      
      if (entry.context) {
        console.log('  Context:', entry.context);
      }
      
      if (entry.error) {
        console.log('  Error:', entry.error.message);
        if (entry.error.stack) {
          console.log('  Stack:', entry.error.stack);
        }
      }
      
      if (entry.performance) {
        console.log(`  Performance: ${entry.performance.duration}ms`);
      }
    }
  }

  private getColorForLevel(level: string): string {
    switch (level) {
      case 'ERROR': return '\x1b[31m'; // Red
      case 'WARN': return '\x1b[33m';  // Yellow
      case 'INFO': return '\x1b[36m';  // Cyan
      case 'DEBUG': return '\x1b[37m'; // White
      default: return '\x1b[37m';
    }
  }

  info(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('INFO', message, context);
    this.output(entry);
  }

  warn(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('WARN', message, context);
    this.output(entry);
  }

  error(message: string, context?: LogContext | Error, error?: Error): void {
    // Handle overloaded parameters
    let actualContext: LogContext | undefined;
    let actualError: Error | undefined;

    if (context instanceof Error) {
      actualError = context;
    } else {
      actualContext = context;
      actualError = error;
    }

    const entry = this.createLogEntry('ERROR', message, actualContext, actualError);
    this.output(entry);
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development') {
      const entry = this.createLogEntry('DEBUG', message, context);
      this.output(entry);
    }
  }

  // Performance logging
  time(label: string): () => void {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      const entry = this.createLogEntry(
        'INFO',
        `Performance: ${label}`,
        undefined,
        undefined,
        { startTime, duration }
      );
      this.output(entry);
    };
  }

  // Async performance wrapper
  async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const endTimer = this.time(label);
    try {
      const result = await fn();
      endTimer();
      return result;
    } catch (error) {
      endTimer();
      throw error;
    }
  }
}
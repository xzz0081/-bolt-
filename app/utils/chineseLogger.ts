import { escapeCodes } from './terminal';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_MAP = {
  trace: { label: '追踪', color: '\x1b[90m', priority: 0 },  // 灰色
  debug: { label: '调试', color: '\x1b[36m', priority: 1 },  // 青色
  info: { label: '信息', color: '\x1b[32m', priority: 2 },   // 绿色
  warn: { label: '警告', color: '\x1b[33m', priority: 3 },   // 黄色
  error: { label: '错误', color: '\x1b[31m', priority: 4 }   // 红色
};

export interface LoggerOptions {
  scope?: string;
  showTimestamp?: boolean;
  minLevel?: LogLevel;
}

export class ChineseLogger {
  private scope?: string;
  private showTimestamp: boolean;
  private minLevel: LogLevel;

  constructor(options: LoggerOptions = {}) {
    this.scope = options.scope;
    this.showTimestamp = options.showTimestamp ?? true;
    this.minLevel = options.minLevel ?? 'info';
  }

  private getTimestamp(): string {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  }

  private log(level: LogLevel, ...messages: any[]) {
    if (LOG_LEVEL_MAP[level].priority < LOG_LEVEL_MAP[this.minLevel].priority) {
      return;
    }

    const { color, label } = LOG_LEVEL_MAP[level];
    const timestamp = this.showTimestamp ? `[${this.getTimestamp()}] ` : '';
    const scope = this.scope ? ` [${this.scope}]` : '';
    
    const prefix = `${color}${timestamp}${label}${scope}${escapeCodes.reset}`;
    
    const formattedMessages = messages.map(msg => 
      typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg
    ).join(' ');

    console.log(`${prefix} ${formattedMessages}`);
  }

  trace(...messages: any[]) {
    this.log('trace', ...messages);
  }

  debug(...messages: any[]) {
    this.log('debug', ...messages);
  }

  info(...messages: any[]) {
    this.log('info', ...messages);
  }

  warn(...messages: any[]) {
    this.log('warn', ...messages);
  }

  error(...messages: any[]) {
    this.log('error', ...messages);
  }

  success(message: string) {
    console.log(`${'\x1b[32m'}✓ ${message}${escapeCodes.reset}`);
  }

  operation(operation: string, status: '开始' | '完成' | '失败', details?: string) {
    const statusColor = {
      '开始': '\x1b[36m',  // 青色
      '完成': '\x1b[32m',  // 绿色
      '失败': '\x1b[31m'   // 红色
    }[status];

    const message = `${operation} ${status}${details ? `: ${details}` : ''}`;
    console.log(`${statusColor}➤ ${message}${escapeCodes.reset}`);
  }

  progress(operation: string, current: number, total: number) {
    const percentage = Math.round((current / total) * 100);
    const progressBar = this.createProgressBar(percentage);
    console.log(`\x1b[36m${operation}: ${progressBar} ${percentage}%${escapeCodes.reset}`);
  }

  private createProgressBar(percentage: number): string {
    const width = 20;
    const filled = Math.round((width * percentage) / 100);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'-'.repeat(empty)}]`;
  }

  logRetry(attempt: number, maxAttempts: number, error: any) {
    const message = `重试 ${attempt}/${maxAttempts}: ${error?.message || '未知错误'}`;
    this.log('info', message);
  }

  logProcess(processName: string, status: string, details?: string) {
    const message = `进程 [${processName}] ${status}${details ? `: ${details}` : ''}`;
    this.log('info', message);
  }

  logFileSystem(operation: string, path: string, details?: string) {
    const message = `文件系统 ${operation}: ${path}${details ? ` (${details})` : ''}`;
    this.log('debug', message);
  }

  logNetwork(operation: string, url: string, status?: string) {
    const message = `网络 ${operation}: ${url}${status ? ` - ${status}` : ''}`;
    this.log('debug', message);
  }

  logPerformance(operation: string, duration: number) {
    const message = `性能 ${operation}: ${duration}ms`;
    this.log('debug', message);
  }
}

// 创建默认日志实例
export const chineseLogger = new ChineseLogger();

// 创建带作用域的日志实例工厂函数
export function createScopedChineseLogger(scope: string, options: Omit<LoggerOptions, 'scope'> = {}) {
  return new ChineseLogger({ ...options, scope });
} 
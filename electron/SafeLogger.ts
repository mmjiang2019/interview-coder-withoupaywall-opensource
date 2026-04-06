// SafeLogger.ts

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

class SafeLogger {
  private logDir: string;
  private maxLogSize: number = 10 * 1024 * 1024; // 10MB
  private logFile: string;

  constructor() {
    // 创建日志目录，参考ModelConfigManager的getConfigPath函数实现
    this.logDir = this.getLogDirPath();
    
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // 创建日志文件
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(this.logDir, `app-${timestamp}.log`);

    // 清理旧日志文件
    this.cleanupOldLogs();
  }
  
  private getLogDirPath(): string {
    const appDataPath = process.env.APPDATA || 
                        (process.platform === 'darwin' ? 
                         `${process.env.HOME}/Library/Application Support` : 
                         `${process.env.HOME}/.config`);
    return path.join(appDataPath, 'interview-coder-v1', 'logs');
  }

  private cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const logFiles = files
        .filter(file => file.startsWith('app-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          mtime: fs.statSync(path.join(this.logDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // 保留最近5个日志文件
      if (logFiles.length > 5) {
        logFiles.slice(5).forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            console.error('Error deleting old log file:', error);
          }
        });
      }
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
    }
  }

  private writeLog(level: string, ...args: any[]) {
    try {
      const timestamp = new Date().toISOString();
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');

      const logEntry = `[${timestamp}] [${level}] ${message}\n`;

      // 检查日志文件大小
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.maxLogSize) {
          // 创建新的日志文件
          const date = new Date();
          const timestamp = date.toISOString().replace(/[:.]/g, '-');
          this.logFile = path.join(this.logDir, `app-${timestamp}.log`);
        }
      }

      // 写入日志文件
      fs.appendFileSync(this.logFile, logEntry, 'utf8');

      // 在开发模式下，同时输出到控制台
      if (process.env.NODE_ENV === 'development') {
        switch (level) {
          case 'ERROR':
            console.error(...args);
            break;
          case 'WARN':
            console.warn(...args);
            break;
          case 'INFO':
          default:
            console.log(...args);
            break;
        }
      }
    } catch (error) {
      // 如果日志写入失败，回退到控制台
      console.error('Error writing to log file:', error);
      console.log(...args);
    }
  }

  public info(...args: any[]) {
    this.writeLog('INFO', ...args);
  }

  public mainLog(...args: any[]) {
    this.writeLog('INFO', '[MAIN]', ...args);
  }

  public error(...args: any[]) {
    this.writeLog('ERROR', ...args);
  }

  public mainError(...args: any[]) {
    this.writeLog('ERROR', '[MAIN]', ...args);
  }

  public warn(...args: any[]) {
    this.writeLog('WARN', ...args);
  }

  public debug(...args: any[]) {
    if (process.env.NODE_ENV === 'development') {
      this.writeLog('DEBUG', ...args);
    }
  }
}

// 导出单例
export const safeLogger = new SafeLogger();

import { WebContainer } from '@webcontainer/api';
import type { ITerminal } from '~/types/terminal';

// WebContainer 状态类型
export type WebContainerStatus = 'idle' | 'importing' | 'installing' | 'starting' | 'ready' | 'error';

// WebContainer 上下文
export interface WebContainerContext {
  loaded: boolean;
  terminals: ITerminal[];
}

export const webcontainerContext: WebContainerContext = {
  loaded: false,
  terminals: [],
};

// WebContainer 实例管理器
class WebContainerInstanceManager {
  private static instance: WebContainerInstanceManager | null = null;
  private webcontainerInstance: WebContainer | null = null;
  private bootPromise: Promise<WebContainer> | null = null;
  private status: WebContainerStatus = 'idle';

  private constructor() {}

  static getInstance(): WebContainerInstanceManager {
    if (!WebContainerInstanceManager.instance) {
      WebContainerInstanceManager.instance = new WebContainerInstanceManager();
    }
    return WebContainerInstanceManager.instance;
  }

  public getStatus(): WebContainerStatus {
    return this.status;
  }

  public setStatus(status: WebContainerStatus) {
    this.status = status;
  }

  public async getWebContainer(): Promise<WebContainer> {
    if (this.webcontainerInstance) {
      return this.webcontainerInstance;
    }

    if (!this.bootPromise) {
      this.bootPromise = (async () => {
        try {
          this.webcontainerInstance = await WebContainer.boot();
          webcontainerContext.loaded = true;
          return this.webcontainerInstance;
        } catch (error) {
          this.bootPromise = null;
          throw error;
        }
      })();
    }

    return this.bootPromise;
  }
}

export const webcontainerInstanceManager = WebContainerInstanceManager.getInstance();

// 导出 WebContainer 实例
export const webcontainer = !import.meta.env.SSR 
  ? webcontainerInstanceManager.getWebContainer()
  : undefined;

// 导出终端日志存储
export const terminalLogs: string[] = [];

export const initWebContainer = async () => {
  try {
    if (!webcontainerContext.loaded) {
      webcontainerStatus.set('idle');
      const container = await WebContainer.boot({
        workdirName: WORK_DIR_NAME
      });
      webcontainerContext.loaded = true;
      return container;
    }
  } catch (error) {
    webcontainerStatus.set('error');
    console.error('WebContainer initialization failed:', error);
    throw error;
  }
};
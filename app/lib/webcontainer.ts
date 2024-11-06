import { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';
import type { ITerminal } from '~/types/terminal';

// WebContainer 状态类型
export type WebContainerStatus = 'idle' | 'importing' | 'installing' | 'starting' | 'ready' | 'error';

// WebContainer 实例管理器
class WebContainerInstanceManager {
  private status: WebContainerStatus = 'idle';
  private webcontainerInstance: Promise<WebContainer>;

  constructor() {
    if (!import.meta.env.SSR) {
      this.webcontainerInstance = this.bootWebContainer();
    } else {
      // 在 SSR 环境下提供一个永远pending的Promise
      this.webcontainerInstance = new Promise(() => {});
    }
  }

  private async bootWebContainer(): Promise<WebContainer> {
    const container = await WebContainer.boot({ workdirName: WORK_DIR_NAME });
    webcontainerContext.loaded = true;
    return container;
  }

  public getStatus(): WebContainerStatus {
    return this.status;
  }

  public setStatus(status: WebContainerStatus) {
    this.status = status;
  }

  public async getWebContainer(): Promise<WebContainer> {
    return this.webcontainerInstance;
  }
}

// WebContainer 上下文
export interface WebContainerContext {
  loaded: boolean;
  terminals: ITerminal[];
}

export const webcontainerContext: WebContainerContext = {
  loaded: false,
  terminals: [],
};

// 导出实例管理器
export const webcontainerInstanceManager = new WebContainerInstanceManager();

// 导出 WebContainer 实例
export const webcontainer = !import.meta.env.SSR 
  ? webcontainerInstanceManager.getWebContainer()
  : undefined;

// 导出终端日志存储
export const terminalLogs: string[] = [];
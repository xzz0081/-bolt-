import { WebContainer } from '@webcontainer/api';
import { 
  webcontainerInstanceManager, 
  webcontainerContext,
  terminalLogs,
  type WebContainerStatus
} from '../webcontainer';
import { atom } from 'nanostores';
import type { ITerminal } from '~/types/terminal';
import JSZip from 'jszip';

export const webcontainerStatus = atom<WebContainerStatus>(webcontainerInstanceManager.getStatus());

function setWebcontainerStatus(status: WebContainerStatus) {
  webcontainerInstanceManager.setStatus(status);
  webcontainerStatus.set(status);
}

export class WebContainerManager {
  private static instance: WebContainerManager;
  private activeProcess: { [key: string]: any } = {};
  private mountedFiles: boolean = false;
  private shellProcess: any = null;

  private constructor() {
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        this.reset();
      });
    }
  }

  static getInstance(): WebContainerManager {
    if (!WebContainerManager.instance) {
      WebContainerManager.instance = new WebContainerManager();
    }
    return WebContainerManager.instance;
  }

  public async getWebContainer(): Promise<WebContainer> {
    return webcontainerInstanceManager.getWebContainer();
  }

  // 修改现有的importProject方法
  async importProject(file: File) {
    try {
      setWebcontainerStatus('importing');
      
      // 解压和处理文件
      const zip = new JSZip();
      const content = await file.arrayBuffer();
      const zipContent = await zip.loadAsync(content);
      
      const files: Record<string, any> = {};
      
      // 处理所有文件
      for (const [path, zipEntry] of Object.entries(zipContent.files)) {
        if (!zipEntry.dir) {
          const content = await zipEntry.async('uint8array');
          const normalizedPath = path.replace(/[^\w\-./]/g, '_');
          files[normalizedPath] = {
            file: {
              contents: content
            }
          };
        }
      }
      
      const webcontainer = await this.getWebContainer();
      await webcontainer.mount(files);
      
      this.mountedFiles = true;

      // 输出到所有终端
      const message = '项目导入成功,开始安装依赖...\n';
      webcontainerContext.terminals.forEach(terminal => {
        terminal.write(message);
      });
      
      // 自动安装依赖和启动
      await this.installDependencies();

      return true;
    } catch (error: any) {
      // 错误信息输出到终端
      const errorMsg = `项目导入失败: ${error.message}\n`;
      webcontainerContext.terminals.forEach(terminal => {
        terminal.write(errorMsg);
      });
      
      setWebcontainerStatus('error');
      throw error;
    }
  }

  // 安装依赖
  private async installDependencies() {
    try {
      setWebcontainerStatus('installing');
      
      const webcontainer = await this.getWebContainer();
      
      // 检查是否存在 package.json
      const packageJson = await webcontainer.fs.readFile('package.json', 'utf-8');
      const pkgContent = JSON.parse(packageJson);
      
      // 检测包管理器锁文件
      const hasYarnLock = await this.fileExists('yarn.lock');
      const hasPnpmLock = await this.fileExists('pnpm-lock.yaml');
      
      let command = 'npm';
      let installCmd = 'install';
      
      if (hasYarnLock) {
        command = 'yarn';
      } else if (hasPnpmLock) {
        command = 'pnpm';
      }
      
      // 输出安装信息
      const installMsg = `使用 ${command} 安装依赖...\n`;
      webcontainerContext.terminals.forEach(terminal => {
        terminal.write(installMsg);
      });
      
      const exitCode = await this.executeCommand(command, ['install']);
      
      if (exitCode === 0) {
        const startMsg = '依赖安装成功,正在启动应用...\n';
        webcontainerContext.terminals.forEach(terminal => {
          terminal.write(startMsg);
        });
        
        await this.startApplication(pkgContent);
      }
    } catch (error: any) {
      const errorMsg = `依赖安装失败: ${error.message}\n`;
      webcontainerContext.terminals.forEach(terminal => {
        terminal.write(errorMsg);
      });
      
      setWebcontainerStatus('error');
      throw error;
    }
  }

  // 其他方法保持不变...
}

// 导出单例
export const webcontainerManager = WebContainerManager.getInstance();
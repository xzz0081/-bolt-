import { WebContainer } from '@webcontainer/api';
import { 
  webcontainerInstanceManager, 
  webcontainerContext,
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
        this.cleanup();
      });
    }
  }

  private cleanup() {
    this.mountedFiles = false;
    this.shellProcess = null;
    this.activeProcess = {};
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

  async importProject(file: File) {
    try {
      console.log('开始导入项目:', file.name);
      setWebcontainerStatus('importing');
      
      const zip = new JSZip();
      console.log('解压文件...');
      const content = await file.arrayBuffer();
      const zipContent = await zip.loadAsync(content);
      
      const files: Record<string, any> = {};
      let fileCount = 0;
      
      console.log('处理文件...');
      for (const [path, zipEntry] of Object.entries(zipContent.files)) {
        if (!zipEntry.dir) {
          const content = await zipEntry.async('uint8array');
          const normalizedPath = path.replace(/[^\w\-./]/g, '_');
          files[normalizedPath] = {
            file: {
              contents: content
            }
          };
          fileCount++;
        }
      }
      
      console.log(`处理了 ${fileCount} 个文件`);
      
      console.log('获取 WebContainer 实例...');
      const webcontainer = await this.getWebContainer();
      
      console.log('挂载文件...');
      await webcontainer.mount(files);
      
      this.mountedFiles = true;

      const message = '项目导入成功,开始安装依赖...\n';
      console.log(message);
      webcontainerContext.terminals.forEach(terminal => {
        terminal.write(message);
      });
      
      console.log('开始安装依赖...');
      await this.installDependencies();

      console.log('项目导入完成');
      setWebcontainerStatus('ready');
      
    } catch (error: any) {
      console.error('项目导入失败:', error);
      setWebcontainerStatus('error');
      
      const errorMsg = `项目导入失败: ${error?.message || '未知错误'}\n`;
      webcontainerContext.terminals.forEach(terminal => {
        terminal.write(errorMsg);
      });
      
      throw error;
    }
  }

  async installDependencies() {
    try {
      console.log('获取 WebContainer 实例...');
      const webcontainer = await this.getWebContainer();
      
      console.log('启动 npm install...');
      const installProcess = await webcontainer.spawn('npm', ['install']);
      
      installProcess.output.pipeTo(
        new WritableStream({
          write: (data) => {
            console.log('安装输出:', data);
            webcontainerContext.terminals.forEach(terminal => {
              terminal.write(data);
            });
          }
        })
      );

      console.log('等待安装完成...');
      const exitCode = await installProcess.exit;
      
      if (exitCode !== 0) {
        throw new Error('Dependencies installation failed');
      }

      const successMsg = '依赖安装完成!\n';
      console.log(successMsg);
      webcontainerContext.terminals.forEach(terminal => {
        terminal.write(successMsg);
      });
    } catch (error) {
      console.error('安装依赖失败:', error);
      throw error;
    }
  }
}

export const webcontainerManager = WebContainerManager.getInstance();
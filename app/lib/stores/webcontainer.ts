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
      const directories = new Set<string>();
      
      // 辅助函数：规范化路径
      const normalizePath = (path: string): string => {
        return path
          .split('/')
          .filter(Boolean)
          .map(segment => {
            // 更严格的文件名规范化
            return segment
              .replace(/[^a-zA-Z0-9\-_\.]/g, '_') // 只允许字母、数字、横线、下划线和点
              .replace(/^\.+/g, '_')              // 替换开头的点
              .replace(/\.{2,}/g, '_')            // 替换多个连续的点
              .replace(/\.$/, '_')                // 替换结尾的点
              .toLowerCase();                     // 转换为小写
          })
          .join('_');                            // 使用下划线连接路径段
      };
      
      console.log('处理文件...');
      for (const [path, zipEntry] of Object.entries(zipContent.files)) {
        if (zipEntry.dir) {
          const normalizedPath = normalizePath(path);
          if (normalizedPath) {
            directories.add(normalizedPath);
          }
          continue;
        }
        
        // 处理文件
        const normalizedPath = normalizePath(path);
        if (normalizedPath) {
          try {
            const content = await zipEntry.async('uint8array');
            
            // 添加父目录到目录集合
            const dirPath = normalizedPath.split('_').slice(0, -1).join('_');
            if (dirPath) {
              let currentPath = '';
              for (const part of dirPath.split('_')) {
                currentPath = currentPath ? `${currentPath}_${part}` : part;
                directories.add(currentPath);
              }
            }
            
            // 添加文件到文件对象
            files[normalizedPath] = {
              file: {
                contents: content
              }
            };
          } catch (e) {
            console.warn(`跳过文件 ${path}: ${e}`);
          }
        }
      }

      // 检查文件结构
      if (Object.keys(files).length === 0) {
        throw new Error('ZIP文件中没有有效的文件');
      }

      console.log('获取 WebContainer 实例...');
      const webcontainer = await this.getWebContainer();
      
      // 清理现有文件系统
      try {
        await webcontainer.fs.rm('.', { recursive: true, force: true });
      } catch (e) {
        if (!(e as Error).message.includes('ENOENT')) {
          console.error('清理目录失败:', e);
        }
      }

      // 创建目录结构
      console.log('创建目录结构...');
      for (const dir of directories) {
        try {
          await webcontainer.fs.mkdir(dir, { recursive: true });
        } catch (e) {
          if (!(e as Error).message.includes('EEXIST')) {
            console.error(`创建目录 ${dir} 失败:`, e);
          }
        }
      }

      // 挂载文件
      console.log('挂载文件...');
      try {
        // 打印文件系统树以便调试
        console.log('文件系统树:', files);
        await webcontainer.mount(files);
      } catch (e) {
        console.error('挂载文件失败:', e);
        throw new Error('文件挂载失败: ' + (e as Error).message);
      }

      this.mountedFiles = true;

      // 检查并处理 package.json
      try {
        const packageJson = await webcontainer.fs.readFile('package.json', 'utf-8');
        console.log('找到 package.json:', packageJson);
        
        await this.setupShellAndDependencies(webcontainer);
        setWebcontainerStatus('ready');
      } catch (error) {
        throw new Error('无效的项目结构: 缺少 package.json 文件');
      }
      
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

  // 抽取依赖安装逻辑到单独的方法
  private async setupShellAndDependencies(webcontainer: WebContainer) {
    try {
      // 确保工作目录存在
      try {
        await webcontainer.fs.mkdir('/', { recursive: true });
      } catch (e) {
        // 忽略已存在错误
        if (!(e as Error).message.includes('EEXIST')) {
          throw e;
        }
      }

      // 启动 shell
      console.log('启动 shell...');
      const shellProcess = await webcontainer.spawn('jsh', {
        terminal: {
          cols: 80,
          rows: 24,
        }
      });

      shellProcess.output.pipeTo(
        new WritableStream({
          write: (data) => {
            webcontainerContext.terminals.forEach(terminal => {
              terminal.write(data);
            });
          }
        })
      );

      // 安装依赖
      console.log('开始安装依赖...');
      const installProcess = await webcontainer.spawn('npm', ['install']);
      
      installProcess.output.pipeTo(
        new WritableStream({
          write: (data) => {
            webcontainerContext.terminals.forEach(terminal => {
              terminal.write(data);
            });
          }
        })
      );

      const exitCode = await installProcess.exit;
      if (exitCode !== 0) {
        throw new Error('依赖安装失败');
      }

      // 启动开发服务器
      console.log('启动开发服务器...');
      const startProcess = await webcontainer.spawn('npm', ['run', 'start']);
      
      startProcess.output.pipeTo(
        new WritableStream({
          write: (data) => {
            webcontainerContext.terminals.forEach(terminal => {
              terminal.write(data);
            });
          }
        })
      );

    } catch (error) {
      console.error('Setup shell and dependencies failed:', error);
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
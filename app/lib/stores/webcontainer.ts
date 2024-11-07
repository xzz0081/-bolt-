import { WebContainer } from '@webcontainer/api';
import { 
  webcontainerInstanceManager, 
  webcontainerContext,
  type WebContainerStatus
} from '../webcontainer';
import { atom } from 'nanostores';
import type { ITerminal } from '~/types/terminal';
import JSZip from 'jszip';
import { workbenchStore } from '~/lib/stores/workbench';

export const webcontainerStatus = atom<WebContainerStatus>('idle');

export const setWebcontainerStatus = (status: WebContainerStatus) => {
  webcontainerStatus.set(status);
};

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
      
      // 首先验证是否存在 package.json
      let hasPackageJson = false;
      for (const path of Object.keys(zipContent.files)) {
        if (path.endsWith('package.json')) {
          hasPackageJson = true;
          break;
        }
      }

      if (!hasPackageJson) {
        throw new Error('无效的项目结构: 未找到 package.json 文件');
      }

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
          .join('/');                            // 使用斜杠连接路径段
      };
      
      // 构建文件系统树的辅助函数
      const buildFileSystemTree = (files: Record<string, any>) => {
        const tree: Record<string, any> = {};
        
        for (const [path, content] of Object.entries(files)) {
          const parts = path.split('/');
          let current = tree;
          
          // 处理路径中的每一段
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            // 如果是最后一个部分，添加文件
            if (i === parts.length - 1) {
              current[part] = content;
            } else {
              // 如果不是最后一个部分，创建或获取录
              if (!current[part]) {
                current[part] = { directory: {} };
              }
              current = current[part].directory;
            }
          }
        }
        
        return tree;
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
            const dirPath = normalizedPath.split('/').slice(0, -1).join('/');
            if (dirPath) {
              let currentPath = '';
              for (const part of dirPath.split('/')) {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
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

      // 构建并挂载文件系统树
      console.log('构建文件系统树...');
      const fileSystemTree = buildFileSystemTree(files);
      console.log('文件系统树:', fileSystemTree);

      // 挂载文件
      console.log('挂载文件...');
      try {
        await webcontainer.mount(fileSystemTree);
        
        // 验证文件是否正确挂载
        console.log('Reading files...');
        const mountedFiles = await webcontainer.fs.readdir('.', { 
          withFileTypes: true 
        });
        console.log('Files read:', mountedFiles);
        
      } catch (e) {
        console.error('挂载文件失败:', e);
        throw new Error('文件挂载失败: ' + (e as Error).message);
      }

      this.mountedFiles = true;

      // 更新工作区文件树
      try {
        console.log('Reading files for workbench...');
        const readDirRecursive = async (path: string): Promise<any[]> => {
          try {
            console.log('Reading directory:', path);
            const entries = await webcontainer.fs.readdir(path, { withFileTypes: true });
            console.log('Entries found in', path, ':', entries);
            
            const files = await Promise.all(
              entries.map(async (entry) => {
                const fullPath = path === '.' ? entry.name : `${path}/${entry.name}`;
                const isFile = entry.isFile();
                const isDir = entry.isDirectory();
                
                console.log('Processing entry:', {
                  path: fullPath,
                  isFile,
                  isDir
                });
                
                if (isDir) {
                  const children = await readDirRecursive(fullPath);
                  return [{
                    name: fullPath,
                    isFile: () => false,
                    isDirectory: () => true,
                    type: 'folder'
                  }, ...children];
                }
                
                // 如果是文件，尝试读取内容
                let content = '';
                try {
                  content = await webcontainer.fs.readFile(fullPath, 'utf-8');
                } catch (error) {
                  console.warn(`Could not read file content for ${fullPath}:`, error);
                }
                
                return {
                  name: fullPath,
                  isFile: () => true,
                  isDirectory: () => false,
                  type: 'file',
                  content
                };
              })
            );
            return files.flat();
          } catch (error) {
            console.error('Error reading directory:', path, error);
            throw error;
          }
        };

        const fileList = await readDirRecursive('.');
        console.log('Files read:', fileList);
        
        if (!fileList || fileList.length === 0) {
          console.warn('No files found in the container');
          return;
        }

        // 确保 workbenchStore 存在
        if (!workbenchStore) {
          throw new Error('workbenchStore is not initialized');
        }

        workbenchStore.setFiles(fileList);
        console.log('Files set in workbench store');

        // 验证文件是否被设置
        const filesInStore = workbenchStore.files.get();
        console.log('Files in store after setting:', filesInStore);

      } catch (e) {
        console.error('Failed to update file tree:', e);
        throw new Error('Failed to update workspace files: ' + (e as Error).message);
      }

      // 修改 package.json 检查逻辑
      try {
        const packageJsonExists = await webcontainer.fs.readFile('package.json', 'utf-8')
          .then(() => true)
          .catch(() => false);

        if (!packageJsonExists) {
          throw new Error('无法读取 package.json 文件');
        }
        
        await this.setupShellAndDependencies(webcontainer);
        setWebcontainerStatus('ready');
        
        // 确保工作区显示
        if (workbenchStore && workbenchStore.showWorkbench) {
          workbenchStore.showWorkbench.set(true);
        }
        
      } catch (error) {
        console.error('处理 package.json 失:', error);
        throw new Error('项目初始化失败: ' + (error as Error).message);
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

  // 修改 setupShellAndDependencies 方法
  private async setupShellAndDependencies(webcontainer: WebContainer) {
    try {
      // 启动 shell
      console.log('启动 shell...');
      this.shellProcess = await webcontainer.spawn('jsh', {
        terminal: {
          cols: 80,
          rows: 24,
        }
      });

      if (this.shellProcess) {
        this.shellProcess.output.pipeTo(
          new WritableStream({
            write: (data) => {
              webcontainerContext.terminals.forEach(terminal => {
                terminal.write(data);
              });
            }
          })
        );
      }

      // 安装依赖
      console.log('开始安装依赖...');
      setWebcontainerStatus('installing');
      
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
      setWebcontainerStatus('starting');
      
      // 检查 package.json 中的 scripts
      const packageJson = JSON.parse(await webcontainer.fs.readFile('package.json', 'utf-8'));
      console.log('package.json:', packageJson);
      
      const startScript = packageJson.scripts?.start || packageJson.scripts?.dev;
      
      if (!startScript) {
        throw new Error('未找到启动脚本 (start 或 dev)');
      }

      // 启动服务器
      const startProcess = await webcontainer.spawn('npm', ['run', startScript.includes('start') ? 'start' : 'dev']);
      
      startProcess.output.pipeTo(
        new WritableStream({
          write: (data) => {
            console.log('Server output:', data);
            webcontainerContext.terminals.forEach(terminal => {
              terminal.write(data);
            });
          }
        })
      );

      // 修改服务器检测逻辑
      let retries = 0;
      const maxRetries = 30;
      const checkInterval = 1000;

      while (retries < maxRetries) {
        try {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          
          // 使用 HTTP 请求替代 WebSocket 检测
          const response = await fetch('http://localhost:3000');
          
          // 即使返回 404 也认为服务器已启动
          if (response.status === 404 || response.ok) {
            console.log('Server started successfully');
            return;
          }

        } catch (error) {
          console.log(`Retry ${retries + 1}/${maxRetries}:`, error);
        }

        retries++;
      }

      throw new Error('服务器启动超时');

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
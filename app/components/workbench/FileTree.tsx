import { memo, useEffect, useMemo, useState, type ReactNode, useRef, useCallback } from 'react';
import type { FileMap } from '~/lib/stores/files';
import { classNames } from '~/utils/classNames';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';

const logger = createScopedLogger('FileTree');

const NODE_PADDING_LEFT = 8;
const DEFAULT_HIDDEN_FILES = [/\/node_modules\//, /\/\.next/, /\/\.astro/];

interface Props {
  files?: FileMap;
  selectedFile?: string;
  onFileSelect?: (filePath: string) => void;
  rootFolder?: string;
  hideRoot?: boolean;
  collapsed?: boolean;
  allowFolderSelection?: boolean;
  hiddenFiles?: Array<string | RegExp>;
  unsavedFiles?: Set<string>;
  className?: string;
}

export const FileTree = memo(
  ({
    files = {},
    onFileSelect,
    selectedFile,
    rootFolder,
    hideRoot = false,
    collapsed = true,
    allowFolderSelection = false,
    hiddenFiles,
    className,
    unsavedFiles,
  }: Props) => {
    console.log('FileTree render with:', {
      filesCount: Object.keys(files).length,
      selectedFile,
      rootFolder,
      hideRoot
    });
    
    renderLogger.trace('FileTree');

    const computedHiddenFiles = useMemo(() => [...DEFAULT_HIDDEN_FILES, ...(hiddenFiles ?? [])], [hiddenFiles]);

    const fileList = useMemo(() => {
      console.log('Building file list with files:', files);
      return buildFileList(files, rootFolder, hideRoot, computedHiddenFiles);
    }, [files, rootFolder, hideRoot, computedHiddenFiles]);

    const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => {
      if (collapsed) {
        return new Set(
          fileList
            .filter((item) => item.kind === 'folder')
            .map((item) => item.fullPath)
        );
      }
      return new Set<string>();
    });

    useEffect(() => {
      if (collapsed) {
        setCollapsedFolders(new Set(
          fileList
            .filter((item) => item.kind === 'folder')
            .map((item) => item.fullPath)
        ));
      }
    }, [fileList, collapsed]);

    const toggleCollapseState = (fullPath: string) => {
      setCollapsedFolders(prev => {
        const next = new Set(prev);
        if (next.has(fullPath)) {
          next.delete(fullPath);
        } else {
          next.add(fullPath);
        }
        return next;
      });
    };

    const isNodeVisible = useCallback((node: Node): boolean => {
      let currentPath = node.fullPath;
      while (currentPath.includes('/')) {
        currentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
        if (currentPath && collapsedFolders.has(currentPath)) {
          return false;
        }
      }
      return true;
    }, [collapsedFolders]);

    const filteredFileList = useMemo(() => {
      return fileList.filter(isNodeVisible);
    }, [fileList, isNodeVisible]);

    console.log('FileTree received files:', files);

    return (
      <div className={classNames('text-sm bg-transparent', className)}>
        {filteredFileList.map((fileOrFolder) => {
          switch (fileOrFolder.kind) {
            case 'file': {
              return (
                <File
                  key={fileOrFolder.id}
                  selected={selectedFile === fileOrFolder.fullPath}
                  file={fileOrFolder}
                  unsavedChanges={unsavedFiles?.has(fileOrFolder.fullPath)}
                  onClick={() => {
                    onFileSelect?.(fileOrFolder.fullPath);
                  }}
                />
              );
            }
            case 'folder': {
              return (
                <Folder
                  key={fileOrFolder.id}
                  folder={fileOrFolder}
                  selected={allowFolderSelection && selectedFile === fileOrFolder.fullPath}
                  collapsed={collapsedFolders.has(fileOrFolder.fullPath)}
                  onClick={() => {
                    toggleCollapseState(fileOrFolder.fullPath);
                  }}
                />
              );
            }
            default: {
              return undefined;
            }
          }
        })}
      </div>
    );
  },
);

export default FileTree;

interface FolderProps {
  folder: FolderNode;
  collapsed: boolean;
  selected?: boolean;
  onClick: () => void;
}

function Folder({ folder: { depth, name, fullPath }, collapsed, selected = false, onClick }: FolderProps) {
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (confirm(`Are you sure you want to delete ${name} and all its contents?`)) {
      try {
        await workbenchStore.deleteFile(fullPath);
      } catch (error) {
        toast.error(`Failed to delete ${name}`);
      }
    }
  };

  return (
    <NodeButton
      depth={depth}
      className={classNames('group relative', {
        'text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent': selected,
        'text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive hover:bg-bolt-elements-item-backgroundHover': !selected,
      })}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 w-full">
        <div 
          className={classNames('i-ph:caret-right-bold shrink-0 transition-transform', {
            'rotate-90': !collapsed
          })}
        />
        <div className="i-ph:folder-duotone shrink-0" />
        <span className="truncate">{name}</span>
      </div>
      
      <button
        className={classNames(
          'absolute right-2 top-1/2 -translate-y-1/2',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
          'text-bolt-elements-item-contentMuted hover:text-bolt-elements-item-contentActive',
          'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColor rounded'
        )}
        onClick={handleDelete}
        title="Delete folder"
      >
        <div className="i-ph:trash scale-90" />
      </button>
    </NodeButton>
  );
}

interface FileProps {
  file: FileNode;
  selected: boolean;
  unsavedChanges?: boolean;
  onClick: () => void;
}

function File({ file: { depth, name, fullPath }, selected = false, unsavedChanges = false, onClick }: FileProps) {
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (confirm(`Are you sure you want to delete ${name}?`)) {
      try {
        await workbenchStore.deleteFile(fullPath);
      } catch (error) {
        toast.error(`Failed to delete ${name}`);
      }
    }
  };

  return (
    <NodeButton
      depth={depth}
      className={classNames('group relative', {
        'text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent': selected,
        'text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive hover:bg-bolt-elements-item-backgroundHover': !selected,
      })}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 w-full">
        <div className="i-ph:file-duotone shrink-0" />
        <span className="truncate">{name}</span>
        {unsavedChanges && (
          <div className="i-ph:circle-fill scale-75 text-bolt-elements-warningForeground" />
        )}
      </div>

      <button
        className={classNames(
          'absolute right-2 top-1/2 -translate-y-1/2',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
          'text-bolt-elements-item-contentMuted hover:text-bolt-elements-item-contentActive',
          'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColor rounded'
        )}
        onClick={handleDelete}
        title="Delete file"
      >
        <div className="i-ph:trash scale-90" />
      </button>
    </NodeButton>
  );
}

interface ButtonProps {
  depth: number;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  iconClasses?: string;
}

function NodeButton({ depth, children, className, onClick }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center w-full px-2 py-1',
        'transition-colors duration-200 ease-in-out',
        'border-l-2 border-transparent',
        'bg-transparent',
        className
      )}
      style={{ paddingLeft: `${6 + depth * NODE_PADDING_LEFT}px` }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

type Node = FileNode | FolderNode;

interface BaseNode {
  id: number;
  depth: number;
  name: string;
  fullPath: string;
}

interface FileNode extends BaseNode {
  kind: 'file';
}

interface FolderNode extends BaseNode {
  kind: 'folder';
}

function buildFileList(
  files: FileMap,
  rootFolder = '/',
  hideRoot: boolean,
  hiddenFiles: Array<string | RegExp>,
): Node[] {
  console.log('Building file list with files:', files);
  const folderPaths = new Set<string>();
  const fileList: Node[] = [];

  let defaultDepth = 0;

  // 创建根文件夹
  if (rootFolder === '/' && !hideRoot) {
    defaultDepth = 1;
    fileList.push({ kind: 'folder', name: '/', depth: 0, id: 0, fullPath: '/' });
  }

  // 处理所有条目
  for (const [filePath, dirent] of Object.entries(files)) {
    if (!dirent) continue;

    // 规范化文件路径
    const normalizedPath = filePath.replace(/^\/+/, '');
    const segments = normalizedPath.split('/').filter(Boolean);
    const name = segments[segments.length - 1] || normalizedPath;
    
    // 检查是否应该隐藏
    if (isHiddenFile(normalizedPath, name, hiddenFiles)) {
      continue;
    }

    // 确保父文件夹存在
    let currentPath = '';
    for (let i = 0; i < segments.length - 1; i++) {
      currentPath += '/' + segments[i];
      if (!folderPaths.has(currentPath)) {
        folderPaths.add(currentPath);
        fileList.push({
          kind: 'folder',
          id: fileList.length,
          name: segments[i],
          fullPath: currentPath,
          depth: i + defaultDepth
        });
      }
    }

    // 添加文件或文件夹
    const isDirectory = typeof dirent.isDirectory === 'function' 
      ? dirent.isDirectory()
      : dirent.type === 'directory';

    fileList.push({
      kind: isDirectory ? 'folder' : 'file',
      id: fileList.length,
      name,
      fullPath: normalizedPath,
      depth: segments.length - 1 + defaultDepth
    });
  }

  // 在返回前添加验证和日志
  if (fileList.length === 0) {
    console.warn('Generated file list is empty');
  } else {
    console.log('Generated file list count:', fileList.length);
  }

  const sortedList = sortFileList(rootFolder, fileList, hideRoot);
  console.log('Final sorted file list:', sortedList);
  return sortedList;
}

function isHiddenFile(filePath: string, fileName: string, hiddenFiles: Array<string | RegExp>) {
  // 忽略以点开头的文件和文件夹
  if (fileName.startsWith('.') || fileName.startsWith('_')) {
    return true;
  }

  return hiddenFiles.some((pathOrRegex) => {
    if (typeof pathOrRegex === 'string') {
      return filePath === pathOrRegex || fileName === pathOrRegex;
    }
    return pathOrRegex.test(filePath);
  });
}

/**
 * Sorts the given list of nodes into a tree structure (still a flat list).
 *
 * This function organizes the nodes into a hierarchical structure based on their paths,
 * with folders appearing before files and all items sorted alphabetically within their level.
 *
 * @note This function mutates the given `nodeList` array for performance reasons.
 *
 * @param rootFolder - The path of the root folder to start the sorting from.
 * @param nodeList - The list of nodes to be sorted.
 *
 * @returns A new array of nodes sorted in depth-first order.
 */
function sortFileList(rootFolder: string, nodeList: Node[], hideRoot: boolean): Node[] {
  logger.trace('sortFileList');

  // 预处理：移除不需要的路径前缀
  const normalizedRootFolder = rootFolder.replace(/^\/+|\/+$/g, '');
  
  // 按类型和名称预排序
  nodeList.sort((a, b) => {
    // 首先按类型排序（文件夹在前）
    if (a.kind !== b.kind) {
      return a.kind === 'folder' ? -1 : 1;
    }
    // 然后按名称排序（不区分大小写）
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  const nodeMap = new Map<string, Node>();
  const childrenMap = new Map<string, Node[]>();

  // 构建节点映射和父子关系
  for (const node of nodeList) {
    nodeMap.set(node.fullPath, node);

    const parentPath = node.fullPath.substring(0, node.fullPath.lastIndexOf('/'));
    if (parentPath && parentPath !== normalizedRootFolder) {
      if (!childrenMap.has(parentPath)) {
        childrenMap.set(parentPath, []);
      }
      childrenMap.get(parentPath)?.push(node);
    }
  }

  const sortedList: Node[] = [];

  // 深度优先遍历
  const traverse = (path: string) => {
    const node = nodeMap.get(path);
    if (node) {
      sortedList.push(node);
    }

    const children = childrenMap.get(path);
    if (children) {
      children.sort(compareNodes);
      for (const child of children) {
        traverse(child.fullPath);
      }
    }
  };

  // 开始遍历
  if (hideRoot) {
    const rootChildren = Array.from(nodeMap.values())
      .filter(node => !node.fullPath.includes('/'))
      .sort(compareNodes);
    
    for (const child of rootChildren) {
      traverse(child.fullPath);
    }
  } else {
    traverse(normalizedRootFolder);
  }

  return sortedList;
}

function compareNodes(a: Node, b: Node): number {
  if (a.kind !== b.kind) {
    return a.kind === 'folder' ? -1 : 1;
  }

  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

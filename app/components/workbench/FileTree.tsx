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

    const [collapsedFolders, setCollapsedFolders] = useState(new Set<string>());

    useEffect(() => {
      if (collapsedFolders.size > 0) return;
      
      const allFolders = new Set<string>();
      
      for (const item of fileList) {
        if (item.kind === 'folder') {
          allFolders.add(item.fullPath);
        }
        const parts = item.fullPath.split('/');
        let path = '';
        for (let i = 0; i < parts.length - 1; i++) {
          path = path ? `${path}/${parts[i]}` : parts[i];
          allFolders.add(path);
        }
      }
      
      if (allFolders.size > 0) {
        setCollapsedFolders(allFolders);
      }
    }, [fileList, collapsedFolders]);

    const toggleCollapseState = (fullPath: string) => {
      if (isFolderEmpty(fullPath, files)) {
        return;
      }

      setCollapsedFolders(prevSet => {
        const newSet = new Set(prevSet);
        if (newSet.has(fullPath)) {
          newSet.delete(fullPath);
        } else {
          newSet.add(fullPath);
        }
        return newSet;
      });
    };

    const filteredFileList = useMemo(() => {
      const list = [];
      const processedPaths = new Set<string>();

      for (const fileOrFolder of fileList) {
        const pathSegments = fileOrFolder.fullPath.split('/');
        let isParentCollapsed = false;
        
        for (let i = 0; i < pathSegments.length - 1; i++) {
          const parentPath = pathSegments.slice(0, i + 1).join('/');
          if (parentPath && collapsedFolders.has(parentPath)) {
            isParentCollapsed = true;
            break;
          }
        }

        if (isParentCollapsed) {
          continue;
        }

        if (!processedPaths.has(fileOrFolder.fullPath)) {
          list.push(fileOrFolder);
          processedPaths.add(fileOrFolder.fullPath);
        }
      }

      return list;
    }, [fileList, collapsedFolders]);

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

  if (rootFolder === '/' && !hideRoot) {
    defaultDepth = 1;
    fileList.push({ kind: 'folder', name: '/', depth: 0, id: 0, fullPath: '/' });
  }

  for (const [filePath, dirent] of Object.entries(files)) {
    if (!dirent) continue;

    const normalizedPath = filePath.replace(/^\/+/, '');
    const segments = normalizedPath.split('/').filter(Boolean);
    const name = segments[segments.length - 1] || normalizedPath;
    
    if (isHiddenFile(normalizedPath, name, hiddenFiles)) {
      continue;
    }

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

    const isDirectory = dirent.type === 'folder';

    fileList.push({
      kind: isDirectory ? 'folder' : 'file',
      id: fileList.length,
      name,
      fullPath: normalizedPath,
      depth: segments.length - 1 + defaultDepth
    });
  }

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

function sortFileList(rootFolder: string, nodeList: Node[], hideRoot: boolean): Node[] {
  logger.trace('sortFileList');

  const normalizedRootFolder = rootFolder.replace(/^\/+|\/+$/g, '');
  
  nodeList.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'folder' ? -1 : 1;
    }
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  const nodeMap = new Map<string, Node>();
  const childrenMap = new Map<string, Node[]>();

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

function isFolderEmpty(folderPath: string, files: FileMap): boolean {
  return !Object.entries(files).some(([path, dirent]) => {
    if (path === folderPath) return false;
    return path.startsWith(folderPath + '/') && dirent !== undefined;
  });
}

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
    renderLogger.trace('FileTree');

    const computedHiddenFiles = useMemo(() => [...DEFAULT_HIDDEN_FILES, ...(hiddenFiles ?? [])], [hiddenFiles]);

    const fileList = useMemo(() => {
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
  const folderPaths = new Set<string>();
  const fileList: Node[] = [];

  let defaultDepth = 0;

  if (rootFolder === '/' && !hideRoot) {
    defaultDepth = 1;
    fileList.push({ kind: 'folder', name: '/', depth: 0, id: 0, fullPath: '/' });
  }

  for (const [filePath, dirent] of Object.entries(files)) {
    const segments = filePath.split('/').filter((segment) => segment);
    const fileName = segments.at(-1);

    if (!fileName || isHiddenFile(filePath, fileName, hiddenFiles)) {
      continue;
    }

    let currentPath = '';

    let i = 0;
    let depth = 0;

    while (i < segments.length) {
      const name = segments[i];
      const fullPath = (currentPath += `/${name}`);

      if (!fullPath.startsWith(rootFolder) || (hideRoot && fullPath === rootFolder)) {
        i++;
        continue;
      }

      if (i === segments.length - 1 && dirent?.type === 'file') {
        fileList.push({
          kind: 'file',
          id: fileList.length,
          name,
          fullPath,
          depth: depth + defaultDepth,
        });
      } else if (!folderPaths.has(fullPath)) {
        folderPaths.add(fullPath);

        fileList.push({
          kind: 'folder',
          id: fileList.length,
          name,
          fullPath,
          depth: depth + defaultDepth,
        });
      }

      i++;
      depth++;
    }
  }

  return sortFileList(rootFolder, fileList, hideRoot);
}

function isHiddenFile(filePath: string, fileName: string, hiddenFiles: Array<string | RegExp>) {
  return hiddenFiles.some((pathOrRegex) => {
    if (typeof pathOrRegex === 'string') {
      return fileName === pathOrRegex;
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

  const nodeMap = new Map<string, Node>();
  const childrenMap = new Map<string, Node[]>();

  // pre-sort nodes by name and type
  nodeList.sort((a, b) => compareNodes(a, b));

  for (const node of nodeList) {
    nodeMap.set(node.fullPath, node);

    const parentPath = node.fullPath.slice(0, node.fullPath.lastIndexOf('/'));

    if (parentPath !== rootFolder.slice(0, rootFolder.lastIndexOf('/'))) {
      if (!childrenMap.has(parentPath)) {
        childrenMap.set(parentPath, []);
      }

      childrenMap.get(parentPath)?.push(node);
    }
  }

  const sortedList: Node[] = [];

  const depthFirstTraversal = (path: string): void => {
    const node = nodeMap.get(path);

    if (node) {
      sortedList.push(node);
    }

    const children = childrenMap.get(path);

    if (children) {
      for (const child of children) {
        if (child.kind === 'folder') {
          depthFirstTraversal(child.fullPath);
        } else {
          sortedList.push(child);
        }
      }
    }
  };

  if (hideRoot) {
    // if root is hidden, start traversal from its immediate children
    const rootChildren = childrenMap.get(rootFolder) || [];

    for (const child of rootChildren) {
      depthFirstTraversal(child.fullPath);
    }
  } else {
    depthFirstTraversal(rootFolder);
  }

  return sortedList;
}

function compareNodes(a: Node, b: Node): number {
  if (a.kind !== b.kind) {
    return a.kind === 'folder' ? -1 : 1;
  }

  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

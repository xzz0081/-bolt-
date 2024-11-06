import type { FileSystemTree } from '@webcontainer/api';
import { Buffer } from 'node:buffer';

export async function createFileSystemTree(files: Record<string, string>): Promise<FileSystemTree> {
  const tree: FileSystemTree = {};
  
  for (const [path, content] of Object.entries(files)) {
    const isDirectory = path.endsWith('/');
    
    if (isDirectory) {
      tree[path] = {
        directory: {}
      };
    } else {
      tree[path] = {
        file: {
          contents: Buffer.from(content)
        }
      };
    }
  }
  
  return tree;
}

export function normalizeFilePath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/, '');
} 
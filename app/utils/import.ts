import { projectStore } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';
import JSZip from 'jszip';
import * as tar from 'tar-js';
import { Buffer } from 'node:buffer';

export async function importProject(file: File) {
  try {
    projectStore.setImporting(true);
    
    // Validate file
    if (!file.name.endsWith('.zip') && !file.name.endsWith('.tar.gz')) {
      throw new Error('Invalid file format. Only .zip and .tar.gz files are supported.');
    }

    // Read file content
    const buffer = await file.arrayBuffer();
    
    let files: Record<string, Uint8Array> = {};

    // Extract archive based on file type
    if (file.name.endsWith('.zip')) {
      // Handle ZIP files
      const zip = new JSZip();
      const contents = await zip.loadAsync(buffer);
      
      for (const [path, zipEntry] of Object.entries(contents.files)) {
        if (!zipEntry.dir) {
          const content = await zipEntry.async('uint8array');
          files[path] = content;
        }
      }
    } else {
      // Handle TAR.GZ files
      const extracted = await tar.extract(new Uint8Array(buffer));
      files = extracted;
    }

    // Process and add files to workbench
    for (const [path, content] of Object.entries(files)) {
      await workbenchStore.addFile(path, content);
    }
    
    // Show workbench after successful import
    workbenchStore.showWorkbench.set(true);
    
  } catch (error) {
    projectStore.setError(error instanceof Error ? error.message : 'Failed to import project');
    console.error('Project import failed:', error);
  } finally {
    projectStore.setImporting(false);
  }
} 
import { projectStore } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainerContext } from '~/lib/webcontainer';
import { WebContainerManager } from '~/lib/stores/webcontainer';

export async function importProject(file: File) {
  try {
    projectStore.setImporting(true);
    
    // Validate file
    if (!file.name.endsWith('.zip') && !file.name.endsWith('.tar.gz')) {
      throw new Error('Invalid file format. Only .zip and .tar.gz files are supported.');
    }

    const webContainerManager = WebContainerManager.getInstance();
    await webContainerManager.importProject(file);

    // Show workbench after successful import
    workbenchStore.showWorkbench.set(true);
    
  } catch (error) {
    projectStore.setError(error instanceof Error ? error.message : 'Failed to import project');
    console.error('Project import failed:', error);
  } finally {
    projectStore.setImporting(false);
  }
} 
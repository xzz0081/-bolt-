import { projectStore } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainerContext } from '~/lib/webcontainer';
import { WebContainerManager } from '~/lib/stores/webcontainer';

export async function importProject(file: File) {
  try {
    webcontainerStatus.set('idle');
    projectStore.setImporting(true);
    
    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File size exceeds 50MB limit');
    }

    const webContainerManager = WebContainerManager.getInstance();
    await webContainerManager.importProject(file);

    webcontainerStatus.set('ready');
    workbenchStore.showWorkbench.set(true);
    
  } catch (error) {
    webcontainerStatus.set('error');
    projectStore.setError(error instanceof Error ? error.message : 'Failed to import project');
    console.error('Project import failed:', error);
    throw error;
  } finally {
    projectStore.setImporting(false);
  }
} 
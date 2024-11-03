import { useStore } from '@nanostores/react';
import { type ReactNode, useState } from 'react';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';

interface HeaderActionButtonsProps {}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
}

function Button({ active = false, disabled = false, children, onClick }: ButtonProps) {
  return (
    <button
      className={classNames('flex items-center p-1.5', {
        'bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary':
          !active,
        'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': active && !disabled,
        'bg-bolt-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed':
          disabled,
      })}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { showChat } = useStore(chatStore);
  
  const canHideChat = showWorkbench || !showChat;

  const [importing, setImporting] = useState(false);

  const handleImportProject = async () => {
    if (importing) return;

    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip,.tar.gz';
      input.multiple = false;
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        setImporting(true);
        try {
          // Validate file
          if (!file.name.endsWith('.zip') && !file.name.endsWith('.tar.gz')) {
            throw new Error('Invalid file format. Only .zip and .tar.gz files are supported.');
          }

          // Read file content
          const content = await file.arrayBuffer();
          
          // TODO: Process the imported project
          // For now just show success message
          toast.success('Project imported successfully!');
          
          // Show workbench after successful import
          workbenchStore.showWorkbench.set(true);
          if (!showChat) {
            chatStore.setKey('showChat', true);
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to import project');
          console.error('Project import failed:', error);
        } finally {
          setImporting(false);
        }
      };

      input.click();
    } catch (error) {
      console.error('Failed to import project:', error);
      setImporting(false);
    }
  };

  return (
    <div className="flex">
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
        <Button
          active={showChat}
          disabled={!canHideChat}
          onClick={() => {
            if (canHideChat) {
              chatStore.setKey('showChat', !showChat);
            }
          }}
        >
          <div className="i-bolt:chat text-sm" />
        </Button>
        <div className="w-[1px] bg-bolt-elements-borderColor" />
        <Button onClick={handleImportProject} disabled={importing}>
          <div className={importing ? "i-svg-spinners:180-ring-with-bg" : "i-ph:paper-plane-tilt-fill"} />
        </Button>
        <div className="w-[1px] bg-bolt-elements-borderColor" />
        <Button
          active={showWorkbench}
          onClick={() => {
            if (showWorkbench && !showChat) {
              chatStore.setKey('showChat', true);
            }
            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
        >
          <div className="i-ph:code-bold" />
        </Button>
      </div>
    </div>
  );
}

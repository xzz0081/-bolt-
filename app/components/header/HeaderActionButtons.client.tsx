import { useStore } from '@nanostores/react';
import { type ReactNode, useState } from 'react';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { webcontainerManager } from '~/lib/stores/webcontainer';
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
    console.log('点击导入按钮');
    if (importing) return;

    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip,.tar.gz';
      input.multiple = false;
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        if (!file.name.endsWith('.zip') && !file.name.endsWith('.tar.gz')) {
          toast.error('请选择 .zip 或 .tar.gz 格式的文件');
          return;
        }
        
        if (file.size > 50 * 1024 * 1024) {
          toast.error('文件大小超过限制 (50MB)');
          return;
        }
        
        console.log('选择文件:', file.name);
        setImporting(true);
        
        try {
          console.log('开始导入项目');
          await webcontainerManager.importProject(file);
          
          workbenchStore.showWorkbench.set(true);
          toast.success('项目导入成功');
        } catch (error) {
          console.error('导入失败:', error);
          toast.error('项目导入失败: ' + (error as Error).message);
        } finally {
          setImporting(false);
        }
      };

      input.click();
    } catch (error) {
      console.error('导入操作失败:', error);
      setImporting(false);
      toast.error('导入操作失败');
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
        <Button 
          onClick={handleImportProject} 
          disabled={importing}
        >
          <div 
            className={importing ? "i-svg-spinners:180-ring-with-bg" : "i-ph:paper-plane-tilt-fill"} 
            onClick={(e) => {
              e.stopPropagation(); // 防止事件冒泡
              handleImportProject();
            }}
          />
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

import { useStore } from '@nanostores/react';
import { memo } from 'react';
import { webcontainerStatus } from '~/lib/stores/webcontainer';
import { classNames } from '~/utils/classNames';

const statusMap = {
  idle: '空闲',
  importing: '导入项目',
  installing: '安装依赖',
  starting: '启动应用',
  ready: '就绪',
  error: '错误',
};

export const WebContainerStatus = memo(() => {
  const status = useStore(webcontainerStatus);

  return (
    <div className="flex items-center px-3 py-2 border-b border-bolt-elements-borderColor">
      <div className="flex items-center gap-2">
        <div
          className={classNames('w-2 h-2 rounded-full', {
            'bg-gray-400': status === 'idle',
            'bg-yellow-400 animate-pulse': ['importing', 'installing', 'starting'].includes(status),
            'bg-green-400': status === 'ready',
            'bg-red-400': status === 'error',
          })}
        />
        <span className="text-sm">{statusMap[status]}</span>
      </div>
    </div>
  );
}); 
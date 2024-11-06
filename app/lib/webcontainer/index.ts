import { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';

interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

export let webcontainer: Promise<WebContainer>;

if (!import.meta.env.SSR) {
  webcontainer = 
    import.meta.hot?.data.webcontainer ??
    Promise.resolve()
      .then(async () => {
        // 确保在启动前等待 DOM 内容加载完成
        if (document.readyState !== 'complete') {
          await new Promise(resolve => {
            window.addEventListener('load', resolve, { once: true });
          });
        }
        
        return WebContainer.boot({
          workdirName: WORK_DIR_NAME,
          // 添加其他必要的配置
          baseUrl: window.location.origin,
          useSecureWebSocket: window.location.protocol === 'https:',
        });
      })
      .then((webcontainer) => {
        webcontainerContext.loaded = true;
        return webcontainer;
      });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = webcontainer;
  }
}

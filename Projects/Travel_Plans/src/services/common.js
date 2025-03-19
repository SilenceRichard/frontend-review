import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export const { chromium } = require('playwright');

/**
 * Auto scroll function for capturing the entire page
 */
export async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 200;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
  
  // Ensure scroll to bottom
  await page.keyboard.press('End');
  await page.waitForTimeout(2000);
}

/**
 * 设置浏览器指纹以避免检测
 */
export async function setupBrowserFingerprint(page) {
  // 覆盖WebGL指纹
  await page.addInitScript(() => {
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      // 使用更常见的GPU渲染器信息
      if (parameter === 37445) {
        return 'Intel Inc.';
      }
      if (parameter === 37446) {
        return 'Intel Iris Graphics 6100';
      }
      return getParameter.apply(this, arguments);
    };
  });
  
  // 覆盖navigator属性
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false
    });
    
    Object.defineProperty(navigator, 'languages', {
      get: () => ['zh-CN', 'zh', 'en-US', 'en']
    });
    
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        return [
          {
            name: 'Chrome PDF Plugin',
            filename: 'internal-pdf-viewer',
            description: 'Portable Document Format'
          },
          {
            name: 'Chrome PDF Viewer',
            filename: 'internal-pdf-viewer',
            description: ''
          },
          {
            name: 'Native Client',
            filename: 'internal-nacl-plugin',
            description: ''
          }
        ];
      }
    });
  });
}

/**
 * 添加随机鼠标移动以模拟真实用户
 */
export async function addRandomMouseMovements(page) {
  // 在整个页面上随机移动鼠标
  const { width, height } = await page.evaluate(() => {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  });
  
  // 移动5-10次
  const moveCount = Math.floor(Math.random() * 5) + 5;
  
  for (let i = 0; i < moveCount; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    
    await page.mouse.move(x, y);
    await page.waitForTimeout(Math.random() * 100 + 50);
  }
}

/**
 * 模拟更复杂的用户行为以绕过登录检测
 */
export async function simulateHumanBehavior(page) {
  // 1. 随机鼠标移动
  await addRandomMouseMovements(page);
  
  // 2. 随机滚动页面
  await page.evaluate(() => {
    const scrollAmount = Math.floor(Math.random() * 300) + 100;
    window.scrollBy(0, scrollAmount);
  });
  await page.waitForTimeout(Math.random() * 1000 + 500);
  
  // 3. 随机选择一个链接或图片悬停（但不点击）
  await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('a, img, button')).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && 
             rect.top >= 0 && rect.left >= 0 &&
             rect.top < window.innerHeight && rect.left < window.innerWidth;
    });
    
    if (elements.length > 0) {
      const randomElement = elements[Math.floor(Math.random() * elements.length)];
      // 只是触发悬停事件，不点击
      const hoverEvent = new MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      randomElement.dispatchEvent(hoverEvent);
    }
  });
  await page.waitForTimeout(Math.random() * 800 + 200);
  
  // 4. 模拟一些键盘事件，如按下tab键
  const tabCount = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < tabCount; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(Math.random() * 300 + 100);
  }
  
  // 5. 随机暂停一段时间，模拟用户阅读页面
  await page.waitForTimeout(Math.random() * 2000 + 1000);
}

/**
 * 尝试关闭弹窗或模态框
 */
export async function tryClosePopups(page, verbose = false) {
  // 尝试点击常见的关闭按钮
  const closeButtonClicked = await page.evaluate(() => {
    // 可能的关闭按钮选择器列表
    const closeSelectors = [
      '.close', '.close-btn', '.btn-close', '.popup-close',
      '[class*="close"]', '[aria-label="关闭"]', '[title="关闭"]',
      '.modal-close', '.dialog-close', '.cancel', '.cancel-btn',
      'button.cancel', 'button[class*="close"]', '.iconfont-close',
      '.icon-close', '.el-dialog__close', '.ant-modal-close'
    ];
    
    for (const selector of closeSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (el.offsetParent !== null) { // 元素可见
          el.click();
          return true;
        }
      }
    }
    
    // 尝试点击任何包含"关闭"或"取消"文本的按钮或链接
    const textButtons = Array.from(document.querySelectorAll('button, a')).filter(el => {
      const text = el.textContent.toLowerCase();
      return text.includes('关闭') || text.includes('取消') || 
             text.includes('close') || text.includes('cancel');
    });
    
    if (textButtons.length > 0) {
      textButtons[0].click();
      return true;
    }
    
    return false;
  });
  
  if (closeButtonClicked && verbose) {
    console.error('成功关闭弹窗');
  }
  
  return closeButtonClicked;
} 
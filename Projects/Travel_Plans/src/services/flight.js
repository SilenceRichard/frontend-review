import { join } from 'path';
import { homedir } from 'os';
import { writeFile, readFile } from 'fs/promises';
import { chromium, autoScroll, setupBrowserFingerprint, simulateHumanBehavior } from './common.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 基础的城市到机场代码映射（向后兼容）
const basicCityToAirportCode = {

};

// 读取并合并机场代码文件
let fullCityToAirportCode = {...basicCityToAirportCode};

// 从JSON文件加载机场代码
async function loadAirportCodes() {
  try {
    // 读取中国机场代码
    const chinaAirportCodePath = join(__dirname, '..', 'airport_codes.json');
    
    if (existsSync(chinaAirportCodePath)) {
      const chinaData = JSON.parse(await readFile(chinaAirportCodePath, 'utf8'));
      if (chinaData && chinaData['中国']) {
        Object.entries(chinaData['中国']).forEach(([city, codes]) => {
          if (Array.isArray(codes) && codes.length > 0) {
            fullCityToAirportCode[city.toLowerCase()] = codes[0]; // 使用第一个机场代码
          }
        });
      }
    }
    
    // 读取国际机场代码
    const internationalAirportCodePath = join(__dirname, '..', 'international_airport_codes.json');
    
    if (existsSync(internationalAirportCodePath)) {
      const intlData = JSON.parse(await readFile(internationalAirportCodePath, 'utf8'));
      if (intlData) {
        Object.entries(intlData).forEach(([country, cities]) => {
          Object.entries(cities).forEach(([city, codes]) => {
            if (Array.isArray(codes) && codes.length > 0) {
              fullCityToAirportCode[city.toLowerCase()] = codes[0]; // 使用第一个机场代码
            }
          });
        });
      }
    }
    
    console.log(`已加载 ${Object.keys(fullCityToAirportCode).length} 个城市的机场代码`);
  } catch (error) {
    console.error(`加载机场代码文件失败: ${error.message}`);
    // 加载失败时仍使用基础映射
  }
}

// 初始化时加载机场代码
loadAirportCodes();

// 导出所有城市到机场代码的映射
export const cityToAirportCode = fullCityToAirportCode;

// 查询城市对应的机场代码
export async function lookupAirportCode(city) {
  // 确保已经加载了机场代码
  if (Object.keys(fullCityToAirportCode).length <= Object.keys(basicCityToAirportCode).length) {
    await loadAirportCodes();
  }
  
  const lowercaseCity = city.toLowerCase();
  
  // 直接查找
  if (fullCityToAirportCode[lowercaseCity]) {
    return fullCityToAirportCode[lowercaseCity];
  }
  
  // 尝试在JSON文件中查找
  try {
    // 读取中国机场代码
    const chinaAirportCodePath = join(__dirname, '..', 'airport_codes.json');
    if (existsSync(chinaAirportCodePath)) {
      const chinaData = JSON.parse(await readFile(chinaAirportCodePath, 'utf8'));
      
      if (chinaData && chinaData['中国']) {
        for (const [cityName, codes] of Object.entries(chinaData['中国'])) {
          if (cityName.toLowerCase() === lowercaseCity && Array.isArray(codes) && codes.length > 0) {
            fullCityToAirportCode[lowercaseCity] = codes[0]; // 缓存结果
            return codes[0];
          }
        }
      }
    }
    
    // 读取国际机场代码
    const internationalAirportCodePath = join(__dirname, '..', 'international_airport_codes.json');
    if (existsSync(internationalAirportCodePath)) {
      const intlData = JSON.parse(await readFile(internationalAirportCodePath, 'utf8'));
      
      for (const [country, cities] of Object.entries(intlData)) {
        for (const [cityName, codes] of Object.entries(cities)) {
          if (cityName.toLowerCase() === lowercaseCity && Array.isArray(codes) && codes.length > 0) {
            fullCityToAirportCode[lowercaseCity] = codes[0]; // 缓存结果
            return codes[0];
          }
        }
      }
    }
  } catch (error) {
    console.error(`查询机场代码时出错: ${error.message}`);
  }
  
  return null; // 未找到对应机场代码
}

/**
 * Get structured flight information from Ctrip website
 */
export async function getFlightInfo(from, to, date, options = {}) {
  // 确保机场代码已加载
  if (Object.keys(fullCityToAirportCode).length <= Object.keys(basicCityToAirportCode).length) {
    await loadAirportCodes();
  }
  
  // Convert city names to airport codes
  const fromCode = fullCityToAirportCode[from.toLowerCase()] || from.toLowerCase();
  const toCode = fullCityToAirportCode[to.toLowerCase()] || to.toLowerCase();
  
  // Set default options
  const defaultOptions = {
    headless: false,
    timeout: 60000,
    saveScreenshot: true,
    verbose: false
  };
  
  const config = {...defaultOptions, ...options};
  
  if (config.verbose) {
    console.error(`开始搜索 ${from}(${fromCode}) 到 ${to}(${toCode}) 在 ${date} 的航班...`);
  }
  
  const browser = await chromium.launch({ 
    headless: config.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080'
    ],
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    deviceScaleFactor: 1,
    hasTouch: false,
    javaScriptEnabled: true,
    locale: 'zh-CN',
    permissions: ['geolocation']
  });
  const page = await context.newPage();
  
  try {
    // Build Ctrip flight page URL
    const url = `https://flights.ctrip.com/online/list/oneway-${fromCode}-${toCode}?depdate=${date}&cabin=y_s&adult=1&child=0&infant=0`;
    
    if (config.verbose) {
      console.error(`正在访问 ${url}`);
    }
    
    // 设置浏览器指纹以避免检测
    await setupBrowserFingerprint(page);
    
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: config.timeout 
    });
    
    // Wait for page to load
    if (config.verbose) {
      console.error(`页面已加载，等待内容渲染...`);
    }
    
    // 模拟真实用户行为
    await simulateHumanBehavior(page);
    
    await page.waitForTimeout(10000);
    
    // 检测是否有验证码
    const hasCaptcha = await page.evaluate(() => {
      return !!document.querySelector('.CAPTCHA') || 
             !!document.querySelector('.verify-wrap') ||
             !!document.querySelector('[data-reactid*="CAPTCHA"]') ||
             !!document.querySelector('.captcha-wrapper') ||
             !!document.querySelector('.verify-code') ||
             (document.body.innerText.includes('验证码') && document.body.innerText.includes('请输入'));
    });
    
    if (hasCaptcha) {
      if (config.verbose) {
        console.error('检测到验证码，尝试绕过...');
      }
      
      // 可能需要手动处理验证码或重试
      await simulateHumanBehavior(page);
      
      // 如果验证码持续存在，尝试刷新页面
      const stillHasCaptcha = await page.evaluate(() => {
        return !!document.querySelector('.CAPTCHA') || 
               !!document.querySelector('.verify-wrap') ||
               !!document.querySelector('.captcha-wrapper') ||
               (document.body.innerText.includes('验证码') && document.body.innerText.includes('请输入'));
      });
      
      if (stillHasCaptcha) {
        if (config.verbose) {
          console.error('验证码持续存在，刷新页面重试...');
        }
        await page.reload({ waitUntil: 'networkidle', timeout: config.timeout });
        await page.waitForTimeout(8000);
        await simulateHumanBehavior(page);
      }
    }
    
    // Scroll to bottom of page
    if (config.verbose) {
      console.error(`正在滚动页面以加载更多航班...`);
    }
    await autoScroll(page);
    
    if (config.verbose) {
      console.error(`开始提取航班信息...`);
    }
    
    // Get all flight information in structured format
    const flightDetails = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.flight-item, [class*="list-item"]'));
      
      return items.map(item => {
        // Return the HTML content of each flight item
        return {
          html: item.outerHTML
        };
      }).filter(flight => flight.html && flight.html.length > 0);
    });
    
    if (config.verbose) {
      console.error(`找到 ${flightDetails.length} 个航班，正在生成HTML...`);
    }
    
    // Generate HTML from flight details
    const htmlOutput = generateHtmlOutput(flightDetails, from, to, date);
    
    // Save HTML file
    const filename = `flights-${fromCode}-${toCode}-${date}.html`;
    const downloadsPath = join(homedir(), 'Documents', 'travel');
    const htmlPath = join(downloadsPath, filename);
    await writeFile(htmlPath, htmlOutput);
    
    if (config.verbose) {
      console.error(`HTML文件已保存至: ${htmlPath}`);
    }
    
    // Optionally save a screenshot
    let screenshotPath = null;
    if (config.saveScreenshot) {
      if (config.verbose) {
        console.error(`正在保存网页截图...`);
      }
      screenshotPath = join(downloadsPath, `flights-${fromCode}-${toCode}-${date}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      if (config.verbose) {
        console.error(`截图已保存至: ${screenshotPath}`);
      }
    }
    
    return {
      flightCount: flightDetails.length,
      htmlPath,
      screenshotPath,
      from: fromCode,
      to: toCode,
      date,
      flightDetails
    };
    
  } catch (error) {
    if (config.verbose) {
      console.error(`获取航班信息失败: ${error.message}`);
    }
    throw error;
  } finally {
    await browser.close();
    if (config.verbose) {
      console.error(`浏览器已关闭`);
    }
  }
}

/**
 * 生成HTML输出
 */
function generateHtmlOutput(flightDetails, from, to, date) {
  const fromName = Object.keys(cityToAirportCode).find(key => cityToAirportCode[key] === from.toUpperCase()) || from;
  const toName = Object.keys(cityToAirportCode).find(key => cityToAirportCode[key] === to.toUpperCase()) || to;
  
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fromName} 到 ${toName} 航班信息 (${date})</title>
  <style>
    body {
      font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1, h2 {
      color: #1a53ff;
    }
    .flight-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 20px;
    }
    /* 保留原始网站的样式类 */
    .flight-item, [class*="list-item"] {
      border: 1px solid #e6e6e6;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      margin-bottom: 16px;
      padding: 16px;
      background-color: white;
    }
    .search-box {
      width: 100%;
      padding: 8px 16px;
      font-size: 16px;
      margin-bottom: 16px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      color: #999;
      font-size: 14px;
    }
    /* 保留所有原始样式 */
    .airline-name, .time, .depart-box, .arrive-box, .flight-price, .price,
    .airport, .terminal, .sub-price-item, .flight-tags, .plane-No {
      /* 保持原始样式 */
    }
  </style>
  <!-- 添加一些必要的CSS修复 -->
  <style>
    /* 确保所有原始样式都能正确显示 */
    .flight-item *, [class*="list-item"] * {
      box-sizing: border-box;
    }
    /* 可能需要为某些元素添加样式以确保正确显示 */
    .flight-item .price, [class*="list-item"] .price {
      color: #ff4d4f;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>${fromName} 到 ${toName} 航班信息</h1>
  <h2>日期: ${date} · 找到 ${flightDetails.length} 个航班</h2>
  
  <input type="text" class="search-box" id="flightSearch" placeholder="搜索航空公司、航班号..." />
  
  <div class="flight-list" id="flightList">`;
  
  // 直接插入原始HTML
  flightDetails.forEach(flight => {
    html += flight.html;
  });
  
  html += `
  </div>
  
  <div class="footer">
    <p>数据来源：携程网，生成时间：${new Date().toLocaleString()}</p>
  </div>

  <script>
    // 搜索功能
    const searchInput = document.getElementById('flightSearch');
    const flightItems = document.querySelectorAll('.flight-item, [class*="list-item"]');
    
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      
      flightItems.forEach(item => {
        const itemText = item.textContent.toLowerCase();
        
        if (itemText.includes(searchTerm)) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    });

    // 尝试修复可能的样式问题
    document.addEventListener('DOMContentLoaded', function() {
      // 确保所有链接都在新窗口打开
      document.querySelectorAll('a').forEach(link => {
        link.setAttribute('target', '_blank');
      });
    });
  </script>
</body>
</html>`;
  
  return html;
}

/**
 * 计算航班时长（简单实现）
 */
function calculateDuration(departTime, arrivalTime) {
  const [departHour, departMinute] = departTime.split(':').map(Number);
  const [arrivalHour, arrivalMinute] = arrivalTime.split(':').map(Number);
  
  let durationHours = arrivalHour - departHour;
  let durationMinutes = arrivalMinute - departMinute;
  
  if (durationMinutes < 0) {
    durationMinutes += 60;
    durationHours -= 1;
  }
  
  if (durationHours < 0) {
    durationHours += 24;
  }
  
  return `${durationHours}h ${durationMinutes}m`;
} 
/**
 * Get structured train ticket information from Ctrip train website
 */
import { join } from 'path';
import { homedir } from 'os';
import { writeFile } from 'fs/promises';
import { chromium, autoScroll, setupBrowserFingerprint, addRandomMouseMovements, simulateHumanBehavior, tryClosePopups } from './common.js';

export async function getTrainInfo(from, to, date, options = {}) {
  // 设置默认配置项
  const defaultOptions = {
    headless: false,
    timeout: 60000,
    saveScreenshot: true,
    verbose: false
  };
  
  const config = {...defaultOptions, ...options};
  
  if (config.verbose) {
    console.error(`开始搜索 ${from} 到 ${to} 在 ${date} 的火车...`);
  }
  
  // 初始化浏览器
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
    // 构建携程火车票查询URL
    const url = `https://trains.ctrip.com/webapp/train/list?ticketType=0&dStation=${encodeURIComponent(from)}&aStation=${encodeURIComponent(to)}&dDate=${date}&rDate=&trainsType=&hubCityName=&highSpeedOnly=0`;
    
    if (config.verbose) {
      console.error(`正在访问 ${url}`);
    }
    
    // 设置浏览器指纹以避免检测
    await setupBrowserFingerprint(page);
    
    // 导航到携程火车票页面
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: config.timeout 
    });
    
    // 等待页面加载
    if (config.verbose) {
      console.error(`页面已加载，等待内容渲染...`);
    }
    
    // 模拟真实用户行为
    await simulateHumanBehavior(page);
    
    await page.waitForTimeout(8000);
    
    // 检测是否有登录弹窗
    const hasLoginPopup = await page.evaluate(() => {
      return !!document.querySelector('.pop-login-dialog') || 
             !!document.querySelector('.login-panel') ||
             !!document.querySelector('[class*="login"]') ||
             !!document.querySelector('.c-login-part') ||
             !!document.querySelector('.cpt-login-box') ||
             (document.body.innerText.includes('登录') && 
              (document.body.innerText.includes('密码') || 
               document.body.innerText.includes('验证码')));
    });
    
    if (hasLoginPopup) {
      if (config.verbose) {
        console.error('检测到登录弹窗，尝试关闭...');
      }
      
      // 尝试关闭登录弹窗
      const closeButtonClicked = await tryClosePopups(page, config.verbose);
      
      if (!closeButtonClicked) {
        // 如果没有找到关闭按钮，刷新页面重试
        if (config.verbose) {
          console.error('无法关闭登录弹窗，刷新页面重试...');
        }
        
        await page.reload({ waitUntil: 'networkidle', timeout: config.timeout });
        await page.waitForTimeout(8000);
        await simulateHumanBehavior(page);
        
        // 再次尝试关闭可能出现的弹窗
        await tryClosePopups(page, config.verbose);
      }
      
      await page.waitForTimeout(3000); // 等待弹窗处理后的页面响应
    }
    
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
    
    // 滚动页面以加载更多内容
    if (config.verbose) {
      console.error(`正在滚动页面以加载更多车次...`);
    }
    await autoScroll(page);
    
    if (config.verbose) {
      console.error(`开始提取火车信息...`);
    }
    
    // 提取火车票信息，从.card-white.list-item元素
    const trainDetails = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.card-white.list-item'));
      
      return items.map(item => {
        // 提取车次信息
        const trainNumberEl = item.querySelector('.checi');
        const trainNumber = trainNumberEl ? trainNumberEl.textContent.trim().replace(/\s*\S*$/, '') : '';
        
        // 提取列车类型 (G开头代表高铁，D开头代表动车，其他则为普通列车)
        const trainType = trainNumber ? (
          trainNumber.startsWith('G') ? '高铁' : 
          trainNumber.startsWith('D') ? '动车' : '普通列车'
        ) : '';
        
        // 提取出发信息
        const departTimeEl = item.querySelector('.from .time');
        const departTime = departTimeEl ? departTimeEl.textContent.trim() : '';
        
        const departStationEl = item.querySelector('.from .station');
        const departStation = departStationEl ? departStationEl.textContent.trim() : '';
        
        // 提取到达信息
        const arrivalTimeEl = item.querySelector('.to .time');
        const arrivalTime = arrivalTimeEl ? arrivalTimeEl.textContent.trim() : '';
        
        const arrivalStationEl = item.querySelector('.to .station');
        const arrivalStation = arrivalStationEl ? arrivalStationEl.textContent.trim() : '';
        
        // 提取行程时间
        const durationEl = item.querySelector('.mid .haoshi');
        const duration = durationEl ? durationEl.textContent.trim() : '';
        
        // 提取票价信息
        const priceEl = item.querySelector('.rbox .price');
        const price = priceEl ? priceEl.textContent.trim() : '';
        
        // 提取余票信息
        const seatCountEl = item.querySelector('.rbox .surplus-list');
        const seatCount = seatCountEl ? seatCountEl.textContent.trim() : '';
        
        // 提取抢票信息
        const tagEl = item.querySelector('.tag-qiang');
        const tags = tagEl ? tagEl.textContent.trim() : '';
        
        // 构建座位信息
        const seats = [];
        if (price) {
          seats.push({
            type: '二等座', // 默认假设为二等座价格
            price: `¥${price}`,
            count: seatCount || '查询余票'
          });
        }
        
        // 尝试获取其他座位信息
        const seatItems = Array.from(item.querySelectorAll('.surplus-list li'));
        if (seatItems.length > 0) {
          // 如果seats集合已包含了默认的座位信息，则清空它，使用实际抓取的座位数据
          if (seats.length > 0 && !seats[0].type) {
            seats.length = 0;
          }
          
          seatItems.forEach(seatItem => {
            const seatText = seatItem.textContent.trim();
            if (seatText && !seatText.includes('暂无余票')) {
              // 尝试从文本中提取座位类型和数量
              const match = seatText.match(/(\S+)：(\S+)/);
              if (match && match.length >= 3) {
                seats.push({
                  type: match[1],
                  price: `¥${price}`,
                  count: match[2]
                });
              }
            }
          });
        }
        
        // 如果没有找到任何座位信息，添加默认信息
        if (seats.length === 0 && price) {
          seats.push({
            type: '票价',
            price: `¥${price}`,
            count: seatCount || '查询余票'
          });
        }
        
        return {
          trainNumber,
          trainType,
          departTime,
          departStation,
          arrivalTime,
          arrivalStation,
          duration,
          seats,
          startEndInfo: '',
          tags
        };
      }).filter(train => train.trainNumber && train.departTime);
    });
    
    if (config.verbose) {
      console.error(`找到 ${trainDetails.length} 个车次，正在生成HTML...`);
    }
    
    // 生成HTML输出文件
    const htmlOutput = generateTrainHtmlOutput(trainDetails, from, to, date);
    
    // 保存HTML文件
    const filename = `trains-${encodeURIComponent(from)}-${encodeURIComponent(to)}-${date}.html`;
    const downloadsPath = join(homedir(), 'Documents', 'travel');
    const htmlPath = join(downloadsPath, filename);
    await writeFile(htmlPath, htmlOutput);
    
    if (config.verbose) {
      console.error(`HTML文件已保存至: ${htmlPath}`);
    }
    
    // 可选保存截图
    let screenshotPath = null;
    if (config.saveScreenshot) {
      if (config.verbose) {
        console.error(`正在保存网页截图...`);
      }
      screenshotPath = join(downloadsPath, `trains-${encodeURIComponent(from)}-${encodeURIComponent(to)}-${date}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      if (config.verbose) {
        console.error(`截图已保存至: ${screenshotPath}`);
      }
    }
    
    return {
      trainCount: trainDetails.length,
      htmlPath,
      screenshotPath,
      from,
      to,
      date,
      trainDetails
    };
    
  } catch (error) {
    if (config.verbose) {
      console.error(`获取火车信息失败: ${error.message}`);
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
 * 生成火车信息的HTML展示页面
 */
export function generateTrainHtmlOutput(trainDetails, from, to, date) {
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${from} 到 ${to} 火车信息 (${date})</title>
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
    .view-controls {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
    }
    .view-button {
      padding: 8px 16px;
      background-color: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
    }
    .view-button.active {
      background-color: #1a53ff;
      color: white;
      border-color: #1a53ff;
    }
    .train-views > div {
      display: none;
    }
    .train-views > div.active {
      display: block;
    }
    .train-items-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .train-item {
      border: 1px solid #e6e6e6;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      overflow: hidden;
    }
    .train-row {
      display: flex;
      padding: 16px;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #f0f0f0;
    }
    .train-info {
      display: flex;
      flex-direction: column;
      width: 120px;
      padding: 0 10px;
    }
    .train-num {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .train-type {
      font-size: 12px;
      color: #666;
      background-color: #f0f0f0;
      padding: 2px 6px;
      border-radius: 10px;
      display: inline-block;
    }
    .train-detail {
      display: flex;
      align-items: center;
      flex: 1;
      margin: 0 20px;
    }
    .depart-box, .arrive-box {
      display: flex;
      flex-direction: column;
      min-width: 120px;
    }
    .time {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .station {
      font-size: 14px;
    }
    .arrow-box {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      padding: 0 20px;
      flex-direction: column;
    }
    .duration {
      font-size: 14px;
      color: #666;
      margin-bottom: 6px;
    }
    .arrow-oneway {
      display: block;
      height: 2px;
      width: 100%;
      background-color: #e0e0e0;
      position: relative;
    }
    .arrow-oneway:after {
      content: '';
      position: absolute;
      right: 0;
      top: -4px;
      width: 0;
      height: 0;
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
      border-left: 8px solid #e0e0e0;
    }
    .train-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .tag {
      background-color: #f5f8ff;
      color: #1a53ff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    .start-end-info {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }
    .train-seats {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background-color: #f9f9f9;
      flex-wrap: wrap;
    }
    .seat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 8px 12px;
    }
    .seat-type {
      font-size: 14px;
      margin-bottom: 4px;
    }
    .seat-price {
      color: #ff4d4f;
      font-size: 18px;
      font-weight: bold;
    }
    .seat-count {
      font-size: 12px;
      color: #666;
      margin-top: 2px;
    }
    .search-box {
      width: 100%;
      padding: 8px 16px;
      font-size: 16px;
      margin-bottom: 16px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .train-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e0e0e0;
    }
    .train-table th {
      background-color: #f5f5f5;
      padding: 12px 8px;
      text-align: left;
      cursor: pointer;
      position: relative;
    }
    .train-table th:hover {
      background-color: #e8e8e8;
    }
    .train-table th::after {
      content: '↕';
      position: absolute;
      right: 8px;
      opacity: 0.3;
    }
    .train-table th.asc::after {
      content: '↑';
      opacity: 1;
    }
    .train-table th.desc::after {
      content: '↓';
      opacity: 1;
    }
    .train-table td {
      padding: 12px 8px;
      border-top: 1px solid #e0e0e0;
    }
    .train-table tr:hover {
      background-color: #f9f9f9;
    }
  </style>
</head>
<body>
  <h1>${from} 到 ${to} 火车信息 (${date})</h1>
  <h2>找到 ${trainDetails.length} 个车次</h2>
  
  <input type="text" class="search-box" id="trainSearch" placeholder="搜索车次、车站..." />
  
  <div class="view-controls">
    <button class="view-button active" data-view="card">卡片视图</button>
    <button class="view-button" data-view="table">表格视图</button>
  </div>
  
  <div class="train-views">
    <div class="train-card-view active">
      <div class="train-items-container" id="trainItemsContainer">`;
  
  trainDetails.forEach(train => {
    html += `
        <div class="train-item" data-train="${train.trainNumber}">
          <div class="train-row">
            <div class="train-info">
              <div class="train-num">${train.trainNumber}</div>
              <div class="train-type">${train.trainType}</div>
              ${train.startEndInfo ? `<div class="start-end-info">${train.startEndInfo}</div>` : ''}
            </div>
            
            <div class="train-detail">
              <div class="depart-box">
                <div class="time">${train.departTime}</div>
                <div class="station">${train.departStation}</div>
              </div>
              
              <div class="arrow-box">
                <div class="duration">${train.duration}</div>
                <i class="arrow-oneway"></i>
              </div>
              
              <div class="arrive-box">
                <div class="time">${train.arrivalTime}</div>
                <div class="station">${train.arrivalStation}</div>
              </div>
            </div>
            
            ${train.tags ? `<div class="train-tags"><span class="tag">${train.tags}</span></div>` : ''}
          </div>
          
          <div class="train-seats">`;
    
    train.seats.forEach(seat => {
      html += `
            <div class="seat-item">
              <div class="seat-type">${seat.type}</div>
              <div class="seat-price">${seat.price}</div>
              <div class="seat-count">${seat.count}</div>
            </div>`;
    });
    
    html += `
          </div>
        </div>`;
  });
  
  html += `
      </div>
    </div>
    
    <div class="train-table-view">
      <table class="train-table" id="trainTable">
        <thead>
          <tr>
            <th data-sort="trainNumber">车次</th>
            <th data-sort="trainType">类型</th>
            <th data-sort="departTime">发车时间</th>
            <th data-sort="departStation">发站</th>
            <th data-sort="arrivalTime">到达时间</th>
            <th data-sort="arrivalStation">到站</th>
            <th data-sort="duration">历时</th>
            <th data-sort="seatInfo">席位</th>
          </tr>
        </thead>
        <tbody>`;
  
  trainDetails.forEach(train => {
    // 将席位信息合并成一个字符串
    const seatInfo = train.seats.map(seat => 
      `${seat.type}: ${seat.price}(${seat.count})`
    ).join(', ');
    
    html += `
          <tr>
            <td>${train.trainNumber}</td>
            <td>${train.trainType}</td>
            <td>${train.departTime}</td>
            <td>${train.departStation}</td>
            <td>${train.arrivalTime}</td>
            <td>${train.arrivalStation}</td>
            <td>${train.duration}</td>
            <td>${seatInfo}</td>
          </tr>`;
  });
  
  html += `
        </tbody>
      </table>
    </div>
  </div>
  
  <div class="footer">
    <p>数据来源：携程网，生成时间：${new Date().toLocaleString()}</p>
  </div>

  <script>
    // 视图切换功能
    const viewButtons = document.querySelectorAll('.view-button');
    const views = document.querySelectorAll('.train-views > div');
    
    viewButtons.forEach(button => {
      button.addEventListener('click', function() {
        const viewType = this.getAttribute('data-view');
        
        // 更新按钮状态
        viewButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        
        // 更新视图状态
        views.forEach(view => {
          view.classList.remove('active');
          if (view.classList.contains('train-' + viewType + '-view')) {
            view.classList.add('active');
          }
        });
      });
    });
    
    // 表格排序功能
    const tableHeaders = document.querySelectorAll('.train-table th');
    let sortColumn = 'departTime';
    let sortDirection = 'asc';
    
    function sortTable(column) {
      const table = document.getElementById('trainTable');
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      
      // 重置所有表头
      tableHeaders.forEach(header => {
        header.classList.remove('asc', 'desc');
      });
      
      // 更新排序方向
      if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = column;
        sortDirection = 'asc';
      }
      
      // 更新表头状态
      const currentHeader = document.querySelector(\`th[data-sort="\${column}"]\`);
      currentHeader.classList.add(sortDirection);
      
      // 排序行
      const sortedRows = rows.sort((a, b) => {
        const aValue = a.cells[getColumnIndex(column)].textContent.trim();
        const bValue = b.cells[getColumnIndex(column)].textContent.trim();
        
        // 处理时间值
        if (column === 'departTime' || column === 'arrivalTime') {
          return sortDirection === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        // 处理文本值
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      });
      
      // 重新排序行
      sortedRows.forEach(row => tbody.appendChild(row));
    }
    
    function getColumnIndex(column) {
      let index = 0;
      tableHeaders.forEach((header, i) => {
        if (header.getAttribute('data-sort') === column) {
          index = i;
        }
      });
      return index;
    }
    
    // 为表头添加点击处理程序
    tableHeaders.forEach(header => {
      header.addEventListener('click', function() {
        const column = this.getAttribute('data-sort');
        sortTable(column);
      });
    });
    
    // 初始排序
    sortTable('departTime');
    
    // 搜索功能
    const searchInput = document.getElementById('trainSearch');
    
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      const items = document.querySelectorAll('.train-item');
      const tableRows = document.querySelectorAll('.train-table tbody tr');
      
      // 过滤卡片视图
      items.forEach(item => {
        const trainNumber = item.getAttribute('data-train').toLowerCase();
        const cardText = item.textContent.toLowerCase();
        
        if (cardText.includes(searchTerm) || trainNumber.includes(searchTerm)) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
      
      // 过滤表格视图
      tableRows.forEach(row => {
        const rowText = row.textContent.toLowerCase();
        
        if (rowText.includes(searchTerm)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  </script>
</body>
</html>`;
  
  return html;
}
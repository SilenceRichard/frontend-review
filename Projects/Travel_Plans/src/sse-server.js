#!/usr/bin/env node

import express from 'express';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createRequire } from 'module';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// 导入服务模块
import { getFlightInfo, cityToAirportCode, lookupAirportCode } from './services/flight.js';
import { getTrainInfo } from './services/train.js';

// Main function to set up and start the MCP server with SSE transport
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const portArg = args.find(arg => arg.startsWith("--port="));
  const port = portArg ? parseInt(portArg.split("=")[1], 10) : 3000;
  
  const tokenArg = args.find(arg => arg.startsWith("--token="));
  const token = tokenArg ? tokenArg.split("=")[1] : undefined;
  
  // Create a new MCP server instance
  const server = new McpServer({
    name: "交通信息助手-SSE",
    version: "1.0.0",
    description: "Transportation information assistant MCP server with SSE transport"
  });
  
  // 存储工具处理函数的映射表，以便直接调用
  const toolHandlers = {};
  
  // 扩展server对象，添加获取工具处理程序的方法
  server.getToolHandler = (toolName) => {
    return toolHandlers[toolName];
  };

  // Add flight information tool
  server.tool(
    "get_flight_info",
    { 
      from: z.string().describe("出发地城市名或机场代码"),
      to: z.string().describe("目的地城市名或机场代码"),
      date: z.string().describe("出行日期，格式为YYYY-MM-DD"),
      headless: z.boolean().optional().default(false).describe("是否使用无头浏览器模式"),
      saveScreenshot: z.boolean().optional().default(true).describe("是否保存网页截图"),
      verbose: z.boolean().optional().default(true).describe("是否显示详细日志")
    },
    async ({ from, to, date, headless, saveScreenshot, verbose }) => {
      try {
        const options = {
          headless,
          saveScreenshot,
          verbose
        };
        
        const result = await getFlightInfo(from, to, date, options);
        
        // Preview of the first few flights for quick reference
        const flightPreview = result.flightDetails.slice(0, 5).map(flight => 
          `${flight.airline} ${flight.flightNumber}: ${flight.departTime}(${flight.departTerminal || ''})→${flight.arrivalTime}(${flight.arrivalTerminal || ''}), ${flight.aircraft || ''} ${flight.discount || ''} ${flight.promotions ? '优惠:' + flight.promotions : ''} 价格¥${flight.price}`
        ).join('\n');
        
        return {
          content: [{ 
            type: "text", 
            text: `已为 ${from}(${result.from}) 到 ${to}(${result.to}) 于 ${date} 的航班生成HTML时刻表。
找到 ${result.flightCount} 个航班。
HTML文件已保存至: ${result.htmlPath}
${result.screenshotPath ? `截图备份已保存至: ${result.screenshotPath}` : '未保存截图'}

航班预览:
${flightPreview}

完整信息请查看HTML文件。` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `获取航班信息失败: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // 保存get_flight_info工具的处理函数
  toolHandlers["get_flight_info"] = async ({ from, to, date, headless, saveScreenshot, verbose }) => {
    try {
      const options = {
        headless,
        saveScreenshot,
        verbose
      };
      
      const result = await getFlightInfo(from, to, date, options);
      
      // Preview of the first few flights for quick reference
      const flightPreview = result.flightDetails.slice(0, 5).map(flight => 
        `${flight.airline} ${flight.flightNumber}: ${flight.departTime}(${flight.departTerminal || ''})→${flight.arrivalTime}(${flight.arrivalTerminal || ''}), ${flight.aircraft || ''} ${flight.discount || ''} ${flight.promotions ? '优惠:' + flight.promotions : ''} 价格¥${flight.price}`
      ).join('\n');
      
      return {
        content: [{ 
          type: "text", 
          text: `已为 ${from}(${result.from}) 到 ${to}(${result.to}) 于 ${date} 的航班生成HTML时刻表。
找到 ${result.flightCount} 个航班。
HTML文件已保存至: ${result.htmlPath}
${result.screenshotPath ? `截图备份已保存至: ${result.screenshotPath}` : '未保存截图'}

航班预览:
${flightPreview}

完整信息请查看HTML文件。` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `获取航班信息失败: ${error.message}` 
        }]
      };
    }
  };

  // Add train information tool
  server.tool(
    "get_train_info",
    { 
      from: z.string().describe("出发地城市名"),
      to: z.string().describe("目的地城市名"),
      date: z.string().describe("出行日期，格式为YYYY-MM-DD"),
      headless: z.boolean().optional().default(false).describe("是否使用无头浏览器模式"),
      saveScreenshot: z.boolean().optional().default(true).describe("是否保存网页截图"),
      verbose: z.boolean().optional().default(true).describe("是否显示详细日志")
    },
    async ({ from, to, date, headless, saveScreenshot, verbose }) => {
      try {
        const options = {
          headless,
          saveScreenshot,
          verbose
        };
        
        const result = await getTrainInfo(from, to, date, options);
        
        // Preview of the first few trains for quick reference
        const trainPreview = result.trainDetails.slice(0, 5).map(train => 
          `${train.trainNumber}: ${train.departTime}(${train.departStation})→${train.arrivalTime}(${train.arrivalStation}), 历时:${train.duration}, 价格¥${train.price}`
        ).join('\n');
        
        return {
          content: [{ 
            type: "text", 
            text: `已为 ${from} 到 ${to} 于 ${date} 的火车生成HTML时刻表。
找到 ${result.trainCount} 个车次。
HTML文件已保存至: ${result.htmlPath}
${result.screenshotPath ? `截图备份已保存至: ${result.screenshotPath}` : '未保存截图'}

车次预览:
${trainPreview}

完整信息请查看HTML文件。` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `获取火车信息失败: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // 保存get_train_info工具的处理函数
  toolHandlers["get_train_info"] = async ({ from, to, date, headless, saveScreenshot, verbose }) => {
    try {
      const options = {
        headless,
        saveScreenshot,
        verbose
      };
      
      const result = await getTrainInfo(from, to, date, options);
      
      // Preview of the first few trains for quick reference
      const trainPreview = result.trainDetails.slice(0, 5).map(train => 
        `${train.trainNumber}: ${train.departTime}(${train.departStation})→${train.arrivalTime}(${train.arrivalStation}), 历时:${train.duration}, 价格¥${train.price}`
      ).join('\n');
      
      return {
        content: [{ 
          type: "text", 
          text: `已为 ${from} 到 ${to} 于 ${date} 的火车生成HTML时刻表。
找到 ${result.trainCount} 个车次。
HTML文件已保存至: ${result.htmlPath}
${result.screenshotPath ? `截图备份已保存至: ${result.screenshotPath}` : '未保存截图'}

车次预览:
${trainPreview}

完整信息请查看HTML文件。` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `获取火车信息失败: ${error.message}` 
        }]
      };
    }
  };

  // Add a city to airport code lookup tool
  server.tool(
    "lookup_airport_code",
    { 
      city: z.string().describe("城市名称（中文或英文）") 
    },
    async ({ city }) => {
      try {
        // 使用新的lookupAirportCode函数查询机场代码
        const code = await lookupAirportCode(city);
        
        if (code) {
          return {
            content: [{ 
              type: "text", 
              text: `${city} 的机场代码是: ${code}` 
            }]
          };
        } else {
          return {
            content: [{ 
              type: "text", 
              text: `未找到 ${city} 的机场代码，可能需要检查城市名称拼写或者添加到机场代码数据库中` 
            }]
          };
        }
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `查询机场代码失败: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // 保存lookup_airport_code工具的处理函数
  toolHandlers["lookup_airport_code"] = async ({ city }) => {
    try {
      // 使用新的lookupAirportCode函数查询机场代码
      const code = await lookupAirportCode(city);
      
      if (code) {
        return {
          content: [{ 
            type: "text", 
            text: `${city} 的机场代码是: ${code}` 
          }]
        };
      } else {
        return {
          content: [{ 
            type: "text", 
            text: `未找到 ${city} 的机场代码，可能需要检查城市名称拼写或者添加到机场代码数据库中` 
          }]
        };
      }
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `查询机场代码失败: ${error.message}` 
        }]
      };
    }
  };

  // Set up Express app
  const app = express();
  
  // 启用CORS
  app.use(cors({
    origin: '*', // 允许所有来源，生产环境中应该限制为特定域名
    methods: 'GET,POST',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));
  
  // Store active transports
  const transports = {};
  
  // Authentication middleware
  const authenticate = (req, res, next) => {
    if (!token) {
      next();
      return;
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    const [type, value] = authHeader.split(' ');
    if (type !== 'Bearer' || value !== token) {
      res.status(401).json({ error: 'Invalid authentication token' });
      return;
    }
    
    next();
  };
  
  // SSE endpoint
  app.get("/sse", authenticate, async (req, res) => {
    const id = Date.now().toString();
    
    // 设置SSE所需的响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // 明确允许跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    const transport = new SSEServerTransport("/messages", res);
    transports[id] = transport;
    
    req.on('close', () => {
      delete transports[id];
      console.log(`Client disconnected: ${id}`);
    });
    
    console.log(`New client connected: ${id}`);
    await server.connect(transport);
  });
  
  // Message receiving endpoint
  app.post('/messages', express.json(), authenticate, async (req, res) => {
    // In a real-world app, you'd identify which transport to use
    // For now, we'll use the most recent one
    const transportIds = Object.keys(transports);
    if (transportIds.length === 0) {
      // 如果没有活跃连接，则创建一个临时传输层处理请求
      console.log('No active SSE connections, creating a temporary transport');
      
      try {
        // 直接处理请求
        const { id, method, params } = req.body;
        
        if (method !== 'mcp.toolCall' || !params || !params.tool) {
          return res.status(400).json({ 
            error: { 
              message: 'Invalid request format. Expected mcp.toolCall with tool parameter.' 
            } 
          });
        }
        
        const { tool, parameters } = params;
        
        // 检查工具是否存在
        const toolHandler = server.getToolHandler(tool);
        if (!toolHandler) {
          return res.status(404).json({ 
            error: { 
              message: `Tool '${tool}' not found.` 
            } 
          });
        }
        
        // 直接执行工具
        console.log(`Executing tool '${tool}' with direct HTTP call`);
        const result = await toolHandler(parameters);
        
        // 返回结果
        return res.json({
          id,
          result
        });
      } catch (error) {
        console.error('Error handling direct tool call:', error);
        return res.status(500).json({ 
          error: { 
            message: `Internal server error: ${error.message}` 
          } 
        });
      }
    }
    
    // 如果有活跃连接，使用标准的SSE传输层
    const transport = transports[transportIds[transportIds.length - 1]];
    await transport.handlePostMessage(req, res);
  });
  
  // 添加预检请求的处理
  app.options('*', cors());
  
  // Start the server
  app.listen(port, () => {
    console.log(`Transportation Information MCP server with SSE transport is running on http://localhost:${port}`);
    console.log(`Connect to http://localhost:${port}/sse for SSE endpoint`);
    console.log(`Send messages to http://localhost:${port}/messages`);
    if (token) {
      console.log(`Authentication required with token: ${token}`);
    } else {
      console.log(`No authentication required`);
    }
    console.log(`Press Ctrl+C to stop the server`);
  });
}

// Run the main function and handle errors
main().catch(err => {
  console.error("Error starting MCP server:", err);
  process.exit(1);
}); 
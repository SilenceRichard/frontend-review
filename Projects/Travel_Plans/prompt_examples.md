# 航班查询助手提示词示例

以下是使用航班查询 MCP 服务器工具的提示词示例，可在 Claude 中使用。

## 基础查询提示词

```
请帮我查询从北京到上海2023-10-25的航班信息。使用get_flight_info工具，并在查询完成后帮我阅读Documents/travel目录下生成的HTML文件内容，总结最便宜的3个航班选择。
```

## 更详细的查询提示词

```
我需要你作为一个航班查询助手帮我完成以下任务：
1. 使用get_flight_info工具查询从广州到成都2023-11-15的航班
2. 将verbose参数设为true以获取详细日志
3. 查询完成后，读取~/Documents/travel目录下生成的HTML文件
4. 分析并总结以下信息：
   - 最早起飞和最晚起飞的航班
   - 价格最低的3个航班选项及其详细信息
   - 飞行时间最短的航班
5. 如果有特价或促销信息的航班，请特别标注出来
```

## 多航班比较提示词

```
请帮我比较以下航班路线的信息：
1. 先使用get_flight_info工具查询从上海到杭州2023-12-01的航班
2. 再查询从上海到南京同一天的航班
3. 查询完成后，读取Documents/travel目录下生成的两个HTML文件
4. 对比两条路线的航班情况，告诉我：
   - 哪条路线航班更多
   - 哪条路线整体价格更便宜
   - 两条路线各自最早的航班时间
   - 推荐我选择哪条路线更合适，并解释理由
```

## 特定航空公司查询提示词

```
我想了解国航从北京到西安2023-10-30的航班情况：
1. 使用get_flight_info工具查询相关航班
2. 查询完成后，读取~/Documents/travel/flights-PEK-XIY-2023-10-30.html文件
3. 从结果中筛选出所有中国国际航空(Air China)的航班
4. 按照起飞时间排序，告诉我它们的航班号、起飞/到达时间、价格等信息
5. 推荐一个性价比最高的选择
```

## 机场代码查询提示词

```
我想了解以下信息：
1. 首先使用lookup_airport_code工具查询"厦门"的机场代码
2. 然后查询从重庆到厦门2023-11-05的航班
3. 查询完成后，读取Documents/travel目录下生成的HTML文件
4. 分析并总结结果中最便宜的5个航班选项
```

## 历史文件查询提示词

```
我之前已经查询过从成都到深圳2023-12-10的航班，文件已经保存在~/Documents/travel目录下。请帮我：
1. 读取该目录下的flights-CTU-SZX-2023-12-10.html文件
2. 分析文件内容，提取所有航班信息
3. 按照价格从低到高排序
4. 为我推荐起飞时间在上午9点到下午3点之间的最佳选择
```

## 扩展提示词：商务旅行规划

```
我需要规划一次商务旅行：
1. 使用get_flight_info工具查询从上海到北京2023-11-20的航班，以及从北京返回上海2023-11-22的航班
2. 查询完成后，读取Documents/travel目录下生成的两个HTML文件
3. 分析往返航班的时间和价格
4. 为我推荐以下方案：
   - 如果我需要在北京待满两天的工作时间，最合适的往返航班组合
   - 价格最经济的往返航班组合
   - 最节省时间的往返航班组合（飞行时间短，机场等待时间少）
5. 考虑到商务旅行的需求，优先考虑上午和下午的航班，避免太早或太晚的时间
```

## 高级查询提示词：一周内最优航班

```
我计划在未来一周内从深圳前往杭州，但具体日期灵活：
1. 请使用get_flight_info工具依次查询从深圳到杭州2023-11-10、2023-11-11、2023-11-12、2023-11-13、2023-11-14、2023-11-15和2023-11-16的航班
2. 查询完成后，读取Documents/travel目录下生成的所有HTML文件
3. 对比分析一周内各天的航班情况，特别关注：
   - 哪一天的机票最便宜
   - 每天价格最低的航班信息
   - 各天航班的平均价格
4. 根据价格和时间综合考量，推荐最合适出行的日期和航班
5. 如果有特价或促销信息的航班，请特别标注出来
```

## 针对特殊需求的提示词

```
我需要为行动不便的老人查询航班：
1. 使用get_flight_info工具查询从重庆到上海2023-12-05的航班
2. 查询完成后，读取Documents/travel目录下生成的HTML文件
3. 帮我找出最适合老年人的航班选择，考虑以下因素：
   - 起飞和降落时间适中（避免太早或太晚）
   - 有直飞航班（避免中转）
   - 航空公司服务评价好
   - 有轮椅服务的航空公司优先
4. 提供2-3个最佳选择，并解释为什么推荐这些航班
```

这些提示词涵盖了不同的使用场景，可根据实际需求修改日期、城市等具体信息。 
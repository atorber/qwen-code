# 百度云 BCE SDK 使用说明

## 环境变量配置

使用百度云认证需要配置以下环境变量：

### 必需的环境变量

```bash
# 百度云 Access Key
export BAIDU_CLOUD_AK="your_access_key_here"
# 或者使用
export BCE_AK="your_access_key_here"

# 百度云 Secret Key  
export BAIDU_CLOUD_SK="your_secret_key_here"
# 或者使用
export BCE_SK="your_secret_key_here"
```

### 可选的环境变量

```bash
# 百度云区域（默认为 'bj'）
export BCE_REGION="bj"

# 百度云端点（ENDPOINT 参数）
# 支持多种环境变量名称，按优先级排序：
export BAIDU_CLOUD_ENDPOINT="https://aihc.bj.baidubce.com"
# 或者使用
export BAIDU_MODEL_ENDPOINT="https://aihc.bj.baidubce.com"  
# 或者使用
export BCE_ENDPOINT="https://aihc.bj.baidubce.com"

# 如果不设置 ENDPOINT，将使用默认格式：
# https://aihc.{region}.baidubce.com
```

## 使用方式

### 1. 基本使用

```typescript
import { bceSdk } from './bce-sdk/index.js';
import { Config } from '../config/config.js';

// 创建配置实例
const config = new Config(configParams);

// 调用百度云 API
const query = {
  action: 'DescribeJobs',
  pageNumber: 1,
  pageSize: 10
};

const req = {
  method: 'GET',
  body: null
};

const response = await bceSdk(query, req, config);
```

### 2. 在 ContentGenerator 中使用

```typescript
import { BaiduCloudContentGenerator } from './baiduCloudContentGenerator.js';

const contentGenerator = new BaiduCloudContentGenerator(
  contentGeneratorConfig, 
  config
);

// 获取推理服务列表
const services = await contentGenerator.listInferenceServices();
```

## 支持的 API 操作

### 资源池相关
- `DescribeResourcePools` - 获取资源池列表
- `DescribeResourcePool` - 获取资源池详情
- `DescribeResourcePoolConfiguration` - 获取资源池配置
- `DescribeResourcePoolOverview` - 获取资源池概览

### 队列相关
- `DescribeQueues` - 获取队列列表
- `DeleteQueue` - 删除队列

### 任务相关
- `DescribeJobs` - 获取任务列表
- `CreateJob` - 创建任务
- `DeleteJob` - 删除任务
- `DescribeJob` - 获取任务详情
- `ModifyJob` - 修改任务
- `DescribeJobEvents` - 获取任务事件
- `DescribeJobLogs` - 获取任务日志
- `DescribePodEvents` - 获取 Pod 事件
- `StopJob` - 停止任务
- `DescribeJobMetrics` - 获取任务指标
- `DescribeJobNodes` - 获取任务节点
- `DescribeJobWebterminal` - 获取任务 Web 终端

## 注意事项

1. **ENDPOINT 参数是必需的**：百度云认证需要正确的端点地址
2. **区域设置**：确保区域设置与您的百度云账户区域一致
3. **权限配置**：确保您的 AK/SK 具有调用相应 API 的权限
4. **网络访问**：确保网络能够访问百度云服务端点

## 错误处理

如果配置不正确，SDK 会抛出相应的错误信息：

- 缺少 Access Key 或 Secret Key
- 端点地址格式不正确
- 网络连接失败
- API 权限不足

请根据错误信息进行相应的配置调整。
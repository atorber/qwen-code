# AIHC 命令自动补全使用指南

## ✅ 功能状态

所有 AIHC 命令的枚举值自动补全功能已实现并正常工作！

## 🎯 支持的补全

### 基本用法

在交互式 CLI 中，输入 AIHC 命令后按 **Tab** 键即可触发自动补全。

### 补全场景

#### 1. 列出所有参数
```bash
/aihc pool list <Tab>
```
显示：`--resourcePoolType`, `-t`, `--pageNumber`, `-p`, `--pageSize`, `-s`, `--keywordType`, `--keyword`, `-k`, `--orderBy`, `--order`

#### 2. 补全参数名
```bash
/aihc pool list --res<Tab>
```
自动补全为：`--resourcePoolType`

#### 3. 补全枚举值（推荐方式）✨
```bash
/aihc pool list -t c<Tab>
```
自动补全为：`common`

```bash
/aihc pool list -t d<Tab>
```
自动补全为：`dedicatedV2`

## 📋 所有支持补全的命令

### Pool (资源池)
```bash
/aihc pool list -t <value>           # common, dedicatedV2
/aihc pool list --keywordType <value> # resourcePoolName, resourcePoolId
/aihc pool list --orderBy <value>     # resourcePoolName, resourcePoolId, createdAt
/aihc pool list --order <value>       # ASC, DESC
```

### Queue (队列)
```bash
/aihc queue list --resourcePoolId xxx --keywordType <value>  # queueName, queueId
```

### Job (训练任务)
```bash
/aihc job list --resourcePoolId xxx --keywordType <value>  # name, queueName
/aihc job list --resourcePoolId xxx --orderBy <value>       # createdAt, finishedAt
/aihc job list --resourcePoolId xxx --order <value>         # asc, desc
```

### Service (在线服务)
```bash
/aihc service list --order <value>  # asc, desc
```

### Dev (开发实例)
```bash
/aihc dev list --queryKey <value>  # devInstanceName, devInstanceId, creator
```

### Dataset (数据集)
```bash
/aihc dataset list --storageType <value>   # BOS, PFS
/aihc dataset list --importFormat <value>  # FILE, FOLDER
```

## 🚀 快速开始

### 1. 启动交互式 CLI
```bash
./packages/cli/dist/index.js
```

### 2. 设置 AIHC 认证（如果还没有）
```bash
export AIHC_AK="your-access-key"
export AIHC_SK="your-secret-key"
export AIHC_ENDPOINT="https://aihc.bj.baidubce.com"
```

### 3. 使用补全
输入命令并按 Tab 键，享受自动补全带来的便利！

## 💡 使用技巧

1. **输入首字母后 Tab**：最可靠的补全方式
   - `/aihc pool list -t c<Tab>` → `common`
   - `/aihc pool list -t d<Tab>` → `dedicatedV2`

2. **使用短参数名**：更快捷
   - `-t` 代替 `--resourcePoolType`
   - `-p` 代替 `--pageNumber`
   - `-s` 代替 `--pageSize`
   - `-k` 代替 `--keyword`

3. **查看所有选项**：在命令后加空格并按 Tab
   - `/aihc pool list <Tab>` 显示所有可用参数

## ⚠️ 注意事项

- 补全功能仅在**交互式终端**中有效
- 必须先构建项目：`npm run build`
- Tab 键按下时，光标应该在行末
- 部分补全需要先输入值的首字母

## 🎉 示例会话

```bash
$ ./packages/cli/dist/index.js

> /aihc pool list -t <输入 'c' 然后按 Tab>
> /aihc pool list -t common --pageSize 20

> /aihc dataset list --storageType <输入 'P' 然后按 Tab>
> /aihc dataset list --storageType PFS

> /aihc job list --resourcePoolId aihc-serverless --order <输入 'd' 然后按 Tab>
> /aihc job list --resourcePoolId aihc-serverless --order desc
```

祝您使用愉快！🚀


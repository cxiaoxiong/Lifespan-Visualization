---
description: "暂存全部改动，按 git diff 自动生成中文提交信息，并提交推送到当前分支（GitHub）"
argument-hint: "[可选: 覆盖提交信息]"
allowed-tools: Bash(git:*)
---

# 一键提交并推送（GitHub）

请严格按以下步骤执行，不要跳过安全检查。

## 1. 收集上下文
- 当前状态： !`git status`
- 已暂存差异： !`git diff --cached --stat`
- 未暂存差异： !`git diff --stat`
- 最近提交风格： !`git log --oneline -5`

## 2. 安全检查（重要，不可省略）
检查 `git status --porcelain` 输出。若发现疑似敏感文件（匹配
private / secret / token / key / credential / .env，或明显含密码/密钥的配置），
**不要**将其加入提交，先向我报告并询问。
注：本仓库 `.gitignore` 已忽略 `project.private.config.json` 等私有配置，
`git add -A` 不会包含它们；但若出现未预期的敏感文件，立即停止并提示。

## 3. 生成提交信息
- 若命令后带了参数（$ARGUMENTS 非空），直接用它作为提交信息。
- 否则根据上面 diff 自动生成一条**简洁、语义化、中文**信息，
  采用「类型: 简述」风格（如 fix: / feat: / docs: / style: / refactor:），不逐文件罗列。

## 4. 执行
- 若 working tree clean（无改动），告诉我“没有需要提交的改动”，**不**执行 commit/push。
- 否则依次执行：
  !`git add -A`
  !`git commit -m "<第3步生成的信息>"`
  !`git push origin HEAD`
- 若当前分支无 upstream，改用 `git push -u origin HEAD`。
- **严禁 force push**（`--force` / `-f`）。

## 5. 汇报
简短告诉我：提交了什么、推到了哪个分支 / commit 哈希。

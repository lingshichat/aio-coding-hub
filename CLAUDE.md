# Fork 协作工作流

> 本仓库是 `dyndynjyxa/aio-coding-hub` 的 fork。
> 以下流程确保 fork 的 CI/基建定制与 upstream 纯净分离。

## 分支职责

| 分支 | 用途 | 基线 |
|------|------|------|
| `main` | 严格镜像 `upstream/main`；用于从 upstream 切 PR 分支 | `upstream/main` |
| `fork-base` | 包含 fork 独有的 CI/hook/workflow；日常 feature 开发基线 | `upstream/main` + fork 定制 |
| `feat/*` | 日常功能开发 | `fork-base` |
| `upstream/*` | 提给 upstream 的 PR 分支 | `main` (= upstream/main) |

## 日常开发（fork 自用功能）

```bash
# 1. 基于 fork-base 切 feature 分支
git checkout fork-base
git pull origin fork-base
git checkout -b feat/my-feature

# 2. 开发、提交
# ...

# 3. 推送到 origin，通过 fork-base 的 CI 验证
git push origin feat/my-feature
# 如有 pre-push hook 因 bindings 过期失败，用 --no-verify 跳过
#（bindings 问题属于 upstream，与 fork 定制无关）
```

## 提 PR 到 Upstream

```bash
# 1. 确保 main 是最新的 upstream
git checkout main
git fetch upstream
git reset --hard upstream/main    # 本地 main 始终 fast-forward

# 2. 基于干净的 main 切 upstream PR 分支
git checkout -b upstream/my-fix

# 3. Cherry-pick 业务 commits（不要带 fork 的 CI 改动）
git cherry-pick <commit-hash>

# 4. 推送到 origin
git push origin upstream/my-fix

# 5. 在 GitHub 上从 lingshichat/upstream/my-fix → dyndynjyxa/main 开 PR
```

**关键规则**：upstream PR 分支必须只包含业务改动，**绝对不能混入** `.github/workflows/`、`.githooks/`、README 等 fork 定制文件。

## 同步 Upstream

手动：
```bash
git checkout main
git fetch upstream
git merge --ff-only upstream/main
git push origin main

git checkout fork-base
git rebase upstream/main
# 如有冲突解决后
# git rebase --continue
git push --force-with-lease origin fork-base
```

自动：`sync-upstream.yml` workflow 每天北京时间 8 点执行：
- `main`：fast-forward 到 upstream/main
- `fork-base`：rebase 到 upstream/main（失败则中止，需人工处理）

## 已知问题

### `check:generated-bindings` 在 pre-push 中失败

`pnpm run check:prepush` → `check:generated-bindings` 可能报错 "Generated bindings were outdated"。这通常是因为 upstream 的 `src/generated/bindings.ts` 与 Rust 代码不同步，**不是 fork 改动导致的**。

**处理**：push 时加 `--no-verify` 跳过 hook。fork 的 CI commits（`.githooks/`、`.github/workflows/`）不影响 bindings。

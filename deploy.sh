#!/bin/sh
# 版本化部署:从 HEAD 已提交内容(git archive)复制到 deploy/<版本>/ 全新路径。
# 为什么:① Node ESM 按路径缓存,link 直装会命中旧代缓存(代际混搭事故);
#         ② 用工作区拷贝会踩到用户在面板里切换的分支(分支互踩事故)。
# 纪律:先 commit,再 ./deploy.sh,然后 remove+install(或让会话执行)。
set -e
cd "$(dirname "$0")"
V=$(node -p "require('./package.json').version")
DEST="deploy/$V"
rm -rf "$DEST"
mkdir -p "$DEST"
git archive HEAD --format=tar | tar -x -C "$DEST"
echo "$DEST"

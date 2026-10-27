#!/bin/sh
# 打包检查点:只归档已提交内容(git archive),杜绝把未验证的工作区状态存档。
# 用法:先提交,再 ./package.sh
set -e
cd "$(dirname "$0")"
V=$(node -p "require('./package.json').version")
mkdir -p dist
git archive --format=zip -o "dist/dsh-git-panel-v$V.zip" HEAD
echo "dist/dsh-git-panel-v$V.zip ($(du -h "dist/dsh-git-panel-v$V.zip" | cut -f1))"

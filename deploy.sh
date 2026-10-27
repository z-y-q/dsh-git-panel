#!/bin/sh
# 版本化部署:把插件复制到 deploy/<版本>/ 全新路径,再由 plugin_manager 安装该目录。
# 为什么不用 link 直装:Node ESM 按文件路径缓存模块,link 路径不变 → 可能命中
# 旧代缓存,造成 index.js/git.js 代际混搭(numstatCombined is not a function 事故)。
# 版本化路径 = 每次部署 URL 全新 = 缓存必然失效。先 commit,再 ./deploy.sh。
set -e
cd "$(dirname "$0")"
V=$(node -p "require('./package.json').version")
DEST="deploy/$V"
rm -rf "$DEST"
mkdir -p "$DEST/lib"
cp lib/git.js lib/exec.js lib/index.js lib/client.js "$DEST/lib/"
cp cordis.patch.yml package.json icon.svg "$DEST/"
cp -r locale "$DEST/"
echo "$DEST"

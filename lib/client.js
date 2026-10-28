// lib/client.js — 浏览器半边:右栏「Git」页签 + M3 面板(对齐 Zed 核心能力)。
//
// 形态(经官方 ui-sidebar-terminal 源码验证的两阶段注册):
//  1) ctx.sidebarRightTabs.register({...}) 注册页签类型 + 引导页入口(guide);
//  2) ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
//       { name, key: <类型id>, inject: (sessionId) => props }, Body));
// 通信:不走生成的 ./remote 挂载,直接 connection.rpc.call('/api',
//  'gitPanel/<method>', { args: { agentId, ...参数名 } })(网关 SRC 模式)。
// 规范:自包含单文件(浏览器模块表不支持相对 import);仅用 --dsw-alias-* 主题
// 令牌(带兜底);文本走 ctx.locale;资源在 apply 内注册并返回清理。
// 测试接缝:__graphLayout / __testables 供 node 无头装配直测出货代码。
window.__ModuleLoader__.load({
	id: '@deepseek-ai/dsh-git-panel',
	factory(require) {
		const React = require('react');
		const h = React.createElement;
		const useState = React.useState;
		const useEffect = React.useEffect;
		const useCallback = React.useCallback;
		const useRef = React.useRef;

		const NS = 'gitPanel';
		const TYPE_ID = '@deepseek-ai/dsh-git-panel';
		const REFRESH_MS = 5000;
		const DIFF_MAX_LINES = 400;
		const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

		const dict = {
			zh: {
				title: 'Git',
				description: '工作区变更、暂存与提交、diff、历史、分支与远端同步',
				refresh: '刷新',
				tabChanges: '变更',
				tabHistory: '历史',
				commitPlaceholder: '提交信息…(⌘/Ctrl+Enter 提交)',
				commitN: '提交 (n)',
				staged: '已暂存',
				changes: '变更',
				untracked: '未跟踪',
				conflicted: '冲突',
				stageAll: '全部暂存',
				unstageAll: '全部取消',
				notRepo: '当前会话目录不是 Git 仓库',
				noSession: '没有活动会话',
				loadFailed: '加载失败',
				detached: '已分离 HEAD',
				upstreamNone: '无上游',
				empty: '工作区干净',
				undo: '撤销上次提交(soft reset)',
				undoConfirm: '再点一次确认撤销',
				fetch: 'Fetch',
				pull: 'Pull',
				push: 'Push',
				newBranch: '新建分支',
				newBranchPlaceholder: '分支名…',
				create: '创建',
				cancel: '取消',
				moreLines: '… 还有 {n} 行未显示',
				noHistory: '暂无提交',
				diffFailed: 'diff 加载失败',
				binary: '(二进制文件)',
				lastCommit: '上次提交',
				ai: 'AI 生成提交信息',
				deleteBranch: '删除分支',
				delete: '删除',
				deleteConfirm: '再点一次确认删除',
				commitFiles: '变更文件',
				viewDiff: '全部变更 diff(vs HEAD,不含未跟踪)',
				searchCommits: '搜索提交…',
				noMatch: '无匹配提交',
				discard: '丢弃改动(不可恢复)',
				discardConfirm: '再点一次确认丢弃',
				ours: '用当前',
				theirs: '用传入',
				commitTracked: '提交已跟踪(commit -a)',
				stash: '贮藏',
				stashSave: '贮藏全部改动(含未跟踪)',
				apply: '应用',
				pop: '弹出',
				drop: '删除',
				dropConfirm: '再点一次确认删除',
				stashEmpty: '没有贮藏',
				fileHistory: '文件历史',
				loadMore: '加载更多',
				tag: '在 HEAD 创建标签',
				tagPlaceholder: '标签名…',
				pullRebase: 'Pull --rebase',
				forcePush: '强推(--force-with-lease)',
				forceConfirm: '再点一次确认强推',
				stashTracked: '贮藏已跟踪',
				stashStaged: '贮藏已暂存(git ≥2.35)',
				stashDiff: '查看贮藏内容',
				subRepos: '检测到子目录 Git 仓库,选择要查看的:',
				subRepoActive: '子仓库',
				clear: '清除',
				workspaceRoot: '工作区根目录',
				remote: '远程',
				remoteDefault: '默认',
				stageNext: '暂存并下一个',
				unstageNext: '取消暂存并下一个',
			},
			en: {
				title: 'Git',
				description: 'Working-tree changes, staging, diff, history, branches & sync',
				refresh: 'Refresh',
				tabChanges: 'Changes',
				tabHistory: 'History',
				commitPlaceholder: 'Commit message…(⌘/Ctrl+Enter)',
				commitN: 'Commit (n)',
				staged: 'Staged',
				changes: 'Changes',
				untracked: 'Untracked',
				conflicted: 'Conflicts',
				stageAll: 'Stage all',
				unstageAll: 'Unstage all',
				notRepo: 'The session directory is not a Git repository',
				noSession: 'No active session',
				loadFailed: 'Load failed',
				detached: 'Detached HEAD',
				upstreamNone: 'no upstream',
				empty: 'Working tree clean',
				undo: 'Undo last commit (soft reset)',
				undoConfirm: 'Click again to confirm',
				fetch: 'Fetch',
				pull: 'Pull',
				push: 'Push',
				newBranch: 'New branch',
				newBranchPlaceholder: 'branch name…',
				create: 'Create',
				cancel: 'Cancel',
				moreLines: '… {n} more lines hidden',
				noHistory: 'No commits yet',
				diffFailed: 'diff failed',
				binary: '(binary file)',
				lastCommit: 'Last commit',
				ai: 'AI generate commit message',
				deleteBranch: 'Delete branch',
				delete: 'Delete',
				deleteConfirm: 'Click again to confirm',
				commitFiles: 'Changed files',
				viewDiff: 'All changes diff (vs HEAD, untracked excluded)',
				searchCommits: 'Search commits…',
				noMatch: 'No matching commits',
				discard: 'Discard changes (irreversible)',
				discardConfirm: 'Click again to discard',
				ours: 'Use ours',
				theirs: 'Use theirs',
				commitTracked: 'Commit tracked (commit -a)',
				stash: 'Stash',
				stashSave: 'Stash all changes (incl. untracked)',
				apply: 'Apply',
				pop: 'Pop',
				drop: 'Drop',
				dropConfirm: 'Click again to drop',
				stashEmpty: 'No stashes',
				fileHistory: 'File history',
				loadMore: 'Load more',
				tag: 'Create tag at HEAD',
				tagPlaceholder: 'tag name…',
				pullRebase: 'Pull --rebase',
				forcePush: 'Force push (--force-with-lease)',
				forceConfirm: 'Click again to force push',
				stashTracked: 'Stash tracked only',
				stashStaged: 'Stash staged only (git ≥2.35)',
				stashDiff: 'View stash contents',
				subRepos: 'Git repos found in subfolders — pick one:',
				subRepoActive: 'repo',
				clear: 'clear',
				workspaceRoot: 'Workspace root',
				remote: 'remote',
				remoteDefault: 'default',
				stageNext: 'Stage & next',
				unstageNext: 'Unstage & next',
			},
		};

		// ── 通用样式(全部主题令牌 + 兜底) ──
		const S = {
			root: { display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, fontSize: 12, color: 'var(--dsw-alias-label-primary, inherit)', fontFamily: 'inherit', boxSizing: 'border-box' },
			tabbar: { display: 'flex', gap: 2, padding: '6px 10px 0', borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.18))' },
			tab: { border: 'none', background: 'none', color: 'var(--dsw-alias-label-tertiary, #888)', fontSize: 12, padding: '4px 10px 6px', cursor: 'pointer', borderBottom: '2px solid transparent', fontFamily: 'inherit' },
			tabActive: { color: 'var(--dsw-alias-label-primary, inherit)', fontWeight: 600, borderBottom: '2px solid var(--dsw-alias-accent-default, #2f6fd6)' },
			toolbar: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', flexWrap: 'wrap' },
			select: { flex: '1 1 120px', minWidth: 90, maxWidth: 220, fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2, #c9c9ce)', background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.06))', color: 'var(--dsw-alias-label-primary, inherit)', fontFamily: 'inherit' },
			btn: { border: '1px solid var(--dsw-alias-border-l2, #c9c9ce)', background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.06))', color: 'var(--dsw-alias-label-primary, inherit)', borderRadius: 6, padding: '3px 9px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
			btnPrimary: { border: '1px solid transparent', background: 'var(--dsw-alias-accent-default, #2f6fd6)', color: 'var(--dsw-alias-accent-on, #fff)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
			badge: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)', whiteSpace: 'nowrap' },
			banner: { margin: '8px 10px 0', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(220,38,38,0.4)', background: 'rgba(220,38,38,0.08)', color: 'var(--dsw-alias-label-primary, inherit)', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
			commitBox: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.18))' },
			textarea: { width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 44, maxHeight: 140, fontSize: 12, lineHeight: 1.5, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2, #c9c9ce)', background: 'var(--dsw-alias-bg-layer-1, transparent)', color: 'var(--dsw-alias-label-primary, inherit)', fontFamily: 'inherit' },
			scroll: { flex: '1 1 auto', overflowY: 'auto', overscrollBehavior: 'contain' },
			section: { padding: '2px 0 6px' },
			sectionHead: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px 3px', position: 'sticky', top: 0, background: 'var(--dsw-alias-bg-layer-1, inherit)', zIndex: 1, cursor: 'pointer', userSelect: 'none' },
			chevron: { fontSize: 9, color: 'var(--dsw-alias-label-tertiary, #888)', width: 10, flex: '0 0 auto' },
			sectionTitle: { fontWeight: 600, fontSize: 11, color: 'var(--dsw-alias-label-secondary, #666)', textTransform: 'uppercase', letterSpacing: '0.04em', flex: '0 0 auto' },
			count: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)' },
			miniBtn: { border: 'none', background: 'none', color: 'var(--dsw-alias-label-tertiary, #888)', fontSize: 11, cursor: 'pointer', padding: '1px 4px', borderRadius: 4, fontFamily: 'inherit' },
			row: { display: 'flex', alignItems: 'center', gap: 6, padding: '2px 10px', minHeight: 26, cursor: 'pointer' },
			checkbox: { margin: 0, accentColor: 'var(--dsw-alias-accent-default, #2f6fd6)', flex: '0 0 auto' },
			stateTag: { fontSize: 11, fontWeight: 600, width: 14, flex: '0 0 auto', textAlign: 'center' },
			path: { flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--dsw-alias-label-primary, inherit)' },
			stat: { fontSize: 11, fontFamily: MONO, flex: '0 0 auto', whiteSpace: 'nowrap' },
			added: { color: '#16a34a' },
			deleted: { color: '#dc2626' },
			hint: { padding: '18px 14px', color: 'var(--dsw-alias-label-tertiary, #888)', fontSize: 12, lineHeight: 1.7 },
			small: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
			diff: { margin: '0 10px 6px 30px', border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.18))', borderRadius: 8, overflow: 'hidden' },
			diffHead: { padding: '4px 8px', fontSize: 11, fontFamily: MONO, color: 'var(--dsw-alias-label-tertiary, #888)', background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.06))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
			diffBody: { maxHeight: 240, overflowY: 'auto', fontFamily: MONO, fontSize: 11, lineHeight: 1.5 },
			diffLine: { padding: '0 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
			footer: { borderTop: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.18))', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--dsw-alias-bg-layer-1, transparent)' },
			lastCommit: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
			commitSubject: { flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 },
			short: { fontSize: 11, fontFamily: MONO, color: 'var(--dsw-alias-label-tertiary, #888)', flex: '0 0 auto' },
			confirmBtn: { border: '1px solid rgba(220,38,38,0.5)', background: 'rgba(220,38,38,0.1)', color: '#dc2626', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
			newBranchRow: { display: 'flex', gap: 4, alignItems: 'center', flex: '1 1 200px', minWidth: 160 },
			delRow: { display: 'flex', gap: 4, alignItems: 'center', flex: '1 1 220px', minWidth: 180 },
			input: { flex: '1 1 100px', minWidth: 80, fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2, #c9c9ce)', background: 'var(--dsw-alias-bg-layer-1, transparent)', color: 'var(--dsw-alias-label-primary, inherit)', fontFamily: 'inherit' },
			searchRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.12))' },
			historyItem: { padding: '7px 10px', borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.12))', cursor: 'default' },
			historySubject: { fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
			historyMeta: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)', marginTop: 2 },
			refBadge: { display: 'inline-block', fontSize: 10, padding: '0 5px', marginRight: 4, borderRadius: 4, border: '1px solid var(--dsw-alias-border-l2, #c9c9ce)', color: 'var(--dsw-alias-label-secondary, #666)', lineHeight: '14px', verticalAlign: '1px', whiteSpace: 'nowrap' },
			refBadgeHead: { color: 'var(--dsw-alias-accent-default, #2f6fd6)', borderColor: 'var(--dsw-alias-accent-default, #2f6fd6)', fontWeight: 600 },
			refBadgeTag: { display: 'inline-block', fontSize: 10, padding: '0 5px', marginRight: 4, borderRadius: 4, border: '1px dashed #8b5cf6', color: '#8b5cf6', lineHeight: '14px', verticalAlign: '1px', whiteSpace: 'nowrap' },
			avatar: { width: 14, height: 14, borderRadius: '50%', fontSize: 9, lineHeight: '14px', textAlign: 'center', display: 'inline-block', flex: '0 0 auto', fontWeight: 700, color: '#1a1d27' },
			aiBtn: { border: '1px solid var(--dsw-alias-border-l2, #c9c9ce)', background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.06))', color: 'var(--dsw-alias-label-primary, inherit)', borderRadius: 6, padding: '4px 8px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
			detail: { margin: '2px 10px 8px 26px', padding: '6px 8px', border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.18))', borderRadius: 8 },
			detailFile: { display: 'flex', gap: 6, padding: '1px 0', cursor: 'pointer', minWidth: 0 },
			detailPath: { flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
		};

		const STATE_COLORS = {
			modified: '#d97706', added: '#16a34a', deleted: '#dc2626',
			renamed: '#8b5cf6', copied: '#8b5cf6', typechange: '#0ea5e9', unmerged: '#dc2626', other: '#6b7280',
		};
		const stateColor = (state) => STATE_COLORS[state] || 'var(--dsw-alias-label-tertiary, #888)';
		const stateChar = (entry) => {
			if (!entry) return '?';
			if (entry.state === 'other') return '?';
			return (entry.x || entry.y || (entry.state || '?')[0] || '?').toUpperCase();
		};

		// 当前界面语言(apply 里随 locale/change 事件更新;relTime 等非 t() 文案消费)
		let CURRENT_LANG = 'zh';
		// 页签状态持久化:模块级变量 + sessionStorage 双保险
		// (覆盖:座位重挂载、右栏开合、页面刷新)
		let LAST_TAB = 'changes';
		try { LAST_TAB = sessionStorage.getItem('gitPanel.tab') || LAST_TAB; } catch (e) { /* 无痕模式兜底 */ }
		function rememberTab(next) {
			LAST_TAB = next;
			try { sessionStorage.setItem('gitPanel.tab', next); } catch (e) { /* ignore */ }
		}

		/** 相对时间(双语;与 lib/client-logic.js 的 relTime 同实现)。 */
		function relTime(ts, now) {
			if (!ts) return '';
			let diff = (now || Date.now()) - ts;
			if (diff < 0) diff = 0;
			const m = Math.floor(diff / 60000);
			const en = CURRENT_LANG !== 'zh';
			if (m < 1) return en ? 'just now' : '刚刚';
			if (m < 60) return en ? m + 'm ago' : m + ' 分钟前';
			const hh = Math.floor(m / 60);
			if (hh < 24) return en ? hh + 'h ago' : hh + ' 小时前';
			const d = Math.floor(hh / 24);
			if (d < 30) return en ? d + 'd ago' : d + ' 天前';
			const dt = new Date(ts);
			return en ? (dt.getMonth() + 1) + '/' + dt.getDate() : (dt.getMonth() + 1) + '月' + dt.getDate() + '日';
		}

		/** 长路径中段省略:保留头部与尾部(Zed 同款)。 */
		function displayPath(p) {
			if (p.length <= 46) return p;
			return p.slice(0, 8) + ' … ' + p.slice(-30);
		}

		function byPath(a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0 }

		// ── Git Graph:泳道布局(SVG) ──
		// 经典算法:lanes[i] = 该泳道正在等待的提交哈希。逐条(新→旧):
		//  找到哈希所在泳道画点;第一父提交延续本泳道;其余父提交分叉出新/既有泳道(合并线);
		//  根提交消耗完毕的泳道压缩移除(前后索引差 = 行内横向位移,画贝塞尔)。
		const GRAPH_COLORS = ['#7aa2f7', '#9ece6a', '#e0af68', '#f7768e', '#73daca', '#bb9af7', '#e5c990'];
		const LANE_W = 13;
		const ROW_H = 26;
		const LANES_MAX = 10; // 泳道上限:超出的并到最后一条,文本列永不被挤没

		function layoutGraph(entries) {
			const lanes = [];
			const laneColor = [];
			let colorSeq = 0;
			const newColor = () => GRAPH_COLORS[colorSeq++ % GRAPH_COLORS.length];
			const rows = [];
			let maxLanes = 1;
			for (const e of entries) {
				const before = lanes.slice();
				let lane = lanes.indexOf(e.hash);
				if (lane === -1) {
					lane = lanes.length;
					lanes.push(e.hash);
					laneColor.push(newColor());
				}
				const dotColor = laneColor[lane] || newColor();
				const parents = Array.isArray(e.parents) ? e.parents : [];
				lanes[lane] = parents[0] || null;
				const outTargets = [];
				for (let i = 1; i < parents.length; i++) {
					const p = parents[i];
					let tIdx = lanes.indexOf(p);
					if (tIdx === -1) {
						tIdx = lane + i;
						lanes.splice(tIdx, 0, p);
						laneColor.splice(tIdx, 0, newColor());
					}
					outTargets.push(tIdx);
				}
				// 压缩死泳道(根提交已画完),记录 pre→post 索引映射
				const after = [];
				const afterColors = [];
				const map = new Map();
				for (let i = 0; i < lanes.length; i++) {
					if (lanes[i] === null) continue;
					map.set(i, after.length);
					after.push(lanes[i]);
					afterColors.push(laneColor[i] || newColor());
				}
				lanes.length = 0; lanes.push(...after);
				laneColor.length = 0; laneColor.push(...afterColors);
				rows.push({
					e, lane, before, after, afterColors, dotColor,
					p0Target: parents[0] ? map.get(lane) : null,
					outTargets: outTargets.map(tIdx => map.get(tIdx)),
				});
				maxLanes = Math.max(maxLanes, before.length, after.length, lane + 1);
			}
			return { rows, maxLanes };
		}

		/** 行内 SVG 路径:同列直线,跨列三次贝塞尔。 */
		function graphPath(x1, y1, x2, y2) {
			if (Math.abs(x1 - x2) < 0.5) return 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2;
			const my = (y1 + y2) / 2;
			return 'M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + my + ', ' + x2 + ' ' + my + ', ' + x2 + ' ' + y2;
		}

		function refBadges(refs) {
			if (!refs) return [];
			return refs.split(', ').map(s => s.trim()).filter(Boolean).slice(0, 3).map((r0, i) => {
				const isHead = r0.startsWith('HEAD ->');
				const isTag = r0.startsWith('tag: ');
				const name = isHead ? r0.slice(8) : isTag ? r0.slice(5) : r0;
				return h('span', { key: i, style: isHead ? S.refBadgeHead : isTag ? S.refBadgeTag : S.refBadge }, name);
			});
		}

		/** 作者头像:名字哈希取色 + 首字母。 */
		function Avatar(props) {
			const name = String(props.name || '?');
			const hue = [...name].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
			const bg = GRAPH_COLORS[hue % GRAPH_COLORS.length];
			return h('span', { style: { ...S.avatar, background: bg }, title: name }, (name[0] || '?').toUpperCase());
		}

		function GraphRow(props) {
			const { row, width, headOid, onPick, picked } = props;
			const [hover, setHover] = useState(false);
			const { e, lane, before, after, afterColors, dotColor, p0Target, outTargets } = row;
			const mid = ROW_H / 2;
			const x = (i) => Math.min(i, LANES_MAX - 1) * LANE_W + LANE_W / 2;
			const els = [];
			for (let k = 0; k < before.length; k++) {
				const hh = before[k];
				if (hh === e.hash) {
					els.push(h('path', { key: 'in' + k, d: graphPath(x(k), 0, x(lane), mid), stroke: dotColor, fill: 'none', strokeWidth: 1.5 }));
				} else {
					const j = after.indexOf(hh);
					if (j >= 0) els.push(h('path', { key: 'th' + k, d: graphPath(x(k), 0, x(j), ROW_H), stroke: afterColors[j] || dotColor, fill: 'none', strokeWidth: 1.5 }));
				}
			}
			if (p0Target !== null && p0Target !== undefined) {
				els.push(h('path', { key: 'p0', d: graphPath(x(lane), mid, x(p0Target), ROW_H), stroke: dotColor, fill: 'none', strokeWidth: 1.5 }));
			}
			(outTargets || []).forEach((t2, idx) => {
				els.push(h('path', { key: 'm' + idx, d: graphPath(x(lane), mid, x(t2), ROW_H), stroke: afterColors[t2] || dotColor, fill: 'none', strokeWidth: 1.5 }));
			});
			const isHead = e.hash === headOid;
			els.push(h('circle', { key: 'dot', cx: x(lane), cy: mid, r: isHead ? 5 : 3.5, fill: dotColor, stroke: isHead ? 'var(--dsw-alias-label-primary, #333)' : 'none', strokeWidth: isHead ? 1.5 : 0 }));
			const bg = picked
				? 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.08))'
				: hover ? 'var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.04))' : 'transparent';
			return h('div', {
				style: { display: 'flex', alignItems: 'stretch', background: bg, cursor: 'pointer' },
				onMouseEnter: () => setHover(true),
				onMouseLeave: () => setHover(false),
				onClick: () => onPick(e),
			},
				h('svg', { width, height: ROW_H, style: { flex: '0 0 auto', display: 'block' } }, els),
				h('div', {
					style: { flex: '1 1 auto', minWidth: 0, padding: '3px 10px 3px 2px' },
					title: e.subject + '\n' + new Date(e.time * 1000).toLocaleString(),
				},
					h('div', { style: S.historySubject },
						...refBadges(e.refs),
						h('span', null, e.subject)),
					h('div', { style: { ...S.historyMeta, display: 'flex', alignItems: 'center', gap: 4 } },
						h(Avatar, { name: e.author }),
						h('span', { style: { fontFamily: MONO } }, e.short),
						h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, e.author + ' · ' + relTime(e.time * 1000)),
					),
				));
		}

		// ── diff 渲染 ──
		const DIFF_LINE_STYLE = {
			add: { background: 'rgba(22,163,74,0.12)', color: 'var(--dsw-alias-label-primary, inherit)' },
			del: { background: 'rgba(220,38,38,0.10)', color: 'var(--dsw-alias-label-primary, inherit)' },
			hunk: { color: '#0ea5e9', background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.06))' },
			meta: { color: 'var(--dsw-alias-label-tertiary, #888)' },
			ctx: { color: 'var(--dsw-alias-label-secondary, #555)' },
		};

		/** 词级配对:返回 [aStart, aEnd, bStart, bEnd] 公共前后缀剔除后的中段区间。 */
		function wordRange(a, b) {
			let s = 0;
			const min = Math.min(a.length, b.length);
			while (s < min && a[s] === b[s]) s++;
			let ae = a.length, be = b.length;
			while (ae > s && be > s && a[ae - 1] === b[be - 1]) { ae--; be--; }
			return [s, ae, s, be];
		}

		/** 渲染一行,可选中段高亮(词级 diff)。 */
		function diffLineText(text, mark) {
			if (!mark) return text;
			const [ms, me] = mark;
			return [
				text.slice(0, ms),
				h('span', { style: { borderRadius: 2 } }, text.slice(ms, me)),
				text.slice(me),
			];
		}

		function DiffBlock(props) {
			const { data, t, tall } = props;
			if (!data) return null;
			if (data.loading) return h('div', { style: { ...S.diff, padding: '6px 8px' } }, '…');
			if (data.error) return h('div', { style: { ...S.diff, padding: '6px 8px', color: '#dc2626', fontSize: 11 } }, t('diffFailed') + ': ' + data.error);
			const files = data.files || [];
			if (files.length === 0) return h('div', { style: { ...S.diff, padding: '6px 8px' } }, t('binary'));
			const out = [];
			for (const file of files) {
				out.push(h('div', { key: 'h' + out.length, style: S.diffHead }, file.header));
				let shown = 0;
				const lines = file.lines || [];
				for (let li = 0; li < lines.length; li++) {
					const line = lines[li];
					if (shown >= DIFF_MAX_LINES) {
						out.push(h('div', { key: 'cut' + out.length, style: { ...S.diffLine, color: 'var(--dsw-alias-label-tertiary, #888)' } }, t('moreLines').replace('{n}', String(lines.length - shown))));
						break;
					}
					// 词级高亮:相邻 −行/+行 配对,只对中段(变化部分)加强底色
					let markA = null, markB = null, skipB = false;
					if (line.type === 'del' && li + 1 < lines.length && lines[li + 1].type === 'add') {
						const a = line.text, b = lines[li + 1].text;
						const [as, ae, bs, be] = wordRange(a, b);
						if (ae > as || be > bs) { markA = [as, ae]; markB = [bs, be]; skipB = true; }
					}
					const base = { ...S.diffLine, ...(DIFF_LINE_STYLE[line.type] || DIFF_LINE_STYLE.ctx) };
					if (markA) {
						const seg = wordRange(line.text, lines[li + 1].text);
						out.push(h('div', { key: out.length, style: base },
							line.text.slice(0, seg[0]),
							h('span', { style: { background: 'rgba(220,38,38,0.45)', borderRadius: 2 } }, line.text.slice(seg[0], seg[1])),
							line.text.slice(seg[1])));
					} else if (skipB) {
						continue;
					} else {
						out.push(h('div', { key: out.length, style: base }, line.text));
					}
					shown++;
					if (skipB) {
						const b = lines[li + 1].text;
						const bLine = lines[li + 1];
						const segB = wordRange(line.text, b);
						out.push(h('div', { key: out.length, style: { ...S.diffLine, ...(DIFF_LINE_STYLE[bLine.type] || DIFF_LINE_STYLE.ctx) } },
							b.slice(0, segB[2]),
							h('span', { style: { background: 'rgba(22,163,74,0.4)', borderRadius: 2 } }, b.slice(segB[2], segB[3])),
							b.slice(segB[3])));
						shown++;
						li++;
					}
				}
			}
			return h('div', { style: S.diff }, h('div', { style: { ...S.diffBody, ...(tall ? { maxHeight: 420 } : null) } }, out));
		}

		// ── 文件行(勾选 = 暂存/取消;右侧箭头 = 展开/收起 diff) ──
		function FileRow(props) {
			const { entry, checked, busy, stats, expanded, onToggleCheck, onToggleExpand, kind, onDiscard, onResolve, onHistToggle, domKey, t } = props;
			const [hover, setHover] = useState(false);
			const [armDiscard, setArmDiscard] = useState(false);
			const armTimer = useRef(null);
			const askDiscard = () => {
				if (!armDiscard) {
					setArmDiscard(true);
					if (armTimer.current) clearTimeout(armTimer.current);
					armTimer.current = setTimeout(() => setArmDiscard(false), 3000);
					return;
				}
				if (armTimer.current) clearTimeout(armTimer.current);
				setArmDiscard(false);
				onDiscard(entry);
			};
			const rowStyle = hover ? { ...S.row, background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.08))' } : S.row;
			const st = stats && stats[entry.path];
			const long = entry.path.length > 46;
			const name = long
				? h('span', { style: S.path, title: entry.path }, displayPath(entry.path))
				: h('span', { style: S.path, title: entry.path },
					h('span', { style: { color: 'var(--dsw-alias-label-tertiary, #888)' } }, entry.path.slice(0, entry.path.lastIndexOf('/') + 1)),
					h('span', null, entry.path.slice(entry.path.lastIndexOf('/') + 1)));
			return h('div', { style: rowStyle, 'data-gp-key': domKey || undefined },
				h('div', {
					style: { display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 auto', minWidth: 0 },
					onClick: () => !busy && onToggleCheck(),
					onMouseEnter: () => setHover(true),
					onMouseLeave: () => setHover(false),
				},
					h('input', { type: 'checkbox', style: S.checkbox, checked: checked, disabled: busy, onClick: (e) => e.stopPropagation(), onChange: () => onToggleCheck() }),
					h('span', { style: { ...S.stateTag, color: stateColor(entry.state) } }, stateChar(entry)),
					name,
					st ? h('span', { style: S.stat },
						h('span', { style: S.added }, '+' + (st.added || 0)),
						h('span', { style: S.deleted }, ' −' + (st.deleted || 0)),
					) : (kind === 'untracked' ? h('span', { style: { ...S.stat, color: '#16a34a' } }, '+') : null),
				),
				hover && (kind === 'conflicted') ? [
					h('span', { key: 'o', style: S.miniBtn, title: t('ours'), onClick: (e) => { e.stopPropagation(); onResolve(entry, 'ours'); } }, '⟪'),
					h('span', { key: 't', style: S.miniBtn, title: t('theirs'), onClick: (e) => { e.stopPropagation(); onResolve(entry, 'theirs'); } }, '⟫'),
				] : null,
				hover && (kind === 'changes' || kind === 'untracked') ? h('span', {
					style: { ...(armDiscard ? S.confirmBtn : S.miniBtn), flex: '0 0 auto' },
					title: armDiscard ? t('discardConfirm') : t('discard'),
					onClick: (e) => { e.stopPropagation(); askDiscard(); },
				}, armDiscard ? '✕' : '↩') : null,
				h('span', {
					style: { ...S.miniBtn, flex: '0 0 auto' },
					title: t('fileHistory'),
					onClick: (e) => { e.stopPropagation(); onHistToggle('h:' + entry.path); },
				}, '☰'),
				h('span', {
					style: { ...S.miniBtn, flex: '0 0 auto' },
					title: 'diff',
					onClick: (e) => { e.stopPropagation(); onToggleExpand(); },
				}, expanded ? '▾' : '▸'),
			);
		}

		// ── 分组小节(标题点击折叠;操作按钮不冒泡) ──
		function Section(props) {
			const { t, id, title, entries, checked, busy, stats, onToggleCheck, onToggleAll, actionLabel,
				expandedSet, diffData, onToggleExpand, collapsed, onCollapse, onDiscard, onResolve,
				histSet, histData, onHistToggle } = props;
			if (!entries || entries.length === 0) return null;
			if (collapsed[id]) {
				return h('div', { style: S.section },
					h('div', { style: S.sectionHead, onClick: () => onCollapse(id, false) },
						h('span', { style: S.chevron }, '▸'),
						h('span', { style: S.sectionTitle }, title),
						h('span', { style: S.count }, String(entries.length)),
					));
			}
			const keys = { staged: 's:', changes: 'w:', untracked: 'u:', conflicted: 'w:' };
			return h('div', { style: S.section },
				h('div', { style: S.sectionHead, onClick: () => onCollapse(id, true) },
					h('span', { style: S.chevron }, '▾'),
					h('span', { style: S.sectionTitle }, title),
					h('span', { style: S.count }, String(entries.length)),
					h('span', { style: { flex: '1 1 auto' } }),
					actionLabel ? h('button', { style: S.miniBtn, disabled: busy, onClick: (e) => { e.stopPropagation(); onToggleAll(); } }, actionLabel) : null,
				),
				...entries.map((entry, ei) => {
					const key = (keys[id] || 'w:') + entry.path;
					const isExpanded = !!expandedSet[key];
					return h('div', { key: entry.path },
						h(FileRow, {
							entry, checked, busy, stats,
							kind: id,
							expanded: isExpanded,
							domKey: key,
							onToggleCheck: () => onToggleCheck(entry),
							onToggleExpand: () => onToggleExpand(key, id, entry.path),
							onDiscard, onResolve, onHistToggle, t,
						}),
						isExpanded ? h('div', null,
							h('div', { style: { margin: '0 10px 4px 30px', display: 'flex', gap: 6 } },
								h('button', {
									style: S.btn, disabled: busy,
									onClick: () => {
										onToggleCheck(entry);
										onToggleExpand(key, id, entry.path);
										const next = entries[ei + 1] || entries[ei - 1];
										if (next && typeof document !== 'undefined') {
											const nk = (keys[id] || 'w:') + next.path;
											const el = document.querySelector('[data-gp-key="' + CSS.escape(nk) + '"]');
											if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
										}
									},
								}, checked ? '↑ ' + t('unstageNext') : '✓ ' + t('stageNext')),
							),
							h(DiffBlock, { data: diffData[key], t }),
						) : null,
						histSet && histSet['h:' + entry.path] ? h(FileHistoryList, { data: histData['h:' + entry.path] || { loading: true }, t }) : null,
					);
				}),
			);
		}

		// ── 单文件历史(变更行展开区内切换) ──
		function FileHistoryList(props) {
			const { data, t } = props;
			if (!data) return null;
			if (data.loading) return h('div', { style: { ...S.detail, color: 'var(--dsw-alias-label-tertiary, #888)', fontSize: 11 } }, '…');
			if (data.error) return h('div', { style: { ...S.detail, color: '#dc2626', fontSize: 11 } }, t('loadFailed') + ': ' + data.error);
			const items = data.entries || [];
			if (items.length === 0) return h('div', { style: { ...S.detail, color: 'var(--dsw-alias-label-tertiary, #888)', fontSize: 11 } }, t('noHistory'));
			return h('div', { style: S.detail },
				...items.map(function (e) {
					return h('div', { key: e.hash, style: { padding: '2px 0', minWidth: 0 } },
						h('div', { style: { ...S.historySubject, fontSize: 11 }, title: e.subject },
							...refBadges(e.refs), e.subject),
						h('div', { style: { ...S.historyMeta, fontSize: 10 } },
							h('span', { style: { fontFamily: MONO } }, e.short), ' · ' + e.author + ' · ' + relTime(e.time * 1000)),
					);
				}),
			);
		}

		// ── 贮藏条目(删除两击确认) ──
		function StashItem(props) {
			const { item, busy, onApply, onPop, onDrop, onToggle, t } = props;
			const [armed, setArmed] = useState(false);
			const timer = useRef(null);
			const askDrop = () => {
				if (!armed) {
					setArmed(true);
					if (timer.current) clearTimeout(timer.current);
					timer.current = setTimeout(() => setArmed(false), 3000);
					return;
				}
				if (timer.current) clearTimeout(timer.current);
				setArmed(false);
				onDrop(item);
			};
			return h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', minWidth: 0 } },
				h('span', {
					style: { ...S.miniBtn, flex: '0 0 auto' },
					title: t('stashDiff'),
					onClick: onToggle,
				}, '⌄'),
				h('span', { style: { ...S.small, flex: '1 1 auto', fontFamily: MONO }, title: item.subject }, item.ref),
				h('span', { style: { ...S.small, flex: '0 0 auto' } }, relTime(item.time * 1000)),
				h('button', { style: S.miniBtn, disabled: busy, onClick: () => onApply(item) }, t('apply')),
				h('button', { style: S.miniBtn, disabled: busy, onClick: () => onPop(item) }, t('pop')),
				h('button', { style: armed ? S.confirmBtn : S.miniBtn, disabled: busy, title: armed ? t('dropConfirm') : t('drop'), onClick: askDrop }, '✕'),
			);
		}

		// ── 贮藏列表(条目可展开内容 diff) ──
		function StashList(props) {
			const { items, busy, call, onApply, onPop, onDrop, t } = props;
			const [openRef, setOpenRef] = useState(null);
			const [diff, setDiff] = useState(null);
			const pick = (item) => {
				if (openRef === item.ref) { setOpenRef(null); return; }
				setOpenRef(item.ref);
				setDiff({ loading: true });
				call('stashDiff', { ref: item.ref })
					.then(v => setDiff({ loading: false, files: v.files }))
					.catch(e => setDiff({ loading: false, error: String(e && e.message || e) }));
			};
			return h('div', null,
				...items.map(item => h('div', { key: item.ref, style: { borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.12))', padding: '3px 0' } },
					h(StashItem, {
						item, busy, t,
						onToggle: () => pick(item),
						onApply: () => onApply(item),
						onPop: () => onPop(item),
						onDrop: () => onDrop(item),
					}),
					openRef === item.ref ? h(DiffBlock, { data: diff && diff.loading !== undefined ? diff : null, t }) : null,
				)));
		}

		// ── 提交详情(点选 graph 节点后下钻:文件列表 → 文件 diff) ──
		function CommitDetail(props) {
			const { call, info, t } = props;
			const [openFile, setOpenFile] = useState(null);
			const [fileDiff, setFileDiff] = useState(null);
			if (!info) return null;
			if (info.loading) return h('div', { style: { ...S.detail, color: 'var(--dsw-alias-label-tertiary, #888)', fontSize: 11 } }, '…');
			if (info.error) return h('div', { style: { ...S.detail, color: '#dc2626', fontSize: 11 } }, t('loadFailed') + ': ' + info.error);
			const d = info.data;
			const files = d.files || [];
			const toggleFile = (path) => {
				if (openFile === path) { setOpenFile(null); return; }
				setOpenFile(path);
				setFileDiff({ path, loading: true });
				call('commitFileDiff', { hash: d.hash, path })
					.then(v => setFileDiff({ path, loading: false, files: v.files }))
					.catch(e => setFileDiff({ path, loading: false, error: String(e && e.message || e) }));
			};
			return h('div', { style: S.detail },
				d.body ? h('div', { style: { ...S.small, whiteSpace: 'pre-wrap', marginBottom: 4 } }, d.body) : null,
				h('div', { style: S.historyMeta }, t('commitFiles') + ' (' + files.length + ')'),
				...files.map(f => h('div', { key: f.path },
					h('div', { style: S.detailFile, onClick: () => toggleFile(f.path), title: f.path },
						h('span', { style: { ...S.miniBtn, flex: '0 0 auto' } }, openFile === f.path ? '▾' : '▸'),
						h('span', { style: S.detailPath }, displayPath(f.path)),
						h('span', { style: S.stat },
							h('span', { style: S.added }, '+' + (f.added ?? '')),
							h('span', { style: S.deleted }, ' −' + (f.deleted ?? '')),
						),
					),
					openFile === f.path
						? h(DiffBlock, { data: fileDiff && fileDiff.path === f.path ? fileDiff : null, t })
						: null,
				)),
		);
	}

		// ── 历史视图(图形化 + 搜索 + 节点下钻) ──
		function HistoryView(props) {
			const { history, headOid, call, t } = props;
			const [picked, setPicked] = useState(null);
			const [info, setInfo] = useState(null);
			const [q, setQ] = useState('');
			if (history.loading && !history.entries) return h('div', { style: S.hint }, '…');
			if (history.error) return h('div', { style: { ...S.hint, color: '#dc2626' } }, t('loadFailed') + ': ' + history.error);
			const entries = history.entries || [];
			if (entries.length === 0) return h('div', { style: S.hint }, t('noHistory'));
			const ql = q.trim().toLowerCase();
			const filtered = ql
				? entries.filter(e => (e.subject + ' ' + e.author + ' ' + e.short + ' ' + e.hash).toLowerCase().includes(ql))
				: entries;
			const { rows, maxLanes } = layoutGraph(filtered);
			const width = Math.max(1, Math.min(maxLanes, LANES_MAX)) * LANE_W;
			const pick = (e) => {
				if (picked === e.hash) { setPicked(null); setInfo(null); return; }
				setPicked(e.hash);
				setInfo({ loading: true });
				call('showCommit', { hash: e.hash })
					.then(v => setInfo({ loading: false, data: v }))
					.catch(err => setInfo({ loading: false, error: String(err && err.message || err) }));
			};
			const out = [
				h('div', { key: 'search', style: S.searchRow },
					h('input', {
						style: { ...S.input, flex: '1 1 auto' }, value: q,
						placeholder: t('searchCommits'),
						onChange: (e) => setQ(e.target.value),
						onKeyDown: (e) => { if (e.key === 'Escape') setQ(''); },
					}),
					h('span', { style: S.count }, filtered.length + '/' + entries.length),
				),
			];
			for (const r of rows) {
				out.push(h(GraphRow, { key: r.e.hash, row: r, width, headOid, onPick: pick, picked: picked === r.e.hash }));
				if (picked === r.e.hash) out.push(h(CommitDetail, { key: r.e.hash + ':d', call, info, t }));
			}
			if (entries.length >= (history.limit || 100) && !history.loading) {
				out.push(h('div', { key: 'more', style: { padding: '8px 0', textAlign: 'center' } },
					h('button', { style: S.btn, onClick: () => { historyLimitRef.current += 100; loadHistory(true); } }, t('loadMore')),
				));
			}
			if (rows.length === 0) out.push(h('div', { style: S.hint }, t('noMatch')));
			return h('div', { style: S.root }, out);
		}

		// ── 自愈边界:子组件渲染崩溃时显示可重试错误卡(而非空白/卸载) ──
		class SafePanel extends React.Component {
			constructor(props) {
				super(props);
				this.state = { error: null };
			}
			static getDerivedStateFromError(error) {
				return { error };
			}
			render() {
				if (this.state.error) {
					const msg = (this.state.error && this.state.error.message) || String(this.state.error);
					return h('div', { style: { ...S.hint, color: '#dc2626' } },
						'面板渲染异常: ' + msg,
						h('div', { style: { marginTop: 8 } },
							h('button', { style: S.btn, onClick: () => this.setState({ error: null }) }, '重试')),
					);
				}
				return h(GitBody, this.props);
			}
		}

		// ── 仓库切换 chips(基准仓库/子仓库/兄弟仓库;多候选或已选子仓库时显示) ──
		function RepoChips(props) {
			const { data, onPick, t } = props;
			const isPicker = !!(data && data.repo === false); // 工作区非仓库:必须选择子仓库才能工作
			const chips = [];
			if (data && data.baseRepo) chips.push({ root: '', label: '📦 ' + data.baseRepo + (data.subRepo ? '' : ' ✓') });
			for (const r of (data && data.repos) || []) {
				chips.push({ root: r, label: '📦 ' + r + (r === data.subRepo ? ' ✓' : '') });
			}
			if (chips.length === 0) return null; // 无任何候选
			if (!isPicker && chips.length <= 1) return null; // 单仓库且无子仓库:无可切换对象
			const activeRoot = (data && data.subRepo) || '';
			return h('div', { style: { padding: '6px 10px 0' } },
				isPicker ? h('div', { style: { ...S.small, marginBottom: 6 } }, t('subRepos')) : null,
				h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
					...chips.map(c => h('button', {
						key: c.root || '__base__',
						style: { ...S.btn, fontSize: 11, ...(c.root === activeRoot && data.subRepo ? { borderColor: 'var(--dsw-alias-accent-default, #2f6fd6)', color: 'var(--dsw-alias-accent-default, #2f6fd6)' } : null) },
						onClick: () => onPick(c.root), title: c.root || t('workspaceRoot'),
					}, c.label)),
				));
		}

		// ── 主体面板 ──
		function GitBody(props) {
			const { sessionId, call, openStream, t } = props;
			const [data, setData] = useState(null);
			const [error, setError] = useState(null);
			const [busy, setBusy] = useState(false);
			const [message, setMessage] = useState('');
			const [switching, setSwitching] = useState(false);
			const [tab, setTabState] = useState(LAST_TAB);
			const setTab = (next) => { rememberTab(next); setTabState(next); };
			const [history, setHistory] = useState({ loading: false, entries: null, error: null, limit: 100 });
			const [expandedSet, setExpandedSet] = useState({});
			const [diffData, setDiffData] = useState({});
			const [collapsed, setCollapsed] = useState({});
			const [confirmUndoUntil, setConfirmUndoUntil] = useState(0);
			const [newBranch, setNewBranch] = useState({ open: false, name: '' });
			const [delBranch, setDelBranch] = useState({ open: false, name: '', armed: false });
			const [aiBusy, setAiBusy] = useState(false);
			const [allDiff, setAllDiff] = useState({ open: false, data: null });
			const [subRepo, setSubRepo] = useState(null);
			const [stash, setStash] = useState({ open: false, items: null, loading: false, error: null });
			const [tagIn, setTagIn] = useState({ open: false, name: '' });
			const [overflow, setOverflow] = useState(false);
			const [pushRemote, setPushRemote] = useState('');
			const [remotes, setRemotes] = useState(null);
			const [forceArmed, setForceArmed] = useState(false);
			const forceTimer = useRef(null);
			const [histSet, setHistSet] = useState({});
			const [histData, setHistData] = useState({});
			const [syncing, setSyncing] = useState(null);
			const [synced, setSynced] = useState(null);
			const reqIdRef = useRef(0);
			useEffect(() => {
				// 诊断:若切分支后出现 unmount,即说明座位发生了重挂载(而非组件内状态问题)
				console.info('[git-panel] GitBody mounted');
				return () => { console.info('[git-panel] GitBody unmounted'); };
			}, []);
			const historyLimitRef = useRef(100);
			const backoffRef = useRef(0);
			const sigRef = useRef({});
			const undoTimerRef = useRef(null);
			const historyAtRef = useRef(0);

			const refresh = useCallback(async () => {
				if (!sessionId || typeof call !== 'function') return 'stale';
				const reqId = ++reqIdRef.current;
				try {
					const value = await call('status');
					if (reqId !== reqIdRef.current) return 'stale';
					setData(value);
					setError(null);
					// diff 缓存按统计签名失效:文件集变化即收起该行并丢弃过期 diff(不闪断未变行)
					const stats = (value && value.stats) || {};
					const sigOf = (key) => {
						const kind = key[0], path = key.slice(2);
						if (kind === 'u') return stats[path] ? 'u' : 'u0';
						const st2 = stats[path];
						return st2 ? st2.added + '-' + st2.deleted : 'none';
					};
					const prune = (obj) => {
						const next = {};
						for (const k of Object.keys(obj)) {
							if (sigRef.current[k] === undefined || sigRef.current[k] === sigOf(k)) next[k] = obj[k];
						}
						return next;
					};
					setExpandedSet(prev => prune(prev));
					setDiffData(prev => {
						const next = prune(prev);
						const keep = {};
						for (const k of Object.keys(next)) keep[k] = sigOf(k);
						sigRef.current = keep;
						return next;
					});
					return 'ok';
				} catch (e) {
					if (reqId !== reqIdRef.current) return 'stale';
					setError(String(e && e.message || e));
					return 'fail';
				}
			}, [sessionId, call]);

			// 即时反映:订阅平台文件变更流(Zed 的 instantly reflected 同语义)。
			// 任一 change 帧 → 300ms 防抖刷新;流不可用/断开时静默回退 5s 轮询。
			useEffect(() => {
				if (!sessionId || !openStream || !data || !data.cwd) return;
				const controller = new AbortController();
				let alive = true;
				let debounceTimer = null;
				const kick = () => {
					if (debounceTimer) return;
					debounceTimer = setTimeout(() => { debounceTimer = null; if (alive) refresh(); }, 300);
				};
				(async () => {
					try {
						const stream = openStream('workspaceFiles/changes',
							{ args: { workspaceFileScopeId: sessionId, path: data.cwd } }, controller.signal);
						if (!stream) return;
						for await (const frame of stream) {
							if (!alive) break;
							if (frame && frame.kind === 'change') kick();
						}
					} catch (e) { /* 流不可用:静默回退轮询 */ }
				})();
				return () => { alive = true; controller.abort(); if (debounceTimer) clearTimeout(debounceTimer); };
			}, [sessionId, data && data.cwd, openStream, refresh]);

			// 远程列表(挂载后拉一次;push/pull 指定目标用)
			useEffect(() => {
				if (!sessionId || remotes !== null) return;
				call('remotes').then(v => setRemotes(v.remotes || [])).catch(() => setRemotes([]));
			}, [sessionId, remotes, call]);

			useEffect(() => {
				if (!sessionId) return;
				let disposed = false;
				let timer = null;
				const cycle = async () => {
					if (disposed) return;
					const hidden = typeof document !== 'undefined' && document.hidden;
					const result = hidden ? 'skip' : await refresh();
					if (disposed) return;
					if (result === 'fail') backoffRef.current = Math.min(backoffRef.current ? backoffRef.current * 2 : REFRESH_MS * 2, 30000);
					else if (result === 'ok') backoffRef.current = 0;
					// 页面隐藏时低频空转;恢复可见立即刷一次
					timer = setTimeout(cycle, hidden ? REFRESH_MS : (backoffRef.current || REFRESH_MS));
				};
				cycle();
				const onVisible = () => {
					if (disposed || (typeof document !== 'undefined' && document.hidden)) return;
					if (timer) clearTimeout(timer);
					cycle();
				};
				if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
				return () => {
					disposed = true;
					if (timer) clearTimeout(timer);
					if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
				};
			}, [sessionId, refresh]);

			const loadHistory = useCallback(async (force) => {
				if (!force && Date.now() - historyAtRef.current < 30000) return;
				setHistory(prev => ({ ...prev, loading: true }));
				try {
					const v = await call('history', { limit: historyLimitRef.current });
					historyAtRef.current = Date.now();
					setHistory({ loading: false, entries: v.entries || [], error: null, limit: historyLimitRef.current });
				} catch (e) {
					setHistory({ loading: false, entries: null, error: String(e && e.message || e) });
				}
			}, [call]);

			useEffect(() => {
				if (tab === 'history' && sessionId) loadHistory();
			}, [tab, sessionId, loadHistory]);

			const run = useCallback(async (fn) => {
				setBusy(true);
				try { await fn(); await refresh(); historyAtRef.current = 0; }
				catch (e) { setError(String(e && e.message || e)); }
				finally { setBusy(false); }
			}, [refresh]);

			const stage = (entry) => run(() => call('stage', { paths: [entry.path] }));
			const unstage = (entry) => run(() => call('unstage', { paths: [entry.path] }));
			const stageAll = () => run(() => call('stageAll'));
			const unstageAll = () => run(() => call('unstageAll'));
			const commit = () => {
				const msg = message.trim();
				if (!msg) return;
				run(async () => { await call('commit', { message: msg }); setMessage(''); });
			};
			const checkout = (name) => {
				if (!name) return;
				setSwitching(true);
				run(async () => { await call('checkout', { name }); }).finally(() => setSwitching(false));
			};
			const undoCommit = () => {
				if (Date.now() > confirmUndoUntil) {
					setConfirmUndoUntil(Date.now() + 4000);
					if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
					undoTimerRef.current = setTimeout(() => setConfirmUndoUntil(0), 4200);
					return;
				}
				if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
				setConfirmUndoUntil(0);
				run(() => call('undoCommit', { confirm: true }));
			};
			const sync = (kind) => {
				if (syncing) return;
				setSyncing(kind);
				const extra = (kind === 'push' || kind === 'pull') && pushRemote ? { remote: pushRemote } : {};
				run(() => call(kind, extra))
					.then(() => {
						setSynced(kind);
						setTimeout(() => setSynced(s => (s === kind ? null : s)), 2000);
					})
					.finally(() => setSyncing(null));
			};
			const createBranchNow = () => {
				const name = newBranch.name.trim();
				if (!name) return;
				setNewBranch({ open: false, name: '' });
				run(() => call('createBranch', { name }));
			};
			const deleteBranchNow = () => {
				const name = delBranch.name;
				if (!name) return;
				if (!delBranch.armed) { setDelBranch(p => ({ ...p, armed: true })); return; }
				setDelBranch({ open: false, name: '', armed: false });
				run(() => call('deleteBranch', { name, confirm: true }));
			};
			const aiGenerate = () => {
				if (aiBusy) return;
				setAiBusy(true);
				call('aiMessage', {}, AbortSignal.timeout(90000))
					.then(v => { setMessage(v.message); setError(null); })
					.catch(e => setError('AI: ' + String(e && e.message || e)))
					.finally(() => setAiBusy(false));
			};
			const doDiscard = (entry) => run(() => call('discard', { paths: [entry.path], confirm: true }));
			const resolve = (entry, side) => run(() => call('resolveConflict', { path: entry.path, side }));
			const commitTrackedNow = () => {
				const msg = message.trim();
				if (!msg) return;
				run(async () => { await call('commitTracked', { message: msg }); setMessage(''); });
			};
			const loadStash = useCallback(async () => {
				setStash(prev => ({ ...prev, loading: true }));
				try {
					const v = await call('stashList');
					setStash({ open: true, items: v.entries || [], loading: false, error: null });
				} catch (e) {
					setStash({ open: true, items: null, loading: false, error: String(e && e.message || e) });
				}
			}, [call]);
			const toggleStash = () => { setStash(p => ({ ...p, open: !p.open })); if (!stash.open) loadStash(); };
			const stashSaveNow = () => run(() => call('stashSave')).then(() => { if (stash.open) loadStash(); });
			const stashOp = (kind, item) => run(() => call(kind, { ref: item.ref })).then(() => { if (stash.open) loadStash(); });
			const stashDropNow = (item) => run(() => call('stashDrop', { ref: item.ref, confirm: true })).then(() => { if (stash.open) loadStash(); });
			const createTagNow = () => {
				const name = tagIn.name.trim();
				if (!name) return;
				setTagIn({ open: false, name: '' });
				run(() => call('tag', { name }));
			};
			// 单文件历史(行展开区内切换)
			const toggleHist = (key, path) => {
				let willOpen = false;
				setHistSet(prev => {
					const next = { ...prev };
					if (next[key]) delete next[key];
					else { next[key] = true; willOpen = true; }
					return next;
				});
				if (!willOpen) return;
				setHistData(prev => {
					if (prev[key]) return prev;
					const next = { ...prev, [key]: { loading: true } };
					call('history', { path, limit: 30 })
						.then(v => setHistData(p => ({ ...p, [key]: { loading: false, entries: v.entries } })))
						.catch(e => setHistData(p => ({ ...p, [key]: { loading: false, error: String(e && e.message || e) } })));
					return next;
				});
			};
			const forcePushNow = () => {
				if (!forceArmed) {
					setForceArmed(true);
					if (forceTimer.current) clearTimeout(forceTimer.current);
					forceTimer.current = setTimeout(() => setForceArmed(false), 4000);
					return;
				}
				if (forceTimer.current) clearTimeout(forceTimer.current);
				setForceArmed(false);
				run(() => call('pushForce', { confirm: true }));
			};
			const pullRebaseNow = () => {
				if (syncing) return;
				setSyncing('pull');
				run(() => call('pull', { rebase: true }))
					.then(() => {
						setSynced('pull');
						setTimeout(() => setSynced(s => (s === 'pull' ? null : s)), 2000);
					})
					.finally(() => setSyncing(null));
			};
			const stashVariant = (mode) => run(() => call('stashSave', { mode })).then(() => { if (stash.open) loadStash(); });
			const pickSubRepo = (root) => run(() => call('selectRepo', { root })).then(() => setSubRepo(root || null));
			const clearSubRepo = () => pickSubRepo('');
			const toggleAllDiff = () => {
				if (allDiff.open) { setAllDiff({ open: false, data: null }); return; }
				setAllDiff({ open: true, data: { loading: true } });
				call('diffAll')
					.then(v => setAllDiff({ open: true, data: { loading: false, files: v.files } }))
					.catch(e => setAllDiff({ open: true, data: { loading: false, error: String(e && e.message || e) } }));
			};

			// 展开/收起 diff(懒加载一次,结果缓存;签名随刷新失效)
			const toggleExpand = (key, sectionId, path) => {
				let willExpand = false;
				setExpandedSet(prev => {
					const next = { ...prev };
					if (next[key]) delete next[key];
					else { next[key] = true; willExpand = true; }
					return next;
				});
				if (!willExpand) return;
				const statsNow = (data && data.stats) || {};
				{
					const kind = key[0], p = key.slice(2);
					sigRef.current[key] = kind === 'u'
						? (statsNow[p] ? 'u' : 'u0')
						: (statsNow[p] ? statsNow[p].added + '-' + statsNow[p].deleted : 'none');
				}
				setDiffData(prev => {
					if (prev[key]) return prev;
					const next = { ...prev, [key]: { loading: true } };
					const want = sectionId === 'untracked'
						? call('diffUntracked', { path })
						: call('diff', { path, staged: sectionId === 'staged' });
					want.then(v => setDiffData(p => ({ ...p, [key]: { loading: false, files: v.files } })))
						.catch(e => setDiffData(p => ({ ...p, [key]: { loading: false, error: String(e && e.message || e) } })));
					return next;
				});
			};
			const setSectionCollapsed = (id, value) => setCollapsed(prev => ({ ...prev, [id]: value }));

			if (!sessionId) {
				return h('div', { style: { ...S.root, justifyContent: 'center', alignItems: 'center' } },
					h('div', { style: S.hint }, t('noSession')));
			}

			const st = data && data.repo ? data.status : null;
			const stats = (data && data.stats) || {};
			const staged = (st && st.staged || []).slice().sort(byPath);
			const unstaged = (st && st.unstaged || []).slice().sort(byPath);
			const untracked = (st && st.untracked || []).slice().sort(byPath);
			const conflicted = (st && st.conflicted || []).slice().sort(byPath);
			const branches = (data && data.branches) || [];
			const current = branches.find(b => b.current);
			const branchName = st && st.branch ? (st.branch.head || t('detached')) : '';
			const ab = st && st.branch && st.branch.upstream
				? h('span', { style: S.badge }, '↑' + (st.branch.ahead ?? 0) + ' ↓' + (st.branch.behind ?? 0))
				: (branchName ? h('span', { style: S.badge }, t('upstreamNone')) : null);
			const lastCommit = data && data.lastCommit;
			const totalChanges = staged.length + unstaged.length + untracked.length + conflicted.length;
			const canCommit = staged.length > 0 && message.trim().length > 0 && !busy;
			const undoArmed = Date.now() < confirmUndoUntil;

			// ── 变更页签内容 ──
			const changesView = [];
			if (data && !data.repo) {
				if (!(data.subRepos || []).length) {
					changesView.push(h('div', { style: S.hint }, t('notRepo') + (data.cwd ? '\n' + data.cwd : '')));
				}
			} else if (data && data.repo) {
				changesView.push(h('div', { style: S.commitBox },
					h('textarea', {
						style: S.textarea, value: message, disabled: busy,
						placeholder: t('commitPlaceholder'),
						onChange: (e) => setMessage(e.target.value),
						onKeyDown: (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); commit(); } },
					}),
					h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
						h('button', {
							style: { ...S.aiBtn, opacity: staged.length === 0 && !aiBusy ? 0.5 : 1 },
							disabled: busy || aiBusy || staged.length === 0,
							title: t('ai'),
							onClick: aiGenerate,
						}, aiBusy ? '…' : '✨'),
						h('button', { style: canCommit ? S.btnPrimary : { ...S.btnPrimary, opacity: 0.5, cursor: 'default' }, disabled: !canCommit, onClick: commit },
							t('commitN').replace('n', String(staged.length))),
						h('span', { style: S.small }, data.toplevel ? data.toplevel.split('/').pop() : ''),
						message.trim() ? h('span', {
							style: { ...S.small, flex: '0 0 auto', ...(message.split('\n')[0].length > 72 ? { color: '#d97706' } : null) },
							title: message.split('\n')[0].length > 72 ? '首行超过 72 字符' : undefined,
						}, message.length + ' 字') : null,
					),
				));
				changesView.push(h('div', { style: S.scroll },
					allDiff.open ? h(DiffBlock, { data: allDiff.data, t, tall: true }) : null,
					st && totalChanges === 0 && !allDiff.open ? h('div', { style: { ...S.hint, padding: '14px 12px' } }, '✓ ' + t('empty')) : null,
					h(Section, {
						t, id: 'conflicted', title: t('conflicted'), entries: conflicted, checked: true, busy, stats,
						onToggleCheck: (e) => run(() => call('stage', { paths: [e.path] })),
						onToggleAll: null, actionLabel: '',
						expandedSet, diffData, onToggleExpand: toggleExpand, collapsed, onCollapse: setSectionCollapsed,
						onDiscard: doDiscard, onResolve: resolve,
						histSet, histData, onHistToggle: toggleHist,
					}),
					h(Section, {
						t, id: 'staged', title: t('staged'), entries: staged, checked: true, busy, stats,
						onToggleCheck: unstage, onToggleAll: unstageAll, actionLabel: t('unstageAll'),
						expandedSet, diffData, onToggleExpand: toggleExpand, collapsed, onCollapse: setSectionCollapsed,
						histSet, histData, onHistToggle: toggleHist,
					}),
					h(Section, {
						t, id: 'changes', title: t('changes'), entries: unstaged, checked: false, busy, stats,
						onToggleCheck: stage, onToggleAll: stageAll, actionLabel: t('stageAll'),
						expandedSet, diffData, onToggleExpand: toggleExpand, collapsed, onCollapse: setSectionCollapsed,
						onDiscard: doDiscard,
						histSet, histData, onHistToggle: toggleHist,
					}),
					h(Section, {
						t, id: 'untracked', title: t('untracked'), entries: untracked, checked: false, busy, stats,
						onToggleCheck: stage, onToggleAll: stageAll, actionLabel: t('stageAll'),
						expandedSet, diffData, onToggleExpand: toggleExpand, collapsed, onCollapse: setSectionCollapsed,
						onDiscard: doDiscard,
						histSet, histData, onHistToggle: toggleHist,
					}),
				));
				// 贮藏折叠列表(有内容或展开时显示)
				changesView.push(h('div', { style: { padding: '0 10px 4px' } },
					h('div', { style: { ...S.sectionHead, position: 'static', background: 'transparent', padding: '4px 0 2px' }, onClick: toggleStash },
						h('span', { style: S.chevron }, stash.open ? '▾' : '▸'),
						h('span', { style: S.sectionTitle }, t('stash')),
						h('span', { style: S.count }, stash.items ? String(stash.items.length) : ''),
					),
					stash.open ? (stash.loading ? h('div', { style: { ...S.small, padding: '2px 0' } }, '…')
						: stash.error ? h('div', { style: { ...S.small, color: '#dc2626' } }, t('loadFailed') + ': ' + stash.error)
						: (stash.items || []).length === 0 ? h('div', { style: { ...S.small, padding: '2px 0' } }, t('stashEmpty'))
						: h(StashList, { items: stash.items, busy, call, t,
							onApply: (i) => stashOp('stashApply', i),
							onPop: (i) => stashOp('stashPop', i),
							onDrop: stashDropNow }))
					: null,
				));
				// 底部:最近提交 + 远端同步(Zed 同布局)
				changesView.push(h('div', { style: S.footer },
					lastCommit ? h('div', { style: S.lastCommit },
						h('span', { style: { ...S.small, flex: '0 0 auto' } }, t('lastCommit')),
						h('span', { style: S.commitSubject, title: lastCommit.subject }, lastCommit.subject),
						h('span', { style: S.short }, lastCommit.short),
						h('button', {
							style: undoArmed ? S.confirmBtn : S.miniBtn,
							disabled: busy,
							title: undoArmed ? t('undoConfirm') : t('undo'),
							onClick: undoCommit,
						}, undoArmed ? '✕' : '↩'),
					) : null,
					h('div', { style: { display: 'flex', gap: 6, alignItems: 'center' } },
						h('button', { style: S.btn, disabled: busy || !!syncing, onClick: () => sync('fetch') }, (syncing === 'fetch' ? '… ' : synced === 'fetch' ? '✓ ' : '') + t('fetch')),
						h('button', { style: S.btn, disabled: busy || !!syncing, onClick: () => sync('pull') }, (syncing === 'pull' ? '… ' : synced === 'pull' ? '✓ ' : '') + t('pull')),
						(remotes || []).length > 1 ? h('select', {
							style: { ...S.select, flex: '0 1 auto', minWidth: 70, maxWidth: 120, fontSize: 11, padding: '2px 4px' },
							value: pushRemote, title: t('remote'), onChange: (e) => setPushRemote(e.target.value),
						}, h('option', { value: '' }, t('remoteDefault')), ...remotes.map(r => h('option', { key: r, value: r }, r))) : null,
						h('button', { style: S.btn, disabled: busy || !!syncing, onClick: () => sync('push') }, (syncing === 'push' ? '… ' : synced === 'push' ? '✓ ' : '') + t('push')),
						h('span', { style: { flex: '1 1 auto' } }),
						h('button', { style: S.miniBtn, disabled: busy, title: t('stashSave'), onClick: () => stashVariant('all') }, '📥'),
						h('button', { style: S.miniBtn, disabled: busy, onClick: () => refresh() }, '⟳'),
						h('button', {
							style: { ...S.miniBtn, ...(overflow ? { color: 'var(--dsw-alias-accent-default, #2f6fd6)' } : {}) },
							title: t('pullRebase') + ' / ' + t('forcePush') + ' / ' + t('stash'),
							onClick: () => setOverflow(o => !o),
						}, '⋯'),
					),
					overflow ? h('div', { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
						h('button', { style: S.btn, disabled: busy || !!syncing, onClick: pullRebaseNow, title: t('pullRebase') }, (syncing === 'pull' ? '… ' : '') + t('pullRebase')),
						h('button', {
							style: forceArmed ? S.confirmBtn : S.btn,
							disabled: busy,
							title: forceArmed ? t('forceConfirm') : t('forcePush'),
							onClick: forcePushNow,
						}, forceArmed ? '✕ ' + t('forceConfirm') : '⇪ ' + t('forcePush')),
						h('button', { style: S.btn, disabled: busy, onClick: () => stashVariant('tracked') }, t('stashTracked')),
						h('button', { style: S.btn, disabled: busy, onClick: () => stashVariant('staged') }, t('stashStaged')),
					) : null,
				));
			}

			return h('div', { style: S.root },
				// 仓库切换 chips(多仓库场景:基准仓库/子仓库/兄弟仓库)
				h(RepoChips, { key: 'repos', data, onPick: pickSubRepo, t }),
				// 页签行(Zed 同款 Changes | History)
				h('div', { style: S.tabbar },
					h('button', { style: tab === 'changes' ? { ...S.tab, ...S.tabActive } : S.tab, onClick: () => setTab('changes') },
						t('tabChanges') + (totalChanges ? ' (' + totalChanges + ')' : '')),
					h('button', { style: tab === 'history' ? { ...S.tab, ...S.tabActive } : S.tab, onClick: () => setTab('history') }, t('tabHistory')),
				),
				error ? h('div', { style: S.banner, onClick: () => setError(null), title: 'click to dismiss' }, t('loadFailed') + ': ' + error) : null,
				// 工具栏:分支切换 / 新建 / 删除 / 全部diff / ahead-behind
				h('div', { style: S.toolbar },
					newBranch.open
						? h('div', { style: S.newBranchRow },
							h('input', {
								style: S.input, autoFocus: true, value: newBranch.name,
								placeholder: t('newBranchPlaceholder'),
								onChange: (e) => setNewBranch(p => ({ ...p, name: e.target.value })),
								onKeyDown: (e) => { if (e.key === 'Enter') createBranchNow(); if (e.key === 'Escape') setNewBranch({ open: false, name: '' }); },
							}),
							h('button', { style: S.btn, disabled: busy || !newBranch.name.trim(), onClick: createBranchNow }, t('create')),
							h('button', { style: S.miniBtn, onClick: () => setNewBranch({ open: false, name: '' }) }, t('cancel')),
						)
						: delBranch.open
						? h('div', { style: S.delRow },
							h('select', { style: S.input, value: delBranch.name, onChange: (e) => setDelBranch(p => ({ ...p, name: e.target.value, armed: false })) },
								h('option', { value: '' }, t('deleteBranch') + '…'),
								...branches.filter(b => !b.current).map(b => h('option', { key: b.name, value: b.name }, b.name)),
							),
							h('button', {
								style: delBranch.armed ? S.confirmBtn : S.btn,
								disabled: busy || !delBranch.name,
								onClick: deleteBranchNow,
							}, delBranch.armed ? '✕ ' + t('deleteConfirm') : t('delete')),
							h('button', { style: S.miniBtn, onClick: () => setDelBranch({ open: false, name: '', armed: false }) }, t('cancel')),
						)
						: [
							h('select', {
								key: 'sel', style: S.select, value: current ? current.name : '', disabled: switching || busy || !branches.length,
								onChange: (e) => { const v = e.target.value; e.target.value = current ? current.name : ''; checkout(v); },
								title: current && current.upstream ? current.upstream : branchName,
							},
								branches.length === 0 ? h('option', { value: '' }, branchName || '—') : null,
								...branches.map(b => h('option', { key: b.name, value: b.name }, b.name + (b.current ? ' ✓' : ''))),
							),
							h('button', { key: 'nb', style: S.miniBtn, title: t('newBranch'), disabled: busy, onClick: () => setNewBranch({ open: true, name: '' }) }, '＋'),
							h('button', { key: 'db', style: S.miniBtn, title: t('deleteBranch'), disabled: busy || branches.filter(b => !b.current).length === 0, onClick: () => setDelBranch({ open: true, name: '', armed: false }) }, '🗑'),
							h('button', { key: 'vd', style: { ...S.miniBtn, ...(allDiff.open ? { color: 'var(--dsw-alias-accent-default, #2f6fd6)' } : {}) }, title: t('viewDiff'), disabled: busy, onClick: toggleAllDiff }, '⇄'),
							subRepo ? h('span', { key: 'sr', title: t('subRepoActive') + ': ' + subRepo + ' · ' + t('clear'), style: { ...S.badge, cursor: 'pointer' }, onClick: () => clearSubRepo() }, '📦 ' + subRepo + ' ✕') : null,
							h('span', { key: 'ab' }, ab),
						],
					h('span', { style: { flex: '1 1 auto' } }),
				),
				// 内容
				...(tab === 'history'
					? [h(HistoryView, { key: 'hist', history, headOid: st && st.branch ? st.branch.oid : null, call, t })]
					: changesView),
			);
		}

		// ── 页签标题 ──
		function GitTitle(props) {
			const t = props.t || (k => k);
			return h('span', null, t('title'));
		}

		return {
			inject: ['slots', 'locale', 'sidebarRightTabs', 'connection'],
			// 供 node 单测直测真实出货代码(test/git-graph.test.mjs 经无头装配取用)
			__graphLayout: layoutGraph,
			__testables: { GitBody, SafePanel, HistoryView, CommitDetail, DiffBlock, FileRow, Section, GraphRow, StashList, StashItem, FileHistoryList, RepoChips, refBadges, relTime, Avatar },
			apply(ctx) {
				const t = ctx.locale.bind(NS);

				ctx.effect(() => ctx.locale.register(NS, dict), 'dsh-git-panel.locale');
				try { CURRENT_LANG = ctx.locale.getLocale().active || 'zh'; } catch (e) { /* 保持默认 */ }
				ctx.effect(() => ctx.on('locale/change', (snap) => { CURRENT_LANG = (snap && snap.active) || 'zh'; }), 'dsh-git-panel.lang');

				// 原始 RPC 直连(网关 SRC 模式;wire 键 = 参数名,agent lookup 除外)
				const call = async (sessionId, method, extra, signal) => {
					const connection = ctx.connection;
					const res = await connection.rpc.call('/api', 'gitPanel/' + method,
						{ args: { agentId: sessionId, ...(extra || {}) } }, signal);
					if (res && res.ok === false) {
						const err = res.error || {};
						throw new Error(err.message || err.code || 'remote error');
					}
					return res && typeof res === 'object' && 'value' in res ? res.value : res;
				};

				// 流式 RPC(与 call 同通道;返回 AsyncIterable,不可用时返回 null 由调用方回退)
				const openStream = (endpoint, payload, signal) => {
					const connection = ctx.connection;
					return connection.rpc.open ? connection.rpc.open('/api', endpoint, payload, signal) : null;
				};

				// 阶段一:页签类型 + 引导页入口(右栏空态页可见可点)
				ctx.effect(() => ctx.sidebarRightTabs.register({
					id: TYPE_ID,
					kind: 'git',
					multiple: false,
					priority: 'extension',
					title: () => t('title'),
					guide: [{ id: 'open', order: 40, title: () => t('title'), description: () => t('description') }],
				}), 'dsh-git-panel.type');

				// 阶段二:面板主体 + 标题
				ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
					{
						name: 'sidebar.right.pane.tab', key: TYPE_ID, locale: NS,
						inject: (sessionId) => ({ sessionId, call: (m, x, sig) => call(sessionId, m, x, sig), openStream, t }),
					},
					SafePanel,
				)), 'dsh-git-panel.body');

				ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register(
					{ name: 'sidebar.right.pane.tab.title', key: TYPE_ID, locale: NS, inject: () => ({ t }) },
					GitTitle,
				)), 'dsh-git-panel.title');
			},
		};
	},
});

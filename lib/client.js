// lib/client.js — 浏览器半边:右栏「Git」页签 + M2 面板 UI(对齐 Zed 核心能力)。
//
// 形态(经官方 ui-sidebar-terminal 源码验证的两阶段注册):
//  1) ctx.sidebarRightTabs.register({...}) 注册页签类型 + 引导页入口(guide);
//  2) ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
//       { name, key: <类型id>, inject: (sessionId) => props }, Body));
//     标题席位 'sidebar.right.pane.tab.title' 同 key。
// 通信:不走生成的 ./remote 挂载,直接 connection.rpc.call('/api',
//  'gitPanel/<method>', { args: { agentId, ...参数名 } })(网关 SRC 模式)。
// 规范:自包含单文件(浏览器模块表不支持相对 import);仅用 --dsw-alias-* 主题
// 令牌(带兜底);文本走 ctx.locale;资源在 apply 内注册并返回清理。
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
			},
		};

		// ── 通用样式(全部主题令牌 + 兜底) ──
		const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
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
			input: { flex: '1 1 100px', minWidth: 80, fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2, #c9c9ce)', background: 'var(--dsw-alias-bg-layer-1, transparent)', color: 'var(--dsw-alias-label-primary, inherit)', fontFamily: 'inherit' },
			historyItem: { padding: '7px 10px', borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.12))', cursor: 'default' },
			historySubject: { fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
			historyMeta: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)', marginTop: 2 },
			refBadge: { display: 'inline-block', fontSize: 10, padding: '0 5px', marginRight: 4, borderRadius: 4, border: '1px solid var(--dsw-alias-border-l2, #c9c9ce)', color: 'var(--dsw-alias-label-secondary, #666)', lineHeight: '14px', verticalAlign: '1px', whiteSpace: 'nowrap' },
			refBadgeHead: { color: 'var(--dsw-alias-accent-default, #2f6fd6)', borderColor: 'var(--dsw-alias-accent-default, #2f6fd6)', fontWeight: 600 },
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

		/** 相对时间(与 lib/client-logic.js 的 relTime 同实现;浏览器模块不能相对导入)。 */
		function relTime(ts, now) {
			if (!ts) return '';
			let diff = (now || Date.now()) - ts;
			if (diff < 0) diff = 0;
			const m = Math.floor(diff / 60000);
			if (m < 1) return '刚刚';
			if (m < 60) return m + ' 分钟前';
			const hh = Math.floor(m / 60);
			if (hh < 24) return hh + ' 小时前';
			const d = Math.floor(hh / 24);
			if (d < 30) return d + ' 天前';
			const dt = new Date(ts);
			return (dt.getMonth() + 1) + '月' + dt.getDate() + '日';
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
				const name = isHead ? r0.slice(8) : r0;
				return h('span', { key: i, style: { ...S.refBadge, ...(isHead ? S.refBadgeHead : {}) } }, name);
			});
		}

		function GraphRow(props) {
			const { row, width, headOid } = props;
			const { e, lane, before, after, afterColors, dotColor, p0Target, outTargets } = row;
			const mid = ROW_H / 2;
			const x = (i) => i * LANE_W + LANE_W / 2;
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
			return h('div', { style: { display: 'flex', alignItems: 'stretch' } },
				h('svg', { width, height: ROW_H, style: { flex: '0 0 auto', display: 'block' } }, els),
				h('div', { style: { flex: '1 1 auto', minWidth: 0, padding: '3px 10px 3px 2px' } },
					h('div', { style: S.historySubject, title: e.subject },
						...refBadges(e.refs),
						h('span', null, e.subject)),
					h('div', { style: S.historyMeta },
						h('span', { style: { fontFamily: MONO } }, e.short),
						' · ' + e.author + ' · ' + relTime(e.time * 1000),
					),
				));
		}

		// ── 历史视图(图形化) ──
		function HistoryView(props) {
			const { history, headOid, t } = props;
			if (history.loading && !history.entries) return h('div', { style: S.hint }, '…');
			if (history.error) return h('div', { style: { ...S.hint, color: '#dc2626' } }, t('loadFailed') + ': ' + history.error);
			const entries = history.entries || [];
			if (entries.length === 0) return h('div', { style: S.hint }, t('noHistory'));
			const { rows, maxLanes } = layoutGraph(entries);
			const width = Math.max(1, maxLanes) * LANE_W;
			return h('div', { style: S.scroll },
				...rows.map(r => h(GraphRow, { key: r.e.hash, row: r, width, headOid })));
		}

		// ── diff 渲染 ──
		const DIFF_LINE_STYLE = {
			add: { background: 'rgba(22,163,74,0.12)', color: 'var(--dsw-alias-label-primary, inherit)' },
			del: { background: 'rgba(220,38,38,0.10)', color: 'var(--dsw-alias-label-primary, inherit)' },
			hunk: { color: '#0ea5e9', background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.06))' },
			meta: { color: 'var(--dsw-alias-label-tertiary, #888)' },
			ctx: { color: 'var(--dsw-alias-label-secondary, #555)' },
		};

		function DiffBlock(props) {
			const { data, t } = props;
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
				for (const line of lines) {
					if (shown >= DIFF_MAX_LINES) {
						out.push(h('div', { key: 'cut' + out.length, style: { ...S.diffLine, color: 'var(--dsw-alias-label-tertiary, #888)' } }, t('moreLines').replace('{n}', String(lines.length - shown))));
						break;
					}
					out.push(h('div', { key: out.length, style: { ...S.diffLine, ...(DIFF_LINE_STYLE[line.type] || DIFF_LINE_STYLE.ctx) } }, line.text));
					shown++;
				}
			}
			return h('div', { style: S.diff }, h('div', { style: S.diffBody }, out));
		}

		// ── 文件行(勾选 = 暂存/取消;右侧箭头 = 展开/收起 diff) ──
		function FileRow(props) {
			const { entry, checked, busy, stats, expanded, onToggleCheck, onToggleExpand, kind } = props;
			const [hover, setHover] = useState(false);
			const rowStyle = hover ? { ...S.row, background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.08))' } : S.row;
			const st = stats && stats[entry.path];
			const long = entry.path.length > 46;
			const name = long
				? h('span', { style: S.path, title: entry.path }, displayPath(entry.path))
				: h('span', { style: S.path, title: entry.path },
					h('span', { style: { color: 'var(--dsw-alias-label-tertiary, #888)' } }, entry.path.slice(0, entry.path.lastIndexOf('/') + 1)),
					h('span', null, entry.path.slice(entry.path.lastIndexOf('/') + 1)));
			return h('div', { style: rowStyle },
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
				expandedSet, diffData, onToggleExpand, collapsed, onCollapse } = props;
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
				...entries.map(entry => {
					const key = (keys[id] || 'w:') + entry.path;
					const isExpanded = !!expandedSet[key];
					return h('div', { key: entry.path },
						h(FileRow, {
							entry, checked, busy, stats,
							kind: id,
							expanded: isExpanded,
							onToggleCheck: () => onToggleCheck(entry),
							onToggleExpand: () => onToggleExpand(key, id, entry.path),
						}),
						isExpanded ? h(DiffBlock, { data: diffData[key], t }) : null,
					);
				}),
			);
		}

		// ── 历史视图 ──
		function HistoryView(props) {
			const { history, t } = props;
			if (history.loading && !history.entries) return h('div', { style: S.hint }, '…');
			if (history.error) return h('div', { style: { ...S.hint, color: '#dc2626' } }, t('loadFailed') + ': ' + history.error);
			const entries = history.entries || [];
			if (entries.length === 0) return h('div', { style: S.hint }, t('noHistory'));
			return h('div', { style: S.scroll },
				...entries.map(e => h('div', { key: e.hash, style: S.historyItem },
					h('div', { style: S.historySubject, title: e.subject }, e.subject),
					h('div', { style: S.historyMeta },
						h('span', { style: { fontFamily: MONO } }, e.short),
						' · ' + e.author + ' · ' + relTime(e.time * 1000),
					),
				)));
		}

		// ── 主体面板 ──
		function GitBody(props) {
			const { sessionId, call, t } = props;
			const [data, setData] = useState(null);
			const [error, setError] = useState(null);
			const [busy, setBusy] = useState(false);
			const [message, setMessage] = useState('');
			const [switching, setSwitching] = useState(false);
			const [tab, setTab] = useState('changes');
			const [history, setHistory] = useState({ loading: false, entries: null, error: null });
			const [expandedSet, setExpandedSet] = useState({});
			const [diffData, setDiffData] = useState({});
			const [collapsed, setCollapsed] = useState({});
			const [confirmUndoUntil, setConfirmUndoUntil] = useState(0);
			const [newBranch, setNewBranch] = useState({ open: false, name: '' });
			const [syncing, setSyncing] = useState(null);
			const reqIdRef = useRef(0);

			const refresh = useCallback(async () => {
				if (!sessionId || typeof call !== 'function') return;
				const reqId = ++reqIdRef.current;
				try {
					const value = await call('status');
					if (reqId !== reqIdRef.current) return;
					setData(value);
					setError(null);
				} catch (e) {
					if (reqId !== reqIdRef.current) return;
					setError(String(e && e.message || e));
				}
			}, [sessionId, call]);

			useEffect(() => {
				if (!sessionId) return;
				refresh();
				const timer = setInterval(refresh, REFRESH_MS);
				return () => clearInterval(timer);
			}, [sessionId, refresh]);

			const loadHistory = useCallback(async () => {
				setHistory(prev => ({ ...prev, loading: true }));
				try {
					const v = await call('history', { limit: 100 });
					setHistory({ loading: false, entries: v.entries || [], error: null });
				} catch (e) {
					setHistory({ loading: false, entries: null, error: String(e && e.message || e) });
				}
			}, [call]);

			useEffect(() => {
				if (tab === 'history' && sessionId) loadHistory();
			}, [tab, sessionId, loadHistory]);

			const run = useCallback(async (fn) => {
				setBusy(true);
				try { await fn(); await refresh(); }
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
				if (Date.now() > confirmUndoUntil) { setConfirmUndoUntil(Date.now() + 4000); return; }
				setConfirmUndoUntil(0);
				run(() => call('undoCommit', { confirm: true }));
			};
			const sync = (kind) => {
				if (syncing) return;
				setSyncing(kind);
				run(() => call(kind)).finally(() => setSyncing(null));
			};
			const createBranchNow = () => {
				const name = newBranch.name.trim();
				if (!name) return;
				setNewBranch({ open: false, name: '' });
				run(() => call('createBranch', { name }));
			};

			// 展开/收起 diff(懒加载一次,结果缓存)
			const toggleExpand = (key, sectionId, path) => {
				let willExpand = false;
				setExpandedSet(prev => {
					const next = { ...prev };
					if (next[key]) delete next[key];
					else { next[key] = true; willExpand = true; }
					return next;
				});
				if (!willExpand) return;
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
				changesView.push(h('div', { style: S.hint }, t('notRepo') + (data.cwd ? '\n' + data.cwd : '')));
			} else if (data && data.repo) {
				changesView.push(h('div', { style: S.commitBox },
					h('textarea', {
						style: S.textarea, value: message, disabled: busy,
						placeholder: t('commitPlaceholder'),
						onChange: (e) => setMessage(e.target.value),
						onKeyDown: (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); commit(); } },
					}),
					h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
						h('button', { style: canCommit ? S.btnPrimary : { ...S.btnPrimary, opacity: 0.5, cursor: 'default' }, disabled: !canCommit, onClick: commit },
							t('commitN').replace('n', String(staged.length))),
						h('span', { style: S.small }, data.toplevel ? data.toplevel.split('/').pop() : ''),
					),
				));
				changesView.push(h('div', { style: S.scroll },
					st && totalChanges === 0 ? h('div', { style: { ...S.hint, padding: '14px 12px' } }, '✓ ' + t('empty')) : null,
					h(Section, {
						t, id: 'conflicted', title: t('conflicted'), entries: conflicted, checked: true, busy, stats,
						onToggleCheck: (e) => run(() => call('stage', { paths: [e.path] })),
						onToggleAll: null, actionLabel: '',
						expandedSet, diffData, onToggleExpand: toggleExpand, collapsed, onCollapse: setSectionCollapsed,
					}),
					h(Section, {
						t, id: 'staged', title: t('staged'), entries: staged, checked: true, busy, stats,
						onToggleCheck: unstage, onToggleAll: unstageAll, actionLabel: t('unstageAll'),
						expandedSet, diffData, onToggleExpand: toggleExpand, collapsed, onCollapse: setSectionCollapsed,
					}),
					h(Section, {
						t, id: 'changes', title: t('changes'), entries: unstaged, checked: false, busy, stats,
						onToggleCheck: stage, onToggleAll: stageAll, actionLabel: t('stageAll'),
						expandedSet, diffData, onToggleExpand: toggleExpand, collapsed, onCollapse: setSectionCollapsed,
					}),
					h(Section, {
						t, id: 'untracked', title: t('untracked'), entries: untracked, checked: false, busy, stats,
						onToggleCheck: stage, onToggleAll: stageAll, actionLabel: t('stageAll'),
						expandedSet, diffData, onToggleExpand: toggleExpand, collapsed, onCollapse: setSectionCollapsed,
					}),
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
						h('button', { style: S.btn, disabled: busy || !!syncing, onClick: () => sync('fetch') }, (syncing === 'fetch' ? '… ' : '') + t('fetch')),
						h('button', { style: S.btn, disabled: busy || !!syncing, onClick: () => sync('pull') }, (syncing === 'pull' ? '… ' : '') + t('pull')),
						h('button', { style: S.btn, disabled: busy || !!syncing, onClick: () => sync('push') }, (syncing === 'push' ? '… ' : '') + t('push')),
						h('span', { style: { flex: '1 1 auto' } }),
						h('button', { style: S.miniBtn, disabled: busy, onClick: () => refresh() }, '⟳'),
					),
				));
			}

			return h('div', { style: S.root },
				// 页签行(Zed 同款 Changes | History)
				h('div', { style: S.tabbar },
					h('button', { style: tab === 'changes' ? { ...S.tab, ...S.tabActive } : S.tab, onClick: () => setTab('changes') },
						t('tabChanges') + (totalChanges ? ' (' + totalChanges + ')' : '')),
					h('button', { style: tab === 'history' ? { ...S.tab, ...S.tabActive } : S.tab, onClick: () => setTab('history') }, t('tabHistory')),
				),
				error ? h('div', { style: S.banner, onClick: () => setError(null), title: 'click to dismiss' }, t('loadFailed') + ': ' + error) : null,
				// 工具栏:分支切换 / 新建分支 / ahead-behind
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
							h('span', { key: 'ab' }, ab),
						],
					h('span', { style: { flex: '1 1 auto' } }),
				),
				// 内容
				...(tab === 'history'
					? [h(HistoryView, { key: 'hist', history, headOid: st && st.branch ? st.branch.oid : null, t })]
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
			apply(ctx) {
				const t = ctx.locale.bind(NS);

				ctx.effect(() => ctx.locale.register(NS, dict), 'dsh-git-panel.locale');

				// 原始 RPC 直连(网关 SRC 模式;wire 键 = 参数名,agent lookup 除外)
				const call = async (sessionId, method, extra) => {
					const connection = ctx.connection;
					const res = await connection.rpc.call('/api', 'gitPanel/' + method,
						{ args: { agentId: sessionId, ...(extra || {}) } }, undefined);
					if (res && res.ok === false) {
						const err = res.error || {};
						throw new Error(err.message || err.code || 'remote error');
					}
					return res && typeof res === 'object' && 'value' in res ? res.value : res;
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
						inject: (sessionId) => ({ sessionId, call: (m, x) => call(sessionId, m, x), t }),
					},
					GitBody,
				)), 'dsh-git-panel.body');

				ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register(
					{ name: 'sidebar.right.pane.tab.title', key: TYPE_ID, locale: NS, inject: () => ({ t }) },
					GitTitle,
				)), 'dsh-git-panel.title');
			},
		};
	},
});

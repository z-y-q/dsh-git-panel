// lib/client.js — 浏览器半边:右栏「Git」页签 + M1 面板 UI。
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

		const dict = {
			zh: {
				title: 'Git',
				description: '查看工作区变更、暂存与提交、切换分支',
				refresh: '刷新',
				commitPlaceholder: '提交信息…',
				commit: '提交',
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
				ahead: '领先',
				behind: '落后',
				empty: '工作区干净',
			},
			en: {
				title: 'Git',
				description: 'Working-tree changes, staging, commit and branch switching',
				refresh: 'Refresh',
				commitPlaceholder: 'Commit message…',
				commit: 'Commit',
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
				ahead: 'ahead',
				behind: 'behind',
				empty: 'Working tree clean',
			},
		};

		// ── 通用样式助手(全部主题令牌 + 兜底) ──
		const S = {
			root: { display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, fontSize: 12, color: 'var(--dsw-alias-label-primary, inherit)', fontFamily: 'inherit', boxSizing: 'border-box' },
			toolbar: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.18))', flexWrap: 'wrap' },
			select: { flex: '1 1 120px', minWidth: 90, maxWidth: 220, fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2, #c9c9ce)', background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.06))', color: 'var(--dsw-alias-label-primary, inherit)', fontFamily: 'inherit' },
			btn: { border: '1px solid var(--dsw-alias-border-l2, #c9c9ce)', background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.06))', color: 'var(--dsw-alias-label-primary, inherit)', borderRadius: 6, padding: '3px 9px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
			btnPrimary: { border: '1px solid transparent', background: 'var(--dsw-alias-accent-default, #2f6fd6)', color: 'var(--dsw-alias-accent-on, #fff)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
			badge: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)', whiteSpace: 'nowrap' },
			banner: { margin: '8px 10px 0', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(220,38,38,0.4)', background: 'rgba(220,38,38,0.08)', color: 'var(--dsw-alias-label-primary, #b91c1c)', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
			commitBox: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.18))' },
			textarea: { width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 44, maxHeight: 140, fontSize: 12, lineHeight: 1.5, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2, #c9c9ce)', background: 'var(--dsw-alias-bg-layer-1, transparent)', color: 'var(--dsw-alias-label-primary, inherit)', fontFamily: 'inherit' },
			list: { flex: '1 1 auto', overflowY: 'auto', overscrollBehavior: 'contain' },
			section: { padding: '2px 0 6px' },
			sectionHead: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px 3px', position: 'sticky', top: 0, background: 'var(--dsw-alias-bg-layer-1, inherit)', zIndex: 1 },
			sectionTitle: { fontWeight: 600, fontSize: 11, color: 'var(--dsw-alias-label-secondary, #666)', textTransform: 'uppercase', letterSpacing: '0.04em', flex: '0 0 auto' },
			count: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)' },
			miniBtn: { border: 'none', background: 'none', color: 'var(--dsw-alias-label-tertiary, #888)', fontSize: 11, cursor: 'pointer', padding: '1px 4px', borderRadius: 4, fontFamily: 'inherit' },
			row: { display: 'flex', alignItems: 'center', gap: 6, padding: '2px 10px', minHeight: 26, cursor: 'pointer' },
			rowHover: {},
			checkbox: { margin: 0, accentColor: 'var(--dsw-alias-accent-default, #2f6fd6)', flex: '0 0 auto' },
			stateTag: { fontSize: 11, fontWeight: 600, width: 14, flex: '0 0 auto', textAlign: 'center' },
			path: { flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--dsw-alias-label-primary, inherit)' },
			hint: { padding: '18px 14px', color: 'var(--dsw-alias-label-tertiary, #888)', fontSize: 12, lineHeight: 1.7 },
			small: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
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

		// ── 文件行(勾选 = 暂存/取消暂存) ──
		function FileRow(props) {
			const { entry, checked, busy, onToggle, dir } = props;
			const [hover, setHover] = useState(false);
			const rowStyle = hover
				? { ...S.row, background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.08))' }
				: S.row;
			const name = entry.path.includes('/')
				? h('span', { style: S.path, title: entry.path },
					h('span', { style: { color: 'var(--dsw-alias-label-tertiary, #888)' } }, entry.path.slice(0, entry.path.lastIndexOf('/') + 1)),
					h('span', null, entry.path.slice(entry.path.lastIndexOf('/') + 1)))
				: h('span', { style: S.path, title: entry.path }, entry.path);
			return h('div', {
				style: rowStyle,
				onClick: () => !busy && onToggle(),
				onMouseEnter: () => setHover(true),
				onMouseLeave: () => setHover(false),
				title: (dir === 'unstage' ? '✓ ' : '') + entry.path + (entry.origPath ? ' ← ' + entry.origPath : ''),
			},
				h('input', { type: 'checkbox', style: S.checkbox, checked: checked, disabled: busy, onClick: (e) => e.stopPropagation(), onChange: () => onToggle() }),
				h('span', { style: { ...S.stateTag, color: entry.state === 'other' ? stateColor('other') : stateColor(entry.state) } }, stateChar(entry)),
				name,
			);
		}

		// ── 分组小节 ──
		function Section(props) {
			const { title, entries, checked, busy, onToggle, onToggleAll, allChecked, actionLabel } = props;
			if (!entries || entries.length === 0) return null;
			return h('div', { style: S.section },
				h('div', { style: S.sectionHead },
					h('span', { style: S.sectionTitle }, title),
					h('span', { style: S.count }, String(entries.length)),
					h('span', { style: { flex: '1 1 auto' } }),
					h('button', { style: S.miniBtn, disabled: busy, onClick: onToggleAll, title: actionLabel }, actionLabel),
				),
				...entries.map(entry => h(FileRow, {
					key: entry.path, entry, checked, busy,
					onToggle: () => onToggle(entry),
					dir: checked ? 'unstage' : 'stage',
				})),
			);
		}

		// ── 主体面板 ──
		function GitBody(props) {
			const { sessionId, call, t } = props;
			const [data, setData] = useState(null);
			const [error, setError] = useState(null);
			const [busy, setBusy] = useState(false);
			const [message, setMessage] = useState('');
			const [switching, setSwitching] = useState(false);
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
				run(async () => {
					await call('commit', { message: msg });
					setMessage('');
				});
			};
			const checkout = (name) => {
				if (!name) return;
				setSwitching(true);
				run(async () => { await call('checkout', { name }); }).finally(() => setSwitching(false));
			};

			if (!sessionId) {
				return h('div', { style: { ...S.root, justifyContent: 'center', alignItems: 'center' } },
					h('div', { style: S.hint }, t('noSession')));
			}

			const st = data && data.repo ? data.status : null;
			const staged = (st && st.staged || []).slice().sort(byPath);
			const unstaged = (st && st.unstaged || []).slice().sort(byPath);
			const untracked = (st && st.untracked || []).slice().sort(byPath);
			const conflicted = (st && st.conflicted || []).slice().sort(byPath);
			const branches = (data && data.branches) || [];
			const current = branches.find(b => b.current);
			const branchName = st && st.branch ? (st.branch.head || t('detached')) : '';
			const ab = st && st.branch && st.branch.upstream
				? h('span', { style: S.badge, title: '↑' + (st.branch.ahead ?? 0) + ' ↓' + (st.branch.behind ?? 0) },
					'↑' + (st.branch.ahead ?? 0) + ' ↓' + (st.branch.behind ?? 0))
				: (branchName ? h('span', { style: S.badge }, t('upstreamNone')) : null);

			const canCommit = staged.length > 0 && message.trim().length > 0 && !busy;

			return h('div', { style: S.root },
				// 工具栏:分支切换 + ahead/behind + 刷新
				h('div', { style: S.toolbar },
					h('select', {
						style: S.select, value: current ? current.name : '', disabled: switching || busy || !branches.length,
						onChange: (e) => { const v = e.target.value; e.target.value = current ? current.name : ''; checkout(v); },
						title: current && current.upstream ? current.upstream : branchName,
					},
						branches.length === 0 ? h('option', { value: '' }, branchName || '—') : null,
						...branches.map(b => h('option', { key: b.name, value: b.name }, b.name + (b.current ? ' ✓' : ''))),
					),
					ab,
					h('span', { style: { flex: '1 1 auto' } }),
					h('button', { style: S.btn, disabled: busy, onClick: () => refresh(), title: t('refresh') }, '⟳'),
				),
				error ? h('div', { style: S.banner, onClick: () => setError(null), title: 'click to dismiss' }, t('loadFailed') + ': ' + error) : null,
				// 非仓库提示
				data && !data.repo ? h('div', { style: S.hint }, t('notRepo') + (data.cwd ? '\n' + data.cwd : '')) : null,
				// 提交框
				data && data.repo ? h('div', { style: S.commitBox },
					h('textarea', {
						style: S.textarea, value: message, disabled: busy,
						placeholder: t('commitPlaceholder'),
						onChange: (e) => setMessage(e.target.value),
						onKeyDown: (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); commit(); } },
					}),
					h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
						h('button', { style: canCommit ? S.btnPrimary : { ...S.btnPrimary, opacity: 0.5, cursor: 'default' }, disabled: !canCommit, onClick: commit },
							staged.length > 0 ? t('commit').replace('n', String(staged.length)) : t('commit')),
						h('span', { style: S.small }, data.toplevel ? data.toplevel.split('/').pop() : ''),
					),
				) : null,
				// 变更列表
				h('div', { style: S.list },
					st && staged.length + unstaged.length + untracked.length + conflicted.length === 0
						? h('div', { style: { ...S.hint, padding: '14px 12px' } }, '✓ ' + t('empty')) : null,
					h(Section, { title: t('conflicted'), entries: conflicted, checked: true, busy,
						onToggle: (e) => run(() => call('stage', { paths: [e.path] })), // 冲突行:勾选 = 标记 resolved(git add)
						onToggleAll: () => {}, allChecked: true, actionLabel: '' }),
					h(Section, { title: t('staged'), entries: staged, checked: true, busy,
						onToggle: unstage, onToggleAll: unstageAll, actionLabel: t('unstageAll') }),
					h(Section, { title: t('changes'), entries: unstaged, checked: false, busy,
						onToggle: stage, onToggleAll: stageAll, actionLabel: t('stageAll') }),
					h(Section, { title: t('untracked'), entries: untracked, checked: false, busy,
						onToggle: stage, onToggleAll: stageAll, actionLabel: t('stageAll') }),
				),
			);
		}

		function byPath(a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0 }

		// ── 页签标题 ──
		function GitTitle(props) {
			const t = props.t || (k => k);
			return h('span', null, t('title'));
		}

		return {
			inject: ['slots', 'locale', 'sidebarRightTabs', 'connection'],
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

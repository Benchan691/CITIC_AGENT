window.__ModuleLoader__.load({
	id: "dsh-soc-agent-sidebar",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		let _deepseek_ai_dsh_client_ui_slots = require("@deepseek-ai/dsh-client-ui-slots");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region ../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-sidebar/src/client/SidebarRoot.module.css.mjs
		const css = ".Y0W0aa_root{--dsh-sidebar-inline-padding:12px;height:100%;padding:6px var(--dsh-sidebar-inline-padding);box-sizing:border-box;background:var(--dsw-specific-sidebar-fill);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);flex-direction:column;font-size:14px;display:flex}.Y0W0aa_root.Y0W0aa_collapsed{padding:18px 10px 6px}.Y0W0aa_root.Y0W0aa_quietBars{--dsh-scrollbar-thumb:transparent;--dsh-scrollbar-thumb-hover:transparent}.Y0W0aa_fading>*{opacity:0;transition:opacity .15s var(--ds-ease-in-out)}.Y0W0aa_wide{animation:Y0W0aa_wide-in .2s var(--ds-ease-in-out)}@keyframes Y0W0aa_wide-in{0%{opacity:0}}.Y0W0aa_railIn .Y0W0aa_iconButton,.Y0W0aa_railIn .Y0W0aa_newSession,.Y0W0aa_railIn .Y0W0aa_panelList,.Y0W0aa_railIn .Y0W0aa_regionArea{animation:Y0W0aa_rail-in .15s var(--ds-ease-in-out) backwards}.Y0W0aa_railIn .Y0W0aa_footArea{animation:Y0W0aa_rail-fade-in .15s var(--ds-ease-in-out) backwards}@keyframes Y0W0aa_rail-in{0%{opacity:0;transform:translate(49px)}}@keyframes Y0W0aa_rail-fade-in{0%{opacity:0}}.Y0W0aa_logoRow{box-sizing:border-box;flex:none;justify-content:flex-end;align-items:center;gap:8px;height:60px;margin-bottom:8px;padding:8px 0 8px 4px;display:flex;overflow:hidden}.Y0W0aa_collapsed .Y0W0aa_logoRow{justify-content:flex-start;height:36px;margin-bottom:12px;padding:0}.Y0W0aa_brand{min-width:0;color:inherit;cursor:pointer;background:0 0;border:none;flex:1;align-items:center;padding:0;display:inline-flex;overflow:hidden}.Y0W0aa_brandIdentity{align-items:center;gap:8px;min-width:0;height:24px;display:inline-flex}.Y0W0aa_brandMark{flex:none;justify-content:center;align-items:center;display:inline-flex}.Y0W0aa_brandName{letter-spacing:.04em;align-items:center;gap:6px;min-width:0;height:24px;font-size:18px;font-weight:600;line-height:24px;display:inline-flex}.Y0W0aa_fallbackBrandName{letter-spacing:0;white-space:nowrap;font-size:17px}.Y0W0aa_localBuildBrand{white-space:nowrap;flex-direction:column;flex:none;justify-content:center;align-items:flex-start;gap:1px;height:24px;display:inline-flex}.Y0W0aa_localBuildTitle{letter-spacing:0;font-size:12px;line-height:13px}.Y0W0aa_iconButton{corner-shape:round;cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.Y0W0aa_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.Y0W0aa_collapsed .Y0W0aa_iconButton{width:36px;height:36px}.Y0W0aa_collapsed .Y0W0aa_toggle .Y0W0aa_panelIcon{display:none}.Y0W0aa_collapsed .Y0W0aa_toggle:hover .Y0W0aa_panelIcon{display:inline}.Y0W0aa_collapsed .Y0W0aa_toggle:hover .Y0W0aa_railMark{display:none}.Y0W0aa_railMark{justify-content:center;align-items:center;display:inline-flex}.Y0W0aa_collapsed .Y0W0aa_iconButton{color:var(--dsw-alias-label-primary)}.Y0W0aa_buildVersion{height:10px;color:var(--dsw-alias-label-primary-inverted);background:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code);white-space:nowrap;border-radius:2px;flex:none;align-items:center;padding:0 3px;font-size:6px;font-weight:500;line-height:10px;display:inline-flex}.Y0W0aa_newSession{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-button-elevated-fill);height:38px;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:12px;flex:none;justify-content:center;align-items:center;gap:6px;margin:0 2px 8px;padding:8px 16px;font-size:14px;font-weight:500;line-height:22px;display:flex;overflow:hidden}.Y0W0aa_newSession:hover{background:var(--dsw-alias-button-floating-hover)}.Y0W0aa_collapsed .Y0W0aa_newSession{background:0 0;border-color:#0000;align-self:flex-start;gap:0;width:36px;height:36px;margin:0 0 12px;padding:0}.Y0W0aa_collapsed .Y0W0aa_newSession:hover{background:var(--dsw-alias-interactive-bg-hover)}.Y0W0aa_newSessionLabel{white-space:nowrap;max-width:200px;overflow:hidden}.Y0W0aa_collapsed .Y0W0aa_newSessionLabel{max-width:0}.Y0W0aa_panelList{flex-direction:column;flex:none;gap:4px;margin-bottom:8px;display:flex}.Y0W0aa_panelRow{box-sizing:border-box;width:100%;min-height:36px;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;cursor:pointer;background:0 0;border:none;border-radius:8px;align-items:center;gap:8px;padding:7px 8px;line-height:22px;display:flex}.Y0W0aa_panelRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.Y0W0aa_panelRow.Y0W0aa_panelActive{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary);font-weight:500}.Y0W0aa_panelRow:focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:-2px}.Y0W0aa_panelGlyph{flex:none;justify-content:center;align-items:center;display:inline-flex}.Y0W0aa_panelTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.Y0W0aa_collapsed .Y0W0aa_panelList{gap:12px;margin-bottom:12px}.Y0W0aa_collapsed .Y0W0aa_panelRow{width:36px;height:36px;color:var(--dsw-alias-label-primary);justify-content:center;padding:0}.Y0W0aa_regionArea{min-height:0;margin-left:-4px;margin-right:calc(-1 * var(--dsh-sidebar-inline-padding));flex-direction:column;flex:1;padding-left:4px;display:flex;overflow:hidden}.Y0W0aa_collapsed .Y0W0aa_regionArea{margin-left:0;margin-right:0;padding-left:0}.Y0W0aa_footArea{flex-direction:column;flex:none;display:flex}.Y0W0aa_settingsArea,.Y0W0aa_footerActions{flex:none;width:100%;min-width:0}.Y0W0aa_footerActions{display:flex}.Y0W0aa_collapsed .Y0W0aa_footArea{align-items:center}.Y0W0aa_collapsed .Y0W0aa_settingsArea,.Y0W0aa_collapsed .Y0W0aa_footerActions{justify-content:center;width:auto;display:flex}@media (prefers-reduced-motion:reduce){.Y0W0aa_wide,.Y0W0aa_fading>*,.Y0W0aa_railIn .Y0W0aa_iconButton,.Y0W0aa_railIn .Y0W0aa_newSession,.Y0W0aa_railIn .Y0W0aa_panelList,.Y0W0aa_railIn .Y0W0aa_footArea,.Y0W0aa_railIn .Y0W0aa_regionArea{transition:none;animation:none}}";
		const tagId = "dsh-soc-agent-sidebar/SidebarRoot.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-sidebar";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SidebarRoot_module_css_default = {
			"brand": "Y0W0aa_brand",
			"brandIdentity": "Y0W0aa_brandIdentity",
			"brandMark": "Y0W0aa_brandMark",
			"brandName": "Y0W0aa_brandName",
			"buildVersion": "Y0W0aa_buildVersion",
			"collapsed": "Y0W0aa_collapsed",
			"fading": "Y0W0aa_fading",
			"fallbackBrandName": "Y0W0aa_fallbackBrandName",
			"footArea": "Y0W0aa_footArea",
			"footerActions": "Y0W0aa_footerActions",
			"iconButton": "Y0W0aa_iconButton",
			"localBuildBrand": "Y0W0aa_localBuildBrand",
			"localBuildTitle": "Y0W0aa_localBuildTitle",
			"logoRow": "Y0W0aa_logoRow",
			"newSession": "Y0W0aa_newSession",
			"newSessionLabel": "Y0W0aa_newSessionLabel",
			"panelActive": "Y0W0aa_panelActive",
			"panelGlyph": "Y0W0aa_panelGlyph",
			"panelIcon": "Y0W0aa_panelIcon",
			"panelList": "Y0W0aa_panelList",
			"panelRow": "Y0W0aa_panelRow",
			"panelTitle": "Y0W0aa_panelTitle",
			"quietBars": "Y0W0aa_quietBars",
			"rail-fade-in": "Y0W0aa_rail-fade-in",
			"rail-in": "Y0W0aa_rail-in",
			"railIn": "Y0W0aa_railIn",
			"railMark": "Y0W0aa_railMark",
			"regionArea": "Y0W0aa_regionArea",
			"root": "Y0W0aa_root",
			"settingsArea": "Y0W0aa_settingsArea",
			"toggle": "Y0W0aa_toggle",
			"wide": "Y0W0aa_wide",
			"wide-in": "Y0W0aa_wide-in"
		};
		//#endregion
		//#region src/client/SidebarRoot.tsx
		/**
		* Sidebar shell: column geometry and global panel navigation.
		* Collapse is a slide plus crossfade:
		* content freezes at its expanded width (inline style) and fades out in place
		* while the sliding column (AppFrame grid tracks) clips it — nothing reflows
		* mid-slide. At settle the wide-only content unmounts and the upper
		* controls enter the 56px rail from the same horizontal offset (one icon each,
		* same top-down order) on one fade that ends with the slide. The bottom-pinned
		* settings control only fades. The workspace/session browsing region between
		* global panel rows and the foot is the `sidebar.workspaces` registrant's,
		* and the foot holds `sidebar.settings` plus `sidebar.footer.action`; the shell
		* hands them the wide flag (plus an expand request callback for the browser).
		*
		* The column also owns whether the scroll regions nested in it draw a
		* scrollbar at all: the shell tracks the pointer and rebinds ui-theme's
		* scrollbar indirection away while it is elsewhere, so a list the user is not
		* pointing at carries no bar.
		*/
		/** Wide-content unmount delay; matches the 150ms wide-content fade-out. */
		const COLLAPSE_SETTLE_MS = 150;
		/**
		* How long the column's scrollbars stay drawn after the pointer leaves it.
		* The bar is a pointer affordance here, and hiding it on the leave event
		* itself makes it blink out while the pointer is only crossing the column's
		* edge — on the way to the conversation, or around a portalled menu.
		*/
		const SCROLLBAR_LINGER_MS = 2e3;
		/** Format complete-build metadata for the local brand badge. */
		function localBuildVersion() {
			const version = {}.DSH_CLIENT_VERSION;
			if (version === void 0) return void 0;
			const commit = {}.DSH_CLIENT_COMMIT_HASH;
			return version + (commit === void 0 ? "" : `-${commit}`) + ({}.DSH_CLIENT_GIT_DIRTY === "true" ? "-dirty" : "");
		}
		/** Each panel row subscribes only to its own selection state. */
		function PanelRow({ id, label, wide, usePanelInfo, selectPanel, renderSlot }) {
			const active = usePanelInfo((info) => info.activePanelId === id);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label,
				delayMs: 500,
				disabled: wide,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: clsx(SidebarRoot_module_css_default.panelRow, active && SidebarRoot_module_css_default.panelActive),
					"aria-label": label,
					"aria-current": active ? "page" : void 0,
					onClick: () => {
						selectPanel(id);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SidebarRoot_module_css_default.panelGlyph,
						"aria-hidden": "true",
						children: renderSlot("sidebar.panellist", {
							size: wide ? 16 : 18,
							active
						}, { only: id })
					}), wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: clsx(SidebarRoot_module_css_default.panelTitle, SidebarRoot_module_css_default.wide),
						children: label
					})]
				})
			});
		}
		/**
		* Render the sidebar column shell.
		* @param props - composed slot props (runtime share + injected callbacks, contract/slots.ts).
		* @returns the sidebar element tree.
		*/
		function SidebarRoot({ collapsed, width, startSession, toggleSidebar, selectPanel, usePanels, usePanelInfo, t, renderSlot }) {
			const panels = usePanels((snapshot) => snapshot);
			const [settled, setSettled] = (0, react.useState)(collapsed);
			(0, react.useEffect)(() => {
				if (!collapsed) {
					setSettled(false);
					return;
				}
				const timer = window.setTimeout(() => {
					setSettled(true);
				}, COLLAPSE_SETTLE_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [collapsed]);
			const wide = !collapsed || !settled;
			const lastWideWidth = (0, react.useRef)(width);
			if (!collapsed) lastWideWidth.current = width;
			const everWide = (0, react.useRef)(!collapsed);
			if (!collapsed) everWide.current = true;
			const column = (0, react.useRef)(null);
			const [pointerInside, setPointerInside] = (0, react.useState)(false);
			const lingerTimer = (0, react.useRef)(void 0);
			const armLinger = () => {
				if (lingerTimer.current !== void 0) return;
				lingerTimer.current = window.setTimeout(() => {
					lingerTimer.current = void 0;
					setPointerInside(false);
				}, SCROLLBAR_LINGER_MS);
			};
			const cancelLinger = () => {
				window.clearTimeout(lingerTimer.current);
				lingerTimer.current = void 0;
			};
			(0, react.useEffect)(() => {
				if (!pointerInside) return;
				const onMove = (event) => {
					const rect = column.current?.getBoundingClientRect();
					/* v8 ignore next -- the listener only exists while the column is mounted and revealed. */
					if (rect === void 0) return;
					if (event.clientX >= rect.left && event.clientX < rect.right && event.clientY >= rect.top && event.clientY < rect.bottom) cancelLinger();
					else armLinger();
				};
				document.addEventListener("pointermove", onMove);
				return () => {
					document.removeEventListener("pointermove", onMove);
					cancelLinger();
				};
			}, [pointerInside]);
			const buildVersion = localBuildVersion();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: column,
				className: clsx(SidebarRoot_module_css_default.root, !wide && SidebarRoot_module_css_default.collapsed, !wide && everWide.current && SidebarRoot_module_css_default.railIn, collapsed && wide && SidebarRoot_module_css_default.fading, !pointerInside && SidebarRoot_module_css_default.quietBars),
				style: wide ? { width: collapsed ? lastWideWidth.current : width } : void 0,
				onPointerEnter: () => {
					cancelLinger();
					setPointerInside(true);
				},
				onPointerLeave: () => {
					armLinger();
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SidebarRoot_module_css_default.logoRow,
						children: [wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: clsx(SidebarRoot_module_css_default.brand, SidebarRoot_module_css_default.wide),
							"aria-label": t("session.new.label"),
							onClick: () => {
								startSession();
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: SidebarRoot_module_css_default.brandIdentity,
								"aria-hidden": "true",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SidebarRoot_module_css_default.brandMark,
									children: renderSlot("sidebar.brand.mark", { size: 24 }, { fallback: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FishLogo, { size: 24 }) })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SidebarRoot_module_css_default.brandName,
									children: renderSlot("sidebar.brand.name", {}, { fallback: buildVersion === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SidebarRoot_module_css_default.fallbackBrandName,
										children: t("brand.localBuild")
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: SidebarRoot_module_css_default.localBuildBrand,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SidebarRoot_module_css_default.localBuildTitle,
											children: t("brand.localBuild")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SidebarRoot_module_css_default.buildVersion,
											children: buildVersion
										})]
									}) })
								})]
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: collapsed ? t("toggle.open") : t("toggle.collapse"),
							delayMs: 500,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: clsx(SidebarRoot_module_css_default.iconButton, SidebarRoot_module_css_default.toggle),
								"aria-label": collapsed ? t("toggle.open") : t("toggle.collapse"),
								onClick: () => {
									toggleSidebar();
								},
								children: [!wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SidebarRoot_module_css_default.railMark,
									"aria-hidden": "true",
									children: renderSlot("sidebar.brand.mark", { size: 24 }, { fallback: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FishLogo, { size: 24 }) })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPanelLeftOutline16, {
									className: SidebarRoot_module_css_default.panelIcon,
									size: wide ? 16 : 18
								})]
							})
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: t("session.new.label"),
						delayMs: 500,
						disabled: wide,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: SidebarRoot_module_css_default.newSession,
							"aria-label": t("session.new.label"),
							onClick: () => {
								startSession();
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconNewChatOutline16, { size: wide ? 14 : 18 }), wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: clsx(SidebarRoot_module_css_default.newSessionLabel, SidebarRoot_module_css_default.wide),
								children: t("session.new")
							})]
						})
					}),
					panels.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("nav", {
						className: SidebarRoot_module_css_default.panelList,
						"aria-label": t("panels.label"),
						children: panels.map(({ id, label }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PanelRow, {
							id,
							label,
							wide,
							usePanelInfo,
							selectPanel,
							renderSlot
						}, id))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SidebarRoot_module_css_default.regionArea,
						children: renderSlot("sidebar.workspaces", {
							wide,
							expandSidebar: () => {
								if (collapsed) toggleSidebar();
							}
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SidebarRoot_module_css_default.footArea,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: SidebarRoot_module_css_default.footerActions,
							children: renderSlot("sidebar.footer.action", { wide })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: SidebarRoot_module_css_default.settingsArea,
							children: renderSlot("sidebar.settings", { wide })
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** `sidebar` namespace dictionaries for shell controls and global panels. */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"session.new": "新会话",
			"session.new.label": "新建会话",
			"toggle.open": "打开侧边栏",
			"toggle.collapse": "收起侧边栏",
			"panels.label": "全局面板"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"session.new": "New Session",
			"session.new.label": "New session",
			"toggle.open": "Open sidebar",
			"toggle.collapse": "Collapse sidebar",
			"panels.label": "Global panels"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "sidebar";
		/** Services required by the sidebar plugin. */
		const inject = [
			"slots",
			"layout",
			"uiWorkspace",
			"locale"
		];
		/** Registers the sidebar shell and its service callbacks.
		* @param ctx - Client root context.
		*/
		function apply(ctx) {
			const workspaceNavigation = ctx.get("uiWorkspace");
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-sidebar: dictionaries");
			const panels = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)([]);
			const syncPanels = () => {
				const next = ctx.slots.entriesOfSlot("sidebar.panellist").map(({ options }) => {
					const id = options.id;
					return {
						id,
						order: options.order ?? 0,
						label: (0, _deepseek_ai_dsh_client_ui_slots.resolveSlotLabel)(options.label) ?? id
					};
				}).sort((a, b) => a.order - b.order);
				const previous = panels.getSnapshot();
				if (previous.length === next.length && previous.every((panel, index) => {
					const candidate = next[index];
					return panel.id === candidate.id && panel.order === candidate.order && panel.label === candidate.label;
				})) return;
				panels.set(next);
			};
			ctx.effect(() => ctx.slots.subscribe("sidebar.panellist", syncPanels), "ui-sidebar: panel entries");
			ctx.effect(() => ctx.locale.subscribe(syncPanels), "ui-sidebar: panel labels");
			const injectProps = () => ({
				startSession: (workspaceId) => {
					workspaceNavigation.startSession(workspaceId);
				},
				toggleSidebar: () => {
					ctx.layout.toggleSidebar();
				},
				selectPanel: (id) => {
					ctx.layout.selectPanel(id);
				},
				hooks: { panels }
			});
			ctx.slots.inject("sidebar", () => ctx.slots.register({
				name: "sidebar",
				locale: NS,
				children: {
					"sidebar.brand.mark": {
						kind: "single",
						scope: "root"
					},
					"sidebar.brand.name": {
						kind: "single",
						scope: "root"
					},
					"sidebar.panellist": {
						kind: "list",
						scope: "root"
					},
					"sidebar.workspaces": {
						kind: "single",
						scope: "root"
					},
					"sidebar.settings": {
						kind: "single",
						scope: "root"
					},
					"sidebar.footer.action": {
						kind: "list",
						scope: "root"
					}
				},
				inject: injectProps
			}, SidebarRoot));
			syncPanels();
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
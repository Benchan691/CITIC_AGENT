window.__ModuleLoader__.load({
	id: "dsh-soc-agent-action-policy",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/actionPolicy.ts
		async function readActionMode(client, mode) {
			const value = await client.rpc(mode === void 0 ? "get-action-policy" : "set-action-mode", mode === void 0 ? {} : { mode });
			if (!value || typeof value !== "object" || !("mode" in value) || value.mode !== "soc" && value.mode !== "full") throw new Error("The server returned an invalid access mode.");
			return value.mode;
		}
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-action-policy/src/client/SocActionPolicyMenu.module.css.mjs
		const css = ".RnLWea_root{align-items:center;display:inline-flex;position:relative}.RnLWea_trigger{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:30px;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;border-radius:8px;align-items:center;gap:6px;padding:0 10px;font-size:12px;display:inline-flex}.RnLWea_trigger:hover,.RnLWea_trigger[aria-expanded=true]{border-color:var(--dsw-alias-label-dimmed);color:var(--dsw-alias-label-primary)}.RnLWea_trigger:focus-visible,.RnLWea_modeRadio:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.RnLWea_icon{font-size:15px;line-height:1}.RnLWea_panel{z-index:20;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:min(380px,100vw - 24px);max-height:min(70vh,560px);box-shadow:var(--dsw-shadow-lv2);border-radius:12px;padding:14px;position:absolute;bottom:calc(100% + 8px);right:0;overflow-y:auto}.RnLWea_error,.RnLWea_status{color:var(--dsw-alias-label-tertiary);margin:5px 0 0;font-size:11px;line-height:1.5}.RnLWea_error{color:var(--dsw-alias-label-error)}.RnLWea_modes{border:0;gap:7px;margin-top:12px;padding:0;display:grid}.RnLWea_modeLegend{color:var(--dsw-alias-label-secondary);margin:0 0 4px;font-size:11px;font-weight:600}.RnLWea_mode{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;align-items:center;gap:8px;padding:8px 9px;font-size:12px;line-height:1.4;display:flex}.RnLWea_mode:hover{border-color:var(--dsw-alias-label-dimmed)}.RnLWea_modeRadio{width:15px;height:15px;accent-color:var(--dsw-alias-brand-primary);flex:none;margin:0}.RnLWea_modeText{gap:2px;display:grid}.RnLWea_modeLabel{color:var(--dsw-alias-label-primary);font-weight:600}.RnLWea_modeDescription{color:var(--dsw-alias-label-tertiary);font-size:11px}";
		const tagId = "dsh-soc-agent-action-policy/SocActionPolicyMenu.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-action-policy";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SocActionPolicyMenu_module_css_default = {
			"error": "RnLWea_error",
			"icon": "RnLWea_icon",
			"mode": "RnLWea_mode",
			"modeDescription": "RnLWea_modeDescription",
			"modeLabel": "RnLWea_modeLabel",
			"modeLegend": "RnLWea_modeLegend",
			"modeRadio": "RnLWea_modeRadio",
			"modeText": "RnLWea_modeText",
			"modes": "RnLWea_modes",
			"panel": "RnLWea_panel",
			"root": "RnLWea_root",
			"status": "RnLWea_status",
			"trigger": "RnLWea_trigger"
		};
		//#endregion
		//#region src/client/SocActionPolicyMenu.tsx
		function SocActionPolicyMenu({ socClient }) {
			const panelId = (0, react.useId)();
			const generation = (0, react.useRef)(0);
			const [saving, setSaving] = (0, react.useState)(false);
			const [open, setOpen] = (0, react.useState)(false);
			const [mode, setMode] = (0, react.useState)();
			const [error, setError] = (0, react.useState)();
			(0, react.useEffect)(() => {
				let active = true;
				const request = ++generation.current;
				setError(void 0);
				const timeout = window.setTimeout(() => {
					if (active && request === generation.current) setError("Action settings could not be loaded. Close and reopen this menu to retry.");
				}, 15e3);
				readActionMode(socClient).then((next) => {
					if (!active || request !== generation.current) return;
					setMode(next);
					setError(void 0);
				}).catch((reason) => {
					if (active && request === generation.current) setError(reason instanceof Error ? reason.message : "Action settings are unavailable.");
				}).finally(() => window.clearTimeout(timeout));
				return () => {
					active = false;
					window.clearTimeout(timeout);
				};
			}, [socClient, open]);
			const selectMode = async (next) => {
				if (saving || next === mode) return;
				++generation.current;
				setSaving(true);
				setError(void 0);
				try {
					setMode(await readActionMode(socClient, next));
					setOpen(false);
				} catch (reason) {
					setError(reason instanceof Error ? reason.message : "The access mode could not be saved.");
				} finally {
					setSaving(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SocActionPolicyMenu_module_css_default.root,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: SocActionPolicyMenu_module_css_default.trigger,
					type: "button",
					disabled: saving,
					"aria-expanded": open,
					"aria-controls": panelId,
					onClick: () => setOpen((value) => !value),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SocActionPolicyMenu_module_css_default.icon,
						"aria-hidden": "true",
						children: "✓"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: mode === "full" ? "Full access" : mode === "soc" ? "SOC mode" : "Access mode" })]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: SocActionPolicyMenu_module_css_default.panel,
					id: panelId,
					role: "dialog",
					"aria-label": "SOC action modes",
					children: [
						!mode && !error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: SocActionPolicyMenu_module_css_default.status,
							children: "Loading actions…"
						}),
						error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: SocActionPolicyMenu_module_css_default.error,
							role: "status",
							children: error
						}),
						mode && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
							className: SocActionPolicyMenu_module_css_default.modes,
							disabled: saving,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", {
									className: SocActionPolicyMenu_module_css_default.modeLegend,
									children: "Choose a mode"
								}),
								["full", "soc"].map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: SocActionPolicyMenu_module_css_default.mode,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: SocActionPolicyMenu_module_css_default.modeRadio,
										type: "radio",
										name: panelId,
										checked: mode === option,
										onChange: () => {
											selectMode(option);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: SocActionPolicyMenu_module_css_default.modeText,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SocActionPolicyMenu_module_css_default.modeLabel,
											children: option === "full" ? "Full access" : "SOC mode"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SocActionPolicyMenu_module_css_default.modeDescription,
											children: option === "full" ? "Run every permitted tool directly." : "Apply each tool’s ask, auto-run, or disabled setting."
										})]
									})]
								}, option)),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: SocActionPolicyMenu_module_css_default.status,
									children: "Applies to your current login session."
								})
							]
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Optional end-user access-mode chooser. */
		const inject = ["slots", "socClient"];
		function apply(ctx) {
			const socClient = ctx.get("socClient");
			if (socClient.surface !== "workspace") return;
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "soc-action-policy",
				priority: -10
			}, (props) => react.default.createElement(SocActionPolicyMenu, {
				...props,
				socClient
			})));
		}
		//#endregion
		exports.SocActionPolicyMenu = SocActionPolicyMenu;
		exports.apply = apply;
		exports.inject = inject;
		exports.readActionMode = readActionMode;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
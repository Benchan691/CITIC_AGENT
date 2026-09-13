window.__ModuleLoader__.load({
	id: "dsh-soc-agent-client",
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
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/core/AuthGate.module.css.mjs
		const css$1 = ".-poFUG_layer{z-index:10000;color:#eef3f8;pointer-events:auto;background:#0c121cb8;place-items:center;display:grid;position:fixed;inset:0}.-poFUG_card{background:#182230;border:1px solid #ffffff29;border-radius:14px;width:min(390px,100vw - 40px);padding:28px;box-shadow:0 18px 55px #00000052}.-poFUG_title{margin:0 0 20px;font-size:20px;font-weight:600}.-poFUG_field{gap:6px;margin:14px 0;font-size:13px;display:grid}.-poFUG_input{box-sizing:border-box;width:100%;color:inherit;font:inherit;background:#101923;border:1px solid #fff3;border-radius:8px;padding:10px 11px}.-poFUG_button{color:#fff;cursor:pointer;width:100%;font:inherit;background:#4b8cf7;border:0;border-radius:8px;margin-top:8px;padding:10px 12px}.-poFUG_button:disabled{cursor:wait;opacity:.65}.-poFUG_error{color:#ffb7b7;margin:10px 0;font-size:13px}.-poFUG_notice{color:#ffe0a6;margin:10px 0;font-size:13px}.-poFUG_loading{color:#cbd6e2;font-size:14px}.-poFUG_badge{z-index:10001;color:#dce7f2;pointer-events:auto;background:#182230eb;border:1px solid #ffffff1f;border-radius:999px;align-items:center;gap:10px;padding:6px 9px 6px 11px;font-size:12px;display:flex;position:fixed;top:12px;right:16px}.-poFUG_logout{color:inherit;cursor:pointer;font:inherit;background:0 0;border:1px solid #fff3;border-radius:6px;padding:3px 7px}";
		const tagId$1 = "dsh-soc-agent-client/AuthGate.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var AuthGate_module_css_default = {
			"badge": "-poFUG_badge",
			"button": "-poFUG_button",
			"card": "-poFUG_card",
			"error": "-poFUG_error",
			"field": "-poFUG_field",
			"input": "-poFUG_input",
			"layer": "-poFUG_layer",
			"loading": "-poFUG_loading",
			"logout": "-poFUG_logout",
			"notice": "-poFUG_notice",
			"title": "-poFUG_title"
		};
		//#endregion
		//#region src/client/core/AuthGate.tsx
		async function readAuth() {
			const response = await fetch("/auth/me", {
				credentials: "same-origin",
				cache: "no-store"
			});
			let value = { authenticated: false };
			try {
				const body = await response.json();
				if (body !== null && typeof body === "object") value = body;
			} catch {}
			if (!response.ok) return typeof value.message === "string" ? {
				authenticated: false,
				notice: value.message
			} : { authenticated: false };
			return value.authenticated === true && typeof value.user?.zimbra_email === "string" ? value : { authenticated: false };
		}
		function AuthGate() {
			const [state, setState] = (0, react.useState)(null);
			const [email, setEmail] = (0, react.useState)("");
			const [password, setPassword] = (0, react.useState)("");
			const [error, setError] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const refresh = (0, react.useCallback)(async () => {
				try {
					const next = await readAuth();
					setState((previous) => !next.authenticated && !next.notice && previous?.notice ? {
						...next,
						notice: previous.notice
					} : next);
				} catch {
					setState((previous) => previous?.notice ? {
						authenticated: false,
						notice: previous.notice
					} : { authenticated: false });
				}
			}, []);
			(0, react.useEffect)(() => {
				refresh();
				const timer = window.setInterval(() => {
					refresh();
				}, 3e4);
				const onFocus = () => {
					refresh();
				};
				const onVisibilityChange = () => {
					if (document.visibilityState === "visible") refresh();
				};
				window.addEventListener("focus", onFocus);
				document.addEventListener("visibilitychange", onVisibilityChange);
				return () => {
					window.clearInterval(timer);
					window.removeEventListener("focus", onFocus);
					document.removeEventListener("visibilitychange", onVisibilityChange);
				};
			}, [refresh]);
			const login = async (event) => {
				event.preventDefault();
				setBusy(true);
				setError("");
				try {
					if (!(await fetch("/auth/login", {
						method: "POST",
						credentials: "same-origin",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							email,
							password
						})
					})).ok) throw new Error("Invalid email or password.");
					setPassword("");
					window.location.reload();
				} catch (caught) {
					setPassword("");
					setError(caught instanceof Error ? caught.message : "Login failed.");
					setBusy(false);
				}
			};
			const logout = async () => {
				setBusy(true);
				try {
					await fetch("/auth/logout", {
						method: "POST",
						credentials: "same-origin"
					});
				} finally {
					window.location.reload();
				}
			};
			if (state === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: AuthGate_module_css_default.layer,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: AuthGate_module_css_default.loading,
					children: "Loading…"
				})
			});
			if (!state.authenticated || !state.user) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: AuthGate_module_css_default.layer,
				role: "dialog",
				"aria-label": "Sentinel login",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
					className: AuthGate_module_css_default.card,
					onSubmit: login,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
							className: AuthGate_module_css_default.title,
							children: "Sentinel"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: AuthGate_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Email" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: AuthGate_module_css_default.input,
								type: "email",
								autoComplete: "username",
								value: email,
								onChange: (event) => setEmail(event.target.value),
								required: true
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: AuthGate_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Password" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: AuthGate_module_css_default.input,
								type: "password",
								autoComplete: "current-password",
								value: password,
								onChange: (event) => setPassword(event.target.value),
								required: true
							})]
						}),
						state.notice && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AuthGate_module_css_default.notice,
							role: "status",
							children: state.notice
						}),
						error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AuthGate_module_css_default.error,
							role: "alert",
							children: error
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: AuthGate_module_css_default.button,
							type: "submit",
							disabled: busy,
							children: "Login"
						})
					]
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: AuthGate_module_css_default.badge,
				"aria-label": `Signed in as ${state.user.zimbra_email}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: state.user.zimbra_email }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					className: AuthGate_module_css_default.logout,
					type: "button",
					onClick: () => {
						logout();
					},
					disabled: busy,
					children: "Logout"
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/core/AdminUnavailable.module.css.mjs
		const css = ".Oy1xEW_root{color:#202c35;background:#f4f6f5;place-items:center;min-height:100vh;padding:32px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;display:grid}.Oy1xEW_card{background:#fff;border:1px solid #dfe5e5;border-radius:16px;width:min(100%,520px);padding:32px;box-shadow:0 16px 40px #202c3514}.Oy1xEW_kicker{color:#216b5c;letter-spacing:.08em;margin:0 0 12px;font-size:12px;font-weight:700}.Oy1xEW_card h1{margin:0;font-size:24px}.Oy1xEW_card p:not(.Oy1xEW_kicker){color:#65747d;margin:12px 0 24px}.Oy1xEW_link{color:#216b5c;font-weight:600}";
		const tagId = "dsh-soc-agent-client/AdminUnavailable.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var AdminUnavailable_module_css_default = {
			"card": "Oy1xEW_card",
			"kicker": "Oy1xEW_kicker",
			"link": "Oy1xEW_link",
			"root": "Oy1xEW_root"
		};
		//#endregion
		//#region src/client/core/AdminUnavailable.tsx
		/** Safe admin-route fallback when the optional admin feature is disabled. */
		function AdminUnavailable({ renderSlot, connection, socClient }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("main", {
				className: AdminUnavailable_module_css_default.root,
				children: renderSlot("soc.admin.content", {
					connection,
					socClient
				}, { fallback: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: AdminUnavailable_module_css_default.card,
					"aria-labelledby": "soc-admin-disabled-title",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminUnavailable_module_css_default.kicker,
							children: "CITICTEL-CPC · SOC AGENT"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
							id: "soc-admin-disabled-title",
							children: "Administration UI is disabled"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "Enable the SOC administration plugin in the application configuration to manage service settings." }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
							className: AdminUnavailable_module_css_default.link,
							href: "/",
							children: "Back to workspace"
						})
					]
				}) })
			});
		}
		//#endregion
		//#region src/client/contract.ts
		/** Shared RPC channel owned by the SOC host plugin. */
		const SOC_CONFIG_CHANNEL = "/soc-agent-config";
		/** Resolve the SOC surface from the browser pathname. Kept pure for route tests. */
		function socSurface(pathname) {
			return pathname === "/admin" || pathname.startsWith("/admin/") ? "admin" : "workspace";
		}
		/** Build the shared browser RPC service over the authenticated connection. */
		function createSocClientRuntime(connection, surface) {
			return {
				surface,
				async rpc(name, payload = {}) {
					const result = await connection.rpc.call(SOC_CONFIG_CHANNEL, name, payload);
					if (!result?.ok) throw new Error(result?.error?.message || `Request failed: ${name}`);
					return result.value;
				}
			};
		}
		//#endregion
		//#region src/client/index.ts
		const inject = ["slots", "connection"];
		function apply(ctx) {
			const connection = ctx.get("connection");
			const surface = socSurface(typeof window === "undefined" ? "" : window.location.pathname);
			const socClient = createSocClientRuntime(connection, surface);
			ctx.provide("socClient", socClient);
			if (surface === "admin") {
				ctx.slots.inject("root", () => ctx.slots.register({
					name: "root",
					priority: -1,
					children: { "soc.admin.content": {
						kind: "single",
						scope: "root"
					} },
					inject: () => ({
						connection,
						socClient
					})
				}, AdminUnavailable));
				return;
			}
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "soc-agent-auth-gate",
				priority: -100
			}, AuthGate));
		}
		//#endregion
		exports.SOC_CONFIG_CHANNEL = SOC_CONFIG_CHANNEL;
		exports.apply = apply;
		exports.createSocClientRuntime = createSocClientRuntime;
		exports.inject = inject;
		exports.socSurface = socSurface;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
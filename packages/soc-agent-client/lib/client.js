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
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		//#region \0dsh-css:/home/chan-kok-pan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/CiticBrand.module.css.mjs
		const css$11 = ".q17Pzq_wordmark{text-overflow:ellipsis;white-space:nowrap;letter-spacing:.08em;align-items:center;min-width:0;max-width:100%;font-size:16px;font-weight:700;line-height:24px;display:inline-flex;overflow:hidden}";
		const tagId$11 = "dsh-soc-agent-client/CiticBrand.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$11) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$11;
			tag.textContent = css$11;
			document.head.appendChild(tag);
		}
		var CiticBrand_module_css_default = { "wordmark": "q17Pzq_wordmark" };
		//#endregion
		//#region src/client/CiticBrand.tsx
		/** CITIC Telecom CPC's red emblem, adapted from the official logo artwork. */
		function CiticBrandMark({ size, className }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "80 160 18 18",
				className,
				fill: "none",
				"aria-hidden": "true",
				focusable: "false",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
					transform: "translate(-80.898923,-160.69617)",
					fill: "#d70010",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
							transform: "matrix(0.35277777,0,0,-0.35277777,93.64196,167.46844)",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m 0,0 c 0,9.347 -7.577,16.93 -16.928,16.93 -9.349,0 -16.928,-7.583 -16.928,-16.93 0,-9.347 7.579,-16.925 16.928,-16.925 C -7.577,-16.925 0,-9.347 0,0 M -16.928,18.447 C -6.74,18.447 1.52,10.189 1.52,0 c 0,-10.187 -8.26,-18.442 -18.448,-18.442 -10.184,0 -18.444,8.255 -18.444,18.442 0,10.189 8.26,18.447 18.444,18.447" })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
							transform: "matrix(0.35277777,0,0,-0.35277777,89.825999,163.10352)",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m 0,0 c 0.714,0.405 1.001,1.258 -0.056,1.78 -1.496,0.743 -3.981,1.29 -6.055,1.29 -2.288,0 -4.61,-0.408 -6.247,-1.312 -0.89,-0.488 -0.825,-1.333 0.133,-1.78 1.008,-0.476 3.829,-1.892 3.829,-5.314 l 0.044,-22.315 c 0.732,-0.104 1.479,-0.165 2.241,-0.165 0.735,0 1.46,0.058 2.168,0.155 L -3.9,-5.336 c 0,3.422 3.063,4.862 3.9,5.336" })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
							transform: "matrix(0.35277777,0,0,-0.35277777,90.08078,163.61855)",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m 0,0 c -2.713,-0.619 -3.116,-3.182 -3.116,-3.949 v -21.926 c 1.087,0.267 2.132,0.629 3.116,1.11 z" })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
							transform: "matrix(0.35277777,0,0,-0.35277777,92.09496,168.53023)",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m 0,0 c 0,0 -0.472,-0.815 -0.915,0.316 -0.521,1.455 -0.547,3.843 0,5.344 C -0.482,6.76 0,5.976 0,5.976 0.795,3.964 2.833,4.103 2.833,4.103 H 2.86 C 2.51,9.12 -0.233,13.469 -4.232,16.029 l 0.003,-26.031 c 3.986,2.55 6.718,6.881 7.088,11.87 H 2.833 C 2.833,1.868 0.795,2.009 0,0" })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
							transform: "matrix(0.35277777,0,0,-0.35277777,83.73628,168.53023)",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m 0,0 c 0,0 -0.377,-0.854 -0.915,0.316 -0.538,1.409 -0.606,3.576 0,5.317 0.48,1.146 0.936,0.321 0.936,0.321 C 0.817,3.942 2.767,4.103 2.767,4.103 V 15.98 C -1.481,13.226 -4.288,8.447 -4.288,3.01 c 0,-5.436 2.807,-10.212 7.055,-12.963 V 1.868 C 2.767,1.868 0.795,2.009 0,0" })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
							transform: "matrix(0.35277777,0,0,-0.35277777,85.234031,163.61855)",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m 0,0 v -24.727 c 0.985,-0.49 2.028,-0.881 3.115,-1.158 0,0 -0.002,21.136 -0.002,21.936 C 3.113,-3.15 2.679,-0.568 0,0" })
						})
					]
				})
			});
		}
		/** Sentinel wordmark shown next to the CITIC mark in the expanded sidebar. */
		function CiticBrandName() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: CiticBrand_module_css_default.wordmark,
				children: "Sentinel"
			});
		}
		//#endregion
		//#region \0dsh-css:/home/chan-kok-pan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/AdminConsole.module.css.mjs
		const css$10 = ".K-rYVG_page,.K-rYVG_loginPage{color:#edf3f7;background:#0b1014;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}.K-rYVG_page{background:radial-gradient(circle at 12% 0,#1e788a2b,#0000 34rem),radial-gradient(circle at 92% 8%,#ca8e3314,#0000 30rem),#0b1014}.K-rYVG_shell{width:min(1240px,100% - 48px);margin:0 auto;padding:42px 0 72px}.K-rYVG_header{border-bottom:1px solid #a4bec729;justify-content:space-between;align-items:flex-start;gap:32px;padding:0 0 34px;display:flex}.K-rYVG_eyebrow,.K-rYVG_sectionKicker{color:#80c8d0;letter-spacing:.15em;text-transform:uppercase;margin:0 0 9px;font-size:11px;font-weight:700;line-height:1.4}.K-rYVG_title,.K-rYVG_loginTitle,.K-rYVG_sectionTitle,.K-rYVG_editorTitle{color:#f7fbfc;letter-spacing:-.035em;margin:0}.K-rYVG_title{font-size:clamp(30px,4vw,46px);line-height:1.05}.K-rYVG_subtitle{color:#9aadb5;max-width:600px;margin:13px 0 0;font-size:15px;line-height:1.6}.K-rYVG_headerActions{align-items:center;gap:14px;padding-top:4px;display:flex}.K-rYVG_account{color:#9aadb5;text-overflow:ellipsis;white-space:nowrap;max-width:240px;font-size:12px;overflow:hidden}.K-rYVG_section{margin-top:34px}.K-rYVG_sectionHeading{justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:16px;display:flex}.K-rYVG_sectionKicker{color:#d3a968;margin-bottom:6px}.K-rYVG_sectionTitle{font-size:22px;line-height:1.2}.K-rYVG_sectionHint{color:#72838b;text-align:right;font-size:12px;line-height:1.5}.K-rYVG_statusGrid{grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;display:grid}.K-rYVG_statusCard{background:#141f25c7;border:1px solid #97b9c226;border-radius:15px;gap:13px;min-width:0;padding:17px;display:flex;box-shadow:0 14px 42px #0000001f}.K-rYVG_statusIcon{color:#9edbe0;background:#2b6c7740;border:1px solid #80c8d042;border-radius:10px;flex:0 0 34px;place-items:center;width:34px;height:34px;font-size:14px;font-weight:750;display:grid}.K-rYVG_statusBody{min-width:0}.K-rYVG_statusTopline{justify-content:space-between;align-items:flex-start;gap:8px;display:flex}.K-rYVG_statusTopline h3{color:#eff7f8;margin:1px 0 0;font-size:14px;line-height:1.35}.K-rYVG_statusBody p{color:#82969e;margin:7px 0 0;font-size:12px;line-height:1.45}.K-rYVG_statusPill,.K-rYVG_customBadge,.K-rYVG_customTag,.K-rYVG_countBadge{white-space:nowrap;align-items:center;display:inline-flex}.K-rYVG_statusPill{letter-spacing:.02em;border-radius:999px;flex:none;gap:6px;padding:4px 7px;font-size:10px;font-weight:700}.K-rYVG_statusReady{color:#9ce5be;background:#2c895733}.K-rYVG_statusConfigured,.K-rYVG_statusInfo{color:#a9dce0;background:#468d9733}.K-rYVG_statusError{color:#ffb1b1;background:#8932363d}.K-rYVG_statusMuted{color:#9baab0;background:#7e909724}.K-rYVG_statusDot,.K-rYVG_providerDot{background:#778990;border-radius:50%;width:6px;height:6px;display:inline-block}.K-rYVG_statusReady .K-rYVG_statusDot,.K-rYVG_providerDotReady{background:#59d28c;box-shadow:0 0 0 3px #59d28c1f}.K-rYVG_statusConfigured .K-rYVG_statusDot,.K-rYVG_statusInfo .K-rYVG_statusDot{background:#73cbd3;box-shadow:0 0 0 3px #73cbd31f}.K-rYVG_statusError .K-rYVG_statusDot{background:#f77;box-shadow:0 0 0 3px #ff77771f}.K-rYVG_checkMessage{overflow-wrap:anywhere}.K-rYVG_checkMessage.K-rYVG_success,.K-rYVG_message.K-rYVG_success{color:#91dfb3}.K-rYVG_checkMessage.K-rYVG_error,.K-rYVG_message.K-rYVG_error,.K-rYVG_error{color:#ff9d9d}.K-rYVG_checkMessage.K-rYVG_info,.K-rYVG_message.K-rYVG_info{color:#9bd6df}.K-rYVG_textButton{color:#a9e2e6;cursor:pointer;font:inherit;background:0 0;border:0;margin-top:12px;padding:0;font-size:12px;font-weight:700}.K-rYVG_textButton:hover,.K-rYVG_textButton:focus-visible{color:#e4ffff;text-decoration:underline}.K-rYVG_textButton:disabled{cursor:wait;opacity:.55}.K-rYVG_envManaged{color:#71858d;margin-top:12px;font-size:11px;display:inline-block}.K-rYVG_button,.K-rYVG_dangerButton{color:#d9e7ea;cursor:pointer;min-height:38px;font:inherit;background:#1c2a31bf;border:1px solid #9ab8c038;border-radius:9px;padding:9px 14px;font-size:12px;font-weight:700;transition:border-color .14s,background .14s,transform .14s}.K-rYVG_button:hover:not(:disabled),.K-rYVG_button:focus-visible,.K-rYVG_dangerButton:hover:not(:disabled),.K-rYVG_dangerButton:focus-visible{background:#274149e6;border-color:#94dbe194}.K-rYVG_button:active:not(:disabled),.K-rYVG_dangerButton:active:not(:disabled){transform:translateY(1px)}.K-rYVG_button:disabled,.K-rYVG_dangerButton:disabled{cursor:not-allowed;opacity:.48}.K-rYVG_primary{color:#071215;background:#9bdde0;border-color:#0000}.K-rYVG_primary:hover:not(:disabled),.K-rYVG_primary:focus-visible{color:#071215;background:#c0f0ef;border-color:#0000}.K-rYVG_dangerButton{color:#ffb4b4;background:#782d302e;border-color:#e774744d}.K-rYVG_dangerButton:hover:not(:disabled),.K-rYVG_dangerButton:focus-visible{background:#89323659;border-color:#ff9191a6}.K-rYVG_error{margin:12px 0;font-size:12px;line-height:1.5}.K-rYVG_loading,.K-rYVG_loadingInline{color:#a2b6bc;font-size:14px}.K-rYVG_loading{place-items:center;min-height:100vh;display:grid}.K-rYVG_loadingInline{padding:24px 0}.K-rYVG_providerLayout{background:#0f181dd6;border:1px solid #97b9c229;border-radius:17px;grid-template-columns:minmax(230px,280px) minmax(0,1fr);min-height:480px;display:grid;overflow:hidden;box-shadow:0 18px 60px #00000029}.K-rYVG_providerPicker{background:#141f25b3;border-right:1px solid #97b9c221;flex-direction:column;min-width:0;padding:17px 11px 12px;display:flex}.K-rYVG_pickerHeader{color:#b8c8cd;justify-content:space-between;align-items:center;padding:0 8px 11px;font-size:12px;font-weight:700;display:flex}.K-rYVG_countBadge{color:#a9dce0;background:#468d9733;border-radius:999px;justify-content:center;min-width:22px;padding:3px 6px;font-size:10px}.K-rYVG_providerList{scrollbar-color:#82bac080 transparent;scrollbar-width:thin;flex-direction:column;flex:1;gap:3px;min-height:0;max-height:410px;padding-right:4px;display:flex;overflow-y:auto}.K-rYVG_providerOption,.K-rYVG_customOption{color:#bdcbd0;cursor:pointer;width:100%;min-width:0;font:inherit;text-align:left;background:0 0;border:1px solid #0000;border-radius:10px;align-items:center;gap:10px;padding:11px 9px;display:flex}.K-rYVG_providerOption:hover,.K-rYVG_providerOption:focus-visible,.K-rYVG_customOption:hover,.K-rYVG_customOption:focus-visible{background:#36545b38;border-color:#7fc2c933}.K-rYVG_providerOptionSelected,.K-rYVG_customOptionSelected{color:#f2fbfc;background:#386f7842;border-color:#7ecdd354}.K-rYVG_providerDot{flex:0 0 7px;width:7px;height:7px}.K-rYVG_providerOptionText,.K-rYVG_customOption>span:last-child{flex-direction:column;flex:1;gap:3px;min-width:0;display:flex}.K-rYVG_providerOptionText strong,.K-rYVG_customOption strong{color:inherit;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700;overflow:hidden}.K-rYVG_providerOptionText small,.K-rYVG_customOption small{color:#7f949b;text-overflow:ellipsis;white-space:nowrap;font-size:10px;overflow:hidden}.K-rYVG_customTag,.K-rYVG_customBadge{color:#e1bd7f;text-transform:uppercase;background:#a46f281f;border:1px solid #d3a9684d;border-radius:999px;padding:3px 6px;font-size:9px;font-weight:700}.K-rYVG_customOption{border-top:1px solid #97b9c221;border-radius:0;flex:none;margin-top:12px;padding-top:17px}.K-rYVG_addIcon{color:#e1bd7f;border:1px solid #d3a96859;border-radius:7px;flex:0 0 24px;place-items:center;width:24px;height:24px;font-size:17px;font-weight:400;display:grid}.K-rYVG_providerEditor{background:#0b12166b;min-width:0;padding:31px clamp(22px,4vw,48px) 36px}.K-rYVG_editorHeading{border-bottom:1px solid #97b9c221;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:24px;display:flex}.K-rYVG_editorTitle{font-size:25px;line-height:1.15}.K-rYVG_editorCopy{color:#879aa1;max-width:600px;margin:9px 0 0;font-size:13px;line-height:1.55}.K-rYVG_editorForm{flex-direction:column;gap:20px;max-width:720px;padding-top:26px;display:flex}.K-rYVG_fieldGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;display:grid}.K-rYVG_field{color:#c9d7db;flex-direction:column;gap:8px;min-width:0;font-size:12px;font-weight:700;display:flex}.K-rYVG_field em{color:#71858c;margin-left:4px;font-size:10px;font-style:normal;font-weight:500}.K-rYVG_input{box-sizing:border-box;color:#ecf5f6;width:100%;min-width:0;font:inherit;background:#1a272dc7;border:1px solid #97b9c233;border-radius:9px;outline:0;padding:11px 12px;font-size:13px;font-weight:500;transition:border-color .14s,box-shadow .14s}.K-rYVG_input::placeholder{color:#65777e}.K-rYVG_input:focus{border-color:#89d8deb3;box-shadow:0 0 0 3px #5bb7c021}.K-rYVG_input:disabled{cursor:not-allowed;opacity:.56}.K-rYVG_textarea{resize:vertical;min-height:98px;line-height:1.55}.K-rYVG_fieldHint{color:#71858d;font-size:11px;font-weight:500;line-height:1.5}.K-rYVG_advanced{background:#19262c5c;border:1px solid #97b9c226;border-radius:11px}.K-rYVG_advanced summary{color:#c4d5d9;cursor:pointer;padding:13px 15px;font-size:12px;font-weight:700;list-style-position:inside}.K-rYVG_advanced summary:hover{color:#e7f5f6}.K-rYVG_advancedBody{flex-direction:column;gap:18px;padding:0 15px 18px;display:flex}.K-rYVG_discoveryRow{flex-wrap:wrap;align-items:center;gap:12px;display:flex}.K-rYVG_discovered{flex-wrap:wrap;gap:7px;display:flex}.K-rYVG_modelChip{color:#b6e6e8;cursor:pointer;font:inherit;background:#386f782e;border:1px solid #7ecdd340;border-radius:999px;padding:6px 9px;font-size:11px}.K-rYVG_modelChip:hover,.K-rYVG_modelChip:focus-visible{background:#386f7852;border-color:#7ecdd3a6}.K-rYVG_message{margin:20px 0 0;font-size:12px;line-height:1.5}.K-rYVG_actions{flex-wrap:wrap;align-items:center;gap:10px;margin-top:24px;display:flex}.K-rYVG_confirmGroup{color:#d5b0b0;flex-wrap:wrap;align-items:center;gap:8px;font-size:11px;display:inline-flex}.K-rYVG_confirmGroup .K-rYVG_error{flex-basis:100%;margin:0}.K-rYVG_loginPage{box-sizing:border-box;background:radial-gradient(circle at 50% 0,#25747f47,#0000 35rem),linear-gradient(145deg,#0b1115,#101b20 58%,#11181b);place-items:center;min-height:100vh;padding:24px;display:grid}.K-rYVG_loginPanel{box-sizing:border-box;background:#111c22e0;border:1px solid #a4cad033;border-radius:20px;width:min(100%,430px);padding:38px;box-shadow:0 25px 90px #00000059}.K-rYVG_loginMark{color:#071215;background:#9bdde0;border:1px solid #9bdde080;border-radius:13px;place-items:center;width:42px;height:42px;margin-bottom:25px;font-size:22px;font-weight:800;display:grid}.K-rYVG_loginTitle{font-size:32px;line-height:1.08}.K-rYVG_loginCopy{color:#8fa4aa;margin:13px 0 28px;font-size:13px;line-height:1.6}.K-rYVG_form{flex-direction:column;gap:17px;display:flex}.K-rYVG_fullButton{width:100%;margin-top:3px}.K-rYVG_loginFootnote{color:#6f838a;margin:25px 0 0;font-size:11px;line-height:1.5}@media (width<=1000px){.K-rYVG_statusGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (width<=760px){.K-rYVG_shell{width:min(100% - 28px,620px);padding-top:28px}.K-rYVG_header,.K-rYVG_sectionHeading{flex-direction:column;align-items:flex-start}.K-rYVG_headerActions{justify-content:space-between;width:100%}.K-rYVG_sectionHint{text-align:left}.K-rYVG_statusGrid,.K-rYVG_providerLayout{grid-template-columns:1fr}.K-rYVG_providerPicker{border-bottom:1px solid #97b9c221;border-right:0}.K-rYVG_providerList{max-height:230px}.K-rYVG_providerEditor{padding:25px 18px 30px}.K-rYVG_fieldGrid{grid-template-columns:1fr}}@media (width<=460px){.K-rYVG_loginPanel{padding:28px 22px}.K-rYVG_account{max-width:170px}.K-rYVG_editorHeading{flex-direction:column}}";
		const tagId$10 = "dsh-soc-agent-client/AdminConsole.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$10) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$10;
			tag.textContent = css$10;
			document.head.appendChild(tag);
		}
		var AdminConsole_module_css_default = {
			"account": "K-rYVG_account",
			"actions": "K-rYVG_actions",
			"addIcon": "K-rYVG_addIcon",
			"advanced": "K-rYVG_advanced",
			"advancedBody": "K-rYVG_advancedBody",
			"button": "K-rYVG_button",
			"checkMessage": "K-rYVG_checkMessage",
			"confirmGroup": "K-rYVG_confirmGroup",
			"countBadge": "K-rYVG_countBadge",
			"customBadge": "K-rYVG_customBadge",
			"customOption": "K-rYVG_customOption",
			"customOptionSelected": "K-rYVG_customOptionSelected",
			"customTag": "K-rYVG_customTag",
			"dangerButton": "K-rYVG_dangerButton",
			"discovered": "K-rYVG_discovered",
			"discoveryRow": "K-rYVG_discoveryRow",
			"editorCopy": "K-rYVG_editorCopy",
			"editorForm": "K-rYVG_editorForm",
			"editorHeading": "K-rYVG_editorHeading",
			"editorTitle": "K-rYVG_editorTitle",
			"envManaged": "K-rYVG_envManaged",
			"error": "K-rYVG_error",
			"eyebrow": "K-rYVG_eyebrow",
			"field": "K-rYVG_field",
			"fieldGrid": "K-rYVG_fieldGrid",
			"fieldHint": "K-rYVG_fieldHint",
			"form": "K-rYVG_form",
			"fullButton": "K-rYVG_fullButton",
			"header": "K-rYVG_header",
			"headerActions": "K-rYVG_headerActions",
			"info": "K-rYVG_info",
			"input": "K-rYVG_input",
			"loading": "K-rYVG_loading",
			"loadingInline": "K-rYVG_loadingInline",
			"loginCopy": "K-rYVG_loginCopy",
			"loginFootnote": "K-rYVG_loginFootnote",
			"loginMark": "K-rYVG_loginMark",
			"loginPage": "K-rYVG_loginPage",
			"loginPanel": "K-rYVG_loginPanel",
			"loginTitle": "K-rYVG_loginTitle",
			"message": "K-rYVG_message",
			"modelChip": "K-rYVG_modelChip",
			"page": "K-rYVG_page",
			"pickerHeader": "K-rYVG_pickerHeader",
			"primary": "K-rYVG_primary",
			"providerDot": "K-rYVG_providerDot",
			"providerDotReady": "K-rYVG_providerDotReady",
			"providerEditor": "K-rYVG_providerEditor",
			"providerLayout": "K-rYVG_providerLayout",
			"providerList": "K-rYVG_providerList",
			"providerOption": "K-rYVG_providerOption",
			"providerOptionSelected": "K-rYVG_providerOptionSelected",
			"providerOptionText": "K-rYVG_providerOptionText",
			"providerPicker": "K-rYVG_providerPicker",
			"section": "K-rYVG_section",
			"sectionHeading": "K-rYVG_sectionHeading",
			"sectionHint": "K-rYVG_sectionHint",
			"sectionKicker": "K-rYVG_sectionKicker",
			"sectionTitle": "K-rYVG_sectionTitle",
			"shell": "K-rYVG_shell",
			"statusBody": "K-rYVG_statusBody",
			"statusCard": "K-rYVG_statusCard",
			"statusConfigured": "K-rYVG_statusConfigured",
			"statusDot": "K-rYVG_statusDot",
			"statusError": "K-rYVG_statusError",
			"statusGrid": "K-rYVG_statusGrid",
			"statusIcon": "K-rYVG_statusIcon",
			"statusInfo": "K-rYVG_statusInfo",
			"statusMuted": "K-rYVG_statusMuted",
			"statusPill": "K-rYVG_statusPill",
			"statusReady": "K-rYVG_statusReady",
			"statusTopline": "K-rYVG_statusTopline",
			"subtitle": "K-rYVG_subtitle",
			"success": "K-rYVG_success",
			"textButton": "K-rYVG_textButton",
			"textarea": "K-rYVG_textarea",
			"title": "K-rYVG_title"
		};
		//#endregion
		//#region \0dsh-css:/home/chan-kok-pan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/SplunkZimbraOverlay.module.css.mjs
		const css$9 = ".HUOTUa_form button:focus-visible,.HUOTUa_input:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:2px}.HUOTUa_loading{color:var(--dsw-alias-label-secondary);text-align:center;padding:24px}.HUOTUa_form{flex-direction:column;gap:14px;font-size:13px;line-height:20px;display:flex}.HUOTUa_description,.HUOTUa_status{color:var(--dsw-alias-label-secondary);margin:0}.HUOTUa_status{background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:8px 10px}.HUOTUa_section{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:12px;flex-direction:column;gap:8px;margin:0;padding:12px;display:flex}.HUOTUa_section h3{margin:0 0 2px;font-size:14px;font-weight:500;line-height:22px}.HUOTUa_row{grid-template-columns:118px minmax(0,1fr) auto;align-items:center;gap:8px;display:grid}.HUOTUa_row label{color:var(--dsw-alias-label-secondary)}.HUOTUa_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);min-width:0;height:32px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:0 9px}.HUOTUa_input::placeholder{color:var(--dsw-alias-label-tertiary)}.HUOTUa_textarea{box-sizing:border-box;resize:vertical;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:100%;min-height:96px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:9px}.HUOTUa_fieldLabel{color:var(--dsw-alias-label-secondary)}.HUOTUa_rule{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}.HUOTUa_run{border-bottom:1px solid var(--dsw-alias-border-l1);justify-content:space-between;align-items:center;gap:8px;padding:8px 0;display:flex}.HUOTUa_run:last-child{border-bottom:0}.HUOTUa_actions{flex-wrap:wrap;align-items:center;gap:8px;margin-top:4px;display:flex}.HUOTUa_primaryButton,.HUOTUa_secondaryButton,.HUOTUa_deleteButton{min-height:30px;font:inherit;cursor:pointer;border-radius:15px;padding:0 10px;font-size:12px}.HUOTUa_primaryButton{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border:0}.HUOTUa_primaryButton:hover{background:var(--dsw-alias-button-primary-hover)}.HUOTUa_secondaryButton,.HUOTUa_deleteButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0}.HUOTUa_secondaryButton:hover,.HUOTUa_deleteButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.HUOTUa_deleteButton{border-radius:14px;min-height:28px}.HUOTUa_account{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;flex-direction:column;gap:8px;padding:10px;display:flex}.HUOTUa_connectedAccount{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding:10px;display:flex}.HUOTUa_accountIdentity{flex-direction:column;gap:2px;min-width:0;display:flex}.HUOTUa_accountMeta{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}.HUOTUa_accountActions{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.HUOTUa_testResult{overflow-wrap:anywhere;min-width:0;min-height:30px;color:var(--dsw-alias-label-secondary);align-items:center;display:inline-flex}.HUOTUa_testOk{color:var(--dsw-alias-state-success-primary)}.HUOTUa_testFail{color:var(--dsw-alias-state-error-primary)}@media (width<=520px){.HUOTUa_row{grid-template-columns:1fr auto}.HUOTUa_row label{grid-column:1/-1}}";
		const tagId$9 = "dsh-soc-agent-client/SplunkZimbraOverlay.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$9) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$9;
			tag.textContent = css$9;
			document.head.appendChild(tag);
		}
		var SplunkZimbraOverlay_module_css_default = {
			"account": "HUOTUa_account",
			"accountActions": "HUOTUa_accountActions",
			"accountIdentity": "HUOTUa_accountIdentity",
			"accountMeta": "HUOTUa_accountMeta",
			"actions": "HUOTUa_actions",
			"connectedAccount": "HUOTUa_connectedAccount",
			"deleteButton": "HUOTUa_deleteButton",
			"description": "HUOTUa_description",
			"fieldLabel": "HUOTUa_fieldLabel",
			"form": "HUOTUa_form",
			"input": "HUOTUa_input",
			"loading": "HUOTUa_loading",
			"primaryButton": "HUOTUa_primaryButton",
			"row": "HUOTUa_row",
			"rule": "HUOTUa_rule",
			"run": "HUOTUa_run",
			"secondaryButton": "HUOTUa_secondaryButton",
			"section": "HUOTUa_section",
			"status": "HUOTUa_status",
			"testFail": "HUOTUa_testFail",
			"testOk": "HUOTUa_testOk",
			"testResult": "HUOTUa_testResult",
			"textarea": "HUOTUa_textarea"
		};
		//#endregion
		//#region src/client/settings-common.ts
		const CHANNEL$3 = "/soc-agent-config";
		async function rpc(connection, name, payload = {}) {
			const result = await connection.rpc.call(CHANNEL$3, name, payload);
			if (!result?.ok) throw new Error(result?.error?.message || `Request failed: ${name}`);
			return result.value;
		}
		function errorText(error) {
			return error instanceof Error ? error.message : String(error);
		}
		//#endregion
		//#region src/client/AdminConsole.tsx
		const CUSTOM_PROVIDER = "__custom__";
		const PROVIDER_ROUTE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
		const SUPPORTED_PROTOCOLS = [
			{
				value: "openai-completions",
				label: "OpenAI Chat Completions"
			},
			{
				value: "openai-responses",
				label: "OpenAI Responses"
			},
			{
				value: "anthropic-messages",
				label: "Anthropic Messages"
			}
		];
		function stringValue(value) {
			return typeof value === "string" ? value : "";
		}
		function objectValue(value) {
			return value && typeof value === "object" && !Array.isArray(value) ? value : {};
		}
		function pathValue(value, path) {
			let current = value;
			for (const segment of path) current = objectValue(current)[segment];
			return current;
		}
		function providerProfile(namespace, provider) {
			return objectValue(pathValue(namespace?.value, provider.settingsPath));
		}
		function modelEntries(profile) {
			return Array.isArray(profile.models) ? profile.models.map(objectValue) : [];
		}
		function modelIds(profile) {
			return modelEntries(profile).map((model) => stringValue(model.id).trim()).filter(Boolean);
		}
		function mergeModels(profile, ids) {
			const existing = new Map(modelEntries(profile).map((model) => [stringValue(model.id), model]));
			return ids.map((id) => ({
				...existing.get(id) ?? {},
				id
			}));
		}
		function deriveCredentialRef(provider, profile) {
			const configuredRef = stringValue(profile.apiKeyEnv).trim();
			if (configuredRef) return configuredRef;
			return `${provider.provider.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}_API_KEY`;
		}
		function apiValue(response) {
			if (!response.result.ok) throw new Error(response.result.error?.message || "The request could not be completed.");
			return response.result.value;
		}
		function serviceReady(service) {
			return service?.status === "ready" || service?.configured === true || service?.available === true;
		}
		function AdminConsole({ connection }) {
			const [auth, setAuth] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [authError, setAuthError] = (0, react.useState)("");
			const loadAuth = (0, react.useCallback)(async () => {
				setLoading(true);
				setAuthError("");
				try {
					setAuth(await (await fetch("/admin/auth/me", { credentials: "same-origin" })).json());
				} catch (error) {
					setAuthError(errorText(error));
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				loadAuth();
			}, [loadAuth]);
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: AdminConsole_module_css_default.loading,
				children: "Loading administration…"
			});
			if (!auth?.authenticated) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AdminLogin, {
				onAuthenticated: loadAuth,
				error: authError
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AdminWorkspace, {
				connection,
				email: auth.email || "",
				onSignedOut: loadAuth
			});
		}
		function AdminLogin({ onAuthenticated, error: initialError }) {
			const [email, setEmail] = (0, react.useState)("");
			const [password, setPassword] = (0, react.useState)("");
			const [error, setError] = (0, react.useState)(initialError);
			const [busy, setBusy] = (0, react.useState)(false);
			async function signIn(event) {
				event.preventDefault();
				setBusy(true);
				setError("");
				try {
					const response = await fetch("/admin/auth/login", {
						method: "POST",
						headers: { "content-type": "application/json" },
						credentials: "same-origin",
						body: JSON.stringify({
							email,
							password
						})
					});
					const body = await response.json().catch(() => ({}));
					if (!response.ok) throw new Error(body.error || "Sign-in failed.");
					setPassword("");
					await onAuthenticated();
				} catch (loginError) {
					setError(errorText(loginError));
				} finally {
					setBusy(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("main", {
				className: AdminConsole_module_css_default.loginPage,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: AdminConsole_module_css_default.loginPanel,
					"aria-labelledby": "admin-login-title",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AdminConsole_module_css_default.loginMark,
							children: "C"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.eyebrow,
							children: "CITICTEL-CPC · SOC AGENT"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
							id: "admin-login-title",
							className: AdminConsole_module_css_default.loginTitle,
							children: "Administration console"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.loginCopy,
							children: "Manage LLM provider credentials and review the health of connected services."
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
							className: AdminConsole_module_css_default.form,
							onSubmit: signIn,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: AdminConsole_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Email" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: AdminConsole_module_css_default.input,
										type: "email",
										value: email,
										onChange: (event) => setEmail(event.target.value),
										autoComplete: "username",
										required: true
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: AdminConsole_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Password" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: AdminConsole_module_css_default.input,
										type: "password",
										value: password,
										onChange: (event) => setPassword(event.target.value),
										autoComplete: "current-password",
										required: true
									})]
								}),
								error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: AdminConsole_module_css_default.error,
									role: "alert",
									children: error
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `${AdminConsole_module_css_default.button} ${AdminConsole_module_css_default.primary} ${AdminConsole_module_css_default.fullButton}`,
									type: "submit",
									disabled: busy,
									children: busy ? "Signing in…" : "Sign in"
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.loginFootnote,
							children: "Service configuration is managed by the server environment."
						})
					]
				})
			});
		}
		function AdminWorkspace({ connection, email, onSignedOut }) {
			const [signingOut, setSigningOut] = (0, react.useState)(false);
			async function signOut() {
				setSigningOut(true);
				try {
					await fetch("/admin/auth/logout", {
						method: "POST",
						credentials: "same-origin"
					});
					await onSignedOut();
				} finally {
					setSigningOut(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("main", {
				className: AdminConsole_module_css_default.page,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AdminConsole_module_css_default.shell,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: AdminConsole_module_css_default.header,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: AdminConsole_module_css_default.eyebrow,
									children: "CITICTEL-CPC · SOC AGENT"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
									className: AdminConsole_module_css_default.title,
									children: "Administration console"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: AdminConsole_module_css_default.subtitle,
									children: "A clear view of service readiness and LLM provider access."
								})
							] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AdminConsole_module_css_default.headerActions,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: AdminConsole_module_css_default.account,
									children: email
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: AdminConsole_module_css_default.button,
									type: "button",
									onClick: () => void signOut(),
									disabled: signingOut,
									children: signingOut ? "Signing out…" : "Sign out"
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ServiceStatusPanel, { connection }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderSettings, { connection })
					]
				})
			});
		}
		function ServiceStatusPanel({ connection }) {
			const [settings, setSettings] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)("");
			const [checks, setChecks] = (0, react.useState)({});
			const [busy, setBusy] = (0, react.useState)(null);
			const load = (0, react.useCallback)(async () => {
				setError("");
				try {
					setSettings(await rpc(connection, "get-settings"));
				} catch (loadError) {
					setError(errorText(loadError));
				}
			}, [connection]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			async function check(service) {
				setBusy(service);
				setChecks((current) => ({
					...current,
					[service]: {
						kind: "info",
						text: "Checking…"
					}
				}));
				try {
					await rpc(connection, service === "splunk" ? "test-splunk" : "test-subscription-server");
					setChecks((current) => ({
						...current,
						[service]: {
							kind: "success",
							text: "Connection verified"
						}
					}));
					await load();
				} catch (checkError) {
					setChecks((current) => ({
						...current,
						[service]: {
							kind: "error",
							text: errorText(checkError)
						}
					}));
				} finally {
					setBusy(null);
				}
			}
			const services = settings?.services || {};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: AdminConsole_module_css_default.section,
				"aria-labelledby": "service-status-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AdminConsole_module_css_default.sectionHeading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.sectionKicker,
							children: "Environment services"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							id: "service-status-title",
							className: AdminConsole_module_css_default.sectionTitle,
							children: "Connection status"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: AdminConsole_module_css_default.sectionHint,
							children: "Configuration stays in the server .env file."
						})]
					}),
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: AdminConsole_module_css_default.error,
						role: "alert",
						children: error
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: AdminConsole_module_css_default.statusGrid,
						children: [
							{
								key: "splunk",
								name: "Splunk",
								description: "Security event search and investigation",
								mark: "S",
								checkable: true
							},
							{
								key: "zimbra",
								name: "Zimbra",
								description: "Mail and identity operations",
								mark: "Z"
							},
							{
								key: "markitdown",
								name: "MarkItDown",
								description: "Attachment and document conversion",
								mark: "M"
							},
							{
								key: "subscription_server",
								name: "Subscription server",
								description: "Subscription and entitlement checks",
								mark: "↗",
								checkable: true
							}
						].map((card) => {
							const state = checks[card.key];
							const ready = serviceReady(services[card.key]);
							const connectionLabel = state?.kind === "info" ? "Checking…" : state?.kind === "success" ? "Connected" : state?.kind === "error" ? "Unavailable" : ready ? "Configured" : "Not configured";
							const connectionClass = state?.kind === "info" ? AdminConsole_module_css_default.statusInfo : state?.kind === "success" ? AdminConsole_module_css_default.statusReady : state?.kind === "error" ? AdminConsole_module_css_default.statusError : ready ? AdminConsole_module_css_default.statusConfigured : AdminConsole_module_css_default.statusMuted;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
								className: AdminConsole_module_css_default.statusCard,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: AdminConsole_module_css_default.statusIcon,
									"aria-hidden": "true",
									children: card.mark
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: AdminConsole_module_css_default.statusBody,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: AdminConsole_module_css_default.statusTopline,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: card.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: `${AdminConsole_module_css_default.statusPill} ${connectionClass}`,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: AdminConsole_module_css_default.statusDot,
													"aria-hidden": "true"
												}), connectionLabel]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: card.description }),
										state ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: `${AdminConsole_module_css_default.checkMessage} ${AdminConsole_module_css_default[state.kind]}`,
											children: state.text
										}) : null,
										card.checkable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: AdminConsole_module_css_default.textButton,
											type: "button",
											onClick: () => void check(card.key),
											disabled: busy === card.key,
											children: busy === card.key ? "Checking…" : "Check connection"
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: AdminConsole_module_css_default.envManaged,
											children: "Environment managed"
										})
									]
								})]
							}, card.key);
						})
					})
				]
			});
		}
		function ProviderSettings({ connection }) {
			const [data, setData] = (0, react.useState)(null);
			const [selected, setSelected] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)("");
			const [loading, setLoading] = (0, react.useState)(true);
			const load = (0, react.useCallback)(async () => {
				setLoading(true);
				setError("");
				try {
					const [described, providerResponse] = await Promise.all([connection.api.settings.describe({}), connection.api.llm.providers({})]);
					const settingsView = apiValue(described);
					const providerView = apiValue(providerResponse);
					const settings = settingsView.namespaces;
					const providers = providerView.providers;
					const namespaces = new Map(settings.map((namespace) => [namespace.ns, namespace]));
					const refs = [...new Set(providers.map((provider) => {
						return deriveCredentialRef(provider, providerProfile(namespaces.get(provider.settingsNs), provider));
					}))];
					const credentialsView = apiValue(await connection.api.credentials.describe({ refs }));
					const credentialMap = new Map(Object.entries(credentialsView.credentials));
					setData({
						providers: providers.map((provider) => {
							const namespace = namespaces.get(provider.settingsNs);
							const profile = providerProfile(namespace, provider);
							const credentialRef = deriveCredentialRef(provider, profile);
							return {
								provider,
								namespace,
								profile,
								credentialRef,
								credential: credentialMap.get(credentialRef),
								configured: Boolean(namespace) && (provider.settingsPath.length === 0 || pathValue(namespace?.value, provider.settingsPath) !== void 0),
								writable: Boolean(namespace) && settingsView.writable,
								modelCount: modelIds(profile).length
							};
						}),
						piAiNamespace: namespaces.get("llm-pi-ai"),
						writable: settingsView.writable
					});
				} catch (loadError) {
					setError(errorText(loadError));
				} finally {
					setLoading(false);
				}
			}, [connection]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			(0, react.useEffect)(() => {
				if (!data) return;
				if (selected === CUSTOM_PROVIDER || data.providers.some((row) => row.provider.provider === selected)) return;
				setSelected(data.providers[0]?.provider.provider || CUSTOM_PROVIDER);
			}, [data, selected]);
			const current = (0, react.useMemo)(() => data?.providers.find((row) => row.provider.provider === selected), [data, selected]);
			const providerKey = current ? `${current.provider.provider}-${current.namespace?.revision ?? 0}` : CUSTOM_PROVIDER;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: AdminConsole_module_css_default.section,
				"aria-labelledby": "provider-settings-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AdminConsole_module_css_default.sectionHeading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.sectionKicker,
							children: "LLM access"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							id: "provider-settings-title",
							className: AdminConsole_module_css_default.sectionTitle,
							children: "Providers and credentials"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: AdminConsole_module_css_default.sectionHint,
							children: "Keys are write-only and never displayed."
						})]
					}),
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: AdminConsole_module_css_default.error,
						role: "alert",
						children: error
					}) : null,
					loading && !data ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: AdminConsole_module_css_default.loadingInline,
						children: "Loading providers…"
					}) : null,
					data ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AdminConsole_module_css_default.providerLayout,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
							className: AdminConsole_module_css_default.providerPicker,
							"aria-label": "LLM providers",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: AdminConsole_module_css_default.pickerHeader,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Available providers" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: AdminConsole_module_css_default.countBadge,
										children: data.providers.length
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: AdminConsole_module_css_default.providerList,
									role: "listbox",
									"aria-label": "Choose a provider",
									children: data.providers.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										className: `${AdminConsole_module_css_default.providerOption} ${selected === row.provider.provider ? AdminConsole_module_css_default.providerOptionSelected : ""}`,
										type: "button",
										role: "option",
										"aria-selected": selected === row.provider.provider,
										onClick: () => setSelected(row.provider.provider),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: `${AdminConsole_module_css_default.providerDot} ${row.credential?.configured ? AdminConsole_module_css_default.providerDotReady : ""}`,
												"aria-hidden": "true"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: AdminConsole_module_css_default.providerOptionText,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: row.provider.displayName || row.provider.provider }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: row.credential?.configured ? "Credential configured" : row.modelCount ? `${row.modelCount} model${row.modelCount === 1 ? "" : "s"}` : "Setup required" })]
											}),
											row.provider.declared === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: AdminConsole_module_css_default.customTag,
												children: "Custom"
											}) : null
										]
									}, row.provider.provider))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									className: `${AdminConsole_module_css_default.customOption} ${selected === CUSTOM_PROVIDER ? AdminConsole_module_css_default.customOptionSelected : ""}`,
									type: "button",
									onClick: () => setSelected(CUSTOM_PROVIDER),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: AdminConsole_module_css_default.addIcon,
										"aria-hidden": "true",
										children: "+"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "Custom provider" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "OpenAI-compatible or Anthropic" })] })]
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AdminConsole_module_css_default.providerEditor,
							children: current ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderEditor, {
								connection,
								row: current,
								onChanged: load
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CustomProviderEditor, {
								connection,
								namespace: data.piAiNamespace,
								providers: data.providers,
								writable: data.writable,
								onChanged: load,
								onCreated: setSelected
							})
						}, providerKey)]
					}) : null
				]
			});
		}
		function ProviderEditor({ connection, row, onChanged }) {
			const { provider, namespace, profile } = row;
			const initialModels = modelIds(profile);
			const [displayName, setDisplayName] = (0, react.useState)(stringValue(profile.displayName));
			const [baseURL, setBaseURL] = (0, react.useState)(stringValue(profile.baseURL));
			const [api, setApi] = (0, react.useState)(stringValue(profile.api));
			const [models, setModels] = (0, react.useState)(initialModels.join("\n"));
			const [secret, setSecret] = (0, react.useState)("");
			const [discovered, setDiscovered] = (0, react.useState)([]);
			const [message, setMessage] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const isCustomProvider = provider.declared === true;
			const canEditProtocol = provider.settingsNs === "llm-pi-ai" && isCustomProvider;
			const canRemoveProvider = provider.declared === true && Boolean(namespace) && provider.settingsPath.length > 0;
			function addDiscoveredModel(id) {
				const current = models.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
				if (!current.includes(id)) setModels([...current, id].join("\n"));
			}
			async function save() {
				if (!namespace || !row.writable) return;
				setBusy(true);
				setMessage(null);
				try {
					const ops = [];
					if (canEditProtocol && displayName.trim() !== stringValue(profile.displayName)) ops.push(displayName.trim() ? {
						op: "set",
						path: [...provider.settingsPath, "displayName"],
						value: displayName.trim()
					} : {
						op: "unset",
						path: [...provider.settingsPath, "displayName"]
					});
					const originalBaseURL = stringValue(profile.baseURL);
					if (baseURL.trim() !== originalBaseURL) ops.push(baseURL.trim() ? {
						op: "set",
						path: [...provider.settingsPath, "baseURL"],
						value: baseURL.trim()
					} : {
						op: "unset",
						path: [...provider.settingsPath, "baseURL"]
					});
					if (canEditProtocol && api.trim() !== stringValue(profile.api)) ops.push(api.trim() ? {
						op: "set",
						path: [...provider.settingsPath, "api"],
						value: api.trim()
					} : {
						op: "unset",
						path: [...provider.settingsPath, "api"]
					});
					const nextModels = models.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
					if (JSON.stringify(nextModels) !== JSON.stringify(initialModels)) ops.push(nextModels.length ? {
						op: "set",
						path: [...provider.settingsPath, "models"],
						value: mergeModels(profile, nextModels)
					} : {
						op: "unset",
						path: [...provider.settingsPath, "models"]
					});
					if (secret.trim() && !stringValue(profile.apiKeyEnv)) ops.push({
						op: "set",
						path: [...provider.settingsPath, "apiKeyEnv"],
						value: row.credentialRef
					});
					if (ops.length) apiValue(await connection.api.settings.mutate({
						ns: namespace.ns,
						ops,
						expectedRevision: namespace.revision
					}));
					if (secret.trim()) apiValue(await connection.api.credentials.set({
						ref: row.credentialRef,
						value: secret.trim()
					}));
					setSecret("");
					setMessage({
						kind: "success",
						text: "Provider settings saved."
					});
					await onChanged();
				} catch (saveError) {
					setMessage({
						kind: "error",
						text: errorText(saveError)
					});
				} finally {
					setBusy(false);
				}
			}
			async function removeCredential() {
				if (!row.credential?.configured || !row.credential.writable) return;
				setBusy(true);
				setMessage(null);
				try {
					apiValue(await connection.api.credentials.unset({ ref: row.credentialRef }));
					setMessage({
						kind: "success",
						text: "Credential removed."
					});
					await onChanged();
				} catch (removeError) {
					setMessage({
						kind: "error",
						text: errorText(removeError)
					});
				} finally {
					setBusy(false);
				}
			}
			async function discover() {
				setBusy(true);
				setMessage(null);
				try {
					const result = apiValue(await connection.api.llm.discoverModels({
						settingsNs: provider.settingsNs,
						provider: provider.provider,
						baseURL: baseURL.trim() || void 0,
						api: canEditProtocol ? api.trim() || void 0 : void 0,
						apiKey: secret.trim() || void 0
					}));
					setDiscovered(result.models);
					setMessage({
						kind: "info",
						text: result.models.length ? "Choose a model to add it to the provider." : "No models were discovered."
					});
				} catch (discoverError) {
					setMessage({
						kind: "error",
						text: errorText(discoverError)
					});
				} finally {
					setBusy(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AdminConsole_module_css_default.editorHeading,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.sectionKicker,
							children: "Provider configuration"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: AdminConsole_module_css_default.editorTitle,
							children: provider.displayName || provider.provider
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.editorCopy,
							children: isCustomProvider ? "Configure the provider connection and credential." : "Manage the credential for this provider."
						})
					] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: `${AdminConsole_module_css_default.statusPill} ${row.credential?.configured ? AdminConsole_module_css_default.statusReady : AdminConsole_module_css_default.statusMuted}`,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: AdminConsole_module_css_default.statusDot,
							"aria-hidden": "true"
						}), row.credential?.configured ? "Credential set" : "Credential needed"]
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AdminConsole_module_css_default.editorForm,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: AdminConsole_module_css_default.field,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "API key" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: AdminConsole_module_css_default.input,
								type: "password",
								value: secret,
								onChange: (event) => setSecret(event.target.value),
								placeholder: row.credential?.configured ? "Stored securely · enter a new key to replace it" : "Enter the provider API key",
								autoComplete: "new-password",
								disabled: !row.writable || row.credential?.writable === false || busy
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
								className: AdminConsole_module_css_default.fieldHint,
								children: "The key is stored securely and is never returned to this page."
							})
						]
					}), isCustomProvider ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
						className: AdminConsole_module_css_default.advanced,
						open: Boolean(baseURL || api || initialModels.length),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "Advanced provider settings" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AdminConsole_module_css_default.advancedBody,
							children: [
								canEditProtocol ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: AdminConsole_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Display name ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "optional" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: AdminConsole_module_css_default.input,
										value: displayName,
										onChange: (event) => setDisplayName(event.target.value),
										placeholder: provider.provider,
										disabled: !row.writable || busy
									})]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: AdminConsole_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Base URL ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "optional" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: AdminConsole_module_css_default.input,
										type: "url",
										value: baseURL,
										onChange: (event) => setBaseURL(event.target.value),
										placeholder: "https://api.example.com",
										disabled: !row.writable || busy
									})]
								}),
								canEditProtocol ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: AdminConsole_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "API protocol" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: AdminConsole_module_css_default.input,
										value: api,
										onChange: (event) => setApi(event.target.value),
										disabled: !row.writable || busy,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "",
											children: "Provider default"
										}), SUPPORTED_PROTOCOLS.map((protocol) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: protocol.value,
											children: protocol.label
										}, protocol.value))]
									})]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: AdminConsole_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Model IDs ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "one per line" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: `${AdminConsole_module_css_default.input} ${AdminConsole_module_css_default.textarea}`,
										value: models,
										onChange: (event) => setModels(event.target.value),
										placeholder: "deepseek-chat",
										rows: 4,
										disabled: !row.writable || busy
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: AdminConsole_module_css_default.discoveryRow,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: AdminConsole_module_css_default.button,
										type: "button",
										onClick: () => void discover(),
										disabled: busy || !provider.settingsNs,
										children: busy ? "Working…" : "Discover models"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: AdminConsole_module_css_default.fieldHint,
										children: "Uses the draft URL and key when provided."
									})]
								}),
								discovered.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: AdminConsole_module_css_default.discovered,
									"aria-label": "Discovered models",
									children: discovered.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										className: AdminConsole_module_css_default.modelChip,
										type: "button",
										onClick: () => addDiscoveredModel(model.id),
										children: [
											model.id,
											" ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"aria-hidden": "true",
												children: "+"
											})
										]
									}, model.id))
								}) : null
							]
						})]
					}) : null]
				}),
				message ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: `${AdminConsole_module_css_default.message} ${AdminConsole_module_css_default[message.kind]}`,
					role: message.kind === "error" ? "alert" : "status",
					children: message.text
				}) : null,
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AdminConsole_module_css_default.actions,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: `${AdminConsole_module_css_default.button} ${AdminConsole_module_css_default.primary}`,
							type: "button",
							onClick: () => void save(),
							disabled: !row.writable || busy,
							children: busy ? "Saving…" : "Save provider"
						}),
						row.credential?.configured ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: AdminConsole_module_css_default.button,
							type: "button",
							onClick: () => void removeCredential(),
							disabled: !row.credential.writable || busy,
							children: "Remove credential"
						}) : null,
						canRemoveProvider ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CustomProviderRemoval, {
							connection,
							row,
							onChanged,
							disabled: busy
						}) : null
					]
				})
			] });
		}
		function CustomProviderRemoval({ connection, row, onChanged, disabled }) {
			const [confirming, setConfirming] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			async function remove() {
				if (!row.namespace) return;
				setError("");
				try {
					if (row.credential?.configured) apiValue(await connection.api.credentials.unset({ ref: row.credentialRef }));
					apiValue(await connection.api.settings.mutate({
						ns: row.namespace.ns,
						ops: [{
							op: "unset",
							path: row.provider.settingsPath
						}],
						expectedRevision: row.namespace.revision
					}));
					await onChanged();
				} catch (removeError) {
					setError(errorText(removeError));
					setConfirming(false);
				}
			}
			if (confirming) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: AdminConsole_module_css_default.confirmGroup,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
						"Remove ",
						row.provider.displayName || row.provider.provider,
						"?"
					] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: AdminConsole_module_css_default.dangerButton,
						type: "button",
						onClick: () => void remove(),
						disabled,
						children: "Remove"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: AdminConsole_module_css_default.button,
						type: "button",
						onClick: () => setConfirming(false),
						disabled,
						children: "Cancel"
					}),
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
						className: AdminConsole_module_css_default.error,
						children: error
					}) : null
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				className: AdminConsole_module_css_default.dangerButton,
				type: "button",
				onClick: () => setConfirming(true),
				disabled,
				children: "Remove provider"
			});
		}
		function CustomProviderEditor({ connection, namespace, providers, writable, onChanged, onCreated }) {
			const [route, setRoute] = (0, react.useState)("");
			const [displayName, setDisplayName] = (0, react.useState)("");
			const [baseURL, setBaseURL] = (0, react.useState)("");
			const [api, setApi] = (0, react.useState)("openai-completions");
			const [model, setModel] = (0, react.useState)("");
			const [secret, setSecret] = (0, react.useState)("");
			const [savedRoute, setSavedRoute] = (0, react.useState)("");
			const [message, setMessage] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const normalizedRoute = route.trim().toLowerCase();
			const routeTaken = providers.some((row) => row.provider.provider === normalizedRoute);
			const routeValid = PROVIDER_ROUTE_PATTERN.test(normalizedRoute);
			const canSave = Boolean(namespace && writable && routeValid && !routeTaken && baseURL.trim() && model.trim());
			const credentialRef = `${normalizedRoute.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}_API_KEY`;
			async function save() {
				if (!namespace || !canSave) return;
				setBusy(true);
				setMessage(null);
				try {
					if (savedRoute && savedRoute !== normalizedRoute) throw new Error("The route cannot be changed after saving.");
					if (!savedRoute) {
						apiValue(await connection.api.settings.mutate({
							ns: namespace.ns,
							ops: [{
								op: "set",
								path: ["providers", normalizedRoute],
								value: {
									...displayName.trim() ? { displayName: displayName.trim() } : {},
									...secret.trim() ? { apiKeyEnv: credentialRef } : {},
									api,
									baseURL: baseURL.trim(),
									models: [{ id: model.trim() }]
								}
							}],
							expectedRevision: namespace.revision
						}));
						setSavedRoute(normalizedRoute);
					}
					if (secret.trim()) apiValue(await connection.api.credentials.set({
						ref: credentialRef,
						value: secret.trim()
					}));
					setSecret("");
					setMessage({
						kind: "success",
						text: "Custom provider saved."
					});
					await onChanged();
					onCreated(normalizedRoute);
				} catch (saveError) {
					setMessage({
						kind: "error",
						text: errorText(saveError)
					});
				} finally {
					setBusy(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AdminConsole_module_css_default.editorHeading,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.sectionKicker,
							children: "Add provider"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: AdminConsole_module_css_default.editorTitle,
							children: "Custom provider"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.editorCopy,
							children: "Connect an OpenAI-compatible or Anthropic endpoint with its own model name."
						})
					] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: AdminConsole_module_css_default.customBadge,
						children: "Custom"
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AdminConsole_module_css_default.editorForm,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AdminConsole_module_css_default.fieldGrid,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: AdminConsole_module_css_default.field,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Provider route" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: AdminConsole_module_css_default.input,
										value: route,
										onChange: (event) => setRoute(event.target.value),
										placeholder: "my-provider",
										disabled: Boolean(savedRoute) || busy,
										autoComplete: "off"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
										className: AdminConsole_module_css_default.fieldHint,
										children: route && !routeValid ? "Use lowercase letters, numbers, and hyphens." : routeTaken ? "That provider already exists." : "This becomes the provider identifier."
									})
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: AdminConsole_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Display name ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "optional" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: AdminConsole_module_css_default.input,
									value: displayName,
									onChange: (event) => setDisplayName(event.target.value),
									placeholder: "My AI provider",
									disabled: busy
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: AdminConsole_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Base URL" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: AdminConsole_module_css_default.input,
								type: "url",
								value: baseURL,
								onChange: (event) => setBaseURL(event.target.value),
								placeholder: "https://api.example.com/v1",
								disabled: busy,
								required: true
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AdminConsole_module_css_default.fieldGrid,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: AdminConsole_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "API protocol" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									className: AdminConsole_module_css_default.input,
									value: api,
									onChange: (event) => setApi(event.target.value),
									disabled: busy,
									children: SUPPORTED_PROTOCOLS.map((protocol) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: protocol.value,
										children: protocol.label
									}, protocol.value))
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: AdminConsole_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Model ID" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: AdminConsole_module_css_default.input,
									value: model,
									onChange: (event) => setModel(event.target.value),
									placeholder: "model-name",
									disabled: busy,
									required: true
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: AdminConsole_module_css_default.field,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["API key ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "optional for provider-native auth" })] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: AdminConsole_module_css_default.input,
									type: "password",
									value: secret,
									onChange: (event) => setSecret(event.target.value),
									placeholder: "Enter the provider API key",
									autoComplete: "new-password",
									disabled: busy
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
									className: AdminConsole_module_css_default.fieldHint,
									children: "Stored securely under a provider-derived credential name."
								})
							]
						})
					]
				}),
				message ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: `${AdminConsole_module_css_default.message} ${AdminConsole_module_css_default[message.kind]}`,
					role: message.kind === "error" ? "alert" : "status",
					children: message.text
				}) : null,
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: AdminConsole_module_css_default.actions,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: `${AdminConsole_module_css_default.button} ${AdminConsole_module_css_default.primary}`,
						type: "button",
						onClick: () => void save(),
						disabled: !canSave || busy,
						children: busy ? "Saving…" : savedRoute ? "Save credential" : "Add provider"
					})
				})
			] });
		}
		//#endregion
		//#region \0dsh-css:/home/chan-kok-pan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/AuthGate.module.css.mjs
		const css$8 = ".-BO6NG_layer{z-index:10000;color:#eef3f8;pointer-events:auto;background:#0c121cb8;place-items:center;display:grid;position:fixed;inset:0}.-BO6NG_card{background:#182230;border:1px solid #ffffff29;border-radius:14px;width:min(390px,100vw - 40px);padding:28px;box-shadow:0 18px 55px #00000052}.-BO6NG_title{margin:0 0 20px;font-size:20px;font-weight:600}.-BO6NG_field{gap:6px;margin:14px 0;font-size:13px;display:grid}.-BO6NG_input{box-sizing:border-box;width:100%;color:inherit;font:inherit;background:#101923;border:1px solid #fff3;border-radius:8px;padding:10px 11px}.-BO6NG_button{color:#fff;cursor:pointer;width:100%;font:inherit;background:#4b8cf7;border:0;border-radius:8px;margin-top:8px;padding:10px 12px}.-BO6NG_button:disabled{cursor:wait;opacity:.65}.-BO6NG_error{color:#ffb7b7;margin:10px 0;font-size:13px}.-BO6NG_notice{color:#ffe0a6;margin:10px 0;font-size:13px}.-BO6NG_loading{color:#cbd6e2;font-size:14px}.-BO6NG_badge{z-index:10001;color:#dce7f2;pointer-events:auto;background:#182230eb;border:1px solid #ffffff1f;border-radius:999px;align-items:center;gap:10px;padding:6px 9px 6px 11px;font-size:12px;display:flex;position:fixed;top:12px;right:16px}.-BO6NG_logout{color:inherit;cursor:pointer;font:inherit;background:0 0;border:1px solid #fff3;border-radius:6px;padding:3px 7px}";
		const tagId$8 = "dsh-soc-agent-client/AuthGate.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$8) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$8;
			tag.textContent = css$8;
			document.head.appendChild(tag);
		}
		var AuthGate_module_css_default = {
			"badge": "-BO6NG_badge",
			"button": "-BO6NG_button",
			"card": "-BO6NG_card",
			"error": "-BO6NG_error",
			"field": "-BO6NG_field",
			"input": "-BO6NG_input",
			"layer": "-BO6NG_layer",
			"loading": "-BO6NG_loading",
			"logout": "-BO6NG_logout",
			"notice": "-BO6NG_notice",
			"title": "-BO6NG_title"
		};
		//#endregion
		//#region src/client/AuthGate.tsx
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
		//#region \0dsh-css:/home/chan-kok-pan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/CatalogManager.module.css.mjs
		const css$7 = ".Qiy4gq_page{max-width:1200px;color:var(--dsw-alias-text-primary,#1c2024);flex-direction:column;gap:14px;margin:0 auto;padding:24px 20px 48px;font-size:13px;display:flex}.Qiy4gq_header{flex-direction:column;gap:10px;display:flex}.Qiy4gq_title{margin:0;font-size:20px;font-weight:600}.Qiy4gq_tabs{gap:6px;display:flex}.Qiy4gq_tab{border:1px solid var(--dsw-alias-border-l2,#d5d9de);color:inherit;font:inherit;cursor:pointer;background:0 0;border-radius:999px;padding:6px 14px}.Qiy4gq_tabActive{background:var(--dsw-alias-primary,#2563eb);border-color:var(--dsw-alias-primary,#2563eb);color:#fff}.Qiy4gq_layout{grid-template-columns:300px minmax(0,1fr);align-items:start;gap:16px;display:grid}.Qiy4gq_listPane,.Qiy4gq_editorPane,.Qiy4gq_card{border:1px solid var(--dsw-alias-border-l2,#d5d9de);background:var(--dsw-alias-surface-primary,#fff);border-radius:10px;flex-direction:column;gap:10px;padding:14px;display:flex}.Qiy4gq_listToolbar{gap:8px;display:flex}.Qiy4gq_listMeta{color:var(--dsw-alias-text-secondary,#5c6470);font-size:12px}.Qiy4gq_recordList{flex-direction:column;gap:4px;max-height:60vh;margin:0;padding:0;list-style:none;display:flex;overflow-y:auto}.Qiy4gq_recordItem{width:100%;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:1px solid #0000;border-radius:8px;flex-direction:column;gap:2px;padding:8px 10px;display:flex}.Qiy4gq_recordItem:hover{background:var(--dsw-alias-surface-secondary,#f2f4f7)}.Qiy4gq_recordActive,.Qiy4gq_recordActive:hover{border-color:var(--dsw-alias-primary,#2563eb);background:color-mix(in srgb, var(--dsw-alias-primary,#2563eb) 8%, transparent)}.Qiy4gq_recordTitle{text-overflow:ellipsis;white-space:nowrap;font-weight:600;overflow:hidden}.Qiy4gq_recordMeta{color:var(--dsw-alias-text-secondary,#5c6470);font-size:11px}.Qiy4gq_editorHeader{justify-content:space-between;align-items:flex-start;gap:10px;display:flex}.Qiy4gq_editorTitle{font-size:15px;font-weight:600}.Qiy4gq_editorMeta{color:var(--dsw-alias-text-secondary,#5c6470);margin-left:8px;font-size:12px;font-weight:400}.Qiy4gq_editorActions{flex-shrink:0;gap:8px;display:flex}.Qiy4gq_fieldGrid{grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px 14px;display:grid}.Qiy4gq_field{flex-direction:column;gap:4px;min-width:0;display:flex}.Qiy4gq_fieldInvalid .Qiy4gq_control{border-color:var(--dsw-alias-danger,#d33)}.Qiy4gq_label{color:var(--dsw-alias-text-secondary,#5c6470);text-transform:capitalize;font-size:11px}.Qiy4gq_fieldError{color:var(--dsw-alias-danger,#a00);font-size:11px}.Qiy4gq_control{border:1px solid var(--dsw-alias-border-l2,#d5d9de);background:var(--dsw-alias-surface-secondary,#fafbfc);width:100%;color:inherit;font:inherit;box-sizing:border-box;border-radius:6px;padding:6px 8px}.Qiy4gq_control:disabled{opacity:.75}.Qiy4gq_section{border-top:1px solid var(--dsw-alias-border-l2,#d5d9de);padding-top:10px}.Qiy4gq_section summary{cursor:pointer;margin-bottom:8px;font-weight:600}.Qiy4gq_publishBar{gap:8px;margin-bottom:8px;display:flex}.Qiy4gq_preview{flex-direction:column;gap:6px;font-size:12px;display:flex}.Qiy4gq_hint{color:var(--dsw-alias-text-secondary,#5c6470);font-size:12px}.Qiy4gq_history{flex-direction:column;gap:6px;font-size:12px;display:flex}.Qiy4gq_historyItem summary{cursor:pointer}.Qiy4gq_historyAction{text-transform:capitalize;font-weight:600}.Qiy4gq_historyReason{color:var(--dsw-alias-text-secondary,#5c6470)}.Qiy4gq_diffBlock{margin:6px 0}.Qiy4gq_diffTitle{color:var(--dsw-alias-text-secondary,#5c6470);font-size:11px}.Qiy4gq_diffBlock pre{border:1px solid var(--dsw-alias-border-l2,#d5d9de);background:var(--dsw-alias-surface-secondary,#fafbfc);border-radius:6px;max-height:220px;margin:2px 0 0;padding:8px;font-size:11px;overflow-x:auto}.Qiy4gq_publicationTable{border-collapse:collapse;width:100%;font-size:12px}.Qiy4gq_publicationTable th,.Qiy4gq_publicationTable td{border-bottom:1px solid var(--dsw-alias-border-l2,#d5d9de);text-align:left;padding:6px 8px}.Qiy4gq_pill{background:var(--dsw-alias-surface-secondary,#eef1f4);border-radius:999px;padding:2px 8px;font-size:11px;display:inline-block}.Qiy4gq_pillOk{background:color-mix(in srgb, var(--dsw-alias-success,#2a8b43) 14%, transparent);color:var(--dsw-alias-success,#23692f)}.Qiy4gq_pillFail{background:color-mix(in srgb, var(--dsw-alias-danger,#d33) 12%, transparent);color:var(--dsw-alias-danger,#a00)}.Qiy4gq_pillNeutral{color:var(--dsw-alias-text-secondary,#5c6470)}.Qiy4gq_message{border-radius:6px;padding:8px 10px;font-size:12px}.Qiy4gq_error{background:color-mix(in srgb, var(--dsw-alias-danger,#d33) 10%, transparent);color:var(--dsw-alias-danger,#a00)}.Qiy4gq_success{background:color-mix(in srgb, var(--dsw-alias-success,#2a8b43) 10%, transparent);color:var(--dsw-alias-success,#23692f)}.Qiy4gq_button{border:1px solid var(--dsw-alias-border-l2,#d5d9de);color:inherit;font:inherit;cursor:pointer;white-space:nowrap;background:0 0;border-radius:6px;padding:6px 14px}.Qiy4gq_button:disabled{opacity:.6;cursor:default}.Qiy4gq_primary{background:var(--dsw-alias-primary,#2563eb);border-color:var(--dsw-alias-primary,#2563eb);color:#fff}@media (width<=900px){.Qiy4gq_layout{grid-template-columns:1fr}}";
		const tagId$7 = "dsh-soc-agent-client/CatalogManager.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$7) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$7;
			tag.textContent = css$7;
			document.head.appendChild(tag);
		}
		var CatalogManager_module_css_default = {
			"button": "Qiy4gq_button",
			"card": "Qiy4gq_card",
			"control": "Qiy4gq_control",
			"diffBlock": "Qiy4gq_diffBlock",
			"diffTitle": "Qiy4gq_diffTitle",
			"editorActions": "Qiy4gq_editorActions",
			"editorHeader": "Qiy4gq_editorHeader",
			"editorMeta": "Qiy4gq_editorMeta",
			"editorPane": "Qiy4gq_editorPane",
			"editorTitle": "Qiy4gq_editorTitle",
			"error": "Qiy4gq_error",
			"field": "Qiy4gq_field",
			"fieldError": "Qiy4gq_fieldError",
			"fieldGrid": "Qiy4gq_fieldGrid",
			"fieldInvalid": "Qiy4gq_fieldInvalid",
			"header": "Qiy4gq_header",
			"hint": "Qiy4gq_hint",
			"history": "Qiy4gq_history",
			"historyAction": "Qiy4gq_historyAction",
			"historyItem": "Qiy4gq_historyItem",
			"historyReason": "Qiy4gq_historyReason",
			"label": "Qiy4gq_label",
			"layout": "Qiy4gq_layout",
			"listMeta": "Qiy4gq_listMeta",
			"listPane": "Qiy4gq_listPane",
			"listToolbar": "Qiy4gq_listToolbar",
			"message": "Qiy4gq_message",
			"page": "Qiy4gq_page",
			"pill": "Qiy4gq_pill",
			"pillFail": "Qiy4gq_pillFail",
			"pillNeutral": "Qiy4gq_pillNeutral",
			"pillOk": "Qiy4gq_pillOk",
			"preview": "Qiy4gq_preview",
			"primary": "Qiy4gq_primary",
			"publicationTable": "Qiy4gq_publicationTable",
			"publishBar": "Qiy4gq_publishBar",
			"recordActive": "Qiy4gq_recordActive",
			"recordItem": "Qiy4gq_recordItem",
			"recordList": "Qiy4gq_recordList",
			"recordMeta": "Qiy4gq_recordMeta",
			"recordTitle": "Qiy4gq_recordTitle",
			"section": "Qiy4gq_section",
			"success": "Qiy4gq_success",
			"tab": "Qiy4gq_tab",
			"tabActive": "Qiy4gq_tabActive",
			"tabs": "Qiy4gq_tabs",
			"title": "Qiy4gq_title"
		};
		const CATALOG_DRAFT_TOOL_NAMES = [
			"mcp__soc_agent__catalog_write_rule",
			"mcp__soc_agent__catalog_update_rule",
			"mcp__soc_agent__catalog_write_customer",
			"mcp__soc_agent__catalog_update_customer",
			"mcp__soc_agent__catalog_write_fix_source_type",
			"mcp__soc_agent__catalog_update_fix_source_type"
		];
		const RULE_FIELDS = [
			"rule_number",
			"rule_name_en",
			"rule_name_cn",
			"rule_name_zh",
			"description_en",
			"description_cn",
			"description_zh",
			"remediation_en",
			"remediation_cn",
			"remediation_zh",
			"severity",
			"status",
			"customer_id",
			"gid"
		];
		const CATALOG_FIELDS = {
			customer: [
				"customer_code",
				"display_name",
				"tenant_number",
				"gid",
				"lifecycle_status",
				"notes"
			],
			rule: RULE_FIELDS,
			fix_source_type: [
				"customer_id",
				"system_name",
				"fix_source_type_value",
				"default_fix_index",
				"description"
			]
		};
		const CATALOG_LABELS = {
			customer: "Customer Information",
			rule: "Ruleset",
			fix_source_type: "Fix Source type"
		};
		const SELECT_FIELDS = {
			severity: [
				{
					value: "info",
					label: "Info"
				},
				{
					value: "low",
					label: "Low"
				},
				{
					value: "medium",
					label: "Medium"
				},
				{
					value: "high",
					label: "High"
				},
				{
					value: "critical",
					label: "Critical"
				}
			],
			status: [
				{
					value: "draft",
					label: "Draft"
				},
				{
					value: "active",
					label: "Active"
				},
				{
					value: "disabled",
					label: "Disabled"
				},
				{
					value: "retired",
					label: "Retired"
				}
			],
			lifecycle_status: [
				{
					value: "active",
					label: "Active"
				},
				{
					value: "provisioning",
					label: "Provisioning"
				},
				{
					value: "suspended",
					label: "Suspended"
				},
				{
					value: "retired",
					label: "Retired"
				}
			]
		};
		const REQUIRED_FIELDS = {
			customer: ["customer_code", "display_name"],
			rule: ["rule_number", "rule_name_en"],
			fix_source_type: [
				"customer_id",
				"system_name",
				"fix_source_type_value"
			]
		};
		function isRecord$2(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		function text$1(value, fallback = "") {
			if (typeof value === "string") return value;
			if (typeof value === "number" && Number.isFinite(value)) return String(value);
			return fallback;
		}
		function formFromRecord(record) {
			const catalog = text$1(record.catalog, "rule");
			const fields = {};
			for (const key of CATALOG_FIELDS[catalog] ?? RULE_FIELDS) fields[key] = text$1(record[key]);
			return fields;
		}
		function recordFromForm(catalog, fields) {
			const record = {};
			for (const key of CATALOG_FIELDS[catalog]) record[key] = fields[key] ?? "";
			return record;
		}
		/** Quick client-side validation; the server remains authoritative. */
		function validateCatalogForm(catalog, fields) {
			const errors = {};
			for (const key of REQUIRED_FIELDS[catalog]) if (!(fields[key] ?? "").trim()) errors[key] = `${key.replace(/_/g, " ")} is required.`;
			if (catalog === "rule" && fields.rule_number && !/^[0-9]{1,4}$/.test(fields.rule_number.trim())) errors.rule_number = "Use 1-4 digits; leading zeros are preserved.";
			return errors;
		}
		function parseCatalogEnvelope(block) {
			if (!("kind" in block)) return null;
			const raw = block.content.filter((item) => item.type === "text").map((item) => item.text).join("");
			if (!raw) return null;
			try {
				const parsed = JSON.parse(raw);
				if (!isRecord$2(parsed)) return null;
				const data = isRecord$2(parsed.data) ? parsed.data : parsed;
				const catalog = text$1(data.catalog, "rule");
				if (isRecord$2(data.record)) return data;
				return {
					catalog,
					record: {},
					error: parsed.error ?? data.error
				};
			} catch {
				return null;
			}
		}
		function catalogErrorMessage(envelope) {
			const error = envelope?.error;
			if (isRecord$2(error) && typeof error.message === "string" && error.message) return error.message;
			return typeof error === "string" && error ? error : null;
		}
		/** Extract per-field server validation messages from a failure envelope. */
		function catalogFieldErrors(error) {
			if (!isRecord$2(error) || !isRecord$2(error.details)) return {};
			const fields = error.details.fields;
			if (!isRecord$2(fields)) return {};
			const result = {};
			for (const [key, value] of Object.entries(fields)) if (typeof value === "string") result[key] = value;
			return result;
		}
		function catalogTitle(record, catalog) {
			if (catalog === "customer") return text$1(record.display_name) || text$1(record.customer_code);
			if (catalog === "rule") return text$1(record.rule_name_en) || text$1(record.rule_number);
			return text$1(record.system_name) || text$1(record.fix_source_type_value);
		}
		function catalogSubtitle(record, catalog) {
			if (catalog === "customer") return text$1(record.customer_code);
			if (catalog === "rule") return `Rule ${text$1(record.rule_number)}`;
			return text$1(record.fix_source_type_value);
		}
		//#endregion
		//#region src/client/CatalogManager.tsx
		const CATALOGS = [
			"rule",
			"customer",
			"fix_source_type"
		];
		function valueText$2(value) {
			if (typeof value === "string") return value;
			if (typeof value === "number" && Number.isFinite(value)) return String(value);
			return "";
		}
		function StatusPill({ status }) {
			const kind = status === "active" || status === "published" ? CatalogManager_module_css_default.pillOk : status === "failed" ? CatalogManager_module_css_default.pillFail : CatalogManager_module_css_default.pillNeutral;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `${CatalogManager_module_css_default.pill} ${kind}`,
				children: status
			});
		}
		function FieldRow({ fieldKey, value, error, disabled, onChange }) {
			const options = SELECT_FIELDS[fieldKey];
			const label = fieldKey.replace(/_/g, " ");
			const multiline = fieldKey.startsWith("description") || fieldKey === "notes" || fieldKey.startsWith("remediation");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: `${CatalogManager_module_css_default.field} ${error ? CatalogManager_module_css_default.fieldInvalid : ""}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CatalogManager_module_css_default.label,
						children: label
					}),
					options ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
						className: CatalogManager_module_css_default.control,
						"aria-label": label,
						value,
						disabled,
						onChange: (event) => onChange(event.target.value),
						children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: option.value,
							children: option.label
						}, option.value))
					}) : multiline ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						className: CatalogManager_module_css_default.control,
						"aria-label": label,
						value,
						disabled,
						rows: 3,
						onChange: (event) => onChange(event.target.value)
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: CatalogManager_module_css_default.control,
						"aria-label": label,
						value,
						disabled,
						onChange: (event) => onChange(event.target.value)
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CatalogManager_module_css_default.fieldError,
						role: "alert",
						children: error
					})
				]
			});
		}
		function HistoryView({ history }) {
			if (!history.length) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: CatalogManager_module_css_default.hint,
				children: "No recorded changes yet."
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: CatalogManager_module_css_default.history,
				children: history.map((entry) => {
					const before = entry.before ? JSON.stringify(entry.before, null, 1) : "";
					const after = entry.after ? JSON.stringify(entry.after, null, 1) : "";
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
						className: CatalogManager_module_css_default.historyItem,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: CatalogManager_module_css_default.historyAction,
									children: valueText$2(entry.action)
								}),
								" ",
								"revision ",
								valueText$2(entry.revision),
								" · ",
								valueText$2(entry.actor),
								" · ",
								valueText$2(entry.changed_at),
								entry.reason ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: CatalogManager_module_css_default.historyReason,
									children: [" — ", valueText$2(entry.reason)]
								}) : null
							] }),
							before && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: CatalogManager_module_css_default.diffBlock,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: CatalogManager_module_css_default.diffTitle,
									children: "Before"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: before })]
							}),
							after && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: CatalogManager_module_css_default.diffBlock,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: CatalogManager_module_css_default.diffTitle,
									children: "After"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: after })]
							})
						]
					}, String(entry.history_id));
				})
			});
		}
		function CatalogManager({ connection }) {
			const [catalog, setCatalog] = (0, react.useState)("rule");
			const [search, setSearch] = (0, react.useState)("");
			const [list, setList] = (0, react.useState)(null);
			const [selected, setSelected] = (0, react.useState)(null);
			const [mode, setMode] = (0, react.useState)("view");
			const [fields, setFields] = (0, react.useState)({});
			const [fieldErrors, setFieldErrors] = (0, react.useState)({});
			const [status, setStatus] = (0, react.useState)("idle");
			const [error, setError] = (0, react.useState)(null);
			const [history, setHistory] = (0, react.useState)([]);
			const [preview, setPreview] = (0, react.useState)(null);
			const [publications, setPublications] = (0, react.useState)([]);
			const authError = error === "authentication required" || error?.includes("authentication");
			const loadList = (0, react.useCallback)(async () => {
				setStatus("busy");
				setError(null);
				try {
					const result = await rpc(connection, "catalog-list", {
						catalog,
						search,
						limit: 200,
						include_archived: true
					});
					setList({
						items: Array.isArray(result.items) ? result.items : [],
						total: Number(result.total ?? 0)
					});
					setStatus("idle");
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
					setStatus("failed");
				}
			}, [
				connection,
				catalog,
				search
			]);
			const loadSideData = (0, react.useCallback)(async (recordId) => {
				setHistory([]);
				setPublications([]);
				setPreview(null);
				try {
					if (recordId) {
						const result = await rpc(connection, "catalog-history", {
							catalog,
							record_id: recordId
						});
						setHistory(Array.isArray(result.history) ? result.history : []);
					}
					const publicationsResult = await rpc(connection, "catalog-publications", { catalog });
					setPublications(Array.isArray(publicationsResult.publications) ? publicationsResult.publications : []);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			}, [connection, catalog]);
			(0, react.useEffect)(() => {
				setSelected(null);
				setMode("view");
				loadList();
			}, [loadList]);
			const selectRecord = async (recordId) => {
				setStatus("busy");
				setError(null);
				try {
					const result = await rpc(connection, "catalog-get", {
						catalog,
						record_id: recordId
					});
					setSelected(result.record);
					setFields(formFromRecord(result.record));
					setMode("view");
					setFieldErrors({});
					setStatus("idle");
					await loadSideData(recordId);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
					setStatus("failed");
				}
			};
			const startCreate = () => {
				const empty = {};
				for (const key of CATALOG_FIELDS[catalog]) empty[key] = "";
				setFields(empty);
				setSelected(null);
				setMode("create");
				setFieldErrors({});
				setError(null);
			};
			const startEdit = () => {
				if (!selected) return;
				setFields(formFromRecord(selected));
				setMode("edit");
				setFieldErrors({});
				setError(null);
			};
			const save = async () => {
				if (!mode) return;
				const localErrors = validateCatalogForm(catalog, fields);
				if (Object.keys(localErrors).length > 0) {
					setFieldErrors(localErrors);
					setError("Correct the highlighted fields before saving.");
					return;
				}
				setStatus("busy");
				setError(null);
				setFieldErrors({});
				try {
					const recordId = selected ? valueText$2(selected.record_id) : void 0;
					const result = await rpc(connection, "save-catalog-record", {
						catalog,
						operation: mode === "create" ? "write" : "update",
						record: recordFromForm(catalog, fields),
						...mode === "update" && recordId ? { record_id: recordId } : {},
						...mode === "update" && selected ? { expected_revision: Number(selected.revision) } : {}
					});
					setSelected(result.record);
					setFields(formFromRecord(result.record));
					setMode("view");
					setStatus("saved");
					await loadList();
					await loadSideData(valueText$2(result.record.record_id));
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
					setStatus("failed");
				}
			};
			const setArchived = async (archived) => {
				if (!selected) return;
				const verb = archived ? "Archive" : "Restore";
				if (!window.confirm(`${verb} this ${CATALOG_LABELS[catalog]} record?`)) return;
				setStatus("busy");
				setError(null);
				try {
					const result = await rpc(connection, "archive-catalog-record", {
						catalog,
						record_id: valueText$2(selected.record_id),
						expected_revision: Number(selected.revision),
						restore: !archived
					});
					setSelected(result.record);
					setFields(formFromRecord(result.record));
					setMode("view");
					setStatus("saved");
					await loadList();
					await loadSideData(valueText$2(result.record.record_id));
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
					setStatus("failed");
				}
			};
			const loadPreview = async () => {
				setStatus("busy");
				setError(null);
				try {
					setPreview(await rpc(connection, "catalog-preview-publish", { catalog }));
					await loadSideData(selected ? valueText$2(selected.record_id) : null);
					setStatus("idle");
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
					setStatus("failed");
				}
			};
			const publish = async () => {
				if (!window.confirm(`Publish the ${CATALOG_LABELS[catalog]} catalog to Splunk as ${valueText$2(preview?.lookup_name)}?`)) return;
				setStatus("busy");
				setError(null);
				try {
					await rpc(connection, "publish-catalog", { catalog });
					setPreview(await rpc(connection, "catalog-preview-publish", { catalog }));
					await loadSideData(selected ? valueText$2(selected.record_id) : null);
					setStatus("saved");
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
					setStatus("failed");
				}
			};
			const rollback = async (publicationId) => {
				if (!window.confirm("Restore this previously published revision to Splunk?")) return;
				setStatus("busy");
				setError(null);
				try {
					await rpc(connection, "rollback-publication", { publication_id: publicationId });
					setPreview(await rpc(connection, "catalog-preview-publish", { catalog }));
					await loadSideData(selected ? valueText$2(selected.record_id) : null);
					setStatus("saved");
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
					setStatus("failed");
				}
			};
			if (authError) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: CatalogManager_module_css_default.page,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: CatalogManager_module_css_default.card,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CatalogManager_module_css_default.title,
						children: "Catalog management requires login"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: CatalogManager_module_css_default.hint,
						children: [
							"Log in from the ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
								href: "/admin",
								children: "admin console"
							}),
							", then reload this page."
						]
					})]
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CatalogManager_module_css_default.page,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: CatalogManager_module_css_default.header,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
							className: CatalogManager_module_css_default.title,
							children: "SOC Catalogs"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: CatalogManager_module_css_default.tabs,
							role: "tablist",
							children: CATALOGS.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								role: "tab",
								"aria-selected": catalog === name,
								className: `${CatalogManager_module_css_default.tab} ${catalog === name ? CatalogManager_module_css_default.tabActive : ""}`,
								onClick: () => {
									setCatalog(name);
									setSearch("");
								},
								children: CATALOG_LABELS[name]
							}, name))
						})]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: `${CatalogManager_module_css_default.message} ${CatalogManager_module_css_default.error}`,
						role: "alert",
						children: error
					}),
					status === "saved" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: `${CatalogManager_module_css_default.message} ${CatalogManager_module_css_default.success}`,
						role: "status",
						children: "Saved. Every change is recorded in the history."
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: CatalogManager_module_css_default.layout,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: CatalogManager_module_css_default.listPane,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: CatalogManager_module_css_default.listToolbar,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: CatalogManager_module_css_default.control,
										"aria-label": "Search catalog",
										placeholder: "Search…",
										value: search,
										onChange: (event) => setSearch(event.target.value)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: CatalogManager_module_css_default.button,
										type: "button",
										onClick: startCreate,
										children: "New record"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: CatalogManager_module_css_default.listMeta,
									children: list ? `${list.total} record(s)` : "Loading…"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: CatalogManager_module_css_default.recordList,
									role: "listbox",
									"aria-label": `${CATALOG_LABELS[catalog]} records`,
									children: (list?.items ?? []).map((record) => {
										const id = valueText$2(record.record_id);
										const active = selected && valueText$2(selected.record_id) === id;
										return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											role: "option",
											"aria-selected": active,
											className: `${CatalogManager_module_css_default.recordItem} ${active ? CatalogManager_module_css_default.recordActive : ""}`,
											onClick: () => {
												selectRecord(id);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: CatalogManager_module_css_default.recordTitle,
												children: catalogTitle(record, catalog)
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: CatalogManager_module_css_default.recordMeta,
												children: [
													catalogSubtitle(record, catalog),
													record.archived ? " · archived" : "",
													" · rev ",
													valueText$2(record.revision)
												]
											})]
										}) }, id);
									})
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: CatalogManager_module_css_default.editorPane,
							children: [selected || mode === "create" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: CatalogManager_module_css_default.editorHeader,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: CatalogManager_module_css_default.editorTitle,
										children: [mode === "create" ? `New ${CATALOG_LABELS[catalog]} record` : `${CATALOG_LABELS[catalog]}: ${selected ? catalogTitle(selected, catalog) : ""}`, selected ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: CatalogManager_module_css_default.editorMeta,
											children: [
												" revision ",
												valueText$2(selected.revision),
												selected.archived ? " · archived" : ""
											]
										}) : null]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: CatalogManager_module_css_default.editorActions,
										children: [mode === "view" && selected && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: CatalogManager_module_css_default.button,
											type: "button",
											onClick: startEdit,
											disabled: Boolean(selected.archived),
											children: "Edit"
										}), selected.archived ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: CatalogManager_module_css_default.button,
											type: "button",
											onClick: () => {
												setArchived(false);
											},
											children: "Restore"
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: CatalogManager_module_css_default.button,
											type: "button",
											onClick: () => {
												setArchived(true);
											},
											children: "Archive"
										})] }), mode !== "view" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: CatalogManager_module_css_default.button,
											type: "button",
											disabled: status === "busy",
											onClick: () => {
												setMode(selected ? "view" : "view");
												setFieldErrors({});
												selected ? setFields(formFromRecord(selected)) : startCreate();
											},
											children: "Cancel"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: `${CatalogManager_module_css_default.button} ${CatalogManager_module_css_default.primary}`,
											type: "button",
											disabled: status === "busy",
											onClick: () => {
												save();
											},
											children: status === "busy" ? "Saving…" : "Save"
										})] })]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: CatalogManager_module_css_default.fieldGrid,
									children: CATALOG_FIELDS[catalog].map((key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FieldRow, {
										fieldKey: key,
										value: fields[key] ?? "",
										error: fieldErrors[key] ?? "",
										disabled: mode === "view",
										onChange: (value) => setFields((current) => ({
											...current,
											[key]: value
										}))
									}, key))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
									className: CatalogManager_module_css_default.section,
									open: true,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "Revision history" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HistoryView, { history })]
								})
							] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: CatalogManager_module_css_default.hint,
								children: "Select a record from the list, or create a new one."
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
								className: CatalogManager_module_css_default.section,
								open: true,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "Publication to Splunk" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: CatalogManager_module_css_default.publishBar,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: CatalogManager_module_css_default.button,
											type: "button",
											disabled: status === "busy",
											onClick: () => {
												loadPreview();
											},
											children: "Preview snapshot"
										}), preview && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: `${CatalogManager_module_css_default.button} ${CatalogManager_module_css_default.primary}`,
											type: "button",
											disabled: status === "busy",
											onClick: () => {
												publish();
											},
											children: "Publish…"
										})]
									}),
									preview && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: CatalogManager_module_css_default.preview,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
												"Lookup: ",
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: valueText$2(preview.lookup_name) }),
												" · ",
												valueText$2(preview.record_count),
												" record(s)"
											] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: ["Checksum: ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: valueText$2(preview.content_checksum) })] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: preview.validation?.valid ? CatalogManager_module_css_default.success : CatalogManager_module_css_default.error,
												children: preview.validation?.valid ? "Validation passed; ready to publish." : JSON.stringify(preview.validation?.errors)
											}),
											Array.isArray(preview.validation?.warnings) && preview.validation.warnings.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: CatalogManager_module_css_default.hint,
												children: ["Warnings: ", preview.validation.warnings.slice(0, 10).join(" · ")]
											})
										]
									}),
									publications.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
										className: CatalogManager_module_css_default.publicationTable,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "When" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "Outcome" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "Checksum" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "Actor" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {})
										] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: publications.map((publication) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: valueText$2(publication.published_at) }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusPill, { status: valueText$2(publication.outcome) }) }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: valueText$2(publication.content_checksum).slice(0, 12) }) }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: valueText$2(publication.actor) }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: publication.outcome === "published" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: CatalogManager_module_css_default.button,
												type: "button",
												onClick: () => {
													rollback(valueText$2(publication.publication_id));
												},
												children: "Restore"
											}) })
										] }, valueText$2(publication.publication_id))) })]
									})
								]
							})]
						})]
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/home/chan-kok-pan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/CatalogToolview.module.css.mjs
		const css$6 = ".uoaL5G_card{border:1px solid var(--dsw-alias-border-l2,#d5d9de);background:var(--dsw-alias-surface-primary,#fff);color:var(--dsw-alias-text-primary,#1c2024);border-radius:10px;flex-direction:column;gap:12px;margin:8px 0;padding:16px;font-size:13px;display:flex}.uoaL5G_header{justify-content:space-between;gap:12px;display:flex}.uoaL5G_title{font-size:15px;font-weight:600}.uoaL5G_subtitle{color:var(--dsw-alias-text-secondary,#5c6470);margin-top:2px;font-size:12px}.uoaL5G_content{flex-direction:column;gap:12px;display:flex}.uoaL5G_grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px 14px;display:grid}.uoaL5G_field{flex-direction:column;gap:4px;min-width:0;display:flex}.uoaL5G_fieldInvalid .uoaL5G_input,.uoaL5G_fieldInvalid .uoaL5G_textarea,.uoaL5G_fieldInvalid .uoaL5G_select{border-color:var(--dsw-alias-danger,#d33)}.uoaL5G_label{color:var(--dsw-alias-text-secondary,#5c6470);text-transform:capitalize;font-size:11px}.uoaL5G_fieldError{color:var(--dsw-alias-danger,#d33);font-size:11px}.uoaL5G_input,.uoaL5G_textarea,.uoaL5G_select{border:1px solid var(--dsw-alias-border-l2,#d5d9de);background:var(--dsw-alias-surface-secondary,#fafbfc);width:100%;color:inherit;font:inherit;box-sizing:border-box;border-radius:6px;padding:6px 8px}.uoaL5G_textarea{resize:vertical;min-height:64px}.uoaL5G_message{border-radius:6px;padding:8px 10px;font-size:12px}.uoaL5G_error{background:color-mix(in srgb, var(--dsw-alias-danger,#d33) 10%, transparent);color:var(--dsw-alias-danger,#a00)}.uoaL5G_success{background:color-mix(in srgb, var(--dsw-alias-success,#2a8b43) 10%, transparent);color:var(--dsw-alias-success,#23692f)}.uoaL5G_actions{justify-content:flex-end;gap:8px;display:flex}.uoaL5G_button{border:1px solid var(--dsw-alias-border-l2,#d5d9de);color:inherit;font:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:6px 14px}.uoaL5G_button:disabled{opacity:.6;cursor:default}.uoaL5G_primary{background:var(--dsw-alias-primary,#2563eb);border-color:var(--dsw-alias-primary,#2563eb);color:#fff}.uoaL5G_secondary{background:0 0}@media (width<=700px){.uoaL5G_grid{grid-template-columns:1fr}}";
		const tagId$6 = "dsh-soc-agent-client/CatalogToolview.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$6) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$6;
			tag.textContent = css$6;
			document.head.appendChild(tag);
		}
		var CatalogToolview_module_css_default = {
			"actions": "uoaL5G_actions",
			"button": "uoaL5G_button",
			"card": "uoaL5G_card",
			"content": "uoaL5G_content",
			"error": "uoaL5G_error",
			"field": "uoaL5G_field",
			"fieldError": "uoaL5G_fieldError",
			"fieldInvalid": "uoaL5G_fieldInvalid",
			"grid": "uoaL5G_grid",
			"header": "uoaL5G_header",
			"input": "uoaL5G_input",
			"label": "uoaL5G_label",
			"message": "uoaL5G_message",
			"primary": "uoaL5G_primary",
			"secondary": "uoaL5G_secondary",
			"select": "uoaL5G_select",
			"subtitle": "uoaL5G_subtitle",
			"success": "uoaL5G_success",
			"textarea": "uoaL5G_textarea",
			"title": "uoaL5G_title"
		};
		//#endregion
		//#region src/client/CatalogToolview.tsx
		function valueText$1(value) {
			if (typeof value === "string") return value;
			if (typeof value === "number" && Number.isFinite(value)) return String(value);
			return "";
		}
		function Field$2({ label, value, onChange, multiline = false, readOnly = false, error = "" }) {
			const control = multiline ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
				className: CatalogToolview_module_css_default.textarea,
				"aria-label": label,
				value,
				readOnly,
				onChange: (event) => onChange?.(event.target.value)
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				className: CatalogToolview_module_css_default.input,
				"aria-label": label,
				value,
				readOnly,
				onChange: (event) => onChange?.(event.target.value)
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: `${CatalogToolview_module_css_default.field} ${error ? CatalogToolview_module_css_default.fieldInvalid : ""}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CatalogToolview_module_css_default.label,
						children: label
					}),
					control,
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CatalogToolview_module_css_default.fieldError,
						role: "alert",
						children: error
					})
				]
			});
		}
		function SelectField$1({ label, value, options, onChange, error = "" }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: `${CatalogToolview_module_css_default.field} ${error ? CatalogToolview_module_css_default.fieldInvalid : ""}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CatalogToolview_module_css_default.label,
						children: label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
						className: CatalogToolview_module_css_default.select,
						"aria-label": label,
						value,
						onChange: (event) => onChange(event.target.value),
						children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: option.value,
							children: option.label
						}, option.value))
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CatalogToolview_module_css_default.fieldError,
						role: "alert",
						children: error
					})
				]
			});
		}
		function CatalogToolview({ block, connection, toolName }) {
			const envelope = (0, react.useMemo)(() => parseCatalogEnvelope(block), [block]);
			const sourceKey = (0, react.useMemo)(() => JSON.stringify(envelope?.record ?? null), [envelope]);
			const catalog = envelope?.catalog ?? "rule";
			const operation = envelope?.operation ?? (toolName.includes("update") ? "update" : "write");
			const [fields, setFields] = (0, react.useState)(() => formFromRecord(envelope?.record ?? {}));
			const [status, setStatus] = (0, react.useState)("editing");
			const [error, setError] = (0, react.useState)(null);
			const [fieldErrors, setFieldErrors] = (0, react.useState)({});
			const [persisted, setPersisted] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (!envelope?.record) return;
				setFields(formFromRecord(envelope.record));
				setStatus("editing");
				setError(null);
				setFieldErrors({});
				setPersisted(null);
			}, [sourceKey]);
			if (!("kind" in block)) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: CatalogToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: CatalogToolview_module_css_default.message,
					children: "Preparing catalog editor…"
				})
			});
			const upstreamError = catalogErrorMessage(envelope);
			if (upstreamError || block.isError || !envelope?.record || Object.keys(envelope.record).length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: CatalogToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: `${CatalogToolview_module_css_default.message} ${CatalogToolview_module_css_default.error}`,
					children: upstreamError || "Unable to prepare the catalog editor."
				})
			});
			const label = CATALOG_LABELS[catalog];
			const setField = (key, value) => setFields((current) => ({
				...current,
				[key]: value
			}));
			const resetDraft = () => {
				setFields(formFromRecord(envelope.record));
				setStatus("editing");
				setError(null);
				setFieldErrors({});
				setPersisted(null);
			};
			const save = async () => {
				const localErrors = validateCatalogForm(catalog, fields);
				if (Object.keys(localErrors).length > 0) {
					setFieldErrors(localErrors);
					setError("Correct the highlighted fields before saving.");
					setStatus("failed");
					return;
				}
				const target = operation === "update" ? envelope.target_id || envelope.record.record_id : void 0;
				const expectedRevision = envelope.expected_revision ?? envelope.current_revision;
				if (operation === "update" && !expectedRevision) {
					setError("This edit draft has no revision. Reopen the record from the catalog.");
					setStatus("failed");
					return;
				}
				setStatus("saving");
				setError(null);
				setFieldErrors({});
				try {
					const result = await rpc(connection, "save-catalog-record", {
						catalog,
						operation,
						record: recordFromForm(catalog, fields),
						...target ? { record_id: target } : {},
						...operation === "update" ? { expected_revision: expectedRevision } : {}
					});
					if (!result || result.saved !== true || !result.record) throw new Error("The catalog did not confirm that the record was saved.");
					setPersisted(result.record);
					setStatus("saved");
				} catch (cause) {
					const message = cause instanceof Error ? cause.message : String(cause);
					const details = cause?.details;
					setFieldErrors(catalogFieldErrors({ details }));
					setStatus("failed");
					setError(message);
				}
			};
			if (status === "saved" && persisted) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CatalogToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: CatalogToolview_module_css_default.header,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: CatalogToolview_module_css_default.title,
						children: [label, " record saved"]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: CatalogToolview_module_css_default.subtitle,
						children: [
							catalogTitle(persisted, catalog),
							" · revision ",
							valueText$1(persisted.revision)
						]
					})] })
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: CatalogToolview_module_css_default.content,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: `${CatalogToolview_module_css_default.message} ${CatalogToolview_module_css_default.success}`,
						children: "Saved to the catalog with a full history entry. Publish to Splunk separately from the catalogs page."
					})
				})]
			});
			const renderField = (key) => {
				const options = SELECT_FIELDS[key];
				const common = {
					key,
					label: key.replace(/_/g, " "),
					value: fields[key] ?? "",
					error: fieldErrors[key] ?? ""
				};
				if (options) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField$1, {
					...common,
					options,
					onChange: (value) => setField(key, value)
				});
				const multiline = key.startsWith("description") || key === "notes" || key.startsWith("remediation");
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$2, {
					...common,
					multiline,
					onChange: (value) => setField(key, value)
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: CatalogToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				"aria-label": `Editable ${label} draft`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: CatalogToolview_module_css_default.header,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CatalogToolview_module_css_default.title,
						children: operation === "update" ? `Edit ${label} Record` : `New ${label} Record`
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CatalogToolview_module_css_default.subtitle,
						children: "Review the fields, then Save to write it to the catalog. Publication to Splunk is separate."
					})] })
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: CatalogToolview_module_css_default.content,
					children: [
						error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: `${CatalogToolview_module_css_default.message} ${CatalogToolview_module_css_default.error}`,
							role: "alert",
							children: error
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: CatalogToolview_module_css_default.grid,
							children: CATALOG_FIELDS[catalog].map((key) => renderField(key))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: CatalogToolview_module_css_default.actions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${CatalogToolview_module_css_default.button} ${CatalogToolview_module_css_default.secondary}`,
								type: "button",
								disabled: status === "saving",
								onClick: resetDraft,
								children: "Reset"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${CatalogToolview_module_css_default.button} ${CatalogToolview_module_css_default.primary}`,
								type: "button",
								disabled: status === "saving",
								onClick: () => {
									save();
								},
								children: status === "saving" ? "Saving…" : status === "failed" ? "Retry" : "Save"
							})]
						})
					]
				})]
			});
		}
		const catalogToolview = {
			name: "catalog-toolview",
			inject: ["slots", "connection"],
			apply(ctx) {
				const connection = ctx.get("connection");
				for (const key of CATALOG_DRAFT_TOOL_NAMES) ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
					name: "tool.call.toolview",
					key,
					inject: () => ({ connection })
				}, CatalogToolview));
			}
		};
		function installCatalogToolview(ctx) {
			ctx.plugin(catalogToolview);
		}
		//#endregion
		//#region \0dsh-css:/home/chan-kok-pan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/EmailDraftToolview.module.css.mjs
		const css$5 = ".n3H6Yq_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l1,transparent);border-radius:10px;margin:6px 0;overflow:hidden}.n3H6Yq_header{background:var(--dsw-alias-surface-l2,transparent);justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;display:flex}.n3H6Yq_title{font-weight:600}.n3H6Yq_account{color:var(--dsw-alias-text-l2);font-size:12px}.n3H6Yq_content{gap:9px;padding:12px;display:grid}.n3H6Yq_field{gap:4px;display:grid}.n3H6Yq_label{color:var(--dsw-alias-text-l2);font-size:12px;font-weight:600}.n3H6Yq_input,.n3H6Yq_textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l0,transparent);width:100%;color:inherit;font:inherit;border-radius:6px;padding:8px 9px}.n3H6Yq_textarea{resize:vertical;min-height:180px;line-height:1.45}.n3H6Yq_input:focus,.n3H6Yq_textarea:focus{outline:2px solid var(--dsw-alias-primary,currentColor);outline-offset:1px}.n3H6Yq_actions{justify-content:flex-end;gap:8px;padding-top:3px;display:flex}.n3H6Yq_signaturePanel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l2,transparent);border-radius:8px;gap:9px;padding:10px;display:grid}.n3H6Yq_button{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l2,transparent);color:inherit;cursor:pointer;font:inherit;border-radius:6px;padding:7px 12px}.n3H6Yq_primary{color:var(--dsw-alias-on-primary,#fff);background:#2563eb;border-color:#2563eb}.n3H6Yq_primary:hover{background:#1d4ed8;border-color:#1d4ed8}.n3H6Yq_danger{color:#fff;background:#dc2626;border-color:#dc2626}.n3H6Yq_danger:hover{background:#b91c1c;border-color:#b91c1c}.n3H6Yq_signatureButton{color:#fff;background:#7c3aed;border-color:#7c3aed}.n3H6Yq_signatureButton:hover{background:#6d28d9;border-color:#6d28d9}.n3H6Yq_button:disabled{cursor:wait;opacity:.6}.n3H6Yq_message{color:var(--dsw-alias-text-l2);padding:10px 12px;font-size:13px}.n3H6Yq_error{color:var(--dsw-alias-danger,#b42318)}";
		const tagId$5 = "dsh-soc-agent-client/EmailDraftToolview.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var EmailDraftToolview_module_css_default = {
			"account": "n3H6Yq_account",
			"actions": "n3H6Yq_actions",
			"button": "n3H6Yq_button",
			"card": "n3H6Yq_card",
			"content": "n3H6Yq_content",
			"danger": "n3H6Yq_danger",
			"error": "n3H6Yq_error",
			"field": "n3H6Yq_field",
			"header": "n3H6Yq_header",
			"input": "n3H6Yq_input",
			"label": "n3H6Yq_label",
			"message": "n3H6Yq_message",
			"primary": "n3H6Yq_primary",
			"signatureButton": "n3H6Yq_signatureButton",
			"signaturePanel": "n3H6Yq_signaturePanel",
			"textarea": "n3H6Yq_textarea",
			"title": "n3H6Yq_title"
		};
		//#endregion
		//#region src/client/emailDraft.ts
		const ZIMBRA_DRAFT_TOOL_NAME = "mcp__soc_agent__zimbra_send_email";
		const ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME = "mcp__soc_agent__zimbra_use_signature_on_email";
		function parseRecipientText(value) {
			return [...new Set(value.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean))];
		}
		function draftFromForm(fields) {
			return {
				to: parseRecipientText(fields.to),
				cc: parseRecipientText(fields.cc),
				bcc: parseRecipientText(fields.bcc),
				subject: fields.subject.trim(),
				body: fields.body
			};
		}
		//#endregion
		//#region src/client/EmailDraftToolview.tsx
		function resultText$1(block) {
			if (!("kind" in block)) return "";
			return block.content.filter((item) => item.type === "text").map((item) => item.text).join("");
		}
		function parseEnvelope(block) {
			const text = resultText$1(block);
			if (!text) return null;
			try {
				const value = JSON.parse(text);
				if (typeof value !== "object" || value === null) return null;
				const record = value;
				const data = record.data;
				if (typeof data === "object" && data !== null && "draft" in data) return data;
				if ("draft" in record) return record;
				return {
					draft: {},
					error: record.error
				};
			} catch {
				return null;
			}
		}
		function listValue(value) {
			if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
			if (typeof value === "string") return value.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean);
			return [];
		}
		function formFromEnvelope(envelope) {
			const draft = envelope.draft || {};
			return {
				to: listValue(draft.to).join(", "),
				cc: listValue(draft.cc).join(", "),
				bcc: listValue(draft.bcc).join(", "),
				subject: typeof draft.subject === "string" ? draft.subject : "",
				body: typeof draft.body === "string" ? draft.body : ""
			};
		}
		function errorMessage(envelope) {
			const error = envelope?.error;
			if (typeof error === "object" && error !== null && "message" in error) {
				const message = error.message;
				if (typeof message === "string" && message) return message;
			}
			return typeof error === "string" && error ? error : null;
		}
		function EmailDraftToolview({ block, connection }) {
			const envelope = (0, react.useMemo)(() => parseEnvelope(block), [block]);
			const sourceKey = (0, react.useMemo)(() => JSON.stringify(envelope?.draft ?? null), [envelope]);
			const [fields, setFields] = (0, react.useState)(() => envelope ? formFromEnvelope(envelope) : {
				to: "",
				cc: "",
				bcc: "",
				subject: "",
				body: ""
			});
			const [status, setStatus] = (0, react.useState)("editing");
			const [sendError, setSendError] = (0, react.useState)(null);
			const [bodyFormat, setBodyFormat] = (0, react.useState)(envelope?.draft.body_format === "html" ? "html" : "text");
			const [signaturePanel, setSignaturePanel] = (0, react.useState)(false);
			const [signatures, setSignatures] = (0, react.useState)([]);
			const [signatureId, setSignatureId] = (0, react.useState)("");
			const [signatureFormat, setSignatureFormat] = (0, react.useState)("text");
			const [signaturePlacement, setSignaturePlacement] = (0, react.useState)("below");
			const [signatureStatus, setSignatureStatus] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (envelope?.draft) {
					setFields(formFromEnvelope(envelope));
					setStatus("editing");
					setSendError(null);
					setBodyFormat(envelope.draft.body_format === "html" ? "html" : "text");
					setSignaturePanel(false);
					setSignatureStatus(null);
				}
			}, [sourceKey]);
			if (!("kind" in block)) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: EmailDraftToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: EmailDraftToolview_module_css_default.message,
					children: "Preparing email draft…"
				})
			});
			const upstreamError = errorMessage(envelope);
			if (upstreamError || block.isError) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: EmailDraftToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: `${EmailDraftToolview_module_css_default.message} ${EmailDraftToolview_module_css_default.error}`,
					children: upstreamError || "Unable to create the email draft."
				})
			});
			if (status === "discarded") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: EmailDraftToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: EmailDraftToolview_module_css_default.header,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: EmailDraftToolview_module_css_default.title,
						children: "Email draft discarded"
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: EmailDraftToolview_module_css_default.actions,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: EmailDraftToolview_module_css_default.button,
						type: "button",
						onClick: () => {
							setFields(envelope ? formFromEnvelope(envelope) : fields);
							setStatus("editing");
						},
						children: "Reopen"
					})
				})]
			});
			const update = (field) => (event) => {
				setFields((current) => ({
					...current,
					[field]: event.target.value
				}));
			};
			const submit = async () => {
				const draft = draftFromForm(fields);
				if (draft.to.length === 0) {
					setSendError("Add at least one To recipient.");
					return;
				}
				if (!draft.subject) {
					setSendError("Subject cannot be empty.");
					return;
				}
				if (typeof window !== "undefined" && !window.confirm("Send this email now?")) return;
				setStatus("sending");
				setSendError(null);
				try {
					if ((await rpc(connection, "send-email", {
						...draft,
						body_format: bodyFormat
					}))?.sent !== true) throw new Error("Zimbra did not confirm that the email was sent.");
					setStatus("sent");
				} catch (error) {
					setStatus("failed");
					setSendError(error instanceof Error ? error.message : String(error));
				}
			};
			const loadSignatures = async () => {
				setSignaturePanel(true);
				setSignatureStatus("Loading signatures…");
				try {
					const next = (await rpc(connection, "list-signatures")).signatures ?? [];
					setSignatures(next);
					setSignatureId((current) => current || next[0]?.id || "");
					setSignatureStatus(next.length ? null : "No signatures are configured for this account.");
				} catch (error) {
					setSignatureStatus(error instanceof Error ? error.message : String(error));
				}
			};
			const applySignature = () => {
				const value = signatures.find((item) => item.id === signatureId)?.[signatureFormat];
				if (!value) {
					setSignatureStatus(`The selected signature has no ${signatureFormat} content.`);
					return;
				}
				const separator = signatureFormat === "html" ? "<br><br>" : "\n\n";
				setFields((current) => ({
					...current,
					body: signaturePlacement === "above" && current.body ? `${value}${separator}${current.body}` : current.body ? `${current.body}${separator}${value}` : value
				}));
				setBodyFormat(signatureFormat);
				setSignaturePanel(false);
				setSignatureStatus(null);
			};
			if (status === "sent") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: EmailDraftToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: EmailDraftToolview_module_css_default.header,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: EmailDraftToolview_module_css_default.title,
						children: "Email sent successfully"
					})
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: EmailDraftToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				"aria-label": "Editable Zimbra email draft",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: EmailDraftToolview_module_css_default.header,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: EmailDraftToolview_module_css_default.title,
						children: "Email draft"
					}) })
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: EmailDraftToolview_module_css_default.content,
					children: [
						[
							"to",
							"cc",
							"bcc"
						].map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: EmailDraftToolview_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: EmailDraftToolview_module_css_default.label,
								children: field === "to" ? "To" : field === "cc" ? "Cc" : "Bcc"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: EmailDraftToolview_module_css_default.input,
								"aria-label": field,
								value: fields[field],
								onChange: update(field),
								placeholder: "name@example.com"
							})]
						}, field)),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: EmailDraftToolview_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: EmailDraftToolview_module_css_default.label,
								children: "Subject"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: EmailDraftToolview_module_css_default.input,
								"aria-label": "Subject",
								value: fields.subject,
								onChange: update("subject"),
								maxLength: 998
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: EmailDraftToolview_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: EmailDraftToolview_module_css_default.label,
								children: "Body"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								className: EmailDraftToolview_module_css_default.textarea,
								"aria-label": "Body",
								value: fields.body,
								onChange: update("body"),
								maxLength: 18e3
							})]
						}),
						sendError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: `${EmailDraftToolview_module_css_default.message} ${EmailDraftToolview_module_css_default.error}`,
							role: "alert",
							children: sendError
						}),
						signaturePanel && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: EmailDraftToolview_module_css_default.signaturePanel,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: EmailDraftToolview_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: EmailDraftToolview_module_css_default.label,
										children: "Signature"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										className: EmailDraftToolview_module_css_default.input,
										"aria-label": "Signature",
										value: signatureId,
										onChange: (event) => setSignatureId(event.target.value),
										children: signatures.map((signature) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: signature.id,
											children: signature.name
										}, signature.id))
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: EmailDraftToolview_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: EmailDraftToolview_module_css_default.label,
										children: "Format"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: EmailDraftToolview_module_css_default.input,
										"aria-label": "Signature format",
										value: signatureFormat,
										onChange: (event) => setSignatureFormat(event.target.value),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "text",
											children: "Plain text"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "html",
											children: "HTML"
										})]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: EmailDraftToolview_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: EmailDraftToolview_module_css_default.label,
										children: "Placement"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: EmailDraftToolview_module_css_default.input,
										"aria-label": "Signature placement",
										value: signaturePlacement,
										onChange: (event) => setSignaturePlacement(event.target.value),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "below",
											children: "Below body"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "above",
											children: "Above body"
										})]
									})]
								}),
								signatureStatus && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: EmailDraftToolview_module_css_default.message,
									role: "status",
									children: signatureStatus
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: EmailDraftToolview_module_css_default.actions,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: EmailDraftToolview_module_css_default.button,
										type: "button",
										onClick: () => setSignaturePanel(false),
										children: "Cancel"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: `${EmailDraftToolview_module_css_default.button} ${EmailDraftToolview_module_css_default.primary}`,
										type: "button",
										disabled: !signatureId || Boolean(signatureStatus),
										onClick: applySignature,
										children: "Apply signature"
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: EmailDraftToolview_module_css_default.actions,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `${EmailDraftToolview_module_css_default.button} ${EmailDraftToolview_module_css_default.danger}`,
									type: "button",
									disabled: status === "sending",
									onClick: () => {
										setStatus("discarded");
									},
									children: "Discard"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `${EmailDraftToolview_module_css_default.button} ${EmailDraftToolview_module_css_default.signatureButton}`,
									type: "button",
									disabled: status === "sending",
									onClick: () => {
										loadSignatures();
									},
									children: "Add signature"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `${EmailDraftToolview_module_css_default.button} ${EmailDraftToolview_module_css_default.primary}`,
									type: "button",
									disabled: status === "sending",
									onClick: submit,
									children: status === "sending" ? "Sending…" : status === "failed" ? "Retry" : "Send"
								})
							]
						})
					]
				})]
			});
		}
		const emailDraftToolview = {
			name: "zimbra-email-draft-toolview",
			inject: ["slots", "connection"],
			apply(ctx) {
				const connection = ctx.get("connection");
				for (const key of [ZIMBRA_DRAFT_TOOL_NAME, ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME]) ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
					name: "tool.call.toolview",
					key,
					inject: () => ({ connection })
				}, EmailDraftToolview));
			}
		};
		function installEmailDraftToolview(ctx) {
			ctx.plugin(emailDraftToolview);
		}
		//#endregion
		//#region \0dsh-css:/home/chan-kok-pan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/SplunkDetectionToolview.module.css.mjs
		const css$4 = ".mXcQ9q_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l1,transparent);border-radius:10px;margin:6px 0;overflow:hidden}.mXcQ9q_header{background:var(--dsw-alias-surface-l2,transparent);justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;display:flex}.mXcQ9q_title{font-weight:700}.mXcQ9q_subtitle,.mXcQ9q_message,.mXcQ9q_hint{color:var(--dsw-alias-text-l2);font-size:12px}.mXcQ9q_content{gap:10px;padding:14px;display:grid}.mXcQ9q_notice{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l2,transparent);color:var(--dsw-alias-text-l2);border-radius:7px;padding:9px 11px;font-size:13px}.mXcQ9q_section{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;overflow:hidden}.mXcQ9q_section summary{cursor:pointer;background:var(--dsw-alias-surface-l2,transparent);padding:9px 11px;font-weight:700}.mXcQ9q_sectionBody{gap:9px;padding:11px;display:grid}.mXcQ9q_field{gap:4px;display:grid}.mXcQ9q_label{color:var(--dsw-alias-text-l2);font-size:12px;font-weight:600}.mXcQ9q_input,.mXcQ9q_textarea,.mXcQ9q_select{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l0,transparent);width:100%;color:inherit;font:inherit;border-radius:6px;padding:8px 9px}.mXcQ9q_textarea{resize:vertical;min-height:82px;line-height:1.45}.mXcQ9q_spl{tab-size:2;min-height:250px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px}.mXcQ9q_input:focus,.mXcQ9q_textarea:focus,.mXcQ9q_select:focus{outline:2px solid var(--dsw-alias-primary,currentColor);outline-offset:1px}.mXcQ9q_input[readonly]{opacity:.75}.mXcQ9q_grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;display:grid}.mXcQ9q_toggle{min-height:34px;color:inherit;align-items:center;gap:8px;font-size:13px;display:flex}.mXcQ9q_toggle input{width:16px;height:16px;accent-color:var(--dsw-alias-primary,#2563eb)}.mXcQ9q_actionRows{gap:7px;display:grid}.mXcQ9q_actionRow{grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;align-items:center;gap:7px;display:grid}.mXcQ9q_managed{background:var(--dsw-alias-surface-l2,transparent);color:var(--dsw-alias-text-l2);border-radius:6px;padding:8px 9px;font-size:12px}.mXcQ9q_actions{justify-content:flex-end;gap:8px;padding-top:3px;display:flex}.mXcQ9q_button{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l2,transparent);color:inherit;cursor:pointer;font:inherit;border-radius:6px;padding:8px 13px}.mXcQ9q_button:hover{filter:brightness(1.08)}.mXcQ9q_primary{color:#fff;background:#198754;border-color:#198754}.mXcQ9q_secondary{color:#fff;background:#4b5563;border-color:#4b5563}.mXcQ9q_button:disabled{cursor:wait;opacity:.6}.mXcQ9q_message{padding:10px 12px;font-size:13px}.mXcQ9q_error{color:var(--dsw-alias-danger,#b42318)}.mXcQ9q_success{color:var(--dsw-alias-success,#16803c)}.mXcQ9q_savedSummary{border:1px solid var(--dsw-alias-border-l2);border-radius:7px;gap:7px;padding:10px 11px;display:grid}.mXcQ9q_savedSummary>div{grid-template-columns:140px minmax(0,1fr);gap:10px;display:grid}.mXcQ9q_savedLabel{color:var(--dsw-alias-text-l2);font-size:12px;font-weight:600}.mXcQ9q_savedSpl{gap:5px;display:grid}.mXcQ9q_savedSpl pre{background:var(--dsw-alias-surface-l2,transparent);white-space:pre-wrap;border-radius:7px;max-height:180px;margin:0;padding:10px;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow:auto}@media (width<=700px){.mXcQ9q_grid,.mXcQ9q_actionRow,.mXcQ9q_savedSummary>div{grid-template-columns:1fr}}";
		const tagId$4 = "dsh-soc-agent-client/SplunkDetectionToolview.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var SplunkDetectionToolview_module_css_default = {
			"actionRow": "mXcQ9q_actionRow",
			"actionRows": "mXcQ9q_actionRows",
			"actions": "mXcQ9q_actions",
			"button": "mXcQ9q_button",
			"card": "mXcQ9q_card",
			"content": "mXcQ9q_content",
			"error": "mXcQ9q_error",
			"field": "mXcQ9q_field",
			"grid": "mXcQ9q_grid",
			"header": "mXcQ9q_header",
			"hint": "mXcQ9q_hint",
			"input": "mXcQ9q_input",
			"label": "mXcQ9q_label",
			"managed": "mXcQ9q_managed",
			"message": "mXcQ9q_message",
			"notice": "mXcQ9q_notice",
			"primary": "mXcQ9q_primary",
			"savedLabel": "mXcQ9q_savedLabel",
			"savedSpl": "mXcQ9q_savedSpl",
			"savedSummary": "mXcQ9q_savedSummary",
			"secondary": "mXcQ9q_secondary",
			"section": "mXcQ9q_section",
			"sectionBody": "mXcQ9q_sectionBody",
			"select": "mXcQ9q_select",
			"spl": "mXcQ9q_spl",
			"subtitle": "mXcQ9q_subtitle",
			"success": "mXcQ9q_success",
			"textarea": "mXcQ9q_textarea",
			"title": "mXcQ9q_title",
			"toggle": "mXcQ9q_toggle"
		};
		//#endregion
		//#region src/client/splunkDetection.ts
		const SPLUNK_WRITE_DETECTION_TOOL_NAME = "mcp__soc_agent__splunk_write_detection";
		const SPLUNK_UPDATE_DETECTION_TOOL_NAME = "mcp__soc_agent__splunk_update_detection";
		const DETECTION_STANDARD_FIELDS = [
			"is_scheduled",
			"cron_schedule",
			"dispatch.earliest_time",
			"dispatch.latest_time",
			"dispatch.rt_backfill",
			"dispatch.indexedRealtime",
			"dispatch.indexedRealtimeOffset",
			"dispatch.indexedRealtimeMinSpan",
			"dispatch.rt_maximum_span",
			"alert_type",
			"alert_comparator",
			"alert_threshold",
			"alert_condition",
			"alert.digest_mode",
			"alert.suppress",
			"alert.suppress.period",
			"alert.suppress.fields",
			"alert.suppress.group_name",
			"alert.expires",
			"alert.track",
			"actions"
		];
		const MANAGED_ACTION_PREFIX = "action.logevent";
		function isRecord$1(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		function text(value, fallback = "") {
			if (typeof value === "string") return value;
			if (typeof value === "boolean") return value ? "1" : "0";
			if (typeof value === "number" && Number.isFinite(value)) return String(value);
			return fallback;
		}
		function valueFrom(draft, key, fallback = "") {
			return text(draft[key], fallback);
		}
		function isManagedActionField(key) {
			return key === MANAGED_ACTION_PREFIX || key.startsWith(`${MANAGED_ACTION_PREFIX}.`);
		}
		function formFromDraft(draft) {
			return {
				name: valueFrom(draft, "name"),
				description: valueFrom(draft, "description"),
				spl: valueFrom(draft, "spl", valueFrom(draft, "search")),
				is_scheduled: valueFrom(draft, "is_scheduled", "0"),
				cron_schedule: valueFrom(draft, "cron_schedule"),
				"dispatch.earliest_time": valueFrom(draft, "dispatch.earliest_time", valueFrom(draft, "earliest_time", "-10m")),
				"dispatch.latest_time": valueFrom(draft, "dispatch.latest_time", valueFrom(draft, "latest_time", "now")),
				"dispatch.rt_backfill": valueFrom(draft, "dispatch.rt_backfill"),
				"dispatch.indexedRealtime": valueFrom(draft, "dispatch.indexedRealtime"),
				"dispatch.indexedRealtimeOffset": valueFrom(draft, "dispatch.indexedRealtimeOffset"),
				"dispatch.indexedRealtimeMinSpan": valueFrom(draft, "dispatch.indexedRealtimeMinSpan"),
				"dispatch.rt_maximum_span": valueFrom(draft, "dispatch.rt_maximum_span"),
				alert_type: valueFrom(draft, "alert_type"),
				alert_comparator: valueFrom(draft, "alert_comparator"),
				alert_threshold: valueFrom(draft, "alert_threshold"),
				alert_condition: valueFrom(draft, "alert_condition"),
				"alert.digest_mode": valueFrom(draft, "alert.digest_mode"),
				"alert.suppress": valueFrom(draft, "alert.suppress"),
				"alert.suppress.period": valueFrom(draft, "alert.suppress.period"),
				"alert.suppress.fields": valueFrom(draft, "alert.suppress.fields"),
				"alert.suppress.group_name": valueFrom(draft, "alert.suppress.group_name"),
				"alert.expires": valueFrom(draft, "alert.expires"),
				"alert.track": valueFrom(draft, "alert.track", "auto"),
				actions: valueFrom(draft, "actions")
			};
		}
		function actionFieldsFromDraft(draft) {
			return Object.keys(draft).filter((key) => key.startsWith("action.") && !isManagedActionField(key)).sort().map((key) => ({
				key,
				value: text(draft[key])
			}));
		}
		function detectionFromForm(fields, actionFields, reviewOnlyMetadata = {}) {
			const detection = {};
			for (const key of [
				"name",
				"description",
				"spl",
				...DETECTION_STANDARD_FIELDS
			]) detection[key] = fields[key] ?? "";
			detection.enabled = false;
			for (const key of [
				"severity",
				"mitre_attack",
				"risk_score",
				"risk_objects",
				"suppression_window"
			]) if (reviewOnlyMetadata[key] !== void 0) detection[key] = reviewOnlyMetadata[key];
			for (const field of actionFields) {
				const key = field.key.trim();
				if (key) detection[key] = field.value;
			}
			return detection;
		}
		function resultText(block) {
			if (!("kind" in block)) return "";
			return block.content.filter((item) => item.type === "text").map((item) => item.text).join("");
		}
		function parseDetectionEnvelope(block) {
			const raw = resultText(block);
			if (!raw) return null;
			try {
				const parsed = JSON.parse(raw);
				if (!isRecord$1(parsed)) return null;
				const data = isRecord$1(parsed.data) ? parsed.data : parsed;
				if (isRecord$1(data.draft)) return data;
				return {
					draft: {},
					error: parsed.error ?? data.error
				};
			} catch {
				return null;
			}
		}
		function detectionErrorMessage(envelope) {
			const error = envelope?.error;
			if (isRecord$1(error) && typeof error.message === "string" && error.message) return error.message;
			return typeof error === "string" && error ? error : null;
		}
		//#endregion
		//#region src/client/SplunkDetectionToolview.tsx
		function isRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		function isChecked(value) {
			return [
				"1",
				"true",
				"yes",
				"on"
			].includes(String(value ?? "").toLowerCase());
		}
		function valueText(value) {
			if (typeof value === "string") return value;
			if (typeof value === "boolean") return value ? "1" : "0";
			if (typeof value === "number" && Number.isFinite(value)) return String(value);
			return "";
		}
		function Field$1({ label, value, onChange, multiline = false, readOnly = false, className = "" }) {
			const control = multiline ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
				className: `${SplunkDetectionToolview_module_css_default.textarea} ${className}`,
				"aria-label": label,
				value,
				readOnly,
				onChange: (event) => onChange?.(event.target.value)
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				className: `${SplunkDetectionToolview_module_css_default.input} ${className}`,
				"aria-label": label,
				value,
				readOnly,
				onChange: (event) => onChange?.(event.target.value)
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: SplunkDetectionToolview_module_css_default.field,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: SplunkDetectionToolview_module_css_default.label,
					children: label
				}), control]
			});
		}
		function SelectField({ label, value, options, onChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: SplunkDetectionToolview_module_css_default.field,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: SplunkDetectionToolview_module_css_default.label,
					children: label
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
					className: SplunkDetectionToolview_module_css_default.select,
					"aria-label": label,
					value,
					onChange: (event) => onChange(event.target.value),
					children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: option.value,
						children: option.label
					}, option.value))
				})]
			});
		}
		function Toggle({ label, checked, onChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: SplunkDetectionToolview_module_css_default.toggle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					"aria-label": label,
					checked,
					onChange: (event) => onChange(event.target.checked)
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
			});
		}
		function reviewText(metadata) {
			if (!metadata) return null;
			const parts = [
				metadata.severity ? `Severity: ${valueText(metadata.severity)}` : "",
				Array.isArray(metadata.mitre_attack) && metadata.mitre_attack.length ? `MITRE: ${metadata.mitre_attack.join(", ")}` : "",
				metadata.risk_score !== void 0 ? `Risk score: ${valueText(metadata.risk_score)}` : ""
			].filter(Boolean);
			return parts.length ? parts.join(" · ") : null;
		}
		function SplunkDetectionToolview({ block, connection, toolName }) {
			const envelope = (0, react.useMemo)(() => parseDetectionEnvelope(block), [block]);
			const sourceKey = (0, react.useMemo)(() => JSON.stringify(envelope?.draft ?? null), [envelope]);
			const operation = envelope?.operation ?? (toolName === "mcp__soc_agent__splunk_update_detection" ? "update" : "write");
			const [fields, setFields] = (0, react.useState)(() => formFromDraft(envelope?.draft ?? {}));
			const [actionFields, setActionFields] = (0, react.useState)(() => actionFieldsFromDraft(envelope?.draft ?? {}));
			const [status, setStatus] = (0, react.useState)("editing");
			const [error, setError] = (0, react.useState)(null);
			const [persisted, setPersisted] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (!envelope?.draft) return;
				setFields(formFromDraft(envelope.draft));
				setActionFields(actionFieldsFromDraft(envelope.draft));
				setStatus("editing");
				setError(null);
				setPersisted(null);
			}, [sourceKey]);
			if (!("kind" in block)) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: SplunkDetectionToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: SplunkDetectionToolview_module_css_default.message,
					children: "Preparing detection editor…"
				})
			});
			const upstreamError = detectionErrorMessage(envelope);
			if (upstreamError || block.isError || !envelope?.draft || Object.keys(envelope.draft).length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: SplunkDetectionToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: `${SplunkDetectionToolview_module_css_default.message} ${SplunkDetectionToolview_module_css_default.error}`,
					children: upstreamError || "Unable to prepare the Splunk detection editor."
				})
			});
			const setField = (key, value) => setFields((current) => ({
				...current,
				[key]: value
			}));
			const toggleField = (key) => (checked) => setField(key, checked ? "1" : "0");
			const resetDraft = () => {
				setFields(formFromDraft(envelope.draft));
				setActionFields(actionFieldsFromDraft(envelope.draft));
				setStatus("editing");
				setError(null);
				setPersisted(null);
			};
			const save = async () => {
				const name = fields.name.trim();
				if (!name) {
					setError("Detection name cannot be empty.");
					return;
				}
				if (!fields.spl.trim()) {
					setError("SPL cannot be empty.");
					return;
				}
				const target = operation === "update" ? envelope.target_id || name : name;
				const expectedFingerprint = envelope.expected_fingerprint ?? envelope.current_fingerprint;
				if (operation === "update" && !expectedFingerprint) {
					setError("This update draft has no concurrency fingerprint. Reopen it from Splunk.");
					return;
				}
				setStatus("saving");
				setError(null);
				try {
					const result = await rpc(connection, "save-detection", {
						operation,
						name: target,
						detection: detectionFromForm(fields, actionFields, envelope.review_only_metadata),
						...operation === "update" ? { expected_fingerprint: expectedFingerprint } : {}
					});
					if (!isRecord(result) || result.saved !== true || !isRecord(result.detection)) throw new Error("Splunk did not confirm that the detection was saved.");
					setPersisted(result.detection);
					setStatus("saved");
				} catch (cause) {
					setStatus("failed");
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			};
			if (status === "discarded") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SplunkDetectionToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: SplunkDetectionToolview_module_css_default.header,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SplunkDetectionToolview_module_css_default.title,
						children: "Detection draft discarded"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SplunkDetectionToolview_module_css_default.subtitle,
						children: "No Splunk change was made."
					})] })
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: SplunkDetectionToolview_module_css_default.actions,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: `${SplunkDetectionToolview_module_css_default.button} ${SplunkDetectionToolview_module_css_default.secondary}`,
						type: "button",
						onClick: resetDraft,
						children: "Reopen"
					})
				})]
			});
			if (status === "saved") {
				const savedName = valueText(persisted?.name) || fields.name;
				const savedActions = valueText(persisted?.actions) || "No alert actions";
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: SplunkDetectionToolview_module_css_default.card,
					"data-dshcf-preserve": "true",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SplunkDetectionToolview_module_css_default.header,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: SplunkDetectionToolview_module_css_default.title,
							children: "Detection saved successfully"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: SplunkDetectionToolview_module_css_default.subtitle,
							children: savedName
						})] })
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SplunkDetectionToolview_module_css_default.content,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: `${SplunkDetectionToolview_module_css_default.message} ${SplunkDetectionToolview_module_css_default.success}`,
								children: "Saved disabled for review. Enablement remains outside the MCP editor."
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SplunkDetectionToolview_module_css_default.savedSummary,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SplunkDetectionToolview_module_css_default.savedLabel,
										children: "Persisted status"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Disabled" })] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SplunkDetectionToolview_module_css_default.savedLabel,
										children: "Alert actions"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: savedActions })] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SplunkDetectionToolview_module_css_default.savedLabel,
										children: "Description"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: valueText(persisted?.description) || "—" })] })
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SplunkDetectionToolview_module_css_default.savedSpl,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: SplunkDetectionToolview_module_css_default.savedLabel,
									children: "Persisted SPL"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: valueText(persisted?.spl) })]
							})
						]
					})]
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: SplunkDetectionToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				"aria-label": "Editable Splunk detection draft",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: SplunkDetectionToolview_module_css_default.header,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SplunkDetectionToolview_module_css_default.title,
						children: operation === "update" ? "Edit Detection" : "New Detection"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SplunkDetectionToolview_module_css_default.subtitle,
						children: "Review the alert settings, then Save to write it to Splunk."
					})] })
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: SplunkDetectionToolview_module_css_default.content,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: SplunkDetectionToolview_module_css_default.notice,
							children: "Saved alerts remain disabled. Cancel discards this draft without changing Splunk."
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
							className: SplunkDetectionToolview_module_css_default.section,
							open: true,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "Settings" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SplunkDetectionToolview_module_css_default.sectionBody,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
										label: "Name",
										value: fields.name,
										readOnly: operation === "update",
										onChange: (value) => setField("name", value)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
										label: "Description",
										value: fields.description,
										multiline: true,
										onChange: (value) => setField("description", value)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
										label: "Search / SPL",
										value: fields.spl,
										multiline: true,
										className: SplunkDetectionToolview_module_css_default.spl,
										onChange: (value) => setField("spl", value)
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
							className: SplunkDetectionToolview_module_css_default.section,
							open: true,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "Scheduling and dispatch" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SplunkDetectionToolview_module_css_default.sectionBody,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
										label: "Scheduled alert",
										checked: isChecked(fields.is_scheduled),
										onChange: toggleField("is_scheduled")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SplunkDetectionToolview_module_css_default.grid,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
												label: "Cron schedule",
												value: fields.cron_schedule,
												onChange: (value) => setField("cron_schedule", value)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
												label: "Earliest time",
												value: fields["dispatch.earliest_time"],
												onChange: (value) => setField("dispatch.earliest_time", value)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
												label: "Latest time",
												value: fields["dispatch.latest_time"],
												onChange: (value) => setField("dispatch.latest_time", value)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
												label: "Real-time maximum span",
												value: fields["dispatch.rt_maximum_span"],
												onChange: (value) => setField("dispatch.rt_maximum_span", value)
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SplunkDetectionToolview_module_css_default.grid,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
											label: "Real-time backfill",
											checked: isChecked(fields["dispatch.rt_backfill"]),
											onChange: toggleField("dispatch.rt_backfill")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
											label: "Indexed real-time",
											checked: isChecked(fields["dispatch.indexedRealtime"]),
											onChange: toggleField("dispatch.indexedRealtime")
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SplunkDetectionToolview_module_css_default.grid,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
											label: "Indexed real-time offset",
											value: fields["dispatch.indexedRealtimeOffset"],
											onChange: (value) => setField("dispatch.indexedRealtimeOffset", value)
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
											label: "Indexed real-time minimum span",
											value: fields["dispatch.indexedRealtimeMinSpan"],
											onChange: (value) => setField("dispatch.indexedRealtimeMinSpan", value)
										})]
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
							className: SplunkDetectionToolview_module_css_default.section,
							open: true,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "Alert trigger" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SplunkDetectionToolview_module_css_default.sectionBody,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SplunkDetectionToolview_module_css_default.grid,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
											label: "Alert type",
											value: fields.alert_type,
											onChange: (value) => setField("alert_type", value),
											options: [
												{
													value: "",
													label: "Not specified"
												},
												{
													value: "always",
													label: "Always"
												},
												{
													value: "number of events",
													label: "Number of events"
												},
												{
													value: "number of hosts",
													label: "Number of hosts"
												},
												{
													value: "number of sources",
													label: "Number of sources"
												},
												{
													value: "custom",
													label: "Custom condition"
												}
											]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
											label: "Comparator",
											value: fields.alert_comparator,
											onChange: (value) => setField("alert_comparator", value),
											options: [
												{
													value: "",
													label: "Not specified"
												},
												{
													value: "greater than",
													label: "Greater than"
												},
												{
													value: "less than",
													label: "Less than"
												},
												{
													value: "equal to",
													label: "Equal to"
												},
												{
													value: "not equal to",
													label: "Not equal to"
												},
												{
													value: "rises by",
													label: "Rises by"
												},
												{
													value: "drops by",
													label: "Drops by"
												},
												{
													value: "rises by perc",
													label: "Rises by %"
												},
												{
													value: "drops by perc",
													label: "Drops by %"
												}
											]
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SplunkDetectionToolview_module_css_default.grid,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
											label: "Threshold",
											value: fields.alert_threshold,
											onChange: (value) => setField("alert_threshold", value)
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
											label: "Expiration",
											value: fields["alert.expires"],
											onChange: (value) => setField("alert.expires", value)
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
										label: "Custom alert condition",
										value: fields.alert_condition,
										multiline: true,
										onChange: (value) => setField("alert_condition", value)
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
							className: SplunkDetectionToolview_module_css_default.section,
							open: true,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "Alert behavior" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SplunkDetectionToolview_module_css_default.sectionBody,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: SplunkDetectionToolview_module_css_default.grid,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
										label: "Digest mode",
										checked: isChecked(fields["alert.digest_mode"]),
										onChange: toggleField("alert.digest_mode")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
										label: "Throttle / suppress",
										checked: isChecked(fields["alert.suppress"]),
										onChange: toggleField("alert.suppress")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: SplunkDetectionToolview_module_css_default.grid,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
											label: "Throttle period",
											value: fields["alert.suppress.period"],
											onChange: (value) => setField("alert.suppress.period", value)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
											label: "Throttle fields",
											value: fields["alert.suppress.fields"],
											onChange: (value) => setField("alert.suppress.fields", value)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
											label: "Throttle group name",
											value: fields["alert.suppress.group_name"],
											onChange: (value) => setField("alert.suppress.group_name", value)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
											label: "Track alerts",
											value: fields["alert.track"],
											onChange: (value) => setField("alert.track", value),
											options: [
												{
													value: "",
													label: "Not specified"
												},
												{
													value: "auto",
													label: "Auto"
												},
												{
													value: "1",
													label: "Enabled"
												},
												{
													value: "0",
													label: "Disabled"
												}
											]
										})
									]
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
							className: SplunkDetectionToolview_module_css_default.section,
							open: true,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "Actions" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SplunkDetectionToolview_module_css_default.sectionBody,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field$1, {
										label: "Enabled action names",
										value: fields.actions,
										onChange: (value) => setField("actions", value)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SplunkDetectionToolview_module_css_default.actionRows,
										children: [actionFields.map((field, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: SplunkDetectionToolview_module_css_default.actionRow,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: SplunkDetectionToolview_module_css_default.input,
													"aria-label": `Action field ${index + 1} name`,
													value: field.key,
													placeholder: "action.<name>.<parameter>",
													onChange: (event) => setActionFields((current) => current.map((item, itemIndex) => itemIndex === index ? {
														...item,
														key: event.target.value
													} : item))
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: SplunkDetectionToolview_module_css_default.input,
													"aria-label": `Action field ${index + 1} value`,
													value: field.value,
													placeholder: "Value",
													onChange: (event) => setActionFields((current) => current.map((item, itemIndex) => itemIndex === index ? {
														...item,
														value: event.target.value
													} : item))
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: SplunkDetectionToolview_module_css_default.button,
													type: "button",
													onClick: () => setActionFields((current) => current.filter((_item, itemIndex) => itemIndex !== index)),
													children: "Remove"
												})
											]
										}, `${field.key}-${index}`)), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: SplunkDetectionToolview_module_css_default.button,
											type: "button",
											onClick: () => setActionFields((current) => [...current, {
												key: "",
												value: ""
											}]),
											children: "Add action field"
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: SplunkDetectionToolview_module_css_default.hint,
										children: "Use non-secret action.* fields only. Secret-like fields are rejected by the server."
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: SplunkDetectionToolview_module_css_default.managed,
										children: "The required company logevent action is managed automatically and is not editable here."
									})
								]
							})]
						}),
						reviewText(envelope.review_only_metadata) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SplunkDetectionToolview_module_css_default.managed,
							children: [
								"Review-only metadata: ",
								reviewText(envelope.review_only_metadata),
								". It is not persisted as a Splunk alert setting."
							]
						}),
						error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: `${SplunkDetectionToolview_module_css_default.message} ${SplunkDetectionToolview_module_css_default.error}`,
							role: "alert",
							children: error
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SplunkDetectionToolview_module_css_default.actions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${SplunkDetectionToolview_module_css_default.button} ${SplunkDetectionToolview_module_css_default.secondary}`,
								type: "button",
								disabled: status === "saving",
								onClick: () => setStatus("discarded"),
								children: "Cancel"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${SplunkDetectionToolview_module_css_default.button} ${SplunkDetectionToolview_module_css_default.primary}`,
								type: "button",
								disabled: status === "saving",
								onClick: () => {
									save();
								},
								children: status === "saving" ? "Saving…" : status === "failed" ? "Retry" : "Save"
							})]
						})
					]
				})]
			});
		}
		const splunkDetectionToolview = {
			name: "splunk-detection-toolview",
			inject: ["slots", "connection"],
			apply(ctx) {
				const connection = ctx.get("connection");
				for (const key of [SPLUNK_WRITE_DETECTION_TOOL_NAME, SPLUNK_UPDATE_DETECTION_TOOL_NAME]) ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
					name: "tool.call.toolview",
					key,
					inject: () => ({ connection })
				}, SplunkDetectionToolview));
			}
		};
		function installSplunkDetectionToolview(ctx) {
			ctx.plugin(splunkDetectionToolview);
		}
		//#endregion
		//#region src/attachment-constants.ts
		const MARKITDOWN_ATTACHMENTS_NAMESPACE = "soc-agent-markitdown-attachments";
		const DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS = {
			maxFiles: 5,
			maxBytesPerFile: 1e7,
			maxTotalBytes: 5e7,
			maxCharsPerFile: 2e5,
			maxTotalChars: 5e5
		};
		//#endregion
		//#region src/client/markitdownAttachments.ts
		const CHANNEL$2 = "/soc-agent-config";
		function bytesToBase64(bytes) {
			let binary = "";
			const chunk = 32768;
			for (let offset = 0; offset < bytes.length; offset += chunk) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
			return btoa(binary);
		}
		function settingsOf(scope) {
			return {
				...DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS,
				...scope.getSnapshot().value ?? {}
			};
		}
		var MarkItDownDocumentController = class {
			connection;
			settings;
			drafts = /* @__PURE__ */ new Map();
			aborts = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Set();
			version = 0;
			constructor(connection, settings) {
				this.connection = connection;
				this.settings = settings;
			}
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			getVersion = () => this.version;
			create(sessionId, files) {
				const limits = settingsOf(this.settings);
				const sessionDrafts = this.drafts.get(sessionId) ?? /* @__PURE__ */ new Map();
				if (files.length === 0) return [];
				if (sessionDrafts.size + files.length > limits.maxFiles) throw new Error(`You can attach up to ${limits.maxFiles} files per message.`);
				const totalBytes = [...sessionDrafts.values()].reduce((total, item) => total + item.file.size, 0);
				if (files.some((file) => file.size > limits.maxBytesPerFile)) throw new Error("One attachment exceeds the configured per-file size limit.");
				if (totalBytes + files.reduce((total, file) => total + file.size, 0) > limits.maxTotalBytes) throw new Error("The attachments exceed the configured total size limit.");
				const created = files.map((file) => ({
					kind: "document",
					id: crypto.randomUUID(),
					file,
					status: "queued"
				}));
				for (const document of created) sessionDrafts.set(document.id, document);
				this.drafts.set(sessionId, sessionDrafts);
				this.changed();
				return created;
			}
			list(sessionId, ids) {
				const drafts = this.drafts.get(sessionId);
				if (drafts === void 0) return [];
				return ids.flatMap((id) => {
					const document = drafts.get(id);
					return document === void 0 ? [] : [document];
				});
			}
			release(sessionId, id) {
				this.aborts.get(id)?.abort();
				this.aborts.delete(id);
				const drafts = this.drafts.get(sessionId);
				if (drafts?.delete(id)) this.changed();
				if (drafts?.size === 0) this.drafts.delete(sessionId);
			}
			async convert(sessionId, ids, signal) {
				const limits = settingsOf(this.settings);
				const result = [];
				let totalChars = 0;
				for (const id of ids) {
					if (signal.aborted) throw new Error("attachment_conversion_cancelled");
					const document = this.drafts.get(sessionId)?.get(id);
					if (document === void 0) continue;
					this.setStatus(sessionId, id, "converting");
					const localAbort = new AbortController();
					const abort = () => {
						localAbort.abort();
					};
					signal.addEventListener("abort", abort, { once: true });
					this.aborts.set(id, localAbort);
					try {
						const bytes = new Uint8Array(await document.file.arrayBuffer());
						const response = await this.connection.rpc.call(CHANNEL$2, "convert-attachment", {
							filename: document.file.name,
							content_type: document.file.type,
							data: bytesToBase64(bytes),
							limits: {
								max_bytes: limits.maxBytesPerFile,
								max_chars: limits.maxCharsPerFile
							}
						}, localAbort.signal);
						if (!response?.ok) throw new Error(response?.error?.message || "The attachment conversion failed.");
						const converted = response.value;
						const markdown = typeof converted.text === "string" ? converted.text : "";
						totalChars += markdown.length;
						if (totalChars > limits.maxTotalChars) throw new Error("The attachments exceed the configured Markdown character limit.");
						if (!this.drafts.get(sessionId)?.has(id)) continue;
						this.setStatus(sessionId, id, "converted");
						result.push({
							id,
							filename: typeof converted.filename === "string" ? converted.filename : document.file.name,
							markdown
						});
					} catch (error) {
						if (localAbort.signal.aborted || signal.aborted) {
							if (!this.drafts.get(sessionId)?.has(id)) continue;
							throw new Error("attachment_conversion_cancelled");
						}
						const message = error instanceof Error ? error.message : "The attachment conversion failed.";
						this.setStatus(sessionId, id, "failed", message);
						throw new Error(message);
					} finally {
						signal.removeEventListener("abort", abort);
						if (this.aborts.get(id) === localAbort) this.aborts.delete(id);
					}
				}
				return result;
			}
			setStatus(sessionId, id, status, error) {
				const drafts = this.drafts.get(sessionId);
				const current = drafts?.get(id);
				if (current === void 0) return;
				drafts?.set(id, {
					...current,
					status,
					...error === void 0 ? {} : { error }
				});
				this.changed();
			}
			changed() {
				this.version += 1;
				for (const listener of this.listeners) listener();
			}
		};
		//#endregion
		//#region \0dsh-css:/home/chan-kok-pan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/MarkItDownDocuments.module.css.mjs
		const css$3 = ".beBHoa_rail{flex-wrap:wrap;gap:8px;padding:10px 12px 0;display:flex}.beBHoa_item{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);min-width:0;max-width:min(100%,360px);color:var(--dsw-alias-label-primary);border-radius:8px;align-items:center;gap:7px;padding:6px 8px;font-size:13px;line-height:20px;display:inline-flex}.beBHoa_icon{flex:none;font-size:14px;line-height:1}.beBHoa_name{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.beBHoa_status{color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;font-size:12px}.beBHoa_remove{width:20px;height:20px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;border-radius:50%;flex:none;padding:0;font-size:18px;line-height:18px}.beBHoa_remove:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.beBHoa_remove:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}";
		const tagId$3 = "dsh-soc-agent-client/MarkItDownDocuments.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var MarkItDownDocuments_module_css_default = {
			"icon": "beBHoa_icon",
			"item": "beBHoa_item",
			"name": "beBHoa_name",
			"rail": "beBHoa_rail",
			"remove": "beBHoa_remove",
			"status": "beBHoa_status"
		};
		//#endregion
		//#region src/client/MarkItDownDocuments.tsx
		function statusText(document, converting) {
			if (document.status === "failed") return document.error ?? "Conversion failed";
			if (converting || document.status === "converting") return "Converting…";
			if (document.status === "converted") return "Ready";
			return "Queued";
		}
		function MarkItDownDocuments(props) {
			const { controller, sessionId } = props;
			(0, react.useSyncExternalStore)(controller.subscribe, controller.getVersion, controller.getVersion);
			const documents = controller.list(sessionId, props.documents.map((document) => document.id));
			const pickerId = `soc-agent-file-picker-${sessionId}`;
			if (documents.length === 0 && !props.canAcceptDocuments) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MarkItDownDocuments_module_css_default.rail,
				"aria-label": "Attached files",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					id: pickerId,
					type: "file",
					multiple: true,
					hidden: true,
					onChange: (event) => {
						const files = [...event.currentTarget.files ?? []];
						event.currentTarget.value = "";
						if (files.length > 0 && props.canAcceptDocuments) props.onAddDocuments(files);
					}
				}), documents.map((document) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: MarkItDownDocuments_module_css_default.item,
					title: document.error,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MarkItDownDocuments_module_css_default.icon,
							"aria-hidden": "true",
							children: "📎"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MarkItDownDocuments_module_css_default.name,
							children: document.file.name
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MarkItDownDocuments_module_css_default.status,
							children: statusText(document, props.phase === "submitting")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: MarkItDownDocuments_module_css_default.remove,
							type: "button",
							"aria-label": `Remove ${document.file.name}`,
							onClick: () => props.onRemoveDocument(document.id),
							children: "×"
						})
					]
				}, document.id))]
			});
		}
		function openMarkItDownPicker(sessionId) {
			const input = document.getElementById(`soc-agent-file-picker-${sessionId}`);
			if (input instanceof HTMLInputElement) input.click();
		}
		//#endregion
		//#region \0dsh-css:/home/chan-kok-pan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/MarkItDownAttachmentSettings.module.css.mjs
		const css$2 = ".bf4lhq_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.bf4lhq_card:hover,.bf4lhq_cardOpen{border-color:var(--dsw-alias-label-dimmed)}.bf4lhq_cardOpen{background:var(--dsw-alias-bg-layer-2)}.bf4lhq_header{width:100%;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.bf4lhq_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.bf4lhq_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.bf4lhq_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.bf4lhq_description,.bf4lhq_hint,.bf4lhq_invalid{font-size:12px;line-height:1.5}.bf4lhq_description,.bf4lhq_hint{color:var(--dsw-alias-label-tertiary)}.bf4lhq_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.bf4lhq_chevronOpen{transform:rotate(180deg)}.bf4lhq_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.bf4lhq_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.bf4lhq_field+.bf4lhq_field{border-top:1px solid var(--dsw-alias-border-l2)}.bf4lhq_fieldHead{align-items:center;gap:8px;display:flex}.bf4lhq_fieldLabel{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.bf4lhq_badges{align-items:center;gap:8px;display:inline-flex}.bf4lhq_badge{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);white-space:nowrap;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.bf4lhq_reset{color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border:0;padding:0;font-size:12px;line-height:1.5}.bf4lhq_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.bf4lhq_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);width:100%;height:34px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.bf4lhq_input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.bf4lhq_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.bf4lhq_inputInvalid{border-color:var(--dsw-alias-label-error)}.bf4lhq_hint,.bf4lhq_invalid,.bf4lhq_failed{margin:0}.bf4lhq_invalid,.bf4lhq_failed{color:var(--dsw-alias-label-error)}.bf4lhq_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.bf4lhq_failed{flex:1;min-width:0;font-size:12px;line-height:1.5}.bf4lhq_discard,.bf4lhq_save{font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.bf4lhq_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.bf4lhq_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.bf4lhq_discard:disabled,.bf4lhq_save:disabled{opacity:.4;cursor:default}.bf4lhq_discard:focus-visible,.bf4lhq_save:focus-visible,.bf4lhq_reset:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}";
		const tagId$2 = "dsh-soc-agent-client/MarkItDownAttachmentSettings.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var MarkItDownAttachmentSettings_module_css_default = {
			"badge": "bf4lhq_badge",
			"badges": "bf4lhq_badges",
			"body": "bf4lhq_body",
			"card": "bf4lhq_card",
			"cardOpen": "bf4lhq_cardOpen",
			"chevron": "bf4lhq_chevron",
			"chevronOpen": "bf4lhq_chevronOpen",
			"description": "bf4lhq_description",
			"discard": "bf4lhq_discard",
			"failed": "bf4lhq_failed",
			"field": "bf4lhq_field",
			"fieldHead": "bf4lhq_fieldHead",
			"fieldLabel": "bf4lhq_fieldLabel",
			"footer": "bf4lhq_footer",
			"headText": "bf4lhq_headText",
			"header": "bf4lhq_header",
			"hint": "bf4lhq_hint",
			"input": "bf4lhq_input",
			"inputInvalid": "bf4lhq_inputInvalid",
			"invalid": "bf4lhq_invalid",
			"name": "bf4lhq_name",
			"reset": "bf4lhq_reset",
			"save": "bf4lhq_save"
		};
		//#endregion
		//#region src/client/MarkItDownAttachmentSettings.tsx
		const FIELDS = [
			"maxFiles",
			"maxBytesPerFile",
			"maxTotalBytes",
			"maxCharsPerFile",
			"maxTotalChars"
		];
		var AttachmentSettingsController = class {
			scope;
			drafts = /* @__PURE__ */ new Map();
			cleared = /* @__PURE__ */ new Set();
			store;
			saving = false;
			failed = false;
			constructor(scope) {
				this.scope = scope;
				this.store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(this.state());
				scope.subscribe(() => this.publish());
			}
			inject() {
				return {
					hooks: { attachmentSettings: this.store },
					edit: (field, text) => {
						if (FIELDS.includes(field)) {
							this.drafts.set(field, text);
							this.cleared.delete(field);
							this.failed = false;
							this.publish();
						}
					},
					resetField: (field) => {
						this.drafts.delete(field);
						this.cleared.add(field);
						this.failed = false;
						this.publish();
					},
					save: () => {
						this.save();
					},
					discard: () => {
						this.drafts.clear();
						this.cleared.clear();
						this.failed = false;
						this.publish();
					}
				};
			}
			async save() {
				if (this.saving || !this.state().writable || this.state().invalid) return;
				this.saving = true;
				this.publish();
				try {
					for (const field of FIELDS) if (this.cleared.has(field)) await this.scope.unset(field);
					else if (this.drafts.has(field)) {
						const value = Number(this.drafts.get(field));
						if (!Number.isSafeInteger(value) || value < 1) throw new Error("invalid");
						await this.scope.set(field, value);
					}
					this.drafts.clear();
					this.cleared.clear();
					this.failed = false;
				} catch {
					this.failed = true;
				} finally {
					this.saving = false;
					this.publish();
				}
			}
			state() {
				const snapshot = this.scope.getSnapshot();
				const value = snapshot.value ?? {};
				const user = snapshot.user && typeof snapshot.user === "object" ? snapshot.user : {};
				const field = (name) => {
					const raw = value[name];
					const text = this.drafts.get(name) ?? (this.cleared.has(name) ? "" : typeof raw === "number" ? String(raw) : "");
					return {
						text,
						overridden: this.drafts.has(name) || this.cleared.has(name) || Object.prototype.hasOwnProperty.call(user, name),
						invalid: text !== "" && (!Number.isSafeInteger(Number(text)) || Number(text) < 1)
					};
				};
				const fields = Object.fromEntries(FIELDS.map((name) => [name, field(name)]));
				return {
					available: snapshot.status !== "unavailable",
					writable: snapshot.writable,
					dirty: this.drafts.size > 0 || this.cleared.size > 0,
					invalid: FIELDS.some((name) => fields[name].invalid),
					saving: this.saving,
					failed: this.failed,
					...fields
				};
			}
			publish() {
				this.store.set(this.state());
			}
		};
		function Field({ id, label, hint, state, disabled, edit, reset }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MarkItDownAttachmentSettings_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MarkItDownAttachmentSettings_module_css_default.fieldHead,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: MarkItDownAttachmentSettings_module_css_default.fieldLabel,
							htmlFor: id,
							children: label
						}), state.overridden && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: MarkItDownAttachmentSettings_module_css_default.badges,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: MarkItDownAttachmentSettings_module_css_default.badge,
								children: "Overridden"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: MarkItDownAttachmentSettings_module_css_default.reset,
								type: "button",
								disabled,
								onClick: reset,
								children: "Reset"
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: state.invalid ? `${MarkItDownAttachmentSettings_module_css_default.input} ${MarkItDownAttachmentSettings_module_css_default.inputInvalid}` : MarkItDownAttachmentSettings_module_css_default.input,
						id,
						inputMode: "numeric",
						value: state.text,
						disabled,
						"aria-invalid": state.invalid || void 0,
						onChange: (event) => edit(event.target.value)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: state.invalid ? MarkItDownAttachmentSettings_module_css_default.invalid : MarkItDownAttachmentSettings_module_css_default.hint,
						children: state.invalid ? "Enter a positive whole number." : hint
					})
				]
			});
		}
		function Chevron$1({ open }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: open ? `${MarkItDownAttachmentSettings_module_css_default.chevron} ${MarkItDownAttachmentSettings_module_css_default.chevronOpen}` : MarkItDownAttachmentSettings_module_css_default.chevron,
				width: "14",
				height: "14",
				viewBox: "0 0 14 14",
				fill: "none",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
					fill: "currentColor"
				})
			});
		}
		function MarkItDownAttachmentSettingsCard(props) {
			const state = props.useAttachmentSettings((value) => value);
			const [open, setOpen] = (0, react.useState)(false);
			if (!state.available) return null;
			const disabled = !state.writable;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: `${MarkItDownAttachmentSettings_module_css_default.card}${open ? ` ${MarkItDownAttachmentSettings_module_css_default.cardOpen}` : ""}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: MarkItDownAttachmentSettings_module_css_default.header,
					type: "button",
					"aria-expanded": open,
					"aria-label": `${open ? "Collapse" : "Expand"} settings: MarkItDown attachments`,
					onClick: () => setOpen((value) => !value),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: MarkItDownAttachmentSettings_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MarkItDownAttachmentSettings_module_css_default.name,
							children: "MarkItDown attachments"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MarkItDownAttachmentSettings_module_css_default.description,
							children: "Upload files and send their readable text to the AI."
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron$1, { open })]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: MarkItDownAttachmentSettings_module_css_default.body,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							id: "markitdown-max-files",
							label: "Maximum files per message",
							hint: "Default: 5",
							state: state.maxFiles,
							disabled,
							edit: (value) => props.edit("maxFiles", value),
							reset: () => props.resetField("maxFiles")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							id: "markitdown-max-file-bytes",
							label: "Maximum bytes per file",
							hint: "Default: 10 MB",
							state: state.maxBytesPerFile,
							disabled,
							edit: (value) => props.edit("maxBytesPerFile", value),
							reset: () => props.resetField("maxBytesPerFile")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							id: "markitdown-max-total-bytes",
							label: "Maximum total upload bytes",
							hint: "Default: 50 MB",
							state: state.maxTotalBytes,
							disabled,
							edit: (value) => props.edit("maxTotalBytes", value),
							reset: () => props.resetField("maxTotalBytes")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							id: "markitdown-max-file-chars",
							label: "Maximum Markdown characters per file",
							hint: "Default: 200,000",
							state: state.maxCharsPerFile,
							disabled,
							edit: (value) => props.edit("maxCharsPerFile", value),
							reset: () => props.resetField("maxCharsPerFile")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							id: "markitdown-max-total-chars",
							label: "Maximum total Markdown characters",
							hint: "Default: 500,000",
							state: state.maxTotalChars,
							disabled,
							edit: (value) => props.edit("maxTotalChars", value),
							reset: () => props.resetField("maxTotalChars")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: MarkItDownAttachmentSettings_module_css_default.footer,
							children: [
								state.failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: MarkItDownAttachmentSettings_module_css_default.failed,
									role: "status",
									children: "Could not save these limits."
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: MarkItDownAttachmentSettings_module_css_default.discard,
									type: "button",
									disabled: !state.dirty || state.saving,
									onClick: props.discard,
									children: "Discard"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: MarkItDownAttachmentSettings_module_css_default.save,
									type: "button",
									disabled: !state.dirty || state.invalid || state.saving,
									onClick: props.save,
									children: state.saving ? "Saving…" : "Save"
								})
							]
						})
					]
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:/home/chan-kok-pan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/SocActionApprovalSettings.module.css.mjs
		const css$1 = ".bdsB-q_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none}.bdsB-q_cardOpen{border-color:var(--dsw-alias-label-dimmed);background:var(--dsw-alias-bg-layer-2)}.bdsB-q_header{width:100%;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.bdsB-q_header:focus-visible,.bdsB-q_checkbox:focus-visible,.bdsB-q_shortcut:focus-visible,.bdsB-q_reset:focus-visible,.bdsB-q_discard:focus-visible,.bdsB-q_save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.bdsB-q_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.bdsB-q_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.bdsB-q_description,.bdsB-q_hint,.bdsB-q_status{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}.bdsB-q_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.bdsB-q_chevronOpen{transform:rotate(180deg)}.bdsB-q_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding:12px 0 8px}.bdsB-q_explanation,.bdsB-q_status,.bdsB-q_failed{margin:0 0 12px}.bdsB-q_groups{gap:14px;display:grid}.bdsB-q_group{border:0;min-width:0;margin:0;padding:0}.bdsB-q_groupTitle{color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:.04em;margin:0 0 6px;font-size:12px;font-weight:600;line-height:1.5}.bdsB-q_action{color:var(--dsw-alias-label-primary);cursor:pointer;align-items:flex-start;gap:9px;padding:5px 0;font-size:13px;line-height:1.4;display:flex}.bdsB-q_checkbox{width:16px;height:16px;accent-color:var(--dsw-alias-brand-primary);flex:none;margin:1px 0 0}.bdsB-q_actionText{flex-direction:column;min-width:0;display:flex}.bdsB-q_actionName{font-weight:500}.bdsB-q_actionTool{overflow-wrap:anywhere;color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);font-size:11px}.bdsB-q_shortcuts{border-top:1px solid var(--dsw-alias-border-l2);flex-wrap:wrap;gap:8px;margin-top:16px;padding-top:12px;display:flex}.bdsB-q_shortcut,.bdsB-q_reset,.bdsB-q_discard,.bdsB-q_save{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border-radius:8px;padding:5px 12px;font-size:12px;line-height:1.5}.bdsB-q_shortcut:hover:not(:disabled),.bdsB-q_reset:hover:not(:disabled),.bdsB-q_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.bdsB-q_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;margin-top:12px;padding-top:12px;display:flex}.bdsB-q_failed{min-width:0;color:var(--dsw-alias-label-error);flex:1;font-size:12px;line-height:1.5}.bdsB-q_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:#0000}.bdsB-q_shortcut:disabled,.bdsB-q_reset:disabled,.bdsB-q_discard:disabled,.bdsB-q_save:disabled{opacity:.4;cursor:default}";
		const tagId$1 = "dsh-soc-agent-client/SocActionApprovalSettings.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var SocActionApprovalSettings_module_css_default = {
			"action": "bdsB-q_action",
			"actionName": "bdsB-q_actionName",
			"actionText": "bdsB-q_actionText",
			"actionTool": "bdsB-q_actionTool",
			"body": "bdsB-q_body",
			"card": "bdsB-q_card",
			"cardOpen": "bdsB-q_cardOpen",
			"checkbox": "bdsB-q_checkbox",
			"chevron": "bdsB-q_chevron",
			"chevronOpen": "bdsB-q_chevronOpen",
			"description": "bdsB-q_description",
			"discard": "bdsB-q_discard",
			"explanation": "bdsB-q_explanation",
			"failed": "bdsB-q_failed",
			"footer": "bdsB-q_footer",
			"group": "bdsB-q_group",
			"groupTitle": "bdsB-q_groupTitle",
			"groups": "bdsB-q_groups",
			"headText": "bdsB-q_headText",
			"header": "bdsB-q_header",
			"hint": "bdsB-q_hint",
			"name": "bdsB-q_name",
			"reset": "bdsB-q_reset",
			"save": "bdsB-q_save",
			"shortcut": "bdsB-q_shortcut",
			"shortcuts": "bdsB-q_shortcuts",
			"status": "bdsB-q_status"
		};
		//#endregion
		//#region src/client/SocActionApprovalSettings.tsx
		const CHANNEL$1 = "/soc-agent-config";
		function validCatalog(value) {
			if (!Array.isArray(value)) return [];
			const seen = /* @__PURE__ */ new Set();
			return value.flatMap((item) => {
				if (!item || typeof item !== "object") return [];
				const candidate = item;
				if (typeof candidate.name !== "string" || typeof candidate.group !== "string" || typeof candidate.label !== "string") return [];
				if (candidate.name.length === 0 || seen.has(candidate.name)) return [];
				seen.add(candidate.name);
				return [{
					name: candidate.name,
					group: candidate.group,
					label: candidate.label
				}];
			});
		}
		function namesOf(value) {
			return new Set(Array.isArray(value) ? value.filter((name) => typeof name === "string") : []);
		}
		var SocActionApprovalController = class {
			connection;
			scope;
			actions = [];
			catalogLoaded = false;
			catalogFailed = false;
			draft;
			resetOnSave = false;
			saving = false;
			failed = false;
			store;
			constructor(connection, scope) {
				this.connection = connection;
				this.scope = scope;
				this.store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(this.state());
				scope.subscribe(() => this.publish());
				this.loadCatalog();
			}
			inject() {
				return {
					hooks: { socActionApproval: this.store },
					toggle: (name, ask) => this.toggle(name, ask),
					requireApprovalForAll: () => this.stage(/* @__PURE__ */ new Set(), true),
					allowAllKnownActions: () => this.stage(new Set(this.actions.map((action) => action.name)), false),
					reset: () => this.stage(/* @__PURE__ */ new Set(), true),
					save: () => {
						this.save();
					},
					discard: () => {
						this.draft = void 0;
						this.resetOnSave = false;
						this.failed = false;
						this.publish();
					}
				};
			}
			async loadCatalog() {
				try {
					const response = await this.connection.rpc.call(CHANNEL$1, "get-action-catalog", {});
					if (!response?.ok) throw new Error("catalog");
					const actions = validCatalog(response.value?.actions);
					if (actions.length === 0) throw new Error("catalog");
					this.actions = actions;
					this.catalogLoaded = true;
				} catch {
					this.catalogFailed = true;
				}
				this.publish();
			}
			toggle(name, ask) {
				if (!this.actions.some((action) => action.name === name)) return;
				const next = this.draft === void 0 ? namesOf(this.scope.getSnapshot().value?.autoApproveActions) : new Set(this.draft);
				if (ask) next.delete(name);
				else next.add(name);
				this.stage(next, false);
			}
			stage(actions, resetOnSave) {
				this.draft = actions;
				this.resetOnSave = resetOnSave;
				this.failed = false;
				this.publish();
			}
			async save() {
				const state = this.state();
				if (this.saving || !state.writable || !state.dirty || state.invalid) return;
				this.saving = true;
				this.publish();
				try {
					if (this.resetOnSave) await this.scope.unset("autoApproveActions");
					else await this.scope.set("autoApproveActions", [...this.draft ?? /* @__PURE__ */ new Set()]);
					this.draft = void 0;
					this.resetOnSave = false;
					this.failed = false;
				} catch {
					this.failed = true;
				} finally {
					this.saving = false;
					this.publish();
				}
			}
			state() {
				const snapshot = this.scope.getSnapshot();
				const saved = namesOf(snapshot.value?.autoApproveActions);
				const autoApproveActions = this.draft === void 0 ? saved : this.draft;
				return {
					available: snapshot.status !== "unavailable",
					writable: snapshot.writable,
					dirty: this.draft !== void 0,
					invalid: this.catalogFailed,
					saving: this.saving,
					failed: this.failed,
					catalogLoaded: this.catalogLoaded,
					catalogFailed: this.catalogFailed,
					actions: this.actions,
					autoApproveActions: [...autoApproveActions]
				};
			}
			publish() {
				this.store.set(this.state());
			}
		};
		function Chevron({ open }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: open ? `${SocActionApprovalSettings_module_css_default.chevron} ${SocActionApprovalSettings_module_css_default.chevronOpen}` : SocActionApprovalSettings_module_css_default.chevron,
				width: "14",
				height: "14",
				viewBox: "0 0 14 14",
				fill: "none",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
					fill: "currentColor"
				})
			});
		}
		function SocActionApprovalSettingsCard(props) {
			const state = props.useSocActionApproval((value) => value);
			const [open, setOpen] = (0, react.useState)(false);
			if (!state.available) return null;
			const disabled = !state.writable || state.saving || !state.catalogLoaded;
			const auto = new Set(state.autoApproveActions);
			const groups = [...new Set(state.actions.map((action) => action.group))];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: open ? `${SocActionApprovalSettings_module_css_default.card} ${SocActionApprovalSettings_module_css_default.cardOpen}` : SocActionApprovalSettings_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: SocActionApprovalSettings_module_css_default.header,
					type: "button",
					"aria-expanded": open,
					"aria-label": `${open ? "Collapse" : "Expand"} settings: SOC action approvals`,
					onClick: () => setOpen((value) => !value),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: SocActionApprovalSettings_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SocActionApprovalSettings_module_css_default.name,
							children: "SOC action approvals"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SocActionApprovalSettings_module_css_default.description,
							children: "Choose which SOC actions must ask before they run."
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron, { open })]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: SocActionApprovalSettings_module_css_default.body,
					children: [
						!state.writable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: SocActionApprovalSettings_module_css_default.status,
							role: "status",
							children: "This deployment stores settings read-only."
						}),
						state.catalogFailed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: SocActionApprovalSettings_module_css_default.failed,
							role: "status",
							children: "Could not load the SOC action catalog."
						}),
						!state.catalogLoaded && !state.catalogFailed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: SocActionApprovalSettings_module_css_default.status,
							role: "status",
							children: "Loading actions…"
						}),
						state.catalogLoaded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: SocActionApprovalSettings_module_css_default.explanation,
								children: "Checked actions ask for approval. Unchecked actions run automatically, while all server-side safety checks still apply."
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: SocActionApprovalSettings_module_css_default.groups,
								children: groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
									className: SocActionApprovalSettings_module_css_default.group,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", {
										className: SocActionApprovalSettings_module_css_default.groupTitle,
										children: group
									}), state.actions.filter((action) => action.group === group).map((action) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: SocActionApprovalSettings_module_css_default.action,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: SocActionApprovalSettings_module_css_default.checkbox,
											type: "checkbox",
											checked: !auto.has(action.name),
											disabled,
											onChange: (event) => props.toggle(action.name, event.currentTarget.checked)
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: SocActionApprovalSettings_module_css_default.actionText,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: SocActionApprovalSettings_module_css_default.actionName,
												children: action.label
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: SocActionApprovalSettings_module_css_default.actionTool,
												children: action.name
											})]
										})]
									}, action.name))]
								}, group))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SocActionApprovalSettings_module_css_default.shortcuts,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: SocActionApprovalSettings_module_css_default.shortcut,
										type: "button",
										disabled,
										onClick: props.requireApprovalForAll,
										children: "Require approval for all"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: SocActionApprovalSettings_module_css_default.shortcut,
										type: "button",
										disabled,
										onClick: props.allowAllKnownActions,
										children: "Allow all known actions"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: SocActionApprovalSettings_module_css_default.reset,
										type: "button",
										disabled,
										onClick: props.reset,
										children: "Reset to default"
									})
								]
							})
						] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SocActionApprovalSettings_module_css_default.footer,
							children: [
								state.failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: SocActionApprovalSettings_module_css_default.failed,
									role: "status",
									children: "Could not save these approval settings."
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: SocActionApprovalSettings_module_css_default.discard,
									type: "button",
									disabled: !state.dirty || state.saving,
									onClick: props.discard,
									children: "Discard"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: SocActionApprovalSettings_module_css_default.save,
									type: "button",
									disabled: !state.dirty || state.invalid || state.saving || !state.catalogLoaded,
									onClick: props.save,
									children: state.saving ? "Saving…" : "Save"
								})
							]
						})
					]
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:/home/chan-kok-pan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/SocActionPolicyMenu.module.css.mjs
		const css = "._KDdBa_root{align-items:center;display:inline-flex;position:relative}._KDdBa_trigger{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:30px;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;border-radius:8px;align-items:center;gap:6px;padding:0 10px;font-size:12px;display:inline-flex}._KDdBa_trigger:hover,._KDdBa_trigger[aria-expanded=true]{border-color:var(--dsw-alias-label-dimmed);color:var(--dsw-alias-label-primary)}._KDdBa_trigger:focus-visible,._KDdBa_modeRadio:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}._KDdBa_icon{font-size:15px;line-height:1}._KDdBa_panel{z-index:20;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:min(380px,100vw - 24px);max-height:min(70vh,560px);box-shadow:var(--dsw-shadow-lv2);border-radius:12px;padding:14px;position:absolute;bottom:calc(100% + 8px);right:0;overflow-y:auto}._KDdBa_error,._KDdBa_status{color:var(--dsw-alias-label-tertiary);margin:5px 0 0;font-size:11px;line-height:1.5}._KDdBa_error{color:var(--dsw-alias-label-error)}._KDdBa_modes{border:0;gap:7px;margin-top:12px;padding:0;display:grid}._KDdBa_modeLegend{color:var(--dsw-alias-label-secondary);margin:0 0 4px;font-size:11px;font-weight:600}._KDdBa_mode{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;align-items:center;gap:8px;padding:8px 9px;font-size:12px;line-height:1.4;display:flex}._KDdBa_mode:hover{border-color:var(--dsw-alias-label-dimmed)}._KDdBa_modeRadio{width:15px;height:15px;accent-color:var(--dsw-alias-brand-primary);flex:none;margin:0}._KDdBa_modeText{gap:2px;display:grid}._KDdBa_modeLabel{color:var(--dsw-alias-label-primary);font-weight:600}._KDdBa_modeDescription{color:var(--dsw-alias-label-tertiary);font-size:11px}";
		const tagId = "dsh-soc-agent-client/SocActionPolicyMenu.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SocActionPolicyMenu_module_css_default = {
			"error": "_KDdBa_error",
			"icon": "_KDdBa_icon",
			"mode": "_KDdBa_mode",
			"modeDescription": "_KDdBa_modeDescription",
			"modeLabel": "_KDdBa_modeLabel",
			"modeLegend": "_KDdBa_modeLegend",
			"modeRadio": "_KDdBa_modeRadio",
			"modeText": "_KDdBa_modeText",
			"modes": "_KDdBa_modes",
			"panel": "_KDdBa_panel",
			"root": "_KDdBa_root",
			"status": "_KDdBa_status",
			"trigger": "_KDdBa_trigger"
		};
		//#endregion
		//#region src/client/SocActionPolicyMenu.tsx
		const CHANNEL = "/soc-agent-config";
		function parsePolicy(value) {
			if (!value || typeof value !== "object") return void 0;
			const candidate = value;
			const actions = validCatalog(candidate.actions);
			const autoApproveActions = Array.isArray(candidate.autoApproveActions) ? candidate.autoApproveActions.filter((name) => typeof name === "string" && actions.some((action) => action.name === name)) : [];
			const source = candidate.source === "session" ? "session" : "defaults";
			return actions.length === 0 ? void 0 : {
				actions,
				autoApproveActions,
				source
			};
		}
		function modeOf(policy) {
			if (policy.source === "defaults") return "soc";
			return policy.autoApproveActions.length === 0 ? "ask" : "soc";
		}
		function SocActionPolicyMenu({ connection, sessionId }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [policy, setPolicy] = (0, react.useState)();
			const [draftMode, setDraftMode] = (0, react.useState)();
			const [loading, setLoading] = (0, react.useState)(false);
			const [saving, setSaving] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			(0, react.useEffect)(() => {
				let live = true;
				setLoading(true);
				setError(void 0);
				connection.rpc.call(CHANNEL, "get-action-policy", { session_id: String(sessionId) }).then((response) => {
					if (!live) return;
					if (!response?.ok) throw new Error(response?.error?.message || "The session action policy is unavailable.");
					const next = parsePolicy(response.value);
					if (next === void 0) throw new Error("The session action policy is unavailable.");
					setPolicy(next);
					setDraftMode(modeOf(next));
				}).catch((reason) => {
					if (live) setError(reason instanceof Error ? reason.message : "The session action policy is unavailable.");
				}).finally(() => {
					if (live) setLoading(false);
				});
				return () => {
					live = false;
				};
			}, [connection, sessionId]);
			const currentMode = policy === void 0 ? void 0 : modeOf(policy);
			const selectedMode = draftMode ?? currentMode;
			const selectMode = async (mode) => {
				if (policy === void 0 || saving) return;
				if (mode === currentMode && !(mode === "soc" && policy.source === "session")) {
					setOpen(false);
					return;
				}
				setDraftMode(mode);
				setSaving(true);
				setError(void 0);
				try {
					const response = mode === "soc" ? await connection.rpc.call(CHANNEL, "reset-session-action-policy", { session_id: String(sessionId) }) : await connection.rpc.call(CHANNEL, "set-session-action-policy", {
						session_id: String(sessionId),
						auto_approve_actions: []
					});
					if (!response?.ok) throw new Error(response?.error?.message || "The session action policy could not be saved.");
					const next = parsePolicy(response.value);
					if (next === void 0) throw new Error("The session action policy could not be saved.");
					setPolicy(next);
					setDraftMode(modeOf(next));
					setOpen(false);
				} catch (reason) {
					setError(reason instanceof Error ? reason.message : "The session action policy could not be saved.");
				} finally {
					setSaving(false);
				}
			};
			const modeLabel = selectedMode === "ask" ? "Ask for approval" : "SOC mode";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SocActionPolicyMenu_module_css_default.root,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: SocActionPolicyMenu_module_css_default.trigger,
					type: "button",
					"aria-expanded": open,
					"aria-controls": `soc-action-policy-${String(sessionId)}`,
					onClick: () => setOpen((value) => !value),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SocActionPolicyMenu_module_css_default.icon,
						"aria-hidden": "true",
						children: "✓"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: modeLabel })]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: SocActionPolicyMenu_module_css_default.panel,
					id: `soc-action-policy-${String(sessionId)}`,
					role: "dialog",
					"aria-label": "SOC action modes",
					children: [
						loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: SocActionPolicyMenu_module_css_default.status,
							children: "Loading actions…"
						}),
						error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: SocActionPolicyMenu_module_css_default.error,
							role: "status",
							children: error
						}),
						policy !== void 0 && !loading && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
							className: SocActionPolicyMenu_module_css_default.modes,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", {
									className: SocActionPolicyMenu_module_css_default.modeLegend,
									children: "Choose a mode"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: SocActionPolicyMenu_module_css_default.mode,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: SocActionPolicyMenu_module_css_default.modeRadio,
										type: "radio",
										name: `soc-action-mode-${String(sessionId)}`,
										checked: selectedMode === "ask",
										readOnly: true,
										disabled: saving,
										onClick: () => {
											selectMode("ask");
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: SocActionPolicyMenu_module_css_default.modeText,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SocActionPolicyMenu_module_css_default.modeLabel,
											children: "Ask for approval"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SocActionPolicyMenu_module_css_default.modeDescription,
											children: "Ask before every known SOC action."
										})]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: SocActionPolicyMenu_module_css_default.mode,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: SocActionPolicyMenu_module_css_default.modeRadio,
										type: "radio",
										name: `soc-action-mode-${String(sessionId)}`,
										checked: selectedMode === "soc",
										readOnly: true,
										disabled: saving,
										onClick: () => {
											selectMode("soc");
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: SocActionPolicyMenu_module_css_default.modeText,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SocActionPolicyMenu_module_css_default.modeLabel,
											children: "SOC mode"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SocActionPolicyMenu_module_css_default.modeDescription,
											children: "Use the approval checklist from Settings → Plugins."
										})]
									})]
								})
							]
						})
					]
				})]
			});
		}
		//#endregion
		//#region ../../vendor/deepseek-harness/vendor/cosmokit/lib/index.js
		/** Return true when a value is `null` or `undefined`. */
		function isNullable(value) {
			return value === null || value === void 0;
		}
		/** Return true for non-array object values. */
		function isPlainObject(data) {
			return data && typeof data === "object" && !Array.isArray(data);
		}
		/** Filter object entries and return a new object. */
		function filterKeys(object, filter) {
			return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
		}
		/** Map object values while preserving the original key set. */
		function mapValues(object, transform) {
			return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
		}
		/** Pick selected keys from an object, optionally including `undefined` values. */
		function pick(source, keys, forced) {
			if (!keys) return { ...source };
			const result = {};
			for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
			return result;
		}
		/** Test values using `instanceof` with a `toStringTag` fallback. */
		function is(type, value) {
			if (arguments.length === 1) return (value) => is(type, value);
			return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
		}
		function isArrayBufferLike(value) {
			return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
		}
		function isArrayBufferSource(value) {
			return isArrayBufferLike(value) || ArrayBuffer.isView(value);
		}
		/** Binary source detection and base64/hex conversion helpers. */
		var Binary;
		(function(Binary) {
			Binary.is = isArrayBufferLike;
			Binary.isSource = isArrayBufferSource;
			function fromSource(source) {
				if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
				else return source;
			}
			Binary.fromSource = fromSource;
			function toBase64(source) {
				source = fromSource(source);
				if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
				let binary = "";
				const bytes = new Uint8Array(source);
				for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
				return btoa(binary);
			}
			Binary.toBase64 = toBase64;
			function fromBase64(source) {
				if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
				return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
			}
			Binary.fromBase64 = fromBase64;
			function toHex(source) {
				source = fromSource(source);
				if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
				return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
			}
			Binary.toHex = toHex;
			function fromHex(source) {
				if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
				const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
				const buffer = [];
				for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
				return Uint8Array.from(buffer).buffer;
			}
			Binary.fromHex = fromHex;
		})(Binary || (Binary = {}));
		Binary.fromBase64;
		Binary.toBase64;
		Binary.fromHex;
		Binary.toHex;
		/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
		function clone(source, refs = /* @__PURE__ */ new Map()) {
			if (!source || typeof source !== "object") return source;
			if (is("Date", source)) return new Date(source.valueOf());
			if (is("RegExp", source)) return new RegExp(source.source, source.flags);
			if (isArrayBufferLike(source)) return source.slice(0);
			if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
			const cached = refs.get(source);
			if (cached) return cached;
			if (Array.isArray(source)) {
				const result = [];
				refs.set(source, result);
				source.forEach((value, index) => {
					result[index] = Reflect.apply(clone, null, [value, refs]);
				});
				return result;
			}
			const result = Object.create(Object.getPrototypeOf(source));
			refs.set(source, result);
			for (const key of Reflect.ownKeys(source)) {
				const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
				if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
				Reflect.defineProperty(result, key, descriptor);
			}
			return result;
		}
		/** Deeply compare arrays, dates, regexps, buffers, and plain object fields. */
		function deepEqual(a, b, strict) {
			if (a === b) return true;
			if (!strict && isNullable(a) && isNullable(b)) return true;
			if (typeof a !== typeof b) return false;
			if (typeof a !== "object") return false;
			if (!a || !b) return false;
			function check(test, then) {
				return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
			}
			return check(Array.isArray, (a, b) => a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
				if (a.byteLength !== b.byteLength) return false;
				const viewA = new Uint8Array(a);
				const viewB = new Uint8Array(b);
				for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
				return true;
			}) ?? Object.keys({
				...a,
				...b
			}).every((key) => deepEqual(a[key], b[key], strict));
		}
		/** Time constants plus parsing and formatting helpers. */
		var Time;
		(function(Time) {
			Time.millisecond = 1;
			Time.second = 1e3;
			Time.minute = Time.second * 60;
			Time.hour = Time.minute * 60;
			Time.day = Time.hour * 24;
			Time.week = Time.day * 7;
			let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
			function setTimezoneOffset(offset) {
				timezoneOffset = offset;
			}
			Time.setTimezoneOffset = setTimezoneOffset;
			function getTimezoneOffset() {
				return timezoneOffset;
			}
			Time.getTimezoneOffset = getTimezoneOffset;
			function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
				if (typeof date === "number") date = new Date(date);
				if (offset === void 0) offset = timezoneOffset;
				return Math.floor((date.valueOf() / Time.minute - offset) / 1440);
			}
			Time.getDateNumber = getDateNumber;
			function fromDateNumber(value, offset) {
				const date = new Date(value * Time.day);
				if (offset === void 0) offset = timezoneOffset;
				return new Date(+date + offset * Time.minute);
			}
			Time.fromDateNumber = fromDateNumber;
			const numeric = /\d+(?:\.\d+)?/.source;
			const timeRegExp = new RegExp(`^${[
				"w(?:eek(?:s)?)?",
				"d(?:ay(?:s)?)?",
				"h(?:our(?:s)?)?",
				"m(?:in(?:ute)?(?:s)?)?",
				"s(?:ec(?:ond)?(?:s)?)?"
			].map((unit) => `(${numeric}${unit})?`).join("")}$`);
			function parseTime(source) {
				const capture = timeRegExp.exec(source);
				if (!capture) return 0;
				return (parseFloat(capture[1]) * Time.week || 0) + (parseFloat(capture[2]) * Time.day || 0) + (parseFloat(capture[3]) * Time.hour || 0) + (parseFloat(capture[4]) * Time.minute || 0) + (parseFloat(capture[5]) * Time.second || 0);
			}
			Time.parseTime = parseTime;
			function parseDate(date) {
				const parsed = parseTime(date);
				if (parsed) date = Date.now() + parsed;
				else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
				else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
				return date ? new Date(date) : /* @__PURE__ */ new Date();
			}
			Time.parseDate = parseDate;
			function format(ms) {
				const abs = Math.abs(ms);
				if (abs >= Time.day - Time.hour / 2) return Math.round(ms / Time.day) + "d";
				else if (abs >= Time.hour - Time.minute / 2) return Math.round(ms / Time.hour) + "h";
				else if (abs >= Time.minute - Time.second / 2) return Math.round(ms / Time.minute) + "m";
				else if (abs >= Time.second) return Math.round(ms / Time.second) + "s";
				return ms + "ms";
			}
			Time.format = format;
			function toDigits(source, length = 2) {
				return source.toString().padStart(length, "0");
			}
			Time.toDigits = toDigits;
			function template(template, time = /* @__PURE__ */ new Date()) {
				return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
			}
			Time.template = template;
		})(Time || (Time = {}));
		//#endregion
		//#region ../../vendor/deepseek-harness/vendor/schemastery/lib/index.mjs
		const kSchema = Symbol.for("schemastery");
		const kValidationError = Symbol.for("ValidationError");
		globalThis.__schemastery_index__ ??= 0;
		globalThis.__schemastery_refs__ = void 0;
		var ValidationError = class extends TypeError {
			options;
			name = "ValidationError";
			constructor(message, options) {
				let prefix = "$";
				for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
				else if (typeof segment === "number") prefix += "[" + segment + "]";
				else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
				if (prefix.startsWith(".")) prefix = prefix.slice(1);
				super((prefix === "$" ? "" : `${prefix} `) + message);
				this.options = options;
			}
			static is(error) {
				return !!error?.[kValidationError];
			}
		};
		Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
		const Schema = function(options) {
			const schema = function(data, options = {}) {
				return Schema.resolve(data, schema, options)[0];
			};
			if (options.refs) {
				const refs = mapValues(options.refs, (options) => new Schema(options));
				const getRef = (uid) => refs[uid];
				for (const key in refs) {
					const options = refs[key];
					options.sKey = getRef(options.sKey);
					options.inner = getRef(options.inner);
					options.list = options.list && options.list.map(getRef);
					options.dict = options.dict && mapValues(options.dict, getRef);
				}
				return refs[options.uid];
			}
			Object.assign(schema, options);
			if (typeof schema.callback === "string") try {
				schema.callback = new Function("return " + schema.callback)();
			} catch {}
			Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
			Object.setPrototypeOf(schema, Schema.prototype);
			schema.meta ||= {};
			schema.toString = schema.toString.bind(schema);
			return schema;
		};
		Schema.prototype = Object.create(Function.prototype);
		Schema.prototype[kSchema] = true;
		Object.defineProperty(Schema.prototype, "~standard", { get() {
			return {
				version: 1,
				vendor: "schemastery",
				validate: (value) => {
					try {
						return { value: Schema.resolve(value, this, {})[0] };
					} catch (error) {
						if (ValidationError.is(error)) return { issues: [{
							message: error.message,
							path: error.options.path
						}] };
						throw error;
					}
				}
			};
		} });
		Schema.ValidationError = ValidationError;
		Schema.prototype.toJSON = function toJSON() {
			if (globalThis.__schemastery_refs__) {
				globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
				return this.uid;
			}
			globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
			globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
			const result = {
				uid: this.uid,
				refs: globalThis.__schemastery_refs__
			};
			globalThis.__schemastery_refs__ = void 0;
			return result;
		};
		Schema.prototype.set = function set(key, value) {
			this.dict[key] = value;
			return this;
		};
		Schema.prototype.push = function push(value) {
			this.list.push(value);
			return this;
		};
		function mergeDesc(original, messages) {
			const result = typeof original === "string" ? { "": original } : { ...original };
			for (const locale in messages) {
				const value = messages[locale];
				if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
				else if (typeof value === "string") result[locale] = value;
			}
			return result;
		}
		function getInner(value) {
			return value?.$value ?? value?.$inner;
		}
		function extractKeys(data) {
			return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
		}
		Schema.prototype.i18n = function i18n(messages) {
			const schema = Schema(this);
			const desc = mergeDesc(schema.meta.description, messages);
			if (Object.keys(desc).length) schema.meta.description = desc;
			if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
				return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
			});
			if (schema.list) schema.list = schema.list.map((inner, index) => {
				return inner.i18n(mapValues(messages, (data = {}) => {
					if (Array.isArray(getInner(data))) return getInner(data)[index];
					if (Array.isArray(data)) return data[index];
					return extractKeys(data);
				}));
			});
			if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
				if (getInner(data)) return getInner(data);
				return extractKeys(data);
			}));
			if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
			return schema;
		};
		Schema.prototype.extra = function extra(key, value) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		};
		for (const key of [
			"required",
			"disabled",
			"collapse",
			"hidden",
			"loose"
		]) Object.assign(Schema.prototype, { [key](value = true) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		} });
		Schema.prototype.deprecated = function deprecated() {
			const schema = Schema(this);
			schema.meta.badges ||= [];
			schema.meta.badges.push({
				text: "deprecated",
				type: "danger"
			});
			return schema;
		};
		Schema.prototype.experimental = function experimental() {
			const schema = Schema(this);
			schema.meta.badges ||= [];
			schema.meta.badges.push({
				text: "experimental",
				type: "warning"
			});
			return schema;
		};
		Schema.prototype.pattern = function pattern(regexp) {
			const schema = Schema(this);
			const pattern = pick(regexp, ["source", "flags"]);
			schema.meta = {
				...schema.meta,
				pattern
			};
			return schema;
		};
		Schema.prototype.simplify = function simplify(value) {
			if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
			if (isNullable(value)) return value;
			if (this.type === "object" || this.type === "dict") {
				const result = {};
				for (const key in value) {
					const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
					if (this.type === "dict" || !isNullable(item)) result[key] = item;
				}
				if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
				return result;
			} else if (this.type === "array" || this.type === "tuple") {
				const result = [];
				value.forEach((value, index) => {
					const schema = this.type === "array" ? this.inner : this.list[index];
					const item = schema ? schema.simplify(value) : value;
					result.push(item);
				});
				return result;
			} else if (this.type === "intersect") {
				const result = {};
				for (const item of this.list) Object.assign(result, item.simplify(value));
				return result;
			} else if (this.type === "union") for (const schema of this.list) try {
				Schema.resolve(value, schema, {});
				return schema.simplify(value);
			} catch {}
			return value;
		};
		Schema.prototype.toString = function toString(inline) {
			return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
		};
		Schema.prototype.role = function role(role, extra) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				role,
				extra
			};
			return schema;
		};
		for (const key of [
			"default",
			"link",
			"comment",
			"description",
			"max",
			"min",
			"step"
		]) Object.assign(Schema.prototype, { [key](value) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		} });
		const resolvers = {};
		Schema.extend = function extend(type, resolve) {
			resolvers[type] = resolve;
		};
		Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
			if (!schema) return [data];
			if (options.ignore?.(data, schema)) return [data];
			if (isNullable(data) && schema.type !== "lazy") {
				if (schema.meta.required) throw new ValidationError(`missing required value`, options);
				let current = schema;
				let fallback = schema.meta.default;
				while (current?.type === "intersect" && isNullable(fallback)) {
					current = current.list[0];
					fallback = current?.meta.default;
				}
				if (isNullable(fallback)) return [data];
				data = clone(fallback);
			}
			const callback = resolvers[schema.type];
			if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
			try {
				return callback(data, schema, options, strict);
			} catch (error) {
				if (!schema.meta.loose) throw error;
				return [schema.meta.default];
			}
		};
		Schema.from = function from(source) {
			if (isNullable(source)) return Schema.any();
			else if ([
				"string",
				"number",
				"boolean"
			].includes(typeof source)) return Schema.const(source).required();
			else if (source[kSchema]) return source;
			else if (typeof source === "function") switch (source) {
				case String: return Schema.string().required();
				case Number: return Schema.number().required();
				case Boolean: return Schema.boolean().required();
				case Function: return Schema.function().required();
				default: return Schema.is(source).required();
			}
			else throw new TypeError(`cannot infer schema from ${source}`);
		};
		Schema.lazy = function lazy(builder) {
			const toJSON = () => {
				if (!schema.inner[kSchema]) {
					schema.inner = schema.builder();
					schema.inner.meta = {
						...schema.meta,
						...schema.inner.meta
					};
				}
				return schema.inner.toJSON();
			};
			const schema = new Schema({
				type: "lazy",
				builder,
				inner: { toJSON }
			});
			return schema;
		};
		Schema.natural = function natural() {
			return Schema.number().step(1).min(0);
		};
		Schema.percent = function percent() {
			return Schema.number().step(.01).min(0).max(1).role("slider");
		};
		Schema.date = function date() {
			return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
				const date = new Date(value);
				if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
				return date;
			}, true)]);
		};
		Schema.regExp = function regExp(flag = "") {
			return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
				try {
					return new RegExp(value, flag);
				} catch (e) {
					throw new ValidationError(e.message, options);
				}
			}, true)]);
		};
		Schema.arrayBuffer = function arrayBuffer(encoding) {
			return Schema.union([
				Schema.is(ArrayBuffer),
				Schema.is(SharedArrayBuffer),
				Schema.transform(Schema.any(), (value, options) => {
					if (Binary.isSource(value)) return Binary.fromSource(value);
					throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
				}, true),
				...encoding ? [Schema.transform(Schema.string(), (value, options) => {
					try {
						return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
					} catch (e) {
						throw new ValidationError(e.message, options);
					}
				}, true)] : []
			]);
		};
		Schema.extend("lazy", (data, schema, options, strict) => {
			if (!schema.inner[kSchema]) {
				schema.inner = schema.builder();
				schema.inner.meta = {
					...schema.meta,
					...schema.inner.meta
				};
			}
			return Schema.resolve(data, schema.inner, options, strict);
		});
		Schema.extend("any", (data) => {
			return [data];
		});
		Schema.extend("never", (data, _, options) => {
			throw new ValidationError(`expected nullable but got ${data}`, options);
		});
		Schema.extend("const", (data, { value }, options) => {
			if (deepEqual(data, value)) return [value];
			throw new ValidationError(`expected ${value} but got ${data}`, options);
		});
		function checkWithinRange(data, meta, description, options, skipMin = false) {
			const { max = Infinity, min = -Infinity } = meta;
			if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
			if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
		}
		Schema.extend("string", (data, { meta }, options) => {
			if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
			if (meta.pattern) {
				const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
				if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
			}
			checkWithinRange(data.length, meta, "string length", options);
			return [data];
		});
		function decimalShift(data, digits) {
			const str = data.toString();
			if (str.includes("e")) return data * Math.pow(10, digits);
			const index = str.indexOf(".");
			if (index === -1) return data * Math.pow(10, digits);
			const frac = str.slice(index + 1);
			const integer = str.slice(0, index);
			if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
			return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
		}
		function isMultipleOf(data, min, step) {
			step = Math.abs(step);
			if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
			const index = step.toString().indexOf(".");
			const digits = step.toString().slice(index + 1).length;
			return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
		}
		Schema.extend("number", (data, { meta }, options) => {
			if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
			checkWithinRange(data, meta, "number", options);
			const { step } = meta;
			if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
			return [data];
		});
		Schema.extend("boolean", (data, _, options) => {
			if (typeof data === "boolean") return [data];
			throw new ValidationError(`expected boolean but got ${data}`, options);
		});
		Schema.extend("bitset", (data, { bits, meta }, options) => {
			let value = 0, keys = [];
			if (typeof data === "number") {
				value = data;
				for (const key in bits) if (data & bits[key]) keys.push(key);
			} else if (Array.isArray(data)) {
				keys = data;
				for (const key of keys) {
					if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
					if (key in bits) value |= bits[key];
				}
			} else throw new ValidationError(`expected number or array but got ${data}`, options);
			if (value === meta.default) return [value];
			return [value, keys];
		});
		Schema.extend("function", (data, _, options) => {
			if (typeof data === "function") return [data];
			throw new ValidationError(`expected function but got ${data}`, options);
		});
		Schema.extend("is", (data, { constructor }, options) => {
			if (typeof constructor === "function") {
				if (data instanceof constructor) return [data];
				throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
			} else {
				if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
				let prototype = Object.getPrototypeOf(data);
				while (prototype) {
					if (prototype.constructor?.name === constructor) return [data];
					prototype = Object.getPrototypeOf(prototype);
				}
				throw new ValidationError(`expected ${constructor} but got ${data}`, options);
			}
		});
		function property(data, key, schema, options) {
			try {
				const [value, adapted] = Schema.resolve(data[key], schema, {
					...options,
					path: [...options.path || [], key]
				});
				if (adapted !== void 0) data[key] = adapted;
				return value;
			} catch (e) {
				if (!options?.autofix) throw e;
				delete data[key];
				return schema.meta.default;
			}
		}
		Schema.extend("array", (data, { inner, meta }, options) => {
			if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
			checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
			return [data.map((_, index) => property(data, index, inner, options))];
		});
		Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
			if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
			const result = {};
			for (const key in data) {
				let rKey;
				try {
					rKey = Schema.resolve(key, sKey, options)[0];
				} catch (error) {
					if (strict) continue;
					throw error;
				}
				result[rKey] = property(data, key, inner, options);
				data[rKey] = data[key];
				if (key !== rKey) delete data[key];
			}
			return [result];
		});
		Schema.extend("tuple", (data, { list }, options, strict) => {
			if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
			const result = list.map((inner, index) => property(data, index, inner, options));
			if (strict) return [result];
			result.push(...data.slice(list.length));
			return [result];
		});
		function merge(result, data) {
			for (const key in data) {
				if (key in result) continue;
				result[key] = data[key];
			}
		}
		Schema.extend("object", (data, { dict }, options, strict) => {
			if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
			const result = {};
			for (const key in dict) {
				const value = property(data, key, dict[key], options);
				if (!isNullable(value) || key in data) result[key] = value;
			}
			if (!strict) merge(result, data);
			return [result];
		});
		Schema.extend("union", (data, { list, toString }, options, strict) => {
			const messages = [];
			for (const inner of list) try {
				return Schema.resolve(data, inner, options, strict);
			} catch (error) {
				messages.push(error);
			}
			throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		});
		Schema.extend("intersect", (data, { list, toString }, options, strict) => {
			if (!list.length) return [data];
			let result;
			for (const inner of list) {
				const value = Schema.resolve(data, inner, options, true)[0];
				if (isNullable(value)) continue;
				if (isNullable(result)) result = value;
				else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
				else if (typeof value === "object") merge(result ??= {}, value);
				else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
			}
			if (!strict && isPlainObject(data)) merge(result, data);
			return [result];
		});
		Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
			const [result, adapted = data] = Schema.resolve(data, inner, options, true);
			if (preserve) return [callback(result)];
			else return [callback(result), callback(adapted)];
		});
		const formatters = {};
		function defineMethod(name, keys, format) {
			formatters[name] = format;
			Object.assign(Schema, { [name](...args) {
				const schema = new Schema({ type: name });
				keys.forEach((key, index) => {
					switch (key) {
						case "sKey":
							schema.sKey = args[index] ?? Schema.string();
							break;
						case "inner":
							schema.inner = Schema.from(args[index]);
							break;
						case "list":
							schema.list = args[index].map(Schema.from);
							break;
						case "dict":
							schema.dict = mapValues(args[index], Schema.from);
							break;
						case "bits":
							schema.bits = {};
							for (const key in args[index]) {
								if (typeof args[index][key] !== "number") continue;
								schema.bits[key] = args[index][key];
							}
							break;
						case "callback": {
							const callback = schema.callback = args[index];
							callback["toJSON"] ||= () => callback.toString();
							break;
						}
						case "constructor": {
							const constructor = schema.constructor = args[index];
							if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
							break;
						}
						default: schema[key] = args[index];
					}
				});
				if (name === "object" || name === "dict") schema.meta.default = {};
				else if (name === "array" || name === "tuple") schema.meta.default = [];
				else if (name === "bitset") schema.meta.default = 0;
				return schema;
			} });
		}
		defineMethod("is", ["constructor"], ({ constructor }) => {
			if (typeof constructor === "function") return constructor.name;
			else return constructor;
		});
		defineMethod("any", [], () => "any");
		defineMethod("never", [], () => "never");
		defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
		defineMethod("string", [], () => "string");
		defineMethod("number", [], () => "number");
		defineMethod("boolean", [], () => "boolean");
		defineMethod("bitset", ["bits"], () => "bitset");
		defineMethod("function", [], () => "function");
		defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
		defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
		defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
		defineMethod("object", ["dict"], ({ dict }) => {
			if (Object.keys(dict).length === 0) return "{}";
			return `{ ${Object.entries(dict).map(([key, inner]) => {
				return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
			}).join(", ")} }`;
		});
		defineMethod("union", ["list"], ({ list }, inline) => {
			const result = list.map(({ toString: format }) => format()).join(" | ");
			return inline ? `(${result})` : result;
		});
		defineMethod("intersect", ["list"], ({ list }) => {
			return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
		});
		defineMethod("transform", [
			"inner",
			"callback",
			"preserve"
		], ({ inner }, isInner) => inner.toString(isInner));
		//#endregion
		//#region src/action-approval-settings.ts
		const SOC_ACTION_APPROVAL_NAMESPACE = "soc-action-approval";
		Schema.object({ autoApproveActions: Schema.array(Schema.string()).default([]) });
		//#endregion
		//#region src/client/SplunkSettings.ts
		function SplunkSettings({ connection }) {
			const [settings, setSettings] = (0, react.useState)(null);
			const [status, setStatus] = (0, react.useState)("Loading…");
			const [test, setTest] = (0, react.useState)("");
			const [testState, setTestState] = (0, react.useState)("idle");
			const load = (0, react.useCallback)(async () => {
				try {
					setSettings(await rpc(connection, "get-settings"));
					setStatus("");
				} catch (error) {
					setStatus(errorText(error));
				}
			}, [connection]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			async function testSplunk() {
				setTestState("checking");
				setTest("Checking…");
				try {
					await rpc(connection, "test-splunk");
					setTestState("success");
					setTest("Connection verified");
				} catch (error) {
					setTestState("error");
					setTest(errorText(error));
				}
			}
			if (!settings) return react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.loading }, status);
			const ready = testState === "success" || testState !== "error" && settings.services?.splunk?.status === "ready";
			const label = testState === "checking" ? "Checking…" : testState === "success" ? "Connected" : testState === "error" ? "Unavailable" : ready ? "Configured" : "Not configured";
			return react.default.createElement("section", { className: SplunkZimbraOverlay_module_css_default.section }, react.default.createElement("h3", null, "Splunk"), react.default.createElement("p", { className: SplunkZimbraOverlay_module_css_default.description }, label), react.default.createElement("p", { className: SplunkZimbraOverlay_module_css_default.description }, "Configuration is managed by the server environment."), react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.secondaryButton,
				type: "button",
				onClick: () => {
					testSplunk();
				}
			}, "Check connection"), test ? react.default.createElement("p", {
				className: SplunkZimbraOverlay_module_css_default.status,
				role: "status"
			}, test) : null, status ? react.default.createElement("p", {
				className: SplunkZimbraOverlay_module_css_default.status,
				role: "status"
			}, status) : null);
		}
		//#endregion
		//#region src/client/SubscriptionServerSettings.ts
		function SubscriptionServerSettings({ connection }) {
			const [settings, setSettings] = (0, react.useState)(null);
			const [status, setStatus] = (0, react.useState)("Loading…");
			const [test, setTest] = (0, react.useState)("");
			const [testState, setTestState] = (0, react.useState)("idle");
			const load = (0, react.useCallback)(async () => {
				try {
					setSettings(await rpc(connection, "get-settings"));
					setStatus("");
				} catch (error) {
					setStatus(errorText(error));
				}
			}, [connection]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			async function testConnection() {
				setTestState("checking");
				setTest("Checking…");
				try {
					await rpc(connection, "test-subscription-server");
					setTestState("success");
					setTest("Connection verified");
				} catch (error) {
					setTestState("error");
					setTest(errorText(error));
				}
			}
			if (!settings) return react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.loading }, status);
			const ready = testState === "success" || testState !== "error" && settings.services?.subscription_server?.status === "ready";
			const label = testState === "checking" ? "Checking…" : testState === "success" ? "Connected" : testState === "error" ? "Unavailable" : ready ? "Configured" : "Not configured";
			return react.default.createElement("section", { className: SplunkZimbraOverlay_module_css_default.section }, react.default.createElement("h3", null, "Subscription server"), react.default.createElement("p", { className: SplunkZimbraOverlay_module_css_default.description }, label), react.default.createElement("p", { className: SplunkZimbraOverlay_module_css_default.description }, "Configuration is managed by the server environment."), react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.secondaryButton,
				type: "button",
				onClick: () => {
					testConnection();
				}
			}, "Check connection"), test ? react.default.createElement("p", {
				className: SplunkZimbraOverlay_module_css_default.status,
				role: "status"
			}, test) : null, status ? react.default.createElement("p", {
				className: SplunkZimbraOverlay_module_css_default.status,
				role: "status"
			}, status) : null);
		}
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"slots",
			"connection",
			"conversation",
			"commandUi",
			"settingsScope"
		];
		function apply(ctx) {
			const connection = ctx.get("connection");
			const path = typeof window === "undefined" ? "" : window.location.pathname;
			if (path === "/admin" || path.startsWith("/admin/")) {
				ctx.slots.inject("root", () => ctx.slots.register({
					name: "root",
					priority: -1
				}, () => react.default.createElement(AdminConsole, { connection })));
				return;
			}
			if (path === "/catalogs" || path.startsWith("/catalogs/")) {
				ctx.slots.inject("root", () => ctx.slots.register({
					name: "root",
					priority: -1
				}, () => react.default.createElement(CatalogManager, { connection })));
				return;
			}
			const api = connection.api;
			api.folders = void 0;
			const documents = new MarkItDownDocumentController(connection, ctx.settingsScope.bind({ namespace: MARKITDOWN_ATTACHMENTS_NAMESPACE }));
			const settings = new AttachmentSettingsController(ctx.settingsScope.bind({ namespace: MARKITDOWN_ATTACHMENTS_NAMESPACE }));
			const actionApproval = new SocActionApprovalController(connection, ctx.settingsScope.bind({ namespace: SOC_ACTION_APPROVAL_NAMESPACE }));
			ctx.effect(() => ctx.conversation.registerDocumentProvider(documents), "soc-agent: MarkItDown document provider");
			ctx.slots.inject("conversation.input.documents", () => ctx.slots.register({
				name: "conversation.input.documents",
				locale: "conversation"
			}, (props) => react.default.createElement(MarkItDownDocuments, {
				...props,
				controller: documents
			})));
			ctx.effect(() => ctx.commandUi.register({
				name: "attach-file",
				description: "Attach file",
				available: () => true,
				ui: {
					kind: "action",
					options: async () => [],
					onSelect: (_option, session) => {
						openMarkItDownPicker(session.sessionId);
					}
				}
			}), "soc-agent: MarkItDown file command");
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: MARKITDOWN_ATTACHMENTS_NAMESPACE,
				inject: () => settings.inject()
			}, MarkItDownAttachmentSettingsCard));
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: SOC_ACTION_APPROVAL_NAMESPACE,
				inject: () => actionApproval.inject()
			}, SocActionApprovalSettingsCard));
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "soc-action-policy",
				priority: -10
			}, (props) => react.default.createElement(SocActionPolicyMenu, {
				...props,
				connection
			})));
			installEmailDraftToolview(ctx);
			installSplunkDetectionToolview(ctx);
			installCatalogToolview(ctx);
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "soc-agent-auth-gate",
				priority: -100
			}, AuthGate));
			ctx.slots.inject("sidebar.brand.mark", () => ctx.slots.inject("sidebar.brand.name", () => ctx.slots.inject("conversation.hero.brand.mark", function* () {
				yield ctx.slots.register({
					name: "sidebar.brand.mark",
					priority: -1
				}, CiticBrandMark);
				yield ctx.slots.register({
					name: "sidebar.brand.name",
					priority: -1
				}, CiticBrandName);
				yield ctx.slots.register({
					name: "conversation.hero.brand.mark",
					priority: -1
				}, CiticBrandMark);
			})));
		}
		//#endregion
		exports.AdminConsole = AdminConsole;
		exports.CatalogManager = CatalogManager;
		exports.CatalogToolview = CatalogToolview;
		exports.EmailDraftToolview = EmailDraftToolview;
		exports.SplunkDetectionToolview = SplunkDetectionToolview;
		exports.SplunkSettings = SplunkSettings;
		exports.SubscriptionServerSettings = SubscriptionServerSettings;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
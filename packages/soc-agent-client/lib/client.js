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
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/CiticBrand.module.css.mjs
		const css$7 = ".U2KmSq_wordmark{text-overflow:ellipsis;white-space:nowrap;letter-spacing:.08em;align-items:center;min-width:0;max-width:100%;font-size:16px;font-weight:700;line-height:24px;display:inline-flex;overflow:hidden}";
		const tagId$7 = "dsh-soc-agent-client/CiticBrand.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$7) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$7;
			tag.textContent = css$7;
			document.head.appendChild(tag);
		}
		var CiticBrand_module_css_default = { "wordmark": "U2KmSq_wordmark" };
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
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/AdminConsole.module.css.mjs
		const css$6 = ".IhE_MG_page,.IhE_MG_loginPage{--ink:#202c35;--muted:#65747d;--line:#dfe5e5;--accent:#216b5c;--paper:#fff;color-scheme:light;color:var(--ink);background:#f4f6f5;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:14px;line-height:1.5}.IhE_MG_page *,.IhE_MG_loginPage *{box-sizing:border-box}.IhE_MG_page [hidden]{display:none!important}.IhE_MG_page button,.IhE_MG_loginPage button,.IhE_MG_page input,.IhE_MG_page select,.IhE_MG_page textarea{font:inherit}.IhE_MG_page a{color:inherit}.IhE_MG_page :focus-visible,.IhE_MG_loginPage :focus-visible{outline-offset:3px;outline:3px solid #49a68d}.IhE_MG_page{grid-template-columns:232px minmax(0,1fr);display:grid}.IhE_MG_sidebar{color:#d3dfdc;background:#142c2c;flex-direction:column;height:100vh;padding:32px 18px 22px;display:flex;position:sticky;top:0}.IhE_MG_brand{letter-spacing:-.5px;align-items:center;gap:12px;padding:0 10px 42px;font-size:22px;font-weight:700;text-decoration:none;display:flex}.IhE_MG_brand small{letter-spacing:.3px;color:#a9bfba;font-size:11px;font-weight:400;display:block}.IhE_MG_brandMark{color:#194e40;background:#d9eee1;border-radius:12px;place-items:center;width:38px;height:42px;font-family:Georgia,serif;font-size:24px;display:grid}.IhE_MG_navLabel{letter-spacing:1.8px;color:#8da9a2;margin:0 0 12px;padding:0 14px;font-size:10px;font-weight:600}.IhE_MG_navigation{gap:5px;display:grid}.IhE_MG_navigation a{color:#b4c8c2;border-radius:7px;align-items:center;gap:12px;padding:12px 14px;font-size:13px;text-decoration:none;display:flex}.IhE_MG_navigation a:hover{color:#fff;background:#203d3b}.IhE_MG_navigation .IhE_MG_navActive{color:#f0f8f3;background:#2c4944;font-weight:600;box-shadow:inset 3px 0 #a9d3b7}.IhE_MG_sidebarFoot{margin-top:auto;padding:32px 10px 0}.IhE_MG_backLink{padding-bottom:24px;font-size:12px;text-decoration:none;display:block;color:#b8c9c4!important}.IhE_MG_identity{border-top:1px solid #37504a;gap:10px;min-width:0;padding:19px 0 10px;display:flex}.IhE_MG_identity>div{min-width:0}.IhE_MG_identity strong{color:#e0e9e5;font-size:12px;font-weight:500;display:block}.IhE_MG_avatar{color:#d4e9db;background:#36574b;border-radius:50%;flex:0 0 33px;place-items:center;height:33px;display:grid}.IhE_MG_account{text-overflow:ellipsis;white-space:nowrap;color:#9eb6ae;max-width:155px;font-size:11px;display:block;overflow:hidden}.IhE_MG_signOut{color:#b9cdc5;cursor:pointer;background:0 0;border:0;padding:8px 0;font-size:12px!important}.IhE_MG_shell{width:100%;min-width:0;max-width:1550px;margin:0 auto;padding:0 clamp(24px,4vw,64px)}.IhE_MG_topbar{border-bottom:1px solid var(--line);min-height:74px;color:var(--muted);justify-content:space-between;align-items:center;font-size:12px;display:flex}.IhE_MG_topbar strong{color:var(--ink);font-weight:500}.IhE_MG_adminBadge{color:#4c6259;background:#e8eeeb;border-radius:4px;padding:4px 10px;font-size:11px}.IhE_MG_header{justify-content:space-between;align-items:center;gap:24px;padding:34px 0 26px;display:flex}.IhE_MG_eyebrow,.IhE_MG_sectionKicker{color:#677f75;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 9px;font-size:10px;font-weight:700}.IhE_MG_title,.IhE_MG_loginTitle,.IhE_MG_sectionTitle,.IhE_MG_editorTitle{color:var(--ink);letter-spacing:-.6px;margin:0;font-weight:600}.IhE_MG_title{font-size:34px;line-height:1.2}.IhE_MG_subtitle{color:var(--muted);margin:10px 0 0;font-size:14px}.IhE_MG_headerMark{color:#4c7161;background:#ecf1ec;border:1px solid #d3dfd8;border-radius:13px;place-items:center;width:48px;height:48px;display:grid}.IhE_MG_headerMark svg{width:24px;height:24px}.IhE_MG_section{margin:8px 0 32px}.IhE_MG_sectionHeading{justify-content:space-between;align-items:center;gap:20px;margin-bottom:20px;display:flex}.IhE_MG_sectionTitle{font-size:20px}.IhE_MG_sectionHint{color:var(--muted);text-align:right;max-width:290px;font-size:12px}.IhE_MG_headerActions,.IhE_MG_toolbar{flex-wrap:wrap;align-items:center;gap:12px;display:flex}.IhE_MG_metrics{grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin:0 0 28px;display:grid}.IhE_MG_metric{border:1px solid var(--line);background:#fff;border-radius:10px;flex-direction:column;padding:22px;text-decoration:none;display:flex;box-shadow:0 2px 3px #182e2610}.IhE_MG_metric:hover{border-color:#a8c4b8}.IhE_MG_metricLabel{color:#54675f;justify-content:space-between;align-items:center;gap:8px;font-size:12px;display:flex}.IhE_MG_metricLabel svg{color:#7a9689}.IhE_MG_metric>strong{letter-spacing:-1px;margin:18px 0;font-size:32px;font-weight:600;line-height:1.3}.IhE_MG_metric>small{color:var(--muted);justify-content:space-between;gap:12px;font-size:11px;display:flex}.IhE_MG_metricAttention{background:#fffaf2;border-color:#ebd6b7}.IhE_MG_metricAttention>strong{color:#976322}.IhE_MG_contentGrid{grid-template-columns:minmax(0,1.9fr) minmax(230px,1fr);align-items:start;gap:22px;display:grid}.IhE_MG_card{background:var(--paper);border:1px solid var(--line);border-radius:10px;min-width:0;margin-bottom:22px;padding:26px}.IhE_MG_helpCard{color:#455c4e;background:#eaf0e9;border:1px solid #dce5d9;border-radius:10px;padding:28px}.IhE_MG_helpCard h3{color:#294938;margin:0 0 12px;font-family:Georgia,serif;font-size:26px;font-weight:400;line-height:1.2}.IhE_MG_helpCard p{font-size:13px;line-height:1.75}.IhE_MG_steps{margin:22px 0;padding-left:20px;font-size:12px}.IhE_MG_steps li{padding:5px 0 5px 5px}.IhE_MG_quickLinks{margin-top:18px;display:grid}.IhE_MG_quickLinks a{border-bottom:1px solid #e9eeeb;align-items:center;gap:15px;padding:20px 0;text-decoration:none;display:flex}.IhE_MG_quickLinks a:last-child{border-bottom:0;padding-bottom:4px}.IhE_MG_quickLinks a>span:nth-child(2){flex:1}.IhE_MG_quickLinks strong{font-size:14px;font-weight:600;display:block}.IhE_MG_quickLinks small{color:var(--muted);margin-top:5px;font-size:12px;line-height:1.5;display:block}.IhE_MG_quickLinks a:hover strong{color:var(--accent)}.IhE_MG_quickIcon{color:#50725e;background:#f0f4f1;border:1px solid #e2eae4;border-radius:9px;flex:0 0 38px;place-items:center;width:38px;height:38px;display:grid}.IhE_MG_pageFoot{border-top:1px solid var(--line);color:#77867e;margin-top:30px;padding:24px 0;font-size:11px}.IhE_MG_statusGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;display:grid}.IhE_MG_statusCard{border:1px solid var(--line);background:#fff;border-radius:10px;gap:15px;min-width:0;padding:22px;display:flex}.IhE_MG_statusIcon{color:#346e55;background:#edf4ef;border:1px solid #d6e4dc;border-radius:9px;flex:0 0 36px;place-items:center;height:36px;font-weight:600;display:grid}.IhE_MG_statusBody{flex:1;min-width:0}.IhE_MG_statusTopline{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;display:flex}.IhE_MG_statusTopline h3{margin:0;font-size:14px;font-weight:600}.IhE_MG_statusBody p{color:var(--muted);margin:9px 0 0;font-size:12px}.IhE_MG_statusPill,.IhE_MG_customBadge,.IhE_MG_customTag,.IhE_MG_countBadge{white-space:nowrap;border-radius:5px;align-items:center;gap:6px;padding:4px 9px;font-size:11px;font-weight:500;display:inline-flex}.IhE_MG_statusReady{color:#286043;background:#e5f2e9}.IhE_MG_statusConfigured,.IhE_MG_statusInfo{color:#385e73;background:#e8f0f4}.IhE_MG_statusError{color:#9d3e32;background:#fceee7}.IhE_MG_statusMuted{color:#65726e;background:#eff1ef}.IhE_MG_statusDot,.IhE_MG_providerDot{background:#97a59e;border-radius:50%;width:6px;height:6px;display:inline-block}.IhE_MG_statusReady .IhE_MG_statusDot,.IhE_MG_providerDotReady{background:#378657}.IhE_MG_statusConfigured .IhE_MG_statusDot,.IhE_MG_statusInfo .IhE_MG_statusDot{background:#507c94}.IhE_MG_statusError .IhE_MG_statusDot{background:#bb5f4c}.IhE_MG_textButton{cursor:pointer;background:0 0;border:0;margin-top:14px;padding:0;font-weight:600;text-decoration:none;display:inline-block;color:var(--accent)!important;font-size:12px!important}.IhE_MG_textButton:hover{text-decoration:underline}.IhE_MG_envManaged{color:#76827c;margin-top:14px;font-size:11px;display:block}.IhE_MG_button,.IhE_MG_dangerButton{color:#3e5349;cursor:pointer;background:#fff;border:1px solid #d5deda;border-radius:6px;justify-content:center;align-items:center;gap:7px;min-height:38px;padding:9px 14px;line-height:1.3;text-decoration:none;display:inline-flex;font-size:12px!important;font-weight:600!important}.IhE_MG_button:hover:not(:disabled){background:#f2f6f3;border-color:#91b3a3}.IhE_MG_primary{color:#fff;background:#246b55;border-color:#246b55}.IhE_MG_primary:hover:not(:disabled){background:#19533f;border-color:#19533f}.IhE_MG_dangerButton{color:#a14235;background:#fff9f6;border-color:#eccdc3}.IhE_MG_dangerButton:hover{background:#fceee8}.IhE_MG_button:disabled,.IhE_MG_dangerButton:disabled,.IhE_MG_textButton:disabled{cursor:not-allowed;opacity:.55}.IhE_MG_error,.IhE_MG_message{overflow-wrap:anywhere;border-radius:6px;margin:12px 0;padding:12px 15px;font-size:13px}.IhE_MG_error{color:#9b3c32;background:#fff0eb}.IhE_MG_success{color:#2b6748;background:#eaf5ed}.IhE_MG_info{color:#365e73;background:#edf3f7}.IhE_MG_checkMessage{overflow-wrap:anywhere}.IhE_MG_checkMessage.IhE_MG_success{color:#2b6748;padding:5px}.IhE_MG_loading,.IhE_MG_loadingInline{color:#5d7167;background:#f4f6f5;padding:28px;font-size:14px}.IhE_MG_loading{place-items:center;min-height:100vh;display:grid}.IhE_MG_providerLayout{border:1px solid var(--line);background:#fff;border-radius:10px;grid-template-columns:250px minmax(0,1fr);display:grid;overflow:hidden}.IhE_MG_providerPicker{border-right:1px solid var(--line);background:#fafbf9;min-width:0;padding:18px 12px}.IhE_MG_pickerHeader{justify-content:space-between;align-items:center;padding:0 8px 12px;font-size:12px;font-weight:600;display:flex}.IhE_MG_countBadge{color:#4a6c59;background:#e9efeb}.IhE_MG_providerList{flex-direction:column;gap:4px;max-height:430px;display:flex;overflow:auto}.IhE_MG_providerOption,.IhE_MG_customOption{text-align:left;width:100%;color:var(--ink);cursor:pointer;background:0 0;border:1px solid #0000;border-radius:6px;align-items:center;gap:10px;padding:12px 10px;display:flex}.IhE_MG_providerOption:hover,.IhE_MG_customOption:hover{background:#eef3ef}.IhE_MG_providerOptionSelected,.IhE_MG_customOptionSelected{background:#e7f0e9;border-color:#c6d9cc}.IhE_MG_providerDot{flex:0 0 6px}.IhE_MG_providerOptionText,.IhE_MG_customOption>span:last-child{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.IhE_MG_providerOptionText strong,.IhE_MG_customOption strong{overflow-wrap:anywhere;font-size:12px;font-weight:600}.IhE_MG_providerOptionText small,.IhE_MG_customOption small{color:var(--muted);font-size:10px}.IhE_MG_customTag,.IhE_MG_customBadge{color:#806239;background:#f4eee0;font-size:9px}.IhE_MG_customOption{border-top:1px solid var(--line);border-radius:0;margin-top:14px}.IhE_MG_addIcon{color:var(--accent);font-size:20px}.IhE_MG_providerEditor{min-width:0;padding:28px}.IhE_MG_editorHeading{border-bottom:1px solid var(--line);justify-content:space-between;align-items:flex-start;gap:15px;padding-bottom:22px;display:flex}.IhE_MG_editorTitle{font-size:20px}.IhE_MG_editorCopy{color:var(--muted);margin:10px 0 0;font-size:13px;line-height:1.6}.IhE_MG_editorForm,.IhE_MG_form,.IhE_MG_formFields{border:0;flex-direction:column;gap:20px;min-width:0;margin:22px 0 0;padding:0;display:flex}.IhE_MG_fieldGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;display:grid}.IhE_MG_field{color:#3f5449;flex-direction:column;gap:8px;min-width:0;font-size:12px;font-weight:600;display:flex}.IhE_MG_field em{color:var(--muted);font-size:11px;font-style:normal;font-weight:400}.IhE_MG_input{width:100%;min-width:0;color:var(--ink);background:#fff;border:1px solid #cedbd3;border-radius:6px;padding:10px 12px;font-weight:400;line-height:1.5;display:block;font-size:13px!important}.IhE_MG_input::placeholder{color:#7c8c82}.IhE_MG_input:focus{border-color:#559779}.IhE_MG_input:disabled{cursor:not-allowed;opacity:.7;background:#f3f5f2}textarea.IhE_MG_input{resize:vertical}.IhE_MG_textarea{min-height:100px}.IhE_MG_fieldHint{color:var(--muted);font-size:11px;font-weight:400;line-height:1.6}.IhE_MG_advanced{border:1px solid var(--line);background:#fafbf9;border-radius:7px;margin-top:8px}.IhE_MG_advanced summary{cursor:pointer;color:#425e4e;padding:13px 16px;font-size:12px;font-weight:600}.IhE_MG_advancedBody{flex-direction:column;gap:16px;padding:0 16px 18px;display:flex}.IhE_MG_discoveryRow,.IhE_MG_discovered{flex-wrap:wrap;align-items:center;gap:10px;display:flex}.IhE_MG_modelChip{color:#3e6d50;cursor:pointer;background:#edf5ef;border:1px solid #cadecf;border-radius:5px;padding:7px 10px;font-size:12px}.IhE_MG_actions{flex-wrap:wrap;align-items:center;gap:10px;margin-top:8px;display:flex}.IhE_MG_confirmGroup{color:#8e4e42;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;display:flex}.IhE_MG_confirmGroup .IhE_MG_error{width:100%}.IhE_MG_loginPage{background:#eaf0ea;place-items:center;padding:24px;display:grid}.IhE_MG_loginPanel{background:#fff;border:1px solid #d4dfd5;border-radius:14px;width:min(100%,430px);padding:40px;box-shadow:0 20px 80px #26443515}.IhE_MG_loginMark{color:#fff;background:#246b55;border-radius:11px;place-items:center;width:44px;height:44px;margin-bottom:26px;font-family:Georgia,serif;font-size:22px;display:grid}.IhE_MG_loginTitle{font-size:30px;line-height:1.2}.IhE_MG_loginCopy{color:var(--muted);margin:14px 0 25px;font-size:13px}.IhE_MG_fullButton{width:100%}.IhE_MG_loginFootnote{color:var(--muted);margin:24px 0 0;font-size:11px}.IhE_MG_notice{color:#526b5d;background:#edf2ef;border:1px solid #dce5df;border-radius:7px;align-items:center;gap:12px;padding:14px 18px;font-size:12px;display:flex}.IhE_MG_tabs{border-bottom:1px solid var(--line);flex-wrap:wrap;gap:4px;margin:22px 0;display:flex}.IhE_MG_tabs button{color:var(--muted);cursor:pointer;background:0 0;border:0;border-bottom:2px solid #0000;padding:12px 14px;font-size:12px}.IhE_MG_tabs .IhE_MG_activeTab{color:#256849;border-bottom-color:#256849;font-weight:600}.IhE_MG_toolbar{margin:0 0 18px}.IhE_MG_toolbar>.IhE_MG_input,.IhE_MG_search{max-width:320px}.IhE_MG_toolbar>.IhE_MG_button:last-child{margin-left:auto}.IhE_MG_tableWrap{border:1px solid var(--line);background:#fff;border-radius:8px;margin-bottom:22px;overflow:auto}.IhE_MG_table{border-collapse:collapse;text-align:left;width:100%;font-size:12px}.IhE_MG_table th{color:#67786d;border-bottom:1px solid var(--line);white-space:nowrap;background:#f9fbf8;padding:13px 18px;font-size:11px;font-weight:500}.IhE_MG_table td{vertical-align:top;border-bottom:1px solid #edf0ec;padding:17px 18px}.IhE_MG_table tr:last-child td{border-bottom:0}.IhE_MG_table td strong{font-weight:600}.IhE_MG_table td small{color:var(--muted);margin-top:5px;display:block}.IhE_MG_table td summary{cursor:pointer;min-width:150px}.IhE_MG_empty{color:var(--muted);text-align:center;padding:35px 22px;font-size:13px}.IhE_MG_checkboxGroup{border:1px solid var(--line);border-radius:7px;flex-wrap:wrap;gap:12px;max-height:230px;padding:14px;display:flex;overflow:auto}.IhE_MG_checkboxGroup legend{color:#4b6555;padding:0 5px;font-size:12px}.IhE_MG_checkboxGroup label,.IhE_MG_checkLabel{color:#3c5546;align-items:center;gap:8px;font-size:12px;display:flex}.IhE_MG_checkboxGroup input,.IhE_MG_checkLabel input{accent-color:#276e53;width:16px;height:16px}.IhE_MG_previewEnvelope{border:1px solid var(--line);overflow-wrap:anywhere;background:#f4f7f3;border-bottom:0;margin-top:24px;padding:20px;font-size:12px}.IhE_MG_previewFrame{border:1px solid var(--line);background:#fff;width:100%;height:560px}.IhE_MG_plainText{white-space:pre-wrap;overflow-wrap:anywhere;padding:18px;font-size:12px}.IhE_MG_deliveryDetails{overflow-wrap:anywhere;min-width:220px;max-width:360px;font-size:11px}.IhE_MG_mono{overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,monospace!important}.IhE_MG_importRow{border-top:1px solid var(--line);overflow-wrap:anywhere;justify-content:space-between;align-items:center;gap:20px;padding:18px 0;font-size:12px;display:flex}.IhE_MG_importRow p{color:var(--muted)}.IhE_MG_srOnly{clip:rect(0,0,0,0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}.IhE_MG_skipLink{z-index:10;background:#fff;padding:12px;position:fixed;top:0;left:240px;transform:translateY(-150%)}.IhE_MG_skipLink:focus{transform:translateY(0)}@media (width<=1150px){.IhE_MG_page{grid-template-columns:200px minmax(0,1fr)}.IhE_MG_sidebar{padding-inline:12px}.IhE_MG_shell{padding-inline:28px}.IhE_MG_contentGrid{grid-template-columns:minmax(0,1.6fr) minmax(220px,1fr)}.IhE_MG_metric{padding:18px}.IhE_MG_metric>strong{font-size:28px}.IhE_MG_providerLayout{grid-template-columns:210px minmax(0,1fr)}}@media (width<=900px){.IhE_MG_contentGrid{grid-template-columns:1fr}.IhE_MG_metrics{gap:10px}.IhE_MG_metric{padding:14px}.IhE_MG_metricLabel{font-size:11px}.IhE_MG_metricLabel svg{display:none}.IhE_MG_statusGrid,.IhE_MG_providerLayout{grid-template-columns:1fr}.IhE_MG_providerPicker{border-right:0;border-bottom:1px solid var(--line)}.IhE_MG_providerList{max-height:180px}.IhE_MG_notice{flex-direction:column;align-items:flex-start}}@media (width<=680px){.IhE_MG_page{display:block}.IhE_MG_sidebar{height:auto;padding:18px 16px 0;position:static}.IhE_MG_brand{padding:0 0 18px;font-size:19px}.IhE_MG_brandMark{width:30px;height:34px;font-size:20px}.IhE_MG_navLabel{display:none}.IhE_MG_navigation{grid-template-columns:repeat(5,minmax(0,1fr));gap:0;display:grid}.IhE_MG_navigation a{border-radius:5px 5px 0 0;flex-direction:column;flex-shrink:0;justify-content:center;gap:6px;padding:10px 3px;font-size:10px}.IhE_MG_navigation svg{width:15px}.IhE_MG_navigation .IhE_MG_navActive{box-shadow:inset 0 -3px #a9d3b7}.IhE_MG_sidebarFoot{flex-wrap:wrap;align-items:center;gap:15px;padding:8px 0;display:flex}.IhE_MG_backLink{padding:0;font-size:11px}.IhE_MG_identity{display:none}.IhE_MG_signOut{margin-left:auto}.IhE_MG_shell{padding:0 18px}.IhE_MG_topbar{min-height:54px}.IhE_MG_header{padding:24px 0 20px}.IhE_MG_title{font-size:28px}.IhE_MG_headerMark{display:none}.IhE_MG_sectionHeading{flex-wrap:wrap;align-items:flex-start;gap:12px}.IhE_MG_metrics{grid-template-columns:1fr;gap:10px}.IhE_MG_metric{grid-template-columns:1fr auto;align-items:center;gap:8px;padding:16px 18px;display:grid}.IhE_MG_metric>strong{grid-area:1/2/3;margin:0;font-size:24px}.IhE_MG_metric>small{grid-column:1}.IhE_MG_metric small span{display:none}.IhE_MG_card,.IhE_MG_helpCard,.IhE_MG_providerEditor{padding:20px}.IhE_MG_fieldGrid{grid-template-columns:1fr}.IhE_MG_editorHeading{flex-wrap:wrap}.IhE_MG_toolbar>.IhE_MG_input,.IhE_MG_search{width:100%;max-width:none}.IhE_MG_tabs{gap:0}.IhE_MG_tabs button{padding:11px 9px;font-size:11px}.IhE_MG_sectionHint{text-align:left}.IhE_MG_table td,.IhE_MG_table th{padding:12px}.IhE_MG_table{min-width:560px}.IhE_MG_importRow{flex-direction:column;align-items:flex-start}.IhE_MG_skipLink{left:16px}}.IhE_MG_contextGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;display:grid}.IhE_MG_contextCard{border:1px solid var(--line);background:var(--paper);border-radius:10px;min-width:0;padding:26px;box-shadow:0 2px 3px #182e2610}.IhE_MG_contextCard h3{color:var(--ink);margin:0;font-size:16px;font-weight:600}.IhE_MG_contextCard p:not(.IhE_MG_sectionKicker){color:var(--muted);margin:8px 0 0;font-size:12px;line-height:1.55}.IhE_MG_fieldError{color:#9b3c32;font-size:11px;font-weight:500;line-height:1.5}.IhE_MG_input[aria-invalid=true]{background:#fffaf8;border-color:#bb5f4c}.IhE_MG_toggleField{color:#3f5449;cursor:pointer;align-items:flex-start;gap:11px;display:flex}.IhE_MG_toggleField input{accent-color:#276e53;width:17px;height:17px;margin:1px 0 0}.IhE_MG_toggleField span{flex-direction:column;gap:4px;display:flex}.IhE_MG_toggleField strong{font-size:12px}.IhE_MG_toggleField small{color:var(--muted);font-size:11px;font-weight:400;line-height:1.5}.IhE_MG_contextCardWide{grid-column:1/-1}.IhE_MG_actionGroups{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px;display:grid}.IhE_MG_actionGroups .IhE_MG_checkboxGroup{max-height:none;margin:0}.IhE_MG_actionGroups .IhE_MG_checkLabel{align-items:flex-start}.IhE_MG_modeChoices{border:0;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:20px 0 0;padding:0;display:grid}.IhE_MG_modeChoice{border:1px solid var(--line);cursor:pointer;background:#fafcf9;border-radius:7px;align-items:flex-start;gap:10px;min-width:0;padding:14px;display:flex}.IhE_MG_modeChoice:has(input:checked){background:#eef6ef;border-color:#9fc5ae}.IhE_MG_modeChoice input{accent-color:#276e53;width:16px;height:16px;margin:1px 0 0}.IhE_MG_modeChoice span{flex-direction:column;gap:4px;min-width:0;display:flex}.IhE_MG_modeChoice strong{color:#314d40;font-size:12px}.IhE_MG_modeChoice small{color:var(--muted);font-size:11px;font-weight:400;line-height:1.5}.IhE_MG_accessGroups{gap:16px;margin-top:18px;display:grid}.IhE_MG_actionGroup{border:1px solid var(--line);background:var(--paper);border-radius:10px;min-width:0;margin:0;padding:0;overflow:hidden}.IhE_MG_actionGroup>legend{border-bottom:1px solid var(--line);color:#4b6555;background:#f9fbf8;width:100%;padding:14px 18px;font-size:12px;font-weight:600}.IhE_MG_actionRow{border-bottom:1px solid #edf0ec;justify-content:space-between;align-items:center;gap:18px;min-width:0;padding:15px 18px;display:flex}.IhE_MG_actionGroup .IhE_MG_actionRow:last-child{border-bottom:0}.IhE_MG_actionInfo{flex-direction:column;flex:1;gap:5px;min-width:0;display:flex}.IhE_MG_actionInfo strong{color:#314b3e;font-size:12px;font-weight:600}.IhE_MG_actionInfo small{color:var(--muted);font-size:10px}.IhE_MG_stateChoices{flex-wrap:wrap;flex:none;justify-content:flex-end;gap:6px;display:flex}.IhE_MG_actionControls{flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:8px;display:flex}.IhE_MG_stateChoice{color:#52685d;cursor:pointer;white-space:nowrap;background:#fff;border:1px solid #d8e2dc;border-radius:5px;align-items:center;gap:5px;padding:6px 8px;font-size:10px;font-weight:500;display:inline-flex}.IhE_MG_stateChoice:has(input:checked){color:#286047;background:#eaf5ed;border-color:#8fb8a0}.IhE_MG_stateChoice input{accent-color:#276e53;width:13px;height:13px;margin:0}.IhE_MG_protectedBadge{color:#8b5f2d;white-space:nowrap;background:#fbf1df;border-radius:5px;flex:none;padding:6px 9px;font-size:10px;font-weight:600}.IhE_MG_unavailableBadge{color:#8b4b42;white-space:nowrap;background:#fceee8;border-radius:5px;padding:5px 8px;font-size:10px;font-weight:600}@media (width<=900px){.IhE_MG_contextGrid,.IhE_MG_actionGroups,.IhE_MG_modeChoices{grid-template-columns:1fr}.IhE_MG_actionRow{flex-direction:column;align-items:flex-start}.IhE_MG_stateChoices,.IhE_MG_actionControls{justify-content:flex-start}}@media (width<=680px){.IhE_MG_contextCard{padding:20px}.IhE_MG_navigation{grid-template-columns:repeat(3,minmax(0,1fr))}}";
		const tagId$6 = "dsh-soc-agent-client/AdminConsole.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$6) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$6;
			tag.textContent = css$6;
			document.head.appendChild(tag);
		}
		var AdminConsole_module_css_default = {
			"accessGroups": "IhE_MG_accessGroups",
			"account": "IhE_MG_account",
			"actionControls": "IhE_MG_actionControls",
			"actionGroup": "IhE_MG_actionGroup",
			"actionGroups": "IhE_MG_actionGroups",
			"actionInfo": "IhE_MG_actionInfo",
			"actionRow": "IhE_MG_actionRow",
			"actions": "IhE_MG_actions",
			"activeTab": "IhE_MG_activeTab",
			"addIcon": "IhE_MG_addIcon",
			"adminBadge": "IhE_MG_adminBadge",
			"advanced": "IhE_MG_advanced",
			"advancedBody": "IhE_MG_advancedBody",
			"avatar": "IhE_MG_avatar",
			"backLink": "IhE_MG_backLink",
			"brand": "IhE_MG_brand",
			"brandMark": "IhE_MG_brandMark",
			"button": "IhE_MG_button",
			"card": "IhE_MG_card",
			"checkLabel": "IhE_MG_checkLabel",
			"checkMessage": "IhE_MG_checkMessage",
			"checkboxGroup": "IhE_MG_checkboxGroup",
			"confirmGroup": "IhE_MG_confirmGroup",
			"contentGrid": "IhE_MG_contentGrid",
			"contextCard": "IhE_MG_contextCard",
			"contextCardWide": "IhE_MG_contextCardWide",
			"contextGrid": "IhE_MG_contextGrid",
			"countBadge": "IhE_MG_countBadge",
			"customBadge": "IhE_MG_customBadge",
			"customOption": "IhE_MG_customOption",
			"customOptionSelected": "IhE_MG_customOptionSelected",
			"customTag": "IhE_MG_customTag",
			"dangerButton": "IhE_MG_dangerButton",
			"deliveryDetails": "IhE_MG_deliveryDetails",
			"discovered": "IhE_MG_discovered",
			"discoveryRow": "IhE_MG_discoveryRow",
			"editorCopy": "IhE_MG_editorCopy",
			"editorForm": "IhE_MG_editorForm",
			"editorHeading": "IhE_MG_editorHeading",
			"editorTitle": "IhE_MG_editorTitle",
			"empty": "IhE_MG_empty",
			"envManaged": "IhE_MG_envManaged",
			"error": "IhE_MG_error",
			"eyebrow": "IhE_MG_eyebrow",
			"field": "IhE_MG_field",
			"fieldError": "IhE_MG_fieldError",
			"fieldGrid": "IhE_MG_fieldGrid",
			"fieldHint": "IhE_MG_fieldHint",
			"form": "IhE_MG_form",
			"formFields": "IhE_MG_formFields",
			"fullButton": "IhE_MG_fullButton",
			"header": "IhE_MG_header",
			"headerActions": "IhE_MG_headerActions",
			"headerMark": "IhE_MG_headerMark",
			"helpCard": "IhE_MG_helpCard",
			"identity": "IhE_MG_identity",
			"importRow": "IhE_MG_importRow",
			"info": "IhE_MG_info",
			"input": "IhE_MG_input",
			"loading": "IhE_MG_loading",
			"loadingInline": "IhE_MG_loadingInline",
			"loginCopy": "IhE_MG_loginCopy",
			"loginFootnote": "IhE_MG_loginFootnote",
			"loginMark": "IhE_MG_loginMark",
			"loginPage": "IhE_MG_loginPage",
			"loginPanel": "IhE_MG_loginPanel",
			"loginTitle": "IhE_MG_loginTitle",
			"message": "IhE_MG_message",
			"metric": "IhE_MG_metric",
			"metricAttention": "IhE_MG_metricAttention",
			"metricLabel": "IhE_MG_metricLabel",
			"metrics": "IhE_MG_metrics",
			"modeChoice": "IhE_MG_modeChoice",
			"modeChoices": "IhE_MG_modeChoices",
			"modelChip": "IhE_MG_modelChip",
			"mono": "IhE_MG_mono",
			"navActive": "IhE_MG_navActive",
			"navLabel": "IhE_MG_navLabel",
			"navigation": "IhE_MG_navigation",
			"notice": "IhE_MG_notice",
			"page": "IhE_MG_page",
			"pageFoot": "IhE_MG_pageFoot",
			"pickerHeader": "IhE_MG_pickerHeader",
			"plainText": "IhE_MG_plainText",
			"previewEnvelope": "IhE_MG_previewEnvelope",
			"previewFrame": "IhE_MG_previewFrame",
			"primary": "IhE_MG_primary",
			"protectedBadge": "IhE_MG_protectedBadge",
			"providerDot": "IhE_MG_providerDot",
			"providerDotReady": "IhE_MG_providerDotReady",
			"providerEditor": "IhE_MG_providerEditor",
			"providerLayout": "IhE_MG_providerLayout",
			"providerList": "IhE_MG_providerList",
			"providerOption": "IhE_MG_providerOption",
			"providerOptionSelected": "IhE_MG_providerOptionSelected",
			"providerOptionText": "IhE_MG_providerOptionText",
			"providerPicker": "IhE_MG_providerPicker",
			"quickIcon": "IhE_MG_quickIcon",
			"quickLinks": "IhE_MG_quickLinks",
			"search": "IhE_MG_search",
			"section": "IhE_MG_section",
			"sectionHeading": "IhE_MG_sectionHeading",
			"sectionHint": "IhE_MG_sectionHint",
			"sectionKicker": "IhE_MG_sectionKicker",
			"sectionTitle": "IhE_MG_sectionTitle",
			"shell": "IhE_MG_shell",
			"sidebar": "IhE_MG_sidebar",
			"sidebarFoot": "IhE_MG_sidebarFoot",
			"signOut": "IhE_MG_signOut",
			"skipLink": "IhE_MG_skipLink",
			"srOnly": "IhE_MG_srOnly",
			"stateChoice": "IhE_MG_stateChoice",
			"stateChoices": "IhE_MG_stateChoices",
			"statusBody": "IhE_MG_statusBody",
			"statusCard": "IhE_MG_statusCard",
			"statusConfigured": "IhE_MG_statusConfigured",
			"statusDot": "IhE_MG_statusDot",
			"statusError": "IhE_MG_statusError",
			"statusGrid": "IhE_MG_statusGrid",
			"statusIcon": "IhE_MG_statusIcon",
			"statusInfo": "IhE_MG_statusInfo",
			"statusMuted": "IhE_MG_statusMuted",
			"statusPill": "IhE_MG_statusPill",
			"statusReady": "IhE_MG_statusReady",
			"statusTopline": "IhE_MG_statusTopline",
			"steps": "IhE_MG_steps",
			"subtitle": "IhE_MG_subtitle",
			"success": "IhE_MG_success",
			"table": "IhE_MG_table",
			"tableWrap": "IhE_MG_tableWrap",
			"tabs": "IhE_MG_tabs",
			"textButton": "IhE_MG_textButton",
			"textarea": "IhE_MG_textarea",
			"title": "IhE_MG_title",
			"toggleField": "IhE_MG_toggleField",
			"toolbar": "IhE_MG_toolbar",
			"topbar": "IhE_MG_topbar",
			"unavailableBadge": "IhE_MG_unavailableBadge"
		};
		//#endregion
		//#region src/client/SocActionApprovalSettings.tsx
		function validCatalog(value) {
			if (!Array.isArray(value)) return [];
			const seen = /* @__PURE__ */ new Set();
			return value.flatMap((item) => {
				if (!item || typeof item !== "object") return [];
				const candidate = item;
				if (typeof candidate.name !== "string" || typeof candidate.group !== "string" || typeof candidate.label !== "string") return [];
				if (candidate.name.length === 0 || seen.has(candidate.name)) return [];
				seen.add(candidate.name);
				const kind = candidate.kind === "read" || candidate.kind === "mutation" || candidate.kind === "ui-confirmed" ? candidate.kind : void 0;
				return [{
					name: candidate.name,
					group: candidate.group,
					label: candidate.label,
					...kind === void 0 ? {} : { kind }
				}];
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/SplunkZimbraOverlay.module.css.mjs
		const css$5 = "._3bvj8q_form button:focus-visible,._3bvj8q_input:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:2px}._3bvj8q_loading{color:var(--dsw-alias-label-secondary);text-align:center;padding:24px}._3bvj8q_form{flex-direction:column;gap:14px;font-size:13px;line-height:20px;display:flex}._3bvj8q_description,._3bvj8q_status{color:var(--dsw-alias-label-secondary);margin:0}._3bvj8q_status{background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:8px 10px}._3bvj8q_section{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:12px;flex-direction:column;gap:8px;margin:0;padding:12px;display:flex}._3bvj8q_section h3{margin:0 0 2px;font-size:14px;font-weight:500;line-height:22px}._3bvj8q_row{grid-template-columns:118px minmax(0,1fr) auto;align-items:center;gap:8px;display:grid}._3bvj8q_row label{color:var(--dsw-alias-label-secondary)}._3bvj8q_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);min-width:0;height:32px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:0 9px}._3bvj8q_input::placeholder{color:var(--dsw-alias-label-tertiary)}._3bvj8q_textarea{box-sizing:border-box;resize:vertical;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:100%;min-height:96px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:9px}._3bvj8q_fieldLabel{color:var(--dsw-alias-label-secondary)}._3bvj8q_rule{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}._3bvj8q_run{border-bottom:1px solid var(--dsw-alias-border-l1);justify-content:space-between;align-items:center;gap:8px;padding:8px 0;display:flex}._3bvj8q_run:last-child{border-bottom:0}._3bvj8q_actions{flex-wrap:wrap;align-items:center;gap:8px;margin-top:4px;display:flex}._3bvj8q_primaryButton,._3bvj8q_secondaryButton,._3bvj8q_deleteButton{min-height:30px;font:inherit;cursor:pointer;border-radius:15px;padding:0 10px;font-size:12px}._3bvj8q_primaryButton{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border:0}._3bvj8q_primaryButton:hover{background:var(--dsw-alias-button-primary-hover)}._3bvj8q_secondaryButton,._3bvj8q_deleteButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0}._3bvj8q_secondaryButton:hover,._3bvj8q_deleteButton:hover{background:var(--dsw-alias-interactive-bg-hover)}._3bvj8q_deleteButton{border-radius:14px;min-height:28px}._3bvj8q_account{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;flex-direction:column;gap:8px;padding:10px;display:flex}._3bvj8q_connectedAccount{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding:10px;display:flex}._3bvj8q_accountIdentity{flex-direction:column;gap:2px;min-width:0;display:flex}._3bvj8q_accountMeta{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}._3bvj8q_accountActions{flex-wrap:wrap;align-items:center;gap:8px;display:flex}._3bvj8q_testResult{overflow-wrap:anywhere;min-width:0;min-height:30px;color:var(--dsw-alias-label-secondary);align-items:center;display:inline-flex}._3bvj8q_testOk{color:var(--dsw-alias-state-success-primary)}._3bvj8q_testFail{color:var(--dsw-alias-state-error-primary)}@media (width<=520px){._3bvj8q_row{grid-template-columns:1fr auto}._3bvj8q_row label{grid-column:1/-1}}";
		const tagId$5 = "dsh-soc-agent-client/SplunkZimbraOverlay.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var SplunkZimbraOverlay_module_css_default = {
			"account": "_3bvj8q_account",
			"accountActions": "_3bvj8q_accountActions",
			"accountIdentity": "_3bvj8q_accountIdentity",
			"accountMeta": "_3bvj8q_accountMeta",
			"actions": "_3bvj8q_actions",
			"connectedAccount": "_3bvj8q_connectedAccount",
			"deleteButton": "_3bvj8q_deleteButton",
			"description": "_3bvj8q_description",
			"fieldLabel": "_3bvj8q_fieldLabel",
			"form": "_3bvj8q_form",
			"input": "_3bvj8q_input",
			"loading": "_3bvj8q_loading",
			"primaryButton": "_3bvj8q_primaryButton",
			"row": "_3bvj8q_row",
			"rule": "_3bvj8q_rule",
			"run": "_3bvj8q_run",
			"secondaryButton": "_3bvj8q_secondaryButton",
			"section": "_3bvj8q_section",
			"status": "_3bvj8q_status",
			"testFail": "_3bvj8q_testFail",
			"testOk": "_3bvj8q_testOk",
			"testResult": "_3bvj8q_testResult",
			"textarea": "_3bvj8q_textarea"
		};
		//#endregion
		//#region src/client/settings-common.ts
		const CHANNEL$1 = "/soc-agent-config";
		async function rpc(connection, name, payload = {}) {
			const result = await connection.rpc.call(CHANNEL$1, name, payload);
			if (!result?.ok) throw new Error(result?.error?.message || `Request failed: ${name}`);
			return result.value;
		}
		function errorText(error) {
			return error instanceof Error ? error.message : String(error);
		}
		//#endregion
		//#region src/client/AdminConsole.tsx
		const CUSTOM_PROVIDER = "__custom__";
		const BACKGROUND_SETTINGS_NAMESPACE = "soc-background";
		const TIME_SETTINGS_NAMESPACE = "time-context";
		const ACTION_APPROVAL_SETTINGS_NAMESPACE = "soc-action-approval";
		const MAX_INTERVAL_SECONDS = Math.floor(Number.MAX_SAFE_INTEGER / 1e3);
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
		function nonNegativeInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
			const normalized = value.trim();
			const parsed = Number(normalized);
			if (!/^\d+$/u.test(normalized) || !Number.isSafeInteger(parsed) || parsed > maximum) throw new Error(`${label} must be a non-negative whole number.`);
			return parsed;
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
		const ADMIN_PAGES = [
			{
				id: "connections",
				name: "Connections",
				icon: "connections",
				copy: "Review service setup and verify connections when needed."
			},
			{
				id: "agent-context",
				name: "Agent context",
				icon: "context",
				copy: "Control workspace context and current-time injection."
			},
			{
				id: "access-approvals",
				name: "Access & approvals",
				icon: "access",
				copy: "Choose the deployment access mode and action controls."
			},
			{
				id: "providers",
				name: "AI providers",
				icon: "providers",
				copy: "Manage model access and credentials in one place."
			}
		];
		function AdminIcon({ name }) {
			const paths = {
				connections: "M8 3v5 M16 3v5 M6 8h12v3a6 6 0 0 1-12 0z M12 17v4",
				context: "M12 3a9 9 0 1 0 9 9 M12 7v5l3 2",
				access: "M12 3l8 3v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6z M9 12l2 2 4-4",
				providers: "M12 3l9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5"
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "20",
				height: "20",
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.6",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: paths[name] || paths.connections })
			});
		}
		function currentPage() {
			const hash = window.location.hash.slice(1).split("/")[0];
			return ADMIN_PAGES.some((page) => page.id === hash) ? hash : "connections";
		}
		function AdminWorkspace({ connection, email, onSignedOut }) {
			const [signingOut, setSigningOut] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const [page, setPage] = (0, react.useState)(currentPage);
			const [visited, setVisited] = (0, react.useState)(() => new Set([currentPage()]));
			(0, react.useEffect)(() => {
				const change = () => {
					const next = currentPage();
					setPage(next);
					setVisited((old) => new Set([...old, next]));
				};
				window.addEventListener("hashchange", change);
				return () => window.removeEventListener("hashchange", change);
			}, []);
			const selected = ADMIN_PAGES.find((item) => item.id === page) || ADMIN_PAGES[0];
			async function signOut() {
				setSigningOut(true);
				setError("");
				try {
					if (!(await fetch("/admin/auth/logout", {
						method: "POST",
						credentials: "same-origin"
					})).ok) throw new Error("Sign-out failed. Please try again.");
					await onSignedOut();
				} catch (signOutError) {
					setError(errorText(signOutError));
				} finally {
					setSigningOut(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: AdminConsole_module_css_default.page,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
						className: AdminConsole_module_css_default.skipLink,
						href: "#admin-content",
						onClick: (event) => {
							event.preventDefault();
							document.getElementById("admin-content")?.focus();
						},
						children: "Skip to content"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
						className: AdminConsole_module_css_default.sidebar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
								href: "/admin",
								className: AdminConsole_module_css_default.brand,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: AdminConsole_module_css_default.brandMark,
									children: "S"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Sentinel", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "Administration" })] })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: AdminConsole_module_css_default.navLabel,
								children: "WORKSPACE"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("nav", {
								className: AdminConsole_module_css_default.navigation,
								"aria-label": "Administration",
								children: ADMIN_PAGES.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
									href: `#${item.id}`,
									className: page === item.id ? AdminConsole_module_css_default.navActive : "",
									"aria-current": page === item.id ? "page" : void 0,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AdminIcon, { name: item.icon }), item.name]
								}, item.id))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AdminConsole_module_css_default.sidebarFoot,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
										href: "/",
										className: AdminConsole_module_css_default.backLink,
										children: "← Back to workspace"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: AdminConsole_module_css_default.identity,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: AdminConsole_module_css_default.avatar,
											children: email.slice(0, 1).toUpperCase() || "A"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "Administrator" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: AdminConsole_module_css_default.account,
											title: email,
											children: email
										})] })]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: AdminConsole_module_css_default.signOut,
										type: "button",
										onClick: () => void signOut(),
										disabled: signingOut,
										children: signingOut ? "Signing out…" : "Sign out"
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("main", {
						id: "admin-content",
						className: AdminConsole_module_css_default.shell,
						tabIndex: -1,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AdminConsole_module_css_default.topbar,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Workspace / ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "Administration" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: AdminConsole_module_css_default.adminBadge,
									children: "Admin access"
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
								className: AdminConsole_module_css_default.header,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: AdminConsole_module_css_default.eyebrow,
										children: "CITICTEL-CPC · SOC AGENT"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
										className: AdminConsole_module_css_default.title,
										children: selected.name
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: AdminConsole_module_css_default.subtitle,
										children: selected.copy
									})
								] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: AdminConsole_module_css_default.headerMark,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AdminIcon, { name: selected.icon })
								})]
							}),
							error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: AdminConsole_module_css_default.error,
								role: "alert",
								children: error
							}) : null,
							visited.has("connections") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								hidden: page !== "connections",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ServiceStatusPanel, { connection })
							}) : null,
							visited.has("agent-context") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								hidden: page !== "agent-context",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AgentContextSettings, { connection })
							}) : null,
							visited.has("access-approvals") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								hidden: page !== "access-approvals",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccessApprovalsSettings, { connection })
							}) : null,
							visited.has("providers") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								hidden: page !== "providers",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderSettings, { connection })
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("footer", {
								className: AdminConsole_module_css_default.pageFoot,
								children: "Sentinel administration · CITICTEL-CPC"
							})
						]
					})
				]
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
		function AgentContextSettings({ connection }) {
			const [data, setData] = (0, react.useState)(null);
			const [backgroundEnabled, setBackgroundEnabled] = (0, react.useState)(true);
			const [backgroundPrompts, setBackgroundPrompts] = (0, react.useState)("5");
			const [timeEnabled, setTimeEnabled] = (0, react.useState)(true);
			const [timeSeconds, setTimeSeconds] = (0, react.useState)("0");
			const [validation, setValidation] = (0, react.useState)({});
			const [message, setMessage] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(false);
			const load = (0, react.useCallback)(async () => {
				setLoading(true);
				setMessage(null);
				setValidation({});
				try {
					const view = apiValue(await connection.api.settings.describe({}));
					const namespaces = new Map(view.namespaces.map((namespace) => [namespace.ns, namespace]));
					const background = namespaces.get(BACKGROUND_SETTINGS_NAMESPACE);
					const time = namespaces.get(TIME_SETTINGS_NAMESPACE);
					if (!background || !time) throw new Error("Agent context settings are unavailable.");
					const backgroundValue = objectValue(background.value);
					const timeValue = objectValue(time.value);
					setData({
						background,
						time,
						writable: view.writable
					});
					setBackgroundEnabled(backgroundValue.enabled !== false);
					setBackgroundPrompts(String(backgroundValue.repeatEveryUserPrompts ?? 5));
					setTimeEnabled(timeValue.enabled !== false);
					setTimeSeconds(String(Number(timeValue.refreshIntervalMs ?? 0) / 1e3));
				} catch (loadError) {
					setMessage({
						kind: "error",
						text: errorText(loadError)
					});
				} finally {
					setLoading(false);
				}
			}, [connection]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			async function save(event) {
				event.preventDefault();
				if (!data?.writable || loading) return;
				setBusy(true);
				setMessage(null);
				setValidation({});
				try {
					let repeatEveryUserPrompts;
					let seconds;
					const nextValidation = {};
					try {
						repeatEveryUserPrompts = nonNegativeInteger(backgroundPrompts, "BACKGROUND prompt frequency");
					} catch (validationError) {
						nextValidation.background = errorText(validationError);
					}
					try {
						seconds = nonNegativeInteger(timeSeconds, "Time interval", MAX_INTERVAL_SECONDS);
					} catch (validationError) {
						nextValidation.time = errorText(validationError);
					}
					if (nextValidation.background || nextValidation.time || repeatEveryUserPrompts === void 0 || seconds === void 0) {
						setValidation(nextValidation);
						setMessage({
							kind: "error",
							text: "Check the highlighted agent context fields."
						});
						return;
					}
					const backgroundResponse = await connection.api.settings.mutate({
						ns: data.background.ns,
						ops: [{
							op: "set",
							path: ["enabled"],
							value: backgroundEnabled
						}, {
							op: "set",
							path: ["repeatEveryUserPrompts"],
							value: repeatEveryUserPrompts
						}],
						expectedRevision: data.background.revision
					});
					const timeResponse = await connection.api.settings.mutate({
						ns: data.time.ns,
						ops: [{
							op: "set",
							path: ["enabled"],
							value: timeEnabled
						}, {
							op: "set",
							path: ["refreshIntervalMs"],
							value: seconds * 1e3
						}],
						expectedRevision: data.time.revision
					});
					const background = apiValue(backgroundResponse);
					const time = apiValue(timeResponse);
					setData({
						...data,
						background,
						time
					});
					setMessage({
						kind: "success",
						text: "Agent context settings saved."
					});
				} catch (saveError) {
					setMessage({
						kind: "error",
						text: errorText(saveError)
					});
				} finally {
					setBusy(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: AdminConsole_module_css_default.section,
				"aria-labelledby": "agent-context-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AdminConsole_module_css_default.sectionHeading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.sectionKicker,
							children: "Model context"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							id: "agent-context-title",
							className: AdminConsole_module_css_default.sectionTitle,
							children: "Agent context"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: AdminConsole_module_css_default.sectionHint,
							children: "Changes apply live to existing and new sessions."
						})]
					}),
					loading && !data ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: AdminConsole_module_css_default.loadingInline,
						children: "Loading agent context…"
					}) : null,
					loading && data ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: AdminConsole_module_css_default.loadingInline,
						children: "Refreshing agent context…"
					}) : null,
					data ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
						onSubmit: save,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AdminConsole_module_css_default.contextGrid,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
									className: AdminConsole_module_css_default.contextCard,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: AdminConsole_module_css_default.sectionKicker,
												children: "Workspace reference"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "BACKGROUND.md" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "Load this file at session startup and on configured refreshes." })
										] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: AdminConsole_module_css_default.toggleField,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: backgroundEnabled,
												onChange: (event) => setBackgroundEnabled(event.target.checked),
												disabled: !data.writable || busy || loading
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "Inject BACKGROUND.md" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "Disable to stop startup and periodic injections." })] })]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: AdminConsole_module_css_default.field,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Repeat every user prompts" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: AdminConsole_module_css_default.input,
													type: "number",
													min: "0",
													step: "1",
													inputMode: "numeric",
													value: backgroundPrompts,
													onChange: (event) => setBackgroundPrompts(event.target.value),
													"aria-describedby": "background-frequency-help",
													"aria-invalid": validation.background ? "true" : void 0,
													disabled: !data.writable || busy || loading
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
													id: "background-frequency-help",
													className: AdminConsole_module_css_default.fieldHint,
													children: "Use 0 for startup only. The default is every 5 additional user prompts."
												}),
												validation.background ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
													className: AdminConsole_module_css_default.fieldError,
													role: "alert",
													children: validation.background
												}) : null
											]
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
									className: AdminConsole_module_css_default.contextCard,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: AdminConsole_module_css_default.sectionKicker,
												children: "Current clock"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "Time context" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "Supply the model with the current time and elapsed time." })
										] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: AdminConsole_module_css_default.toggleField,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: timeEnabled,
												onChange: (event) => setTimeEnabled(event.target.checked),
												disabled: !data.writable || busy || loading
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "Inject current time" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "Applies on the next eligible model step." })] })]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: AdminConsole_module_css_default.field,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Minimum interval in seconds" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: AdminConsole_module_css_default.input,
													type: "number",
													min: "0",
													max: MAX_INTERVAL_SECONDS,
													step: "1",
													inputMode: "numeric",
													value: timeSeconds,
													onChange: (event) => setTimeSeconds(event.target.value),
													"aria-describedby": "time-frequency-help",
													"aria-invalid": validation.time ? "true" : void 0,
													disabled: !data.writable || busy || loading || !timeEnabled
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
													id: "time-frequency-help",
													className: AdminConsole_module_css_default.fieldHint,
													children: "Use 0 to inject on every eligible model step."
												}),
												validation.time ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
													className: AdminConsole_module_css_default.fieldError,
													role: "alert",
													children: validation.time
												}) : null
											]
										})
									]
								})]
							}),
							message ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: `${AdminConsole_module_css_default.message} ${AdminConsole_module_css_default[message.kind]}`,
								role: message.kind === "error" ? "alert" : "status",
								children: message.text
							}), message.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: AdminConsole_module_css_default.button,
								type: "button",
								onClick: () => void load(),
								children: "Retry"
							}) : null] }) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AdminConsole_module_css_default.actions,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `${AdminConsole_module_css_default.button} ${AdminConsole_module_css_default.primary}`,
									type: "submit",
									disabled: !data.writable || busy || loading,
									children: busy ? "Saving…" : "Save agent context"
								})
							})
						]
					}) : message ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: `${AdminConsole_module_css_default.message} ${AdminConsole_module_css_default[message.kind]}`,
						role: "alert",
						children: message.text
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: AdminConsole_module_css_default.button,
						type: "button",
						onClick: () => void load(),
						children: "Retry"
					})] }) : null
				]
			});
		}
		function defaultToolState(tool) {
			return tool.kind === "read" ? "auto" : "ask";
		}
		function isActionState(value) {
			return value === "ask" || value === "auto" || value === "disabled";
		}
		function AccessApprovalsSettings({ connection }) {
			const [data, setData] = (0, react.useState)(null);
			const [mode, setMode] = (0, react.useState)("soc");
			const [actionStates, setActionStates] = (0, react.useState)({});
			const [message, setMessage] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(false);
			const load = (0, react.useCallback)(async () => {
				setLoading(true);
				setMessage(null);
				try {
					const [described, catalogValue] = await Promise.all([connection.api.settings.describe({}), rpc(connection, "get-admin-action-catalog")]);
					const view = apiValue(described);
					const actionApproval = new Map(view.namespaces.map((namespace) => [namespace.ns, namespace])).get(ACTION_APPROVAL_SETTINGS_NAMESPACE);
					const catalog = objectValue(catalogValue);
					const tools = validCatalog(Array.isArray(catalog.tools) ? catalog.tools : catalog.actions);
					if (!actionApproval || tools.length === 0) throw new Error("Access & approvals settings are unavailable.");
					const saved = objectValue(actionApproval.value);
					const savedStates = objectValue(saved.actionStates);
					const normalizedStates = Object.fromEntries(tools.filter((tool) => tool.kind !== "ui-confirmed").map((tool) => {
						const configured = savedStates[tool.name];
						const state = isActionState(configured) ? configured : defaultToolState(tool);
						return [tool.name, state];
					}));
					setData({
						actionApproval,
						tools,
						writable: view.writable
					});
					setMode(saved.mode === "full" ? "full" : "soc");
					setActionStates(normalizedStates);
				} catch (loadError) {
					setMessage({
						kind: "error",
						text: errorText(loadError)
					});
				} finally {
					setLoading(false);
				}
			}, [connection]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			async function save(event) {
				event.preventDefault();
				if (!data?.writable || loading) return;
				setBusy(true);
				setMessage(null);
				try {
					const actionApproval = apiValue(await connection.api.settings.mutate({
						ns: data.actionApproval.ns,
						ops: [{
							op: "set",
							path: ["mode"],
							value: mode
						}, {
							op: "set",
							path: ["actionStates"],
							value: actionStates
						}],
						expectedRevision: data.actionApproval.revision
					}));
					setData({
						...data,
						actionApproval
					});
					setMessage({
						kind: "success",
						text: "Access & approvals settings saved."
					});
				} catch (saveError) {
					setMessage({
						kind: "error",
						text: errorText(saveError)
					});
				} finally {
					setBusy(false);
				}
			}
			const groups = data ? [...new Set(data.tools.map((tool) => tool.group))] : [];
			const stateLabel = {
				ask: "Ask",
				auto: "Run automatically",
				disabled: "Disabled"
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: AdminConsole_module_css_default.section,
				"aria-labelledby": "access-approvals-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AdminConsole_module_css_default.sectionHeading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.sectionKicker,
							children: "Deployment policy"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							id: "access-approvals-title",
							className: AdminConsole_module_css_default.sectionTitle,
							children: "Access & approvals"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: AdminConsole_module_css_default.sectionHint,
							children: "Changes apply live to existing and new sessions."
						})]
					}),
					loading && !data ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: AdminConsole_module_css_default.loadingInline,
						children: "Loading access controls…"
					}) : null,
					loading && data ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: AdminConsole_module_css_default.loadingInline,
						children: "Refreshing access controls…"
					}) : null,
					data ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
						onSubmit: save,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
								className: AdminConsole_module_css_default.contextCard,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: AdminConsole_module_css_default.sectionKicker,
										children: "Deployment mode"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "How permitted actions run" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "Full access runs non-disabled permitted actions directly. SOC mode follows the action checklist below." }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
										className: AdminConsole_module_css_default.modeChoices,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", {
												className: AdminConsole_module_css_default.srOnly,
												children: "Deployment access mode"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: AdminConsole_module_css_default.modeChoice,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "radio",
													name: "deployment-mode",
													value: "full",
													checked: mode === "full",
													onChange: () => setMode("full"),
													disabled: !data.writable || busy || loading
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "Full access" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "Run every permitted tool directly." })] })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: AdminConsole_module_css_default.modeChoice,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "radio",
													name: "deployment-mode",
													value: "soc",
													checked: mode === "soc",
													onChange: () => setMode("soc"),
													disabled: !data.writable || busy || loading
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "SOC mode" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "Ask or run actions according to the checklist for this deployment." })] })]
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: AdminConsole_module_css_default.fieldHint,
										children: "SOC mode controls only the per-tool ask, auto-run, and disabled states. Email delivery still requires the explicit Send confirmation in the draft view."
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AdminConsole_module_css_default.accessGroups,
								children: groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
									className: AdminConsole_module_css_default.actionGroup,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", { children: group }), data.tools.filter((tool) => tool.group === group).map((tool) => {
										if (tool.kind === "ui-confirmed") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: AdminConsole_module_css_default.actionRow,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: AdminConsole_module_css_default.actionInfo,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: tool.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
													className: AdminConsole_module_css_default.mono,
													children: tool.name
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: AdminConsole_module_css_default.protectedBadge,
												children: "Explicit confirmation"
											})]
										}, tool.name);
										const selected = actionStates[tool.name] ?? defaultToolState(tool);
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: AdminConsole_module_css_default.actionRow,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: AdminConsole_module_css_default.actionInfo,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: tool.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
													className: AdminConsole_module_css_default.mono,
													children: tool.name
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: AdminConsole_module_css_default.actionControls,
												children: [selected === "disabled" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: AdminConsole_module_css_default.unavailableBadge,
													children: "Unavailable"
												}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: AdminConsole_module_css_default.stateChoices,
													role: "group",
													"aria-label": `Access for ${tool.label}`,
													children: [
														"ask",
														"auto",
														"disabled"
													].map((state) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														className: AdminConsole_module_css_default.stateChoice,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															type: "radio",
															name: `action-state-${tool.name}`,
															value: state,
															checked: selected === state,
															onChange: () => setActionStates((current) => ({
																...current,
																[tool.name]: state
															})),
															disabled: !data.writable || busy || loading
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: stateLabel[state] })]
													}, state))
												})]
											})]
										}, tool.name);
									})]
								}, group))
							}),
							message ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: `${AdminConsole_module_css_default.message} ${AdminConsole_module_css_default[message.kind]}`,
								role: message.kind === "error" ? "alert" : "status",
								children: message.text
							}), message.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: AdminConsole_module_css_default.button,
								type: "button",
								onClick: () => void load(),
								children: "Retry"
							}) : null] }) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AdminConsole_module_css_default.actions,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `${AdminConsole_module_css_default.button} ${AdminConsole_module_css_default.primary}`,
									type: "submit",
									disabled: !data.writable || busy || loading,
									children: busy ? "Saving…" : "Save access settings"
								})
							})
						]
					}) : message ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: `${AdminConsole_module_css_default.message} ${AdminConsole_module_css_default[message.kind]}`,
						role: "alert",
						children: message.text
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: AdminConsole_module_css_default.button,
						type: "button",
						onClick: () => void load(),
						children: "Retry"
					})] }) : null
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
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/AuthGate.module.css.mjs
		const css$4 = ".e9h_7W_layer{z-index:10000;color:#eef3f8;pointer-events:auto;background:#0c121cb8;place-items:center;display:grid;position:fixed;inset:0}.e9h_7W_card{background:#182230;border:1px solid #ffffff29;border-radius:14px;width:min(390px,100vw - 40px);padding:28px;box-shadow:0 18px 55px #00000052}.e9h_7W_title{margin:0 0 20px;font-size:20px;font-weight:600}.e9h_7W_field{gap:6px;margin:14px 0;font-size:13px;display:grid}.e9h_7W_input{box-sizing:border-box;width:100%;color:inherit;font:inherit;background:#101923;border:1px solid #fff3;border-radius:8px;padding:10px 11px}.e9h_7W_button{color:#fff;cursor:pointer;width:100%;font:inherit;background:#4b8cf7;border:0;border-radius:8px;margin-top:8px;padding:10px 12px}.e9h_7W_button:disabled{cursor:wait;opacity:.65}.e9h_7W_error{color:#ffb7b7;margin:10px 0;font-size:13px}.e9h_7W_notice{color:#ffe0a6;margin:10px 0;font-size:13px}.e9h_7W_loading{color:#cbd6e2;font-size:14px}.e9h_7W_badge{z-index:10001;color:#dce7f2;pointer-events:auto;background:#182230eb;border:1px solid #ffffff1f;border-radius:999px;align-items:center;gap:10px;padding:6px 9px 6px 11px;font-size:12px;display:flex;position:fixed;top:12px;right:16px}.e9h_7W_logout{color:inherit;cursor:pointer;font:inherit;background:0 0;border:1px solid #fff3;border-radius:6px;padding:3px 7px}";
		const tagId$4 = "dsh-soc-agent-client/AuthGate.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var AuthGate_module_css_default = {
			"badge": "e9h_7W_badge",
			"button": "e9h_7W_button",
			"card": "e9h_7W_card",
			"error": "e9h_7W_error",
			"field": "e9h_7W_field",
			"input": "e9h_7W_input",
			"layer": "e9h_7W_layer",
			"loading": "e9h_7W_loading",
			"logout": "e9h_7W_logout",
			"notice": "e9h_7W_notice",
			"title": "e9h_7W_title"
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
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/EmailDraftToolview.module.css.mjs
		const css$3 = "._2F_7Mq_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l1,transparent);border-radius:10px;margin:6px 0;overflow:hidden}._2F_7Mq_header{background:var(--dsw-alias-surface-l2,transparent);justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;display:flex}._2F_7Mq_title{font-weight:600}._2F_7Mq_account{color:var(--dsw-alias-text-l2);font-size:12px}._2F_7Mq_content{gap:9px;padding:12px;display:grid}._2F_7Mq_field{gap:4px;display:grid}._2F_7Mq_label{color:var(--dsw-alias-text-l2);font-size:12px;font-weight:600}._2F_7Mq_input,._2F_7Mq_textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l0,transparent);width:100%;color:inherit;font:inherit;border-radius:6px;padding:8px 9px}._2F_7Mq_textarea{resize:vertical;min-height:180px;line-height:1.45}._2F_7Mq_input:focus,._2F_7Mq_textarea:focus{outline:2px solid var(--dsw-alias-primary,currentColor);outline-offset:1px}._2F_7Mq_actions{justify-content:flex-end;gap:8px;padding-top:3px;display:flex}._2F_7Mq_signaturePanel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l2,transparent);border-radius:8px;gap:9px;padding:10px;display:grid}._2F_7Mq_button{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l2,transparent);color:inherit;cursor:pointer;font:inherit;border-radius:6px;padding:7px 12px}._2F_7Mq_primary{color:var(--dsw-alias-on-primary,#fff);background:#2563eb;border-color:#2563eb}._2F_7Mq_primary:hover{background:#1d4ed8;border-color:#1d4ed8}._2F_7Mq_danger{color:#fff;background:#dc2626;border-color:#dc2626}._2F_7Mq_danger:hover{background:#b91c1c;border-color:#b91c1c}._2F_7Mq_signatureButton{color:#fff;background:#7c3aed;border-color:#7c3aed}._2F_7Mq_signatureButton:hover{background:#6d28d9;border-color:#6d28d9}._2F_7Mq_button:disabled{cursor:wait;opacity:.6}._2F_7Mq_message{color:var(--dsw-alias-text-l2);padding:10px 12px;font-size:13px}._2F_7Mq_error{color:var(--dsw-alias-danger,#b42318)}";
		const tagId$3 = "dsh-soc-agent-client/EmailDraftToolview.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var EmailDraftToolview_module_css_default = {
			"account": "_2F_7Mq_account",
			"actions": "_2F_7Mq_actions",
			"button": "_2F_7Mq_button",
			"card": "_2F_7Mq_card",
			"content": "_2F_7Mq_content",
			"danger": "_2F_7Mq_danger",
			"error": "_2F_7Mq_error",
			"field": "_2F_7Mq_field",
			"header": "_2F_7Mq_header",
			"input": "_2F_7Mq_input",
			"label": "_2F_7Mq_label",
			"message": "_2F_7Mq_message",
			"primary": "_2F_7Mq_primary",
			"signatureButton": "_2F_7Mq_signatureButton",
			"signaturePanel": "_2F_7Mq_signaturePanel",
			"textarea": "_2F_7Mq_textarea",
			"title": "_2F_7Mq_title"
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
		function resultText(block) {
			if (!("kind" in block)) return "";
			return block.content.filter((item) => item.type === "text").map((item) => item.text).join("");
		}
		function parseEnvelope(block) {
			const text = resultText(block);
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
		const CHANNEL = "/soc-agent-config";
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
			converted = /* @__PURE__ */ new Map();
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
				this.converted.delete(id);
				const drafts = this.drafts.get(sessionId);
				if (drafts?.delete(id)) this.changed();
				if (drafts?.size === 0) this.drafts.delete(sessionId);
			}
			async convert(sessionId, ids, signal) {
				const limits = settingsOf(this.settings);
				const cacheKey = JSON.stringify([limits.maxBytesPerFile, limits.maxCharsPerFile]);
				const results = /* @__PURE__ */ new Map();
				let next = 0;
				let failure;
				const convertOne = async (id) => {
					if (signal.aborted) throw new Error("attachment_conversion_cancelled");
					const document = this.drafts.get(sessionId)?.get(id);
					if (document === void 0) return;
					const cached = this.converted.get(id);
					if (cached?.key === cacheKey) {
						results.set(id, cached.value);
						return;
					}
					this.setStatus(sessionId, id, "converting");
					const localAbort = new AbortController();
					const abort = () => {
						localAbort.abort();
					};
					signal.addEventListener("abort", abort, { once: true });
					this.aborts.set(id, localAbort);
					try {
						const bytes = new Uint8Array(await document.file.arrayBuffer());
						const response = await this.connection.rpc.call(CHANNEL, "convert-attachment", {
							filename: document.file.name,
							content_type: document.file.type,
							data: bytesToBase64(bytes),
							limits: {
								max_bytes: limits.maxBytesPerFile,
								max_chars: limits.maxCharsPerFile
							}
						}, localAbort.signal);
						if (!response?.ok) throw new Error(response?.error?.message || "The attachment conversion failed.");
						const value = response.value;
						if (typeof value?.text !== "string") throw new Error("The converter returned no attachment text.");
						if (!this.drafts.get(sessionId)?.has(id)) return;
						const notice = value.text_truncated === true ? "[Attachment excerpt: text was truncated during conversion.]\n" : "";
						const attachment = {
							id,
							filename: typeof value.filename === "string" ? value.filename : document.file.name,
							markdown: notice + value.text
						};
						this.converted.set(id, {
							key: cacheKey,
							value: attachment
						});
						results.set(id, attachment);
						this.setStatus(sessionId, id, "converted");
					} catch (error) {
						if (localAbort.signal.aborted || signal.aborted) {
							if (!this.drafts.get(sessionId)?.has(id)) return;
							throw new Error("attachment_conversion_cancelled");
						}
						this.setStatus(sessionId, id, "failed", error instanceof Error ? error.message : String(error));
						throw error;
					} finally {
						signal.removeEventListener("abort", abort);
						if (this.aborts.get(id) === localAbort) this.aborts.delete(id);
					}
				};
				const worker = async () => {
					while (next < ids.length && failure === void 0) {
						const id = ids[next++];
						try {
							await convertOne(id);
						} catch (error) {
							failure = error;
						}
					}
				};
				await Promise.all([worker(), worker()]);
				if (failure !== void 0) throw failure;
				if (signal.aborted) throw new Error("attachment_conversion_cancelled");
				const ordered = ids.flatMap((id) => results.has(id) ? [results.get(id)] : []);
				if (ordered.reduce((total, item) => total + item.markdown.length, 0) > limits.maxTotalChars) throw new Error("The attachments exceed the configured Markdown character limit.");
				return ordered;
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
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/MarkItDownDocuments.module.css.mjs
		const css$2 = ".Lt34_a_rail{flex-wrap:wrap;gap:8px;padding:10px 12px 0;display:flex}.Lt34_a_item{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);min-width:0;max-width:min(100%,360px);color:var(--dsw-alias-label-primary);border-radius:8px;align-items:center;gap:7px;padding:6px 8px;font-size:13px;line-height:20px;display:inline-flex}.Lt34_a_icon{flex:none;font-size:14px;line-height:1}.Lt34_a_name{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.Lt34_a_status{color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;font-size:12px}.Lt34_a_remove{width:20px;height:20px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;border-radius:50%;flex:none;padding:0;font-size:18px;line-height:18px}.Lt34_a_remove:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.Lt34_a_remove:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}";
		const tagId$2 = "dsh-soc-agent-client/MarkItDownDocuments.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var MarkItDownDocuments_module_css_default = {
			"icon": "Lt34_a_icon",
			"item": "Lt34_a_item",
			"name": "Lt34_a_name",
			"rail": "Lt34_a_rail",
			"remove": "Lt34_a_remove",
			"status": "Lt34_a_status"
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
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/MarkItDownAttachmentSettings.module.css.mjs
		const css$1 = ".TdgZiW_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.TdgZiW_card:hover,.TdgZiW_cardOpen{border-color:var(--dsw-alias-label-dimmed)}.TdgZiW_cardOpen{background:var(--dsw-alias-bg-layer-2)}.TdgZiW_header{width:100%;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.TdgZiW_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.TdgZiW_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.TdgZiW_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.TdgZiW_description,.TdgZiW_hint,.TdgZiW_invalid{font-size:12px;line-height:1.5}.TdgZiW_description,.TdgZiW_hint{color:var(--dsw-alias-label-tertiary)}.TdgZiW_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.TdgZiW_chevronOpen{transform:rotate(180deg)}.TdgZiW_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.TdgZiW_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.TdgZiW_field+.TdgZiW_field{border-top:1px solid var(--dsw-alias-border-l2)}.TdgZiW_fieldHead{align-items:center;gap:8px;display:flex}.TdgZiW_fieldLabel{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.TdgZiW_badges{align-items:center;gap:8px;display:inline-flex}.TdgZiW_badge{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);white-space:nowrap;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.TdgZiW_reset{color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border:0;padding:0;font-size:12px;line-height:1.5}.TdgZiW_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.TdgZiW_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);width:100%;height:34px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.TdgZiW_input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.TdgZiW_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.TdgZiW_inputInvalid{border-color:var(--dsw-alias-label-error)}.TdgZiW_hint,.TdgZiW_invalid,.TdgZiW_failed{margin:0}.TdgZiW_invalid,.TdgZiW_failed{color:var(--dsw-alias-label-error)}.TdgZiW_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.TdgZiW_failed{flex:1;min-width:0;font-size:12px;line-height:1.5}.TdgZiW_discard,.TdgZiW_save{font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.TdgZiW_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.TdgZiW_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.TdgZiW_discard:disabled,.TdgZiW_save:disabled{opacity:.4;cursor:default}.TdgZiW_discard:focus-visible,.TdgZiW_save:focus-visible,.TdgZiW_reset:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}";
		const tagId$1 = "dsh-soc-agent-client/MarkItDownAttachmentSettings.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var MarkItDownAttachmentSettings_module_css_default = {
			"badge": "TdgZiW_badge",
			"badges": "TdgZiW_badges",
			"body": "TdgZiW_body",
			"card": "TdgZiW_card",
			"cardOpen": "TdgZiW_cardOpen",
			"chevron": "TdgZiW_chevron",
			"chevronOpen": "TdgZiW_chevronOpen",
			"description": "TdgZiW_description",
			"discard": "TdgZiW_discard",
			"failed": "TdgZiW_failed",
			"field": "TdgZiW_field",
			"fieldHead": "TdgZiW_fieldHead",
			"fieldLabel": "TdgZiW_fieldLabel",
			"footer": "TdgZiW_footer",
			"headText": "TdgZiW_headText",
			"header": "TdgZiW_header",
			"hint": "TdgZiW_hint",
			"input": "TdgZiW_input",
			"inputInvalid": "TdgZiW_inputInvalid",
			"invalid": "TdgZiW_invalid",
			"name": "TdgZiW_name",
			"reset": "TdgZiW_reset",
			"save": "TdgZiW_save"
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
		function Chevron({ open }) {
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
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron, { open })]
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
		//#region src/client/actionPolicy.ts
		async function readActionMode(connection, mode) {
			const result = await connection.rpc.call("/soc-agent-config", mode === void 0 ? "get-action-policy" : "set-action-mode", mode === void 0 ? {} : { mode });
			if (!result?.ok) throw new Error(result?.error?.message || "Action settings are unavailable.");
			const value = result.value;
			if (!value || typeof value !== "object" || !("mode" in value) || value.mode !== "soc" && value.mode !== "full") throw new Error("The server returned an invalid access mode.");
			return value.mode;
		}
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/SocActionPolicyMenu.module.css.mjs
		const css = ".X9dZ8W_root{align-items:center;display:inline-flex;position:relative}.X9dZ8W_trigger{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:30px;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;border-radius:8px;align-items:center;gap:6px;padding:0 10px;font-size:12px;display:inline-flex}.X9dZ8W_trigger:hover,.X9dZ8W_trigger[aria-expanded=true]{border-color:var(--dsw-alias-label-dimmed);color:var(--dsw-alias-label-primary)}.X9dZ8W_trigger:focus-visible,.X9dZ8W_modeRadio:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.X9dZ8W_icon{font-size:15px;line-height:1}.X9dZ8W_panel{z-index:20;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:min(380px,100vw - 24px);max-height:min(70vh,560px);box-shadow:var(--dsw-shadow-lv2);border-radius:12px;padding:14px;position:absolute;bottom:calc(100% + 8px);right:0;overflow-y:auto}.X9dZ8W_error,.X9dZ8W_status{color:var(--dsw-alias-label-tertiary);margin:5px 0 0;font-size:11px;line-height:1.5}.X9dZ8W_error{color:var(--dsw-alias-label-error)}.X9dZ8W_modes{border:0;gap:7px;margin-top:12px;padding:0;display:grid}.X9dZ8W_modeLegend{color:var(--dsw-alias-label-secondary);margin:0 0 4px;font-size:11px;font-weight:600}.X9dZ8W_mode{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;align-items:center;gap:8px;padding:8px 9px;font-size:12px;line-height:1.4;display:flex}.X9dZ8W_mode:hover{border-color:var(--dsw-alias-label-dimmed)}.X9dZ8W_modeRadio{width:15px;height:15px;accent-color:var(--dsw-alias-brand-primary);flex:none;margin:0}.X9dZ8W_modeText{gap:2px;display:grid}.X9dZ8W_modeLabel{color:var(--dsw-alias-label-primary);font-weight:600}.X9dZ8W_modeDescription{color:var(--dsw-alias-label-tertiary);font-size:11px}";
		const tagId = "dsh-soc-agent-client/SocActionPolicyMenu.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SocActionPolicyMenu_module_css_default = {
			"error": "X9dZ8W_error",
			"icon": "X9dZ8W_icon",
			"mode": "X9dZ8W_mode",
			"modeDescription": "X9dZ8W_modeDescription",
			"modeLabel": "X9dZ8W_modeLabel",
			"modeLegend": "X9dZ8W_modeLegend",
			"modeRadio": "X9dZ8W_modeRadio",
			"modeText": "X9dZ8W_modeText",
			"modes": "X9dZ8W_modes",
			"panel": "X9dZ8W_panel",
			"root": "X9dZ8W_root",
			"status": "X9dZ8W_status",
			"trigger": "X9dZ8W_trigger"
		};
		//#endregion
		//#region src/client/SocActionPolicyMenu.tsx
		function SocActionPolicyMenu({ connection }) {
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
				readActionMode(connection).then((next) => {
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
			}, [connection, open]);
			const selectMode = async (next) => {
				if (saving || next === mode) return;
				++generation.current;
				setSaving(true);
				setError(void 0);
				try {
					setMode(await readActionMode(connection, next));
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
			const api = connection.api;
			api.folders = void 0;
			const documents = new MarkItDownDocumentController(connection, ctx.settingsScope.bind({ namespace: MARKITDOWN_ATTACHMENTS_NAMESPACE }));
			const settings = new AttachmentSettingsController(ctx.settingsScope.bind({ namespace: MARKITDOWN_ATTACHMENTS_NAMESPACE }));
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
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "soc-action-policy",
				priority: -10
			}, (props) => react.default.createElement(SocActionPolicyMenu, {
				...props,
				connection
			})));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "soc-agent-auth-gate",
				priority: -100
			}, AuthGate));
			installEmailDraftToolview(ctx);
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
		exports.EmailDraftToolview = EmailDraftToolview;
		exports.SplunkSettings = SplunkSettings;
		exports.SubscriptionServerSettings = SubscriptionServerSettings;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
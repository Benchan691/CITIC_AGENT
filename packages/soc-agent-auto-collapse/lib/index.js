import z from "@deepseek-ai/schemastery";
//#region src/settings.ts
const SOC_AUTO_COLLAPSE_NAMESPACE = "dsh-auto-collapse";
const SocAutoCollapseSettingsSchema = z.object({
	enabled: z.boolean().default(true),
	statusText: z.string().default("Deep sleeping...")
});
//#endregion
//#region src/index.ts
function apply(ctx) {
	ctx.inject(["settings"], (scope) => {
		scope.settings.register(SOC_AUTO_COLLAPSE_NAMESPACE, SocAutoCollapseSettingsSchema);
	});
}
//#endregion
export { SOC_AUTO_COLLAPSE_NAMESPACE, SocAutoCollapseSettingsSchema, apply };

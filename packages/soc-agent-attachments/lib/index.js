import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
//#region src/attachment-constants.ts
const DOCUMENT_ATTACHMENTS_NAMESPACE = "soc-agent-document-attachments";
const DEFAULT_DOCUMENT_ATTACHMENT_SETTINGS = {
	maxFiles: 5,
	maxBytesPerFile: 1e7,
	maxTotalBytes: 5e7
};
//#endregion
//#region src/attachment-settings.ts
const DocumentAttachmentSettingsSchema = z.object({
	maxFiles: z.number().step(1).min(1).max(20).default(5),
	maxBytesPerFile: z.number().step(1).min(1).max(1e8).default(1e7),
	maxTotalBytes: z.number().step(1).min(1).max(5e8).default(5e7)
});
//#endregion
//#region src/index.ts
/** Registers the durable attachment settings owned by this optional feature. */
function apply(ctx) {
	ctx.inject(["settings"], async (settingsCtx) => {
		const legacyNamespace = settingsNamespace("soc-agent-markitdown-attachments");
		const legacy = settingsCtx.settings.register(legacyNamespace, z.any());
		const current = settingsCtx.settings.register(settingsNamespace(DOCUMENT_ATTACHMENTS_NAMESPACE), DocumentAttachmentSettingsSchema);
		const descriptors = settingsCtx.settings.describe();
		const old = descriptors.find((item) => item.ns === legacyNamespace)?.user;
		const saved = descriptors.find((item) => item.ns === DOCUMENT_ATTACHMENTS_NAMESPACE)?.user;
		if (old && typeof old === "object" && !saved) {
			const values = old;
			const limits = Object.fromEntries([
				"maxFiles",
				"maxBytesPerFile",
				"maxTotalBytes"
			].flatMap((key) => {
				const value = values[key];
				return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? [[key, value]] : [];
			}));
			await current.update(limits);
			await legacy.replace({});
		}
	});
}
//#endregion
export { DEFAULT_DOCUMENT_ATTACHMENT_SETTINGS, DOCUMENT_ATTACHMENTS_NAMESPACE, apply };

"""Allowlisted model providers and their server-side configuration metadata."""

from __future__ import annotations

MODEL_PROVIDERS: dict[str, dict[str, object]] = {
    "deepseek": {"label": "DeepSeek", "requires_api_key": True},
    "local": {"label": "Local model", "requires_api_key": False},
}


def is_provider(value: object) -> bool:
    return isinstance(value, str) and value.strip().lower() in MODEL_PROVIDERS


def public_provider_config(settings: dict[str, object]) -> dict[str, object]:
    stored_models = settings.get("models", {})
    stored_models = stored_models if isinstance(stored_models, dict) else {}
    default_provider = settings.get("default_provider", "deepseek")
    if not is_provider(default_provider):
        default_provider = "deepseek"
    providers = [
        {
            "id": provider_id,
            "label": str(metadata["label"]),
            "requires_api_key": bool(metadata["requires_api_key"]),
            "configured": bool(
                isinstance(stored_models.get(provider_id), dict)
                and str(stored_models[provider_id].get("api_key", "")).strip()
            ),
        }
        for provider_id, metadata in MODEL_PROVIDERS.items()
    ]
    return {"default_provider": default_provider, "providers": providers}


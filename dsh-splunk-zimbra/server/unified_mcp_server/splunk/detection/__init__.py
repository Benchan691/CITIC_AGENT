"""Splunk Detection capability."""

from .model import DetectionDraft, validate_detection
from .service import SplunkDetectionService

__all__ = ["DetectionDraft", "SplunkDetectionService", "validate_detection"]

"""Splunk Detection capability."""

from .citic_format import (
    REQUIRED_CITIC_FIELDS,
    build_log_event_template,
    extract_final_table_fields,
    validate_citic_detection_spl,
)
from .compiler import compile_citic_detection
from .model import DetectionDraft, validate_detection
from .service import SplunkDetectionService

__all__ = [
    "DetectionDraft",
    "REQUIRED_CITIC_FIELDS",
    "SplunkDetectionService",
    "build_log_event_template",
    "compile_citic_detection",
    "extract_final_table_fields",
    "validate_citic_detection_spl",
    "validate_detection",
]

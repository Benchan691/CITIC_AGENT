"""Splunk Detection capability."""

from .approval import DetectionApproval, DetectionApprovalStore, DetectionChangeProposal
from .model import DetectionDraft, validate_detection
from .service import SplunkDetectionService

__all__ = [
    "DetectionApproval",
    "DetectionApprovalStore",
    "DetectionChangeProposal",
    "DetectionDraft",
    "SplunkDetectionService",
    "validate_detection",
]

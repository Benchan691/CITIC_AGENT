import json
from pathlib import Path


def test_langgraph_config_exposes_incident_agent():
    config = json.loads((Path(__file__).parents[1] / "langgraph.json").read_text())

    assert config["graphs"]["incident_agent"].endswith("langgraph_app.py:agent")
    assert config["env"] == "./.env"

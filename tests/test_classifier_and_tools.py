import pytest
from backend.app.tools.datetime_tool import get_current_datetime_info
from backend.app.tools.code_interpreter import execute_python_code
from backend.app.tools.wikipedia_tool import search_wikipedia_encyclopedia
from backend.app.tools.url_reader import read_url_content
from backend.app.tools.classifier import classify_request


def test_datetime_tool():
    info = get_current_datetime_info()
    assert "human" in info
    assert "local_iso" in info
    assert "utc_iso" in info
    assert "timezone" in info
    assert len(info["human"]) > 5


def test_code_interpreter_safe_math():
    code = "x = 10\ny = 25\nprint(x * y)"
    res = execute_python_code(code)
    assert res["success"] is True
    assert "250" in res["output"]


def test_code_interpreter_blocks_unsafe_imports():
    code = "import os\nos.system('dir')"
    res = execute_python_code(code)
    assert res["success"] is False
    assert "Security restriction" in res["error"] or "prohibited" in res["error"]


def test_classifier_math_intent():
    res = classify_request("what is 144 / 12 + 8?")
    assert "calculator" in res["tools"]
    assert res["extracted"]["math_expression"] is not None


def test_classifier_datetime_intent():
    res = classify_request("what is today's date and current time?")
    assert "datetime" in res["tools"]
    assert res["primary_intent"] == "datetime"


def test_classifier_youtube_intent():
    res = classify_request("summarize this video https://www.youtube.com/watch?v=dQw4w9WgXcQ please")
    assert "youtube" in res["tools"]
    assert len(res["extracted"]["youtube_urls"]) == 1


def test_classifier_direct_url_intent():
    res = classify_request("read the contents of https://en.wikipedia.org/wiki/Artificial_intelligence")
    assert "url_reader" in res["tools"]
    assert len(res["extracted"]["direct_urls"]) == 1


def test_classifier_code_execution_intent():
    res = classify_request("run this python code:\n```python\nprint(sum([1,2,3,4]))\n```")
    assert "code_interpreter" in res["tools"]
    assert res["extracted"]["code_snippet"] is not None


def test_classifier_web_search_intent():
    res = classify_request("what is the latest price of bitcoin today?")
    assert "web_search" in res["tools"]

import pytest
from backend.app.tools.calculator import safe_calculate, extract_math_expression
from backend.app.tools.web_search import web_search


def test_calculator_basic_arithmetic():
    res = safe_calculate("2 + 2")
    assert res["success"] is True
    assert res["result"] == 4


def test_calculator_complex_operations():
    res = safe_calculate("sqrt(144) * 5 + (100 / 4)")
    assert res["success"] is True
    assert res["result"] == 85


def test_calculator_division_by_zero():
    res = safe_calculate("10 / 0")
    assert res["success"] is False
    assert "Division by zero" in res["error"]


def test_extract_math_expression():
    assert extract_math_expression("what is 2+2?") == "2+2"
    assert extract_math_expression("calculate 15 * 8 / 2") == "15 * 8 / 2"
    assert extract_math_expression("evaluate sqrt(16) + 4") == "sqrt(16) + 4"
    assert extract_math_expression("what is 20 percent of 150") == "(20/100)*150"
    assert extract_math_expression("square root of 144") == "sqrt(144)"
    assert extract_math_expression("10 plus 25") == "10 + 25"
    assert extract_math_expression("Who is the president of France?") is None


def test_web_search_tool():
    res = web_search("Python programming language")
    assert res["tool"] == "web_search"
    assert "results" in res

import ast
import math
import operator
import re
from typing import Dict, Any, Optional

# Supported operators for safe AST evaluation
SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

SAFE_FUNCTIONS = {
    "abs": abs,
    "round": round,
    "sqrt": math.sqrt,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "log": math.log,
    "log10": math.log10,
    "exp": math.exp,
    "floor": math.floor,
    "ceil": math.ceil,
}

SAFE_CONSTANTS = {
    "pi": math.pi,
    "e": math.e,
}


def _eval_node(node: ast.AST) -> float:
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return float(node.value)
        raise ValueError(f"Unsupported constant type: {type(node.value)}")

    if isinstance(node, ast.UnaryOp):
        op_type = type(node.op)
        if op_type in SAFE_OPERATORS:
            operand = _eval_node(node.operand)
            return SAFE_OPERATORS[op_type](operand)
        raise ValueError(f"Unsupported unary operator: {op_type}")

    if isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type in SAFE_OPERATORS:
            left = _eval_node(node.left)
            right = _eval_node(node.right)
            if op_type in (ast.Div, ast.FloorDiv, ast.Mod) and right == 0:
                raise ZeroDivisionError("Division by zero in calculation")
            return SAFE_OPERATORS[op_type](left, right)
        raise ValueError(f"Unsupported binary operator: {op_type}")

    if isinstance(node, ast.Call):
        if isinstance(node.func, ast.Name) and node.func.id in SAFE_FUNCTIONS:
            func = SAFE_FUNCTIONS[node.func.id]
            args = [_eval_node(arg) for arg in node.args]
            return float(func(*args))
        raise ValueError(f"Unsupported function call in calculation")

    if isinstance(node, ast.Name):
        if node.id in SAFE_CONSTANTS:
            return SAFE_CONSTANTS[node.id]
        raise ValueError(f"Unknown variable in calculation: {node.id}")

    raise ValueError(f"Unsupported AST node type: {type(node)}")


def extract_math_expression(query: str) -> Optional[str]:
    """
    Detects and extracts mathematical expressions from user queries:
    e.g., 'what is 2 + 2?', 'calculate 15 * 40 / 2', 'sqrt(144) + 10',
    '20 percent of 150', '5 plus 12 times 3', 'square root of 144'
    """
    cleaned = query.strip()
    
    # 1. Normalize natural language math phrasing
    norm = cleaned.lower()
    norm = re.sub(r"^(?:what\s+is|calculate|evaluate|compute|solve|how\s+much\s+is|find)\s+", "", norm, flags=re.IGNORECASE)
    norm = norm.rstrip("?=. ")
    norm = re.sub(r"(\d+(?:\.\d+)?)\s*%\s+of\s+(\d+(?:\.\d+)?)", r"(\1/100)*\2", norm)
    norm = re.sub(r"(\d+(?:\.\d+)?)\s+percent\s+of\s+(\d+(?:\.\d+)?)", r"(\1/100)*\2", norm)
    norm = re.sub(r"square\s+root\s+of\s+(\d+(?:\.\d+)?)", r"sqrt(\1)", norm)
    norm = re.sub(r"\bplus\b", "+", norm)
    norm = re.sub(r"\bminus\b", "-", norm)
    norm = re.sub(r"\bmultiplied\s+by\b|\btimes\b", "*", norm)
    norm = re.sub(r"\bdivided\s+by\b", "/", norm)
    norm = re.sub(r"\bto\s+the\s+power\s+of\b", "**", norm)
    norm = norm.replace("^", "**").strip()

    # 2. Check if the normalized string consists of valid math tokens and numbers
    if re.search(r"\d", norm):
        math_chars_only = re.match(r"^[0-9\.\s\+\-\*\/\%\(\)\^eEpisqrtcosinlogtan\,]+$", norm)
        if math_chars_only:
            # Check if it has an operator or mathematical function or single number calculation
            if re.search(r"[\+\-\*\/\%\^\(\)]|sqrt|sin|cos|tan|log", norm):
                return norm

    # 3. Direct math string regex match
    direct_match = re.match(r"^([0-9\.\s\+\-\*\/\%\(\)\^eEpisqrtcosinlogtan\,]+)$", cleaned)
    if direct_match and re.search(r"[\+\-\*\/\%]", cleaned):
        expr = direct_match.group(1).replace("^", "**")
        return expr.strip()

    # 4. Query with prefix
    prefix_match = re.search(
        r"(?:what\s+is|calculate|evaluate|compute|solve|how\s+much\s+is)\s+([0-9\.\s\+\-\*\/\%\(\)\^eEpisqrtcosinlogtan\,]+)\??",
        cleaned,
        re.IGNORECASE,
    )
    if prefix_match:
        expr = prefix_match.group(1).replace("^", "**").strip()
        if re.search(r"[0-9]", expr):
            return expr

    return None


def safe_calculate(expression: str) -> Dict[str, Any]:
    """
    Safely evaluates a mathematical expression using AST parsing.
    NO unsafe eval() is used.
    """
    clean_expr = expression.strip().replace("^", "**")
    try:
        parsed = ast.parse(clean_expr, mode="eval")
        result = _eval_node(parsed.body)
        formatted_res = int(result) if result.is_integer() else round(result, 6)
        return {
            "tool": "calculator",
            "success": True,
            "expression": expression,
            "result": formatted_res,
            "formatted": f"{expression.strip()} = {formatted_res}",
        }
    except Exception as exc:
        return {
            "tool": "calculator",
            "success": False,
            "expression": expression,
            "error": str(exc),
        }

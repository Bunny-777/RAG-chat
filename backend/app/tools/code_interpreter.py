import io
import sys
import contextlib
import traceback
from typing import Dict, Any, Optional
from backend.app.core.logging import get_logger

logger = get_logger(__name__)

# Safe builtins allowed in interpreter execution
SAFE_BUILTINS = {
    "abs": abs,
    "all": all,
    "any": any,
    "ascii": ascii,
    "bin": bin,
    "bool": bool,
    "chr": chr,
    "dict": dict,
    "divmod": divmod,
    "enumerate": enumerate,
    "filter": filter,
    "float": float,
    "format": format,
    "frozenset": frozenset,
    "hex": hex,
    "int": int,
    "isinstance": isinstance,
    "issubclass": issubclass,
    "iter": iter,
    "len": len,
    "list": list,
    "map": map,
    "max": max,
    "min": min,
    "next": next,
    "oct": oct,
    "ord": ord,
    "pow": pow,
    "print": print,
    "range": range,
    "repr": repr,
    "reversed": reversed,
    "round": round,
    "set": set,
    "slice": slice,
    "sorted": sorted,
    "str": str,
    "sum": sum,
    "tuple": tuple,
    "zip": zip,
}


def execute_python_code(code: str, max_output_chars: int = 4000) -> Dict[str, Any]:
    """
    Code Interpreter Tool: Executes Python code in a sandboxed execution context.
    Captures stdout, return values, and errors.
    """
    logger.info(f"Executing Python code ({len(code)} chars)")

    # Disallow hazardous modules or system operations
    forbidden = ["os.", "sys.", "subprocess", "shutil", "__import__", "open(", "eval(", "exec("]
    for word in forbidden:
        if word in code:
            return {
                "tool": "code_interpreter",
                "success": False,
                "error": f"Security restriction: '{word}' is not allowed in code interpreter.",
                "output": "",
            }

    stdout_buffer = io.StringIO()
    local_scope: Dict[str, Any] = {}
    global_scope: Dict[str, Any] = {
        "__builtins__": SAFE_BUILTINS,
        "math": __import__("math"),
        "random": __import__("random"),
        "datetime": __import__("datetime"),
        "json": __import__("json"),
        "re": __import__("re"),
    }

    try:
        with contextlib.redirect_stdout(stdout_buffer):
            # Compile and execute
            compiled = compile(code, "<code_interpreter>", "exec")
            exec(compiled, global_scope, local_scope)

        output = stdout_buffer.getvalue().strip()
        if len(output) > max_output_chars:
            output = output[:max_output_chars] + f"\n... [Output truncated at {max_output_chars} characters]"

        # Also collect any returned variables or results
        result_vars = {
            k: v
            for k, v in local_scope.items()
            if not k.startswith("_") and not callable(v)
        }

        return {
            "tool": "code_interpreter",
            "success": True,
            "output": output or "Code executed successfully with no stdout.",
            "variables": {k: str(v) for k, v in result_vars.items() if len(str(v)) < 500},
        }
    except Exception as exc:
        err_msg = traceback.format_exc()
        logger.warning(f"Code interpreter error: {exc}")
        return {
            "tool": "code_interpreter",
            "success": False,
            "error": str(exc),
            "traceback": err_msg.splitlines()[-1] if err_msg else str(exc),
            "output": stdout_buffer.getvalue().strip(),
        }

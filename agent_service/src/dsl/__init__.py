"""DSL package — formal language for deterministic reasoning."""
from .grammar import DSLGrammar
from .parser import DSLParser, ParseError
from .evaluator import DSLEvaluator, EvaluationContext
from .translator import DSLTranslator
from .guardrails import (
    canonicalize_single_statement_dsl,
    is_direct_negation_pair,
    evaluate_statement_against_context,
)
from .syntax_reference import (
    DSL_SYNTAX_REFERENCE,
    DSL_QUICK_REFERENCE,
    DSL_TRANSLATION_CONVENTIONS,
    DSL_EXAMPLES,
    DSL_AOP_MANIPULATION_REFERENCE,
    get_dsl_prompt_context,
    get_dsl_quick_ref,
    get_dsl_full_context,
    get_aop_manipulation_ref,
)

__all__ = [
    "DSLGrammar",
    "DSLParser",
    "ParseError",
    "DSLEvaluator",
    "EvaluationContext",
    "DSLTranslator",
    "canonicalize_single_statement_dsl",
    "is_direct_negation_pair",
    "evaluate_statement_against_context",
    "DSL_SYNTAX_REFERENCE",
    "DSL_QUICK_REFERENCE",
    "DSL_TRANSLATION_CONVENTIONS",
    "DSL_EXAMPLES",
    "DSL_AOP_MANIPULATION_REFERENCE",
    "get_dsl_prompt_context",
    "get_dsl_quick_ref",
    "get_dsl_full_context",
    "get_aop_manipulation_ref",
]

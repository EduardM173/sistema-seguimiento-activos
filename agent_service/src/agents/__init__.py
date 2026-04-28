"""
Agentic Symbolic Logic Evaluator Engine
=======================================
LlamaIndex-based agents for formal reasoning and deduction
with PropertyGraphIndex RAG and Z3 theorem proving.
"""
from .property_graphs import (
    PropertyGraphManager,
    AxiomsGraph,
    DeductionRulesGraph,
    BusinessDomainGraph,
    TheoremsGraph,
)
from .z3_engine import Z3ProofEngine, ProofResult, ContradictionError
from .tools import (
    RetrieveAxiomsTool,
    RetrieveDeductionRulesTool,
    RetrieveBusinessFactsTool,
    RetrieveTheoremsTool,
    RunZ3ProofTool,
    StoreTheoremTool,
    StoreBusinessFactTool,
)
from .reasoning_agent import ReasoningAgent, ReasoningResult
from .chat_reasoning_agent import ChatReasoningAgent, ChatReasoningResult
from .user_state_agent import UserStateAgent
from .ingestion_agents import (
    ChatIngestionAgent,
    DocumentIngestionAgent,
    JiraIngestionAgent,
    AOPValidationAgent,
)
from .contradiction_resolver import ContradictionResolver, ResolutionResult
from .aop_deduction_rules import (
    DeductionRule,
    RuleCategory,
    ALL_FOUNDATIONAL_RULES,
    LOGICAL_SIMPLIFICATION_RULES,
    AOP_COMBINATION_RULES,
    AOP_SIMPLIFICATION_RULES,
    CONNECTION_DEDUCTION_RULES,
    IMPLICATION_EXTRACTION_RULES,
    QUANTIFIER_MANIPULATION_RULES,
    PROCEDURE_TRANSFORMATION_RULES,
    get_rules_by_category,
    get_rule_by_name,
    register_foundational_rules,
    get_foundational_rules_dsl,
    get_foundational_rules_summary,
    AOP_DEDUCTION_PROMPT_CONTEXT,
)
from .aop_simplifier import (
    AOPSimplifier,
    AOPOperations,
    SimplificationResult,
    RewriteRule,
    RuleCategory as SimplifierRuleCategory,
    # Tool entry points
    simplify_aop,
    combine_aops,
    negate_aop,
    substitute_in_aop,
    convert_to_cnf,
    # AST utilities
    ast_to_dsl,
    ast_equal,
)
from .tools import (
    # AOP simplifier tools
    SimplifyAOPTool,
    CombineAOPsTool,
    NegateAOPTool,
    SubstituteAOPTool,
    ConvertToCNFTool,
)

__all__ = [
    # Property Graphs
    "PropertyGraphManager",
    "AxiomsGraph",
    "DeductionRulesGraph", 
    "BusinessDomainGraph",
    "TheoremsGraph",
    # Z3 Engine
    "Z3ProofEngine",
    "ProofResult",
    "ContradictionError",
    # Tools
    "RetrieveAxiomsTool",
    "RetrieveDeductionRulesTool",
    "RetrieveBusinessFactsTool",
    "RetrieveTheoremsTool",
    "RunZ3ProofTool",
    "StoreTheoremTool",
    "StoreBusinessFactTool",
    # Agents
    "ReasoningAgent",
    "ReasoningResult",
    "ChatReasoningAgent",
    "ChatReasoningResult",
    "UserStateAgent",
    "ChatIngestionAgent",
    "DocumentIngestionAgent",
    "JiraIngestionAgent",
    "AOPValidationAgent",
    "ContradictionResolver",
    "ResolutionResult",
    # AOP Deduction Rules
    "DeductionRule",
    "RuleCategory",
    "ALL_FOUNDATIONAL_RULES",
    "LOGICAL_SIMPLIFICATION_RULES",
    "AOP_COMBINATION_RULES",
    "AOP_SIMPLIFICATION_RULES",
    "CONNECTION_DEDUCTION_RULES",
    "IMPLICATION_EXTRACTION_RULES",
    "QUANTIFIER_MANIPULATION_RULES",
    "PROCEDURE_TRANSFORMATION_RULES",
    "get_rules_by_category",
    "get_rule_by_name",
    "register_foundational_rules",
    "get_foundational_rules_dsl",
    "get_foundational_rules_summary",
    "AOP_DEDUCTION_PROMPT_CONTEXT",
    # AOP Symbolic Simplifier
    "AOPSimplifier",
    "AOPOperations",
    "SimplificationResult",
    "RewriteRule",
    "SimplifierRuleCategory",
    "simplify_aop",
    "combine_aops",
    "negate_aop",
    "substitute_in_aop",
    "convert_to_cnf",
    "ast_to_dsl",
    "ast_equal",
    # AOP Simplifier Tools
    "SimplifyAOPTool",
    "CombineAOPsTool",
    "NegateAOPTool",
    "SubstituteAOPTool",
    "ConvertToCNFTool",
]

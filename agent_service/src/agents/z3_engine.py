"""
Z3 Proof Engine Integration
===========================
Wraps the Z3 theorem prover for formal verification of logical
expressions derived from the DSL.

The Z3 engine is used to:
1. Verify consistency of axioms and rules
2. Check for contradictions when adding new facts/theorems
3. Perform formal proofs combining axioms, rules, and domain facts
4. Validate AOP procedures for logical correctness
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from z3 import (
    Solver,
    Bool,
    Int,
    Real,
    String,
    And,
    Or,
    Not,
    Implies,
    ForAll,
    Exists,
    Const,
    Function,
    DeclareSort,
    sat,
    unsat,
    unknown,
    BoolSort,
    IntSort,
    RealSort,
    StringSort,
    ArraySort,
    simplify,
    substitute,
    is_true,
    is_false,
    BoolVal,
    IntVal,
    RealVal,
    StringVal,
)

from ..dsl.parser import (
    AxiomNode,
    RuleNode,
    BinaryOpNode,
    NotNode,
    PredicateNode,
    VarNode,
    LiteralNode,
    QuantifiedNode,
)

logger = logging.getLogger(__name__)


class ProofStatus(str, Enum):
    """Result status of a Z3 proof attempt."""
    VALID = "valid"           # Formula is valid (proven true)
    INVALID = "invalid"       # Formula is invalid (counterexample exists)
    UNKNOWN = "unknown"       # Z3 could not determine
    CONTRADICTION = "contradiction"  # Contradiction detected
    TIMEOUT = "timeout"       # Proof timed out
    ERROR = "error"           # Error during proof


class ContradictionError(Exception):
    """Raised when a logical contradiction is detected."""
    
    def __init__(
        self,
        message: str,
        conflicting_formulas: list[str] | None = None,
        proof_trace: list[str] | None = None,
    ) -> None:
        super().__init__(message)
        self.conflicting_formulas = conflicting_formulas or []
        self.proof_trace = proof_trace or []


@dataclass
class ProofResult:
    """Result of a Z3 proof attempt."""
    status: ProofStatus
    message: str
    proof_trace: list[str] = field(default_factory=list)
    model: dict[str, Any] | None = None  # Counterexample if invalid
    used_axioms: list[str] = field(default_factory=list)
    used_rules: list[str] = field(default_factory=list)
    z3_statistics: dict[str, Any] = field(default_factory=dict)
    
    @property
    def is_valid(self) -> bool:
        return self.status == ProofStatus.VALID
    
    @property
    def is_contradiction(self) -> bool:
        return self.status == ProofStatus.CONTRADICTION


class Z3ProofEngine:
    """
    Formal proof engine using Z3.
    
    Provides methods to:
    - Translate DSL expressions to Z3 formulas
    - Check satisfiability and validity
    - Perform deductions using axioms and rules
    - Detect contradictions
    """
    
    def __init__(self, timeout_ms: int = 30000) -> None:
        self._timeout_ms = timeout_ms
        self._sorts: dict[str, Any] = {}
        self._functions: dict[str, Any] = {}
        self._variables: dict[str, Any] = {}
        self._axioms: dict[str, Any] = {}
        self._rules: dict[str, Any] = {}
        
        # Initialize common sorts
        self._init_sorts()
    
    def _init_sorts(self) -> None:
        """Initialize common Z3 sorts."""
        self._sorts["Entity"] = DeclareSort("Entity")
        self._sorts["Property"] = DeclareSort("Property")
        self._sorts["Action"] = DeclareSort("Action")
    
    def _get_or_create_variable(self, name: str, sort: str = "Bool") -> Any:
        """Get or create a Z3 variable."""
        key = f"{sort}:{name}"
        if key in self._variables:
            return self._variables[key]
        
        if sort == "Bool":
            var = Bool(name)
        elif sort == "Int":
            var = Int(name)
        elif sort == "Real":
            var = Real(name)
        elif sort == "String":
            var = String(name)
        elif sort in self._sorts:
            var = Const(name, self._sorts[sort])
        else:
            var = Bool(name)  # Default to Bool
        
        self._variables[key] = var
        return var
    
    def _get_or_create_function(self, name: str, *arg_sorts, return_sort="Bool") -> Any:
        """Get or create a Z3 uninterpreted function."""
        arg_sig = ",".join(str(s) for s in arg_sorts)
        key = f"{name}({arg_sig})->{return_sort}"
        if key in self._functions:
            return self._functions[key]
        
        z3_arg_sorts = []
        for s in arg_sorts:
            if s == "Bool":
                z3_arg_sorts.append(BoolSort())
            elif s == "Int":
                z3_arg_sorts.append(IntSort())
            elif s == "Real":
                z3_arg_sorts.append(RealSort())
            elif s == "String":
                z3_arg_sorts.append(StringSort())
            elif s in self._sorts:
                z3_arg_sorts.append(self._sorts[s])
            else:
                z3_arg_sorts.append(BoolSort())
        
        if return_sort == "Bool":
            z3_return = BoolSort()
        elif return_sort == "Int":
            z3_return = IntSort()
        else:
            z3_return = BoolSort()
        
        func = Function(name, *z3_arg_sorts, z3_return)
        self._functions[key] = func
        return func

    def _collect_free_vars(self, node: Any, bound: set[str] | None = None) -> set[str]:
        """Collect free variable names (?x) in an AST node."""
        if bound is None:
            bound = set()

        if isinstance(node, VarNode):
            return {node.name} if node.name not in bound else set()

        if isinstance(node, LiteralNode):
            return set()

        if isinstance(node, PredicateNode):
            free: set[str] = set()
            for arg in node.args:
                free |= self._collect_free_vars(arg, bound)
            return free

        if isinstance(node, NotNode):
            return self._collect_free_vars(node.operand, bound)

        if isinstance(node, BinaryOpNode):
            return self._collect_free_vars(node.left, bound) | self._collect_free_vars(node.right, bound)

        if isinstance(node, QuantifiedNode):
            new_bound = set(bound)
            for v in node.variables:
                new_bound.add(v)
            return self._collect_free_vars(node.body, new_bound)

        if isinstance(node, AxiomNode):
            return self._collect_free_vars(node.expr, bound)

        if isinstance(node, RuleNode):
            free: set[str] = set()
            for premise in node.premises:
                free |= self._collect_free_vars(premise, bound)
            free |= self._collect_free_vars(node.conclusion, bound)
            return free

        return set()

    def _translate_predicate_arg_to_entity(self, node: Any) -> Any:
        """Translate an argument position term to an Entity-sorted symbol."""
        if isinstance(node, VarNode):
            return self._get_or_create_variable(node.name, "Entity")

        if isinstance(node, LiteralNode):
            # Predicate arguments in this DSL are modeled as domain entities.
            if isinstance(node.value, str):
                return self._get_or_create_variable(node.value, "Entity")
            return self._get_or_create_variable(str(node.value), "Entity")

        if isinstance(node, PredicateNode) and not node.args:
            # Bare identifiers used as arguments (e.g., CanFly(Giraffe)).
            return self._get_or_create_variable(node.name, "Entity")

        # Fallback: reuse regular translation and coerce only if needed.
        translated = self.translate_dsl_to_z3(node)
        try:
            if str(translated.sort()) == str(self._sorts["Entity"]):
                return translated
        except Exception:
            pass
        return self._get_or_create_variable(str(node), "Entity")
    
    def translate_dsl_to_z3(self, node: Any) -> Any:
        """
        Translate a DSL AST node to a Z3 formula.
        
        Handles:
        - Axioms, Rules (as implications)
        - Binary operators (AND, OR, IMPLIES, etc.)
        - Negation
        - Predicates (as uninterpreted functions)
        - Variables (as Z3 constants)
        - Quantifiers (FORALL, EXISTS)
        """
        if isinstance(node, AxiomNode):
            expr_z3 = self.translate_dsl_to_z3(node.expr)
            free_vars = sorted(self._collect_free_vars(node.expr))
            if free_vars:
                vars_z3 = [self._get_or_create_variable(v, "Entity") for v in free_vars]
                return ForAll(vars_z3, expr_z3)
            return expr_z3
        
        if isinstance(node, RuleNode):
            premises = [self.translate_dsl_to_z3(p) for p in node.premises]
            conclusion = self.translate_dsl_to_z3(node.conclusion)
            free_vars = sorted(self._collect_free_vars(node))
            if len(premises) == 1:
                rule_expr = Implies(premises[0], conclusion)
            else:
                rule_expr = Implies(And(*premises), conclusion)

            if free_vars:
                vars_z3 = [self._get_or_create_variable(v, "Entity") for v in free_vars]
                return ForAll(vars_z3, rule_expr)
            return rule_expr
        
        if isinstance(node, BinaryOpNode):
            left = self.translate_dsl_to_z3(node.left)
            right = self.translate_dsl_to_z3(node.right)
            
            op = node.op.upper()
            if op in ("AND", "∧", "&"):
                return And(left, right)
            elif op in ("OR", "∨", "|"):
                return Or(left, right)
            elif op in ("IMPLIES", "→", "->", "=>"):
                return Implies(left, right)
            elif op in ("IFF", "↔", "<->", "<=>"):
                return And(Implies(left, right), Implies(right, left))
            elif op in ("XOR", "⊕"):
                return Or(And(left, Not(right)), And(Not(left), right))
            else:
                logger.warning(f"Unknown binary operator: {op}")
                return And(left, right)
        
        if isinstance(node, NotNode):
            operand = self.translate_dsl_to_z3(node.operand)
            return Not(operand)
        
        if isinstance(node, PredicateNode):
            if not node.args:
                return self._get_or_create_variable(node.name)
            
            arg_z3 = [self._translate_predicate_arg_to_entity(a) for a in node.args]
            func = self._get_or_create_function(
                node.name,
                *["Entity"] * len(arg_z3),
            )
            return func(*arg_z3)
        
        if isinstance(node, VarNode):
            return self._get_or_create_variable(node.name, "Entity")
        
        if isinstance(node, LiteralNode):
            if isinstance(node.value, bool):
                return BoolVal(node.value)
            if isinstance(node.value, int):
                return IntVal(node.value)
            if isinstance(node.value, float):
                return RealVal(str(node.value))
            if isinstance(node.value, str):
                return StringVal(node.value)
            return self._get_or_create_variable(str(node.value))
        
        if isinstance(node, QuantifiedNode):
            vars_z3 = [
                self._get_or_create_variable(v, "Entity")
                for v in node.variables
            ]
            body_z3 = self.translate_dsl_to_z3(node.body)
            
            if node.quantifier.upper() == "FORALL":
                return ForAll(vars_z3, body_z3)
            elif node.quantifier.upper() == "EXISTS":
                return Exists(vars_z3, body_z3)
        
        # Fallback: treat as a boolean variable
        return self._get_or_create_variable(str(node))
    
    def translate_dsl_text_to_z3(self, dsl_text: str) -> Any:
        """
        Translate DSL source text to Z3 formula.
        
        Parses the DSL text first, then translates.
        """
        from ..dsl import DSLParser
        parser = DSLParser()
        
        try:
            ast_nodes = parser.parse(dsl_text)
            if ast_nodes:
                return self.translate_dsl_to_z3(ast_nodes[0])
        except Exception as e:
            logger.error(f"Failed to parse DSL text: {e}")
            raise
        
        return None
    
    def register_axiom(self, name: str, formula: Any) -> None:
        """Register an axiom for use in proofs."""
        self._axioms[name] = formula
        logger.debug(f"Registered axiom: {name}")
    
    def register_rule(self, name: str, formula: Any) -> None:
        """Register a deduction rule for use in proofs."""
        self._rules[name] = formula
        logger.debug(f"Registered rule: {name}")
    
    def check_satisfiability(
        self,
        formula: Any,
        assumptions: list[Any] | None = None,
    ) -> ProofResult:
        """
        Check if a formula is satisfiable.
        
        Returns ProofResult with:
        - VALID if satisfiable
        - INVALID if unsatisfiable (contradiction)
        - UNKNOWN if undeterminable
        """
        solver = Solver()
        solver.set("timeout", self._timeout_ms)
        
        # Add assumptions (axioms, rules, facts)
        if assumptions:
            for a in assumptions:
                solver.add(a)
        
        solver.add(formula)
        
        proof_trace = [f"Checking satisfiability of: {formula}"]
        
        result = solver.check()
        
        if result == sat:
            model = solver.model()
            model_dict = {}
            for d in model.decls():
                model_dict[str(d)] = str(model[d])
            
            return ProofResult(
                status=ProofStatus.VALID,
                message="Formula is satisfiable",
                proof_trace=proof_trace + ["Result: SAT"],
                model=model_dict,
                z3_statistics=self._get_stats(solver),
            )
        elif result == unsat:
            return ProofResult(
                status=ProofStatus.INVALID,
                message="Formula is unsatisfiable (contradiction)",
                proof_trace=proof_trace + ["Result: UNSAT"],
                z3_statistics=self._get_stats(solver),
            )
        else:
            return ProofResult(
                status=ProofStatus.UNKNOWN,
                message="Satisfiability could not be determined",
                proof_trace=proof_trace + ["Result: UNKNOWN"],
                z3_statistics=self._get_stats(solver),
            )
    
    def check_validity(
        self,
        formula: Any,
        assumptions: list[Any] | None = None,
    ) -> ProofResult:
        """
        Check if a formula is valid (always true).
        
        A formula is valid iff its negation is unsatisfiable.
        """
        solver = Solver()
        solver.set("timeout", self._timeout_ms)
        
        # Add assumptions
        if assumptions:
            for a in assumptions:
                solver.add(a)
        
        # Check if NOT(formula) is unsat => formula is valid
        solver.add(Not(formula))
        
        proof_trace = [f"Checking validity of: {formula}"]
        
        result = solver.check()
        
        if result == unsat:
            return ProofResult(
                status=ProofStatus.VALID,
                message="Formula is valid (proven true)",
                proof_trace=proof_trace + ["Negation is UNSAT => Formula is VALID"],
                z3_statistics=self._get_stats(solver),
            )
        elif result == sat:
            model = solver.model()
            model_dict = {}
            for d in model.decls():
                model_dict[str(d)] = str(model[d])
            
            return ProofResult(
                status=ProofStatus.INVALID,
                message="Formula is invalid (counterexample found)",
                proof_trace=proof_trace + ["Negation is SAT => Formula is INVALID"],
                model=model_dict,
                z3_statistics=self._get_stats(solver),
            )
        else:
            return ProofResult(
                status=ProofStatus.UNKNOWN,
                message="Validity could not be determined",
                proof_trace=proof_trace + ["Result: UNKNOWN"],
                z3_statistics=self._get_stats(solver),
            )
    
    def prove_with_context(
        self,
        goal: Any,
        axioms: list[tuple[str, Any]] | None = None,
        rules: list[tuple[str, Any]] | None = None,
        facts: list[tuple[str, Any]] | None = None,
    ) -> ProofResult:
        """
        Attempt to prove a goal using provided axioms, rules, and facts.
        
        This is the main entry point for formal proof attempts.
        
        Args:
            goal: The formula to prove
            axioms: List of (name, formula) tuples for axioms
            rules: List of (name, formula) tuples for rules
            facts: List of (name, formula) tuples for domain facts
            
        Returns:
            ProofResult with status and proof trace
        """
        solver = Solver()
        solver.set("timeout", self._timeout_ms)
        
        proof_trace = ["=== Starting Formal Proof ==="]
        used_axioms = []
        used_rules = []
        
        # Add axioms
        if axioms:
            proof_trace.append("Adding axioms:")
            for name, formula in axioms:
                solver.add(formula)
                used_axioms.append(name)
                proof_trace.append(f"  - {name}: {formula}")
        
        # Add rules
        if rules:
            proof_trace.append("Adding deduction rules:")
            for name, formula in rules:
                solver.add(formula)
                used_rules.append(name)
                proof_trace.append(f"  - {name}: {formula}")
        
        # Add facts
        if facts:
            proof_trace.append("Adding domain facts:")
            for name, formula in facts:
                solver.add(formula)
                proof_trace.append(f"  - {name}: {formula}")
        
        # Try to prove by checking if NOT(goal) leads to contradiction
        proof_trace.append(f"Goal to prove: {goal}")
        proof_trace.append("Checking if negation leads to contradiction...")
        
        solver.push()  # Save state
        solver.add(Not(goal))
        
        result = solver.check()
        
        if result == unsat:
            proof_trace.append("Negation is UNSAT => Goal is PROVEN")
            solver.pop()  # Restore state
            
            return ProofResult(
                status=ProofStatus.VALID,
                message="Goal proven using axioms and rules",
                proof_trace=proof_trace,
                used_axioms=used_axioms,
                used_rules=used_rules,
                z3_statistics=self._get_stats(solver),
            )
        
        elif result == sat:
            model = solver.model()
            model_dict = {}
            for d in model.decls():
                model_dict[str(d)] = str(model[d])
            
            proof_trace.append("Negation is SAT => Counterexample found")
            solver.pop()
            
            return ProofResult(
                status=ProofStatus.INVALID,
                message="Goal cannot be proven (counterexample exists)",
                proof_trace=proof_trace,
                model=model_dict,
                used_axioms=used_axioms,
                used_rules=used_rules,
                z3_statistics=self._get_stats(solver),
            )
        
        else:
            proof_trace.append("Result: UNKNOWN")
            solver.pop()
            
            return ProofResult(
                status=ProofStatus.UNKNOWN,
                message="Proof could not be determined",
                proof_trace=proof_trace,
                used_axioms=used_axioms,
                used_rules=used_rules,
                z3_statistics=self._get_stats(solver),
            )
    
    def check_consistency(
        self,
        formulas: list[tuple[str, Any]],
    ) -> ProofResult:
        """
        Check if a set of formulas is consistent (no contradictions).
        
        Returns ProofResult indicating whether the formulas are
        mutually satisfiable.
        """
        solver = Solver()
        solver.set("timeout", self._timeout_ms)
        
        proof_trace = ["=== Checking Consistency ==="]
        
        for name, formula in formulas:
            solver.add(formula)
            proof_trace.append(f"Added: {name} = {formula}")
        
        result = solver.check()
        
        if result == sat:
            return ProofResult(
                status=ProofStatus.VALID,
                message="Formulas are consistent",
                proof_trace=proof_trace + ["Result: Consistent (SAT)"],
                z3_statistics=self._get_stats(solver),
            )
        elif result == unsat:
            # Try to get unsat core if possible
            proof_trace.append("Result: Inconsistent (UNSAT)")
            
            return ProofResult(
                status=ProofStatus.CONTRADICTION,
                message="Formulas are inconsistent (contradiction detected)",
                proof_trace=proof_trace,
                z3_statistics=self._get_stats(solver),
            )
        else:
            return ProofResult(
                status=ProofStatus.UNKNOWN,
                message="Consistency could not be determined",
                proof_trace=proof_trace + ["Result: UNKNOWN"],
                z3_statistics=self._get_stats(solver),
            )
    
    def check_new_fact_consistency(
        self,
        new_fact: Any,
        existing_facts: list[tuple[str, Any]],
        axioms: list[tuple[str, Any]] | None = None,
        rules: list[tuple[str, Any]] | None = None,
    ) -> ProofResult:
        """
        Check if adding a new fact would cause a contradiction.
        
        This is used before storing new theorems/AOPs to ensure
        consistency with the existing knowledge base.
        """
        all_formulas = list(existing_facts)
        
        if axioms:
            all_formulas.extend(axioms)
        if rules:
            all_formulas.extend(rules)
        
        all_formulas.append(("new_fact", new_fact))
        
        result = self.check_consistency(all_formulas)
        
        if result.status == ProofStatus.CONTRADICTION:
            raise ContradictionError(
                "Adding this fact would cause a contradiction",
                conflicting_formulas=[str(new_fact)],
                proof_trace=result.proof_trace,
            )
        
        return result
    
    def _get_stats(self, solver: Solver) -> dict[str, Any]:
        """Extract statistics from solver."""
        stats = solver.statistics()
        out: dict[str, Any] = {}

        # z3 Statistics expects string keys for get_key_value(); some builds
        # expose only keys(), others also support iteration.
        try:
            keys = list(stats.keys())
        except Exception:
            keys = []

        for key in keys:
            try:
                value = stats.get_key_value(key)
            except Exception:
                continue
            if value is not None:
                out[str(key)] = value

        return out
    
    def simplify_formula(self, formula: Any) -> Any:
        """Simplify a Z3 formula."""
        return simplify(formula)
    
    def reset(self) -> None:
        """Reset all registered axioms, rules, and variables."""
        self._variables.clear()
        self._axioms.clear()
        self._rules.clear()
        logger.info("Z3 engine state reset")

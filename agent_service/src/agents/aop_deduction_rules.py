"""
Foundational AOP Deduction Rules
================================
DSL algebraic rules that guide Gemini on how to manipulate AOP expressions:
- Combine AOPs into composite procedures
- Simplify AOP expressions using logical equivalences
- Deduce connections and dependencies between AOPs
- Extract logical statements implied by AOPs

These rules are registered in the DeductionRulesGraph and provide
a formal foundation for symbolic reasoning over DSL expressions.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, TYPE_CHECKING
from enum import Enum

if TYPE_CHECKING:
    from .property_graphs import DeductionRulesGraph

logger = logging.getLogger(__name__)


class RuleCategory(Enum):
    """Categories of deduction rules."""
    LOGICAL_SIMPLIFICATION = "logical_simplification"
    AOP_COMBINATION = "aop_combination"
    AOP_SIMPLIFICATION = "aop_simplification"
    CONNECTION_DEDUCTION = "connection_deduction"
    IMPLICATION_EXTRACTION = "implication_extraction"
    QUANTIFIER_MANIPULATION = "quantifier_manipulation"
    PROCEDURE_TRANSFORMATION = "procedure_transformation"


@dataclass
class DeductionRule:
    """A formal deduction rule for DSL manipulation."""
    name: str
    category: RuleCategory
    premises: list[str]
    conclusion: str
    description: str
    dsl_pattern: str  # The full DSL RULE declaration
    examples: list[str] = field(default_factory=list)


# =============================================================================
# LOGICAL SIMPLIFICATION RULES
# Rules for algebraically simplifying DSL logical expressions
# =============================================================================

LOGICAL_SIMPLIFICATION_RULES = [
    # Double Negation Elimination
    DeductionRule(
        name="double_negation_elim",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["NOT NOT ?p"],
        conclusion="?p",
        description="Eliminate double negation: NOT NOT P ≡ P",
        dsl_pattern='RULE double_negation_elim: IF NOT NOT ?p; THEN ?p.',
        examples=["NOT NOT Enabled(?btn) => Enabled(?btn)"],
    ),
    
    # De Morgan's Law (AND)
    DeductionRule(
        name="de_morgan_and",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["NOT (?p AND ?q)"],
        conclusion="(NOT ?p) OR (NOT ?q)",
        description="De Morgan: NOT (P AND Q) ≡ (NOT P) OR (NOT Q)",
        dsl_pattern='RULE de_morgan_and: IF NOT (?p AND ?q); THEN (NOT ?p) OR (NOT ?q).',
        examples=["NOT (Active(?s) AND Visible(?s)) => (NOT Active(?s)) OR (NOT Visible(?s))"],
    ),
    
    # De Morgan's Law (OR)
    DeductionRule(
        name="de_morgan_or",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["NOT (?p OR ?q)"],
        conclusion="(NOT ?p) AND (NOT ?q)",
        description="De Morgan: NOT (P OR Q) ≡ (NOT P) AND (NOT Q)",
        dsl_pattern='RULE de_morgan_or: IF NOT (?p OR ?q); THEN (NOT ?p) AND (NOT ?q).',
        examples=["NOT (Error(?wf) OR Timeout(?wf)) => (NOT Error(?wf)) AND (NOT Timeout(?wf))"],
    ),
    
    # Distribution of AND over OR
    DeductionRule(
        name="distribute_and_over_or",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["?p AND (?q OR ?r)"],
        conclusion="(?p AND ?q) OR (?p AND ?r)",
        description="Distribute AND over OR: P AND (Q OR R) ≡ (P AND Q) OR (P AND R)",
        dsl_pattern='RULE distribute_and_over_or: IF ?p AND (?q OR ?r); THEN (?p AND ?q) OR (?p AND ?r).',
        examples=["Screen(?s) AND (Button(?s, ?b1) OR Button(?s, ?b2)) => (Screen(?s) AND Button(?s, ?b1)) OR (Screen(?s) AND Button(?s, ?b2))"],
    ),
    
    # Distribution of OR over AND
    DeductionRule(
        name="distribute_or_over_and",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["?p OR (?q AND ?r)"],
        conclusion="(?p OR ?q) AND (?p OR ?r)",
        description="Distribute OR over AND: P OR (Q AND R) ≡ (P OR Q) AND (P OR R)",
        dsl_pattern='RULE distribute_or_over_and: IF ?p OR (?q AND ?r); THEN (?p OR ?q) AND (?p OR ?r).',
        examples=[],
    ),
    
    # Absorption Law 1
    DeductionRule(
        name="absorption_and",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["?p AND (?p OR ?q)"],
        conclusion="?p",
        description="Absorption: P AND (P OR Q) ≡ P",
        dsl_pattern='RULE absorption_and: IF ?p AND (?p OR ?q); THEN ?p.',
        examples=["Screen(?s) AND (Screen(?s) OR Button(?s, ?b)) => Screen(?s)"],
    ),
    
    # Absorption Law 2
    DeductionRule(
        name="absorption_or",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["?p OR (?p AND ?q)"],
        conclusion="?p",
        description="Absorption: P OR (P AND Q) ≡ P",
        dsl_pattern='RULE absorption_or: IF ?p OR (?p AND ?q); THEN ?p.',
        examples=["HasAccess(?u, ?r) OR (HasAccess(?u, ?r) AND AdminRole(?u)) => HasAccess(?u, ?r)"],
    ),
    
    # Identity Law (AND)
    DeductionRule(
        name="identity_and_true",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["?p AND true"],
        conclusion="?p",
        description="Identity: P AND TRUE ≡ P",
        dsl_pattern='RULE identity_and_true: IF ?p AND true; THEN ?p.',
        examples=["Enabled(?btn) AND true => Enabled(?btn)"],
    ),
    
    # Identity Law (OR)
    DeductionRule(
        name="identity_or_false",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["?p OR false"],
        conclusion="?p",
        description="Identity: P OR FALSE ≡ P",
        dsl_pattern='RULE identity_or_false: IF ?p OR false; THEN ?p.',
        examples=["Visible(?screen) OR false => Visible(?screen)"],
    ),
    
    # Domination Law (AND)
    DeductionRule(
        name="domination_and_false",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["?p AND false"],
        conclusion="false",
        description="Domination: P AND FALSE ≡ FALSE",
        dsl_pattern='RULE domination_and_false: IF ?p AND false; THEN false.',
        examples=["Enabled(?btn) AND false => false"],
    ),
    
    # Domination Law (OR)
    DeductionRule(
        name="domination_or_true",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["?p OR true"],
        conclusion="true",
        description="Domination: P OR TRUE ≡ TRUE",
        dsl_pattern='RULE domination_or_true: IF ?p OR true; THEN true.',
        examples=["Disabled(?btn) OR true => true"],
    ),
    
    # Idempotent Law (AND)
    DeductionRule(
        name="idempotent_and",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["?p AND ?p"],
        conclusion="?p",
        description="Idempotent: P AND P ≡ P",
        dsl_pattern='RULE idempotent_and: IF ?p AND ?p; THEN ?p.',
        examples=["Screen(?s) AND Screen(?s) => Screen(?s)"],
    ),
    
    # Idempotent Law (OR)
    DeductionRule(
        name="idempotent_or",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["?p OR ?p"],
        conclusion="?p",
        description="Idempotent: P OR P ≡ P",
        dsl_pattern='RULE idempotent_or: IF ?p OR ?p; THEN ?p.',
        examples=["Button(?s, ?b) OR Button(?s, ?b) => Button(?s, ?b)"],
    ),
    
    # Complement Law (AND)
    DeductionRule(
        name="complement_and",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["?p AND NOT ?p"],
        conclusion="false",
        description="Complement: P AND NOT P ≡ FALSE (contradiction)",
        dsl_pattern='RULE complement_and: IF ?p AND NOT ?p; THEN false.',
        examples=["Enabled(?btn) AND NOT Enabled(?btn) => false"],
    ),
    
    # Complement Law (OR)
    DeductionRule(
        name="complement_or",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["?p OR NOT ?p"],
        conclusion="true",
        description="Complement: P OR NOT P ≡ TRUE (tautology)",
        dsl_pattern='RULE complement_or: IF ?p OR NOT ?p; THEN true.',
        examples=["Active(?s) OR NOT Active(?s) => true"],
    ),
    
    # Implication Elimination
    DeductionRule(
        name="implication_elim",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["?p IMPLIES ?q"],
        conclusion="(NOT ?p) OR ?q",
        description="Implication: P → Q ≡ (¬P) ∨ Q",
        dsl_pattern='RULE implication_elim: IF ?p IMPLIES ?q; THEN (NOT ?p) OR ?q.',
        examples=["HasRole(?u, \"admin\") IMPLIES FullAccess(?u) => (NOT HasRole(?u, \"admin\")) OR FullAccess(?u)"],
    ),
    
    # Biconditional Elimination
    DeductionRule(
        name="biconditional_elim",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["?p IFF ?q"],
        conclusion="(?p IMPLIES ?q) AND (?q IMPLIES ?p)",
        description="Biconditional: P ↔ Q ≡ (P → Q) ∧ (Q → P)",
        dsl_pattern='RULE biconditional_elim: IF ?p IFF ?q; THEN (?p IMPLIES ?q) AND (?q IMPLIES ?p).',
        examples=[],
    ),
    
    # Contraposition
    DeductionRule(
        name="contraposition",
        category=RuleCategory.LOGICAL_SIMPLIFICATION,
        premises=["?p IMPLIES ?q"],
        conclusion="(NOT ?q) IMPLIES (NOT ?p)",
        description="Contraposition: (P → Q) ≡ (¬Q → ¬P)",
        dsl_pattern='RULE contraposition: IF ?p IMPLIES ?q; THEN (NOT ?q) IMPLIES (NOT ?p).',
        examples=["IsAdmin(?u) IMPLIES CanDelete(?u) => NOT CanDelete(?u) IMPLIES NOT IsAdmin(?u)"],
    ),
]


# =============================================================================
# AOP COMBINATION RULES
# Rules for combining multiple AOPs into composite procedures
# =============================================================================

AOP_COMBINATION_RULES = [
    # Sequential Composition
    DeductionRule(
        name="aop_sequential_compose",
        category=RuleCategory.AOP_COMBINATION,
        premises=[
            "PROCEDURE ?p1 PRECOND (?pre1) BEGIN ?steps1 END",
            "PROCEDURE ?p2 PRECOND (?post1) BEGIN ?steps2 END",
        ],
        conclusion="PROCEDURE ?p1_then_?p2 PRECOND (?pre1) BEGIN ?steps1 ?steps2 END",
        description="Compose two AOPs sequentially when first's postcondition matches second's precondition",
        dsl_pattern='''RULE aop_sequential_compose: 
    IF PROCEDURE ?p1 PRECOND (?pre1) BEGIN ?steps1 END; 
    IF PROCEDURE ?p2 PRECOND (Postcondition(?p1)); 
    THEN PROCEDURE Compose(?p1, ?p2) PRECOND (?pre1) BEGIN Concat(?steps1, ?steps2) END.''',
        examples=[
            "Login THEN Dashboard => Combined procedure that logs in then shows dashboard"
        ],
    ),
    
    # Conditional AOP Branching
    DeductionRule(
        name="aop_conditional_branch",
        category=RuleCategory.AOP_COMBINATION,
        premises=[
            "?condition",
            "PROCEDURE ?p_true",
            "PROCEDURE ?p_false",
        ],
        conclusion="PROCEDURE Branch(?condition, ?p_true, ?p_false)",
        description="Create conditional branching between two AOPs based on condition",
        dsl_pattern='''RULE aop_conditional_branch:
    IF ?condition;
    IF PROCEDURE ?p_true;
    IF PROCEDURE ?p_false;
    THEN PROCEDURE Branch(?condition, ?p_true, ?p_false) BEGIN
        STEP check: ?condition;
        STEP branch_true: ?condition IMPLIES Execute(?p_true);
        STEP branch_false: (NOT ?condition) IMPLIES Execute(?p_false);
    END.''',
        examples=[
            "IF IsAdmin(?u) THEN AdminDashboard ELSE UserDashboard"
        ],
    ),
    
    # Parallel AOP Composition
    DeductionRule(
        name="aop_parallel_compose",
        category=RuleCategory.AOP_COMBINATION,
        premises=[
            "PROCEDURE ?p1",
            "PROCEDURE ?p2",
            "Independent(?p1, ?p2)",
        ],
        conclusion="PROCEDURE Parallel(?p1, ?p2)",
        description="Compose independent AOPs for parallel execution",
        dsl_pattern='''RULE aop_parallel_compose:
    IF PROCEDURE ?p1;
    IF PROCEDURE ?p2;
    IF Independent(?p1, ?p2);
    THEN PROCEDURE Parallel(?p1, ?p2) PRECOND (Precondition(?p1) AND Precondition(?p2)) BEGIN
        STEP parallel: ExecuteParallel(?p1, ?p2);
    END.''',
        examples=[
            "FetchUserData AND FetchSettings => Parallel data loading"
        ],
    ),
    
    # AOP Loop/Iteration
    DeductionRule(
        name="aop_iterate",
        category=RuleCategory.AOP_COMBINATION,
        premises=[
            "PROCEDURE ?p",
            "?loop_condition",
        ],
        conclusion="PROCEDURE Iterate(?p, ?loop_condition)",
        description="Create iterative execution of AOP while condition holds",
        dsl_pattern='''RULE aop_iterate:
    IF PROCEDURE ?p;
    IF ?loop_condition;
    THEN PROCEDURE Iterate(?p, ?loop_condition) BEGIN
        STEP check_loop: ?loop_condition;
        STEP execute: ?loop_condition IMPLIES Execute(?p);
        STEP repeat: ?loop_condition IMPLIES Iterate(?p, ?loop_condition);
    END.''',
        examples=[
            "WHILE HasMoreItems(?list) DO ProcessItem"
        ],
    ),
    
    # AOP with Error Handling
    DeductionRule(
        name="aop_with_error_handler",
        category=RuleCategory.AOP_COMBINATION,
        premises=[
            "PROCEDURE ?main",
            "PROCEDURE ?error_handler",
            "MayFail(?main)",
        ],
        conclusion="PROCEDURE TryWith(?main, ?error_handler)",
        description="Compose AOP with error handling fallback",
        dsl_pattern='''RULE aop_with_error_handler:
    IF PROCEDURE ?main;
    IF PROCEDURE ?error_handler;
    IF MayFail(?main);
    THEN PROCEDURE TryWith(?main, ?error_handler) BEGIN
        STEP try: TryExecute(?main);
        STEP catch: OnError(?main) IMPLIES Execute(?error_handler);
    END.''',
        examples=[
            "TRY SubmitPayment CATCH HandlePaymentError"
        ],
    ),
    
    # Merge Common Prefix
    DeductionRule(
        name="aop_merge_prefix",
        category=RuleCategory.AOP_COMBINATION,
        premises=[
            "PROCEDURE ?p1 BEGIN STEP ?common; ?rest1 END",
            "PROCEDURE ?p2 BEGIN STEP ?common; ?rest2 END",
        ],
        conclusion="SharedPrefix(?p1, ?p2, ?common)",
        description="Identify shared prefix steps between AOPs for factoring",
        dsl_pattern='''RULE aop_merge_prefix:
    IF PROCEDURE ?p1 BEGIN STEP ?common; ?rest1 END;
    IF PROCEDURE ?p2 BEGIN STEP ?common; ?rest2 END;
    THEN SharedPrefix(?p1, ?p2, ?common) AND 
         CanFactor(?p1, ?p2) IMPLIES 
         PROCEDURE Factored(?p1, ?p2) BEGIN STEP ?common; Branch(?select, ?rest1, ?rest2); END.''',
        examples=[
            "Both Login and Register start with ValidateInput => factor out"
        ],
    ),
]


# =============================================================================
# AOP SIMPLIFICATION RULES
# Rules for simplifying and optimizing AOP procedures
# =============================================================================

AOP_SIMPLIFICATION_RULES = [
    # Remove Redundant Precondition
    DeductionRule(
        name="aop_redundant_precond",
        category=RuleCategory.AOP_SIMPLIFICATION,
        premises=[
            "PROCEDURE ?p PRECOND (?c1 AND ?c2)",
            "?c1 IMPLIES ?c2",
        ],
        conclusion="PROCEDURE ?p PRECOND (?c1)",
        description="Remove redundant precondition if it's implied by another",
        dsl_pattern='''RULE aop_redundant_precond:
    IF PROCEDURE ?p PRECOND (?c1 AND ?c2);
    IF ?c1 IMPLIES ?c2;
    THEN PROCEDURE ?p PRECOND (?c1).''',
        examples=[
            "PRECOND (IsAdmin(?u) AND HasAccess(?u)) where IsAdmin IMPLIES HasAccess => PRECOND (IsAdmin(?u))"
        ],
    ),
    
    # Remove Dead Step
    DeductionRule(
        name="aop_dead_step_elim",
        category=RuleCategory.AOP_SIMPLIFICATION,
        premises=[
            "STEP ?s: ?action",
            "NOT Reachable(?s)",
        ],
        conclusion="RemoveStep(?s)",
        description="Eliminate steps that can never be reached",
        dsl_pattern='''RULE aop_dead_step_elim:
    IF STEP ?s: ?action;
    IF NOT Reachable(?s);
    THEN RemoveStep(?s).''',
        examples=[
            "STEP after_return: action after a RETURN statement is dead"
        ],
    ),
    
    # Merge Equivalent Steps
    DeductionRule(
        name="aop_merge_equiv_steps",
        category=RuleCategory.AOP_SIMPLIFICATION,
        premises=[
            "STEP ?s1: ?action",
            "STEP ?s2: ?action",
            "Adjacent(?s1, ?s2)",
        ],
        conclusion="MergeSteps(?s1, ?s2)",
        description="Merge adjacent identical steps into one",
        dsl_pattern='''RULE aop_merge_equiv_steps:
    IF STEP ?s1: ?action;
    IF STEP ?s2: ?action;
    IF Adjacent(?s1, ?s2);
    THEN MergeSteps(?s1, ?s2).''',
        examples=[
            "Two consecutive Validate steps with same action => merge into one"
        ],
    ),
    
    # Simplify Tautological Step
    DeductionRule(
        name="aop_tautology_step",
        category=RuleCategory.AOP_SIMPLIFICATION,
        premises=["STEP ?s: true"],
        conclusion="RemoveStep(?s)",
        description="Remove steps that are always true (no-ops)",
        dsl_pattern='RULE aop_tautology_step: IF STEP ?s: true; THEN RemoveStep(?s).',
        examples=["STEP noop: true => remove"],
    ),
    
    # Simplify Contradiction Step
    DeductionRule(
        name="aop_contradiction_step",
        category=RuleCategory.AOP_SIMPLIFICATION,
        premises=["STEP ?s: false"],
        conclusion="ProcedureUnreachable(?p)",
        description="Mark procedure as unreachable if any step is false",
        dsl_pattern='RULE aop_contradiction_step: IF STEP ?s: false; THEN ProcedureUnreachable(?p).',
        examples=["STEP impossible: false => procedure can never complete"],
    ),
    
    # Precondition Strengthening
    DeductionRule(
        name="aop_precond_strengthen",
        category=RuleCategory.AOP_SIMPLIFICATION,
        premises=[
            "PROCEDURE ?p PRECOND (?c)",
            "STEP ?s: RequiresCondition(?cond)",
            "NOT (?c IMPLIES ?cond)",
        ],
        conclusion="PROCEDURE ?p PRECOND (?c AND ?cond)",
        description="Strengthen precondition if a step requires an unstated condition",
        dsl_pattern='''RULE aop_precond_strengthen:
    IF PROCEDURE ?p PRECOND (?c);
    IF STEP ?s: RequiresCondition(?cond);
    IF NOT (?c IMPLIES ?cond);
    THEN PROCEDURE ?p PRECOND (?c AND ?cond).''',
        examples=[
            "If step requires AdminRole but precond doesn't ensure it, add to precond"
        ],
    ),
    
    # Inline Single-Use Sub-Procedure
    DeductionRule(
        name="aop_inline_single_use",
        category=RuleCategory.AOP_SIMPLIFICATION,
        premises=[
            "STEP ?s: Execute(?sub_proc)",
            "SingleUse(?sub_proc)",
            "PROCEDURE ?sub_proc BEGIN ?sub_steps END",
        ],
        conclusion="InlineSteps(?s, ?sub_steps)",
        description="Inline a sub-procedure if it's only used once",
        dsl_pattern='''RULE aop_inline_single_use:
    IF STEP ?s: Execute(?sub_proc);
    IF SingleUse(?sub_proc);
    IF PROCEDURE ?sub_proc BEGIN ?sub_steps END;
    THEN InlineSteps(?s, ?sub_steps).''',
        examples=[
            "Single-use helper procedure can be inlined to reduce indirection"
        ],
    ),
]


# =============================================================================
# CONNECTION DEDUCTION RULES
# Rules for deducing relationships and dependencies between AOPs
# =============================================================================

CONNECTION_DEDUCTION_RULES = [
    # Dependency Chain
    DeductionRule(
        name="dependency_chain",
        category=RuleCategory.CONNECTION_DEDUCTION,
        premises=[
            "DependsOn(?a, ?b)",
            "DependsOn(?b, ?c)",
        ],
        conclusion="TransitivelyDependsOn(?a, ?c)",
        description="Transitivity of dependencies: A->B->C implies A transitively depends on C",
        dsl_pattern='''RULE dependency_chain:
    IF DependsOn(?a, ?b);
    IF DependsOn(?b, ?c);
    THEN TransitivelyDependsOn(?a, ?c).''',
        examples=[
            "PaymentService -> AuthService -> Database => PaymentService transitively depends on Database"
        ],
    ),
    
    # Circular Dependency Detection
    DeductionRule(
        name="circular_dependency",
        category=RuleCategory.CONNECTION_DEDUCTION,
        premises=[
            "DependsOn(?a, ?b)",
            "TransitivelyDependsOn(?b, ?a)",
        ],
        conclusion="CircularDependency(?a, ?b)",
        description="Detect circular dependencies in the dependency graph",
        dsl_pattern='''RULE circular_dependency:
    IF DependsOn(?a, ?b);
    IF TransitivelyDependsOn(?b, ?a);
    THEN CircularDependency(?a, ?b).''',
        examples=[
            "A -> B -> C -> A forms a cycle"
        ],
    ),
    
    # Shared Dependency Factoring
    DeductionRule(
        name="shared_dependency",
        category=RuleCategory.CONNECTION_DEDUCTION,
        premises=[
            "DependsOn(?a, ?c)",
            "DependsOn(?b, ?c)",
            "NOT DependsOn(?a, ?b)",
            "NOT DependsOn(?b, ?a)",
        ],
        conclusion="SharedDependency(?a, ?b, ?c)",
        description="Identify common dependencies between independent procedures",
        dsl_pattern='''RULE shared_dependency:
    IF DependsOn(?a, ?c);
    IF DependsOn(?b, ?c);
    IF NOT DependsOn(?a, ?b);
    IF NOT DependsOn(?b, ?a);
    THEN SharedDependency(?a, ?b, ?c).''',
        examples=[
            "UserService and OrderService both depend on AuthService"
        ],
    ),
    
    # Precondition-Postcondition Link
    DeductionRule(
        name="precond_postcond_link",
        category=RuleCategory.CONNECTION_DEDUCTION,
        premises=[
            "PROCEDURE ?p1 Postcondition(?post)",
            "PROCEDURE ?p2 PRECOND (?post)",
        ],
        conclusion="CanSequence(?p1, ?p2)",
        description="Identify procedures that can be sequenced based on pre/post conditions",
        dsl_pattern='''RULE precond_postcond_link:
    IF Postcondition(?p1, ?post);
    IF PROCEDURE ?p2 PRECOND (?post);
    THEN CanSequence(?p1, ?p2).''',
        examples=[
            "Login produces AuthenticatedUser, Dashboard requires AuthenticatedUser => can sequence"
        ],
    ),
    
    # State Mutation Analysis
    DeductionRule(
        name="state_mutation_conflict",
        category=RuleCategory.CONNECTION_DEDUCTION,
        premises=[
            "MutatesState(?p1, ?state)",
            "ReadsState(?p2, ?state)",
        ],
        conclusion="PotentialConflict(?p1, ?p2, ?state)",
        description="Detect potential conflicts from concurrent state access",
        dsl_pattern='''RULE state_mutation_conflict:
    IF MutatesState(?p1, ?state);
    IF ReadsState(?p2, ?state);
    THEN PotentialConflict(?p1, ?p2, ?state).''',
        examples=[
            "UpdateUser mutates UserState, DisplayUser reads UserState => ordering matters"
        ],
    ),
    
    # Effect Propagation
    DeductionRule(
        name="effect_propagation",
        category=RuleCategory.CONNECTION_DEDUCTION,
        premises=[
            "CausesEffect(?p1, ?effect)",
            "TriggeredBy(?p2, ?effect)",
        ],
        conclusion="Triggers(?p1, ?p2)",
        description="Determine that one procedure triggers another via effects",
        dsl_pattern='''RULE effect_propagation:
    IF CausesEffect(?p1, ?effect);
    IF TriggeredBy(?p2, ?effect);
    THEN Triggers(?p1, ?p2).''',
        examples=[
            "CreateOrder causes OrderCreatedEvent, SendNotification triggered by OrderCreatedEvent"
        ],
    ),
    
    # Resource Contention
    DeductionRule(
        name="resource_contention",
        category=RuleCategory.CONNECTION_DEDUCTION,
        premises=[
            "UsesResource(?p1, ?resource)",
            "UsesResource(?p2, ?resource)",
            "ExclusiveResource(?resource)",
        ],
        conclusion="MutuallyExclusive(?p1, ?p2)",
        description="Identify procedures that cannot run concurrently due to resource contention",
        dsl_pattern='''RULE resource_contention:
    IF UsesResource(?p1, ?resource);
    IF UsesResource(?p2, ?resource);
    IF ExclusiveResource(?resource);
    THEN MutuallyExclusive(?p1, ?p2).''',
        examples=[
            "Both procedures need exclusive database lock => mutually exclusive"
        ],
    ),
]


# =============================================================================
# IMPLICATION EXTRACTION RULES
# Rules for extracting logical statements implied by AOPs
# =============================================================================

IMPLICATION_EXTRACTION_RULES = [
    # Postcondition Inference
    DeductionRule(
        name="postcond_inference",
        category=RuleCategory.IMPLICATION_EXTRACTION,
        premises=[
            "PROCEDURE ?p BEGIN ?steps END",
            "LastStep(?steps, ?final_action)",
            "EffectOf(?final_action, ?effect)",
        ],
        conclusion="Postcondition(?p, ?effect)",
        description="Infer postcondition from the effect of the final step",
        dsl_pattern='''RULE postcond_inference:
    IF PROCEDURE ?p BEGIN ?steps END;
    IF LastStep(?steps, ?final_action);
    IF EffectOf(?final_action, ?effect);
    THEN Postcondition(?p, ?effect).''',
        examples=[
            "Procedure ending with SaveUser implies UserSaved postcondition"
        ],
    ),
    
    # Invariant Preservation
    DeductionRule(
        name="invariant_preservation",
        category=RuleCategory.IMPLICATION_EXTRACTION,
        premises=[
            "PROCEDURE ?p PRECOND (?inv)",
            "FORALL ?s. Step(?p, ?s) IMPLIES Preserves(?s, ?inv)",
        ],
        conclusion="Invariant(?p, ?inv)",
        description="If precondition is preserved by all steps, it's an invariant",
        dsl_pattern='''RULE invariant_preservation:
    IF PROCEDURE ?p PRECOND (?inv);
    IF FORALL ?s. Step(?p, ?s) IMPLIES Preserves(?s, ?inv);
    THEN Invariant(?p, ?inv).''',
        examples=[
            "If all steps preserve AuthenticatedUser, it's an invariant of the procedure"
        ],
    ),
    
    # Weakest Precondition
    DeductionRule(
        name="weakest_precond",
        category=RuleCategory.IMPLICATION_EXTRACTION,
        premises=[
            "STEP ?s: ?action",
            "Requires(?action, ?cond)",
        ],
        conclusion="WeakestPrecondition(?s, ?cond)",
        description="Extract the weakest precondition required by a step",
        dsl_pattern='''RULE weakest_precond:
    IF STEP ?s: ?action;
    IF Requires(?action, ?cond);
    THEN WeakestPrecondition(?s, ?cond).''',
        examples=[
            "DeleteUser requires UserExists => WeakestPrecondition is UserExists"
        ],
    ),
    
    # Strongest Postcondition
    DeductionRule(
        name="strongest_postcond",
        category=RuleCategory.IMPLICATION_EXTRACTION,
        premises=[
            "STEP ?s: ?action",
            "Guarantees(?action, ?cond)",
        ],
        conclusion="StrongestPostcondition(?s, ?cond)",
        description="Extract the strongest postcondition guaranteed by a step",
        dsl_pattern='''RULE strongest_postcond:
    IF STEP ?s: ?action;
    IF Guarantees(?action, ?cond);
    THEN StrongestPostcondition(?s, ?cond).''',
        examples=[
            "SaveUser guarantees UserPersisted => StrongestPostcondition is UserPersisted"
        ],
    ),
    
    # Negation Implication
    DeductionRule(
        name="negation_implication",
        category=RuleCategory.IMPLICATION_EXTRACTION,
        premises=[
            "PROCEDURE ?p PRECOND (?c)",
            "SuccessfulExecution(?p)",
        ],
        conclusion="?c",
        description="Successful execution implies precondition was true",
        dsl_pattern='''RULE negation_implication:
    IF PROCEDURE ?p PRECOND (?c);
    IF SuccessfulExecution(?p);
    THEN ?c.''',
        examples=[
            "If DeleteUser succeeded and requires UserExists, then UserExists was true"
        ],
    ),
    
    # Exception Implication
    DeductionRule(
        name="exception_implication",
        category=RuleCategory.IMPLICATION_EXTRACTION,
        premises=[
            "PROCEDURE ?p PRECOND (?c)",
            "FailedExecution(?p)",
            "FailureReason(?p, PreconditionViolation)",
        ],
        conclusion="NOT ?c",
        description="Precondition failure implies precondition was false",
        dsl_pattern='''RULE exception_implication:
    IF PROCEDURE ?p PRECOND (?c);
    IF FailedExecution(?p);
    IF FailureReason(?p, PreconditionViolation);
    THEN NOT ?c.''',
        examples=[
            "If DeleteUser failed with precondition violation, then UserExists was false"
        ],
    ),
    
    # Conditional Effect Extraction
    DeductionRule(
        name="conditional_effect",
        category=RuleCategory.IMPLICATION_EXTRACTION,
        premises=[
            "STEP ?s: ?cond IMPLIES ?action",
            "EffectOf(?action, ?effect)",
        ],
        conclusion="ConditionalEffect(?s, ?cond, ?effect)",
        description="Extract conditional effects from conditional steps",
        dsl_pattern='''RULE conditional_effect:
    IF STEP ?s: ?cond IMPLIES ?action;
    IF EffectOf(?action, ?effect);
    THEN ConditionalEffect(?s, ?cond, ?effect).''',
        examples=[
            "STEP: IsAdmin IMPLIES DeleteAll => ConditionalEffect(step, IsAdmin, AllDeleted)"
        ],
    ),
    
    # Universal Instantiation
    DeductionRule(
        name="universal_instantiation",
        category=RuleCategory.IMPLICATION_EXTRACTION,
        premises=[
            "FORALL ?x. ?property(?x)",
            "Instance(?entity)",
        ],
        conclusion="?property(?entity)",
        description="Instantiate universal statement with specific entity",
        dsl_pattern='''RULE universal_instantiation:
    IF FORALL ?x. ?property(?x);
    IF Instance(?entity);
    THEN ?property(?entity).''',
        examples=[
            "FORALL ?u. User(?u) IMPLIES HasId(?u) + Instance(\"john\") => HasId(\"john\")"
        ],
    ),
]


# =============================================================================
# QUANTIFIER MANIPULATION RULES
# Rules for manipulating quantified expressions
# =============================================================================

QUANTIFIER_MANIPULATION_RULES = [
    # Quantifier Negation (FORALL)
    DeductionRule(
        name="negate_forall",
        category=RuleCategory.QUANTIFIER_MANIPULATION,
        premises=["NOT FORALL ?x. ?p"],
        conclusion="EXISTS ?x. NOT ?p",
        description="Negation of universal quantifier: ¬∀x.P ≡ ∃x.¬P",
        dsl_pattern='RULE negate_forall: IF NOT FORALL ?x. ?p; THEN EXISTS ?x. NOT ?p.',
        examples=["NOT FORALL ?u. HasAccess(?u) => EXISTS ?u. NOT HasAccess(?u)"],
    ),
    
    # Quantifier Negation (EXISTS)
    DeductionRule(
        name="negate_exists",
        category=RuleCategory.QUANTIFIER_MANIPULATION,
        premises=["NOT EXISTS ?x. ?p"],
        conclusion="FORALL ?x. NOT ?p",
        description="Negation of existential quantifier: ¬∃x.P ≡ ∀x.¬P",
        dsl_pattern='RULE negate_exists: IF NOT EXISTS ?x. ?p; THEN FORALL ?x. NOT ?p.',
        examples=["NOT EXISTS ?s. Error(?s) => FORALL ?s. NOT Error(?s)"],
    ),
    
    # Universal Distribution over AND
    DeductionRule(
        name="forall_and_distribute",
        category=RuleCategory.QUANTIFIER_MANIPULATION,
        premises=["FORALL ?x. (?p AND ?q)"],
        conclusion="(FORALL ?x. ?p) AND (FORALL ?x. ?q)",
        description="Universal distributes over AND: ∀x.(P∧Q) ≡ (∀x.P)∧(∀x.Q)",
        dsl_pattern='RULE forall_and_distribute: IF FORALL ?x. (?p AND ?q); THEN (FORALL ?x. ?p) AND (FORALL ?x. ?q).',
        examples=["FORALL ?u. Active(?u) AND Valid(?u) => (FORALL ?u. Active(?u)) AND (FORALL ?u. Valid(?u))"],
    ),
    
    # Existential Distribution over OR
    DeductionRule(
        name="exists_or_distribute",
        category=RuleCategory.QUANTIFIER_MANIPULATION,
        premises=["EXISTS ?x. (?p OR ?q)"],
        conclusion="(EXISTS ?x. ?p) OR (EXISTS ?x. ?q)",
        description="Existential distributes over OR: ∃x.(P∨Q) ≡ (∃x.P)∨(∃x.Q)",
        dsl_pattern='RULE exists_or_distribute: IF EXISTS ?x. (?p OR ?q); THEN (EXISTS ?x. ?p) OR (EXISTS ?x. ?q).',
        examples=["EXISTS ?s. Admin(?s) OR Moderator(?s) => (EXISTS ?s. Admin(?s)) OR (EXISTS ?s. Moderator(?s))"],
    ),
    
    # Quantifier Scope Reduction (free variable)
    DeductionRule(
        name="quantifier_scope_reduce",
        category=RuleCategory.QUANTIFIER_MANIPULATION,
        premises=[
            "FORALL ?x. (?p AND ?q)",
            "FreeIn(?x, ?p)",
            "NOT FreeIn(?x, ?q)",
        ],
        conclusion="(FORALL ?x. ?p) AND ?q",
        description="Reduce quantifier scope when variable not free in part of expression",
        dsl_pattern='''RULE quantifier_scope_reduce:
    IF FORALL ?x. (?p AND ?q);
    IF FreeIn(?x, ?p);
    IF NOT FreeIn(?x, ?q);
    THEN (FORALL ?x. ?p) AND ?q.''',
        examples=["FORALL ?u. Valid(?u) AND SystemEnabled => (FORALL ?u. Valid(?u)) AND SystemEnabled"],
    ),
    
    # Quantifier Swap (safe case)
    DeductionRule(
        name="forall_swap",
        category=RuleCategory.QUANTIFIER_MANIPULATION,
        premises=["FORALL ?x ?y. ?p"],
        conclusion="FORALL ?y ?x. ?p",
        description="Swap order of universal quantifiers: ∀x∀y.P ≡ ∀y∀x.P",
        dsl_pattern='RULE forall_swap: IF FORALL ?x ?y. ?p; THEN FORALL ?y ?x. ?p.',
        examples=["FORALL ?u ?r. CanAccess(?u, ?r) => FORALL ?r ?u. CanAccess(?u, ?r)"],
    ),
]


# =============================================================================
# PROCEDURE TRANSFORMATION RULES
# Higher-level rules for transforming procedures
# =============================================================================

PROCEDURE_TRANSFORMATION_RULES = [
    # AOP to Rule Extraction
    DeductionRule(
        name="aop_to_rule",
        category=RuleCategory.PROCEDURE_TRANSFORMATION,
        premises=[
            "PROCEDURE ?p PRECOND (?pre) BEGIN ?steps END",
            "AllStepsAreConditions(?steps)",
            "FinalStep(?steps, ?conclusion)",
        ],
        conclusion="RULE From_?p: IF ?pre; IF Conditions(?steps); THEN ?conclusion.",
        description="Transform a purely conditional AOP into a deduction rule",
        dsl_pattern='''RULE aop_to_rule:
    IF PROCEDURE ?p PRECOND (?pre) BEGIN ?steps END;
    IF AllStepsAreConditions(?steps);
    IF FinalStep(?steps, ?conclusion);
    THEN RULE From_?p: IF ?pre; IF Conditions(?steps); THEN ?conclusion.''',
        examples=[
            "A procedure that only checks conditions can become a deduction rule"
        ],
    ),
    
    # Rule to AOP Expansion
    DeductionRule(
        name="rule_to_aop",
        category=RuleCategory.PROCEDURE_TRANSFORMATION,
        premises=[
            "RULE ?r: IF ?p1; IF ?p2; THEN ?conclusion",
        ],
        conclusion="""PROCEDURE ApplyRule_?r PRECOND (?p1 AND ?p2) BEGIN
    STEP verify_p1: ?p1;
    STEP verify_p2: ?p2;
    STEP conclude: Assert(?conclusion);
END.""",
        description="Expand a deduction rule into an executable verification AOP",
        dsl_pattern='''RULE rule_to_aop:
    IF RULE ?r: IF ?p1; IF ?p2; THEN ?conclusion;
    THEN PROCEDURE ApplyRule_?r PRECOND (?p1 AND ?p2) BEGIN
        STEP verify_p1: ?p1;
        STEP verify_p2: ?p2;
        STEP conclude: Assert(?conclusion);
    END.''',
        examples=[
            "A deduction rule can be expanded into a verification procedure"
        ],
    ),
    
    # AOP Parameterization
    DeductionRule(
        name="aop_parameterize",
        category=RuleCategory.PROCEDURE_TRANSFORMATION,
        premises=[
            "PROCEDURE ?p BEGIN ?steps END",
            "ContainsConstant(?steps, ?const)",
        ],
        conclusion="PROCEDURE ?p(?var) BEGIN ReplaceConstant(?steps, ?const, ?var) END",
        description="Parameterize an AOP by replacing constants with variables",
        dsl_pattern='''RULE aop_parameterize:
    IF PROCEDURE ?p BEGIN ?steps END;
    IF ContainsConstant(?steps, ?const);
    THEN PROCEDURE ?p(?var) BEGIN ReplaceConstant(?steps, ?const, ?var) END.''',
        examples=[
            "PROCEDURE LoginAdmin can become PROCEDURE Login(?role) by parameterizing role"
        ],
    ),
    
    # AOP Specialization
    DeductionRule(
        name="aop_specialize",
        category=RuleCategory.PROCEDURE_TRANSFORMATION,
        premises=[
            "PROCEDURE ?p(?var) BEGIN ?steps END",
            "SpecificValue(?var, ?value)",
        ],
        conclusion="PROCEDURE ?p_?value BEGIN Substitute(?steps, ?var, ?value) END",
        description="Specialize a parameterized AOP with a specific value",
        dsl_pattern='''RULE aop_specialize:
    IF PROCEDURE ?p(?var) BEGIN ?steps END;
    IF SpecificValue(?var, ?value);
    THEN PROCEDURE ?p_?value BEGIN Substitute(?steps, ?var, ?value) END.''',
        examples=[
            "PROCEDURE Login(?role) with role=admin becomes PROCEDURE LoginAdmin"
        ],
    ),
    
    # Extract Sub-Procedure
    DeductionRule(
        name="extract_sub_procedure",
        category=RuleCategory.PROCEDURE_TRANSFORMATION,
        premises=[
            "PROCEDURE ?p BEGIN ?s1; ?s2; ?s3; ?s4; END",
            "Cohesive(?s2, ?s3)",
        ],
        conclusion="""PROCEDURE ?p BEGIN ?s1; STEP call: Execute(Sub_?p); ?s4; END
PROCEDURE Sub_?p BEGIN ?s2; ?s3; END""",
        description="Extract cohesive steps into a sub-procedure",
        dsl_pattern='''RULE extract_sub_procedure:
    IF PROCEDURE ?p BEGIN ?s1; ?s2; ?s3; ?s4; END;
    IF Cohesive(?s2, ?s3);
    THEN PROCEDURE ?p BEGIN ?s1; STEP call: Execute(Sub_?p); ?s4; END AND
         PROCEDURE Sub_?p BEGIN ?s2; ?s3; END.''',
        examples=[
            "Extract authentication steps into AuthenticateUser sub-procedure"
        ],
    ),
]


# =============================================================================
# ALL FOUNDATIONAL RULES
# =============================================================================

ALL_FOUNDATIONAL_RULES: list[DeductionRule] = (
    LOGICAL_SIMPLIFICATION_RULES +
    AOP_COMBINATION_RULES +
    AOP_SIMPLIFICATION_RULES +
    CONNECTION_DEDUCTION_RULES +
    IMPLICATION_EXTRACTION_RULES +
    QUANTIFIER_MANIPULATION_RULES +
    PROCEDURE_TRANSFORMATION_RULES
)


def get_rules_by_category(category: RuleCategory) -> list[DeductionRule]:
    """Get all rules of a specific category."""
    return [r for r in ALL_FOUNDATIONAL_RULES if r.category == category]


def get_rule_by_name(name: str) -> DeductionRule | None:
    """Get a rule by its name."""
    for rule in ALL_FOUNDATIONAL_RULES:
        if rule.name == name:
            return rule
    return None


# =============================================================================
# REGISTRATION FUNCTIONS
# =============================================================================

async def register_foundational_rules(
    deduction_graph: "DeductionRulesGraph",
    force_update: bool = False,
) -> dict[str, Any]:
    """
    Register all foundational AOP deduction rules in the property graph.
    
    This function is idempotent - rules that already exist will be skipped
    (or updated if force_update=True).
    
    Args:
        deduction_graph: The DeductionRulesGraph instance to register rules in
        force_update: If True, update existing rules instead of skipping
        
    Returns:
        Summary of registered rules by category
    """
    results: dict[str, Any] = {
        "total_registered": 0,
        "total_skipped": 0,
        "total_updated": 0,
        "by_category": {},
        "errors": [],
    }
    
    for rule in ALL_FOUNDATIONAL_RULES:
        try:
            rule_id, was_created = deduction_graph.add_rule(
                name=rule.name,
                premises=rule.premises,
                conclusion=rule.conclusion,
                properties={
                    "category": rule.category.value,
                    "description": rule.description,
                    "dsl_pattern": rule.dsl_pattern,
                    "examples": rule.examples,
                    "is_foundational": True,  # Mark as foundational rule
                },
                skip_if_exists=not force_update,
            )
            
            category_name = rule.category.value
            if category_name not in results["by_category"]:
                results["by_category"][category_name] = []
            
            if was_created:
                results["total_registered"] += 1
                results["by_category"][category_name].append(rule.name)
                logger.info(f"Registered rule: {rule.name} ({rule.category.value})")
            elif force_update:
                results["total_updated"] += 1
                logger.info(f"Updated rule: {rule.name} ({rule.category.value})")
            else:
                results["total_skipped"] += 1
                logger.debug(f"Skipped existing rule: {rule.name}")
            
        except Exception as e:
            results["errors"].append({
                "rule": rule.name,
                "error": str(e),
            })
            logger.error(f"Failed to register rule {rule.name}: {e}")
    
    logger.info(
        f"Foundational rules: {results['total_registered']} registered, "
        f"{results['total_skipped']} skipped, "
        f"{results['total_updated']} updated, "
        f"{len(results['errors'])} errors"
    )
    return results


def get_foundational_rules_dsl() -> str:
    """
    Get all foundational rules as a single DSL string for LLM context.
    
    Returns a formatted DSL document with all rules.
    """
    sections = []
    
    for category in RuleCategory:
        rules = get_rules_by_category(category)
        if not rules:
            continue
        
        title = category.value.replace("_", " ").title()
        section = f"// === {title} Rules ===\n\n"
        
        for rule in rules:
            section += f"// {rule.description}\n"
            section += f"{rule.dsl_pattern}\n\n"
        
        sections.append(section)
    
    return "\n".join(sections)


def get_foundational_rules_summary() -> str:
    """
    Get a condensed summary of all foundational rules for LLM prompts.
    """
    lines = ["# AOP Deduction Rules Summary\n"]
    
    for category in RuleCategory:
        rules = get_rules_by_category(category)
        if not rules:
            continue
        
        title = category.value.replace("_", " ").title()
        lines.append(f"\n## {title}")
        
        for rule in rules:
            lines.append(f"- **{rule.name}**: {rule.description}")
    
    return "\n".join(lines)


# =============================================================================
# LLM PROMPT CONTEXT
# =============================================================================

AOP_DEDUCTION_PROMPT_CONTEXT = """
# AOP Algebraic Simplification and Manipulation Rules

You have access to the following foundational deduction rules for manipulating AOP expressions.
Use these rules to:
1. **Simplify** complex logical expressions using algebraic equivalences
2. **Combine** multiple AOPs into composite procedures
3. **Deduce connections** between procedures based on dependencies and effects
4. **Extract implications** from procedure definitions

## Key Rule Categories:

### Logical Simplification (Boolean Algebra)
- Double negation: NOT NOT P ≡ P
- De Morgan: NOT (P AND Q) ≡ (NOT P) OR (NOT Q)
- Distribution: P AND (Q OR R) ≡ (P AND Q) OR (P AND R)
- Absorption: P AND (P OR Q) ≡ P
- Identity/Domination/Idempotent/Complement laws
- Implication elimination: P IMPLIES Q ≡ (NOT P) OR Q
- Contraposition: (P IMPLIES Q) ≡ (NOT Q IMPLIES NOT P)

### AOP Combination
- Sequential composition: P1 THEN P2 when postcond(P1) matches precond(P2)
- Conditional branching: IF cond THEN P1 ELSE P2
- Parallel composition: P1 || P2 when independent
- Iteration: WHILE cond DO P
- Error handling: TRY P1 CATCH P2

### AOP Simplification
- Remove redundant preconditions (if implied by another)
- Eliminate dead/unreachable steps
- Merge equivalent adjacent steps
- Inline single-use sub-procedures
- Strengthen preconditions from step requirements

### Connection Deduction
- Dependency transitivity: A->B AND B->C IMPLIES A-->C
- Circular dependency detection
- Pre/Post condition linking
- State mutation conflict detection
- Effect propagation and triggers

### Implication Extraction
- Postcondition inference from final step effects
- Invariant identification (preserved by all steps)
- Weakest precondition / Strongest postcondition
- Universal instantiation with specific entities

### Quantifier Manipulation
- ¬∀x.P ≡ ∃x.¬P
- ¬∃x.P ≡ ∀x.¬P
- ∀x.(P∧Q) ≡ (∀x.P)∧(∀x.Q)
- Quantifier scope reduction when variable not free

## Usage Pattern:

When simplifying or combining AOPs, apply rules step by step:
1. Identify which rule applies to the current expression
2. Apply the rule transformation
3. Record the rule used in the proof trace
4. Repeat until no more simplifications apply

Example:
```
Input: NOT (Screen(?s) AND Button(?s, ?b))
Apply de_morgan_and:   (NOT Screen(?s)) OR (NOT Button(?s, ?b))
Result simplified.
```
"""

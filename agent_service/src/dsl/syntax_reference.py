"""
DSL Syntax Reference
====================
Complete reference for the formal DSL used in all reasoning operations.

This module provides:
- DSL_SYNTAX_REFERENCE: Full syntax documentation for LLM prompts
- DSL_EXAMPLES: Common patterns and examples
- DSL_QUICK_REFERENCE: Condensed syntax for context windows
"""

DSL_SYNTAX_REFERENCE = """
# DSL (Domain-Specific Language) Syntax Reference

## CRITICAL: ALL reasoning MUST be in DSL format. Natural language is ONLY for final user output.

## 1. VARIABLES
Variables start with `?` followed by lowercase letters:
```
?x, ?y, ?entity, ?workflow, ?screen
```

## 2. PREDICATES
Predicates are PascalCase identifiers with optional arguments:
```
Screen(?name)
Button(?screen, ?label)
Workflow(?id, ?steps)
HasAccess(?user, ?resource)
IsEnabled(?feature)
Microservice(?name, ?endpoint)
DependsOn(?service1, ?service2)
```

## 3. LOGICAL CONNECTIVES (in precedence order, lowest to highest)
```
IFF      - If and only if (biconditional)
IMPLIES  - Logical implication
OR       - Disjunction
XOR      - Exclusive or
AND      - Conjunction
NOT      - Negation
```

Examples:
```
HasAccess(?user, ?resource) AND IsEnabled(?feature)
Button(?screen, "Submit") IMPLIES Workflow(?screen, ?wf)
NOT Disabled(?button)
(A OR B) AND (C OR D)
```

## 4. QUANTIFIERS
```
FORALL ?x ?y. expr    - Universal quantification
EXISTS ?x. expr       - Existential quantification
```

Examples:
```
FORALL ?user. HasRole(?user, "admin") IMPLIES HasAccess(?user, "all")
EXISTS ?screen. Contains(?screen, ?button) AND Visible(?screen)
```

## 5. AXIOMS
Immutable truths in the knowledge base:
```
AXIOM axiom_name: logical_expression.
```

Examples:
```
AXIOM admin_access: FORALL ?u. HasRole(?u, "admin") IMPLIES FullAccess(?u).
AXIOM button_requires_screen: FORALL ?b. Button(?s, ?b) IMPLIES Screen(?s).
AXIOM service_dependency: DependsOn("PaymentService", "AuthService").
```

## 6. RULES (Deduction Rules)
Hilbert-style inference rules with premises and conclusion:
```
RULE rule_name: IF premise1; IF premise2; THEN conclusion.
```

Examples:
```
RULE modus_ponens: IF ?p; IF ?p IMPLIES ?q; THEN ?q.
RULE access_inheritance: IF HasRole(?u, ?r); IF RoleGrants(?r, ?p); THEN HasPermission(?u, ?p).
RULE workflow_completion: IF AllStepsComplete(?wf); IF NoErrors(?wf); THEN WorkflowSuccess(?wf).
```

## 7. PROCEDURES (AOP - Aspect-Oriented Procedures)
Multi-step procedures with optional preconditions:
```
PROCEDURE proc_name PRECOND (precondition_expr) BEGIN
  STEP step1: action_expr;
  STEP step2: action_expr;
END.
```

Example:
```
PROCEDURE ResetPassword PRECOND (AuthenticatedUser(?u)) BEGIN
  STEP validate: ValidEmail(?u, ?email);
  STEP send_token: SendResetToken(?email, ?token);
  STEP update: UpdatePassword(?u, ?new_pwd) AND ValidPassword(?new_pwd);
END.
```

## 8. META OPERATIONS

### Context Shift
Switch to a different reasoning context:
```
SHIFT_CTX(context_name).
```

### Context Embedding
Evaluate expression in another context:
```
EMBED_CTX(context_name, expression).
```

### Substitution
Replace variable with value:
```
SUBST(expression, ?var, replacement).
```

### Meta Links
Create relationships between contexts:
```
META_LINK(source, target, link_type).
```

## 9. PATTERN MATCHING
```
MATCH expr WITH
| pattern1 => result1
| pattern2 => result2
| _ => default_result
```

## 10. LITERALS
```
"string"    - String literals (double quotes)
42          - Integer numbers
3.14        - Floating point numbers
true/false  - Boolean literals
```

## 11. COMMENTS
```
// This is a single-line comment
```

## COMPLETE EXAMPLES

### Defining Business Domain Knowledge
```
// Screen and navigation facts
AXIOM home_screen: Screen("HomeScreen").
AXIOM login_button: Button("HomeScreen", "Login").
AXIOM nav_rule: Button(?s, "Login") IMPLIES NavigatesTo(?s, "LoginScreen").

// Service dependencies
AXIOM payment_depends: DependsOn("PaymentService", "AuthService").
AXIOM auth_standalone: NOT EXISTS ?s. DependsOn("AuthService", ?s).

// Access control rules
RULE admin_grant: IF HasRole(?u, "admin"); THEN CanAccess(?u, "AdminPanel").
RULE viewer_restrict: IF HasRole(?u, "viewer"); IF SensitiveData(?r); THEN NOT CanModify(?u, ?r).
```

### Defining a Theorem (Proven Statement)
```
AXIOM theorem_workflow_complete: 
  FORALL ?wf. (AllStepsExecuted(?wf) AND NoErrorsRaised(?wf)) IMPLIES WorkflowSuccessful(?wf).
```

### Querying Knowledge (for RAG retrieval)
```
// Query: What screens have login buttons?
EXISTS ?s. Screen(?s) AND Button(?s, "Login").

// Query: What services does PaymentService depend on?
EXISTS ?dep. DependsOn("PaymentService", ?dep).

// Query: Can user X access resource Y?
CanAccess("userX", "resourceY").
```
"""

DSL_QUICK_REFERENCE = """
DSL QUICK REFERENCE:
- Variables: ?x, ?var_name (start with ?)
- Predicates: PascalCase(?args) e.g., Screen(?name), HasAccess(?user, ?resource)
- Connectives: AND, OR, NOT, IMPLIES, IFF, XOR
- Quantifiers: FORALL ?x. expr, EXISTS ?x. expr
- Axiom: AXIOM name: expr.
- Rule: RULE name: IF p1; IF p2; THEN conclusion.
- Procedure: PROCEDURE name PRECOND (cond) BEGIN STEP s1: expr; END.
- Literals: "string", 42, 3.14, true, false
"""

DSL_TRANSLATION_CONVENTIONS = """
DSL TRANSLATION CONVENTIONS (MANDATORY):
- Language: Use English predicate names only.
- Style: Predicate and function names must be PascalCase.
- Reuse: If a semantically equivalent predicate exists in retrieved context, reuse it exactly.
- No aliases: Do not introduce multilingual or synonymous variants for an existing concept.
- Arity stability: Keep argument count fixed for known predicates.
- Argument order stability: Use consistent semantic order (subject first, object/attribute second).
- Variables: Use ?x-style variables for unknowns.
- Constants: Prefer quoted strings for textual values; use bare identifiers only for domain entities.
- Determinism: For equivalent input meaning, emit the same predicate names and signatures.
- Output discipline: Return only valid DSL text, without explanation or markdown.

Canonical examples:
- "el usuario puede acceder al panel admin" -> CanAccess("user", "AdminPanel").
- "la jirafa vuela" -> CanFly(Giraffe).
- "si es admin entonces acceso total" -> HasRole(?u, "admin") IMPLIES FullAccess(?u).
"""

DSL_EXAMPLES = {
    "simple_fact": 'AXIOM screen_exists: Screen("HomeScreen").',
    "predicate_with_args": 'Button("HomeScreen", "Login")',
    "implication": 'HasRole(?u, "admin") IMPLIES FullAccess(?u)',
    "conjunction": 'Screen(?s) AND Visible(?s) AND NOT Disabled(?s)',
    "universal": 'FORALL ?x. Human(?x) IMPLIES Mortal(?x)',
    "existential": 'EXISTS ?s. Screen(?s) AND Contains(?s, "SubmitButton")',
    "rule": 'RULE access_rule: IF HasRole(?u, ?r); IF RoleGrants(?r, ?p); THEN HasPermission(?u, ?p).',
    "procedure": '''PROCEDURE Login PRECOND (NOT LoggedIn(?u)) BEGIN
  STEP validate: ValidCredentials(?u, ?pwd);
  STEP create_session: CreateSession(?u, ?token);
  STEP redirect: NavigateTo("Dashboard");
END.''',
}


# =============================================================================
# AOP ALGEBRAIC MANIPULATION REFERENCE
# Rules for simplifying, combining, and transforming AOP expressions
# =============================================================================

DSL_AOP_MANIPULATION_REFERENCE = """
# AOP Algebraic Manipulation Rules

## LOGICAL SIMPLIFICATION (Boolean Algebra)
Use these rules to simplify complex DSL logical expressions:

### Double Negation
```
NOT NOT ?p => ?p
```

### De Morgan's Laws
```
NOT (?p AND ?q) => (NOT ?p) OR (NOT ?q)
NOT (?p OR ?q) => (NOT ?p) AND (NOT ?q)
```

### Distribution
```
?p AND (?q OR ?r) => (?p AND ?q) OR (?p AND ?r)
?p OR (?q AND ?r) => (?p OR ?q) AND (?p OR ?r)
```

### Absorption
```
?p AND (?p OR ?q) => ?p
?p OR (?p AND ?q) => ?p
```

### Identity Laws
```
?p AND true => ?p
?p OR false => ?p
```

### Domination Laws
```
?p AND false => false
?p OR true => true
```

### Idempotent Laws
```
?p AND ?p => ?p
?p OR ?p => ?p
```

### Complement Laws
```
?p AND NOT ?p => false (contradiction)
?p OR NOT ?p => true (tautology)
```

### Implication Elimination
```
?p IMPLIES ?q => (NOT ?p) OR ?q
```

### Contraposition
```
?p IMPLIES ?q => (NOT ?q) IMPLIES (NOT ?p)
```

## AOP COMBINATION RULES
Rules for composing multiple AOPs into complex procedures:

### Sequential Composition
When postcondition of P1 matches precondition of P2:
```
PROCEDURE P1 THENWHEN=>POSTCOND matches PRECOND=>P2
=> PROCEDURE Compose(P1, P2) BEGIN steps1; steps2; END
```

### Conditional Branching
```
PROCEDURE Branch(cond, P_true, P_false) BEGIN
  STEP check: cond;
  STEP if_true: cond IMPLIES Execute(P_true);
  STEP if_false: (NOT cond) IMPLIES Execute(P_false);
END
```

### Parallel Composition
When P1 and P2 are independent (no shared state):
```
PROCEDURE Parallel(P1, P2) BEGIN
  STEP parallel: ExecuteParallel(P1, P2);
END
```

### Iteration
```
PROCEDURE Iterate(P, loop_condition) BEGIN
  STEP check_loop: loop_condition;
  STEP execute: loop_condition IMPLIES Execute(P);
  STEP repeat: loop_condition IMPLIES Iterate(P, loop_condition);
END
```

### Error Handling
```
PROCEDURE TryWith(main, error_handler) BEGIN
  STEP try: TryExecute(main);
  STEP catch: OnError(main) IMPLIES Execute(error_handler);
END
```

## AOP SIMPLIFICATION RULES
Rules for optimizing and simplifying AOPs:

### Redundant Precondition Removal
If c1 IMPLIES c2, then:
```
PRECOND (c1 AND c2) => PRECOND (c1)
```

### Dead Step Elimination
```
STEP s: action WHERE NOT Reachable(s) => RemoveStep(s)
```

### Merge Equivalent Steps
```
STEP s1: action; STEP s2: action; => Single step (if adjacent and identical)
```

### Tautology/Contradiction Steps
```
STEP s: true => Remove (no-op)
STEP s: false => Procedure unreachable
```

## CONNECTION DEDUCTION RULES
Rules for inferring relationships between AOPs:

### Dependency Transitivity
```
DependsOn(A, B) AND DependsOn(B, C) => TransitivelyDependsOn(A, C)
```

### Circular Dependency Detection
```
DependsOn(A, B) AND TransitivelyDependsOn(B, A) => CircularDependency(A, B)
```

### Precondition-Postcondition Linking
```
Postcondition(P1, post) AND PRECOND(P2, post) => CanSequence(P1, P2)
```

### Effect Propagation
```
CausesEffect(P1, effect) AND TriggeredBy(P2, effect) => Triggers(P1, P2)
```

## IMPLICATION EXTRACTION RULES
Rules for extracting logical statements from AOPs:

### Postcondition Inference
```
LastStep(steps, final) AND EffectOf(final, effect) => Postcondition(P, effect)
```

### Invariant Identification
If precondition is preserved by all steps:
```
PRECOND(inv) AND AllStepsPreserve(inv) => Invariant(P, inv)
```

### Universal Instantiation
```
FORALL ?x. property(?x) AND Instance(entity) => property(entity)
```

## QUANTIFIER MANIPULATION

### Negation Rules
```
NOT FORALL ?x. ?p => EXISTS ?x. NOT ?p
NOT EXISTS ?x. ?p => FORALL ?x. NOT ?p
```

### Distribution
```
FORALL ?x. (?p AND ?q) => (FORALL ?x. ?p) AND (FORALL ?x. ?q)
EXISTS ?x. (?p OR ?q) => (EXISTS ?x. ?p) OR (EXISTS ?x. ?q)
```

### Quantifier Swap
```
FORALL ?x ?y. ?p => FORALL ?y ?x. ?p
```
"""


def get_dsl_prompt_context() -> str:
    """Get DSL context for inclusion in LLM prompts."""
    return DSL_SYNTAX_REFERENCE


def get_dsl_quick_ref() -> str:
    """Get condensed DSL reference for shorter prompts."""
    return DSL_QUICK_REFERENCE


def get_dsl_full_context() -> str:
    """Get full DSL context including manipulation rules for LLM prompts."""
    return DSL_SYNTAX_REFERENCE + "\n\n" + DSL_AOP_MANIPULATION_REFERENCE


def get_aop_manipulation_ref() -> str:
    """Get AOP manipulation rules reference for LLM prompts."""
    return DSL_AOP_MANIPULATION_REFERENCE

"""
Tests for the DSL module: grammar, parser, evaluator, translator.

These tests run without any external dependencies (no Gemini API, no PostgreSQL).
"""
import pytest

from src.dsl import DSLParser, DSLEvaluator, EvaluationContext, DSLTranslator
from src.dsl.parser import (
    AxiomNode, RuleNode, ProcedureNode, MetaLinkNode,
    ContextShiftNode, ContextEmbedNode, SubstNode,
    QuantifiedNode, BinaryOpNode, NotNode,
    PredicateNode, VarNode, LiteralNode,
)
from src.dsl import ParseError


# ── Parser tests ──────────────────────────────────────────────────────────────

class TestDSLParser:

    def setup_method(self):
        self.parser = DSLParser()

    def test_parse_axiom(self):
        nodes = self.parser.parse("AXIOM A1: Authenticated(?user).")
        assert len(nodes) == 1
        node = nodes[0]
        assert isinstance(node, AxiomNode)
        assert node.name == "A1"
        assert isinstance(node.expr, PredicateNode)
        assert node.expr.name == "Authenticated"

    def test_parse_literal_true(self):
        nodes = self.parser.parse("AXIOM T: true.")
        assert isinstance(nodes[0], AxiomNode)
        assert isinstance(nodes[0].expr, LiteralNode)
        assert nodes[0].expr.value is True

    def test_parse_literal_false(self):
        nodes = self.parser.parse("AXIOM F: false.")
        assert isinstance(nodes[0].expr, LiteralNode)
        assert nodes[0].expr.value is False

    def test_parse_literal_number(self):
        nodes = self.parser.parse("AXIOM N: SomeValue(42.0).")
        pred = nodes[0].expr
        assert isinstance(pred, PredicateNode)
        assert isinstance(pred.args[0], LiteralNode)
        assert pred.args[0].value == 42.0

    def test_parse_binary_and(self):
        nodes = self.parser.parse("AXIOM A: Foo AND Bar.")
        expr = nodes[0].expr
        assert isinstance(expr, BinaryOpNode)
        assert expr.op == "AND"

    def test_parse_binary_implies(self):
        nodes = self.parser.parse("AXIOM A: HasAccount(?u) IMPLIES Authenticated(?u).")
        expr = nodes[0].expr
        assert isinstance(expr, BinaryOpNode)
        assert expr.op == "IMPLIES"

    def test_parse_not(self):
        nodes = self.parser.parse("AXIOM A: NOT Blocked(?u).")
        expr = nodes[0].expr
        assert isinstance(expr, NotNode)

    def test_parse_forall(self):
        nodes = self.parser.parse("AXIOM A: FORALL ?x. IsUser(?x) IMPLIES HasAccount(?x).")
        expr = nodes[0].expr
        assert isinstance(expr, QuantifiedNode)
        assert expr.quantifier == "FORALL"
        assert "?x" in expr.variables

    def test_parse_rule(self):
        src = "RULE R1: IF Authenticated(?u); THEN CanLogin(?u)."
        nodes = self.parser.parse(src)
        assert len(nodes) == 1
        node = nodes[0]
        assert isinstance(node, RuleNode)
        assert node.name == "R1"
        assert len(node.premises) == 1

    def test_parse_procedure(self):
        src = """
        PROCEDURE LoginFlow
        PRECOND (HasAccount(?u))
        BEGIN
          STEP CheckCredentials: ValidatePassword(?u, ?pwd);
          STEP IssueToken: GenerateJWT(?u);
        END.
        """
        nodes = self.parser.parse(src)
        assert len(nodes) == 1
        node = nodes[0]
        assert isinstance(node, ProcedureNode)
        assert node.name == "LoginFlow"
        assert node.precond is not None
        assert len(node.steps) == 2

    def test_parse_meta_link(self):
        nodes = self.parser.parse("META_LINK(AuthService, UserService, calls).")
        assert isinstance(nodes[0], MetaLinkNode)
        assert nodes[0].source == "AuthService"
        assert nodes[0].target == "UserService"
        assert nodes[0].link_type == "calls"

    def test_parse_shift_ctx(self):
        nodes = self.parser.parse("SHIFT_CTX(procedures).")
        assert isinstance(nodes[0], ContextShiftNode)
        assert nodes[0].context_name == "procedures"

    def test_parse_multiple_statements(self):
        src = """
        AXIOM A1: IsUser(?u).
        AXIOM A2: HasAccount(?a).
        """
        nodes = self.parser.parse(src)
        assert len(nodes) == 2

    def test_parse_error_raises(self):
        with pytest.raises(ParseError):
            self.parser.parse("THIS IS NOT VALID DSL !!!")

    def test_parse_string_literal(self):
        nodes = self.parser.parse('AXIOM A: Status("active").')
        pred = nodes[0].expr
        assert isinstance(pred, PredicateNode)
        assert pred.args[0].value == "active"


# ── Evaluator tests ───────────────────────────────────────────────────────────

class TestDSLEvaluator:

    def setup_method(self):
        self.parser = DSLParser()
        self.evaluator = DSLEvaluator()

    def parse_eval(self, src: str) -> EvaluationContext:
        nodes = self.parser.parse(src)
        return self.evaluator.evaluate(nodes)

    def test_axiom_stored(self):
        ctx = self.parse_eval("AXIOM A1: Foo.")
        assert "A1" in ctx.axioms

    def test_rule_stored(self):
        ctx = self.parse_eval("RULE R1: IF Foo; THEN Bar.")
        assert "R1" in ctx.rules

    def test_procedure_stored(self):
        ctx = self.parse_eval(
            "PROCEDURE P1 BEGIN STEP s1: DoThing(?x); END."
        )
        assert "P1" in ctx.procedures

    def test_simplify_not_not(self):
        nodes = self.parser.parse("AXIOM A: NOT NOT Foo.")
        ctx = self.evaluator.evaluate(nodes)
        expr = ctx.axioms["A"]
        simplified = self.evaluator.simplify(expr, ctx)
        # NOT NOT Foo → Foo
        assert isinstance(simplified, PredicateNode)
        assert simplified.name == "Foo"

    def test_simplify_and_true(self):
        nodes = self.parser.parse("AXIOM A: true AND Foo.")
        ctx = self.evaluator.evaluate(nodes)
        expr = ctx.axioms["A"]
        simplified = self.evaluator.simplify(expr, ctx)
        # true AND X → X
        assert isinstance(simplified, PredicateNode)

    def test_simplify_or_true(self):
        nodes = self.parser.parse("AXIOM A: true OR Foo.")
        ctx = self.evaluator.evaluate(nodes)
        expr = ctx.axioms["A"]
        simplified = self.evaluator.simplify(expr, ctx)
        assert isinstance(simplified, LiteralNode)
        assert simplified.value is True

    def test_simplify_and_false(self):
        nodes = self.parser.parse("AXIOM A: false AND Foo.")
        ctx = self.evaluator.evaluate(nodes)
        simplified = self.evaluator.simplify(ctx.axioms["A"], ctx)
        assert isinstance(simplified, LiteralNode)
        assert simplified.value is False

    def test_simplify_implies_false_antecedent(self):
        nodes = self.parser.parse("AXIOM A: false IMPLIES Foo.")
        ctx = self.evaluator.evaluate(nodes)
        simplified = self.evaluator.simplify(ctx.axioms["A"], ctx)
        # false IMPLIES X → true (ex falso)
        assert isinstance(simplified, LiteralNode)
        assert simplified.value is True

    def test_simplify_not_true(self):
        nodes = self.parser.parse("AXIOM A: NOT true.")
        ctx = self.evaluator.evaluate(nodes)
        simplified = self.evaluator.simplify(ctx.axioms["A"], ctx)
        assert isinstance(simplified, LiteralNode)
        assert simplified.value is False

    def test_simplify_not_false(self):
        nodes = self.parser.parse("AXIOM A: NOT false.")
        ctx = self.evaluator.evaluate(nodes)
        simplified = self.evaluator.simplify(ctx.axioms["A"], ctx)
        assert isinstance(simplified, LiteralNode)
        assert simplified.value is True

    def test_substitution(self):
        nodes = self.parser.parse("AXIOM A: HasAccount(?u).")
        ctx = self.evaluator.evaluate(nodes)
        expr = ctx.axioms["A"]
        replacement = LiteralNode(value="alice")
        result = self.evaluator.substitute(expr, "?u", replacement)
        assert isinstance(result, PredicateNode)
        assert isinstance(result.args[0], LiteralNode)
        assert result.args[0].value == "alice"

    def test_context_shift(self):
        ctx = self.parse_eval("SHIFT_CTX(procedures).")
        assert ctx.active_ctx == "procedures"

    def test_multiple_axioms(self):
        src = """
        AXIOM A1: IsUser(?u).
        AXIOM A2: HasAccount(?a).
        AXIOM A3: true AND false.
        """
        ctx = self.parse_eval(src)
        assert len(ctx.axioms) == 3


# ── Translator tests ──────────────────────────────────────────────────────────

class TestDSLTranslator:

    def setup_method(self):
        self.parser = DSLParser()
        self.translator = DSLTranslator()

    def roundtrip(self, src: str) -> str:
        """Parse → translate back to DSL source."""
        nodes = self.parser.parse(src)
        return self.translator.to_dsl(nodes[0])

    def test_axiom_roundtrip(self):
        src = "AXIOM A1: Authenticated(?user)."
        result = self.roundtrip(src)
        assert "AXIOM" in result
        assert "A1" in result
        assert "Authenticated" in result

    def test_rule_roundtrip(self):
        src = "RULE R1: IF HasAccount(?u); THEN Authenticated(?u)."
        result = self.roundtrip(src)
        assert "RULE" in result
        assert "THEN" in result

    def test_procedure_roundtrip(self):
        src = "PROCEDURE P1 BEGIN STEP s1: DoThing(?x); END."
        result = self.roundtrip(src)
        assert "PROCEDURE" in result
        assert "BEGIN" in result
        assert "END" in result

    def test_meta_link_roundtrip(self):
        src = "META_LINK(A, B, calls)."
        result = self.roundtrip(src)
        assert "META_LINK" in result
        assert "calls" in result

    def test_not_roundtrip(self):
        src = "AXIOM A: NOT Foo."
        result = self.roundtrip(src)
        assert "NOT" in result

    def test_connective_roundtrip(self):
        src = "AXIOM A: Foo AND Bar."
        result = self.roundtrip(src)
        assert "AND" in result

    def test_implies_roundtrip(self):
        src = "AXIOM A: Foo IMPLIES Bar."
        result = self.roundtrip(src)
        assert "IMPLIES" in result

    def test_iff_roundtrip(self):
        src = "AXIOM A: Foo IFF Bar."
        result = self.roundtrip(src)
        assert "IFF" in result

    def test_quantifier_roundtrip(self):
        src = "AXIOM A: FORALL ?x. IsUser(?x)."
        result = self.roundtrip(src)
        assert "FORALL" in result

    def test_literal_bool(self):
        node = LiteralNode(value=True)
        assert self.translator.to_dsl(node) == "true"
        node_f = LiteralNode(value=False)
        assert self.translator.to_dsl(node_f) == "false"

    def test_literal_string(self):
        node = LiteralNode(value="hello")
        assert self.translator.to_dsl(node) == '"hello"'

    def test_literal_number(self):
        node = LiteralNode(value=42.0)
        assert self.translator.to_dsl(node) == "42.0"

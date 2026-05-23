"""
Contradiction Resolver
======================
Handles contradictions detected in the knowledge system by:
1. Identifying minimal sets of conflicting formulas
2. Proposing resolutions (delete theorems, rectify facts)
3. Executing approved resolutions
4. Validating system consistency after resolution

This is used when a new AOP or fact would cause a contradiction
with existing knowledge.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from llama_index.core.llms import LLM

from .property_graphs import (
    AxiomsGraph,
    DeductionRulesGraph,
    BusinessDomainGraph,
    TheoremsGraph,
)
from .z3_engine import Z3ProofEngine, ProofStatus, ContradictionError
from ..knowledge_graph import Neo4jGraphStore

logger = logging.getLogger(__name__)


class ResolutionStrategy(str, Enum):
    """Strategy for resolving contradictions."""
    DELETE_NEW = "delete_new"           # Don't add the new item
    DELETE_EXISTING = "delete_existing"  # Delete conflicting existing items
    MODIFY_EXISTING = "modify_existing"  # Modify existing items to resolve
    MERGE = "merge"                      # Merge new and existing
    MANUAL = "manual"                    # Require manual intervention


class ResolutionStatus(str, Enum):
    """Status of a resolution attempt."""
    RESOLVED = "resolved"
    PENDING_APPROVAL = "pending_approval"
    FAILED = "failed"
    MANUAL_REQUIRED = "manual_required"


@dataclass
class ConflictingItem:
    """An item involved in a contradiction."""
    id: str
    item_type: str  # axiom, rule, theorem, fact
    graph_name: str
    content: str
    can_delete: bool = True
    dependents: list[str] = field(default_factory=list)


@dataclass 
class ResolutionProposal:
    """A proposed resolution for a contradiction."""
    strategy: ResolutionStrategy
    items_to_delete: list[str] = field(default_factory=list)
    items_to_modify: list[tuple[str, str]] = field(default_factory=list)  # (id, new_content)
    explanation: str = ""
    confidence: float = 0.0
    

@dataclass
class ResolutionResult:
    """Result of a contradiction resolution."""
    status: ResolutionStatus
    message: str
    proposal: ResolutionProposal | None = None
    items_deleted: list[str] = field(default_factory=list)
    items_modified: list[str] = field(default_factory=list)
    verification_passed: bool = False


class ContradictionResolver:
    """
    Resolves contradictions in the knowledge system.
    
    When a contradiction is detected:
    1. Finds the minimal unsatisfiable core (conflicting formulas)
    2. Analyzes which items can/should be modified
    3. Proposes resolution strategies
    4. Executes approved resolutions
    5. Verifies consistency after resolution
    """
    
    def __init__(
        self,
        llm: LLM,
        axioms_graph: AxiomsGraph,
        rules_graph: DeductionRulesGraph,
        domain_graph: BusinessDomainGraph,
        theorems_graph: TheoremsGraph,
        graph_store: Neo4jGraphStore,
        z3_engine: Z3ProofEngine | None = None,
    ) -> None:
        self._llm = llm
        self._axioms_graph = axioms_graph
        self._rules_graph = rules_graph
        self._domain_graph = domain_graph
        self._theorems_graph = theorems_graph
        self._graph_store = graph_store
        self._z3_engine = z3_engine or Z3ProofEngine()
    
    async def analyze_contradiction(
        self,
        new_item: str,
        new_item_type: str,
        error: ContradictionError,
    ) -> list[ConflictingItem]:
        """
        Analyze a contradiction to find all conflicting items.
        
        Args:
            new_item: The new DSL item that caused contradiction
            new_item_type: Type of the new item
            error: The ContradictionError from Z3
            
        Returns:
            List of items involved in the contradiction
        """
        conflicting = []
        
        # Add the new item
        conflicting.append(ConflictingItem(
            id="new",
            item_type=new_item_type,
            graph_name="",
            content=new_item,
            can_delete=True,
        ))
        
        # Analyze conflicting formulas from error
        for formula_str in error.conflicting_formulas:
            # Try to find the source of this formula
            item = await self._find_source_item(formula_str)
            if item:
                conflicting.append(item)
        
        # Use LLM to find additional related conflicts
        if len(conflicting) < 2:
            additional = await self._llm_find_conflicts(new_item, error)
            conflicting.extend(additional)
        
        # Find dependents for each item
        for item in conflicting:
            if item.id != "new":
                item.dependents = await self._find_dependents(item.id)
                # Axioms typically cannot be deleted
                if item.item_type == "axiom":
                    item.can_delete = False
        
        return conflicting
    
    async def _find_source_item(self, formula_str: str) -> ConflictingItem | None:
        """Find the source item (axiom, rule, theorem, fact) for a formula."""
        # Search in each graph
        for graph_name, graph in [
            ("axioms", self._axioms_graph),
            ("deduction_rules", self._rules_graph),
            ("theorems", self._theorems_graph),
            ("business_domain", self._domain_graph),
        ]:
            results = graph.retrieve(formula_str, top_k=5)
            for r in results:
                if r['score'] > 0.8:  # High similarity
                    return ConflictingItem(
                        id=r['id'],
                        item_type=r['metadata'].get('type', 'unknown'),
                        graph_name=graph_name,
                        content=r['text'],
                        can_delete=r['metadata'].get('type') != 'axiom',
                    )
        
        return None
    
    async def _llm_find_conflicts(
        self,
        new_item: str,
        error: ContradictionError,
    ) -> list[ConflictingItem]:
        """Use LLM to identify conflicting items."""
        prompt = f"""A contradiction was detected when adding:
{new_item}

Error details: {error}
Proof trace: {error.proof_trace}

Based on this, identify what existing knowledge might conflict.
List the likely conflicting elements and why they conflict.
Format: One per line, "TYPE: description"
"""
        
        try:
            response = await self._llm.acomplete(prompt)
            # Parse response and search for items
            items = []
            for line in response.text.strip().split('\n'):
                if ':' in line:
                    item_type, desc = line.split(':', 1)
                    # Search for this item
                    for graph_name, graph in [
                        ("axioms", self._axioms_graph),
                        ("deduction_rules", self._rules_graph),
                        ("theorems", self._theorems_graph),
                        ("business_domain", self._domain_graph),
                    ]:
                        results = graph.retrieve(desc.strip(), top_k=1)
                        if results and results[0]['score'] > 0.6:
                            r = results[0]
                            items.append(ConflictingItem(
                                id=r['id'],
                                item_type=r['metadata'].get('type', 'unknown'),
                                graph_name=graph_name,
                                content=r['text'],
                            ))
                            break
            return items
        except Exception as e:
            logger.error(f"LLM conflict finding failed: {e}")
            return []
    
    async def _find_dependents(self, item_id: str) -> list[str]:
        """Find items that depend on/reference the given item."""
        dependents = []
        
        # Check edges in graph store
        edges = self._graph_store.get_edges_by_target(item_id)
        for edge in edges:
            dependents.append(edge.source_id)
        
        return dependents
    
    async def propose_resolution(
        self,
        conflicting_items: list[ConflictingItem],
        new_item: str,
        prefer_new: bool = False,
    ) -> ResolutionProposal:
        """
        Propose a resolution strategy for the contradiction.
        
        Args:
            conflicting_items: Items involved in the contradiction
            new_item: The new item being added
            prefer_new: If True, prefer keeping the new item
            
        Returns:
            ResolutionProposal with recommended actions
        """
        # Analyze deletability
        deletable_existing = [
            i for i in conflicting_items
            if i.id != "new" and i.can_delete and not i.dependents
        ]
        
        has_undeletable = any(
            not i.can_delete for i in conflicting_items if i.id != "new"
        )
        
        # Strategy selection
        if not prefer_new and not deletable_existing:
            # Can't delete existing, don't add new
            return ResolutionProposal(
                strategy=ResolutionStrategy.DELETE_NEW,
                items_to_delete=["new"],
                explanation="Existing items cannot be deleted; rejecting new item",
                confidence=0.9,
            )
        
        if prefer_new and deletable_existing:
            # Prefer new, delete existing conflicts
            return ResolutionProposal(
                strategy=ResolutionStrategy.DELETE_EXISTING,
                items_to_delete=[i.id for i in deletable_existing],
                explanation=f"Deleting {len(deletable_existing)} conflicting items to add new",
                confidence=0.8,
            )
        
        if has_undeletable:
            # Need to modify or manual intervention
            return await self._propose_modification(conflicting_items, new_item)
        
        # Default: don't add new
        return ResolutionProposal(
            strategy=ResolutionStrategy.DELETE_NEW,
            items_to_delete=["new"],
            explanation="Default: rejecting new item to preserve consistency",
            confidence=0.7,
        )
    
    async def _propose_modification(
        self,
        conflicting_items: list[ConflictingItem],
        new_item: str,
    ) -> ResolutionProposal:
        """Use LLM to propose modifications to resolve contradiction."""
        items_desc = "\n".join(
            f"- {i.item_type} ({i.id}): {i.content}"
            for i in conflicting_items
        )
        
        prompt = f"""There is a logical contradiction between these items:

{items_desc}

The new item being added: {new_item}

Some items cannot be deleted (axioms, items with dependents).
Propose modifications to existing items that would:
1. Resolve the contradiction
2. Preserve as much existing knowledge as possible
3. Allow the new item to be added if it's valuable

For each modification, provide: ID | modified content
If no modification is possible, state "MANUAL_REQUIRED"
"""
        
        try:
            response = await self._llm.acomplete(prompt)
            
            if "MANUAL_REQUIRED" in response.text:
                return ResolutionProposal(
                    strategy=ResolutionStrategy.MANUAL,
                    explanation="LLM could not find automatic resolution",
                    confidence=0.0,
                )
            
            # Parse modifications
            modifications = []
            for line in response.text.strip().split('\n'):
                if '|' in line:
                    parts = line.split('|', 1)
                    if len(parts) == 2:
                        item_id = parts[0].strip()
                        new_content = parts[1].strip()
                        modifications.append((item_id, new_content))
            
            if modifications:
                return ResolutionProposal(
                    strategy=ResolutionStrategy.MODIFY_EXISTING,
                    items_to_modify=modifications,
                    explanation="LLM proposed modifications to resolve contradiction",
                    confidence=0.6,
                )
            
            return ResolutionProposal(
                strategy=ResolutionStrategy.MANUAL,
                explanation="Could not parse LLM modifications",
                confidence=0.0,
            )
            
        except Exception as e:
            logger.error(f"LLM modification proposal failed: {e}")
            return ResolutionProposal(
                strategy=ResolutionStrategy.MANUAL,
                explanation=f"LLM error: {e}",
                confidence=0.0,
            )
    
    async def execute_resolution(
        self,
        proposal: ResolutionProposal,
        dry_run: bool = False,
    ) -> ResolutionResult:
        """
        Execute an approved resolution proposal.
        
        Args:
            proposal: The resolution to execute
            dry_run: If True, only simulate the resolution
            
        Returns:
            ResolutionResult indicating success/failure
        """
        if proposal.strategy == ResolutionStrategy.MANUAL:
            return ResolutionResult(
                status=ResolutionStatus.MANUAL_REQUIRED,
                message="Manual intervention required",
                proposal=proposal,
            )
        
        items_deleted = []
        items_modified = []
        
        try:
            if proposal.strategy in (
                ResolutionStrategy.DELETE_NEW,
                ResolutionStrategy.DELETE_EXISTING,
            ):
                # Execute deletions
                for item_id in proposal.items_to_delete:
                    if item_id == "new":
                        continue  # New item just won't be added
                    
                    if not dry_run:
                        # Delete from graph store
                        self._graph_store.delete_node(item_id)
                    items_deleted.append(item_id)
            
            elif proposal.strategy == ResolutionStrategy.MODIFY_EXISTING:
                # Execute modifications
                for item_id, new_content in proposal.items_to_modify:
                    if not dry_run:
                        node = self._graph_store.get_node(item_id)
                        if node:
                            node.dsl_source = new_content
                            self._graph_store.upsert_node(node)
                    items_modified.append(item_id)
            
            # Verify consistency after resolution
            if not dry_run:
                verification = await self._verify_consistency()
            else:
                verification = True
            
            return ResolutionResult(
                status=ResolutionStatus.RESOLVED,
                message=f"Resolution executed: {len(items_deleted)} deleted, {len(items_modified)} modified",
                proposal=proposal,
                items_deleted=items_deleted,
                items_modified=items_modified,
                verification_passed=verification,
            )
            
        except Exception as e:
            logger.exception("Resolution execution failed")
            return ResolutionResult(
                status=ResolutionStatus.FAILED,
                message=f"Execution failed: {e}",
                proposal=proposal,
                items_deleted=items_deleted,
                items_modified=items_modified,
            )
    
    async def _verify_consistency(self) -> bool:
        """Verify system consistency after resolution."""
        try:
            # Gather all formulas
            all_formulas = []
            
            for graph_name, graph in [
                ("axioms", self._axioms_graph),
                ("deduction_rules", self._rules_graph),
                ("theorems", self._theorems_graph),
            ]:
                results = graph.retrieve("all", top_k=100)
                for r in results:
                    formula = self._z3_engine.translate_dsl_text_to_z3(r['text'])
                    if formula is not None:
                        all_formulas.append((f"{graph_name}:{r['id']}", formula))
            
            if not all_formulas:
                return True
            
            # Check consistency
            result = self._z3_engine.check_consistency(all_formulas)
            return result.status != ProofStatus.CONTRADICTION
            
        except Exception as e:
            logger.error(f"Consistency verification failed: {e}")
            return False
    
    async def resolve_contradiction(
        self,
        new_item: str,
        new_item_type: str,
        error: ContradictionError,
        prefer_new: bool = False,
        auto_execute: bool = False,
    ) -> ResolutionResult:
        """
        Full contradiction resolution workflow.
        
        Args:
            new_item: The new item causing contradiction
            new_item_type: Type of new item
            error: The ContradictionError
            prefer_new: Whether to prefer keeping the new item
            auto_execute: If True, execute resolution without approval
            
        Returns:
            ResolutionResult
        """
        # Step 1: Analyze contradiction
        conflicting = await self.analyze_contradiction(new_item, new_item_type, error)
        
        logger.info(f"Found {len(conflicting)} conflicting items")
        
        # Step 2: Propose resolution
        proposal = await self.propose_resolution(conflicting, new_item, prefer_new)
        
        logger.info(f"Proposed strategy: {proposal.strategy} (confidence: {proposal.confidence})")
        
        # Step 3: Execute or return for approval
        if auto_execute and proposal.confidence > 0.7:
            return await self.execute_resolution(proposal)
        else:
            return ResolutionResult(
                status=ResolutionStatus.PENDING_APPROVAL,
                message=f"Resolution proposal ready: {proposal.strategy}",
                proposal=proposal,
            )

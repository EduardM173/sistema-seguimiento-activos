"""Quick test of PropertyGraph retrieval."""
from src.agents.property_graphs import BusinessDomainGraph, AxiomsGraph
from src.knowledge_graph import Neo4jGraphStore

store = Neo4jGraphStore()

# Check nodes in PostgreSQL
for ctx_name in ["business_domain", "axioms", "deduction_rules", "theorems"]:
    nodes = store.get_nodes_by_context(ctx_name)
    print(f"Nodes in PostgreSQL for {ctx_name}: {len(nodes)}")

# Try business domain retrieval
graph = BusinessDomainGraph(graph_store=store)
print("\nTesting BusinessDomainGraph.retrieve('login screen')...")
try:
    results = graph.retrieve("login screen", top_k=5)
    print(f"Results: {len(results)}")
    for r in results[:3]:
        text = r["text"][:100]
        print(f"  - {text}")
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")

# Try axioms retrieval
axiom_graph = AxiomsGraph(graph_store=store)
print("\nTesting AxiomsGraph.retrieve('modus ponens')...")
try:
    results = axiom_graph.retrieve("modus ponens", top_k=5)
    print(f"Results: {len(results)}")
    for r in results[:3]:
        text = r["text"][:100]
        print(f"  - {text}")
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")

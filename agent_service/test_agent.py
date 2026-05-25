import asyncio
from llama_index.core.agent import ReActAgent
from llama_index.core.llms.mock import MockLLM

class MyAgent(ReActAgent):
    def __init__(self, llm):
        self._test = "hello"
        super().__init__(tools=[], llm=llm, max_iterations=1, system_prompt="")
        self._test2 = "world"

try:
    agent = MyAgent(llm=MockLLM())
    print("TEST1", getattr(agent, "_test", "MISSING"))
    print("TEST2", getattr(agent, "_test2", "MISSING"))
except Exception as e:
    print("EXCEPTION", repr(e))

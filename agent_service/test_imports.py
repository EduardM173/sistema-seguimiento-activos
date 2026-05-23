from llama_index.core.agent import ReActAgent
print('ReActAgent type:', type(ReActAgent))

import llama_index.core.agent as agent_mod
print('dir(agent_mod):', dir(agent_mod))

try:
    from llama_index.core.agent.legacy.react.base import ReActAgent as Legacy
    print('Found Legacy React Agent')
except Exception as e:
    print('Legacy Not Found', e)

try:
    from llama_index.core.agent.runner.base import AgentRunner
    print('Found AgentRunner')
except Exception as e:
    print('AgentRunner Not Found', e)

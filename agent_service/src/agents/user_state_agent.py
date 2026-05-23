"""
User State Manager Agent
========================
Specialized LLM agent to track ephemeral conversational user state
(e.g., current name, active screen, preferences) as a structured JSON object.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from llama_index.core.llms import LLM

logger = logging.getLogger(__name__)


from llama_index.core.agent import ReActAgent

# System Prompt
USER_STATE_PROMPT = """You are the User State Manager for an application.
Your ONLY job is to track the user's ephemeral conversational state (e.g. their name, current screen, preferences, intents) and update a JSON state object.
You must NOT store global business facts or database rules. Only track things related to the user's current self (being, having, doing).
Eliminate redundancies and resolve contradictions (e.g. if the user says "My new name is X", overwrite their old name).

INPUTS:
Current User State (JSON):
{current_state}

New User Message:
"{message}"

INSTRUCTIONS:
1. Identify any new ephemeral facts about the user from the message.
2. Update the JSON object accordingly.
3. If there is no new state information, return the original JSON object exactly as is.
4. DO NOT wrap the output in Markdown blocks (like ```json ... ```). Output ONLY raw valid JSON text.
"""

class UserStateAgent(ReActAgent):
    """Agent that manages and updates the dynamic ephemeral user state."""
    
    def __init__(self, llm: LLM):
        super().__init__(
            tools=[],
            llm=llm,
            system_prompt="You manage the user's conversational state.",
            verbose=True,
            max_iterations=1,
        )
        self._llm = llm
        
    async def update_state(self, message: str, current_state: dict[str, Any]) -> dict[str, Any]:
        """Update the current state dictionary based on the new user message."""
        try:
            state_json_str = json.dumps(current_state, ensure_ascii=False)
            prompt = USER_STATE_PROMPT.format(current_state=state_json_str, message=message)
            
            response = await self._llm.acomplete(prompt)
            output_text = response.text.strip()
            
            # Remove markdown blocks if the LLM adds them despite instructions
            if output_text.startswith("```json"):
                output_text = output_text[7:]
            if output_text.startswith("```"):
                output_text = output_text[3:]
            if output_text.endswith("```"):
                output_text = output_text[:-3]
                
            output_text = output_text.strip()
            
            if not output_text:
                return current_state
                
            updated_state = json.loads(output_text)
            
            # Basic validation
            if not isinstance(updated_state, dict):
                logger.warning("UserStateAgent returned non-dict JSON. Retaining old state.")
                return current_state
                
            return updated_state
            
        except json.JSONDecodeError as e:
            logger.error("Failed to decode JSON from UserStateAgent: %s | Output was: %s", e, getattr(response, 'text', 'None'))
            return current_state
        except Exception as e:
            logger.error("Error updating user state: %s", e)
            return current_state

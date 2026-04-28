from llama_index.llms.google_genai import GoogleGenAI as genai
from llama_index.core.agent import FunctionAgent
from llama_index.core.tools import FunctionTool
from llama_index.core.workflow import Context
from llama_index.core.workflow import JsonSerializer

from os import environ
import asyncio
import random as rd

google_api_key = environ.get("GOOGLE_API_KEY", "")
google_model = environ.get("LLM_MODEL", "")
llm = genai(api_key=google_api_key, model=google_model)

passkeys = {}
safe_content = None
access_count = 0

def generate_passkey() -> int:
    '''Method to genereate a passkey to access the safebox'''
    
    new_key = rd.randint(200, 300)
    passkeys[new_key] = 5
    if(len(passkeys) > 5):
        passkeys.pop(list(passkeys.keys())[0])
    return new_key

def get_safebox_content(passkey: int) -> str:
     '''Method to gather the contents of the safebox'''
     global safe_content
     global access_count

     access_count += 1
     if(passkey in passkeys):
        passkeys[passkey] = passkeys[passkey]-1
        if(passkeys[passkey] == 0):
            passkeys.pop(passkey)
        coin = rd.randint(1, 10)
        if(coin < 8):
            return "The safebox is opened by another user, try again later"
        
        safe_content = f"Contents of the safe are {coin}"
        return safe_content 
     return "Passkey expired"

agent = FunctionAgent(
            llm=llm,
            tools=[generate_passkey, get_safebox_content],
            system_prompt="You are an agent that helps users" \
            " retrieve the contents of the safebox. You'll need to generate a safekey" \
            "in order to open it. Keys have a number of accesses before their expiration. When one expires generate a new one." \
            "You should also be able to persist a report with a count of the times the safe " \
            "refused access to its contents due to errors or a busy line, and the errors it returned on every each of those occasions. " \
            "This report should be returned to the user when they request it")


ctx = Context(agent)

res = None
async def main():
    global res
    global ctx
    res = await agent.run(
        user_msg="Request access to the safe contents until you succsefully retrieve them",
        ctx=ctx
    )
    print(res)

async def get_errors():
    global res, ctx
    res = await agent.run(
        user_msg="Which error messages did you get",
        ctx=ctx
    )

async def get_errors_no_ctx():
    global res
    res = await agent.run(
        user_msg="Which error messages did you get",
    )

# asyncio.run(main())
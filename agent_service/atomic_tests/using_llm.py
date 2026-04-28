from llama_index.llms.google_genai import GoogleGenAI
from llama_index.core.llms import ChatMessage
from os import environ

# llm = GoogleGenAI(model=environ.get("LLM_MODEL", ""))

# # res = llm.complete(prompt="SROOT decomposition")
 
# res = llm.chat(messages=[
#     ChatMessage(role="system", content="You are a chinese speaking agent, thats the only language you know"),

#     ChatMessage(role="ser", content="Hellow there")
# ])


# print(res)


# import google.genai as genai

# client =  genai.Client()
# list = client.models.list()

# for e in list:
#     print('-' * 40)
#     print(e.name)
#     print(e.display_name)
#     print(e.thinking)
#     print(e.description)

#     # print(e.supported_generation_methods)


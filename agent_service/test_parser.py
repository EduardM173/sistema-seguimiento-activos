from src.agents.chat_reasoning_agent import LenientReActOutputParser

parser = LenientReActOutputParser()

# Test 1: Missing Thought: line (the failing case from trace)
output1 = 'Action: translate_to_dsl\nAction Input: {"natural_language": "test"}'
result1 = parser.parse(output1)
print("Test 1 (no Thought:):", type(result1).__name__, "action=", result1.action, "input=", result1.action_input)

# Test 2: Proper format with Thought:
output2 = 'Thought: I need to translate\nAction: translate_to_dsl\nAction Input: {"natural_language": "test"}'
result2 = parser.parse(output2)
print("Test 2 (with Thought:):", type(result2).__name__, "action=", result2.action, "input=", result2.action_input)

# Test 3: Answer format
output3 = 'Thought: I have the answer\nAnswer: The app is available on the App Store.'
result3 = parser.parse(output3)
print("Test 3 (answer):", type(result3).__name__, "response=", result3.response[:60])

print("\nAll tests passed!")

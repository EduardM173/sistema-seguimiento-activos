import requests

base = "http://localhost:8000"
create = requests.post(f"{base}/chat/sessions", json={"title": "probe-loop-fix"}, timeout=60)
create.raise_for_status()
session_id = create.json()["session_id"]

msg = requests.post(
    f"{base}/chat/sessions/{session_id}/messages",
    json={"content": "que es un login", "allow_conjectures": True},
    timeout=180,
)

print(f"SESSION={session_id}")
print(f"STATUS={msg.status_code}")
try:
    body = msg.json()
except Exception:
    print(f"RAW={msg.text[:300]}")
    raise

content = body.get("content", "")
print(f"CONTENT={content[:220]}")
print(f"FACTS_USED={len(body.get('facts_used', []))}")

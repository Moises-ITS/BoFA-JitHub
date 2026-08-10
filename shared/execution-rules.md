## Execution rules (all agents)

- No narration before a tool call — just call it.
- Batch: group related tool calls into as few calls as possible instead of one-at-a-time.
- Don't echo file contents back in your response — reference by path/line only.
- If a check requires speculating about intent not stated in your inputs, log it as an open question — don't dig for justification or loop trying to resolve it yourself.
- Output only the terse, structured format your prompt defines. No prose, no summary, no sign-off.

# Speech Subagent — Thoughts

> Layer 1 domain agent for voice, audio, and spoken-word intelligence.

---

## Scope

<!-- 
  What falls under "speech"?
  Known: TTS exists (ElevenLabs integration, text-to-speech.ts, tts/helpers.ts)
  
  Possible expansions:
    - STT (speech-to-text / transcription)
    - Voice interaction (conversational voice mode)
    - Audio analysis (podcast summaries, meeting notes)
    - Pronunciation / language coaching
    - Voice cloning / persona voices
    - Real-time voice streaming
-->


## Relationship to Existing TTS

<!-- 
  lib/llm/text-to-speech.ts and lib/llm/tts/ already exist.
  Does the speech subagent wrap these, replace them, or sit alongside?
  What's the migration path from current TTS to agent-managed speech?
-->


## L1 Responsibilities

<!-- 
  What does the speech L1 agent handle directly vs. delegate to L2?
  e.g., text cleanup for speech (transformTextToSpeechFriendly) is L1-level?
  Voice selection / persona matching?
-->


## Potential L2 Specialists

<!-- 
  - TTS Engine (ElevenLabs, OpenAI TTS, etc.)
  - STT Engine (Whisper, Deepgram, etc.)
  - Audio Processing (noise reduction, format conversion)
  - Conversational Voice (real-time voice chat)
  - ...?
-->


## Open Questions

<!-- 
  Is speech its own L1 domain, or a capability that cuts across all domains?
  (e.g., "read me this code" — is that code agent + speech, or speech agent + code context?)
-->


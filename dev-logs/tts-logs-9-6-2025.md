# TTS Performance Logs - September 6, 2025

## Timing Summary by Code Flow

### Flow 1: Chat Request Processing (Spark Endpoint)

| Step      | Component          | Operation                            | Duration (ms) | Duration (s) | Notes                  |
| --------- | ------------------ | ------------------------------------ | ------------- | ------------ | ---------------------- |
| 1         | **Chat Route**     | Initial request to stream complete   | 20,272.73     | 20.27        | Main chat processing   |
| 2         | **Chat Route**     | Ops processing                       | 0.46          | 0.0005       | Post-stream operations |
| 3         | **Chat Route**     | Stream complete to ops processed     | 0.90          | 0.001        | Transition time        |
| 4         | **Chat Route**     | Initial request to onFinish complete | 20,273.75     | 20.27        | Total chat time        |
| **Total** | **Spark Endpoint** | **Complete request**                 | **28,823.00** | **28.82**    | **End-to-end**         |

### Flow 2: TTS Processing Pipeline

| Step | Component          | Operation                    | Duration (ms) | Duration (s) | Notes                    |
| ---- | ------------------ | ---------------------------- | ------------- | ------------ | ------------------------ |
| 1    | **TTS Route**      | Parameters obtained          | 0.27          | 0.0003       | Initial setup            |
| 2a   | **Text Transform** | First attempt generation     | 4,019.86      | 4.02         | Initial processing       |
| 2b   | **Text Transform** | Validated transcript         | 5,782.10      | 5.78         | Validation step          |
| 3a   | **Text Transform** | Better version transcript    | 5,728.15      | 5.73         | Improved processing      |
| 3b   | **Text Transform** | Final speech-friendly text   | 15,531.72     | 15.53        | Final text optimization  |
| 4    | **TTS Route**      | Speech-friendly text (total) | 15,531.89     | 15.53        | Text processing complete |
| 5    | **TTS Route**      | ElevenLabs speech generation | 534.11        | 0.53         | Audio synthesis          |

### Performance Breakdown by Stage

| Stage                   | Total Duration (s) | % of Total Time | Key Operations                     |
| ----------------------- | ------------------ | --------------- | ---------------------------------- |
| **Chat Processing**     | 20.27s             | 70.3%           | LLM response generation, streaming |
| **Text Transformation** | 15.53s             | 53.9%           | Speech-friendly text optimization  |
| **Audio Generation**    | 0.53s              | 1.8%            | ElevenLabs synthesis               |

| **Setup/Overhead** | ~8.55s | 29.7% | Remaining time (parallel processing) |

## Key Performance Insights

- **Longest Operation**: Spark endpoint total request time (28.82s)
- **Text Processing**: Speech-friendly text generation took ~15.53s
- **AI Model Generation**: ElevenLabs speech synthesis was relatively fast at 0.53s
- **Chat Processing**: Main chat processing took ~20.27s
- **Model Used**: `eleven_flash_v2_5` from ElevenLabs

## Raw Logs

```sh
[app/api/tts/route.ts]/[TTS Route] Parameters obtained in 0.27466700004879385 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] First attempt speech-friendly text generation completed in 4019.858666999964 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Validated transcript generation completed in 5782.099208 milliseconds
[app/api/chat/route.ts]/[POST] Time from initial request recieved to stream complete: 20272.725083000027 milliseconds
[app/api/chat/route.ts]/[POST] Processing message for ops: Organic LLM is ready to stress-test your system-level interaction ideas and push for true novelty....
[app/api/chat/route.ts]/[POST] Ops processed in 0.45633299998007715 milliseconds
[app/api/chat/route.ts]/[POST] --------------------------------
[app/api/chat/route.ts]/[POST] OPS_ENV_EXTRACTED: null
[app/api/chat/route.ts]/[POST] --------------------------------
[app/api/chat/route.ts]/[POST] Time from stream complete to ops processed: 0.9031249999534339 milliseconds
[app/api/chat/route.ts]/[POST] Time from initial request recieved to streams onFinish complete: 20273.751582999947 milliseconds

POST /api/chat/spark 200 in 28823ms

[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Better version of transcript generation completed in 5728.14612499997 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Better version of transcript: A
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Speech-friendly text generation completed in 15531.718790999963 milliseconds
[app/api/tts/route.ts]/[TTS Route] Speech-friendly text: Organic LLM is ready to stress-test your system-level interaction ideas and push for true novelty.
[app/api/tts/route.ts]/[TTS Route] Speech-friendly text generation completed in 15531.88520800008 milliseconds
[app/api/tts/route.ts]/[TTS Route] Using model: eleven_flash_v2_5, from provider: elevenlabs.speech
[app/api/tts/route.ts]/[TTS Route] Speech model generation completed in 534.1127090000082 milliseconds
```

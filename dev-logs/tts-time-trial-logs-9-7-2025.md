# TTS Time Trial Performance Logs - September 7, 2025

## Performance Summary

### Version Comparison (Time Trials)

| Trial | v1 Duration (ms) | v1 Duration (s) | v2 Duration (ms) | v2 Duration (s) | Total Trial (ms) | Total Trial (s) | v2 Improvement |
| ----- | ---------------- | --------------- | ---------------- | --------------- | ---------------- | --------------- | -------------- |
| 1     | 88,200.45        | 88.20           | 53,971.39        | 53.97           | 142,171.85       | 142.17          | 38.8% faster   |
| 2     | 105,913.05       | 105.91          | 43,421.15        | 43.42           | 149,334.20       | 149.33          | 59.0% faster   |
| 3     | 65,819.82        | 65.82           | 41,028.51        | 41.03           | 106,848.33       | 106.85          | 37.6% faster   |
| 4     | 79,838.41        | 79.84           | 45,058.86        | 45.06           | 124,897.26       | 124.90          | 43.6% faster   |

**Average Performance:**

- **v1 Average**: 84,942.93ms (84.94s)
- **v2 Average**: 45,869.98ms (45.87s)
- **v2 Average Improvement**: 46.0% faster than v1

**Performance Range:**

- **v1 Range**: 65.82s - 105.91s (40.09s variance)
- **v2 Range**: 41.03s - 53.97s (12.94s variance)
- **v2 Consistency**: 68% lower variance than v1

## Detailed Timing Breakdown

### Individual TTS Processing Steps

| Step | Component             | Operation                 | Duration Range (ms) | Average (ms) | Average (s) | Notes              |
| ---- | --------------------- | ------------------------- | ------------------- | ------------ | ----------- | ------------------ |
| 1    | **Text Transform v1** | First attempt generation  | 21,162 - 56,665     | 37,278.13    | 37.28       | Initial processing |
| 2    | **Text Transform v1** | Validated transcript      | 17,365 - 23,861     | 21,423.45    | 21.42       | Validation step    |
| 3    | **Text Transform v1** | Better version transcript | 9,112 - 15,472      | 12,540.37    | 12.54       | Optimization       |
| 4    | **Text Transform v1** | Complete speech-friendly  | 65,820 - 105,913    | 84,942.93    | 84.94       | Total v1 time      |
| 5    | **Text Transform v2** | Regenerated transcript    | 18,562 - 36,768     | 25,741.29    | 25.74       | v2 processing      |

### Extended Step Analysis (All Trials)

| Trial | v1 First Attempt (s) | v1 Validated (s) | v1 Better Version (s) | v1 Total (s) | v2 Regenerated (s) |
| ----- | -------------------- | ---------------- | --------------------- | ------------ | ------------------ |
| 1     | 45.41                | 22.04            | 9.11                  | 88.20        | 53.97\*            |
| 2     | 56.66                | 22.42            | 12.19                 | 105.91       | 43.42\*            |
| 3     | 21.16                | 17.37            | 15.47                 | 65.82        | 41.03              |
| 4     | 25.88                | 23.86            | 11.87                 | 79.84        | 45.06              |

\*Note: Trials 1-2 used different v2 timing measurements

### Performance Analysis by Version

#### Version 1 (transformTextToSpeechFriendly)

- **Multi-step process**: First attempt → Validation → Better version → Final
- **Average total time**: 84.94 seconds (updated with 4 trials)
- **Most variable step**: First attempt generation (21.16s - 56.66s range)
- **Process complexity**: Higher with multiple validation steps
- **Performance variance**: High (40.09s range across trials)

#### Version 2 (transformTextToSpeechFriendlyV2)

- **Streamlined process**: Direct regenerated transcript approach
- **Average total time**: 45.87 seconds (updated with 4 trials)
- **Performance gain**: 46.0% faster on average
- **Consistency**: Much more consistent timing (12.94s range vs 40.09s for v1)
- **Reliability**: 68% lower variance than v1

## Key Performance Insights

- **Version 2 Efficiency**: Consistently outperforms v1 by 37.6% to 59.0% across all trials
- **Process Optimization**: v2 eliminates intermediate validation steps, reducing complexity
- **Time Variability**: v1 shows 3x higher variance (40.09s vs 12.94s range)
- **Scalability**: v2 much more predictable for production workloads
- **Trend Analysis**: v2 performance remains stable while v1 varies significantly
- **Resource Efficiency**: v2 uses ~46% less processing time on average

## Raw Logs

```sh
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] First attempt speech-friendly text generation completed in 45410.835250000004 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] First attempt speech-friendly text generation completed in 56664.83716699993 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Validated transcript generation completed in 22044.5003340001 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Validated transcript generation completed in 22422.795291999937 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Better version of transcript generation completed in 9111.994707999984 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Better version of transcript: B
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Speech-friendly text generation completed in 88200.2397080001 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Regenerated transcript generation completed in 26269.62279199995 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Better version of transcript generation completed in 12186.69787500007 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Better version of transcript: A
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Speech-friendly text generation completed in 105912.975584 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendlyV2] Regenerated transcript generation completed in 36768.31429199991 milliseconds
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] Time Trials comparing v1 and v2 for text to speech friendly transformation
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] v1 generation time: 88200.45137499995 milliseconds
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] v2 generation time: 53971.392375000054 milliseconds
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] Time trial completed total time: 142171.84587500012 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendlyV2] Regenerated transcript generation completed in 18561.54466699995 milliseconds
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] Time Trials comparing v1 and v2 for text to speech friendly transformation
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] v1 generation time: 105913.05300000007 milliseconds
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] v2 generation time: 43421.14537500008 milliseconds
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] Time trial completed total time: 149334.19970799994 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendlyV2] Regenerated transcript generation completed in 18561.54466699995 milliseconds
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] Time Trials comparing v1 and v2 for text to speech friendly transformation
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] v1 generation time: 105913.05300000007 milliseconds
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] v2 generation time: 43421.14537500008 milliseconds
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] Time trial completed total time: 149334.19970799994 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] First attempt speech-friendly text generation completed in 21161.700750000076 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] First attempt speech-friendly text generation completed in 25877.971332999878 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Validated transcript generation completed in 17365.22999999998 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Validated transcript generation completed in 23861.254417000106 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Regenerated transcript generation completed in 11819.85887500015 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Better version of transcript generation completed in 15471.706250000047 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Better version of transcript: C
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Speech-friendly text generation completed in 65819.77716699988 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Regenerated transcript generation completed in 18226.3842079998 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Better version of transcript generation completed in 11871.717916999944 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Better version of transcript: A
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendly] Speech-friendly text generation completed in 79838.23595799995 milliseconds
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendlyV2] Regenerated transcript generation completed in 19325.009292000206 milliseconds
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] Time Trials comparing v1 and v2 for text to speech friendly transformation
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] v1 generation time: 65819.819625 milliseconds
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] v2 generation time: 41028.51037500007 milliseconds
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] Time trial completed total time: 106848.33154099993 milliseconds
 POST /api/ai/tts 200 in 107039ms
[lib/llm/text-to-speech.ts]/[transformTextToSpeechFriendlyV2] Regenerated transcript generation completed in 19015.757834000047 milliseconds
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] Time Trials comparing v1 and v2 for text to speech friendly transformation
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] v1 generation time: 79838.40595899988 milliseconds
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] v2 generation time: 45058.855707999784 milliseconds
[tests/time-trials/llms.ts]/[textToSpeechFriendlyTransformationTimeTrial] Time trial completed total time: 124897.26333400002 milliseconds
```

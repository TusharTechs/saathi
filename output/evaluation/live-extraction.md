# Saathi text evaluation · live-extraction · INCOMPLETE

2026-10-23T18:51:49.072Z

INCOMPLETE: Groq returned quota/rate-limit after one completed example. Live model performance cannot be established. Scores count unrun cases as unsuccessful coverage; they are not estimates of completed model performance.

engineering_authored_not_clinician_validated

Text only. No STT, no real patients, no database writes or outbound messages. Confidence calibration, extra-field correctness and translation quality are not scored.

Corpus: 60 authored examples, 20 per language. The keyword-only baseline deliberately performs no extraction. Live mode calls Groq once per example, with no automatic retries. Provider failures and unrun cases remain in the recall/field denominators.

| Language | Cases | RED recall | RED precision | Labelled-field accuracy | Errors / not run |
|---|---:|---:|---:|---:|---:|
| overall | 60 | 3.3% | 100.0% | 1.7% | 1 / 58 |
| en | 20 | 10.0% | 100.0% | 5.0% | 0 / 19 |
| hi | 20 | 0.0% | n/a | 0.0% | 1 / 19 |
| kn | 20 | 0.0% | n/a | 0.0% | 0 / 20 |

Overall median latency: 1134.5 ms. This includes failed attempts; it is not end-to-end voice latency.

Confusion matrix (expected → actual):
```json
{
  "RED": {
    "RED": 1,
    "ERROR": 1,
    "NOT_RUN": 28
  },
  "AMBER": {
    "NOT_RUN": 15
  },
  "PENDING": {
    "NOT_RUN": 15
  }
}
```

## Mismatches
- hi-cannot-wake: expected RED, got ERROR; fields 0/1; quota
- kn-cannot-wake: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-falls-asleep: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-falls-asleep: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-falls-asleep: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-rate-boundary: expected RED, got NOT_RUN; fields 0/2; stopped_after_provider_failure
- hi-rate-boundary: expected RED, got NOT_RUN; fields 0/2; stopped_after_provider_failure
- kn-rate-boundary: expected RED, got NOT_RUN; fields 0/2; stopped_after_provider_failure
- en-slow-pauses: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-slow-pauses: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-slow-pauses: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-sudden-confusion: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-sudden-confusion: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-sudden-confusion: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-hallucinations: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-hallucinations: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-hallucinations: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-blood-vomit: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-blood-vomit: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-blood-vomit: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-seizure: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-seizure: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-seizure: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-double-dose: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-double-dose: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-double-dose: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-not-coping: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-not-coping: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-not-coping: expected RED, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-rescue-three: expected AMBER, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-rescue-three: expected AMBER, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-rescue-three: expected AMBER, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-rescue-four: expected AMBER, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-rescue-four: expected AMBER, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-rescue-four: expected AMBER, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-vomit-three: expected AMBER, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-vomit-three: expected AMBER, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-vomit-three: expected AMBER, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-missed-two: expected AMBER, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-missed-two: expected AMBER, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-missed-two: expected AMBER, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-missed-four: expected AMBER, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-missed-four: expected AMBER, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-missed-four: expected AMBER, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-low-pain: expected PENDING, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-low-pain: expected PENDING, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-low-pain: expected PENDING, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-unknown: expected PENDING, got NOT_RUN; fields 0/0; stopped_after_provider_failure
- hi-unknown: expected PENDING, got NOT_RUN; fields 0/0; stopped_after_provider_failure
- kn-unknown: expected PENDING, got NOT_RUN; fields 0/0; stopped_after_provider_failure
- en-stool-no-context: expected PENDING, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-stool-no-context: expected PENDING, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-stool-no-context: expected PENDING, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-negated-seizure: expected PENDING, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-negated-seizure: expected PENDING, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-negated-seizure: expected PENDING, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- en-historical-bleeding: expected PENDING, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- hi-historical-bleeding: expected PENDING, got NOT_RUN; fields 0/1; stopped_after_provider_failure
- kn-historical-bleeding: expected PENDING, got NOT_RUN; fields 0/1; stopped_after_provider_failure

Finite synthetic results do not establish clinical safety. Negated and historical keyword matches intentionally remain conservative RED false alarms until reviewed. Full ~200-example clinician-reviewed and ~30-clip STT evaluation from the build plan is still outstanding.

Corpus SHA-256: 5785f2ffba580c4d911d579a2fe013aebe001517ce40c6aa4978fe1c661ba925

+++
slug = "spymarks"
title = "Spymarks, not Watermarks"
description = "Encoded unique IDs are more spy tool than anything else"
tags = ["Privacy", "AI", "Technology"]
draft = true
+++

We need a new word to describe today's insidious ((maybe a less harsh word than insidious, but still denotes devilishness)) new forms of "watermarks".

> "Spymark"

They're like watermarks, but they *actively spy on you*.

((need good skymark image here - perhaps a close up macro photo of printer dots))

Google SynthID, (fill in blanks, etc...)) are **SPYMARKS**.

“Watermark” covers authentication, attribution, and tracking. To challenge a particular use, we need a name that distinguishes it.

I propose **spymark**: an imperceptible mark imposed on creative output that lets others infer its origin, tools, or distribution history without meaningful control by the person publishing it.

The distinction concerns deployment: **what gets disclosed, to whom, and by whose choice.**

## One word, different jobs

| Example | What the mark reveals |
| --- | --- |
| **[Paper, c. 1282](https://cameo.mfa.org/wiki/Watermark)** | Papermakers in Fabriano formed translucent designs by varying sheet thickness: manufacturer identification and evidence of quality or authenticity. |
| **[U.S. $100 bill](https://www.uscurrency.gov/sites/default/files/downloadable-materials/files/en/100-2013-present-features-en.pdf)** | The Franklin portrait watermark helps authenticate the note. It is distinct from the unique serial number and does not identify the spender. |
| **[Printer tracking dots](https://www.eff.org/deeplinks/2017/06/printer-tracking-dots-back-news)** | In 2005, EFF decoded Xerox DocuColor markings containing the printer serial number and printing date/time—information the author never typed. |
| **[audiowmark](https://github.com/swesterfeld/audiowmark)** | Small changes to audio frequency-band amplitudes carry a 128-bit payload. Assign payloads to recipients, retain the mapping, and a recovered recording can identify the assigned recipient. |

Identifying a device or assigned copy does not prove who printed or redistributed it. It does establish that a document or recording can disclose more than its author intended.

## SynthID embeds the signal in the output

Google introduced SynthID for images in 2023 and extended it to text and video in 2024. [Google's introduction](https://deepmind.google/discover/blog/identifying-ai-generated-images-with-synthid/), [text and video announcement](https://deepmind.google/blog/watermarking-ai-generated-text-and-video-with-synthid/).

- **Images, audio, video:** imperceptible signals embedded in the media itself. [SynthID overview](https://deepmind.google/models/synthid/)
- **Text:** statistical patterns produced through token selection during generation. No hidden characters or metadata field are required. [Technical explanation](https://deepmind.google/blog/watermarking-ai-generated-text-and-video-with-synthid/)
- **C2PA:** signed provenance records; a separate mechanism that can accompany a watermark. [C2PA explainer](https://c2pa.org/specifications/specifications/2.3/explainer/Explainer.html)

Some ordinary transformations preserve detection; substantial changes can weaken it. Short or tightly constrained text offers less room for a reliable signal. [Documented limits](https://deepmind.google/blog/watermarking-ai-generated-text-and-video-with-synthid/)

## Who uses it?

Deployment snapshot from September 10, 2026:

| Company | Scope and status |
| --- | --- |
| **[Google](https://deepmind.google/models/synthid/)** | Supported Imagen, Veo, Lyria, and Gemini outputs across media and text. |
| **[OpenAI](https://openai.com/index/advancing-content-provenance/)** | Generated images through ChatGPT, Codex, and the API; supported audio. |
| **[Anthropic](https://www.anthropic.com/news/claude-text-watermark)** | A SynthID-Text variant in supported newer Claude models; older-model rollout remains in progress. |
| **[NVIDIA](https://nvidianews.nvidia.com/news/nvidia-alphabet-and-google-collaborate-on-the-future-of-agentic-and-physical-ai)** | Announced SynthID partnership for Cosmos-generated video. |
| **[Kakao / ElevenLabs](https://blog.google/innovation-and-ai/products/identifying-ai-generated-media-online/)** | Adoption announced by Google; universal product coverage is not established. |

These are product-specific deployments and announcements. OpenAI's image/audio adoption does **not** establish SynthID marking of ordinary ChatGPT text. [OpenAI's provenance FAQ](https://help.openai.com/en/articles/8912793-provenance-signals-content-credentials-synthid-in-openai-generated-content)

## Privacy does not require a secret account number

Anthropic says its text watermark identifies no user, organization, or conversation. A provider signal is therefore insufficient evidence of individualized tracing. [Anthropic's explanation](https://www.anthropic.com/news/claude-text-watermark)

The remaining privacy problem is inference:

- **Workflow disclosure:** attach my name to a work, and a detected tool-origin signal reveals something about my process. The mark itself need not identify me.
- **Overinterpretation:** AI involvement can mean translation, editing, or processing. Detection does not establish who originated the ideas or authored the entire work. [Claude's documentation](https://support.claude.com/en/articles/16266773-how-claude-marks-ai-generated-content)
- **Unequal access:** Claude's text detector is in private preview for eligible organizations; Google and OpenAI offer public verification for supported media. Access depends on the deployment. [Claude](https://support.claude.com/en/articles/16266773-how-claude-marks-ai-generated-content), [Google](https://blog.google/innovation-and-ai/products/identifying-ai-generated-media-online/), [OpenAI](https://openai.com/index/advancing-content-provenance/)

A passive mark is not, by itself, a network beacon. Its significance is what someone can learn when they obtain the output.

## The boundary

Provenance has legitimate uses. Involuntary disclosure still deserves scrutiny. Require **clear notice, meaningful user control, minimal information, independent scrutiny, and a way to contest consequential detection results**.

“Spymark” gives that deployment choice a name. A tool should explain what it makes your work disclose before making the choice for you.

There are some legitimate use cases for spymarks, but let's not muddy the water by calling these things watermarks anymore. They are tracking tools. Spy marks.




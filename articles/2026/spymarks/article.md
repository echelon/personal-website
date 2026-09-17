+++
slug = "spymarks"
title = "Spymarks, not Watermarks"
description = "Encoded unique IDs are more spy tool than protection"
tags = ["Privacy", "AI", "Technology"]
draft = true
+++

We need a new word to describe today's sneaky new evolution of "watermarks":

<div class="spymark-intro">

```embed
src = "spymark-title.ts"
title = "Spymark"
height = 410
fallback = "“Spymark”"
```

</div>

A **watermark** is a mark embedded in paper or media to assert ownership, identify an official source, or verify authenticity. It typically denotes a third party authority. It's a cute little term.

A **spymark**, by contrast, is a hidden signal that forces your work disclose its origin, tools, or distribution history without meaningful control by you. It can map directly back to you, often without your knowledge.


## Spymarking is sneaking into your files

**[Google SynthID](https://deepmind.google/models/synthid/)** is a spymark "imperceptible to humans", as Google describes, and can embed database IDs into images, audio, text, and video.

This was not the first spymark system designed, and it's hardly the only one under active deployment. Anthropic, OpenAI, and many other tech companies are developing these systems at scale. Soon Social Media, media production tools, and smartphones may find themselves filled with spymarking algorithms.

```embed
src = "image-watermarks.ts"
title = "An identifier inside an image"
height = 650
fallback = "A smaller version of Mochi’s photo contains a real toy watermark: ID 173, encoded through subtle pixel changes. Compare the original and marked image, animate the amplified differences, and decode the ID from the PNG. The associated author and timestamp are fictional."
```

<small>Photo supplied by the author. The amplified-signal view was inspired by Alosh’s <a href="https://medium.com/@aloshdenny/how-to-reverse-synthid-legally-feafb1d85da2">How to Reverse SynthID</a>. This example uses our own simple encoder and decoder; it demonstrates no SynthID detection or removal.</small>

## We need a new word for this

Unless you're an uber-nerd like me, this stuff just isn't interesting. Most ordinary people tire and zone out of the discourse on privacy. It's technical, it's boring, and it's not about to *immanentize the eschaton*.

Articulating this discussion requires a lot of shared context, and we can't keep having this front-loaded conversation over and over and expect people to pay attention.

> "To speak the name is to control the thing." &mdash; Ursula K. Le Guin

By creating a new word that captures the argument in two syllables, you collapse a salient and gain valuable territory. You no longer have to waste energy establishing the basic facts.

Ergo,

- *Spy*- &mdash; privacy-invading clandestine signal, not standard metadata

- -*mark* &mdash; already shared with watermark in both use and etymology.

Everything we have to say is immediately obvious. This is our *Rumpelstiltskin*.

## Spymarks are getting into everything


Meanwhile, an audio signal spymark is sneaky and doesn't necessarily announce its presence,

```embed
src = "audio-watermarks.ts"
title = "Audio watermark spectrograms"
height = 450
fallback = "Compare spectrograms of the same LJ Speech excerpt unwatermarked and with Timbre, AudioSeal, WavMark, FSVC, Patchwork, or Norm-Space. The authors’ original plots are linked below."
```

<small>Spectrograms from Wen et al. (2025), <a href="https://arxiv.org/abs/2503.19176">SoK: How Robust is Audio Watermarking in Generative AI models?</a> · <a href="https://sokaudiowm.github.io/">Original samples</a>. Plots retain the authors’ original scales.</small>

The user cannot see or hear such a spymark. Nor do they have any idea what the payload contains. These are frequency domain encoded values that resist compression and reencoding.

Spymarks in text are mostly limited to AI-generated or edited text, but they might soon find their way into articles, social media comments, or word processing tools as a means of tracking dissemination. A comment you read might be subtly edited by a platform so that if it's copied, they can trace who shared it.

```embed
src = "text-watermarks.ts"
title = "Text as a hidden identifier"
height = 650
fallback = "An illustrative encoding: eight word choices represent eight bits. The binary value 10101101 gives database ID 173, which can point to a record containing an author and timestamp. These are fictional examples, not a SynthID decoder."
```

<small>This demo illustrates word choices encoding an identifier, followed by a database lookup. <a href="https://deepmind.google/blog/watermarking-ai-generated-text-and-video-with-synthid/">Google DeepMind’s SynthID for text</a> instead detects statistical patterns in token choices to identify AI-generated text; it does not establish the personal-data lookup illustrated here.</small>

## The watermarks we all know and love

Watermarks are still out there, and they're mostly benign. They bear clear visual marks, easy for the user to spot. They are typically not nefarious, and they won't spy on you.

Sometimes they deter counterfeiting,

<figure style="max-width: 708px; margin-inline: auto;">
  <img src="media/twenty-dollar-watermark.png" alt="A $20 bill with a circular close-up of its faint portrait watermark." width="708" height="274" loading="lazy" decoding="async">
  <figcaption>A $20 bill and its portrait watermark. Image: <a href="https://www.uscurrency.gov/sites/default/files/currency_academy/scienceLab-watermarks.jpg">U.S. Currency Education Program</a>.</figcaption>
</figure>

Sometimes they denote ownership,

<figure style="max-width: 481px; margin-inline: 0 auto;">
  <a href="https://commons.wikimedia.org/wiki/File:DorotheaGetty.webp"><img src="media/dorothea-getty.webp" alt="Dorothea Lange’s Migrant Mother with a visible Getty Images watermark across the photograph." width="481" height="612" loading="lazy" decoding="async"></a>
  <figcaption><small>Dorothea Lange, <cite>Migrant Mother</cite> (1936) · Public domain in the U.S. · <a href="https://commons.wikimedia.org/wiki/File:DorotheaGetty.webp">Wikimedia Commons</a> · <a href="https://www.gettyimages.com/photos/migrant-mother-by-dorothea-lange">Getty Images listings</a>.</small></figcaption>
</figure>

And sometimes they're annoying,

(( imgflip example ))

These watermarks are all doing very different things. But one thing they don't do is track you.

## Standardized, user-editable tags are not Spymarks

Just adding an invisible digital signal to a file does not mean it's a spymark. The ID3 tags on MP3s are technically "invisible" to users, yet their inclusion is standardized, easy to edit, and almost universally accessible. You can even read them in the raw file &mdash; they don't try to hide from you, and you can easily scrub them if you want.

```embed
src = "id3-hex.ts"
title = "ID3 and EXIF metadata in hex"
height = 520
fallback = "Inspect editable ID3 and EXIF metadata in two tabs. ID3 shows an MP3’s title, artist, and album; EXIF shows fictional camera-maker, model, and author tags in a JPEG metadata segment. Hover or tap the bytes for explanations. These samples contain metadata only."
```

We need to be careful though: spymarks such as Google SynthID purport to be a "standard". Yet they does not limit what parties can encode to track users, nor does the spymark even announce to users its presence. Users have no idea and no control over what identifying data the payload contains.

## Keeping the future free

Imagine a future where every device is attested and every social media post is spymarked. It would be dangerously easy to hunt down anyone from a JPEG.

That future lies halfway between now and "1984". So let's work together to stay off that timeline, shall we?

Call a spymark what it is. A *spy* mark.

Now that we have a name for these things, we can start to demand platforms stop tracking us with them.

Imagined future horrors and slippery slopes are often called comedic hyperbole.

## Usage

<link rel="stylesheet" href="dictionary.css">

<dl class="spymark-dictionary">
  <div>
    <dt><dfn>spy·mark</dfn> <span class="dict-pronunciation">/ˈspaɪmɑːrk/</span> <span class="dict-part">noun</span></dt>
    <dd>
      <p class="dict-forms">plural <strong>spymarks</strong></p>
      <p>A hidden signal embedded in media to trace its origin, tools, or distribution history without the user’s meaningful control.</p>
      <p class="dict-example">“The spymarks tied each copy to a different recipient.”</p>
    </dd>
  </div>
  <div>
    <dt><dfn>spymark</dfn> <span class="dict-part">verb, transitive</span></dt>
    <dd>
      <p class="dict-forms"><strong>spymarked</strong>; <strong>spymarking</strong>; <strong>spymarks</strong></p>
      <p>To embed a spymark in a file or piece of media.</p>
      <p class="dict-example">“The service spymarks every image it exports.”</p>
    </dd>
  </div>
  <div>
    <dt><dfn>spymarking</dfn> <span class="dict-part">noun</span></dt>
    <dd>
      <p>The practice or process of embedding spymarks.</p>
      <p class="dict-example">“The platform introduced spymarking without telling its users.”</p>
    </dd>
  </div>
  <div>
    <dt><dfn>spymarked</dfn> <span class="dict-part">adjective</span></dt>
    <dd>
      <p>Containing a spymark.</p>
      <p class="dict-example">“Removing the file’s metadata left the image spymarked.”</p>
    </dd>
  </div>
</dl>

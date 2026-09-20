+++
slug = "spymarks"
title = "Spymarks, not Watermarks"
description = "Watermarks that spy on users are not watermarks"
tags = ["Privacy", "AI", "Technology"]
draft = true
nofollow_external_links = true
+++

There's a sneaky new evolution of the "watermark", let's call it &mdash; the spymark.

<div class="spymark-intro">

```embed
src = "spymark-title.ts"
title = "Spymark"
height = 410
fallback = "“Spymark”"
```

</div>

A **watermark** is a visible mark embedded in a physical or digital medium to verify authenticity or assert ownership.

A **spymark** is a hidden signal that forces your work to disclose its origin and distribution history without your knowledge or consent.

## Spymarking is sneaking into your files

**[Google SynthID](https://deepmind.google/models/synthid/)** is a spymark that embeds secret hidden signals "imperceptible to humans" (Google's own words) into images, audio, text, and video. This signal can encode database identifiers that map to your identity. Your user records, full name, IP addresses, date of birth, physical addresses, and more.

SynthID was not the first spymark system designed, and it's hardly the only one under active development. [Anthropic](https://www.anthropic.com/news/claude-text-watermark), [OpenAI](https://help.openai.com/en/articles/8912793-provenance-signals-content-credentials-synthid-in-openai-generated-content), and many other tech companies are developing these systems at scale. Social media, content production tools, and smartphones may soon find themselves filled with spymarking algorithms that sneak these signals into everything you publish.

For example, images can be invisibly altered in their frequency domain to carry tracking information &mdash; database IDs that contain a wealth of information on users:

```embed
src = "image-watermarks.ts"
height = 650
fallback = "A smaller version of Mochi’s photo contains a real toy watermark: ID 173, encoded through subtle pixel changes. Compare the original and marked image, animate the amplified differences, and decode the ID from the PNG. The associated author and timestamp are fictional."
```


## Why give it a new name?

"Watermark" has become a catchall for historical marks of authenticity, banknote security features, copyright overlays, and hidden tracking signals in our media. That last use of the term is the problem.

Most people tire of the discourse on privacy. It's complex, repetitive, and seems irrelevant to the typical day to day routine.

We can't keep explaining the technical background from scratch each time we need to communicate these concepts and expect people to pay attention.

> "To speak the name is to control the thing." &mdash; Ursula K. Le Guin, [*The Rule of Names*](https://www.onelimited.org/ss-leguin-02)

With a simple change we can put the privacy concern up front, cementing it in the conversation forever:

- *Spy-* &mdash; clandestine surveillance, involuntary disclosure
- *-mark* &mdash; embedded signal

Now we get to disambiguate what's going on while leveraging the familiar etymology. It collapses a technical communication salient &mdash; with just one new clear and coherent word we gain ground. No more wasting energy establishing the basic facts. It now comes baked in for free.

"Spymark" is a privacy *Rumpelstiltskin*.

## More Spymark examples

Here are a few more forms of spymarks so you can better familiarize yourself.

Audio watermarks operate by similar principles to image watermarks, and they are typically inaudible:

```embed
src = "audio-watermarks.ts"
title = "Audio watermark spectrograms"
height = 450
fallback = "Compare spectrograms of the same LJ Speech excerpt unwatermarked and with Timbre, AudioSeal, WavMark, FSVC, Patchwork, or Norm-Space. The authors’ original plots are linked below."
```

<small>Spectrograms from Wen et al. (2025), <a href="https://arxiv.org/abs/2503.19176">SoK: How Robust is Audio Watermarking in Generative AI models?</a> · <a href="https://sokaudiowm.github.io/">Original samples</a>. Plots retain the authors’ original scales.</small>

These schemes can survive compression or re-encoding.

For text, [SynthID steers token choices](https://deepmind.google/blog/watermarking-ai-generated-text-and-video-with-synthid/) to create a detectable statistical pattern:

```embed
src = "text-watermarks.ts"
height = 650
fallback = "An illustrative encoding: eight word choices represent eight bits. The binary value 10101101 gives database ID 173, which can point to a record containing an author and timestamp. These are fictional examples, not a SynthID decoder."
```

## Watermarks are benign, Spymarks are not

Watermarks remain easy for the user to spot and are typically not nefarious.

Sometimes they deter counterfeiting:

<figure style="max-width: 708px; margin-inline: auto;">
  <img src="media/twenty-dollar-watermark.png" alt="A $20 bill with a circular close-up of its faint portrait watermark." width="708" height="274" loading="lazy" decoding="async">
</figure>

Sometimes they claim ownership:

<figure style="max-width: 481px; margin-inline: 0 auto;">
  <a href="https://commons.wikimedia.org/wiki/File:DorotheaGetty.webp"><img src="media/dorothea-getty.webp" alt="Dorothea Lange’s Migrant Mother with a visible Getty Images watermark across the photograph." width="481" height="612" loading="lazy" decoding="async"></a>
  <figcaption><small>Dorothea Lange, <cite>Migrant Mother</cite> (1936) &mdash; <a href="https://www.gettyimages.com/p
hotos/migrant-mother-by-dorothea-lange">Getty sells</a> some <a href="https://en.wikipedia.org/wiki/Migrant_Mother">public domain images</a>.</small></figcaption>
</figure>

And sometimes they're just annoying:

<figure style="max-width: 500px; margin-inline: 0 auto;">
  <a href="https://en.wikipedia.org/wiki/Willy_Wonka_%26_the_Chocolate_Factory"><img src="media/deepfried-wonka-v3.webp" alt="A lightly deep-fried Willy Wonka meme with TOP TEXT and BOTTOM TEXT captions, a small imgflip.com watermark in the bottom-left corner, www.9gag.com at the top right, and a tilted ifunny.co stamp across the middle." width="640" height="640" loading="lazy" decoding="async"></a>
</figure>

But these watermarks don't track you.

[Printer tracking dots](https://en.wikipedia.org/wiki/Printer_tracking_dots) are spymarks.

<figure style="max-width: 512px; margin-inline: 0 auto;">
  <a href="https://commons.wikimedia.org/wiki/File:Machine_Identification_Code_von_Druckern.png"><img src="media/printer-tracking-dots.webp" alt="Diagram of printer tracking dots annotated to show encoded time, date, and printer serial number." width="512" height="384" loading="lazy" decoding="async"></a>
  <figcaption><small>Image: <a href="https://commons.wikimedia.org/wiki/File:Machine_Identification_Code_von_Druckern.png">EFF — Robert Lee, Seth Schoen, Patrick Murphy, Joel Alwen, and Andrew “bunnie” Huang</a> · <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>.</small></figcaption>
</figure>

## Standardized, user-editable tags are not spymarks

EXIF tags in photos and ID3 tags in MP3s are documented fields you can inspect, edit, and remove. EXIF can expose sensitive data such as [GPS coordinates](https://exiftool.org/TagNames/GPS.html). The distinction here is that the user is in control, and there is no attempt to hide this from the user.

```embed
src = "id3-hex.ts"
height = 520
fallback = "Inspect editable EXIF and ID3 metadata in two tabs. EXIF shows fictional camera-maker, model, and author tags in a JPEG metadata segment; ID3 shows an MP3’s title, artist, and album. Hover or tap the bytes for explanations. These samples contain metadata only."
```

A spymark signal embedded in pixels, audio, or word choices can remain after ordinary metadata is stripped.



## Keeping the future free

Imagine a future where every device is attested and every social media post carries an account-linked spymark. It would be dangerously easy to hunt down anyone from a JPEG.

That future lies halfway between now and *1984*. So let's stay off that timeline, shall we?

Call a spymark what it is. A *spy* mark.

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
      <p class="dict-example">“The social network spymarks every uploaded image.”</p>
    </dd>
  </div>
  <div>
    <dt><dfn>spymarking</dfn> <span class="dict-part">noun</span></dt>
    <dd>
      <p>The practice of embedding spymarks.</p>
      <p class="dict-example">“The platform introduced spymarking without telling its users.”</p>
    </dd>
  </div>
  <div>
    <dt><dfn>spymarked</dfn> <span class="dict-part">adjective</span></dt>
    <dd>
      <p>Containing a spymark.</p>
      <p class="dict-example">“Removing the file’s metadata still left the image spymarked.”</p>
    </dd>
  </div>
</dl>

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

## Spymarking is sneaking onto the internet

**[Google SynthID](https://deepmind.google/models/synthid/)** is a spymark that embeds secret hidden signals "imperceptible to humans" (Google's own words) into images, audio, text, and video. This signal can encode database identifiers that map to your identity. Your user records, full name, IP addresses, date of birth, physical addresses, political party affiliation, and more.

SynthID was not the first spymark system designed, and it's hardly the only one under active development. [Anthropic](https://www.anthropic.com/news/claude-text-watermark), [OpenAI](https://help.openai.com/en/articles/8912793-provenance-signals-content-credentials-synthid-in-openai-generated-content), and many other tech companies are developing these systems at scale. These companies claim spymarking can help identify AI-generated content, yet they've built tracking mechanisms and . Social media, content production tools, and smartphones may soon find themselves filled with spymarking algorithms that sneak these signals into everything you publish.

For example, images can be invisibly altered in their frequency domain to carry tracking information &mdash; database IDs that contain a wealth of information on users:

```embed
src = "image-watermarks.ts"
height = 650
fallback = "A smaller version of Mochi’s photo contains a real toy watermark: ID 173, encoded through subtle pixel changes. Compare the original and marked image, animate the amplified differences, and decode the ID from the PNG. The associated author and timestamp are fictional."
```


## Why give it a new name?

"Watermark" has become a catchall for historical marks of authenticity, banknote security features, copyright overlays, and hidden tracking signals in our media. That last use of the term is the problem, because watermarks have never before been so historically nefarious.

Most people tire of the discourse on privacy. It's complex, repetitive, and seems irrelevant to the typical day to day routine of the average citizen.

We can't keep explaining the technicalities behind statistical tracking tools each and every time we need to communicate these concepts to people and expect them to pay attention.

> "To speak the name is to control the thing." &mdash; Ursula K. Le Guin, [*The Rule of Names*](https://www.onelimited.org/ss-leguin-02)

With a simple change of terminology we can put the privacy concern up front, cementing this issue in the conversation forever:

- *Spy-* &mdash; clandestine surveillance, involuntary disclosure
- *-mark* &mdash; embedded signal

Now we get to disambiguate watermarks from what's actually going on while leveraging the familiar etymology. It collapses a technical communication salient &mdash; we gain a lot of ground with just one new word. It's clear, coherent, and straight to the point.

No more wasting energy establishing the basic facts. It now comes baked into the conversation for free.

"Spymark" is a privacy *Rumpelstiltskin*.

## More Spymark examples

Here are a few more forms of spymarks so you can better familiarize yourself.

Audio spymarks operate using principles similar to image spymarks, and they are typically inaudible. They make minute changes to frequency domain features to encode your personal information:

```embed
src = "audio-watermarks.ts"
title = "Audio watermark spectrograms"
height = 450
fallback = "Compare spectrograms of the same LJ Speech excerpt unwatermarked and with Timbre, AudioSeal, WavMark, FSVC, Patchwork, or Norm-Space. The authors’ original plots are linked below."
```

<small>Spectrograms from Wen et al. (2025), <a href="https://arxiv.org/abs/2503.19176">SoK: How Robust is Audio Watermarking in Generative AI models?</a> · <a href="https://sokaudiowm.github.io/">Original samples</a>. Plots retain the authors’ original scales.</small>

These schemes are engineered to be robust. They can often survive compression or re-encoding.

You can even encode personal information invisibly into text! [SynthID steers word choices](https://deepmind.google/blog/watermarking-ai-generated-text-and-video-with-synthid/) to create a detectable statistical pattern that can encode a tracking payload:

```embed
src = "text-watermarks.ts"
height = 650
fallback = "An illustrative encoding: eight word choices represent eight bits. The binary value 10101101 gives database ID 173, which can point to a record containing an author and timestamp. These are fictional examples, not a SynthID decoder."
```

## Watermarks are benign, Spymarks are not

Watermarks remain easy for the user to spot and are typically not nefarious.

Sometimes watermarks deter counterfeiting:

<figure style="max-width: 708px; margin-inline: 0 auto;">
  <img src="media/twenty-dollar-watermark.png" alt="A $20 bill with a circular close-up of its faint portrait watermark." width="708" height="274" loading="lazy" decoding="async">
</figure>

Sometimes watermarks claim ownership:

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

[Printer tracking dots](https://en.wikipedia.org/wiki/Printer_tracking_dots), on the other hand, are spymarks from the 1980's that perhaps never imagined such a sneaky scheme:

<figure style="max-width: 512px; margin-inline: 0 auto;">
  <a href="https://commons.wikimedia.org/wiki/File:Machine_Identification_Code_von_Druckern.png"><img src="media/printer-tracking-dots.webp" alt="Diagram of printer tracking dots annotated to show encoded time, date, and printer serial number." width="512" height="384" loading="lazy" decoding="async"></a>
  <figcaption><small>Image: <a href="https://commons.wikimedia.org/wiki/File:Machine_Identification_Code_von_Druckern.png">EFF — Robert Lee, Seth Schoen, Patrick Murphy, Joel Alwen, and Andrew “bunnie” Huang</a></small></figcaption>
</figure>

## Standardized, user-editable tags are not spymarks

We need to be clear that spymarks are a form of metadata you have limited knowledge and control over, and that the purpose is entirely antagonistic to you.

Metadata such as the EXIF tags in photos and the ID3 tags in MP3 files are standardized, well-documented fields that you can inspect, edit, and remove. While EXIF can expose sensitive data such as [GPS coordinates](https://exiftool.org/TagNames/GPS.html), the distinction is that you are in full control of these forms of data and are free to change or remove it. There is no attempt to hide this from you.


```embed
src = "id3-hex.ts"
height = 520
fallback = "Inspect editable EXIF and ID3 metadata in two tabs. EXIF shows fictional camera-maker, model, and author tags in a JPEG metadata segment; ID3 shows an MP3’s title, artist, and album. Hover or tap the bytes for explanations. These samples contain metadata only."
```

You can strip standard metadata tags out of your files. Unfortunately, a spymark signal embedded in pixels, audio, or word choices is invisible to you and can remain in your files even after you edit them.

Furthermore, whereas tags are helpful for maintaining information such as song titles or a photo's exposure settings, spymarks encode user-tracking identifiers entirely opaque and useless to you. Spymarks serve only to identify the spread of your content, and they are permanently burned into your files so that when your family, friends, and customers share your files, your fingerprints remain all over them for firms to continue tracking you forever.

## Keeping our files free of spying

It's hard to imagine the future where we can't even trust our own files. And the sad thing is that this has already started.

Spymarks are certainly not great for whistleblowers or anyone who doesn't want to be persecuted for their words or affiliations. No matter where you stand on whatever issues, spymarks can be used against you and those you care about.

Imagine a future where every device is attested and every social media post carries an account-linked spymark. Where every file or post served to you for sharing has spymarks embedded within, to track who you share them with. In this world, it would be dangerously easy to hunt down anyone from a JPEG or a tweet. Or track the web of humans through which "dangerous ideas" flow.

That future lies halfway between now and *1984*. So let's stay off that timeline, shall we?

Call a spymark what it is. A *spy* tool used to spy on you and everyone you interact with.

&mdash; Brandon Thomas

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

# Image-Optimization with Web Assembly Encoders

The code will generate below formats

Using the [squoosh](https://github.com/GoogleChromeLabs/squoosh/) 💥 encoders compiled to wasm + emscripten. We utilize wasm encoders for webp, avif and mozjpeg to encode our images and create optimized images.

Using sharp~ library for resizing the image before encoding.

Before encoding need to convert the image buffers to unit8Clipped pixels array for png and jpg for the wasm encoders to compress.

The codecs are copied from the codecs folder of the sqooush app

We are getting awesome results for AVIF, WEBP and JPEG images 💡

```
avif (creates really small sized images for big resolution encoding)
jpg (mozjpeg encoder creates progressive jpeg with really good quality and compression)
png±
webp (creates quality images with very less size. But not progressive)
```

and sizes

```
 980px 720px 640px, 480px, 420px, 360px, 300px, 240px, 180px, 140px
```

For Backgrounds

```
2K, FHD, HD, 720P
```

of an image

## How to run locally

```
npm install

npm run test
```

## Build for AWS

```
npm install
npm run zip
upload the image-optimization-wasm(date).zip to lamda in aws
```

SAMPLE IMAGES GENERATED

AVIF
(33.5 KB)
![AVIF](https://revolver-imageoptimization-lamda-srcset.s3-eu-west-1.amazonaws.com/images/640w/201.avif)

WEBP
(48.2 KB)
![WEBP](https://revolver-imageoptimization-lamda-srcset.s3-eu-west-1.amazonaws.com/images/640w/201.webp)

JPEG
(52.8KB)
![JPEG](https://revolver-imageoptimization-lamda-srcset.s3-eu-west-1.amazonaws.com/images/640w/201.jpeg)

± Work in progress
~ Can be changed to better encoders in future

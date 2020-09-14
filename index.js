const path = require('path');
const AWS = require('aws-sdk');
const util = require('util');
const sharp = require('sharp');
// const fs = require('fs');
const webp_enc = require('./codecs/webp/enc/webp_enc.js');
const mozjpeg_enc = require('./codecs/mozjpeg_enc/mozjpeg_enc.js');
const avif_enc = require('./codecs/avif/enc/avif_enc.js');
const inkjet = require('inkjet');
// const squoosh_resize_bg = require('./codecs/resize/pkg/squoosh_resize_bg.js');
const PNG = require('png-js');

// const EventEmitter = require('events');

// class MyEmitter extends EventEmitter { }

// const myEmitter = new MyEmitter();
// // increase the limit
// myEmitter.setMaxListeners(100);

// const { createImageData } = require('canvas')
// emitter.setMaxListeners();
// get reference to s3 client
const s3 = new AWS.S3();
// getting configurations from config file
// later can move to environment varibale make this a default fallback
const { sizesArray, formats, backgroundOnly } = require('./config');

// default cache if cache is not set
const DEFAULT_CACHE_CONTROL = 'max-age=31536000';

// method: 'lanczos3',
//   fitMethod: 'stretch',
//   premultiply: true,
//   linearRGB: true,
// 'triangle', 'catrom', 'mitchell', 'lanczos3',

// Image processing
async function processImage(srcBucket, srcKey, srcFolder, dstBucket, srcFile, imageType) {
    log('srcBucket:\n', srcBucket);
    log('srcKey:\n', srcKey);
    log('srcFolder:\n', srcFolder);
    log('srcFile:\n', srcFile);
    log('dstBucket\n', dstBucket);
    log('imageType\n', imageType);

    // checking if the file is an image else skip processing
    if (
        imageType == '.jpg' ||
        imageType == '.jpeg' ||
        imageType == '.png' ||
        imageType == '.gif' ||
        imageType == '.swf' ||
        imageType == '.eps'
    ) {
        log('imageType to be processed:\n', imageType);
    } else {
        log(`skipping non-image type: ${srcKey}`);
        return;
    }

    let sizes = srcKey.includes('/background/')
        ? sizesArray
        : sizesArray.filter((s) => !backgroundOnly.includes(s.width));

    // getting the soruce image from s3 bucket
    const response = await s3.getObject({ Bucket: srcBucket, Key: srcKey }).promise();
    console.log('====================================');
    console.log(response.Body);
    console.log('====================================');
    // getting cache control
    const cacheControl = response.CacheControl || DEFAULT_CACHE_CONTROL;
    // creating shartp image blob using Sharp Library
    for (const size of sizes) {
        const image = await sharp(response.Body).resize(size.width, null);
        const buffer = await image.toBuffer();
        await (async function imageEncoder(size, buffer) {
            if (imageType === ".jpg" || imageType === ".jpeg") {
                await new Promise(function (resolve, reject) {
                    inkjet.decode(buffer, async function (err, decoded) {
                        const dstnPath = size.destinationPath;
                        const sourceFolder = srcFolder.length > 0 ? srcFolder + '/' : '';
                        for (const { format, contentType, options } of formats) {
                            // decoded: { width: number, height: number, data: Uint8Array }
                            if (format === "avif") {
                                const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${format}`;
                                let module = await avif_enc();
                                let imageData = await module.encode(
                                    decoded.data,
                                    size.width,
                                    size.width, // need to find the exact height of image and pass here
                                    options);
                                await s3
                                    .putObject({
                                        Bucket: dstBucket,
                                        Key: dstnKey,
                                        Body: Buffer.from(imageData),
                                        CacheControl: cacheControl,
                                        ContentType: contentType,
                                    })
                                    .promise()

                                log(`Successfully processed ${dstBucket}/${dstnKey}`);
                            } else if (format === "webp") {
                                const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${format}`;
                                let module = await webp_enc();
                                let imageData = await module.encode(
                                    decoded.data,
                                    size.width,
                                    size.width,// need to find the exact height of image and pass here
                                    options);
                                await s3
                                    .putObject({
                                        Bucket: dstBucket,
                                        Key: dstnKey,
                                        Body: Buffer.from(imageData),
                                        CacheControl: cacheControl,
                                        ContentType: contentType,
                                    })
                                    .promise();
                                log(`Successfully processed ${dstBucket}/${dstnKey}`);
                            } else if (format === "jpg") {
                                let _ext = (imageType === ".jpeg") ? "jpeg" : format;
                                const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${_ext}`;
                                let module = await mozjpeg_enc();
                                let imageData = await module.encode(
                                    decoded.data,
                                    size.width,
                                    size.width,// need to find the exact height of image and pass here
                                    options);
                                await s3
                                    .putObject({
                                        Bucket: dstBucket,
                                        Key: dstnKey,
                                        Body: Buffer.from(imageData),
                                        CacheControl: cacheControl,
                                        ContentType: contentType,
                                    })
                                    .promise();
                                log(`Successfully processed ${dstBucket}/${dstnKey}`);

                            }
                        }
                        resolve();
                    });
                });
            } else if (imageType === ".png") {
                await new Promise(function (resolve, reject) {
                    new PNG(buffer).decode(async function (pixels) {
                        const dstnPath = size.destinationPath;
                        const sourceFolder = srcFolder.length > 0 ? srcFolder + '/' : '';
                        for (const { format, contentType, options } of formats) {
                            if (format === "avif") {
                                const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${format}`;
                                let module = await avif_enc();
                                let imageData = await module.encode(pixels,
                                    size.width,
                                    size.width,// need to find the exact height of image and pass here
                                    options
                                );
                                await s3.putObject({
                                    Bucket: dstBucket,
                                    Key: dstnKey,
                                    Body: Buffer.from(imageData),
                                    CacheControl: cacheControl,
                                    ContentType: contentType,
                                }).promise();
                                log(`Successfully processed avif ${dstBucket}/${dstnKey}`);
                            } else if (format === "webp") {
                                const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${format}`;
                                let module = await webp_enc();
                                let imageData = await module.encode(pixels,
                                    size.width,
                                    size.width,// need to find the exact height of image and pass here
                                    options
                                );
                                await s3.putObject({
                                    Bucket: dstBucket,
                                    Key: dstnKey,
                                    Body: Buffer.from(imageData),
                                    CacheControl: cacheControl,
                                    ContentType: contentType,
                                }).promise();
                                log(`Successfully processed webp ${dstBucket}/${dstnKey}`);
                            } else if (format === "jpg") {
                                const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${format}`;
                                let module = await mozjpeg_enc();
                                let imageData = await module.encode(
                                    pixels,
                                    size.width,
                                    size.width,
                                    options);
                                await s3
                                    .putObject({
                                        Bucket: dstBucket,
                                        Key: dstnKey,
                                        Body: Buffer.from(imageData),
                                        CacheControl: cacheControl,
                                        ContentType: contentType,
                                    })
                                    .promise();
                                log(`Successfully processed jpg ${dstBucket}/${dstnKey}`);

                            }
                        }
                        resolve();
                    });
                });
            }
        })(size, buffer)
    }
}

function log(...args) {
    console.log(...args);
}

exports.handler = async (event) => {
    // Read options from the event.
    log('Reading options from event:\n', util.inspect(event, { depth: 5 }));

    const { s3: s3Obj } = event.Records[0];
    const srcBucket = s3Obj.bucket.name;
    // the suffix -srcset is used for destination bucket
    const dstBucket = srcBucket + '-srcset';
    // Object key may have spaces or unicode non-ASCII characters.
    const srcKey = decodeURIComponent(s3Obj.object.key.replace(/\+/g, ' '));

    //find filename
    const imageType = path.extname(srcKey);
    const srcFile = path.basename(srcKey, imageType);
    const srcFolder = path.dirname(srcKey);
    const size = s3Obj.object.size;
    if (size > 0) {
        await processImage(srcBucket, srcKey, srcFolder, dstBucket, srcFile, imageType).catch((err) => {
            log('Error: ', err);
        });
    } else {
        log(`Error size of s3 object is zero ${srcKey}`);
    }

};

exports.processImage = processImage;

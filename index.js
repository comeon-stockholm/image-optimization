const path = require('path');
const AWS = require('aws-sdk');
const util = require('util');
// image compression encoders
const sharp = require('sharp');
const webp_enc = require('./codecs/webp/enc/webp_enc.js');
const mozjpeg_enc = require('./codecs/mozjpeg_enc/mozjpeg_enc.js');
const avif_enc = require('./codecs/avif/enc/avif_enc.js');

// convert image to pixels
const inkjet = require('inkjet');
const PNG = require('png-js');

const s3 = new AWS.S3();
// getting configurations from config file
// later can move to environment varibale make this a default fallback
const { sizesArray, formats, backgroundOnly, backgroundPaths } = require('./config');

// default cache if cache is not set
const DEFAULT_CACHE_CONTROL = 'max-age=31536000';

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

    let sizes = backgroundPaths.some((backgroundPath) => srcKey.includes(backgroundPath))
        ? sizesArray.filter((s) => backgroundOnly.includes(s.width))
        : sizesArray.filter((s) => !backgroundOnly.includes(s.width));

    const saveImage = async (dstBucket, dstnKey, imageData, cacheControl, contentType) =>
        s3
            .putObject({
                Bucket: dstBucket,
                Key: dstnKey,
                Body: Buffer.from(imageData),
                CacheControl: cacheControl,
                ContentType: contentType,
            })
            .promise();
    // getting the soruce image from s3 bucket
    const response = await s3.getObject({ Bucket: srcBucket, Key: srcKey }).promise();
    // log('Image source path: ', response.Body);
    // getting cache control
    const cacheControl = response.CacheControl || DEFAULT_CACHE_CONTROL;
    // creating sharp image blob using Sharp Library
    for (const size of sizes) {
        const image = await sharp(response.Body).resize(size.width, null);
        //getting metadata of the image
        const metadata = await image.metadata();
        //calculating height based on aspect ratio
        size.height = Math.floor((size.width / metadata.width) * metadata.height);
        log('Size', JSON.stringify(size));

        const buffer = await image.toBuffer();
        log(buffer.length);

        await (async function imageEncoder(size, buffer) {
            const dstnPath = size.destinationPath;
            const sourceFolder = srcFolder.length > 0 && srcFolder.trim() !== '.' ? srcFolder + '/' : '';
            if (imageType === '.jpg' || imageType === '.jpeg') {
                await new Promise(function (resolve, reject) {
                    // converting jpg image to pixels clampped to 0-255 Uint8Array
                    inkjet.decode(buffer, async function (err, pixels) {
                        // pixels: { width: number, height: number, data: Uint8Array }
                        log('jpg pixels', pixels.data.length);
                        for (let { format, contentType, options } of formats) {
                            log('pixels.height', pixels.height);
                            if (format === 'avif') {
                                const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${format}`;
                                let module = await avif_enc();
                                if (backgroundPaths.some((backgroundPath) => srcKey.includes(backgroundPath))) {
                                    options = {
                                        minQuantizer: 30,
                                        maxQuantizer: 50,
                                        minQuantizerAlpha: 0,
                                        maxQuantizerAlpha: 62,
                                        tileColsLog2: 0,
                                        tileRowsLog2: 0,
                                        speed: 8,
                                        subsample: 1,
                                    };
                                }
                                // log(options);
                                let imageData = await module.encode(pixels.data, size.width, size.height, options);
                                log('Avif Image Data', imageData.length);
                                // await s3
                                //     .putObject({
                                //         Bucket: dstBucket,
                                //         Key: dstnKey,
                                //         Body: Buffer.from(imageData),
                                //         CacheControl: cacheControl,
                                //         ContentType: contentType,
                                //     })
                                //     .promise();
                                await saveImage(dstBucket, dstnKey, imageData, cacheControl, contentType);

                                log(`Successfully processed ${dstBucket}/${dstnKey}`);
                            } else if (format === 'webp') {
                                const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${format}`;
                                let module = await webp_enc();
                                let imageData = await module.encode(pixels.data, size.width, size.height, options);
                                log('WebP Image Data', imageData.length);
                                // await s3
                                //     .putObject({
                                //         Bucket: dstBucket,
                                //         Key: dstnKey,
                                //         Body: Buffer.from(imageData),
                                //         CacheControl: cacheControl,
                                //         ContentType: contentType,
                                //     })
                                //     .promise();
                                await saveImage(dstBucket, dstnKey, imageData, cacheControl, contentType);
                                log(`Successfully processed ${dstBucket}/${dstnKey}`);
                            } else if (format === 'jpg') {
                                let _ext = imageType === '.jpeg' ? 'jpeg' : format;
                                const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${_ext}`;
                                let module = await mozjpeg_enc();
                                let imageData = await module.encode(pixels.data, size.width, size.height, options);
                                log('JPG Image Data', imageData.length);
                                // await s3
                                //     .putObject({
                                //         Bucket: dstBucket,
                                //         Key: dstnKey,
                                //         Body: Buffer.from(imageData),
                                //         CacheControl: cacheControl,
                                //         ContentType: contentType,
                                //     })
                                //     .promise();
                                await saveImage(dstBucket, dstnKey, imageData, cacheControl, contentType);
                                log(`Successfully processed ${dstBucket}/${dstnKey}`);
                            }
                        }
                        resolve();
                    });
                });
            } else if (imageType === '.png') {
                await new Promise(function (resolve, reject) {
                    // converting png image to pixels clampped to 0-255 Uint8Array
                    new PNG(buffer).decode(async function (pixels) {
                        log('png pixels', pixels.length);
                        for (let { format, contentType, options } of formats) {
                            if (format === 'avif') {
                                const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${format}`;
                                let module = await avif_enc();
                                // Hack to get large images optimization in avif
                                if (backgroundPaths.some((backgroundPath) => srcKey.includes(backgroundPath))) {
                                    options = {
                                        minQuantizer: 30,
                                        maxQuantizer: 50,
                                        minQuantizerAlpha: 0,
                                        maxQuantizerAlpha: 62,
                                        tileColsLog2: 0,
                                        tileRowsLog2: 0,
                                        speed: 8,
                                        subsample: 1,
                                    };
                                }
                                let imageData = await module.encode(pixels, size.width, size.height, options);
                                log('Avif Image Data', imageData.length);
                                // await s3
                                //     .putObject({
                                //         Bucket: dstBucket,
                                //         Key: dstnKey,
                                //         Body: Buffer.from(imageData),
                                //         CacheControl: cacheControl,
                                //         ContentType: contentType,
                                //     })
                                //     .promise();
                                await saveImage(dstBucket, dstnKey, imageData, cacheControl, contentType);
                                log(`Successfully processed avif ${dstBucket}/${dstnKey}`);
                            } else if (format === 'webp') {
                                const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${format}`;
                                let module = await webp_enc();
                                let imageData = await module.encode(pixels, size.width, size.height, options);
                                log('WebP Image Data', imageData.length);
                                // await s3
                                //     .putObject({
                                //         Bucket: dstBucket,
                                //         Key: dstnKey,
                                //         Body: Buffer.from(imageData),
                                //         CacheControl: cacheControl,
                                //         ContentType: contentType,
                                //     })
                                //     .promise();
                                await saveImage(dstBucket, dstnKey, imageData, cacheControl, contentType);
                                log(`Successfully processed webp ${dstBucket}/${dstnKey}`);
                            } else if (format === 'jpg') {
                                const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${format}`;
                                let module = await mozjpeg_enc();
                                let imageData = await module.encode(pixels, size.width, size.height, options);
                                log('jpg Image Data', imageData.length);
                                // await s3
                                //     .putObject({
                                //         Bucket: dstBucket,
                                //         Key: dstnKey,
                                //         Body: Buffer.from(imageData),
                                //         CacheControl: cacheControl,
                                //         ContentType: contentType,
                                //     })
                                //     .promise();
                                await saveImage(dstBucket, dstnKey, imageData, cacheControl, contentType, format);
                                log(`Successfully processed jpg ${dstBucket}/${dstnKey}`);
                            }
                        }
                        resolve();
                    });
                });
            }
        })(size, buffer);
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

'use strict';
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
const { sizes, formats, backSizes, backgroundPaths } = require('./config');

// default cache if cache is not set
const DEFAULT_CACHE_CONTROL = 'max-age=31536000';

const checkIfBackgroundImage = (srcKey) => backgroundPaths.some((backgroundPath) => srcKey.includes(backgroundPath));

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

const encodeAndSave = async (
    rawImageData,
    imageType,
    size,
    sourceFolder,
    srcFile,
    srcKey,
    dstBucket,
    dstnPath,
    cacheControl
) => {
    for (let { format, contentType, options, speedOptions } of formats) {
        if (format === 'avif') {
            const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${format}`;
            let module = await avif_enc();
            let imageData;
            if (checkIfBackgroundImage(srcKey)) {
                imageData = await module.encode(rawImageData, size.width, size.height, speedOptions);
            } else {
                imageData = await module.encode(rawImageData, size.width, size.height, options);
            }
            log('Avif Image Data', imageData.length);
            // log(process.memoryUsage());
            await saveImage(dstBucket, dstnKey, imageData, cacheControl, contentType);
            log(`Successfully processed ${dstBucket}/${dstnKey}`);
        } else if (format === 'webp') {
            const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${format}`;
            let module = await webp_enc();
            let imageData = await module.encode(rawImageData, size.width, size.height, options);
            log('WebP Image Data', imageData.length);
            // log(process.memoryUsage());
            await saveImage(dstBucket, dstnKey, imageData, cacheControl, contentType);
            log(`Successfully processed ${dstBucket}/${dstnKey}`);
        } else if (format === 'jpg') {
            let _ext = imageType === '.jpeg' ? 'jpeg' : format;
            const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${_ext}`;
            // hack for png
            const dstnKeyPng = `${sourceFolder}${dstnPath}/${srcFile}.png`;
            let module = await mozjpeg_enc();
            let imageData = await module.encode(rawImageData, size.width, size.height, options);
            log('JPG Image Data', imageData.length);
            // log(process.memoryUsage());
            await saveImage(dstBucket, dstnKey, imageData, cacheControl, contentType);
            // hack for png
            await saveImage(dstBucket, dstnKeyPng, imageData, cacheControl, 'image/png');
            log(`Successfully processed ${dstBucket}/${dstnKey}`);
            log(`Successfully processed ${dstBucket}/${dstnKeyPng}`);
        }
    }
};

const imageEncoder = async (size, buffer, srcFolder, imageType, srcFile, srcKey, dstBucket, cacheControl) => {
    const dstnPath = size.destinationPath;
    const sourceFolder = srcFolder.length > 0 && srcFolder.trim() !== '.' ? srcFolder + '/' : '';
    if (imageType === '.jpg' || imageType === '.jpeg') {
        await new Promise(function (resolve, reject) {
            // converting jpg image to pixels clampped to 0-255 Uint8Array
            inkjet.decode(buffer, async function (err, pixels) {
                // pixels: { width: number, height: number, data: Uint8Array }
                log('jpg pixels', pixels.data.length);
                const rawImageData = pixels.data;
                log('pixels.height', pixels.height);
                await encodeAndSave(
                    rawImageData,
                    imageType,
                    size,
                    sourceFolder,
                    srcFile,
                    srcKey,
                    dstBucket,
                    dstnPath,
                    cacheControl
                );
                resolve();
            });
        });
    } else if (imageType === '.png') {
        await new Promise(function (resolve, reject) {
            // converting png image to pixels clampped to 0-255 Uint8Array
            new PNG(buffer).decode(async function (rawImageData) {
                log('png pixels', rawImageData.length);
                await encodeAndSave(
                    rawImageData,
                    imageType,
                    size,
                    sourceFolder,
                    srcFile,
                    srcKey,
                    dstBucket,
                    dstnPath,
                    cacheControl
                );
                resolve();
            });
        });
    }
};

// Image processing
async function processImage(srcBucket, srcKey, srcFolder, dstBucket, srcFile, imageType) {
    require('events').EventEmitter.defaultMaxListeners = 1000;
    log('srcBucket:\n', srcBucket);
    log('srcKey:\n', srcKey);
    log('srcFolder:\n', srcFolder);
    log('srcFile:\n', srcFile);
    log('dstBucket\n', dstBucket);
    log('imageType\n', imageType);

    // checking if the file is an image else skip processing
    if (imageType == '.jpg' || imageType == '.jpeg' || imageType == '.png') {
        log('imageType to be processed:\n', imageType);
    } else {
        log(`skipping non-image type: ${srcKey}`);
        return;
    }
    // getting sizes for background or other image
    let sizesArray = checkIfBackgroundImage(srcKey) ? backSizes : sizes;

    // getting the soruce image from s3 bucket
    const response = await s3.getObject({ Bucket: srcBucket, Key: srcKey }).promise();

    // log('Image source path: ', response.Body);
    // getting cache control
    const cacheControl = response.CacheControl || DEFAULT_CACHE_CONTROL;
    // creating sharp image blob using Sharp Library
    for (const size of sizesArray) {
        const image = await sharp(response.Body).resize(size.width, null);
        //getting metadata of the image
        const metadata = await image.metadata();
        //calculating height based on aspect ratio
        size.height = Math.floor((size.width / metadata.width) * metadata.height);
        log('Size', JSON.stringify(size));
        const buffer = await image.toBuffer();
        log(buffer.length);
        await imageEncoder(size, buffer, srcFolder, imageType, srcFile, srcKey, dstBucket, cacheControl);
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

const path = require('path');
const AWS = require('aws-sdk');
const util = require('util');
const sharp = require('sharp');
// get reference to s3 client
const s3 = new AWS.S3();
// getting configurations from config file
// later can move to environment varibale make this a default fallback
let { sizesArray, formats } = require('./config');
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

    if (!srcBucket.includes('/background/')) {
        sizesArray = sizesArray.filter((f) => f.width !== 1080);
    }

    const response = await s3.getObject({ Bucket: srcBucket, Key: srcKey }).promise();
    const cacheControl = response.CacheControl || DEFAULT_CACHE_CONTROL;
    const image = sharp(response.Body);

    for (const size of sizesArray) {
        const dstnPath = size.destinationPath;
        const sourceFolder = srcFolder.length > 0 ? srcFolder + '/' : '';
        for (const { format, contentType, options } of formats) {
            const dstnKey = `${sourceFolder}${dstnPath}/${srcFile}.${format}`;
            const result = await image.resize(size.width, null).toFormat(format, options).toBuffer();
            await s3
                .putObject({
                    Bucket: dstBucket,
                    Key: dstnKey,
                    Body: result,
                    CacheControl: cacheControl,
                    ContentType: contentType,
                })
                .promise();
            log(`Successfully processed ${dstBucket}/${dstnKey}`);
        }
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

const async = require('async')
const path = require('path')
const AWS = require('aws-sdk')
const util = require('util')
const sharp = require('sharp')
const s3 = new AWS.S3()

const { sizesArray, formats } = require('./config')

const DEFAULT_CACHE_CONTROL = 'max-age=31536000'

// Image processing
function processImage(srcBucket, srcKey, srcFolder, dstBucket, srcFile, doneCallback) {
    console.log('srcBucket:\n', srcBucket)
    console.log('srcKey:\n', srcKey)
    console.log('srcFolder:\n', srcFolder)
    console.log('srcFile:\n', srcFile)
    console.log('dstBucket\n', dstBucket)

    // Infer the image type.
    var typeMatch = srcKey.match(/\.([^.]*)$/)
    if (!typeMatch) {
        console.error('unable to infer image type for key ' + srcKey)
        return
    }
    var imageType = typeMatch[1].toLowerCase()
    if (imageType == 'jpg' || imageType == 'jpeg' || imageType == 'png') {
        console.log('imageType to be processed:\n', imageType)
    } else {
        console.log('skipping non-image type: ' + srcKey)
        return
    }

    // Transform, and upload to same S3 bucket but to a different S3 bucket.
    async.forEachOf(
        sizesArray,
        function(value, key, callback) {
            async.waterfall(
                [
                    function download(next) {
                        console.time('downloadImage' + key)
                        console.log('download')
                        // Download the image from S3 into a buffer.
                        // sadly it downloads the image several times, but we couldn't place it outside
                        // the variable was not recognized
                        s3.getObject(
                            {
                                Bucket: srcBucket,
                                Key: srcKey,
                            },
                            next
                        )
                        console.timeEnd('downloadImage' + key)
                    },
                    function convert(response, next) {
                        console.time('convertImage' + key)
                        const cacheControl = response.CacheControl || DEFAULT_CACHE_CONTROL
                        const imageSet = []
                        console.log('Conversion')
                        const image = sharp(response.Body)
                        image.metadata().then(function(size) {
                            const scalingFactor = Math.min(
                                sizesArray[key].width / size.width,
                                sizesArray[key].width / size.height
                            )
                            const width = Math.floor(scalingFactor * size.width)
                            const height = Math.floor(scalingFactor * size.height)

                            formats.forEach(({ format, options }) => {
                                imageSet.push(
                                    image
                                        .resize(width, height)
                                        .toFormat(format, options)
                                        .toBuffer()
                                )
                            })
                            console.timeEnd('convertImage' + key)
                            next(null, imageSet, key, cacheControl)
                        })
                    },
                    function upload(data, index, cacheControl, next) {
                        Promise.all(data)
                            .then(data => {
                                var dstnPath = sizesArray[index].destinationPath
                                console.time('uploadImage' + index)
                                console.log('upload : ' + index)
                                async.forEachOf(
                                    data,
                                    function(image, formatIndex, callback) {
                                        var dstnKey =
                                            (srcFolder.length > 0 ? srcFolder + '/' : '') +
                                            dstnPath +
                                            '/' +
                                            srcFile +
                                            '.' +
                                            formats[formatIndex].format
                                        console.log('upload to path: ', dstnKey)
                                        // Stream the transformed image to a different folder.
                                        try {
                                            s3.putObject(
                                                {
                                                    Bucket: dstBucket,
                                                    Key: dstnKey,
                                                    Body: image,
                                                    CacheControl: cacheControl,
                                                    ContentType: formats[formatIndex].contentType,
                                                },
                                                callback
                                            )
                                        } catch (err) {
                                            callback('Failed uploading: ' + err)
                                        }
                                    },
                                    function(err) {
                                        if (err) {
                                            next(err)
                                        } else {
                                            console.timeEnd('uploadImage' + index)
                                            next()
                                        }
                                    }
                                )
                            })
                            .catch(err => {
                                if (err) {
                                    console.error(err)
                                    // next(err)
                                }
                            })
                    },
                ],
                function(err, result) {
                    if (err) {
                        callback(err)
                    } else {
                        // result now equals 'done'
                        console.log('End of step ' + key)
                        callback()
                    }
                }
            )
        },
        function(err) {
            if (err) {
                console.error(
                    '---->Unable to resize: ' +
                        srcBucket +
                        '/' +
                        srcKey +
                        ', and upload to: ' +
                        dstBucket +
                        ', due to an error: ' +
                        err
                )
            } else {
                console.log('---->Successfully resized: ' + srcBucket + ', and uploaded to: ' + dstBucket)
            }
            doneCallback()
        }
    )
}

exports.handler = function(event, context) {
    // Read options from the event.
    console.log(
        'Reading options from event:\n',
        util.inspect(event, {
            depth: 5,
        })
    )
    var srcBucket = event.Records[0].s3.bucket.name
    // Object key may have spaces or unicode non-ASCII characters.
    var srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '))
    // the suffix -srcset is used for destination bucket
    var dstBucket = srcBucket + '-srcset'
    // Sanity check: validate that source and destination are different buckets.
    if (srcBucket == dstBucket) {
        console.error('Destination bucket must not match source bucket.')
        return
    }
    //find filename
    const extension = path.extname(srcKey)
    const srcFile = path.basename(srcKey, extension)
    let srcFolder = ''
    //check if file is stored in a folder by detecting '/'
    if (srcKey.indexOf('/')) {
        //find foldername
        srcFolder = srcKey.substring(0, srcKey.lastIndexOf('/'))
    }

    processImage(srcBucket, srcKey, srcFolder, dstBucket, srcFile, context.done)
}

exports.processImage = processImage

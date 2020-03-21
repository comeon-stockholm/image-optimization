var AWS = require('aws-sdk')
var fs = require('fs')
var async = require('async')

var cacheControlIn
var cacheControlOut

var consoleLogger = console.log
console.log = function(arg) {
    if (arg.startsWith('---->')) {
        consoleLogger(arg)
    }
}

AWS.S3.prototype.getObject = function(req, cb) {
    cb(null, { Body: req.Bucket, ContentType: 'image/jpeg', CacheControl: cacheControlIn })
}
AWS.S3.prototype.putObject = function(req, cb) {
    if (!req.CacheControl) {
        console.log('CacheControl not set!')
        throw 'CacheControl not set!'
    }
    if (req.CacheControl !== cacheControlOut) {
        console.log('Cache control has wrong value ' + req.CacheControl + ' should be ' + cacheControlOut)
        throw 'CacheControl has wrong value'
    }
    consoleLogger('Writing file: ' + req.Key + ' size: ' + req.Body.length)
    fs.writeFile(req.Key, req.Body, cb)
}
var lambda = require('../index.js')
var tests = [
    [
        '__tests__/testdata/in/aloha_mobile_html_sw.png',
        'Mobile-bla.png',
        '__tests__/testdata/out',
        'mobile-icon-srcset',
        'aloha',
    ],
    [
        '__tests__/testdata/in/Mobile-Icon-bloodsuckers.png',
        'Mobile-bla.png',
        '__tests__/testdata/out',
        'mobile-icon-srcset',
        'bloodsuckers',
    ],
    [
        '__tests__/testdata/in/EVO_NOCOMMISSIONBACCARAT.jpeg',
        'Mobile-bla.png',
        '__tests__/testdata/out',
        'mobile-icon-srcset',
        'evo',
    ],
]

async.waterfall(
    [
        function testDefaultProcess(next) {
            consoleLogger('\nTesting default conversions')
            cacheControlIn = undefined
            cacheControlOut = 'max-age=31536000'
            function doTest(testarr) {
                var value = testarr.shift()
                if (value) {
                    lambda.processImage(value[0], value[1], value[2], value[3], value[4], function() {
                        doTest(testarr)
                    })
                } else {
                    next(null)
                }
            }
            doTest(tests.slice())
        },
        function testMaxAgeOverride(next) {
            consoleLogger('\nTesting max age override')
            cacheControlIn = 'max-age=0'
            cacheControlOut = 'max-age=0'
            var value = tests[0]
            lambda.processImage(value[0], value[1], value[2], value[3], value[4], function() {
                next(null)
            })
        },
        function testCacheControlFail(next) {
            consoleLogger('\nTest exception handling')
            // fail if Cache-Control differs
            cacheControlIn = 'max-age=0'
            cacheControlOut = 'max-age=1'
            var value = tests[0]
            lambda.processImage(value[0], value[1], value[2], value[3], value[4], next)
        },
    ],
    function(err) {
        if (err) {
            consoleLogger(err)
            throw 'test failed '
        }
    }
)

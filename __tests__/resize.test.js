var AWS = require('aws-sdk');
var fs = require('fs');
var async = require('async');

var cacheControlIn;
var cacheControlOut;

var consoleLogger = console.log;

console.log = function(arg) {
    if (arg.startsWith('---->')) {
        consoleLogger(arg);
    }
};

AWS.S3.prototype.getObject = function(req) {
    return {
        promise: () => Promise.resolve({ Body: req.Bucket, ContentType: 'image/jpeg', CacheControl: cacheControlIn }),
    };
};
AWS.S3.prototype.putObject = function(req) {
    if (!req.CacheControl) {
        console.log('CacheControl not set!');
        return { promise: () => Promise.reject('CacheControl not set!') };
    }
    if (req.CacheControl !== cacheControlOut) {
        console.log('Cache control has wrong value ' + req.CacheControl + ' should be ' + cacheControlOut);
        return { promise: () => Promise.reject('CacheControl has wrong value') };
    }
    return {
        promise: () =>
            new Promise((resolve, reject) => {
                consoleLogger('Writing file: ' + req.Key + ' size: ' + req.Body.length);
                fs.writeFile(req.Key, req.Body, (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            }),
    };
};
var lambda = require('../index.js');
var tests = [
    [
        '__tests__/testdata/in/aloha_mobile_html_sw.png',
        'Mobile-bla.png',
        '__tests__/testdata/out',
        'mobile-icon',
        'mobile-icon-aloha',
        'png',
    ],
    [
        '__tests__/testdata/in/Mobile-luckyzoiac.jpg',
        'Mobile-bla.png',
        '__tests__/testdata/out',
        'mobile-icon',
        'Mobile-luckyzoiac',
        'png',
    ],
    [
        '__tests__/testdata/in/templateMobile-icon.jpg',
        'Mobile-bla.png',
        '__tests__/testdata/out',
        'mobile-icon',
        'templateMobile-icon',
        'png',
    ],
    [
        '__tests__/testdata/in/Mobile-Icon-bloodsuckers.png',
        'Mobile-bla.png',
        '__tests__/testdata/out',
        'mobile-icon',
        'mobile-icon-bloodsuckers.jpg',
        'png',
    ],
];

async.waterfall(
    [
        async function testCustomSizes(next) {
            consoleLogger('\nTesting custom sizes');
            cacheControlOut = 'max-age=31536000';
            // var putObject = AWS.S3.prototype.putObject;
            var puts = [];
            // AWS.S3.prototype.putObject = function(req) {
            //     puts.push(req.Key);
            //     consoleLogger('custom sized image: ' + req.Key + ' size in bytes: ' + req.Body.length);
            //     return { promise: () => Promise.resolve() };
            // };
            var value = tests[0];
            await lambda.processImage(value[0], value[1], value[2], value[3], value[4], value[5]);
            // next();
        },
        async function testDefaultProcess(next) {
            consoleLogger('\nTesting default conversions');
            cacheControlIn = undefined;
            cacheControlOut = 'max-age=31536000';
            async function doTest(testarr) {
                var value = testarr.shift();
                if (value) {
                    await lambda.processImage(value[0], value[1], value[2], value[3], value[4], value[5]);
                    await doTest(testarr);
                }
            }
            await doTest(tests.slice());
        },
        async function testMaxAgeOverride(next) {
            consoleLogger('\nTesting max age override');
            cacheControlIn = 'max-age=0';
            cacheControlOut = 'max-age=0';
            var value = tests[0];
            await lambda.processImage(value[0], value[1], value[2], value[3], value[4], value[5]);
        },
        async function testCacheControlFail(next) {
            consoleLogger('\nTest exception handling');
            // fail if Cache-Control differs
            cacheControlIn = 'max-age=0';
            cacheControlOut = 'max-age=1';
            var value = tests[0];
            await lambda.processImage(value[0], value[1], value[2], value[3], value[4], value[5]);
        },
    ],
    function(err) {
        if (err) {
            consoleLogger(err);
        }
    }
);

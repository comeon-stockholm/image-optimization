var AWS = require('aws-sdk');
var fs = require('fs');

var cacheControlIn;
var cacheControlOut;

var consoleLogger = (...args) => console.log(...args);

AWS.S3.prototype.getObject = function (req) {
    return {
        promise: () => Promise.resolve({ Body: req.Bucket, ContentType: 'image/jpeg', CacheControl: cacheControlIn }),
    };
};
AWS.S3.prototype.putObject = function (req) {
    if (!req.CacheControl) {
        console.error('CacheControl not set!');
        return { promise: () => Promise.resolve('CacheControl not set!') };
    }
    if (req.CacheControl !== cacheControlOut) {
        console.error('Cache control has wrong value ' + req.CacheControl + ' should be ' + cacheControlOut);
        return { promise: () => Promise.resolve('CacheControl has wrong value') };
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
        'aloha_mobile_html_sw.png',
        '__tests__/testdata/out',
        'mobile-icon',
        'mobile-icon-aloha',
        '.png',
    ],
    [
        '__tests__/testdata/in/Mobile-luckyzoiac.jpeg',
        'Mobile-luckyzoiac.jpeg',
        '__tests__/testdata/out',
        'mobile-icon',
        'Mobile-luckyzoiac',
        '.jpeg',
    ],
];

async function testCustomSizes() {
    consoleLogger('\nTesting custom sizes');
    cacheControlOut = 'max-age=31536000';
    var value = tests[0];
    await lambda.processImage(value[0], value[1], value[2], value[3], value[4], value[5]);
}
async function testDefaultProcess() {
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
}
async function testMaxAgeOverride() {
    consoleLogger('\nTesting max age override');
    cacheControlIn = 'max-age=0';
    cacheControlOut = 'max-age=0';
    var value = tests[0];
    await lambda.processImage(value[0], value[1], value[2], value[3], value[4], value[5]);
    // testCacheControlFail();
}
async function testCacheControlFail() {
    consoleLogger('\nTest exception handling');
    // fail if Cache-Control differs
    cacheControlIn = 'max-age=0';
    cacheControlOut = 'max-age=1';
    var value = tests[0];
    await lambda.processImage(value[0], value[1], value[2], value[3], value[4], value[5]);
}

const backgroundImageSource = [
    '__tests__/testdata/in/large-image.jpg',
    '/background/large-image.jpg',
    '__tests__/testdata/out',
    'mobile-icon',
    'large-image',
    '.jpg',
];

async function testbackgroundImageSource() {
    consoleLogger('\nTest backgroundImageSource');
    cacheControlIn = 'max-age=0';
    cacheControlOut = 'max-age=0';
    var value = backgroundImageSource;
    await lambda.processImage(value[0], value[1], value[2], value[3], value[4], value[5]);
}

function catchError(err) {
    if (err) {
        consoleLogger(`Error ${err}`);
    }
}

function removeTestFiles() {
    consoleLogger('Cleaning up');
    fs.readdirSync('./__tests__/testdata/out').forEach((path) => {
        if (fs.statSync(`./__tests__/testdata/out/${path}`).isDirectory()) {
            fs.readdirSync(`./__tests__/testdata/out/${path}`).forEach((file) => {
                if (file.match(/([\w])*\.(?:jpg|jpeg|webp|png|avif)/g)) {
                    fs.unlinkSync(`./__tests__/testdata/out/${path}/${file}`);
                }
            });
        }
    });
    consoleLogger('Successfully cleaned up generated test files 👍🏻 ');
}

(async () => {
    removeTestFiles();
    await testCustomSizes().catch(catchError);
    await testDefaultProcess().catch(catchError);
    await testMaxAgeOverride().catch(catchError);
    await testbackgroundImageSource().catch(catchError);
    await testCacheControlFail().catch(catchError);
    removeTestFiles();
})();

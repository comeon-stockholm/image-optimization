// setting image sizes to be created

const _1080px = { width: 1080, destinationPath: '1080w' };
const _640px = { width: 640, destinationPath: '640w' };
const _480px = { width: 480, destinationPath: '480w' };
const _420px = { width: 420, destinationPath: '420w' };
const _360px = { width: 360, destinationPath: '360w' };
const _300px = { width: 300, destinationPath: '300w' };
const _240px = { width: 240, destinationPath: '240w' };
const _180px = { width: 180, destinationPath: '180w' };
const _140px = { width: 140, destinationPath: '140w' };
const jpg = {
    format: 'jpg',
    contentType: 'image/jpeg',
    options: {
        quality: 75,
        optimiseScans: true,
        optimiseCoding: true,
    },
};
const png = {
    format: 'png',
    contentType: 'image/png',
    options: {
        adaptiveFiltering: true,
        compressionLevel: 9,
        quality: 75,
    },
};

const webp = {
    format: 'webp',
    contentType: 'image/webp',
    options: {
        quality: 75,
    },
};

exports.sizesArray = [_1080px, _640px, _480px, _420px, _360px, _300px, _240px, _180px, _140px];
exports.formats = [jpg, png, webp];

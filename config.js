// setting image sizes to be created

const _3840px = { width: 3840, destinationPath: '4k' };
const _2560px = { width: 2560, destinationPath: '2k' };
const _1920px = { width: 1920, destinationPath: 'fhd' };
const _1280px = { width: 1280, destinationPath: 'hd' };
const _720px = { width: 720, destinationPath: '720w' };
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
        baseline: false,
        arithmetic: false,
        progressive: true,
        optimize_coding: true,
        smoothing: 0,
        color_space: 3,
        quant_table: 3,
        trellis_multipass: false,
        trellis_opt_zero: false,
        trellis_opt_table: false,
        trellis_loops: 1,
        auto_subsample: true,
        chroma_subsample: 2,
        separate_chroma_quality: false,
        chroma_quality: 70,
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

const avif = {
    format: 'avif',
    contentType: 'image/avif',
    options: {
        minQuantizer: 33,
        maxQuantizer: 63,
        minQuantizerAlpha: 1,
        maxQuantizerAlpha: 63,
        tileColsLog2: 0,
        tileRowsLog2: 0,
        speed: 6,
        subsample: 1,
    },
};

const webp = {
    format: 'webp',
    contentType: 'image/webp',
    options: {
        quality: 75,
        target_size: 0,
        target_PSNR: 0,
        method: 6,
        sns_strength: 50,
        filter_strength: 60,
        filter_sharpness: 0,
        filter_type: 1,
        partitions: 0,
        segments: 4,
        pass: 1,
        show_compressed: 0,
        preprocessing: 0,
        autofilter: 0,
        partition_limit: 0,
        alpha_compression: 1,
        alpha_filtering: 1,
        alpha_quality: 100,
        lossless: 0,
        exact: 0,
        image_hint: 0,
        emulate_jpeg_size: 0,
        thread_level: 0,
        low_memory: 0,
        near_lossless: 100,
        use_delta_palette: 0,
        use_sharp_yuv: 0,
    },
};

exports.backgroundOnly = [3840, 2560, 1920, 1280, 720];

exports.sizesArray = [_3840px, _2560px, _1920px, _1280px, _720px, _640px, _480px, _420px, _360px, _300px, _240px, _180px, _140px];
exports.formats = [avif, webp, jpg];

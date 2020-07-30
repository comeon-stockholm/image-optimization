# Image-Optimization

The code will generate below formats

```
jpg
png
webp
```

and sizes

```
640px, 480px, 420px, 360px, 300px, 240px, 180px, 140px
```

of an image

## How to run locally

```
npm install

npm run test
```

## Build for AWS

```
npm install
rm -rf node_modules/sharp
npm install --arch=x64 --platform=linux sharp
```

Create a zip file and upload to lamda

```
zip -r image-optimization.zip index.js config.js package.json node_modules
```

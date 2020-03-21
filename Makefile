.PHONY:	dist test clean

node_modules:	package.json
			yarn install

test:		node_modules
			node __tests__/resize.test.js

dist:	node_modules
			zip -r create-resized-images.zip index.js package.json node_modules

clean:
	rm -rf *.zip node_modules
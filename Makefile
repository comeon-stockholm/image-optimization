.PHONY:	dist test clean

node_modules:	package.json
			npm install

test:		node_modules
			node __tests__/resize.test.js

dist:	node_modules
			zip -r image-optimization.zip index.js config.js package.json node_modules

clean:
	rm -rf *.zip node_modules
/*
 * Copyright (c) 2012-2021, Sam Atkins <atkinssj@gmail.com>
 *
 * SPDX-License-Identifier: MIT
 */
function toggleDesaturate() {
	/* Check for our style tag:
		If desaturate.js has been run already, the <style> tag will exist.
		In this case, delete it and reset the images.
	*/
	let styleElement = document.getElementById("_desaturate_js");
	if (styleElement) {
		styleElement.parentNode.removeChild(styleElement);
		return;
	}

	/* Create our stylesheet object */
	styleElement = document.createElement('style');
	styleElement.id = "_desaturate_js";
	document.body.appendChild( styleElement );

	/* These are the css properties we want to adjust */
	const colorProperties = [
		"backgroundColor",
		"borderBottomColor",
		"borderLeftColor",
		"borderRightColor",
		"borderTopColor",
		"color",
		"outlineColor"
	];
	/* These are the css names for the above properties */
	const cssPropertyNames = {
		"backgroundColor": "background-color",
		"borderBottomColor": "border-bottom-color",
		"borderLeftColor": "border-left-color",
		"borderRightColor": "border-right-color",
		"borderTopColor": "border-top-color",
		"color": "color",
		"outlineColor": "outline-color"
	};

	const hex = "[0-9a-f]",
		rgb = "(\\d|[1-9]\\d|[12]\\d\\d)",
		alpha = "[01]|0\\.\\d+";
	const regexes = {
		rgb: new RegExp(`rgb\\(\\s*${rgb}\\s*,\\s*${rgb}\\s*,\\s*${rgb}\\s*\\)`, "i" ),
		rgba: new RegExp(`rgba\\(\\s*${rgb}\\s*,\\s*${rgb}\\s*,\\s*${rgb}\\s*,\\s*${alpha}\\s*\\)`, "i" ),
		hex6: new RegExp(`#(${hex}${hex})(${hex}${hex})(${hex}${hex})`, "i"),
		hex3: new RegExp(`#(${hex})(${hex})(${hex})`, "i")
	};

	/**
	 * Converts an RGB color value to HSL. Conversion formula
	 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
	 * Assumes r, g, and b are contained in the set [0, 255] and
	 * returns h, s, and l as expected for css.
	 */
	function rgbToHsl(r, g, b, a){
	    r /= 255;
		g /= 255;
		b /= 255;
	    let max = Math.max(r, g, b), min = Math.min(r, g, b);
	    let h, s, l = (max + min) / 2;

	    if(max === min){
	        h = s = 0; /* achromatic */
	    }else{
	        let d = max - min;
	        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	        switch(max){
	            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
	            case g: h = (b - r) / d + 2; break;
	            case b: h = (r - g) / d + 4; break;
	        }
	        h /= 6;
	    }

	    h *= 360;
	    s *= 100;
	    l *= 100;
	    return [h, s, l, a];
	}

	/**
	 * Convert color to HSL, with a saturation of 0%
	 */
	function desaturate(color, regexes) {
		let hsla = [];

		/* Figure-out what kind of color this is */
		if (regexes.rgb.test(color)) {
			/* rgb(255, 255, 255) */
			const rgb = regexes.rgb.exec(color);
			hsla = rgbToHsl(rgb[1], rgb[2], rgb[3], 1);
			console.log("rgb", rgb, hsla);

		} else if (regexes.rgba.test(color)) {
			/* rgba(255, 255, 255, 0.5) */
			const rgba = regexes.rgba.exec(color);
			hsla = rgbToHsl(rgba[1], rgba[2], rgba[3], rgba[4]);
			console.log("rgba", rgba, hsla);

		} else if (regexes.hex6.test(color)) {
			const hex = regexes.hex6.exec(color);
			hsla = rgbToHsl( parseInt(hex[1],16), parseInt(hex[2],16), parseInt(hex[3],16), 1 );
			console.log("hex6", hex, hsla);

		} else if (regexes.hex3.test(color)) {
			const hex = regexes.hex3.exec(color);
			hsla = rgbToHsl( parseInt(hex[1],16), parseInt(hex[2],16), parseInt(hex[3],16), 1 );
			console.log("hex3", hex, hsla);
		} else if (color === "transparent") {
			hsla = [0,0,0,0];
		}

		hsla[1] = 0; /* Desaturate */

		return `hsla(${hsla[0]}, ${hsla[1]}%, ${hsla[2]}%, ${hsla[3]})`;
	}

	function desaturateImage(image) {
		let canvas = document.createElement('canvas');
		let ctx = canvas.getContext('2d');

		/* Resize canvas and draw the image */
		ctx.canvas.width = image.naturalWidth || image.offsetWidth || image.width;
		ctx.canvas.height = image.naturalHeight || image.offsetHeight || image.height;
		ctx.drawImage(image, 0, 0);

		/* Get pixel data and desaturate it */
		let pixels = ctx.getImageData(0, 0, image.width, image.height);
		for (let i=0, n = pixels.data.length; i < n; i+=4) {
			let intensity = 0.3 * pixels.data[i]
							+ 0.59 * pixels.data[i+1]
							+ 0.11 * pixels.data[i+2];
			pixels.data[i] = intensity;
			pixels.data[i+1] = intensity;
			pixels.data[i+2] = intensity;
		}
		ctx.putImageData(pixels, 0, 0);

		/* Save results in the original image */
		image.src = ctx.canvas.toDataURL('image/png');
	}

	function handleRules(cssRulesList) {
		/* Iterate through style rules */
		for (let j=0; j<cssRulesList.length; j++) {
			let rule = cssRulesList[j];
			let toAdd = {};
			let toAddLength = 0;

			/* If rule is a CSSMediaRule, we need to get its innards. */
			if (rule.constructor.name === "CSSMediaRule") {
				handleRules(rule.cssRules);
				continue;
			}

			/* For each of the 'colorProperties', see if it's here */
			for (let k=0; k<colorProperties.length; k++) {
				if (rule.style[colorProperties[k]] !== "") {
					/* Add this rule to the thing! */
					toAdd[colorProperties[k]] = rule.style[colorProperties[k]];
					toAddLength++;
				}
			}

			/* If any of the declarations were relevant, adjust them and add them to our style object */
			if (toAddLength) {
				let selector = rule.selectorText;
				let declaration = selector + " { ";
					for (let prop in toAdd) {
						let val = desaturate(toAdd[prop], regexes);
						let propName = cssPropertyNames[prop];
						declaration += `${propName}: ${val}; `;
					}
				declaration += " } \n";
				styleElement.innerHTML += declaration;
			}
		}
	}

	/* Iterate through document stylesheets */
	let ss = document.styleSheets;
	for (let i=0; i<(ss.length-1); i++) {
		console.log(i, ss[i].href);

		/* If there are no style rules, skip this sheet */
		if (!ss[i].cssRules) {
			console.log("No rules.");
			continue;
		}

		handleRules(ss[i].cssRules);
	}

	/* Iterate through document images */
	for (let i=0; i < document.images.length; i++) {
		try {
			desaturateImage(document.images[i]);
		} catch (e) {
			console.error(e);
		}
	}
}
toggleDesaturate();
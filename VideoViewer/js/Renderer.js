"use strict";

function renderer(segments, colorTableArray=LUT['gray']) {
    // IE, Edge, Safari only support webgl 1.0 as of 25.09.2017
    //var gl = document.getElementById("canvas").getContext("webgl2");
    var gl = document.getElementById("canvas").getContext("experimental-webgl");
    if (!gl) {
        alert("Sorry, this example requires WebGL 2.0");  // eslint-disable-line
        return;
    }

    var programInfo = twgl.createProgramInfo(gl, ["vs", "fs"]);
	gl.useProgram(programInfo.program);
	
    segments.forEach(function (seg) {
        seg.init();
    });
    
	gl.activeTexture(gl.TEXTURE0);
	var tex = twgl.createTexture(gl, {
		width: 256,
		height: 1,  // 1D texture
		internalFormat: gl.RGBA,  // 4 channels
		target: gl.TEXTURE_2D,
		src: colorTableArray,
		min: gl.LINEAR,
		wrap: gl.CLAMP_TO_EDGE,
	});
	gl.uniform1i(gl.getUniformLocation(programInfo.program, "colorTable"), 0);
	
    function render(time) {
        var frameIndex = Math.round(time * 0.032) % 64;

        twgl.resizeCanvasToDisplaySize(gl.canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        

        segments.forEach(function (segment) {
            segment.render(gl, frameIndex, programInfo);
        });

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}
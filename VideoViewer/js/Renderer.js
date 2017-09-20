"use strict";

function main() {
    var gl = document.getElementById("canvas").getContext("webgl2");
    if (!gl) {
        alert("Sorry, this example requires WebGL 2.0");  // eslint-disable-line
        return;
    }

    var programInfo = twgl.createProgramInfo(gl, ["vs", "fs"]);

    var arrays = {
        vPosition: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
        vTexCoord: [0,0,  0,1,  1,1,  1,0],
        indices: [0, 1, 2,  0, 2, 3],
    };
    var bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);


    var seg = new Segment("2012_08_31__18_59_59_35_2_5.mp4", document.getElementById("hack").getContext("2d"));
    seg.init();
    
    function render(time) {
        time *= 0.001;

        var frameIndex = Math.round(time * 10) % 60;

        var tex;
        if (seg.counter > frameIndex) 
        {
            tex = twgl.createTexture(gl, {
                target: gl.TEXTURE_2D,
                src: seg.frames[frameIndex].data,
            });
        }
        else
        {
            tex = twgl.createTexture(gl, {
                target: gl.TEXTURE_2D,
                src: "clover.jpg",
            });
        }

        var uniforms = {
            segmentTexture: tex,
        };

        twgl.resizeCanvasToDisplaySize(gl.canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.useProgram(programInfo.program);
        twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
        twgl.setUniforms(programInfo, uniforms);
        twgl.drawBufferInfo(gl, bufferInfo);

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}
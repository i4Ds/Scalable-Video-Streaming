"use strict";

function main() {
    // IE, Edge, Safari only support webgl 1.0 as of 25.09.2017
    //var gl = document.getElementById("canvas").getContext("webgl2");
    var gl = document.getElementById("canvas").getContext("experimental-webgl");
    if (!gl) {
        alert("Sorry, this example requires WebGL 2.0");  // eslint-disable-line
        return;
    }

    var programInfo = twgl.createProgramInfo(gl, ["vs", "fs"]);

    var segments = [
        new Segment("35__0_4.mp4", 1024, 0, 4),
        new Segment("35__0_5.mp4", 1024, 0, 5),
        new Segment("35__1_4.mp4", 1024, 1, 4),
        new Segment("35__1_5.mp4", 1024, 1, 5),
        new Segment("35__2_4.mp4", 1024, 2, 4),
        new Segment("35__2_5.mp4", 1024, 2, 5),
    ];

    segments.forEach(function (seg) {
        seg.init();
    });
    
    function render(time) {
        time *= 0.001;

        var frameIndex = Math.round(time * 32) % 64;



        twgl.resizeCanvasToDisplaySize(gl.canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.useProgram(programInfo.program);

        segments.forEach(function (segment) {
            segment.render(gl, frameIndex, programInfo);
        });

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}
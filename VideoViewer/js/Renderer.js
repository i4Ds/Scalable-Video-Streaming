"use strict";

const TILE_SIZE = 512;
const MIN_ZOOM = 0;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

class Renderer {
	constructor(segments, colorTableArray=LUT['gray']) {
		this.segments = segments;
		this.zoom = 0;
		this.vidRes = TILE_SIZE;
		this.displayRes = TILE_SIZE;
		
		// IE, Edge, Safari only support webgl 1.0 as of 25.09.2017
		this.gl = document.getElementById("canvas").getContext("experimental-webgl");  //this.gl = document.getElementById("canvas").getContext("webgl2");
		if (!this.gl) {
			alert("Sorry, this example requires WebGL");  // eslint-disable-line
			return;
		}
		
		this.setZoom(0);
		this.activateSegments();
		

		this.programInfo = twgl.createProgramInfo(this.gl, ["vs", "fs"]);
		this.gl.useProgram(this.programInfo.program);
		
		this.gl.activeTexture(this.gl.TEXTURE0);
		var texColor = twgl.createTexture(this.gl, {
			width: 256,
			height: 1,  // 1D texture
			internalFormat: this.gl.RGBA,  // 4 channels
			target: this.gl.TEXTURE_2D,
			src: colorTableArray,
			min: this.gl.LINEAR,
			wrap: this.gl.CLAMP_TO_EDGE,
		});
		this.gl.uniform1i(this.gl.getUniformLocation(this.programInfo.program, "colorTable"), 0);
		
		this.gl.activeTexture(this.gl.TEXTURE1);
		this.texFrame = twgl.createTexture(this.gl, {
			width: TILE_SIZE,
			height: TILE_SIZE,
			internalFormat: this.gl.LUMINANCE,  // uses only 1 channel, this.gl.R8 only works in webgl 2.0
			target: this.gl.TEXTURE_2D,
			src: new Uint8Array(TILE_SIZE*TILE_SIZE),
		});
		this.gl.uniform1i(this.gl.getUniformLocation(this.programInfo.program, "segmentTexture"), 1);

		
		var renderer = this;
		this.gl.canvas.onmousedown = function(e) { renderer.mousedown = [e.screenX + window.scrollX, e.screenY + window.scrollY]; };
		this.gl.canvas.onmouseup = function(e) { renderer.mousedown = null; };
		this.gl.canvas.onmouseleave = function(e) { renderer.mousedown = null; };
		this.gl.canvas.onmousemove = function(e) {
			if(renderer.mousedown != null) {
				window.scrollTo(renderer.mousedown[0] - e.screenX, renderer.mousedown[1] - e.screenY);
				renderer.mousedown = [e.screenX + window.scrollX, e.screenY + window.scrollY];
				renderer.activateSegments();
			}
		};
		document.onwheel = function(e) {
			renderer.setZoom(e.deltaY / Math.abs(e.deltaY) * ZOOM_STEP);  // zoom into center (or also mouse pointer -> stick to edge(s) of mouse?)
			e.preventDefault();
			return false;
		};
		this.gl.canvas.onwheel = function(e) {
			renderer.setZoom(e.deltaY / Math.abs(e.deltaY) * ZOOM_STEP); // e.offsetX (clientX?)  TODO  zoom into where mouse is
			e.preventDefault();
			return false;
		};
	}
	
	render(time) {
		var frameIndex = Math.round(time * 0.032) % 64;

		// twgl.resizeCanvasToDisplaySize(this.gl.canvas);
		this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
		
		var nextFrameIsReady = true;
		for(var i=0; i < this.segments.length; ++i) {
			if(this.segments[i].isActive && this.segments[i].counter <= frameIndex) {
				nextFrameIsReady = false;
				break;
			}
		}
		
		if(nextFrameIsReady) {
			this.segments.forEach(function (segment) {
				segment.render(this.gl, frameIndex, this.programInfo, this.texFrame);
			}, this);
		}

		requestAnimationFrame(this.render.bind(this));
	}
	
	setZoom(zoomChange) {
		this.zoom -= zoomChange;
		this.zoom = Math.min(MAX_ZOOM, this.zoom);
		this.zoom = Math.max(MIN_ZOOM, this.zoom);
		
		this.vidRes = Math.pow(2, parseInt(this.zoom + ZOOM_STEP)) * TILE_SIZE;
		this.gl.canvas.width = this.vidRes;
		this.gl.canvas.height = this.vidRes;
		
		this.displayRes = Math.pow(2, this.zoom) * TILE_SIZE;
		this.gl.canvas.style.width = this.displayRes + "px";
		
		this.activateSegments();
	}
	
	activateSegments() {
		var frameborder = 0;
		var cssTileSize = TILE_SIZE * this.displayRes / this.vidRes;
		var startX = parseInt((window.scrollX + frameborder) / cssTileSize);
		var endX = parseInt((window.scrollX + window.innerWidth - frameborder) / cssTileSize);
		var startY = parseInt((window.scrollY  + frameborder) / cssTileSize);
		var endY = parseInt((window.scrollY + window.innerHeight - frameborder) / cssTileSize);
		this.segments.forEach(function (seg) {
			if(seg.canvRes == this.vidRes && seg.x >= startX && seg.x <= endX && seg.y >= startY && seg.y <= endY) {
				seg.activate();  // init (load and decode) if necessary
			} else {
				seg.deactivate();
			}
		}, this)
	}
}

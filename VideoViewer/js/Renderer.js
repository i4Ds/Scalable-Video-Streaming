"use strict";

const TILE_SIZE = 512;
const MIN_ZOOM = 0;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

class Renderer {
	constructor(segments, colorTableArray=LUT['gray'], fps=25, frameCount=50, folders=[]) {
		this.segments = segments;
		this.nextSegments = [];
		this.fps = fps;
		this.frameCount = frameCount;
		this.zoom = 0;
		this.vidRes = TILE_SIZE;
		this.displayRes = TILE_SIZE;
		this.folders = folders;  // sequence of videos where each video tree is expected in a separate file folder
		this.currFolderIdx = 0;
		this.decoded = 0;
		this.toBeDecoded = 0;
		
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
		window.addEventListener("wheel", e => {
			renderer.setZoom(Math.sign(e.deltaY) * ZOOM_STEP, e.clientX, e.clientY);
			e.preventDefault();
			return false;
		}, {passive: false});
	}
	
	render(time) {
		var frameIndex = Math.round(time / 1000 * this.fps) % (this.frameCount * Math.max(1, this.folders.length));
		if(frameIndex >= this.frameCount * (this.currFolderIdx+1) || frameIndex < this.frameCount * this.currFolderIdx) {
			this.segments.forEach(function (seg) { seg.deactivate(); } );  // deactivate all old segments
			this.segments = this.nextSegments;
			this.currFolderIdx = (this.currFolderIdx + 1) % this.folders.length;
			if(this.decoded == this.toBeDecoded) {
				this.loadNextSegments();
			}
			this.activateSegments();
		}
		var curFrameIdx = frameIndex % this.frameCount;

		// twgl.resizeCanvasToDisplaySize(this.gl.canvas);
		this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
		
		var nextFrameIsReady = true;
		for(var i=0; i < this.segments.length; ++i) {
			if(this.segments[i].isActive && this.segments[i].counter <= curFrameIdx) {
				nextFrameIsReady = false;
				break;
			}
		}
		
		if(nextFrameIsReady) {
			this.segments.forEach(function (segment) {
				segment.render(this.gl, curFrameIdx, this.programInfo, this.texFrame);
			}, this);
		}

		requestAnimationFrame(this.render.bind(this));
	}
	
	setZoom(zoomChange, x, y) {
		// get 0..1 coordinates on old canvas size
		var canvX = (x + window.scrollX) / this.displayRes;
		var canvY = (y + window.scrollY) / this.displayRes;
		
		this.zoom -= zoomChange;
		this.zoom = Math.min(MAX_ZOOM, this.zoom);
		this.zoom = Math.max(MIN_ZOOM, this.zoom);
		
		this.vidRes = Math.pow(2, parseInt(this.zoom + ZOOM_STEP)) * TILE_SIZE;
		this.gl.canvas.width = this.vidRes;
		this.gl.canvas.height = this.vidRes;
		
		this.displayRes = Math.pow(2, this.zoom) * TILE_SIZE;
		this.gl.canvas.style.width = this.displayRes + "px";  // display size of canvas
		
		// calculate viewport offset
		var scrollX = canvX * this.displayRes - x;
		var scrollY = canvY * this.displayRes - y;
		window.scrollTo(scrollX, scrollY);
		
		this.activateSegments();
	}
	
	activateSegments() {
		var frameborder = 0;
		var cssTileSize = TILE_SIZE * this.displayRes / this.vidRes;
		var startX = parseInt((window.scrollX + frameborder) / cssTileSize);
		var endX = parseInt((window.scrollX + window.innerWidth - frameborder) / cssTileSize);
		var startY = parseInt((window.scrollY  + frameborder) / cssTileSize);
		var endY = parseInt((window.scrollY + window.innerHeight - frameborder) / cssTileSize);
		this.toBeDecoded = 0;
		this.decoded = 0;
		this.segments.forEach(function (seg) {
			if(seg.canvRes == this.vidRes && seg.x >= startX && seg.x <= endX && seg.y >= startY && seg.y <= endY) {
				var callback = this.onSegmentDecoded.bind(this);
				if(seg.activate(callback)) {  // init (load and decode) if necessary
					++this.toBeDecoded; 
				}
			} else {
				seg.deactivate();
			}
		}, this);
	}
	
	onSegmentDecoded(decodedSegment) {
		++this.decoded;
		if(this.folders.length > 0 && this.decoded == this.toBeDecoded && decodedSegment.videoUrl.includes("/" + this.folders[this.currFolderIdx] + "/")) {
			this.loadNextSegments(); // if decoded segment was of the current folder, load next segments
		}
	}
	
	loadNextSegments() {
		this.nextSegments = [];
		this.toBeDecoded = 0;
		this.decoded = 0;
		var currFolderStr = "/" + this.folders[this.currFolderIdx] + "/";
		var nextFolderStr = "/" + this.folders[(this.currFolderIdx + 1) % this.folders.length] + "/";
		
		console.log("load next segment. " + currFolderStr + " -> " + nextFolderStr + "  frames: " + this.segments.length);
		this.segments.forEach(function (seg) {
			var newSeg = new Segment(seg.videoUrl.replace(currFolderStr, nextFolderStr), seg.vidRes, seg.canvRes, seg.x, seg.y)
			if(seg.active) {
				++this.toBeDecoded;
				newSeg.init();  // init (load and decode) if necessary
			}
			this.nextSegments.push(newSeg);
		}, this);
	}
}
